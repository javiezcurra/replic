import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Design, DesignMaterial, DataType } from '../types/design'
import type { Material } from '../types/material'
import type { CollaboratorEntry } from '../types/user'
import type { Review, FieldSuggestion, ReadinessSignal, SuggestionType } from '../types/review'
import DesignForm, { defaultFormValues, formValuesToBody, type DesignFormValues } from '../components/DesignForm'
import UserDisplayName from '../components/UserDisplayName'

// ─── Display helpers ──────────────────────────────────────────────────────────

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
const SUGGESTION_TYPE_LABELS: Record<SuggestionType, string> = {
  suggestion:    'Suggestion',
  issue:         'Issue',
  question:      'Question',
  safety_concern:'Safety concern',
}
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

// ─── designToFormValues ───────────────────────────────────────────────────────

function designToFormValues(d: Design): DesignFormValues {
  return {
    title: d.title,
    summary: d.summary ?? '',
    discipline_tags: d.discipline_tags.join(', '),
    difficulty_level: d.difficulty_level,
    // Populated with placeholder names; loadMaterialDetails() overwrites with real names.
    materials: d.materials.map((m) => ({
      id: m.material_id,
      name: m.material_id,
      quantity: m.quantity,
      alternatives_allowed: m.alternatives_allowed,
      criticality: m.criticality,
    })),
    steps: d.steps.length ? d.steps : [{ step_number: 1, instruction: '' }],
    research_questions: d.research_questions.length
      ? d.research_questions
      : [{ id: crypto.randomUUID(), question: '', expected_data_type: 'numeric' }],
    safety_considerations: d.safety_considerations ?? '',
    reference_experiment_ids: d.reference_experiment_ids ?? [],
    hypothesis: d.hypothesis ?? '',
    independent_variables: d.independent_variables ?? [],
    dependent_variables: d.dependent_variables ?? [],
    controlled_variables: d.controlled_variables ?? [],
    sample_size: d.sample_size != null ? String(d.sample_size) : '',
    analysis_plan: d.analysis_plan ?? '',
    seeking_collaborators: d.seeking_collaborators,
    collaboration_notes: d.collaboration_notes ?? '',
    ethical_considerations: d.ethical_considerations ?? '',
    disclaimers: d.disclaimers ?? '',
    // Placeholder uids; loadCoauthorDetails() will fill in display names.
    coauthors: (d.coauthor_uids ?? []).map((uid) => ({ uid, displayName: uid })),
  }
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function EditDesign() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [values, setValues] = useState<DesignFormValues>(defaultFormValues())
  const [design, setDesign] = useState<Design | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  // Changelog note — only shown / submitted when editing a design that has been published at least once
  const [changelog, setChangelog] = useState('')

  // Review navigator state
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewIdx, setReviewIdx] = useState(0)
  const [loadingReviews, setLoadingReviews] = useState(false)
  const [applyToast, setApplyToast] = useState<string | null>(null)

  async function loadCoauthorDetails(coauthorUids: string[]) {
    if (!coauthorUids.length) return
    try {
      const res = await api.get<{ status: string; data: CollaboratorEntry[] }>('/api/users/me/collaborators')
      const nameMap: Record<string, string> = {}
      res.data.forEach((c) => { nameMap[c.uid] = c.displayName })
      setValues((prev) => ({
        ...prev,
        coauthors: prev.coauthors.map((c) =>
          nameMap[c.uid] ? { ...c, displayName: nameMap[c.uid] } : c,
        ),
      }))
    } catch {
      // non-critical — placeholder uids remain
    }
  }

  async function loadMaterialDetails(designMaterials: DesignMaterial[]) {
    if (!designMaterials.length) return
    const results = await Promise.allSettled(
      designMaterials.map((m) =>
        api.get<{ status: string; data: Material }>(`/api/materials/${m.material_id}`)
      )
    )
    setValues((prev) => ({
      ...prev,
      materials: prev.materials.map((entry, i) => {
        const r = results[i]
        return r.status === 'fulfilled' ? { ...entry, name: r.value.data.name } : entry
      }),
    }))
  }

  async function loadReviews() {
    if (!id) return
    setLoadingReviews(true)
    try {
      const res = await api.get<{ status: string; data: Review[] }>(`/api/designs/${id}/reviews`)
      setReviews(res.data)
      setReviewIdx(0)
    } catch {
      // non-critical
    } finally {
      setLoadingReviews(false)
    }
  }

  useEffect(() => {
    api.get<{ status: string; data: Design }>(`/api/designs/${id}`)
      .then(({ data: d }) => {
        setDesign(d)
        setValues(designToFormValues(d))
        loadMaterialDetails(d.materials)
        if (d.coauthor_uids?.length) loadCoauthorDetails(d.coauthor_uids)
        setChangelog(d.pending_changelog ?? '')
        if (d.published_version > 0) {
          loadReviews()
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  // ─── Suggestion actions ───────────────────────────────────────────────────

  function applyProposedText(fieldRef: string | null, proposedText: string | null): boolean {
    if (!proposedText || !fieldRef) return false
    const match = fieldRef.match(/^([a-z_]+)(\[(.+)\])?$/)
    if (!match) return false
    const key = match[1]
    const sub = match[3]

    setValues((prev) => {
      switch (key) {
        case 'title':                  return { ...prev, title: proposedText }
        case 'summary':                return { ...prev, summary: proposedText }
        case 'hypothesis':             return { ...prev, hypothesis: proposedText }
        case 'safety_considerations':  return { ...prev, safety_considerations: proposedText }
        case 'analysis_plan':          return { ...prev, analysis_plan: proposedText }
        case 'ethical_considerations': return { ...prev, ethical_considerations: proposedText }
        case 'steps': {
          if (sub === 'new') {
            return {
              ...prev,
              steps: [...prev.steps, { step_number: prev.steps.length + 1, instruction: proposedText }],
            }
          }
          const idx = parseInt(sub ?? '1', 10) - 1
          if (idx < 0) return prev
          return {
            ...prev,
            steps: prev.steps.map((s, i) => i === idx ? { ...s, instruction: proposedText } : s),
          }
        }
        case 'research_questions': {
          if (sub === 'new') {
            return {
              ...prev,
              research_questions: [
                ...prev.research_questions,
                { id: crypto.randomUUID(), question: proposedText, expected_data_type: 'numeric' as DataType },
              ],
            }
          }
          const idx = parseInt(sub ?? '1', 10) - 1
          if (idx < 0) return prev
          return {
            ...prev,
            research_questions: prev.research_questions.map((q, i) =>
              i === idx ? { ...q, question: proposedText } : q
            ),
          }
        }
        default: return prev
      }
    })
    return true
  }

  function patchSuggestion(reviewId: string, suggestionId: string, patch: Partial<FieldSuggestion>) {
    setReviews((prev) =>
      prev.map((r) =>
        r.id !== reviewId
          ? r
          : { ...r, suggestions: r.suggestions.map((s) => s.id === suggestionId ? { ...s, ...patch } : s) }
      )
    )
  }

  async function handleAccept(review: Review, suggestion: FieldSuggestion) {
    patchSuggestion(review.id, suggestion.id, { status: 'accepted' })
    const applied = applyProposedText(suggestion.fieldRef, suggestion.proposedText)
    if (applied) {
      setApplyToast(`Applied to: ${formatFieldRef(suggestion.fieldRef, suggestion.newFieldName)}`)
      setTimeout(() => setApplyToast(null), 3000)
    }
    try {
      const res = await api.post<{ status: string; data: { suggestion: FieldSuggestion; draftCreated: boolean } }>(
        `/api/designs/${id}/reviews/${review.id}/suggestions/${suggestion.id}/accept`,
      )
      patchSuggestion(review.id, suggestion.id, res.data.suggestion)
    } catch {
      patchSuggestion(review.id, suggestion.id, { status: 'open' })
    }
  }

  async function handleClose(review: Review, suggestion: FieldSuggestion) {
    patchSuggestion(review.id, suggestion.id, { status: 'closed' })
    try {
      const res = await api.post<{ status: string; data: FieldSuggestion }>(
        `/api/designs/${id}/reviews/${review.id}/suggestions/${suggestion.id}/close`,
      )
      patchSuggestion(review.id, suggestion.id, res.data)
    } catch {
      patchSuggestion(review.id, suggestion.id, { status: 'open' })
    }
  }

  async function handleReply(review: Review, suggestion: FieldSuggestion, replyText: string) {
    try {
      const res = await api.post<{ status: string; data: FieldSuggestion }>(
        `/api/designs/${id}/reviews/${review.id}/suggestions/${suggestion.id}/reply`,
        { reply: replyText },
      )
      patchSuggestion(review.id, suggestion.id, res.data)
    } catch {
      // no-op
    }
  }

  // ─── Form submit ──────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body: Record<string, unknown> = { ...formValuesToBody(values) }
      if (design && design.published_version > 0) {
        body.pending_changelog = changelog
      }
      await api.patch(`/api/designs/${id}`, body)
      navigate(`/designs/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Loading / error states ───────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isLocked = design ? design.execution_count >= 1 : false
  const isVersioned = design ? design.published_version > 0 : false
  const currentReview = reviews[reviewIdx] ?? null
  const openSuggestionCount = reviews.flatMap((r) => r.suggestions).filter((s) => s.status === 'open').length

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Design</h1>

      <form onSubmit={handleSubmit}>
        {isVersioned ? (
          /* Two-column layout when editing a versioned (published) design */
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
            <div className="lg:col-span-2 space-y-6">
              <DesignForm values={values} onChange={setValues} lockedMethodology={isLocked} />
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-2">
                <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
                  {submitting ? 'Saving…' : 'Save changes'}
                </button>
                <button type="button" onClick={() => navigate(`/designs/${id}`)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </div>

            {/* Sticky sidebar */}
            <div className="lg:sticky lg:top-6 space-y-5">

              {/* Changelog */}
              <div className="card p-5 space-y-3">
                <h2
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Change Log
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Summarise what changed in this version. This note will be attached when you publish.
                </p>
                <textarea
                  rows={8}
                  value={changelog}
                  onChange={(e) => setChangelog(e.target.value)}
                  placeholder="e.g. Clarified step 3, added safety note, updated sample size…"
                  className="w-full input-sm resize-y text-sm"
                  style={{ fontFamily: 'var(--font-body)' }}
                />
              </div>

              {/* Review navigator */}
              {loadingReviews && (
                <div className="card p-5 flex justify-center py-8">
                  <div className="w-5 h-5 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              )}

              {!loadingReviews && reviews.length > 0 && currentReview && (
                <div className="card p-5 space-y-4">
                  {/* Header */}
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h2
                        className="text-xs font-semibold uppercase tracking-widest"
                        style={{ color: 'var(--color-text-muted)' }}
                      >
                        Peer Reviews
                      </h2>
                      {openSuggestionCount > 0 && (
                        <span
                          className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full text-white"
                          style={{ background: 'var(--color-primary)' }}
                        >
                          {openSuggestionCount} open
                        </span>
                      )}
                    </div>
                    {/* Navigator arrows */}
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setReviewIdx(Math.max(0, reviewIdx - 1))}
                        disabled={reviewIdx === 0}
                        className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30 transition-colors"
                      >
                        ‹
                      </button>
                      <span className="text-xs text-muted tabular-nums">
                        {reviewIdx + 1}/{reviews.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setReviewIdx(Math.min(reviews.length - 1, reviewIdx + 1))}
                        disabled={reviewIdx === reviews.length - 1}
                        className="w-6 h-6 flex items-center justify-center rounded text-muted hover:text-ink disabled:opacity-30 transition-colors"
                      >
                        ›
                      </button>
                    </div>
                  </div>

                  {/* Apply toast */}
                  {applyToast && (
                    <div
                      className="rounded-lg px-3 py-2 text-xs font-medium text-white"
                      style={{ background: 'var(--color-dark)' }}
                    >
                      ✓ {applyToast}
                    </div>
                  )}

                  {/* Reviewer meta */}
                  <div className="flex flex-wrap items-center gap-2">
                    <UserDisplayName uid={currentReview.reviewerId} className="text-xs font-medium" />
                    {currentReview.endorsement && (
                      <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full font-medium">
                        Endorsed
                      </span>
                    )}
                    {currentReview.readinessSignal && (
                      <span className={`text-xs px-2 py-0.5 rounded-full ${READINESS_COLORS[currentReview.readinessSignal]}`}>
                        {READINESS_LABELS[currentReview.readinessSignal]}
                      </span>
                    )}
                  </div>

                  {/* General comment */}
                  {currentReview.generalComment && (
                    <p
                      className="text-xs text-gray-700 leading-relaxed italic border-l-2 pl-2"
                      style={{ borderColor: 'var(--color-accent)' }}
                    >
                      {currentReview.generalComment}
                    </p>
                  )}

                  {/* Suggestions */}
                  {currentReview.suggestions.length > 0 ? (
                    <div className="space-y-3">
                      {currentReview.suggestions.map((s) => (
                        <EditSuggestionRow
                          key={s.id}
                          suggestion={s}
                          onAccept={() => handleAccept(currentReview, s)}
                          onClose={() => handleClose(currentReview, s)}
                          onReply={(text) => handleReply(currentReview, s, text)}
                        />
                      ))}
                    </div>
                  ) : (
                    !currentReview.generalComment && (
                      <p className="text-xs text-muted italic">No suggestions in this review.</p>
                    )
                  )}
                </div>
              )}
            </div>
          </div>
        ) : (
          /* Single-column layout for new (never-published) drafts */
          <div className="space-y-6">
            <DesignForm values={values} onChange={setValues} lockedMethodology={isLocked} />
            {error && <p className="text-sm text-red-600">{error}</p>}
            <div className="flex gap-3 pt-2">
              <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
                {submitting ? 'Saving…' : 'Save changes'}
              </button>
              <button type="button" onClick={() => navigate(`/designs/${id}`)} className="btn-secondary text-sm">
                Cancel
              </button>
            </div>
          </div>
        )}
      </form>
    </div>
  )
}

// ─── EditSuggestionRow ────────────────────────────────────────────────────────

interface EditSuggRowProps {
  suggestion: FieldSuggestion
  onAccept: () => void
  onClose: () => void
  onReply: (text: string) => void
}

function EditSuggestionRow({ suggestion, onAccept, onClose, onReply }: EditSuggRowProps) {
  const [replyText, setReplyText] = useState('')
  const [sending, setSending] = useState(false)
  const [showReply, setShowReply] = useState(false)

  const isOpen = suggestion.status === 'open'
  const isActioned = suggestion.status !== 'open'

  async function handleSend() {
    if (!replyText.trim()) return
    setSending(true)
    await onReply(replyText.trim())
    setSending(false)
    setReplyText('')
    setShowReply(false)
  }

  return (
    <div
      className={`rounded-lg border border-surface-2 p-3 space-y-2 transition-opacity ${isActioned ? 'opacity-50' : ''}`}
    >
      {/* Field label + type badge + status */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className="text-xs font-medium"
          style={{ color: 'var(--color-secondary)', fontFamily: 'var(--font-mono)' }}
        >
          {formatFieldRef(suggestion.fieldRef, suggestion.newFieldName)}
        </span>
        {suggestion.suggestionType && (
          <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-muted">
            {SUGGESTION_TYPE_LABELS[suggestion.suggestionType]}
          </span>
        )}
        {isActioned && (
          <span className="ml-auto text-[10px] px-1.5 py-0.5 rounded-full bg-surface text-muted capitalize">
            {suggestion.status}
          </span>
        )}
      </div>

      {/* Proposed text */}
      {suggestion.proposedText && (
        <div className="rounded px-2 py-1.5 bg-surface border border-surface-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-0.5">Proposed</p>
          <p className="text-xs text-ink leading-relaxed">{suggestion.proposedText}</p>
        </div>
      )}

      {/* Reviewer comment */}
      {suggestion.comment && (
        <p className="text-xs text-muted leading-relaxed italic">{suggestion.comment}</p>
      )}

      {/* Owner reply */}
      {suggestion.ownerReply && (
        <div className="rounded px-2 py-1.5" style={{ background: 'var(--color-accent)' }}>
          <p className="text-[10px] font-semibold uppercase tracking-widest mb-0.5" style={{ color: 'var(--color-dark)' }}>
            Your reply
          </p>
          <p className="text-xs leading-relaxed" style={{ color: 'var(--color-dark)' }}>
            {suggestion.ownerReply}
          </p>
        </div>
      )}

      {/* Actions */}
      {isOpen && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={onAccept}
            className="text-xs px-2 py-1 rounded font-medium text-white hover:opacity-90 transition-opacity"
            style={{ background: 'var(--color-primary)' }}
          >
            Accept
          </button>
          <button
            type="button"
            onClick={onClose}
            className="text-xs px-2 py-1 rounded font-medium border border-surface-2 text-muted hover:text-ink hover:border-secondary transition-colors"
          >
            Close
          </button>
          {suggestion.ownerReply === null && (
            <button
              type="button"
              onClick={() => setShowReply((v) => !v)}
              className="text-xs text-muted hover:text-ink transition-colors ml-auto"
            >
              {showReply ? 'Cancel' : 'Reply'}
            </button>
          )}
        </div>
      )}

      {/* Reply input */}
      {showReply && isOpen && suggestion.ownerReply === null && (
        <div className="space-y-1.5">
          <textarea
            rows={2}
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply to reviewer…"
            className="w-full input-sm text-xs resize-y"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={sending || !replyText.trim()}
            className="text-xs px-2 py-1 rounded font-medium text-white disabled:opacity-50 transition-opacity"
            style={{ background: 'var(--color-dark)' }}
          >
            {sending ? 'Sending…' : 'Send'}
          </button>
        </div>
      )}
    </div>
  )
}
