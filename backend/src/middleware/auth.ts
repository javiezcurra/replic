import * as admin from 'firebase-admin'
import { Request, Response, NextFunction } from 'express'
import { adminAuth, adminDb } from '../lib/firebase'

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

/**
 * Like requireAuth but non-fatal: sets req.user when a valid Bearer token is
 * present, then continues. Used for public routes that also serve additional
 * content to authenticated users (e.g. draft visibility on GET /designs/:id).
 */
export async function optionalAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      req.user = await adminAuth.verifyIdToken(token)
    } catch {
      // Invalid or expired token — proceed as unauthenticated
    }
  }
  next()
}

/** Must be used after requireAuth. Returns 403 if the caller is not an admin. */
export async function requireAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb.collection('users').doc(req.user!.uid).get()
    if (!snap.exists || snap.data()?.is_admin !== true) {
      res.status(403).json({ status: 'error', message: 'Admin access required' })
      return
    }
    next()
  } catch {
    res.status(403).json({ status: 'error', message: 'Admin access required' })
  }
}
