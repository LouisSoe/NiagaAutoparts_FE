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
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import Toast from 'primevue/toast'
import ToggleSwitch from 'primevue/toggleswitch'
import Toolbar from 'primevue/toolbar'

import { useConfirm } from 'primevue/useconfirm'
import { useToast } from 'primevue/usetoast'

import type { Category } from '@/types/category'

import {
  fetchCategories,
  createCategory as apiCreateCategory,
  updateCategory as apiUpdateCategory,
  deleteCategory as apiDeleteCategory,
} from '@/services/categoryService'
import type { CreateCategoryPayload } from '@/services/categoryService'
import { categorySchema, validateForm as zodValidateForm } from '@/utils/validation'

/* =========================================================
 * SERVICES
 * ======================================================= */

const confirm = useConfirm()
const toast = useToast()

/* =========================================================
 * TYPES
 * ======================================================= */

interface CategoryForm {
  id: number | null
  name: string
  description: string
}

/* =========================================================
 * STATE
 * ======================================================= */

const search = ref<string>('')
const dialogVisible = ref<boolean>(false)
const submitted = ref<boolean>(false)
const editMode = ref<boolean>(false)
const isLoading = ref<boolean>(false)

/* =========================================================
 * FORM
 * ======================================================= */

const form = reactive<CategoryForm>({
  id: null,
  name: '',
  description: '',
})

/* =========================================================
 * CATEGORY DATA — diambil dari API
 * ======================================================= */

const categories = ref<Category[]>([])
const page = ref<number>(1)
const limit = ref<number>(10)
const totalRecords = ref<number>(0)

const loadCategories = async (): Promise<void> => {
  isLoading.value = true
  try {
    const res = await fetchCategories({
      q: search.value.trim(),
      page: page.value,
      limit: limit.value,
    })
    categories.value = res.data
    totalRecords.value = res.meta.total
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Gagal memuat data',
      detail: err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat kategori.',
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
    loadCategories()
  }, 400)
})

const onPage = (event: any) => {
  page.value = event.page + 1
  limit.value = event.rows
  loadCategories()
}

onMounted(loadCategories)

/* =========================================================
 * COMPUTED
 * ======================================================= */

const filteredCategories = computed<Category[]>(() => {
  const keyword = search.value.trim().toLowerCase()

  if (!keyword) {
    return categories.value
  }

  return categories.value.filter((category) => {
    return (
      category.slug.toLowerCase().includes(keyword) ||
      category.name.toLowerCase().includes(keyword) ||
      (category.description && category.description.toLowerCase().includes(keyword))
    )
  })
})

const dialogTitle = computed<string>(() => {
  return editMode.value ? 'Edit Category' : 'Tambah Category'
})

const isNameInvalid = computed<boolean>(() => {
  return submitted.value && !form.name.trim()
})

/* =========================================================
 * FORM HELPERS
 * ======================================================= */

const resetForm = (): void => {
  form.id = null
  form.name = ''
  form.description = ''
  submitted.value = false
}

const generateSlug = (name: string): string => {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
}

/* =========================================================
 * DIALOG
 * ======================================================= */

const openCreateDialog = (): void => {
  resetForm()
  editMode.value = false
  dialogVisible.value = true
}

const openEditDialog = (category: Category): void => {
  resetForm()
  editMode.value = true
  form.id = category.id
  form.name = category.name
  form.description = category.description ?? ''
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
  const res = zodValidateForm(categorySchema, {
    name: form.name,
    description: form.description,
  })
  errors.value = res.errors
  return res.success
}

/* =========================================================
 * SAVE
 * ======================================================= */

const saveCategory = (): void => {
  if (!validateForm()) {
    return
  }

  if (editMode.value && form.id !== null) {
    updateCategory()
    return
  }

  createCategory()
}

const createCategory = async (): Promise<void> => {
  isLoading.value = true
  try {
    const payload: CreateCategoryPayload = {
      name: form.name.trim(),
      slug: generateSlug(form.name.trim()),
      description: form.description.trim(),
    }
    await apiCreateCategory(payload)
    await loadCategories()
    dialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Berhasil',
      detail: 'Category berhasil ditambahkan.',
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

const updateCategory = async (): Promise<void> => {
  if (form.id === null) return
  isLoading.value = true
  try {
    await apiUpdateCategory(form.id, {
      name: form.name.trim(),
      slug: generateSlug(form.name.trim()),
      description: form.description.trim(),
    })
    await loadCategories()
    dialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Berhasil',
      detail: 'Category berhasil diperbarui.',
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

const confirmDeleteCategory = (category: Category): void => {
  confirm.require({
    header: 'Hapus Category',
    message: `Apakah kamu yakin ingin menghapus category "${category.name}"?`,
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
        await apiDeleteCategory(category.id)
        await loadCategories()
        toast.add({
          severity: 'success',
          summary: 'Berhasil',
          detail: 'Category berhasil dihapus.',
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
         PAGE HEADER
    ====================================================== -->

    <div class="mb-4">
      <h1 class="text-2xl font-bold text-900 m-0">Master Category</h1>

      <p class="text-sm text-500 mt-2 mb-0">Kelola category produk yang tersedia di sistem.</p>
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
            <div class="flex align-items-center gap-2">
              <Avatar icon="pi pi-tags" shape="square" class="bg-blue-50 text-blue-600" />

              <div>
                <div class="font-semibold text-900">Daftar Category</div>

                <div class="text-xs text-500 mt-1">{{ totalRecords }} category terdaftar</div>
              </div>
            </div>
          </template>

          <template #end>
            <Button label="Tambah Category" icon="pi pi-plus" @click="openCreateDialog" />
          </template>
        </Toolbar>

        <!-- =================================================
             SEARCH
        ================================================== -->

        <div
          class="flex flex-column md:flex-row md:align-items-center md:justify-content-between gap-3 mb-4"
        >
          <IconField class="w-full md:w-20rem">
            <InputIcon class="pi pi-search" />

            <InputText v-model="search" placeholder="Cari category..." class="w-full" />
          </IconField>
        </div>

        <!-- =================================================
             TABLE
        ================================================== -->

        <DataTable
          :value="categories"
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
          <!-- SLUG -->

          <Column field="slug" header="SLUG" sortable style="min-width: 10rem">
            <template #body="{ data }">
              <Tag :value="data.slug" severity="secondary" />
            </template>
          </Column>

          <!-- CATEGORY -->

          <Column field="name" header="CATEGORY" sortable style="min-width: 15rem">
            <template #body="{ data }">
              <div class="flex align-items-center gap-3">
                <Avatar
                  icon="pi pi-tag"
                  shape="square"
                  class="bg-blue-50 text-blue-600 flex-shrink-0"
                />

                <div class="min-w-0">
                  <div class="font-semibold text-900">
                    {{ data.name }}
                  </div>

                  <div
                    class="text-xs text-500 mt-1 white-space-nowrap overflow-hidden text-overflow-ellipsis"
                  >
                    {{ data.description || '-' }}
                  </div>
                </div>
              </div>
            </template>
          </Column>

          <!-- ACTION -->

          <Column header="AKSI" style="width: 8rem">
            <template #body="{ data }">
              <div class="flex align-items-center gap-1">
                <Button
                  icon="pi pi-pencil"
                  severity="secondary"
                  text
                  rounded
                  aria-label="Edit category"
                  @click="openEditDialog(data)"
                />

                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  aria-label="Hapus category"
                  @click="confirmDeleteCategory(data)"
                />
              </div>
            </template>
          </Column>

          <!-- EMPTY -->

          <template #empty>
            <div class="flex flex-column align-items-center justify-content-center gap-3 py-6">
              <Avatar
                icon="pi pi-search"
                shape="circle"
                size="xlarge"
                class="bg-gray-100 text-gray-500"
              />

              <div class="text-center">
                <div class="font-semibold text-900">Category tidak ditemukan</div>

                <div class="text-sm text-500 mt-1">Coba gunakan kata pencarian yang berbeda.</div>
              </div>
            </div>
          </template>
        </DataTable>
      </template>
    </Card>

    <!-- =====================================================
         CATEGORY FORM DIALOG
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
      <div class="flex flex-column gap-4">
        <!-- NAME -->

        <div class="flex flex-column gap-2">
          <label for="category-name" class="text-sm font-medium text-900"> Nama Category </label>

          <InputText
            id="category-name"
            v-model="form.name"
            :invalid="isNameInvalid"
            placeholder="Contoh: Mesin"
            autocomplete="off"
            class="w-full"
          />

          <Message v-if="isNameInvalid" severity="error" variant="simple" size="small">
            Nama category wajib diisi.
          </Message>
        </div>

        <!-- DESCRIPTION -->

        <div class="flex flex-column gap-2">
          <label for="category-description" class="text-sm font-medium text-900"> Deskripsi </label>

          <Textarea
            id="category-description"
            v-model="form.description"
            rows="4"
            auto-resize
            placeholder="Deskripsi category..."
            class="w-full"
          />
        </div>
      </div>

      <!-- FOOTER -->

      <template #footer>
        <Button label="Batal" severity="secondary" outlined @click="closeDialog" />

        <Button
          :label="editMode ? 'Simpan Perubahan' : 'Tambah Category'"
          :icon="editMode ? 'pi pi-check' : 'pi pi-plus'"
          @click="saveCategory"
        />
      </template>
    </Dialog>
  </div>
</template>
