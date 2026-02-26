import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { Material, MaterialResponse } from '../types/material'
import { AppError } from '../middleware/errorHandler'

const LAB = 'lab'
const MATERIALS = 'materials'

function toResponse(m: Material): MaterialResponse {
  return {
    ...m,
    created_at: m.created_at.toDate().toISOString(),
    updated_at: m.updated_at.toDate().toISOString(),
  }
}

function notFound(msg = 'Material not found'): AppError {
  const err: AppError = new Error(msg)
  err.statusCode = 404
  return err
}

// ─── GET /api/lab ─────────────────────────────────────────────────────────────
// Returns all materials in the current user's lab, as full material objects.
export async function getLab(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const labSnap = await adminDb.collection('users').doc(uid).collection(LAB).get()

    if (labSnap.empty) {
      res.status(200).json({ status: 'ok', data: [] })
      return
    }

    const materialIds = labSnap.docs.map((d) => d.id)
    const materialSnaps = await Promise.all(
      materialIds.map((id) => adminDb.collection(MATERIALS).doc(id).get()),
    )

    const data: MaterialResponse[] = materialSnaps
      .filter((snap) => snap.exists)
      .map((snap) => toResponse(snap.data() as Material))

    res.status(200).json({ status: 'ok', data })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/lab/:materialId ────────────────────────────────────────────────
// Adds a material to the current user's lab.
export async function addToLab(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const { materialId } = req.params

    const matSnap = await adminDb.collection(MATERIALS).doc(materialId).get()
    if (!matSnap.exists) return next(notFound())

    await adminDb.collection('users').doc(uid).collection(LAB).doc(materialId).set({
      material_id: materialId,
      added_at: FieldValue.serverTimestamp(),
    })

    res.status(201).json({ status: 'ok' })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/lab/:materialId ──────────────────────────────────────────────
// Removes a material from the current user's lab.
export async function removeFromLab(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const { materialId } = req.params

    await adminDb.collection('users').doc(uid).collection(LAB).doc(materialId).delete()
    res.status(200).json({ status: 'ok' })
  } catch (err) {
    next(err)
  }
}
