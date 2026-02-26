import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Design, ForkType } from '../types/design'

const FORK_TYPES: { value: ForkType; label: string; description: string }[] = [
  { value: 'replication', label: 'Replication', description: 'Reproduce the same study to verify results' },
  { value: 'iteration',   label: 'Iteration',   description: 'Build on the design with modifications' },
  { value: 'adaptation',  label: 'Adaptation',  description: 'Adapt to a different context or population' },
]

const DIFFICULTY_COLORS: Record<string, string> = {
  'Pre-K':         'bg-emerald-50 text-emerald-700',
  'Elementary':    'bg-emerald-50 text-emerald-700',
  'Middle School': 'bg-sky-50 text-sky-700',
  'High School':   'bg-blue-50 text-blue-700',
  'Undergraduate': 'bg-violet-50 text-violet-700',
  'Graduate':      'bg-purple-50 text-purple-700',
  'Professional':  'bg-rose-50 text-rose-700',
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-xs font-semibold uppercase tracking-widest text-muted mb-4">
      {children}
    </h2>
  )
}

export default function DesignDetail() {
  const { id } = useParams<{ id: string }>()
  const { user, loading: authLoading } = useAuth()
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
      const res = await api.get<{ status: string; data: Design }>(`/api/designs/${id}`)
      setDesign(res.data)
    } catch (err: any) {
      if (err?.status === 404) setNotFound(true)
      else setError(err?.message ?? 'Failed to load')
    } finally {
      setLoading(false)
    }
  }

  // Wait for Firebase auth to restore session before requesting the design,
  // so that draft designs load correctly for their owners.
  useEffect(() => {
    if (authLoading) return
    loadDesign()
  }, [id, authLoading])

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
      const res = await api.post<{ status: string; data: Design }>(`/api/designs/${id}/fork`, {
        fork_type: forkType,
        fork_rationale: forkRationale,
      })
      navigate(`/designs/${res.data.id}`)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fork')
      setForking(false)
    }
  }

  if (authLoading || loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <p className="text-4xl mb-4">🔍</p>
        <h1 className="text-xl font-semibold text-ink">Design not found</h1>
        <p className="mt-2 text-sm text-muted">It may be a private draft or may not exist.</p>
        <Link to="/experiments" className="mt-4 inline-block btn-secondary text-sm">
          Browse experiments
        </Link>
      </div>
    )
  }

  if (error && !design) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <p className="text-4xl mb-4">⚠️</p>
        <h1 className="text-xl font-semibold text-ink">Could not load design</h1>
        <p className="mt-2 text-sm text-muted">{error}</p>
        <Link to="/experiments" className="mt-4 inline-block btn-secondary text-sm">
          Browse experiments
        </Link>
      </div>
    )
  }

  const isAuthor  = user ? design.author_ids.includes(user.uid) : false
  const canPublish = isAuthor && design.status === 'draft'
  const canEdit    = isAuthor && design.status !== 'locked'
  const canFork    = !!user && !isAuthor && design.status === 'published'

  const hasVariables =
    (design.independent_variables?.length ?? 0) > 0 ||
    (design.dependent_variables?.length    ?? 0) > 0 ||
    (design.controlled_variables?.length   ?? 0) > 0

  const hasSidebarDetails =
    !!design.hypothesis ||
    !!design.safety_considerations ||
    design.sample_size != null ||
    !!design.analysis_plan ||
    !!design.ethical_considerations ||
    !!design.disclaimers ||
    (design.reference_experiment_ids?.length ?? 0) > 0

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm text-muted">
        <Link to="/experiments" className="hover:text-ink transition-colors">Experiments</Link>
        <span>/</span>
        <span className="text-ink truncate max-w-xs">{design.title}</span>
      </nav>

      {/* ── Page header ── */}
      <header className="mb-8">
        {/* Tags row */}
        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          {design.discipline_tags.map((tag) => (
            <span key={tag} className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[design.difficulty_level] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {design.difficulty_level}
          </span>
          {design.status !== 'published' && (
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                design.status === 'draft'
                  ? 'bg-yellow-50 text-yellow-700'
                  : 'bg-gray-100 text-gray-500'
              }`}
            >
              {design.status.charAt(0).toUpperCase() + design.status.slice(1)}
            </span>
          )}
        </div>

        {/* Title */}
        <h1 className="text-3xl font-display font-bold text-dark leading-tight">
          {design.title}
        </h1>

        {/* Stats row */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span>{design.execution_count} run{design.execution_count !== 1 ? 's' : ''}</span>
          <span>{design.derived_design_count} fork{design.derived_design_count !== 1 ? 's' : ''}</span>
          <span>v{design.version}</span>
          {design.fork_metadata && (
            <span>
              Forked from{' '}
              <Link
                to={`/designs/${design.fork_metadata.parent_design_id}`}
                className="text-primary hover:underline"
              >
                parent
              </Link>
              {' '}({design.fork_metadata.fork_type})
            </span>
          )}
          <span>Updated {new Date(design.updated_at).toLocaleDateString()}</span>
        </div>
      </header>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {/* ── Two-column layout ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

        {/* ────────── Main content (left, 2/3) ────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Summary */}
          {design.summary && (
            <section className="card p-6">
              <SectionLabel>Summary</SectionLabel>
              <p className="text-gray-800 leading-relaxed">{design.summary}</p>
            </section>
          )}

          {/* Procedure */}
          {design.steps.length > 0 && (
            <section className="card p-6">
              <SectionLabel>Procedure</SectionLabel>
              <ol className="space-y-5">
                {design.steps.map((step) => (
                  <li key={step.step_number} className="flex gap-4">
                    <span className="shrink-0 w-7 h-7 rounded-full bg-primary text-white text-xs font-bold flex items-center justify-center mt-0.5">
                      {step.step_number}
                    </span>
                    <div className="flex-1 min-w-0 pt-0.5">
                      <p className="text-gray-800 text-sm leading-relaxed">{step.instruction}</p>
                      {(step.duration_minutes || step.safety_notes) && (
                        <div className="mt-2 flex flex-wrap gap-3 text-xs text-muted">
                          {step.duration_minutes && (
                            <span>{step.duration_minutes} min</span>
                          )}
                          {step.safety_notes && (
                            <span className="text-amber-600">⚠ {step.safety_notes}</span>
                          )}
                        </div>
                      )}
                    </div>
                  </li>
                ))}
              </ol>
            </section>
          )}

          {/* Research Questions */}
          {design.research_questions.length > 0 && (
            <section className="card p-6">
              <SectionLabel>Research Questions & Outcomes</SectionLabel>
              <ul className="space-y-4">
                {design.research_questions.map((q, i) => (
                  <li key={q.id} className="flex gap-3">
                    <span className="shrink-0 text-xs font-bold text-muted mt-0.5 w-4">{i + 1}.</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-gray-800 text-sm leading-relaxed">{q.question}</p>
                      <div className="mt-1.5 flex flex-wrap gap-2 text-xs text-muted">
                        <span className="bg-surface-2 px-2 py-0.5 rounded-full">
                          {q.expected_data_type}
                        </span>
                        {q.measurement_unit && <span>{q.measurement_unit}</span>}
                        {q.success_criteria && (
                          <span className="italic">Goal: {q.success_criteria}</span>
                        )}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          {/* Variables */}
          {hasVariables && (
            <section className="card p-6">
              <SectionLabel>Variables</SectionLabel>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                {[
                  { label: 'Independent', vars: design.independent_variables ?? [], border: 'border-blue-200',   bg: 'bg-blue-50' },
                  { label: 'Dependent',   vars: design.dependent_variables   ?? [], border: 'border-green-200',  bg: 'bg-green-50' },
                  { label: 'Controlled',  vars: design.controlled_variables  ?? [], border: 'border-surface-2',  bg: 'bg-surface' },
                ].map(({ label, vars, border, bg }) =>
                  vars.length > 0 ? (
                    <div key={label} className={`rounded-xl border ${border} ${bg} p-4`}>
                      <p className="text-xs font-semibold uppercase tracking-wider text-muted mb-3">
                        {label}
                      </p>
                      <ul className="space-y-3">
                        {vars.map((v, i) => (
                          <li key={i}>
                            <p className="text-sm font-medium text-ink">{v.name}</p>
                            <p className="text-xs text-muted mt-0.5">
                              {v.type} · {v.values_or_range}
                              {v.units ? ` (${v.units})` : ''}
                            </p>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : null
                )}
              </div>
            </section>
          )}

          {/* Materials */}
          {design.materials.length > 0 && (
            <section className="card p-6">
              <SectionLabel>Materials</SectionLabel>
              <ul className="divide-y divide-surface-2">
                {design.materials.map((m) => (
                  <li key={m.material_id} className="py-3 flex items-start justify-between gap-4 first:pt-0 last:pb-0">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-ink font-mono">{m.material_id}</p>
                      {m.usage_notes && (
                        <p className="text-xs text-muted mt-0.5">{m.usage_notes}</p>
                      )}
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1.5">
                      <span className="text-sm text-gray-700">{m.quantity}</span>
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          m.criticality === 'required'
                            ? 'bg-red-50 text-red-600'
                            : m.criticality === 'recommended'
                            ? 'bg-yellow-50 text-yellow-700'
                            : 'bg-surface-2 text-muted'
                        }`}
                      >
                        {m.criticality}
                      </span>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>

        {/* ────────── Sidebar (right, 1/3) ────────── */}
        <div className="space-y-5 lg:sticky lg:top-6">

          {/* Actions */}
          <div className="card p-5">
            <SectionLabel>Actions</SectionLabel>

            {/* Community actions */}
            <div className="space-y-2">
              <button className="w-full btn-primary text-sm justify-center" disabled>
                Run Experiment
              </button>
              <button className="w-full btn-secondary text-sm justify-center" disabled>
                Add to My Lab
              </button>
              <button className="w-full btn-secondary text-sm justify-center" disabled>
                Review Experiment
              </button>
              {(canFork || design.status === 'published') && (
                <button
                  onClick={canFork ? () => setShowForkModal(true) : undefined}
                  disabled={!canFork}
                  className="w-full btn-secondary text-sm justify-center disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Fork
                </button>
              )}
            </div>

            {/* Owner-only actions */}
            {isAuthor && (
              <>
                <div className="my-4 border-t border-surface-2" />
                <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                  Owner
                </p>
                <div className="space-y-2">
                  {canEdit && (
                    <Link
                      to={`/designs/${id}/edit`}
                      className="block w-full btn-secondary text-sm text-center justify-center"
                    >
                      Edit
                    </Link>
                  )}
                  {canPublish && (
                    <button
                      onClick={handlePublish}
                      disabled={publishing}
                      className="w-full btn-primary text-sm justify-center disabled:opacity-50"
                    >
                      {publishing ? 'Publishing…' : 'Publish'}
                    </button>
                  )}
                  <button className="w-full btn-secondary text-sm justify-center" disabled>
                    View Reviews
                  </button>
                </div>
              </>
            )}
          </div>

          {/* About */}
          <div className="card p-5">
            <SectionLabel>About</SectionLabel>
            <dl className="space-y-3 text-sm">
              <div>
                <dt className="text-xs text-muted mb-1">Difficulty</dt>
                <dd>
                  <span
                    className={`inline-block text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[design.difficulty_level] ?? 'bg-gray-100 text-gray-600'}`}
                  >
                    {design.difficulty_level}
                  </span>
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted mb-1">Status</dt>
                <dd className="text-ink capitalize">{design.status}</dd>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <dt className="text-xs text-muted mb-1">Runs</dt>
                  <dd className="text-ink font-medium">{design.execution_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted mb-1">Forks</dt>
                  <dd className="text-ink font-medium">{design.derived_design_count}</dd>
                </div>
                <div>
                  <dt className="text-xs text-muted mb-1">Version</dt>
                  <dd className="text-ink font-medium">{design.version}</dd>
                </div>
              </div>
              {design.fork_metadata && (
                <div>
                  <dt className="text-xs text-muted mb-1">Forked from</dt>
                  <dd>
                    <Link
                      to={`/designs/${design.fork_metadata.parent_design_id}`}
                      className="text-primary hover:underline"
                    >
                      Parent design
                    </Link>
                    <span className="text-muted text-xs ml-1">({design.fork_metadata.fork_type})</span>
                  </dd>
                </div>
              )}
              {design.seeking_collaborators && (
                <div>
                  <span className="inline-block text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                    Seeking collaborators
                  </span>
                  {design.collaboration_notes && (
                    <p className="mt-2 text-xs text-muted leading-relaxed">
                      {design.collaboration_notes}
                    </p>
                  )}
                </div>
              )}
            </dl>
          </div>

          {/* Additional details */}
          {hasSidebarDetails && (
            <div className="card p-5">
              <SectionLabel>Additional Details</SectionLabel>
              <div className="space-y-4 text-sm">
                {design.hypothesis && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">Hypothesis</p>
                    <p className="text-gray-800 leading-relaxed">{design.hypothesis}</p>
                  </div>
                )}
                {design.safety_considerations && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">Safety</p>
                    <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                      {design.safety_considerations}
                    </p>
                  </div>
                )}
                {design.sample_size != null && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">Sample Size</p>
                    <p className="text-gray-800">{design.sample_size}</p>
                  </div>
                )}
                {design.analysis_plan && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">Analysis Plan</p>
                    <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                      {design.analysis_plan}
                    </p>
                  </div>
                )}
                {design.ethical_considerations && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">Ethical Considerations</p>
                    <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                      {design.ethical_considerations}
                    </p>
                  </div>
                )}
                {design.disclaimers && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">Disclaimers</p>
                    <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                      {design.disclaimers}
                    </p>
                  </div>
                )}
                {(design.reference_experiment_ids?.length ?? 0) > 0 && (
                  <div>
                    <p className="text-xs font-semibold text-muted mb-1">Reference Experiments</p>
                    <ul className="space-y-1">
                      {design.reference_experiment_ids.map((refId) => (
                        <li key={refId}>
                          <Link
                            to={`/designs/${refId}`}
                            className="text-primary hover:underline text-xs font-mono"
                          >
                            {refId}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fork modal ── */}
      {showForkModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
            <h2 className="text-lg font-semibold text-ink mb-4">Fork this design</h2>
            <form onSubmit={handleFork} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-ink mb-2">Fork type</label>
                {FORK_TYPES.map(({ value, label, description }) => (
                  <label key={value} className="flex gap-3 mb-3 cursor-pointer">
                    <input
                      type="radio"
                      name="fork_type"
                      value={value}
                      checked={forkType === value}
                      onChange={() => setForkType(value)}
                      className="mt-0.5 accent-primary"
                    />
                    <div>
                      <span className="text-sm font-medium text-ink">{label}</span>
                      <p className="text-xs text-muted mt-0.5">{description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div>
                <label className="block text-sm font-medium text-ink mb-1">Rationale *</label>
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
                <button
                  type="submit"
                  disabled={forking}
                  className="btn-primary text-sm disabled:opacity-50"
                >
                  {forking ? 'Forking…' : 'Create fork'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowForkModal(false)}
                  className="btn-secondary text-sm"
                >
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
