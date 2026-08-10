import type { ProductUnit } from './product'

export interface ProductForm {
  id: number | null
  sku: string
  barcode: string
  name: string
  categoryId: number | null
  unit: ProductUnit | null
  purchase_price: number | null
  selling_price: number | null
  stock: number | null
  minimumStock: number | null
  isActive: boolean
}

export interface CategoryOption {
  id: number
  name: string
}

export interface UnitOption {
  label: string
  value: ProductUnit
}

export interface OrderItemDetail {
  id: number
  order_id: number
  product_id: number
  product_name?: string | null
  quantity: number
  unit_price: number
  subtotal: number
  created_at: string
}

export interface Order {
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
  items: OrderItemDetail[]
}

export interface CreateOrderItemPayload {
  product_id: number
  quantity: number
  unit_price: number
}

export interface CreateOrderPayload {
  user_id?: number | null
  amount_paid: number
  change_amount: number
  source?: string
  payment_method?: string
  status?: string
  notes?: string
  items: CreateOrderItemPayload[]
}

export type StatusFilter = 'all' | 'paid' | 'pending' | 'cancelled'

export interface StatusFilterOption {
  label: string
  value: StatusFilter
}
