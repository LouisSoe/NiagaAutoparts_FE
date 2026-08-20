<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Divider from 'primevue/divider'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

import { loadSnapScript, createSnapToken } from '@/services/paymentService'
import { formatCurrencyIDR } from '@/utils/format'
import { fetchOrders, fetchOrderById } from '@/services/orderService'
import { deliveryService } from '@/services/deliveryService'
import RescheduleNotificationModal from '@/components/RescheduleNotificationModal.vue'
import type { Order } from '@/types/order'
import type { DeliveryDetails } from '@/types/delivery'

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const isPaying = ref(false)
const orderData = ref<Order | null>(null)
const deliveryData = ref<DeliveryDetails | null>(null)
const isRescheduleModalOpen = ref(false)

// Parse query or route params (e.g. from Midtrans redirect)
const orderIdQuery = computed(() => {
  const q = route.query.order_id || route.query.orderId || route.query.id || route.params.order_id || route.params.id
  return Array.isArray(q) ? q[0] : (q as string | undefined) || ''
})

const statusCodeQuery = computed(() => {
  const q = route.query.status_code || route.query.statusCode
  return Array.isArray(q) ? q[0] : (q as string | undefined) || ''
})

const transactionStatusQuery = computed(() => {
  const q = route.query.transaction_status || route.query.transactionStatus
  return Array.isArray(q) ? q[0] : (q as string | undefined) || ''
})

// Determine overall payment status
const paymentStatus = computed(() => {
  const status = (transactionStatusQuery.value || orderData.value?.status || '').toLowerCase()
  const code = statusCodeQuery.value

  if (['settlement', 'capture', 'paid', 'success', 'completed'].includes(status) || code === '200') {
    return 'success'
  }
  if (['pending', 'challenge', 'reserved', 'unpaid'].includes(status) || code === '201') {
    return 'pending'
  }
  if (['deny', 'cancel', 'expire', 'failure', 'failed'].includes(status) || ['202', '400', '407', '500'].includes(code)) {
    return 'failed'
  }
  
  // Default fallback if orderData status exists
  if (orderData.value?.status) {
    const s = orderData.value.status.toLowerCase()
    if (['paid', 'completed', 'settlement'].includes(s)) return 'success'
    if (['pending', 'unpaid', 'reserved'].includes(s)) return 'pending'
    if (['cancelled', 'failed', 'expired'].includes(s)) return 'failed'
  }

  return 'pending'
})

const statusConfig = computed(() => {
  switch (paymentStatus.value) {
    case 'success':
      return {
        icon: 'pi pi-check-circle',
        iconColor: 'text-green-600',
        bgColor: 'bg-green-100',
        badgeSeverity: 'success' as const,
        badgeText: 'Pembayaran Berhasil',
        title: 'Pembayaran Berhasil!',
        subtitle: 'Terima kasih, pembayaran transaksi Anda telah berhasil diproses.',
      }
    case 'pending':
      return {
        icon: 'pi pi-clock',
        iconColor: 'text-orange-600',
        bgColor: 'bg-orange-100',
        badgeSeverity: 'warn' as const,
        badgeText: 'Menunggu Pembayaran',
        title: 'Pembayaran Menunggu Konfirmasi',
        subtitle: 'Selesaikan pembayaran Anda sesuai dengan petunjuk metode pembayaran yang dipilih.',
      }
    case 'failed':
    default:
      return {
        icon: 'pi pi-times-circle',
        iconColor: 'text-red-600',
        bgColor: 'bg-red-100',
        badgeSeverity: 'danger' as const,
        badgeText: 'Pembayaran Gagal / Dibatalkan',
        title: 'Pembayaran Tidak Berhasil',
        subtitle: 'Maaf, transaksi pembayaran Anda tidak dapat diproses atau telah dibatalkan.',
      }
  }
})

const handlePayWithMidtrans = async () => {
  if (!orderData.value?.id) return
  isPaying.value = true
  try {
    await loadSnapScript()
    const snapRes = await createSnapToken(orderData.value.id)
    if ((window as any).snap && snapRes.token) {
      ;(window as any).snap.pay(snapRes.token, {
        onSuccess: async () => {
          if (orderData.value) {
            orderData.value.status = 'paid'
          }
        },
        onPending: () => {
          if (orderData.value) orderData.value.status = 'pending'
        },
        onError: () => {
          if (orderData.value) orderData.value.status = 'failed'
        },
        onClose: async () => {
          if (orderData.value?.id) {
            try {
              const latest = await fetchOrderById(orderData.value.id)
              orderData.value = latest
            } catch {
              // ignore
            }
          }
        },
      })
    }
  } catch (err: any) {
    console.warn('Failed to create Snap token, checking latest order status from server:', err)
    if (orderData.value?.id) {
      try {
        const latest = await fetchOrderById(orderData.value.id)
        orderData.value = latest
      } catch (checkErr) {
        console.error('Failed to check latest order status:', checkErr)
      }
    }

    const errMsg = err?.message || ''
    if (errMsg.includes('sudah digunakan') || errMsg.includes('already used') || errMsg.includes('duplicate')) {
      toast.add({
        severity: 'info',
        summary: 'Transaksi Midtrans Sudah Dibuat',
        detail: 'Kode pesanan ini sudah pernah dikirim ke Midtrans. Silakan selesaikan pembayaran di aplikasi bank/e-wallet Anda.',
        life: 5000,
      })
    } else {
      toast.add({
        severity: 'error',
        summary: 'Gagal Membuka Pembayaran',
        detail: errMsg || 'Terjadi kesalahan saat menghubungkan ke Midtrans.',
        life: 4000,
      })
    }
  } finally {
    isPaying.value = false
  }
}

onMounted(async () => {
  if (!orderIdQuery.value) {
    isLoading.value = false
    return
  }

  try {
    const numericId = parseInt(orderIdQuery.value, 10)
    if (!isNaN(numericId) && String(numericId) === orderIdQuery.value) {
      orderData.value = await fetchOrderById(numericId)
    } else {
      const res = await fetchOrders({ q: orderIdQuery.value, limit: 1 })
      if (res.data && res.data.length > 0) {
        orderData.value = res.data[0]
      }
    }

    if (orderData.value?.id) {
      try {
        deliveryData.value = await deliveryService.getDeliveryByOrderId(orderData.value.id)
      } catch (e) {
        console.warn('No delivery record found or failed to fetch delivery:', e)
      }
    }
  } catch (err) {
    console.warn('Could not fetch order details:', err)
  } finally {
    isLoading.value = false
  }
})

const goToHome = () => {
  router.push({ name: 'landing' })
}

const goToOrders = () => {
  router.push({ name: 'orders' })
}
</script>

<template>
  <div class="min-h-screen surface-ground flex align-items-center justify-content-center p-3 sm:p-5">
    <Card class="payment-card shadow-4 border-round-2xl border-1 surface-border overflow-hidden">
      <template #content>
        <div v-if="isLoading" class="flex flex-column align-items-center justify-content-center py-6 gap-3">
          <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
          <p class="text-color-secondary font-medium m-0">Memuat status pembayaran...</p>
        </div>

        <div v-else class="flex flex-column align-items-center text-center p-2 sm:p-4">
          <!-- Status Icon with Glow -->
          <div 
            class="w-6rem h-6rem border-circle flex align-items-center justify-content-center mb-4 transition-all duration-300 shadow-2"
            :class="[statusConfig.bgColor]"
          >
            <i :class="[statusConfig.icon, statusConfig.iconColor, 'text-5xl']"></i>
          </div>

          <!-- Title & Subtitle -->
          <h1 class="text-2xl font-bold text-900 mb-2 mt-0">
            {{ statusConfig.title }}
          </h1>
          <p class="text-color-secondary text-sm line-height-3 mt-0 mb-4" style="max-width: 24rem">
            {{ statusConfig.subtitle }}
          </p>

          <Tag 
            :severity="statusConfig.badgeSeverity" 
            class="px-3 py-2 text-xs font-semibold tracking-wider mb-4 border-round-md uppercase"
            :value="statusConfig.badgeText"
          />

          <Divider class="my-4 w-full" />

          <!-- Order Summary Box -->
          <div class="w-full surface-100 border-round-xl p-3 sm:p-4 text-left flex flex-column gap-3 mb-4 border-1 surface-border">
            <div class="flex justify-content-between align-items-center text-sm">
              <span class="text-color-secondary">ID / No. Pesanan</span>
              <span class="font-mono font-bold text-900">
                {{ orderIdQuery || orderData?.order_number || '-' }}
              </span>
            </div>

            <div v-if="orderData?.payment_method" class="flex justify-content-between align-items-center text-sm">
              <span class="text-color-secondary">Metode Pembayaran</span>
              <span class="font-semibold text-700 capitalize flex align-items-center gap-1">
                <i class="pi pi-credit-card text-primary text-xs"></i>
                {{ orderData.payment_method === 'midtrans' ? 'Midtrans (QRIS / VA / E-Wallet)' : (orderData.payment_method === 'cash' ? 'Tunai / Cash' : orderData.payment_method) }}
              </span>
            </div>

            <div v-if="orderData?.order_type" class="flex justify-content-between align-items-center text-sm">
              <span class="text-color-secondary">Tipe Pesanan</span>
              <span class="font-semibold text-700 capitalize">
                {{ orderData.order_type === 'delivery' ? 'Pengantaran (Delivery)' : (orderData.order_type === 'pickup' ? 'Ambil Sendiri di Toko (Pickup)' : orderData.order_type) }}
              </span>
            </div>

            <div v-if="transactionStatusQuery || orderData?.status" class="flex justify-content-between align-items-center text-sm">
              <span class="text-color-secondary">Status Transaksi</span>
              <span class="capitalize font-semibold text-700">
                {{ transactionStatusQuery || orderData?.status }}
              </span>
            </div>

            <div v-if="statusCodeQuery" class="flex justify-content-between align-items-center text-sm">
              <span class="text-color-secondary">Status Code</span>
              <span class="font-mono text-xs text-600">
                {{ statusCodeQuery }}
              </span>
            </div>

            <!-- Items Breakdown jika ada -->
            <div v-if="orderData?.items && orderData.items.length" class="surface-0 border-round-lg p-2.5 border-1 surface-border flex flex-column gap-2 text-xs my-1">
              <span class="font-semibold text-700">Rincian Item:</span>
              <div v-for="item in orderData.items" :key="item.id" class="flex justify-content-between align-items-center text-700">
                <span class="truncate max-w-16rem">{{ item.product_name || `Produk #${item.product_id}` }} ×{{ item.quantity }}</span>
                <span class="font-medium text-900">{{ formatCurrencyIDR(item.subtotal) }}</span>
              </div>
            </div>

            <!-- Catatan Pesanan jika ada -->
            <div v-if="orderData?.notes" class="text-xs text-600 bg-yellow-50 border-1 border-yellow-200 border-round p-2">
              <span class="font-bold text-yellow-900 block mb-0.5">Catatan:</span>
              <span class="text-yellow-900">{{ orderData.notes }}</span>
            </div>

            <!-- Breakdown Biaya -->
            <div class="border-top-1 surface-border pt-2 flex flex-column gap-1.5 text-xs">
              <div v-if="orderData?.tax_amount && orderData.tax_amount > 0" class="flex justify-content-between text-600">
                <span>Pajak (PPN):</span>
                <span>{{ formatCurrencyIDR(orderData.tax_amount) }}</span>
              </div>
              <div v-if="orderData?.shipping_cost && orderData.shipping_cost > 0" class="flex justify-content-between text-600">
                <span>Ongkos Kirim:</span>
                <span>{{ formatCurrencyIDR(orderData.shipping_cost) }}</span>
              </div>
              <div v-if="orderData?.total_price" class="flex justify-content-between align-items-center text-sm pt-1">
                <span class="font-bold text-800">Total Pembayaran</span>
                <span class="font-bold text-primary text-base">
                  {{ formatCurrencyIDR(orderData.total_price) }}
                </span>
              </div>
            </div>
          </div>

          <!-- Delivery Status Card if Delivery exists -->
          <div
            v-if="deliveryData"
            class="w-full surface-50 border-round-xl p-3 sm:p-4 text-left flex flex-column gap-3 mb-4 border-1 surface-border"
          >
            <div class="flex align-items-center justify-content-between">
              <div class="flex align-items-center gap-2">
                <i class="pi pi-truck text-blue-600 text-lg" />
                <span class="font-bold text-sm text-900">Status Pengantaran Kurir</span>
              </div>
              <Tag
                :value="deliveryData.status.replace(/_/g, ' ').toUpperCase()"
                :severity="
                  deliveryData.status === 'confirmed' || deliveryData.status === 'delivered'
                    ? 'success'
                    : deliveryData.status === 'reschedule_suggested'
                    ? 'warn'
                    : 'info'
                "
                class="text-xs"
              />
            </div>

            <div class="text-xs text-600 flex flex-column gap-1">
              <div><strong>Tanggal Antar:</strong> {{ deliveryData.delivery_date }}</div>
              <div><strong>Alamat Tujuan:</strong> {{ deliveryData.address }}</div>
              <div v-if="deliveryData.distance_km"><strong>Jarak:</strong> {{ deliveryData.distance_km }} km (Ongkir: {{ formatCurrencyIDR(deliveryData.shipping_cost) }})</div>
            </div>

            <!-- Warning and button if Reschedule is suggested -->
            <div
              v-if="deliveryData.status === 'reschedule_suggested'"
              class="p-2 bg-orange-50 border-round-lg border-1 border-orange-200 flex align-items-center justify-content-between gap-2"
            >
              <span class="text-xs text-orange-900">
                ⚠️ Kurir menyarankan jadwal baru: <strong>{{ deliveryData.suggested_date }}</strong>
              </span>
              <Button
                label="Lihat Saran"
                size="small"
                severity="warn"
                class="text-xs py-1 px-2"
                @click="isRescheduleModalOpen = true"
              />
            </div>
          </div>

          <!-- Alert Note if Pending or Failed -->
          <Message v-if="paymentStatus === 'pending'" severity="warn" class="w-full mb-4 text-left" :closable="false">
            Jika Anda sudah menyelesaikan pembayaran, status akan diperbarui secara otomatis dalam beberapa saat.
          </Message>

          <Message v-else-if="paymentStatus === 'failed'" severity="error" class="w-full mb-4 text-left" :closable="false">
            Jika saldo Anda terpotong atau terjadi kendala, silakan hubungi tim layanan pelanggan kami.
          </Message>

          <!-- Midtrans Pay Button for Pending Orders -->
          <Button
            v-if="paymentStatus === 'pending' && orderData?.id && (orderData?.payment_method === 'midtrans' || !orderData?.payment_method)"
            label="Bayar Sekarang via Midtrans"
            icon="pi pi-credit-card"
            severity="warn"
            class="w-full mb-3 font-bold py-3"
            :loading="isPaying"
            @click="handlePayWithMidtrans"
          />

          <!-- Action Buttons -->
          <div class="w-full flex flex-column sm:flex-row gap-3">
            <Button
              label="Kembali ke Beranda"
              icon="pi pi-home"
              class="p-button-outlined flex-1 w-full"
              @click="goToHome"
            />
            <Button
              label="Lihat Pesanan"
              icon="pi pi-shopping-bag"
              class="flex-1 w-full"
              @click="goToOrders"
            />
          </div>
        </div>
      </template>
    </Card>

    <!-- Reschedule Modal -->
    <RescheduleNotificationModal
      v-model:visible="isRescheduleModalOpen"
      :delivery="deliveryData"
      @accepted="(updated) => {
        deliveryData = updated
      }"
    />
  </div>
</template>

<style scoped>
.min-h-screen {
  min-height: 100vh;
}
.payment-card {
  width: 100%;
  max-width: 32rem;
}
</style>

