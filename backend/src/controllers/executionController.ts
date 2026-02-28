import { Request, Response, NextFunction } from 'express'
import { FieldValue, Timestamp } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import { createNotification, createNotifications, getDisplayName } from '../lib/notifications'
import { Design } from '../types/design'
import {
  Execution,
  ExecutionResponse,
  UpdateExecutionBody,
} from '../types/execution'

const DESIGNS    = 'designs'
const EXECUTIONS = 'executions'

function toResponse(execution: Execution): ExecutionResponse {
  return {
    ...execution,
    start_date:  execution.start_date.toDate().toISOString(),
    created_at:  execution.created_at.toDate().toISOString(),
    updated_at:  execution.updated_at.toDate().toISOString(),
  }
}

function badRequest(message: string): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 400
  return err
}

function notFoundErr(message = 'Not found'): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 404
  return err
}

function forbidden(message: string): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 403
  return err
}

// ─── POST /api/designs/:id/executions ────────────────────────────────────────
export async function startExecution(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: designId } = req.params
    const experimenterUid = req.user!.uid

    const designRef  = adminDb.collection(DESIGNS).doc(designId)
    const designSnap = await designRef.get()
    if (!designSnap.exists) return next(notFoundErr('Design not found'))
    const design = designSnap.data() as Design

    // Only published or already-locked designs can be executed
    if (design.status === 'draft') {
      return next(badRequest('Only published designs can be executed'))
    }

    // Blocked if a draft is in progress on a published design
    if (design.status === 'published' && design.has_draft_changes) {
      return next(badRequest('The author of this experiment is working on a new draft version'))
    }

    const execRef = adminDb.collection(EXECUTIONS).doc()
    const now     = FieldValue.serverTimestamp()

    const executionData = {
      id:                     execRef.id,
      design_id:              designId,
      design_version:         design.published_version,
      design_title:           design.title,
      experimenter_uid:       experimenterUid,
      co_experimenter_uids:   [],
      co_experimenters:       [],
      start_date:             now,
      methodology_deviations: '',
      status:                 'in_progress',
      created_at:             now,
      updated_at:             now,
    }

    // Lock the design on first execution; subsequent executions leave it locked
    const designUpdates: Record<string, unknown> = {
      execution_count: FieldValue.increment(1),
      updated_at:      now,
    }
    if (design.status === 'published') {
      designUpdates.status = 'locked'
    }

    await Promise.all([
      execRef.set(executionData),
      designRef.update(designUpdates),
    ])

    // Notify authors (skip the experimenter if they are also an author)
    const authorsToNotify = design.author_ids.filter((uid) => uid !== experimenterUid)
    if (authorsToNotify.length > 0) {
      const experimenterName = await getDisplayName(experimenterUid)
      createNotifications(authorsToNotify, {
        type:         'experiment_started',
        message:      `${experimenterName} started running your experiment "${design.title}"`,
        link:         `/executions/${execRef.id}`,
        actor_uid:    experimenterUid,
        actor_name:   experimenterName,
        design_id:    designId,
        design_title: design.title,
        execution_id: execRef.id,
      })
    }

    // Re-fetch to get server timestamps
    const createdSnap = await execRef.get()
    res.status(201).json({ status: 'ok', data: toResponse(createdSnap.data() as Execution) })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/:id/executions ─────────────────────────────────────────
export async function listExecutions(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: designId } = req.params
    const snap = await adminDb
      .collection(EXECUTIONS)
      .where('design_id', '==', designId)
      .orderBy('created_at', 'desc')
      .get()
    const executions = snap.docs.map((d) => toResponse(d.data() as Execution))
    res.json({ status: 'ok', data: executions })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/executions/:id ─────────────────────────────────────────────────
export async function getExecution(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params
    const snap   = await adminDb.collection(EXECUTIONS).doc(id).get()
    if (!snap.exists) return next(notFoundErr('Execution not found'))
    res.json({ status: 'ok', data: toResponse(snap.data() as Execution) })
  } catch (err) {
    next(err)
  }
}

// ─── PATCH /api/executions/:id ───────────────────────────────────────────────
export async function updateExecution(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id }    = req.params
    const actorUid  = req.user!.uid
    const body      = req.body as UpdateExecutionBody

    const snap = await adminDb.collection(EXECUTIONS).doc(id).get()
    if (!snap.exists) return next(notFoundErr('Execution not found'))
    const execution = snap.data() as Execution

    if (execution.experimenter_uid !== actorUid) {
      return next(forbidden('Only the lead experimenter can update this execution'))
    }
    if (execution.status !== 'in_progress') {
      return next(badRequest('Cannot update a completed or cancelled execution'))
    }

    const updates: Record<string, unknown> = {
      updated_at: FieldValue.serverTimestamp(),
    }
    if (body.co_experimenter_uids !== undefined) updates.co_experimenter_uids = body.co_experimenter_uids
    if (body.co_experimenters     !== undefined) updates.co_experimenters     = body.co_experimenters
    if (body.start_date           !== undefined) updates.start_date           = Timestamp.fromDate(new Date(body.start_date))
    if (body.methodology_deviations !== undefined) updates.methodology_deviations = body.methodology_deviations

    await adminDb.collection(EXECUTIONS).doc(id).update(updates)

    // Notify co-experimenter changes
    if (body.co_experimenter_uids !== undefined) {
      const oldSet = new Set(execution.co_experimenter_uids)
      const newSet = new Set(body.co_experimenter_uids)
      const actorName = await getDisplayName(actorUid)

      for (const uid of newSet) {
        if (!oldSet.has(uid) && uid !== actorUid) {
          createNotification(uid, {
            type:         'added_as_co_experimenter',
            message:      `${actorName} added you as a co-experimenter on "${execution.design_title}"`,
            link:         `/executions/${id}`,
            actor_uid:    actorUid,
            actor_name:   actorName,
            design_id:    execution.design_id,
            design_title: execution.design_title,
            execution_id: id,
          })
        }
      }
      for (const uid of oldSet) {
        if (!newSet.has(uid) && uid !== actorUid) {
          createNotification(uid, {
            type:         'removed_as_co_experimenter',
            message:      `${actorName} removed you from the experiment run of "${execution.design_title}"`,
            link:         `/executions/${id}`,
            actor_uid:    actorUid,
            actor_name:   actorName,
            design_id:    execution.design_id,
            design_title: execution.design_title,
            execution_id: id,
          })
        }
      }
    }

    const updated = await adminDb.collection(EXECUTIONS).doc(id).get()
    res.json({ status: 'ok', data: toResponse(updated.data() as Execution) })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/executions/:id ──────────────────────────────────────────────
export async function cancelExecution(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id }   = req.params
    const actorUid = req.user!.uid

    const snap = await adminDb.collection(EXECUTIONS).doc(id).get()
    if (!snap.exists) return next(notFoundErr('Execution not found'))
    const execution = snap.data() as Execution

    if (execution.experimenter_uid !== actorUid) {
      return next(forbidden('Only the lead experimenter can cancel this execution'))
    }
    if (execution.status !== 'in_progress') {
      return next(badRequest('Only in-progress executions can be cancelled'))
    }

    const designRef = adminDb.collection(DESIGNS).doc(execution.design_id)

    await adminDb.runTransaction(async (tx) => {
      const designSnap = await tx.get(designRef)
      if (!designSnap.exists) throw notFoundErr('Design not found')
      const design = designSnap.data() as Design

      tx.delete(adminDb.collection(EXECUTIONS).doc(id))

      const newCount = (design.execution_count ?? 1) - 1
      const designUpdates: Record<string, unknown> = {
        execution_count: FieldValue.increment(-1),
        updated_at:      FieldValue.serverTimestamp(),
      }
      // Restore to published if this was the last active execution
      if (newCount <= 0 && design.status === 'locked') {
        designUpdates.status = 'published'
      }
      tx.update(designRef, designUpdates)
    })

    res.json({ status: 'ok', data: null })
  } catch (err) {
    next(err)
  }
}
