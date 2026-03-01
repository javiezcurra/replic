import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { UserProfile, UserProfileResponse } from '../types/user'
import { Design } from '../types/design'
import { AppError } from '../middleware/errorHandler'
import { createNotification } from '../lib/notifications'
import type { LedgerEntry, LedgerEventType } from '../types/ledger'

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

// ─── GET /api/admin/ledger ────────────────────────────────────────────────────
// Contribution ledger entries, most recent first.
// Optional query params: user_id, event_type, design_id (all in-memory filtered).
export async function listLedger(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const filterUserId    = (req.query.user_id    as string | undefined)?.trim() || undefined
    const filterEventType = (req.query.event_type as string | undefined)?.trim() || undefined
    const filterDesignId  = (req.query.design_id  as string | undefined)?.trim() || undefined

    // Fetch up to 500 recent entries; filter in memory to avoid composite index requirements
    const snap = await adminDb
      .collection('contribution_ledger')
      .orderBy('created_at', 'desc')
      .limit(500)
      .get()

    let entries = snap.docs.map((d) => d.data() as LedgerEntry)

    if (filterUserId)    entries = entries.filter((e) => e.user_id    === filterUserId)
    if (filterEventType) entries = entries.filter((e) => e.event_type === filterEventType as LedgerEventType)
    if (filterDesignId)  entries = entries.filter((e) => e.design_id  === filterDesignId)

    // Resolve display names and design titles in parallel
    const uniqueUserIds   = [...new Set(entries.map((e) => e.user_id))]
    const uniqueDesignIds = [...new Set(entries.map((e) => e.design_id).filter(Boolean) as string[])]

    const [userResults, designResults] = await Promise.all([
      Promise.allSettled(uniqueUserIds.map((uid) => adminDb.collection(USERS).doc(uid).get())),
      Promise.allSettled(uniqueDesignIds.map((id) => adminDb.collection('designs').doc(id).get())),
    ])

    const userNames: Record<string, string> = {}
    uniqueUserIds.forEach((uid, i) => {
      const r = userResults[i]
      if (r.status === 'fulfilled' && r.value.exists) {
        userNames[uid] = (r.value.data() as { displayName: string }).displayName
      }
    })

    const designTitles: Record<string, string> = {}
    uniqueDesignIds.forEach((id, i) => {
      const r = designResults[i]
      if (r.status === 'fulfilled' && r.value.exists) {
        designTitles[id] = (r.value.data() as { title: string }).title
      }
    })

    const data = entries.map((e) => ({
      ...e,
      created_at:         (e.created_at as FirebaseFirestore.Timestamp).toDate().toISOString(),
      user_display_name:  userNames[e.user_id] ?? null,
      design_title:       e.design_id ? (designTitles[e.design_id] ?? null) : null,
    }))

    res.json({ status: 'ok', data, total: data.length })
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
