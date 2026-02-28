import { Timestamp } from 'firebase-admin/firestore'

export type ExecutionStatus = 'in_progress' | 'completed' | 'cancelled'

export interface CoExperimenterEntry {
  uid: string
  displayName: string
}

export interface Execution {
  id: string
  design_id: string
  design_version: number     // published_version at the time execution was started
  design_title: string       // denormalized for display
  experimenter_uid: string   // immutable — the user who started the execution
  co_experimenter_uids: string[]
  co_experimenters: CoExperimenterEntry[]
  start_date: Timestamp
  methodology_deviations: string
  status: ExecutionStatus

  created_at: Timestamp
  updated_at: Timestamp
}

export interface ExecutionResponse extends Omit<Execution, 'start_date' | 'created_at' | 'updated_at'> {
  start_date: string
  created_at: string
  updated_at: string
}

export interface UpdateExecutionBody {
  co_experimenter_uids?: string[]
  co_experimenters?: CoExperimenterEntry[]
  start_date?: string   // ISO string — user-supplied execution date
  methodology_deviations?: string
}
