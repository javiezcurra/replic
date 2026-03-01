/**
 * AdminLedger — Admin Panel page showing the contribution scoring ledger.
 *
 * Displays up to 500 most recent ledger entries, most recent first.
 * Filters (user name, event type, experiment name) are applied client-side
 * on the already-fetched data for instant feedback.
 */
import { useEffect, useMemo, useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import type { UserPublicProfile } from '../types/user'
import UserProfileModal from '../components/UserProfileModal'

// ── Types ──────────────────────────────────────────────────────────────────────

type LedgerEventType =
  | 'DESIGN_PUBLISHED'
  | 'DESIGN_ENDORSED'
  | 'DESIGN_REFERENCED_BY_DESIGN'
  | 'DESIGN_DERIVED_CREATED'
  | 'DESIGN_REVIEW_SUBMITTED'
  | 'REVIEW_SUGGESTION_ACCEPTED_ON_DESIGN'
  | 'DESIGN_VERSION_PUBLISHED_WITH_ACCEPTED_SUGGESTION'
  | 'SAFETY_SUGGESTION_ACCEPTED'

interface LedgerEntryRow {
  id: string
  user_id: string
  user_display_name: string | null
  event_type: LedgerEventType
  created_at: string
  design_id?: string
  design_title?: string | null
  design_version?: number
  review_id?: string
  suggestion_id?: string
  referencing_design_id?: string
  fork_design_id?: string
}

interface LedgerResponse {
  status: string
  data: LedgerEntryRow[]
  total: number
}

// ── Event type config ──────────────────────────────────────────────────────────

const EVENT_CONFIG: Record<LedgerEventType, { label: string; bg: string; text: string }> = {
  DESIGN_PUBLISHED:                              { label: 'Published',          bg: '#dcfce7', text: '#15803d' },
  DESIGN_ENDORSED:                               { label: 'Endorsed',           bg: '#ccfbf1', text: '#0f766e' },
  DESIGN_REFERENCED_BY_DESIGN:                   { label: 'Referenced',         bg: '#dbeafe', text: '#1d4ed8' },
  DESIGN_DERIVED_CREATED:                        { label: 'Derived',            bg: '#ede9fe', text: '#7c3aed' },
  DESIGN_REVIEW_SUBMITTED:                       { label: 'Review',             bg: '#fef3c7', text: '#b45309' },
  REVIEW_SUGGESTION_ACCEPTED_ON_DESIGN:          { label: 'Suggestion Accepted',bg: '#ffedd5', text: '#c2410c' },
  DESIGN_VERSION_PUBLISHED_WITH_ACCEPTED_SUGGESTION: { label: 'Version + Suggestion', bg: '#f0fdf4', text: '#166534' },
  SAFETY_SUGGESTION_ACCEPTED:                    { label: 'Safety Suggestion',  bg: '#fee2e2', text: '#b91c1c' },
}

const ALL_EVENT_TYPES = Object.keys(EVENT_CONFIG) as LedgerEventType[]

// ── Spinner ───────────────────────────────────────────────────────────────────

function Spinner() {
  return (
    <div className="flex justify-center py-20">
      <div
        className="w-8 h-8 border-4 rounded-full animate-spin"
        style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
      />
    </div>
  )
}

// ── Event badge ───────────────────────────────────────────────────────────────

function EventBadge({ type }: { type: LedgerEventType }) {
  const cfg = EVENT_CONFIG[type] ?? { label: type, bg: '#f3f4f6', text: '#374151' }
  return (
    <span
      className="inline-block text-xs font-semibold px-2 py-0.5 rounded-full whitespace-nowrap"
      style={{ background: cfg.bg, color: cfg.text }}
    >
      {cfg.label}
    </span>
  )
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function AdminLedger() {
  const { user, isAdmin, loading: authLoading } = useAuth()

  const [entries, setEntries]   = useState<LedgerEntryRow[]>([])
  const [total, setTotal]       = useState(0)
  const [loading, setLoading]   = useState(true)

  // Filters (client-side)
  const [filterUser,    setFilterUser]    = useState('')
  const [filterEvent,   setFilterEvent]   = useState<LedgerEventType | ''>('')
  const [filterDesign,  setFilterDesign]  = useState('')

  // User profile modal
  const [profileModal, setProfileModal]         = useState<UserPublicProfile | null>(null)
  const [loadingProfile, setLoadingProfile]     = useState<string | null>(null) // uid being loaded

  useEffect(() => {
    if (!isAdmin) return
    setLoading(true)
    api.get<LedgerResponse>('/api/admin/ledger')
      .then((res) => {
        setEntries(res.data)
        setTotal(res.total)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [isAdmin])

  const filtered = useMemo(() => {
    let rows = entries
    if (filterUser.trim()) {
      const q = filterUser.trim().toLowerCase()
      rows = rows.filter((e) => (e.user_display_name ?? e.user_id).toLowerCase().includes(q))
    }
    if (filterEvent) {
      rows = rows.filter((e) => e.event_type === filterEvent)
    }
    if (filterDesign.trim()) {
      const q = filterDesign.trim().toLowerCase()
      rows = rows.filter((e) => (e.design_title ?? e.design_id ?? '').toLowerCase().includes(q))
    }
    return rows
  }, [entries, filterUser, filterEvent, filterDesign])

  async function openProfile(uid: string) {
    if (loadingProfile === uid) return
    setLoadingProfile(uid)
    try {
      const res = await api.get<{ status: string; data: UserPublicProfile }>(`/api/users/${uid}`)
      setProfileModal(res.data)
    } catch {
      // silently ignore — user may have been deleted
    } finally {
      setLoadingProfile(null)
    }
  }

  function formatDate(iso: string) {
    const d = new Date(iso)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
      + ' · '
      + d.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!authLoading && (!user || !isAdmin)) return <Navigate to="/" replace />

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>

      {/* Page header */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-8">
        <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">Admin Panel</p>
        <h1
          className="text-5xl sm:text-6xl text-ink"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          Contributions Ledger
        </h1>
        <p className="mt-2 text-lg text-plum max-w-sm">
          Scoring events across the platform.{' '}
          <span className="text-muted text-base">Only you can see this.</span>
        </p>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-4">

        {/* Stats bar */}
        <div
          className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4"
          style={{ background: 'var(--color-dark)' }}
        >
          <div className="flex items-center gap-4">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
              style={{ background: 'rgba(255,255,255,0.12)' }}
            >
              {/* Ledger icon */}
              <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2
                     2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4" />
              </svg>
            </div>
            <div>
              <h2 className="text-2xl font-semibold text-white" style={{ fontFamily: 'var(--font-display)' }}>
                Ledger Entries
              </h2>
              <p className="text-white/60 text-sm">
                {loading ? 'Loading…' : `${filtered.length} of ${total} shown`}
              </p>
            </div>
          </div>
          <span
            className="text-white/40 text-3xl font-semibold tabular-nums shrink-0"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            {total}
          </span>
        </div>

        {/* Filters */}
        <div className="bg-white rounded-2xl border border-gray-100 px-5 py-4">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

            {/* User filter */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              <input
                type="text"
                value={filterUser}
                onChange={(e) => setFilterUser(e.target.value)}
                placeholder="Filter by user…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border-2 border-surface-2
                           bg-gray-50 focus:bg-white focus:border-ink focus:outline-none transition-colors"
              />
            </div>

            {/* Event type filter */}
            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value as LedgerEventType | '')}
              className="w-full px-3 py-2 text-sm rounded-xl border-2 border-surface-2
                         bg-gray-50 focus:bg-white focus:border-ink focus:outline-none transition-colors"
            >
              <option value="">All event types</option>
              {ALL_EVENT_TYPES.map((t) => (
                <option key={t} value={t}>{EVENT_CONFIG[t].label}</option>
              ))}
            </select>

            {/* Design filter */}
            <div className="relative">
              <svg
                className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
                fill="none" stroke="currentColor" viewBox="0 0 24 24"
              >
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                  d="M9 3h6m-6 0v7l-4 9a1 1 0 00.9 1.45h12.2A1 1 0 0019 19l-4-9V3m-6 0h6" />
              </svg>
              <input
                type="text"
                value={filterDesign}
                onChange={(e) => setFilterDesign(e.target.value)}
                placeholder="Filter by experiment…"
                className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border-2 border-surface-2
                           bg-gray-50 focus:bg-white focus:border-ink focus:outline-none transition-colors"
              />
            </div>
          </div>

          {/* Clear filters */}
          {(filterUser || filterEvent || filterDesign) && (
            <div className="mt-3 flex justify-end">
              <button
                onClick={() => { setFilterUser(''); setFilterEvent(''); setFilterDesign('') }}
                className="text-xs font-medium text-muted hover:text-ink transition-colors"
              >
                Clear filters
              </button>
            </div>
          )}
        </div>

        {/* Entries list */}
        <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
          {loading ? (
            <Spinner />
          ) : filtered.length === 0 ? (
            <p className="text-sm text-muted text-center py-16">
              {entries.length === 0 ? 'No ledger entries yet.' : 'No entries match the current filters.'}
            </p>
          ) : (
            <div className="divide-y divide-gray-50">
              {filtered.map((entry) => (
                <EntryRow
                  key={entry.id}
                  entry={entry}
                  loadingProfileUid={loadingProfile}
                  onOpenProfile={openProfile}
                  formatDate={formatDate}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* User profile modal */}
      {profileModal && (
        <UserProfileModal
          profile={profileModal}
          onClose={() => setProfileModal(null)}
        />
      )}
    </div>
  )
}

// ── EntryRow ──────────────────────────────────────────────────────────────────

function EntryRow({
  entry,
  loadingProfileUid,
  onOpenProfile,
  formatDate,
}: {
  entry: LedgerEntryRow
  loadingProfileUid: string | null
  onOpenProfile: (uid: string) => void
  formatDate: (iso: string) => string
}) {
  const displayName = entry.user_display_name ?? entry.user_id
  const isLoadingThis = loadingProfileUid === entry.user_id

  return (
    <div className="flex flex-col sm:flex-row sm:items-start gap-2 sm:gap-4 px-5 py-4">

      {/* Timestamp */}
      <span
        className="shrink-0 text-xs text-muted tabular-nums mt-0.5 sm:w-44"
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {formatDate(entry.created_at)}
      </span>

      {/* Badge */}
      <div className="shrink-0 sm:w-44">
        <EventBadge type={entry.event_type} />
      </div>

      {/* Main content */}
      <div className="flex-1 min-w-0 space-y-1">

        {/* User */}
        <div className="flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
              d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
          <button
            onClick={() => onOpenProfile(entry.user_id)}
            disabled={isLoadingThis}
            className="text-sm font-medium transition-colors hover:underline disabled:opacity-50"
            style={{ color: 'var(--color-primary)' }}
          >
            {isLoadingThis ? 'Loading…' : displayName}
          </button>
        </div>

        {/* Design */}
        {entry.design_id && (
          <div className="flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-muted shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.75}
                d="M9 3h6m-6 0v7l-4 9a1 1 0 00.9 1.45h12.2A1 1 0 0019 19l-4-9V3m-6 0h6" />
            </svg>
            <Link
              to={`/designs/${entry.design_id}`}
              className="text-sm transition-colors hover:underline truncate"
              style={{ color: 'var(--color-secondary)' }}
            >
              {entry.design_title ?? entry.design_id}
            </Link>
            {entry.design_version !== undefined && (
              <span className="text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                v{entry.design_version}
              </span>
            )}
          </div>
        )}

        {/* Extra context chips */}
        <div className="flex flex-wrap gap-1.5 pt-0.5">
          {entry.referencing_design_id && (
            <Link
              to={`/designs/${entry.referencing_design_id}`}
              className="text-xs px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
              style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}
            >
              cited by {entry.referencing_design_id.slice(0, 8)}…
            </Link>
          )}
          {entry.fork_design_id && (
            <Link
              to={`/designs/${entry.fork_design_id}`}
              className="text-xs px-2 py-0.5 rounded-full hover:opacity-80 transition-opacity"
              style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}
            >
              fork {entry.fork_design_id.slice(0, 8)}…
            </Link>
          )}
          {entry.review_id && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#f3f4f6', color: '#6b7280', fontFamily: 'var(--font-mono)' }}
            >
              review {entry.review_id.slice(0, 8)}…
            </span>
          )}
          {entry.suggestion_id && (
            <span
              className="text-xs px-2 py-0.5 rounded-full"
              style={{ background: '#f3f4f6', color: '#6b7280', fontFamily: 'var(--font-mono)' }}
            >
              suggestion {entry.suggestion_id.slice(0, 8)}…
            </span>
          )}
        </div>
      </div>
    </div>
  )
}
