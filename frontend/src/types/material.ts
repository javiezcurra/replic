export type MaterialType = 'Consumable' | 'Equipment'

/** Dynamically managed — see /api/categories. Value is the category slug (e.g. 'glassware'). */
export type MaterialCategory = string

export interface Material {
  id: string
  name: string
  type: MaterialType
  description?: string
  category: MaterialCategory
  link?: string
  image_url?: string
  supplier?: string
  typical_cost_usd?: number
  safety_notes?: string
  tags: string[]
  is_verified: boolean
  created_by: string
  created_at: string
  updated_at: string
}

export interface MaterialListResponse {
  status: string
  data: Material[]
  count: number
}
