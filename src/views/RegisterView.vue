<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'

import Button from 'primevue/button'
import Card from 'primevue/card'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import { useToast } from 'primevue/usetoast'

import { registerUser } from '@/services/authService'

const router = useRouter()
const toast = useToast()

const username = ref('')
const name = ref('')
const email = ref('')
const phone = ref('')
const password = ref('')

const isSubmitting = ref(false)
const errorMessage = ref<string | null>(null)

/* =========================================================
 * FLOWCHART REGISTER HANDLER
 * ======================================================= */
const handleRegister = async (): Promise<void> => {
  errorMessage.value = null

  // 1. Decision: Semua Field Valid?
  if (
    !username.value.trim() ||
    !name.value.trim() ||
    !email.value.trim() ||
    !phone.value.trim() ||
    !password.value.trim()
  ) {
    errorMessage.value = 'Error: Data Tidak Valid. Semua field wajib diisi.'
    return
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!emailRegex.test(email.value.trim())) {
    errorMessage.value = 'Error: Format email tidak valid.'
    return
  }

  if (password.value.length < 6) {
    errorMessage.value = 'Error: Password minimal harus 6 karakter.'
    return
  }

  isSubmitting.value = true

  try {
    // 2. Cek Email & Process Registration / Patch User (Kirim ke Server)
    await registerUser({
      username: username.value.trim(),
      name: name.value.trim(),
      email: email.value.trim(),
      phone: phone.value.trim(),
      password: password.value.trim(),
    })

    // 3. Kirim Notifikasi & Redirect Login
    toast.add({
      severity: 'success',
      summary: 'Registrasi Berhasil',
      detail: 'Akun Anda berhasil dibuat. Silakan login!',
      life: 4000,
    })

    router.push('/login')
  } catch (err) {
    // Reject: Email Sudah Terdaftar / Data Error
    errorMessage.value = err instanceof Error ? err.message : 'Error: Registrasi gagal.'
  } finally {
    isSubmitting.value = false
  }
}
</script>

<template>
  <div class="min-h-screen surface-ground flex align-items-center justify-content-center p-4 font-sans py-8">
    <Card class="w-full max-w-30rem shadow-4 border-round-3xl surface-card">
      <template #title>
        <div class="text-center flex flex-column align-items-center gap-2 pt-2">
          <div
            class="bg-blue-50 border-circle flex align-items-center justify-content-center p-3 text-blue-600 mb-1"
            style="width: 3.5rem; height: 3.5rem"
          >
            <i class="pi pi-user-plus text-2xl" />
          </div>
          <h1 class="text-2xl font-extrabold text-900 m-0 tracking-tight">Buat Akun Baru</h1>
          <span class="text-color-secondary text-sm font-normal">Lengkapi data diri Anda untuk mendaftar</span>
        </div>
      </template>

      <template #content>
        <div class="flex flex-column gap-3 mt-2">
          <!-- Error Alert Message -->
          <Message v-if="errorMessage" severity="error" :closable="false" class="m-0">
            {{ errorMessage }}
          </Message>

          <!-- Form Register -->
          <form class="flex flex-column gap-3" @submit.prevent="handleRegister">
            <!-- Input Username -->
            <div class="flex flex-column gap-1.5">
              <label class="font-semibold text-xs text-700 uppercase tracking-wider">Username</label>
              <IconField class="w-full">
                <InputIcon class="pi pi-user text-400" />
                <InputText
                  v-model="username"
                  placeholder="Contoh: user123"
                  class="w-full text-sm"
                />
              </IconField>
            </div>

            <!-- Input Nama Lengkap -->
            <div class="flex flex-column gap-1.5">
              <label class="font-semibold text-xs text-700 uppercase tracking-wider">Nama Lengkap</label>
              <IconField class="w-full">
                <InputIcon class="pi pi-id-card text-400" />
                <InputText
                  v-model="name"
                  placeholder="Masukkan nama lengkap"
                  class="w-full text-sm"
                />
              </IconField>
            </div>

            <!-- Input Email -->
            <div class="flex flex-column gap-1.5">
              <label class="font-semibold text-xs text-700 uppercase tracking-wider">Email</label>
              <IconField class="w-full">
                <InputIcon class="pi pi-envelope text-400" />
                <InputText
                  v-model="email"
                  type="email"
                  placeholder="nama@email.com"
                  class="w-full text-sm"
                />
              </IconField>
            </div>

            <!-- Input Telepon (Phone) -->
            <div class="flex flex-column gap-1.5">
              <label class="font-semibold text-xs text-700 uppercase tracking-wider">Nomor Telepon</label>
              <IconField class="w-full">
                <InputIcon class="pi pi-phone text-400" />
                <InputText
                  v-model="phone"
                  placeholder="081234567890"
                  class="w-full text-sm"
                />
              </IconField>
            </div>

            <!-- Input Password -->
            <div class="flex flex-column gap-1.5">
              <label class="font-semibold text-xs text-700 uppercase tracking-wider">Password</label>
              <IconField class="w-full">
                <InputIcon class="pi pi-lock text-400 z-2" />
                <Password
                  v-model="password"
                  placeholder="Minimal 6 karakter"
                  toggleMask
                  class="w-full"
                  inputClass="w-full text-sm pl-6"
                />
              </IconField>
            </div>

            <!-- Submit Register Button -->
            <Button
              type="submit"
              label="Daftar Sekarang (Register)"
              icon="pi pi-check-circle"
              :loading="isSubmitting"
              class="w-full font-bold mt-2"
              severity="primary"
            />
          </form>
        </div>
      </template>

      <template #footer>
        <div class="text-center text-sm text-color-secondary pb-2">
          Sudah memiliki akun?
          <router-link to="/login" class="text-blue-600 font-bold hover:underline">
            Login Di Sini
          </router-link>
        </div>
      </template>
    </Card>
  </div>
</template>
