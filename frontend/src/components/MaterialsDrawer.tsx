/**
 * MaterialsDrawer — slides in from the right, showing all system materials.
 * Users can search, filter by category, and add/remove materials from their lab.
 */
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Material, MaterialCategory, MaterialListResponse } from '../types/material'
import MaterialCard from './MaterialCard'
import MaterialDetailModal from './MaterialDetailModal'

const CATEGORIES: { value: MaterialCategory; label: string; emoji: string }[] = [
  { value: 'glassware',  label: 'Glassware',   emoji: '🫙' },
  { value: 'reagent',    label: 'Reagent',     emoji: '⚗️' },
  { value: 'equipment',  label: 'Instruments', emoji: '🔬' },
  { value: 'biological', label: 'Biological',  emoji: '🧬' },
  { value: 'other',      label: 'Other',       emoji: '📦' },
]

interface Props {
  /** Set of material IDs currently in the user's lab */
  labIds: Set<string>
  /** Set of material IDs with a pending add/remove in flight */
  pendingIds: Set<string>
  onAdd: (material: Material) => void
  onRemove: (material: Material) => void
  onClose: () => void
}

export default function MaterialsDrawer({ labIds, pendingIds, onAdd, onRemove, onClose }: Props) {
  const [equipmentAll, setEquipmentAll] = useState<Material[]>([])
  const [consumablesAll, setConsumablesAll] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [category, setCategory] = useState<MaterialCategory | ''>('')
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)

  // Load all materials once on mount
  useEffect(() => {
    Promise.all([
      api.get<MaterialListResponse>('/api/materials?type=Equipment&limit=100'),
      api.get<MaterialListResponse>('/api/materials?type=Consumable&limit=100'),
    ])
      .then(([eq, con]) => {
        setEquipmentAll(eq.data)
        setConsumablesAll(con.data)
      })
      .finally(() => setLoading(false))
  }, [])

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape' && !selectedMaterial) onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, selectedMaterial])

  // Client-side search (name, description, tags) + category filter
  function matches(m: Material): boolean {
    if (category && m.category !== category) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return (
      m.name.toLowerCase().includes(q) ||
      (m.description?.toLowerCase().includes(q) ?? false) ||
      m.tags.some((t) => t.toLowerCase().includes(q))
    )
  }

  const filteredEquipment  = useMemo(() => equipmentAll.filter(matches),  [equipmentAll,  search, category])  // eslint-disable-line react-hooks/exhaustive-deps
  const filteredConsumables = useMemo(() => consumablesAll.filter(matches), [consumablesAll, search, category])  // eslint-disable-line react-hooks/exhaustive-deps

  const totalShown = filteredEquipment.length + filteredConsumables.length

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 z-40 bg-black/30"
        onClick={onClose}
      />

      {/* Drawer panel */}
      <div
        className="fixed right-0 top-0 h-full w-full max-w-md z-40
                   bg-white shadow-2xl flex flex-col"
        style={{ background: 'var(--color-surface)' }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-2 bg-white">
          <div>
            <h2
              className="text-lg font-semibold text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Add Materials
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Browse and add materials to your lab
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted
                       hover:bg-gray-100 hover:text-ink transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search */}
        <div className="px-5 pt-4 pb-3 border-b border-surface-2 bg-white space-y-3">
          <div className="relative">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted pointer-events-none"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35m0 0A7.5 7.5 0 104.5 4.5a7.5 7.5 0 0012.15 12.15z" />
            </svg>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, description, or tag…"
              className="w-full pl-9 pr-4 py-2 text-sm rounded-xl border-2 border-surface-2
                         focus:border-plum focus:outline-none bg-white"
            />
          </div>

          {/* Category pills */}
          <div className="flex flex-wrap gap-1.5">
            <CategoryPill label="All" active={category === ''} onClick={() => setCategory('')} />
            {CATEGORIES.map((c) => (
              <CategoryPill
                key={c.value}
                label={`${c.emoji} ${c.label}`}
                active={category === c.value}
                onClick={() => setCategory(category === c.value ? '' : c.value)}
              />
            ))}
          </div>
        </div>

        {/* Results */}
        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {loading ? (
            <div className="flex justify-center py-12">
              <div className="w-6 h-6 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : totalShown === 0 ? (
            <div className="text-center py-12 text-muted text-sm">
              {search ? 'No materials match your search.' : 'No materials found.'}
            </div>
          ) : (
            <>
              {filteredEquipment.length > 0 && (
                <MaterialSection
                  title="Equipment"
                  materials={filteredEquipment}
                  labIds={labIds}
                  pendingIds={pendingIds}
                  onAdd={onAdd}
                  onRemove={onRemove}
                  onDetails={setSelectedMaterial}
                />
              )}
              {filteredConsumables.length > 0 && (
                <MaterialSection
                  title="Consumables"
                  materials={filteredConsumables}
                  labIds={labIds}
                  pendingIds={pendingIds}
                  onAdd={onAdd}
                  onRemove={onRemove}
                  onDetails={setSelectedMaterial}
                />
              )}
            </>
          )}
        </div>
      </div>

      {/* Detail modal (above drawer) */}
      {selectedMaterial && (
        <MaterialDetailModal
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
          inLab={labIds.has(selectedMaterial.id)}
          onAdd={onAdd}
          onRemove={onRemove}
          actionPending={pendingIds.has(selectedMaterial.id)}
        />
      )}
    </>
  )
}

function MaterialSection({
  title,
  materials,
  labIds,
  pendingIds,
  onAdd,
  onRemove,
  onDetails,
}: {
  title: string
  materials: Material[]
  labIds: Set<string>
  pendingIds: Set<string>
  onAdd: (m: Material) => void
  onRemove: (m: Material) => void
  onDetails: (m: Material) => void
}) {
  return (
    <div>
      <h3 className="text-xs font-semibold text-muted uppercase tracking-wide mb-2">
        {title} · {materials.length}
      </h3>
      <div className="space-y-2">
        {materials.map((m) => (
          <MaterialCard
            key={m.id}
            material={m}
            onDetails={onDetails}
            inLab={labIds.has(m.id)}
            onAdd={onAdd}
            onRemove={onRemove}
            actionPending={pendingIds.has(m.id)}
          />
        ))}
      </div>
    </div>
  )
}

function CategoryPill({
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
      className={`flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-medium
                  border transition-all ${
        active
          ? 'border-ink bg-ink text-white'
          : 'border-surface-2 bg-white text-ink hover:border-plum'
      }`}
    >
      {label}
    </button>
  )
}
