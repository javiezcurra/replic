import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../lib/api'
import type { Design } from '../types/design'
import DesignCard from '../components/DesignCard'

export default function MyDesigns() {
  const [designs, setDesigns] = useState<Design[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api.get<{ status: string; data: Design[] }>('/api/designs/me/list')
      .then((res) => setDesigns(res.data))
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="max-w-4xl mx-auto py-8 px-4">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-ink">My Designs</h1>
          <p className="mt-1 text-muted text-sm">All your experiment designs, including drafts.</p>
        </div>
        <Link to="/designs/new" className="btn-primary text-sm">
          + New Design
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-20">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : designs.length === 0 ? (
        <div className="card p-12 flex flex-col items-center text-center">
          <div className="text-5xl mb-4">🧪</div>
          <h2 className="text-lg font-semibold text-ink">No designs yet</h2>
          <p className="mt-2 text-sm text-muted max-w-sm">
            You haven't created any designs yet.{' '}
            <Link to="/designs/new" className="text-primary hover:underline">Start one →</Link>
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {designs.map((design) => (
            <DesignCard key={design.id} design={design} />
          ))}
        </div>
      )}
    </div>
  )
}
