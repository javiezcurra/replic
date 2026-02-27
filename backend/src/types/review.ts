import { Timestamp } from 'firebase-admin/firestore'

// ─── Enums ────────────────────────────────────────────────────────────────────

// Status of a Review document (distinct from the design's aggregate review_status)
export type ReviewDocStatus  = 'active' | 'resolved' | 'superseded' | 'locked'
export type SuggestionStatus = 'open' | 'accepted' | 'closed' | 'superseded' | 'locked'
export type ReadinessSignal  = 'ready' | 'almost_ready' | 'needs_revision'
export type SuggestionType   = 'suggestion' | 'issue' | 'question' | 'safety_concern'

// ─── Firestore document shapes ────────────────────────────────────────────────
// Path: designs/{designId}/reviews/{reviewId}

export interface Review {
  id: string
  designId: string
  versionNumber: number
  reviewerId: string
  generalComment: string | null
  readinessSignal: ReadinessSignal | null
  endorsement: boolean
  status: ReviewDocStatus
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Path: designs/{designId}/reviews/{reviewId}/suggestions/{suggestionId}

export interface FieldSuggestion {
  id: string
  reviewId: string
  designId: string
  versionNumber: number
  fieldRef: string | null       // null = proposed new field
  newFieldName: string | null   // set when fieldRef is null
  proposedText: string | null
  comment: string | null
  suggestionType: SuggestionType | null
  status: SuggestionStatus
  ownerReply: string | null
  createdAt: Timestamp
  updatedAt: Timestamp
}

// Path: designs/{designId}/contributors/{userId}

export interface ContributingReviewer {
  designId: string
  userId: string
  versionNumber: number
  acceptedSuggestionIds: string[]
  endorsedAndExecuted: boolean
}

// ─── API request bodies ───────────────────────────────────────────────────────

export interface CreateSuggestionBody {
  fieldRef?: string | null
  newFieldName?: string | null
  proposedText?: string | null
  comment?: string | null
  suggestionType?: SuggestionType | null
}

export interface CreateReviewBody {
  generalComment?: string | null
  readinessSignal?: ReadinessSignal | null
  endorsement?: boolean
  suggestions?: CreateSuggestionBody[]
}

export interface CreateEndorsementBody {
  comment: string
}

// ─── API response types ───────────────────────────────────────────────────────

export interface FieldSuggestionResponse extends Omit<FieldSuggestion, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
}

export interface ReviewResponse extends Omit<Review, 'createdAt' | 'updatedAt'> {
  createdAt: string
  updatedAt: string
  suggestions: FieldSuggestionResponse[]
}

export interface ReviewSummary {
  endorsementCount: number
  reviewCount: number
  contributingReviewers: ContributingReviewer[]
  versionNumber: number
  isLocked: boolean
  reviewable: boolean
  userHasReviewed?: boolean
}
