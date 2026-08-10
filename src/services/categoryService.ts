/**
 * categoryService.ts
 * Service untuk operasi CRUD Category via backend API.
 * Endpoint: /api/v1/categories
 */

import { apiFetch } from './api'
import type { Category } from '@/types/category'
import type { PaginationMeta } from '@/types/pagination'

/* ================================================================
 * API Response Types
 * ============================================================== */

interface CategoryApiItem {
  id: number
  name: string
  slug: string
  description: string
  created_at: string
  updated_at: string
}

interface CategoryListResponse {
  data: CategoryApiItem[]
  meta?: PaginationMeta
}

interface CategorySingleResponse {
  data: CategoryApiItem
}

/* ================================================================
 * Mapper: backend → frontend
 * ============================================================== */

function mapCategory(item: CategoryApiItem): Category {
  return {
    id: item.id,
    name: item.name,
    slug: item.slug,
    description: item.description ?? null,
    created_at: item.created_at,
    updated_at: item.updated_at,
  }
}

export interface FetchCategoriesParams {
  q?: string
  page?: number
  limit?: number
}

export interface FetchCategoriesResult {
  data: Category[]
  meta: PaginationMeta
}

/* ================================================================
 * CRUD Functions
 * ============================================================== */

/** GET /api/v1/categories */
export async function fetchCategories(
  params?: FetchCategoriesParams
): Promise<FetchCategoriesResult> {
  const queryParams = new URLSearchParams()
  if (params?.q) queryParams.append('q', params.q)
  if (params?.page) queryParams.append('page', String(params.page))
  if (params?.limit) queryParams.append('limit', String(params.limit))

  const queryString = queryParams.toString()
  const endpoint = `/api/v1/categories${queryString ? `?${queryString}` : ''}`

  const res = await apiFetch<CategoryListResponse>(endpoint)
  const items = (res.data ?? []).map(mapCategory)
  
  const meta: PaginationMeta = res.meta ?? {
    page: params?.page ?? 1,
    limit: params?.limit ?? items.length,
    total: items.length,
    total_pages: 1,
  }

  return { data: items, meta }
}

/** GET /api/v1/categories/:id */
export async function fetchCategoryById(id: number): Promise<Category> {
  const res = await apiFetch<CategorySingleResponse>(`/api/v1/categories/${id}`)
  return mapCategory(res.data)
}

export interface CreateCategoryPayload {
  name: string
  slug: string
  description: string
}

/** POST /api/v1/categories */
export async function createCategory(payload: CreateCategoryPayload): Promise<Category> {
  const res = await apiFetch<CategorySingleResponse>('/api/v1/categories', {
    method: 'POST',
    body: JSON.stringify(payload),
  })
  return mapCategory(res.data)
}

export interface UpdateCategoryPayload {
  name?: string
  slug?: string
  description?: string
}

/** PUT /api/v1/categories/:id */
export async function updateCategory(
  id: number,
  payload: UpdateCategoryPayload,
): Promise<Category> {
  const res = await apiFetch<CategorySingleResponse>(`/api/v1/categories/${id}`, {
    method: 'PUT',
    body: JSON.stringify(payload),
  })
  return mapCategory(res.data)
}

/** DELETE /api/v1/categories/:id */
export async function deleteCategory(id: number): Promise<void> {
  await apiFetch<unknown>(`/api/v1/categories/${id}`, {
    method: 'DELETE',
  })
}
