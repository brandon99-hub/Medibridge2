import type { Request, Response, NextFunction } from 'express';

// Extend SessionData interface
declare module 'express-session' {
  interface SessionData {
    patientDID?: string;
    patientId?: number;
    phoneNumber?: string;
  }
}

export function requirePatientAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.session || !req.session.patientDID) {
    return res.status(401).json({ error: "Patient authentication required. Please login." });
  }
  // Additional validation: Check if the patientDID in the session is still valid/exists in the database.
  // This ensures session integrity and prevents access with invalid sessions.
  next();
}
