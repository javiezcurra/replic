import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Category } from '../types/category'

interface UseCategoriesResult {
  categories: Category[]
  loading: boolean
  /** Replace the entire category list (call after admin CRUD). */
  setCategories: React.Dispatch<React.SetStateAction<Category[]>>
}

/**
 * Fetches the admin-managed category list from /api/categories.
 * Each call creates its own fetch — use at the page/component level.
 */
export function useCategories(): UseCategoriesResult {
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    api
      .get<{ status: string; data: Category[] }>('/api/categories')
      .then(({ data }) => setCategories(data))
      .catch(() => {
        // Fallback to empty list; UI should handle gracefully
      })
      .finally(() => setLoading(false))
  }, [])

  return { categories, loading, setCategories }
}
