<script setup lang="ts">
import Card from 'primevue/card'
import Chart from 'primevue/chart'
import DataTable from 'primevue/datatable'
import Column from 'primevue/column'
import Tag from 'primevue/tag'
import Avatar from 'primevue/avatar'
import Badge from 'primevue/badge'
import Divider from 'primevue/divider'

import type {
  ChartData,
  ChartOptions,
  TooltipItem
} from 'chart.js'

import {
  formatCurrencyIDR,
  getInitials
} from '@/utils/format'

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

interface Transaction {
  id: number
  orderNumber: string
  customer: string
  product: string
  sku: string
  status: TransactionStatus
  total: number
}

/* =========================================================
 * SUMMARY
 * ======================================================= */

const summaries: Summary[] = [
  {
    label: 'Total Penjualan',
    value: formatCurrencyIDR(42_500_000),
    change: '+8.2%',
    icon: 'pi pi-wallet',
    severity: 'success',
    avatarClass: 'bg-blue-50 text-blue-600'
  },
  {
    label: 'Stok Rendah',
    value: '86',
    change: '24 item',
    icon: 'pi pi-box',
    severity: 'danger',
    avatarClass: 'bg-red-50 text-red-600'
  },
  {
    label: 'Order Baru',
    value: '158',
    change: 'Baru',
    icon: 'pi pi-shopping-cart',
    severity: 'info',
    avatarClass: 'bg-purple-50 text-purple-600'
  },
  {
    label: 'Total Pelanggan',
    value: '1.240',
    change: '+14',
    icon: 'pi pi-users',
    severity: 'secondary',
    avatarClass: 'bg-orange-50 text-orange-600'
  }
]

/* =========================================================
 * WEEKLY SALES CHART
 * ======================================================= */

const weeklySalesData: ChartData<'bar'> = {
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
      label: 'Penjualan',
      data: [
        42,
        56,
        28,
        61,
        47,
        18,
        11
      ],
      backgroundColor: '#2563eb',
      borderColor: '#2563eb',
      borderWidth: 0,
      borderRadius: 4,
      borderSkipped: false,
      barPercentage: 0.7,
      categoryPercentage: 0.8
    },
    {
      label: 'Sisa Target',
      data: [
        24,
        10,
        38,
        5,
        19,
        48,
        55
      ],
      backgroundColor: '#dbeafe',
      borderColor: '#dbeafe',
      borderWidth: 0,
      borderRadius: 4,
      borderSkipped: false,
      barPercentage: 0.7,
      categoryPercentage: 0.8
    }
  ]
}

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

          return `${context.dataset.label}: Rp${value} juta`
        }
      }
    }
  },

  scales: {
    x: {
      stacked: true,

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
      stacked: true,
      beginAtZero: true,

      border: {
        display: false
      },

      grid: {
        color: '#f3f4f6'
      },

      ticks: {
        display: false
      }
    }
  }
}

/* =========================================================
 * CRITICAL STOCK
 * ======================================================= */

const criticalStocks: CriticalStock[] = [
  {
    id: 1,
    name: 'Kampas Rem Bendix',
    code: 'Brake Pad - Front',
    stock: 5,
    unit: 'Pcs',
    icon: 'pi pi-car'
  },
  {
    id: 2,
    name: 'Shell Helix Ultra',
    code: '5W-40',
    stock: 2,
    unit: 'Ltr',
    icon: 'pi pi-box'
  },
  {
    id: 3,
    name: 'Busi NGK Iridium',
    code: 'Spark Plug',
    stock: 12,
    unit: 'Pcs',
    icon: 'pi pi-cog'
  }
]

/* =========================================================
 * RECENT TRANSACTIONS
 * ======================================================= */

const recentTransactions: Transaction[] = [
  {
    id: 1,
    orderNumber: '#ORD-2023-9081',
    customer: 'Bengkel Karunia',
    product: 'Radiator Toyota Avanza',
    sku: 'RAD-AVANZA-001',
    status: 'SELESAI',
    total: 1_250_000
  },
  {
    id: 2,
    orderNumber: '#ORD-2023-9082',
    customer: 'Putra Jaya Motor',
    product: 'Oil Federal Matic (12 Ltr)',
    sku: 'OIL-FED-MTC-12',
    status: 'DIKIRIM',
    total: 640_000
  },
  {
    id: 3,
    orderNumber: '#ORD-2023-9083',
    customer: 'Ahli Shockbreaker',
    product: 'Shock KYB Ultra Rear',
    sku: 'SHOCK-KYB-UR',
    status: 'PROSES',
    total: 890_000
  },
  {
    id: 4,
    orderNumber: '#ORD-2023-9084',
    customer: 'Sumber Motor',
    product: 'Aki GS Astra NS40ZL',
    sku: 'AKI-GS-NS40ZL',
    status: 'MENUNGGU',
    total: 975_000
  },
  {
    id: 5,
    orderNumber: '#ORD-2023-9085',
    customer: 'Prima Auto Service',
    product: 'Filter Oli Toyota',
    sku: 'FLT-OIL-TYT-001',
    status: 'SELESAI',
    total: 375_000
  }
]

/* =========================================================
 * HELPERS
 * ======================================================= */

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
            <template
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
                  <div class="flex flex-column gap-1">
                    <span class="text-sm text-900">
                      {{ data.product }}
                    </span>

                    <span class="text-xs text-500">
                      {{ data.sku }}
                    </span>
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