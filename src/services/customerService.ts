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
  user_id?: number
  user_name?: string
  user_email?: string
  user_phone?: string
  name?: string
  phone_number?: string
  email?: string
  address: string
  notes?: string
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

/* ================================================================
 * Mapper: backend → frontend
 * ============================================================== */

function mapCustomer(item: CustomerApiItem): Customer {
  return {
    id: item.id,
    user_id: item.user_id ?? null,
    user_name: item.user_name ?? item.name ?? '',
    user_email: item.user_email ?? item.email ?? '',
    user_phone: item.user_phone ?? item.phone_number ?? '',
    code: `CUS-${String(item.id).padStart(3, '0')}`,
    name: item.user_name ?? item.name ?? '',
    type: 'INDIVIDUAL' as CustomerType,
    phone: item.user_phone ?? item.phone_number ?? '',
    email: item.user_email ?? item.email ?? '',
    address: item.address ?? '',
    totalOrders: 0,
    totalSpent: 0,
    isActive: true,
  }
}

export interface FetchCustomersParams {
  q?: string
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

export interface CreateCustomerPayload {
  user_id?: number
  name?: string
  phone_number?: string
  email?: string
  address?: string
  notes?: string
  type?: string
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
