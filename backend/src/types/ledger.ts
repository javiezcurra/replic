/**
 * Contribution scoring ledger types.
 *
 * Each LedgerEntry records a single scoring event for a single user.
 * Multi-author events (e.g. DESIGN_PUBLISHED with several co-authors) produce
 * one LedgerEntry per beneficiary.
 */

export type LedgerEventType =
  /** A design version was published. Awarded to every author/co-author. */
  | 'DESIGN_PUBLISHED'
  /** A review with endorsement=true was submitted on a design. Awarded to every author/co-author. */
  | 'DESIGN_ENDORSED'
  /** A newly-published design lists this design as a reference. Awarded to every author/co-author of the referenced design. */
  | 'DESIGN_REFERENCED_BY_DESIGN'
  /** A fork of a design was created. Awarded to every author/co-author of the parent. */
  | 'DESIGN_DERIVED_CREATED'
  /** A review was submitted (new, not an update). Awarded to the reviewer. */
  | 'DESIGN_REVIEW_SUBMITTED'
  /** A field suggestion was accepted by the design owner. Awarded to the reviewer who authored the suggestion. */
  | 'REVIEW_SUGGESTION_ACCEPTED_ON_DESIGN'
  /** A new design version was published and at least one of the reviewer's suggestions had been accepted. Awarded once per reviewer per published version. */
  | 'DESIGN_VERSION_PUBLISHED_WITH_ACCEPTED_SUGGESTION'
  /** A suggestion with suggestionType='safety_concern' was accepted. Awarded to the reviewer. */
  | 'SAFETY_SUGGESTION_ACCEPTED'

export interface LedgerEntry {
  /** Auto-assigned Firestore doc id */
  id: string
  /** The user who receives credit for this event */
  user_id: string
  event_type: LedgerEventType
  /** ISO 8601 timestamp — set by the server via FieldValue.serverTimestamp() */
  created_at: FirebaseFirestore.Timestamp
  /** The design this event relates to (if applicable) */
  design_id?: string
  /** The published version number this event relates to (if applicable) */
  design_version?: number
  /** The review this event relates to (if applicable) */
  review_id?: string
  /** The suggestion this event relates to (if applicable) */
  suggestion_id?: string
  /** For DESIGN_REFERENCED_BY_DESIGN: the design whose publication triggered the event */
  referencing_design_id?: string
  /** For DESIGN_DERIVED_CREATED: the newly-created fork */
  fork_design_id?: string
}
