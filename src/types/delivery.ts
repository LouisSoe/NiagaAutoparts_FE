export interface DeliverySchedule {
  id: number
  day_of_week: string
  slot_name: string
  start_time: string
  end_time: string
  max_capacity: number
  booked_count: number
  available_slots: number
  is_full: boolean
  is_active?: boolean
  created_at?: string
  updated_at?: string
}

export interface AdminDeliverySchedule {
  id: number
  day_of_week: string
  slot_name: string
  start_time: string
  end_time: string
  max_capacity: number
  booked_count?: number
  available_slots?: number
  is_full?: boolean
  is_active: boolean
  created_at?: string
  updated_at?: string
}

export interface CreateDeliverySchedulePayload {
  day_of_week: string
  slot_name: string
  start_time: string
  end_time: string
  max_capacity: number
  is_active?: boolean
}

export interface UpdateDeliverySchedulePayload {
  day_of_week?: string
  slot_name?: string
  start_time?: string
  end_time?: string
  max_capacity?: number
  is_active?: boolean
}

export interface DeliveryScheduleQueryParams {
  day_of_week?: string
  is_active?: boolean | string
}

export interface ShippingEstimateResult {
  distance_km: number
  shipping_cost: number
}

export interface RequestDeliveryPayload {
  order_id: number
  customer_id?: number
  schedule_id: number
  delivery_date: string // YYYY-MM-DD
  address: string
  latitude: number
  longitude: number
  notes?: string
}

export interface DeliveryItem {
  id: number
  order_id: number
  customer_id?: number | null
  schedule_id: number
  courier_id?: number | null
  delivery_date: string
  status: 'waiting_courier_approval' | 'confirmed' | 'reschedule_suggested' | 'on_delivery' | 'delivered' | 'cancelled'
  address: string
  latitude: number
  longitude: number
  distance_km: number
  shipping_cost: number
  suggested_date?: string | null
  suggested_schedule_id?: number | null
  rejection_reason?: string | null
  notes?: string | null
  created_at: string
  updated_at: string
  // Joined fields
  order_number?: string
  customer_name?: string
  customer_phone?: string
  customer_address?: string
  customer_latitude?: number
  customer_longitude?: number
  slot_name?: string
  suggested_slot_name?: string
  courier_name?: string
  telegram_chat_id?: string
}

export type DeliveryDetails = DeliveryItem

export interface SuggestReschedulePayload {
  suggested_date: string
  suggested_schedule_id: number
  reason?: string
}
