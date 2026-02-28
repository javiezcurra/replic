import { Timestamp } from 'firebase-admin/firestore'

// ─── Enums ────────────────────────────────────────────────────────────────────

export type DifficultyLevel =
  | 'Pre-K'
  | 'Elementary'
  | 'Middle School'
  | 'High School'
  | 'Undergraduate'
  | 'Graduate'
  | 'Professional'

export type DesignStatus = 'draft' | 'published' | 'locked'

export type ReviewStatus = 'unreviewed' | 'under_review' | 'reviewed' | 'flagged'

export type ForkType = 'iteration' | 'adaptation' | 'replication'

export type VariableType = 'continuous' | 'discrete' | 'categorical'

export type DataType = 'numeric' | 'categorical' | 'image' | 'text' | 'other'

export type Criticality = 'required' | 'recommended' | 'optional'

export type RiskLevel = 'none' | 'low' | 'moderate' | 'high'

// ─── Sub-document types ───────────────────────────────────────────────────────

export interface DesignFile {
  name: string
  url: string
  size: number  // bytes
}

export interface DesignStep {
  step_number: number
  instruction: string
  duration_minutes?: number
  safety_notes?: string
}

export interface DesignMaterial {
  material_id: string
  quantity: string
  alternatives_allowed: boolean
  criticality: Criticality
  usage_notes?: string
  estimated_cost_usd?: number
}

export interface ResearchQuestion {
  id: string               // stable UUID, referenced by Executions
  question: string
  expected_data_type: DataType
  measurement_unit?: string
  success_criteria?: string
}

export interface Variable {
  name: string
  type: VariableType
  values_or_range: string
  units?: string
}

export interface DesignReference {
  citation: string
  url?: string
  doi?: string
  relevance_note?: string
}

export interface SafetyRequirements {
  risk_level: RiskLevel
  ppe_required: string[]
  supervision_required: boolean
  hazards?: string
}

export interface EstimatedDuration {
  setup_minutes?: number
  execution_minutes?: number
  analysis_minutes?: number
  total_days?: number
}

export interface ForkMetadata {
  parent_design_id: string
  fork_generation: number   // 0 = original, 1 = direct fork, etc.
  fork_type: ForkType
  fork_rationale: string
}

// ─── Primary document ─────────────────────────────────────────────────────────

export interface Design {
  id: string

  // Core required fields
  title: string
  summary: string
  hypothesis?: string
  discipline_tags: string[]           // max 5
  difficulty_level: DifficultyLevel

  // Methodology
  steps: DesignStep[]
  materials: DesignMaterial[]
  research_questions: ResearchQuestion[]
  independent_variables: Variable[]
  dependent_variables: Variable[]
  controlled_variables: Variable[]

  // Media & files
  cover_image_url?: string
  design_files: DesignFile[]

  // Optional advanced fields
  safety_considerations?: string
  reference_experiment_ids: string[]
  parent_designs: string[]
  references: DesignReference[]
  sample_size?: number
  repetitions?: number
  statistical_methods: string[]
  analysis_plan?: string
  estimated_duration?: EstimatedDuration
  estimated_budget_usd?: number
  safety_requirements?: SafetyRequirements
  ethical_considerations?: string
  disclaimers?: string
  seeking_collaborators: boolean
  collaboration_notes?: string
  coauthor_uids: string[]

  // Draft-only metadata (stripped from main doc on publish)
  pending_changelog?: string   // changelog text saved while editing, auto-used on next publish

  // Metadata (system-managed)
  status: DesignStatus
  is_public: boolean           // true when status is 'published' or 'locked'
  version: number              // internal edit counter, increments on every PATCH
  published_version: number    // user-facing version number, increments on each publish (0 = never published)
  has_draft_changes: boolean   // true when a published design has unsaved edits in its draft sub-document
  owner_uid: string            // immutable — the user who created the design
  author_ids: string[]         // owner_uid + coauthor_uids (drives all permission checks)
  review_status: ReviewStatus
  review_count: number
  execution_count: number
  scientific_value_points: number
  derived_design_count: number
  fork_metadata?: ForkMetadata
  watchlist_uids: string[]     // UIDs of users who have watchlisted this design
  pipeline_uids: string[]      // UIDs of users who have pipelined this design

  created_at: Timestamp
  updated_at: Timestamp
}

// ─── API request bodies ───────────────────────────────────────────────────────

export interface CreateDesignBody {
  title: string
  summary: string
  discipline_tags: string[]
  difficulty_level: DifficultyLevel
  materials: DesignMaterial[]
  steps: DesignStep[]
  research_questions: ResearchQuestion[]
  // Optional
  hypothesis?: string
  independent_variables?: Variable[]
  dependent_variables?: Variable[]
  controlled_variables?: Variable[]
  safety_considerations?: string
  reference_experiment_ids?: string[]
  parent_designs?: string[]
  references?: DesignReference[]
  sample_size?: number
  repetitions?: number
  statistical_methods?: string[]
  analysis_plan?: string
  estimated_duration?: EstimatedDuration
  estimated_budget_usd?: number
  safety_requirements?: SafetyRequirements
  ethical_considerations?: string
  disclaimers?: string
  seeking_collaborators?: boolean
  collaboration_notes?: string
  coauthor_uids?: string[]
  cover_image_url?: string
  design_files?: DesignFile[]
}

// All CreateDesignBody fields are optional for updates; pending_changelog is edit-only
export interface UpdateDesignBody extends Partial<CreateDesignBody> {
  pending_changelog?: string
}

export interface ForkDesignBody {
  fork_type: ForkType
  fork_rationale: string
}

export interface PublishDesignBody {
  changelog?: string
}

// ─── Version history types ────────────────────────────────────────────────────

// Summary returned by GET /api/designs/:id/versions
export interface DesignVersionSummary {
  version_number: number
  published_at: string   // ISO string
  published_by: string   // uid
  changelog?: string
}

// Full snapshot returned by GET /api/designs/:id/versions/:versionNum
export interface DesignVersionSnapshot extends DesignVersionSummary {
  data: DesignResponse
}

// ─── API response types ───────────────────────────────────────────────────────

export interface DesignResponse extends Omit<Design, 'created_at' | 'updated_at'> {
  created_at: string
  updated_at: string
}
