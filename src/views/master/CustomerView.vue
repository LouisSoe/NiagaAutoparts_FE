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
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import Toast from 'primevue/toast'
import ToggleSwitch from 'primevue/toggleswitch'
import Toolbar from 'primevue/toolbar'

import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

import { formatCurrencyIDR, getInitials } from '@/utils/format'

import type { Customer, CustomerType } from '@/types/customer'

import {
  fetchCustomers,
  createCustomer as apiCreateCustomer,
  updateCustomer as apiUpdateCustomer,
  deleteCustomer as apiDeleteCustomer,
} from '@/services/customerService'
import type { CreateCustomerPayload } from '@/services/customerService'
import { fetchUsers } from '@/services/userService'



/* =========================================================
 * TYPES
 * ======================================================= */

interface CustomerForm {
  id: number | null
  userId: number | null
  type: CustomerType | null
  address: string
  notes: string
  isActive: boolean
}

interface CustomerTypeOption {
  label: string
  value: CustomerType
}

interface UserOption {
  id: number
  name: string
  email: string | null
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

const selectedType = ref<CustomerType | null>(null)

const dialogVisible = ref<boolean>(false)

const editMode = ref<boolean>(false)

const submitted = ref<boolean>(false)

const isLoading = ref<boolean>(false)

const userOptions = ref<UserOption[]>([])

const loadUserOptions = async (): Promise<void> => {
  try {
    const res = await fetchUsers({ role: 'CUSTOMER', limit: 100 })
    userOptions.value = res.data.map((u) => ({
      id: u.id,
      name: u.name,
      email: u.email,
    }))
  } catch {
    // ignore
  }
}

/* =========================================================
 * OPTIONS
 * ======================================================= */

const customerTypeOptions: CustomerTypeOption[] = [
  {
    label: 'Individual',
    value: 'INDIVIDUAL',
  },
  {
    label: 'Bengkel',
    value: 'WORKSHOP',
  },
  {
    label: 'Perusahaan',
    value: 'COMPANY',
  },
]

/* =========================================================
 * FORM
 * ======================================================= */

const form = reactive<CustomerForm>({
  id: null,
  userId: null,
  type: null,
  address: '',
  notes: '',
  isActive: true,
})

/* =========================================================
 * DATA — diambil dari API
 * ======================================================= */

const customers = ref<Customer[]>([])
const page = ref<number>(1)
const limit = ref<number>(10)
const totalRecords = ref<number>(0)

const loadCustomers = async (): Promise<void> => {
  isLoading.value = true
  try {
    const res = await fetchCustomers({
      q: search.value.trim(),
      page: page.value,
      limit: limit.value,
    })
    customers.value = res.data
    totalRecords.value = res.meta.total
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Gagal memuat data',
      detail: err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat pelanggan.',
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
    loadCustomers()
  }, 400)
})

const onPage = (event: any) => {
  page.value = event.page + 1
  limit.value = event.rows
  loadCustomers()
}

onMounted(async () => {
  await loadCustomers()
  await loadUserOptions()
})

/* =========================================================
 * COMPUTED
 * ======================================================= */

const filteredCustomers = computed<Customer[]>(() => {
  const keyword = search.value.trim().toLowerCase()

  return customers.value.filter((customer) => {
    if (!keyword) return true
    const name = (customer.user_name ?? customer.name ?? '').toLowerCase()
    const phone = (customer.user_phone ?? customer.phone_number ?? '').toLowerCase()
    const email = (customer.user_email ?? customer.email ?? '').toLowerCase()
    return name.includes(keyword) || phone.includes(keyword) || email.includes(keyword)
  })
})

const dialogTitle = computed<string>(() => {
  return editMode.value ? 'Edit Customer' : 'Tambah Customer'
})

/* =========================================================
 * HELPERS
 * ======================================================= */

const getCustomerTypeLabel = (type: CustomerType): string => {
  switch (type) {
    case 'WORKSHOP':
      return 'Bengkel'

    case 'COMPANY':
      return 'Perusahaan'

    case 'INDIVIDUAL':
    default:
      return 'Individual'
  }
}

const getCustomerTypeSeverity = (type: CustomerType): 'info' | 'success' | 'secondary' => {
  switch (type) {
    case 'WORKSHOP':
      return 'info'

    case 'COMPANY':
      return 'success'

    case 'INDIVIDUAL':
    default:
      return 'secondary'
  }
}

const resetFilters = (): void => {
  search.value = ''
  selectedType.value = null
}

/* =========================================================
 * FORM HELPERS
 * ======================================================= */

const resetForm = (): void => {
  form.id = null
  form.userId = null
  form.type = null
  form.address = ''
  form.notes = ''
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

const openEditDialog = (customer: Customer): void => {
  resetForm()

  editMode.value = true

  form.id = customer.id
  form.userId = customer.user_id ?? null
  form.type = customer.type ?? null
  form.address = customer.address ?? ''
  form.notes = customer.notes ?? ''
  form.isActive = customer.isActive

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
  errors.value = {}

  if (!form.userId) {
    errors.value.userId = 'Pilih akun user yang terhubung'
    return false
  }

  return true
}

/* =========================================================
 * SAVE
 * ======================================================= */

const saveCustomer = (): void => {
  if (!validateForm()) return

  if (editMode.value && form.id !== null) {
    updateCustomer()
    return
  }

  createCustomer()
}

const createCustomer = async (): Promise<void> => {
  isLoading.value = true
  try {
    const payload: CreateCustomerPayload = {
      user_id: form.userId ?? undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      type: form.type ?? undefined,
    }
    await apiCreateCustomer(payload)
    await loadCustomers()
    dialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Berhasil',
      detail: 'Customer berhasil ditambahkan.',
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

const updateCustomer = async (): Promise<void> => {
  if (form.id === null) return
  isLoading.value = true
  try {
    await apiUpdateCustomer(form.id, {
      user_id: form.userId ?? undefined,
      address: form.address.trim() || undefined,
      notes: form.notes.trim() || undefined,
      type: form.type ?? undefined,
    })
    await loadCustomers()
    dialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Berhasil',
      detail: 'Customer berhasil diperbarui.',
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

const confirmDeleteCustomer = (customer: Customer): void => {
  if (customer.totalOrders > 0) {
    toast.add({
      severity: 'warn',
      summary: 'Customer tidak dapat dihapus',
      detail: 'Customer sudah memiliki transaksi. Nonaktifkan customer jika tidak digunakan.',
      life: 4000,
    })

    return
  }

  confirm.require({
    header: 'Hapus Customer',
    message: `Apakah kamu yakin ingin menghapus customer "${customer.name}"?`,
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
        await apiDeleteCustomer(customer.id)
        customers.value = customers.value.filter((item) => item.id !== customer.id)
        toast.add({
          severity: 'success',
          summary: 'Berhasil',
          detail: 'Customer berhasil dihapus.',
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
      <h1 class="text-2xl font-bold text-900 m-0">Master Customer</h1>

      <p class="text-sm text-500 mt-2 mb-0">Kelola data customer yang melakukan transaksi.</p>
    </div>

    <!-- =====================================================
         CONTENT
    ====================================================== -->

    <Card>
      <template #content>
        <!-- =================================================
             TOOLBAR
        ================================================== -->

        <Toolbar class="mb-4">
          <template #start>
            <div class="flex align-items-center gap-3">
              <Avatar icon="pi pi-users" shape="square" class="bg-blue-50 text-blue-600" />

              <div>
                <div class="font-semibold text-900">Daftar Customer</div>

                <div class="text-xs text-500 mt-1">{{ customers.length }} customer terdaftar</div>
              </div>
            </div>
          </template>

          <template #end>
            <Button label="Tambah Customer" icon="pi pi-plus" @click="openCreateDialog" />
          </template>
        </Toolbar>

        <!-- =================================================
             FILTER
        ================================================== -->

        <div class="flex flex-column xl:flex-row xl:align-items-center gap-3 mb-4">
          <div class="flex flex-column md:flex-row gap-2 flex-1 min-w-0">
            <IconField class="w-full md:w-20rem">
              <InputIcon class="pi pi-search" />

              <InputText v-model="search" placeholder="Cari customer..." class="w-full" />
            </IconField>

            <Select
              v-model="selectedType"
              :options="customerTypeOptions"
              option-label="label"
              option-value="value"
              placeholder="Semua Tipe"
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
          :value="customers"
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
          <Column field="name" header="CUSTOMER" sortable style="min-width: 15rem">
            <template #body="{ data }: { data: Customer }">
              <div class="flex align-items-center gap-3">
                <Avatar
                  :label="getInitials(data.name)"
                  shape="circle"
                  class="bg-blue-50 text-blue-600 flex-shrink-0"
                />

                <div class="min-w-0">
                  <div class="font-semibold text-900">
                    {{ data.user_name || data.name || '-' }}
                  </div>

                  <div class="text-xs text-500 mt-1">
                    {{ data.code }}
                  </div>
                </div>
              </div>
            </template>
          </Column>

          <Column field="type" header="TIPE" sortable style="min-width: 8rem">
            <template #body="{ data }: { data: Customer }">
              <Tag
                :value="getCustomerTypeLabel(data.type)"
                :severity="getCustomerTypeSeverity(data.type)"
              />
            </template>
          </Column>

          <Column field="user_phone" header="KONTAK" style="min-width: 12rem">
            <template #body="{ data }: { data: Customer }">
              <div class="flex flex-column gap-1">
                <span class="text-sm text-900">
                  {{ data.user_phone || data.phone_number || '-' }}
                </span>

                <span class="text-xs text-500">
                  {{ data.user_email || data.email || '-' }}
                </span>
              </div>
            </template>
          </Column>

          <Column field="totalOrders" header="ORDER" sortable style="min-width: 6rem">
            <template #body="{ data }: { data: Customer }">
              <span class="font-semibold text-900">
                {{ data.totalOrders }}
              </span>
            </template>
          </Column>

          <Column field="totalSpent" header="TOTAL BELANJA" sortable style="min-width: 10rem">
            <template #body="{ data }: { data: Customer }">
              <span class="font-semibold text-900">
                {{ formatCurrencyIDR(data.totalSpent) }}
              </span>
            </template>
          </Column>

          <Column field="isActive" header="STATUS" sortable style="min-width: 7rem">
            <template #body="{ data }: { data: Customer }">
              <Tag
                :value="data.isActive ? 'Aktif' : 'Nonaktif'"
                :severity="data.isActive ? 'success' : 'secondary'"
                rounded
              />
            </template>
          </Column>

          <Column header="AKSI" style="width: 6rem">
            <template #body="{ data }: { data: Customer }">
              <div class="flex align-items-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  text
                  rounded
                  aria-label="Edit customer"
                  @click="openEditDialog(data)"
                />

                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  aria-label="Hapus customer"
                  @click="confirmDeleteCustomer(data)"
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
                <div class="font-semibold text-900">Customer tidak ditemukan</div>

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
        <div class="field col-12 md:col-6">
          <label for="customer-user" class="block text-sm font-medium text-900 mb-2">
            Pilih User Terhubung <span class="text-red-500">*</span>
          </label>

          <Select
            id="customer-user"
            v-model="form.userId"
            :options="userOptions"
            option-label="name"
            option-value="id"
            placeholder="Pilih akun User (Role: Customer)"
            :invalid="submitted && !form.userId"
            filter
            filter-by="name,email"
            show-clear
            class="w-full"
          />

          <Message v-if="submitted && !form.userId" severity="error" variant="simple" size="small" class="mt-2">
            Pilih user yang terhubung.
          </Message>
        </div>

        <div class="field col-12 md:col-6">
          <label for="customer-type" class="block text-sm font-medium text-900 mb-2">
            Tipe Customer
          </label>

          <Select
            id="customer-type"
            v-model="form.type"
            :options="customerTypeOptions"
            option-label="label"
            option-value="value"
            placeholder="Pilih tipe (opsional)"
            show-clear
            class="w-full"
          />
        </div>

        <!-- USER SELECTION (id_user) -->

        <div class="field col-12">
          <label for="customer-address" class="block text-sm font-medium text-900 mb-2">
            Alamat
          </label>

          <Textarea
            id="customer-address"
            v-model="form.address"
            rows="3"
            auto-resize
            placeholder="Alamat customer..."
            class="w-full"
          />
        </div>

        <div class="col-12">
          <Divider />
        </div>

        <div class="field col-12">
          <div class="flex align-items-center justify-content-between gap-3">
            <div>
              <div class="text-sm font-medium text-900">Status Customer</div>

              <div class="text-xs text-500 mt-1">
                Customer aktif dapat digunakan dalam transaksi.
              </div>
            </div>

            <ToggleSwitch v-model="form.isActive" />
          </div>
        </div>
      </div>

      <template #footer>
        <Button label="Batal" severity="secondary" outlined @click="closeDialog" />

        <Button
          :label="editMode ? 'Simpan Perubahan' : 'Tambah Customer'"
          :icon="editMode ? 'pi pi-check' : 'pi pi-plus'"
          @click="saveCustomer"
        />
      </template>
    </Dialog>
  </div>
</template>
