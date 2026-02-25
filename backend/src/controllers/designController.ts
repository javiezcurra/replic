import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import {
  Design,
  DesignResponse,
  CreateDesignBody,
  UpdateDesignBody,
  ForkDesignBody,
  DifficultyLevel,
  ResearchQuestion,
} from '../types/design'

const DESIGNS = 'designs'

const DIFFICULTY_LEVELS: DifficultyLevel[] = [
  'Pre-K',
  'Elementary',
  'Middle School',
  'High School',
  'Undergraduate',
  'Graduate',
  'Professional',
]

// Fields that cannot be changed once a design is locked (execution_count >= 1)
const LOCKED_FIELDS = new Set([
  'hypothesis',
  'steps',
  'materials',
  'research_questions',
  'independent_variables',
  'dependent_variables',
  'controlled_variables',
])

function toResponse(design: Design): DesignResponse {
  return {
    ...design,
    created_at: design.created_at.toDate().toISOString(),
    updated_at: design.updated_at.toDate().toISOString(),
  }
}

function badRequest(message: string): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 400
  return err
}

function notFound(message = 'Design not found'): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 404
  return err
}

function forbidden(message: string): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 403
  return err
}

function validateCreate(body: CreateDesignBody): string | null {
  if (!body.title?.trim()) return 'title is required'
  if (body.title.length > 200) return 'title must be 200 characters or fewer'
  if (!body.hypothesis?.trim()) return 'hypothesis is required'
  if (!Array.isArray(body.discipline_tags) || body.discipline_tags.length === 0)
    return 'at least one discipline_tag is required'
  if (body.discipline_tags.length > 5) return 'discipline_tags cannot exceed 5'
  if (!body.difficulty_level || !DIFFICULTY_LEVELS.includes(body.difficulty_level))
    return `difficulty_level must be one of: ${DIFFICULTY_LEVELS.join(', ')}`
  if (!Array.isArray(body.steps) || body.steps.length === 0)
    return 'at least one step is required'
  if (!Array.isArray(body.research_questions) || body.research_questions.length === 0)
    return 'at least one research_question is required'
  if (!Array.isArray(body.independent_variables))
    return 'independent_variables must be an array'
  if (!Array.isArray(body.dependent_variables))
    return 'dependent_variables must be an array'
  if (!Array.isArray(body.controlled_variables))
    return 'controlled_variables must be an array'
  return null
}

// ─── POST /api/designs ────────────────────────────────────────────────────────
export async function createDesign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const body = req.body as CreateDesignBody
    const validationError = validateCreate(body)
    if (validationError) return next(badRequest(validationError))

    // Ensure research questions each have a stable ID
    const research_questions: ResearchQuestion[] = body.research_questions.map((q) => ({
      ...q,
      id: q.id ?? randomUUID(),
    }))

    const docRef = adminDb.collection(DESIGNS).doc()
    const now = FieldValue.serverTimestamp()

    const design = {
      id: docRef.id,
      title: body.title.trim(),
      hypothesis: body.hypothesis.trim(),
      discipline_tags: body.discipline_tags,
      difficulty_level: body.difficulty_level,
      steps: body.steps,
      materials: body.materials ?? [],
      research_questions,
      independent_variables: body.independent_variables,
      dependent_variables: body.dependent_variables,
      controlled_variables: body.controlled_variables,
      parent_designs: body.parent_designs ?? [],
      references: body.references ?? [],
      sample_size: body.sample_size,
      repetitions: body.repetitions,
      statistical_methods: body.statistical_methods ?? [],
      analysis_plan: body.analysis_plan,
      estimated_duration: body.estimated_duration,
      estimated_budget_usd: body.estimated_budget_usd,
      safety_requirements: body.safety_requirements,
      ethical_considerations: body.ethical_considerations,
      seeking_collaborators: body.seeking_collaborators ?? false,
      collaboration_notes: body.collaboration_notes,
      // System-managed
      status: 'draft',
      is_public: false,
      version: 1,
      author_ids: [req.user!.uid],
      review_status: 'unreviewed',
      review_count: 0,
      execution_count: 0,
      scientific_value_points: 0,
      derived_design_count: 0,
      created_at: now,
      updated_at: now,
    }

    await docRef.set(design)
    const snap = await docRef.get()
    res.status(201).json({ status: 'ok', data: toResponse(snap.data() as Design) })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs ─────────────────────────────────────────────────────────
// Lists published + locked designs. Supports ?discipline=&difficulty=&limit=&after=
export async function listDesigns(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { discipline, difficulty, limit: limitParam, after } = req.query
    const limit = Math.min(parseInt(limitParam as string) || 20, 100)

    // Use is_public (equality) as the base filter so it can be combined with
    // array-contains (discipline_tags). Firestore prohibits 'in' + 'array-contains'
    // in the same query.
    let query = adminDb
      .collection(DESIGNS)
      .where('is_public', '==', true)
      .orderBy('created_at', 'desc')
      .limit(limit)

    if (discipline) {
      query = query.where('discipline_tags', 'array-contains', discipline as string)
    }
    if (difficulty && DIFFICULTY_LEVELS.includes(difficulty as DifficultyLevel)) {
      query = query.where('difficulty_level', '==', difficulty as string)
    }
    if (after) {
      const cursorSnap = await adminDb.collection(DESIGNS).doc(after as string).get()
      if (cursorSnap.exists) query = query.startAfter(cursorSnap)
    }

    const snap = await query.get()
    const data = snap.docs.map((d) => toResponse(d.data() as Design))
    res.status(200).json({ status: 'ok', data, count: data.length })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/mine ────────────────────────────────────────────────────
// Lists the authenticated user's own designs (all statuses)
export async function listMyDesigns(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb
      .collection(DESIGNS)
      .where('author_ids', 'array-contains', req.user!.uid)
      .orderBy('updated_at', 'desc')
      .get()

    const data = snap.docs.map((d) => toResponse(d.data() as Design))
    res.status(200).json({ status: 'ok', data, count: data.length })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/:id ─────────────────────────────────────────────────────
export async function getDesign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const snap = await adminDb.collection(DESIGNS).doc(req.params.id).get()
    if (!snap.exists) return next(notFound())

    const design = snap.data() as Design

    // Drafts are only visible to their authors
    if (design.status === 'draft') {
      if (!req.user || !design.author_ids.includes(req.user.uid)) {
        return next(notFound()) // 404 rather than 403 — don't reveal draft existence
      }
    }

    res.status(200).json({ status: 'ok', data: toResponse(design) })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/designs/:id ───────────────────────────────────────────────────
export async function updateDesign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ref = adminDb.collection(DESIGNS).doc(req.params.id)
    const snap = await ref.get()
    if (!snap.exists) return next(notFound())

    const design = snap.data() as Design
    if (!design.author_ids.includes(req.user!.uid)) return next(forbidden('Not an author'))

    const body = req.body as UpdateDesignBody

    // When locked, reject any attempt to change methodology fields
    if (design.execution_count >= 1) {
      const attempted = Object.keys(body).filter((k) => LOCKED_FIELDS.has(k))
      if (attempted.length > 0) {
        return next(
          forbidden(
            `Design is locked after execution. Cannot change: ${attempted.join(', ')}. Fork this design to modify methodology.`,
          ),
        )
      }
    }

    // Validate title length if provided
    if (body.title !== undefined) {
      if (!body.title.trim()) return next(badRequest('title cannot be empty'))
      if (body.title.length > 200) return next(badRequest('title must be 200 characters or fewer'))
    }
    if (body.discipline_tags !== undefined && body.discipline_tags.length > 5) {
      return next(badRequest('discipline_tags cannot exceed 5'))
    }
    if (body.difficulty_level !== undefined && !DIFFICULTY_LEVELS.includes(body.difficulty_level)) {
      return next(badRequest(`difficulty_level must be one of: ${DIFFICULTY_LEVELS.join(', ')}`))
    }

    // Re-stamp question IDs if research_questions are being updated
    if (body.research_questions) {
      body.research_questions = body.research_questions.map((q) => ({
        ...q,
        id: q.id ?? randomUUID(),
      }))
    }

    const patch: Record<string, unknown> = {
      ...body,
      version: design.version + 1,
      updated_at: FieldValue.serverTimestamp(),
    }

    await ref.update(patch)
    const updated = await ref.get()
    res.status(200).json({ status: 'ok', data: toResponse(updated.data() as Design) })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/designs/:id/publish ───────────────────────────────────────────
export async function publishDesign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ref = adminDb.collection(DESIGNS).doc(req.params.id)
    const snap = await ref.get()
    if (!snap.exists) return next(notFound())

    const design = snap.data() as Design
    if (!design.author_ids.includes(req.user!.uid)) return next(forbidden('Not an author'))
    if (design.status !== 'draft') return next(badRequest('Only drafts can be published'))

    // Full validation before publishing
    const validationError = validateCreate(design as unknown as CreateDesignBody)
    if (validationError) return next(badRequest(`Cannot publish: ${validationError}`))

    await ref.update({ status: 'published', is_public: true, updated_at: FieldValue.serverTimestamp() })
    const updated = await ref.get()
    res.status(200).json({ status: 'ok', data: toResponse(updated.data() as Design) })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/designs/:id/fork ───────────────────────────────────────────────
export async function forkDesign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { fork_type, fork_rationale } = req.body as ForkDesignBody
    if (!fork_type || !fork_rationale?.trim()) {
      return next(badRequest('fork_type and fork_rationale are required'))
    }

    const snap = await adminDb.collection(DESIGNS).doc(req.params.id).get()
    if (!snap.exists) return next(notFound())

    const source = snap.data() as Design
    if (source.status === 'draft') {
      return next(forbidden('Cannot fork a draft — the design must be published first'))
    }

    const docRef = adminDb.collection(DESIGNS).doc()
    const now = FieldValue.serverTimestamp()
    const parentGeneration = source.fork_metadata?.fork_generation ?? 0

    const forked = {
      ...source,
      id: docRef.id,
      title: `Fork of: ${source.title}`,
      status: 'draft',
      is_public: false,
      version: 1,
      author_ids: [req.user!.uid],
      review_status: 'unreviewed',
      review_count: 0,
      execution_count: 0,
      scientific_value_points: 0,
      derived_design_count: 0,
      fork_metadata: {
        parent_design_id: source.id,
        fork_generation: parentGeneration + 1,
        fork_type,
        fork_rationale: fork_rationale.trim(),
      },
      created_at: now,
      updated_at: now,
    }

    await docRef.set(forked)

    // Increment derived_design_count on the source
    await adminDb
      .collection(DESIGNS)
      .doc(source.id)
      .update({ derived_design_count: source.derived_design_count + 1 })

    const created = await docRef.get()
    res.status(201).json({ status: 'ok', data: toResponse(created.data() as Design) })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/designs/:id ──────────────────────────────────────────────────
export async function deleteDesign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const ref = adminDb.collection(DESIGNS).doc(req.params.id)
    const snap = await ref.get()
    if (!snap.exists) return next(notFound())

    const design = snap.data() as Design
    if (!design.author_ids.includes(req.user!.uid)) return next(forbidden('Not an author'))
    if (design.status !== 'draft') {
      return next(forbidden('Only drafts can be deleted'))
    }

    await ref.delete()
    res.status(200).json({ status: 'ok', message: 'Design deleted' })
  } catch (err) {
    next(err)
  }
}
