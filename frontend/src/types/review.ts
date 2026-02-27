export type ReviewDocStatus  = 'active' | 'resolved' | 'superseded' | 'locked'
export type SuggestionStatus = 'open' | 'accepted' | 'closed' | 'superseded' | 'locked'
export type ReadinessSignal  = 'ready' | 'almost_ready' | 'needs_revision'
export type SuggestionType   = 'suggestion' | 'issue' | 'question' | 'safety_concern'

export interface FieldSuggestion {
  id: string
  reviewId: string
  designId: string
  versionNumber: number
  fieldRef: string | null
  newFieldName: string | null
  proposedText: string | null
  comment: string | null
  suggestionType: SuggestionType | null
  status: SuggestionStatus
  ownerReply: string | null
  createdAt: string
  updatedAt: string
}

export interface Review {
  id: string
  designId: string
  versionNumber: number
  reviewerId: string
  generalComment: string | null
  readinessSignal: ReadinessSignal | null
  endorsement: boolean
  status: ReviewDocStatus
  createdAt: string
  updatedAt: string
  suggestions: FieldSuggestion[]
}

export interface ContributingReviewer {
  designId: string
  userId: string
  versionNumber: number
  acceptedSuggestionIds: string[]
  endorsedAndExecuted: boolean
}

export interface ReviewSummary {
  endorsementCount: number
  reviewCount: number
  contributingReviewers: ContributingReviewer[]
  versionNumber: number
  isLocked: boolean
  reviewable: boolean
}

// ─── Form state types ─────────────────────────────────────────────────────────

export interface SuggestionEntry {
  localId: string           // React key only
  fieldRef: string          // '' when useNewField is true
  useNewField: boolean
  newFieldName: string
  proposedText: string
  comment: string
  suggestionType: SuggestionType | null
}
