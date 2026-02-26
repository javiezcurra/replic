import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Design, DifficultyLevel, DesignListResponse } from '../types/design'

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
    <Link
      to={`/designs/${design.id}`}
      className="block card p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <h3 className="font-semibold text-gray-900 truncate">{design.title}</h3>
          <p className="mt-1 text-sm text-gray-600 line-clamp-2">{design.hypothesis}</p>
        </div>
        <span className="shrink-0 text-xs font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full">
          {design.difficulty_level}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {design.discipline_tags.map((tag) => (
          <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>

      <div className="mt-3 flex items-center gap-4 text-xs text-gray-400">
        <span>{design.execution_count} execution{design.execution_count !== 1 ? 's' : ''}</span>
        <span>{design.derived_design_count} fork{design.derived_design_count !== 1 ? 's' : ''}</span>
      </div>
    </Link>
  )
}
