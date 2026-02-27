import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import { Design } from '../types/design'

const DESIGNS = 'designs'
const USERS = 'users'
const WATCHLIST = 'watchlist'

export type WatchlistSource = 'manual' | 'review'

function notFound(message = 'Not found'): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 404
  return err
}

export function watchlistRef(uid: string) {
  return adminDb.collection(USERS).doc(uid).collection(WATCHLIST)
}

/** Idempotent upsert — used internally (e.g. from reviewController). */
export async function upsertWatchlistEntry(
  uid: string,
  designId: string,
  source: WatchlistSource,
): Promise<void> {
  await watchlistRef(uid).doc(designId).set(
    { designId, addedAt: FieldValue.serverTimestamp(), source },
    { merge: true },
  )
}

// ─── POST /api/users/me/watchlist/:designId ───────────────────────────────────
export async function addToWatchlist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const { designId } = req.params

    const designSnap = await adminDb.collection(DESIGNS).doc(designId).get()
    if (!designSnap.exists) return next(notFound('Design not found'))

    await upsertWatchlistEntry(uid, designId, 'manual')
    res.status(200).json({ status: 'ok', message: 'Added to watchlist' })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/users/me/watchlist/:designId ─────────────────────────────────
export async function removeFromWatchlist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const { designId } = req.params

    await watchlistRef(uid).doc(designId).delete()
    res.status(200).json({ status: 'ok', message: 'Removed from watchlist' })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/users/me/watchlist ──────────────────────────────────────────────
export async function listWatchlist(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const snap = await watchlistRef(uid).orderBy('addedAt', 'desc').get()

    const entries = await Promise.all(
      snap.docs.map(async (doc) => {
        const { designId, addedAt, source } = doc.data()
        const designSnap = await adminDb.collection(DESIGNS).doc(designId).get()
        if (!designSnap.exists) return null
        const d = designSnap.data() as Design
        return {
          designId,
          addedAt: (addedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
          source,
          title: d.title,
          status: d.status,
          discipline_tags: d.discipline_tags,
          difficulty_level: d.difficulty_level,
          execution_count: d.execution_count ?? 0,
          derived_design_count: d.derived_design_count ?? 0,
          author_ids: d.author_ids ?? [],
        }
      }),
    )

    const data = entries.filter(Boolean)
    res.status(200).json({ status: 'ok', data, count: data.length })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/users/me/watchlist/:designId ────────────────────────────────────
export async function isWatchlisted(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const { designId } = req.params
    const snap = await watchlistRef(uid).doc(designId).get()
    res.status(200).json({ status: 'ok', data: { inWatchlist: snap.exists } })
  } catch (err) {
    next(err)
  }
}
