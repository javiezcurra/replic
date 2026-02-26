import { useRef, useState } from 'react'
import { api } from '../lib/api'
import type { MaterialType, MaterialCategory } from '../types/material'

// Simple RFC 4180-compatible CSV parser
function parseCSV(text: string): { headers: string[]; rows: Record<string, string>[] } {
  const lines = text.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
  const nonEmpty = lines.filter((l) => l.trim() !== '')
  if (nonEmpty.length === 0) return { headers: [], rows: [] }

  function parseLine(line: string): string[] {
    const fields: string[] = []
    let i = 0
    while (i <= line.length) {
      if (i === line.length) {
        break
      }
      if (line[i] === '"') {
        let field = ''
        i++ // skip opening quote
        while (i < line.length) {
          if (line[i] === '"' && line[i + 1] === '"') {
            field += '"'
            i += 2
          } else if (line[i] === '"') {
            i++ // skip closing quote
            break
          } else {
            field += line[i]
            i++
          }
        }
        fields.push(field)
        if (i < line.length && line[i] === ',') i++
      } else {
        const end = line.indexOf(',', i)
        if (end === -1) {
          fields.push(line.slice(i))
          break
        } else {
          fields.push(line.slice(i, end))
          i = end + 1
        }
      }
    }
    return fields
  }

  const headers = parseLine(nonEmpty[0]).map((h) => h.trim())
  const rows = nonEmpty.slice(1).map((line) => {
    const values = parseLine(line)
    const row: Record<string, string> = {}
    headers.forEach((h, idx) => {
      row[h] = values[idx]?.trim() ?? ''
    })
    return row
  })

  return { headers, rows }
}

// Known optional string fields
const OPTIONAL_STRING_FIELDS = ['description', 'safety_notes', 'link', 'supplier', 'image_url'] as const

function rowToMaterial(row: Record<string, string>) {
  const body: Record<string, unknown> = {
    name: row.name?.trim() ?? '',
    type: row.type?.trim() as MaterialType,
    category: row.category?.trim() as MaterialCategory,
    // Support both | and , as tag delimiters
    tags: row.tags ? row.tags.split(/[|,]/).map((t) => t.trim()).filter(Boolean) : [],
  }

  for (const field of OPTIONAL_STRING_FIELDS) {
    if (row[field]) body[field] = row[field]
  }

  if (row.typical_cost_usd) {
    const cost = parseFloat(row.typical_cost_usd)
    if (!isNaN(cost)) body.typical_cost_usd = cost
  }

  return body
}

type UpsertResult =
  | { name: string; action: 'created' | 'updated'; id: string }
  | { name: string; error: string }

interface Props {
  onClose: () => void
  onComplete: () => void
}

export default function BulkUploadMaterialsModal({ onClose, onComplete }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState<Record<string, string>[]>([])
  const [fileName, setFileName] = useState('')
  const [parseError, setParseError] = useState('')
  const [uploading, setUploading] = useState(false)
  const [results, setResults] = useState<UpsertResult[] | null>(null)

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setFileName(file.name)
    setParseError('')
    setResults(null)

    const reader = new FileReader()
    reader.onload = (ev) => {
      try {
        const text = ev.target?.result as string
        const { rows: parsed } = parseCSV(text)
        if (parsed.length === 0) {
          setParseError('No data rows found in CSV.')
          setRows([])
        } else {
          setRows(parsed)
        }
      } catch {
        setParseError('Failed to parse CSV file.')
        setRows([])
      }
    }
    reader.readAsText(file)
  }

  async function handleUpload() {
    if (rows.length === 0 || uploading) return
    setUploading(true)

    try {
      const materials = rows.map(rowToMaterial)
      const res = await api.post<{ status: string; results: UpsertResult[] }>(
        '/api/materials/bulk-upsert',
        { materials },
      )
      setResults(res.results)
      if (res.results.some((r) => !('error' in r))) {
        onComplete()
      }
    } catch (err: any) {
      const message = err?.body?.message ?? err?.message ?? 'Upload failed'
      setParseError(message)
    } finally {
      setUploading(false)
    }
  }

  const created  = results?.filter((r) => 'action' in r && r.action === 'created').length ?? 0
  const updated  = results?.filter((r) => 'action' in r && r.action === 'updated').length ?? 0
  const failed   = results?.filter((r) => 'error'  in r).length ?? 0

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md">
        {/* Header */}
        <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Bulk Upload Materials</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 text-2xl leading-none"
            aria-label="Close"
          >
            &times;
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 space-y-4">
          {!results ? (
            <>
              <p className="text-sm text-gray-600">
                Upload a CSV file with a header row. Required columns:{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">name</code>,{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">type</code>,{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">category</code>. Optional:{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">description</code>,{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">tags</code>,{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">safety_notes</code>,{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">supplier</code>,{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">link</code>,{' '}
                <code className="text-xs bg-gray-100 px-1 rounded">typical_cost_usd</code>.
              </p>
              <p className="text-xs text-gray-500">
                Tags can be separated by <code className="bg-gray-100 px-1 rounded">|</code> or{' '}
                <code className="bg-gray-100 px-1 rounded">,</code> — e.g.{' '}
                <code className="bg-gray-100 px-1 rounded">chemistry|biology|measurement</code>.
                If a row's name matches an existing material it will be updated; otherwise a new
                one is created.
              </p>

              <div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".csv"
                  onChange={handleFileChange}
                  className="hidden"
                  id="csv-bulk-upload"
                />
                <label
                  htmlFor="csv-bulk-upload"
                  className="btn-secondary text-sm cursor-pointer inline-block"
                >
                  Choose CSV file
                </label>
                {fileName && (
                  <span className="ml-3 text-sm text-gray-600">{fileName}</span>
                )}
              </div>

              {parseError && <p className="text-sm text-red-600">{parseError}</p>}

              {rows.length > 0 && !uploading && (
                <p className="text-sm text-gray-700">
                  Found <strong>{rows.length}</strong> row{rows.length !== 1 ? 's' : ''} ready to
                  upload.
                </p>
              )}

              {uploading && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <div className="w-4 h-4 border-2 border-gray-300 border-t-gray-600 rounded-full animate-spin" />
                  Uploading {rows.length} row{rows.length !== 1 ? 's' : ''}…
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                {created > 0 && (
                  <span className="text-green-700 font-medium">{created} created</span>
                )}
                {updated > 0 && (
                  <span className="text-blue-700 font-medium">{updated} updated</span>
                )}
                {failed > 0 && (
                  <span className="text-red-600 font-medium">{failed} failed</span>
                )}
              </div>

              {failed > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {results
                    .filter((r): r is { name: string; error: string } => 'error' in r)
                    .map((r, i) => (
                      <div
                        key={i}
                        className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded"
                      >
                        <span className="font-medium">{r.name || '(unnamed)'}:</span> {r.error}
                      </div>
                    ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary text-sm">
            {results ? 'Close' : 'Cancel'}
          </button>
          {!results && (
            <button
              onClick={handleUpload}
              disabled={rows.length === 0 || uploading}
              className="btn-primary text-sm disabled:opacity-50"
            >
              {uploading ? 'Uploading…' : 'Upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
