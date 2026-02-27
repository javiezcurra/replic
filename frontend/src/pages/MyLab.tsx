import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Design } from '../types/design'
import type { Material } from '../types/material'
import DesignCard from '../components/DesignCard'

// ─── Data types ───────────────────────────────────────────────────────────────

interface PipelineEntry {
  designId: string
  addedAt: string
  title: string
  status: string
  discipline_tags: string[]
  difficulty_level: string
}

interface WatchlistEntry extends PipelineEntry {
  source: 'manual' | 'review'
}

interface CollaboratorEntry {
  uid: string
  displayName: string
  affiliation: string | null
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
  const [variant, setVariant] = useState<1 | 2 | 3>(1)

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
        api.get<{ status: string; data: Design[] }>('/api/designs/mine'),
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
      {/* Variant switcher bar */}
      <div className="sticky top-16 z-40 border-b border-gray-100 bg-white/90 backdrop-blur">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-2 flex items-center justify-between">
          <span
            className="text-xs text-muted hidden sm:block"
            style={{ fontFamily: 'var(--font-mono)' }}
          >
            preview mode — pick a layout
          </span>
          <div className="flex gap-1 p-1 rounded-xl bg-gray-100 ml-auto">
            {([1, 2, 3] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setVariant(v)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  variant === v
                    ? 'bg-white shadow-sm text-ink'
                    : 'text-muted hover:text-ink'
                }`}
              >
                My Lab {v}
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-32">
          <div className="w-8 h-8 border-4 border-t-transparent rounded-full animate-spin"
               style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
        </div>
      ) : (
        <>
          {variant === 1 && <Layout1CommandCenter data={data} />}
          {variant === 2 && <Layout2CleanBento data={data} />}
          {variant === 3 && <Layout3PlayfulBento data={data} />}
        </>
      )}
    </div>
  )
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function EmptyMsg({ children }: { children: React.ReactNode }) {
  return <p className="text-sm text-muted text-center py-4">{children}</p>
}

function DesignEntryRow({ entry }: { entry: PipelineEntry }) {
  return (
    <Link
      to={`/designs/${entry.designId}`}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface transition-colors group"
    >
      <span className="flex-1 text-sm font-medium text-ink truncate group-hover:text-primary transition-colors">
        {entry.title}
      </span>
      <span className="shrink-0 text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
        {new Date(entry.addedAt).toLocaleDateString()}
      </span>
    </Link>
  )
}

function WatchlistEntryRow({ entry }: { entry: WatchlistEntry }) {
  return (
    <Link
      to={`/designs/${entry.designId}`}
      className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-surface transition-colors group"
    >
      <span className="flex-1 text-sm font-medium text-ink truncate group-hover:text-primary transition-colors">
        {entry.title}
      </span>
      {entry.source === 'review' && (
        <span className="shrink-0 text-xs px-1.5 py-0.5 rounded-full bg-accent text-ink font-medium">
          reviewed
        </span>
      )}
      <span className="shrink-0 text-xs text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
        {new Date(entry.addedAt).toLocaleDateString()}
      </span>
    </Link>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  LAYOUT 1 — COMMAND CENTER
//  Sticky sidebar navigation + scrollable main content
// ══════════════════════════════════════════════════════════════════════════════

const CC_SECTIONS = [
  { id: 'workbench',     label: 'Workbench',     icon: '🔧' },
  { id: 'pipeline',      label: 'Pipeline',       icon: '⚗️' },
  { id: 'watchlist',     label: 'Watchlist',      icon: '👁️' },
  { id: 'published',     label: 'Published',      icon: '✨' },
  { id: 'collaborators', label: 'Collaborators',  icon: '👥' },
  { id: 'lab-inventory', label: 'Lab Inventory',  icon: '🧪' },
]

function Layout1CommandCenter({ data }: { data: LabHubData }) {
  const counts: Record<string, number> = {
    workbench:     data.workbench.length,
    pipeline:      data.pipeline.length,
    watchlist:     data.watchlist.length,
    published:     data.published.length,
    collaborators: data.collaborators.length,
    'lab-inventory': data.labStats.equipment + data.labStats.consumables,
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 flex gap-6 items-start">

      {/* Sidebar */}
      <aside
        className="hidden lg:flex flex-col w-52 shrink-0 rounded-2xl overflow-hidden"
        style={{ position: 'sticky', top: '112px', background: 'var(--color-dark)' }}
      >
        {/* Sidebar header */}
        <div className="px-5 pt-5 pb-4">
          <h1
            className="text-2xl text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            My Lab
          </h1>
          <p className="text-white/40 text-xs mt-0.5">Command Center</p>
        </div>

        {/* Section nav */}
        <nav className="flex flex-col px-2 pb-4 gap-0.5">
          {CC_SECTIONS.map((s) => (
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

        {/* Lab inventory shortcut */}
        <div className="mx-2 mb-4">
          <Link
            to="/lab-inventory"
            className="block w-full text-center text-xs font-semibold px-3 py-2 rounded-xl
                       text-white/60 hover:text-white border border-white/20 hover:border-white/40
                       transition-all"
          >
            Open Lab Inventory →
          </Link>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 min-w-0 space-y-10">

        {/* Page title (mobile only) */}
        <div className="lg:hidden">
          <h1
            className="text-4xl text-ink"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            My Lab
          </h1>
          <p className="text-sm text-muted mt-1">Command Center</p>
        </div>

        {/* ── Workbench ── */}
        <section id="cc-workbench">
          <CCSectionHeader icon="🔧" title="Workbench" count={data.workbench.length}
            action={<Link to="/designs/new" className="cc-action-btn">+ New Design</Link>} />
          {data.workbench.length === 0 ? (
            <EmptyMsg>No designs in progress. <Link to="/designs/new" className="text-primary hover:underline">Start one</Link>.</EmptyMsg>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {data.workbench.map((d) => (
                <div key={d.id} className="border-b border-gray-50 last:border-0">
                  <DesignCard design={d} compact />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Pipeline ── */}
        <section id="cc-pipeline">
          <CCSectionHeader icon="⚗️" title="Pipeline" count={data.pipeline.length}
            action={<Link to="/experiments" className="cc-action-btn">Browse designs</Link>} />
          {data.pipeline.length === 0 ? (
            <EmptyMsg>Your pipeline is empty. <Link to="/experiments" className="text-primary hover:underline">Find experiments to run</Link>.</EmptyMsg>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {data.pipeline.map((e) => (
                <div key={e.designId} className="border-b border-gray-50 last:border-0">
                  <DesignEntryRow entry={e} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Watchlist ── */}
        <section id="cc-watchlist">
          <CCSectionHeader icon="👁️" title="Watchlist" count={data.watchlist.length} />
          {data.watchlist.length === 0 ? (
            <EmptyMsg>Nothing on your watchlist yet.</EmptyMsg>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {data.watchlist.map((e) => (
                <div key={e.designId} className="border-b border-gray-50 last:border-0">
                  <WatchlistEntryRow entry={e} />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Published ── */}
        <section id="cc-published">
          <CCSectionHeader icon="✨" title="Published" count={data.published.length} />
          {data.published.length === 0 ? (
            <EmptyMsg>No published designs yet.</EmptyMsg>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {data.published.map((d) => (
                <div key={d.id} className="border-b border-gray-50 last:border-0">
                  <DesignCard design={d} compact />
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Collaborators ── */}
        <section id="cc-collaborators">
          <CCSectionHeader icon="👥" title="Collaborators" count={data.collaborators.length}
            action={<Link to="/collaborators" className="cc-action-btn">Manage</Link>} />
          {data.collaborators.length === 0 ? (
            <EmptyMsg>No collaborators yet. <Link to="/collaborators" className="text-primary hover:underline">Find researchers</Link>.</EmptyMsg>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
              {data.collaborators.map((c) => (
                <div key={c.uid} className="flex items-center gap-3 px-4 py-3 border-b border-gray-50 last:border-0">
                  <div className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                       style={{ background: 'var(--color-secondary)' }}>
                    {(c.displayName || c.uid).charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{c.displayName || c.uid}</p>
                    {c.affiliation && <p className="text-xs text-muted truncate">{c.affiliation}</p>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* ── Lab Inventory ── */}
        <section id="cc-lab-inventory">
          <CCSectionHeader icon="🧪" title="Lab Inventory"
            count={data.labStats.equipment + data.labStats.consumables}
            action={<Link to="/lab-inventory" className="cc-action-btn">Open Inventory</Link>} />
          <div className="bg-white rounded-2xl border border-gray-100 p-5">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-4 rounded-xl" style={{ background: 'var(--color-surface)' }}>
                <p className="text-3xl font-bold text-ink" style={{ fontFamily: 'var(--font-mono)' }}>
                  {data.labStats.equipment}
                </p>
                <p className="text-sm text-muted mt-1">🔬 Equipment</p>
              </div>
              <div className="text-center p-4 rounded-xl" style={{ background: 'var(--color-surface)' }}>
                <p className="text-3xl font-bold text-ink" style={{ fontFamily: 'var(--font-mono)' }}>
                  {data.labStats.consumables}
                </p>
                <p className="text-sm text-muted mt-1">🧪 Consumables</p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link
                to="/lab-inventory"
                className="flex-1 text-center text-sm font-semibold py-2.5 rounded-xl
                           text-white hover:opacity-90 transition-all"
                style={{ background: 'var(--color-dark)' }}
              >
                Open Lab Inventory
              </Link>
              <Link
                to="/lab-inventory"
                className="flex-1 text-center text-sm font-semibold py-2.5 rounded-xl
                           text-white hover:opacity-90 transition-all"
                style={{ background: 'var(--color-primary)' }}
              >
                + Add Materials
              </Link>
            </div>
          </div>
        </section>

      </main>
    </div>
  )
}

function CCSectionHeader({
  icon,
  title,
  count,
  action,
}: {
  icon: string
  title: string
  count: number
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-ink"
          style={{ fontFamily: 'var(--font-display)' }}>
        <span>{icon}</span>
        {title}
        <span className="text-sm font-normal text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
          ({count})
        </span>
      </h2>
      {action && <div>{action}</div>}
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  LAYOUT 2 — CLEAN BENTO
//  Structured asymmetric grid with clean white cards
// ══════════════════════════════════════════════════════════════════════════════

function Layout2CleanBento({ data }: { data: LabHubData }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Page header */}
      <div className="mb-8">
        <h1
          className="text-5xl sm:text-6xl text-ink"
          style={{ fontFamily: 'var(--font-display)' }}
        >
          My Lab
        </h1>
        <p className="mt-1 text-sm text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
          clean bento
        </p>
      </div>

      {/* Bento grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 auto-rows-auto">

        {/* Workbench — wide (2/3) */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <BentoSectionHeader icon="🔧" title="Workbench" count={data.workbench.length}
            accentColor="var(--color-dark)" />
          <div className="mt-4">
            {data.workbench.length === 0 ? (
              <EmptyMsg>No designs in progress.</EmptyMsg>
            ) : (
              <div className="space-y-0.5">
                {data.workbench.map((d) => <DesignCard key={d.id} design={d} compact />)}
              </div>
            )}
          </div>
          <Link to="/designs/new"
            className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-primary hover:underline">
            + New Design
          </Link>
        </div>

        {/* Pipeline — narrow (1/3) */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <BentoSectionHeader icon="⚗️" title="Pipeline" count={data.pipeline.length}
            accentColor="var(--color-primary)" />
          <div className="mt-4 space-y-0.5">
            {data.pipeline.length === 0 ? (
              <EmptyMsg>Empty.</EmptyMsg>
            ) : (
              data.pipeline.slice(0, 6).map((e) => <DesignEntryRow key={e.designId} entry={e} />)
            )}
          </div>
        </div>

        {/* Watchlist — narrow (1/3) */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <BentoSectionHeader icon="👁️" title="Watchlist" count={data.watchlist.length}
            accentColor="var(--color-secondary)" />
          <div className="mt-4 space-y-0.5">
            {data.watchlist.length === 0 ? (
              <EmptyMsg>Nothing saved yet.</EmptyMsg>
            ) : (
              data.watchlist.slice(0, 6).map((e) => <WatchlistEntryRow key={e.designId} entry={e} />)
            )}
          </div>
        </div>

        {/* Published — wide (2/3) */}
        <div className="md:col-span-2 bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <BentoSectionHeader icon="✨" title="Published" count={data.published.length}
            accentColor="#4A7C59" />
          <div className="mt-4">
            {data.published.length === 0 ? (
              <EmptyMsg>No published designs yet.</EmptyMsg>
            ) : (
              <div className="space-y-0.5">
                {data.published.map((d) => <DesignCard key={d.id} design={d} compact />)}
              </div>
            )}
          </div>
        </div>

        {/* Lab Inventory — wide (2/3) */}
        <div
          className="md:col-span-2 rounded-3xl p-6 shadow-sm"
          style={{ background: 'var(--color-dark)' }}
        >
          <div className="flex items-start justify-between">
            <div>
              <p className="text-4xl mb-2">🧪</p>
              <h3
                className="text-xl font-semibold text-white"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Lab Inventory
              </h3>
            </div>
            <div className="flex gap-6 text-right">
              <div>
                <p className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                  {data.labStats.equipment}
                </p>
                <p className="text-xs text-white/50 mt-0.5">Equipment</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                  {data.labStats.consumables}
                </p>
                <p className="text-xs text-white/50 mt-0.5">Consumables</p>
              </div>
            </div>
          </div>
          <div className="flex gap-3 mt-6">
            <Link
              to="/lab-inventory"
              className="flex-1 text-center text-sm font-semibold py-2.5 rounded-xl
                         bg-white/10 hover:bg-white/20 text-white transition-all"
            >
              Open Inventory
            </Link>
            <Link
              to="/lab-inventory"
              className="flex-1 text-center text-sm font-semibold py-2.5 rounded-xl
                         text-white hover:opacity-90 transition-all"
              style={{ background: 'var(--color-primary)' }}
            >
              + Add Materials
            </Link>
          </div>
        </div>

        {/* Collaborators — narrow (1/3) */}
        <div className="bg-white rounded-3xl border border-gray-100 p-6 shadow-sm">
          <BentoSectionHeader icon="👥" title="Collaborators" count={data.collaborators.length}
            accentColor="var(--color-secondary)" />
          <div className="mt-4 space-y-2">
            {data.collaborators.length === 0 ? (
              <EmptyMsg>No collaborators yet.</EmptyMsg>
            ) : (
              data.collaborators.slice(0, 5).map((c) => (
                <div key={c.uid} className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold shrink-0"
                       style={{ background: 'var(--color-secondary)' }}>
                    {(c.displayName || c.uid).charAt(0).toUpperCase()}
                  </div>
                  <p className="text-sm font-medium text-ink truncate">{c.displayName || c.uid}</p>
                </div>
              ))
            )}
          </div>
          <Link to="/collaborators"
            className="mt-4 inline-flex items-center text-xs font-semibold text-primary hover:underline">
            Manage →
          </Link>
        </div>

      </div>
    </div>
  )
}

function BentoSectionHeader({
  icon,
  title,
  count,
  accentColor,
}: {
  icon: string
  title: string
  count: number
  accentColor: string
}) {
  return (
    <div className="flex items-center gap-3">
      <div
        className="w-1 h-8 rounded-full shrink-0"
        style={{ background: accentColor }}
      />
      <span className="text-xl">{icon}</span>
      <h3
        className="text-base font-semibold text-ink"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        {title}
      </h3>
      <span className="ml-auto text-sm text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
        {count}
      </span>
    </div>
  )
}

// ══════════════════════════════════════════════════════════════════════════════
//  LAYOUT 3 — PLAYFUL BENTO
//  Bold full-color sections, horizontal scroll rails, large type
// ══════════════════════════════════════════════════════════════════════════════

function Layout3PlayfulBento({ data }: { data: LabHubData }) {
  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">

      {/* Page header */}
      <div className="mb-8 flex items-end justify-between">
        <div>
          <h1
            className="text-5xl sm:text-7xl text-ink"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            My Lab
          </h1>
          <p className="mt-1 text-sm text-muted" style={{ fontFamily: 'var(--font-mono)' }}>
            playful bento
          </p>
        </div>
        <Link
          to="/designs/new"
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-bold
                     text-white hover:opacity-90 active:scale-95 transition-all"
          style={{ background: 'var(--color-primary)' }}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
          </svg>
          New Design
        </Link>
      </div>

      {/* Playful grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">

        {/* Workbench — deep indigo, spans 2 cols on xl */}
        <div
          className="xl:col-span-2 rounded-3xl p-6 flex flex-col"
          style={{ background: 'var(--color-dark)' }}
        >
          <PlayfulSectionBadge emoji="🔧" label="Workbench" count={data.workbench.length} light />
          {data.workbench.length === 0 ? (
            <p className="text-white/50 text-sm mt-3 flex-1">Start a new design to see it here.</p>
          ) : (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {data.workbench.map((d) => (
                <PlayfulDesignPill key={d.id} design={d} />
              ))}
            </div>
          )}
        </div>

        {/* Pipeline — burnt sienna */}
        <div
          className="rounded-3xl p-6 flex flex-col"
          style={{ background: 'var(--color-primary)' }}
        >
          <PlayfulSectionBadge emoji="⚗️" label="Pipeline" count={data.pipeline.length} light />
          {data.pipeline.length === 0 ? (
            <p className="text-white/60 text-sm mt-3 flex-1">No experiments queued.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-1.5 overflow-y-auto max-h-48">
              {data.pipeline.map((e) => (
                <PlayfulEntryRow key={e.designId} entry={e} light />
              ))}
            </div>
          )}
        </div>

        {/* Watchlist — dusty plum */}
        <div
          className="rounded-3xl p-6 flex flex-col"
          style={{ background: 'var(--color-secondary)' }}
        >
          <PlayfulSectionBadge emoji="👁️" label="Watchlist" count={data.watchlist.length} light />
          {data.watchlist.length === 0 ? (
            <p className="text-white/60 text-sm mt-3 flex-1">Nothing saved yet.</p>
          ) : (
            <div className="mt-3 flex flex-col gap-1.5 overflow-y-auto max-h-48">
              {data.watchlist.map((e) => (
                <PlayfulEntryRow key={e.designId} entry={e} light />
              ))}
            </div>
          )}
        </div>

        {/* Published — warm green */}
        <div className="xl:col-span-2 rounded-3xl p-6 flex flex-col bg-emerald-700">
          <PlayfulSectionBadge emoji="✨" label="Published" count={data.published.length} light />
          {data.published.length === 0 ? (
            <p className="text-white/60 text-sm mt-3">Publish a design to share your science.</p>
          ) : (
            <div className="mt-3 flex gap-2 overflow-x-auto pb-2 scrollbar-hide">
              {data.published.map((d) => (
                <PlayfulDesignPill key={d.id} design={d} />
              ))}
            </div>
          )}
        </div>

        {/* Lab Inventory — amber/golden */}
        <div className="rounded-3xl p-6 flex flex-col bg-amber-600">
          <PlayfulSectionBadge emoji="🧪" label="Lab Inventory"
            count={data.labStats.equipment + data.labStats.consumables} light />
          <div className="mt-4 flex gap-4">
            <div className="text-center">
              <p className="text-4xl font-black text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                {data.labStats.equipment}
              </p>
              <p className="text-xs text-white/70 font-semibold mt-0.5">🔬 Equip.</p>
            </div>
            <div className="text-center">
              <p className="text-4xl font-black text-white" style={{ fontFamily: 'var(--font-mono)' }}>
                {data.labStats.consumables}
              </p>
              <p className="text-xs text-white/70 font-semibold mt-0.5">🧪 Consum.</p>
            </div>
          </div>
          <div className="mt-auto pt-4 flex flex-col gap-2">
            <Link
              to="/lab-inventory"
              className="block text-center text-sm font-bold py-2.5 rounded-2xl
                         bg-white/20 hover:bg-white/30 text-white transition-all"
            >
              Open Inventory
            </Link>
            <Link
              to="/lab-inventory"
              className="block text-center text-sm font-bold py-2.5 rounded-2xl
                         bg-white text-amber-700 hover:bg-white/90 transition-all"
            >
              + Add Materials
            </Link>
          </div>
        </div>

        {/* Collaborators — sky blue (full width bottom) */}
        <div className="md:col-span-2 xl:col-span-3 rounded-3xl p-6 bg-sky-600">
          <div className="flex items-start justify-between mb-4">
            <PlayfulSectionBadge emoji="👥" label="Collaborators"
              count={data.collaborators.length} light />
            <Link
              to="/collaborators"
              className="text-xs font-bold text-white/70 hover:text-white transition-colors"
            >
              Manage →
            </Link>
          </div>
          {data.collaborators.length === 0 ? (
            <p className="text-white/60 text-sm">
              No collaborators yet. <Link to="/collaborators" className="text-white underline">Find researchers</Link>.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {data.collaborators.map((c) => (
                <div
                  key={c.uid}
                  className="flex items-center gap-2 px-3 py-2 rounded-2xl bg-white/15 hover:bg-white/25 transition-all"
                >
                  <div
                    className="w-6 h-6 rounded-full flex items-center justify-center text-sky-600 text-xs font-black bg-white shrink-0"
                  >
                    {(c.displayName || c.uid).charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-semibold text-white">
                    {c.displayName || c.uid}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  )
}

function PlayfulSectionBadge({
  emoji,
  label,
  count,
  light,
}: {
  emoji: string
  label: string
  count: number
  light?: boolean
}) {
  return (
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-2">
        <span className="text-2xl">{emoji}</span>
        <h3
          className={`text-lg font-bold ${light ? 'text-white' : 'text-ink'}`}
          style={{ fontFamily: 'var(--font-display)' }}
        >
          {label}
        </h3>
      </div>
      <span
        className={`text-2xl font-black ${light ? 'text-white/60' : 'text-ink/40'}`}
        style={{ fontFamily: 'var(--font-mono)' }}
      >
        {count}
      </span>
    </div>
  )
}

function PlayfulDesignPill({ design }: { design: Design }) {
  return (
    <Link
      to={`/designs/${design.id}`}
      className="shrink-0 bg-white/15 hover:bg-white/25 rounded-2xl px-4 py-3 transition-all
                 flex flex-col gap-1 min-w-[180px] max-w-[220px]"
    >
      <span className="text-xs font-semibold text-white/60 truncate">{design.difficulty_level}</span>
      <span className="text-sm font-bold text-white leading-snug line-clamp-2">{design.title}</span>
    </Link>
  )
}

function PlayfulEntryRow({
  entry,
  light,
}: {
  entry: PipelineEntry
  light?: boolean
}) {
  return (
    <Link
      to={`/designs/${entry.designId}`}
      className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all
                  ${light ? 'bg-white/15 hover:bg-white/25' : 'hover:bg-black/5'}`}
    >
      <span className={`flex-1 text-sm font-semibold truncate ${light ? 'text-white' : 'text-ink'}`}>
        {entry.title}
      </span>
    </Link>
  )
}
