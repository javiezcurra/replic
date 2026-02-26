import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Design, DesignMaterial } from '../types/design'
import type { Material } from '../types/material'
import DesignForm, { defaultFormValues, formValuesToBody, type DesignFormValues } from '../components/DesignForm'

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
  }
}

export default function EditDesign() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [values, setValues] = useState<DesignFormValues>(defaultFormValues())
  const [design, setDesign] = useState<Design | null>(null)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')

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

  useEffect(() => {
    api.get<{ status: string; data: Design }>(`/api/designs/${id}`)
      .then(({ data: d }) => {
        setDesign(d)
        setValues(designToFormValues(d))
        loadMaterialDetails(d.materials)
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError('')
    try {
      await api.patch(`/api/designs/${id}`, formValuesToBody(values))
      navigate(`/designs/${id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isLocked = design ? design.execution_count >= 1 : false

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Edit Design</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
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
      </form>
    </div>
  )
}
