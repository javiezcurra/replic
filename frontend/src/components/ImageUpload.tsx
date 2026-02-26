import { useRef, useState } from 'react'
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage'
import { storage } from '../lib/firebase'

interface Props {
  value: string          // current image URL; empty string if none
  onChange: (url: string) => void
}

export default function ImageUpload({ value, onChange }: Props) {
  const [uploading, setUploading] = useState(false)
  const [progress, setProgress] = useState(0)
  const [error, setError] = useState('')
  const fileRef = useRef<HTMLInputElement>(null)

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    if (!file.type.startsWith('image/')) {
      setError('Please select an image file')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB')
      return
    }

    setError('')
    setUploading(true)
    setProgress(0)

    const storageRef = ref(storage, `materials/${crypto.randomUUID()}_${file.name}`)
    const task = uploadBytesResumable(storageRef, file)

    task.on(
      'state_changed',
      (snapshot) => {
        setProgress(Math.round((snapshot.bytesTransferred / snapshot.totalBytes) * 100))
      },
      (err) => {
        setError(err.message)
        setUploading(false)
      },
      async () => {
        const url = await getDownloadURL(task.snapshot.ref)
        onChange(url)
        setUploading(false)
      },
    )
  }

  return (
    <div>
      {value ? (
        <div className="flex items-start gap-3">
          <img
            src={value}
            alt="Material preview"
            className="h-24 w-24 object-cover rounded-lg border border-gray-200 shrink-0"
          />
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="btn-secondary text-xs"
            >
              Replace image
            </button>
            <button
              type="button"
              onClick={() => onChange('')}
              className="block text-xs text-red-500 hover:underline"
            >
              Remove image
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={uploading}
          className="w-full border-2 border-dashed border-gray-300 rounded-lg p-6 text-center hover:border-brand-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {uploading ? (
            <div className="space-y-2">
              <div className="text-sm text-gray-600">Uploading… {progress}%</div>
              <div className="w-full bg-gray-200 rounded-full h-1.5">
                <div
                  className="bg-brand-600 h-1.5 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <>
              <svg className="mx-auto h-8 w-8 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5}
                  d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
              <p className="text-sm text-gray-500">Click to upload an image</p>
              <p className="text-xs text-gray-400 mt-1">PNG, JPG, GIF, WebP — max 5 MB</p>
            </>
          )}
        </button>
      )}

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFile}
      />

      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  )
}
