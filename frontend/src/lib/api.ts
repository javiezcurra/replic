import { auth } from './firebase'

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? ''

class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public body: unknown,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }

  const token = await auth.currentUser?.getIdToken()
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  let responseBody: unknown
  const contentType = res.headers.get('content-type')
  if (contentType?.includes('application/json')) {
    responseBody = await res.json()
  } else {
    responseBody = await res.text()
  }

  if (!res.ok) {
    const message =
      (responseBody as { message?: string } | null)?.message ??
      `${method} ${path} → ${res.status}`
    throw new ApiError(res.status, message, responseBody)
  }

  return responseBody as T
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body),
  patch: <T>(path: string, body?: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
}

export { ApiError }
