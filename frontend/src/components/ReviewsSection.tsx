import { useEffect, useState, useMemo } from 'react'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import ReviewForm from './ReviewForm'
import UserDisplayName from './UserDisplayName'
import type { Design } from '../types/design'
import type { Material } from '../types/material'
import type { Review, ReviewSummary, ReadinessSignal, SuggestionType } from '../types/review'

// ─── Field name display helpers ───────────────────────────────────────────────

const FIELD_DISPLAY_NAMES: Record<string, string> = {
  title:                  'Title',
  summary:                'Summary',
  hypothesis:             'Hypothesis',
  steps:                  'Methodology',
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

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  designId: string
  design: Design
  materialMap: Record<string, Material>
  isAuthor: boolean
  isPublished: boolean
  onReviewCountChange?: (count: number) => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReviewsSection({
  designId,
  design,
  materialMap,
  isAuthor,
  isPublished,
  onReviewCountChange,
}: Props) {
  const { user } = useAuth()
  const [summary, setSummary] = useState<ReviewSummary | null>(null)
  const [reviews, setReviews] = useState<Review[]>([])
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [showForm, setShowForm] = useState(false)
  const [editingReview, setEditingReview] = useState<Review | undefined>(undefined)

  const canReview = !!user && !isAuthor && isPublished && (summary?.reviewable ?? false)
  const alreadyReviewed = summary?.userHasReviewed ?? reviews.some((r) => r.reviewerId === user?.uid)

  useEffect(() => {
    if (!isPublished) return
    loadSummary()
    loadReviews()
  }, [designId])

  async function loadSummary() {
    try {
      const res = await api.get<{ status: string; data: ReviewSummary }>(
        `/api/designs/${designId}/review-summary`,
      )
      setSummary(res.data)
      onReviewCountChange?.(res.data.reviewCount)
    } catch {
      // non-critical
    }
  }

  async function loadReviews() {
    if (loadingReviews) return
    setLoadingReviews(true)
    try {
      const res = await api.get<{ status: string; data: Review[] }>(
        `/api/designs/${designId}/reviews`,
      )
      setReviews(res.data)
    } catch {
      // non-critical
    } finally {
      setLoadingReviews(false)
    }
  }

  async function handleEditReview() {
    let current = reviews
    if (reviews.length === 0) {
      setLoadingReviews(true)
      try {
        const res = await api.get<{ status: string; data: Review[] }>(`/api/designs/${designId}/reviews`)
        setReviews(res.data)
        current = res.data
      } finally {
        setLoadingReviews(false)
      }
    }
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
    loadSummary()
  }

  // Pin the current user's review first; sort others newest-first
  const sortedReviews = useMemo(() => {
    const myUid = user?.uid
    const mine = myUid ? reviews.find((r) => r.reviewerId === myUid) : null
    const others = reviews.filter((r) => r.id !== mine?.id)
    others.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
    return mine ? [mine, ...others] : others
  }, [reviews, user?.uid])

  if (!isPublished) return null

  return (
    <div className="space-y-4">

      {/* Write / edit review button */}
      {!showForm && canReview && (
        alreadyReviewed ? (
          <button onClick={handleEditReview} className="btn-secondary text-sm">
            Edit your review
          </button>
        ) : (
          <button onClick={() => setShowForm(true)} className="btn-primary text-sm">
            Review Experiment
          </button>
        )
      )}

      {/* Sign-in prompt */}
      {!user && !isAuthor && (
        <p className="text-sm text-muted italic">Sign in to leave a review.</p>
      )}

      {/* Review form */}
      {showForm && (
        <div className="rounded-xl border border-surface-2 bg-surface p-5">
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

      {/* Loading */}
      {loadingReviews && (
        <div className="flex justify-center py-8">
          <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* Empty state */}
      {!loadingReviews && sortedReviews.length === 0 && (
        <p className="text-sm text-muted py-2">
          No reviews yet.{' '}
          {canReview ? 'Be the first to review this design.' : isAuthor ? 'Share this design to invite feedback.' : ''}
        </p>
      )}

      {/* Review list — collapsible cards */}
      {!loadingReviews && sortedReviews.map((review) => (
        <CollapsibleReviewCard
          key={review.id}
          review={review}
          isOwn={review.reviewerId === user?.uid}
          onEdit={handleEditReview}
        />
      ))}
    </div>
  )
}

// ─── CollapsibleReviewCard ─────────────────────────────────────────────────────

interface CardProps {
  review: Review
  isOwn: boolean
  onEdit: () => void
}

function CollapsibleReviewCard({ review, isOwn, onEdit }: CardProps) {
  const [collapsed, setCollapsed] = useState(true)
  const suggestionCount = review.suggestions.length

  return (
    <div className="rounded-xl border border-surface-2 bg-white overflow-hidden">

      {/* Header — always visible, click to toggle */}
      <button
        type="button"
        onClick={() => setCollapsed((v) => !v)}
        className="w-full text-left px-4 py-3 hover:bg-surface/50 transition-colors"
      >
        <div className="flex flex-wrap items-center gap-2">
          {isOwn && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white shrink-0"
              style={{ background: 'var(--color-secondary)' }}
            >
              Your review
            </span>
          )}
          <UserDisplayName uid={review.reviewerId} className="text-sm font-medium" />
          <span className="text-xs text-muted">{formatDate(review.createdAt)}</span>
          {review.versionNumber > 0 && (
            <span
              className="text-xs px-1.5 py-0.5 rounded"
              style={{
                fontFamily: 'var(--font-mono)',
                background: 'var(--color-accent)',
                color: 'var(--color-dark)',
              }}
            >
              v{review.versionNumber}
            </span>
          )}
          {review.endorsement && (
            <span className="text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
              Endorsed
            </span>
          )}
          {review.readinessSignal && (
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${READINESS_COLORS[review.readinessSignal]}`}>
              {READINESS_LABELS[review.readinessSignal]}
            </span>
          )}
          {suggestionCount > 0 && (
            <span className="text-xs text-muted">
              {suggestionCount} field suggestion{suggestionCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="ml-auto text-xs text-muted shrink-0">
            {collapsed ? '▸' : '▾'}
          </span>
        </div>
      </button>

      {/* Expanded body */}
      {!collapsed && (
        <div className="border-t border-surface-2 px-4 pb-4 pt-3 space-y-3">

          {review.generalComment && (
            <p className="text-sm text-gray-800 leading-relaxed">{review.generalComment}</p>
          )}

          {review.suggestions.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted uppercase tracking-widest">
                {review.suggestions.length} field suggestion{review.suggestions.length !== 1 ? 's' : ''}
              </p>
              {review.suggestions.map((s) => (
                <div
                  key={s.id}
                  className="rounded-lg border border-surface-2 bg-surface px-3 py-2 space-y-1"
                >
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-dark/5 text-ink">
                      {s.fieldRef ? formatFieldRef(s.fieldRef) : `${s.newFieldName} (new)`}
                    </span>
                    {s.suggestionType && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${SUGGESTION_TYPE_COLORS[s.suggestionType]}`}>
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
                  {s.ownerReply && (
                    <div className="mt-1 rounded px-2 py-1.5" style={{ background: 'var(--color-accent)' }}>
                      <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-dark)' }}>
                        Owner reply
                      </p>
                      <p className="text-xs" style={{ color: 'var(--color-dark)' }}>{s.ownerReply}</p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {isOwn && (
            <button
              onClick={(e) => { e.stopPropagation(); onEdit() }}
              className="text-xs text-primary hover:underline"
            >
              Edit your review
            </button>
          )}
        </div>
      )}
    </div>
  )
}
