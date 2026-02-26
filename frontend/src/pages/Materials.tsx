import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type { Material, MaterialCategory, MaterialListResponse } from '../types/material'

const CATEGORY_OPTIONS: { value: MaterialCategory; label: string }[] = [
  { value: 'glassware', label: 'Glassware' },
  { value: 'reagent', label: 'Reagent' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'biological', label: 'Biological' },
  { value: 'other', label: 'Other' },
]

export default function Materials() {
  const { user } = useAuth()
  const [materials, setMaterials] = useState<Material[]>([])
  const [cursor, setCursor] = useState<string | undefined>()
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [category, setCategory] = useState('')

  function buildQuery(after?: string) {
    const params = new URLSearchParams()
    if (category) params.set('category', category)
    if (after) params.set('after', after)
    const qs = params.toString()
    return `/api/materials${qs ? `?${qs}` : ''}`
  }

  async function fetchMaterials() {
    setLoading(true)
    try {
      const res = await api.get<MaterialListResponse>(buildQuery())
      setMaterials(res.data)
      setCursor(res.data.length === 20 ? res.data[res.data.length - 1]?.id : undefined)
    } finally {
      setLoading(false)
    }
  }

  async function loadMore() {
    if (!cursor) return
    setLoadingMore(true)
    try {
      const res = await api.get<MaterialListResponse>(buildQuery(cursor))
      setMaterials((prev) => [...prev, ...res.data])
      setCursor(res.data.length === 20 ? res.data[res.data.length - 1]?.id : undefined)
    } finally {
      setLoadingMore(false)
    }
  }

  useEffect(() => {
    fetchMaterials()
  }, [category])

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Materials</h1>
          <p className="mt-2 text-gray-600">Browse the catalog of consumables and equipment used in experiment designs.</p>
        </div>
        {user && (
          <Link to="/materials/new" className="btn-primary text-sm shrink-0">
            Submit material
          </Link>
        )}
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-6">
        <select
          value={category}
          onChange={(e) => setCategory(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
        >
          <option value="">All categories</option>
          {CATEGORY_OPTIONS.map(({ value, label }) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : materials.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <div className="text-5xl mb-4">🧪</div>
          <h2 className="text-lg font-semibold text-gray-900">No materials found</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            Try adjusting your filters or check back soon.
          </p>
        </div>
      ) : (
        <>
          <div className="space-y-3">
            {materials.map((material) => (
              <MaterialCard key={material.id} material={material} />
            ))}
          </div>

          {cursor && (
            <div className="mt-6 text-center">
              <button
                onClick={loadMore}
                disabled={loadingMore}
                className="btn-secondary text-sm disabled:opacity-50"
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function MaterialCard({ material }: { material: Material }) {
  return (
    <Link
      to={`/materials/${material.id}`}
      className="block card p-5 hover:shadow-md transition-shadow"
    >
      <div className="flex items-start gap-4">
        {material.image_url && (
          <img
            src={material.image_url}
            alt={material.name}
            className="h-14 w-14 object-cover rounded-lg border border-gray-200 shrink-0"
          />
        )}
        <div className="flex-1 min-w-0 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="font-semibold text-gray-900">{material.name}</h3>
              {material.is_verified && (
                <span className="text-xs font-medium bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              )}
            </div>
            {material.description && (
              <p className="mt-1 text-sm text-gray-600 line-clamp-2">{material.description}</p>
            )}
          </div>
          <span className="shrink-0 text-xs font-medium bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full capitalize">
            {material.type}
          </span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-gray-500">
        <span className="capitalize">{material.category}</span>
        <span>·</span>
        <span>{material.unit}</span>
        {material.typical_cost_usd != null && (
          <>
            <span>·</span>
            <span>${material.typical_cost_usd.toFixed(2)}</span>
          </>
        )}
        {material.supplier && (
          <>
            <span>·</span>
            <span>{material.supplier}</span>
          </>
        )}
      </div>

      {material.tags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1.5">
          {material.tags.map((tag) => (
            <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
              {tag}
            </span>
          ))}
        </div>
      )}
    </Link>
  )
}
