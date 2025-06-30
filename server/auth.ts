import passport from "passport";
import { Strategy as LocalStrategy } from "passport-local";
import { Express } from "express";
import session from "express-session";
import { scrypt, randomBytes, timingSafeEqual } from "crypto";
import { promisify } from "util";
import { storage } from "./storage";
import { User as SelectUser } from "@shared/schema";
import { auditService } from "./audit-service";

declare global {
  namespace Express {
    interface User extends SelectUser {}
  }
}

const scryptAsync = promisify(scrypt);

async function hashPassword(password: string) {
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

export function setupAuth(app: Express) {
  const sessionSettings: session.SessionOptions = {
    secret: process.env.SESSION_SECRET!,
    resave: false,
    saveUninitialized: false,
    store: storage.sessionStore,
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
    done(null, user);
  });

  app.post("/api/register", async (req, res, next) => {
    const existingUser = await storage.getUserByUsername(req.body.username);
    if (existingUser) {
      return res.status(400).send("Username already exists");
    }

    const user = await storage.createUser({
      ...req.body,
      password: await hashPassword(req.body.password),
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
