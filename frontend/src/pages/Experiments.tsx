import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Design, DifficultyLevel, DesignListResponse } from '../types/design'
import UserDisplayName from '../components/UserDisplayName'

interface LabMatches {
  full: Design[]
  partial: Design[]
}

const DIFFICULTY_OPTIONS: DifficultyLevel[] = [
  'Pre-K', 'Elementary', 'Middle School', 'High School',
  'Undergraduate', 'Graduate', 'Professional',
]

export default function Experiments() {
  const { user } = useAuth()

  const [designs, setDesigns] = useState<Design[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [discipline, setDiscipline] = useState('')
  const [difficulty, setDifficulty] = useState('')

  const [labMatches, setLabMatches] = useState<LabMatches>({ full: [], partial: [] })
  const [loadingMatches, setLoadingMatches] = useState(false)

  function buildQuery(after?: string) {
    const params = new URLSearchParams()
    if (discipline) params.set('discipline', discipline)
    if (difficulty) params.set('difficulty', difficulty)
    if (after) params.set('after', after)
    const qs = params.toString()
    return `/api/designs${qs ? `?${qs}` : ''}`
  }

  async function fetchDesigns() {
    setLoading(true)
    try {
      const res = await api.get<DesignListResponse>(buildQuery())
      setDesigns(res.data)
      setCursor(res.data.length === 20 ? res.data[res.data.length - 1]?.id : undefined)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const res = await api.get<DesignListResponse>(buildQuery(cursor))
      setDesigns((prev) => [...prev, ...res.data])
      setCursor(res.data.length === 20 ? res.data[res.data.length - 1]?.id : undefined)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchDesigns()
  }, [discipline, difficulty])

  // Fetch lab-matched designs once on mount (logged-in users only)
  useEffect(() => {
    if (!user) return
    setLoadingMatches(true)
    api
      .get<{ status: string; data: LabMatches }>('/api/lab/matches')
      .then(({ data }) => setLabMatches(data))
      .catch(() => {}) // silently ignore — feature is additive
      .finally(() => setLoadingMatches(false))
  }, [user?.uid])

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Experiments</h1>
        <p className="mt-2 text-gray-600">Browse reproducible scientific experiment designs.</p>
      </div>

      {/* ── Lab-matched discovery (logged-in users only) ── */}
      {user && (loadingMatches || labMatches.full.length > 0 || labMatches.partial.length > 0) && (
        <section className="mb-8 rounded-2xl border border-gray-100 p-5"
          style={{ background: 'var(--color-surface)' }}>
          <div className="flex items-center gap-2 mb-4">
            <span className="text-base">🔬</span>
            <h2 className="text-sm font-bold uppercase tracking-wider"
              style={{ color: 'var(--color-dark)' }}>
              From Your Lab Inventory
            </h2>
          </div>

          {loadingMatches ? (
            <div className="flex items-center gap-2 text-sm py-2"
              style={{ color: 'var(--color-text-muted)' }}>
              <div className="w-4 h-4 border-2 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
              Checking your lab inventory…
            </div>
          ) : (
            <div className="space-y-6">
              {/* Full matches — user has every piece of equipment */}
              {labMatches.full.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}>
                      Ready to run — you have all the equipment
                    </span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}>
                      {labMatches.full.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {labMatches.full.map((d) => <DesignCard key={d.id} design={d} />)}
                  </div>
                </div>
              )}

              {/* Partial matches — user has some equipment */}
              {labMatches.partial.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <span className="w-2 h-2 rounded-full bg-amber-400 shrink-0" />
                    <span className="text-xs font-semibold uppercase tracking-wider"
                      style={{ color: 'var(--color-text-muted)' }}>
                      You have some of the equipment
                    </span>
                    <span className="text-xs font-mono px-1.5 py-0.5 rounded"
                      style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}>
                      {labMatches.partial.length}
                    </span>
                  </div>
                  <div className="space-y-3">
                    {labMatches.partial.map((d) => <DesignCard key={d.id} design={d} />)}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
          className="select-filter"
        >
          <option value="">All disciplines</option>
          <option value="biology">Biology</option>
          <option value="chemistry">Chemistry</option>
          <option value="physics">Physics</option>
          <option value="psychology">Psychology</option>
          <option value="environmental">Environmental Science</option>
          <option value="other">Other</option>
        </select>

        <select
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
          className="select-filter"
        >
          <option value="">All levels</option>
          {DIFFICULTY_OPTIONS.map((d) => (
            <option key={d} value={d}>{d}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : designs.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <div className="text-5xl mb-4">🔬</div>
          <h2 className="text-lg font-semibold text-gray-900">No experiments found</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            Try adjusting your filters or check back soon.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-4">
            {designs.map((design) => (
              <DesignCard key={design.id} design={design} />
            ))}
          </div>

          {cursor && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function DesignCard({ design }: { design: Design }) {
  return (
    // Stretched-link pattern: Link covers the full card; interactive children
    // use relative + z-10 to sit above the overlay and receive their own clicks.
    <div className="card p-5 hover:shadow-md transition-shadow relative">
      <Link
        to={`/designs/${design.id}`}
        className="absolute inset-0 rounded-2xl"
        aria-label={design.title}
      />

      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink leading-snug">{design.title}</h3>
          {design.summary && (
            <p className="mt-1.5 text-sm text-muted line-clamp-2 leading-relaxed">
              {design.summary}
            </p>
          )}
        </div>
        <span className="shrink-0 text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
          {design.difficulty_level}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {design.discipline_tags.map((tag) => (
          <span key={tag} className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>

      {/* Authors — rendered above the stretched link via relative + z-10 */}
      {design.author_ids.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-muted relative z-10">
          <span>by</span>
          {design.author_ids.map((uid, i) => (
            <span key={uid} className="flex items-center gap-1">
              <UserDisplayName uid={uid} className="text-xs" />
              {i < design.author_ids.length - 1 && <span>,</span>}
            </span>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-xs text-muted">
        <span>{design.execution_count} run{design.execution_count !== 1 ? 's' : ''}</span>
        <span>{design.derived_design_count} fork{design.derived_design_count !== 1 ? 's' : ''}</span>
      </div>
    </div>
  )
}
