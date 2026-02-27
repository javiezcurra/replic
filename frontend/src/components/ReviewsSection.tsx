import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import ReviewForm from './ReviewForm'
import type { Design } from '../types/design'
import type { Material } from '../types/material'
import type { Review, ReviewSummary, ReadinessSignal, SuggestionType } from '../types/review'

// ─── Field name display helpers ───────────────────────────────────────────────

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  title:                  'Title',
  summary:                'Summary',
  hypothesis:             'Hypothesis',
  steps:                  'Procedure / Steps',
  materials:              'Materials',
  research_questions:     'Research Questions',
  independent_variables:  'Independent Variables',
  dependent_variables:    'Dependent Variables',
  controlled_variables:   'Controlled Variables',
  safety_considerations:  'Safety Considerations',
  analysis_plan:          'Analysis Plan',
  ethical_considerations: 'Ethical Considerations',
}

function formatFieldRef(fieldRef: string): string {
  const match = fieldRef.match(/^([a-z_]+)(\[(.+)\])?$/)
  if (!match) return fieldRef
  const key = match[1]
  const sub = match[3]
  const displayName = FIELD_DISPLAY_NAMES[key] ?? key.replace(/_/g, ' ')
  if (!sub) return displayName
  if (sub === 'new') return `${displayName} (new)`
  return `${displayName} #${sub}`
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  designId: string
  design: Design
  materialMap: Record<string, Material>
  isAuthor: boolean
  isPublished: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const READINESS_LABELS: Record<ReadinessSignal, string> = {
  ready:          'Ready to execute',
  almost_ready:   'Almost ready',
  needs_revision: 'Needs revision',
}

const READINESS_COLORS: Record<ReadinessSignal, string> = {
  ready:          'bg-green-50 text-green-700',
  almost_ready:   'bg-yellow-50 text-yellow-700',
  needs_revision: 'bg-red-50 text-red-700',
}

const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  suggestion:    'Suggestion',
  issue:         'Issue',
  question:      'Question',
  safety_concern:'Safety concern',
}

const SUGGESTION_TYPE_COLORS: Record<SuggestionType, string> = {
  suggestion:    'bg-blue-50 text-blue-700',
  issue:         'bg-red-50 text-red-700',
  question:      'bg-violet-50 text-violet-700',
  safety_concern:'bg-amber-50 text-amber-700',
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric', month: 'short', day: 'numeric',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReviewsSection({ designId, design, materialMap, isAuthor, isPublished }: Props) {
  const { user } = useAuth()
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [showReviews, setShowReviews] = useState(false)
  const [summaryError, setSummaryError] = useState('')
  const [editingReview, setEditingReview] = useState<Review | undefined>(undefined)

  const canReview = !!user && !isAuthor && isPublished && (summary?.reviewable ?? false)
  // userHasReviewed comes from the summary (server-authoritative); fall back to local check
  const alreadyReviewed = summary?.userHasReviewed ?? reviews.some((r) => r.reviewerId === user?.uid)

  useEffect(() => {
    loadSummary()
  }, [designId])

  async function loadSummary() {
    try {
      const res = await api.get<{ status: string; data: ReviewSummary }>(
        `/api/designs/${designId}/review-summary`,
      )
      setSummary(res.data)
    } catch {
      setSummaryError('Could not load review summary.')
    }
  }

  async function loadReviews(): Promise<Review[]> {
    if (loadingReviews) return reviews
    setLoadingReviews(true)
    try {
      const res = await api.get<{ status: string; data: Review[] }>(
        `/api/designs/${designId}/reviews`,
      )
      setReviews(res.data)
      return res.data
    } catch {
      return reviews
    } finally {
      setLoadingReviews(false)
    }
  }

  function handleToggleReviews() {
    const next = !showReviews
    setShowReviews(next)
    if (next && reviews.length === 0) loadReviews()
  }

  async function handleEditReview() {
    let current = reviews
    if (reviews.length === 0) current = await loadReviews()
    const mine = user ? current.find((r) => r.reviewerId === user.uid) : undefined
    setEditingReview(mine)
    setShowForm(true)
  }

  function handleReviewSubmitted(review: Review) {
    setReviews((prev) => {
      const idx = prev.findIndex((r) => r.id === review.id)
      if (idx !== -1) {
        const next = [...prev]
        next[idx] = review
        return next
      }
      return [review, ...prev]
    })
    setShowForm(false)
    setEditingReview(undefined)
    setShowReviews(true)
    // Reload summary from server since counts may have changed
    loadSummary()
  }

  if (!isPublished) return null

  return (
    <section className="card p-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4 mb-5">
        <div>
          <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">
            Peer Reviews
          </h2>
          {summary && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm">
              <span className="text-ink">
                <span className="font-medium">{summary.reviewCount}</span>{' '}
                {summary.reviewCount === 1 ? 'review' : 'reviews'}
              </span>
              <span className="text-ink">
                <span className="font-medium">{summary.endorsementCount}</span>{' '}
                {summary.endorsementCount === 1 ? 'endorsement' : 'endorsements'}
              </span>
              {summary.isLocked && (
                <span className="text-xs bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full self-center">
                  Locked
                </span>
              )}
            </div>
          )}
          {summaryError && (
            <p className="text-xs text-muted">{summaryError}</p>
          )}
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 shrink-0">
          {(summary?.reviewCount ?? 0) + (summary?.endorsementCount ?? 0) > 0 && (
            <button
              onClick={handleToggleReviews}
              className="btn-secondary text-xs"
            >
              {showReviews ? 'Hide' : 'View'} reviews
            </button>
          )}
          {canReview && !alreadyReviewed && !showForm && (
            <button
              onClick={() => setShowForm(true)}
              className="btn-primary text-xs"
            >
              Write a review
            </button>
          )}
          {canReview && alreadyReviewed && !showForm && (
            <button
              onClick={handleEditReview}
              className="btn-secondary text-xs"
            >
              Edit your review
            </button>
          )}
          {!user && isPublished && !isAuthor && (
            <p className="text-xs text-muted italic">Sign in to leave a review</p>
          )}
        </div>
      </div>

      {/* Review form */}
      {showForm && (
        <div className="mb-5 rounded-xl border border-surface-2 bg-surface p-5">
          <h3 className="text-sm font-semibold text-ink mb-4">
            {editingReview ? 'Edit your review' : 'Write a review'}
          </h3>
          <ReviewForm
            designId={designId}
            design={design}
            materialMap={materialMap}
            existingReview={editingReview}
            onSubmitted={handleReviewSubmitted}
            onCancel={() => { setShowForm(false); setEditingReview(undefined) }}
          />
        </div>
      )}

      {/* Review list */}
      {showReviews && (
        <div className="space-y-4">
          {loadingReviews && (
            <div className="flex justify-center py-6">
              <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          )}

          {!loadingReviews && reviews.length === 0 && (
            <p className="text-sm text-muted text-center py-4">No reviews yet.</p>
          )}

          {reviews.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}
        </div>
      )}

      {/* Empty state when no reviews and no form */}
      {!showForm && !showReviews && summary &&
        summary.reviewCount === 0 && summary.endorsementCount === 0 && (
        <p className="text-sm text-muted">
          No reviews yet.{' '}
          {canReview
            ? 'Be the first to review this design.'
            : 'Share this design to invite feedback.'}
        </p>
      )}
    </section>
  )
}

// ─── ReviewCard ───────────────────────────────────────────────────────────────

function ReviewCard({ review }: { review: Review }) {
  const [expanded, setExpanded] = useState(false)
  const hasSuggestions = review.suggestions.length > 0
  const visibleSuggestions = expanded ? review.suggestions : review.suggestions.slice(0, 2)

  return (
    <div className="rounded-xl border border-surface-2 bg-white p-4 space-y-3">
      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-2">
        {review.endorsement && (
          <span className="text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
            Endorsed
          </span>
        )}
        {review.readinessSignal && (
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${READINESS_COLORS[review.readinessSignal]}`}
          >
            {READINESS_LABELS[review.readinessSignal]}
          </span>
        )}
        <span className="text-xs text-muted ml-auto">{formatDate(review.createdAt)}</span>
      </div>

      {/* General comment */}
      {review.generalComment && (
        <p className="text-sm text-gray-800 leading-relaxed">{review.generalComment}</p>
      )}

      {/* Suggestions */}
      {hasSuggestions && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-muted uppercase tracking-widest">
            {review.suggestions.length} field suggestion{review.suggestions.length !== 1 ? 's' : ''}
          </p>
          {visibleSuggestions.map((s) => (
            <div
              key={s.id}
              className="rounded-lg border border-surface-2 bg-surface px-3 py-2 space-y-1"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full bg-dark/5 text-ink"
                >
                  {s.fieldRef ? formatFieldRef(s.fieldRef) : `${s.newFieldName} (new)`}
                </span>
                {s.suggestionType && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full ${SUGGESTION_TYPE_COLORS[s.suggestionType]}`}
                  >
                    {SUGGESTION_TYPE_LABELS[s.suggestionType]}
                  </span>
                )}
              </div>
              {s.proposedText && (
                <p className="text-xs text-ink leading-relaxed">
                  <span className="font-medium text-muted">Proposed: </span>
                  {s.proposedText}
                </p>
              )}
              {s.comment && (
                <p className="text-xs text-muted leading-relaxed italic">{s.comment}</p>
              )}
            </div>
          ))}
          {review.suggestions.length > 2 && (
            <button
              onClick={() => setExpanded((p) => !p)}
              className="text-xs text-primary hover:underline"
            >
              {expanded
                ? 'Show fewer'
                : `Show ${review.suggestions.length - 2} more suggestion${review.suggestions.length - 2 !== 1 ? 's' : ''}`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
