import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { createClient } from "redis";
import { RedisStore } from "connect-redis";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser, User } from "@shared/schema";
import { auditService } from "./audit-service";
import { redisService } from "./redis-service";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

export async function hashPassword(password: string) {
  const salt = randomBytes(16).toString("hex");
  const buf = (await scryptAsync(password, salt, 64)) as Buffer;
  return `${buf.toString("hex")}.${salt}`;
}

async function comparePasswords(supplied: string, stored: string) {
  const [hashed, salt] = stored.split(".");
  const hashedBuf = Buffer.from(hashed, "hex");
  const suppliedBuf = (await scryptAsync(supplied, salt, 64)) as Buffer;
  return timingSafeEqual(hashedBuf, suppliedBuf);
}

export async function setupAuth(app: Express) {
  // Wait for Redis to be ready
  let redisStore;
  try {
    // Wait for Redis connection to be established
    const isConnected = await redisService.healthCheck();
    if (!isConnected) {
      console.warn('[AUTH] Redis not available, falling back to memory store');
      redisStore = undefined;
    } else {
      // Create a dedicated Redis client for sessions to avoid conflicts
      const sessionRedisClient = createClient({
        url: process.env.REDIS_URL || `redis://${process.env.REDIS_HOST || 'localhost'}:${process.env.REDIS_PORT || '6379'}`,
        password: process.env.REDIS_PASSWORD,
        database: parseInt(process.env.REDIS_DB || '0'),
      });
      
      await sessionRedisClient.connect();
      
      console.log('[AUTH] Using Redis session store');
      redisStore = new RedisStore({
        client: sessionRedisClient,
        prefix: "medibridge:sess:",
        ttl: 3600, // 1 hour
      });
    }
  } catch (error) {
    console.error('[AUTH] Failed to initialize Redis session store:', error);
    redisStore = undefined; // Fallback to memory store
  }

  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: redisStore, // Will use memory store if Redis is not available
    cookie: {
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      maxAge: 3600000, // 1 hour
    },
  };

  app.set("trust proxy", 1);
  app.use(session(sessionSettings));
  app.use(passport.initialize());
  app.use(passport.session());

  passport.use(
    new LocalStrategy(async (username, password, done) => {
      const user = await storage.getUserByUsername(username);
      if (!user || !(await comparePasswords(password, user.password))) {
        return done(null, false);
      } else {
        return done(null, user);
      }
    }),
  );

  passport.serializeUser((user, done) => done(null, user.id));
  passport.deserializeUser(async (id: number, done) => {
    const user = await storage.getUser(id);
    if (user) {
      // If user comes from DB with is_admin, map it to isAdmin
      if ('is_admin' in user) {
        user.isAdmin = user.isAdmin ?? user.is_admin ?? false;
      }
    }
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    // Generate a unique hospital_id for new hospital registrations
    const allUsers = await storage.getAllUsers();
    const maxHospitalId = Math.max(0, ...allUsers.map((user: User) => user.hospital_id || 0));
    const newHospitalId = maxHospitalId + 1;

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
      hospital_id: newHospitalId, // Assign unique hospital_id
      isAdmin: true, // Make new hospital registrations admin by default
    });

    req.login(user, (err) => {
      if (err) return next(err);
      res.status(201).json(user);
    });
  });

  app.post("/api/login", async (req, res, next) => {
    passport.authenticate("local", async (err: any, user: any, info: any) => {
      if (err) {
        await auditService.logEvent({
          eventType: "LOGIN_FAILURE",
          actorType: "HOSPITAL",
          actorId: req.body.username || "unknown",
          targetType: "AUTH_SYSTEM",
          targetId: "login",
          action: "AUTHENTICATE",
          outcome: "FAILURE",
          metadata: { error: err.message },
          severity: "warning",
        }, req);
        return next(err);
      }
      
      if (!user) {
        await auditService.logEvent({
          eventType: "LOGIN_FAILURE",
          actorType: "HOSPITAL",
          actorId: req.body.username || "unknown",
          targetType: "AUTH_SYSTEM",
          targetId: "login",
          action: "AUTHENTICATE",
          outcome: "FAILURE",
          metadata: { reason: "Invalid credentials" },
          severity: "warning",
        }, req);
        return res.status(401).json({ message: "Invalid credentials" });
      }
      
      req.login(user, async (err) => {
        if (err) {
          await auditService.logEvent({
            eventType: "LOGIN_FAILURE",
            actorType: "HOSPITAL",
            actorId: user.username,
            targetType: "AUTH_SYSTEM",
            targetId: "login",
            action: "AUTHENTICATE",
            outcome: "FAILURE",
            metadata: { error: err.message },
            severity: "warning",
          }, req);
          return next(err);
        }
        
        await auditService.logEvent({
          eventType: "LOGIN_SUCCESS",
          actorType: "HOSPITAL",
          actorId: user.username,
          targetType: "AUTH_SYSTEM",
          targetId: "login",
          action: "AUTHENTICATE",
          outcome: "SUCCESS",
          metadata: { hospitalId: user.id, hospitalType: user.hospitalType },
          severity: "info",
        }, req);
        
        res.status(200).json(user);
      });
    })(req, res, next);
  });

  app.post("/api/logout", async (req, res, next) => {
    if (req.isAuthenticated()) {
      await auditService.logEvent({
        eventType: "LOGOUT",
        actorType: "HOSPITAL",
        actorId: req.user?.username || "unknown",
        targetType: "AUTH_SYSTEM",
        targetId: "logout",
        action: "LOGOUT",
        outcome: "SUCCESS",
        metadata: { hospitalId: req.user?.id, hospitalType: req.user?.hospitalType },
        severity: "info",
      }, req);
    }
    
    req.logout((err) => {
      if (err) return next(err);
      res.sendStatus(200);
    });
  });

  app.get("/api/user", (req, res) => {
    if (!req.isAuthenticated()) return res.sendStatus(401);
    res.json(req.user);
  });
}
