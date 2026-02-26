/**
 * MaterialDetailModal — shows full material details in an overlay modal.
 * When onSave is provided (admin context) an Edit button lets admins update
 * the material in-place without leaving the page.
 */
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Material } from '../types/material'
import MaterialForm, {
  materialToFormValues,
  formValuesToUpdateBody,
  type MaterialFormValues,
} from './MaterialForm'

interface Props {
  material: Material
  onClose: () => void
  /** Optional: show an add/remove lab button in the modal header */
  inLab?: boolean
  onAdd?: (m: Material) => void
  onRemove?: (m: Material) => void
  actionPending?: boolean
  /** When provided an Edit button is shown (admin-only usage). Called with the updated material. */
  onSave?: (updated: Material) => void
}

export default function MaterialDetailModal({
  material,
  onClose,
  inLab,
  onAdd,
  onRemove,
  actionPending,
  onSave,
}: Props) {
  const [editing, setEditing] = useState(false)
  const [editValues, setEditValues] = useState<MaterialFormValues>(() => materialToFormValues(material))
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // Close on Escape (but not while editing — Escape cancels edit instead)
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editing) {
          setEditing(false)
          setEditValues(materialToFormValues(material))
          setSaveError('')
        } else {
          onClose()
        }
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, editing, material])

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function handleStartEdit() {
    setEditValues(materialToFormValues(material))
    setSaveError('')
    setEditing(true)
  }

  function handleCancelEdit() {
    setEditing(false)
    setEditValues(materialToFormValues(material))
    setSaveError('')
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setSaving(true)
    setSaveError('')
    try {
      const res = await api.patch<{ status: string; data: Material }>(
        `/api/materials/${material.id}`,
        formValuesToUpdateBody(editValues),
      )
      onSave?.(res.data)
      setEditing(false)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save changes')
    } finally {
      setSaving(false)
    }
  }

  const showLabAction = !!(onAdd || onRemove)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={editing ? undefined : onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[88vh] overflow-y-auto
                   shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-0">
          <div className="flex-1 min-w-0">
            {!editing && (
              <>
                {/* Badges */}
                <div className="flex flex-wrap gap-1.5 mb-2">
                  <span
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{ background: 'var(--color-blush)', color: 'var(--color-plum)' }}
                  >
                    {material.type}
                  </span>
                  <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-gray-100 text-gray-600 capitalize">
                    {material.category}
                  </span>
                  {material.is_verified && (
                    <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700">
                      ✓ Verified
                    </span>
                  )}
                </div>
                <h2
                  className="text-xl font-semibold text-ink leading-tight"
                  style={{ fontFamily: 'var(--font-display)' }}
                >
                  {material.name}
                </h2>
              </>
            )}
            {editing && (
              <h2
                className="text-xl font-semibold text-ink leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Edit material
              </h2>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Lab action (read-only mode only) */}
            {!editing && showLabAction && (
              <button
                type="button"
                onClick={() => { inLab ? onRemove?.(material) : onAdd?.(material) }}
                disabled={actionPending}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                            border-2 transition-all disabled:opacity-50 ${
                  inLab
                    ? 'border-red-200 text-red-500 hover:bg-red-50'
                    : 'border-primary/30 text-primary hover:bg-primary/10'
                }`}
              >
                {actionPending ? (
                  <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
                ) : inLab ? (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
                    </svg>
                    Remove
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    Add to lab
                  </>
                )}
              </button>
            )}

            {/* Edit button (read-only mode, admin context) */}
            {!editing && onSave && (
              <button
                type="button"
                onClick={handleStartEdit}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium
                           border-2 border-gray-200 text-ink hover:border-ink transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                       m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </button>
            )}

            {/* Close */}
            <button
              type="button"
              onClick={editing ? handleCancelEdit : onClose}
              className="w-8 h-8 rounded-lg flex items-center justify-center text-muted
                         hover:bg-gray-100 hover:text-ink transition-colors"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Body — read-only view */}
        {!editing && (
          <div className="px-6 pb-6 pt-4 space-y-4">
            {/* Image */}
            {material.image_url && (
              <img
                src={material.image_url}
                alt={material.name}
                className="w-full max-h-52 object-contain rounded-xl border border-gray-200 bg-gray-50"
              />
            )}

            {/* Description */}
            {material.description && (
              <section>
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-1.5">
                  Description
                </h3>
                <p className="text-sm text-ink leading-relaxed">{material.description}</p>
              </section>
            )}

            {/* Details */}
            {(material.supplier || material.typical_cost_usd != null || material.link) && (
              <section>
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
                  Details
                </h3>
                <dl className="space-y-1.5 text-sm">
                  {material.supplier && (
                    <div className="flex gap-2">
                      <dt className="w-28 shrink-0 text-muted">Supplier</dt>
                      <dd className="text-ink">{material.supplier}</dd>
                    </div>
                  )}
                  {material.typical_cost_usd != null && (
                    <div className="flex gap-2">
                      <dt className="w-28 shrink-0 text-muted">Typical cost</dt>
                      <dd className="text-ink">${material.typical_cost_usd.toFixed(2)}</dd>
                    </div>
                  )}
                  {material.link && (
                    <div className="flex gap-2">
                      <dt className="w-28 shrink-0 text-muted">Product link</dt>
                      <dd>
                        <a
                          href={material.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-primary hover:underline break-all"
                        >
                          {material.link}
                        </a>
                      </dd>
                    </div>
                  )}
                </dl>
              </section>
            )}

            {/* Safety notes */}
            {material.safety_notes && (
              <section className="bg-amber-50 rounded-xl p-4">
                <h3 className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1.5">
                  ⚠ Safety Notes
                </h3>
                <p className="text-sm text-amber-900 whitespace-pre-line">{material.safety_notes}</p>
              </section>
            )}

            {/* Tags */}
            {material.tags.length > 0 && (
              <section>
                <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">Tags</h3>
                <div className="flex flex-wrap gap-1.5">
                  {material.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-xs px-2.5 py-1 rounded-lg font-medium"
                      style={{
                        fontFamily: 'var(--font-mono)',
                        background: 'var(--color-blush)',
                        color: 'var(--color-plum)',
                      }}
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </section>
            )}
          </div>
        )}

        {/* Body — edit form */}
        {editing && (
          <form onSubmit={handleSave} className="px-6 pb-6 pt-4 space-y-6">
            <MaterialForm values={editValues} onChange={setEditValues} />

            {saveError && <p className="text-sm text-red-600">{saveError}</p>}

            <div className="flex gap-3 pt-1">
              <button
                type="submit"
                disabled={saving}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                           text-sm font-semibold text-white hover:opacity-90 transition-all
                           disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {saving ? 'Saving…' : 'Save changes'}
              </button>
              <button
                type="button"
                onClick={handleCancelEdit}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                           border-2 border-surface-2 text-ink text-sm font-semibold
                           hover:border-ink transition-all"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  )
}
