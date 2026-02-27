import { useEffect, useState } from 'react'
import type { UserPublicProfile, UserRelationship } from '../types/user'
import { USER_ROLE_LABELS } from '../types/user'
import { useAuth } from '../contexts/AuthContext'
import { api } from '../lib/api'

interface Props {
  profile: UserPublicProfile
  onClose: () => void
}

export default function UserProfileModal({ profile, onClose }: Props) {
  const { user } = useAuth()
  const isSelf = user?.uid === profile.uid

  const [relationship, setRelationship] = useState<UserRelationship | null>(null)
  const [relLoading, setRelLoading] = useState(false)
  const [actionLoading, setActionLoading] = useState(false)

  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  // Fetch relationship when modal opens (authenticated non-self only)
  useEffect(() => {
    if (!user || isSelf) return
    setRelLoading(true)
    api
      .get<{ status: string; data: UserRelationship }>(`/api/users/${profile.uid}/relationship`)
      .then((res) => setRelationship(res.data))
      .catch(() => {})
      .finally(() => setRelLoading(false))
  }, [profile.uid, user, isSelf])

  async function handleAddCollaborator() {
    if (!user || actionLoading) return
    setActionLoading(true)
    try {
      const res = await api.post<{ status: string; data: Record<string, unknown> }>(
        `/api/users/${profile.uid}/collaboration-requests`,
      )
      if (res.data.status === 'already_connected') {
        setRelationship({ isCollaborator: true, pendingRequestId: null, pendingDirection: null })
      } else {
        setRelationship({ isCollaborator: false, pendingRequestId: (res.data.id as string) ?? null, pendingDirection: 'outgoing' })
      }
    } catch {
      // button stays active so user can retry
    } finally {
      setActionLoading(false)
    }
  }

  async function handleAccept() {
    if (!relationship?.pendingRequestId || actionLoading) return
    setActionLoading(true)
    try {
      await api.post(`/api/users/me/collaboration-requests/${relationship.pendingRequestId}/accept`)
      setRelationship({ isCollaborator: true, pendingRequestId: null, pendingDirection: null })
    } catch {
      //
    } finally {
      setActionLoading(false)
    }
  }

  async function handleDecline() {
    if (!relationship?.pendingRequestId || actionLoading) return
    setActionLoading(true)
    try {
      await api.post(`/api/users/me/collaboration-requests/${relationship.pendingRequestId}/decline`)
      setRelationship({ isCollaborator: false, pendingRequestId: null, pendingDirection: null })
    } catch {
      //
    } finally {
      setActionLoading(false)
    }
  }

  const initials = profile.displayName?.[0]?.toUpperCase() ?? '?'

  function renderCollaboratorAction() {
    if (!user || isSelf || relLoading) return null

    if (relationship?.isCollaborator) {
      return (
        <span
          className="inline-flex items-center gap-1.5 text-sm font-medium px-3 py-1.5 rounded-lg"
          style={{ background: 'color-mix(in srgb, var(--color-accent) 30%, white)', color: 'var(--color-secondary)' }}
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
          Collaborator
        </span>
      )
    }

    if (relationship?.pendingDirection === 'outgoing') {
      return <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Request sent</span>
    }

    if (relationship?.pendingDirection === 'incoming') {
      return (
        <div className="flex items-center gap-2">
          <button onClick={handleAccept} disabled={actionLoading} className="btn-primary text-sm disabled:opacity-50">Accept</button>
          <button onClick={handleDecline} disabled={actionLoading} className="btn-secondary text-sm disabled:opacity-50">Decline</button>
        </div>
      )
    }

    return (
      <button
        onClick={handleAddCollaborator}
        disabled={actionLoading}
        className="inline-flex items-center gap-1.5 text-sm font-medium hover:opacity-80 transition-opacity disabled:opacity-50"
        style={{ color: 'var(--color-primary)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
        </svg>
        {actionLoading ? 'Sending…' : 'Add Collaborator'}
      </button>
    )
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-xl max-w-sm w-full p-6 space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header — avatar + name + admin badge */}
        <div className="flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
            style={{ background: 'var(--color-dark)' }}
          >
            {initials}
          </div>
          <div className="min-w-0">
            <div className="flex items-center flex-wrap gap-2">
              <p
                className="font-semibold text-ink text-base leading-snug"
                style={{ fontFamily: 'var(--font-body)' }}
              >
                {profile.displayName}
              </p>
              {profile.is_admin && (
                <span
                  className="text-xs font-medium px-2 py-0.5 rounded-full text-white shrink-0"
                  style={{ background: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}
                >
                  admin
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Profile fields */}
        <dl className="space-y-3 text-sm">
          {profile.role && (
            <div>
              <dt className="text-xs text-muted mb-0.5">Role</dt>
              <dd className="text-ink">{USER_ROLE_LABELS[profile.role] ?? profile.role}</dd>
            </div>
          )}
          {profile.affiliation && (
            <div>
              <dt className="text-xs text-muted mb-0.5">Affiliation</dt>
              <dd className="text-ink">{profile.affiliation}</dd>
            </div>
          )}
          {profile.bio && (
            <div>
              <dt className="text-xs text-muted mb-0.5">Bio</dt>
              <dd className="text-gray-800 leading-relaxed whitespace-pre-line">{profile.bio}</dd>
            </div>
          )}
          {!profile.role && !profile.affiliation && !profile.bio && (
            <p className="text-sm text-muted italic">No additional profile information.</p>
          )}
        </dl>

        {/* Collaborator action row */}
        {user && !isSelf && (
          <div className="flex items-center pt-1 border-t border-gray-100">
            {renderCollaboratorAction()}
          </div>
        )}

        <button onClick={onClose} className="btn-secondary text-sm w-full justify-center">
          Close
        </button>
      </div>
    </div>
  )
}
