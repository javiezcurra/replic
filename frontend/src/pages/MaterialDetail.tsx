import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { api } from '../lib/api'
import type { Material } from '../types/material'

export default function MaterialDetail() {
  const { id } = useParams<{ id: string }>()
  const [material, setMaterial] = useState<Material | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    api.get<{ status: string; data: Material }>(`/api/materials/${id}`)
      .then(({ data }) => setMaterial(data))
      .catch((err: any) => {
        if (err?.status === 404) setNotFound(true)
        else setError(err?.message ?? 'Failed to load')
      })
      .finally(() => setLoading(false))
  }, [id])

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (notFound || !material) {
    return (
      <div className="max-w-2xl mx-auto py-20 px-4 text-center">
        <p className="text-4xl mb-4">🔍</p>
        <h1 className="text-xl font-semibold text-gray-900">Material not found</h1>
        <p className="mt-2 text-sm text-gray-500">It may have been removed or the link may be incorrect.</p>
        <Link to="/materials" className="mt-4 inline-block btn-secondary text-sm">Browse materials</Link>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto py-8 px-4">
      {/* Header */}
      <div className="mb-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex flex-wrap gap-1.5 mb-2">
              <span className="text-xs bg-brand-50 text-brand-700 px-2 py-0.5 rounded-full capitalize">
                {material.type}
              </span>
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full capitalize">
                {material.category}
              </span>
              {material.is_verified && (
                <span className="text-xs bg-green-50 text-green-700 px-2 py-0.5 rounded-full">
                  Verified
                </span>
              )}
            </div>
            <h1 className="text-2xl font-bold text-gray-900">{material.name}</h1>
          </div>
        </div>
      </div>

      {error && <p className="mb-4 text-sm text-red-600">{error}</p>}

      {/* Image */}
      {material.image_url && (
        <div className="mb-4">
          <img
            src={material.image_url}
            alt={material.name}
            className="w-full max-h-64 object-contain rounded-xl border border-gray-200 bg-gray-50"
          />
        </div>
      )}

      {/* Description */}
      {material.description && (
        <section className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Description</h2>
          <p className="text-gray-800">{material.description}</p>
        </section>
      )}

      {/* Details */}
      <section className="card p-5 mb-4">
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Details</h2>
        <dl className="space-y-2 text-sm">
          <div className="flex gap-2">
            <dt className="w-32 shrink-0 text-gray-500">Unit</dt>
            <dd className="text-gray-800">{material.unit}</dd>
          </div>
          {material.supplier && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Supplier</dt>
              <dd className="text-gray-800">{material.supplier}</dd>
            </div>
          )}
          {material.typical_cost_usd != null && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Typical cost</dt>
              <dd className="text-gray-800">${material.typical_cost_usd.toFixed(2)}</dd>
            </div>
          )}
          {material.link && (
            <div className="flex gap-2">
              <dt className="w-32 shrink-0 text-gray-500">Product link</dt>
              <dd>
                <a
                  href={material.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-brand-600 hover:underline break-all"
                >
                  {material.link}
                </a>
              </dd>
            </div>
          )}
        </dl>
      </section>

      {/* Safety notes */}
      {material.safety_notes && (
        <section className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">Safety Notes</h2>
          <p className="text-gray-800 text-sm whitespace-pre-line">{material.safety_notes}</p>
        </section>
      )}

      {/* Tags */}
      {material.tags.length > 0 && (
        <section className="card p-5 mb-4">
          <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-3">Tags</h2>
          <div className="flex flex-wrap gap-1.5">
            {material.tags.map((tag) => (
              <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {tag}
              </span>
            ))}
          </div>
        </section>
      )}

      <Link to="/materials" className="text-sm text-brand-600 hover:underline">
        ← Back to materials
      </Link>
    </div>
  )
}
