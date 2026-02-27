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
  userHasReviewed?: boolean
}

// ─── Form state types ─────────────────────────────────────────────────────────

export interface SuggestionEntry {
  localId: string

  // Top-level field selection
  selectedField: string       // e.g. 'title', 'steps', 'materials', ''
  useNewField: boolean        // true = user typed a custom field name
  newFieldName: string        // only used when useNewField is true

  // Sub-item selection (steps, research_questions, variables)
  selectedIndex: number | null   // 0-based index into the list; null = nothing chosen
  isAddingNewItem: boolean       // true = proposing a new item in a list field

  // Content
  proposedText: string    // free text for simple fields; pre-filled for sub-items
  comment: string
  suggestionType: SuggestionType | null

  // Materials-specific
  removeMaterialIds: string[]  // design.materials[i].material_id values checked for removal
  addMaterialText: string      // free-text description of materials to add
}
