import { Link } from 'react-router-dom'
import type { Design, DesignStatus } from '../types/design'
import UserDisplayName from './UserDisplayName'

const STATUS_LABELS: Record<DesignStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  locked: 'Locked',
}

const STATUS_COLORS: Record<DesignStatus, string> = {
  draft: 'bg-yellow-50 text-yellow-700',
  published: 'bg-green-50 text-green-700',
  locked: 'bg-gray-100 text-gray-600',
}

const DIFFICULTY_COLORS: Record<string, string> = {
  'Pre-K':         'bg-emerald-50 text-emerald-700',
  'Elementary':    'bg-emerald-50 text-emerald-700',
  'Middle School': 'bg-sky-50 text-sky-700',
  'High School':   'bg-blue-50 text-blue-700',
  'Undergraduate': 'bg-violet-50 text-violet-700',
  'Graduate':      'bg-purple-50 text-purple-700',
  'Professional':  'bg-rose-50 text-rose-700',
}

interface Props {
  design: Design
  compact?: boolean
}

export default function DesignCard({ design, compact = false }: Props) {
  if (compact) {
    return (
      <div
        className="relative rounded-xl border border-gray-100 p-3.5 hover:shadow-sm transition-shadow"
        style={{ background: 'var(--color-surface)' }}
      >
        <Link
          to={`/designs/${design.id}`}
          className="absolute inset-0 rounded-xl"
          aria-label={design.title}
        />

        {/* Row 1: title + status chip */}
        <div className="flex items-start justify-between gap-3 mb-2">
          <h3 className="font-semibold text-ink text-sm leading-snug">{design.title}</h3>
          <div className="flex shrink-0 items-center gap-1.5">
            {design.has_draft_changes && design.status !== 'draft' && (
              <span className="text-xs font-medium px-1.5 py-0.5 rounded-full bg-orange-50 text-orange-600">
                edits
              </span>
            )}
            <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[design.status]}`}>
              {STATUS_LABELS[design.status]}
            </span>
          </div>
        </div>

        {/* Row 2: runs · forks · authors */}
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-muted mb-2.5">
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {design.execution_count} runs
          </span>
          <span className="text-gray-300">·</span>
          <span style={{ fontFamily: 'var(--font-mono)' }}>
            {design.derived_design_count} forks
          </span>
          {design.author_ids.length > 0 && (
            <>
              <span className="text-gray-300">·</span>
              <span className="flex flex-wrap items-center gap-x-1">
                <span>Authors:</span>
                {design.author_ids.map((uid, i) => (
                  <span key={uid} className="flex items-center gap-0.5">
                    <UserDisplayName uid={uid} className="text-xs" />
                    {i < design.author_ids.length - 1 && <span>,</span>}
                  </span>
                ))}
              </span>
            </>
          )}
        </div>

        {/* Row 3: difficulty chip | discipline tags */}
        <div className="flex flex-wrap items-center gap-1.5 relative z-10">
          <span
            className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[design.difficulty_level] ?? 'bg-gray-100 text-gray-600'}`}
          >
            {design.difficulty_level}
          </span>
          {design.discipline_tags.length > 0 && (
            <>
              <div className="h-3 w-px bg-gray-200 rounded-full" />
              {design.discipline_tags.map((tag) => (
                <span key={tag} className="text-xs bg-white text-muted px-2 py-0.5 rounded-full border border-gray-100">
                  {tag}
                </span>
              ))}
            </>
          )}
        </div>
      </div>
    )
  }

  return (
    // Stretched-link pattern: the Link covers the full card; interactive children
    // use relative + z-10 to sit above the overlay and receive their own clicks.
    <div className="card p-5 hover:shadow-md transition-shadow relative">
      {/* Full-card navigation link */}
      <Link
        to={`/designs/${design.id}`}
        className="absolute inset-0 rounded-2xl"
        aria-label={design.title}
      />

      {/* Content */}
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0 flex-1">
          <h3 className="font-semibold text-ink leading-snug">{design.title}</h3>
          {design.summary && (
            <p className="mt-1.5 text-sm text-muted line-clamp-2 leading-relaxed">
              {design.summary}
            </p>
          )}
        </div>
        <span
          className={`shrink-0 text-xs font-medium px-2 py-0.5 rounded-full ${STATUS_COLORS[design.status]}`}
        >
          {STATUS_LABELS[design.status]}
        </span>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        <span
          className={`text-xs font-medium px-2 py-0.5 rounded-full ${DIFFICULTY_COLORS[design.difficulty_level] ?? 'bg-gray-100 text-gray-600'}`}
        >
          {design.difficulty_level}
        </span>
        {design.discipline_tags.map((tag) => (
          <span key={tag} className="text-xs bg-surface-2 text-muted px-2 py-0.5 rounded-full">
            {tag}
          </span>
        ))}
      </div>

      {/* Authors — rendered above the stretched link via relative + z-10 */}
      {design.author_ids.length > 0 && (
        <div className="mt-3 flex flex-wrap items-center gap-1 text-xs text-muted relative z-10">
          <span>by</span>
          {design.author_ids.map((uid, i) => (
            <span key={uid} className="flex items-center gap-1">
              <UserDisplayName uid={uid} className="text-xs" />
              {i < design.author_ids.length - 1 && <span>,</span>}
            </span>
          ))}
        </div>
      )}

      <p className="mt-2 text-xs text-muted">
        Updated {new Date(design.updated_at).toLocaleDateString()}
      </p>
    </div>
  )
}
