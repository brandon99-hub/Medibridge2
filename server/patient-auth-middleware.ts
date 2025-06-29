import type { Request, Response, NextFunction } from 'express';

// Extend Express Request type to include session from express-session
// and our custom patientDID property on the session.
declare global {
  namespace Express {
    interface Request {
      session: import('express-session').Session & Partial<import('express-session').SessionData> & {
        patientDID?: string;
      };
    }
  }
}

export function requirePatientAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.patientDID) {
    return res.status(401).json({ error: "Patient authentication required. Please login." });
  }
  // Placeholder for potential additional validation:
  // For example, check if the patientDID in the session is still valid/exists in the database.
  // This would require async operations and access to 'storage', so it's kept simple for now.
  // e.g., const patient = await storage.getPatientProfileByDID(req.session.patientDID);
  // if (!patient) { return res.status(401).json({ error: "Invalid session." }); }
  next();
}
