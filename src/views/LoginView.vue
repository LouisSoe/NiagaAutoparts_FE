<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import Button from 'primevue/button'
import Card from 'primevue/card'
import Divider from 'primevue/divider'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import { useToast } from 'primevue/usetoast'

import { loginUser, loginAsGuest } from '@/services/authService'

const router = useRouter()
const toast = useToast()

const email = ref('')
const password = ref('')

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

/* =========================================================
 * FLOWCHART LOGIN HANDLER
 * ======================================================= */
const handleLogin = async (): Promise<void> => {
  errorMessage.value = null

  // 1. Decision: Field Terisi?
  if (!email.value.trim() || !password.value.trim()) {
    errorMessage.value = 'Error Field Kosong: Email dan Password wajib diisi.'
    return
  }

  isSubmitting.value = true

  try {
    // 2. Kirim ke Server & Decision: Kredensial Valid?
    const session = await loginUser({
      email: email.value.trim(),
      password: password.value.trim(),
    })

    toast.add({
      severity: 'success',
      summary: 'Login Berhasil',
      detail: `Selamat datang kembali, ${session.name}!`,
      life: 3000,
    })

    // 3. Masuk Dashboard / Catalog / Order berdasarkan Role
    const role = (session.role || '').toLowerCase()
    if (role === 'customer') {
      router.push('/')
    } else if (role === 'cashier') {
      router.push('/orders')
    } else {
      router.push('/admin')
    }
  } catch (err) {
    // Error Login Gagal
    errorMessage.value = err instanceof Error ? err.message : 'Error Login Gagal. Periksa kembali kredensial Anda.'
  } finally {
    isSubmitting.value = false
  }
}

/* =========================================================
 * FLOWCHART GUEST ACCESS HANDLER (Tanpa Registrasi)
 * ======================================================= */
const handleGuestAccess = (): void => {
  loginAsGuest()
  toast.add({
    severity: 'info',
    summary: 'Akses Tamu',
    detail: 'Anda masuk sebagai Tamu. Selamat menjelajah katalog!',
    life: 3000,
  })
  router.push('/')
}
</script>

<template>
  <div class="min-h-screen surface-ground flex align-items-center justify-content-center p-4 font-sans">
    <Card class="w-full max-w-28rem shadow-4 border-round-3xl surface-card">
      <template #title>
        <div class="text-center flex flex-column align-items-center gap-2 pt-2">
          <div
            class="bg-blue-50 border-circle flex align-items-center justify-content-center p-3 text-blue-600 mb-1"
            style="width: 3.5rem; height: 3.5rem"
          >
            <i class="pi pi-car text-3xl" />
          </div>
          <h1 class="text-2xl font-extrabold text-900 m-0 tracking-tight">AutoParts Niaga</h1>
          <span class="text-color-secondary text-sm font-normal">Silakan login untuk mengakses akun Anda</span>
        </div>
      </template>

      <template #content>
        <div class="flex flex-column gap-4 mt-2">
          <!-- Error Alert Message -->
          <Message v-if="errorMessage" severity="error" :closable="false" class="m-0">
            {{ errorMessage }}
          </Message>

          <!-- Login Form -->
          <form class="flex flex-column gap-4" @submit.prevent="handleLogin">
            <!-- Input Email -->
            <div class="flex flex-column gap-2">
              <label class="font-semibold text-xs text-700 uppercase tracking-wider">Email</label>
              <IconField class="w-full">
                <InputIcon class="pi pi-envelope text-400" />
                <InputText
                  v-model="email"
                  type="email"
                  placeholder="nama@email.com"
                  class="w-full text-sm"
                  :invalid="!!errorMessage && !email.trim()"
                />
              </IconField>
            </div>

            <!-- Input Password -->
            <div class="flex flex-column gap-2">
              <label class="font-semibold text-xs text-700 uppercase tracking-wider">Password</label>
              <IconField class="w-full">
                <InputIcon class="pi pi-lock text-400 z-2" />
                <Password
                  v-model="password"
                  placeholder="Masukkan password"
                  :feedback="false"
                  toggleMask
                  class="w-full"
                  inputClass="w-full text-sm pl-6"
                  :invalid="!!errorMessage && !password.trim()"
                />
              </IconField>
            </div>

            <!-- Submit Login Button -->
            <Button
              type="submit"
              label="Masuk (Login)"
              icon="pi pi-sign-in"
              :loading="isSubmitting"
              class="w-full font-bold mt-1"
              severity="primary"
              title="Masuk ke Akun Anda"
            />
          </form>

          <Divider align="center" class="my-1">
            <span class="text-xs text-color-secondary uppercase tracking-wider">atau</span>
          </Divider>

          <!-- Guest Access (Tanpa Registrasi) -->
          <Button
            label="Akses Sebagai Tamu (Guest)"
            icon="pi pi-user"
            severity="secondary"
            outlined
            class="w-full font-semibold"
            title="Masuk langsung tanpa registrasi akun"
            @click="handleGuestAccess"
          />
        </div>
      </template>

      <template #footer>
        <div class="text-center text-sm text-color-secondary pb-2">
          Belum memiliki akun?
          <router-link to="/register" class="text-blue-600 font-bold hover:underline">
            Daftar Sekarang
          </router-link>
        </div>
      </template>
    </Card>
  </div>
</template>
