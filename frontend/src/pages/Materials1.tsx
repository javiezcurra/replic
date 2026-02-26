/**
 * Materials — Option 1: "Specimen Cabinet"
 *
 * Warm, editorial, side-by-side split between Equipment and Consumables.
 * Clean information hierarchy. Distinct but not loud.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Material, MaterialCategory, MaterialListResponse } from '../types/material'
import BulkUploadMaterialsModal from '../components/BulkUploadMaterialsModal'

const CATEGORIES: { value: MaterialCategory; label: string }[] = [
  { value: 'glassware',  label: 'Glassware' },
  { value: 'reagent',    label: 'Reagent' },
  { value: 'equipment',  label: 'Equipment' },
  { value: 'biological', label: 'Biological' },
  { value: 'other',      label: 'Other' },
]

const CATEGORY_COLORS: Record<MaterialCategory, string> = {
  glassware:  'bg-blue-50 text-blue-700',
  reagent:    'bg-amber-50 text-amber-700',
  equipment:  'bg-emerald-50 text-emerald-700',
  biological: 'bg-violet-50 text-violet-700',
  other:      'bg-gray-100 text-gray-600',
}

export default function Materials1() {
  const { user } = useAuth()
  const [all, setAll] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState<string>('')
  const [showBulk, setShowBulk] = useState(false)

  async function fetch() {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (category) params.set('category', category)
      const qs = params.toString()
      const res = await api.get<MaterialListResponse>(`/api/materials${qs ? `?${qs}` : ''}`)
      setAll(res.data)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetch() }, [category])  // eslint-disable-line react-hooks/exhaustive-deps

  const equipment   = all.filter(m => m.type === 'Equipment')
  const consumables = all.filter(m => m.type === 'Consumable')

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      {/* ── Page header ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-xs font-mono tracking-widest text-muted uppercase mb-1">
              Catalog
            </p>
            <h1
              className="text-4xl sm:text-5xl text-ink leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Materials
            </h1>
            <p className="mt-2 text-muted max-w-md">
              Consumables and equipment used across published experiment designs.
            </p>
          </div>
          {user && (
            <div className="flex items-center gap-2">
              <button
                onClick={() => setShowBulk(true)}
                className="btn-secondary text-sm"
              >
                Bulk upload
              </button>
              <Link to="/materials/new" className="btn-primary text-sm">
                Submit material
              </Link>
            </div>
          )}
        </div>

        {/* ── Category pills ── */}
        <div className="mt-6 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('')}
            className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
              category === ''
                ? 'bg-ink text-white'
                : 'bg-white text-ink border border-surface-2 hover:bg-surface-2'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value === category ? '' : c.value)}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                category === c.value
                  ? 'bg-ink text-white'
                  : 'bg-white text-ink border border-surface-2 hover:bg-surface-2'
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Divider ── */}
      <div className="border-t border-surface-2" />

      {/* ── Two-column split ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-x-8 gap-y-12">
            {/* Equipment */}
            <Section
              title="Equipment"
              count={equipment.length}
              accent="#2F1847"
              materials={equipment}
              emptyText="No equipment matches your filters."
            />
            {/* Consumables */}
            <Section
              title="Consumables"
              count={consumables.length}
              accent="#C1502D"
              materials={consumables}
              emptyText="No consumables match your filters."
            />
          </div>
        </div>
      )}

      {showBulk && (
        <BulkUploadMaterialsModal
          onClose={() => setShowBulk(false)}
          onComplete={() => { setShowBulk(false); fetch() }}
        />
      )}
    </div>
  )
}

function Section({
  title,
  count,
  accent,
  materials,
  emptyText,
}: {
  title: string
  count: number
  accent: string
  materials: Material[]
  emptyText: string
}) {
  return (
    <div>
      {/* Section header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="w-1 h-8 rounded-full" style={{ background: accent }} />
        <div>
          <h2
            className="text-xl text-ink leading-none"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h2>
        </div>
        <span
          className="ml-auto text-xs font-mono font-medium px-2.5 py-1 rounded-full"
          style={{ background: accent + '18', color: accent }}
        >
          {count}
        </span>
      </div>

      {materials.length === 0 ? (
        <p className="text-sm text-muted py-8 text-center">{emptyText}</p>
      ) : (
        <div className="space-y-2">
          {materials.map(m => <MaterialCard1 key={m.id} material={m} />)}
        </div>
      )}
    </div>
  )
}

function MaterialCard1({ material }: { material: Material }) {
  const catColor = CATEGORY_COLORS[material.category]

  return (
    <Link
      to={`/materials/${material.id}`}
      className="flex items-start gap-4 bg-white rounded-xl border border-surface-2
                 px-4 py-3 hover:border-plum hover:shadow-sm transition-all group"
    >
      {/* Left accent bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-start gap-2 flex-wrap">
          <span className="font-semibold text-ink group-hover:text-primary transition-colors text-[15px]">
            {material.name}
          </span>
          {material.is_verified && (
            <span className="text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
              ✓ Verified
            </span>
          )}
        </div>

        {material.description && (
          <p className="mt-1 text-sm text-muted line-clamp-1">{material.description}</p>
        )}

        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={`text-xs font-medium px-2 py-0.5 rounded-full capitalize ${catColor}`}>
            {material.category}
          </span>
          {material.supplier && (
            <span className="text-xs text-muted">{material.supplier}</span>
          )}
          {material.typical_cost_usd != null && (
            <span className="text-xs text-muted">${material.typical_cost_usd.toFixed(2)}</span>
          )}
          {material.tags.slice(0, 3).map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-full bg-blush/40 text-plum"
              style={{ fontFamily: 'var(--font-mono)' }}
            >
              {tag}
            </span>
          ))}
          {material.tags.length > 3 && (
            <span className="text-xs text-muted">+{material.tags.length - 3}</span>
          )}
        </div>
      </div>

      {/* Arrow */}
      <svg
        className="w-4 h-4 text-muted mt-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity"
        fill="none" stroke="currentColor" viewBox="0 0 24 24"
      >
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </Link>
  )
}
