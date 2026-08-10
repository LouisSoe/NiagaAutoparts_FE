/**
 * orderService.ts
 * Service untuk operasi CRUD Order via backend API.
 * Endpoint: /api/v1/orders
 */

import { apiFetch } from './api'
import type { Order, OrderItemDetail, CreateOrderPayload } from '@/types/order'
import type { PaginationMeta } from '@/types/pagination'

/* ================================================================
 * API Response Types
 * ============================================================== */

export interface OrderItemApiItem {
  id: number
  order_id: number
  product_id: number
  product_name?: string
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

export interface OrderApiItem {
  id: number
  order_number: string
  user_id?: number | null
  total_price: number
  amount_paid: number
  change_amount: number
  status: string
  source: string
  payment_method: string
  notes?: string | null
  expires_at?: string | null
  created_at: string
  updated_at: string
  items?: OrderItemApiItem[]
}

interface OrderListResponse {
  data: OrderApiItem[]
  meta?: PaginationMeta
}

interface OrderSingleResponse {
  data: OrderApiItem
  message?: string
}

/* ================================================================
 * Mapper: backend → frontend
 * ============================================================== */

function mapOrderItemDetail(item: OrderItemApiItem): OrderItemDetail {
  return {
    id: item.id,
    order_id: item.order_id,
    product_id: item.product_id,
    product_name: item.product_name ?? null,
    quantity: item.quantity,
    unit_price: item.unit_price,
    subtotal: item.subtotal,
    created_at: item.created_at,
  }
}

function mapOrder(item: OrderApiItem): Order {
  return {
    id: item.id,
    order_number: item.order_number,
    user_id: item.user_id ?? null,
    total_price: item.total_price,
    amount_paid: item.amount_paid,
    change_amount: item.change_amount,
    status: item.status,
    source: item.source,
    payment_method: item.payment_method,
    notes: item.notes ?? null,
    expires_at: item.expires_at ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
    items: (item.items ?? []).map(mapOrderItemDetail),
  }
}

export interface FetchOrdersParams {
  q?: string
  status?: string
  page?: number
  limit?: number
}

export interface FetchOrdersResult {
  data: Order[]
  meta: PaginationMeta
}

/* ================================================================
 * CRUD Functions
 * ============================================================== */

/** GET /api/v1/orders */
export async function fetchOrders(
  params?: FetchOrdersParams
): Promise<FetchOrdersResult> {
  const queryParams = new URLSearchParams()
  if (params?.q) queryParams.append('q', params.q)
  if (params?.status) queryParams.append('status', params.status)
  if (params?.page) queryParams.append('page', String(params.page))
  if (params?.limit) queryParams.append('limit', String(params.limit))

  const queryString = queryParams.toString()
  const endpoint = `/api/v1/orders${queryString ? `?${queryString}` : ''}`

  const res = await apiFetch<OrderListResponse>(endpoint)
  const items = (res.data ?? []).map(mapOrder)

  const meta: PaginationMeta = res.meta ?? {
    page: params?.page ?? 1,
    limit: params?.limit ?? items.length,
    total: items.length,
    total_pages: 1,
  }

  return { data: items, meta }
}

/** GET /api/v1/orders/:id */
export async function fetchOrderById(id: number): Promise<Order> {
  const res = await apiFetch<OrderSingleResponse>(`/api/v1/orders/${id}`)
  return mapOrder(res.data)
}

/** POST /api/v1/orders */
export async function createOrder(payload: CreateOrderPayload): Promise<Order> {
  const res = await apiFetch<OrderSingleResponse>('/api/v1/orders', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapOrder(res.data)
}

/** DELETE /api/v1/orders/:id */
export async function deleteOrder(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/v1/orders/${id}`, {
    method: 'DELETE',
  })
}
