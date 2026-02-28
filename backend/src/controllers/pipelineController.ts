import { Request, Response, NextFunction } from 'express'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import { Design } from '../types/design'

const DESIGNS = 'designs'
const USERS = 'users'
const PIPELINE = 'pipeline'

function notFound(message = 'Not found'): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 404
  return err
}

function badRequest(message: string): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 400
  return err
}

function pipelineRef(uid: string) {
  return adminDb.collection(USERS).doc(uid).collection(PIPELINE)
}

// ─── POST /api/users/me/pipeline/:designId ────────────────────────────────────
export async function addToPipeline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const { designId } = req.params

    const designSnap = await adminDb.collection(DESIGNS).doc(designId).get()
    if (!designSnap.exists) return next(notFound('Design not found'))

    const design = designSnap.data() as Design
    if (design.status !== 'published') {
      return next(badRequest('Only published designs can be added to the pipeline'))
    }

    await Promise.all([
      pipelineRef(uid).doc(designId).set(
        { designId, addedAt: FieldValue.serverTimestamp() },
        { merge: true },
      ),
      adminDb.collection(DESIGNS).doc(designId).update({
        pipeline_uids: FieldValue.arrayUnion(uid),
      }),
    ])

    res.status(200).json({ status: 'ok', message: 'Added to pipeline' })
  } catch (err) {
    next(err)
  }
}

// ─── DELETE /api/users/me/pipeline/:designId ──────────────────────────────────
export async function removeFromPipeline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const { designId } = req.params

    await Promise.all([
      pipelineRef(uid).doc(designId).delete(),
      adminDb.collection(DESIGNS).doc(designId).update({
        pipeline_uids: FieldValue.arrayRemove(uid),
      }),
    ])
    res.status(200).json({ status: 'ok', message: 'Removed from pipeline' })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/users/me/pipeline ───────────────────────────────────────────────
export async function listPipeline(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const snap = await pipelineRef(uid).orderBy('addedAt', 'desc').get()

    const entries = await Promise.all(
      snap.docs.map(async (doc) => {
        const { designId, addedAt } = doc.data()
        const designSnap = await adminDb.collection(DESIGNS).doc(designId).get()
        if (!designSnap.exists) return null
        const d = designSnap.data() as Design
        return {
          designId,
          addedAt: (addedAt as FirebaseFirestore.Timestamp).toDate().toISOString(),
          title: d.title,
          status: d.status,
          discipline_tags: d.discipline_tags,
          difficulty_level: d.difficulty_level,
          execution_count: d.execution_count ?? 0,
          derived_design_count: d.derived_design_count ?? 0,
          author_ids: d.author_ids ?? [],
        }
      }),
    )

    const data = entries.filter(Boolean)
    res.status(200).json({ status: 'ok', data, count: data.length })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/users/me/pipeline/:designId ─────────────────────────────────────
export async function isPipelined(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const uid = req.user!.uid
    const { designId } = req.params
    const snap = await pipelineRef(uid).doc(designId).get()
    res.status(200).json({ status: 'ok', data: { inPipeline: snap.exists } })
  } catch (err) {
    next(err)
  }
}
