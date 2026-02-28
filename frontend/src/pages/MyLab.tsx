import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { api } from '../lib/api'
import type { Design } from '../types/design'
import type { Material } from '../types/material'
import type { CollaboratorEntry, UserPublicProfile } from '../types/user'
import type { Notification } from '../types/notification'
import DesignCard from '../components/DesignCard'
import UserDisplayName from '../components/UserDisplayName'
import UserProfileModal from '../components/UserProfileModal'
import { fetchUserProfile } from '../lib/userProfileCache'

// ─── Data types ───────────────────────────────────────────────────────────────

interface PipelineEntry {
  designId: string
  addedAt: string
  title: string
  status: string
  discipline_tags: string[]
  difficulty_level: string
  execution_count: number
  derived_design_count: number
  author_ids: string[]
}

interface WatchlistEntry extends PipelineEntry {
  source: 'manual' | 'review'
}

interface LabStats {
  equipment: number
  consumables: number
}

interface LabHubData {
  workbench: Design[]
  pipeline: PipelineEntry[]
  watchlist: WatchlistEntry[]
  published: Design[]
  collaborators: CollaboratorEntry[]
  labStats: LabStats
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MyLab() {
  const [myDesigns, setMyDesigns] = useState<Design[]>([])
  const [pipeline, setPipeline] = useState<PipelineEntry[]>([])
  const [watchlist, setWatchlist] = useState<WatchlistEntry[]>([])
  const [collaborators, setCollaborators] = useState<CollaboratorEntry[]>([])
  const [labMaterials, setLabMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)

  const workbench = useMemo(
    () => myDesigns.filter((d) => d.status === 'draft' || d.has_draft_changes),
    [myDesigns],
  )
  const published = useMemo(
    () => myDesigns.filter((d) => d.status === 'published' || d.status === 'locked'),
    [myDesigns],
  )
  const labStats: LabStats = useMemo(
    () => ({
      equipment: labMaterials.filter((m) => m.type === 'Equipment').length,
      consumables: labMaterials.filter((m) => m.type === 'Consumable').length,
    }),
    [labMaterials],
  )

  useEffect(() => {
    async function fetchAll() {
      const [designsRes, pipelineRes, watchlistRes, colsRes, labRes] = await Promise.allSettled([
        api.get<{ status: string; data: Design[] }>('/api/designs/me/list'),
        api.get<{ status: string; data: PipelineEntry[] }>('/api/users/me/pipeline'),
        api.get<{ status: string; data: WatchlistEntry[] }>('/api/users/me/watchlist'),
        api.get<{ status: string; data: CollaboratorEntry[] }>('/api/users/me/collaborators'),
        api.get<{ status: string; data: Material[] }>('/api/lab'),
      ])
      if (designsRes.status === 'fulfilled') setMyDesigns(designsRes.value.data)
      if (pipelineRes.status === 'fulfilled') setPipeline(pipelineRes.value.data)
      if (watchlistRes.status === 'fulfilled') setWatchlist(watchlistRes.value.data)
      if (colsRes.status === 'fulfilled') setCollaborators(colsRes.value.data)
      if (labRes.status === 'fulfilled') setLabMaterials(labRes.value.data)
      setLoading(false)
    }
    fetchAll()
  }, [])

  const data: LabHubData = { workbench, pipeline, watchlist, published, collaborators, labStats }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      {loading ? (
        <div className="flex justify-center py-32">
          <div
            className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <CommandCenter data={data} />
      )}
    </div>
  )
}

// ─── Section card container ───────────────────────────────────────────────────

function SectionCard({
  id,
  icon,
  title,
  count,
  accentColor,
  navButton,
  actionButton,
  children,
}: {
  id: string
  icon: string
  title: string
  count: number
  accentColor?: string
  /** Indigo navigation button — goes to another page to browse */
  navButton?: { label: string; to: string }
  /** Orange action button — creates or adds something */
  actionButton?: { label: string; to: string }
  children: React.ReactNode
}) {
  const hasButtons = !!(navButton || actionButton)
  return (
    <section id={`cc-${id}`} className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">

      {/* Card header — accent line + icon + title + count */}
      <div className="flex items-center gap-3 px-5 py-4 border-b border-gray-50">
        <div
          className="w-1 h-7 rounded-full shrink-0"
          style={{ background: accentColor ?? 'var(--color-dark)' }}
        />
        <span className="text-xl">{icon}</span>
        <h2
          className="text-base font-semibold text-ink"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {title}
        </h2>
        <span
          className="ml-auto text-sm text-muted"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {count}
        </span>
      </div>

      {/* Card body */}
      <div className={`px-4 ${hasButtons ? 'pt-4 pb-2' : 'py-4'}`}>
        {children}
      </div>

      {/* Card footer — buttons */}
      {hasButtons && (
        <div className="px-4 pb-4 pt-2 flex gap-3 justify-end">
          {actionButton && (
            <Link
              to={actionButton.to}
              className="text-sm font-semibold px-4 py-2 rounded-xl
                         text-white hover:opacity-90 transition-all"
              style={{ background: 'var(--color-primary)' }}
            >
              {actionButton.label}
            </Link>
          )}
          {navButton && (
            <Link
              to={navButton.to}
              className="text-sm font-semibold px-4 py-2 rounded-xl
                         text-white hover:opacity-90 transition-all"
              style={{ background: 'var(--color-dark)' }}
            >
              {navButton.label}
            </Link>
          )}
        </div>
      )}
    </section>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted text-center py-3">{children}</p>
}

const ENTRY_STATUS_LABELS: Record<string, string> = {
  draft: 'Draft',
  published: 'Published',
  locked: 'Locked',
}
const ENTRY_STATUS_COLORS: Record<string, string> = {
  draft: 'bg-yellow-50 text-yellow-700',
  published: 'bg-green-50 text-green-700',
  locked: 'bg-gray-100 text-gray-600',
}
const ENTRY_DIFFICULTY_COLORS: Record<string, string> = {
  'Pre-K':         'bg-emerald-50 text-emerald-700',
  'Elementary':    'bg-emerald-50 text-emerald-700',
  'Middle School': 'bg-sky-50 text-sky-700',
  'High School':   'bg-blue-50 text-blue-700',
  'Undergraduate': 'bg-violet-50 text-violet-700',
  'Graduate':      'bg-purple-50 text-purple-700',
  'Professional':  'bg-rose-50 text-rose-700',
}

function CompactEntryCard({ entry, watchlistSource }: {
  entry: PipelineEntry
  watchlistSource?: 'manual' | 'review'
}) {
  return (
    <div
      className="relative rounded-xl border border-gray-100 p-3.5 hover:shadow-sm transition-shadow"
      style={{ background: 'var(--color-surface)' }}
    >
      <Link
        to={`/designs/${entry.designId}`}
        className="absolute inset-0 rounded-xl"
        aria-label={entry.title}
      />

      {/* Row 1: title + optional "reviewed" badge + status chip */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <h3 className="font-semibold text-ink text-sm leading-snug">{entry.title}</h3>
        <div className="flex shrink-0 items-center gap-1.5">
          {watchlistSource === 'review' && (
            <span
              className="text-xs font-medium px-1.5 py-0.5 rounded-full"
              style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}
            >
              reviewed
            </span>
          )}
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTRY_STATUS_COLORS[entry.status] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {ENTRY_STATUS_LABELS[entry.status] ?? entry.status}
          </span>
        </div>
      </div>

      {/* Row 2: runs · forks · authors */}
      <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted mb-2.5">
        <span style={{ fontFamily: 'var(--font-mono)' }}>{entry.execution_count} runs</span>
        <span className="text-gray-300">·</span>
        <span style={{ fontFamily: 'var(--font-mono)' }}>{entry.derived_design_count} forks</span>
        {entry.author_ids.length > 0 && (
          <>
            <span className="text-gray-300">·</span>
            <span className="flex flex-wrap items-center gap-x-1">
              <span>Authors:</span>
              {entry.author_ids.map((uid, i) => (
                <span key={uid} className="flex items-center gap-0.5">
                  <UserDisplayName uid={uid} className="text-xs" />
                  {i < entry.author_ids.length - 1 && <span>,</span>}
                </span>
              ))}
            </span>
          </>
        )}
      </div>

      {/* Row 3: difficulty chip | discipline tags */}
      <div className="flex flex-wrap items-center gap-1.5">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${ENTRY_DIFFICULTY_COLORS[entry.difficulty_level] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {entry.difficulty_level}
        </span>
        {entry.discipline_tags.length > 0 && (
          <>
            <div className="h-3 w-px bg-gray-200 rounded-full" />
            {entry.discipline_tags.map((tag) => (
              <span key={tag} className="text-xs bg-white text-muted px-2 py-0.5 rounded-full border border-gray-100">
                {tag}
              </span>
            ))}
          </>
        )}
      </div>
    </div>
  )
}

// ─── Sidebar nav sections ─────────────────────────────────────────────────────

const SIDEBAR_SECTIONS = [
  { id: 'workbench',     label: 'Workbench',     icon: '🔧' },
  { id: 'pipeline',      label: 'Pipeline',       icon: '⚗️' },
  { id: 'watchlist',     label: 'Watchlist',      icon: '👁️' },
  { id: 'published',     label: 'Published',      icon: '✨' },
  { id: 'collaborators', label: 'Collaborators',  icon: '👥' },
  { id: 'lab-inventory', label: 'Lab Inventory',  icon: '🧪' },
]

// ─── Command Center layout ────────────────────────────────────────────────────

// ─── Inbox notification row ───────────────────────────────────────────────────

function InboxRow({ notification, onDismiss }: {
  notification: Notification
  onDismiss: (id: string, link: string) => void
}) {
  return (
    <button
      onClick={() => onDismiss(notification.id, notification.link)}
      className="w-full text-left px-4 py-2.5 hover:bg-gray-50 transition-colors
                 border-b border-gray-50 last:border-0"
    >
      <span className="flex items-start gap-2">
        <span
          className="shrink-0 mt-1.5 w-1.5 h-1.5 rounded-full"
          style={{ background: 'var(--color-primary)', opacity: notification.read ? 0 : 1 }}
        />
        <span className="min-w-0">
          <span
            className="block text-xs leading-snug truncate"
            style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
            title={notification.message}
          >
            {notification.message}
          </span>
        </span>
      </span>
    </button>
  )
}

// ─── Command Center ───────────────────────────────────────────────────────────

function CommandCenter({ data }: { data: LabHubData }) {
  const [profileModal, setProfileModal] = useState<UserPublicProfile | null>(null)
  const [inboxNotifications, setInboxNotifications] = useState<Notification[]>([])
  const navigate = useNavigate()

  useEffect(() => {
    api.get<{ status: string; data: Notification[] }>('/api/users/me/notifications')
      .then((res) => {
        const unread = res.data.filter((n) => !n.read).slice(0, 5)
        setInboxNotifications(unread)
      })
      .catch(() => {})
  }, [])

  async function handleInboxDismiss(id: string, link: string) {
    try {
      await api.patch(`/api/users/me/notifications/${id}/dismiss`)
      setInboxNotifications((prev) => prev.filter((n) => n.id !== id))
    } catch {
      // fire-and-forget
    }
    navigate(link)
  }

  const counts: Record<string, number> = {
    workbench:       data.workbench.length,
    pipeline:        data.pipeline.length,
    watchlist:       data.watchlist.length,
    published:       data.published.length,
    collaborators:   data.collaborators.length,
    'lab-inventory': data.labStats.equipment + data.labStats.consumables,
  }

  async function openProfile(uid: string) {
    const profile = await fetchUserProfile(uid)
    if (profile) setProfileModal(profile)
  }

  return (
    <>
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-6 items-start">

      {/* ── Left column: sticky nav sidebar + inbox ── */}
      <div
        className="hidden lg:flex flex-col gap-3 w-52 shrink-0"
        style={{ position: 'sticky', top: '80px' }}
      >
        {/* Dark nav sidebar */}
        <aside
          className="flex flex-col rounded-2xl overflow-hidden"
          style={{ background: 'var(--color-dark)' }}
        >
          {/* Sidebar header */}
          <div className="px-5 pt-5 pb-4">
            <h1
              className="text-2xl text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              My Lab
            </h1>
          </div>

          {/* Section nav */}
          <nav className="flex flex-col px-2 pb-5 gap-0.5">
            {SIDEBAR_SECTIONS.map((s) => (
              <a
                key={s.id}
                href={`#cc-${s.id}`}
                className="flex items-center justify-between px-3 py-2 rounded-xl text-sm
                           text-white/70 hover:text-white hover:bg-white/10 transition-all"
              >
                <span className="flex items-center gap-2">
                  <span>{s.icon}</span>
                  <span className="font-medium">{s.label}</span>
                </span>
                <span
                  className="text-xs text-white/40"
                  style={{ fontFamily: 'var(--font-mono)' }}
                >
                  {counts[s.id] ?? 0}
                </span>
              </a>
            ))}
          </nav>
        </aside>

        {/* Inbox — own white card, same style as section cards */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-50">
            <span
              className="flex items-center gap-1.5 text-sm font-semibold"
              style={{ color: 'var(--color-text)', fontFamily: 'var(--font-body)' }}
            >
              📬 Inbox
            </span>
            <Link
              to="/notifications"
              className="text-xs font-medium hover:underline transition-colors"
              style={{ color: 'var(--color-primary)' }}
            >
              See all
            </Link>
          </div>
          {/* Fixed height: shows up to 5 open notifications */}
          <div className="overflow-y-auto" style={{ maxHeight: '180px' }}>
            {inboxNotifications.length === 0 ? (
              <p
                className="px-4 py-4 text-xs text-center"
                style={{ color: 'var(--color-text-muted)' }}
              >
                All caught up ✓
              </p>
            ) : (
              inboxNotifications.map((n) => (
                <InboxRow key={n.id} notification={n} onDismiss={handleInboxDismiss} />
              ))
            )}
          </div>
        </section>
      </div>

      {/* ── Main content ── */}
      <main className="flex-1 min-w-0 space-y-6">

        {/* Page title (mobile only) */}
        <div className="lg:hidden">
          <h1
            className="text-4xl text-ink"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            My Lab
          </h1>
        </div>

        {/* ── Workbench ── */}
        <SectionCard
          id="workbench"
          icon="🔧"
          title="Workbench"
          count={data.workbench.length}
          accentColor="var(--color-dark)"
          actionButton={{ label: '+ New Design', to: '/designs/new' }}
        >
          {data.workbench.length === 0 ? (
            <EmptyMsg>No designs in progress.</EmptyMsg>
          ) : (
            <div className="space-y-2">
              {data.workbench.map((d) => (
                <DesignCard key={d.id} design={d} compact />
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Pipeline ── */}
        <SectionCard
          id="pipeline"
          icon="⚗️"
          title="Pipeline"
          count={data.pipeline.length}
          accentColor="var(--color-primary)"
          navButton={{ label: 'Browse Designs', to: '/experiments' }}
        >
          {data.pipeline.length === 0 ? (
            <EmptyMsg>Your pipeline is empty.</EmptyMsg>
          ) : (
            <div className="space-y-2">
              {data.pipeline.map((e) => (
                <CompactEntryCard key={e.designId} entry={e} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Watchlist ── */}
        <SectionCard
          id="watchlist"
          icon="👁️"
          title="Watchlist"
          count={data.watchlist.length}
          accentColor="var(--color-secondary)"
        >
          {data.watchlist.length === 0 ? (
            <EmptyMsg>Nothing on your watchlist yet.</EmptyMsg>
          ) : (
            <div className="space-y-2">
              {data.watchlist.map((e) => (
                <CompactEntryCard key={e.designId} entry={e} watchlistSource={e.source} />
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Published ── */}
        <SectionCard
          id="published"
          icon="✨"
          title="Published"
          count={data.published.length}
          accentColor="#4A7C59"
        >
          {data.published.length === 0 ? (
            <EmptyMsg>No published designs yet.</EmptyMsg>
          ) : (
            <div className="space-y-2">
              {data.published.map((d) => (
                <DesignCard key={d.id} design={d} compact />
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Collaborators ── */}
        <SectionCard
          id="collaborators"
          icon="👥"
          title="Collaborators"
          count={data.collaborators.length}
          accentColor="var(--color-secondary)"
          navButton={{ label: 'Manage Collaborators', to: '/collaborators' }}
        >
          {data.collaborators.length === 0 ? (
            <EmptyMsg>No collaborators yet.</EmptyMsg>
          ) : (
            <div className="divide-y divide-gray-50">
              {data.collaborators.map((c) => (
                <button
                  key={c.uid}
                  onClick={() => openProfile(c.uid)}
                  className="flex w-full items-center gap-3 px-2 py-2.5 -mx-2 rounded-lg
                             hover:bg-surface transition-colors text-left group"
                >
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-white
                               text-xs font-bold shrink-0"
                    style={{ background: 'var(--color-secondary)' }}
                  >
                    {(c.displayName || c.uid).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate group-hover:text-primary transition-colors">
                      {c.displayName || c.uid}
                    </p>
                    {c.affiliation && (
                      <p className="text-xs text-muted truncate">{c.affiliation}</p>
                    )}
                  </div>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        {/* ── Lab Inventory ── */}
        <SectionCard
          id="lab-inventory"
          icon="🧪"
          title="Lab Inventory"
          count={data.labStats.equipment + data.labStats.consumables}
          accentColor="var(--color-dark)"
          navButton={{ label: 'Open Lab Inventory', to: '/lab-inventory' }}
        >
          <div className="grid grid-cols-2 gap-3">
            <div
              className="text-center p-4 rounded-xl border border-gray-100"
              style={{ background: 'var(--color-surface)' }}
            >
              <p
                className="text-3xl font-bold text-ink"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {data.labStats.equipment}
              </p>
              <p className="text-sm text-muted mt-1">🔬 Equipment</p>
            </div>
            <div
              className="text-center p-4 rounded-xl border border-gray-100"
              style={{ background: 'var(--color-surface)' }}
            >
              <p
                className="text-3xl font-bold text-ink"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                {data.labStats.consumables}
              </p>
              <p className="text-sm text-muted mt-1">🧪 Consumables</p>
            </div>
          </div>
        </SectionCard>

      </main>
    </div>

    {profileModal && (
      <UserProfileModal profile={profileModal} onClose={() => setProfileModal(null)} />
    )}
    </>
  )
}
