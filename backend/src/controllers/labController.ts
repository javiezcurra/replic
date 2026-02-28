import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { Material, MaterialResponse } from '../types/material'
import { Design } from '../types/design'
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

// ─── GET /api/lab/matches ─────────────────────────────────────────────────────
// Returns published designs that match the user's lab Equipment inventory.
// A "full" match means the user has every Equipment material the design needs.
// A "partial" match means they have at least one but not all.
// Only Equipment-type materials are considered (consumables are ignored).
export async function getLabMatches(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid

    // 1. Get user's lab entry IDs
    const labSnap = await adminDb.collection('users').doc(uid).collection(LAB).get()
    if (labSnap.empty) {
      res.json({ status: 'ok', data: { full: [], partial: [] } })
      return
    }

    // 2. Resolve lab material docs and filter to Equipment type
    const labMatRefs = labSnap.docs.map((d) => adminDb.collection(MATERIALS).doc(d.id))
    const labMatDocs = await adminDb.getAll(...labMatRefs)
    const userEquipIds = new Set<string>(
      labMatDocs
        .filter((d) => d.exists && (d.data() as Material).type === 'Equipment')
        .map((d) => d.id),
    )

    if (userEquipIds.size === 0) {
      res.json({ status: 'ok', data: { full: [], partial: [] } })
      return
    }

    // 3. Fetch all public published/locked designs
    const designsSnap = await adminDb
      .collection('designs')
      .where('is_public', '==', true)
      .where('status', 'in', ['published', 'locked'])
      .get()

    if (designsSnap.empty) {
      res.json({ status: 'ok', data: { full: [], partial: [] } })
      return
    }

    // 4. Collect every unique material_id referenced across all designs
    const allMatIds = new Set<string>()
    for (const doc of designsSnap.docs) {
      for (const m of (doc.data() as Design).materials ?? []) {
        allMatIds.add(m.material_id)
      }
    }

    if (allMatIds.size === 0) {
      res.json({ status: 'ok', data: { full: [], partial: [] } })
      return
    }

    // 5. Batch-fetch those materials to learn their types
    const matRefs = [...allMatIds].map((id) => adminDb.collection(MATERIALS).doc(id))
    const matDocs = await adminDb.getAll(...matRefs)
    const equipmentIds = new Set<string>(
      matDocs
        .filter((d) => d.exists && (d.data() as Material).type === 'Equipment')
        .map((d) => d.id),
    )

    // 6. Score each design against the user's equipment
    const full: Record<string, unknown>[]    = []
    const partial: Record<string, unknown>[] = []

    for (const doc of designsSnap.docs) {
      const data = doc.data() as Design

      // Equipment material IDs this design requires
      const designEquipIds = (data.materials ?? [])
        .map((m) => m.material_id)
        .filter((id) => equipmentIds.has(id))

      if (designEquipIds.length === 0) continue // no equipment needed; skip

      const matched = designEquipIds.filter((id) => userEquipIds.has(id)).length

      if (matched === 0) continue

      const serialized = {
        ...data,
        id: doc.id,
        created_at: data.created_at?.toDate().toISOString() ?? null,
        updated_at: data.updated_at?.toDate().toISOString() ?? null,
      }

      if (matched === designEquipIds.length) {
        full.push(serialized)
      } else {
        partial.push(serialized)
      }
    }

    res.json({ status: 'ok', data: { full, partial } })
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
