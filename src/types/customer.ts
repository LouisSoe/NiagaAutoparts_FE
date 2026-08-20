export type CustomerType = 'INDIVIDUAL' | 'WORKSHOP' | 'COMPANY'

export interface Customer {
  id: number
  user_id?: number | null
  user_name?: string | null
  user_email?: string | null
  user_phone?: string | null
  name?: string | null
  phone?: string | null
  phone_number?: string | null
  email?: string | null
  code?: string
  type?: CustomerType
  type_customer?: CustomerType | string
  address?: string | null
  latitude?: number | null
  longitude?: number | null
  notes?: string | null
  isActive?: boolean
  total_orders?: number
  totalOrders?: number
  total_spent?: number
  totalSpent?: number
  created_at?: string
  updated_at?: string
}