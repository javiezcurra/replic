import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Design, DesignMaterial, ForkType, DesignVersionSummary, DesignVersionSnapshot } from '../types/design'
import type { Material } from '../types/material'
import MaterialCard from '../components/MaterialCard'
import MaterialDetailModal from '../components/MaterialDetailModal'
import ReviewsSection from '../components/ReviewsSection'
import UserDisplayName from '../components/UserDisplayName'

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
  const [materialMap, setMaterialMap] = useState<Record<string, Material>>({})
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)
  const [refTitleMap, setRefTitleMap] = useState<Record<string, string>>({})

  // Version selector state
  const [versions, setVersions] = useState<DesignVersionSummary[]>([])
  // 'current' = latest state (draft for owner-with-draft, published for others)
  // 'vN' = a specific published version snapshot
  const [selectorKey, setSelectorKey] = useState<string>('current')
  const [selectedSnapshot, setSelectedSnapshot] = useState<DesignVersionSnapshot | null>(null)
  const [snapshotLoading, setSnapshotLoading] = useState(false)

  // Edit warning modal (shown before navigating to edit for published designs with no draft yet)
  const [showEditWarning, setShowEditWarning] = useState(false)

  async function loadMaterials(materials: DesignMaterial[]) {
    if (!materials.length) return
    const results = await Promise.allSettled(
      materials.map((m) =>
        api.get<{ status: string; data: Material }>(`/api/materials/${m.material_id}`)
      )
    )
    const map: Record<string, Material> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') map[materials[i].material_id] = r.value.data
    })
    // Merge into existing map so materials from other viewed versions remain accessible
    setMaterialMap((prev) => ({ ...prev, ...map }))
  }

  // When the selected snapshot changes, fetch any materials it references that we
  // haven't loaded yet (i.e. materials removed from the current version).
  useEffect(() => {
    if (selectedSnapshot?.data?.materials?.length) {
      loadMaterials(selectedSnapshot.data.materials)
    }
  }, [selectedSnapshot])

  async function loadRefTitles(ids: string[]) {
    if (!ids.length) return
    const results = await Promise.allSettled(
      ids.map((refId) =>
        api.get<{ status: string; data: { title: string } }>(`/api/designs/${refId}`)
      )
    )
    const map: Record<string, string> = {}
    results.forEach((r, i) => {
      if (r.status === 'fulfilled') map[ids[i]] = r.value.data.title
    })
    setRefTitleMap(map)
  }

  async function loadVersions() {
    try {
      const res = await api.get<{ status: string; data: DesignVersionSummary[] }>(
        `/api/designs/${id}/versions`
      )
      setVersions(res.data)
    } catch {
      // Version history is non-critical; silently ignore errors
    }
  }

  async function loadDesign() {
    try {
      const res = await api.get<{ status: string; data: Design }>(`/api/designs/${id}`)
      setDesign(res.data)
      loadMaterials(res.data.materials)
      loadRefTitles(res.data.reference_experiment_ids ?? [])
      if (res.data.published_version > 0) {
        loadVersions()
      }
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

  async function handleVersionSelect(key: string) {
    setSelectorKey(key)
    if (key === 'current') {
      setSelectedSnapshot(null)
      return
    }
    const versionNum = key.replace('v', '')
    setSnapshotLoading(true)
    try {
      const res = await api.get<{ status: string; data: DesignVersionSnapshot }>(
        `/api/designs/${id}/versions/${versionNum}`
      )
      setSelectedSnapshot(res.data)
    } catch {
      setError('Failed to load that version')
      setSelectorKey('current')
      setSelectedSnapshot(null)
    } finally {
      setSnapshotLoading(false)
    }
  }

  async function handlePublish() {
    setPublishing(true)
    try {
      await api.post(`/api/designs/${id}/publish`)
      await loadDesign()
      setSelectedSnapshot(null)
      setSelectorKey('current')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  function handleEditClick() {
    // For published designs that have no draft yet, show a warning first explaining
    // that edits create a private draft and the published version stays live.
    if (design && design.status === 'published' && !design.has_draft_changes) {
      setShowEditWarning(true)
    } else {
      navigate(`/designs/${id}/edit`)
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

  if (!design) return null

  const isAuthor  = user ? design.author_ids.includes(user.uid) : false
  // Publish is available for pure drafts OR published designs with unsaved changes,
  // but only when the author is viewing the current (not a historical) state.
  const canPublish = isAuthor && selectedSnapshot === null &&
    (design.status === 'draft' || design.has_draft_changes)
  const canEdit    = isAuthor && design.status !== 'locked' && selectedSnapshot === null
  const canFork    = !!user && !isAuthor && design.status === 'published'

  // The design data actually rendered in the content area.
  // When a historical version is selected, the snapshot's data is used;
  // otherwise the API response is used (which is the draft for authors, published for others).
  const viewedDesign: Design = selectedSnapshot?.data ?? design

  const hasVariables =
    (viewedDesign.independent_variables?.length ?? 0) > 0 ||
    (viewedDesign.dependent_variables?.length    ?? 0) > 0 ||
    (viewedDesign.controlled_variables?.length   ?? 0) > 0

  const hasSidebarDetails =
    !!viewedDesign.safety_considerations ||
    viewedDesign.sample_size != null ||
    !!viewedDesign.analysis_plan ||
    !!viewedDesign.ethical_considerations ||
    !!viewedDesign.disclaimers ||
    (viewedDesign.reference_experiment_ids?.length ?? 0) > 0

  // Show the version selector when there are published versions or an owner-only draft option.
  const hasDraftOption = isAuthor && design.has_draft_changes
  const showVersionSelector = versions.length > 0 || hasDraftOption

  // In the selector, the 'current' option label changes based on context.
  const currentOptionLabel = hasDraftOption
    ? 'Draft (unpublished)'
    : design.published_version > 0
    ? `v${design.published_version} (latest)`
    : 'Current'

  // Historical versions in the selector: exclude the latest published when viewing as non-author
  // (since 'current' already represents it). Include all versions for authors-with-draft.
  const versionOptions = hasDraftOption
    ? versions
    : versions.filter((v) => v.version_number !== design.published_version)

  const isViewingHistorical =
    selectedSnapshot !== null &&
    selectedSnapshot.version_number !== design.published_version

  const isViewingPublishedAsAuthorWithDraft =
    selectedSnapshot !== null &&
    isAuthor &&
    design.has_draft_changes &&
    selectedSnapshot.version_number === design.published_version

  // Determine which changelog entry to show in the sidebar (null = hide the card).
  const changelogToShow: { text: string; date?: string; label?: string } | null = (() => {
    if (selectedSnapshot !== null) {
      return selectedSnapshot.changelog
        ? { text: selectedSnapshot.changelog, date: selectedSnapshot.published_at }
        : null
    }
    // Viewing "current" as author with a pending draft changelog
    if (isAuthor && design.has_draft_changes && design.pending_changelog) {
      return { text: design.pending_changelog, label: 'Draft changelog (not yet published)' }
    }
    // Viewing the latest published version — show its changelog if one was recorded
    if (design.published_version > 0) {
      const currentVersion = versions.find((v) => v.version_number === design.published_version)
      if (currentVersion?.changelog) {
        return { text: currentVersion.changelog, date: currentVersion.published_at }
      }
    }
    return null
  })()

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
          {viewedDesign.discipline_tags.map((tag) => (
            <span key={tag} className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[viewedDesign.difficulty_level] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {viewedDesign.difficulty_level}
          </span>
        </div>

        {/* Title + version selector + status chip */}
        <div className="flex flex-wrap items-start gap-3">
          <h1 className="text-3xl font-display font-bold text-dark leading-tight flex-1">
            {viewedDesign.title}
          </h1>
          <div className="flex items-center gap-2 shrink-0 mt-1 flex-wrap">
            {/* Status chip — always shown */}
            <span
              className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                design.status === 'draft'
                  ? 'bg-yellow-50 text-yellow-700'
                  : design.status === 'locked'
                  ? 'bg-gray-100 text-gray-500'
                  : 'bg-green-50 text-green-700'
              }`}
            >
              {design.status.charAt(0).toUpperCase() + design.status.slice(1)}
            </span>
            {isAuthor && design.has_draft_changes && selectedSnapshot === null && (
              <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-amber-50 text-amber-700">
                Unpublished changes
              </span>
            )}
            {showVersionSelector && (
              <>
                <label className="text-xs text-muted">Version</label>
                <select
                  value={selectorKey}
                  onChange={(e) => handleVersionSelect(e.target.value)}
                  className="input-sm text-xs py-1"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  <option value="current">{currentOptionLabel}</option>
                  {versionOptions.map((v) => (
                    <option key={v.version_number} value={`v${v.version_number}`}>
                      v{v.version_number} — {new Date(v.published_at).toLocaleDateString()}
                    </option>
                  ))}
                </select>
              </>
            )}
          </div>
        </div>

        {/* Historical version banner */}
        {(isViewingHistorical || isViewingPublishedAsAuthorWithDraft) && (
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <span className="shrink-0 mt-0.5">📌</span>
            <div>
              {isViewingHistorical ? (
                <p>
                  You're viewing version {selectedSnapshot!.version_number} — this is not the
                  latest published version.{' '}
                  <button
                    onClick={() => handleVersionSelect('current')}
                    className="underline font-medium"
                  >
                    View latest
                  </button>
                </p>
              ) : (
                <p>
                  You're viewing the published version {selectedSnapshot!.version_number}. You have
                  an unpublished draft with newer changes.{' '}
                  <button
                    onClick={() => handleVersionSelect('current')}
                    className="underline font-medium"
                  >
                    View draft
                  </button>
                </p>
              )}
              {selectedSnapshot?.changelog && (
                <p className="mt-1 text-xs text-amber-700 italic">
                  Changelog: {selectedSnapshot.changelog}
                </p>
              )}
            </div>
          </div>
        )}

        {/* Stats row — Runs · Forks · Updated · Created */}
        <div className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-xs text-muted">
          <span>{design.execution_count} run{design.execution_count !== 1 ? 's' : ''}</span>
          <span>{design.derived_design_count} fork{design.derived_design_count !== 1 ? 's' : ''}</span>
          {viewedDesign.fork_metadata && (
            <span>
              Forked from{' '}
              <Link
                to={`/designs/${viewedDesign.fork_metadata.parent_design_id}`}
                className="text-primary hover:underline"
              >
                parent
              </Link>
              {' '}({viewedDesign.fork_metadata.fork_type})
            </span>
          )}
          <span>Updated {new Date(viewedDesign.updated_at).toLocaleDateString()}</span>
          <span>Created {new Date(design.created_at).toLocaleDateString()}</span>
        </div>
      </header>

      {error && (
        <p className="mb-6 text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
          {error}
        </p>
      )}

      {snapshotLoading && (
        <div className="flex items-center justify-center py-12">
          <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      )}

      {/* ── Two-column layout + reviews ── */}
      {!snapshotLoading && (
        <>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">

          {/* ────────── Main content (left, 2/3) ────────── */}
          <div className="lg:col-span-2 space-y-5">

            {/* Overview */}
            {(viewedDesign.summary || viewedDesign.hypothesis) && (
              <section className="card p-6">
                <SectionLabel>Overview</SectionLabel>
                {viewedDesign.summary && (
                  <p className="text-gray-800 leading-relaxed">{viewedDesign.summary}</p>
                )}
                {viewedDesign.hypothesis && (
                  <>
                    <p className="text-xs font-semibold text-muted mt-4 mb-1">Hypothesis</p>
                    <p className="text-gray-800 leading-relaxed">{viewedDesign.hypothesis}</p>
                  </>
                )}
              </section>
            )}

            {/* Materials */}
            {viewedDesign.materials.length > 0 && (
              <section className="card p-6">
                <SectionLabel>Materials</SectionLabel>
                <ul className="space-y-3">
                  {viewedDesign.materials.map((m) => {
                    const mat = materialMap[m.material_id]
                    return (
                      <li key={m.material_id}>
                        {mat ? (
                          <MaterialCard
                            material={mat}
                            onDetails={setSelectedMaterial}
                          />
                        ) : (
                          <div className="rounded-xl border-2 border-surface-2 px-4 py-3">
                            <p className="text-sm font-mono text-muted">{m.material_id}</p>
                          </div>
                        )}
                        <div className="flex items-center gap-2 mt-1.5 pl-1">
                          <span className="text-xs text-gray-700">{m.quantity}</span>
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
                    )
                  })}
                </ul>
              </section>
            )}

            {/* Methodology */}
            {viewedDesign.steps.length > 0 && (
              <section className="card p-6">
                <SectionLabel>Methodology</SectionLabel>
                <ol className="space-y-5">
                  {viewedDesign.steps.map((step) => (
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
            {viewedDesign.research_questions.length > 0 && (
              <section className="card p-6">
                <SectionLabel>Research Questions & Outcomes</SectionLabel>
                <ul className="space-y-4">
                  {viewedDesign.research_questions.map((q, i) => (
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
                    { label: 'Independent', vars: viewedDesign.independent_variables ?? [], border: 'border-blue-200',   bg: 'bg-blue-50' },
                    { label: 'Dependent',   vars: viewedDesign.dependent_variables   ?? [], border: 'border-green-200',  bg: 'bg-green-50' },
                    { label: 'Controlled',  vars: viewedDesign.controlled_variables  ?? [], border: 'border-surface-2',  bg: 'bg-surface' },
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
          </div>

          {/* ────────── Sidebar (right, 1/3) ────────── */}
          <div className="space-y-5 lg:sticky lg:top-6">

            {/* Changelog */}
            {changelogToShow && (
              <div className="card p-5">
                <SectionLabel>Changelog</SectionLabel>
                {changelogToShow.label && (
                  <p className="text-xs font-medium text-amber-700 mb-2">{changelogToShow.label}</p>
                )}
                {changelogToShow.date && (
                  <p className="text-xs text-muted mb-2">
                    {new Date(changelogToShow.date).toLocaleDateString(undefined, {
                      year: 'numeric',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </p>
                )}
                <p className="text-sm text-gray-800 leading-relaxed whitespace-pre-line">
                  {changelogToShow.text}
                </p>
              </div>
            )}

            {/* Authors */}
            <div className="card p-5">
              <SectionLabel>Authors</SectionLabel>
              <div className="space-y-2">
                {viewedDesign.author_ids.map((uid) => (
                  <div key={uid} className="text-sm">
                    <UserDisplayName uid={uid} className="text-sm" />
                  </div>
                ))}
                {viewedDesign.author_ids.length === 0 && (
                  <p className="text-sm text-muted">No authors listed.</p>
                )}
              </div>
              {viewedDesign.seeking_collaborators && (
                <div className="mt-4 pt-4 border-t border-surface-2">
                  <span className="inline-block text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                    Seeking collaborators
                  </span>
                  {viewedDesign.collaboration_notes && (
                    <p className="mt-2 text-xs text-muted leading-relaxed">
                      {viewedDesign.collaboration_notes}
                    </p>
                  )}
                </div>
              )}
            </div>

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
                {design.status === 'published' && !isAuthor && user && (
                  <button
                    onClick={() =>
                      document
                        .getElementById('reviews-section')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="w-full btn-secondary text-sm justify-center"
                  >
                    Review Experiment
                  </button>
                )}
                {design.status === 'published' && isAuthor && (
                  <button
                    onClick={() =>
                      document
                        .getElementById('reviews-section')
                        ?.scrollIntoView({ behavior: 'smooth', block: 'start' })
                    }
                    className="w-full btn-secondary text-sm justify-center"
                  >
                    View Reviews
                  </button>
                )}
                {design.status !== 'published' && (
                  <button className="w-full btn-secondary text-sm justify-center" disabled>
                    Review Experiment
                  </button>
                )}
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

              {/* Owner-only actions — only shown when viewing the current state */}
              {isAuthor && (
                <>
                  <div className="my-4 border-t border-surface-2" />
                  <p className="text-xs font-semibold uppercase tracking-widest text-muted mb-3">
                    Owner
                  </p>
                  <div className="space-y-2">
                    {canEdit && (
                      <button
                        onClick={handleEditClick}
                        className="block w-full btn-secondary text-sm text-center justify-center"
                      >
                        Edit
                      </button>
                    )}
                    {canPublish && (
                      <button
                        onClick={handlePublish}
                        disabled={publishing}
                        className="w-full btn-primary text-sm justify-center disabled:opacity-50"
                      >
                        {publishing
                          ? 'Publishing…'
                          : design.has_draft_changes
                          ? 'Publish draft'
                          : 'Publish'}
                      </button>
                    )}
                  </div>
                </>
              )}
            </div>

            {/* Additional details */}
            {hasSidebarDetails && (
              <div className="card p-5">
                <SectionLabel>Additional Details</SectionLabel>
                <div className="space-y-4 text-sm">
                  {viewedDesign.safety_considerations && (
                    <div>
                      <p className="text-xs font-semibold text-muted mb-1">Safety</p>
                      <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                        {viewedDesign.safety_considerations}
                      </p>
                    </div>
                  )}
                  {viewedDesign.sample_size != null && (
                    <div>
                      <p className="text-xs font-semibold text-muted mb-1">Sample Size</p>
                      <p className="text-gray-800">{viewedDesign.sample_size}</p>
                    </div>
                  )}
                  {viewedDesign.analysis_plan && (
                    <div>
                      <p className="text-xs font-semibold text-muted mb-1">Analysis Plan</p>
                      <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                        {viewedDesign.analysis_plan}
                      </p>
                    </div>
                  )}
                  {viewedDesign.ethical_considerations && (
                    <div>
                      <p className="text-xs font-semibold text-muted mb-1">Ethical Considerations</p>
                      <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                        {viewedDesign.ethical_considerations}
                      </p>
                    </div>
                  )}
                  {viewedDesign.disclaimers && (
                    <div>
                      <p className="text-xs font-semibold text-muted mb-1">Disclaimers</p>
                      <p className="text-gray-800 whitespace-pre-line leading-relaxed">
                        {viewedDesign.disclaimers}
                      </p>
                    </div>
                  )}
                  {(viewedDesign.reference_experiment_ids?.length ?? 0) > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-muted mb-1">Reference Experiments</p>
                      <ul className="space-y-1">
                        {viewedDesign.reference_experiment_ids.map((refId) => (
                          <li key={refId}>
                            <Link
                              to={`/designs/${refId}`}
                              className="text-primary hover:underline text-sm"
                            >
                              {refTitleMap[refId] ?? refId}
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

        {/* ── Reviews section (full-width, below columns) ── */}
        {design.status === 'published' && (
          <div id="reviews-section" className="mt-2">
            <ReviewsSection
              designId={design.id}
              design={viewedDesign}
              materialMap={materialMap}
              isAuthor={isAuthor}
              isPublished={design.status === 'published'}
            />
          </div>
        )}
        </>
      )}

      {/* ── Edit warning modal ── */}
      {showEditWarning && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6 space-y-4">
            <div className="flex items-start gap-3">
              <span className="text-2xl">📋</span>
              <div>
                <h2
                  className="text-lg font-semibold"
                  style={{ fontFamily: 'var(--font-body)', color: 'var(--color-text)' }}
                >
                  You're editing a published design
                </h2>
                <p className="text-sm mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Your changes will be saved as a private draft.{' '}
                  {design.published_version > 0 ? `v${design.published_version}` : 'The current version'}{' '}
                  will remain publicly visible until you publish the new version.
                </p>
                <p className="text-sm mt-2" style={{ color: 'var(--color-text-muted)' }}>
                  You can save your edits as many times as you like — nothing goes public until you
                  click <strong>Publish draft</strong>.
                </p>
              </div>
            </div>
            <div className="flex gap-3 pt-2">
              <button
                className="btn-primary text-sm flex-1"
                onClick={() => {
                  setShowEditWarning(false)
                  navigate(`/designs/${id}/edit`)
                }}
              >
                Got it, start editing
              </button>
              <button
                className="btn-secondary text-sm flex-1"
                onClick={() => setShowEditWarning(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

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

      {/* Material detail modal */}
      {selectedMaterial && (
        <MaterialDetailModal
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
          inLab={false}
        />
      )}
    </div>
  )
}
