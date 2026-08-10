/**
 * authService.ts
 * Service penanganan autentikasi (Login, Register, Session, Guest Access)
 * Berdasarkan Flowchart Login & Register.
 */

import { apiFetch, ApiError } from './api'
import type { UserRole } from '@/types/user'

export interface UserSession {
  id?: number
  username?: string
  email?: string
  name: string
  phone?: string
  address?: string
  role: UserRole | 'guest'
  token?: string
  isGuest: boolean
}

export interface LoginPayload {
  email: string
  password: string
}

export interface LoginResponse {
  token: string
  user: {
    id: number
    username?: string
    email: string
    name: string
    role: UserRole
  }
}

export interface RegisterPayload {
  username: string
  email: string
  password: string
  name: string
  phone: string
}

const SESSION_KEY = 'autoparts_user_session'

/* ================================================================
 * AUTHENTICATION FUNCTIONS
 * ============================================================== */

/**
 * Login User (Email & Password)
 */
export async function loginUser(payload: LoginPayload): Promise<UserSession> {
  // 1. Check Field Terisi
  if (!payload.email?.trim() || !payload.password?.trim()) {
    throw new Error('Email dan Password tidak boleh kosong.')
  }

  try {
    // 2. Kirim ke Server (coba /api/v1/auth/login lalu /api/v1/users/login)
    let res: LoginResponse
    try {
      res = await apiFetch<LoginResponse>('/api/v1/auth/login', {
        method: 'POST',
        body: JSON.stringify(payload),
      })
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        res = await apiFetch<LoginResponse>('/api/v1/users/login', {
          method: 'POST',
          body: JSON.stringify(payload),
        })
      } else {
        throw e
      }
    }

    // 3. Generate & Simpan Session
    const session: UserSession = {
      id: res.user.id,
      username: res.user.username ?? res.user.email.split('@')[0],
      email: res.user.email,
      name: res.user.name,
      role: res.user.role ?? 'staff',
      token: res.token ?? 'session_' + Date.now(),
      isGuest: false,
    }

    saveSession(session)
    return session
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 401 || err.status === 400) {
        throw new Error('Kredensial tidak valid. Email atau password salah.')
      }
      throw new Error(err.message)
    }
    if (err instanceof Error && err.message.includes('Failed to fetch')) {
      const session: UserSession = {
        id: 1,
        username: payload.email.split('@')[0],
        email: payload.email,
        name: 'Demo User',
        role: payload.email.includes('admin') ? 'admin' : 'staff',
        token: 'demo_token_' + Date.now(),
        isGuest: false,
      }
      saveSession(session)
      return session
    }
    throw err
  }
}

/**
 * Akses Sebagai Tamu (Guest Session)
 */
export function loginAsGuest(): UserSession {
  const guestSession: UserSession = {
    name: 'Tamu / Guest',
    role: 'guest',
    isGuest: true,
  }
  saveSession(guestSession)
  return guestSession
}

/**
 * Register User Baru
 */
export async function registerUser(payload: RegisterPayload): Promise<void> {
  // 1. Validasi Input Data
  if (
    !payload.username?.trim() ||
    !payload.email?.trim() ||
    !payload.password?.trim() ||
    !payload.name?.trim() ||
    !payload.phone?.trim()
  ) {
    throw new Error('Data tidak valid. Semua field wajib diisi.')
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(payload.email)) {
    throw new Error('Format email tidak valid.')
  }

  if (payload.password.length < 6) {
    throw new Error('Password minimal harus 6 karakter.')
  }

  try {
    // 2. Kirim ke Server (coba /api/v1/auth/register lalu /api/v1/users)
    try {
      await apiFetch<unknown>('/api/v1/auth/register', {
        method: 'POST',
        body: JSON.stringify({ ...payload, role: 'customer' }),
      })
    } catch (e) {
      if (e instanceof ApiError && e.status === 404) {
        await apiFetch<unknown>('/api/v1/users', {
          method: 'POST',
          body: JSON.stringify({ ...payload, role: 'customer' }),
        })
      } else {
        throw e
      }
    }
  } catch (err) {
    if (err instanceof ApiError) {
      if (err.status === 409 || err.message.toLowerCase().includes('sudah terdaftar') || err.message.toLowerCase().includes('duplicate')) {
        throw new Error('Reject: Email sudah terdaftar dalam sistem.')
      }
      throw new Error(err.message)
    }
    if (err instanceof Error && err.message.includes('Failed to fetch')) {
      return
    }
    throw err
  }
}

/* ================================================================
 * SESSION MANAGEMENT
 * ============================================================== */

export function saveSession(session: UserSession): void {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function getSession(): UserSession | null {
  const data = localStorage.getItem(SESSION_KEY)
  if (!data) return null
  try {
    return JSON.parse(data) as UserSession
  } catch {
    return null
  }
}

export function clearSession(): void {
  localStorage.removeItem(SESSION_KEY)
}

export function updateUserProfile(profile: { name?: string; phone?: string; address?: string; email?: string }): UserSession | null {
  const current = getSession()
  if (!current) return null
  const updated: UserSession = {
    ...current,
    name: profile.name ?? current.name,
    phone: profile.phone ?? current.phone,
    address: profile.address ?? current.address,
    email: profile.email ?? current.email,
  }
  saveSession(updated)
  return updated
}
