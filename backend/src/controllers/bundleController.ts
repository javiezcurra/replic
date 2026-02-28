import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import { Bundle, BundleResponse, CreateBundleBody, UpdateBundleBody } from '../types/bundle'

const BUNDLES = 'bundles'

function toResponse(b: Bundle): BundleResponse {
  return {
    ...b,
    created_at: b.created_at.toDate().toISOString(),
    updated_at: b.updated_at.toDate().toISOString(),
  }
}

function badRequest(msg: string): AppError {
  const err: AppError = new Error(msg)
  err.statusCode = 400
  return err
}

function notFoundErr(): AppError {
  const err: AppError = new Error('Bundle not found')
  err.statusCode = 404
  return err
}

// ─── GET /api/admin/bundles ───────────────────────────────────────────────────
export async function listBundles(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb.collection(BUNDLES).orderBy('created_at', 'asc').get()
    res.json({ status: 'ok', data: snap.docs.map((d) => toResponse(d.data() as Bundle)) })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/admin/bundles ──────────────────────────────────────────────────
export async function createBundle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as CreateBundleBody
    if (!body.name?.trim()) return next(badRequest('name is required'))

    const ref = adminDb.collection(BUNDLES).doc()
    const now = FieldValue.serverTimestamp()
    await ref.set({
      id:           ref.id,
      name:         body.name.trim(),
      description:  body.description?.trim() ?? '',
      material_ids: body.material_ids ?? [],
      created_at:   now,
      updated_at:   now,
    })

    const snap = await ref.get()
    res.status(201).json({ status: 'ok', data: toResponse(snap.data() as Bundle) })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/admin/bundles/:id ─────────────────────────────────────────────
export async function updateBundle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params
    const body   = req.body as UpdateBundleBody

    const snap = await adminDb.collection(BUNDLES).doc(id).get()
    if (!snap.exists) return next(notFoundErr())

    const updates: Record<string, unknown> = { updated_at: FieldValue.serverTimestamp() }
    if (body.name !== undefined) {
      if (!body.name.trim()) return next(badRequest('name cannot be empty'))
      updates.name = body.name.trim()
    }
    if (body.description !== undefined) updates.description = body.description.trim()
    if (body.material_ids !== undefined) updates.material_ids = body.material_ids

    await adminDb.collection(BUNDLES).doc(id).update(updates)
    const updated = await adminDb.collection(BUNDLES).doc(id).get()
    res.json({ status: 'ok', data: toResponse(updated.data() as Bundle) })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/admin/bundles/:id ────────────────────────────────────────────
export async function deleteBundle(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params
    const snap = await adminDb.collection(BUNDLES).doc(id).get()
    if (!snap.exists) return next(notFoundErr())

    await adminDb.collection(BUNDLES).doc(id).delete()
    res.json({ status: 'ok', data: null })
  } catch (err) {
    next(err)
  }
}
