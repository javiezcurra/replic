/**
 * NavSearch — global search bar for the navbar.
 *
 * - Debounced live search (300 ms) showing up to 5 users + 5 designs in a dropdown.
 * - Press Enter → navigates to /search?q=<query> for full results.
 * - Click a result → navigates directly to that item.
 * - Click outside or press Escape → closes the dropdown.
 */
import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { UserSearchResult } from '../types/user'

// ── Types ──────────────────────────────────────────────────────────────────────

interface SearchDesign {
  id: string
  title: string
  status: string
  difficulty_level: string
  discipline_tags: string[]
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

type ResultItem =
  | { kind: 'user';   item: UserSearchResult }
  | { kind: 'design'; item: SearchDesign }

// ── Icons ──────────────────────────────────────────────────────────────────────

function UserIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2M12 11a4 4 0 100-8 4 4 0 000 8z" />
    </svg>
  )
}

function ExperimentIcon() {
  return (
    <svg className="w-4 h-4 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
        d="M9 3h6m-6 0v7l-4 9a1 1 0 00.9 1.45h12.2A1 1 0 0019 19l-4-9V3m-6 0h6" />
    </svg>
  )
}

// ── Component ──────────────────────────────────────────────────────────────────

export default function NavSearch() {
  const navigate = useNavigate()
  const [query, setQuery]       = useState('')
  const [results, setResults]   = useState<ResultItem[]>([])
  const [loading, setLoading]   = useState(false)
  const [open, setOpen]         = useState(false)
  const containerRef            = useRef<HTMLDivElement>(null)
  const inputRef                = useRef<HTMLInputElement>(null)
  const debounceRef             = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Fetch results, debounced
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setResults([]); setOpen(false); setLoading(false); return }

    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await api.get<SearchResponse>(`/api/search?q=${encodeURIComponent(q)}&limit=5`)
        const items: ResultItem[] = [
          ...res.data.users.map((u): ResultItem => ({ kind: 'user',   item: u })),
          ...res.data.designs.map((d): ResultItem => ({ kind: 'design', item: d })),
        ]
        setResults(items)
        setOpen(items.length > 0)
      } catch {
        setResults([])
      } finally {
        setLoading(false)
      }
    }, 300)

    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
    if (e.key === 'Enter' && query.trim()) {
      setOpen(false)
      navigate(`/search?q=${encodeURIComponent(query.trim())}`)
    }
  }

  function handleResultClick() {
    setOpen(false)
    setQuery('')
  }

  const hasMore = results.length > 0

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Input */}
      <div className="relative">
        <svg
          className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none"
          fill="none" stroke="currentColor" viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
            d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
        </svg>
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          onFocus={() => { if (results.length > 0) setOpen(true) }}
          placeholder="Search experiments & people…"
          className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-gray-200
                     bg-gray-50 focus:bg-white focus:border-gray-300 focus:outline-none
                     transition-colors placeholder:text-gray-400"
        />
        {loading && (
          <div className="absolute right-2.5 top-1/2 -translate-y-1/2">
            <div
              className="w-3 h-3 border-2 rounded-full animate-spin"
              style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
            />
          </div>
        )}
      </div>

      {/* Dropdown */}
      {open && hasMore && (
        <div
          className="absolute top-full left-0 right-0 mt-1.5 bg-white rounded-xl shadow-xl
                     border border-gray-100 overflow-hidden z-50"
        >
          {results.map((r, idx) =>
            r.kind === 'user' ? (
              <Link
                key={`u-${r.item.uid}`}
                to={`/users/${r.item.uid}`}
                onClick={handleResultClick}
                className={`flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50
                            transition-colors text-left ${idx > 0 ? 'border-t border-gray-50' : ''}`}
              >
                <span style={{ color: 'var(--color-secondary)' }}>
                  <UserIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{r.item.displayName}</p>
                  {r.item.affiliation && (
                    <p className="text-xs text-muted truncate">{r.item.affiliation}</p>
                  )}
                </div>
              </Link>
            ) : (
              <Link
                key={`d-${r.item.id}`}
                to={`/designs/${r.item.id}`}
                onClick={handleResultClick}
                className={`flex items-center gap-3 px-3 py-2.5 hover:bg-gray-50
                            transition-colors text-left ${idx > 0 ? 'border-t border-gray-50' : ''}`}
              >
                <span style={{ color: 'var(--color-primary)' }}>
                  <ExperimentIcon />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-ink truncate">{r.item.title}</p>
                  <p className="text-xs text-muted truncate">{r.item.difficulty_level}</p>
                </div>
              </Link>
            ),
          )}

          {/* See all results */}
          <div className="border-t border-gray-100">
            <Link
              to={`/search?q=${encodeURIComponent(query.trim())}`}
              onClick={handleResultClick}
              className="flex items-center justify-center gap-1.5 w-full px-3 py-2.5
                         text-xs font-medium transition-colors hover:bg-gray-50"
              style={{ color: 'var(--color-primary)' }}
            >
              See all results for "{query.trim()}"
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
