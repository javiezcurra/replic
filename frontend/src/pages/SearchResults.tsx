/**
 * SearchResults — full-page results for the global search.
 * URL: /search?q=<query>
 *
 * Shows two sections: Experiments and People.
 * Each section loads 20 at a time with an independent "Load more" button.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { UserSearchResult } from '../types/user'
import DesignCard from '../components/DesignCard'
import type { Design } from '../types/design'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SearchDesign {
  id: string
  title: string
  summary: string
  hypothesis?: string
  status: string
  difficulty_level: string
  discipline_tags: string[]
  author_ids: string[]
  execution_count: number
  derived_design_count: number
}

interface SearchResponse {
  status: string
  data: {
    users: UserSearchResult[]
    designs: SearchDesign[]
    total_users: number
    total_designs: number
  }
}

const PAGE_SIZE = 20

// ── Icons ──────────────────────────────────────────────────────────────────────

function UserIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  )
}

function ExperimentIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 3h6m-6 0v7l-4 9a1 1 0 00.9 1.45h12.2A1 1 0 0019 19l-4-9V3m-6 0h6" />
    </svg>
  )
}

// ── User result card ───────────────────────────────────────────────────────────

function UserResultCard({ user }: { user: UserSearchResult }) {
  return (
    <Link
      to={`/users/${user.uid}`}
      className="flex items-center gap-4 bg-white rounded-xl border-2 border-surface-2
                 px-4 py-3.5 hover:border-plum hover:shadow-sm transition-all"
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center shrink-0"
        style={{ background: 'var(--color-accent)' }}
      >
        <span style={{ color: 'var(--color-secondary)' }}>
          <UserIcon className="w-4 h-4" />
        </span>
      </div>
      <div className="min-w-0">
        <p className="font-medium text-sm text-ink truncate">{user.displayName}</p>
        {user.affiliation && (
          <p className="text-xs text-muted truncate">{user.affiliation}</p>
        )}
      </div>
    </Link>
  )
}

// ── Section header ─────────────────────────────────────────────────────────────

function SectionHeader({
  icon,
  label,
  count,
  total,
}: {
  icon: React.ReactNode
  label: string
  count: number
  total: number
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0"
        style={{ background: 'var(--color-dark)', color: 'white' }}
      >
        {icon}
      </div>
      <h2
        className="text-xl font-semibold"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--color-dark)' }}
      >
        {label}
      </h2>
      <span
        className="text-sm font-mono px-2 py-0.5 rounded"
        style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}
      >
        {count} / {total}
      </span>
    </div>
  )
}

// ── Page ───────────────────────────────────────────────────────────────────────

export default function SearchResults() {
  const [searchParams] = useSearchParams()
  const navigate        = useNavigate()
  const initialQuery    = searchParams.get('q') ?? ''

  const [inputValue, setInputValue] = useState(initialQuery)
  const [query, setQuery]           = useState(initialQuery)

  // Designs state
  const [designs, setDesigns]           = useState<SearchDesign[]>([])
  const [totalDesigns, setTotalDesigns] = useState(0)
  const [designsOffset, setDesignsOffset] = useState(0)
  const [loadingMoreDesigns, setLoadingMoreDesigns] = useState(false)

  // Users state
  const [users, setUsers]           = useState<UserSearchResult[]>([])
  const [totalUsers, setTotalUsers] = useState(0)
  const [usersOffset, setUsersOffset] = useState(0)
  const [loadingMoreUsers, setLoadingMoreUsers] = useState(false)

  // Initial loading
  const [loading, setLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Whenever query changes, reset and fetch from scratch
  useEffect(() => {
    if (!query.trim()) {
      setDesigns([]); setUsers([])
      setTotalDesigns(0); setTotalUsers(0)
      setDesignsOffset(0); setUsersOffset(0)
      return
    }
    setLoading(true)
    setDesigns([]); setUsers([])
    setDesignsOffset(0); setUsersOffset(0)

    api.get<SearchResponse>(
      `/api/search?q=${encodeURIComponent(query.trim())}&limit=${PAGE_SIZE}`,
    )
      .then((res) => {
        setDesigns(res.data.designs)
        setTotalDesigns(res.data.total_designs)
        setUsers(res.data.users)
        setTotalUsers(res.data.total_users)
        setDesignsOffset(res.data.designs.length)
        setUsersOffset(res.data.users.length)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [query])

  // Sync URL when query changes
  useEffect(() => {
    if (query.trim()) navigate(`/search?q=${encodeURIComponent(query.trim())}`, { replace: true })
  }, [query]) // eslint-disable-line react-hooks/exhaustive-deps

  async function loadMoreDesigns() {
    setLoadingMoreDesigns(true)
    try {
      const res = await api.get<SearchResponse>(
        `/api/search?q=${encodeURIComponent(query.trim())}&limit=${PAGE_SIZE}&designs_offset=${designsOffset}&users_offset=9999`,
      )
      setDesigns((prev) => [...prev, ...res.data.designs])
      setDesignsOffset((prev) => prev + res.data.designs.length)
    } finally {
      setLoadingMoreDesigns(false)
    }
  }

  async function loadMoreUsers() {
    setLoadingMoreUsers(true)
    try {
      const res = await api.get<SearchResponse>(
        `/api/search?q=${encodeURIComponent(query.trim())}&limit=${PAGE_SIZE}&users_offset=${usersOffset}&designs_offset=9999`,
      )
      setUsers((prev) => [...prev, ...res.data.users])
      setUsersOffset((prev) => prev + res.data.users.length)
    } finally {
      setLoadingMoreUsers(false)
    }
  }

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' && inputValue.trim()) {
      if (debounceRef.current) clearTimeout(debounceRef.current)
      setQuery(inputValue.trim())
    }
  }

  function handleSearchChange(e: React.ChangeEvent<HTMLInputElement>) {
    const v = e.target.value
    setInputValue(v)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      if (v.trim()) setQuery(v.trim())
    }, 400)
  }

  // Cast SearchDesign to Design shape for DesignCard (all required fields present)
  const designsAsDesign = useMemo(
    () => designs.map((d) => d as unknown as Design),
    [designs],
  )

  const hasDesigns = designs.length > 0
  const hasUsers   = users.length > 0
  const hasResults = hasDesigns || hasUsers
  const searched   = query.trim().length > 0

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>

      {/* ── Page header + search bar ─────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Search</p>
        <h1
          className="text-5xl sm:text-6xl text-ink mb-6"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {query.trim() ? `"${query.trim()}"` : 'Find anything'}
        </h1>

        {/* Full search bar */}
        <div className="relative max-w-2xl">
          <svg
            className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400 pointer-events-none"
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
          </svg>
          <input
            type="text"
            value={inputValue}
            onChange={handleSearchChange}
            onKeyDown={handleSearchKeyDown}
            placeholder="Search experiments and people…"
            autoFocus
            className="w-full pl-12 pr-4 py-3 text-base rounded-2xl border-2 border-surface-2
                       bg-white focus:outline-none focus:border-ink transition-colors"
          />
        </div>
      </div>

      {/* ── Results ──────────────────────────────────────────────────────────── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-10">

        {loading ? (
          <div className="flex justify-center py-20">
            <div
              className="w-8 h-8 border-4 rounded-full animate-spin"
              style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        ) : !searched ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-3">🔍</p>
            <p className="text-muted text-sm">Type something to search experiments and people.</p>
          </div>
        ) : !hasResults ? (
          <div className="text-center py-20">
            <p className="text-5xl mb-3">🔬</p>
            <p className="text-muted">No results for "{query}".</p>
            <p className="text-muted text-sm mt-1">Try a different keyword.</p>
          </div>
        ) : (
          <>
            {/* Experiments */}
            {hasDesigns && (
              <section>
                <SectionHeader
                  icon={<ExperimentIcon className="w-4 h-4" />}
                  label="Experiments"
                  count={designs.length}
                  total={totalDesigns}
                />
                <div className="bg-white rounded-2xl border border-gray-100 p-4 space-y-2">
                  {designsAsDesign.map((d) => (
                    <DesignCard key={d.id} design={d} compact />
                  ))}
                </div>
                {designs.length < totalDesigns && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={loadMoreDesigns}
                      disabled={loadingMoreDesigns}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                                 border-2 border-surface-2 bg-white text-ink hover:border-ink
                                 transition-all disabled:opacity-50"
                    >
                      {loadingMoreDesigns ? 'Loading…' : `Load more experiments (${totalDesigns - designs.length} remaining)`}
                    </button>
                  </div>
                )}
              </section>
            )}

            {/* People */}
            {hasUsers && (
              <section>
                <SectionHeader
                  icon={<UserIcon className="w-4 h-4" />}
                  label="People"
                  count={users.length}
                  total={totalUsers}
                />
                <div className="space-y-2">
                  {users.map((u) => (
                    <UserResultCard key={u.uid} user={u} />
                  ))}
                </div>
                {users.length < totalUsers && (
                  <div className="mt-4 text-center">
                    <button
                      onClick={loadMoreUsers}
                      disabled={loadingMoreUsers}
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-medium
                                 border-2 border-surface-2 bg-white text-ink hover:border-ink
                                 transition-all disabled:opacity-50"
                    >
                      {loadingMoreUsers ? 'Loading…' : `Load more people (${totalUsers - users.length} remaining)`}
                    </button>
                  </div>
                )}
              </section>
            )}
          </>
        )}
      </div>
    </div>
  )
}
