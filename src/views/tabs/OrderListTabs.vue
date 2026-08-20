<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Column from 'primevue/column'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import Divider from 'primevue/divider'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

import type { Order, StatusFilter, StatusFilterOption } from '@/types/order'
import { fetchOrders, deleteOrder as apiDeleteOrder, type FetchOrdersParams } from '@/services/orderService'
import { formatCurrencyIDR, formatNumberID } from '@/utils/format'
import { formatDateTimeID } from '@/utils/date'

/* =========================================================
 * SERVICES & STATE
 * ======================================================= */
const toast = useToast()
const confirm = useConfirm()

const search = ref<string>('')
const selectedStatusFilter = ref<StatusFilter>('all')
const selectedDates = ref<(Date | null)[] | Date | null>(null)

const statusFilterOptions: StatusFilterOption[] = [
  { label: 'Semua Status', value: 'all' },
  { label: 'Paid', value: 'paid' },
  { label: 'Pending', value: 'pending' },
  { label: 'Cancelled', value: 'cancelled' },
]

const orders = ref<Order[]>([])
const isLoading = ref<boolean>(false)
const page = ref<number>(1)
const limit = ref<number>(10)
const totalRecords = ref<number>(0)

/* =========================================================
 * DETAIL DIALOG STATE
 * ======================================================= */
const detailDialogVisible = ref<boolean>(false)
const selectedOrder = ref<Order | null>(null)

const showOrderDetails = (order: Order): void => {
  selectedOrder.value = order
  detailDialogVisible.value = true
}

const formatDateToYYYYMMDD = (date: Date): string => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const loadOrders = async (): Promise<void> => {
  isLoading.value = true
  try {
    const params: FetchOrdersParams = {
      q: search.value.trim() || undefined,
      status: selectedStatusFilter.value === 'all' ? undefined : selectedStatusFilter.value,
      page: page.value,
      limit: limit.value,
    }

    if (selectedDates.value) {
      if (Array.isArray(selectedDates.value)) {
        const d1 = selectedDates.value[0]
        const d2 = selectedDates.value[1]
        if (d1 && d2) {
          params.start_date = formatDateToYYYYMMDD(d1)
          params.end_date = formatDateToYYYYMMDD(d2)
        } else if (d1) {
          params.date = formatDateToYYYYMMDD(d1)
        }
      } else if (selectedDates.value instanceof Date) {
        params.date = formatDateToYYYYMMDD(selectedDates.value)
      }
    }

    const res = await fetchOrders(params)
    orders.value = res.data
    totalRecords.value = res.meta.total
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Gagal memuat data',
      detail: err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat order.',
      life: 4000,
    })
  } finally {
    isLoading.value = false
  }
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch(search, () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 1
    loadOrders()
  }, 400)
})

watch(selectedStatusFilter, () => {
  page.value = 1
  loadOrders()
})

watch(selectedDates, () => {
  page.value = 1
  loadOrders()
})

const onPage = (event: any) => {
  page.value = event.page + 1
  limit.value = event.rows
  loadOrders()
}

onMounted(loadOrders)

/* =========================================================
 * COMPUTED & METHODS
 * ======================================================= */
const resetFilters = (): void => {
  search.value = ''
  selectedStatusFilter.value = 'all'
  selectedDates.value = null
}

const getStatusSeverity = (status: string): 'success' | 'warn' | 'danger' | 'info' => {
  switch (status.toLowerCase()) {
    case 'paid':
      return 'success'
    case 'pending':
      return 'warn'
    case 'cancelled':
      return 'danger'
    default:
      return 'info'
  }
}

const confirmDeleteOrder = (order: Order): void => {
  confirm.require({
    header: 'Hapus Pesanan',
    message: `Apakah kamu yakin ingin menghapus pesanan "${order.order_number}"?`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Batal',
    acceptLabel: 'Hapus',
    rejectProps: {
      severity: 'secondary',
      outlined: true,
    },
    acceptProps: {
      severity: 'danger',
    },
    accept: async () => {
      try {
        await apiDeleteOrder(order.id)
        await loadOrders()
        toast.add({
          severity: 'success',
          summary: 'Berhasil',
          detail: 'Pesanan berhasil dihapus.',
          life: 3000,
        })
      } catch (err) {
        toast.add({
          severity: 'error',
          summary: 'Gagal menghapus',
          detail: err instanceof Error ? err.message : 'Terjadi kesalahan.',
          life: 4000,
        })
      }
    },
  })
}
</script>

<template>
  <div>
    <!-- FILTER BAR -->
    <div class="flex flex-column xl:flex-row xl:align-items-center gap-3 mb-4">
      <div class="flex flex-column md:flex-row gap-2 flex-1 min-w-0">
        <!-- SEARCH -->
        <IconField class="w-full md:w-16rem">
          <InputIcon class="pi pi-search" />
          <InputText
            v-model="search"
            placeholder="Cari order number..."
            class="w-full"
          />
        </IconField>

        <!-- STATUS FILTER -->
        <Select
          v-model="selectedStatusFilter"
          :options="statusFilterOptions"
          option-label="label"
          option-value="value"
          class="w-full md:w-11rem"
        />

        <!-- DATE / DATE RANGE FILTER -->
        <DatePicker
          v-model="selectedDates"
          selectionMode="range"
          dateFormat="yy-mm-dd"
          placeholder="Filter Tanggal..."
          showIcon
          showButtonBar
          class="w-full md:w-16rem"
        />
      </div>

      <!-- RESET -->
      <div class="flex align-items-center flex-shrink-0 xl:ml-auto">
        <Button
          label="Reset"
          icon="pi pi-filter-slash"
          severity="secondary"
          text
          title="Reset semua filter pencarian"
          @click="resetFilters"
        />
      </div>
    </div>

    <!-- DATATABLE -->
    <DataTable
      :value="orders"
      :loading="isLoading"
      data-key="id"
      lazy
      paginator
      :rows="limit"
      :total-records="totalRecords"
      :rows-per-page-options="[10, 25, 50]"
      striped-rows
      row-hover
      responsive-layout="scroll"
      class="w-full"
      @page="onPage"
    >
      <!-- NO -->
      <Column header="NO" style="width: 4rem">
        <template #body="{ index }">
          <span class="text-sm font-medium text-700">
            {{ (page - 1) * limit + index + 1 }}
          </span>
        </template>
      </Column>

      <!-- ORDER NUMBER -->
      <Column field="order_number" header="ORDER NUMBER" sortable style="min-width: 13rem">
        <template #body="{ data }: { data: Order }">
          <span class="font-semibold text-900">{{ data.order_number }}</span>
        </template>
      </Column>

      <!-- TOTAL PRICE -->
      <Column field="total_price" header="TOTAL PRICE" sortable style="min-width: 10rem">
        <template #body="{ data }: { data: Order }">
          <span class="text-sm font-semibold text-900">
            {{ formatCurrencyIDR(data.total_price) }}
          </span>
        </template>
      </Column>

      <!-- AMOUNT PAID -->
      <Column field="amount_paid" header="BAYAR" sortable style="min-width: 10rem">
        <template #body="{ data }: { data: Order }">
          <span class="text-sm font-medium text-green-700">
            {{ formatCurrencyIDR(data.amount_paid) }}
          </span>
        </template>
      </Column>

      <!-- CHANGE AMOUNT -->
      <Column field="change_amount" header="KEMBALIAN" sortable style="min-width: 10rem">
        <template #body="{ data }: { data: Order }">
          <span class="text-sm font-medium text-blue-700">
            {{ formatCurrencyIDR(data.change_amount) }}
          </span>
        </template>
      </Column>

      <!-- CREATED AT -->
      <Column field="created_at" header="TANGGAL" sortable style="min-width: 11rem">
        <template #body="{ data }: { data: Order }">
          <span class="text-xs text-600">
            {{ formatDateTimeID(data.created_at) }}
          </span>
        </template>
      </Column>

      <!-- STATUS -->
      <Column field="status" header="STATUS" sortable style="min-width: 8rem">
        <template #body="{ data }: { data: Order }">
          <Tag
            :value="data.status"
            :severity="getStatusSeverity(data.status)"
            rounded
            class="uppercase text-xs"
          />
        </template>
      </Column>

      <!-- ACTION -->
      <Column header="AKSI" style="width: 8rem">
        <template #body="{ data }: { data: Order }">
          <div class="flex align-items-center gap-1">
            <Button
              icon="pi pi-eye"
              severity="info"
              text
              rounded
              aria-label="Detail order"
              title="Lihat Detail Pesanan"
              @click="showOrderDetails(data)"
            />
            <Button
              v-if="['cancelled', 'dibatalkan'].includes(data.status.toLowerCase())"
              icon="pi pi-trash"
              severity="danger"
              text
              rounded
              aria-label="Hapus order"
              title="Hapus Pesanan Dibatalkan"
              @click="confirmDeleteOrder(data)"
            />
          </div>
        </template>
      </Column>

      <!-- EMPTY -->
      <template #empty>
        <div class="flex flex-column align-items-center justify-content-center gap-3 py-6">
          <Avatar
            icon="pi pi-search"
            size="xlarge"
            shape="circle"
            class="bg-gray-100 text-gray-500"
          />
          <div class="text-center">
            <div class="font-semibold text-900">Data pesanan tidak ditemukan</div>
            <div class="text-sm text-500 mt-1">Ubah kata kunci pencarian atau filter status.</div>
          </div>
        </div>
      </template>
    </DataTable>

    <!-- MODAL DETAIL ORDER -->
    <Dialog
      v-model:visible="detailDialogVisible"
      modal
      append-to="body"
      header="Detail Pesanan"
      class="w-full md:w-8 lg:w-6"
      :draggable="false"
    >
      <div v-if="selectedOrder" class="flex flex-column gap-3">
        <!-- Header Info -->
        <div class="flex flex-column md:flex-row justify-content-between align-items-start md:align-items-center gap-2 border-bottom-1 surface-border pb-3">
          <div>
            <div class="text-xs text-500">Nomor Pesanan</div>
            <div class="font-bold text-lg text-900 font-mono">{{ selectedOrder.order_number }}</div>
            <div class="text-xs text-500 mt-1">
              <i class="pi pi-calendar mr-1"></i>{{ formatDateTimeID(selectedOrder.created_at) }}
            </div>
          </div>
          <div class="flex flex-column align-items-start md:align-items-end gap-1">
            <div class="text-xs text-500">Status Pesanan</div>
            <Tag
              :value="selectedOrder.status"
              :severity="getStatusSeverity(selectedOrder.status)"
              rounded
              class="uppercase text-xs"
            />
          </div>
        </div>

        <!-- Info Grid (Metode Pembayaran, Jenis Pesanan, Sumber) -->
        <div class="grid p-fluid">
          <div class="col-12 sm:col-4">
            <div class="surface-100 border-round-lg p-3 border-1 surface-border h-full">
              <div class="text-xs text-500 mb-1 flex align-items-center gap-1">
                <i class="pi pi-credit-card text-blue-600"></i> Metode Bayar
              </div>
              <div class="font-bold text-900 capitalize text-sm">
                {{ selectedOrder.payment_method || '-' }}
              </div>
            </div>
          </div>

          <div class="col-12 sm:col-4">
            <div class="surface-100 border-round-lg p-3 border-1 surface-border h-full">
              <div class="text-xs text-500 mb-1 flex align-items-center gap-1">
                <i class="pi pi-box text-green-600"></i> Tipe Pesanan
              </div>
              <div class="font-bold text-900 capitalize text-sm">
                {{ selectedOrder.order_type === 'delivery' ? 'Pengantaran (Delivery)' : (selectedOrder.order_type === 'pickup' ? 'Ambil di Toko (Pickup)' : (selectedOrder.order_type || 'Langsung (POS)')) }}
              </div>
            </div>
          </div>

          <div class="col-12 sm:col-4">
            <div class="surface-100 border-round-lg p-3 border-1 surface-border h-full">
              <div class="text-xs text-500 mb-1 flex align-items-center gap-1">
                <i class="pi pi-globe text-orange-600"></i> Sumber
              </div>
              <div class="font-bold text-900 uppercase text-sm">
                {{ selectedOrder.source || 'POS' }}
              </div>
            </div>
          </div>
        </div>

        <!-- Notes / Delivery Notes jika ada -->
        <div v-if="selectedOrder.notes" class="surface-50 border-1 surface-border border-round-lg p-3 text-xs">
          <span class="font-semibold text-700 block mb-1">
            <i class="pi pi-info-circle mr-1 text-primary"></i>Catatan Pesanan / Pengiriman:
          </span>
          <span class="text-800 line-height-3">{{ selectedOrder.notes }}</span>
        </div>

        <!-- ITEMS TABLE -->
        <div class="text-sm font-semibold text-900 mt-1">Daftar Produk / Item:</div>
        <DataTable :value="selectedOrder.items || []" striped-rows class="p-datatable-sm">
          <Column field="product_name" header="NAMA PRODUK" style="min-width: 12rem">
            <template #body="{ data }">
              <span class="font-medium text-900">{{ data.product_name || `Produk #${data.product_id}` }}</span>
            </template>
          </Column>
          <Column field="quantity" header="QTY" style="width: 5rem">
            <template #body="{ data }">
              <span class="font-semibold">{{ formatNumberID(data.quantity) }}</span>
            </template>
          </Column>
          <Column field="unit_price" header="HARGA SATUAN">
            <template #body="{ data }">
              {{ formatCurrencyIDR(data.unit_price) }}
            </template>
          </Column>
          <Column field="subtotal" header="SUBTOTAL">
            <template #body="{ data }">
              <span class="font-semibold text-900">{{ formatCurrencyIDR(data.subtotal) }}</span>
            </template>
          </Column>
        </DataTable>

        <Divider />

        <!-- RINGKASAN PEMBAYARAN -->
        <div class="flex flex-column gap-2 text-sm">
          <div v-if="selectedOrder.tax_amount && selectedOrder.tax_amount > 0" class="flex justify-content-between">
            <span class="text-500">Pajak (PPN):</span>
            <span class="font-medium text-900">{{ formatCurrencyIDR(selectedOrder.tax_amount) }}</span>
          </div>
          <div v-if="selectedOrder.shipping_cost && selectedOrder.shipping_cost > 0" class="flex justify-content-between">
            <span class="text-500">Ongkos Kirim:</span>
            <span class="font-medium text-900">{{ formatCurrencyIDR(selectedOrder.shipping_cost) }}</span>
          </div>
          <div class="flex justify-content-between">
            <span class="text-600 font-semibold">Total Harga:</span>
            <span class="font-bold text-primary text-base">{{ formatCurrencyIDR(selectedOrder.total_price) }}</span>
          </div>
          <div class="flex justify-content-between">
            <span class="text-500">Nominal Dibayar:</span>
            <span class="font-medium text-green-700">{{ formatCurrencyIDR(selectedOrder.amount_paid) }}</span>
          </div>
          <div class="flex justify-content-between">
            <span class="text-500">Kembalian:</span>
            <span class="font-medium text-blue-700">{{ formatCurrencyIDR(selectedOrder.change_amount) }}</span>
          </div>
        </div>
      </div>
      <template #footer>
        <Button label="Tutup" severity="secondary" outlined @click="detailDialogVisible = false" />
      </template>
    </Dialog>
  </div>
</template>
