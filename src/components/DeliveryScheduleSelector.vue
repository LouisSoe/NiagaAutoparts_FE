<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import Message from 'primevue/message'
import { deliveryService } from '@/services/deliveryService'
import type { DeliverySchedule } from '@/types/delivery'

const props = defineProps<{
  selectedDate: string
  selectedScheduleId: number | null
}>()

const emit = defineEmits<{
  (e: 'update:selectedDate', date: string): void
  (e: 'update:selectedScheduleId', scheduleId: number | null): void
  (e: 'selectSchedule', schedule: DeliverySchedule | null): void
}>()

const isLoadingSchedules = ref(false)
const schedules = ref<DeliverySchedule[]>([])
const fetchError = ref<string | null>(null)

// Calculate minimum selectable date (today formatted as YYYY-MM-DD)
const getTodayString = (): string => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const minDate = getTodayString()

const fetchSchedulesForDate = async (dateStr: string) => {
  if (!dateStr) return
  isLoadingSchedules.value = true
  fetchError.value = null

  try {
    const data = await deliveryService.getAvailableSchedules(dateStr)
    schedules.value = data

    // If currently selected schedule is no longer valid or full, reset or re-evaluate
    if (props.selectedScheduleId) {
      const match = data.find((s) => s.id === props.selectedScheduleId)
      if (!match || match.is_full || match.available_slots <= 0) {
        emit('update:selectedScheduleId', null)
        emit('selectSchedule', null)
      } else {
        emit('selectSchedule', match)
      }
    }
  } catch (err: any) {
    console.error('[DeliveryScheduleSelector] Failed to fetch schedules:', err)
    fetchError.value = err.message || 'Gagal memuat jadwal pengantaran untuk tanggal ini.'
    schedules.value = []
  } finally {
    isLoadingSchedules.value = false
  }
}

const handleDateChange = (e: Event) => {
  const target = e.target as HTMLInputElement
  const newDate = target.value
  emit('update:selectedDate', newDate)
  fetchSchedulesForDate(newDate)
}

const handleSelectSlot = (schedule: DeliverySchedule) => {
  if (schedule.is_full || schedule.available_slots <= 0) return
  emit('update:selectedScheduleId', schedule.id)
  emit('selectSchedule', schedule)
}

watch(
  () => props.selectedDate,
  (newVal) => {
    if (newVal) {
      fetchSchedulesForDate(newVal)
    }
  },
  { immediate: true }
)
</script>

<template>
  <div class="delivery-schedule-selector flex flex-column gap-3">
    <!-- Date Picker Input -->
    <div class="flex flex-column gap-1">
      <label class="text-xs font-semibold text-700 flex align-items-center gap-1">
        <i class="pi pi-calendar text-primary text-xs" />
        Pilih Tanggal Pengantaran *
      </label>
      <input
        type="date"
        :min="minDate"
        :value="selectedDate"
        @change="handleDateChange"
        class="w-full p-2 border-1 surface-border border-round-lg text-sm bg-surface-50 focus:border-primary outline-none transition-colors"
        style="font-family: inherit; cursor: pointer;"
      />
    </div>

    <!-- Time Slots Section -->
    <div class="flex flex-column gap-2">
      <div class="flex align-items-center justify-content-between">
        <label class="text-xs font-semibold text-700 flex align-items-center gap-1">
          <i class="pi pi-clock text-primary text-xs" />
          Pilih Slot Waktu Pengantaran *
        </label>
        <span v-if="!isLoadingSchedules && schedules.length" class="text-xs text-500">
          {{ schedules.length }} slot tersedia
        </span>
      </div>

      <!-- Loading State -->
      <div v-if="isLoadingSchedules" class="flex align-items-center justify-content-center py-4 surface-50 border-round-xl border-1 surface-border">
        <div class="flex align-items-center gap-2 text-sm text-500">
          <ProgressSpinner style="width: 20px; height: 20px" strokeWidth="4" />
          <span>Memeriksa ketersediaan kuota slot...</span>
        </div>
      </div>

      <!-- Error State -->
      <Message v-else-if="fetchError" severity="error" :closable="false" class="text-xs m-0">
        {{ fetchError }}
      </Message>

      <!-- Empty State -->
      <div
        v-else-if="!schedules.length"
        class="text-center py-4 px-3 surface-50 border-round-xl border-1 surface-border text-500 text-xs flex flex-column align-items-center gap-2"
      >
        <i class="pi pi-calendar-times text-2xl text-400" />
        <span>Tidak ada slot pengantaran yang tersedia pada tanggal ini. Silakan pilih tanggal lain.</span>
      </div>

      <!-- Slots Grid: Maksimal 2 item per row -->
      <div v-else class="grid">
        <div
          v-for="schedule in schedules"
          :key="schedule.id"
          class="col-12 sm:col-6 flex"
        >
          <div
            @click="handleSelectSlot(schedule)"
            class="slot-card p-3 border-round-xl border-1 transition-all flex flex-column justify-content-between gap-3 w-full h-full"
            :class="[
              schedule.is_full || schedule.available_slots <= 0
                ? 'slot-card-full opacity-60 bg-gray-100 border-gray-200 cursor-not-allowed'
                : selectedScheduleId === schedule.id
                ? 'slot-card-selected border-blue-600 bg-blue-50 shadow-2 cursor-pointer'
                : 'surface-card border-surface-200 hover:border-blue-300 hover:surface-50 cursor-pointer shadow-1'
            ]"
          >
            <div class="flex align-items-start justify-content-between gap-2">
              <span class="font-bold text-sm line-height-2" :class="selectedScheduleId === schedule.id ? 'text-blue-900' : 'text-900'">
                {{ schedule.slot_name }}
              </span>
              <Tag
                v-if="schedule.is_full || schedule.available_slots <= 0"
                value="KUOTA PENUH"
                severity="danger"
                class="text-xs flex-shrink-0"
                style="font-size: 0.65rem; padding: 0.15rem 0.4rem"
              />
              <Tag
                v-else-if="selectedScheduleId === schedule.id"
                value="DIPILIH"
                severity="success"
                class="text-xs flex-shrink-0"
                style="font-size: 0.65rem; padding: 0.15rem 0.4rem"
              />
              <Tag
                v-else
                :value="`Sisa ${schedule.available_slots} Slot`"
                :severity="schedule.available_slots <= 2 ? 'warn' : 'info'"
                class="text-xs flex-shrink-0"
                style="font-size: 0.65rem; padding: 0.15rem 0.4rem"
              />
            </div>

            <div class="flex align-items-center justify-content-between text-xs text-600 border-top-1 surface-border pt-2 mt-auto">
              <span class="flex align-items-center gap-1 font-mono">
                <i class="pi pi-hourglass text-xs" />
                {{ (schedule.start_time || '').slice(0, 5) }} - {{ (schedule.end_time || '').slice(0, 5) }}
              </span>
              <span class="text-500 text-xs">
                Kapasitas: {{ schedule.booked_count ?? 0 }}/{{ schedule.max_capacity }}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.slot-card {
  min-height: 5.5rem;
}
.slot-card-selected {
  outline: 2px solid var(--p-primary-color, #2563eb);
}
</style>
