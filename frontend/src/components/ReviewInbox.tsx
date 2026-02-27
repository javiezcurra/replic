import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import UserDisplayName from './UserDisplayName'
import type { Review, FieldSuggestion, ReadinessSignal, SuggestionStatus, SuggestionType } from '../types/review'

// ─── Display helpers ──────────────────────────────────────────────────────────

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

function formatFieldRef(fieldRef: string | null, newFieldName: string | null): string {
  if (newFieldName) return `New field: ${newFieldName}`
  if (!fieldRef) return '—'
  const match = fieldRef.match(/^([a-z_]+)(\[(.+)\])?$/)
  if (!match) return fieldRef
  const key = match[1]
  const sub = match[3]
  const label = FIELD_DISPLAY_NAMES[key] ?? key.replace(/_/g, ' ')
  if (!sub) return label
  if (sub === 'new') return `${label} (new item)`
  return `${label} #${sub}`
}

const READINESS_LABELS: Record<ReadinessSignal, string> = {
  ready:          'Ready to execute',
  almost_ready:   'Almost ready',
  needs_revision: 'Needs revision',
}
const READINESS_COLORS: Record<ReadinessSignal, string> = {
  ready:          'bg-green-50 text-green-700',
  almost_ready:   'bg-amber-50 text-amber-700',
  needs_revision: 'bg-red-50 text-red-700',
}

const SUGGESTION_TYPE_COLORS: Record<SuggestionType, string> = {
  suggestion:    'bg-blue-50 text-blue-700',
  issue:         'bg-red-50 text-red-700',
  question:      'bg-violet-50 text-violet-700',
  safety_concern:'bg-amber-50 text-amber-700',
}
const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  suggestion:    'Suggestion',
  issue:         'Issue',
  question:      'Question',
  safety_concern:'Safety concern',
}

const STATUS_COLORS: Record<SuggestionStatus, string> = {
  open:       'bg-surface text-ink border border-surface-2',
  accepted:   'bg-green-50 text-green-700',
  closed:     'bg-gray-100 text-gray-500',
  superseded: 'bg-gray-100 text-gray-400',
  locked:     'bg-gray-100 text-gray-400',
}
const STATUS_LABELS: Record<SuggestionStatus, string> = {
  open:       'Open',
  accepted:   'Accepted',
  closed:     'Closed',
  superseded: 'Superseded',
  locked:     'Locked',
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  designId: string
}

// ─── ReviewInbox ──────────────────────────────────────────────────────────────

export default function ReviewInbox({ designId }: Props) {
  const [reviews, setReviews] = useState<Review[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Filter state
  const [statusFilter, setStatusFilter] = useState<SuggestionStatus | 'all'>('all')
  const [readinessFilter, setReadinessFilter] = useState<ReadinessSignal | 'all'>('all')

  // Draft-created toast
  const [draftCreatedToast, setDraftCreatedToast] = useState(false)

  useEffect(() => {
    load()
  }, [designId])

  async function load() {
    setLoading(true)
    setError('')
    try {
      const res = await api.get<{ status: string; data: Review[] }>(`/api/designs/${designId}/reviews`)
      setReviews(res.data)
    } catch {
      setError('Could not load reviews.')
    } finally {
      setLoading(false)
    }
  }

  // Optimistic update helpers
  function patchSuggestion(reviewId: string, suggestionId: string, patch: Partial<FieldSuggestion>) {
    setReviews((prev) =>
      prev.map((r) =>
        r.id !== reviewId
          ? r
          : {
              ...r,
              suggestions: r.suggestions.map((s) =>
                s.id === suggestionId ? { ...s, ...patch } : s,
              ),
            },
      ),
    )
  }

  async function handleAccept(review: Review, suggestion: FieldSuggestion) {
    patchSuggestion(review.id, suggestion.id, { status: 'accepted' })
    try {
      const res = await api.post<{ status: string; data: { suggestion: FieldSuggestion; draftCreated: boolean } }>(
        `/api/designs/${designId}/reviews/${review.id}/suggestions/${suggestion.id}/accept`,
      )
      patchSuggestion(review.id, suggestion.id, res.data.suggestion)
      if (res.data.draftCreated) {
        setDraftCreatedToast(true)
        setTimeout(() => setDraftCreatedToast(false), 4000)
      }
    } catch {
      // Roll back
      patchSuggestion(review.id, suggestion.id, { status: 'open' })
    }
  }

  async function handleClose(review: Review, suggestion: FieldSuggestion) {
    patchSuggestion(review.id, suggestion.id, { status: 'closed' })
    try {
      const res = await api.post<{ status: string; data: FieldSuggestion }>(
        `/api/designs/${designId}/reviews/${review.id}/suggestions/${suggestion.id}/close`,
      )
      patchSuggestion(review.id, suggestion.id, res.data)
    } catch {
      patchSuggestion(review.id, suggestion.id, { status: 'open' })
    }
  }

  async function handleReply(review: Review, suggestion: FieldSuggestion, replyText: string) {
    try {
      const res = await api.post<{ status: string; data: FieldSuggestion }>(
        `/api/designs/${designId}/reviews/${review.id}/suggestions/${suggestion.id}/reply`,
        { reply: replyText },
      )
      patchSuggestion(review.id, suggestion.id, res.data)
    } catch {
      // No-op — let the reply input stay open
    }
  }

  // ── Filtered view ──────────────────────────────────────────────────────────

  const openCount = reviews.flatMap((r) => r.suggestions).filter((s) => s.status === 'open').length

  const filteredReviews = reviews
    .filter((r) => {
      if (readinessFilter !== 'all' && r.readinessSignal !== readinessFilter) return false
      if (statusFilter !== 'all') {
        // Keep the review only if it has at least one suggestion matching the filter
        if (r.suggestions.length > 0 && !r.suggestions.some((s) => s.status === statusFilter)) return false
        if (r.suggestions.length === 0 && statusFilter !== 'open') return false
      }
      return true
    })
    .map((r) => ({
      ...r,
      suggestions:
        statusFilter === 'all'
          ? r.suggestions
          : r.suggestions.filter((s) => s.status === statusFilter),
    }))

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="card p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-3">
          <h2
            className="text-base font-semibold"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
          >
            Review Inbox
          </h2>
          {openCount > 0 && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              {openCount} open
            </span>
          )}
        </div>
        <button
          onClick={load}
          className="text-xs text-muted hover:text-ink transition-colors"
        >
          Refresh
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-2 mb-5">
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as SuggestionStatus | 'all')}
          className="input-sm text-xs py-1"
        >
          <option value="all">All statuses</option>
          <option value="open">Open</option>
          <option value="accepted">Accepted</option>
          <option value="closed">Closed</option>
          <option value="superseded">Superseded</option>
        </select>
        <select
          value={readinessFilter}
          onChange={(e) => setReadinessFilter(e.target.value as ReadinessSignal | 'all')}
          className="input-sm text-xs py-1"
        >
          <option value="all">All readiness signals</option>
          <option value="ready">Ready to execute</option>
          <option value="almost_ready">Almost ready</option>
          <option value="needs_revision">Needs revision</option>
        </select>
      </div>

      {/* Draft-created toast */}
      {draftCreatedToast && (
        <div
          className="mb-4 rounded-xl px-4 py-3 text-sm text-white"
          style={{ background: 'var(--color-dark)' }}
        >
          A draft has been created. Open the editor to incorporate this suggestion.
        </div>
      )}

      {/* Content */}
      {loading ? (
        <div className="flex justify-center py-10">
          <div
            className="w-6 h-6 rounded-full border-2 border-t-transparent animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : error ? (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
      ) : filteredReviews.length === 0 ? (
        <div className="text-center py-10 text-sm text-muted">
          {reviews.length === 0
            ? 'No reviews yet. Share your design to invite feedback.'
            : 'No reviews match the current filters.'}
        </div>
      ) : (
        <div className="space-y-6">
          {filteredReviews.map((review) => (
            <InboxReviewCard
              key={review.id}
              review={review}
              onAccept={(s) => handleAccept(review, s)}
              onClose={(s) => handleClose(review, s)}
              onReply={(s, text) => handleReply(review, s, text)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── InboxReviewCard ──────────────────────────────────────────────────────────

interface CardProps {
  review: Review
  onAccept: (s: FieldSuggestion) => void
  onClose: (s: FieldSuggestion) => void
  onReply: (s: FieldSuggestion, text: string) => void
}

function InboxReviewCard({ review, onAccept, onClose, onReply }: CardProps) {
  const openSuggestions = review.suggestions.filter((s) => s.status === 'open').length

  return (
    <div className="rounded-xl border border-surface-2 overflow-hidden">
      {/* Reviewer meta */}
      <div className="px-5 py-4 bg-surface flex flex-wrap items-center gap-3 border-b border-surface-2">
        <UserDisplayName uid={review.reviewerId} className="text-sm font-medium" />
        <span className="text-xs text-muted">{formatDate(review.createdAt)}</span>
        {review.versionNumber > 0 && (
          <span
            className="text-xs px-2 py-0.5 rounded-full"
            style={{ background: 'var(--color-accent)', color: 'var(--color-dark)', fontFamily: 'var(--font-mono)' }}
          >
            v{review.versionNumber}
          </span>
        )}
        {review.endorsement && (
          <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
            Endorsed
          </span>
        )}
        {review.readinessSignal && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${READINESS_COLORS[review.readinessSignal]}`}>
            {READINESS_LABELS[review.readinessSignal]}
          </span>
        )}
        {openSuggestions > 0 && (
          <span className="ml-auto text-xs text-muted">
            {openSuggestions} open suggestion{openSuggestions !== 1 ? 's' : ''}
          </span>
        )}
      </div>

      {/* General comment */}
      {review.generalComment && (
        <div className="px-5 py-4 border-b border-surface-2">
          <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-1">Comment</p>
          <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{review.generalComment}</p>
        </div>
      )}

      {/* Suggestions */}
      {review.suggestions.length > 0 && (
        <div className="divide-y divide-surface-2">
          {review.suggestions.map((s) => (
            <SuggestionRow
              key={s.id}
              suggestion={s}
              onAccept={() => onAccept(s)}
              onClose={() => onClose(s)}
              onReply={(text) => onReply(s, text)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── SuggestionRow ────────────────────────────────────────────────────────────

interface RowProps {
  suggestion: FieldSuggestion
  onAccept: () => void
  onClose: () => void
  onReply: (text: string) => void
}

function SuggestionRow({ suggestion, onAccept, onClose, onReply }: RowProps) {
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [showReplyInput, setShowReplyInput] = useState(false)

  const isOpen = suggestion.status === 'open'
  const fieldLabel = formatFieldRef(suggestion.fieldRef, suggestion.newFieldName)

  async function handleSendReply() {
    if (!replyText.trim()) return
    setSending(true)
    await onReply(replyText.trim())
    setSending(false)
    setReplyText('')
    setShowReplyInput(false)
  }

  return (
    <div className="px-5 py-4 space-y-3">
      {/* Top row: field + type badge + status */}
      <div className="flex flex-wrap items-center gap-2">
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--color-secondary)', fontFamily: 'var(--font-mono)' }}
        >
          {fieldLabel}
        </span>
        {suggestion.suggestionType && (
          <span className={`text-xs px-2 py-0.5 rounded-full ${SUGGESTION_TYPE_COLORS[suggestion.suggestionType]}`}>
            {SUGGESTION_TYPE_LABELS[suggestion.suggestionType]}
          </span>
        )}
        <span className={`ml-auto text-xs px-2 py-0.5 rounded-full ${STATUS_COLORS[suggestion.status]}`}>
          {STATUS_LABELS[suggestion.status]}
        </span>
      </div>

      {/* Proposed text */}
      {suggestion.proposedText && (
        <div className="rounded-lg bg-surface border border-surface-2 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">Proposed</p>
          <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">{suggestion.proposedText}</p>
        </div>
      )}

      {/* Reviewer comment */}
      {suggestion.comment && (
        <p className="text-sm text-ink leading-relaxed whitespace-pre-line">{suggestion.comment}</p>
      )}

      {/* Owner reply (if sent) */}
      {suggestion.ownerReply && (
        <div
          className="rounded-lg px-3 py-2"
          style={{ background: 'var(--color-accent)' }}
        >
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-1" style={{ color: 'var(--color-dark)' }}>
            Your reply
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-dark)' }}>
            {suggestion.ownerReply}
          </p>
        </div>
      )}

      {/* Actions row */}
      <div className="flex flex-wrap items-center gap-2">
        {isOpen && (
          <>
            <button
              onClick={onAccept}
              className="text-xs px-3 py-1.5 rounded-lg font-medium transition-colors text-white"
              style={{ background: 'var(--color-primary)' }}
            >
              Accept
            </button>
            <button
              onClick={onClose}
              className="text-xs px-3 py-1.5 rounded-lg border border-surface-2 font-medium text-muted hover:text-ink hover:border-secondary transition-colors"
            >
              Close
            </button>
          </>
        )}
        {suggestion.ownerReply === null && (
          <button
            onClick={() => setShowReplyInput((v) => !v)}
            className="text-xs text-muted hover:text-ink transition-colors ml-auto"
          >
            {showReplyInput ? 'Cancel reply' : 'Reply'}
          </button>
        )}
      </div>

      {/* Reply input */}
      {showReplyInput && suggestion.ownerReply === null && (
        <div className="space-y-2">
          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Write a reply to the reviewer…"
            className="w-full input-sm text-sm resize-y"
          />
          <button
            onClick={handleSendReply}
            disabled={sending || !replyText.trim()}
            className="text-xs px-3 py-1.5 rounded-lg font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--color-dark)' }}
          >
            {sending ? 'Sending…' : 'Send reply'}
          </button>
        </div>
      )}
    </div>
  )
}
