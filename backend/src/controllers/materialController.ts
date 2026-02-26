import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import {
  Material,
  MaterialResponse,
  CreateMaterialBody,
  MaterialType,
  MaterialCategory,
} from '../types/material'

const MATERIALS = 'materials'

const MATERIAL_TYPES: MaterialType[] = ['Consumable', 'Equipment']
const MATERIAL_CATEGORIES: MaterialCategory[] = [
  'glassware',
  'reagent',
  'equipment',
  'biological',
  'other',
]

function toResponse(m: Material): MaterialResponse {
  return {
    ...m,
    created_at: m.created_at.toDate().toISOString(),
    updated_at: m.updated_at.toDate().toISOString(),
  }
}

function badRequest(message: string): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 400
  return err
}

function notFound(message = 'Material not found'): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 404
  return err
}

function validateCreate(body: CreateMaterialBody): string | null {
  if (!body.name?.trim()) return 'name is required'
  if (!body.type || !MATERIAL_TYPES.includes(body.type))
    return `type must be one of: ${MATERIAL_TYPES.join(', ')}`
  if (!body.category || !MATERIAL_CATEGORIES.includes(body.category))
    return `category must be one of: ${MATERIAL_CATEGORIES.join(', ')}`
  if (body.tags !== undefined && body.tags.length > 10) return 'tags cannot exceed 10'
  return null
}

// ─── GET /api/materials ───────────────────────────────────────────────────────
// Public list. Filtered by one of: ?tags= | ?category= | ?type=
// (Each filter corresponds to a dedicated Firestore composite index.)
export async function listMaterials(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { category, type, tags, limit: limitParam, after } = req.query
    const limit = Math.min(parseInt(limitParam as string) || 20, 100)

    let query = adminDb
      .collection(MATERIALS)
      .orderBy('created_at', 'desc')
      .limit(limit)

    // Apply at most one filter to match the available composite indexes.
    // Priority: tags > category > type
    if (tags) {
      query = query.where('tags', 'array-contains', tags as string)
    } else if (category && MATERIAL_CATEGORIES.includes(category as MaterialCategory)) {
      query = query.where('category', '==', category as string)
    } else if (type && MATERIAL_TYPES.includes(type as MaterialType)) {
      query = query.where('type', '==', type as string)
    }

    if (after) {
      const cursorSnap = await adminDb.collection(MATERIALS).doc(after as string).get()
      if (cursorSnap.exists) query = query.startAfter(cursorSnap)
    }

    const snap = await query.get()
    const data = snap.docs.map((d) => toResponse(d.data() as Material))
    res.status(200).json({ status: 'ok', data, count: data.length })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/materials ──────────────────────────────────────────────────────
export async function createMaterial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as CreateMaterialBody
    const validationError = validateCreate(body)
    if (validationError) return next(badRequest(validationError))

    const docRef = adminDb.collection(MATERIALS).doc()
    const now = FieldValue.serverTimestamp()

    const material = {
      id: docRef.id,
      name: body.name.trim(),
      type: body.type,
      description: body.description,
      category: body.category,
      link: body.link,
      image_url: body.image_url,
      supplier: body.supplier,
      typical_cost_usd: body.typical_cost_usd,
      safety_notes: body.safety_notes,
      tags: body.tags ?? [],
      is_verified: false,
      created_by: req.user!.uid,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(material)
    const snap = await docRef.get()
    res.status(201).json({ status: 'ok', data: toResponse(snap.data() as Material) })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/materials/:id ───────────────────────────────────────────────────
export async function getMaterial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb.collection(MATERIALS).doc(req.params.id).get()
    if (!snap.exists) return next(notFound())
    res.status(200).json({ status: 'ok', data: toResponse(snap.data() as Material) })
  } catch (err) {
    next(err)
  }
}
