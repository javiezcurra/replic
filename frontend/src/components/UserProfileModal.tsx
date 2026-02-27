import { useEffect } from 'react'
import type { UserPublicProfile } from '../types/user'
import { USER_ROLE_LABELS } from '../types/user'

interface Props {
  profile: UserPublicProfile
  onClose: () => void
}

export default function UserProfileModal({ profile, onClose }: Props) {
  // Close on Escape key
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const initials = profile.displayName?.[0]?.toUpperCase() ?? '?'

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
          {profile.photoURL ? (
            <img
              src={profile.photoURL}
              alt={profile.displayName}
              className="w-14 h-14 rounded-full shrink-0 object-cover"
            />
          ) : (
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold shrink-0"
              style={{ background: 'var(--color-dark)' }}
            >
              {initials}
            </div>
          )}
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
                  style={{
                    background: 'var(--color-primary)',
                    fontFamily: 'var(--font-mono)',
                  }}
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
              <dd className="text-ink">
                {USER_ROLE_LABELS[profile.role] ?? profile.role}
              </dd>
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
              <dd className="text-gray-800 leading-relaxed whitespace-pre-line">
                {profile.bio}
              </dd>
            </div>
          )}
          {!profile.role && !profile.affiliation && !profile.bio && (
            <p className="text-sm text-muted italic">No additional profile information.</p>
          )}
        </dl>

        <button
          onClick={onClose}
          className="btn-secondary text-sm w-full justify-center"
        >
          Close
        </button>
      </div>
    </div>
  )
}
