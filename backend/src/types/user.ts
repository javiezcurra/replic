import { firestore } from 'firebase-admin'

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
  createdAt: firestore.Timestamp
  updatedAt: firestore.Timestamp
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
