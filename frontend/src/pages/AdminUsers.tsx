/**
 * AdminUsers — Admin Panel page for managing platform users and admins.
 * Left column: current admins (with Revoke Admin).
 * Right column: all users paginated (25/page), searchable, with Make Admin.
 * Users cannot change their own admin status.
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'
import type { UserProfileResponse } from '../types/user'

// ── Types ─────────────────────────────────────────────────────────────────────

interface UsersListResponse {
  status: string
  data: UserProfileResponse[]
  total: number
  page: number
  totalPages: number
}

interface AdminsListResponse {
  status: string
  data: UserProfileResponse[]
  total: number
}

// ── Confirmation modal ────────────────────────────────────────────────────────

function ConfirmModal({
  title,
  body,
  confirmLabel,
  confirmStyle,
  onConfirm,
  onCancel,
}: {
  title: string
  body: string
  confirmLabel: string
  confirmStyle: 'danger' | 'primary'
  onConfirm: () => void
  onCancel: () => void
}) {
  useEffect(() => {
    function handleKey(e: KeyboardEvent) { if (e.key === 'Escape') onCancel() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onCancel])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-sm shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-lg font-semibold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
          {title}
        </h3>
        <p className="text-sm text-muted leading-relaxed">{body}</p>
        <div className="flex gap-3 justify-end pt-1">
          <button
            onClick={onCancel}
            className="px-4 py-2 rounded-xl text-sm font-medium border-2 border-surface-2 text-ink
                       hover:border-ink transition-all"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className="px-4 py-2 rounded-xl text-sm font-semibold text-white hover:opacity-90 transition-all"
            style={{ background: confirmStyle === 'danger' ? '#dc2626' : 'var(--color-primary)' }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

// ── UserRow ───────────────────────────────────────────────────────────────────

function UserRow({
  user,
  isSelf,
  actionLabel,
  actionStyle,
  onAction,
  acting,
}: {
  user: UserProfileResponse
  isSelf: boolean
  actionLabel: string
  actionStyle: 'danger' | 'primary'
  onAction: (uid: string) => void
  acting: boolean
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
      {user.photoURL ? (
        <img src={user.photoURL} alt="" className="w-8 h-8 rounded-full shrink-0 object-cover" />
      ) : (
        <div
          className="w-8 h-8 rounded-full shrink-0 flex items-center justify-center text-white text-xs font-bold"
          style={{ background: 'var(--color-secondary)' }}
        >
          {user.displayName.charAt(0).toUpperCase()}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-ink truncate">{user.displayName}</p>
        <p className="text-xs text-muted truncate">{user.email}</p>
      </div>
      {isSelf ? (
        <span className="text-xs text-muted italic shrink-0">you</span>
      ) : (
        <button
          onClick={() => onAction(user.uid)}
          disabled={acting}
          className="shrink-0 px-3 py-1.5 rounded-lg text-xs font-semibold border-2 transition-all
                     disabled:opacity-40"
          style={
            actionStyle === 'danger'
              ? { borderColor: '#dc2626', color: '#dc2626' }
              : { borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }
          }
        >
          {actionLabel}
        </button>
      )}
    </div>
  )
}

// ── Page ─────────────────────────────────────────────────────────────────────

export default function AdminUsers() {
  const { user, isAdmin, loading: authLoading } = useAuth()

  const [admins, setAdmins]               = useState<UserProfileResponse[]>([])
  const [adminsTotal, setAdminsTotal]     = useState(0)
  const [adminsLoading, setAdminsLoading] = useState(true)

  const [allUsers, setAllUsers]           = useState<UserProfileResponse[]>([])
  const [usersTotal, setUsersTotal]       = useState(0)
  const [usersPage, setUsersPage]         = useState(1)
  const [usersPages, setUsersPages]       = useState(1)
  const [usersLoading, setUsersLoading]   = useState(true)
  const [search, setSearch]               = useState('')
  const [searchInput, setSearchInput]     = useState('')
  const searchTimer                       = useRef<ReturnType<typeof setTimeout>>()

  const [confirm, setConfirm] = useState<{
    uid: string
    displayName: string
    action: 'make' | 'revoke'
  } | null>(null)
  const [acting, setActing] = useState(false)
  const [error, setError]   = useState('')

  // ── Fetchers ───────────────────────────────────────────────────────────────

  const fetchAdmins = useCallback(async () => {
    setAdminsLoading(true)
    try {
      const res = await api.get<AdminsListResponse>('/api/admin/users/admins')
      setAdmins(res.data)
      setAdminsTotal(res.total)
    } finally {
      setAdminsLoading(false)
    }
  }, [])

  const fetchUsers = useCallback(async (page: number, q: string) => {
    setUsersLoading(true)
    try {
      const params = new URLSearchParams({ page: String(page) })
      if (q) params.set('q', q)
      const res = await api.get<UsersListResponse>(`/api/admin/users?${params}`)
      setAllUsers(res.data)
      setUsersTotal(res.total)
      setUsersPage(res.page)
      setUsersPages(res.totalPages)
    } finally {
      setUsersLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAdmin) {
      fetchAdmins()
      fetchUsers(1, '')
    }
  }, [isAdmin, fetchAdmins, fetchUsers])

  // Debounced search
  function handleSearchChange(val: string) {
    setSearchInput(val)
    clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(() => {
      setSearch(val)
      fetchUsers(1, val)
    }, 350)
  }

  function handlePageChange(newPage: number) {
    fetchUsers(newPage, search)
  }

  // ── Actions ────────────────────────────────────────────────────────────────

  async function handleConfirm() {
    if (!confirm) return
    setActing(true); setError('')
    try {
      const endpoint =
        confirm.action === 'make'
          ? `/api/admin/users/${confirm.uid}/make-admin`
          : `/api/admin/users/${confirm.uid}/revoke-admin`
      await api.patch(endpoint)
      // Refresh both lists
      await Promise.all([fetchAdmins(), fetchUsers(usersPage, search)])
      setConfirm(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed')
    } finally {
      setActing(false)
    }
  }

  // ── Guard ──────────────────────────────────────────────────────────────────

  if (!authLoading && (!user || !isAdmin)) {
    return <Navigate to="/" replace />
  }

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
          Users
        </h1>
        <p className="mt-2 text-lg text-plum max-w-sm">
          Manage admins and all platform users.{' '}
          <span className="text-muted text-base">Only you can see this.</span>
        </p>
      </div>

      {error && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-4">
          <p className="text-sm text-red-600 bg-red-50 px-4 py-3 rounded-xl">{error}</p>
        </div>
      )}

      {/* Two-column layout */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-start">

          {/* ── Left: Admins ────────────────────────────────────────────── */}
          <div>
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
                      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618
                         3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03
                         9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                  </svg>
                </div>
                <div>
                  <h2
                    className="text-2xl font-semibold text-white"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Admins
                  </h2>
                  <p className="text-white/60 text-sm">Platform administrators</p>
                </div>
              </div>
              <span
                className="text-white/40 text-3xl font-semibold tabular-nums shrink-0"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {adminsTotal}
              </span>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {adminsLoading ? (
                <div className="flex justify-center py-12">
                  <div
                    className="w-6 h-6 border-4 rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                  />
                </div>
              ) : admins.length === 0 ? (
                <p className="text-sm text-muted text-center py-10">No admins found.</p>
              ) : (
                admins.map((u) => (
                  <UserRow
                    key={u.uid}
                    user={u}
                    isSelf={u.uid === user?.uid}
                    actionLabel="Revoke Admin"
                    actionStyle="danger"
                    onAction={(uid) =>
                      setConfirm({ uid, displayName: u.displayName, action: 'revoke' })
                    }
                    acting={acting}
                  />
                ))
              )}
            </div>
          </div>

          {/* ── Right: All Users ─────────────────────────────────────────── */}
          <div>
            <div
              className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4 mb-4"
              style={{ background: 'var(--color-primary)' }}
            >
              <div className="flex items-center gap-4">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{ background: 'rgba(255,255,255,0.12)' }}
                >
                  <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                      d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857
                         M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002
                         5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014
                         0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                </div>
                <div>
                  <h2
                    className="text-2xl font-semibold text-white"
                    style={{ fontFamily: 'var(--font-display)' }}
                  >
                    Replic Users
                  </h2>
                  <p className="text-white/60 text-sm">All registered accounts</p>
                </div>
              </div>
              <span
                className="text-white/40 text-3xl font-semibold tabular-nums shrink-0"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {usersTotal}
              </span>
            </div>

            {/* Search */}
            <div className="mb-3">
              <div className="relative">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                </svg>
                <input
                  type="text"
                  value={searchInput}
                  onChange={(e) => handleSearchChange(e.target.value)}
                  placeholder="Search by name or email…"
                  className="w-full input-sm pl-9"
                />
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {usersLoading ? (
                <div className="flex justify-center py-12">
                  <div
                    className="w-6 h-6 border-4 rounded-full animate-spin"
                    style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                  />
                </div>
              ) : allUsers.length === 0 ? (
                <p className="text-sm text-muted text-center py-10">
                  {search ? `No users matching "${search}".` : 'No users found.'}
                </p>
              ) : (
                allUsers.map((u) => (
                  <UserRow
                    key={u.uid}
                    user={u}
                    isSelf={u.uid === user?.uid}
                    actionLabel="Make Admin"
                    actionStyle="primary"
                    onAction={(uid) =>
                      setConfirm({ uid, displayName: u.displayName, action: 'make' })
                    }
                    acting={acting}
                  />
                ))
              )}
            </div>

            {/* Pagination */}
            {usersPages > 1 && (
              <div className="mt-4 flex items-center justify-center gap-2">
                <button
                  onClick={() => handlePageChange(usersPage - 1)}
                  disabled={usersPage <= 1 || usersLoading}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border-2 border-surface-2
                             text-ink hover:border-ink transition-all disabled:opacity-40"
                >
                  Previous
                </button>
                <span className="text-sm text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
                  {usersPage} / {usersPages}
                </span>
                <button
                  onClick={() => handlePageChange(usersPage + 1)}
                  disabled={usersPage >= usersPages || usersLoading}
                  className="px-3 py-1.5 rounded-lg text-sm font-medium border-2 border-surface-2
                             text-ink hover:border-ink transition-all disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Confirmation modal */}
      {confirm && (
        <ConfirmModal
          title={confirm.action === 'make' ? 'Grant Admin privileges?' : 'Revoke Admin privileges?'}
          body={
            confirm.action === 'make'
              ? `You are about to make ${confirm.displayName} a platform Admin. Admins have elevated permissions — they can manage users, materials, disciplines, and other platform settings. This action can be reversed.`
              : `You are about to revoke Admin privileges from ${confirm.displayName}. They will lose access to all Admin Panel features immediately.`
          }
          confirmLabel={confirm.action === 'make' ? 'Grant Admin' : 'Revoke Admin'}
          confirmStyle={confirm.action === 'make' ? 'primary' : 'danger'}
          onConfirm={handleConfirm}
          onCancel={() => setConfirm(null)}
        />
      )}
    </div>
  )
}
