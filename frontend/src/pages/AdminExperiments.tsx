/**
 * AdminExperiments — Admin Panel page for viewing all platform experiments
 * and managing disciplines.
 */
import { useEffect, useState } from 'react'
import { Navigate, Link } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import type { DesignStatus } from '../types/design'
import { useDisciplines } from '../hooks/useDisciplines'
import ManageDisciplinesModal from '../components/ManageDisciplinesModal'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminDesignSummary {
  id: string
  title: string
  status: DesignStatus
  discipline_tags: string[]
  difficulty_level: string
  author_ids: string[]
  execution_count: number
  published_version: number
  created_at: string
  updated_at: string
}

interface AdminDesignsResponse {
  status: string
  data: AdminDesignSummary[]
  total: number
}

// ── Status badge ──────────────────────────────────────────────────────────────

const STATUS_STYLES: Record<DesignStatus, string> = {
  draft:     'bg-gray-100 text-gray-600',
  published: 'bg-green-50 text-green-700',
  locked:    'bg-amber-50 text-amber-700',
}

function StatusBadge({ status }: { status: DesignStatus }) {
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-medium ${STATUS_STYLES[status] ?? STATUS_STYLES.draft}`}
    >
      {status}
    </span>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminExperiments() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { disciplines, loading: discLoading, setDisciplines } = useDisciplines()

  const [designs, setDesigns]         = useState<AdminDesignSummary[]>([])
  const [total, setTotal]             = useState(0)
  const [loading, setLoading]         = useState(true)
  const [showDisciplines, setShowDisciplines] = useState(false)

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    api
      .get<AdminDesignsResponse>('/api/admin/designs')
      .then((res) => {
        setDesigns(res.data)
        setTotal(res.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAdmin])

  if (!authLoading && (!user || !isAdmin)) {
    return <Navigate to="/" replace />
  }

  // Build a discipline lookup for display
  const disciplineMap = new Map(disciplines.map((d) => [d.id, d]))

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>

      {/* Page header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Admin Panel</p>
            <h1
              className="text-5xl sm:text-6xl text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Experiments
            </h1>
            <p className="mt-2 text-lg text-plum max-w-sm">
              All platform experiments.{' '}
              <span className="text-muted text-base">Only you can see this.</span>
            </p>
          </div>

          <button
            onClick={() => setShowDisciplines(true)}
            className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                       border-2 border-surface-2 text-ink text-sm font-semibold
                       hover:border-ink transition-all"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828
                   0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
            </svg>
            Edit Disciplines
          </button>
        </div>
      </div>

      {/* Experiment list */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">

        {/* Section header banner */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4 mb-4"
          style={{ background: 'var(--color-dark)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 3h6m-6 0v7l-4 9a1 1 0 00.9 1.45h12.2A1 1 0 0019 19l-4-9V3m-6 0h6" />
              </svg>
            </div>
            <div>
              <h2
                className="text-2xl font-semibold text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                All Experiments
              </h2>
              <p className="text-white/60 text-sm">Drafts, published, and locked</p>
            </div>
          </div>
          <span
            className="text-white/40 text-3xl font-semibold tabular-nums shrink-0"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {total}
          </span>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div
              className="w-8 h-8 border-4 rounded-full animate-spin"
              style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : designs.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-5xl mb-3">🔬</p>
            <p className="text-muted text-sm">No experiments yet.</p>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
            {/* Table header */}
            <div className="hidden md:grid grid-cols-[1fr_auto_auto_auto_auto] gap-4 px-5 py-3
                            bg-gray-50 border-b border-gray-100 text-xs font-semibold text-muted uppercase tracking-wide">
              <span>Title</span>
              <span className="text-right">Status</span>
              <span className="text-right">Discipline</span>
              <span className="text-right">Runs</span>
              <span className="text-right">Version</span>
            </div>

            {designs.map((d) => {
              const disc = d.discipline_tags?.[0]
                ? (disciplineMap.get(d.discipline_tags[0]) ?? { name: d.discipline_tags[0], emoji: '' })
                : null

              return (
                <div
                  key={d.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_auto_auto_auto_auto] gap-2 md:gap-4
                             items-center px-5 py-4 border-b border-gray-50 last:border-0
                             hover:bg-gray-50/50 transition-colors"
                >
                  <div className="min-w-0">
                    <Link
                      to={`/designs/${d.id}`}
                      className="text-sm font-medium text-ink hover:underline truncate block"
                      title={d.title}
                    >
                      {d.title}
                    </Link>
                    <p className="text-xs text-muted mt-0.5">
                      {d.difficulty_level} · {d.author_ids.length} author{d.author_ids.length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-2 md:gap-0">
                    <span className="md:hidden text-xs text-muted">Status</span>
                    <StatusBadge status={d.status} />
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-2 md:gap-0">
                    <span className="md:hidden text-xs text-muted">Discipline</span>
                    <span className="text-xs text-ink">
                      {disc ? `${disc.emoji ? disc.emoji + ' ' : ''}${disc.name}` : '—'}
                    </span>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-2 md:gap-0">
                    <span className="md:hidden text-xs text-muted">Runs</span>
                    <span className="text-xs text-ink" style={{ fontFamily: 'var(--font-mono)' }}>
                      {d.execution_count}
                    </span>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-2 md:gap-0">
                    <span className="md:hidden text-xs text-muted">Version</span>
                    <span className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                      v{d.published_version || '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {/* Disciplines modal */}
      {!discLoading && showDisciplines && (
        <ManageDisciplinesModal
          disciplines={disciplines}
          onClose={() => setShowDisciplines(false)}
          onChange={setDisciplines}
        />
      )}
    </div>
  )
}
