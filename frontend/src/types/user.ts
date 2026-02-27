export type UserRole =
  | 'citizen_scientist'
  | 'student'
  | 'teacher'
  | 'professional_researcher'
  | 'industry_professional'
  | 'hobbyist'
  | 'other'

export const USER_ROLE_LABELS: Record<UserRole, string> = {
  citizen_scientist:       'Citizen Scientist',
  student:                 'Student',
  teacher:                 'Teacher / Educator',
  professional_researcher: 'Professional Researcher',
  industry_professional:   'Industry Professional',
  hobbyist:                'Hobbyist',
  other:                   'Other',
}

export interface UserPublicProfile {
  uid: string
  displayName: string
  photoURL: string | null
  bio: string | null
  affiliation: string | null
  role: UserRole | null
  is_admin: boolean
  scores: { designer: number; experimenter: number; reviewer: number }
  createdAt: string
  updatedAt: string
}
