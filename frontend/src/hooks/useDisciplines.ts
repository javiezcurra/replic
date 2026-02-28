import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Discipline } from '../types/discipline'

interface UseDisciplinesResult {
  disciplines: Discipline[]
  loading: boolean
  setDisciplines: React.Dispatch<React.SetStateAction<Discipline[]>>
}

/**
 * Fetches the admin-managed discipline list from /api/disciplines.
 * Each call creates its own fetch — use at the page/component level.
 */
export function useDisciplines(): UseDisciplinesResult {
  const [disciplines, setDisciplines] = useState<Discipline[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<{ status: string; data: Discipline[] }>('/api/disciplines')
      .then(({ data }) => setDisciplines(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  return { disciplines, loading, setDisciplines }
}
