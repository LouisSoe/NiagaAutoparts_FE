export type CustomerType = 'INDIVIDUAL' | 'WORKSHOP' | 'COMPANY'

export interface Customer {
  id: number
  user_id?: number | null
  user_name?: string | null
  user_email?: string | null
  user_phone?: string | null
  /** Legacy / fallback fields */
  name?: string | null
  phone_number?: string | null
  email?: string | null
  /** Data customer lainnya */
  code: string
  type: CustomerType
  address: string | null
  notes?: string | null
  isActive: boolean
  totalOrders: number
  totalSpent: number
  created_at?: string
  updated_at?: string
}