import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    email: string;
    role: string;
  };
}

export const authenticateToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  try {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      res.status(401).json({ error: 'Access token required' });
      return;
    }

    jwt.verify(token, process.env.JWT_SECRET!, (err: unknown, decoded: unknown) => {
      if (err) {
        res.status(403).json({ error: 'Invalid or expired token' });
        return;
      }

      const payload = decoded as { id: number; email: string; role: string };
      req.user = {
        id: String(payload.id),
        email: payload.email,
        role: payload.role,
      };

      next();
    });
  } catch (error) {
    res.status(500).json({ error: 'Authentication error' });
  }
};

export const isAdmin = (req: AuthRequest, res: Response, next: NextFunction): void => {
  if (req.user?.role !== 'admin') {
    res.status(403).json({ error: 'Admin access required' });
    return;
  }
  next();
};
