import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { UserProfile, UserProfileResponse } from '../types/user'
import { Design } from '../types/design'
import { AppError } from '../middleware/errorHandler'
import { createNotification } from '../lib/notifications'

const USERS = 'users'
const PAGE_SIZE = 25

function toResponse(profile: UserProfile): UserProfileResponse {
  return {
    ...profile,
    createdAt: profile.createdAt.toDate().toISOString(),
    updatedAt: profile.updatedAt.toDate().toISOString(),
  }
}

function badRequest(msg: string): AppError {
  const err: AppError = new Error(msg)
  err.statusCode = 400
  return err
}

// ─── GET /api/admin/users ─────────────────────────────────────────────────────
// All users, ordered by createdAt desc, paginated (page param), searchable (q param).
export async function listAllUsers(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const q = ((req.query.q as string) ?? '').trim().toLowerCase()
    const page = Math.max(1, parseInt((req.query.page as string) ?? '1', 10))
    const offset = (page - 1) * PAGE_SIZE

    // Fetch all users for search/count (Firestore doesn't support full-text search)
    const snap = await adminDb.collection(USERS).orderBy('createdAt', 'desc').get()
    const allUsers = snap.docs.map((d) => d.data() as UserProfile)

    const filtered = q
      ? allUsers.filter(
          (u) =>
            u.displayName.toLowerCase().includes(q) ||
            u.email.toLowerCase().includes(q),
        )
      : allUsers

    const total = filtered.length
    const paginated = filtered.slice(offset, offset + PAGE_SIZE)
    const data = paginated.map(toResponse)

    res.json({
      status: 'ok',
      data,
      total,
      page,
      totalPages: Math.ceil(total / PAGE_SIZE),
    })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/users/admins ──────────────────────────────────────────────
// All users with is_admin === true.
export async function listAdmins(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb
      .collection(USERS)
      .where('is_admin', '==', true)
      .get()
    const data = snap.docs
      .map((d) => toResponse(d.data() as UserProfile))
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))
    res.json({ status: 'ok', data, total: data.length })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/admin/users/:uid/make-admin ───────────────────────────────────
export async function makeAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { uid } = req.params
    if (uid === req.user!.uid) return next(badRequest('You cannot change your own admin status'))

    const ref = adminDb.collection(USERS).doc(uid)
    const snap = await ref.get()
    if (!snap.exists) {
      const err: AppError = new Error('User not found')
      err.statusCode = 404
      return next(err)
    }

    await ref.update({ is_admin: true, updatedAt: FieldValue.serverTimestamp() })

    createNotification(uid, {
      type: 'admin_granted',
      message: 'You have been granted Admin privileges on Replic.',
      link: '/admin/users',
    })

    res.json({ status: 'ok' })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/admin/users/:uid/revoke-admin ─────────────────────────────────
export async function revokeAdmin(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { uid } = req.params
    if (uid === req.user!.uid) return next(badRequest('You cannot change your own admin status'))

    const ref = adminDb.collection(USERS).doc(uid)
    const snap = await ref.get()
    if (!snap.exists) {
      const err: AppError = new Error('User not found')
      err.statusCode = 404
      return next(err)
    }

    await ref.update({ is_admin: false, updatedAt: FieldValue.serverTimestamp() })

    createNotification(uid, {
      type: 'admin_revoked',
      message: 'Your Admin privileges on Replic have been revoked.',
      link: '/profile',
    })

    res.json({ status: 'ok' })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/admin/designs ───────────────────────────────────────────────────
// All designs regardless of status, ordered by created_at desc.
export async function listAllDesigns(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb
      .collection('designs')
      .orderBy('created_at', 'desc')
      .get()
    const data = snap.docs.map((d) => {
      const design = d.data() as Design
      return {
        ...design,
        created_at: design.created_at.toDate().toISOString(),
        updated_at: design.updated_at.toDate().toISOString(),
      }
    })
    res.json({ status: 'ok', data, total: data.length })
  } catch (err) {
    next(err)
  }
}
