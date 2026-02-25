import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Design } from '../types/design'
import DesignForm, { defaultFormValues, formValuesToBody, type DesignFormValues } from '../components/DesignForm'

export default function CreateDesign() {
  const navigate = useNavigate()
  const [values, setValues] = useState<DesignFormValues>(defaultFormValues())
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      const body = formValuesToBody(values)
      const created = await api.post<Design>('/api/designs', body)
      navigate(`/designs/${created.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create design')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">New Experiment Design</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <DesignForm values={values} onChange={setValues} />

        {error && <p className="text-sm text-red-600">{error}</p>}

        <div className="flex gap-3 pt-2">
          <button type="submit" disabled={submitting} className="btn-primary text-sm disabled:opacity-50">
            {submitting ? 'Saving…' : 'Save draft'}
          </button>
          <button type="button" onClick={() => navigate(-1)} className="btn-secondary text-sm">
            Cancel
          </button>
        </div>
      </form>
    </div>
  )
}
