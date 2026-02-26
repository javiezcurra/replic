import type { MaterialCategory, MaterialType } from '../types/material'

const CATEGORY_OPTIONS: { value: MaterialCategory; label: string }[] = [
  { value: 'glassware', label: 'Glassware' },
  { value: 'reagent', label: 'Reagent' },
  { value: 'equipment', label: 'Equipment' },
  { value: 'biological', label: 'Biological' },
  { value: 'other', label: 'Other' },
]

export interface MaterialFormValues {
  name: string
  type: MaterialType | ''
  category: MaterialCategory | ''
  unit: string
  description: string
  supplier: string
  typical_cost_usd: string  // string for controlled input
  safety_notes: string
  tags: string              // comma-separated
}

export function defaultMaterialFormValues(): MaterialFormValues {
  return {
    name: '',
    type: '',
    category: '',
    unit: '',
    description: '',
    supplier: '',
    typical_cost_usd: '',
    safety_notes: '',
    tags: '',
  }
}

export function formValuesToBody(v: MaterialFormValues) {
  return {
    name: v.name,
    type: v.type as MaterialType,
    category: v.category as MaterialCategory,
    ...(v.unit ? { unit: v.unit } : {}),
    ...(v.description ? { description: v.description } : {}),
    ...(v.supplier ? { supplier: v.supplier } : {}),
    ...(v.typical_cost_usd ? { typical_cost_usd: parseFloat(v.typical_cost_usd) } : {}),
    ...(v.safety_notes ? { safety_notes: v.safety_notes } : {}),
    tags: v.tags.split(',').map((t) => t.trim()).filter(Boolean),
  }
}

interface Props {
  values: MaterialFormValues
  onChange: (v: MaterialFormValues) => void
}

export default function MaterialForm({ values, onChange }: Props) {
  function set<K extends keyof MaterialFormValues>(key: K, val: MaterialFormValues[K]) {
    onChange({ ...values, [key]: val })
  }

  return (
    <div className="space-y-6">
      {/* Name */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Name *</label>
        <input
          type="text"
          required
          maxLength={200}
          value={values.name}
          onChange={(e) => set('name', e.target.value)}
          placeholder="e.g. Erlenmeyer Flask (250 mL)"
          className="w-full input-sm"
        />
      </div>

      {/* Type + Category */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Type *</label>
          <select
            required
            value={values.type}
            onChange={(e) => set('type', e.target.value as MaterialType | '')}
            className="w-full input-sm"
          >
            <option value="">Select type…</option>
            <option value="Consumable">Consumable</option>
            <option value="Equipment">Equipment</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Category *</label>
          <select
            required
            value={values.category}
            onChange={(e) => set('category', e.target.value as MaterialCategory | '')}
            className="w-full input-sm"
          >
            <option value="">Select category…</option>
            {CATEGORY_OPTIONS.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Unit + Supplier */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Unit <span className="text-gray-400 font-normal">(default: unit)</span>
          </label>
          <input
            type="text"
            value={values.unit}
            onChange={(e) => set('unit', e.target.value)}
            placeholder="unit, mL, g, …"
            className="w-full input-sm"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Supplier</label>
          <input
            type="text"
            value={values.supplier}
            onChange={(e) => set('supplier', e.target.value)}
            placeholder="e.g. Fisher Scientific"
            className="w-full input-sm"
          />
        </div>
      </div>

      {/* Description */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
        <textarea
          rows={3}
          value={values.description}
          onChange={(e) => set('description', e.target.value)}
          className="w-full input-sm resize-y"
        />
      </div>

      {/* Typical cost */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Typical cost (USD)</label>
        <input
          type="number"
          min={0}
          step="0.01"
          value={values.typical_cost_usd}
          onChange={(e) => set('typical_cost_usd', e.target.value)}
          placeholder="0.00"
          className="w-full input-sm"
        />
      </div>

      {/* Safety notes */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Safety notes</label>
        <textarea
          rows={2}
          value={values.safety_notes}
          onChange={(e) => set('safety_notes', e.target.value)}
          className="w-full input-sm resize-y"
        />
      </div>

      {/* Tags */}
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tags <span className="text-gray-400 font-normal">(comma-separated, max 10)</span>
        </label>
        <input
          type="text"
          value={values.tags}
          onChange={(e) => set('tags', e.target.value)}
          placeholder="chemistry, lab, glassware"
          className="w-full input-sm"
        />
      </div>
    </div>
  )
}
