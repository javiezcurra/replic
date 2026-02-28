export type NotificationType =
  | 'collaboration_request_received'
  | 'collaboration_request_accepted'
  | 'added_to_experiment'
  | 'removed_from_experiment'
  | 'experiment_review_received'
  | 'experiment_new_version_coauthor'
  | 'watchlist_new_version'
  | 'review_interaction'
  | 'admin_granted'
  | 'admin_revoked'

export type ReviewInteractionAction = 'accepted' | 'closed' | 'replied'

export interface Notification {
  id: string
  type: NotificationType
  read: boolean
  message: string
  link: string
  actor_uid?: string
  actor_name?: string
  design_id?: string
  design_title?: string
  request_id?: string
  review_id?: string
  review_action?: ReviewInteractionAction
  created_at: string
}
