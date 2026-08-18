<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'

import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import ConfirmDialog from 'primevue/confirmdialog'
import DataTable from 'primevue/datatable'
import DatePicker from 'primevue/datepicker'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import Toast from 'primevue/toast'
import Toolbar from 'primevue/toolbar'

import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

import type { DeliveryItem, DeliverySchedule } from '@/types/delivery'
import { deliveryService } from '@/services/deliveryService'
import { formatCurrencyIDR } from '@/utils/format'

/* =========================================================
 * SERVICES
 * ======================================================= */
const confirm = useConfirm()
const toast = useToast()

/* =========================================================
 * HELPERS & OPTIONS
 * ======================================================= */
const formatDateToISO = (date: Date): string => {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

const formatIndoDate = (dateStr: string): string => {
  if (!dateStr) return '-'
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('id-ID', {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })
  } catch {
    return dateStr
  }
}

const STATUS_CONFIG: Record<
  string,
  { label: string; severity: 'secondary' | 'info' | 'success' | 'warn' | 'danger' | 'contrast'; icon: string }
> = {
  waiting_courier_approval: {
    label: 'Menunggu Konfirmasi',
    severity: 'warn',
    icon: 'pi pi-clock',
  },
  confirmed: {
    label: 'Terkonfirmasi',
    severity: 'info',
    icon: 'pi pi-check-circle',
  },
  reschedule_suggested: {
    label: 'Saran Reschedule',
    severity: 'secondary',
    icon: 'pi pi-calendar-plus',
  },
  on_delivery: {
    label: 'Sedang Diantar',
    severity: 'info',
    icon: 'pi pi-truck',
  },
  delivered: {
    label: 'Terkirim / Selesai',
    severity: 'success',
    icon: 'pi pi-verified',
  },
  cancelled: {
    label: 'Dibatalkan',
    severity: 'danger',
    icon: 'pi pi-times-circle',
  },
}

const STATUS_FILTER_OPTIONS = [
  { label: 'Semua Status', value: '' },
  { label: 'Menunggu Konfirmasi', value: 'waiting_courier_approval' },
  { label: 'Terkonfirmasi', value: 'confirmed' },
  { label: 'Saran Reschedule', value: 'reschedule_suggested' },
  { label: 'Sedang Diantar', value: 'on_delivery' },
  { label: 'Terkirim / Selesai', value: 'delivered' },
  { label: 'Dibatalkan', value: 'cancelled' },
]

/* =========================================================
 * STATE
 * ======================================================= */
const selectedDate = ref<Date>(new Date())
const deliveries = ref<DeliveryItem[]>([])
const isLoading = ref<boolean>(false)
const isActionLoading = ref<boolean>(false)

// Filters
const filterStatus = ref<string>('')
const searchKeyword = ref<string>('')

// Reschedule Dialog State
const rescheduleDialogVisible = ref<boolean>(false)
const targetDelivery = ref<DeliveryItem | null>(null)
const rescheduleDate = ref<Date | null>(null)
const availableSchedules = ref<DeliverySchedule[]>([])
const isLoadingSchedules = ref<boolean>(false)
const selectedScheduleId = ref<number | null>(null)
const rescheduleReason = ref<string>('')

// Detail / Info Dialog
const detailDialogVisible = ref<boolean>(false)
const selectedDeliveryDetail = ref<DeliveryItem | null>(null)

/* =========================================================
 * COMPUTED
 * ======================================================= */
const formattedSelectedDate = computed<string>(() => {
  return formatDateToISO(selectedDate.value)
})

const filteredDeliveries = computed<DeliveryItem[]>(() => {
  return deliveries.value.filter((d) => {
    // Filter status
    if (filterStatus.value && d.status !== filterStatus.value) {
      return false
    }
    // Search keyword
    if (searchKeyword.value.trim()) {
      const q = searchKeyword.value.toLowerCase()
      const orderNum = (d.order_number || '').toLowerCase()
      const name = (d.customer_name || '').toLowerCase()
      const phone = (d.customer_phone || '').toLowerCase()
      const address = (d.address || d.customer_address || '').toLowerCase()
      const slot = (d.slot_name || '').toLowerCase()
      return (
        orderNum.includes(q) ||
        name.includes(q) ||
        phone.includes(q) ||
        address.includes(q) ||
        slot.includes(q)
      )
    }
    return true
  })
})

const stats = computed(() => {
  const list = deliveries.value
  return {
    total: list.length,
    waiting: list.filter((d) => d.status === 'waiting_courier_approval').length,
    confirmed: list.filter((d) => d.status === 'confirmed').length,
    rescheduled: list.filter((d) => d.status === 'reschedule_suggested').length,
    completed: list.filter((d) => d.status === 'delivered').length,
  }
})

/* =========================================================
 * FETCH LOGIC
 * ======================================================= */
const loadDeliveries = async () => {
  isLoading.value = true
  try {
    const data = await deliveryService.getDeliveriesByDate(formattedSelectedDate.value)
    deliveries.value = data
  } catch (err: any) {
    console.error('[DeliveryListView] Failed to load deliveries:', err)
    deliveries.value = []
    toast.add({
      severity: 'error',
      summary: 'Gagal Memuat Pengantaran',
      detail: err?.message || 'Terjadi kesalahan saat memuat data pengantaran.',
      life: 3500,
    })
  } finally {
    isLoading.value = false
  }
}

watch(selectedDate, () => {
  loadDeliveries()
})

onMounted(() => {
  loadDeliveries()
})

/* =========================================================
 * ACTIONS: APPROVE / KONFIRMASI
 * ======================================================= */
const handleConfirmDelivery = (item: DeliveryItem) => {
  confirm.require({
    message: `Apakah Anda yakin ingin mengonfirmasi jadwal pengantaran untuk Order #${item.order_number || item.order_id}?`,
    header: 'Konfirmasi Pengantaran',
    icon: 'pi pi-check-circle text-primary',
    acceptLabel: 'Ya, Konfirmasi',
    rejectLabel: 'Batal',
    acceptClass: 'p-button-primary',
    accept: async () => {
      isActionLoading.value = true
      try {
        await deliveryService.approveDelivery(item.id)
        toast.add({
          severity: 'success',
          summary: 'Berhasil Dikonfirmasi',
          detail: `Jadwal pengantaran untuk Order #${item.order_number || item.order_id} telah dikonfirmasi.`,
          life: 3000,
        })
        await loadDeliveries()
      } catch (err: any) {
        toast.add({
          severity: 'error',
          summary: 'Gagal Konfirmasi',
          detail: err?.message || 'Gagal mengonfirmasi jadwal pengantaran.',
          life: 3500,
        })
      } finally {
        isActionLoading.value = false
      }
    },
  })
}

/* =========================================================
 * ACTIONS: RESCHEDULE MODAL & SUBMIT
 * ======================================================= */
const openRescheduleModal = async (item: DeliveryItem) => {
  targetDelivery.value = item
  rescheduleDate.value = new Date(item.delivery_date || new Date())
  selectedScheduleId.value = item.schedule_id
  rescheduleReason.value = ''
  rescheduleDialogVisible.value = true

  await loadAvailableSchedulesForReschedule()
}

const loadAvailableSchedulesForReschedule = async () => {
  if (!rescheduleDate.value) return
  isLoadingSchedules.value = true
  try {
    const dStr = formatDateToISO(rescheduleDate.value)
    const list = await deliveryService.getAvailableSchedules(dStr)
    availableSchedules.value = list
  } catch (err: any) {
    console.error('[DeliveryListView] Failed to load schedules for date:', err)
    availableSchedules.value = []
  } finally {
    isLoadingSchedules.value = false
  }
}

watch(rescheduleDate, () => {
  if (rescheduleDialogVisible.value) {
    loadAvailableSchedulesForReschedule()
  }
})

const handleSaveReschedule = async () => {
  if (!targetDelivery.value || !rescheduleDate.value || !selectedScheduleId.value) {
    toast.add({
      severity: 'warn',
      summary: 'Data Belum Lengkap',
      detail: 'Silakan pilih tanggal dan slot waktu pengantaran baru.',
      life: 3000,
    })
    return
  }

  isActionLoading.value = true
  try {
    const sugDateStr = formatDateToISO(rescheduleDate.value)
    await deliveryService.suggestReschedule(targetDelivery.value.id, {
      suggested_date: sugDateStr,
      suggested_schedule_id: selectedScheduleId.value,
      reason: rescheduleReason.value || undefined,
    })

    toast.add({
      severity: 'success',
      summary: 'Reschedule Diajukan',
      detail: 'Saran perubahan jadwal berhasil dikirimkan ke pelanggan.',
      life: 3500,
    })

    rescheduleDialogVisible.value = false
    await loadDeliveries()
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Gagal Reschedule',
      detail: err?.message || 'Terjadi kesalahan saat mengajukan perubahan jadwal.',
      life: 3500,
    })
  } finally {
    isActionLoading.value = false
  }
}

/* =========================================================
 * DETAIL VIEW MODAL
 * ======================================================= */
const openDetailModal = (item: DeliveryItem) => {
  selectedDeliveryDetail.value = item
  detailDialogVisible.value = true
}

const openGoogleMaps = (lat: number, lng: number) => {
  if (!lat || !lng) return
  const url = `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
  window.open(url, '_blank')
}
</script>

<template>
  <div class="p-3 md:p-4 surface-ground min-h-screen">
    <Toast />
    <ConfirmDialog />

    <!-- PAGE HEADER -->
    <div class="flex flex-column md:flex-row md:align-items-center md:justify-content-between gap-3 mb-4">
      <div>
        <div class="flex align-items-center gap-2">
          <Avatar icon="pi pi-truck" shape="circle" class="bg-primary text-white" />
          <h1 class="text-2xl font-bold text-900 m-0">Daftar Pengantaran (Deliveries)</h1>
        </div>
        <p class="text-sm text-500 mt-1 mb-0">
          Kelola status pengantaran kurir, konfirmasi jadwal, dan ajukan reschedule pesanan.
        </p>
      </div>

      <!-- DATE PICKER -->
      <div class="flex align-items-center gap-2">
        <span class="text-xs font-semibold text-600 hidden sm:inline">Pilih Tanggal:</span>
        <DatePicker
          v-model="selectedDate"
          dateFormat="yy-mm-dd"
          :showIcon="true"
          class="w-14rem"
        />
        <Button
          icon="pi pi-refresh"
          severity="secondary"
          outlined
          rounded
          :loading="isLoading"
          v-tooltip.top="'Segarkan Data'"
          @click="loadDeliveries"
        />
      </div>
    </div>

    <!-- SUMMARY CARDS -->
    <div class="grid mb-4">
      <div class="col-12 sm:col-6 lg:col-3">
        <Card class="surface-card shadow-1 border-round-xl border-left-3 border-blue-500 h-full">
          <template #content>
            <div class="flex justify-content-between align-items-start">
              <div>
                <span class="text-xs font-semibold text-500 uppercase">Total Pengantaran</span>
                <div class="text-2xl font-bold text-900 mt-1">{{ stats.total }}</div>
                <div class="text-xs text-500 mt-1">{{ formatIndoDate(formattedSelectedDate) }}</div>
              </div>
              <Avatar icon="pi pi-box" class="bg-blue-50 text-blue-600" shape="circle" size="large" />
            </div>
          </template>
        </Card>
      </div>

      <div class="col-12 sm:col-6 lg:col-3">
        <Card class="surface-card shadow-1 border-round-xl border-left-3 border-yellow-500 h-full">
          <template #content>
            <div class="flex justify-content-between align-items-start">
              <div>
                <span class="text-xs font-semibold text-500 uppercase">Menunggu Konfirmasi</span>
                <div class="text-2xl font-bold text-yellow-600 mt-1">{{ stats.waiting }}</div>
                <div class="text-xs text-500 mt-1">Perlu tindakan kurir / admin</div>
              </div>
              <Avatar icon="pi pi-clock" class="bg-yellow-50 text-yellow-600" shape="circle" size="large" />
            </div>
          </template>
        </Card>
      </div>

      <div class="col-12 sm:col-6 lg:col-3">
        <Card class="surface-card shadow-1 border-round-xl border-left-3 border-cyan-500 h-full">
          <template #content>
            <div class="flex justify-content-between align-items-start">
              <div>
                <span class="text-xs font-semibold text-500 uppercase">Terkonfirmasi</span>
                <div class="text-2xl font-bold text-cyan-600 mt-1">{{ stats.confirmed }}</div>
                <div class="text-xs text-500 mt-1">Siap untuk dikirim</div>
              </div>
              <Avatar icon="pi pi-check" class="bg-cyan-50 text-cyan-600" shape="circle" size="large" />
            </div>
          </template>
        </Card>
      </div>

      <div class="col-12 sm:col-6 lg:col-3">
        <Card class="surface-card shadow-1 border-round-xl border-left-3 border-purple-500 h-full">
          <template #content>
            <div class="flex justify-content-between align-items-start">
              <div>
                <span class="text-xs font-semibold text-500 uppercase">Saran Reschedule</span>
                <div class="text-2xl font-bold text-purple-600 mt-1">{{ stats.rescheduled }}</div>
                <div class="text-xs text-500 mt-1">Menunggu persetujuan customer</div>
              </div>
              <Avatar icon="pi pi-calendar-plus" class="bg-purple-50 text-purple-600" shape="circle" size="large" />
            </div>
          </template>
        </Card>
      </div>
    </div>

    <!-- MAIN CARD & TABLE -->
    <Card class="surface-card shadow-1 border-round-xl">
      <template #content>
        <!-- TOOLBAR & FILTERS -->
        <Toolbar class="mb-4 surface-0 border-none p-0">
          <template #start>
            <div class="flex flex-wrap align-items-center gap-2">
              <!-- Search -->
              <IconField iconPosition="left">
                <InputIcon class="pi pi-search" />
                <InputText
                  v-model="searchKeyword"
                  placeholder="Cari order, customer, alamat..."
                  class="w-16rem text-sm"
                />
              </IconField>

              <!-- Status Filter -->
              <Select
                v-model="filterStatus"
                :options="STATUS_FILTER_OPTIONS"
                optionLabel="label"
                optionValue="value"
                placeholder="Status Pengantaran"
                class="w-14rem text-sm"
              />
            </div>
          </template>

          <template #end>
            <div class="text-xs text-500 font-medium">
              Menampilkan {{ filteredDeliveries.length }} dari {{ deliveries.length }} pengantaran
            </div>
          </template>
        </Toolbar>

        <!-- DATA TABLE -->
        <DataTable
          :value="filteredDeliveries"
          :loading="isLoading"
          responsiveLayout="scroll"
          paginator
          :rows="10"
          :rowsPerPageOptions="[10, 20, 50]"
          stripedRows
          class="p-datatable-sm"
        >
          <template #empty>
            <div class="p-4 text-center text-500 flex flex-column align-items-center gap-2">
              <i class="pi pi-truck text-4xl text-300" />
              <p class="m-0 font-medium">Tidak ada data pengantaran pada tanggal {{ formattedSelectedDate }}</p>
              <p class="m-0 text-xs text-400">Pilih tanggal lain atau pastikan sudah ada pesanan dengan metode delivery.</p>
            </div>
          </template>

          <!-- Kolom Order -->
          <Column header="Order" style="min-width: 140px">
            <template #body="{ data }">
              <div class="flex flex-column">
                <span class="font-bold text-primary font-mono text-sm">
                  #{{ data.order_number || data.order_id }}
                </span>
                <span class="text-xs text-500 mt-1">ID: {{ data.id }}</span>
              </div>
            </template>
          </Column>

          <!-- Kolom Customer -->
          <Column header="Pelanggan" style="min-width: 180px">
            <template #body="{ data }">
              <div class="flex flex-column">
                <span class="font-semibold text-900 text-sm">
                  {{ data.customer_name || 'Tanpa Nama' }}
                </span>
                <span class="text-xs text-500 flex align-items-center gap-1 mt-1">
                  <i class="pi pi-phone text-xs" /> {{ data.customer_phone || '-' }}
                </span>
              </div>
            </template>
          </Column>

          <!-- Kolom Slot Waktu -->
          <Column header="Slot Jadwal" style="min-width: 170px">
            <template #body="{ data }">
              <div class="flex flex-column">
                <div class="flex align-items-center gap-1 font-medium text-900 text-sm">
                  <i class="pi pi-calendar text-primary text-xs" />
                  <span>{{ data.slot_name || 'Slot Regular' }}</span>
                </div>
                <span class="text-xs text-500 font-mono mt-1">
                  {{ data.delivery_date }}
                </span>
              </div>
            </template>
          </Column>

          <!-- Kolom Alamat & Ongkir -->
          <Column header="Alamat & Jarak" style="min-width: 220px">
            <template #body="{ data }">
              <div class="flex flex-column gap-1">
                <div class="text-xs text-800 line-clamp-2" :title="data.address || data.customer_address">
                  {{ data.address || data.customer_address || '-' }}
                </div>
                <div class="flex align-items-center gap-2 mt-1">
                  <Tag
                    v-if="data.distance_km"
                    severity="secondary"
                    class="text-xs font-mono"
                    :value="`${data.distance_km.toFixed(1)} km`"
                  />
                  <span class="text-xs font-semibold text-blue-700">
                    {{ formatCurrencyIDR(data.shipping_cost || 0) }}
                  </span>
                  <Button
                    v-if="data.latitude && data.longitude"
                    icon="pi pi-map-marker"
                    size="small"
                    text
                    rounded
                    severity="danger"
                    v-tooltip.top="'Buka di Google Maps'"
                    class="p-0 w-1.5rem h-1.5rem"
                    @click="openGoogleMaps(data.latitude, data.longitude)"
                  />
                </div>
              </div>
            </template>
          </Column>

          <!-- Kolom Status -->
          <Column header="Status" style="min-width: 160px">
            <template #body="{ data }">
              <div class="flex flex-column gap-1">
                <Tag
                  :severity="STATUS_CONFIG[data.status]?.severity || 'secondary'"
                  :value="STATUS_CONFIG[data.status]?.label || data.status"
                  :icon="STATUS_CONFIG[data.status]?.icon"
                  class="text-xs"
                />
                <span v-if="data.status === 'reschedule_suggested' && data.suggested_date" class="text-xs text-purple-700 font-medium">
                  Usulan: {{ data.suggested_date }} ({{ data.suggested_slot_name || 'Slot Baru' }})
                </span>
              </div>
            </template>
          </Column>

          <!-- Kolom Aksi -->
          <Column header="Aksi" style="min-width: 170px" alignFrozen="right" frozen>
            <template #body="{ data }">
              <div class="flex align-items-center gap-1">
                <!-- Tombol Konfirmasi -->
                <Button
                  v-if="data.status === 'waiting_courier_approval'"
                  icon="pi pi-check"
                  size="small"
                  severity="success"
                  v-tooltip.top="'Konfirmasi Pengantaran'"
                  :loading="isActionLoading"
                  @click="handleConfirmDelivery(data)"
                />

                <!-- Tombol Reschedule -->
                <Button
                  v-if="data.status === 'waiting_courier_approval' || data.status === 'confirmed'"
                  icon="pi pi-calendar-plus"
                  size="small"
                  severity="warn"
                  outlined
                  v-tooltip.top="'Ajukan Reschedule'"
                  :disabled="isActionLoading"
                  @click="openRescheduleModal(data)"
                />

                <!-- Tombol Detail -->
                <Button
                  icon="pi pi-eye"
                  size="small"
                  severity="secondary"
                  text
                  rounded
                  v-tooltip.top="'Lihat Detail'"
                  @click="openDetailModal(data)"
                />
              </div>
            </template>
          </Column>
        </DataTable>
      </template>
    </Card>

    <!-- =========================================================
         RESCHEDULE DIALOG
         ======================================================= -->
    <Dialog
      v-model:visible="rescheduleDialogVisible"
      modal
      header="Ajukan Reschedule Pengantaran"
      style="width: 32rem"
      :breakpoints="{ '960px': '80vw', '641px': '95vw' }"
    >
      <div v-if="targetDelivery" class="flex flex-column gap-3 pt-2">
        <Message severity="info" :closable="false" class="text-xs">
          Saran perubahan jadwal akan dikirimkan ke pelanggan untuk disetujui.
        </Message>

        <!-- Info Order Saat Ini -->
        <div class="surface-100 p-3 border-round-lg text-xs flex flex-column gap-1">
          <div class="flex justify-content-between">
            <span class="text-500">Nomor Order:</span>
            <span class="font-bold font-mono">#{{ targetDelivery.order_number || targetDelivery.order_id }}</span>
          </div>
          <div class="flex justify-content-between">
            <span class="text-500">Pelanggan:</span>
            <span class="font-semibold">{{ targetDelivery.customer_name || '-' }}</span>
          </div>
          <div class="flex justify-content-between">
            <span class="text-500">Jadwal Lama:</span>
            <span class="text-red-600 font-semibold">{{ targetDelivery.delivery_date }} ({{ targetDelivery.slot_name }})</span>
          </div>
        </div>

        <!-- Pilih Tanggal Baru -->
        <div class="flex flex-column gap-1">
          <label class="text-xs font-semibold text-700">Pilih Tanggal Baru *</label>
          <DatePicker
            v-model="rescheduleDate"
            dateFormat="yy-mm-dd"
            :showIcon="true"
            class="w-full"
          />
        </div>

        <!-- Pilih Slot Jadwal Baru -->
        <div class="flex flex-column gap-1">
          <label class="text-xs font-semibold text-700">Pilih Slot Waktu Baru *</label>
          <Select
            v-model="selectedScheduleId"
            :options="availableSchedules"
            optionLabel="slot_name"
            optionValue="id"
            :loading="isLoadingSchedules"
            placeholder="Pilih Slot Jadwal"
            class="w-full text-sm"
          >
            <template #option="{ option }">
              <div class="flex justify-content-between align-items-center w-full">
                <div>
                  <div class="font-bold text-sm">{{ option.slot_name }}</div>
                  <div class="text-xs text-500 font-mono">{{ option.start_time }} - {{ option.end_time }}</div>
                </div>
                <Tag
                  :severity="option.is_full ? 'danger' : 'success'"
                  :value="option.is_full ? 'Penuh' : `Sisa ${option.available_slots}`"
                  class="text-xs"
                />
              </div>
            </template>
          </Select>
          <span v-if="!isLoadingSchedules && availableSchedules.length === 0" class="text-xs text-red-500">
            Tidak ada slot jadwal yang aktif/tersedia pada tanggal ini.
          </span>
        </div>

        <!-- Alasan Reschedule -->
        <div class="flex flex-column gap-1">
          <label class="text-xs font-semibold text-700">Alasan Reschedule (Opsional)</label>
          <Textarea
            v-model="rescheduleReason"
            rows="3"
            placeholder="Cth: Armada kurir sedang penuh / kendala cuaca buruk..."
            class="w-full text-sm"
          />
        </div>
      </div>

      <template #footer>
        <div class="flex justify-content-end gap-2 pt-2">
          <Button label="Batal" severity="secondary" text @click="rescheduleDialogVisible = false" />
          <Button
            label="Kirim Usulan Jadwal"
            icon="pi pi-send"
            severity="primary"
            :loading="isActionLoading"
            @click="handleSaveReschedule"
          />
        </div>
      </template>
    </Dialog>

    <!-- =========================================================
         DETAIL MODAL
         ======================================================= -->
    <Dialog
      v-model:visible="detailDialogVisible"
      modal
      header="Detail Pengantaran"
      style="width: 34rem"
      :breakpoints="{ '960px': '80vw', '641px': '95vw' }"
    >
      <div v-if="selectedDeliveryDetail" class="flex flex-column gap-3 pt-2 text-sm">
        <!-- Order & Status Header -->
        <div class="surface-100 p-3 border-round-xl flex justify-content-between align-items-center">
          <div>
            <div class="text-xs text-500">Nomor Order</div>
            <div class="font-bold text-lg font-mono text-primary">
              #{{ selectedDeliveryDetail.order_number || selectedDeliveryDetail.order_id }}
            </div>
          </div>
          <Tag
            :severity="STATUS_CONFIG[selectedDeliveryDetail.status]?.severity || 'secondary'"
            :value="STATUS_CONFIG[selectedDeliveryDetail.status]?.label || selectedDeliveryDetail.status"
            :icon="STATUS_CONFIG[selectedDeliveryDetail.status]?.icon"
          />
        </div>

        <!-- Customer & Lokasi -->
        <div class="flex flex-column gap-2">
          <div class="font-bold text-xs text-500 uppercase border-bottom-1 surface-border pb-1">
            Informasi Pelanggan
          </div>
          <div class="grid grid-nogutter gap-2">
            <div class="col-12 flex justify-content-between">
              <span class="text-500">Nama:</span>
              <span class="font-semibold text-900">{{ selectedDeliveryDetail.customer_name || '-' }}</span>
            </div>
            <div class="col-12 flex justify-content-between">
              <span class="text-500">No. Telepon:</span>
              <span class="font-mono text-900">{{ selectedDeliveryDetail.customer_phone || '-' }}</span>
            </div>
            <div class="col-12 flex justify-content-between">
              <span class="text-500">Alamat:</span>
              <span class="text-right text-800 font-medium max-w-20rem">
                {{ selectedDeliveryDetail.address || selectedDeliveryDetail.customer_address || '-' }}
              </span>
            </div>
            <div v-if="selectedDeliveryDetail.notes" class="col-12 flex justify-content-between">
              <span class="text-500">Catatan/Patokan:</span>
              <span class="text-right text-700 italic">{{ selectedDeliveryDetail.notes }}</span>
            </div>
          </div>
        </div>

        <!-- Jadwal & Kurir -->
        <div class="flex flex-column gap-2">
          <div class="font-bold text-xs text-500 uppercase border-bottom-1 surface-border pb-1">
            Jadwal & Pengiriman
          </div>
          <div class="grid grid-nogutter gap-2">
            <div class="col-12 flex justify-content-between">
              <span class="text-500">Tanggal Antar:</span>
              <span class="font-semibold text-900">{{ selectedDeliveryDetail.delivery_date }}</span>
            </div>
            <div class="col-12 flex justify-content-between">
              <span class="text-500">Slot Jadwal:</span>
              <span class="font-semibold text-900">{{ selectedDeliveryDetail.slot_name || '-' }}</span>
            </div>
            <div class="col-12 flex justify-content-between">
              <span class="text-500">Jarak Tempuh:</span>
              <span class="font-mono">{{ selectedDeliveryDetail.distance_km ? `${selectedDeliveryDetail.distance_km.toFixed(1)} km` : '-' }}</span>
            </div>
            <div class="col-12 flex justify-content-between">
              <span class="text-500">Ongkos Kirim:</span>
              <span class="font-bold text-blue-700">{{ formatCurrencyIDR(selectedDeliveryDetail.shipping_cost || 0) }}</span>
            </div>
          </div>
        </div>

        <!-- Tombol Maps -->
        <div v-if="selectedDeliveryDetail.latitude && selectedDeliveryDetail.longitude" class="pt-2">
          <Button
            label="Buka Rute di Google Maps"
            icon="pi pi-external-link"
            severity="info"
            outlined
            class="w-full"
            @click="openGoogleMaps(selectedDeliveryDetail.latitude, selectedDeliveryDetail.longitude)"
          />
        </div>
      </div>
    </Dialog>
  </div>
</template>

<style scoped>
.line-clamp-2 {
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}
</style>
