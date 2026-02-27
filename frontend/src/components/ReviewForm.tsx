import { useState } from 'react'
import { randomUUID } from '../lib/uuid'
import { api } from '../lib/api'
import type { Design, Variable } from '../types/design'
import type { Material } from '../types/material'
import type {
  ReadinessSignal,
  SuggestionType,
  SuggestionEntry,
  Review,
} from '../types/review'

// ─── Field categories ─────────────────────────────────────────────────────────

const SIMPLE_TEXT_FIELDS = new Set([
  'title',
  'summary',
  'hypothesis',
  'safety_considerations',
  'analysis_plan',
  'ethical_considerations',
])

const LIST_FIELDS = new Set([
  'steps',
  'research_questions',
  'independent_variables',
  'dependent_variables',
  'controlled_variables',
])

const FIELD_OPTIONS: { value: string; label: string }[] = [
  { value: 'title',                  label: 'Title' },
  { value: 'summary',                label: 'Summary' },
  { value: 'hypothesis',             label: 'Hypothesis' },
  { value: 'steps',                  label: 'Procedure / Steps' },
  { value: 'materials',              label: 'Materials' },
  { value: 'research_questions',     label: 'Research Questions' },
  { value: 'independent_variables',  label: 'Independent Variables' },
  { value: 'dependent_variables',    label: 'Dependent Variables' },
  { value: 'controlled_variables',   label: 'Controlled Variables' },
  { value: 'safety_considerations',  label: 'Safety Considerations' },
  { value: 'analysis_plan',          label: 'Analysis Plan' },
  { value: 'ethical_considerations', label: 'Ethical Considerations' },
  { value: '__new__',                label: 'Other / new field…' },
]

const READINESS_OPTIONS: { value: ReadinessSignal; label: string }[] = [
  { value: 'ready',          label: 'Ready to execute' },
  { value: 'almost_ready',   label: 'Almost ready — minor issues' },
  { value: 'needs_revision', label: 'Needs revision before executing' },
]

const SUGGESTION_TYPE_OPTIONS: {
  value: SuggestionType
  label: string
  activeClass: string
}[] = [
  { value: 'suggestion',    label: 'Suggestion',    activeClass: 'bg-blue-100 text-blue-700 ring-1 ring-blue-300' },
  { value: 'issue',         label: 'Issue',         activeClass: 'bg-red-100 text-red-700 ring-1 ring-red-300' },
  { value: 'question',      label: 'Question',      activeClass: 'bg-violet-100 text-violet-700 ring-1 ring-violet-300' },
  { value: 'safety_concern',label: 'Safety concern',activeClass: 'bg-amber-100 text-amber-700 ring-1 ring-amber-300' },
]

// ─── Helpers: read current design value for a field ──────────────────────────

function getSimpleFieldValue(design: Design, field: string): string {
  switch (field) {
    case 'title':                  return design.title ?? ''
    case 'summary':                return design.summary ?? ''
    case 'hypothesis':             return design.hypothesis ?? ''
    case 'safety_considerations':  return design.safety_considerations ?? ''
    case 'analysis_plan':          return design.analysis_plan ?? ''
    case 'ethical_considerations': return design.ethical_considerations ?? ''
    default:                       return ''
  }
}

function getVariableList(design: Design, field: string): Variable[] {
  if (field === 'independent_variables') return design.independent_variables ?? []
  if (field === 'dependent_variables')   return design.dependent_variables ?? []
  if (field === 'controlled_variables')  return design.controlled_variables ?? []
  return []
}

function formatVariable(v: Variable): string {
  const lines = [
    `Name: ${v.name}`,
    `Type: ${v.type}`,
    `Values / Range: ${v.values_or_range}`,
  ]
  if (v.units) lines.push(`Units: ${v.units}`)
  return lines.join('\n')
}

// ─── Compute submission payload from a SuggestionEntry ───────────────────────

function computeFieldRef(entry: SuggestionEntry): string | null {
  if (entry.useNewField) return null
  const { selectedField, selectedIndex, isAddingNewItem } = entry
  if (!selectedField) return null

  // Materials: always top-level; sub-selection handled via checkboxes
  if (selectedField === 'materials') return 'materials'

  if (LIST_FIELDS.has(selectedField)) {
    if (isAddingNewItem) return `${selectedField}[new]`
    if (selectedIndex !== null) return `${selectedField}[${selectedIndex + 1}]` // 1-indexed
    return selectedField
  }

  return selectedField
}

function computeNewFieldName(entry: SuggestionEntry): string | null {
  return entry.useNewField ? entry.newFieldName.trim() || null : null
}

function computeProposedText(
  entry: SuggestionEntry,
  materialMap: Record<string, Material>,
): string | null {
  if (entry.selectedField === 'materials') {
    const removeNames = entry.removeMaterialIds
      .map((id) => materialMap[id]?.name ?? id)
    const parts: string[] = []
    if (removeNames.length > 0) parts.push(`Remove: ${removeNames.join(', ')}`)
    if (entry.addMaterialText.trim()) parts.push(`Add: ${entry.addMaterialText.trim()}`)
    return parts.length > 0 ? parts.join('\n') : null
  }
  return entry.proposedText.trim() || null
}

// ─── Default entry factory ────────────────────────────────────────────────────

function newEntry(): SuggestionEntry {
  return {
    localId:         randomUUID(),
    selectedField:   '',
    useNewField:     false,
    newFieldName:    '',
    selectedIndex:   null,
    isAddingNewItem: false,
    proposedText:    '',
    comment:         '',
    suggestionType:  null,
    removeMaterialIds: [],
    addMaterialText: '',
  }
}

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  designId: string
  design: Design
  materialMap: Record<string, Material>
  existingReview?: Review
  onSubmitted: (review: Review) => void
  onCancel: () => void
}

// ─── ReviewForm ───────────────────────────────────────────────────────────────

export default function ReviewForm({
  designId,
  design,
  materialMap,
  existingReview,
  onSubmitted,
  onCancel,
}: Props) {
  const [generalComment, setGeneralComment] = useState(existingReview?.generalComment ?? '')
  const [endorsement, setEndorsement] = useState(existingReview?.endorsement ?? false)
  const [readinessSignal, setReadinessSignal] = useState<ReadinessSignal | null>(
    existingReview?.readinessSignal ?? null,
  )
  const [suggestions, setSuggestions] = useState<SuggestionEntry[]>([])
  const [collapsedIds, setCollapsedIds] = useState<Set<string>>(new Set())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  function addSuggestion() {
    // Collapse all existing blocks then add a new expanded one
    setCollapsedIds(new Set(suggestions.map((s) => s.localId)))
    setSuggestions((prev) => [...prev, newEntry()])
  }

  function removeSuggestion(localId: string) {
    setSuggestions((prev) => prev.filter((s) => s.localId !== localId))
    setCollapsedIds((prev) => { const next = new Set(prev); next.delete(localId); return next })
  }

  function toggleCollapse(localId: string) {
    setCollapsedIds((prev) => {
      const next = new Set(prev)
      next.has(localId) ? next.delete(localId) : next.add(localId)
      return next
    })
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
      const fieldRef = computeFieldRef(s)
      const newFieldName = computeNewFieldName(s)

      if (!fieldRef && !newFieldName) {
        return `Suggestion ${i + 1}: select a field or enter a field name.`
      }

      const needsSubSelection =
        LIST_FIELDS.has(s.selectedField) && s.selectedIndex === null && !s.isAddingNewItem
      if (needsSubSelection) {
        return `Suggestion ${i + 1}: select a specific item or choose to add a new one.`
      }

      const proposedText = computeProposedText(s, materialMap)
      const comment = s.comment.trim() || null
      if (!proposedText && !comment) {
        return `Suggestion ${i + 1}: add proposed text or a comment.`
      }
    }
    return null
  }

  // ─── Submit ─────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')
    const msg = validate()
    if (msg) { setError(msg); return }

    setSubmitting(true)
    try {
      const body = {
        generalComment: generalComment.trim() || null,
        endorsement,
        readinessSignal,
        suggestions: suggestions.map((s) => ({
          fieldRef:      computeFieldRef(s),
          newFieldName:  computeNewFieldName(s),
          proposedText:  computeProposedText(s, materialMap),
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
      setError(err instanceof Error ? err.message : 'Failed to submit. Please try again.')
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
            Requires a general comment.
          </p>
        </div>
      </label>

      {/* Field suggestions */}
      <div>
        <p className="text-sm font-medium text-ink mb-3">
          Field suggestions{' '}
          <span className="text-muted font-normal">(optional)</span>
        </p>

        {existingReview && (existingReview.suggestions?.length ?? 0) > 0 && suggestions.length === 0 && (
          <p className="text-xs text-muted bg-surface border border-surface-2 rounded-lg px-3 py-2 mb-3">
            Your previous {existingReview.suggestions.length} suggestion{existingReview.suggestions.length !== 1 ? 's' : ''} will be replaced when you update.
          </p>
        )}

        {suggestions.length > 0 && (
          <div className="space-y-3 mb-3">
            {suggestions.map((s, i) => (
              <SuggestionBlock
                key={s.localId}
                index={i}
                entry={s}
                design={design}
                materialMap={materialMap}
                collapsed={collapsedIds.has(s.localId)}
                onToggleCollapse={() => toggleCollapse(s.localId)}
                onUpdate={(patch) => updateSuggestion(s.localId, patch)}
                onToggleType={(type) => toggleSuggestionType(s.localId, type)}
                onRemove={() => removeSuggestion(s.localId)}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addSuggestion}
          className="text-xs text-primary hover:underline font-medium"
        >
          + Add suggestion
        </button>
      </div>

      {error && (
        <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
          {error}
        </p>
      )}

      <div className="flex gap-3 pt-1">
        <button
          type="submit"
          disabled={submitting}
          className="btn-primary text-sm disabled:opacity-50"
        >
          {submitting
            ? (existingReview ? 'Updating…' : 'Submitting…')
            : (existingReview ? 'Update review' : 'Submit review')}
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
  design: Design
  materialMap: Record<string, Material>
  collapsed: boolean
  onToggleCollapse: () => void
  onUpdate: (patch: Partial<SuggestionEntry>) => void
  onToggleType: (type: SuggestionType) => void
  onRemove: () => void
}

function getFieldLabel(entry: SuggestionEntry): string {
  if (entry.useNewField) return entry.newFieldName.trim() || 'Custom field'
  if (!entry.selectedField) return ''
  return FIELD_OPTIONS.find((o) => o.value === entry.selectedField)?.label ?? entry.selectedField
}

function SuggestionBlock({
  index,
  entry,
  design,
  materialMap,
  collapsed,
  onToggleCollapse,
  onUpdate,
  onToggleType,
  onRemove,
}: SuggestionBlockProps) {

  function handleFieldChange(value: string) {
    if (value === '__new__') {
      onUpdate({
        selectedField: '',
        useNewField: true,
        proposedText: '',
        selectedIndex: null,
        isAddingNewItem: false,
        removeMaterialIds: [],
        addMaterialText: '',
      })
      return
    }
    const isSimple = SIMPLE_TEXT_FIELDS.has(value)
    onUpdate({
      selectedField: value,
      useNewField: false,
      proposedText: isSimple ? getSimpleFieldValue(design, value) : '',
      selectedIndex: null,
      isAddingNewItem: false,
      removeMaterialIds: [],
      addMaterialText: '',
    })
  }

  function handleSubIndexSelect(index: number | null, isNew: boolean) {
    if (isNew) {
      onUpdate({ selectedIndex: null, isAddingNewItem: true, proposedText: '' })
      return
    }
    if (index === null) {
      onUpdate({ selectedIndex: null, isAddingNewItem: false, proposedText: '' })
      return
    }

    const field = entry.selectedField
    let text = ''
    if (field === 'steps') {
      text = design.steps[index]?.instruction ?? ''
    } else if (field === 'research_questions') {
      text = design.research_questions[index]?.question ?? ''
    } else if (LIST_FIELDS.has(field)) {
      const vars = getVariableList(design, field)
      text = formatVariable(vars[index])
    }
    onUpdate({ selectedIndex: index, isAddingNewItem: false, proposedText: text })
  }

  const selectorValue = entry.useNewField
    ? '__new__'
    : entry.selectedField || ''

  const fieldLabel = getFieldLabel(entry)

  return (
    <div className="rounded-xl border border-surface-2 bg-white p-4 space-y-3">
      {/* Header — always visible */}
      <div className="flex items-center justify-between">
        <button
          type="button"
          onClick={onToggleCollapse}
          className="flex items-center gap-2 text-left flex-1 min-w-0"
        >
          <p className="text-xs font-semibold uppercase tracking-widest text-muted shrink-0">
            Suggestion {index + 1}
          </p>
          {collapsed && fieldLabel && (
            <p className="text-xs text-ink truncate">— {fieldLabel}</p>
          )}
          <span className="text-xs text-muted ml-auto shrink-0">
            {collapsed ? '▸' : '▾'}
          </span>
        </button>
        <button
          type="button"
          onClick={onRemove}
          className="text-xs text-muted hover:text-red-600 transition-colors ml-3 shrink-0"
        >
          Remove
        </button>
      </div>

      {!collapsed && (
        <>
          {/* Field selector */}
          <div>
            <label className="block text-xs font-medium text-ink mb-1">Field</label>
            <select
              value={selectorValue}
              onChange={(e) => handleFieldChange(e.target.value)}
              className="w-full input-sm"
            >
              <option value="">Select a field…</option>
              {FIELD_OPTIONS.map(({ value, label }) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>

            {/* Custom field name input */}
            {entry.useNewField && (
              <input
                type="text"
                value={entry.newFieldName}
                onChange={(e) => onUpdate({ newFieldName: e.target.value })}
                placeholder="Field name…"
                className="w-full input-sm mt-2"
              />
            )}
          </div>

          {/* Field-type-specific input */}
          {entry.selectedField === 'materials' && (
            <MaterialsInput
              design={design}
              materialMap={materialMap}
              removeMaterialIds={entry.removeMaterialIds}
              addMaterialText={entry.addMaterialText}
              onToggleRemove={(id) =>
                onUpdate({
                  removeMaterialIds: entry.removeMaterialIds.includes(id)
                    ? entry.removeMaterialIds.filter((x) => x !== id)
                    : [...entry.removeMaterialIds, id],
                })
              }
              onAddTextChange={(text) => onUpdate({ addMaterialText: text })}
            />
          )}

          {SIMPLE_TEXT_FIELDS.has(entry.selectedField) && (
            <SimpleTextInput
              currentValue={getSimpleFieldValue(design, entry.selectedField)}
              proposedText={entry.proposedText}
              onChange={(text) => onUpdate({ proposedText: text })}
            />
          )}

          {entry.selectedField === 'steps' && (
            <ListItemInput
              label="step"
              items={design.steps.map((s) => `Step ${s.step_number}: ${s.instruction}`)}
              currentTexts={design.steps.map((s) => s.instruction)}
              selectedIndex={entry.selectedIndex}
              isAddingNew={entry.isAddingNewItem}
              proposedText={entry.proposedText}
              onSelectIndex={handleSubIndexSelect}
              onProposedChange={(text) => onUpdate({ proposedText: text })}
              addNewLabel="Propose a new step"
              proposedPlaceholder="Write the new step instruction…"
              replacePlaceholder="Proposed replacement for this step…"
            />
          )}

          {entry.selectedField === 'research_questions' && (
            <ListItemInput
              label="question"
              items={design.research_questions.map((q, i) => `Q${i + 1}: ${q.question}`)}
              currentTexts={design.research_questions.map((q) => q.question)}
              selectedIndex={entry.selectedIndex}
              isAddingNew={entry.isAddingNewItem}
              proposedText={entry.proposedText}
              onSelectIndex={handleSubIndexSelect}
              onProposedChange={(text) => onUpdate({ proposedText: text })}
              addNewLabel="Propose a new research question"
              proposedPlaceholder="Write the new research question…"
              replacePlaceholder="Proposed replacement for this question…"
            />
          )}

          {(entry.selectedField === 'independent_variables' ||
            entry.selectedField === 'dependent_variables' ||
            entry.selectedField === 'controlled_variables') && (
            <VariablesInput
              design={design}
              field={entry.selectedField as 'independent_variables' | 'dependent_variables' | 'controlled_variables'}
              selectedIndex={entry.selectedIndex}
              isAddingNew={entry.isAddingNewItem}
              proposedText={entry.proposedText}
              onSelectIndex={handleSubIndexSelect}
              onProposedChange={(text) => onUpdate({ proposedText: text })}
            />
          )}

          {/* Suggestion type chips */}
          {(entry.selectedField || entry.useNewField) && (
            <div>
              <p className="text-xs font-medium text-ink mb-1.5">
                Type <span className="text-muted font-normal">(optional)</span>
              </p>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTION_TYPE_OPTIONS.map(({ value, label, activeClass }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => onToggleType(value)}
                    className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                      entry.suggestionType === value
                        ? activeClass
                        : 'bg-white text-muted border-surface-2 hover:border-secondary'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Comment — always shown once a field is selected */}
          {(entry.selectedField || entry.useNewField) && (
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
          )}
        </>
      )}
    </div>
  )
}

// ─── SimpleTextInput ──────────────────────────────────────────────────────────

function SimpleTextInput({
  currentValue,
  proposedText,
  onChange,
}: {
  currentValue: string
  proposedText: string
  onChange: (text: string) => void
}) {
  return (
    <div className="space-y-2">
      {currentValue && (
        <div className="rounded-lg bg-surface border border-surface-2 px-3 py-2">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">
            Current
          </p>
          <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">{currentValue}</p>
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-ink mb-1">
          Proposed replacement
        </label>
        <textarea
          rows={3}
          value={proposedText}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Propose updated text for this field…"
          className="w-full input-sm resize-y"
        />
      </div>
    </div>
  )
}

// ─── ListItemInput (steps & research questions) ───────────────────────────────

function ListItemInput({
  label,
  items,
  currentTexts,
  selectedIndex,
  isAddingNew,
  proposedText,
  onSelectIndex,
  onProposedChange,
  addNewLabel,
  proposedPlaceholder,
  replacePlaceholder,
}: {
  label: string
  items: string[]
  currentTexts: string[]
  selectedIndex: number | null
  isAddingNew: boolean
  proposedText: string
  onSelectIndex: (index: number | null, isNew: boolean) => void
  onProposedChange: (text: string) => void
  addNewLabel: string
  proposedPlaceholder: string
  replacePlaceholder: string
}) {
  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink">
        Which {label}?
      </p>
      <div className="space-y-1 max-h-48 overflow-y-auto pr-1">
        {items.map((text, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectIndex(i, false)}
            className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors ${
              selectedIndex === i && !isAddingNew
                ? 'border-primary bg-primary/5 text-ink'
                : 'border-surface-2 text-muted hover:border-secondary hover:text-ink'
            }`}
          >
            {text.length > 100 ? text.slice(0, 100) + '…' : text}
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelectIndex(null, true)}
          className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors ${
            isAddingNew
              ? 'border-primary bg-primary/5 text-ink'
              : 'border-dashed border-surface-2 text-muted hover:border-secondary hover:text-ink'
          }`}
        >
          + {addNewLabel}
        </button>
      </div>

      {/* Show full current text + proposed input when an item is selected */}
      {selectedIndex !== null && !isAddingNew && (
        <div className="space-y-2">
          <div className="rounded-lg bg-surface border border-surface-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">
              Current
            </p>
            <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap">
              {currentTexts[selectedIndex]}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">
              Proposed replacement
            </label>
            <textarea
              rows={3}
              value={proposedText}
              onChange={(e) => onProposedChange(e.target.value)}
              placeholder={replacePlaceholder}
              className="w-full input-sm resize-y"
            />
          </div>
        </div>
      )}

      {isAddingNew && (
        <div>
          <label className="block text-xs font-medium text-ink mb-1">
            Proposed text
          </label>
          <textarea
            rows={3}
            value={proposedText}
            onChange={(e) => onProposedChange(e.target.value)}
            placeholder={proposedPlaceholder}
            className="w-full input-sm resize-y"
          />
        </div>
      )}
    </div>
  )
}

// ─── VariablesInput ───────────────────────────────────────────────────────────

const VARIABLE_FIELD_LABELS: Record<string, string> = {
  independent_variables: 'independent variable',
  dependent_variables:   'dependent variable',
  controlled_variables:  'controlled variable',
}

function VariablesInput({
  design,
  field,
  selectedIndex,
  isAddingNew,
  proposedText,
  onSelectIndex,
  onProposedChange,
}: {
  design: Design
  field: 'independent_variables' | 'dependent_variables' | 'controlled_variables'
  selectedIndex: number | null
  isAddingNew: boolean
  proposedText: string
  onSelectIndex: (index: number | null, isNew: boolean) => void
  onProposedChange: (text: string) => void
}) {
  const vars = getVariableList(design, field)
  const label = VARIABLE_FIELD_LABELS[field] ?? 'variable'

  return (
    <div className="space-y-2">
      <p className="text-xs font-medium text-ink">Which {label}?</p>
      <div className="space-y-1">
        {vars.map((v, i) => (
          <button
            key={i}
            type="button"
            onClick={() => onSelectIndex(i, false)}
            className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors ${
              selectedIndex === i && !isAddingNew
                ? 'border-primary bg-primary/5 text-ink'
                : 'border-surface-2 text-muted hover:border-secondary hover:text-ink'
            }`}
          >
            <span className="font-medium">{v.name}</span>
            <span className="ml-2 text-muted">
              {v.type} · {v.values_or_range}
              {v.units ? ` (${v.units})` : ''}
            </span>
          </button>
        ))}
        <button
          type="button"
          onClick={() => onSelectIndex(null, true)}
          className={`w-full text-left rounded-lg border px-3 py-2 text-xs transition-colors ${
            isAddingNew
              ? 'border-primary bg-primary/5 text-ink'
              : 'border-dashed border-surface-2 text-muted hover:border-secondary hover:text-ink'
          }`}
        >
          + Propose a new {label}
        </button>
      </div>

      {selectedIndex !== null && !isAddingNew && (
        <div className="space-y-2">
          <div className="rounded-lg bg-surface border border-surface-2 px-3 py-2">
            <p className="text-[10px] font-semibold uppercase tracking-widest text-muted mb-1">
              Current
            </p>
            <p className="text-xs text-ink leading-relaxed whitespace-pre-wrap font-mono">
              {formatVariable(vars[selectedIndex])}
            </p>
          </div>
          <div>
            <label className="block text-xs font-medium text-ink mb-1">
              Proposed changes
            </label>
            <textarea
              rows={4}
              value={proposedText}
              onChange={(e) => onProposedChange(e.target.value)}
              placeholder={`Name: …\nType: …\nValues / Range: …\nUnits: …`}
              className="w-full input-sm resize-y"
              style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
            />
          </div>
        </div>
      )}

      {isAddingNew && (
        <div>
          <label className="block text-xs font-medium text-ink mb-1">
            Proposed {label}
          </label>
          <textarea
            rows={4}
            value={proposedText}
            onChange={(e) => onProposedChange(e.target.value)}
            placeholder={`Name: …\nType: continuous / discrete / categorical\nValues / Range: …\nUnits: …`}
            className="w-full input-sm resize-y"
            style={{ fontFamily: 'var(--font-mono)', fontSize: '11px' }}
          />
        </div>
      )}
    </div>
  )
}

// ─── MaterialsInput ───────────────────────────────────────────────────────────

function MaterialsInput({
  design,
  materialMap,
  removeMaterialIds,
  addMaterialText,
  onToggleRemove,
  onAddTextChange,
}: {
  design: Design
  materialMap: Record<string, Material>
  removeMaterialIds: string[]
  addMaterialText: string
  onToggleRemove: (id: string) => void
  onAddTextChange: (text: string) => void
}) {
  return (
    <div className="space-y-3">
      {/* Current materials with remove checkboxes */}
      {design.materials.length > 0 && (
        <div>
          <p className="text-xs font-medium text-ink mb-1.5">
            Suggest removing
          </p>
          <div className="space-y-1.5 max-h-40 overflow-y-auto pr-1">
            {design.materials.map((m) => {
              const mat = materialMap[m.material_id]
              const name = mat?.name ?? m.material_id
              const checked = removeMaterialIds.includes(m.material_id)
              return (
                <label
                  key={m.material_id}
                  className={`flex items-center gap-2.5 rounded-lg border px-3 py-2 cursor-pointer transition-colors ${
                    checked
                      ? 'border-red-300 bg-red-50'
                      : 'border-surface-2 hover:border-secondary'
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleRemove(m.material_id)}
                    className="accent-red-500 w-3.5 h-3.5 shrink-0"
                  />
                  <span className="text-xs text-ink">{name}</span>
                  <span className="text-xs text-muted ml-auto">{m.quantity}</span>
                </label>
              )
            })}
          </div>
        </div>
      )}

      {/* Suggest adding */}
      <div>
        <label className="block text-xs font-medium text-ink mb-1">
          Suggest adding
        </label>
        <textarea
          rows={2}
          value={addMaterialText}
          onChange={(e) => onAddTextChange(e.target.value)}
          placeholder="Describe materials that should be added to this design…"
          className="w-full input-sm resize-y"
        />
      </div>
    </div>
  )
}
