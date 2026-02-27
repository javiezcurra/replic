import { useEffect, useRef, useState } from 'react'
import { api } from '../lib/api'
import { fetchUserProfile } from '../lib/userProfileCache'
import type {
  CollaborationRequestWithSender,
  CollaboratorEntry,
  UserPublicProfile,
  UserRelationship,
  UserSearchResult,
} from '../types/user'
import { USER_ROLE_LABELS } from '../types/user'
import UserProfileModal from '../components/UserProfileModal'

// Per-search-result relationship state
type SearchItemState = 'none' | 'pending' | 'collaborator'

interface SearchItemWithState extends UserSearchResult {
  relState: SearchItemState
  pendingRequestId: string | null
}

function InitialsAvatar({ name, size = 'md' }: { name: string; size?: 'sm' | 'md' }) {
  const cls = size === 'sm'
    ? 'w-8 h-8 text-xs'
    : 'w-10 h-10 text-sm'
  return (
    <div
      className={`${cls} rounded-full flex items-center justify-center text-white font-bold shrink-0`}
      style={{ background: 'var(--color-dark)' }}
    >
      {name?.[0]?.toUpperCase() ?? '?'}
    </div>
  )
}

function RoleLabel({ role }: { role: string | null }) {
  if (!role) return null
  return (
    <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
      {USER_ROLE_LABELS[role as keyof typeof USER_ROLE_LABELS] ?? role}
    </span>
  )
}

export default function Collaborators() {
  const [query, setQuery] = useState('')
  const [searchResults, setSearchResults] = useState<SearchItemWithState[]>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const [requests, setRequests] = useState<CollaborationRequestWithSender[]>([])
  const [requestsLoading, setRequestsLoading] = useState(true)
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null)

  const [collaborators, setCollaborators] = useState<CollaboratorEntry[]>([])
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(true)

  const [modalProfile, setModalProfile] = useState<UserPublicProfile | null>(null)

  // Load initial data
  useEffect(() => {
    api
      .get<{ status: string; data: CollaborationRequestWithSender[] }>('/api/users/me/collaboration-requests')
      .then((res) => setRequests(res.data))
      .catch(() => {})
      .finally(() => setRequestsLoading(false))

    api
      .get<{ status: string; data: CollaboratorEntry[] }>('/api/users/me/collaborators')
      .then((res) => setCollaborators(res.data))
      .catch(() => {})
      .finally(() => setCollaboratorsLoading(false))
  }, [])

  // Debounced search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!query.trim()) {
      setSearchResults([])
      return
    }
    debounceRef.current = setTimeout(async () => {
      setSearchLoading(true)
      try {
        const [searchRes, colRes] = await Promise.all([
          api.get<{ status: string; data: UserSearchResult[] }>(`/api/users/search?q=${encodeURIComponent(query.trim())}`),
          api.get<{ status: string; data: CollaboratorEntry[] }>('/api/users/me/collaborators'),
        ])
        const collaboratorUids = new Set(colRes.data.map(c => c.uid))
        const pendingUids = new Set(requests.map(r => r.fromUid))

        const enriched: SearchItemWithState[] = await Promise.all(
          searchRes.data.map(async (u) => {
            if (collaboratorUids.has(u.uid)) {
              return { ...u, relState: 'collaborator' as SearchItemState, pendingRequestId: null }
            }
            // Check relationship for anyone not obviously a collaborator
            try {
              const rel = await api.get<{ status: string; data: UserRelationship }>(`/api/users/${u.uid}/relationship`)
              const r = rel.data
              if (r.isCollaborator) return { ...u, relState: 'collaborator' as SearchItemState, pendingRequestId: null }
              if (r.pendingDirection === 'outgoing') return { ...u, relState: 'pending' as SearchItemState, pendingRequestId: r.pendingRequestId }
            } catch {
              // fallback
            }
            if (pendingUids.has(u.uid)) {
              return { ...u, relState: 'pending' as SearchItemState, pendingRequestId: null }
            }
            return { ...u, relState: 'none' as SearchItemState, pendingRequestId: null }
          }),
        )
        setSearchResults(enriched)
      } catch {
        setSearchResults([])
      } finally {
        setSearchLoading(false)
      }
    }, 300)
  }, [query, requests]) // eslint-disable-line react-hooks/exhaustive-deps

  async function openModal(uid: string) {
    const profile = await fetchUserProfile(uid)
    if (profile) setModalProfile(profile as unknown as UserPublicProfile)
  }

  async function handleSendRequest(item: SearchItemWithState) {
    setActionLoadingId(item.uid)
    try {
      const res = await api.post<{ status: string; data: Record<string, unknown> }>(
        `/api/users/${item.uid}/collaboration-requests`,
      )
      const newState: SearchItemState =
        res.data.status === 'already_connected' ? 'collaborator' : 'pending'
      setSearchResults(prev =>
        prev.map(r => r.uid === item.uid ? { ...r, relState: newState } : r),
      )
      if (newState === 'collaborator') {
        // Refresh collaborators list
        const c = await api.get<{ status: string; data: CollaboratorEntry[] }>('/api/users/me/collaborators')
        setCollaborators(c.data)
      }
    } catch {
      //
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleAccept(req: CollaborationRequestWithSender) {
    setActionLoadingId(req.id)
    try {
      await api.post(`/api/users/me/collaboration-requests/${req.id}/accept`)
      setRequests(prev => prev.filter(r => r.id !== req.id))
      const c = await api.get<{ status: string; data: CollaboratorEntry[] }>('/api/users/me/collaborators')
      setCollaborators(c.data)
    } catch {
      //
    } finally {
      setActionLoadingId(null)
    }
  }

  async function handleDecline(req: CollaborationRequestWithSender) {
    setActionLoadingId(req.id)
    try {
      await api.post(`/api/users/me/collaboration-requests/${req.id}/decline`)
      setRequests(prev => prev.filter(r => r.id !== req.id))
    } catch {
      //
    } finally {
      setActionLoadingId(null)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-5xl sm:text-6xl text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Collaborators
            </h1>
            <p className="mt-2 text-lg text-plum">
              Find and connect with other researchers.
            </p>
          </div>

          {/* Search */}
          <div className="relative w-full sm:w-72">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
              style={{ color: 'var(--color-text-muted)' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name…"
              className="input w-full pl-9"
            />
          </div>
        </div>

        {/* Search results */}
        {query.trim() && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Search Results
            </h2>
            {searchLoading ? (
              <div className="flex justify-center py-8">
                <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
              </div>
            ) : searchResults.length === 0 ? (
              <p className="text-sm py-6 text-center" style={{ color: 'var(--color-text-muted)' }}>
                No discoverable users match "{query}".
              </p>
            ) : (
              <div className="card divide-y divide-gray-100">
                {searchResults.map((item) => (
                  <div key={item.uid} className="flex items-center gap-3 px-4 py-3">
                    <InitialsAvatar name={item.displayName} />
                    <div className="flex-1 min-w-0">
                      <button
                        onClick={() => openModal(item.uid)}
                        className="font-medium text-sm text-left hover:underline"
                        style={{ color: 'var(--color-text)' }}
                      >
                        {item.displayName}
                      </button>
                      <div className="flex items-center gap-2 mt-0.5">
                        <RoleLabel role={item.role} />
                        {item.affiliation && (
                          <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                            · {item.affiliation}
                          </span>
                        )}
                      </div>
                    </div>
                    <SearchItemCTA
                      item={item}
                      loading={actionLoadingId === item.uid}
                      onAdd={() => handleSendRequest(item)}
                    />
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* Incoming requests */}
        {!requestsLoading && requests.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
              Collaboration Requests
            </h2>
            <div className="card divide-y divide-gray-100">
              {requests.map((req) => (
                <div key={req.id} className="flex items-center gap-3 px-4 py-3">
                  <InitialsAvatar name={req.sender.displayName} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => openModal(req.sender.uid)}
                      className="font-medium text-sm text-left hover:underline"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {req.sender.displayName}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                      <RoleLabel role={req.sender.role} />
                      {req.sender.affiliation && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          · {req.sender.affiliation}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <button
                      onClick={() => handleAccept(req)}
                      disabled={actionLoadingId === req.id}
                      className="btn-primary text-sm disabled:opacity-50"
                    >
                      Accept
                    </button>
                    <button
                      onClick={() => handleDecline(req)}
                      disabled={actionLoadingId === req.id}
                      className="btn-secondary text-sm disabled:opacity-50"
                    >
                      Decline
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* My Collaborators */}
        <section>
          <h2 className="text-sm font-semibold uppercase tracking-wide mb-3" style={{ color: 'var(--color-text-muted)' }}>
            My Collaborators
          </h2>
          {collaboratorsLoading ? (
            <div className="flex justify-center py-8">
              <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin" style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
          ) : collaborators.length === 0 ? (
            <div className="card px-6 py-10 text-center">
              <p className="text-2xl mb-2">👥</p>
              <p className="text-sm font-medium mb-1" style={{ color: 'var(--color-text)' }}>No collaborators yet</p>
              <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
                Search for users above to send a connection request.
              </p>
            </div>
          ) : (
            <div className="card divide-y divide-gray-100">
              {collaborators.map((col) => (
                <div key={col.uid} className="flex items-center gap-3 px-4 py-3">
                  <InitialsAvatar name={col.displayName} />
                  <div className="flex-1 min-w-0">
                    <button
                      onClick={() => openModal(col.uid)}
                      className="font-medium text-sm text-left hover:underline"
                      style={{ color: 'var(--color-text)' }}
                    >
                      {col.displayName}
                    </button>
                    <div className="flex items-center gap-2 mt-0.5">
                      <RoleLabel role={col.role} />
                      {col.affiliation && (
                        <span className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
                          · {col.affiliation}
                        </span>
                      )}
                    </div>
                  </div>
                  {col.since && (
                    <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(col.since).toLocaleDateString()}
                    </span>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {modalProfile && (
        <UserProfileModal
          profile={modalProfile}
          onClose={() => setModalProfile(null)}
        />
      )}
    </div>
  )
}

function SearchItemCTA({
  item,
  loading,
  onAdd,
}: {
  item: SearchItemWithState
  loading: boolean
  onAdd: () => void
}) {
  if (item.relState === 'collaborator') {
    return (
      <span
        className="inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full shrink-0"
        style={{ background: 'color-mix(in srgb, var(--color-accent) 30%, white)', color: 'var(--color-secondary)' }}
      >
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
        </svg>
        Connected
      </span>
    )
  }

  if (item.relState === 'pending') {
    return (
      <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>
        Pending
      </span>
    )
  }

  return (
    <button
      onClick={onAdd}
      disabled={loading}
      className="btn-primary text-sm shrink-0 disabled:opacity-50"
    >
      {loading ? '…' : 'Add'}
    </button>
  )
}
