export type ExecutionStatus = 'in_progress' | 'completed' | 'cancelled'

export interface CoExperimenterEntry {
  uid: string
  displayName: string
}

export interface Execution {
  id: string
  design_id: string
  design_version: number
  design_title: string
  experimenter_uid: string
  co_experimenter_uids: string[]
  co_experimenters: CoExperimenterEntry[]
  start_date: string   // ISO string
  methodology_deviations: string
  status: ExecutionStatus
  created_at: string
  updated_at: string
}
