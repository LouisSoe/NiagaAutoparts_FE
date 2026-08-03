<script setup lang="ts">
import { computed, reactive, ref } from 'vue'

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
  code: string
  name: string
  description: string
  isActive: boolean
}

/* =========================================================
 * STATE
 * ======================================================= */

const search = ref<string>('')

const dialogVisible = ref<boolean>(false)

const submitted = ref<boolean>(false)

const editMode = ref<boolean>(false)

/* =========================================================
 * FORM
 * ======================================================= */

const form = reactive<CategoryForm>({
  id: null,
  code: '',
  name: '',
  description: '',
  isActive: true
})

/* =========================================================
 * CATEGORY DATA
 *
 * Nanti bagian ini bisa diganti dengan API.
 * ======================================================= */

const categories = ref<Category[]>([
  {
    id: 1,
    code: 'CAT-001',
    name: 'Mesin',
    description: 'Sparepart dan komponen mesin kendaraan.',
    productCount: 42,
    isActive: true
  },
  {
    id: 2,
    code: 'CAT-002',
    name: 'Kelistrikan',
    description: 'Komponen kelistrikan dan sistem elektronik kendaraan.',
    productCount: 28,
    isActive: true
  },
  {
    id: 3,
    code: 'CAT-003',
    name: 'Kaki-Kaki',
    description: 'Suspensi, shockbreaker, ball joint, dan komponen terkait.',
    productCount: 36,
    isActive: true
  },
  {
    id: 4,
    code: 'CAT-004',
    name: 'Pelumas',
    description: 'Oli mesin, oli transmisi, dan cairan kendaraan.',
    productCount: 18,
    isActive: true
  },
  {
    id: 5,
    code: 'CAT-005',
    name: 'Aksesoris',
    description: 'Aksesoris tambahan untuk kendaraan.',
    productCount: 12,
    isActive: false
  }
])

/* =========================================================
 * COMPUTED
 * ======================================================= */

const filteredCategories = computed<Category[]>(() => {
  const keyword = search.value
    .trim()
    .toLowerCase()

  if (!keyword) {
    return categories.value
  }

  return categories.value.filter((category) => {
    return (
      category.code.toLowerCase().includes(keyword) ||
      category.name.toLowerCase().includes(keyword) ||
      category.description.toLowerCase().includes(keyword)
    )
  })
})

const dialogTitle = computed<string>(() => {
  return editMode.value
    ? 'Edit Category'
    : 'Tambah Category'
})

const isCodeInvalid = computed<boolean>(() => {
  return submitted.value && !form.code.trim()
})

const isNameInvalid = computed<boolean>(() => {
  return submitted.value && !form.name.trim()
})

/* =========================================================
 * FORM HELPERS
 * ======================================================= */

const resetForm = (): void => {
  form.id = null
  form.code = ''
  form.name = ''
  form.description = ''
  form.isActive = true

  submitted.value = false
}

const generateCategoryCode = (): string => {
  const highestId = categories.value.reduce(
    (highest, category) => {
      return Math.max(highest, category.id)
    },
    0
  )

  return `CAT-${String(highestId + 1).padStart(3, '0')}`
}

/* =========================================================
 * DIALOG
 * ======================================================= */

const openCreateDialog = (): void => {
  resetForm()

  editMode.value = false
  form.code = generateCategoryCode()

  dialogVisible.value = true
}

const openEditDialog = (category: Category): void => {
  resetForm()

  editMode.value = true

  form.id = category.id
  form.code = category.code
  form.name = category.name
  form.description = category.description
  form.isActive = category.isActive

  dialogVisible.value = true
}

const closeDialog = (): void => {
  dialogVisible.value = false

  resetForm()
}

/* =========================================================
 * VALIDATION
 * ======================================================= */

const validateForm = (): boolean => {
  submitted.value = true

  if (!form.code.trim()) {
    return false
  }

  if (!form.name.trim()) {
    return false
  }

  const duplicateCode = categories.value.find((category) => {
    return (
      category.code.toLowerCase() ===
        form.code.trim().toLowerCase() &&
      category.id !== form.id
    )
  })

  if (duplicateCode) {
    toast.add({
      severity: 'warn',
      summary: 'Kode sudah digunakan',
      detail: `Kode ${form.code} sudah digunakan category lain.`,
      life: 3000
    })

    return false
  }

  return true
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

const createCategory = (): void => {
  const nextId =
    categories.value.reduce(
      (highest, category) => {
        return Math.max(highest, category.id)
      },
      0
    ) + 1

  const category: Category = {
    id: nextId,
    code: form.code.trim().toUpperCase(),
    name: form.name.trim(),
    description: form.description.trim(),
    productCount: 0,
    isActive: form.isActive
  }

  categories.value.unshift(category)

  dialogVisible.value = false

  toast.add({
    severity: 'success',
    summary: 'Berhasil',
    detail: 'Category berhasil ditambahkan.',
    life: 3000
  })

  resetForm()
}

const updateCategory = (): void => {
  if (form.id === null) {
    return
  }

  const categoryExists = categories.value.some(
    (category) => category.id === form.id
  )

  if (!categoryExists) {
    toast.add({
      severity: 'error',
      summary: 'Gagal',
      detail: 'Category tidak ditemukan.',
      life: 3000
    })

    return
  }

  categories.value = categories.value.map(
    (category): Category => {
      if (category.id !== form.id) {
        return category
      }

      return {
        ...category,
        code: form.code.trim().toUpperCase(),
        name: form.name.trim(),
        description: form.description.trim(),
        isActive: form.isActive
      }
    }
  )

  dialogVisible.value = false

  toast.add({
    severity: 'success',
    summary: 'Berhasil',
    detail: 'Category berhasil diperbarui.',
    life: 3000
  })

  resetForm()
}

/* =========================================================
 * DELETE
 * ======================================================= */

const confirmDeleteCategory = (
  category: Category
): void => {
  if (category.productCount > 0) {
    toast.add({
      severity: 'warn',
      summary: 'Category tidak dapat dihapus',
      detail: `${category.name} masih memiliki ${category.productCount} produk.`,
      life: 4000
    })

    return
  }

  confirm.require({
    header: 'Hapus Category',
    message: `Apakah kamu yakin ingin menghapus category "${category.name}"?`,
    icon: 'pi pi-exclamation-triangle',
    rejectLabel: 'Batal',
    acceptLabel: 'Hapus',
    rejectProps: {
      severity: 'secondary',
      outlined: true
    },
    acceptProps: {
      severity: 'danger'
    },

    accept: () => {
      categories.value = categories.value.filter(
        (item) => item.id !== category.id
      )

      toast.add({
        severity: 'success',
        summary: 'Berhasil',
        detail: 'Category berhasil dihapus.',
        life: 3000
      })
    }
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
      <h1 class="text-2xl font-bold text-900 m-0">
        Master Category
      </h1>

      <p class="text-sm text-500 mt-2 mb-0">
        Kelola category produk yang tersedia di sistem.
      </p>
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
              <Avatar
                icon="pi pi-tags"
                shape="square"
                class="bg-blue-50 text-blue-600"
              />

              <div>
                <div class="font-semibold text-900">
                  Daftar Category
                </div>

                <div class="text-xs text-500 mt-1">
                  {{ categories.length }} category terdaftar
                </div>
              </div>
            </div>
          </template>

          <template #end>
            <Button
              label="Tambah Category"
              icon="pi pi-plus"
              @click="openCreateDialog"
            />
          </template>
        </Toolbar>

        <!-- =================================================
             SEARCH
        ================================================== -->

        <div
          class="
            flex
            flex-column
            md:flex-row
            md:align-items-center
            md:justify-content-between
            gap-3
            mb-4
          "
        >
          <IconField class="w-full md:w-20rem">
            <InputIcon class="pi pi-search" />

            <InputText
              v-model="search"
              placeholder="Cari category..."
              class="w-full"
            />
          </IconField>

          <div class="flex align-items-center gap-2">
            <span class="text-sm text-500">
              Total
            </span>

            <Tag
              :value="`${filteredCategories.length} category`"
              severity="secondary"
            />
          </div>
        </div>

        <!-- =================================================
             TABLE
        ================================================== -->

        <DataTable
          :value="filteredCategories"
          data-key="id"
          paginator
          :rows="10"
          :rows-per-page-options="[10, 25, 50]"
          striped-rows
          row-hover
          responsive-layout="scroll"
          class="w-full"
        >
          <!-- CODE -->

          <Column
            field="code"
            header="KODE"
            sortable
            style="min-width: 9rem"
          >
            <template #body="{ data }">
              <Tag
                :value="data.code"
                severity="secondary"
              />
            </template>
          </Column>

          <!-- CATEGORY -->

          <Column
            field="name"
            header="CATEGORY"
            sortable
            style="min-width: 15rem"
          >
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
                    class="
                      text-xs
                      text-500
                      mt-1
                      white-space-nowrap
                      overflow-hidden
                      text-overflow-ellipsis
                    "
                  >
                    {{ data.description || '-' }}
                  </div>
                </div>
              </div>
            </template>
          </Column>

          <!-- PRODUCT COUNT -->

          <Column
            field="productCount"
            header="PRODUK"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <div class="flex align-items-center gap-2">
                <i class="pi pi-box text-500" />

                <span class="text-sm text-900">
                  {{ data.productCount }}
                </span>
              </div>
            </template>
          </Column>

          <!-- STATUS -->

          <Column
            field="isActive"
            header="STATUS"
            sortable
            style="min-width: 8rem"
          >
            <template #body="{ data }">
              <Tag
                :value="data.isActive ? 'Aktif' : 'Nonaktif'"
                :severity="
                  data.isActive
                    ? 'success'
                    : 'secondary'
                "
                rounded
              />
            </template>
          </Column>

          <!-- ACTION -->

          <Column
            header="AKSI"
            style="width: 8rem"
          >
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
            <div
              class="
                flex
                flex-column
                align-items-center
                justify-content-center
                gap-3
                py-6
              "
            >
              <Avatar
                icon="pi pi-search"
                shape="circle"
                size="xlarge"
                class="bg-gray-100 text-gray-500"
              />

              <div class="text-center">
                <div class="font-semibold text-900">
                  Category tidak ditemukan
                </div>

                <div class="text-sm text-500 mt-1">
                  Coba gunakan kata pencarian yang berbeda.
                </div>
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
        <!-- CODE -->

        <div class="flex flex-column gap-2">
          <label
            for="category-code"
            class="text-sm font-medium text-900"
          >
            Kode Category
          </label>

          <InputText
            id="category-code"
            v-model="form.code"
            :invalid="isCodeInvalid"
            autocomplete="off"
            class="w-full"
          />

          <Message
            v-if="isCodeInvalid"
            severity="error"
            variant="simple"
            size="small"
          >
            Kode category wajib diisi.
          </Message>
        </div>

        <!-- NAME -->

        <div class="flex flex-column gap-2">
          <label
            for="category-name"
            class="text-sm font-medium text-900"
          >
            Nama Category
          </label>

          <InputText
            id="category-name"
            v-model="form.name"
            :invalid="isNameInvalid"
            placeholder="Contoh: Mesin"
            autocomplete="off"
            class="w-full"
          />

          <Message
            v-if="isNameInvalid"
            severity="error"
            variant="simple"
            size="small"
          >
            Nama category wajib diisi.
          </Message>
        </div>

        <!-- DESCRIPTION -->

        <div class="flex flex-column gap-2">
          <label
            for="category-description"
            class="text-sm font-medium text-900"
          >
            Deskripsi
          </label>

          <Textarea
            id="category-description"
            v-model="form.description"
            rows="4"
            auto-resize
            placeholder="Deskripsi category..."
            class="w-full"
          />
        </div>

        <Divider class="my-1" />

        <!-- STATUS -->

        <div
          class="
            flex
            align-items-center
            justify-content-between
            gap-3
          "
        >
          <div>
            <div class="text-sm font-medium text-900">
              Status Category
            </div>

            <div class="text-xs text-500 mt-1">
              Category aktif dapat digunakan pada produk.
            </div>
          </div>

          <div class="flex align-items-center gap-2">
            <span
              class="text-sm"
              :class="
                form.isActive
                  ? 'text-green-600'
                  : 'text-500'
              "
            >
              {{ form.isActive ? 'Aktif' : 'Nonaktif' }}
            </span>

            <ToggleSwitch
              v-model="form.isActive"
            />
          </div>
        </div>
      </div>

      <!-- FOOTER -->

      <template #footer>
        <Button
          label="Batal"
          severity="secondary"
          outlined
          @click="closeDialog"
        />

        <Button
          :label="
            editMode
              ? 'Simpan Perubahan'
              : 'Tambah Category'
          "
          :icon="
            editMode
              ? 'pi pi-check'
              : 'pi pi-plus'
          "
          @click="saveCategory"
        />
      </template>
    </Dialog>
  </div>
</template>