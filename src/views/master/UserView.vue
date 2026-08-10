<script setup lang="ts">
import { computed, onMounted, reactive, ref, watch } from 'vue'

import Avatar from 'primevue/avatar'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Column from 'primevue/column'
import ConfirmDialog from 'primevue/confirmdialog'
import DataTable from 'primevue/datatable'
import Dialog from 'primevue/dialog'
import Divider from 'primevue/divider'
import IconField from 'primevue/iconfield'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Message from 'primevue/message'
import Password from 'primevue/password'
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Toast from 'primevue/toast'
import ToggleSwitch from 'primevue/toggleswitch'
import Toolbar from 'primevue/toolbar'

import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

import { getInitials } from '@/utils/format'
import { formatDateTimeID } from '@/utils/date'

import type { User, UserRole } from '@/types/user'

import {
  fetchUsers,
  createUser as apiCreateUser,
  updateUser as apiUpdateUser,
  deleteUser as apiDeleteUser,
} from '@/services/userService'
import type { CreateUserPayload, UpdateUserPayload } from '@/services/userService'
import { userSchema, validateForm as zodValidateForm } from '@/utils/validation'

/* =========================================================
 * TYPES
 * ======================================================= */

interface UserForm {
  id: number | null
  fullName: string
  email: string
  role: UserRole | null
  password: string
  passwordConfirmation: string
  isActive: boolean
}

interface UserRoleOption {
  label: string
  value: UserRole
}

/* =========================================================
 * SERVICES
 * ======================================================= */

const toast = useToast()
const confirm = useConfirm()

/* =========================================================
 * STATE
 * ======================================================= */

const search = ref<string>('')

const selectedRole = ref<UserRole | null>(null)

const dialogVisible = ref<boolean>(false)

const editMode = ref<boolean>(false)

const submitted = ref<boolean>(false)

const isLoading = ref<boolean>(false)

/* =========================================================
 * OPTIONS
 * ======================================================= */

const roleOptions: UserRoleOption[] = [
  {
    label: 'Administrator',
    value: 'ADMIN',
  },
  {
    label: 'Kasir',
    value: 'CASHIER',
  },
  {
    label: 'Customer',
    value: 'CUSTOMER',
  },
]

/* =========================================================
 * FORM
 * ======================================================= */

const form = reactive<UserForm>({
  id: null,
  fullName: '',
  email: '',
  role: null,
  password: '',
  passwordConfirmation: '',
  isActive: true,
})

/* =========================================================
 * DATA — diambil dari API
 * ======================================================= */

const users = ref<User[]>([])
const page = ref<number>(1)
const limit = ref<number>(10)
const totalRecords = ref<number>(0)

const loadUsers = async (): Promise<void> => {
  isLoading.value = true
  try {
    const res = await fetchUsers({
      q: search.value.trim(),
      role: selectedRole.value ?? undefined,
      page: page.value,
      limit: limit.value,
    })
    users.value = res.data
    totalRecords.value = res.meta.total
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Gagal memuat data',
      detail: err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat pengguna.',
      life: 4000,
    })
  } finally {
    isLoading.value = false
  }
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch([search, selectedRole], () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 1
    loadUsers()
  }, 400)
})

const onPage = (event: any) => {
  page.value = event.page + 1
  limit.value = event.rows
  loadUsers()
}

onMounted(() => {
  loadUsers()
})

/* =========================================================
 * COMPUTED & VALIDATION
 * ======================================================= */

const dialogTitle = computed<string>(() => {
  return editMode.value ? 'Edit User' : 'Tambah User'
})


const isFullNameInvalid = computed<boolean>(() => {
  if (!submitted.value) {
    return false
  }

  return !form.fullName.trim()
})

const isEmailInvalid = computed<boolean>(() => {
  if (!submitted.value) {
    return false
  }

  if (!form.email.trim()) {
    return true
  }

  return !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())
})

const isRoleInvalid = computed<boolean>(() => {
  if (!submitted.value) {
    return false
  }

  return form.role === null
})

const isPasswordInvalid = computed<boolean>(() => {
  if (!submitted.value) {
    return false
  }

  if (editMode.value && !form.password) {
    return false
  }

  return !form.password
})

const isPasswordConfirmationInvalid = computed<boolean>(() => {
  if (!submitted.value) {
    return false
  }

  if (editMode.value && !form.password && !form.passwordConfirmation) {
    return false
  }

  return !form.passwordConfirmation || form.password !== form.passwordConfirmation
})

/* =========================================================
 * HELPERS
 * ======================================================= */

const getRoleLabel = (role: UserRole): string => {
  const r = (role ?? '').toUpperCase()
  switch (r) {
    case 'ADMIN':
      return 'Administrator'
    case 'CASHIER':
      return 'Kasir'
    case 'CUSTOMER':
      return 'Customer'
    default:
      return role || '-'
  }
}

const getRoleSeverity = (role: UserRole): 'danger' | 'info' | 'success' | 'secondary' => {
  const r = (role ?? '').toUpperCase()
  switch (r) {
    case 'ADMIN':
      return 'danger'
    case 'CASHIER':
      return 'info'
    case 'CUSTOMER':
      return 'success'
    default:
      return 'secondary'
  }
}

const resetFilters = (): void => {
  search.value = ''
  selectedRole.value = null
}

/* =========================================================
 * FORM HELPERS
 * ======================================================= */

const resetForm = (): void => {
  form.id = null
  form.fullName = ''
  form.email = ''
  form.role = null
  form.password = ''
  form.passwordConfirmation = ''
  form.isActive = true

  submitted.value = false
}

/* =========================================================
 * DIALOG
 * ======================================================= */

const openCreateDialog = (): void => {
  resetForm()

  editMode.value = false
  dialogVisible.value = true
}

const openEditDialog = (user: User): void => {
  resetForm()

  editMode.value = true

  form.id = user.id
  form.fullName = user.name
  form.email = user.email ?? ''
  form.role = (user.role?.toUpperCase() as UserRole) ?? 'STAFF'
  form.isActive = user.is_active ?? true

  dialogVisible.value = true
}

const closeDialog = (): void => {
  dialogVisible.value = false

  resetForm()
}

/* =========================================================
 * VALIDATION
 * ======================================================= */

const errors = ref<Record<string, string>>({})

const validateForm = (): boolean => {
  submitted.value = true

  const res = zodValidateForm(userSchema, {
    name: form.fullName,
    email: form.email,
    role: form.role || '',
    password: form.password,
  })

  errors.value = res.errors

  if (!editMode.value && !form.password) {
    errors.value.password = 'Password wajib diisi untuk user baru'
  }

  if (form.password && form.password !== form.passwordConfirmation) {
    errors.value.passwordConfirmation = 'Konfirmasi password tidak cocok'
  }

  if (!res.success || Object.keys(errors.value).length > 0) {
    return false
  }


  const duplicateEmail = users.value.some((user) => {
    return user.email!.toLowerCase() === form.email.trim().toLowerCase() && user.id !== form.id
  })

  if (duplicateEmail) {
    toast.add({
      severity: 'warn',
      summary: 'Email sudah digunakan',
      detail: 'Email tersebut sudah digunakan user lain.',
      life: 3000,
    })

    return false
  }

  return true
}

/* =========================================================
 * SAVE
 * ======================================================= */

const saveUser = (): void => {
  if (!validateForm()) {
    return
  }

  if (editMode.value && form.id !== null) {
    updateUser()

    return
  }

  createUser()
}

const createUser = async (): Promise<void> => {
  if (form.role === null) return
  isLoading.value = true
  try {
    const payload: CreateUserPayload = {
      email: form.email.trim().toLowerCase(),
      password: form.password,
      name: form.fullName.trim(),
      role: form.role.toLowerCase(),
      phone: '',
    }
    await apiCreateUser(payload)
    await loadUsers()
    dialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Berhasil',
      detail: 'User berhasil ditambahkan.',
      life: 3000,
    })
    resetForm()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Gagal menyimpan',
      detail: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      life: 4000,
    })
  } finally {
    isLoading.value = false
  }
}

const updateUser = async (): Promise<void> => {
  if (form.id === null || form.role === null) return
  isLoading.value = true
  try {
    const payload: UpdateUserPayload = {
      email: form.email.trim().toLowerCase(),
      name: form.fullName.trim(),
      role: form.role.toLowerCase(),
      ...(form.password ? { password: form.password } : {}),
    }
    await apiUpdateUser(form.id, payload)
    await loadUsers()
    dialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Berhasil',
      detail: form.password
        ? 'User dan password berhasil diperbarui.'
        : 'User berhasil diperbarui.',
      life: 3000,
    })
    resetForm()
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Gagal memperbarui',
      detail: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      life: 4000,
    })
  } finally {
    isLoading.value = false
  }
}

/* =========================================================
 * DELETE
 * ======================================================= */

const confirmDeleteUser = (user: User): void => {
  confirm.require({
    header: 'Hapus User',
    message: `Apakah kamu yakin ingin menghapus user "${user.name}"?`,
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
        await apiDeleteUser(user.id)
        await loadUsers()
        toast.add({
          severity: 'success',
          summary: 'Berhasil',
          detail: 'User berhasil dihapus.',
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
  <div class="p-3 md:p-4 surface-ground min-h-screen">
    <Toast />

    <ConfirmDialog />

    <!-- =====================================================
         HEADER
    ====================================================== -->

    <div class="mb-4">
      <h1 class="text-2xl font-bold text-900 m-0">Master User</h1>

      <p class="text-sm text-500 mt-2 mb-0">Kelola user dan hak akses aplikasi.</p>
    </div>

    <!-- =====================================================
         CONTENT
    ====================================================== -->

    <Card>
      <template #content>
        <Toolbar class="mb-4">
          <template #start>
            <div class="flex align-items-center gap-3">
              <Avatar icon="pi pi-user" shape="square" class="bg-blue-50 text-blue-600" />

              <div>
                <div class="font-semibold text-900">Daftar User</div>

                <div class="text-xs text-500 mt-1">{{ users.length }} user terdaftar</div>
              </div>
            </div>
          </template>

          <template #end>
            <Button label="Tambah User" icon="pi pi-plus" @click="openCreateDialog" />
          </template>
        </Toolbar>

        <!-- =================================================
             FILTER
        ================================================== -->

        <div class="flex flex-column xl:flex-row xl:align-items-center gap-3 mb-4">
          <div class="flex flex-column md:flex-row gap-2 flex-1 min-w-0">
            <IconField class="w-full md:w-20rem">
              <InputIcon class="pi pi-search" />

              <InputText v-model="search" placeholder="Cari user..." class="w-full" />
            </IconField>

            <Select
              v-model="selectedRole"
              :options="roleOptions"
              option-label="label"
              option-value="value"
              placeholder="Semua Role"
              show-clear
              class="w-full md:w-12rem"
            />
          </div>

          <div class="flex align-items-center flex-shrink-0 xl:ml-auto">
            <Button
              label="Reset"
              icon="pi pi-filter-slash"
              severity="secondary"
              text
              @click="resetFilters"
            />
          </div>
        </div>

        <!-- =================================================
             TABLE
        ================================================== -->

        <DataTable
          :value="users"
          data-key="id"
          lazy
          paginator
          :first="(page - 1) * limit"
          :rows="limit"
          :total-records="totalRecords"
          :rows-per-page-options="[10, 25, 50]"
          :loading="isLoading"
          striped-rows
          row-hover
          responsive-layout="scroll"
          class="w-full"
          @page="onPage"
        >
          <Column field="name" header="USER" sortable style="min-width: 14rem">
            <template #body="{ data }: { data: User }">
              <div class="flex align-items-center gap-3">
                <Avatar
                  :label="getInitials(data.name)"
                  shape="circle"
                  class="bg-blue-50 text-blue-600 flex-shrink-0"
                />

                <div>
                  <div class="font-semibold text-900">
                    {{ data.name }}
                  </div>
                </div>
              </div>
            </template>
          </Column>

          <Column field="email" header="EMAIL" sortable style="min-width: 13rem">
            <template #body="{ data }: { data: User }">
              <span class="text-sm text-700">
                {{ data.email || '-' }}
              </span>
            </template>
          </Column>

          <Column field="role" header="ROLE" sortable style="min-width: 9rem">
            <template #body="{ data }: { data: User }">
              <Tag :value="getRoleLabel(data.role)" :severity="getRoleSeverity(data.role)" />
            </template>
          </Column>

          <Column field="created_at" header="DIBUAT TANGGAL" sortable style="min-width: 11rem">
            <template #body="{ data }: { data: User }">
              <span v-if="data.created_at" class="text-sm text-700">
                {{ formatDateTimeID(data.created_at) }}
              </span>

              <span v-else class="text-sm text-500"> - </span>
            </template>
          </Column>

          <Column field="is_active" header="STATUS" sortable style="min-width: 7rem">
            <template #body="{ data }: { data: User }">
              <Tag
                :value="data.is_active ? 'Aktif' : 'Nonaktif'"
                :severity="data.is_active ? 'success' : 'secondary'"
                rounded
              />
            </template>
          </Column>

          <Column header="AKSI" style="width: 6rem">
            <template #body="{ data }: { data: User }">
              <div class="flex align-items-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  text
                  rounded
                  aria-label="Edit user"
                  @click="openEditDialog(data)"
                />

                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  aria-label="Hapus user"
                  @click="confirmDeleteUser(data)"
                />
              </div>
            </template>
          </Column>

          <template #empty>
            <div class="flex flex-column align-items-center justify-content-center gap-3 py-6">
              <Avatar
                icon="pi pi-search"
                size="xlarge"
                shape="circle"
                class="bg-gray-100 text-gray-500"
              />

              <div class="text-center">
                <div class="font-semibold text-900">User tidak ditemukan</div>

                <div class="text-sm text-500 mt-1">Ubah keyword atau filter pencarian.</div>
              </div>
            </div>
          </template>
        </DataTable>
      </template>
    </Card>

    <!-- =====================================================
         FORM
    ====================================================== -->

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="dialogTitle"
      class="w-full md:w-8 lg:w-6"
      :draggable="false"
      @hide="resetForm"
    >
      <div class="formgrid grid">

        <div class="field col-12">
          <label for="user-name" class="block text-sm font-medium text-900 mb-2">
            Nama Lengkap
          </label>

          <InputText
            id="user-name"
            v-model="form.fullName"
            :invalid="isFullNameInvalid"
            placeholder="Nama lengkap user"
            class="w-full"
          />

          <Message
            v-if="isFullNameInvalid"
            severity="error"
            variant="simple"
            size="small"
            class="mt-2"
          >
            Nama lengkap wajib diisi.
          </Message>
        </div>

        <div class="field col-12">
          <label for="user-email" class="block text-sm font-medium text-900 mb-2"> Email </label>

          <InputText
            id="user-email"
            v-model="form.email"
            :invalid="isEmailInvalid"
            placeholder="user@example.com"
            class="w-full"
          />

          <Message
            v-if="isEmailInvalid"
            severity="error"
            variant="simple"
            size="small"
            class="mt-2"
          >
            Email wajib diisi dengan format yang valid.
          </Message>
        </div>

        <div class="col-12">
          <Divider />
        </div>

        <div class="field col-12 md:col-6">
          <label for="user-password" class="block text-sm font-medium text-900 mb-2">
            Password
          </label>

          <Password
            id="user-password"
            v-model="form.password"
            :feedback="!editMode"
            toggle-mask
            :invalid="isPasswordInvalid"
            :placeholder="editMode ? 'Kosongkan jika tidak diubah' : 'Minimal 8 karakter'"
            class="w-full"
            input-class="w-full"
          />

          <Message
            v-if="isPasswordInvalid"
            severity="error"
            variant="simple"
            size="small"
            class="mt-2"
          >
            Password minimal 8 karakter.
          </Message>
        </div>

        <div class="field col-12 md:col-6">
          <label for="user-password-confirmation" class="block text-sm font-medium text-900 mb-2">
            Konfirmasi Password
          </label>

          <Password
            id="user-password-confirmation"
            v-model="form.passwordConfirmation"
            :feedback="false"
            toggle-mask
            :invalid="isPasswordConfirmationInvalid"
            placeholder="Ulangi password"
            class="w-full"
            input-class="w-full"
          />

          <Message
            v-if="isPasswordConfirmationInvalid"
            severity="error"
            variant="simple"
            size="small"
            class="mt-2"
          >
            Konfirmasi password tidak sama.
          </Message>
        </div>
        <div class="field col-12">
          <label for="user-role" class="block text-sm font-medium text-900 mb-2"> Role </label>

          <Select
            id="user-role"
            v-model="form.role"
            :options="roleOptions"
            option-label="label"
            option-value="value"
            placeholder="Pilih role"
            :invalid="isRoleInvalid"
            class="w-full"
          />

          <Message v-if="isRoleInvalid" severity="error" variant="simple" size="small" class="mt-2">
            Role wajib dipilih.
          </Message>
        </div>

        <div class="col-12">
          <Divider />
        </div>

        <div class="field col-12">
          <div class="flex align-items-center justify-content-between gap-3">
            <div>
              <div class="text-sm font-medium text-900">Status User</div>

              <div class="text-xs text-500 mt-1">User nonaktif tidak dapat masuk ke aplikasi.</div>
            </div>

            <ToggleSwitch v-model="form.isActive" />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Batal" severity="secondary" outlined @click="closeDialog" />

        <Button
          :label="editMode ? 'Simpan Perubahan' : 'Tambah User'"
          :icon="editMode ? 'pi pi-check' : 'pi pi-plus'"
          @click="saveUser"
        />
      </template>
    </Dialog>
  </div>
</template>
