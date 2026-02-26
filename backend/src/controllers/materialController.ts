import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import {
  Material,
  MaterialResponse,
  CreateMaterialBody,
  UpdateMaterialBody,
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

    // Build the base query. When a filter is applied we intentionally omit
    // orderBy('created_at') so that the query only needs Firestore's auto-created
    // single-field indexes rather than a composite index. Without orderBy the
    // results come back in document-ID order, which is approximately chronological
    // for Firebase auto-IDs and is perfectly consistent for cursor pagination.
    let query: FirebaseFirestore.Query = adminDb.collection(MATERIALS)

    if (tags) {
      query = query.where('tags', 'array-contains', tags as string)
    } else if (category && MATERIAL_CATEGORIES.includes(category as MaterialCategory)) {
      query = query.where('category', '==', category as string)
    } else if (type && MATERIAL_TYPES.includes(type as MaterialType)) {
      query = query.where('type', '==', type as string)
    } else {
      // Unfiltered — safe to order by created_at (only needs the auto-index)
      query = query.orderBy('created_at', 'desc')
    }

    query = query.limit(limit)

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

// ─── PATCH /api/materials/:id ─────────────────────────────────────────────────
// Admin-only. Partial update — only supplied fields are written.
export async function updateMaterial(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ref = adminDb.collection(MATERIALS).doc(req.params.id)
    const snap = await ref.get()
    if (!snap.exists) return next(notFound())

    const body = req.body as UpdateMaterialBody

    if (body.name !== undefined && !body.name.trim()) {
      return next(badRequest('name cannot be empty'))
    }
    if (body.type !== undefined && !MATERIAL_TYPES.includes(body.type)) {
      return next(badRequest(`type must be one of: ${MATERIAL_TYPES.join(', ')}`))
    }
    if (body.category !== undefined && !MATERIAL_CATEGORIES.includes(body.category)) {
      return next(badRequest(`category must be one of: ${MATERIAL_CATEGORIES.join(', ')}`))
    }
    if (body.tags !== undefined && body.tags.length > 10) {
      return next(badRequest('tags cannot exceed 10'))
    }

    const patch: Record<string, unknown> = { updated_at: FieldValue.serverTimestamp() }
    if (body.name !== undefined)              patch.name              = body.name.trim()
    if (body.type !== undefined)              patch.type              = body.type
    if (body.category !== undefined)          patch.category          = body.category
    if ('description' in body)               patch.description       = body.description ?? null
    if ('link' in body)                      patch.link              = body.link ?? null
    if ('image_url' in body)                 patch.image_url         = body.image_url ?? null
    if ('supplier' in body)                  patch.supplier          = body.supplier ?? null
    if ('typical_cost_usd' in body)          patch.typical_cost_usd  = body.typical_cost_usd ?? null
    if ('safety_notes' in body)              patch.safety_notes      = body.safety_notes ?? null
    if (body.tags !== undefined)             patch.tags              = body.tags
    if (body.is_verified !== undefined)      patch.is_verified       = body.is_verified

    await ref.update(patch)
    const updated = await ref.get()
    res.status(200).json({ status: 'ok', data: toResponse(updated.data() as Material) })
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
