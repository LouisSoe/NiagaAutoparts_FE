<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import ConfirmDialog from 'primevue/confirmdialog'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputNumber from 'primevue/inputnumber'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import ToggleSwitch from 'primevue/toggleswitch'
import Toolbar from 'primevue/toolbar'

import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

import type { DeliverySchedule } from '@/types/delivery'
import { deliveryService } from '@/services/deliveryService'
import { deliveryScheduleSchema, validateForm as zodValidateForm } from '@/utils/validation'

/* =========================================================
 * SERVICES
 * ======================================================= */

const confirm = useConfirm()
const toast = useToast()

/* =========================================================
 * CONSTANTS & OPTIONS
 * ======================================================= */

const DAY_OPTIONS = [
  { label: 'Senin (Monday)', value: 'monday' },
  { label: 'Selasa (Tuesday)', value: 'tuesday' },
  { label: 'Rabu (Wednesday)', value: 'wednesday' },
  { label: 'Kamis (Thursday)', value: 'thursday' },
  { label: 'Jumat (Friday)', value: 'friday' },
  { label: 'Sabtu (Saturday)', value: 'saturday' },
  { label: 'Minggu (Sunday)', value: 'sunday' },
]

const DAY_FILTER_OPTIONS = [
  { label: 'Semua Hari', value: '' },
  ...DAY_OPTIONS,
]

const ACTIVE_FILTER_OPTIONS = [
  { label: 'Semua Status', value: '' },
  { label: 'Hanya Aktif', value: 'true' },
  { label: 'Hanya Nonaktif', value: 'false' },
]

const DAY_LABELS: Record<string, string> = {
  monday: 'Senin',
  tuesday: 'Selasa',
  wednesday: 'Rabu',
  thursday: 'Kamis',
  friday: 'Jumat',
  saturday: 'Sabtu',
  sunday: 'Minggu',
}

/* =========================================================
 * TYPES & STATE
 * ======================================================= */

interface ScheduleForm {
  id: number | null
  day_of_week: string
  slot_name: string
  start_time: string
  end_time: string
  max_capacity: number
  is_active: boolean
}

const schedules = ref<DeliverySchedule[]>([])
const isLoading = ref<boolean>(false)
const isSaving = ref<boolean>(false)

// Filters
const filterDay = ref<string>('')
const filterActive = ref<string>('')
const searchKeyword = ref<string>('')

// Dialog state
const dialogVisible = ref<boolean>(false)
const editMode = ref<boolean>(false)
const submitted = ref<boolean>(false)
const errors = ref<Record<string, string>>({})

const form = reactive<ScheduleForm>({
  id: null,
  day_of_week: 'monday',
  slot_name: '',
  start_time: '09:00',
  end_time: '12:00',
  max_capacity: 10,
  is_active: true,
})

/* =========================================================
 * FETCH DATA
 * ======================================================= */

const loadSchedules = async (): Promise<void> => {
  isLoading.value = true
  try {
    const params: { day_of_week?: string; is_active?: string } = {}
    if (filterDay.value) params.day_of_week = filterDay.value
    if (filterActive.value !== '') params.is_active = filterActive.value

    const data = await deliveryService.getDeliverySchedules(params)
    schedules.value = data
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Gagal memuat jadwal',
      detail: err?.message || 'Terjadi kesalahan saat memuat data jadwal delivery.',
      life: 4000,
    })
  } finally {
    isLoading.value = false
  }
}

watch([filterDay, filterActive], () => {
  loadSchedules()
})

onMounted(() => {
  loadSchedules()
})

/* =========================================================
 * COMPUTED
 * ======================================================= */

const filteredSchedules = computed<DeliverySchedule[]>(() => {
  const kw = searchKeyword.value.trim().toLowerCase()
  if (!kw) return schedules.value

  return schedules.value.filter((s) => {
    const dayName = (DAY_LABELS[s.day_of_week?.toLowerCase()] || s.day_of_week || '').toLowerCase()
    const slot = (s.slot_name || '').toLowerCase()
    const time = `${s.start_time} - ${s.end_time}`.toLowerCase()
    return dayName.includes(kw) || slot.includes(kw) || time.includes(kw)
  })
})

const dialogTitle = computed<string>(() => {
  return editMode.value ? 'Edit Jadwal Delivery' : 'Tambah Jadwal Delivery'
})

/* =========================================================
 * HELPERS
 * ======================================================= */

const formatDay = (day: string): string => {
  if (!day) return '-'
  return DAY_LABELS[day.toLowerCase()] || day
}

const getDaySeverity = (day: string): string => {
  switch (day?.toLowerCase()) {
    case 'monday':
    case 'tuesday':
      return 'info'
    case 'wednesday':
    case 'thursday':
      return 'primary'
    case 'friday':
      return 'warn'
    case 'saturday':
    case 'sunday':
      return 'contrast'
    default:
      return 'secondary'
  }
}

const resetForm = (): void => {
  form.id = null
  form.day_of_week = 'monday'
  form.slot_name = ''
  form.start_time = '09:00'
  form.end_time = '12:00'
  form.max_capacity = 10
  form.is_active = true
  submitted.value = false
  errors.value = {}
}

/* =========================================================
 * DIALOG ACTIONS
 * ======================================================= */

const openCreateDialog = (): void => {
  resetForm()
  editMode.value = false
  dialogVisible.value = true
}

const openEditDialog = (schedule: DeliverySchedule): void => {
  resetForm()
  editMode.value = true
  form.id = schedule.id
  form.day_of_week = schedule.day_of_week ? schedule.day_of_week.toLowerCase() : 'monday'
  form.slot_name = schedule.slot_name || ''
  form.start_time = (schedule.start_time || '09:00').slice(0, 5)
  form.end_time = (schedule.end_time || '12:00').slice(0, 5)
  form.max_capacity = schedule.max_capacity ?? 10
  form.is_active = schedule.is_active ?? true
  dialogVisible.value = true
}

const closeDialog = (): void => {
  dialogVisible.value = false
  resetForm()
}

/* =========================================================
 * FORM VALIDATION & SAVE
 * ======================================================= */

const validateScheduleForm = (): boolean => {
  submitted.value = true
  const res = zodValidateForm(deliveryScheduleSchema, {
    day_of_week: form.day_of_week,
    slot_name: form.slot_name.trim(),
    start_time: form.start_time.trim(),
    end_time: form.end_time.trim(),
    max_capacity: form.max_capacity,
    is_active: form.is_active,
  })
  errors.value = res.errors
  return res.success
}

const saveSchedule = async (): Promise<void> => {
  if (!validateScheduleForm()) return

  isSaving.value = true
  try {
    if (editMode.value && form.id !== null) {
      await deliveryService.updateDeliverySchedule(form.id, {
        day_of_week: form.day_of_week,
        slot_name: form.slot_name.trim(),
        start_time: form.start_time.trim(),
        end_time: form.end_time.trim(),
        max_capacity: form.max_capacity,
        is_active: form.is_active,
      })
      toast.add({
        severity: 'success',
        summary: 'Berhasil',
        detail: 'Jadwal delivery berhasil diperbarui.',
        life: 3000,
      })
    } else {
      await deliveryService.createDeliverySchedule({
        day_of_week: form.day_of_week,
        slot_name: form.slot_name.trim(),
        start_time: form.start_time.trim(),
        end_time: form.end_time.trim(),
        max_capacity: form.max_capacity,
        is_active: form.is_active,
      })
      toast.add({
        severity: 'success',
        summary: 'Berhasil',
        detail: 'Jadwal delivery berhasil ditambahkan.',
        life: 3000,
      })
    }
    dialogVisible.value = false
    resetForm()
    await loadSchedules()
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Gagal Menyimpan',
      detail: err?.message || 'Terjadi kesalahan saat menyimpan jadwal.',
      life: 4000,
    })
  } finally {
    isSaving.value = false
  }
}

/* =========================================================
 * QUICK TOGGLE STATUS
 * ======================================================= */

const toggleActiveStatus = async (schedule: DeliverySchedule): Promise<void> => {
  const newStatus = !(schedule.is_active ?? true)
  try {
    await deliveryService.updateDeliverySchedule(schedule.id, {
      is_active: newStatus,
    })
    schedule.is_active = newStatus
    toast.add({
      severity: 'info',
      summary: 'Status Diperbarui',
      detail: `Jadwal "${schedule.slot_name}" kini ${newStatus ? 'aktif' : 'nonaktif'}.`,
      life: 2500,
    })
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Gagal Mengubah Status',
      detail: err?.message || 'Terjadi kesalahan.',
      life: 4000,
    })
  }
}

/* =========================================================
 * DELETE CONFIRMATION
 * ======================================================= */

const confirmDeleteSchedule = (schedule: DeliverySchedule): void => {
  confirm.require({
    header: 'Hapus Jadwal Delivery',
    message: `Apakah Anda yakin ingin menghapus jadwal "${schedule.slot_name}" (${formatDay(schedule.day_of_week)}: ${schedule.start_time} - ${schedule.end_time})?`,
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
        await deliveryService.deleteDeliverySchedule(schedule.id)
        toast.add({
          severity: 'success',
          summary: 'Berhasil',
          detail: 'Jadwal delivery berhasil dihapus.',
          life: 3000,
        })
        await loadSchedules()
      } catch (err: any) {
        toast.add({
          severity: 'error',
          summary: 'Gagal Menghapus',
          detail: err?.message || 'Terjadi kesalahan saat menghapus jadwal.',
          life: 4000,
        })
      }
    },
  })
}
</script>

<template>
  <div class="p-3 md:p-4 surface-ground min-h-screen">
    <Toast />
    <ConfirmDialog />

    <!-- =====================================================
         PAGE HEADER
    ====================================================== -->
    <div class="mb-4">
      <h1 class="text-2xl font-bold text-900 m-0">Master Jadwal Delivery</h1>
      <p class="text-sm text-500 mt-2 mb-0">
        Kelola slot waktu pengantaran, kapasitas harian, dan status aktif jadwal delivery kurir.
      </p>
    </div>

    <!-- =====================================================
         CONTENT CARD
    ====================================================== -->
    <Card>
      <template #content>
        <!-- TOOLBAR -->
        <Toolbar class="mb-4">
          <template #start>
            <div class="flex align-items-center gap-2">
              <Avatar icon="pi pi-calendar-clock" shape="square" class="bg-blue-50 text-blue-600" />
              <div>
                <div class="font-semibold text-900">Daftar Jadwal Delivery</div>
                <div class="text-xs text-500 mt-1">{{ filteredSchedules.length }} jadwal ditemukan</div>
              </div>
            </div>
          </template>

          <template #end>
            <div class="flex items-center gap-2">
              <Button
                icon="pi pi-refresh"
                severity="secondary"
                outlined
                rounded
                aria-label="Refresh data"
                title="Refresh data"
                :loading="isLoading"
                @click="loadSchedules"
              />
              <Button
                label="Tambah Jadwal"
                icon="pi pi-plus"
                @click="openCreateDialog"
              />
            </div>
          </template>
        </Toolbar>

        <!-- FILTERS -->
        <div class="flex flex-column md:flex-row md:align-items-center gap-3 mb-4">
          <!-- SEARCH -->
          <IconField class="w-full md:w-20rem">
            <InputIcon class="pi pi-search" />
            <InputText v-model="searchKeyword" placeholder="Cari nama slot atau jam..." class="w-full" />
          </IconField>

          <!-- DAY FILTER -->
          <div class="w-full md:w-16rem">
            <Select
              v-model="filterDay"
              :options="DAY_FILTER_OPTIONS"
              optionLabel="label"
              optionValue="value"
              placeholder="Filter Hari"
              class="w-full"
            />
          </div>

          <!-- STATUS FILTER -->
          <div class="w-full md:w-14rem">
            <Select
              v-model="filterActive"
              :options="ACTIVE_FILTER_OPTIONS"
              optionLabel="label"
              optionValue="value"
              placeholder="Filter Status"
              class="w-full"
            />
          </div>
        </div>

        <!-- DATA TABLE -->
        <DataTable
          :value="filteredSchedules"
          data-key="id"
          paginator
          :rows="10"
          :rows-per-page-options="[10, 20, 50]"
          :loading="isLoading"
          striped-rows
          row-hover
          responsive-layout="scroll"
          class="w-full"
        >
          <!-- HARI -->
          <Column field="day_of_week" header="HARI" sortable style="min-width: 9rem">
            <template #body="{ data }">
              <Tag
                :value="formatDay(data.day_of_week)"
                :severity="getDaySeverity(data.day_of_week)"
                class="font-semibold px-2 py-1"
              />
            </template>
          </Column>

          <!-- NAMA SLOT -->
          <Column field="slot_name" header="NAMA SLOT" sortable style="min-width: 14rem">
            <template #body="{ data }">
              <div class="flex align-items-center gap-2">
                <Avatar icon="pi pi-clock" shape="square" class="bg-blue-50 text-blue-600 flex-shrink-0" />
                <div>
                  <div class="font-semibold text-900">{{ data.slot_name }}</div>
                  <div class="text-xs text-500">ID: #{{ data.id }}</div>
                </div>
              </div>
            </template>
          </Column>

          <!-- WAKTU -->
          <Column header="WAKTU PENGANTARAN" style="min-width: 12rem">
            <template #body="{ data }">
              <div class="flex align-items-center gap-1 font-mono text-sm text-800">
                <i class="pi pi-hourglass text-xs text-500" />
                <span>{{ (data.start_time || '').slice(0, 5) }} - {{ (data.end_time || '').slice(0, 5) }}</span>
              </div>
            </template>
          </Column>

          <!-- KAPASITAS -->
          <Column field="max_capacity" header="KAPASITAS MAKSIMAL" sortable style="min-width: 11rem">
            <template #body="{ data }">
              <div class="flex align-items-center gap-2">
                <Tag
                  :value="`${data.max_capacity ?? 0} Pengiriman`"
                  severity="secondary"
                  class="font-bold"
                />
              </div>
            </template>
          </Column>

          <!-- STATUS AKTIF -->
          <Column header="STATUS" style="min-width: 8rem">
            <template #body="{ data }">
              <div class="flex align-items-center gap-2">
                <ToggleSwitch
                  :model-value="data.is_active ?? true"
                  @update:model-value="toggleActiveStatus(data)"
                />
                <span class="text-xs" :class="(data.is_active ?? true) ? 'text-green-600 font-semibold' : 'text-500'">
                  {{ (data.is_active ?? true) ? 'Aktif' : 'Nonaktif' }}
                </span>
              </div>
            </template>
          </Column>

          <!-- AKSI -->
          <Column header="AKSI" style="width: 8rem">
            <template #body="{ data }">
              <div class="flex align-items-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  text
                  rounded
                  aria-label="Edit jadwal"
                  title="Edit Jadwal"
                  @click="openEditDialog(data)"
                />
                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  aria-label="Hapus jadwal"
                  title="Hapus Jadwal"
                  @click="confirmDeleteSchedule(data)"
                />
              </div>
            </template>
          </Column>

          <!-- EMPTY -->
          <template #empty>
            <div class="flex flex-column align-items-center justify-content-center gap-3 py-6">
              <Avatar
                icon="pi pi-calendar-times"
                shape="circle"
                size="xlarge"
                class="bg-gray-100 text-gray-500"
              />
              <div class="text-center">
                <div class="font-semibold text-900">Jadwal Delivery Tidak Ditemukan</div>
                <div class="text-sm text-500 mt-1">Coba sesuaikan filter pencarian atau buat jadwal baru.</div>
              </div>
            </div>
          </template>
        </DataTable>
      </template>
    </Card>

    <!-- =====================================================
         SCHEDULE FORM DIALOG
    ====================================================== -->
    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="dialogTitle"
      class="w-full md:w-30rem"
      :closable="true"
      :draggable="false"
      @hide="resetForm"
    >
      <div class="flex flex-column gap-4 pt-2">
        <!-- HARI -->
        <div class="flex flex-column gap-2">
          <label for="schedule-day" class="text-sm font-medium text-900">
            Hari Pengantaran <span class="text-red-500">*</span>
          </label>
          <Select
            id="schedule-day"
            v-model="form.day_of_week"
            :options="DAY_OPTIONS"
            optionLabel="label"
            optionValue="value"
            placeholder="Pilih Hari"
            class="w-full"
            :invalid="submitted && !!errors.day_of_week"
          />
          <Message v-if="submitted && errors.day_of_week" severity="error" variant="simple" size="small">
            {{ errors.day_of_week }}
          </Message>
        </div>

        <!-- SLOT NAME -->
        <div class="flex flex-column gap-2">
          <label for="schedule-slot-name" class="text-sm font-medium text-900">
            Nama Slot Waktu <span class="text-red-500">*</span>
          </label>
          <InputText
            id="schedule-slot-name"
            v-model="form.slot_name"
            placeholder="Contoh: Slot Pagi (09:00 - 12:00)"
            class="w-full"
            :invalid="submitted && !!errors.slot_name"
          />
          <Message v-if="submitted && errors.slot_name" severity="error" variant="simple" size="small">
            {{ errors.slot_name }}
          </Message>
        </div>

        <!-- START TIME & END TIME -->
        <div class="grid">
          <div class="col-6 flex flex-column gap-2">
            <label for="schedule-start-time" class="text-sm font-medium text-900">
              Jam Mulai (HH:MM) <span class="text-red-500">*</span>
            </label>
            <InputText
              id="schedule-start-time"
              v-model="form.start_time"
              placeholder="09:00"
              class="w-full"
              :invalid="submitted && !!errors.start_time"
            />
            <Message v-if="submitted && errors.start_time" severity="error" variant="simple" size="small">
              {{ errors.start_time }}
            </Message>
          </div>

          <div class="col-6 flex flex-column gap-2">
            <label for="schedule-end-time" class="text-sm font-medium text-900">
              Jam Selesai (HH:MM) <span class="text-red-500">*</span>
            </label>
            <InputText
              id="schedule-end-time"
              v-model="form.end_time"
              placeholder="12:00"
              class="w-full"
              :invalid="submitted && !!errors.end_time"
            />
            <Message v-if="submitted && errors.end_time" severity="error" variant="simple" size="small">
              {{ errors.end_time }}
            </Message>
          </div>
        </div>

        <!-- MAX CAPACITY -->
        <div class="flex flex-column gap-2">
          <label for="schedule-capacity" class="text-sm font-medium text-900">
            Kapasitas Maksimal (Slot Order) <span class="text-red-500">*</span>
          </label>
          <InputNumber
            id="schedule-capacity"
            v-model="form.max_capacity"
            :min="1"
            :max="1000"
            showButtons
            class="w-full"
            :invalid="submitted && !!errors.max_capacity"
          />
          <Message v-if="submitted && errors.max_capacity" severity="error" variant="simple" size="small">
            {{ errors.max_capacity }}
          </Message>
        </div>

        <!-- IS ACTIVE -->
        <div class="flex align-items-center justify-content-between p-3 surface-50 border-round-lg border-1 surface-border">
          <div>
            <div class="text-sm font-medium text-900">Status Aktif</div>
            <div class="text-xs text-500">Jadwal aktif dapat dipilih oleh pelanggan saat checkout.</div>
          </div>
          <ToggleSwitch v-model="form.is_active" />
        </div>
      </div>

      <!-- FOOTER -->
      <template #footer>
        <Button label="Batal" severity="secondary" outlined @click="closeDialog" :disabled="isSaving" />
        <Button
          :label="editMode ? 'Simpan Perubahan' : 'Tambah Jadwal'"
          :icon="editMode ? 'pi pi-check' : 'pi pi-plus'"
          :loading="isSaving"
          @click="saveSchedule"
        />
      </template>
    </Dialog>
  </div>
</template>
