<script setup lang="ts">
import { ref } from 'vue'
import Dialog from 'primevue/dialog'
import Button from 'primevue/button'
import Tag from 'primevue/tag'
import { deliveryService } from '@/services/deliveryService'
import type { DeliveryDetails } from '@/types/delivery'

const props = defineProps<{
  visible: boolean
  delivery: DeliveryDetails | null
}>()

const emit = defineEmits<{
  (e: 'update:visible', val: boolean): void
  (e: 'accepted', updatedDelivery: DeliveryDetails): void
}>()

const isAccepting = ref(false)

const handleAccept = async () => {
  if (!props.delivery?.id) return
  isAccepting.value = true
  try {
    const updated = await deliveryService.acceptReschedule(props.delivery.id)
    emit('accepted', updated)
    emit('update:visible', false)
  } catch (err) {
    console.error('Failed to accept reschedule:', err)
  } finally {
    isAccepting.value = false
  }
}
</script>

<template>
  <Dialog
    :visible="visible"
    @update:visible="(val: boolean) => emit('update:visible', val)"
    modal
    header="Tawaran Perubahan Jadwal Pengantaran"
    style="width: 28rem"
    :breakpoints="{ '960px': '75vw', '641px': '90vw' }"
  >
    <div class="flex flex-column gap-3 pt-2 text-sm">
      <div class="p-3 bg-orange-50 border-1 border-orange-200 border-round-xl flex align-items-start gap-3">
        <i class="pi pi-exclamation-triangle text-orange-600 text-2xl mt-1" />
        <div>
          <div class="font-bold text-orange-900">Kurir Menyarankan Jadwal Baru</div>
          <div class="text-xs text-orange-800 mt-1">
            Slot sebelumnya berhalangan. Kurir telah mengajukan waktu pengantaran alternatif untuk pesanan Anda.
          </div>
        </div>
      </div>

      <div v-if="delivery?.rejection_reason" class="flex flex-column gap-1">
        <span class="text-xs text-500 font-semibold">Alasan / Catatan Kurir:</span>
        <div class="p-2 surface-100 border-round text-xs italic text-700">
          "{{ delivery.rejection_reason }}"
        </div>
      </div>

      <div class="surface-50 border-round-xl p-3 border-1 surface-border flex flex-column gap-2">
        <div class="flex justify-content-between text-xs">
          <span class="text-500">Jadwal Baru yang Diajukan:</span>
          <Tag severity="warn" value="Saran Baru" />
        </div>
        <div class="font-bold text-base text-900">
          📅 {{ delivery?.suggested_date || '-' }}
        </div>
      </div>

      <div class="flex justify-content-end gap-2 mt-2">
        <Button
          label="Nanti Saja"
          severity="secondary"
          text
          @click="emit('update:visible', false)"
        />
        <Button
          label="Terima Jadwal Baru"
          icon="pi pi-check"
          severity="success"
          :loading="isAccepting"
          @click="handleAccept"
        />
      </div>
    </div>
  </Dialog>
</template>
