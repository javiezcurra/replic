import { useEffect, useMemo, useState } from 'react'
import { api } from '../lib/api'
import type { Material } from '../types/material'
import MaterialCard from '../components/MaterialCard'
import MaterialDetailModal from '../components/MaterialDetailModal'
import MaterialsDrawer from '../components/MaterialsDrawer'

export default function MyLab() {
  const [labMaterials, setLabMaterials] = useState<Material[]>([])
  const [loading, setLoading] = useState(true)
  const [pendingIds, setPendingIds] = useState<Set<string>>(new Set())
  const [showDrawer, setShowDrawer] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)

  const labIds = useMemo(() => new Set(labMaterials.map((m) => m.id)), [labMaterials])
  const equipment   = labMaterials.filter((m) => m.type === 'Equipment')
  const consumables = labMaterials.filter((m) => m.type === 'Consumable')

  async function fetchLab() {
    try {
      const res = await api.get<{ status: string; data: Material[] }>('/api/lab')
      setLabMaterials(res.data)
    } catch {
      // keep empty
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchLab() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  function setPending(id: string, on: boolean) {
    setPendingIds((prev) => {
      const next = new Set(prev)
      on ? next.add(id) : next.delete(id)
      return next
    })
  }

  async function handleAdd(material: Material) {
    if (pendingIds.has(material.id)) return
    setPending(material.id, true)
    try {
      await api.post(`/api/lab/${material.id}`)
      setLabMaterials((prev) => [...prev, material])
    } finally {
      setPending(material.id, false)
    }
  }

  async function handleRemove(material: Material) {
    if (pendingIds.has(material.id)) return
    setPending(material.id, true)
    try {
      await api.delete(`/api/lab/${material.id}`)
      setLabMaterials((prev) => prev.filter((m) => m.id !== material.id))
      if (selectedMaterial?.id === material.id) setSelectedMaterial(null)
    } finally {
      setPending(material.id, false)
    }
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-surface)' }}>
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-10">

        {/* Page header */}
        <div className="flex flex-wrap items-end justify-between gap-4 mb-8">
          <div>
            <h1
              className="text-5xl sm:text-6xl text-ink"
              style={{ fontFamily: 'var(--font-display)' }}
            >
              Lab Inventory
            </h1>
            <p className="mt-2 text-lg text-plum">
              Materials you use.
            </p>
          </div>
          <button
            type="button"
            onClick={() => setShowDrawer(true)}
            className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold
                       text-white hover:opacity-90 transition-all active:scale-95"
            style={{ background: 'var(--color-primary)' }}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
            </svg>
            Add Materials
          </button>
        </div>

        {loading ? (
          <div className="flex justify-center py-24">
            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : labMaterials.length === 0 ? (
          <EmptyLab onAdd={() => setShowDrawer(true)} />
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <LabSection
              title="Equipment"
              emoji="🔬"
              materials={equipment}
              labIds={labIds}
              pendingIds={pendingIds}
              onRemove={handleRemove}
              onDetails={setSelectedMaterial}
              emptyMsg="No equipment in your lab yet."
            />
            <LabSection
              title="Consumables"
              emoji="🧪"
              materials={consumables}
              labIds={labIds}
              pendingIds={pendingIds}
              onRemove={handleRemove}
              onDetails={setSelectedMaterial}
              emptyMsg="No consumables in your lab yet."
            />
          </div>
        )}
      </div>

      {showDrawer && (
        <MaterialsDrawer
          labIds={labIds}
          pendingIds={pendingIds}
          onAdd={handleAdd}
          onRemove={handleRemove}
          onClose={() => setShowDrawer(false)}
        />
      )}

      {selectedMaterial && (
        <MaterialDetailModal
          material={selectedMaterial}
          onClose={() => setSelectedMaterial(null)}
          inLab={labIds.has(selectedMaterial.id)}
          onAdd={handleAdd}
          onRemove={handleRemove}
          actionPending={pendingIds.has(selectedMaterial.id)}
        />
      )}
    </div>
  )
}

function LabSection({
  title,
  emoji,
  materials,
  labIds,
  pendingIds,
  onRemove,
  onDetails,
  emptyMsg,
}: {
  title: string
  emoji: string
  materials: Material[]
  labIds: Set<string>
  pendingIds: Set<string>
  onRemove: (m: Material) => void
  onDetails: (m: Material) => void
  emptyMsg: string
}) {
  return (
    <div>
      {/* Section header */}
      <div
        className="flex items-center justify-between px-5 py-3.5 rounded-2xl mb-3"
        style={{ background: title === 'Equipment' ? 'var(--color-dark)' : 'var(--color-primary)' }}
      >
        <div className="flex items-center gap-3">
          <span className="text-xl">{emoji}</span>
          <h2
            className="text-lg font-semibold text-white"
            style={{ fontFamily: 'var(--font-display)' }}
          >
            {title}
          </h2>
        </div>
        <span className="text-white/50 text-sm font-medium" style={{ fontFamily: 'var(--font-mono)' }}>
          {materials.length}
        </span>
      </div>

      {materials.length === 0 ? (
        <p className="text-sm text-muted text-center py-6">{emptyMsg}</p>
      ) : (
        <div className="space-y-2">
          {materials.map((m) => (
            <MaterialCard
              key={m.id}
              material={m}
              onDetails={onDetails}
              inLab={labIds.has(m.id)}
              onRemove={onRemove}
              actionPending={pendingIds.has(m.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function EmptyLab({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="text-center py-20">
      <div className="text-6xl mb-4">🧫</div>
      <h2
        className="text-2xl text-ink mb-2"
        style={{ fontFamily: 'var(--font-display)' }}
      >
        Your lab is empty
      </h2>
      <p className="text-muted text-sm mb-6 max-w-xs mx-auto">
        Browse the materials catalog and add the ones you work with to your lab.
      </p>
      <button
        type="button"
        onClick={onAdd}
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
                   text-white hover:opacity-90 transition-all"
        style={{ background: 'var(--color-primary)' }}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M12 4v16m8-8H4" />
        </svg>
        Add Materials
      </button>
    </div>
  )
}
