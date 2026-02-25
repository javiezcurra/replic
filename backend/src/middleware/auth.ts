import * as admin from 'firebase-admin'
import { Request, Response, NextFunction } from 'express'
import { adminAuth } from '../lib/firebase'

declare global {
  namespace Express {
    interface Request {
      user?: admin.auth.DecodedIdToken
    }
  }
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).json({ status: 'error', message: 'Missing authorization header' })
    return
  }

  const token = authHeader.slice(7)
  try {
    req.user = await adminAuth.verifyIdToken(token)
    next()
  } catch {
    res.status(401).json({ status: 'error', message: 'Invalid or expired token' })
  }
}
