<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Divider from 'primevue/divider'
import Tag from 'primevue/tag'
import Message from 'primevue/message'
import ProgressSpinner from 'primevue/progressspinner'

import { formatCurrencyIDR } from '@/utils/format'
import { fetchOrders, fetchOrderById } from '@/services/orderService'
import type { Order } from '@/types/order'

const route = useRoute()
const router = useRouter()

const isLoading = ref(true)
const orderData = ref<Order | null>(null)

// Parse query params from Midtrans redirect
const orderIdQuery = computed(() => {
  const q = route.query.order_id || route.query.orderId || route.query.id
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
  if (['pending', 'challenge'].includes(status) || code === '201') {
    return 'pending'
  }
  if (['deny', 'cancel', 'expire', 'failure', 'failed'].includes(status) || ['202', '400', '407', '500'].includes(code)) {
    return 'failed'
  }
  
  // Default fallback if orderData status exists
  if (orderData.value?.status) {
    const s = orderData.value.status.toLowerCase()
    if (['paid', 'completed', 'settlement'].includes(s)) return 'success'
    if (['pending', 'unpaid'].includes(s)) return 'pending'
    if (['cancelled', 'failed', 'expired'].includes(s)) return 'failed'
  }

  return 'success' // optimistic default for 200 status code
})

const statusConfig = computed(() => {
  switch (paymentStatus.value) {
    case 'success':
      return {
        icon: 'pi pi-check-circle',
        iconColor: 'text-green-500',
        bgGradient: 'from-green-500/10 to-emerald-500/5',
        badgeSeverity: 'success' as const,
        badgeText: 'Pembayaran Berhasil',
        title: 'Pembayaran Berhasil!',
        subtitle: 'Terima kasih, pembayaran transaksi Anda telah berhasil diproses.',
      }
    case 'pending':
      return {
        icon: 'pi pi-clock',
        iconColor: 'text-amber-500',
        bgGradient: 'from-amber-500/10 to-yellow-500/5',
        badgeSeverity: 'warn' as const,
        badgeText: 'Menunggu Pembayaran',
        title: 'Pembayaran Menunggu Konfirmasi',
        subtitle: 'Selesaikan pembayaran Anda sesuai dengan petunjuk metode pembayaran yang dipilih.',
      }
    case 'failed':
    default:
      return {
        icon: 'pi pi-times-circle',
        iconColor: 'text-red-500',
        bgGradient: 'from-red-500/10 to-rose-500/5',
        badgeSeverity: 'danger' as const,
        badgeText: 'Pembayaran Gagal / Dibatalkan',
        title: 'Pembayaran Tidak Berhasil',
        subtitle: 'Maaf, transaksi pembayaran Anda tidak dapat diproses atau telah dibatalkan.',
      }
  }
})

onMounted(async () => {
  if (!orderIdQuery.value) {
    isLoading.value = false
    return
  }

  try {
    // Try fetching by numerical ID first if orderIdQuery is numeric
    const numericId = parseInt(orderIdQuery.value, 10)
    if (!isNaN(numericId) && String(numericId) === orderIdQuery.value) {
      orderData.value = await fetchOrderById(numericId)
    } else {
      // Otherwise search by order_number string
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
  <div class="min-h-screen bg-surface-50 dark:bg-surface-950 flex items-center justify-center p-4">
    <Card class="w-full max-w-lg shadow-xl border border-surface-200 dark:border-surface-800 overflow-hidden">
      <template #content>
        <div v-if="isLoading" class="flex flex-col items-center justify-center py-12 gap-4">
          <ProgressSpinner style="width: 50px; height: 50px" strokeWidth="4" />
          <p class="text-surface-600 dark:text-surface-400 font-medium">Memuat status pembayaran...</p>
        </div>

        <div v-else class="flex flex-col items-center text-center p-4">
          <!-- Status Icon with Glow -->
          <div 
            class="w-24 h-24 rounded-full flex items-center justify-center mb-6 shadow-inner transition-all duration-300"
            :class="[
              paymentStatus === 'success' ? 'bg-green-100 dark:bg-green-950/50' : 
              paymentStatus === 'pending' ? 'bg-amber-100 dark:bg-amber-950/50' : 
              'bg-red-100 dark:bg-red-950/50'
            ]"
          >
            <i :class="[statusConfig.icon, statusConfig.iconColor, 'text-6xl']"></i>
          </div>

          <!-- Title & Subtitle -->
          <h1 class="text-2xl font-bold text-surface-900 dark:text-surface-0 mb-2">
            {{ statusConfig.title }}
          </h1>
          <p class="text-surface-600 dark:text-surface-400 text-sm max-w-sm mb-6">
            {{ statusConfig.subtitle }}
          </p>

          <Tag :severity="statusConfig.badgeSeverity" class="px-4 py-1.5 text-xs font-semibold uppercase tracking-wider mb-6">
            {{ statusConfig.badgeText }}
          </Tag>

          <Divider class="my-4" />

          <!-- Order Summary Card -->
          <div class="w-full bg-surface-100 dark:bg-surface-900 rounded-xl p-4 text-left space-y-3 mb-6 border border-surface-200/60 dark:border-surface-800/60">
            <div class="flex justify-between items-center text-sm">
              <span class="text-surface-500 dark:text-surface-400">ID / No. Pesanan</span>
              <span class="font-mono font-semibold text-surface-900 dark:text-surface-0">
                {{ orderIdQuery || orderData?.order_number || '-' }}
              </span>
            </div>

            <div v-if="orderData?.total_price" class="flex justify-between items-center text-sm">
              <span class="text-surface-500 dark:text-surface-400">Total Pembayaran</span>
              <span class="font-semibold text-primary text-base">
                {{ formatCurrencyIDR(orderData.total_price) }}
              </span>
            </div>

            <div v-if="transactionStatusQuery || orderData?.status" class="flex justify-between items-center text-sm">
              <span class="text-surface-500 dark:text-surface-400">Status Transaksi</span>
              <span class="capitalize font-medium text-surface-800 dark:text-surface-200">
                {{ transactionStatusQuery || orderData?.status }}
              </span>
            </div>

            <div v-if="statusCodeQuery" class="flex justify-between items-center text-sm">
              <span class="text-surface-500 dark:text-surface-400">Status Code</span>
              <span class="font-mono text-xs text-surface-600 dark:text-surface-400">
                {{ statusCodeQuery }}
              </span>
            </div>

            <div v-if="orderData?.payment_method" class="flex justify-between items-center text-sm">
              <span class="text-surface-500 dark:text-surface-400">Metode Pembayaran</span>
              <span class="font-medium text-surface-800 dark:text-surface-200 capitalize">
                {{ orderData.payment_method }}
              </span>
            </div>
          </div>

          <!-- Alert Note if Pending or Failed -->
          <Message v-if="paymentStatus === 'pending'" severity="warn" class="w-full mb-6 text-left" :closable="false">
            Jika Anda sudah menyelesaikan pembayaran, status akan diperbarui secara otomatis dalam beberapa saat.
          </Message>

          <Message v-else-if="paymentStatus === 'failed'" severity="error" class="w-full mb-6 text-left" :closable="false">
            Jika saldo Anda terpotong atau terjadi kendala, silakan hubungi tim layanan pelanggan kami.
          </Message>

          <!-- Action Buttons -->
          <div class="w-full flex flex-col sm:flex-row gap-3">
            <Button
              label="Kembali ke Beranda"
              icon="pi pi-home"
              class="w-full sm:w-1/2 p-button-outlined"
              @click="goToHome"
            />
            <Button
              label="Lihat Pesanan"
              icon="pi pi-shopping-bag"
              class="w-full sm:w-1/2"
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
</style>
