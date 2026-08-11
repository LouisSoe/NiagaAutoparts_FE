<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import Card from 'primevue/card'
import Chart from 'primevue/chart'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import Badge from 'primevue/badge'
import Divider from 'primevue/divider'
import ProgressSpinner from 'primevue/progressspinner'

import type {
  ChartData,
  ChartOptions,
  TooltipItem
} from 'chart.js'

import {
  formatCurrencyIDR,
  getInitials,
  formatDateID
} from '@/utils/format'

import { fetchProducts } from '@/services/productService'
import { fetchOrders } from '@/services/orderService'
import { fetchCustomers } from '@/services/customerService'
import type { Product } from '@/types/product'
import type { Order } from '@/types/order'

/* =========================================================
 * TYPES
 * ======================================================= */

type TagSeverity =
  | 'secondary'
  | 'success'
  | 'info'
  | 'warn'
  | 'danger'
  | 'contrast'

type TransactionStatus =
  | 'SELESAI'
  | 'DIKIRIM'
  | 'PROSES'
  | 'MENUNGGU'
  | 'DIBATALKAN'

interface Summary {
  label: string
  value: string
  change: string
  icon: string
  severity: TagSeverity
  avatarClass: string
}

interface CriticalStock {
  id: number
  name: string
  code: string
  stock: number
  unit: string
  icon: string
}

interface TransactionItem {
  name: string
  quantity: number
  unitPrice: number
}

interface Transaction {
  id: number
  orderNumber: string
  customer: string
  product: string
  sku: string
  status: TransactionStatus
  total: number
  createdAt: string
  items: TransactionItem[]
}

/* =========================================================
 * STATE
 * ======================================================= */

const isLoading = ref(true)

const totalSalesVal = ref(0)
const lowStockCount = ref(0)
const totalOrdersCount = ref(0)
const totalCustomersCount = ref(0)

const criticalStocks = ref<CriticalStock[]>([])
const recentTransactions = ref<Transaction[]>([])

const daySalesMap = ref<number[]>([0, 0, 0, 0, 0, 0, 0])

/* =========================================================
 * SUMMARY COMPUTED
 * ======================================================= */

const summaries = computed<Summary[]>(() => [
  {
    label: 'Total Penjualan',
    value: formatCurrencyIDR(totalSalesVal.value),
    change: 'Total',
    icon: 'pi pi-wallet',
    severity: 'success',
    avatarClass: 'bg-blue-50 text-blue-600'
  },
  {
    label: 'Stok Rendah',
    value: String(lowStockCount.value),
    change: 'Item Kritis',
    icon: 'pi pi-box',
    severity: 'danger',
    avatarClass: 'bg-red-50 text-red-600'
  },
  {
    label: 'Total Order',
    value: String(totalOrdersCount.value),
    change: 'Pesanan',
    icon: 'pi pi-shopping-cart',
    severity: 'info',
    avatarClass: 'bg-purple-50 text-purple-600'
  },
  {
    label: 'Total Pelanggan',
    value: String(totalCustomersCount.value),
    change: 'Terdaftar',
    icon: 'pi pi-users',
    severity: 'secondary',
    avatarClass: 'bg-orange-50 text-orange-600'
  }
])

/* =========================================================
 * WEEKLY SALES CHART COMPUTED
 * ======================================================= */

const weeklySalesData = computed<ChartData<'bar'>>(() => ({
  labels: [
    'Sen',
    'Sel',
    'Rab',
    'Kam',
    'Jum',
    'Sab',
    'Min'
  ],
  datasets: [
    {
      label: 'Penjualan (Rp)',
      data: daySalesMap.value,
      backgroundColor: '#2563eb',
      borderColor: '#2563eb',
      borderWidth: 0,
      borderRadius: 4,
      borderSkipped: false,
      barPercentage: 0.7,
      categoryPercentage: 0.8
    }
  ]
}))

const weeklySalesOptions: ChartOptions<'bar'> = {
  responsive: true,
  maintainAspectRatio: false,

  interaction: {
    mode: 'index',
    intersect: false
  },

  plugins: {
    legend: {
      display: false
    },

    tooltip: {
      backgroundColor: '#ffffff',
      titleColor: '#111827',
      bodyColor: '#374151',
      borderColor: '#e5e7eb',
      borderWidth: 1,
      displayColors: false,
      padding: 10,

      callbacks: {
        label(context: TooltipItem<'bar'>): string {
          const value = context.parsed.y ?? 0
          return `${context.dataset.label}: ${formatCurrencyIDR(value)}`
        }
      }
    }
  },

  scales: {
    x: {
      border: {
        display: false
      },
      grid: {
        display: false
      },
      ticks: {
        color: '#6b7280',
        font: {
          size: 11
        }
      }
    },
    y: {
      beginAtZero: true,
      border: {
        display: false
      },
      grid: {
        color: '#f3f4f6'
      },
      ticks: {
        color: '#6b7280',
        font: {
          size: 10
        },
        callback(value) {
          if (typeof value === 'number') {
            if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`
            if (value >= 1_000) return `${(value / 1_000).toFixed(0)}k`
          }
          return value
        }
      }
    }
  }
}

/* =========================================================
 * STATUS MAPPER
 * ======================================================= */

const mapBackendStatus = (statusStr: string): TransactionStatus => {
  const s = statusStr.toLowerCase()
  if (s === 'paid' || s === 'completed' || s === 'selesai' || s === 'settlement') return 'SELESAI'
  if (s === 'shipped' || s === 'dikirim') return 'DIKIRIM'
  if (s === 'reserved' || s === 'pending' || s === 'proses') return 'PROSES'
  if (s === 'cancelled' || s === 'dibatalkan' || s === 'expire') return 'DIBATALKAN'
  return 'MENUNGGU'
}

const getStatusSeverity = (
  status: TransactionStatus
): TagSeverity => {
  switch (status) {
    case 'SELESAI':
      return 'success'

    case 'DIKIRIM':
      return 'info'

    case 'PROSES':
      return 'warn'

    case 'DIBATALKAN':
      return 'danger'

    case 'MENUNGGU':
    default:
      return 'secondary'
  }
}

/* =========================================================
 * LOAD DATA FROM APIS
 * ======================================================= */

const loadDashboardData = async () => {
  isLoading.value = true
  try {
    const [productsRes, ordersRes, customersRes] = await Promise.allSettled([
      fetchProducts({ limit: 100 }),
      fetchOrders({ limit: 100 }),
      fetchCustomers({ limit: 100 })
    ])

    // 1. Process Products & Critical Stock
    if (productsRes.status === 'fulfilled') {
      const allProducts: Product[] = productsRes.value.data
      const lowStockProducts = allProducts.filter(
        (p) => (p.stock - (p.reserved ?? 0)) <= (p.minimumStock || 5)
      )
      lowStockCount.value = lowStockProducts.length

      criticalStocks.value = lowStockProducts.slice(0, 5).map((p) => {
        const nameLower = p.name.toLowerCase()
        let icon = 'pi pi-box'
        if (nameLower.includes('rem') || nameLower.includes('brake')) icon = 'pi pi-sliders-h'
        else if (nameLower.includes('oli') || nameLower.includes('oil')) icon = 'pi pi-tint'
        else if (nameLower.includes('busi') || nameLower.includes('spark')) icon = 'pi pi-cog'
        else if (nameLower.includes('aki') || nameLower.includes('accu')) icon = 'pi pi-bolt'

        return {
          id: p.id,
          name: p.name,
          code: p.sku,
          stock: Math.max(0, p.stock - (p.reserved ?? 0)),
          unit: p.unit || 'pcs',
          icon
        }
      })
    }

    // 2. Process Customers Count
    if (customersRes.status === 'fulfilled') {
      totalCustomersCount.value = customersRes.value.meta?.total || customersRes.value.data.length
    }

    // 3. Process Orders, Sales Total, Recent Transactions & Chart Data
    if (ordersRes.status === 'fulfilled') {
      const allOrders: Order[] = ordersRes.value.data
      totalOrdersCount.value = ordersRes.value.meta?.total || allOrders.length

      let salesSum = 0
      const days = [0, 0, 0, 0, 0, 0, 0] // Sen, Sel, Rab, Kam, Jum, Sab, Min

      allOrders.forEach((ord) => {
        if (ord.status === 'paid' || ord.status === 'completed' || ord.status === 'settlement') {
          salesSum += ord.total_price
        }

        // Calculate sales by day of week
        if (ord.created_at) {
          const date = new Date(ord.created_at)
          let dayIndex = date.getDay() - 1 // JS getDay: 0=Sun, 1=Mon, ..., 6=Sat
          if (dayIndex === -1) dayIndex = 6 // Convert Sun to index 6 (Min)
          if (dayIndex >= 0 && dayIndex < 7) {
            days[dayIndex] += ord.total_price
          }
        }
      })

      totalSalesVal.value = salesSum
      daySalesMap.value = days

      recentTransactions.value = allOrders.slice(0, 10).map((ord) => {
        const formattedItems: TransactionItem[] = (ord.items || []).map((it) => ({
          name: it.product_name || `Produk #${it.product_id}`,
          quantity: it.quantity,
          unitPrice: it.unit_price,
        }))

        const firstItem = formattedItems[0]
        let productLabel = 'Tanpa Item'
        if (formattedItems.length === 1) {
          productLabel = firstItem.name
        } else if (formattedItems.length > 1) {
          productLabel = `${firstItem.name} +${formattedItems.length - 1} produk lainnya`
        }

        return {
          id: ord.id,
          orderNumber: ord.order_number,
          customer: ord.user_id ? `User #${ord.user_id}` : (ord.notes?.split(';')[0] || 'Pelanggan Umum'),
          product: productLabel,
          sku: firstItem ? `SKU-${ord.id}` : ord.source,
          status: mapBackendStatus(ord.status),
          total: ord.total_price,
          createdAt: formatDateID(ord.created_at),
          items: formattedItems
        }
      })
    }
  } catch (err) {
    console.error('[DashboardView] Error loading dashboard data:', err)
  } finally {
    isLoading.value = false
  }
}

onMounted(() => {
  loadDashboardData()
})
</script>

<template>
  <div class="p-3 md:p-4 surface-ground min-h-screen">
    <!-- =====================================================
         HEADER
    ====================================================== -->

    <div class="mb-4">
      <h1 class="text-2xl font-bold text-900 m-0">
        Dashboard Utama
      </h1>

      <p class="text-sm text-500 mt-2 mb-0">
        Ringkasan operasional gudang hari ini.
      </p>
    </div>

    <!-- =====================================================
         SUMMARY
    ====================================================== -->

    <div class="grid mb-2">
      <div
        v-for="summary in summaries"
        :key="summary.label"
        class="col-12 sm:col-6 xl:col-3"
      >
        <Card class="h-full">
          <template #content>
            <div class="flex flex-column gap-4">
              <div
                class="
                  flex
                  align-items-start
                  justify-content-between
                  gap-3
                "
              >
                <Avatar
                  :icon="summary.icon"
                  shape="square"
                  size="large"
                  :class="summary.avatarClass"
                />

                <Tag
                  :value="summary.change"
                  :severity="summary.severity"
                  rounded
                />
              </div>

              <div>
                <div
                  class="
                    text-xs
                    text-500
                    font-medium
                    uppercase
                    mb-2
                  "
                >
                  {{ summary.label }}
                </div>

                <div class="text-2xl font-bold text-900">
                  {{ summary.value }}
                </div>
              </div>
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- =====================================================
         SALES + CRITICAL STOCK
    ====================================================== -->

    <div class="grid mb-2">
      <!-- WEEKLY SALES -->

      <div class="col-12 xl:col-8">
        <Card class="h-full">
          <template #title>
            <div class="text-base font-semibold text-900">
              Tren Penjualan Mingguan
            </div>
          </template>

          <template #subtitle>
            <span class="text-xs text-500">
              Data penjualan 7 hari terakhir
            </span>
          </template>

          <template #content>
            <Chart
              type="bar"
              :data="weeklySalesData"
              :options="weeklySalesOptions"
              class="w-full h-20rem"
            />
          </template>
        </Card>
      </div>

      <!-- CRITICAL STOCK -->

      <div class="col-12 xl:col-4">
        <Card class="h-full">
          <template #title>
            <div
              class="
                flex
                align-items-center
                justify-content-between
                gap-3
              "
            >
              <span class="text-base font-semibold text-900">
                Stok Kritis
              </span>

              <Badge
                :value="criticalStocks.length"
                severity="danger"
              />
            </div>
          </template>

          <template #subtitle>
            <span class="text-xs text-500">
              Item yang perlu segera dipesan
            </span>
          </template>

          <template #content>
            <div v-if="criticalStocks.length === 0" class="text-xs text-500 py-3 text-center">
              Tidak ada produk dengan stok kritis.
            </div>
            <template
              v-else
              v-for="(item, index) in criticalStocks"
              :key="item.id"
            >
              <div
                class="
                  flex
                  align-items-center
                  justify-content-between
                  gap-3
                  py-2
                "
              >
                <div
                  class="
                    flex
                    align-items-center
                    gap-3
                    min-w-0
                  "
                >
                  <Avatar
                    :icon="item.icon"
                    shape="square"
                    class="
                      bg-blue-50
                      text-blue-600
                      flex-shrink-0
                    "
                  />

                  <div class="min-w-0">
                    <div
                      class="
                        text-sm
                        font-semibold
                        text-900
                        white-space-nowrap
                        overflow-hidden
                        text-overflow-ellipsis
                      "
                    >
                      {{ item.name }}
                    </div>

                    <div class="text-xs text-500 mt-1">
                      {{ item.code }}
                    </div>
                  </div>
                </div>

                <div
                  class="
                    flex
                    flex-column
                    align-items-end
                    flex-shrink-0
                  "
                >
                  <span class="text-sm font-bold text-red-500">
                    {{ item.stock }}
                  </span>

                  <span class="text-xs text-500">
                    {{ item.unit }}
                  </span>
                </div>
              </div>

              <Divider
                v-if="index < criticalStocks.length - 1"
                class="my-2"
              />
            </template>
          </template>
        </Card>
      </div>
    </div>

    <!-- =====================================================
         RECENT TRANSACTIONS
    ====================================================== -->

    <div class="grid">
      <div class="col-12">
        <Card>
          <template #title>
            <div class="text-base font-semibold text-900">
              Transaksi Terbaru
            </div>
          </template>

          <template #subtitle>
            <span class="text-xs text-500">
              Aktivitas transaksi terbaru hari ini
            </span>
          </template>

          <template #content>
            <DataTable
              :value="recentTransactions"
              data-key="id"
              responsive-layout="scroll"
              striped-rows
              row-hover
              class="w-full"
            >
              <!-- ORDER -->

              <Column
                field="orderNumber"
                header="NO. ORDER"
                style="min-width: 10rem"
              >
                <template
                  #body="{ data }: { data: Transaction }"
                >
                  <span class="text-sm font-medium text-900">
                    {{ data.orderNumber }}
                  </span>
                </template>
              </Column>
              <!-- TANGGAL -->

              <Column
                field="createdAt"
                header="TANGGAL"
                style="min-width: 10rem"
              >
                <template
                  #body="{ data }: { data: Transaction }"
                >
                  <span class="text-sm font-medium text-700">
                    {{ data.createdAt }}
                  </span>
                </template>
              </Column>
              <!-- CUSTOMER -->

              <Column
                field="customer"
                header="PELANGGAN"
                style="min-width: 13rem"
              >
                <template
                  #body="{ data }: { data: Transaction }"
                >
                  <div class="flex align-items-center gap-2">
                    <Avatar
                      :label="getInitials(data.customer)"
                      shape="circle"
                      class="
                        bg-blue-50
                        text-blue-600
                        flex-shrink-0
                      "
                    />

                    <span class="text-sm text-900">
                      {{ data.customer }}
                    </span>
                  </div>
                </template>
              </Column>

              <!-- PRODUCT -->

              <Column
                field="product"
                header="PRODUK"
                style="min-width: 16rem"
              >
                <template
                  #body="{ data }: { data: Transaction }"
                >
                  <div v-if="data.items && data.items.length > 0" class="flex flex-column gap-1">
                    <div
                      v-for="(item, idx) in data.items"
                      :key="idx"
                      class="flex align-items-center justify-content-between gap-2 text-xs"
                    >
                      <span class="font-medium text-900 line-clamp-1">
                        • {{ item.name }}
                      </span>
                      <span class="text-500 font-semibold flex-shrink-0">
                        x{{ item.quantity }}
                      </span>
                    </div>
                  </div>
                  <div v-else class="text-sm text-900">
                    {{ data.product }}
                  </div>
                </template>
              </Column>

              <!-- STATUS -->

              <Column
                field="status"
                header="STATUS"
                style="min-width: 8rem"
              >
                <template
                  #body="{ data }: { data: Transaction }"
                >
                  <Tag
                    :value="data.status"
                    :severity="getStatusSeverity(data.status)"
                    rounded
                  />
                </template>
              </Column>

              <!-- TOTAL -->

              <Column
                field="total"
                header="TOTAL"
                style="min-width: 9rem"
              >
                <template
                  #body="{ data }: { data: Transaction }"
                >
                  <span class="text-sm font-semibold text-900">
                    {{ formatCurrencyIDR(data.total) }}
                  </span>
                </template>
              </Column>
            </DataTable>
          </template>
        </Card>
      </div>
    </div>
  </div>
</template>