/**
 * api.ts
 * Konfigurasi dasar HTTP client untuk komunikasi dengan backend NiagaGudang.
 * Base URL diambil dari environment variable atau default localhost:8080.
 */

export const BASE_URL =
  import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8080'

export interface ApiResponse<T> {
  data: T
  message?: string
  error?: string
}

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message)
    this.name = 'ApiError'
  }
}

/**
 * Wrapper fetch dengan JSON parsing, error handling, dan Content-Type header.
 */
export async function apiFetch<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const url = `${BASE_URL}${path}`

  const sessionData = localStorage.getItem('autoparts_user_session')
  let token = ''
  if (sessionData) {
    try {
      const parsed = JSON.parse(sessionData)
      token = parsed.token || ''
    } catch {
      // ignore
    }
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...((options.headers as Record<string, string>) ?? {}),
  }

  const response = await fetch(url, { ...options, headers })

  if (!response.ok) {
    let errorMessage = `HTTP ${response.status}: ${response.statusText}`
    try {
      const body = await response.json()
      errorMessage = body?.error ?? body?.message ?? errorMessage
    } catch {
      // Non-JSON error body, keep default message
    }
    throw new ApiError(response.status, errorMessage)
  }

  return response.json() as Promise<T>
}
