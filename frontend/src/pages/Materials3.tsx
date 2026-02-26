/**
 * Materials — Option 3: "Science Fair"
 *
 * The playful one. Big personality, fun copy, bold color blocks.
 * Equipment and Consumables each get their own strongly-branded hero header.
 * Tags are front-and-center. Cards have color and character.
 *
 * This is intentionally a little too much — pare back to taste.
 */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Material, MaterialCategory, MaterialListResponse } from '../types/material'
import BulkUploadMaterialsModal from '../components/BulkUploadMaterialsModal'

const CATEGORIES: { value: MaterialCategory; label: string; emoji: string }[] = [
  { value: 'glassware',  label: 'Glassware',  emoji: '🫙' },
  { value: 'reagent',    label: 'Reagent',    emoji: '⚗️' },
  { value: 'equipment',  label: 'Equipment',  emoji: '🔬' },
  { value: 'biological', label: 'Biological', emoji: '🧬' },
  { value: 'other',      label: 'Other',      emoji: '📦' },
]

const CATEGORY_DOT: Record<MaterialCategory, string> = {
  glassware:  'bg-sky-400',
  reagent:    'bg-amber-400',
  equipment:  'bg-emerald-400',
  biological: 'bg-violet-400',
  other:      'bg-gray-400',
}

export default function Materials3() {
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
      {/* ── Top header ── */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pt-12 pb-8">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <h1
              className="text-5xl sm:text-6xl text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Materials
            </h1>
            <p className="mt-3 text-lg text-plum max-w-sm leading-snug">
              Everything your experiment needs.{' '}
              <span className="text-muted text-base">No guarantees it fits in the budget.</span>
            </p>
          </div>

          {user && (
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <button
                onClick={() => setShowBulk(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5
                           rounded-xl border-2 border-plum text-plum text-sm font-semibold
                           hover:bg-plum hover:text-white transition-all"
              >
                {/* Upload icon */}
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
                </svg>
                Bulk upload
              </button>
              <Link
                to="/materials/new"
                className="inline-flex items-center justify-center gap-2 px-4 py-2.5
                           rounded-xl text-sm font-semibold text-white transition-all
                           hover:opacity-90 active:scale-95"
                style={{ background: 'var(--color-primary)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                    d="M12 4v16m8-8H4" />
                </svg>
                Submit material
              </Link>
            </div>
          )}
        </div>

        {/* ── Category filter ── */}
        <div className="mt-8 flex flex-wrap gap-2">
          <button
            onClick={() => setCategory('')}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium
                        border-2 transition-all ${
              category === ''
                ? 'border-ink bg-ink text-white'
                : 'border-surface-2 bg-white text-ink hover:border-ink'
            }`}
          >
            All
          </button>
          {CATEGORIES.map(c => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value === category ? '' : c.value)}
              className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium
                          border-2 transition-all ${
                category === c.value
                  ? 'border-ink bg-ink text-white'
                  : 'border-surface-2 bg-white text-ink hover:border-ink'
              }`}
            >
              <span>{c.emoji}</span> {c.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-24">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : (
        <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 pb-16 space-y-14">
          {/* ── Equipment section ── */}
          <TypeSection
            type="Equipment"
            icon={<GearIcon />}
            tagline="The tools that keep on giving."
            bannerBg="#2F1847"
            accentColor="#C1502D"
            materials={equipment}
          />

          {/* ── Consumables section ── */}
          <TypeSection
            type="Consumables"
            icon={<FlaskIcon />}
            tagline="Stuff you'll go through faster than you think."
            bannerBg="#C1502D"
            accentColor="#2F1847"
            materials={consumables}
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

function TypeSection({
  type,
  icon,
  tagline,
  bannerBg,
  accentColor,
  materials,
}: {
  type: string
  icon: React.ReactNode
  tagline: string
  bannerBg: string
  accentColor: string
  materials: Material[]
}) {
  return (
    <div>
      {/* Section hero */}
      <div
        className="rounded-2xl p-6 sm:p-8 flex items-center justify-between gap-6 mb-6"
        style={{ background: bannerBg }}
      >
        <div className="flex items-center gap-5">
          <div
            className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <span className="text-white w-7 h-7">{icon}</span>
          </div>
          <div>
            <h2
              className="text-3xl font-semibold text-white"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {type}
            </h2>
            <p className="text-white/60 text-sm mt-0.5">{tagline}</p>
          </div>
        </div>
        <div
          className="shrink-0 text-4xl font-semibold text-white/30 tabular-nums"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {materials.length}
        </div>
      </div>

      {/* Cards */}
      {materials.length === 0 ? (
        <EmptyState type={type} />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {materials.map(m => (
            <MaterialCard3 key={m.id} material={m} accentColor={accentColor} />
          ))}
        </div>
      )}
    </div>
  )
}

function MaterialCard3({
  material,
  accentColor,
}: {
  material: Material
  accentColor: string
}) {
  const catInfo = CATEGORIES.find(c => c.value === material.category)
  const dotColor = CATEGORY_DOT[material.category]

  return (
    <Link
      to={`/materials/${material.id}`}
      className="group bg-white rounded-2xl border-2 border-surface-2 p-4
                 hover:border-current hover:shadow-lg transition-all flex flex-col gap-3"
      style={{ '--tw-border-opacity': '1' } as React.CSSProperties}
    >
      {/* Category badge row */}
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1.5 text-xs font-medium text-muted">
          <span className={`w-2 h-2 rounded-full ${dotColor}`} />
          {catInfo?.emoji} {catInfo?.label ?? material.category}
        </span>
        {material.is_verified && (
          <span className="text-xs font-semibold text-emerald-600">✓ Verified</span>
        )}
      </div>

      {/* Name */}
      <p
        className="font-semibold text-ink text-[15px] leading-snug
                   group-hover:text-primary transition-colors"
      >
        {material.name}
      </p>

      {/* Description */}
      {material.description && (
        <p className="text-sm text-muted line-clamp-2 leading-snug">{material.description}</p>
      )}

      {/* Tags — very prominent */}
      {material.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {material.tags.slice(0, 5).map(tag => (
            <span
              key={tag}
              className="text-xs px-2.5 py-1 rounded-lg font-medium"
              style={{
                fontFamily: 'var(--font-mono)',
                background: accentColor + '15',
                color: accentColor,
              }}
            >
              #{tag}
            </span>
          ))}
          {material.tags.length > 5 && (
            <span className="text-xs text-muted self-center">+{material.tags.length - 5}</span>
          )}
        </div>
      )}

      {/* Bottom: supplier + cost */}
      {(material.supplier || material.typical_cost_usd != null) && (
        <div className="mt-auto pt-2 border-t border-surface flex items-center justify-between gap-2">
          {material.supplier && (
            <span className="text-xs text-muted truncate">{material.supplier}</span>
          )}
          {material.typical_cost_usd != null && (
            <span
              className="text-xs font-semibold shrink-0"
              style={{ fontFamily: 'var(--font-mono)', color: accentColor }}
            >
              ${material.typical_cost_usd.toFixed(2)}
            </span>
          )}
        </div>
      )}
    </Link>
  )
}

function EmptyState({ type }: { type: string }) {
  const msg = type === 'Equipment'
    ? "No equipment here yet. Your lab feels a little sparse."
    : "No consumables yet. Stock up — science is thirsty."
  return (
    <div className="text-center py-16 px-4">
      <div className="text-5xl mb-3">{type === 'Equipment' ? '🔬' : '🧪'}</div>
      <p className="text-muted text-sm">{msg}</p>
    </div>
  )
}

function GearIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573
           1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426
           1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37
           2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724
           1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0
           00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0
           001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07
           2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  )
}

function FlaskIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M9 3h6m-6 0v7l-4 9a1 1 0 00.9 1.45h12.2A1 1 0 0019 19l-4-9V3m-6 0h6" />
    </svg>
  )
}
