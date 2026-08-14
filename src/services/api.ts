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

  // Ambil token dari localStorage / sessionStorage jika user terautentikasi
  let token =
    localStorage.getItem('autoparts_token') ||
    localStorage.getItem('token') ||
    localStorage.getItem('access_token') ||
    sessionStorage.getItem('autoparts_token') ||
    sessionStorage.getItem('token') ||
    ''

  if (!token) {
    const sessionData =
      localStorage.getItem('autoparts_user_session') ||
      sessionStorage.getItem('autoparts_user_session')
    if (sessionData) {
      try {
        const parsed = JSON.parse(sessionData)
        token = parsed.token || parsed.access_token || ''
      } catch {
        // ignore
      }
    }
  }

  const authHeader = token
    ? { Authorization: token.startsWith('Bearer ') ? token : `Bearer ${token}` }
    : {}

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...authHeader,
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
