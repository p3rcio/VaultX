// JWT verification middleware — checks the Authorization header and attaches the decoded payload
import { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import { config } from "../config";

export interface AuthPayload {
  userId: string;
  email: string;
}

// extends the Express Request type so TypeScript knows req.auth exists on protected routes
declare global {
  namespace Express {
    interface Request {
      auth?: AuthPayload;
    }
  }
}

// runs before any protected route handler — rejects requests without a valid JWT
export function requireAuth(req: Request, res: Response, next: NextFunction): void {
  const header = req.headers.authorization;
  // must be "Bearer <token>" — anything else gets rejected
  if (!header?.startsWith("Bearer ")) {
    res.status(401).json({ error: "Missing or invalid Authorization header" });
    return;
  }

  const token = header.slice(7); // strip the "Bearer " prefix
  try {
    // jwt.verify checks both the signature and expiry in one call
    const payload = jwt.verify(token, config.jwtSecret) as AuthPayload;
    req.auth = payload; // attach decoded user info so route handlers can read it
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}
