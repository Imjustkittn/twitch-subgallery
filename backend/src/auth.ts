import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';
import type { ExtJWT } from './types.js';

const extSecret = Buffer.from(process.env.EXT_SECRET_BASE64!, 'base64');

export function requireExtJWT(req: Request, res: Response, next: NextFunction) {
  const token = (req.headers['x-extension-jwt'] ||
    req.headers['authorization']?.toString().replace(/^Bearer\s+/i, '')) as string | undefined;
  if (!token) return res.status(401).json({ error: 'missing_token' });
  try {
    const decoded = jwt.verify(token, extSecret, { algorithms: ['HS256'] }) as jwt.JwtPayload & ExtJWT;
    (req as any).ext = decoded;
    return next();
  } catch {
    return res.status(403).json({ error: 'invalid_token' });
  }
}

export function requireBroadcaster(req: Request, res: Response, next: NextFunction) {
  const ext = (req as any).ext as ExtJWT | undefined;
  if (!ext) return res.status(401).end();
  if (ext.role !== 'broadcaster') return res.status(403).json({ error: 'forbidden' });
  next();
}
