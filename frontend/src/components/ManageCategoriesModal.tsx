/**
 * ManageCategoriesModal — admin CRUD for the categories collection.
 * Each category has a display name, an optional emoji, and a slug (id)
 * that is auto-derived from the name and used as the `category` field on materials.
 */
import { useEffect, useState } from 'react'
import { api } from '../lib/api'
import type { Category } from '../types/category'

interface Props {
  categories: Category[]
  onClose: () => void
  /** Called with the updated list after any add/edit/delete so the parent can re-render. */
  onChange: (updated: Category[]) => void
}

interface EditState {
  name: string
  emoji: string
}

function slugify(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_|_$/g, '')
}

export default function ManageCategoriesModal({ categories: initial, onClose, onChange }: Props) {
  const [items, setItems]         = useState<Category[]>(initial)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValues, setEditValues] = useState<EditState>({ name: '', emoji: '' })
  const [addForm, setAddForm]     = useState<EditState>({ name: '', emoji: '' })
  const [showAdd, setShowAdd]     = useState(false)
  const [saving, setSaving]       = useState(false)
  const [error, setError]         = useState('')

  // Close on Escape
  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        if (editingId) { setEditingId(null); setError('') }
        else onClose()
      }
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose, editingId])

  useEffect(() => {
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = '' }
  }, [])

  function startEdit(cat: Category) {
    setEditingId(cat.id)
    setEditValues({ name: cat.name, emoji: cat.emoji })
    setError('')
  }

  function cancelEdit() {
    setEditingId(null)
    setError('')
  }

  async function saveEdit(id: string) {
    if (!editValues.name.trim()) { setError('Name cannot be empty'); return }
    setSaving(true); setError('')
    try {
      const res = await api.patch<{ status: string; data: Category }>(
        `/api/categories/${id}`,
        { name: editValues.name.trim(), emoji: editValues.emoji.trim() },
      )
      const updated = items.map((c) => (c.id === id ? res.data : c))
      setItems(updated)
      onChange(updated)
      setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string) {
    setSaving(true); setError('')
    try {
      await api.delete(`/api/categories/${id}`)
      const updated = items.filter((c) => c.id !== id)
      setItems(updated)
      onChange(updated)
      if (editingId === id) setEditingId(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete')
    } finally {
      setSaving(false)
    }
  }

  async function handleAdd() {
    if (!addForm.name.trim()) { setError('Name cannot be empty'); return }
    setSaving(true); setError('')
    try {
      const res = await api.post<{ status: string; data: Category }>(
        '/api/categories',
        { name: addForm.name.trim(), emoji: addForm.emoji.trim() },
      )
      const updated = [...items, res.data]
      setItems(updated)
      onChange(updated)
      setAddForm({ name: '', emoji: '' })
      setShowAdd(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add category')
    } finally {
      setSaving(false)
    }
  }

  const addSlug = slugify(addForm.name)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.45)' }}
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl w-full max-w-md max-h-[88vh] overflow-y-auto shadow-xl flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <div>
            <h2 className="text-xl font-semibold text-ink" style={{ fontFamily: 'var(--font-display)' }}>
              Edit Categories
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Changes apply immediately across all pages.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:bg-gray-100 hover:text-ink transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Category list */}
        <div className="px-6 py-4 space-y-2 flex-1">
          {items.length === 0 && (
            <p className="text-sm text-muted text-center py-6">No categories yet. Add one below.</p>
          )}

          {items.map((cat) => (
            <div key={cat.id} className="rounded-xl border-2 border-surface-2 overflow-hidden">
              {editingId === cat.id ? (
                /* Edit row */
                <div className="p-3 space-y-2">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={editValues.emoji}
                      onChange={(e) => setEditValues((v) => ({ ...v, emoji: e.target.value }))}
                      placeholder="Emoji"
                      maxLength={4}
                      className="w-16 input-sm text-center text-lg"
                    />
                    <input
                      type="text"
                      value={editValues.name}
                      onChange={(e) => setEditValues((v) => ({ ...v, name: e.target.value }))}
                      placeholder="Display name"
                      maxLength={40}
                      className="flex-1 input-sm"
                      autoFocus
                    />
                  </div>
                  <p className="text-xs text-muted">
                    Slug (cannot change):{' '}
                    <code className="bg-gray-100 px-1 rounded font-mono">{cat.id}</code>
                  </p>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => saveEdit(cat.id)}
                      disabled={saving}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold
                                 text-white hover:opacity-90 transition-all disabled:opacity-50"
                      style={{ background: 'var(--color-primary)' }}
                    >
                      {saving ? 'Saving…' : 'Save'}
                    </button>
                    <button
                      type="button"
                      onClick={cancelEdit}
                      className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium
                                 border-2 border-surface-2 text-ink hover:border-ink transition-all"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                /* Read row */
                <div className="flex items-center gap-3 px-4 py-3">
                  <span className="text-xl w-7 text-center shrink-0">
                    {cat.emoji || <span className="text-gray-300 text-sm">—</span>}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-ink truncate">{cat.name}</p>
                    <p className="text-xs text-muted font-mono">{cat.id}</p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => startEdit(cat)}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted
                                 hover:bg-gray-100 hover:text-ink transition-colors"
                      title="Edit"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5
                             m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                      </svg>
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(cat.id)}
                      disabled={saving}
                      className="w-7 h-7 rounded-lg flex items-center justify-center text-muted
                                 hover:bg-red-50 hover:text-red-500 transition-colors disabled:opacity-40"
                      title="Delete"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2}
                          d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}

          {/* Add new category */}
          {showAdd ? (
            <div className="rounded-xl border-2 border-dashed border-plum/40 p-3 space-y-2">
              <div className="flex gap-2">
                <input
                  type="text"
                  value={addForm.emoji}
                  onChange={(e) => setAddForm((v) => ({ ...v, emoji: e.target.value }))}
                  placeholder="Emoji"
                  maxLength={4}
                  className="w-16 input-sm text-center text-lg"
                />
                <input
                  type="text"
                  value={addForm.name}
                  onChange={(e) => setAddForm((v) => ({ ...v, name: e.target.value }))}
                  placeholder="Category name"
                  maxLength={40}
                  className="flex-1 input-sm"
                  autoFocus
                />
              </div>
              {addForm.name && (
                <p className="text-xs text-muted">
                  Slug:{' '}
                  <code className="bg-gray-100 px-1 rounded font-mono">
                    {addSlug || <span className="text-red-400">invalid name</span>}
                  </code>
                </p>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAdd}
                  disabled={saving || !addSlug}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm font-semibold
                             text-white hover:opacity-90 transition-all disabled:opacity-50"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {saving ? 'Adding…' : 'Add category'}
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAdd(false); setAddForm({ name: '', emoji: '' }); setError('') }}
                  className="inline-flex items-center px-3 py-1.5 rounded-lg text-sm font-medium
                             border-2 border-surface-2 text-ink hover:border-ink transition-all"
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <button
              type="button"
              onClick={() => { setShowAdd(true); setError('') }}
              className="w-full flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed
                         border-surface-2 text-muted hover:border-plum hover:text-plum transition-colors text-sm font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
              </svg>
              Add category
            </button>
          )}

          {error && <p className="text-sm text-red-600 pt-1">{error}</p>}
        </div>
      </div>
    </div>
  )
}
