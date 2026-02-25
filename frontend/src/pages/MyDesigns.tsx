import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Design, DesignStatus } from '../types/design'

const STATUS_LABELS: Record<DesignStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  locked: 'Locked',
}

const STATUS_COLORS: Record<DesignStatus, string> = {
  draft: 'bg-yellow-50 text-yellow-700',
  published: 'bg-green-50 text-green-700',
  locked: 'bg-gray-100 text-gray-600',
}

export default function MyDesigns() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ designs: Design[] }>('/api/designs/me/list')
      .then((res) => setDesigns(res.designs))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Designs</h1>
          <p className="mt-1 text-gray-600 text-sm">All your experiment designs, including drafts.</p>
        </div>
        <Link to="/designs/new" className="btn-primary text-sm">
          + New Design
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-brand-600 border-t-transparent rounded-full animate-spin" />
        </div>
      ) : designs.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <div className="text-5xl mb-4">🧪</div>
          <h2 className="text-lg font-semibold text-gray-900">No designs yet</h2>
          <p className="mt-2 text-sm text-gray-500 max-w-sm">
            You haven't created any designs yet.{' '}
            <Link to="/designs/new" className="text-brand-600 hover:underline">Start one →</Link>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {designs.map((design) => (
            <Link
              key={design.id}
              to={`/designs/${design.id}`}
              className="block card p-5 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h3 className="font-semibold text-gray-900 truncate">{design.title}</h3>
                  <p className="mt-1 text-sm text-gray-600 line-clamp-2">{design.hypothesis}</p>
                </div>
                <span className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[design.status]}`}>
                  {STATUS_LABELS[design.status]}
                </span>
              </div>
              <div className="mt-2 flex flex-wrap gap-1.5">
                {design.discipline_tags.map((tag) => (
                  <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                    {tag}
                  </span>
                ))}
              </div>
              <p className="mt-2 text-xs text-gray-400">
                Updated {new Date(design.updated_at).toLocaleDateString()}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
