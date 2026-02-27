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
  // Changelog note — only shown / submitted when editing a design that has been published at least once
  const [changelog, setChangelog] = useState('')

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
        setChangelog(d.pending_changelog ?? '')
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false))
  }, [id])

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

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  const isLocked = design ? design.execution_count >= 1 : false
  const isVersioned = design ? design.published_version > 0 : false

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

            {/* Sticky changelog sidebar */}
            <div className="lg:sticky lg:top-6">
              <div className="card p-5 space-y-3">
                <h2
                  className="text-xs font-semibold uppercase tracking-widest"
                  style={{ color: 'var(--color-text-muted)' }}
                >
                  Change Log
                </h2>
                <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                  Summarise what changed in this version. This note will be attached when you
                  publish.
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
