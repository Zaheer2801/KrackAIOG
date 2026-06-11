import { Request, Response, NextFunction } from "express";
import { verifyToken } from "../utils/jwt";
import User from "../models/user";

export interface JwtPayload {
  _id: string;
  username: string;
  email: string;
  role: string;
}

export interface AuthenticatedRequest extends Request {
  user?: JwtPayload;
}

export const authenticate = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
      res.status(401).json({ message: "Authorization header missing." });
      return;
    }

    const token = authHeader.split(" ")[1];

    if (!token) {
      res.status(401).json({ message: "Token missing." });
      return;
    }

    let decoded: any;
    try {
      decoded = verifyToken(token);
    } catch {
      res.status(401).json({ message: "Invalid or expired token." });
      return;
    }

    if (!decoded || !("_id" in decoded)) {
      res.status(401).json({ message: "Invalid or expired token." });
      return;
    }

    // Admin-master is hardcoded — skip DB expiry check
    if (decoded._id !== "admin-master") {
      let user: any;
      try {
        user = await User.findById(decoded._id).select("expiresAt role").lean();
      } catch {
        // DB unavailable — fail closed: do not allow the request through
        res.status(503).json({ message: "Service temporarily unavailable. Please try again." });
        return;
      }
      if (!user) {
        res.status(401).json({ message: "Account not found." });
        return;
      }
      if (user.expiresAt && new Date() > new Date(user.expiresAt)) {
        res.status(403).json({ message: "Access code expired. Please contact the administrator." });
        return;
      }
    }

    req.user = {
      _id: decoded._id,
      username: decoded.username || '',
      email: decoded.email || '',
      role: decoded.role || 'user',
    };

    next();
  } catch (err) {
    next(err);
  }
};
