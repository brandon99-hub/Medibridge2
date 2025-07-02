import type { Request, Response, NextFunction } from 'express';

// Ensure Express Request type is augmented if not already globally for req.user
// This was done in auth.ts, but good to be mindful.
// declare global {
//   namespace Express {
//     interface User {
//       isAdmin?: boolean;
//     }
//   }
// }

export function requireAdminAuth(req: Request, res: Response, next: NextFunction) {
  console.log("ADMIN CHECK req.user:", req.user);
  if (!req.isAuthenticated() || !req.user) {
    // This check might be redundant if all routes using this are already behind a general isAuthenticated check
    // but it's good for explicitness.
    return res.status(401).json({ message: "Authentication required." });
  }

  if (req.user.isAdmin !== true) {
    return res.status(403).json({ message: "Forbidden: Administrator access required." });
  }

  next();
}
