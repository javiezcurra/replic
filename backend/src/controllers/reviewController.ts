import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { FieldValue, Query, DocumentData } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import { Design } from '../types/design'
import {
  Review,
  FieldSuggestion,
  ReadinessSignal,
  SuggestionType,
  CreateReviewBody,
  CreateSuggestionBody,
  CreateEndorsementBody,
  ReviewResponse,
  FieldSuggestionResponse,
  ReviewSummary,
  ContributingReviewer,
} from '../types/review'

const DESIGNS = 'designs'

const VALID_READINESS_SIGNALS: ReadinessSignal[] = ['ready', 'almost_ready', 'needs_revision']
const VALID_SUGGESTION_TYPES: SuggestionType[] = [
  'suggestion',
  'issue',
  'question',
  'safety_concern',
]

// ─── Error helpers ────────────────────────────────────────────────────────────

function badRequest(message: string): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 400
  return err
}

function notFoundError(message = 'Not found'): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 404
  return err
}

function forbidden(message: string): AppError {
  const err: AppError = new Error(message)
  err.statusCode = 403
  return err
}

// ─── Serializers ──────────────────────────────────────────────────────────────

function toSuggestionResponse(s: FieldSuggestion): FieldSuggestionResponse {
  return {
    ...s,
    createdAt: s.createdAt.toDate().toISOString(),
    updatedAt: s.updatedAt.toDate().toISOString(),
  }
}

function toReviewResponse(review: Review, suggestions: FieldSuggestion[]): ReviewResponse {
  return {
    ...review,
    createdAt: review.createdAt.toDate().toISOString(),
    updatedAt: review.updatedAt.toDate().toISOString(),
    suggestions: suggestions.map(toSuggestionResponse),
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function reviewsRef(designId: string) {
  return adminDb.collection(DESIGNS).doc(designId).collection('reviews')
}

async function loadSuggestions(designId: string, reviewId: string): Promise<FieldSuggestion[]> {
  const snap = await reviewsRef(designId).doc(reviewId).collection('suggestions').get()
  const docs = snap.docs.map((d) => d.data() as FieldSuggestion)
  docs.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())
  return docs
}

// Loads a design, asserts it is published and not locked, and that the caller
// is not an owner. Returns the design on success; throws AppError otherwise.
async function requireReviewable(designId: string, callerId: string): Promise<Design> {
  const snap = await adminDb.collection(DESIGNS).doc(designId).get()
  if (!snap.exists) throw notFoundError('Design not found')

  const design = snap.data() as Design

  if (design.status !== 'published') {
    throw forbidden('This design is not published and cannot be reviewed.')
  }
  if (design.execution_count > 0) {
    throw forbidden('This design is locked because executions have begun.')
  }
  if (design.author_ids.includes(callerId)) {
    throw forbidden('You cannot review your own design.')
  }

  return design
}

// ─── POST /api/designs/:id/reviews ───────────────────────────────────────────

export async function submitReview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params
    const callerId = req.user!.uid

    let design: Design
    try {
      design = await requireReviewable(id, callerId)
    } catch (err) {
      return next(err as AppError)
    }

    const body = req.body as CreateReviewBody
    const generalComment = body.generalComment?.trim() || null
    const endorsement = body.endorsement ?? false
    const readinessSignal = body.readinessSignal ?? null
    const suggestions: CreateSuggestionBody[] = Array.isArray(body.suggestions)
      ? body.suggestions
      : []

    // At least one meaningful contribution required
    if (!generalComment && suggestions.length === 0 && !endorsement) {
      return next(
        badRequest(
          'A review must include at least one of: generalComment, suggestions, or endorsement.',
        ),
      )
    }

    // Endorsement requires a comment
    if (endorsement && !generalComment) {
      return next(badRequest('generalComment is required when endorsement is true.'))
    }

    // Validate readinessSignal
    if (readinessSignal !== null && !VALID_READINESS_SIGNALS.includes(readinessSignal)) {
      return next(
        badRequest(`readinessSignal must be one of: ${VALID_READINESS_SIGNALS.join(', ')}`),
      )
    }

    // Validate each suggestion
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i]
      const hasProposedText = !!s.proposedText?.trim()
      const hasComment = !!s.comment?.trim()
      if (!hasProposedText && !hasComment) {
        return next(
          badRequest(`suggestions[${i}]: at least one of proposedText or comment is required.`),
        )
      }
      const fieldRef = s.fieldRef?.trim() || null
      const newFieldName = s.newFieldName?.trim() || null
      if (fieldRef && newFieldName) {
        return next(
          badRequest(`suggestions[${i}]: fieldRef and newFieldName are mutually exclusive.`),
        )
      }
      if (!fieldRef && !newFieldName) {
        return next(
          badRequest(`suggestions[${i}]: one of fieldRef or newFieldName is required.`),
        )
      }
      if (
        s.suggestionType != null &&
        !VALID_SUGGESTION_TYPES.includes(s.suggestionType)
      ) {
        return next(badRequest(`suggestions[${i}]: invalid suggestionType.`))
      }
    }

    const now = FieldValue.serverTimestamp()
    const reviewId = randomUUID()
    const versionNumber = design.published_version
    const batch = adminDb.batch()

    const reviewDocRef = reviewsRef(id).doc(reviewId)
    batch.set(reviewDocRef, {
      id: reviewId,
      designId: id,
      versionNumber,
      reviewerId: callerId,
      generalComment,
      readinessSignal,
      endorsement,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    for (const s of suggestions) {
      const suggestionId = randomUUID()
      batch.set(reviewDocRef.collection('suggestions').doc(suggestionId), {
        id: suggestionId,
        reviewId,
        designId: id,
        versionNumber,
        fieldRef: s.fieldRef?.trim() || null,
        newFieldName: s.newFieldName?.trim() || null,
        proposedText: s.proposedText?.trim() || null,
        comment: s.comment?.trim() || null,
        suggestionType: s.suggestionType ?? null,
        status: 'open',
        ownerReply: null,
        createdAt: now,
        updatedAt: now,
      })
    }

    // Increment review count atomically; flip review_status on first review
    batch.update(adminDb.collection(DESIGNS).doc(id), {
      review_count: FieldValue.increment(1),
      review_status:
        design.review_status === 'unreviewed' ? 'under_review' : design.review_status,
      updated_at: now,
    })

    await batch.commit()

    // Read back the committed documents
    const [reviewSnap, suggsSnap] = await Promise.all([
      reviewDocRef.get(),
      reviewDocRef.collection('suggestions').get(),
    ])

    const savedReview = reviewSnap.data() as Review
    const savedSuggs = suggsSnap.docs.map((d) => d.data() as FieldSuggestion)
    savedSuggs.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())

    res.status(201).json({ status: 'ok', data: toReviewResponse(savedReview, savedSuggs) })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/:id/reviews ────────────────────────────────────────────

export async function listReviews(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params

    const mainSnap = await adminDb.collection(DESIGNS).doc(id).get()
    if (!mainSnap.exists) return next(notFoundError('Design not found'))

    const design = mainSnap.data() as Design
    if (design.status === 'draft') {
      if (!req.user || !design.author_ids.includes(req.user.uid)) {
        return next(notFoundError('Design not found'))
      }
    }

    // When a version is specified, filter by it without orderBy (avoids composite index).
    // In both cases, sort in memory.
    const versionNumber = req.query.version !== undefined
      ? parseInt(req.query.version as string)
      : NaN

    let query: Query<DocumentData> = reviewsRef(id)
    if (!isNaN(versionNumber)) {
      query = query.where('versionNumber', '==', versionNumber)
    }

    const reviewsSnap = await query.get()
    const reviewDocs = reviewsSnap.docs.map((d) => d.data() as Review)
    reviewDocs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())

    const reviews = await Promise.all(
      reviewDocs.map(async (review) => {
        const suggestions = await loadSuggestions(id, review.id)
        return toReviewResponse(review, suggestions)
      }),
    )

    res.status(200).json({ status: 'ok', data: reviews, count: reviews.length })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/:id/reviews/:reviewId ───────────────────────────────────

export async function getReview(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id, reviewId } = req.params

    const reviewSnap = await reviewsRef(id).doc(reviewId).get()
    if (!reviewSnap.exists) return next(notFoundError('Review not found'))

    const review = reviewSnap.data() as Review
    const suggestions = await loadSuggestions(id, reviewId)

    res.status(200).json({ status: 'ok', data: toReviewResponse(review, suggestions) })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/designs/:id/endorsements ──────────────────────────────────────

export async function endorseDesign(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params
    const callerId = req.user!.uid

    let design: Design
    try {
      design = await requireReviewable(id, callerId)
    } catch (err) {
      return next(err as AppError)
    }

    const { comment } = req.body as CreateEndorsementBody
    if (!comment?.trim()) {
      return next(badRequest('comment is required for an endorsement.'))
    }

    const versionNumber = design.published_version

    // Idempotent: return existing endorsement if already present for this user+version
    const existingSnap = await reviewsRef(id)
      .where('reviewerId', '==', callerId)
      .where('versionNumber', '==', versionNumber)
      .where('endorsement', '==', true)
      .limit(1)
      .get()

    if (!existingSnap.empty) {
      const existing = existingSnap.docs[0].data() as Review
      res.status(200).json({ status: 'ok', data: toReviewResponse(existing, []) })
      return
    }

    const now = FieldValue.serverTimestamp()
    const reviewId = randomUUID()
    const batch = adminDb.batch()

    const reviewDocRef = reviewsRef(id).doc(reviewId)
    batch.set(reviewDocRef, {
      id: reviewId,
      designId: id,
      versionNumber,
      reviewerId: callerId,
      generalComment: comment.trim(),
      readinessSignal: null,
      endorsement: true,
      status: 'active',
      createdAt: now,
      updatedAt: now,
    })

    batch.update(adminDb.collection(DESIGNS).doc(id), {
      review_count: FieldValue.increment(1),
      review_status:
        design.review_status === 'unreviewed' ? 'under_review' : design.review_status,
      updated_at: now,
    })

    await batch.commit()

    const saved = (await reviewDocRef.get()).data() as Review
    res.status(201).json({ status: 'ok', data: toReviewResponse(saved, []) })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/:id/endorsements ───────────────────────────────────────

export async function listEndorsements(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params

    const mainSnap = await adminDb.collection(DESIGNS).doc(id).get()
    if (!mainSnap.exists) return next(notFoundError('Design not found'))

    const snap = await reviewsRef(id).where('endorsement', '==', true).get()
    const docs = snap.docs.map((d) => d.data() as Review)
    docs.sort((a, b) => b.createdAt.toMillis() - a.createdAt.toMillis())

    const data = docs.map((r) => ({
      reviewId: r.id,
      reviewerId: r.reviewerId,
      comment: r.generalComment,
      versionNumber: r.versionNumber,
      createdAt: r.createdAt.toDate().toISOString(),
    }))

    res.status(200).json({ status: 'ok', data, count: data.length })
  } catch (err) {
    next(err)
  }
}

// ─── GET /api/designs/:id/review-summary ─────────────────────────────────────

export async function getReviewSummary(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id } = req.params

    const mainSnap = await adminDb.collection(DESIGNS).doc(id).get()
    if (!mainSnap.exists) return next(notFoundError('Design not found'))

    const design = mainSnap.data() as Design
    if (design.status === 'draft') {
      if (!req.user || !design.author_ids.includes(req.user.uid)) {
        return next(notFoundError('Design not found'))
      }
    }

    // Count reviews vs endorsements for the current published version
    const reviewsSnap = await reviewsRef(id)
      .where('versionNumber', '==', design.published_version)
      .get()

    let endorsementCount = 0
    let reviewCount = 0
    for (const doc of reviewsSnap.docs) {
      const r = doc.data() as Review
      if (r.endorsement) endorsementCount++
      else reviewCount++
    }

    const contributorsSnap = await adminDb
      .collection(DESIGNS)
      .doc(id)
      .collection('contributors')
      .get()
    const contributingReviewers = contributorsSnap.docs.map(
      (d) => d.data() as ContributingReviewer,
    )

    const isLocked = design.status === 'locked' || design.execution_count > 0
    const reviewable = design.status === 'published' && !isLocked

    const summary: ReviewSummary = {
      endorsementCount,
      reviewCount,
      contributingReviewers,
      versionNumber: design.published_version,
      isLocked,
      reviewable,
    }

    res.status(200).json({ status: 'ok', data: summary })
  } catch (err) {
    next(err)
  }
}
