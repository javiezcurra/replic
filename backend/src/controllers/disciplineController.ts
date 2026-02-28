import { Request, Response, NextFunction } from 'express'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'

const COLLECTION = 'disciplines'

export interface Discipline {
  id: string      // slug — also the Firestore document ID, stored as `discipline` on designs
  name: string    // display name
  emoji: string   // optional emoji prefix (empty string = none)
  order: number   // ascending sort order
}

const DEFAULTS: Discipline[] = [
  { id: 'biology',     name: 'Biology',     emoji: '🧬', order: 0 },
  { id: 'chemistry',   name: 'Chemistry',   emoji: '⚗️',  order: 1 },
  { id: 'physics',     name: 'Physics',     emoji: '⚛️',  order: 2 },
  { id: 'earth_science', name: 'Earth Science', emoji: '🌍', order: 3 },
  { id: 'engineering', name: 'Engineering', emoji: '🔧', order: 4 },
  { id: 'mathematics', name: 'Mathematics', emoji: '📐', order: 5 },
  { id: 'psychology',  name: 'Psychology',  emoji: '🧠', order: 6 },
  { id: 'other',       name: 'Other',       emoji: '📦', order: 7 },
]

function notFound(): AppError {
  const err: AppError = new Error('Discipline not found')
  err.statusCode = 404
  return err
}

function badRequest(msg: string): AppError {
  const err: AppError = new Error(msg)
  err.statusCode = 400
  return err
}

// ─── GET /api/disciplines ──────────────────────────────────────────────────────
// Public. Auto-seeds defaults on first call if collection is empty.
export async function listDisciplines(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb.collection(COLLECTION).orderBy('order').get()

    if (snap.empty) {
      const batch = adminDb.batch()
      for (const d of DEFAULTS) {
        batch.set(adminDb.collection(COLLECTION).doc(d.id), d)
      }
      await batch.commit()
      res.json({ status: 'ok', data: DEFAULTS })
      return
    }

    res.json({ status: 'ok', data: snap.docs.map((d) => d.data() as Discipline) })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/disciplines ─────────────────────────────────────────────────────
// Admin-only.
export async function createDiscipline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, emoji } = req.body as { name?: string; emoji?: string }
    if (!name?.trim()) return next(badRequest('name is required'))

    const id = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    if (!id) return next(badRequest('name produced an empty slug'))

    const existing = await adminDb.collection(COLLECTION).doc(id).get()
    if (existing.exists) {
      const err: AppError = new Error(`Discipline "${id}" already exists`)
      err.statusCode = 409
      return next(err)
    }

    const allSnap = await adminDb.collection(COLLECTION).orderBy('order', 'desc').limit(1).get()
    const order = allSnap.empty ? 0 : ((allSnap.docs[0].data() as Discipline).order ?? 0) + 1

    const discipline: Discipline = {
      id,
      name: name.trim(),
      emoji: emoji?.trim() ?? '',
      order,
    }

    await adminDb.collection(COLLECTION).doc(id).set(discipline)
    res.status(201).json({ status: 'ok', data: discipline })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/disciplines/:id ───────────────────────────────────────────────
// Admin-only. Only name and emoji are mutable.
export async function updateDiscipline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ref = adminDb.collection(COLLECTION).doc(req.params.id)
    const snap = await ref.get()
    if (!snap.exists) return next(notFound())

    const { name, emoji } = req.body as { name?: string; emoji?: string }
    if (name !== undefined && !name.trim()) return next(badRequest('name cannot be empty'))

    const patch: Partial<Discipline> = {}
    if (name  !== undefined) patch.name  = name.trim()
    if (emoji !== undefined) patch.emoji = emoji.trim()

    await ref.update(patch)
    const updated = await ref.get()
    res.json({ status: 'ok', data: updated.data() as Discipline })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/disciplines/:id ──────────────────────────────────────────────
// Admin-only.
export async function deleteDiscipline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ref = adminDb.collection(COLLECTION).doc(req.params.id)
    const snap = await ref.get()
    if (!snap.exists) return next(notFound())
    await ref.delete()
    res.json({ status: 'ok' })
  } catch (err) {
    next(err)
  }
}
