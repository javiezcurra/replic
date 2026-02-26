/**
 * MaterialCard — compact, reusable card for displaying a material.
 *
 * Clicking the main card body calls onDetails(material) to open the detail modal.
 * When onAdd/onRemove props are provided, an action icon appears on the right that
 * lets users add/remove the material from their lab without leaving the current page.
 */
import type { Material, MaterialCategory } from '../types/material'

const CATEGORY_META: Record<MaterialCategory, { label: string; emoji: string }> = {
  glassware:  { label: 'Glassware',   emoji: '🫙' },
  reagent:    { label: 'Reagent',     emoji: '⚗️' },
  equipment:  { label: 'Instruments', emoji: '🔬' },
  biological: { label: 'Biological',  emoji: '🧬' },
  other:      { label: 'Other',       emoji: '📦' },
}

interface MaterialCardProps {
  material: Material
  onDetails: (m: Material) => void
  /** Whether this material is already in the user's lab */
  inLab?: boolean
  /** Called when the user clicks the add icon. Omit to hide the action icon. */
  onAdd?: (m: Material) => void
  /** Called when the user clicks the remove icon. Omit to hide the action icon. */
  onRemove?: (m: Material) => void
  /** Disables the action icon while an add/remove is in progress */
  actionPending?: boolean
}

export default function MaterialCard({
  material,
  onDetails,
  inLab = false,
  onAdd,
  onRemove,
  actionPending = false,
}: MaterialCardProps) {
  const cat = CATEGORY_META[material.category]
  const showAction = !!(onAdd || onRemove)

  function handleAction(e: React.MouseEvent) {
    e.stopPropagation()
    if (actionPending) return
    if (inLab) {
      onRemove?.(material)
    } else {
      onAdd?.(material)
    }
  }

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onDetails(material)}
      onKeyDown={(e) => e.key === 'Enter' && onDetails(material)}
      className="group cursor-pointer bg-white rounded-xl border-2 border-surface-2
                 px-4 py-3 hover:border-plum hover:shadow-sm transition-all
                 flex items-center gap-3 text-left w-full"
    >
      {/* Main content */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5">
          <span className="text-xs text-muted">
            {cat?.emoji} {cat?.label}
          </span>
          {material.is_verified && (
            <span className="text-xs text-emerald-600 font-medium">✓</span>
          )}
        </div>
        <p className="font-medium text-ink text-sm leading-snug group-hover:text-primary
                      transition-colors truncate">
          {material.name}
        </p>
        {(material.supplier || material.typical_cost_usd != null) && (
          <p className="text-xs text-muted mt-0.5 truncate">
            {material.supplier}
            {material.supplier && material.typical_cost_usd != null && ' · '}
            {material.typical_cost_usd != null && `$${material.typical_cost_usd.toFixed(2)}`}
          </p>
        )}
      </div>

      {/* Lab action icon */}
      {showAction && (
        <button
          type="button"
          onClick={handleAction}
          disabled={actionPending}
          title={inLab ? 'Remove from lab' : 'Add to lab'}
          className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center
                      transition-all disabled:opacity-40 disabled:cursor-not-allowed ${
            inLab
              ? 'text-red-400 hover:bg-red-50 hover:text-red-600'
              : 'text-primary hover:bg-primary/10'
          }`}
        >
          {actionPending ? (
            <div className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
          ) : inLab ? (
            /* Minus / remove */
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M20 12H4" />
            </svg>
          ) : (
            /* Plus / add */
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
          )}
        </button>
      )}
    </div>
  )
}
