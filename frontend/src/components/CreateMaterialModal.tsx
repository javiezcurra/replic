/**
 * CreateMaterialModal — opens the "Submit material" form in a modal overlay
 * instead of navigating to /materials/new.
 */
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Material } from '../types/material'
import MaterialForm, { defaultMaterialFormValues, formValuesToBody, type MaterialFormValues } from './MaterialForm'

interface Props {
  onClose: () => void
  onCreated: (m: Material) => void
}

export default function CreateMaterialModal({ onClose, onCreated }: Props) {
  const [values, setValues] = useState<MaterialFormValues>(defaultMaterialFormValues())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  // Prevent body scroll while modal is open
  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post<{ status: string; data: Material }>('/api/materials', formValuesToBody(values))
      onCreated(res.data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit material')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto
                   shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2
            className="text-xl font-semibold text-ink"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            Submit material
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted
                       hover:bg-gray-100 hover:text-ink transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="px-6 py-5 space-y-6">
          <MaterialForm values={values} onChange={setValues} />

          {error && <p className="text-sm text-red-600">{error}</p>}

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                         text-sm font-semibold text-white hover:opacity-90 transition-all
                         disabled:opacity-50"
              style={{ background: 'var(--color-primary)' }}
            >
              {submitting ? 'Submitting…' : 'Submit material'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                         border-2 border-surface-2 text-ink text-sm font-semibold
                         hover:border-ink transition-all"
            >
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
