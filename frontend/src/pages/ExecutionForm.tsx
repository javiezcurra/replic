import { useState, useEffect, useMemo } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Execution, CoExperimenterEntry } from '../types/execution'
import type { Design } from '../types/design'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function toDateInputValue(iso: string): string {
  return iso.slice(0, 10)  // 'YYYY-MM-DD'
}

// ─── CollaboratorEntry (same shape used by the API) ───────────────────────────

interface CollaboratorEntry {
  uid: string
  displayName: string
  affiliation: string | null
}

// ─── CoExperimentersDrawer ────────────────────────────────────────────────────

function CoExperimentersDrawer({
  selectedUids,
  leadUid,
  onAdd,
  onRequestRemove,
  onClose,
}: {
  selectedUids: Set<string>
  leadUid: string
  onAdd: (c: CoExperimenterEntry) => void
  onRequestRemove: (c: CoExperimenterEntry) => void
  onClose: () => void
}) {
  const [collaborators, setCollaborators] = useState<CollaboratorEntry[]>([])
  const [loading, setLoading]             = useState(true)
  const [search, setSearch]               = useState('')

  useEffect(() => {
    api
      .get<{ status: string; data: CollaboratorEntry[] }>('/api/users/me/collaborators')
      .then(({ data }) => setCollaborators(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    const list = collaborators.filter((c) => c.uid !== leadUid)
    if (!q) return list
    return list.filter((c) => c.displayName.toLowerCase().includes(q))
  }, [collaborators, leadUid, search])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-base" style={{ color: 'var(--color-dark)' }}>
            Manage Co-Experimenters
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collaborators…"
              className="w-full pl-9 input-sm"
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
              {collaborators.length === 0
                ? 'You have no collaborators yet. Connect with researchers first.'
                : 'No collaborators match your search.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const isSelected = selectedUids.has(c.uid)
                return (
                  <li key={c.uid} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: 'var(--color-dark)' }}
                    >
                      {c.displayName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {c.displayName}
                      </p>
                      {c.affiliation && (
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                          {c.affiliation}
                        </p>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        isSelected
                          ? onRequestRemove({ uid: c.uid, displayName: c.displayName })
                          : onAdd({ uid: c.uid, displayName: c.displayName })
                      }
                      className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white
                                  transition-colors ${isSelected ? 'bg-red-400 hover:bg-red-500' : 'hover:opacity-80'}`}
                      style={isSelected ? {} : { background: 'var(--color-primary)' }}
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                          d={isSelected ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
                      </svg>
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

// ─── CoExperimentersPicker ────────────────────────────────────────────────────

function CoExperimentersPicker({
  selected,
  leadUid,
  leadName,
  onAdd,
  onRemove,
}: {
  selected: CoExperimenterEntry[]
  leadUid: string
  leadName: string
  onAdd: (c: CoExperimenterEntry) => void
  onRemove: (uid: string) => void
}) {
  const [showDrawer, setShowDrawer]         = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<CoExperimenterEntry | null>(null)

  const selectedUids = useMemo(() => new Set(selected.map((c) => c.uid)), [selected])

  useEffect(() => {
    if (!pendingRemoval) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPendingRemoval(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [pendingRemoval])

  return (
    <div>
      {/* Lead experimenter (non-removable) */}
      <div className="flex flex-wrap gap-2 mb-2">
        <span
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-gray-100 text-gray-600 border border-gray-200"
        >
          {leadName}
          <span className="text-gray-400 font-normal">Lead</span>
        </span>
        {selected.map((c) => (
          <span
            key={c.uid}
            className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs
                       bg-brand-50 text-brand-700 border border-brand-200"
          >
            {c.displayName}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={() => setShowDrawer(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-dashed
                   border-gray-300 text-sm text-gray-600 hover:border-brand-400
                   hover:text-brand-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
        </svg>
        Manage Co-Experimenters
      </button>

      {showDrawer && (
        <CoExperimentersDrawer
          selectedUids={selectedUids}
          leadUid={leadUid}
          onAdd={onAdd}
          onRequestRemove={setPendingRemoval}
          onClose={() => setShowDrawer(false)}
        />
      )}

      {pendingRemoval && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setPendingRemoval(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 pointer-events-auto">
              <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-dark)' }}>
                Remove co-experimenter?
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text)' }}>
                Remove <strong>{pendingRemoval.displayName}</strong> as a co-experimenter? They will
                lose access to this experiment run.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setPendingRemoval(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => { onRemove(pendingRemoval.uid); setPendingRemoval(null) }}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ background: 'var(--color-primary)' }}
                >
                  Remove
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Design reference panel ───────────────────────────────────────────────────

function DesignReference({ design }: { design: Design }) {
  return (
    <div className="space-y-4">
      <div>
        <p className="text-xs font-semibold uppercase tracking-widest mb-1"
          style={{ color: 'var(--color-text-muted)' }}>
          Design Reference
        </p>
        <h2 className="text-lg font-bold leading-snug" style={{ color: 'var(--color-dark)' }}>
          {design.title}
        </h2>
        <p className="text-xs mt-1 font-mono" style={{ color: 'var(--color-text-muted)' }}>
          v{design.published_version}
        </p>
      </div>

      {(design.summary || design.hypothesis) && (
        <div className="card p-4 space-y-3">
          {design.summary && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-text-muted)' }}>Overview</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                {design.summary}
              </p>
            </div>
          )}
          {design.hypothesis && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wider mb-1"
                style={{ color: 'var(--color-text-muted)' }}>Hypothesis</p>
              <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                {design.hypothesis}
              </p>
            </div>
          )}
        </div>
      )}

      {design.research_questions.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-text-muted)' }}>Research Questions</p>
          <ol className="space-y-3">
            {design.research_questions.map((q, i) => (
              <li key={q.id} className="flex gap-2">
                <span className="shrink-0 text-xs font-bold mt-0.5 w-4"
                  style={{ color: 'var(--color-text-muted)' }}>{i + 1}.</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    {q.question}
                  </p>
                  <div className="mt-1 flex flex-wrap gap-1.5 text-xs"
                    style={{ color: 'var(--color-text-muted)' }}>
                    <span className="bg-surface-2 px-1.5 py-0.5 rounded font-mono">
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
          </ol>
        </div>
      )}

      {design.steps.length > 0 && (
        <div className="card p-4">
          <p className="text-xs font-semibold uppercase tracking-wider mb-3"
            style={{ color: 'var(--color-text-muted)' }}>Methodology</p>
          <ol className="space-y-3">
            {design.steps.map((step) => (
              <li key={step.step_number} className="flex gap-3">
                <span
                  className="shrink-0 w-6 h-6 rounded-full text-white text-xs font-bold flex items-center justify-center mt-0.5"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {step.step_number}
                </span>
                <div className="flex-1 min-w-0 pt-0.5">
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text)' }}>
                    {step.instruction}
                  </p>
                  {(step.duration_minutes || step.safety_notes) && (
                    <div className="mt-1 flex flex-wrap gap-3 text-xs"
                      style={{ color: 'var(--color-text-muted)' }}>
                      {step.duration_minutes && <span>{step.duration_minutes} min</span>}
                      {step.safety_notes && (
                        <span className="text-amber-600">⚠ {step.safety_notes}</span>
                      )}
                    </div>
                  )}
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ExecutionForm() {
  const { id }       = useParams<{ id: string }>()
  const { user }     = useAuth()
  const navigate     = useNavigate()

  const [execution, setExecution]             = useState<Execution | null>(null)
  const [design, setDesign]                   = useState<Design | null>(null)
  const [loading, setLoading]                 = useState(true)
  const [notFound, setNotFound]               = useState(false)
  const [forbidden, setForbidden]             = useState(false)

  // Form state — initialised from execution once loaded
  const [coExperimenters, setCoExperimenters] = useState<CoExperimenterEntry[]>([])
  const [startDate, setStartDate]             = useState('')
  const [deviations, setDeviations]           = useState('')

  // UI state
  const [isEditing, setIsEditing]             = useState(false)
  const [saving, setSaving]                   = useState(false)
  const [saveSuccess, setSaveSuccess]         = useState(false)
  const [saveError, setSaveError]             = useState('')
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [cancelling, setCancelling]           = useState(false)

  useEffect(() => {
    async function load() {
      if (!id) return
      try {
        const execRes = await api.get<{ status: string; data: Execution }>(`/api/executions/${id}`)
        const exec    = execRes.data
        setExecution(exec)

        // Only the lead experimenter (or co-experimenter) should be here
        if (user && exec.experimenter_uid !== user.uid &&
            !exec.co_experimenter_uids.includes(user.uid)) {
          setForbidden(true)
          setLoading(false)
          return
        }

        // Initialise form state from the execution
        setCoExperimenters(exec.co_experimenters)
        setStartDate(toDateInputValue(exec.start_date))
        setDeviations(exec.methodology_deviations)

        // Load the design for the reference panel
        const designRes = await api.get<{ status: string; data: Design }>(
          `/api/designs/${exec.design_id}`
        )
        setDesign(designRes.data)
      } catch (err: any) {
        if (err?.status === 404) setNotFound(true)
        else setNotFound(true)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [id, user])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    if (!execution) return
    setSaving(true)
    setSaveError('')
    setSaveSuccess(false)
    try {
      const updated = await api.patch<{ status: string; data: Execution }>(
        `/api/executions/${execution.id}`,
        {
          co_experimenter_uids:   coExperimenters.map((c) => c.uid),
          co_experimenters:       coExperimenters,
          start_date:             startDate ? `${startDate}T00:00:00.000Z` : undefined,
          methodology_deviations: deviations,
        },
      )
      setExecution(updated.data)
      setIsEditing(false)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleCancelExperiment() {
    if (!execution) return
    setCancelling(true)
    try {
      await api.delete(`/api/executions/${execution.id}`)
      navigate(`/designs/${execution.design_id}`)
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to cancel experiment')
      setCancelling(false)
      setShowCancelConfirm(false)
    }
  }

  // ── Guard states ────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !execution) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <p className="text-4xl mb-4">🔍</p>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          Experiment run not found
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          It may have been cancelled or may not exist.
        </p>
        <Link to="/experiments" className="mt-4 inline-block btn-secondary text-sm">
          Browse experiments
        </Link>
      </div>
    )
  }

  if (forbidden) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <p className="text-4xl mb-4">🔒</p>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--color-text)' }}>
          Access denied
        </h1>
        <p className="mt-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
          Only the lead experimenter or co-experimenters can view this run.
        </p>
        <Link to="/experiments" className="mt-4 inline-block btn-secondary text-sm">
          Browse experiments
        </Link>
      </div>
    )
  }

  const isLead = user?.uid === execution.experimenter_uid
  const designTitle = design?.title ?? execution.design_title

  const formattedStartDate = startDate
    ? new Date(startDate + 'T12:00:00').toLocaleDateString('en-US', {
        month: 'long', day: 'numeric', year: 'numeric',
      })
    : '—'

  return (
    <div className="max-w-6xl mx-auto py-8 px-4">

      {/* Breadcrumb */}
      <nav className="mb-6 flex items-center gap-2 text-sm" style={{ color: 'var(--color-text-muted)' }}>
        <Link to="/my-lab" className="hover:opacity-70 transition-opacity">My Lab</Link>
        <span>/</span>
        <Link
          to={`/designs/${execution.design_id}`}
          className="hover:opacity-70 transition-opacity truncate max-w-xs"
        >
          {designTitle}
        </Link>
        <span>/</span>
        <span style={{ color: 'var(--color-text)' }}>Run</span>
      </nav>

      {/* Page header */}
      <header className="mb-8 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-display font-bold" style={{ color: 'var(--color-dark)' }}>
              {designTitle}
            </h1>
            <span
              className="text-xs font-medium px-2.5 py-1 rounded-full"
              style={{ background: 'var(--color-accent)', color: 'var(--color-dark)' }}
            >
              In Progress
            </span>
          </div>
          <p className="mt-1 text-sm" style={{ color: 'var(--color-text-muted)' }}>
            Experiment run · Design v{execution.design_version}
          </p>
        </div>

        {/* Edit / Stop Editing toggle (lead only) */}
        {isLead && !isEditing && (
          <button
            type="button"
            onClick={() => setIsEditing(true)}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       border-2 transition-colors hover:opacity-90"
            style={{ borderColor: 'var(--color-dark)', color: 'var(--color-dark)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Edit
          </button>
        )}
        {isLead && isEditing && (
          <button
            type="button"
            onClick={() => { setIsEditing(false); setSaveError('') }}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold
                       border-2 transition-colors hover:bg-gray-50"
            style={{ borderColor: 'var(--color-secondary)', color: 'var(--color-secondary)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
            Stop Editing
          </button>
        )}
      </header>

      {/* Save success banner */}
      {saveSuccess && (
        <div className="mb-6 text-sm text-green-700 bg-green-50 border border-green-200 rounded-xl px-4 py-3">
          Changes saved successfully.
        </div>
      )}

      {/* Two-column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">

        {/* ── Left: form (2/3) ── */}
        <div className="lg:col-span-2">

          {isEditing ? (
            /* ── Edit mode ── */
            <form onSubmit={handleSave} className="space-y-6">

              {/* Co-Experimenters */}
              <div className="card p-6">
                <label className="block text-sm font-semibold mb-1"
                  style={{ color: 'var(--color-text)' }}>
                  Co-Experimenters
                </label>
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Add collaborators who are running this experiment with you.
                </p>
                {design && (
                  <CoExperimentersPicker
                    selected={coExperimenters}
                    leadUid={execution.experimenter_uid}
                    leadName={user?.displayName ?? 'You'}
                    onAdd={(c) => setCoExperimenters((prev) => [...prev, c])}
                    onRemove={(uid) =>
                      setCoExperimenters((prev) => prev.filter((c) => c.uid !== uid))
                    }
                  />
                )}
              </div>

              {/* Start Date */}
              <div className="card p-6">
                <label
                  htmlFor="start-date"
                  className="block text-sm font-semibold mb-1"
                  style={{ color: 'var(--color-text)' }}
                >
                  Start Date
                </label>
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  When did you begin running this experiment? Adjust if the date is incorrect.
                </p>
                <input
                  id="start-date"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="input-sm"
                />
              </div>

              {/* Methodology Deviations */}
              <div className="card p-6">
                <label
                  htmlFor="deviations"
                  className="block text-sm font-semibold mb-1"
                  style={{ color: 'var(--color-text)' }}
                >
                  Methodology Deviations
                </label>
                <p className="text-xs mb-3" style={{ color: 'var(--color-text-muted)' }}>
                  Note any ways your execution deviated from the original design methodology — materials
                  substitutions, procedural changes, unexpected conditions, etc.
                </p>
                <textarea
                  id="deviations"
                  rows={5}
                  value={deviations}
                  onChange={(e) => setDeviations(e.target.value)}
                  placeholder="Describe any deviations from the design methodology…"
                  className="w-full input-sm resize-y"
                />
              </div>

              {/* Error feedback */}
              {saveError && (
                <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
                  {saveError}
                </p>
              )}

              {/* Actions */}
              <div className="flex flex-col gap-3">
                <button
                  type="submit"
                  disabled={saving}
                  className="btn-primary text-sm justify-center disabled:opacity-50"
                >
                  {saving ? 'Saving…' : 'Save Changes'}
                </button>

                <div className="border-t border-surface-2 pt-3">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full px-4 py-2 rounded-xl text-sm font-medium border border-red-200
                               text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Cancel Experiment
                  </button>
                  <p className="mt-2 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                    Cancelling undoes this run as if it never started.
                  </p>
                </div>
              </div>
            </form>
          ) : (
            /* ── View mode ── */
            <div className="space-y-6">

              {/* Co-Experimenters (read-only) */}
              <div className="card p-6">
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                  Co-Experimenters
                </p>
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                                   bg-gray-100 text-gray-600 border border-gray-200">
                    {user?.displayName ?? 'You'}
                    <span className="text-gray-400 font-normal">Lead</span>
                  </span>
                  {coExperimenters.length === 0 ? (
                    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                      No co-experimenters.
                    </span>
                  ) : (
                    coExperimenters.map((c) => (
                      <span
                        key={c.uid}
                        className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs
                                   border border-gray-200 bg-white"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {c.displayName}
                      </span>
                    ))
                  )}
                </div>
              </div>

              {/* Start Date (read-only) */}
              <div className="card p-6">
                <p className="text-sm font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                  Start Date
                </p>
                <p className="text-sm mt-2" style={{ color: 'var(--color-text)' }}>
                  {formattedStartDate}
                </p>
              </div>

              {/* Methodology Deviations (read-only) */}
              <div className="card p-6">
                <p className="text-sm font-semibold mb-3" style={{ color: 'var(--color-text)' }}>
                  Methodology Deviations
                </p>
                {deviations.trim() ? (
                  <p className="text-sm leading-relaxed whitespace-pre-wrap"
                    style={{ color: 'var(--color-text)' }}>
                    {deviations}
                  </p>
                ) : (
                  <p className="text-sm italic" style={{ color: 'var(--color-text-muted)' }}>
                    No deviations noted yet.
                  </p>
                )}
              </div>

              {/* Cancel experiment (lead only, accessible from view mode) */}
              {isLead && (
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => setShowCancelConfirm(true)}
                    className="w-full px-4 py-2 rounded-xl text-sm font-medium border border-red-200
                               text-red-600 hover:bg-red-50 transition-colors"
                  >
                    Cancel Experiment
                  </button>
                  <p className="mt-2 text-xs text-center" style={{ color: 'var(--color-text-muted)' }}>
                    Cancelling undoes this run as if it never started.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Right: design reference (1/3, sticky) ── */}
        <div className="lg:sticky lg:top-6">
          {design ? (
            <DesignReference design={design} />
          ) : (
            <div className="card p-6 text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Loading design…
            </div>
          )}
        </div>
      </div>

      {/* Cancel confirmation modal */}
      {showCancelConfirm && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setShowCancelConfirm(false)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 pointer-events-auto">
              <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-dark)' }}>
                Cancel this experiment run?
              </h3>
              <p className="text-sm mb-4" style={{ color: 'var(--color-text)' }}>
                This will permanently remove this run record. The design will be unlocked if no other
                runs are active. This action cannot be undone.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={cancelling}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200
                             hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Keep run
                </button>
                <button
                  type="button"
                  onClick={handleCancelExperiment}
                  disabled={cancelling}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500
                             hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {cancelling ? 'Cancelling…' : 'Cancel experiment'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
