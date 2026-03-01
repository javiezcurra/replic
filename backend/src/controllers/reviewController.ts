import { randomUUID } from 'crypto'
import { Request, Response, NextFunction } from 'express'
import { FieldValue, Query, DocumentData } from 'firebase-admin/firestore'
import { adminDb } from '../lib/firebase'
import { AppError } from '../middleware/errorHandler'
import { Design } from '../types/design'
import { upsertWatchlistEntry } from './watchlistController'
import { createNotification, createNotifications, getDisplayName } from '../lib/notifications'
import { recordEvent, recordEvents } from '../lib/ledger'
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

    const versionNumber = design.published_version
    const now = FieldValue.serverTimestamp()

    // One review per user per version — find any existing review from this caller
    const existingSnap = await reviewsRef(id)
      .where('reviewerId', '==', callerId)
      .where('versionNumber', '==', versionNumber)
      .limit(1)
      .get()

    const isUpdate = !existingSnap.empty
    const reviewId = isUpdate ? existingSnap.docs[0].id : randomUUID()
    const reviewDocRef = reviewsRef(id).doc(reviewId)
    const batch = adminDb.batch()

    if (isUpdate) {
      // Delete old suggestions so they are replaced by the new set
      const oldSuggsSnap = await reviewDocRef.collection('suggestions').get()
      for (const doc of oldSuggsSnap.docs) batch.delete(doc.ref)

      batch.update(reviewDocRef, {
        generalComment,
        readinessSignal,
        endorsement,
        status: 'active',
        updatedAt: now,
      })
      // review_count on the design does not change — total number of reviews is unchanged
    } else {
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

      // Increment review count atomically; flip review_status on first review
      batch.update(adminDb.collection(DESIGNS).doc(id), {
        review_count: FieldValue.increment(1),
        review_status:
          design.review_status === 'unreviewed' ? 'under_review' : design.review_status,
        updated_at: now,
      })
    }

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

    await batch.commit()

    // Auto-add the reviewed design to the reviewer's watchlist (fire-and-forget)
    upsertWatchlistEntry(callerId, id, 'review').catch(() => {})

    // Notify design authors about the new/updated review
    if (!isUpdate) {
      getDisplayName(callerId).then((reviewerName) => {
        const authors = (design.author_ids ?? []).filter((uid) => uid !== callerId)
        createNotifications(authors, {
          type: 'experiment_review_received',
          message: `${reviewerName} submitted a review on "${design.title}"`,
          link: `/designs/${id}`,
          actor_uid: callerId,
          actor_name: reviewerName,
          design_id: id,
          design_title: design.title,
          review_id: reviewId,
        })
      }).catch(() => {})

      // Ledger: award the reviewer for submitting a new review
      recordEvent({
        user_id: callerId,
        event_type: 'DESIGN_REVIEW_SUBMITTED',
        design_id: id,
        design_version: versionNumber,
        review_id: reviewId,
      })

      // Ledger: if review includes an endorsement, award all design authors
      if (endorsement) {
        recordEvents(design.author_ids, 'DESIGN_ENDORSED', {
          design_id: id,
          design_version: versionNumber,
          review_id: reviewId,
        })
      }
    }

    // Read back the committed documents
    const [reviewSnap, suggsSnap] = await Promise.all([
      reviewDocRef.get(),
      reviewDocRef.collection('suggestions').get(),
    ])

    const savedReview = reviewSnap.data() as Review
    const savedSuggs = suggsSnap.docs.map((d) => d.data() as FieldSuggestion)
    savedSuggs.sort((a, b) => a.createdAt.toMillis() - b.createdAt.toMillis())

    res.status(isUpdate ? 200 : 201).json({ status: 'ok', data: toReviewResponse(savedReview, savedSuggs) })
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

    // Ledger: award the reviewer for endorsing + award all design authors
    recordEvent({
      user_id: callerId,
      event_type: 'DESIGN_REVIEW_SUBMITTED',
      design_id: id,
      design_version: versionNumber,
      review_id: reviewId,
    })
    recordEvents(design.author_ids, 'DESIGN_ENDORSED', {
      design_id: id,
      design_version: versionNumber,
      review_id: reviewId,
    })

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

    // Include whether the authenticated caller has already reviewed this version
    let userHasReviewed: boolean | undefined
    if (req.user) {
      const userReviewSnap = await reviewsRef(id)
        .where('reviewerId', '==', req.user.uid)
        .where('versionNumber', '==', design.published_version)
        .limit(1)
        .get()
      userHasReviewed = !userReviewSnap.empty
    }

    const summary: ReviewSummary = {
      endorsementCount,
      reviewCount,
      contributingReviewers,
      versionNumber: design.published_version,
      isLocked,
      reviewable,
      userHasReviewed,
    }

    res.status(200).json({ status: 'ok', data: summary })
  } catch (err) {
    next(err)
  }
}

// ─── Suggestion management (owner only) ──────────────────────────────────────

function suggestionRef(designId: string, reviewId: string, suggestionId: string) {
  return reviewsRef(designId).doc(reviewId).collection('suggestions').doc(suggestionId)
}

async function requireOwnerAndOpenSuggestion(
  designId: string,
  reviewId: string,
  suggestionId: string,
  callerId: string,
): Promise<{ design: Design; suggestion: FieldSuggestion }> {
  const designSnap = await adminDb.collection(DESIGNS).doc(designId).get()
  if (!designSnap.exists) throw notFoundError('Design not found')
  const design = designSnap.data() as Design

  if (!design.author_ids.includes(callerId)) {
    throw forbidden('Only the design owner can manage suggestions.')
  }

  const suggSnap = await suggestionRef(designId, reviewId, suggestionId).get()
  if (!suggSnap.exists) throw notFoundError('Suggestion not found')
  const suggestion = suggSnap.data() as FieldSuggestion

  return { design, suggestion }
}

// ─── POST /api/designs/:id/reviews/:reviewId/suggestions/:suggestionId/accept ─

export async function acceptSuggestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: designId, reviewId, suggestionId } = req.params
    const callerId = req.user!.uid

    let design: Design, suggestion: FieldSuggestion
    try {
      ;({ design, suggestion } = await requireOwnerAndOpenSuggestion(designId, reviewId, suggestionId, callerId))
    } catch (err) {
      return next(err as AppError)
    }

    if (suggestion.status !== 'open') {
      return next(badRequest('Only open suggestions can be accepted.'))
    }

    const now = FieldValue.serverTimestamp()
    const batch = adminDb.batch()
    const suggRef = suggestionRef(designId, reviewId, suggestionId)
    batch.update(suggRef, { status: 'accepted', updatedAt: now })

    // Create a draft if one does not yet exist so the owner can incorporate this suggestion.
    let draftCreated = false
    if (!design.has_draft_changes) {
      const designRef = adminDb.collection(DESIGNS).doc(designId)
      const draftDoc = designRef.collection('draft').doc('current')
      batch.set(draftDoc, { ...design, updated_at: now })
      batch.update(designRef, {
        has_draft_changes: true,
        version: design.version + 1,
        updated_at: now,
      })
      draftCreated = true
    }

    await batch.commit()

    // Notify the reviewer their suggestion was accepted; also record ledger events
    const reviewSnap = await reviewsRef(designId).doc(reviewId).get()
    if (reviewSnap.exists) {
      const review = reviewSnap.data() as { reviewerId: string }
      if (review.reviewerId !== callerId) {
        getDisplayName(callerId).then(() => {
          createNotification(review.reviewerId, {
            type: 'review_interaction',
            review_action: 'accepted',
            message: `Your suggestion on "${design.title}" was accepted`,
            link: `/designs/${designId}`,
            actor_uid: callerId,
            design_id: designId,
            design_title: design.title,
            review_id: reviewId,
          })
        }).catch(() => {})
      }

      // Ledger: award reviewer for having a suggestion accepted
      recordEvent({
        user_id: review.reviewerId,
        event_type: 'REVIEW_SUGGESTION_ACCEPTED_ON_DESIGN',
        design_id: designId,
        design_version: suggestion.versionNumber,
        review_id: reviewId,
        suggestion_id: suggestionId,
      })

      // Ledger: extra award if this was a safety suggestion
      if (suggestion.suggestionType === 'safety_concern') {
        recordEvent({
          user_id: review.reviewerId,
          event_type: 'SAFETY_SUGGESTION_ACCEPTED',
          design_id: designId,
          design_version: suggestion.versionNumber,
          review_id: reviewId,
          suggestion_id: suggestionId,
        })
      }
    }

    const updatedSnap = await suggRef.get()
    const updated = updatedSnap.data() as FieldSuggestion

    res.json({ status: 'ok', data: { suggestion: toSuggestionResponse(updated), draftCreated } })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/designs/:id/reviews/:reviewId/suggestions/:suggestionId/close ──

export async function closeSuggestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: designId, reviewId, suggestionId } = req.params
    const callerId = req.user!.uid

    let suggestion: FieldSuggestion
    try {
      ;({ suggestion } = await requireOwnerAndOpenSuggestion(designId, reviewId, suggestionId, callerId))
    } catch (err) {
      return next(err as AppError)
    }

    if (suggestion.status !== 'open') {
      return next(badRequest('Only open suggestions can be closed.'))
    }

    const now = FieldValue.serverTimestamp()
    const suggRef = suggestionRef(designId, reviewId, suggestionId)
    await suggRef.update({ status: 'closed', updatedAt: now })

    // Notify the reviewer their suggestion was closed
    const reviewSnap = await reviewsRef(designId).doc(reviewId).get()
    if (reviewSnap.exists) {
      const review = reviewSnap.data() as { reviewerId: string; designId: string }
      const designSnap = await adminDb.collection(DESIGNS).doc(designId).get()
      const designTitle = (designSnap.data() as Design | undefined)?.title ?? 'a design'
      if (review.reviewerId !== callerId) {
        createNotification(review.reviewerId, {
          type: 'review_interaction',
          review_action: 'closed',
          message: `Your suggestion on "${designTitle}" was closed`,
          link: `/designs/${designId}`,
          actor_uid: callerId,
          design_id: designId,
          design_title: designTitle,
          review_id: reviewId,
        })
      }
    }

    const updatedSnap = await suggRef.get()
    const updated = updatedSnap.data() as FieldSuggestion

    res.json({ status: 'ok', data: toSuggestionResponse(updated) })
  } catch (err) {
    next(err)
  }
}

// ─── POST /api/designs/:id/reviews/:reviewId/suggestions/:suggestionId/reply ──

export async function replySuggestion(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const { id: designId, reviewId, suggestionId } = req.params
    const callerId = req.user!.uid

    const designSnap = await adminDb.collection(DESIGNS).doc(designId).get()
    if (!designSnap.exists) return next(notFoundError('Design not found'))
    const design = designSnap.data() as Design

    if (!design.author_ids.includes(callerId)) {
      return next(forbidden('Only the design owner can reply to suggestions.'))
    }

    const reply = (req.body?.reply ?? '').trim()
    if (!reply) return next(badRequest('Reply text is required.'))

    const suggSnap = await suggestionRef(designId, reviewId, suggestionId).get()
    if (!suggSnap.exists) return next(notFoundError('Suggestion not found'))
    const suggestion = suggSnap.data() as FieldSuggestion

    if (suggestion.ownerReply !== null) {
      const err: AppError = new Error('A reply has already been sent for this suggestion.')
      err.statusCode = 409
      return next(err)
    }

    const now = FieldValue.serverTimestamp()
    const suggRef = suggestionRef(designId, reviewId, suggestionId)
    await suggRef.update({ ownerReply: reply, updatedAt: now })

    // Notify the reviewer that the author replied to their suggestion
    const reviewSnap = await reviewsRef(designId).doc(reviewId).get()
    if (reviewSnap.exists) {
      const review = reviewSnap.data() as { reviewerId: string }
      if (review.reviewerId !== callerId) {
        createNotification(review.reviewerId, {
          type: 'review_interaction',
          review_action: 'replied',
          message: `The author of "${design.title}" replied to your suggestion`,
          link: `/designs/${designId}`,
          actor_uid: callerId,
          design_id: designId,
          design_title: design.title,
          review_id: reviewId,
        })
      }
    }

    const updatedSnap = await suggRef.get()
    const updated = updatedSnap.data() as FieldSuggestion

    res.json({ status: 'ok', data: toSuggestionResponse(updated) })
  } catch (err) {
    next(err)
  }
}
