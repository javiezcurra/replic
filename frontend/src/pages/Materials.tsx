/**
 * Materials — Admin Panel page for browsing and managing the full materials catalog.
 * Only accessible to users with is_admin === true.
 *
 * Layout:
 *  - Left (2/3): combined Equipment + Consumables list with search/filter bar
 *  - Right (1/3): inline Bundles panel
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useAuth } from '../contexts/AuthContext'
import type { Material, MaterialCategory, MaterialListResponse } from '../types/material'
import type { Bundle } from '../types/bundle'
import { api } from '../lib/api'
import { useCategories } from '../hooks/useCategories'
import BulkUploadMaterialsModal from '../components/BulkUploadMaterialsModal'
import CreateMaterialModal from '../components/CreateMaterialModal'
import ManageCategoriesModal from '../components/ManageCategoriesModal'
import ManageBundlesModal, { BundleCard } from '../components/ManageBundlesModal'
import MaterialCard from '../components/MaterialCard'
import MaterialDetailModal from '../components/MaterialDetailModal'

interface BundleListResponse { status: string; data: Bundle[] }

const PAGE_SIZE = 50

export default function Materials() {
  const { user, isAdmin, loading: authLoading } = useAuth()
  const { categories, setCategories } = useCategories()

  // ── Materials state ──────────────────────────────────────────────────────────
  const [equipmentAll, setEquipmentAll]   = useState<Material[]>([])
  const [consumablesAll, setConsumablesAll] = useState<Material[]>([])
  const [equipmentCursor, setEquipmentCursor]   = useState<string | undefined>()
  const [consumablesCursor, setConsumablesCursor] = useState<string | undefined>()
  const [loading, setLoading]         = useState(true)
  const [loadingMoreEq, setLoadingMoreEq]   = useState(false)
  const [loadingMoreCon, setLoadingMoreCon] = useState(false)

  // ── Filter state ─────────────────────────────────────────────────────────────
  const [showEquipment, setShowEquipment]   = useState(true)
  const [showConsumables, setShowConsumables] = useState(true)
  const [searchQuery, setSearchQuery]       = useState('')
  const [selectedCategory, setSelectedCategory] = useState<MaterialCategory | ''>('')
  const [showCategoryDropdown, setShowCategoryDropdown] = useState(false)
  const categoryDropdownRef = useRef<HTMLDivElement>(null)

  // ── Bundles state ────────────────────────────────────────────────────────────
  const [bundles, setBundles]           = useState<Bundle[]>([])
  const [editingBundle, setEditingBundle] = useState<Bundle | 'new' | null>(null)
  const [deleteTarget, setDeleteTarget]   = useState<Bundle | null>(null)
  const [deleting, setDeleting]           = useState(false)

  // ── Modals ───────────────────────────────────────────────────────────────────
  const [showBulkUpload, setShowBulkUpload]           = useState(false)
  const [showCreateMaterial, setShowCreateMaterial]   = useState(false)
  const [showManageCategories, setShowManageCategories] = useState(false)
  const [selectedMaterial, setSelectedMaterial]       = useState<Material | null>(null)

  // ── Data fetching ────────────────────────────────────────────────────────────

  async function fetchAll() {
    setLoading(true)
    try {
      const [eqRes, conRes, bundlesRes] = await Promise.all([
        api.get<MaterialListResponse>(`/api/materials?type=Equipment&limit=${PAGE_SIZE}`),
        api.get<MaterialListResponse>(`/api/materials?type=Consumable&limit=${PAGE_SIZE}`),
        api.get<BundleListResponse>('/api/admin/bundles'),
      ])
      setEquipmentAll(eqRes.data)
      setConsumablesAll(conRes.data)
      setBundles(bundlesRes.data)
      setEquipmentCursor(eqRes.data.length === PAGE_SIZE ? eqRes.data[eqRes.data.length - 1]?.id : undefined)
      setConsumablesCursor(conRes.data.length === PAGE_SIZE ? conRes.data[conRes.data.length - 1]?.id : undefined)
    } finally {
      setLoading(false)
    }
  }

  async function loadMoreEquipment() {
    if (!equipmentCursor) return
    setLoadingMoreEq(true)
    try {
      const res = await api.get<MaterialListResponse>(
        `/api/materials?type=Equipment&limit=${PAGE_SIZE}&after=${equipmentCursor}`,
      )
      setEquipmentAll((prev) => [...prev, ...res.data])
      setEquipmentCursor(res.data.length === PAGE_SIZE ? res.data[res.data.length - 1]?.id : undefined)
    } finally {
      setLoadingMoreEq(false)
    }
  }

  async function loadMoreConsumables() {
    if (!consumablesCursor) return
    setLoadingMoreCon(true)
    try {
      const res = await api.get<MaterialListResponse>(
        `/api/materials?type=Consumable&limit=${PAGE_SIZE}&after=${consumablesCursor}`,
      )
      setConsumablesAll((prev) => [...prev, ...res.data])
      setConsumablesCursor(res.data.length === PAGE_SIZE ? res.data[res.data.length - 1]?.id : undefined)
    } finally {
      setLoadingMoreCon(false)
    }
  }

  useEffect(() => {
    if (isAdmin) fetchAll()
  }, [isAdmin]) // eslint-disable-line react-hooks/exhaustive-deps

  // Close category dropdown on outside click
  useEffect(() => {
    if (!showCategoryDropdown) return
    function handleClick(e: MouseEvent) {
      if (!categoryDropdownRef.current?.contains(e.target as Node)) {
        setShowCategoryDropdown(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [showCategoryDropdown])

  // ── Handlers ─────────────────────────────────────────────────────────────────

  function handleMaterialCreated(m: Material) {
    if (m.type === 'Equipment') {
      setEquipmentAll((prev) => [m, ...prev])
    } else {
      setConsumablesAll((prev) => [m, ...prev])
    }
    setShowCreateMaterial(false)
  }

  function handleMaterialUpdated(updated: Material) {
    setEquipmentAll((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    setConsumablesAll((prev) => prev.map((m) => (m.id === updated.id ? updated : m)))
    setSelectedMaterial(updated)
  }

  function handleBundleSaved(b: Bundle) {
    setBundles((prev) => {
      const idx = prev.findIndex((x) => x.id === b.id)
      return idx === -1 ? [...prev, b] : prev.map((x) => (x.id === b.id ? b : x))
    })
    setEditingBundle(null)
  }

  async function handleDeleteBundle() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/admin/bundles/${deleteTarget.id}`)
      setBundles((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      // leave confirmation open for retry
    } finally {
      setDeleting(false)
    }
  }

  // ── Derived data ─────────────────────────────────────────────────────────────

  // Admin guard — wait for auth to resolve before redirecting
  if (!authLoading && (!user || !isAdmin)) {
    return <Navigate to="/" replace />
  }

  // Categories that appear in the currently loaded materials
  const usedSlugs = useMemo(
    () => new Set([...equipmentAll, ...consumablesAll].map((m) => m.category)),
    [equipmentAll, consumablesAll],
  )
  const activeCategories = useMemo(
    () => categories.filter((c) => usedSlugs.has(c.id)),
    [categories, usedSlugs],
  )

  // Filtered materials
  const filteredEquipment = useMemo(() => {
    let result = equipmentAll
    if (selectedCategory) result = result.filter((m) => m.category === selectedCategory)
    const q = searchQuery.toLowerCase().trim()
    if (q) {
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }
    return result
  }, [equipmentAll, selectedCategory, searchQuery])

  const filteredConsumables = useMemo(() => {
    let result = consumablesAll
    if (selectedCategory) result = result.filter((m) => m.category === selectedCategory)
    const q = searchQuery.toLowerCase().trim()
    if (q) {
      result = result.filter(
        (m) =>
          m.name.toLowerCase().includes(q) ||
          m.description?.toLowerCase().includes(q) ||
          m.category?.toLowerCase().includes(q) ||
          m.tags.some((t) => t.toLowerCase().includes(q)),
      )
    }
    return result
  }, [consumablesAll, selectedCategory, searchQuery])

  // Material name lookup for bundle chips
  const materialById = useMemo(
    () => new Map([...equipmentAll, ...consumablesAll].map((m) => [m.id, m])),
    [equipmentAll, consumablesAll],
  )

  const selectedCategoryLabel = selectedCategory
    ? (categories.find((c) => c.id === selectedCategory)?.name ?? selectedCategory)
    : ''

  const neitherTypeSelected = !showEquipment && !showConsumables

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>

      {/* ── Page header ────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-semibold text-muted uppercase tracking-wide mb-1">
              Admin Panel
            </p>
            <h1
              className="text-5xl sm:text-6xl text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Materials
            </h1>
            <p className="mt-2 text-lg text-plum max-w-sm">
              Full catalog.{' '}
              <span className="text-muted text-base">Only you can see this.</span>
            </p>
          </div>

          <div className="flex items-center gap-2 shrink-0 flex-wrap">
            <button
              onClick={() => setShowManageCategories(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                         border-2 border-surface-2 text-ink text-sm font-semibold
                         hover:border-ink transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994
                     1.994 0 013 12V7a4 4 0 014-4z" />
              </svg>
              Edit categories
            </button>
            <button
              onClick={() => setShowBulkUpload(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                         border-2 border-plum text-plum text-sm font-semibold
                         hover:bg-plum hover:text-white transition-all"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Bulk upload
            </button>
            <button
              onClick={() => setShowCreateMaterial(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                         text-sm font-semibold text-white hover:opacity-90 transition-all"
              style={{ background: 'var(--color-primary)' }}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Submit material
            </button>
          </div>
        </div>
      </div>

      {/* ── Main content ───────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 lg:gap-8 items-start">

          {/* ── Left column: Materials list ──────────────────────────────────── */}
          <div className="lg:col-span-2">

            {/* Section header */}
            <div className="flex items-center gap-3 mb-4">
              <h2
                className="text-2xl font-semibold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-dark)' }}
              >
                Materials
              </h2>
            </div>

            {/* ── Filter bar ─────────────────────────────────────────────────── */}
            <div className="flex flex-wrap items-center gap-2 mb-5">

              {/* Search input */}
              <div className="relative w-full sm:flex-1 sm:min-w-52">
                <svg
                  className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
                  fill="none" stroke="currentColor" viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
                </svg>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search name, description, category, tags…"
                  className="w-full pl-9 pr-3 py-2 text-sm rounded-xl border-2 border-surface-2
                             bg-white focus:outline-none focus:border-ink transition-colors"
                />
              </div>

              {/* Type toggles */}
              <TypeToggle
                label="Equipment"
                active={showEquipment}
                onClick={() => setShowEquipment((v) => !v)}
              />
              <TypeToggle
                label="Consumables"
                active={showConsumables}
                onClick={() => setShowConsumables((v) => !v)}
              />

              {/* Category dropdown */}
              <div className="relative" ref={categoryDropdownRef}>
                <button
                  type="button"
                  onClick={() => setShowCategoryDropdown((v) => !v)}
                  className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
                              border-2 transition-all ${
                    selectedCategory
                      ? 'border-ink bg-ink text-white'
                      : 'border-surface-2 bg-white text-ink hover:border-ink'
                  }`}
                >
                  {selectedCategory ? selectedCategoryLabel : 'Category'}
                  <svg
                    className={`w-3.5 h-3.5 transition-transform ${showCategoryDropdown ? 'rotate-180' : ''}`}
                    fill="none" stroke="currentColor" viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {showCategoryDropdown && (
                  <div
                    className="absolute top-full mt-1.5 left-0 z-30 bg-white rounded-xl shadow-xl
                               border border-gray-100 min-w-48 max-h-64 overflow-y-auto py-1"
                  >
                    {/* All option */}
                    <button
                      type="button"
                      onClick={() => { setSelectedCategory(''); setShowCategoryDropdown(false) }}
                      className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-3
                                 hover:bg-gray-50 transition-colors"
                    >
                      <RadioDot checked={!selectedCategory} />
                      All categories
                    </button>
                    {activeCategories.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => {
                          setSelectedCategory(c.id as MaterialCategory)
                          setShowCategoryDropdown(false)
                        }}
                        className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-3
                                   hover:bg-gray-50 transition-colors"
                      >
                        <RadioDot checked={selectedCategory === c.id} />
                        {c.emoji ? `${c.emoji} ${c.name}` : c.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* ── Materials list ──────────────────────────────────────────────── */}
            {loading ? (
              <div className="flex justify-center py-24">
                <div
                  className="w-8 h-8 border-4 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                />
              </div>
            ) : neitherTypeSelected ? (
              <EmptyState emoji="⚗️" msg="No material types selected. Enable Equipment, Consumables, or both." />
            ) : (
              <div className="space-y-6">

                {/* Equipment section */}
                {showEquipment && (
                  <div>
                    {showConsumables && (
                      <TypeGroupHeader
                        label="Equipment"
                        count={filteredEquipment.length}
                        color="var(--color-dark)"
                      />
                    )}
                    {filteredEquipment.length === 0 ? (
                      <EmptyState
                        emoji="🔬"
                        msg={
                          searchQuery || selectedCategory
                            ? 'No equipment matches your filters.'
                            : 'No equipment yet.'
                        }
                      />
                    ) : (
                      <>
                        <div className="space-y-2">
                          {filteredEquipment.map((m) => (
                            <MaterialCard key={m.id} material={m} onDetails={setSelectedMaterial} />
                          ))}
                        </div>
                        {equipmentCursor && (
                          <div className="mt-4 text-center">
                            <button
                              onClick={loadMoreEquipment}
                              disabled={loadingMoreEq}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                                         border-2 border-surface-2 bg-white text-ink hover:border-ink
                                         transition-all disabled:opacity-50"
                            >
                              {loadingMoreEq ? 'Loading…' : 'Load more equipment'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

                {/* Consumables section */}
                {showConsumables && (
                  <div>
                    {showEquipment && (
                      <TypeGroupHeader
                        label="Consumables"
                        count={filteredConsumables.length}
                        color="var(--color-primary)"
                      />
                    )}
                    {filteredConsumables.length === 0 ? (
                      <EmptyState
                        emoji="🧪"
                        msg={
                          searchQuery || selectedCategory
                            ? 'No consumables match your filters.'
                            : 'No consumables yet.'
                        }
                      />
                    ) : (
                      <>
                        <div className="space-y-2">
                          {filteredConsumables.map((m) => (
                            <MaterialCard key={m.id} material={m} onDetails={setSelectedMaterial} />
                          ))}
                        </div>
                        {consumablesCursor && (
                          <div className="mt-4 text-center">
                            <button
                              onClick={loadMoreConsumables}
                              disabled={loadingMoreCon}
                              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
                                         border-2 border-surface-2 bg-white text-ink hover:border-ink
                                         transition-all disabled:opacity-50"
                            >
                              {loadingMoreCon ? 'Loading…' : 'Load more consumables'}
                            </button>
                          </div>
                        )}
                      </>
                    )}
                  </div>
                )}

              </div>
            )}
          </div>

          {/* ── Right column: Bundles panel ──────────────────────────────────── */}
          <div className="lg:sticky lg:top-6">
            <div className="flex items-center justify-between mb-4">
              <h2
                className="text-2xl font-semibold"
                style={{ fontFamily: 'var(--font-display)', color: 'var(--color-dark)' }}
              >
                Bundles
              </h2>
              <button
                type="button"
                onClick={() => setEditingBundle('new')}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm
                           font-semibold text-white hover:opacity-90 transition-colors"
                style={{ background: 'var(--color-primary)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                New
              </button>
            </div>

            {loading ? (
              <div className="flex justify-center py-8">
                <div
                  className="w-6 h-6 border-4 rounded-full animate-spin"
                  style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                />
              </div>
            ) : bundles.length === 0 ? (
              <div className="text-center py-10 rounded-xl border-2 border-dashed border-gray-200">
                <p className="text-3xl mb-2">📦</p>
                <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                  No bundles yet.
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                  Create one to group related materials.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {bundles.map((bundle) => (
                  <BundleCard
                    key={bundle.id}
                    bundle={bundle}
                    materialById={materialById}
                    onEdit={(b) => setEditingBundle(b)}
                    onDelete={(b) => setDeleteTarget(b)}
                  />
                ))}
              </div>
            )}
          </div>

        </div>
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────────── */}

      {showBulkUpload && (
        <BulkUploadMaterialsModal
          onClose={() => setShowBulkUpload(false)}
          onComplete={() => { setShowBulkUpload(false); fetchAll() }}
        />
      )}

      {showCreateMaterial && (
        <CreateMaterialModal
          onClose={() => setShowCreateMaterial(false)}
          onCreated={handleMaterialCreated}
        />
      )}

      {showManageCategories && (
        <ManageCategoriesModal
          categories={categories}
          onClose={() => setShowManageCategories(false)}
          onChange={setCategories}
        />
      )}

      {/* Bundle editor modal — editor-only mode */}
      {editingBundle !== null && (
        <ManageBundlesModal
          onClose={() => setEditingBundle(null)}
          initialEditing={editingBundle}
          onSaved={handleBundleSaved}
        />
      )}

      {selectedMaterial && (
        <MaterialDetailModal
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
          onSave={handleMaterialUpdated}
        />
      )}

      {/* ── Bundle delete confirmation ───────────────────────────────────────── */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-40 bg-black/50" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 pointer-events-auto">
              <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-dark)' }}>
                Delete "{deleteTarget.name}"?
              </h3>
              <p className="text-sm mb-5" style={{ color: 'var(--color-text)' }}>
                This bundle will be permanently removed. The materials themselves are not affected.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200
                             hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleDeleteBundle}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500
                             hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete Bundle'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Small components ─────────────────────────────────────────────────────────

function TypeToggle({
  label,
  active,
  onClick,
}: {
  label: string
  active: boolean
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-sm font-medium
                  border-2 transition-all ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-surface-2 bg-white text-ink hover:border-ink'
      }`}
    >
      {label}
    </button>
  )
}

function TypeGroupHeader({
  label,
  count,
  color,
}: {
  label: string
  count: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3 mb-3">
      <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ background: color }} />
      <h3
        className="text-base font-semibold"
        style={{ color: 'var(--color-dark)', fontFamily: 'var(--font-display)' }}
      >
        {label}
      </h3>
      <span
        className="text-xs font-mono px-1.5 py-0.5 rounded"
        style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}
      >
        {count}
      </span>
    </div>
  )
}

function RadioDot({ checked }: { checked: boolean }) {
  return (
    <span
      className={`w-4 h-4 rounded-full border-2 shrink-0 flex items-center justify-center ${
        checked ? 'border-ink bg-ink' : 'border-gray-300'
      }`}
    >
      {checked && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
    </span>
  )
}

function EmptyState({ emoji, msg }: { emoji: string; msg: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="text-4xl mb-2">{emoji}</div>
      <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>{msg}</p>
    </div>
  )
}
