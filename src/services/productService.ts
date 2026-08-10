/**
 * productService.ts
 * Service untuk operasi CRUD Product via backend API.
 * Endpoint: /api/v1/products
 */

import { apiFetch, BASE_URL } from './api'
import type { Product, ProductUnit } from '@/types/product'
import type { PaginationMeta } from '@/types/pagination'

/* ================================================================
 * API Response Types
 * ============================================================== */

interface ProductApiItem {
  id: number
  sku: string
  name: string
  category_id: number
  category_name: string
  description: string
  stock: number
  minimum_stock: number
  reserved: number
  location: string
  price?: number
  purchase_price: number
  selling_price: number
  unit: string
  image_url?: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

interface ProductListResponse {
  data: ProductApiItem[]
  meta?: PaginationMeta
}

interface ProductSingleResponse {
  data: ProductApiItem
}

/* ================================================================
 * Mapper: backend → frontend
 * ============================================================== */

function mapProduct(item: ProductApiItem): Product {
  let imageUrl: string | null = null
  if (item.image_url) {
    imageUrl = item.image_url.startsWith('http')
      ? item.image_url
      : `${BASE_URL}${item.image_url}`
  }

  return {
    id: item.id,
    sku: item.sku,
    name: item.name,
    categoryId: item.category_id,
    categoryName: item.category_name,
    description: item.description ?? null,
    stock: item.stock,
    minimumStock: item.minimum_stock ?? 0,
    reserved: item.reserved ?? 0,
    location: item.location ?? null,
    purchase_price: item.purchase_price ?? item.price ?? 0,
    selling_price: item.selling_price ?? item.price ?? 0,
    unit: (item.unit as ProductUnit) ?? 'pcs',
    imageUrl,
    isActive: item.is_active ?? true,
    createdAt: item.created_at,
    updated_at: item.updated_at,
  }
}

export interface FetchProductsParams {
  q?: string
  category_id?: number
  stock_status?: string
  low_stock_priority?: boolean
  page?: number
  limit?: number
}

export interface FetchProductsResult {
  data: Product[]
  meta: PaginationMeta
}

/* ================================================================
 * CRUD Functions
 * ============================================================== */

/** GET /api/v1/products */
export async function fetchProducts(
  params?: FetchProductsParams
): Promise<FetchProductsResult> {
  const queryParams = new URLSearchParams()
  if (params?.q) queryParams.append('q', params.q)
  if (params?.category_id) queryParams.append('category_id', String(params.category_id))
  if (params?.stock_status) queryParams.append('stock_status', params.stock_status)
  if (params?.low_stock_priority !== undefined) queryParams.append('low_stock_priority', String(params.low_stock_priority))
  if (params?.page) queryParams.append('page', String(params.page))
  if (params?.limit) queryParams.append('limit', String(params.limit))

  const queryString = queryParams.toString()
  const endpoint = `/api/v1/products${queryString ? `?${queryString}` : ''}`

  const res = await apiFetch<ProductListResponse>(endpoint)
  const items = (res.data ?? []).map(mapProduct)

  const meta: PaginationMeta = res.meta ?? {
    page: params?.page ?? 1,
    limit: params?.limit ?? items.length,
    total: items.length,
    total_pages: 1,
  }

  return { data: items, meta }
}

/** GET /api/v1/products?q=... */
export async function searchProducts(q: string): Promise<Product[]> {
  const res = await fetchProducts({ q })
  return res.data
}

/** GET /api/v1/products/:id */
export async function fetchProductById(id: number): Promise<Product> {
  const res = await apiFetch<ProductSingleResponse>(`/api/v1/products/${id}`)
  return mapProduct(res.data)
}

export interface CreateProductPayload {
  sku: string
  name: string
  category_id: number
  description?: string
  stock: number
  minimum_stock?: number
  reserved?: number
  location?: string
  price?: number
  purchase_price: number
  selling_price: number
  unit: string
  image_url?: string
  is_active: boolean
}

/** POST /api/v1/products */
export async function createProduct(payload: CreateProductPayload): Promise<Product> {
  const res = await apiFetch<ProductSingleResponse>('/api/v1/products', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapProduct(res.data)
}

export type UpdateProductPayload = Partial<CreateProductPayload>

/** PUT /api/v1/products/:id */
export async function updateProduct(
  id: number,
  payload: UpdateProductPayload,
): Promise<Product> {
  const res = await apiFetch<ProductSingleResponse>(`/api/v1/products/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return mapProduct(res.data)
}

/** DELETE /api/v1/products/:id */
export async function deleteProduct(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/v1/products/${id}`, {
    method: 'DELETE',
  })
}
