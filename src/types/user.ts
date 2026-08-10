export type UserRole =
  | 'admin'
  | 'cashier'
  | 'customer'
  | 'ADMIN'
  | 'CASHIER'
  | 'CUSTOMER'

export interface User {
  id: number
  email: string | null
  name: string
  role: UserRole
  phone?: string | null
  is_active: boolean
  created_at?: string
  updated_at?: string
}