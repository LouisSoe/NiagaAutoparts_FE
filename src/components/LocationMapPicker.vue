<script setup lang="ts">
import { ref, watch } from 'vue'
import Button from 'primevue/button'
import InputText from 'primevue/inputtext'
import Textarea from 'primevue/textarea'
import Tag from 'primevue/tag'
import ProgressSpinner from 'primevue/progressspinner'
import { formatCurrencyIDR } from '@/utils/format'
import { deliveryService } from '@/services/deliveryService'

const props = defineProps<{
  latitude: number | null
  longitude: number | null
  address: string
  notes?: string
}>()

const emit = defineEmits<{
  (e: 'update:latitude', val: number | null): void
  (e: 'update:longitude', val: number | null): void
  (e: 'update:address', val: string): void
  (e: 'update:notes', val: string): void
  (e: 'updateDistanceAndFee', info: { distanceKm: number; shippingFee: number }): void
}>()

const isLocating = ref(false)
const isEstimating = ref(false)
const geoError = ref<string | null>(null)
const manualLat = ref<string>(props.latitude !== null ? String(props.latitude) : '')
const manualLng = ref<string>(props.longitude !== null ? String(props.longitude) : '')

const distanceKm = ref<number>(0)
const shippingFee = ref<number>(0)

let estimateDebounceTimer: ReturnType<typeof setTimeout> | null = null

const fetchEstimate = async (lat: number, lng: number) => {
  isEstimating.value = true
  try {
    const res = await deliveryService.estimateShippingCost(lat, lng)
    distanceKm.value = res.distance_km
    shippingFee.value = res.shipping_cost
    emit('updateDistanceAndFee', { distanceKm: res.distance_km, shippingFee: res.shipping_cost })
  } catch (err) {
    console.error('[LocationMapPicker] Failed to fetch shipping estimate:', err)
  } finally {
    isEstimating.value = false
  }
}

watch(
  () => [props.latitude, props.longitude] as const,
  ([lat, lng]) => {
    if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
      if (estimateDebounceTimer) clearTimeout(estimateDebounceTimer)
      estimateDebounceTimer = setTimeout(() => {
        fetchEstimate(lat, lng)
      }, 300)
    } else {
      distanceKm.value = 0
      shippingFee.value = 0
      emit('updateDistanceAndFee', { distanceKm: 0, shippingFee: 0 })
    }
  },
  { immediate: true }
)

const handleGetDeviceLocation = () => {
  if (!navigator.geolocation) {
    geoError.value = 'Browser Anda tidak mendukung deteksi lokasi otomatis.'
    return
  }

  isLocating.value = true
  geoError.value = null

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = Math.round(position.coords.latitude * 1000000) / 1000000
      const lng = Math.round(position.coords.longitude * 1000000) / 1000000
      emit('update:latitude', lat)
      emit('update:longitude', lng)
      manualLat.value = String(lat)
      manualLng.value = String(lng)
      isLocating.value = false
    },
    (err) => {
      console.warn('[LocationMapPicker] Geolocation error:', err)
      geoError.value = 'Izin lokasi tidak diberikan atau GPS tidak aktif.'
      isLocating.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

const handleManualCoordChange = () => {
  const latNum = parseFloat(manualLat.value)
  const lngNum = parseFloat(manualLng.value)

  if (!isNaN(latNum) && !isNaN(lngNum)) {
    emit('update:latitude', latNum)
    emit('update:longitude', lngNum)
    geoError.value = null
  }
}

watch(
  () => [props.latitude, props.longitude],
  ([lat, lng]) => {
    if (lat !== null) manualLat.value = String(lat)
    if (lng !== null) manualLng.value = String(lng)
  }
)
</script>

<template>
  <div class="location-map-picker flex flex-column gap-3">
    <!-- Alamat Lengkap Input -->
    <div class="flex flex-column gap-1">
      <label class="text-xs font-semibold text-700 flex align-items-center gap-1">
        <i class="pi pi-map text-primary text-xs" />
        Alamat Lengkap Pengantaran *
      </label>
      <Textarea
        :model-value="address"
        @update:model-value="(val: string) => emit('update:address', val)"
        rows="2"
        placeholder="Jl. Nama Jalan, No. Rumah, RT/RW, Kelurahan, Kecamatan..."
        class="w-full text-sm"
      />
    </div>

    <!-- Catatan Kurir / Patokan -->
    <div class="flex flex-column gap-1">
      <label class="text-xs font-semibold text-700 flex align-items-center gap-1">
        <i class="pi pi-comment text-primary text-xs" />
        Patokan / Catatan Khusus Kurir
      </label>
      <InputText
        :model-value="notes || ''"
        @update:model-value="(val: string) => emit('update:notes', val)"
        placeholder="Cth: Pagar hitam samping warung madura / titip pos satpam"
        class="w-full text-sm"
      />
    </div>

    <!-- Titik Koordinat GPS / Pin Point -->
    <div class="surface-50 border-round-xl p-3 border-1 surface-border flex flex-column gap-2">
      <div class="flex align-items-center justify-content-between flex-wrap gap-2">
        <div class="flex align-items-center gap-1">
          <i class="pi pi-map-marker text-red-500 font-bold" />
          <span class="text-xs font-bold text-900">Titik Koordinat GPS (Pin Point)</span>
        </div>
        <Button
          label="Gunakan Lokasi Saya"
          icon="pi pi-compass"
          size="small"
          outlined
          severity="primary"
          class="text-xs p-1 px-2"
          :loading="isLocating"
          @click="handleGetDeviceLocation"
        />
      </div>

      <!-- Koordinat Box & Error -->
      <div v-if="geoError" class="text-xs text-red-600 bg-red-50 p-2 border-round border-1 border-red-200">
        <i class="pi pi-exclamation-triangle mr-1" />
        {{ geoError }}
      </div>

      <div class="grid grid-nogutter gap-2 mt-1">
        <div class="col flex flex-column gap-1">
          <span class="text-xs text-500">Latitude</span>
          <InputText
            v-model="manualLat"
            placeholder="-6.123456"
            class="w-full text-xs font-mono p-2"
            @blur="handleManualCoordChange"
          />
        </div>
        <div class="col flex flex-column gap-1">
          <span class="text-xs text-500">Longitude</span>
          <InputText
            v-model="manualLng"
            placeholder="106.876543"
            class="w-full text-xs font-mono p-2"
            @blur="handleManualCoordChange"
          />
        </div>
      </div>

      <!-- Preview Map Simulation / Distance Calculation Card -->
      <div
        v-if="latitude !== null && longitude !== null"
        class="mt-2 p-2 bg-blue-50 border-round-lg border-1 border-blue-200 flex align-items-center justify-content-between text-xs"
      >
        <div class="flex align-items-center gap-2">
          <ProgressSpinner v-if="isEstimating" style="width: 20px; height: 20px" strokeWidth="4" />
          <i v-else class="pi pi-send text-blue-600 text-base" />
          <div>
            <div class="font-bold text-blue-900">
              Estimasi Jarak: {{ distanceKm }} km
            </div>
            <div class="text-blue-700 text-xs">
              Gudang Niaga Autoparts &rarr; Alamat Tujuan
            </div>
          </div>
        </div>
        <div class="text-right">
          <div class="text-xs text-600">Ongkir:</div>
          <div class="font-bold text-blue-700 text-sm">
            <span v-if="isEstimating" class="text-xs text-500">Menghitung...</span>
            <span v-else>{{ formatCurrencyIDR(shippingFee) }}</span>
          </div>
        </div>
      </div>
      <div v-else class="text-xs text-500 italic mt-1">
        * Tekan "Gunakan Lokasi Saya" agar kurir dapat menavigasi ke titik Anda dengan akurat.
      </div>
    </div>
  </div>
</template>

<style scoped>
.location-map-picker {
  font-family: inherit;
}
</style>
