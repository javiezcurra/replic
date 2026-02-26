/**
 * Materials — Option 2: "Science Catalog"
 *
 * Structured, information-dense. Dark indigo hero banner, then two stacked
 * color-coded sections (Equipment / Consumables) each with a full card grid.
 * Functional and confident — feels like a proper lab inventory.
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

const CATEGORY_EMOJI: Record<MaterialCategory, string> = {
  glassware:  '🫙',
  reagent:    '⚗️',
  equipment:  '🔬',
  biological: '🧬',
  other:      '📦',
}

export default function Materials2() {
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
    <div className="min-h-screen bg-gray-50">
      {/* ── Hero banner ── */}
      <div style={{ background: 'var(--color-dark)' }} className="text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <div className="flex flex-wrap items-center justify-between gap-6">
            <div>
              <p
                className="text-xs tracking-widest uppercase mb-2 opacity-50"
                style={{ fontFamily: 'var(--font-mono)' }}
              >
                Lab inventory
              </p>
              <h1
                className="text-4xl sm:text-5xl font-semibold leading-tight"
                style={{ fontFamily: 'var(--font-display)' }}
              >
                Materials
              </h1>
              <p className="mt-2 text-white/60 text-sm max-w-sm">
                A community-maintained catalog of consumables and equipment.
              </p>
            </div>

            {/* Stat + actions */}
            <div className="flex flex-col items-end gap-4">
              <div className="flex gap-6 text-right">
                <div>
                  <div
                    className="text-3xl font-semibold"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {loading ? '—' : equipment.length}
                  </div>
                  <div className="text-xs text-white/50 uppercase tracking-wide">Equipment</div>
                </div>
                <div>
                  <div
                    className="text-3xl font-semibold"
                    style={{ fontFamily: 'var(--font-mono)' }}
                  >
                    {loading ? '—' : consumables.length}
                  </div>
                  <div className="text-xs text-white/50 uppercase tracking-wide">Consumables</div>
                </div>
              </div>
              {user && (
                <div className="flex gap-2">
                  <button
                    onClick={() => setShowBulk(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg border
                               border-white/30 text-white text-sm font-medium
                               hover:bg-white/10 transition-colors"
                  >
                    Bulk upload
                  </button>
                  <Link
                    to="/materials/new"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg
                               text-sm font-medium transition-colors"
                    style={{ background: 'var(--color-primary)', color: 'white' }}
                  >
                    Submit material
                  </Link>
                </div>
              )}
            </div>
          </div>

          {/* Category filter tabs */}
          <div className="mt-8 flex flex-wrap gap-2">
            <button
              onClick={() => setCategory('')}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                category === ''
                  ? 'bg-white text-dark'
                  : 'text-white/70 hover:text-white hover:bg-white/10'
              }`}
            >
              All categories
            </button>
            {CATEGORIES.map(c => (
              <button
                key={c.value}
                onClick={() => setCategory(c.value === category ? '' : c.value)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  category === c.value
                    ? 'bg-white text-dark'
                    : 'text-white/70 hover:text-white hover:bg-white/10'
                }`}
              >
                {CATEGORY_EMOJI[c.value]} {c.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Content ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 space-y-12">
          <CatalogSection
            title="Equipment"
            subtitle="Reusable tools and instruments"
            materials={equipment}
            bannerColor="#2F1847"
            tagColor="#C1502D"
          />
          <CatalogSection
            title="Consumables"
            subtitle="Single-use and replenishable supplies"
            materials={consumables}
            bannerColor="#624763"
            tagColor="#C1502D"
          />
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

function CatalogSection({
  title,
  subtitle,
  materials,
  bannerColor,
  tagColor,
}: {
  title: string
  subtitle: string
  materials: Material[]
  bannerColor: string
  tagColor: string
}) {
  return (
    <div>
      {/* Section header bar */}
      <div
        className="rounded-xl px-5 py-4 flex items-center justify-between mb-5"
        style={{ background: bannerColor }}
      >
        <div>
          <h2
            className="text-xl font-semibold text-white leading-tight"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h2>
          <p className="text-white/60 text-sm mt-0.5">{subtitle}</p>
        </div>
        <span
          className="text-white/90 text-lg font-semibold tabular-nums"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {materials.length}
        </span>
      </div>

      {materials.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">Nothing here yet.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
          {materials.map(m => (
            <MaterialCard2 key={m.id} material={m} tagColor={tagColor} />
          ))}
        </div>
      )}
    </div>
  )
}

function MaterialCard2({
  material,
  tagColor,
}: {
  material: Material
  tagColor: string
}) {
  return (
    <Link
      to={`/materials/${material.id}`}
      className="group bg-white rounded-xl border border-gray-200 p-4
                 hover:shadow-md hover:border-gray-300 transition-all flex flex-col gap-3"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-ink group-hover:text-primary transition-colors leading-snug">
            {material.name}
          </p>
          {material.supplier && (
            <p className="text-xs text-muted mt-0.5">{material.supplier}</p>
          )}
        </div>
        {material.is_verified && (
          <span className="shrink-0 text-xs font-medium bg-emerald-50 text-emerald-700 px-2 py-0.5 rounded-full">
            ✓
          </span>
        )}
      </div>

      {/* Description */}
      {material.description && (
        <p className="text-sm text-muted line-clamp-2 leading-snug">{material.description}</p>
      )}

      {/* Bottom metadata */}
      <div className="mt-auto pt-2 border-t border-gray-100 flex items-center justify-between gap-2">
        <span className="text-xs font-medium capitalize text-muted">{material.category}</span>
        {material.typical_cost_usd != null && (
          <span
            className="text-xs font-medium"
            style={{ fontFamily: 'var(--font-mono)', color: tagColor }}
          >
            ${material.typical_cost_usd.toFixed(2)}
          </span>
        )}
      </div>

      {/* Tags */}
      {material.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {material.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-md"
              style={{
                fontFamily: 'var(--font-mono)',
                background: '#EABFCB40',
                color: '#624763',
              }}
            >
              {tag}
            </span>
          ))}
          {material.tags.length > 4 && (
            <span className="text-xs text-muted">+{material.tags.length - 4}</span>
          )}
        </div>
      )}
    </Link>
  )
}
