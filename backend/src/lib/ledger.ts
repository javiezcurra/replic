/**
 * Contribution scoring ledger utilities.
 *
 * All writes are fire-and-forget: errors are logged but never propagate to the
 * caller, so a ledger write failure never breaks the main request flow.
 */
import { randomUUID } from 'crypto'
import { FieldValue } from 'firebase-admin/firestore'
import { adminDb } from './firebase'
import type { LedgerEntry, LedgerEventType } from '../types/ledger'

const LEDGER = 'contribution_ledger'

type EntryInput = Omit<LedgerEntry, 'id' | 'created_at'>

/**
 * Record a single ledger event. Fire-and-forget — never throws.
 */
export function recordEvent(input: EntryInput): void {
  const id = randomUUID()
  adminDb
    .collection(LEDGER)
    .doc(id)
    .set({
      ...input,
      id,
      created_at: FieldValue.serverTimestamp(),
    } satisfies Omit<LedgerEntry, 'created_at'> & { created_at: unknown })
    .catch((err: unknown) => console.error('[ledger] recordEvent failed:', err))
}

/**
 * Record the same event type for multiple users at once (e.g. all co-authors).
 * Each user gets their own document. Fire-and-forget — never throws.
 */
export function recordEvents(
  userIds: string[],
  eventType: LedgerEventType,
  context: Omit<EntryInput, 'user_id' | 'event_type'>,
): void {
  for (const userId of userIds) {
    recordEvent({ user_id: userId, event_type: eventType, ...context })
  }
}
