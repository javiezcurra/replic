import { useEffect, useMemo, useRef, useState } from 'react'
import { ref as storageRef, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'
import { api } from '../lib/api'
import { useAuth } from '../contexts/AuthContext'
import type {
  CreateDesignBody,
  Criticality,
  DataType,
  DesignFile,
  DesignMaterial,
  DifficultyLevel,
  DesignStep,
  ResearchQuestion,
  Variable,
  VariableType,
} from '../types/design'
import type { Material } from '../types/material'
import type { CollaboratorEntry } from '../types/user'
import MaterialsDrawer from './MaterialsDrawer'

const DIFFICULTY_OPTIONS: DifficultyLevel[] = [
  'Pre-K', 'Elementary', 'Middle School', 'High School',
  'Undergraduate', 'Graduate', 'Professional',
]

const MAX_FILE_BYTES = 20 * 1024 * 1024

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

// Lightweight entry stored in the form — enough to display and convert to DesignMaterial
export interface DesignMaterialEntry {
  id: string
  name: string
  quantity: string
  alternatives_allowed: boolean
  criticality: Criticality
}

// Minimal shape for a referenced design (for the picker)
interface DesignRef {
  id: string
  title: string
}

// Co-author entry stored in the form
export interface CoauthorEntry {
  uid: string
  displayName: string
}

export interface DesignFormValues {
  // ── Basic fields ─────────────────────────────────────────────────────────
  title: string
  summary: string
  discipline_tags: string
  difficulty_level: DifficultyLevel
  materials: DesignMaterialEntry[]
  steps: DesignStep[]
  research_questions: ResearchQuestion[]
  safety_considerations: string
  cover_image_url: string
  // ── Design files ─────────────────────────────────────────────────────────
  design_files: DesignFile[]
  // ── Advanced Details ─────────────────────────────────────────────────────
  reference_experiment_ids: string[]
  hypothesis: string
  independent_variables: Variable[]
  dependent_variables: Variable[]
  controlled_variables: Variable[]
  analysis_plan: string
  collaboration_notes: string
  ethical_considerations: string
  disclaimers: string
  coauthors: CoauthorEntry[]
}

export function defaultFormValues(): DesignFormValues {
  return {
    title: '',
    summary: '',
    discipline_tags: '',
    difficulty_level: 'Undergraduate',
    materials: [],
    steps: [{ step_number: 1, instruction: '' }],
    research_questions: [{ id: crypto.randomUUID(), question: '', expected_data_type: 'numeric' }],
    safety_considerations: '',
    cover_image_url: '',
    design_files: [],
    reference_experiment_ids: [],
    hypothesis: '',
    independent_variables: [],
    dependent_variables: [],
    controlled_variables: [],
    analysis_plan: '',
    collaboration_notes: '',
    ethical_considerations: '',
    disclaimers: '',
    coauthors: [],
  }
}

export function formValuesToBody(v: DesignFormValues): CreateDesignBody {
  return {
    title: v.title,
    summary: v.summary,
    discipline_tags: v.discipline_tags.split(',').map((t) => t.trim()).filter(Boolean),
    difficulty_level: v.difficulty_level,
    materials: v.materials.map((m): DesignMaterial => ({
      material_id: m.id,
      quantity: m.quantity,
      alternatives_allowed: m.alternatives_allowed,
      criticality: m.criticality,
    })),
    steps: v.steps.filter((s) => s.instruction.trim()),
    research_questions: v.research_questions.filter((q) => q.question.trim()),
    ...(v.hypothesis.trim() ? { hypothesis: v.hypothesis } : {}),
    ...(v.independent_variables.filter((x) => x.name.trim()).length > 0
      ? { independent_variables: v.independent_variables.filter((x) => x.name.trim()) }
      : {}),
    ...(v.dependent_variables.filter((x) => x.name.trim()).length > 0
      ? { dependent_variables: v.dependent_variables.filter((x) => x.name.trim()) }
      : {}),
    ...(v.controlled_variables.filter((x) => x.name.trim()).length > 0
      ? { controlled_variables: v.controlled_variables.filter((x) => x.name.trim()) }
      : {}),
    ...(v.safety_considerations.trim() ? { safety_considerations: v.safety_considerations } : {}),
    ...(v.reference_experiment_ids.length > 0 ? { reference_experiment_ids: v.reference_experiment_ids } : {}),
    ...(v.analysis_plan ? { analysis_plan: v.analysis_plan } : {}),
    ...(v.collaboration_notes ? { collaboration_notes: v.collaboration_notes } : {}),
    ...(v.ethical_considerations ? { ethical_considerations: v.ethical_considerations } : {}),
    ...(v.disclaimers ? { disclaimers: v.disclaimers } : {}),
    coauthor_uids: v.coauthors.map((c) => c.uid),
    ...(v.cover_image_url ? { cover_image_url: v.cover_image_url } : {}),
    ...(v.design_files.length > 0 ? { design_files: v.design_files } : {}),
  }
}

interface Props {
  values: DesignFormValues
  onChange: (v: DesignFormValues) => void
  lockedMethodology?: boolean
  ownerUid?: string
}

// ─── Tooltip ──────────────────────────────────────────────────────────────────
function Tooltip({ text }: { text: string }) {
  const [show, setShow] = useState(false)
  return (
    <span className="relative inline-flex items-center ml-1.5 align-middle">
      <button
        type="button"
        onMouseEnter={() => setShow(true)}
        onMouseLeave={() => setShow(false)}
        onFocus={() => setShow(true)}
        onBlur={() => setShow(false)}
        className="w-4 h-4 rounded-full bg-gray-200 text-gray-500 text-[10px] font-bold
                   flex items-center justify-center hover:bg-gray-300 focus:outline-none
                   focus:ring-2 focus:ring-offset-1 focus:ring-gray-400 shrink-0"
        aria-label="Help"
      >
        i
      </button>
      {show && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-72
                         bg-gray-900 text-white text-xs rounded-xl p-3 z-50 shadow-xl
                         pointer-events-none leading-relaxed">
          {text}
          <span className="absolute top-full left-1/2 -translate-x-1/2 w-0 h-0
                           border-l-4 border-r-4 border-t-4
                           border-l-transparent border-r-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  )
}

// ─── FieldLabel ───────────────────────────────────────────────────────────────
function FieldLabel({ label, required, tooltip }: { label: string; required?: boolean; tooltip?: string }) {
  return (
    <label className="flex items-center text-sm font-medium text-gray-700 mb-1">
      {label}{required && ' *'}
      {tooltip && <Tooltip text={tooltip} />}
    </label>
  )
}

// ─── Section sub-header ───────────────────────────────────────────────────────
function SubHeader({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold text-gray-400 uppercase tracking-widest mt-5 mb-3 first:mt-0">
      {children}
    </p>
  )
}

// ─── CoverImageUpload ─────────────────────────────────────────────────────────
function CoverImageUpload({ value, onChange }: { value: string; onChange: (url: string) => void }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { setError('Please select an image file'); return }
    if (file.size > 10 * 1024 * 1024) { setError('Image must be under 10 MB'); return }
    setError('')
    setUploading(true)
    setProgress(0)
    const sr = storageRef(storage, `designs/covers/${crypto.randomUUID()}_${file.name}`)
    const task = uploadBytesResumable(sr, file)
    task.on(
      'state_changed',
      (snap) => setProgress(Math.round((snap.bytesTransferred / snap.totalBytes) * 100)),
      (err) => { setError(err.message); setUploading(false) },
      async () => { onChange(await getDownloadURL(task.snapshot.ref)); setUploading(false) },
    )
  }

  return (
    <div>
      {value ? (
        <div className="flex items-start gap-4">
          <img
            src={value}
            alt="Cover"
            className="h-28 w-44 object-cover rounded-xl border border-gray-200 shrink-0"
          />
          <div className="space-y-2 pt-1">
            <button type="button" onClick={() => fileRef.current?.click()} className="btn-secondary text-xs">
              Replace image
            </button>
            <button type="button" onClick={() => onChange('')} className="block text-xs text-red-500 hover:underline">
              Remove
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-300 rounded-xl p-5 text-center
                     hover:border-gray-400 transition-colors disabled:opacity-50"
        >
          {uploading ? (
            <div className="space-y-2">
              <p className="text-sm text-gray-600">Uploading… {progress}%</p>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%`, background: 'var(--color-primary)' }}
                />
              </div>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-7 w-7 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500">Click to upload a cover image</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, WebP — max 10 MB · optional</p>
            </>
          )}
        </button>
      )}
      <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}

// ─── DesignFilesUpload ────────────────────────────────────────────────────────
function DesignFilesUpload({ files, onChange }: { files: DesignFile[]; onChange: (files: DesignFile[]) => void }) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  const totalSize = files.reduce((sum, f) => sum + f.size, 0)

  async function handleFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (selected.length === 0) return

    const incomingSize = selected.reduce((sum, f) => sum + f.size, 0)
    if (totalSize + incomingSize > MAX_FILE_BYTES) {
      setError(`Total files cannot exceed 20 MB. Currently using ${formatBytes(totalSize)}.`)
      return
    }

    setError('')
    setUploading(true)
    setProgress(0)

    const uploaded: DesignFile[] = []
    let done = 0

    for (const file of selected) {
      await new Promise<void>((resolve) => {
        const sr = storageRef(storage, `designs/files/${crypto.randomUUID()}_${file.name}`)
        const task = uploadBytesResumable(sr, file)
        task.on(
          'state_changed',
          (snap) => {
            const fileProgress = snap.bytesTransferred / snap.totalBytes
            setProgress(Math.round(((done + fileProgress) / selected.length) * 100))
          },
          (err) => { setError(err.message); resolve() },
          async () => {
            uploaded.push({ name: file.name, url: await getDownloadURL(task.snapshot.ref), size: file.size })
            done++
            resolve()
          },
        )
      })
    }

    onChange([...files, ...uploaded])
    setUploading(false)
  }

  return (
    <div className="space-y-3">
      {files.length > 0 && (
        <ul className="space-y-2">
          {files.map((f, i) => (
            <li
              key={i}
              className="flex items-center justify-between gap-3 px-3 py-2 rounded-lg
                         bg-gray-50 border border-gray-200"
            >
              <div className="flex items-center gap-2 min-w-0">
                <svg className="w-4 h-4 text-gray-400 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-sm text-gray-800 truncate">{f.name}</span>
                <span className="text-xs text-gray-400 shrink-0" style={{ fontFamily: 'var(--font-mono)' }}>
                  {formatBytes(f.size)}
                </span>
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="text-gray-400 hover:text-red-500 text-lg leading-none px-1 shrink-0"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {uploading ? (
        <div className="space-y-1">
          <p className="text-sm text-gray-600">Uploading… {progress}%</p>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="h-1.5 rounded-full transition-all"
              style={{ width: `${progress}%`, background: 'var(--color-primary)' }}
            />
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed
                     border-gray-300 text-sm text-gray-600 hover:border-gray-400 hover:text-gray-700
                     transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          Add files
        </button>
      )}

      <p className="text-xs text-gray-400" style={{ fontFamily: 'var(--font-mono)' }}>
        {formatBytes(totalSize)} / 20 MB used
      </p>

      {error && <p className="text-xs text-red-600">{error}</p>}

      <input ref={fileRef} type="file" multiple className="hidden" onChange={handleFiles} />
    </div>
  )
}

// ─── VariableList ─────────────────────────────────────────────────────────────
function VariableList({
  label,
  tooltip,
  vars,
  onUpdate,
  locked,
}: {
  label: string
  tooltip: string
  vars: Variable[]
  onUpdate: (v: Variable[]) => void
  locked: boolean
}) {
  function add() {
    onUpdate([...vars, { name: '', type: 'continuous' as VariableType, values_or_range: '' }])
  }
  function remove(i: number) {
    onUpdate(vars.filter((_, idx) => idx !== i))
  }
  function update(i: number, field: keyof Variable, val: string) {
    onUpdate(vars.map((v, idx) => (idx === i ? { ...v, [field]: val } : v)))
  }

  return (
    <div>
      <FieldLabel label={label} tooltip={tooltip} />
      {vars.map((v, i) => (
        <div key={i} className="flex gap-2 mb-2">
          <input
            type="text"
            placeholder="Name"
            value={v.name}
            disabled={locked}
            onChange={(e) => update(i, 'name', e.target.value)}
            className="flex-1 input-sm"
          />
          <select
            value={v.type}
            disabled={locked}
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
            disabled={locked}
            onChange={(e) => update(i, 'values_or_range', e.target.value)}
            className="flex-1 input-sm"
          />
          {!locked && (
            <button
              type="button"
              onClick={() => remove(i)}
              className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
            >
              ×
            </button>
          )}
        </div>
      ))}
      {!locked && (
        <button type="button" onClick={add} className="text-sm text-brand-600 hover:underline mt-1">
          + Add variable
        </button>
      )}
    </div>
  )
}

// ─── DesignReferencePicker ────────────────────────────────────────────────────
function DesignReferencePicker({
  selectedIds,
  onAdd,
  onRemove,
}: {
  selectedIds: string[]
  onAdd: (id: string, title: string) => void
  onRemove: (id: string) => void
}) {
  const [query, setQuery] = useState('')
  const [allDesigns, setAllDesigns] = useState<DesignRef[]>([])
  const [loaded, setLoaded] = useState(false)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  function loadDesigns() {
    if (loaded || loading) return
    setLoading(true)
    api
      .get<{ status: string; data: DesignRef[] }>('/api/designs?limit=100')
      .then(({ data }) => setAllDesigns(data))
      .catch(() => {})
      .finally(() => { setLoaded(true); setLoading(false) })
  }

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim()
    if (!q) return allDesigns.filter((d) => !selectedIds.includes(d.id)).slice(0, 8)
    return allDesigns
      .filter((d) => !selectedIds.includes(d.id) && d.title.toLowerCase().includes(q))
      .slice(0, 8)
  }, [allDesigns, query, selectedIds])

  const selectedDesigns = useMemo(
    () => allDesigns.filter((d) => selectedIds.includes(d.id)),
    [allDesigns, selectedIds],
  )

  return (
    <div>
      {selectedDesigns.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selectedDesigns.map((d) => (
            <span
              key={d.id}
              className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs
                         bg-brand-50 text-brand-700 border border-brand-200"
            >
              {d.title}
              <button
                type="button"
                onClick={() => onRemove(d.id)}
                className="text-brand-400 hover:text-brand-700 leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
      )}

      <div className="relative" ref={containerRef}>
        <input
          type="text"
          value={query}
          placeholder="Search published designs…"
          className="w-full input-sm"
          onFocus={() => { loadDesigns(); setOpen(true) }}
          onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
        />
        {open && (
          <div className="absolute z-10 left-0 right-0 top-full mt-1 bg-white border border-gray-200
                          rounded-xl shadow-lg overflow-hidden max-h-56 overflow-y-auto">
            {loading && <p className="px-3 py-2 text-xs text-gray-400">Loading…</p>}
            {!loading && filtered.length === 0 && (
              <p className="px-3 py-2 text-xs text-gray-400">No matching designs.</p>
            )}
            {filtered.map((d) => (
              <button
                key={d.id}
                type="button"
                onClick={() => { onAdd(d.id, d.title); setQuery(''); setOpen(false) }}
                className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 text-gray-800"
              >
                {d.title}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── CoauthorsDrawer ──────────────────────────────────────────────────────────
function CoauthorsDrawer({
  selectedUids,
  ownerUid,
  onAdd,
  onRequestRemove,
  onClose,
}: {
  selectedUids: Set<string>
  ownerUid?: string
  onAdd: (c: CoauthorEntry) => void
  onRequestRemove: (c: CoauthorEntry) => void
  onClose: () => void
}) {
  const { user } = useAuth()
  const [collaborators, setCollaborators] = useState<CollaboratorEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')

  useEffect(() => {
    api
      .get<{ status: string; data: CollaboratorEntry[] }>('/api/users/me/collaborators')
      .then(({ data }) => setCollaborators(data))
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const displayList = useMemo(() => {
    const list: Array<{ uid: string; displayName: string; affiliation: string | null }> =
      collaborators.map((c) => ({ uid: c.uid, displayName: c.displayName, affiliation: c.affiliation }))
    if (
      user &&
      selectedUids.has(user.uid) &&
      !collaborators.some((c) => c.uid === user.uid)
    ) {
      list.unshift({ uid: user.uid, displayName: user.displayName ?? user.uid, affiliation: null })
    }
    return list
  }, [collaborators, selectedUids, user])

  const filtered = useMemo(() => {
    const q = search.toLowerCase().trim()
    if (!q) return displayList
    return displayList.filter((c) => c.displayName.toLowerCase().includes(q))
  }, [displayList, search])

  return (
    <>
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-sm bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-200">
          <h2 className="font-semibold text-base" style={{ color: 'var(--color-dark)' }}>
            Manage Co-Authors
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="relative">
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none text-gray-400"
              fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-4.35-4.35M17 11A6 6 0 1 1 5 11a6 6 0 0 1 12 0z" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search collaborators…"
              className="w-full pl-9 input-sm"
            />
          </div>
        </div>
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex justify-center py-10">
              <div className="w-6 h-6 border-4 border-t-transparent rounded-full animate-spin"
                style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
            </div>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--color-text-muted)' }}>
              {displayList.length === 0
                ? 'You have no collaborators yet. Connect with researchers first.'
                : 'No collaborators match your search.'}
            </p>
          ) : (
            <ul className="divide-y divide-gray-100">
              {filtered.map((c) => {
                const isSelected = selectedUids.has(c.uid)
                const isOwner = c.uid === ownerUid
                return (
                  <li key={c.uid} className="flex items-center gap-3 px-4 py-3">
                    <div
                      className="w-9 h-9 rounded-full flex items-center justify-center text-white text-sm font-bold shrink-0"
                      style={{ background: 'var(--color-dark)' }}
                    >
                      {c.displayName?.[0]?.toUpperCase() ?? '?'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate" style={{ color: 'var(--color-text)' }}>
                        {c.displayName}
                      </p>
                      {isOwner ? (
                        <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Design creator</p>
                      ) : c.affiliation ? (
                        <p className="text-xs truncate" style={{ color: 'var(--color-text-muted)' }}>
                          {c.affiliation}
                        </p>
                      ) : null}
                    </div>
                    {isOwner ? (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-gray-100 text-gray-500">
                        Creator
                      </span>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          isSelected
                            ? onRequestRemove({ uid: c.uid, displayName: c.displayName })
                            : onAdd({ uid: c.uid, displayName: c.displayName })
                        }
                        className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 text-white
                                    transition-colors ${isSelected ? 'bg-red-400 hover:bg-red-500' : 'hover:opacity-80'}`}
                        style={isSelected ? {} : { background: 'var(--color-primary)' }}
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5}
                            d={isSelected ? 'M6 18L18 6M6 6l12 12' : 'M12 4v16m8-8H4'} />
                        </svg>
                      </button>
                    )}
                  </li>
                )
              })}
            </ul>
          )}
        </div>
      </div>
    </>
  )
}

// ─── CoauthorsPicker ──────────────────────────────────────────────────────────
function CoauthorsPicker({
  selected,
  ownerUid,
  onAdd,
  onRemove,
}: {
  selected: CoauthorEntry[]
  ownerUid?: string
  onAdd: (c: CoauthorEntry) => void
  onRemove: (uid: string) => void
}) {
  const { user } = useAuth()
  const [showDrawer, setShowDrawer] = useState(false)
  const [pendingRemoval, setPendingRemoval] = useState<CoauthorEntry | null>(null)

  const selectedUids = useMemo(() => new Set(selected.map((c) => c.uid)), [selected])

  useEffect(() => {
    if (!pendingRemoval) return
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setPendingRemoval(null)
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [pendingRemoval])

  function confirmRemove() {
    if (!pendingRemoval) return
    onRemove(pendingRemoval.uid)
    setPendingRemoval(null)
  }

  const isSelfRemoval = pendingRemoval?.uid === user?.uid

  return (
    <div>
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-2">
          {selected.map((c) => (
            <span
              key={c.uid}
              className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs
                         bg-brand-50 text-brand-700 border border-brand-200"
            >
              {c.displayName}
            </span>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setShowDrawer(true)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border-2 border-dashed
                   border-gray-300 text-sm text-gray-600 hover:border-brand-400
                   hover:text-brand-600 transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0" />
        </svg>
        Manage Co-Authors
      </button>

      {showDrawer && (
        <CoauthorsDrawer
          selectedUids={selectedUids}
          ownerUid={ownerUid}
          onAdd={onAdd}
          onRequestRemove={setPendingRemoval}
          onClose={() => setShowDrawer(false)}
        />
      )}

      {pendingRemoval && (
        <>
          <div className="fixed inset-0 z-50 bg-black/50" onClick={() => setPendingRemoval(null)} />
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 pointer-events-none">
            <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 pointer-events-auto">
              <h3 className="font-semibold text-base mb-2" style={{ color: 'var(--color-dark)' }}>
                Remove co-author?
              </h3>
              {isSelfRemoval ? (
                <p className="text-sm mb-4" style={{ color: 'var(--color-text)' }}>
                  You are about to remove yourself as a co-author of this design.{' '}
                  <strong>You will no longer be able to edit or publish it.</strong> This action takes
                  effect immediately after saving.
                </p>
              ) : (
                <p className="text-sm mb-4" style={{ color: 'var(--color-text)' }}>
                  Remove <strong>{pendingRemoval.displayName}</strong> as a co-author? They will lose
                  edit access to this design.
                </p>
              )}
              <div className="flex gap-3 justify-end">
                <button
                  type="button"
                  onClick={() => setPendingRemoval(null)}
                  className="px-4 py-2 rounded-xl text-sm font-medium border border-gray-200 hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={confirmRemove}
                  className="px-4 py-2 rounded-xl text-sm font-medium text-white transition-colors hover:opacity-90"
                  style={{ background: 'var(--color-primary)' }}
                >
                  {isSelfRemoval ? 'Remove myself' : 'Remove'}
                </button>
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function DesignForm({ values, onChange, lockedMethodology = false, ownerUid }: Props) {
  const [showMaterialsDrawer, setShowMaterialsDrawer] = useState(false)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  function set<K extends keyof DesignFormValues>(key: K, val: DesignFormValues[K]) {
    onChange({ ...values, [key]: val })
  }

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
    set('steps', values.steps.map((s, idx) => (idx === i ? { ...s, instruction } : s)))
  }

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
    set(
      'research_questions',
      values.research_questions.map((q, idx) => (idx === i ? { ...q, [field]: val } : q)),
    )
  }

  const selectedMaterialIds = useMemo(
    () => new Set(values.materials.map((m) => m.id)),
    [values.materials],
  )

  function handleAddMaterial(m: Material) {
    if (selectedMaterialIds.has(m.id)) return
    set('materials', [
      ...values.materials,
      { id: m.id, name: m.name, quantity: '1', alternatives_allowed: false, criticality: 'required' },
    ])
  }

  function handleRemoveMaterial(m: Material) {
    set('materials', values.materials.filter((e) => e.id !== m.id))
  }

  function addReference(id: string) {
    if (values.reference_experiment_ids.includes(id)) return
    set('reference_experiment_ids', [...values.reference_experiment_ids, id])
  }
  function removeReference(id: string) {
    set('reference_experiment_ids', values.reference_experiment_ids.filter((r) => r !== id))
  }

  return (
    <div className="space-y-5">
      {lockedMethodology && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 text-sm text-amber-800">
          This design has been executed. Methodology fields (steps, variables, research questions,
          hypothesis, materials) are locked and cannot be changed.
        </div>
      )}

      {/* ── Card 1: Basic fields (no header) ──────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 space-y-6">

        {/* Title */}
        <div>
          <FieldLabel label="Title" required />
          <input
            type="text"
            required
            value={values.title}
            onChange={(e) => set('title', e.target.value)}
            className="w-full input-sm"
          />
        </div>

        {/* Summary */}
        <div>
          <FieldLabel label="Summary" required />
          <textarea
            required
            rows={2}
            value={values.summary}
            onChange={(e) => set('summary', e.target.value)}
            placeholder="A brief overview of what this experiment is about and what you hope to learn."
            className="w-full input-sm resize-y"
          />
        </div>

        {/* Discipline tags + Difficulty */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <FieldLabel label="Discipline tags" required />
            <input
              type="text"
              required
              value={values.discipline_tags}
              onChange={(e) => set('discipline_tags', e.target.value)}
              placeholder="biology, ecology  (comma-separated)"
              className="w-full input-sm"
            />
          </div>
          <div>
            <FieldLabel label="Difficulty level" required />
            <select
              value={values.difficulty_level}
              onChange={(e) => set('difficulty_level', e.target.value as DifficultyLevel)}
              className="w-full input-sm"
            >
              {DIFFICULTY_OPTIONS.map((d) => <option key={d} value={d}>{d}</option>)}
            </select>
          </div>
        </div>

        {/* Materials */}
        <div>
          <FieldLabel label="Materials" required />
          {values.materials.length > 0 && (
            <ul className="mb-3 space-y-1.5">
              {values.materials.map((m) => (
                <li
                  key={m.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg
                             bg-gray-50 border border-gray-200 text-sm text-gray-800"
                >
                  <span>{m.name}</span>
                  {!lockedMethodology && (
                    <button
                      type="button"
                      onClick={() => set('materials', values.materials.filter((e) => e.id !== m.id))}
                      className="text-gray-400 hover:text-red-500 text-lg leading-none px-1 shrink-0"
                    >
                      ×
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
          {!lockedMethodology && (
            <button
              type="button"
              onClick={() => setShowMaterialsDrawer(true)}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl border-2 border-dashed
                         border-gray-300 text-sm text-gray-600 hover:border-brand-400
                         hover:text-brand-600 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
              </svg>
              Add Materials
            </button>
          )}
        </div>

        {/* Methodology */}
        <div>
          <FieldLabel label="Methodology" required />
          {values.steps.map((step, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <span className="shrink-0 w-6 text-sm text-gray-400 pt-2">{step.step_number}.</span>
              <textarea
                rows={2}
                required={i === 0}
                value={step.instruction}
                disabled={lockedMethodology}
                onChange={(e) => updateStep(i, e.target.value)}
                placeholder={`Step ${step.step_number}`}
                className="flex-1 input-sm resize-y"
              />
              {!lockedMethodology && values.steps.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeStep(i)}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {!lockedMethodology && (
            <button type="button" onClick={addStep} className="text-sm text-brand-600 hover:underline">
              + Add step
            </button>
          )}
        </div>

        {/* Outcomes / Research questions */}
        <div>
          <FieldLabel label="Outcomes / Research Questions" required />
          {values.research_questions.map((q, i) => (
            <div key={i} className="flex gap-2 mb-2">
              <input
                type="text"
                required={i === 0}
                value={q.question}
                disabled={lockedMethodology}
                onChange={(e) => updateQuestion(i, 'question', e.target.value)}
                placeholder="Outcome or research question"
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
                <button
                  type="button"
                  onClick={() => removeQuestion(i)}
                  className="text-gray-400 hover:text-red-500 text-lg leading-none px-1"
                >
                  ×
                </button>
              )}
            </div>
          ))}
          {!lockedMethodology && (
            <button type="button" onClick={addQuestion} className="text-sm text-brand-600 hover:underline">
              + Add outcome
            </button>
          )}
        </div>

        {/* Safety considerations */}
        <div>
          <FieldLabel label="Safety Considerations" />
          <textarea
            rows={2}
            value={values.safety_considerations}
            onChange={(e) => set('safety_considerations', e.target.value)}
            placeholder="Any safety notes, required PPE, hazards, or supervision requirements."
            className="w-full input-sm resize-y"
          />
        </div>

        {/* Cover image */}
        <div>
          <FieldLabel label="Cover Image" />
          <CoverImageUpload
            value={values.cover_image_url}
            onChange={(url) => set('cover_image_url', url)}
          />
        </div>

      </div>

      {/* ── Card 2: Design Files ──────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h3 className="text-sm font-semibold text-gray-700">Design Files</h3>
        </div>
        <div className="p-6">
          <DesignFilesUpload
            files={values.design_files}
            onChange={(f) => set('design_files', f)}
          />
        </div>
      </div>

      {/* ── Card 3: Advanced Details (collapsible) ────────────────────────── */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <button
          type="button"
          onClick={() => setAdvancedOpen((o) => !o)}
          className="w-full flex items-center justify-between px-6 py-4 text-left
                     hover:bg-gray-50 transition-colors"
        >
          <h3 className="text-sm font-semibold text-gray-700">Advanced Details</h3>
          <svg
            className={`w-4 h-4 text-gray-400 transition-transform ${advancedOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {advancedOpen && (
          <div className="px-6 pb-6 border-t border-gray-100 space-y-5 pt-5">

            <SubHeader>Attribution</SubHeader>

            <div>
              <FieldLabel
                label="Co-Authors"
                tooltip="Add collaborators who contributed to this design. Only users you are already connected with as collaborators can be added."
              />
              <CoauthorsPicker
                selected={values.coauthors}
                ownerUid={ownerUid}
                onAdd={(c) => {
                  if (!values.coauthors.find((x) => x.uid === c.uid)) {
                    set('coauthors', [...values.coauthors, c])
                  }
                }}
                onRemove={(uid) => set('coauthors', values.coauthors.filter((c) => c.uid !== uid))}
              />
            </div>

            <div>
              <FieldLabel
                label="Reference Experiments"
                tooltip={'Link other Replic designs that directly inspired or informed this one.'}
              />
              <DesignReferencePicker
                selectedIds={values.reference_experiment_ids}
                onAdd={addReference}
                onRemove={removeReference}
              />
            </div>

            <SubHeader>Scientific Methodology</SubHeader>

            <div>
              <FieldLabel
                label="Hypothesis"
                tooltip='A falsifiable statement predicting the relationship between your variables. Example: "Increasing light exposure from 6 h to 12 h per day will increase bean-sprout height by at least 20%."'
              />
              <textarea
                rows={2}
                value={values.hypothesis}
                disabled={lockedMethodology}
                onChange={(e) => set('hypothesis', e.target.value)}
                className="w-full input-sm resize-y"
              />
            </div>

            <VariableList
              label="Independent Variables"
              tooltip="The variable(s) you intentionally change. Example: light exposure duration (6 h, 9 h, 12 h)."
              vars={values.independent_variables}
              onUpdate={(v) => set('independent_variables', v)}
              locked={lockedMethodology}
            />

            <VariableList
              label="Dependent Variables"
              tooltip="The outcome(s) you measure in response to the independent variable. Example: plant height (cm) after 14 days."
              vars={values.dependent_variables}
              onUpdate={(v) => set('dependent_variables', v)}
              locked={lockedMethodology}
            />

            <VariableList
              label="Controlled Variables"
              tooltip="Factors kept constant to ensure a fair test. Example: soil type, pot size, watering volume, room temperature."
              vars={values.controlled_variables}
              onUpdate={(v) => set('controlled_variables', v)}
              locked={lockedMethodology}
            />

            <div>
              <FieldLabel
                label="Analysis Plan"
                tooltip='How you intend to analyse the collected data. Example: "Calculate mean height per group; run a one-way ANOVA and Tukey post-hoc test."'
              />
              <textarea
                rows={2}
                value={values.analysis_plan}
                onChange={(e) => set('analysis_plan', e.target.value)}
                className="w-full input-sm resize-y"
              />
            </div>

            <SubHeader>Collaboration</SubHeader>

            <div>
              <FieldLabel label="Collaboration notes" />
              <textarea
                rows={2}
                value={values.collaboration_notes}
                onChange={(e) => set('collaboration_notes', e.target.value)}
                className="w-full input-sm resize-y"
              />
            </div>

            <SubHeader>Compliance &amp; Ethics</SubHeader>

            <div>
              <FieldLabel
                label="Ethical Considerations"
                tooltip='Any ethical issues relevant to this design and how they are addressed. Example: "Participants are anonymous; parental consent required for under-18 executors."'
              />
              <textarea
                rows={2}
                value={values.ethical_considerations}
                onChange={(e) => set('ethical_considerations', e.target.value)}
                className="w-full input-sm resize-y"
              />
            </div>

            <div>
              <FieldLabel
                label="Disclaimers"
                tooltip='Any caveats or limitations the author wants to flag upfront. Example: "Results may vary significantly outside a controlled lab environment."'
              />
              <textarea
                rows={2}
                value={values.disclaimers}
                onChange={(e) => set('disclaimers', e.target.value)}
                className="w-full input-sm resize-y"
              />
            </div>

          </div>
        )}
      </div>

      {/* Materials drawer */}
      {showMaterialsDrawer && (
        <MaterialsDrawer
          labIds={selectedMaterialIds}
          pendingIds={new Set()}
          onAdd={handleAddMaterial}
          onRemove={handleRemoveMaterial}
          onClose={() => setShowMaterialsDrawer(false)}
          onMaterialCreated={handleAddMaterial}
        />
      )}
    </div>
  )
}
