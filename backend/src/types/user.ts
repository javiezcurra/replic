import { Timestamp } from 'firebase-admin/firestore'

export interface UserScores {
  designer: number
  experimenter: number
  reviewer: number
}

export interface UserProfile {
  uid: string
  displayName: string
  email: string
  photoURL: string | null
  bio: string | null
  affiliation: string | null
  scores: UserScores
  createdAt: Timestamp
  updatedAt: Timestamp
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
}
