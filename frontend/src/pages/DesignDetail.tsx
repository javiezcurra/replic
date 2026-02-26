import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Design, ForkType } from '../types/design'

const FORK_TYPES: { value: ForkType; label: string; description: string }[] = [
  { value: 'replication', label: 'Replication', description: 'Reproduce the same study to verify results' },
  { value: 'iteration', label: 'Iteration', description: 'Build on the design with modifications' },
  { value: 'adaptation', label: 'Adaptation', description: 'Adapt to a different context or population' },
]

export default function DesignDetail() {
  const { id } = useParams<{ id: string }>()
  const { user } = useAuth()
  const navigate = useNavigate()
  const [design, setDesign] = useState<Design | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [showForkModal, setShowForkModal] = useState(false)
  const [forkType, setForkType] = useState<ForkType>('replication')
  const [forkRationale, setForkRationale] = useState('')
  const [forking, setForking] = useState(false)
  const [error, setError] = useState('')

  async function loadDesign() {
    try {
      const d = await api.get<Design>(`/api/designs/${id}`)
      setDesign(d)
    } catch (err: any) {
      if (err?.status === 404) setNotFound(true)
      else setError(err?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { loadDesign() }, [id])

  async function handlePublish() {
    setPublishing(true)
    try {
      await api.post(`/api/designs/${id}/publish`)
      await loadDesign()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  async function handleFork(e: React.FormEvent) {
    e.preventDefault()
    setForking(true)
    try {
      const forked = await api.post<Design>(`/api/designs/${id}/fork`, {
        fork_type: forkType,
        fork_rationale: forkRationale,
      })
      navigate(`/designs/${forked.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fork')
      setForking(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !design) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <p className="text-4xl mb-4">🔍</p>
        <h1 className="text-xl font-semibold text-gray-900">Design not found</h1>
        <p className="mt-2 text-sm text-gray-500">It may be a private draft or may not exist.</p>
        <Link to="/experiments" className="mt-4 inline-block btn-secondary text-sm">Browse experiments</Link>
      </div>
    )
  }

  const isAuthor = user ? design.author_ids.includes(user.uid) : false
  const canPublish = isAuthor && design.status === 'draft'
  const canEdit = isAuthor && design.status !== 'locked'
  const canFork = !!user && !isAuthor && design.status === 'published'

  return (
    <div className="max-w-3xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              {design.discipline_tags.map((tag) => (
                <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{tag}</span>
              ))}
              <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">{design.difficulty_level}</span>
              {design.status !== 'published' && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${design.status === 'draft' ? 'bg-yellow-50 text-yellow-700' : 'bg-gray-100 text-gray-600'}`}>
                  {design.status.charAt(0).toUpperCase() + design.status.slice(1)}
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{design.title}</h1>
          </div>

          <div className="flex gap-2 shrink-0">
            {canEdit && (
              <Link to={`/designs/${id}/edit`} className="btn-secondary text-sm">Edit</Link>
            )}
            {canPublish && (
              <button onClick={handlePublish} disabled={publishing} className="btn-primary text-sm disabled:opacity-50">
                {publishing ? 'Publishing…' : 'Publish'}
              </button>
            )}
            {canFork && (
              <button onClick={() => setShowForkModal(true)} className="btn-primary text-sm">
                Fork
              </button>
            )}
          </div>
        </div>

        <div className="mt-3 flex gap-4 text-xs text-gray-400">
          <span>{design.execution_count} execution{design.execution_count !== 1 ? 's' : ''}</span>
          <span>{design.derived_design_count} fork{design.derived_design_count !== 1 ? 's' : ''}</span>
          <span>v{design.version}</span>
          {design.fork_metadata && (
            <span>
              Forked from{' '}
              <Link to={`/designs/${design.fork_metadata.parent_design_id}`} className="text-brand-600 hover:underline">
                parent
              </Link>
              {' '}({design.fork_metadata.fork_type})
            </span>
          )}
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Summary */}
      {design.summary && (
        <section className="card p-5 mb-4">
          <p className="text-gray-700 leading-relaxed">{design.summary}</p>
        </section>
      )}

      {/* Steps */}
      {design.steps.length > 0 && (
        <section className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Procedure</h2>
          <ol className="space-y-3">
            {design.steps.map((step) => (
              <li key={step.step_number} className="flex gap-3">
                <span className="shrink-0 w-6 h-6 rounded-full bg-brand-50 text-brand-700 text-xs font-bold flex items-center justify-center mt-0.5">
                  {step.step_number}
                </span>
                <p className="text-gray-800 text-sm">{step.instruction}</p>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Outcomes / Research questions */}
      {design.research_questions.length > 0 && (
        <section className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Outcomes / Research Questions</h2>
          <ol className="list-decimal list-inside space-y-2">
            {design.research_questions.map((q) => (
              <li key={q.id} className="text-gray-800">
                {q.question}
                <span className="ml-2 text-xs text-gray-400">({q.expected_data_type})</span>
              </li>
            ))}
          </ol>
        </section>
      )}

      {/* Safety considerations */}
      {design.safety_considerations && (
        <section className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Safety Considerations</h2>
          <p className="text-sm text-gray-800 whitespace-pre-line">{design.safety_considerations}</p>
        </section>
      )}

      {/* Hypothesis */}
      {design.hypothesis && (
        <section className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Hypothesis</h2>
          <p className="text-gray-800">{design.hypothesis}</p>
        </section>
      )}

      {/* Variables */}
      {(
        (design.independent_variables?.length ?? 0) > 0 ||
        (design.dependent_variables?.length ?? 0) > 0 ||
        (design.controlled_variables?.length ?? 0) > 0
      ) && (
        <section className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Variables</h2>
          {[
            { label: 'Independent', vars: design.independent_variables ?? [] },
            { label: 'Dependent', vars: design.dependent_variables ?? [] },
            { label: 'Controlled', vars: design.controlled_variables ?? [] },
          ].map(({ label, vars }) => vars.length > 0 && (
            <div key={label} className="mb-3">
              <p className="text-xs font-medium text-gray-500 mb-1">{label}</p>
              <ul className="space-y-1">
                {vars.map((v, i) => (
                  <li key={i} className="text-sm text-gray-800">
                    <span className="font-medium">{v.name}</span>
                    <span className="text-gray-400"> — {v.type}, {v.values_or_range}</span>
                    {v.units && <span className="text-gray-400"> ({v.units})</span>}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </section>
      )}

      {/* Optional advanced details */}
      {(design.sample_size || design.analysis_plan || design.ethical_considerations ||
        design.disclaimers || design.seeking_collaborators ||
        (design.reference_experiment_ids?.length ?? 0) > 0) && (
        <section className="card p-5 mb-4 space-y-3">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Additional Details</h2>
          {design.sample_size && (
            <p className="text-sm text-gray-800"><span className="font-medium">Sample size:</span> {design.sample_size}</p>
          )}
          {design.analysis_plan && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Analysis plan</p>
              <p className="text-sm text-gray-800 whitespace-pre-line">{design.analysis_plan}</p>
            </div>
          )}
          {design.ethical_considerations && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Ethical considerations</p>
              <p className="text-sm text-gray-800 whitespace-pre-line">{design.ethical_considerations}</p>
            </div>
          )}
          {design.disclaimers && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Disclaimers</p>
              <p className="text-sm text-gray-800 whitespace-pre-line">{design.disclaimers}</p>
            </div>
          )}
          {design.seeking_collaborators && (
            <div>
              <span className="inline-block text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">Seeking collaborators</span>
              {design.collaboration_notes && (
                <p className="mt-1 text-sm text-gray-800">{design.collaboration_notes}</p>
              )}
            </div>
          )}
          {(design.reference_experiment_ids?.length ?? 0) > 0 && (
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1">Reference Experiments</p>
              <ul className="list-disc list-inside space-y-1">
                {design.reference_experiment_ids.map((id) => (
                  <li key={id} className="text-sm">
                    <Link to={`/designs/${id}`} className="text-brand-600 hover:underline">{id}</Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </section>
      )}

      {/* Fork modal */}
      {showForkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-bold text-gray-900 mb-4">Fork this design</h2>
            <form onSubmit={handleFork} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Fork type</label>
                {FORK_TYPES.map(({ value, label, description }) => (
                  <label key={value} className="flex gap-3 mb-2 cursor-pointer">
                    <input
                      type="radio"
                      name="fork_type"
                      value={value}
                      checked={forkType === value}
                      onChange={() => setForkType(value)}
                      className="mt-0.5"
                    />
                    <div>
                      <span className="text-sm font-medium text-gray-800">{label}</span>
                      <p className="text-xs text-gray-500">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rationale *</label>
                <textarea
                  required
                  rows={3}
                  value={forkRationale}
                  onChange={(e) => setForkRationale(e.target.value)}
                  placeholder="Why are you forking this design?"
                  className="w-full input-sm resize-y"
                />
              </div>
              {error && <p className="text-sm text-red-600">{error}</p>}
              <div className="flex gap-3 pt-1">
                <button type="submit" disabled={forking} className="btn-primary text-sm disabled:opacity-50">
                  {forking ? 'Forking…' : 'Create fork'}
                </button>
                <button type="button" onClick={() => setShowForkModal(false)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
