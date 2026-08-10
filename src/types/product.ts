export type ProductUnit =
  'pcs' | 'set' | 'box' | 'liter' | 'botol' | 'Pcs' | 'Set' | 'Box' | 'Liter' | 'Botol'

export interface Product {
  id: number
  sku: string
  name: string
  categoryId: number
  category?: string
  categoryName?: string
  description?: string | null
  stock: number
  minimumStock: number
  reserved?: number
  location?: string | null
  purchase_price: number
  selling_price: number
  unit: ProductUnit
  imageUrl?: string | null
  isActive: boolean
  createdAt?: string
  updated_at?: string
}
