import { Request, Response, NextFunction } from 'express'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'

const COLLECTION = 'categories'

export interface Category {
  id: string      // slug — also the Firestore document ID and the value stored on materials
  name: string    // display name
  emoji: string   // optional emoji prefix (empty string = none)
  order: number   // ascending sort order
}

const DEFAULTS: Category[] = [
  { id: 'glassware',  name: 'Glassware',   emoji: '🫙', order: 0 },
  { id: 'reagent',    name: 'Reagent',     emoji: '⚗️',  order: 1 },
  { id: 'equipment',  name: 'Instruments', emoji: '🔬', order: 2 },
  { id: 'biological', name: 'Biological',  emoji: '🧬', order: 3 },
  { id: 'other',      name: 'Other',       emoji: '📦', order: 4 },
]

function notFound(): AppError {
  const err: AppError = new Error('Category not found')
  err.statusCode = 404
  return err
}

function badRequest(msg: string): AppError {
  const err: AppError = new Error(msg)
  err.statusCode = 400
  return err
}

// ─── GET /api/categories ──────────────────────────────────────────────────────
// Public. Auto-seeds defaults into Firestore on first call if collection empty.
export async function listCategories(
  _req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb.collection(COLLECTION).orderBy('order').get()

    if (snap.empty) {
      const batch = adminDb.batch()
      for (const cat of DEFAULTS) {
        batch.set(adminDb.collection(COLLECTION).doc(cat.id), cat)
      }
      await batch.commit()
      res.json({ status: 'ok', data: DEFAULTS })
      return
    }

    res.json({ status: 'ok', data: snap.docs.map((d) => d.data() as Category) })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/categories ─────────────────────────────────────────────────────
// Admin-only. The `id` (slug) is auto-generated from the name if not provided.
export async function createCategory(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { name, emoji } = req.body as { name?: string; emoji?: string }

    if (!name?.trim()) return next(badRequest('name is required'))

    // Derive slug: lowercase, collapse non-alphanumeric to underscore
    const id = name
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '_')
      .replace(/^_|_$/g, '')

    if (!id) return next(badRequest('name produced an empty slug'))

    const existing = await adminDb.collection(COLLECTION).doc(id).get()
    if (existing.exists) {
      const err: AppError = new Error(`Category "${id}" already exists`)
      err.statusCode = 409
      return next(err)
    }

    // Assign next order value
    const allSnap = await adminDb.collection(COLLECTION).orderBy('order', 'desc').limit(1).get()
    const order = allSnap.empty ? 0 : ((allSnap.docs[0].data() as Category).order ?? 0) + 1

    const cat: Category = {
      id,
      name: name.trim(),
      emoji: emoji?.trim() ?? '',
      order,
    }

    await adminDb.collection(COLLECTION).doc(id).set(cat)
    res.status(201).json({ status: 'ok', data: cat })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/categories/:id ────────────────────────────────────────────────
// Admin-only. Only name and emoji are mutable (id/slug is immutable).
export async function updateCategory(
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

    const patch: Partial<Category> = {}
    if (name  !== undefined) patch.name  = name.trim()
    if (emoji !== undefined) patch.emoji = emoji.trim()

    await ref.update(patch)
    const updated = await ref.get()
    res.json({ status: 'ok', data: updated.data() as Category })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/categories/:id ───────────────────────────────────────────────
// Admin-only.
export async function deleteCategory(
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
