/**
 * userService.ts
 * Service untuk operasi CRUD User via backend API.
 * Endpoint: /api/v1/users
 */

import { apiFetch } from './api'
import type { User, UserRole } from '@/types/user'
import type { PaginationMeta } from '@/types/pagination'

/* ================================================================
 * API Response Types
 * ============================================================== */

interface UserApiItem {
  id: number
  email: string
  name: string
  role: string
  phone: string
  created_at: string
  updated_at: string
}

interface UserListResponse {
  data: UserApiItem[]
  meta?: PaginationMeta
}

interface UserSingleResponse {
  data: UserApiItem
}

/* ================================================================
 * Mapper: backend → frontend
 * ============================================================== */

function mapUser(item: UserApiItem): User {
  return {
    id: item.id,
    email: item.email ?? null,
    name: item.name,
    role: (item.role as UserRole) ?? 'staff',
    phone: item.phone ?? null,
    is_active: true,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
}

export interface FetchUsersParams {
  q?: string
  role?: string
  page?: number
  limit?: number
}

export interface FetchUsersResult {
  data: User[]
  meta: PaginationMeta
}

/* ================================================================
 * CRUD Functions
 * ============================================================== */

/** GET /api/v1/users */
export async function fetchUsers(
  params?: FetchUsersParams
): Promise<FetchUsersResult> {
  const queryParams = new URLSearchParams()
  if (params?.q) queryParams.append('q', params.q)
  if (params?.role) queryParams.append('role', params.role)
  if (params?.page) queryParams.append('page', String(params.page))
  if (params?.limit) queryParams.append('limit', String(params.limit))

  const queryString = queryParams.toString()
  const endpoint = `/api/v1/users${queryString ? `?${queryString}` : ''}`

  const res = await apiFetch<UserListResponse>(endpoint)
  const items = (res.data ?? []).map(mapUser)

  const meta: PaginationMeta = res.meta ?? {
    page: params?.page ?? 1,
    limit: params?.limit ?? items.length,
    total: items.length,
    total_pages: 1,
  }

  return { data: items, meta }
}

/** GET /api/v1/users/:id */
export async function fetchUserById(id: number): Promise<User> {
  const res = await apiFetch<UserSingleResponse>(`/api/v1/users/${id}`)
  return mapUser(res.data)
}

export interface CreateUserPayload {
  email: string
  password: string
  name: string
  role: string
  phone: string
}

/** POST /api/v1/users */
export async function createUser(payload: CreateUserPayload): Promise<User> {
  const res = await apiFetch<UserSingleResponse>('/api/v1/users', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapUser(res.data)
}

export interface UpdateUserPayload {
  email?: string
  password?: string
  name?: string
  role?: string
  phone?: string
}

/** PUT /api/v1/users/:id */
export async function updateUser(id: number, payload: UpdateUserPayload): Promise<User> {
  const res = await apiFetch<UserSingleResponse>(`/api/v1/users/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return mapUser(res.data)
}

/** DELETE /api/v1/users/:id */
export async function deleteUser(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/v1/users/${id}`, {
    method: 'DELETE',
  })
}
