/**
 * AdminExperiments — Admin Panel page for viewing all platform experiments
 * and managing disciplines.
 */
import { useEffect, useMemo, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import type { Design } from '../types/design'
import { useDisciplines } from '../hooks/useDisciplines'
import ManageDisciplinesModal from '../components/ManageDisciplinesModal'
import DesignCard from '../components/DesignCard'

// ── Types ─────────────────────────────────────────────────────────────────────

interface AdminDesignsResponse {
  status: string
  data: Design[]
  total: number
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminExperiments() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { disciplines, loading: discLoading, setDisciplines } = useDisciplines()

  const [designs, setDesigns]                   = useState<Design[]>([])
  const [total, setTotal]                       = useState(0)
  const [loading, setLoading]                   = useState(true)
  const [showDisciplines, setShowDisciplines]   = useState(false)
  const [searchQuery, setSearchQuery]           = useState('')

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

  const filteredDesigns = useMemo(() => {
    const q = searchQuery.toLowerCase().trim()
    if (!q) return designs
    return designs.filter(
      (d) =>
        d.title.toLowerCase().includes(q) ||
        d.summary?.toLowerCase().includes(q) ||
        d.hypothesis?.toLowerCase().includes(q),
    )
  }, [designs, searchQuery])

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

      {/* Two-column content area */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">

          {/* ── Left column: experiment list (2/3 width) ─────────────────────── */}
          <div className="lg:col-span-2">

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

            {/* Search bar */}
            <div className="relative mb-4">
              <svg
                className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
              </svg>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search by title, summary, or hypothesis…"
                className="w-full pl-10 pr-4 py-2.5 text-sm rounded-xl border-2 border-surface-2
                           bg-white focus:outline-none focus:border-ink transition-colors"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400
                             hover:text-gray-600 transition-colors"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              )}
            </div>

            {/* Cards — wrapped in white container for contrast */}
            {loading ? (
              <div className="flex justify-center py-24">
                <div
                  className="w-8 h-8 border-4 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                />
              </div>
            ) : filteredDesigns.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-5xl mb-3">🔬</p>
                <p className="text-muted text-sm">
                  {searchQuery ? `No experiments match "${searchQuery}".` : 'No experiments yet.'}
                </p>
              </div>
            ) : (
              <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                {filteredDesigns.map((d) => (
                  <DesignCard key={d.id} design={d} compact />
                ))}
              </div>
            )}
          </div>

          {/* ── Right column: reserved for future features ────────────────────── */}
          <div className="hidden lg:block" />

        </div>
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
