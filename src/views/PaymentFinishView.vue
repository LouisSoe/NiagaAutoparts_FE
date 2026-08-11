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
import type { Order } from '@/types/order'

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const isPaying = ref(false)
const orderData = ref<Order | null>(null)

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

            <div v-if="orderData?.total_price" class="flex justify-content-between align-items-center text-sm">
              <span class="text-color-secondary">Total Pembayaran</span>
              <span class="font-bold text-primary text-base">
                {{ formatCurrencyIDR(orderData.total_price) }}
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

            <div v-if="orderData?.payment_method" class="flex justify-content-between align-items-center text-sm">
              <span class="text-color-secondary">Metode Pembayaran</span>
              <span class="font-semibold text-700 capitalize">
                {{ orderData.payment_method }}
              </span>
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

