import { Timestamp } from 'firebase-admin/firestore'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type MaterialType = 'Consumable' | 'Equipment'

export type MaterialCategory = 'glassware' | 'reagent' | 'equipment' | 'biological' | 'other'

// ─── Primary document ─────────────────────────────────────────────────────────

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
  tags: string[]           // searchable tags, max 10
  is_verified: boolean     // admin-approved canonical entry; always false for user-created
  created_by: string       // Firebase UID
  created_at: Timestamp
  updated_at: Timestamp
}

// ─── API request bodies ───────────────────────────────────────────────────────

export interface CreateMaterialBody {
  name: string
  type: MaterialType
  category: MaterialCategory
  description?: string
  link?: string
  image_url?: string
  supplier?: string
  typical_cost_usd?: number
  safety_notes?: string
  tags?: string[]
}

export interface UpdateMaterialBody {
  name?: string
  type?: MaterialType
  category?: MaterialCategory
  description?: string | null
  link?: string | null
  image_url?: string | null
  supplier?: string | null
  typical_cost_usd?: number | null
  safety_notes?: string | null
  tags?: string[]
  is_verified?: boolean
}

// ─── API response types ───────────────────────────────────────────────────────

export interface MaterialResponse extends Omit<Material, 'created_at' | 'updated_at'> {
  created_at: string
  updated_at: string
}
