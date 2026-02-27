export type DifficultyLevel =
  | 'Pre-K'
  | 'Elementary'
  | 'Middle School'
  | 'High School'
  | 'Undergraduate'
  | 'Graduate'
  | 'Professional'

export type DesignStatus = 'draft' | 'published' | 'locked'
export type ForkType = 'iteration' | 'adaptation' | 'replication'
export type VariableType = 'continuous' | 'discrete' | 'categorical'
export type DataType = 'numeric' | 'categorical' | 'image' | 'text' | 'other'
export type Criticality = 'required' | 'recommended' | 'optional'
export type RiskLevel = 'none' | 'low' | 'moderate' | 'high'

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
}

export interface ResearchQuestion {
  id: string
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

export interface ForkMetadata {
  parent_design_id: string
  fork_generation: number
  fork_type: ForkType
  fork_rationale: string
}

export interface Design {
  id: string
  title: string
  summary: string
  hypothesis?: string
  discipline_tags: string[]
  difficulty_level: DifficultyLevel
  materials: DesignMaterial[]
  steps: DesignStep[]
  research_questions: ResearchQuestion[]
  independent_variables: Variable[]
  dependent_variables: Variable[]
  controlled_variables: Variable[]
  safety_considerations?: string
  reference_experiment_ids: string[]
  status: DesignStatus
  is_public: boolean
  version: number
  published_version: number    // user-facing version number; 0 = never published
  has_draft_changes: boolean   // true when a published design has unsaved edits
  pending_changelog?: string   // changelog text saved in draft, auto-used on next publish
  author_ids: string[]
  execution_count: number
  derived_design_count: number
  fork_metadata?: ForkMetadata
  seeking_collaborators: boolean
  sample_size?: number
  analysis_plan?: string
  ethical_considerations?: string
  disclaimers?: string
  collaboration_notes?: string
  coauthor_uids: string[]
  created_at: string
  updated_at: string
}

export interface CreateDesignBody {
  title: string
  summary: string
  discipline_tags: string[]
  difficulty_level: DifficultyLevel
  materials: DesignMaterial[]
  steps: DesignStep[]
  research_questions: ResearchQuestion[]
  hypothesis?: string
  independent_variables?: Variable[]
  dependent_variables?: Variable[]
  controlled_variables?: Variable[]
  safety_considerations?: string
  reference_experiment_ids?: string[]
  sample_size?: number
  analysis_plan?: string
  seeking_collaborators?: boolean
  collaboration_notes?: string
  ethical_considerations?: string
  disclaimers?: string
  coauthor_uids?: string[]
}

export interface UpdateDesignBody extends Partial<CreateDesignBody> {
  pending_changelog?: string
}

export interface ForkDesignBody {
  fork_type: ForkType
  fork_rationale: string
}

export interface DesignListResponse {
  status: string
  data: Design[]
  count: number
}

export interface DesignVersionSummary {
  version_number: number
  published_at: string
  published_by: string
  changelog?: string
}

export interface DesignVersionSnapshot extends DesignVersionSummary {
  data: Design
}
