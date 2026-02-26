import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Material, MaterialCategory, MaterialListResponse } from '../types/material'
import BulkUploadMaterialsModal from '../components/BulkUploadMaterialsModal'

const CATEGORIES: { value: MaterialCategory; label: string; emoji: string }[] = [
  { value: 'glassware',  label: 'Glassware',   emoji: '🫙' },
  { value: 'reagent',    label: 'Reagent',     emoji: '⚗️' },
  { value: 'equipment',  label: 'Instruments', emoji: '🔬' },
  { value: 'biological', label: 'Biological',  emoji: '🧬' },
  { value: 'other',      label: 'Other',       emoji: '📦' },
]

export default function Materials() {
  const { user } = useAuth()
  const [all, setAll] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [category, setCategory] = useState('')
  const [showBulkUpload, setShowBulkUpload] = useState(false)

  async function fetchMaterials() {
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

  useEffect(() => { fetchMaterials() }, [category])  // eslint-disable-line react-hooks/exhaustive-deps

  const equipment   = all.filter(m => m.type === 'Equipment')
  const consumables = all.filter(m => m.type === 'Consumable')

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>

      {/* ── Page header ── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-6">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1
              className="text-5xl sm:text-6xl text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Materials
            </h1>
            <p className="mt-2 text-lg text-plum max-w-sm">
              Everything your experiment needs.{' '}
              <span className="text-muted text-base">No guarantees it fits in the budget.</span>
            </p>
          </div>

          {user && (
            <div className="flex items-center gap-2 shrink-0">
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
              <Link
                to="/materials/new"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl
                           text-sm font-semibold text-white hover:opacity-90 transition-all"
                style={{ background: 'var(--color-primary)' }}
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                </svg>
                Submit material
              </Link>
            </div>
          )}
        </div>

        {/* ── Category pill filters ── */}
        <div className="mt-6 flex flex-wrap gap-2">
          <CategoryPill label="All" active={category === ''} onClick={() => setCategory('')} />
          {CATEGORIES.map(c => (
            <CategoryPill
              key={c.value}
              label={`${c.emoji} ${c.label}`}
              active={category === c.value}
              onClick={() => setCategory(category === c.value ? '' : c.value)}
            />
          ))}
        </div>

        {/* ── Mobile jump links (hidden on lg+) ── */}
        <div className="mt-4 flex gap-3 lg:hidden">
          <a
            href="#section-equipment"
            className="inline-flex items-center gap-1 text-sm font-medium text-white
                       px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: 'var(--color-dark)' }}
          >
            ↓ Equipment
          </a>
          <a
            href="#section-consumables"
            className="inline-flex items-center gap-1 text-sm font-medium text-white
                       px-3 py-1.5 rounded-lg hover:opacity-80 transition-opacity"
            style={{ background: 'var(--color-primary)' }}
          >
            ↓ Consumables
          </a>
        </div>
      </div>

      {/* ── Sections ── */}
      {loading ? (
        <div className="flex justify-center py-24">
          <div
            className="w-8 h-8 border-4 rounded-full animate-spin"
            style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
          />
        </div>
      ) : (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pb-16">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <MaterialsSection
              id="section-equipment"
              title="Equipment"
              subtitle="The tools that keep on giving."
              icon={<GearIcon />}
              bannerBg="var(--color-dark)"
              accentColor="var(--color-primary)"
              materials={equipment}
              emptyMsg="No equipment here yet. Your lab feels a little sparse."
              emptyEmoji="🔬"
            />
            <MaterialsSection
              id="section-consumables"
              title="Consumables"
              subtitle="Stuff you'll go through faster than you think."
              icon={<FlaskIcon />}
              bannerBg="var(--color-primary)"
              accentColor="var(--color-dark)"
              materials={consumables}
              emptyMsg="No consumables yet. Stock up — science is thirsty."
              emptyEmoji="🧪"
            />
          </div>
        </div>
      )}

      {showBulkUpload && (
        <BulkUploadMaterialsModal
          onClose={() => setShowBulkUpload(false)}
          onComplete={() => { setShowBulkUpload(false); fetchMaterials() }}
        />
      )}
    </div>
  )
}

function CategoryPill({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium
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

function MaterialsSection({
  id,
  title,
  subtitle,
  icon,
  bannerBg,
  accentColor,
  materials,
  emptyMsg,
  emptyEmoji,
}: {
  id: string
  title: string
  subtitle: string
  icon: React.ReactNode
  bannerBg: string
  accentColor: string
  materials: Material[]
  emptyMsg: string
  emptyEmoji: string
}) {
  return (
    <div id={id} className="flex flex-col">
      {/* Hero banner */}
      <div
        className="rounded-2xl px-6 py-5 flex items-center justify-between gap-4 mb-4"
        style={{ background: bannerBg }}
      >
        <div className="flex items-center gap-4">
          <div
            className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
            style={{ background: 'rgba(255,255,255,0.12)' }}
          >
            <span className="text-white w-6 h-6">{icon}</span>
          </div>
          <div>
            <h2
              className="text-2xl font-semibold text-white leading-tight"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              {title}
            </h2>
            <p className="text-white/60 text-sm">{subtitle}</p>
          </div>
        </div>
        <span
          className="text-white/40 text-3xl font-semibold tabular-nums shrink-0"
          style={{ fontFamily: 'var(--font-mono)' }}
        >
          {materials.length}
        </span>
      </div>

      {/* Card list */}
      {materials.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center py-12 text-center">
          <div className="text-5xl mb-3">{emptyEmoji}</div>
          <p className="text-muted text-sm">{emptyMsg}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {materials.map(m => (
            <MaterialCard key={m.id} material={m} accentColor={accentColor} />
          ))}
        </div>
      )}
    </div>
  )
}

function MaterialCard({ material, accentColor }: { material: Material; accentColor: string }) {
  const catInfo = CATEGORIES.find(c => c.value === material.category)

  return (
    <Link
      to={`/materials/${material.id}`}
      className="group bg-white rounded-2xl border-2 border-surface-2 px-4 py-3
                 hover:border-plum hover:shadow-md transition-all flex flex-col gap-2"
    >
      <div className="flex items-center justify-between">
        <span className="flex items-center gap-1 text-xs font-medium text-muted">
          {catInfo?.emoji} {catInfo?.label ?? material.category}
        </span>
        {material.is_verified && (
          <span className="text-xs font-semibold text-emerald-600">✓ Verified</span>
        )}
      </div>

      <p className="font-semibold text-ink text-[15px] leading-snug group-hover:text-primary transition-colors">
        {material.name}
      </p>

      {material.description && (
        <p className="text-sm text-muted line-clamp-1">{material.description}</p>
      )}

      {material.tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {material.tags.slice(0, 4).map(tag => (
            <span
              key={tag}
              className="text-xs px-2 py-0.5 rounded-lg font-medium"
              style={{ fontFamily: 'var(--font-mono)', background: accentColor + '18', color: accentColor }}
            >
              #{tag}
            </span>
          ))}
          {material.tags.length > 4 && (
            <span className="text-xs text-muted self-center">+{material.tags.length - 4}</span>
          )}
        </div>
      )}

      {(material.supplier || material.typical_cost_usd != null) && (
        <div className="pt-1 border-t border-surface flex items-center justify-between gap-2">
          {material.supplier && <span className="text-xs text-muted truncate">{material.supplier}</span>}
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

function GearIcon() {
  return (
    <svg fill="none" stroke="currentColor" viewBox="0 0 24 24" className="w-full h-full">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
        d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94
           3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724
           1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572
           1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31
           -.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724
           1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
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
