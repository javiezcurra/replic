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
  PublishDesignBody,
  DifficultyLevel,
  ResearchQuestion,
  DesignVersionSummary,
  DesignVersionSnapshot,
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
  if (!body.summary?.trim()) return 'summary is required'
  if (body.summary.length > 1000) return 'summary must be 1000 characters or fewer'
  if (!Array.isArray(body.discipline_tags) || body.discipline_tags.length === 0)
    return 'at least one discipline_tag is required'
  if (body.discipline_tags.length > 5) return 'discipline_tags cannot exceed 5'
  if (!body.difficulty_level || !DIFFICULTY_LEVELS.includes(body.difficulty_level))
    return `difficulty_level must be one of: ${DIFFICULTY_LEVELS.join(', ')}`
  if (!Array.isArray(body.materials) || body.materials.length === 0)
    return 'at least one material is required'
  if (!Array.isArray(body.steps) || body.steps.length === 0)
    return 'at least one step is required'
  if (!Array.isArray(body.research_questions) || body.research_questions.length === 0)
    return 'at least one research_question is required'
  return null
}

// Merges draft sub-document content with system-managed fields from the main document.
// The main document is always the authoritative source for status, published_version, etc.
function mergeDraftWithMain(draftData: Design, main: Design): Design {
  return {
    ...draftData,
    id: main.id,
    status: main.status,
    is_public: main.is_public,
    published_version: main.published_version,
    has_draft_changes: main.has_draft_changes,
    author_ids: main.author_ids,
    review_status: main.review_status,
    review_count: main.review_count,
    execution_count: main.execution_count,
    scientific_value_points: main.scientific_value_points,
    derived_design_count: main.derived_design_count,
    fork_metadata: main.fork_metadata,
    created_at: main.created_at,
  }
}

function draftRef(designId: string) {
  return adminDb.collection(DESIGNS).doc(designId).collection('draft').doc('current')
}

function versionsRef(designId: string) {
  return adminDb.collection(DESIGNS).doc(designId).collection('versions')
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

    const research_questions: ResearchQuestion[] = body.research_questions.map((q) => ({
      ...q,
      id: q.id ?? randomUUID(),
    }))

    const docRef = adminDb.collection(DESIGNS).doc()
    const now = FieldValue.serverTimestamp()

    const design = {
      id: docRef.id,
      title: body.title.trim(),
      summary: body.summary.trim(),
      hypothesis: body.hypothesis?.trim() ?? '',
      discipline_tags: body.discipline_tags,
      difficulty_level: body.difficulty_level,
      materials: body.materials,
      steps: body.steps,
      research_questions,
      independent_variables: body.independent_variables ?? [],
      dependent_variables: body.dependent_variables ?? [],
      controlled_variables: body.controlled_variables ?? [],
      safety_considerations: body.safety_considerations ?? '',
      reference_experiment_ids: body.reference_experiment_ids ?? [],
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
      disclaimers: body.disclaimers ?? '',
      seeking_collaborators: body.seeking_collaborators ?? false,
      collaboration_notes: body.collaboration_notes,
      coauthor_uids: body.coauthor_uids ?? [],
      // System-managed
      status: 'draft',
      is_public: false,
      version: 1,
      published_version: 0,
      has_draft_changes: false,
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
export async function listDesigns(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { discipline, difficulty, limit: limitParam, after } = req.query
    const limit = Math.min(parseInt(limitParam as string) || 20, 100)

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
    // The main document always reflects the last published state, so no draft-awareness needed here.
    const data = snap.docs.map((d) => toResponse(d.data() as Design))
    res.status(200).json({ status: 'ok', data, count: data.length })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/mine ────────────────────────────────────────────────────
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

    // For published designs with unsaved draft changes, return the draft content to authors.
    // Non-authors always see the main document (last published state).
    if (design.has_draft_changes && req.user && design.author_ids.includes(req.user.uid)) {
      const draftSnap = await draftRef(req.params.id).get()
      if (draftSnap.exists) {
        const merged = mergeDraftWithMain(draftSnap.data() as Design, design)
        res.status(200).json({ status: 'ok', data: toResponse(merged) })
        return
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

    if (body.research_questions) {
      body.research_questions = body.research_questions.map((q) => ({
        ...q,
        id: q.id ?? randomUUID(),
      }))
    }

    // Pure drafts (never published): update the main document directly.
    if (design.status === 'draft') {
      const patch: Record<string, unknown> = {
        ...body,
        version: design.version + 1,
        updated_at: FieldValue.serverTimestamp(),
      }
      await ref.update(patch)
      const updated = await ref.get()
      res.status(200).json({ status: 'ok', data: toResponse(updated.data() as Design) })
      return
    }

    // Published / locked designs: write edits to the draft sub-document so the
    // main document (= last published state) stays untouched for public readers.
    const dr = draftRef(req.params.id)

    if (!design.has_draft_changes) {
      // First edit after publish: seed the draft from the current main document.
      await dr.set({
        ...design,
        ...body,
        version: design.version + 1,
        updated_at: FieldValue.serverTimestamp(),
      })
      await ref.update({
        has_draft_changes: true,
        version: design.version + 1,
        updated_at: FieldValue.serverTimestamp(),
      })
    } else {
      // Subsequent edit: update the existing draft document.
      const draftSnap = await dr.get()
      const currentDraft = draftSnap.data() as Design
      await dr.set({
        ...currentDraft,
        ...body,
        version: currentDraft.version + 1,
        updated_at: FieldValue.serverTimestamp(),
      })
      await ref.update({
        version: currentDraft.version + 1,
        updated_at: FieldValue.serverTimestamp(),
      })
    }

    const [updatedDraftSnap, updatedMainSnap] = await Promise.all([dr.get(), ref.get()])
    const merged = mergeDraftWithMain(
      updatedDraftSnap.data() as Design,
      updatedMainSnap.data() as Design,
    )
    void res.status(200).json({ status: 'ok', data: toResponse(merged) })
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

    const { changelog } = (req.body ?? {}) as PublishDesignBody
    const now = FieldValue.serverTimestamp()

    if (design.status === 'draft') {
      // ── First publish ──────────────────────────────────────────────────────
      const validationError = validateCreate(design as unknown as CreateDesignBody)
      if (validationError) return next(badRequest(`Cannot publish: ${validationError}`))

      const newPublishedVersion = 1
      await ref.update({
        status: 'published',
        is_public: true,
        published_version: newPublishedVersion,
        has_draft_changes: false,
        updated_at: now,
      })

      const published = (await ref.get()).data() as Design
      const snapshot: Record<string, unknown> = {
        version_number: newPublishedVersion,
        published_at: now,
        published_by: req.user!.uid,
        data: toResponse(published),
      }
      if (changelog?.trim()) snapshot.changelog = changelog.trim()
      await versionsRef(req.params.id).doc(String(newPublishedVersion)).set(snapshot)

      res.status(200).json({ status: 'ok', data: toResponse(published) })
      return
    }

    if (design.status === 'published' || design.status === 'locked') {
      // ── Re-publish from draft ─────────────────────────────────────────────
      if (!design.has_draft_changes) {
        return next(badRequest('No unpublished changes to publish'))
      }

      const dr = draftRef(req.params.id)
      const draftSnap = await dr.get()
      if (!draftSnap.exists) {
        return next(badRequest('Draft document not found — data may be inconsistent'))
      }

      const draftData = draftSnap.data() as Design
      const validationError = validateCreate(draftData as unknown as CreateDesignBody)
      if (validationError) return next(badRequest(`Cannot publish: ${validationError}`))

      // Explicit changelog in request body takes precedence; otherwise use the
      // pending_changelog saved in the draft by the edit form.
      const effectiveChangelog = changelog?.trim() || draftData.pending_changelog?.trim()

      const newPublishedVersion = design.published_version + 1
      // Strip draft-only metadata before writing the main document
      const { pending_changelog: _pc, ...draftDataClean } = draftData
      const updatedMain = {
        ...draftDataClean,
        id: design.id,
        status: design.status,
        is_public: design.is_public,
        author_ids: design.author_ids,
        review_status: design.review_status,
        review_count: design.review_count,
        execution_count: design.execution_count,
        scientific_value_points: design.scientific_value_points,
        derived_design_count: design.derived_design_count,
        fork_metadata: design.fork_metadata,
        created_at: design.created_at,
        published_version: newPublishedVersion,
        has_draft_changes: false,
        updated_at: now,
      }

      await ref.set(updatedMain)
      await dr.delete()

      const published = (await ref.get()).data() as Design
      const snapshot: Record<string, unknown> = {
        version_number: newPublishedVersion,
        published_at: now,
        published_by: req.user!.uid,
        data: toResponse(published),
      }
      if (effectiveChangelog) snapshot.changelog = effectiveChangelog
      await versionsRef(req.params.id).doc(String(newPublishedVersion)).set(snapshot)

      res.status(200).json({ status: 'ok', data: toResponse(published) })
      return
    }

    return next(badRequest('Design cannot be published in its current state'))
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/:id/versions ───────────────────────────────────────────
export async function listDesignVersions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const mainSnap = await adminDb.collection(DESIGNS).doc(req.params.id).get()
    if (!mainSnap.exists) return next(notFound())

    const design = mainSnap.data() as Design

    // Same visibility rules as getDesign
    if (design.status === 'draft') {
      if (!req.user || !design.author_ids.includes(req.user.uid)) {
        return next(notFound())
      }
    }

    const versionsSnap = await versionsRef(req.params.id)
      .orderBy('version_number', 'desc')
      .get()

    const data: DesignVersionSummary[] = versionsSnap.docs.map((d) => {
      const v = d.data()
      return {
        version_number: v.version_number,
        published_at: v.published_at.toDate().toISOString(),
        published_by: v.published_by,
        ...(v.changelog ? { changelog: v.changelog } : {}),
      }
    })

    res.status(200).json({ status: 'ok', data })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/:id/versions/:versionNum ───────────────────────────────
export async function getDesignVersion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const mainSnap = await adminDb.collection(DESIGNS).doc(req.params.id).get()
    if (!mainSnap.exists) return next(notFound())

    const design = mainSnap.data() as Design

    if (design.status === 'draft') {
      if (!req.user || !design.author_ids.includes(req.user.uid)) {
        return next(notFound())
      }
    }

    const versionSnap = await versionsRef(req.params.id)
      .doc(req.params.versionNum)
      .get()

    if (!versionSnap.exists) return next(notFound('Version not found'))

    const v = versionSnap.data()!
    const result: DesignVersionSnapshot = {
      version_number: v.version_number,
      published_at: v.published_at.toDate().toISOString(),
      published_by: v.published_by,
      ...(v.changelog ? { changelog: v.changelog } : {}),
      data: v.data as DesignResponse,
    }

    res.status(200).json({ status: 'ok', data: result })
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
      published_version: 0,
      has_draft_changes: false,
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
