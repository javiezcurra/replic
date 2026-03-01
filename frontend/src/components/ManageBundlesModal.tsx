/**
 * ManageBundlesModal — Admin UI for creating and editing material Bundles.
 * Bundles are named collections of materials (e.g. "Household Items").
 * They're used by the platform to adjust experiment-matching logic.
 *
 * Usage modes:
 *  - Full modal (no initialEditing): shows list of bundles, can navigate to editor.
 *  - Editor-only (initialEditing provided): opens directly in edit mode; calls
 *    onSaved(bundle) + onClose() after saving; Cancel calls onClose().
 */
import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Bundle } from '../types/bundle'
import type { Material } from '../types/material'

// ─── Types ────────────────────────────────────────────────────────────────────

interface BundleListResponse { status: string; data: Bundle[] }
interface MaterialListResponse { status: string; data: Material[] }

// ─── MaterialRow ──────────────────────────────────────────────────────────────

function MaterialRow({
  material,
  checked,
  onToggle,
}: {
  material: Material
  checked: boolean
  onToggle: (id: string) => void
}) {
  return (
    <label
      className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-gray-50
                 transition-colors border-b border-gray-50 last:border-0"
    >
      <input
        type="checkbox"
        checked={checked}
        onChange={() => onToggle(material.id)}
        className="w-4 h-4 rounded accent-primary shrink-0"
      />
      <span className="text-sm flex-1 min-w-0 truncate" style={{ color: 'var(--color-text)' }}>
        {material.name}
      </span>
      <span
        className="text-xs shrink-0 px-1.5 py-0.5 rounded"
        style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
      >
        {material.type === 'Equipment' ? 'Eq' : 'Con'}
      </span>
      {material.is_verified && (
        <span className="text-xs shrink-0" style={{ color: 'var(--color-text-muted)' }}>✓</span>
      )}
    </label>
  )
}

// ─── BundleEditor ─────────────────────────────────────────────────────────────

function BundleEditor({
  bundle,
  allMaterials,
  onSave,
  onCancel,
}: {
  bundle: Bundle | 'new'
  allMaterials: Material[]
  onSave: (updated: Bundle) => void
  onCancel: () => void
}) {
  const isNew = bundle === 'new'

  const [name, setName]               = useState(isNew ? '' : bundle.name)
  const [description, setDescription] = useState(isNew ? '' : bundle.description)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(
    new Set(isNew ? [] : bundle.material_ids),
  )
  // Track IDs that were in the bundle when the editor opened — used for sort order only
  const [initialIds] = useState<Set<string>>(
    new Set(isNew ? [] : bundle.material_ids),
  )
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError]   = useState('')

  // Flat sorted list: initial bundle members first (alpha), then the rest (alpha)
  const sortedMaterials = useMemo(() => {
    const q = search.toLowerCase().trim()
    const mats = q
      ? allMaterials.filter((m) => m.name.toLowerCase().includes(q))
      : allMaterials
    const inBundle    = mats.filter((m) =>  initialIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name))
    const notInBundle = mats.filter((m) => !initialIds.has(m.id)).sort((a, b) => a.name.localeCompare(b.name))
    return { inBundle, notInBundle }
  }, [allMaterials, search, initialIds])

  function toggle(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSave() {
    if (!name.trim()) { setError('Bundle name is required.'); return }
    setSaving(true)
    setError('')
    try {
      const payload = {
        name:         name.trim(),
        description:  description.trim(),
        material_ids: [...selectedIds],
      }
      let saved: Bundle
      if (isNew) {
        const res = await api.post<{ status: string; data: Bundle }>('/api/admin/bundles', payload)
        saved = res.data
      } else {
        const res = await api.patch<{ status: string; data: Bundle }>(
          `/api/admin/bundles/${bundle.id}`, payload,
        )
        saved = res.data
      }
      onSave(saved)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bundle.')
      setSaving(false)
    }
  }

  const { inBundle, notInBundle } = sortedMaterials
  const hasInBundle    = inBundle.length > 0
  const hasNotInBundle = notInBundle.length > 0
  const isEmpty        = !hasInBundle && !hasNotInBundle

  return (
    <div className="flex flex-col h-full">
      {/* Editor header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-gray-100 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h2 className="font-semibold text-base" style={{ color: 'var(--color-dark)' }}>
          {isNew ? 'Create Bundle' : 'Edit Bundle'}
        </h2>
      </div>

      {/* Editor body — scrollable */}
      <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">

        {/* Name */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Bundle Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Household Items"
            className="w-full input-sm"
          />
        </div>

        {/* Description */}
        <div>
          <label
            className="block text-xs font-semibold uppercase tracking-wider mb-1.5"
            style={{ color: 'var(--color-text-muted)' }}
          >
            Description{' '}
            <span className="font-normal normal-case tracking-normal">(optional)</span>
          </label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Brief description of what this bundle represents…"
            className="w-full input-sm resize-none"
          />
        </div>

        {/* Material picker */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <label
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--color-text-muted)' }}
            >
              Materials
            </label>
            <span
              className="text-xs font-mono px-1.5 py-0.5 rounded"
              style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}
            >
              {selectedIds.size} selected
            </span>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search materials…"
              className="w-full pl-9 input-sm"
            />
          </div>

          {/* Flat sorted material list */}
          <div className="border border-gray-100 rounded-xl overflow-hidden max-h-72 overflow-y-auto">
            {allMaterials.length === 0 ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                No materials found.
              </p>
            ) : isEmpty ? (
              <p className="text-sm text-center py-6" style={{ color: 'var(--color-text-muted)' }}>
                No materials match "{search}".
              </p>
            ) : (
              <>
                {/* Bundle members — shown first */}
                {hasInBundle && (
                  <>
                    {!isNew && !search && (
                      <div
                        className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-50"
                        style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
                      >
                        In this bundle
                      </div>
                    )}
                    {inBundle.map((m) => (
                      <MaterialRow
                        key={m.id}
                        material={m}
                        checked={selectedIds.has(m.id)}
                        onToggle={toggle}
                      />
                    ))}
                  </>
                )}

                {/* Divider between in-bundle and other materials */}
                {hasInBundle && hasNotInBundle && !search && (
                  <div
                    className="px-4 py-2 text-xs font-semibold uppercase tracking-wider border-b border-gray-50"
                    style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
                  >
                    Other materials
                  </div>
                )}

                {/* Remaining materials */}
                {notInBundle.map((m) => (
                  <MaterialRow
                    key={m.id}
                    material={m}
                    checked={selectedIds.has(m.id)}
                    onToggle={toggle}
                  />
                ))}
              </>
            )}
          </div>
        </div>

        {error && (
          <p className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-lg px-4 py-2">
            {error}
          </p>
        )}
      </div>

      {/* Editor footer */}
      <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-end gap-3 shrink-0">
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors
                     hover:opacity-90 disabled:opacity-50"
          style={{ background: 'var(--color-primary)' }}
        >
          {saving ? 'Saving…' : isNew ? 'Create Bundle' : 'Save Changes'}
        </button>
      </div>
    </div>
  )
}

// ─── Main modal ───────────────────────────────────────────────────────────────

export default function ManageBundlesModal({
  onClose,
  initialEditing,
  onSaved,
}: {
  onClose: () => void
  initialEditing?: Bundle | 'new'
  onSaved?: (b: Bundle) => void
}) {
  const isEditorOnly = initialEditing !== undefined

  const [bundles, setBundles]           = useState<Bundle[]>([])
  const [allMaterials, setAllMaterials] = useState<Material[]>([])
  const [loading, setLoading]           = useState(true)
  const [editing, setEditing]           = useState<Bundle | 'new' | null>(initialEditing ?? null)
  const [deleteTarget, setDeleteTarget] = useState<Bundle | null>(null)
  const [deleting, setDeleting]         = useState(false)

  useEffect(() => {
    async function load() {
      const [eqRes, conRes] = await Promise.allSettled([
        api.get<MaterialListResponse>('/api/materials?type=Equipment&limit=100'),
        api.get<MaterialListResponse>('/api/materials?type=Consumable&limit=100'),
      ])
      const eq  = eqRes.status  === 'fulfilled' ? eqRes.value.data  : []
      const con = conRes.status === 'fulfilled' ? conRes.value.data : []
      setAllMaterials([...eq, ...con])

      if (!isEditorOnly) {
        const bundlesRes = await api.get<BundleListResponse>('/api/admin/bundles').catch(() => null)
        if (bundlesRes) setBundles(bundlesRes.data)
      }

      setLoading(false)
    }
    load()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Build material name lookup for rendering bundle member chips
  const materialById = useMemo(
    () => new Map(allMaterials.map((m) => [m.id, m])),
    [allMaterials],
  )

  function handleSaved(updated: Bundle) {
    if (isEditorOnly) {
      onSaved?.(updated)
      onClose()
    } else {
      setBundles((prev) => {
        const idx = prev.findIndex((b) => b.id === updated.id)
        return idx === -1 ? [...prev, updated] : prev.map((b) => (b.id === updated.id ? updated : b))
      })
      setEditing(null)
      onSaved?.(updated)
    }
  }

  async function confirmDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await api.delete(`/api/admin/bundles/${deleteTarget.id}`)
      setBundles((prev) => prev.filter((b) => b.id !== deleteTarget.id))
      setDeleteTarget(null)
    } catch {
      // leave modal open for retry
    } finally {
      setDeleting(false)
    }
  }

  // Escape key closes
  useEffect(() => {
    function onKey(e: KeyboardEvent) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <>
      {/* Overlay */}
      <div className="fixed inset-0 z-40 bg-black/50" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
        <div
          className="relative w-full max-w-2xl bg-white rounded-2xl shadow-2xl
                     flex flex-col pointer-events-auto"
          style={{ maxHeight: '85vh' }}
          onClick={(e) => e.stopPropagation()}
        >

          {/* ── Editor view ── */}
          {editing !== null ? (
            <BundleEditor
              bundle={editing}
              allMaterials={allMaterials}
              onSave={handleSaved}
              onCancel={isEditorOnly ? onClose : () => setEditing(null)}
            />
          ) : (
            /* ── List view ── */
            <>
              {/* Header */}
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
                <h2 className="font-bold text-lg" style={{ color: 'var(--color-dark)' }}>
                  Bundles
                </h2>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setEditing('new')}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-sm
                               font-semibold text-white hover:opacity-90 transition-colors"
                    style={{ background: 'var(--color-primary)' }}
                  >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
                    </svg>
                    New Bundle
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600
                               hover:bg-gray-100 transition-colors"
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto px-6 py-5">
                {loading ? (
                  <div className="flex justify-center py-12">
                    <div
                      className="w-7 h-7 border-4 rounded-full animate-spin"
                      style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }}
                    />
                  </div>
                ) : bundles.length === 0 ? (
                  <div className="text-center py-14">
                    <p className="text-4xl mb-3">📦</p>
                    <p className="text-sm font-medium" style={{ color: 'var(--color-text)' }}>
                      No bundles yet.
                    </p>
                    <p className="text-xs mt-1" style={{ color: 'var(--color-text-muted)' }}>
                      Create one to group related materials together.
                    </p>
                  </div>
                ) : (
                  <div className="space-y-3">
                    {bundles.map((bundle) => (
                      <BundleCard
                        key={bundle.id}
                        bundle={bundle}
                        materialById={materialById}
                        onEdit={setEditing}
                        onDelete={setDeleteTarget}
                      />
                    ))}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      </div>

      {/* Delete confirmation */}
      {deleteTarget && (
        <>
          <div className="fixed inset-0 z-60 bg-black/60" onClick={() => setDeleteTarget(null)} />
          <div className="fixed inset-0 z-60 flex items-center justify-center p-4 pointer-events-none">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 pointer-events-auto">
              <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-dark)' }}>
                Delete "{deleteTarget.name}"?
              </h3>
              <p className="text-sm mb-5" style={{ color: 'var(--color-text)' }}>
                This bundle will be permanently removed. The materials themselves are not affected.
              </p>
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200
                             hover:bg-gray-50 transition-colors disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmDelete}
                  disabled={deleting}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white bg-red-500
                             hover:bg-red-600 transition-colors disabled:opacity-50"
                >
                  {deleting ? 'Deleting…' : 'Delete Bundle'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}

// ─── BundleCard ───────────────────────────────────────────────────────────────

export function BundleCard({
  bundle,
  materialById,
  onEdit,
  onDelete,
}: {
  bundle: Bundle
  materialById: Map<string, Material>
  onEdit: (b: Bundle) => void
  onDelete: (b: Bundle) => void
}) {
  const members = bundle.material_ids
    .map((id) => materialById.get(id))
    .filter(Boolean) as Material[]
  const visible  = members.slice(0, 6)
  const overflow = members.length - visible.length

  return (
    <div className="rounded-xl border-2 border-surface-2 bg-white p-4">
      {/* Title row */}
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h3 className="font-semibold text-sm leading-snug" style={{ color: 'var(--color-dark)' }}>
            {bundle.name}
          </h3>
          {bundle.description && (
            <p className="text-xs mt-0.5 text-muted leading-relaxed">{bundle.description}</p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span
            className="text-xs font-mono px-1.5 py-0.5 rounded"
            style={{ background: 'var(--color-accent)', color: 'var(--color-text)' }}
          >
            {bundle.material_ids.length}
          </span>
          <button
            type="button"
            onClick={() => onEdit(bundle)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-700
                       hover:bg-gray-100 transition-colors"
            title="Edit bundle"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                   m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </button>
          <button
            type="button"
            onClick={() => onDelete(bundle)}
            className="p-1.5 rounded-lg text-gray-300 hover:text-red-500
                       hover:bg-red-50 transition-colors"
            title="Delete bundle"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858
                   L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>

      {/* Material chips */}
      {members.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {visible.map((m) => (
            <span
              key={m.id}
              className="text-xs px-2 py-0.5 rounded-full border border-surface-2"
              style={{ background: 'var(--color-surface)', color: 'var(--color-text)' }}
            >
              {m.name}
            </span>
          ))}
          {overflow > 0 && (
            <span
              className="text-xs px-2 py-0.5 rounded-full border border-surface-2"
              style={{ background: 'var(--color-surface)', color: 'var(--color-text-muted)' }}
            >
              +{overflow} more
            </span>
          )}
        </div>
      )}
      {bundle.material_ids.length > 0 && members.length === 0 && (
        <p className="mt-2 text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
          Materials loading…
        </p>
      )}
      {bundle.material_ids.length === 0 && (
        <p className="mt-2 text-xs italic" style={{ color: 'var(--color-text-muted)' }}>
          No materials added yet.
        </p>
      )}
    </div>
  )
}
