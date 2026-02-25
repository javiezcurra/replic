import type {
  CreateDesignBody,
  DifficultyLevel,
  DesignStep,
  ResearchQuestion,
  Variable,
  VariableType,
  DataType,
} from '../types/design'

const DIFFICULTY_OPTIONS: DifficultyLevel[] = [
  'Pre-K', 'Elementary', 'Middle School', 'High School',
  'Undergraduate', 'Graduate', 'Professional',
]

export interface DesignFormValues {
  title: string
  hypothesis: string
  discipline_tags: string
  difficulty_level: DifficultyLevel
  steps: DesignStep[]
  research_questions: ResearchQuestion[]
  independent_variables: Variable[]
  dependent_variables: Variable[]
  controlled_variables: Variable[]
  sample_size: string
  analysis_plan: string
  seeking_collaborators: boolean
  collaboration_notes: string
  ethical_considerations: string
}

export function defaultFormValues(): DesignFormValues {
  return {
    title: '',
    hypothesis: '',
    discipline_tags: '',
    difficulty_level: 'Undergraduate',
    steps: [{ step_number: 1, instruction: '' }],
    research_questions: [{ id: crypto.randomUUID(), question: '', expected_data_type: 'numeric' }],
    independent_variables: [{ name: '', type: 'continuous', values_or_range: '' }],
    dependent_variables: [{ name: '', type: 'continuous', values_or_range: '' }],
    controlled_variables: [],
    sample_size: '',
    analysis_plan: '',
    seeking_collaborators: false,
    collaboration_notes: '',
    ethical_considerations: '',
  }
}

export function formValuesToBody(v: DesignFormValues): CreateDesignBody {
  return {
    title: v.title,
    hypothesis: v.hypothesis,
    discipline_tags: v.discipline_tags.split(',').map((t) => t.trim()).filter(Boolean),
    difficulty_level: v.difficulty_level,
    steps: v.steps.filter((s) => s.instruction.trim()),
    research_questions: v.research_questions.filter((q) => q.question.trim()),
    independent_variables: v.independent_variables.filter((x) => x.name.trim()),
    dependent_variables: v.dependent_variables.filter((x) => x.name.trim()),
    controlled_variables: v.controlled_variables.filter((x) => x.name.trim()),
    ...(v.sample_size ? { sample_size: parseInt(v.sample_size, 10) } : {}),
    ...(v.analysis_plan ? { analysis_plan: v.analysis_plan } : {}),
    seeking_collaborators: v.seeking_collaborators,
    ...(v.collaboration_notes ? { collaboration_notes: v.collaboration_notes } : {}),
    ...(v.ethical_considerations ? { ethical_considerations: v.ethical_considerations } : {}),
  }
}

interface Props {
  values: DesignFormValues
  onChange: (v: DesignFormValues) => void
  lockedMethodology?: boolean
}

export default function DesignForm({ values, onChange, lockedMethodology = false }: Props) {
  function set<K extends keyof DesignFormValues>(key: K, val: DesignFormValues[K]) {
    onChange({ ...values, [key]: val })
  }

  // Steps
  function addStep() {
    set('steps', [...values.steps, { step_number: values.steps.length + 1, instruction: '' }])
  }
  function removeStep(i: number) {
    const updated = values.steps
      .filter((_, idx) => idx !== i)
      .map((s, idx) => ({ ...s, step_number: idx + 1 }))
    set('steps', updated)
  }
  function updateStep(i: number, instruction: string) {
    const updated = values.steps.map((s, idx) => idx === i ? { ...s, instruction } : s)
    set('steps', updated)
  }

  // Research questions
  function addQuestion() {
    set('research_questions', [
      ...values.research_questions,
      { id: crypto.randomUUID(), question: '', expected_data_type: 'numeric' as DataType },
    ])
  }
  function removeQuestion(i: number) {
    set('research_questions', values.research_questions.filter((_, idx) => idx !== i))
  }
  function updateQuestion(i: number, field: keyof ResearchQuestion, val: string) {
    const updated = values.research_questions.map((q, idx) =>
      idx === i ? { ...q, [field]: val } : q
    )
    set('research_questions', updated)
  }

  // Variables helper
  function VariableList({
    label,
    vars,
    onUpdate,
  }: {
    label: string
    vars: Variable[]
    onUpdate: (v: Variable[]) => void
  }) {
    function add() {
      onUpdate([...vars, { name: '', type: 'continuous' as VariableType, values_or_range: '' }])
    }
    function remove(i: number) {
      onUpdate(vars.filter((_, idx) => idx !== i))
    }
    function update(i: number, field: keyof Variable, val: string) {
      onUpdate(vars.map((v, idx) => idx === i ? { ...v, [field]: val } : v))
    }

    return (
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">{label}</label>
        {vars.map((v, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              placeholder="Name"
              value={v.name}
              disabled={lockedMethodology}
              onChange={(e) => update(i, 'name', e.target.value)}
              className="flex-1 input-sm"
            />
            <select
              value={v.type}
              disabled={lockedMethodology}
              onChange={(e) => update(i, 'type', e.target.value)}
              className="input-sm w-36"
            >
              <option value="continuous">Continuous</option>
              <option value="discrete">Discrete</option>
              <option value="categorical">Categorical</option>
            </select>
            <input
              type="text"
              placeholder="Values / range"
              value={v.values_or_range}
              disabled={lockedMethodology}
              onChange={(e) => update(i, 'values_or_range', e.target.value)}
              className="flex-1 input-sm"
            />
            {!lockedMethodology && (
              <button type="button" onClick={() => remove(i)} className="text-gray-400 hover:text-red-500 text-lg leading-none px-1">×</button>
            )}
          </div>
        ))}
        {!lockedMethodology && (
          <button type="button" onClick={add} className="text-sm text-brand-600 hover:underline mt-1">
            + Add variable
          </button>
        )}
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {lockedMethodology && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          This design has been executed. Methodology fields (steps, variables, research questions, hypothesis) are locked and cannot be changed.
        </div>
      )}

      {/* Core fields */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Title *</label>
        <input
          type="text"
          required
          value={values.title}
          onChange={(e) => set('title', e.target.value)}
          className="w-full input-sm"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Hypothesis *</label>
        <textarea
          required
          rows={3}
          value={values.hypothesis}
          disabled={lockedMethodology}
          onChange={(e) => set('hypothesis', e.target.value)}
          className="w-full input-sm resize-y"
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Discipline tags * <span className="text-gray-400 font-normal">(comma-separated)</span></label>
          <input
            type="text"
            required
            value={values.discipline_tags}
            onChange={(e) => set('discipline_tags', e.target.value)}
            placeholder="biology, ecology"
            className="w-full input-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty level *</label>
          <select
            value={values.difficulty_level}
            onChange={(e) => set('difficulty_level', e.target.value as DifficultyLevel)}
            className="w-full input-sm"
          >
            {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
          </select>
        </div>
      </div>

      {/* Steps */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Steps *</label>
        {values.steps.map((step, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <span className="shrink-0 w-6 text-sm text-gray-400 pt-2">{step.step_number}.</span>
            <textarea
              rows={2}
              required={i === 0}
              value={step.instruction}
              disabled={lockedMethodology}
              onChange={(e) => updateStep(i, e.target.value)}
              placeholder={`Step ${step.step_number} instruction`}
              className="flex-1 input-sm resize-y"
            />
            {!lockedMethodology && values.steps.length > 1 && (
              <button type="button" onClick={() => removeStep(i)} className="text-gray-400 hover:text-red-500 text-lg leading-none px-1">×</button>
            )}
          </div>
        ))}
        {!lockedMethodology && (
          <button type="button" onClick={addStep} className="text-sm text-brand-600 hover:underline">
            + Add step
          </button>
        )}
      </div>

      {/* Research questions */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Research questions *</label>
        {values.research_questions.map((q, i) => (
          <div key={i} className="flex gap-2 mb-2">
            <input
              type="text"
              required={i === 0}
              value={q.question}
              disabled={lockedMethodology}
              onChange={(e) => updateQuestion(i, 'question', e.target.value)}
              placeholder="Research question"
              className="flex-1 input-sm"
            />
            <select
              value={q.expected_data_type}
              disabled={lockedMethodology}
              onChange={(e) => updateQuestion(i, 'expected_data_type', e.target.value)}
              className="input-sm w-36"
            >
              {(['numeric', 'categorical', 'image', 'text', 'other'] as DataType[]).map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
            {!lockedMethodology && values.research_questions.length > 1 && (
              <button type="button" onClick={() => removeQuestion(i)} className="text-gray-400 hover:text-red-500 text-lg leading-none px-1">×</button>
            )}
          </div>
        ))}
        {!lockedMethodology && (
          <button type="button" onClick={addQuestion} className="text-sm text-brand-600 hover:underline">
            + Add question
          </button>
        )}
      </div>

      {/* Variables */}
      <VariableList
        label="Independent variables *"
        vars={values.independent_variables}
        onUpdate={(v) => set('independent_variables', v)}
      />
      <VariableList
        label="Dependent variables *"
        vars={values.dependent_variables}
        onUpdate={(v) => set('dependent_variables', v)}
      />
      <VariableList
        label="Controlled variables"
        vars={values.controlled_variables}
        onUpdate={(v) => set('controlled_variables', v)}
      />

      {/* Optional fields */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Sample size</label>
          <input
            type="number"
            min={1}
            value={values.sample_size}
            onChange={(e) => set('sample_size', e.target.value)}
            className="w-full input-sm"
          />
        </div>
        <div className="flex items-center gap-3 pt-5">
          <input
            id="collab"
            type="checkbox"
            checked={values.seeking_collaborators}
            onChange={(e) => set('seeking_collaborators', e.target.checked)}
            className="w-4 h-4 text-brand-600"
          />
          <label htmlFor="collab" className="text-sm font-medium text-gray-700">Seeking collaborators</label>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Analysis plan</label>
        <textarea
          rows={3}
          value={values.analysis_plan}
          onChange={(e) => set('analysis_plan', e.target.value)}
          className="w-full input-sm resize-y"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Ethical considerations</label>
        <textarea
          rows={2}
          value={values.ethical_considerations}
          onChange={(e) => set('ethical_considerations', e.target.value)}
          className="w-full input-sm resize-y"
        />
      </div>

      {values.seeking_collaborators && (
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Collaboration notes</label>
          <textarea
            rows={2}
            value={values.collaboration_notes}
            onChange={(e) => set('collaboration_notes', e.target.value)}
            className="w-full input-sm resize-y"
          />
        </div>
      )}
    </div>
  )
}
