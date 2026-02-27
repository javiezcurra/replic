import { useState } from 'react'
import { randomUUID } from '../lib/uuid'
import { api } from '../lib/api'
import type {
  ReadinessSignal,
  SuggestionType,
  SuggestionEntry,
  Review,
} from '../types/review'

// ─── Constants ────────────────────────────────────────────────────────────────

const DESIGN_FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'title',                 label: 'Title' },
  { value: 'summary',               label: 'Summary' },
  { value: 'hypothesis',            label: 'Hypothesis' },
  { value: 'steps',                 label: 'Procedure / Steps' },
  { value: 'materials',             label: 'Materials' },
  { value: 'research_questions',    label: 'Research Questions' },
  { value: 'independent_variables', label: 'Independent Variables' },
  { value: 'dependent_variables',   label: 'Dependent Variables' },
  { value: 'controlled_variables',  label: 'Controlled Variables' },
  { value: 'safety_considerations', label: 'Safety Considerations' },
  { value: 'analysis_plan',         label: 'Analysis Plan' },
  { value: 'ethical_considerations',label: 'Ethical Considerations' },
  { value: '__new__',               label: 'New field (propose an addition)' },
]

const READINESS_OPTIONS: { value: ReadinessSignal; label: string }[] = [
  { value: 'ready',          label: 'Ready to execute' },
  { value: 'almost_ready',   label: 'Almost ready — minor issues' },
  { value: 'needs_revision', label: 'Needs revision before executing' },
]

const SUGGESTION_TYPE_OPTIONS: { value: SuggestionType; label: string; selectedClass: string }[] = [
  { value: 'suggestion',    label: 'Suggestion',    selectedClass: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' },
  { value: 'issue',         label: 'Issue',         selectedClass: 'bg-red-100 text-red-700 ring-1 ring-red-300' },
  { value: 'question',      label: 'Question',      selectedClass: 'bg-violet-100 text-violet-700 ring-1 ring-violet-300' },
  { value: 'safety_concern',label: 'Safety concern',selectedClass: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' },
]

function newSuggestionEntry(): SuggestionEntry {
  return {
    localId:      randomUUID(),
    fieldRef:     '',
    useNewField:  false,
    newFieldName: '',
    proposedText: '',
    comment:      '',
    suggestionType: null,
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  designId: string
  onSubmitted: (review: Review) => void
  onCancel: () => void
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReviewForm({ designId, onSubmitted, onCancel }: Props) {
  const [generalComment, setGeneralComment] = useState('')
  const [endorsement, setEndorsement] = useState(false)
  const [readinessSignal, setReadinessSignal] = useState<ReadinessSignal | null>(null)
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // ─── Suggestion helpers ──────────────────────────────────────────────────

  function addSuggestion() {
    setSuggestions((prev) => [...prev, newSuggestionEntry()])
  }

  function removeSuggestion(localId: string) {
    setSuggestions((prev) => prev.filter((s) => s.localId !== localId))
  }

  function updateSuggestion(localId: string, patch: Partial<SuggestionEntry>) {
    setSuggestions((prev) =>
      prev.map((s) => (s.localId === localId ? { ...s, ...patch } : s)),
    )
  }

  function toggleSuggestionType(localId: string, type: SuggestionType) {
    setSuggestions((prev) =>
      prev.map((s) =>
        s.localId === localId
          ? { ...s, suggestionType: s.suggestionType === type ? null : type }
          : s,
      ),
    )
  }

  // ─── Validation ─────────────────────────────────────────────────────────

  function validate(): string | null {
    const trimmedComment = generalComment.trim()

    if (!trimmedComment && !endorsement && suggestions.length === 0) {
      return 'Add a general comment, field suggestions, or an endorsement.'
    }
    if (endorsement && !trimmedComment) {
      return 'A comment is required when endorsing a design.'
    }
    for (let i = 0; i < suggestions.length; i++) {
      const s = suggestions[i]
      const fieldRef = s.useNewField ? null : s.fieldRef.trim()
      const newFieldName = s.useNewField ? s.newFieldName.trim() : null
      if (!fieldRef && !newFieldName) {
        return `Suggestion ${i + 1}: select a field or enter a new field name.`
      }
      if (!s.proposedText.trim() && !s.comment.trim()) {
        return `Suggestion ${i + 1}: add proposed text or a comment.`
      }
    }
    return null
  }

  // ─── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    const validationError = validate()
    if (validationError) {
      setError(validationError)
      return
    }

    setSubmitting(true)
    try {
      const body = {
        generalComment: generalComment.trim() || null,
        endorsement,
        readinessSignal,
        suggestions: suggestions.map((s) => ({
          fieldRef:      s.useNewField ? null : s.fieldRef || null,
          newFieldName:  s.useNewField ? s.newFieldName.trim() || null : null,
          proposedText:  s.proposedText.trim() || null,
          comment:       s.comment.trim() || null,
          suggestionType: s.suggestionType,
        })),
      }

      const res = await api.post<{ status: string; data: Review }>(
        `/api/designs/${designId}/reviews`,
        body,
      )
      onSubmitted(res.data)
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : 'Failed to submit review. Please try again.'
      setError(message)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Render ─────────────────────────────────────────────────────────────

  return (
    <form onSubmit={handleSubmit} className="space-y-5">

      {/* General comment */}
      <div>
        <label className="block text-sm font-medium text-ink mb-1">
          General comment
        </label>
        <textarea
          rows={4}
          value={generalComment}
          onChange={(e) => setGeneralComment(e.target.value)}
          placeholder="Share your overall assessment of this design's methodology, clarity, and scientific rigor…"
          className="w-full input-sm resize-y"
        />
      </div>

      {/* Readiness signal */}
      <div>
        <p className="text-sm font-medium text-ink mb-2">
          Readiness signal <span className="text-muted font-normal">(optional)</span>
        </p>
        <div className="flex flex-wrap gap-2">
          {READINESS_OPTIONS.map(({ value, label }) => (
            <button
              key={value}
              type="button"
              onClick={() => setReadinessSignal(readinessSignal === value ? null : value)}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                readinessSignal === value
                  ? 'bg-dark text-surface border-dark'
                  : 'bg-white text-muted border-surface-2 hover:border-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Endorsement */}
      <label className="flex items-start gap-3 cursor-pointer">
        <input
          type="checkbox"
          checked={endorsement}
          onChange={(e) => setEndorsement(e.target.checked)}
          className="mt-0.5 accent-primary w-4 h-4 shrink-0"
        />
        <div>
          <span className="text-sm font-medium text-ink">Endorse this design</span>
          <p className="text-xs text-muted mt-0.5">
            I consider this design methodologically sound and ready to execute.
            Requires a general comment explaining your endorsement.
          </p>
        </div>
      </label>

      {/* Field suggestions */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-medium text-ink">
            Field suggestions <span className="text-muted font-normal">(optional)</span>
          </p>
          <button
            type="button"
            onClick={addSuggestion}
            className="text-xs text-primary hover:underline font-medium"
          >
            + Add suggestion
          </button>
        </div>

        {suggestions.length > 0 && (
          <div className="space-y-4">
            {suggestions.map((s, i) => (
              <SuggestionBlock
                key={s.localId}
                index={i}
                entry={s}
                onUpdate={(patch) => updateSuggestion(s.localId, patch)}
                onToggleType={(type) => toggleSuggestionType(s.localId, type)}
                onRemove={() => removeSuggestion(s.localId)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      {/* Actions */}
      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {submitting ? 'Submitting…' : 'Submit review'}
        </button>
        <button
          type="button"
          onClick={onCancel}
          disabled={submitting}
          className="btn-secondary text-sm"
        >
          Cancel
        </button>
      </div>
    </form>
  )
}

// ─── SuggestionBlock ──────────────────────────────────────────────────────────

interface SuggestionBlockProps {
  index: number
  entry: SuggestionEntry
  onUpdate: (patch: Partial<SuggestionEntry>) => void
  onToggleType: (type: SuggestionType) => void
  onRemove: () => void
}

function SuggestionBlock({ index, entry, onUpdate, onToggleType, onRemove }: SuggestionBlockProps) {
  return (
    <div className="rounded-xl border border-surface-2 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-widest text-muted">
          Suggestion {index + 1}
        </p>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted hover:text-red-600 transition-colors"
        >
          Remove
        </button>
      </div>

      {/* Field reference */}
      <div>
        <label className="block text-xs font-medium text-ink mb-1">Field</label>
        <select
          value={entry.useNewField ? '__new__' : entry.fieldRef}
          onChange={(e) => {
            const val = e.target.value
            if (val === '__new__') {
              onUpdate({ useNewField: true, fieldRef: '' })
            } else {
              onUpdate({ useNewField: false, fieldRef: val })
            }
          }}
          className="w-full input-sm"
        >
          <option value="">Select a field…</option>
          {DESIGN_FIELD_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        {entry.useNewField && (
          <input
            type="text"
            value={entry.newFieldName}
            onChange={(e) => onUpdate({ newFieldName: e.target.value })}
            placeholder="New field name…"
            className="w-full input-sm mt-2"
          />
        )}
      </div>

      {/* Type chips */}
      <div>
        <p className="text-xs font-medium text-ink mb-1.5">
          Type <span className="text-muted font-normal">(optional)</span>
        </p>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTION_TYPE_OPTIONS.map(({ value, label, selectedClass }) => (
            <button
              key={value}
              type="button"
              onClick={() => onToggleType(value)}
              className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                entry.suggestionType === value
                  ? selectedClass
                  : 'bg-white text-muted border-surface-2 hover:border-secondary'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Proposed text */}
      <div>
        <label className="block text-xs font-medium text-ink mb-1">
          Proposed text <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={entry.proposedText}
          onChange={(e) => onUpdate({ proposedText: e.target.value })}
          placeholder="Suggest replacement text for this field…"
          className="w-full input-sm resize-y"
        />
      </div>

      {/* Comment */}
      <div>
        <label className="block text-xs font-medium text-ink mb-1">
          Comment <span className="text-muted font-normal">(optional)</span>
        </label>
        <textarea
          rows={2}
          value={entry.comment}
          onChange={(e) => onUpdate({ comment: e.target.value })}
          placeholder="Explain your suggestion or ask a question…"
          className="w-full input-sm resize-y"
        />
      </div>
    </div>
  )
}
