import { Timestamp } from 'firebase-admin/firestore'

export interface UserScores {
  designer: number
  experimenter: number
  reviewer: number
}

export type UserRole =
  | 'citizen_scientist'
  | 'student'
  | 'teacher'
  | 'professional_researcher'
  | 'industry_professional'
  | 'hobbyist'
  | 'other'

export const USER_ROLES: { value: UserRole; label: string }[] = [
  { value: 'citizen_scientist',    label: 'Citizen Scientist' },
  { value: 'student',              label: 'Student' },
  { value: 'teacher',              label: 'Teacher / Educator' },
  { value: 'professional_researcher', label: 'Professional Researcher' },
  { value: 'industry_professional',label: 'Industry Professional' },
  { value: 'hobbyist',             label: 'Hobbyist' },
  { value: 'other',                label: 'Other' },
]

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  bio: string | null
  affiliation: string | null
  role: UserRole | null
  is_admin: boolean
  discoverable: boolean
  scores: UserScores
  createdAt: Timestamp
  updatedAt: Timestamp
}

// ── Collaboration ─────────────────────────────────────────────────────────────

export type CollaborationStatus = 'pending' | 'accepted' | 'declined'

export interface CollaborationRequest {
  id: string
  fromUid: string
  toUid: string
  status: CollaborationStatus
  createdAt: string
  updatedAt: string
}

export interface CollaborationRequestWithSender extends CollaborationRequest {
  sender: UserSearchResult
}

export interface CollaboratorEntry {
  uid: string
  displayName: string
  affiliation: string | null
  role: UserRole | null
  since: string
}

export interface UserRelationship {
  isCollaborator: boolean
  pendingRequestId: string | null
  pendingDirection: 'incoming' | 'outgoing' | null
}

export interface UserSearchResult {
  uid: string
  displayName: string
  affiliation: string | null
  role: UserRole | null
}

export interface UserProfileResponse extends Omit<UserProfile, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
}

export type PublicUserProfileResponse = Omit<UserProfileResponse, 'email'>

export interface UpdateUserBody {
  displayName?: string
  photoURL?: string | null
  bio?: string | null
  affiliation?: string | null
  role?: UserRole | null
  discoverable?: boolean
  /** Dev-only self-promotion toggle — remove before production hardening */
  is_admin?: boolean
}
