import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Design, DifficultyLevel, DesignListResponse } from '../types/design'
import UserDisplayName from '../components/UserDisplayName'

const DIFFICULTY_OPTIONS: DifficultyLevel[] = [
  'Pre-K', 'Elementary', 'Middle School', 'High School',
  'Undergraduate', 'Graduate', 'Professional',
]

export default function Experiments() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [discipline, setDiscipline] = useState('')
  const [difficulty, setDifficulty] = useState('')

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

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Experiments</h1>
        <p className="mt-2 text-gray-600">Browse reproducible scientific experiment designs.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
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
