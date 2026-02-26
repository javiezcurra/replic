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
  supplier?: string
  unit: string             // default "unit"; e.g. mL, g, unit
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
  unit?: string
  description?: string
  link?: string
  supplier?: string
  typical_cost_usd?: number
  safety_notes?: string
  tags?: string[]
}

// ─── API response types ───────────────────────────────────────────────────────

export interface MaterialResponse extends Omit<Material, 'created_at' | 'updated_at'> {
  created_at: string
  updated_at: string
}
