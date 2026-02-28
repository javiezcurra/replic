import { useState, useEffect, useRef, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Notification } from '../types/notification'

// ─── Icon ──────────────────────────────────────────────────────────────────────

function BellIcon({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0
           00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0
           .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"
      />
    </svg>
  )
}

// ─── Relative time helper ──────────────────────────────────────────────────────

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
  return new Date(iso).toLocaleDateString()
}

// ─── Notification item row ────────────────────────────────────────────────────

function NotificationRow({
  notification,
  onDismiss,
}: {
  notification: Notification
  onDismiss: (id: string, link: string) => void
}) {
  return (
    <button
      onClick={() => onDismiss(notification.id, notification.link)}
      className="w-full text-left px-4 py-3 flex items-start gap-3 hover:bg-gray-50
                 transition-colors border-b border-gray-50 last:border-0"
    >
      {/* Unread dot */}
      <span className="mt-1.5 shrink-0 w-2 h-2 rounded-full" style={{
        background: notification.read ? 'transparent' : 'var(--color-primary)',
      }} />
      <span className="flex-1 min-w-0">
        <span
          className="block text-sm leading-snug"
          style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
        >
          {notification.message}
        </span>
        <span
          className="block text-xs mt-0.5"
          style={{ color: 'var(--color-text-muted)', fontFamily: 'var(--font-mono)' }}
        >
          {relativeTime(notification.created_at)}
        </span>
      </span>
    </button>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const dropdownRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Poll unread count every 30s
  const fetchUnreadCount = useCallback(async () => {
    try {
      const res = await api.get<{ status: string; data: { count: number } }>(
        '/api/users/me/notifications/unread-count',
      )
      setUnreadCount(res.data.count)
    } catch {
      // silently ignore
    }
  }, [])

  useEffect(() => {
    fetchUnreadCount()
    const interval = setInterval(fetchUnreadCount, 30_000)
    return () => clearInterval(interval)
  }, [fetchUnreadCount])

  // Fetch recent notifications when dropdown opens
  useEffect(() => {
    if (!open) return
    api.get<{ status: string; data: Notification[] }>('/api/users/me/notifications')
      .then((res) => setNotifications(res.data.slice(0, 5)))
      .catch(() => {})
  }, [open])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    if (open) document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [open])

  async function handleDismiss(id: string, link: string) {
    setOpen(false)
    try {
      await api.patch(`/api/users/me/notifications/${id}/dismiss`)
      setUnreadCount((c) => Math.max(0, c - 1))
    } catch {
      // fire-and-forget
    }
    navigate(link)
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setOpen((v) => !v)}
        className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100
                   hover:text-gray-900 transition-colors"
        aria-label="Notifications"
      >
        <BellIcon className="w-5 h-5" />
        {unreadCount > 0 && (
          <span
            className="absolute -top-0.5 -right-0.5 min-w-[1.1rem] h-[1.1rem] flex items-center
                       justify-center rounded-full text-white text-[10px] font-bold px-1"
            style={{ background: 'var(--color-primary)', fontFamily: 'var(--font-mono)' }}
          >
            {unreadCount > 99 ? '99+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-1 w-72 sm:w-80 bg-white rounded-xl shadow-lg
                     border border-gray-200 overflow-hidden z-50"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span
              className="text-sm font-semibold"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
            >
              Notifications
            </span>
            <button
              onClick={() => { setOpen(false); navigate('/notifications') }}
              className="text-xs font-medium hover:underline transition-colors"
              style={{ color: 'var(--color-primary)' }}
            >
              See all
            </button>
          </div>

          {/* Items */}
          {notifications.length === 0 ? (
            <p
              className="px-4 py-6 text-sm text-center"
              style={{ color: 'var(--color-text-muted)' }}
            >
              No notifications yet
            </p>
          ) : (
            notifications.map((n) => (
              <NotificationRow key={n.id} notification={n} onDismiss={handleDismiss} />
            ))
          )}
        </div>
      )}
    </div>
  )
}
