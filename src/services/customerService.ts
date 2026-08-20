/**
 * customerService.ts
 * Service untuk operasi CRUD Customer via backend API.
 * Endpoint: /api/v1/customers
 */

import { apiFetch } from './api'
import type { Customer, CustomerType } from '@/types/customer'
import type { PaginationMeta } from '@/types/pagination'

/* ================================================================
 * API Response Types
 * ============================================================== */

interface CustomerApiItem {
  id: number
  user_id?: number | null
  type_customer?: string | null
  type?: string | null
  name?: string | null
  phone?: string | null
  phone_number?: string | null
  email?: string | null
  user_name?: string | null
  user_email?: string | null
  user_phone?: string | null
  total_orders?: number
  total_spent?: number
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  notes?: string | null
  created_at?: string
  updated_at?: string
}

interface CustomerListResponse {
  data: CustomerApiItem[]
  meta?: PaginationMeta
}

interface CustomerSingleResponse {
  data: CustomerApiItem
}

export interface CustomerProfileData {
  id: number
  user_id: number
  name: string
  phone: string
  email?: string
  address: string
  notes?: string
  latitude?: number
  longitude?: number
  type_customer?: string
  created_at?: string
  updated_at?: string
}

export interface UpdateCustomerProfilePayload {
  name: string
  phone: string
  address: string
  latitude?: number
  longitude?: number
  notes?: string
  type_customer?: string
}

interface CustomerByUserResponse {
  data: CustomerProfileData
}

/* ================================================================
 * Mapper: backend → frontend
 * ============================================================== */

function mapCustomer(item: CustomerApiItem): Customer {
  const rawType = (item.type_customer ?? item.type ?? 'INDIVIDUAL').toUpperCase()
  const customerType: CustomerType =
    rawType === 'WORKSHOP' || rawType === 'COMPANY' ? rawType : 'INDIVIDUAL'

  const resolvedName = item.name ?? item.user_name ?? ''
  const resolvedPhone = item.phone ?? item.phone_number ?? item.user_phone ?? ''
  const resolvedEmail = item.email ?? item.user_email ?? ''
  const totalOrders = item.total_orders ?? 0
  const totalSpent = item.total_spent ?? 0

  return {
    id: item.id,
    user_id: item.user_id ?? null,
    user_name: item.user_name ?? resolvedName,
    user_email: item.user_email ?? resolvedEmail,
    user_phone: item.user_phone ?? resolvedPhone,
    code: `CUS-${String(item.id).padStart(3, '0')}`,
    name: resolvedName,
    type: customerType,
    type_customer: rawType,
    phone: resolvedPhone,
    phone_number: resolvedPhone,
    email: resolvedEmail,
    address: item.address ?? '',
    latitude: item.latitude ?? null,
    longitude: item.longitude ?? null,
    notes: item.notes ?? '',
    totalOrders: totalOrders,
    total_orders: totalOrders,
    totalSpent: totalSpent,
    total_spent: totalSpent,
    isActive: true,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
}

export interface FetchCustomersParams {
  q?: string
  type_customer?: string
  type?: string
  page?: number
  limit?: number
}

export interface FetchCustomersResult {
  data: Customer[]
  meta: PaginationMeta
}

/* ================================================================
 * CRUD Functions
 * ============================================================== */

/** GET /api/v1/customers */
export async function fetchCustomers(
  params?: FetchCustomersParams
): Promise<FetchCustomersResult> {
  const queryParams = new URLSearchParams()
  if (params?.q) queryParams.append('q', params.q)
  if (params?.type_customer) {
    queryParams.append('type_customer', params.type_customer)
  } else if (params?.type) {
    queryParams.append('type_customer', params.type)
  }
  if (params?.page) queryParams.append('page', String(params.page))
  if (params?.limit) queryParams.append('limit', String(params.limit))

  const queryString = queryParams.toString()
  const endpoint = `/api/v1/customers${queryString ? `?${queryString}` : ''}`

  const res = await apiFetch<CustomerListResponse>(endpoint)
  const items = (res.data ?? []).map(mapCustomer)

  const meta: PaginationMeta = res.meta ?? {
    page: params?.page ?? 1,
    limit: params?.limit ?? items.length,
    total: items.length,
    total_pages: 1,
  }

  return { data: items, meta }
}

/** GET /api/v1/customers/:id */
export async function fetchCustomerById(id: number): Promise<Customer> {
  const res = await apiFetch<CustomerSingleResponse>(`/api/v1/customers/${id}`)
  return mapCustomer(res.data)
}

/** GET /api/v1/customers/user/:userId */
export async function fetchCustomerByUserId(userId: number): Promise<CustomerProfileData | null> {
  try {
    const res = await apiFetch<CustomerByUserResponse>(`/api/v1/customers/user/${userId}`)
    return res.data ?? null
  } catch (err) {
    console.warn(`[customerService] Failed to fetch customer data for user_id ${userId}:`, err)
    return null
  }
}

/** PUT /api/v1/customers/user/:userId */
export async function updateCustomerByUserId(
  userId: number,
  payload: UpdateCustomerProfilePayload
): Promise<CustomerProfileData> {
  const res = await apiFetch<CustomerByUserResponse>(`/api/v1/customers/user/${userId}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return res.data
}

export interface CreateCustomerPayload {
  user_id?: number
  name?: string
  phone_number?: string
  phone?: string
  email?: string
  address?: string
  notes?: string
  type?: string
  type_customer?: string
  latitude?: number
  longitude?: number
}

/** POST /api/v1/customers */
export async function createCustomer(payload: CreateCustomerPayload): Promise<Customer> {
  const res = await apiFetch<CustomerSingleResponse>('/api/v1/customers', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapCustomer(res.data)
}

export type UpdateCustomerPayload = Partial<CreateCustomerPayload>

/** PUT /api/v1/customers/:id */
export async function updateCustomer(
  id: number,
  payload: UpdateCustomerPayload,
): Promise<Customer> {
  const res = await apiFetch<CustomerSingleResponse>(`/api/v1/customers/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return mapCustomer(res.data)
}

/** DELETE /api/v1/customers/:id */
export async function deleteCustomer(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/v1/customers/${id}`, {
    method: 'DELETE',
  })
}
