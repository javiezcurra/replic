import { FieldValue } from 'firebase-admin/firestore'
import { randomUUID } from 'crypto'
import { adminDb } from './firebase'
import type { NotificationType, ReviewInteractionAction } from '../types/notification'

interface NotificationPayload {
  type: NotificationType
  message: string
  link: string
  actor_uid?: string
  actor_name?: string
  design_id?: string
  design_title?: string
  request_id?: string
  review_id?: string
  review_action?: ReviewInteractionAction
}

// Fire-and-forget — call without await in controllers.
export function createNotification(
  recipientUid: string,
  payload: NotificationPayload,
): void {
  const id = randomUUID()
  adminDb
    .collection('users')
    .doc(recipientUid)
    .collection('notifications')
    .doc(id)
    .set({
      id,
      read: false,
      created_at: FieldValue.serverTimestamp(),
      ...payload,
    })
    .catch((err) => {
      console.error('[notifications] Failed to create notification:', err)
    })
}

// Convenience: notify multiple recipients at once.
export function createNotifications(
  recipientUids: string[],
  payload: NotificationPayload,
): void {
  for (const uid of recipientUids) {
    createNotification(uid, payload)
  }
}

// Look up a user's cached display name for notification messages.
export async function getDisplayName(uid: string): Promise<string> {
  try {
    const snap = await adminDb.collection('users').doc(uid).get()
    return (snap.data()?.displayName as string) || 'A user'
  } catch {
    return 'A user'
  }
}
