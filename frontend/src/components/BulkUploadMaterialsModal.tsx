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
        // trailing comma produces an empty field
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

// Known optional string fields — forward-compatible: add new ones here as the schema grows
const OPTIONAL_STRING_FIELDS = ['description', 'safety_notes', 'link', 'supplier', 'image_url'] as const

function rowToBody(row: Record<string, string>) {
  const body: Record<string, unknown> = {
    name: row.name?.trim() ?? '',
    type: row.type?.trim() as MaterialType,
    category: row.category?.trim() as MaterialCategory,
    tags: row.tags ? row.tags.split(',').map((t) => t.trim()).filter(Boolean) : [],
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

interface RowResult {
  rowIndex: number
  success: boolean
  error?: string
}

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
  const [progress, setProgress] = useState(0)
  const [results, setResults] = useState<RowResult[] | null>(null)

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
    setProgress(0)

    const uploadResults: RowResult[] = []

    for (let i = 0; i < rows.length; i++) {
      const body = rowToBody(rows[i])
      try {
        await api.post('/api/materials', body)
        uploadResults.push({ rowIndex: i + 2, success: true }) // +2: 1-based index + header row
      } catch (err: any) {
        const message =
          (err?.body as any)?.message ?? err?.message ?? 'Unknown error'
        uploadResults.push({ rowIndex: i + 2, success: false, error: message })
      }
      setProgress(i + 1)
    }

    setResults(uploadResults)
    setUploading(false)

    if (uploadResults.some((r) => r.success)) {
      onComplete()
    }
  }

  const succeeded = results?.filter((r) => r.success).length ?? 0
  const failed = results?.filter((r) => !r.success).length ?? 0

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
                <div className="space-y-1">
                  <div className="flex justify-between text-xs text-gray-500">
                    <span>Uploading…</span>
                    <span>
                      {progress} / {rows.length}
                    </span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2">
                    <div
                      className="bg-brand-600 h-2 rounded-full transition-all"
                      style={{ width: `${(progress / rows.length) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-4 text-sm">
                {succeeded > 0 && (
                  <span className="text-green-700 font-medium">
                    {succeeded} succeeded
                  </span>
                )}
                {failed > 0 && (
                  <span className="text-red-600 font-medium">{failed} failed</span>
                )}
              </div>

              {failed > 0 && (
                <div className="max-h-48 overflow-y-auto space-y-1">
                  {results
                    .filter((r) => !r.success)
                    .map((r) => (
                      <div
                        key={r.rowIndex}
                        className="text-xs text-red-600 bg-red-50 px-3 py-1.5 rounded"
                      >
                        <span className="font-medium">Row {r.rowIndex}:</span> {r.error}
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
              {uploading ? `Uploading ${progress}/${rows.length}…` : 'Upload'}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
