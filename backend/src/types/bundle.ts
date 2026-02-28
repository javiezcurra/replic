import { Timestamp } from 'firebase-admin/firestore'

export interface Bundle {
  id: string
  name: string
  description: string
  material_ids: string[]
  created_at: Timestamp
  updated_at: Timestamp
}

export interface BundleResponse extends Omit<Bundle, 'created_at' | 'updated_at'> {
  created_at: string
  updated_at: string
}

export interface CreateBundleBody {
  name: string
  description?: string
  material_ids?: string[]
}

export interface UpdateBundleBody {
  name?: string
  description?: string
  material_ids?: string[]
}
