import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Material } from '../types/material'
import MaterialForm, { defaultMaterialFormValues, formValuesToBody, type MaterialFormValues } from '../components/MaterialForm'

export default function CreateMaterial() {
  const navigate = useNavigate()
  const [values, setValues] = useState<MaterialFormValues>(defaultMaterialFormValues())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const res = await api.post<{ status: string; data: Material }>('/api/materials', formValuesToBody(values))
      navigate(`/materials/${res.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to submit material')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Submit a Material</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <MaterialForm values={values} onChange={setValues} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
            {submitting ? 'Submitting…' : 'Submit material'}
          </button>
          <button type="button" onClick={() => navigate('/materials')} className="btn-secondary text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
