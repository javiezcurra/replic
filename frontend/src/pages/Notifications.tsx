import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Notification } from '../types/notification'
import type { UserPublicProfile } from '../types/user'
import UserProfileModal from '../components/UserProfileModal'
import { fetchUserProfile } from '../lib/userProfileCache'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const s = Math.floor(diff / 1000)
  if (s < 60) return 'just now'
  const m = Math.floor(s / 60)
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

const TYPE_ICONS: Record<string, string> = {
  collaboration_request_received:  '🤝',
  collaboration_request_accepted:  '✅',
  added_to_experiment:             '➕',
  removed_from_experiment:         '➖',
  experiment_review_received:      '📝',
  experiment_new_version_coauthor: '🚀',
  watchlist_new_version:           '👁️',
  review_interaction:              '💬',
  experiment_started:              '🧪',
  added_as_co_experimenter:        '🔬',
  removed_as_co_experimenter:      '➖',
}

// Renders the notification message, turning the actor_name substring into a
// clickable span that opens the actor's profile (when actor_uid is present).
function MessageWithActor({
  message,
  actorName,
  actorUid,
  onActorClick,
}: {
  message: string
  actorName?: string
  actorUid?: string
  onActorClick?: (uid: string) => void
}) {
  if (!actorName || !actorUid || !onActorClick) {
    return <>{message}</>
  }
  const idx = message.indexOf(actorName)
  if (idx === -1) return <>{message}</>

  return (
    <>
      {message.slice(0, idx)}
      <button
        onClick={(e) => { e.stopPropagation(); onActorClick(actorUid) }}
        className="font-semibold underline decoration-dotted hover:opacity-70 transition-opacity"
        style={{ color: 'var(--color-secondary)' }}
      >
        {actorName}
      </button>
      {message.slice(idx + actorName.length)}
    </>
  )
}

// ─── Notification row ─────────────────────────────────────────────────────────

function NotificationItem({
  notification,
  onDismiss,
  onActorClick,
}: {
  notification: Notification
  onDismiss: (id: string, link: string) => void
  onActorClick: (uid: string) => void
}) {
  const icon = TYPE_ICONS[notification.type] ?? '🔔'

  return (
    <button
      onClick={() => onDismiss(notification.id, notification.link)}
      className={`w-full text-left flex items-start gap-4 px-5 py-4 rounded-xl
                  border transition-all hover:shadow-sm
                  ${notification.read
                    ? 'bg-white border-gray-100'
                    : 'border-orange-100 hover:border-orange-200'
                  }`}
      style={notification.read ? {} : { background: 'rgba(193,80,45,0.04)' }}
    >
      {/* Icon bubble */}
      <span
        className="shrink-0 w-10 h-10 rounded-full flex items-center justify-center text-lg"
        style={{ background: 'var(--color-surface)' }}
      >
        {icon}
      </span>

      <span className="flex-1 min-w-0">
        <span
          className={`block text-sm leading-snug ${notification.read ? '' : 'font-medium'}`}
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
        >
          <MessageWithActor
            message={notification.message}
            actorName={notification.actor_name}
            actorUid={notification.actor_uid}
            onActorClick={onActorClick}
          />
        </span>
        <span
          className="block text-xs mt-1"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {relativeTime(notification.created_at)}
        </span>
      </span>

      {/* Unread dot */}
      {!notification.read && (
        <span
          className="shrink-0 mt-2 w-2 h-2 rounded-full"
          style={{ background: 'var(--color-primary)' }}
        />
      )}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function NotificationsPage() {
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [loading, setLoading] = useState(true)
  const [dismissingAll, setDismissingAll] = useState(false)
  const [profileModal, setProfileModal] = useState<UserPublicProfile | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    api.get<{ status: string; data: Notification[] }>('/api/users/me/notifications')
      .then((res) => setNotifications(res.data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  async function handleDismiss(id: string, link: string) {
    try {
      await api.patch(`/api/users/me/notifications/${id}/dismiss`)
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n)),
      )
    } catch {
      // fire-and-forget
    }
    navigate(link)
  }

  async function handleDismissAll() {
    setDismissingAll(true)
    try {
      await api.patch('/api/users/me/notifications/dismiss-all')
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    } catch {
      // ignore
    } finally {
      setDismissingAll(false)
    }
  }

  async function handleActorClick(uid: string) {
    const profile = await fetchUserProfile(uid)
    if (profile) setProfileModal(profile)
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  return (
    <>
      <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
        <div className="max-w-2xl mx-auto px-4 sm:px-6 py-10">

          {/* Page header */}
          <div className="flex items-center justify-between mb-6">
            <h1
              className="text-4xl"
              style={{ fontFamily: 'var(--font-display)', color: 'var(--color-dark)' }}
            >
              Notifications
            </h1>
            {unreadCount > 0 && (
              <button
                onClick={handleDismissAll}
                disabled={dismissingAll}
                className="text-sm font-medium px-4 py-2 rounded-xl border transition-colors
                           disabled:opacity-50"
                style={{
                  color: 'var(--color-primary)',
                  borderColor: 'var(--color-primary)',
                  fontFamily: 'var(--font-body)',
                }}
              >
                {dismissingAll ? 'Marking read…' : `Mark all read (${unreadCount})`}
              </button>
            )}
          </div>

          {/* Content */}
          {loading ? (
            <div className="flex justify-center py-24">
              <div
                className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
              />
            </div>
          ) : notifications.length === 0 ? (
            <div className="text-center py-24">
              <span className="text-5xl mb-4 block">🔔</span>
              <p
                className="text-base"
                style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-body)' }}
              >
                You're all caught up — no notifications yet.
              </p>
            </div>
          ) : (
            <div className="space-y-2">
              {notifications.map((n) => (
                <NotificationItem
                  key={n.id}
                  notification={n}
                  onDismiss={handleDismiss}
                  onActorClick={handleActorClick}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {profileModal && (
        <UserProfileModal profile={profileModal} onClose={() => setProfileModal(null)} />
      )}
    </>
  )
}
