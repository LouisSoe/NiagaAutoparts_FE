import { apiFetch, type ApiResponse } from './api'
import type { DeliverySchedule, RequestDeliveryPayload, DeliveryDetails } from '@/types/delivery'

export const deliveryService = {
  /**
   * Mengambil daftar slot jadwal pengantaran yang tersedia untuk tanggal tertentu
   */
  async getAvailableSchedules(date: string): Promise<DeliverySchedule[]> {
    const res = await apiFetch<ApiResponse<DeliverySchedule[]>>(
      `/api/v1/deliveries/available-schedules?date=${encodeURIComponent(date)}`
    )
    return res.data ?? []
  },

  /**
   * Menghitung estimasi jarak (km) dan ongkos kirim (Rp) berdasarkan titik GPS customer
   * Endpoint: GET /api/v1/deliveries/estimate-shipping-cost?latitude=...&longitude=...
   */
  async estimateShippingCost(latitude: number, longitude: number): Promise<{ distance_km: number; shipping_cost: number }> {
    const res = await apiFetch<ApiResponse<{ distance_km: number; shipping_cost: number }>>(
      `/api/v1/deliveries/estimate-shipping-cost?latitude=${latitude}&longitude=${longitude}`
    )
    return res.data ?? { distance_km: 0, shipping_cost: 0 }
  },

  /**
   * Mengirim request pengantaran pesanan setelah order dibuat
   */
  async requestDelivery(payload: RequestDeliveryPayload): Promise<DeliveryDetails> {
    const res = await apiFetch<ApiResponse<DeliveryDetails>>('/api/v1/deliveries/request', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return res.data
  },

  /**
   * Mendapatkan detail data pengantaran untuk suatu pesanan
   */
  async getDeliveryByOrderId(orderId: number): Promise<DeliveryDetails | null> {
    try {
      const res = await apiFetch<ApiResponse<DeliveryDetails>>(`/api/v1/deliveries/order/${orderId}`)
      return res.data ?? null
    } catch {
      return null
    }
  },

  /**
   * Mengambil daftar deliveries berdasarkan tanggal (GET /api/v1/deliveries?date=YYYY-MM-DD)
   */
  async getDeliveriesByDate(date: string): Promise<DeliveryDetails[]> {
    const res = await apiFetch<ApiResponse<DeliveryDetails[]>>(
      `/api/v1/deliveries?date=${encodeURIComponent(date)}`
    )
    return res.data ?? []
  },

  /**
   * Konfirmasi / Approve pengantaran oleh kurir/admin (POST /api/v1/deliveries/:id/approve)
   */
  async approveDelivery(deliveryId: number): Promise<void> {
    await apiFetch<ApiResponse<any>>(`/api/v1/deliveries/${deliveryId}/approve`, {
      method: 'POST',
    })
  },

  /**
   * Sarankan perubahan jadwal pengantaran (POST /api/v1/deliveries/:id/reschedule-suggest)
   */
  async suggestReschedule(
    deliveryId: number,
    payload: {
      suggested_date: string
      suggested_schedule_id: number
      reason?: string
    }
  ): Promise<void> {
    await apiFetch<ApiResponse<any>>(`/api/v1/deliveries/${deliveryId}/reschedule-suggest`, {
      method: 'POST',
      body: JSON.stringify(payload),
    })
  },

  /**
   * Menerima saran jadwal baru dari kurir jika statusnya 'reschedule_suggested'
   */
  async acceptReschedule(deliveryId: number): Promise<DeliveryDetails> {
    const res = await apiFetch<ApiResponse<DeliveryDetails>>(
      `/api/v1/deliveries/${deliveryId}/reschedule-accept`,
      {
        method: 'POST',
      }
    )
    return res.data
  },

  /**
   * ==========================================
   * ADMIN CRUD DELIVERY SCHEDULES ENDPOINTS
   * ==========================================
   */

  /**
   * GET /api/v1/delivery-schedules
   * Query params: day_of_week, is_active
   */
  async getDeliverySchedules(params?: { day_of_week?: string; is_active?: boolean | string }): Promise<DeliverySchedule[]> {
    const searchParams = new URLSearchParams()
    if (params?.day_of_week) {
      searchParams.append('day_of_week', params.day_of_week)
    }
    if (params?.is_active !== undefined && params?.is_active !== null && params?.is_active !== '') {
      searchParams.append('is_active', String(params.is_active))
    }

    const queryStr = searchParams.toString()
    const endpoint = `/api/v1/delivery-schedules${queryStr ? `?${queryStr}` : ''}`

    const res = await apiFetch<ApiResponse<DeliverySchedule[]>>(endpoint)
    return res.data ?? []
  },

  /**
   * GET /api/v1/delivery-schedules/:id
   */
  async getDeliveryScheduleById(id: number): Promise<DeliverySchedule> {
    const res = await apiFetch<ApiResponse<DeliverySchedule>>(`/api/v1/delivery-schedules/${id}`)
    return res.data
  },

  /**
   * POST /api/v1/delivery-schedules
   */
  async createDeliverySchedule(payload: {
    day_of_week: string
    slot_name: string
    start_time: string
    end_time: string
    max_capacity: number
    is_active?: boolean
  }): Promise<DeliverySchedule> {
    const res = await apiFetch<ApiResponse<DeliverySchedule>>('/api/v1/delivery-schedules', {
      method: 'POST',
      body: JSON.stringify(payload),
    })
    return res.data
  },

  /**
   * PUT /api/v1/delivery-schedules/:id
   */
  async updateDeliverySchedule(
    id: number,
    payload: {
      day_of_week?: string
      slot_name?: string
      start_time?: string
      end_time?: string
      max_capacity?: number
      is_active?: boolean
    }
  ): Promise<DeliverySchedule> {
    const res = await apiFetch<ApiResponse<DeliverySchedule>>(`/api/v1/delivery-schedules/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload),
    })
    return res.data
  },

  /**
   * DELETE /api/v1/delivery-schedules/:id
   */
  async deleteDeliverySchedule(id: number): Promise<void> {
    await apiFetch<ApiResponse<any>>(`/api/v1/delivery-schedules/${id}`, {
      method: 'DELETE',
    })
  },
}
