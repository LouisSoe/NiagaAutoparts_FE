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

import { formatCurrencyIDR, formatNumberID } from '@/utils/format'

import type { Product, ProductUnit } from '@/types/product'

import {
  fetchProducts,
  searchProducts,
  createProduct as apiCreateProduct,
  updateProduct as apiUpdateProduct,
  deleteProduct as apiDeleteProduct,
} from '@/services/productService'
import type { CreateProductPayload } from '@/services/productService'

import { fetchCategories } from '@/services/categoryService'
import { productSchema, validateForm as zodValidateForm } from '@/utils/validation'

/* =========================================================
 * TYPES
 * ======================================================= */

interface ProductForm {
  id: number | null
  sku: string
  name: string

  categoryId: number | null

  unit: ProductUnit | null

  purchase_price: number | null
  selling_price: number | null

  stock: number | null
  minimumStock: number | null

  imageUrl: string | null

  isActive: boolean
}

interface CategoryOption {
  id: number
  name: string
}

interface UnitOption {
  label: string
  value: ProductUnit
}

type StockFilter = 'all' | 'available' | 'low' | 'empty'

interface StockFilterOption {
  label: string
  value: StockFilter
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

const selectedCategoryId = ref<number | null>(null)

const selectedStockFilter = ref<StockFilter>('all')

const dialogVisible = ref<boolean>(false)

const editMode = ref<boolean>(false)

const submitted = ref<boolean>(false)

const isLoading = ref<boolean>(false)

/* =========================================================
 * OPTIONS
 *
 * Nanti categoryOptions sebaiknya berasal dari API master
 * category.
 * ======================================================= */

/* =========================================================
 * OPTIONS — category dari API, unit statis
 * ======================================================= */

const categoryOptions = ref<CategoryOption[]>([])

const loadCategoryOptions = async (): Promise<void> => {
  try {
    const res = await fetchCategories({ limit: 100 })
    categoryOptions.value = res.data.map((c) => ({ id: c.id, name: c.name }))
  } catch {
    // Jika gagal, biarkan dropdown kosong
  }
}

const unitOptions: UnitOption[] = [
  {
    label: 'Pcs',
    value: 'Pcs',
  },
  {
    label: 'Set',
    value: 'Set',
  },
  {
    label: 'Box',
    value: 'Box',
  },
  {
    label: 'Liter',
    value: 'Liter',
  },
  {
    label: 'Botol',
    value: 'Botol',
  },
]

const stockFilterOptions: StockFilterOption[] = [
  {
    label: 'Semua Stok',
    value: 'all',
  },
  {
    label: 'Tersedia',
    value: 'available',
  },
  {
    label: 'Stok Rendah',
    value: 'low',
  },
  {
    label: 'Stok Habis',
    value: 'empty',
  },
]

/* =========================================================
 * FORM
 * ======================================================= */

const form = reactive<ProductForm>({
  id: null,
  sku: '',
  name: '',

  categoryId: null,

  unit: null,

  purchase_price: null,
  selling_price: null,

  stock: 0,
  minimumStock: 0,
  imageUrl: null,
  isActive: true,
})

/* =========================================================
 * DATA
 *
 * Untuk sekarang dummy data.
 * Nanti tinggal diganti dengan response API.
 * ======================================================= */

/* =========================================================
 * DATA — diambil dari API
 * ======================================================= */

const products = ref<Product[]>([])
const page = ref<number>(1)
const limit = ref<number>(10)
const totalRecords = ref<number>(0)

const loadProducts = async (): Promise<void> => {
  isLoading.value = true
  try {
    const res = await fetchProducts({
      q: search.value.trim(),
      category_id: selectedCategoryId.value ?? undefined,
      stock_status: selectedStockFilter.value !== 'all' ? selectedStockFilter.value : undefined,
      page: page.value,
      limit: limit.value,
    })
    products.value = res.data
    totalRecords.value = res.meta.total
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Gagal memuat data',
      detail: err instanceof Error ? err.message : 'Terjadi kesalahan saat memuat produk.',
      life: 4000,
    })
  } finally {
    isLoading.value = false
  }
}

let searchDebounce: ReturnType<typeof setTimeout> | null = null

watch([search, selectedCategoryId, selectedStockFilter], () => {
  if (searchDebounce) clearTimeout(searchDebounce)
  searchDebounce = setTimeout(() => {
    page.value = 1
    loadProducts()
  }, 400)
})

const onPage = (event: any) => {
  page.value = event.page + 1
  limit.value = event.rows
  loadProducts()
}

onMounted(async () => {
  await loadCategoryOptions()
  await loadProducts()
})

/* =========================================================
 * COMPUTED
 * ======================================================= */

const filteredProducts = computed<Product[]>(() => {
  const keyword = search.value.trim().toLowerCase()

  return products.value.filter((product) => {
    const matchesKeyword =
      !keyword ||
      product.sku.toLowerCase().includes(keyword) ||
      product.name.toLowerCase().includes(keyword) ||
      (product.categoryName && product.categoryName.toLowerCase().includes(keyword)) ||
      (product.location && product.location.toLowerCase().includes(keyword))

    const matchesCategory =
      selectedCategoryId.value === null || product.categoryId === selectedCategoryId.value

    return matchesKeyword
  })
})

const dialogTitle = computed<string>(() => {
  return editMode.value ? 'Edit Produk' : 'Tambah Produk'
})

/* =========================================================
 * PRODUCT HELPERS
 * ======================================================= */

const getCategoryName = (categoryId: number): string => {
  const category = categoryOptions.find((item) => item.id === categoryId)

  return category?.name ?? '-'
}

const getStockSeverity = (product: Product): 'success' | 'warn' | 'danger' => {
  const effectiveStock = product.stock - (product.reserved ?? 0)

  if (effectiveStock <= 0) {
    return 'danger'
  }

  if (effectiveStock <= product.minimumStock) {
    return 'warn'
  }

  return 'success'
}

const getStockLabel = (product: Product): string => {
  const effectiveStock = product.stock - (product.reserved ?? 0)

  if (effectiveStock <= 0) {
    return 'Habis'
  }

  if (effectiveStock <= product.minimumStock) {
    return 'Rendah'
  }

  return 'Tersedia'
}

const generateProductSku = (): string => {
  return `PRD-${String(Date.now()).slice(-4)}`
}

/* =========================================================
 * FORM HELPERS
 * ======================================================= */

const imagePreview = ref<string | null>(null)
const imageFile = ref<File | null>(null)

const onImageSelect = (event: Event): void => {
  const target = event.target as HTMLInputElement
  if (target.files && target.files[0]) {
    const file = target.files[0]
    imageFile.value = file
    const reader = new FileReader()
    reader.onload = (e) => {
      imagePreview.value = e.target?.result as string
      form.imageUrl = e.target?.result as string
    }
    reader.readAsDataURL(file)
  }
}

const removeImage = (): void => {
  imageFile.value = null
  imagePreview.value = null
  form.imageUrl = null
}

const resetForm = (): void => {
  form.id = null
  form.sku = ''
  form.name = ''

  form.categoryId = null

  form.unit = null

  form.purchase_price = null
  form.selling_price = null

  form.stock = 0
  form.minimumStock = 0

  form.imageUrl = null
  imageFile.value = null
  imagePreview.value = null

  form.isActive = true

  submitted.value = false
}

const resetFilters = (): void => {
  search.value = ''
  selectedCategoryId.value = null
  selectedStockFilter.value = 'all'
}

/* =========================================================
 * DIALOG
 * ======================================================= */

const openCreateDialog = (): void => {
  resetForm()

  editMode.value = false

  form.sku = generateProductSku()

  dialogVisible.value = true
}

const openEditDialog = (product: Product): void => {
  resetForm()

  editMode.value = true

  form.id = product.id
  form.sku = product.sku
  form.name = product.name

  form.categoryId = product.categoryId

  form.unit = product.unit

  form.purchase_price = product.purchase_price
  form.selling_price = product.selling_price

  form.stock = product.stock
  form.minimumStock = product.minimumStock

  form.imageUrl = product.imageUrl ?? null
  imagePreview.value = product.imageUrl ?? null

  form.isActive = product.isActive

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

  const res = zodValidateForm(productSchema, {
    name: form.name,
    code: form.sku,
    price: form.selling_price ?? -1,
    buy_price: form.purchase_price,
    stock: form.stock ?? -1,
    min_stock: form.minimumStock,
    category_id: form.categoryId,
  })

  errors.value = res.errors

  if (form.unit === null) {
    errors.value.unit = 'Satuan wajib dipilih'
  }

  if (!res.success || Object.keys(errors.value).length > 0) {
    return false
  }

  const duplicateSku = products.value.some((product) => {
    return product.sku.toLowerCase() === form.sku.trim().toLowerCase() && product.id !== form.id
  })

  if (duplicateSku) {
    toast.add({
      severity: 'warn',
      summary: 'SKU sudah digunakan',
      detail: `SKU ${form.sku} sudah digunakan produk lain.`,
      life: 3000,
    })

    return false
  }

  if (form.selling_price! < form.purchase_price!) {
    toast.add({
      severity: 'warn',
      summary: 'Harga jual tidak valid',
      detail: 'Harga jual lebih kecil daripada harga beli.',
      life: 3000,
    })

    return false
  }

  return true
}

/* =========================================================
 * SAVE
 * ======================================================= */

const saveProduct = (): void => {
  if (!validateForm()) {
    return
  }

  if (editMode.value && form.id !== null) {
    updateProduct()

    return
  }

  createProduct()
}

const createProduct = async (): Promise<void> => {
  if (
    form.categoryId === null ||
    form.unit === null ||
    form.purchase_price === null ||
    form.selling_price === null ||
    form.stock === null ||
    form.minimumStock === null
  ) {
    return
  }
  isLoading.value = true
  try {
    const payload: CreateProductPayload = {
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      category_id: form.categoryId,
      description: '',
      stock: form.stock,
      minimum_stock: form.minimumStock,
      purchase_price: form.purchase_price,
      selling_price: form.selling_price,
      unit: form.unit,
      image_url: form.imageUrl || undefined,
      is_active: form.isActive,
    }
    await apiCreateProduct(payload)
    await loadProducts()
    dialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Berhasil',
      detail: 'Produk berhasil ditambahkan.',
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

const updateProduct = async (): Promise<void> => {
  if (
    form.id === null ||
    form.categoryId === null ||
    form.unit === null ||
    form.purchase_price === null ||
    form.selling_price === null ||
    form.stock === null ||
    form.minimumStock === null
  ) {
    return
  }
  isLoading.value = true
  try {
    await apiUpdateProduct(form.id, {
      sku: form.sku.trim().toUpperCase(),
      name: form.name.trim(),
      category_id: form.categoryId,
      stock: form.stock,
      minimum_stock: form.minimumStock,
      purchase_price: form.purchase_price,
      selling_price: form.selling_price,
      unit: form.unit,
      image_url: form.imageUrl || undefined,
      is_active: form.isActive,
    })
    await loadProducts()
    dialogVisible.value = false
    toast.add({
      severity: 'success',
      summary: 'Berhasil',
      detail: 'Produk berhasil diperbarui.',
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

const confirmDeleteProduct = (product: Product): void => {
  confirm.require({
    header: 'Hapus Produk',
    message: `Apakah kamu yakin ingin menghapus produk "${product.name}"?`,
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
        await apiDeleteProduct(product.id)
        products.value = products.value.filter((item) => item.id !== product.id)
        toast.add({
          severity: 'success',
          summary: 'Berhasil',
          detail: 'Produk berhasil dihapus.',
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
      <h1 class="text-2xl font-bold text-900 m-0">Master Produk</h1>

      <p class="text-sm text-500 mt-2 mb-0">Kelola data produk, harga, category, dan stok.</p>
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
              <Avatar icon="pi pi-box" shape="square" class="bg-blue-50 text-blue-600" />

              <div>
                <div class="font-semibold text-900">Daftar Produk</div>

                <div class="text-xs text-500 mt-1">{{ products.length }} produk terdaftar</div>
              </div>
            </div>
          </template>

          <template #end>
            <Button label="Tambah Produk" icon="pi pi-plus" @click="openCreateDialog" />
          </template>
        </Toolbar>

        <!-- =================================================
     FILTER
================================================== -->

        <div class="flex flex-column xl:flex-row xl:align-items-center gap-3 mb-4">
          <!-- FILTER INPUTS -->

          <div class="flex flex-column md:flex-row gap-2 flex-1 min-w-0">
            <!-- SEARCH -->

            <IconField class="w-full md:w-20rem">
              <InputIcon class="pi pi-search" />

              <InputText v-model="search" placeholder="Cari SKU, produk..." class="w-full" />
            </IconField>

            <!-- CATEGORY -->

            <Select
              v-model="selectedCategoryId"
              :options="categoryOptions"
              option-label="name"
              option-value="id"
              placeholder="Semua Category"
              show-clear
              filter
              filterBy="name"
              class="w-full md:w-14rem"
            />

            <!-- STOCK -->

            <Select
              v-model="selectedStockFilter"
              :options="stockFilterOptions"
              option-label="label"
              option-value="value"
              class="w-full md:w-12rem"
            />
          </div>

          <!-- RESET -->

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
          :value="products"
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
          <Column field="name" header="PRODUK" sortable style="min-width: 18rem">
            <template #body="{ data }">
              <div class="flex align-items-center gap-3">
                <img
                  v-if="data.imageUrl"
                  :src="data.imageUrl"
                  :alt="data.name"
                  class="w-3rem h-3rem border-round object-cover flex-shrink-0"
                />
                <Avatar
                  v-else
                  icon="pi pi-box"
                  shape="square"
                  class="bg-blue-50 text-blue-600 flex-shrink-0"
                />

                <div class="min-w-0">
                  <div class="font-semibold text-900">
                    {{ data.name }}
                  </div>

                  <div class="flex align-items-center flex-wrap gap-2 mt-1">
                    <span class="text-xs text-500">
                      {{ data.sku }}
                    </span>
                  </div>
                </div>
              </div>
            </template>
          </Column>

          <!-- CATEGORY -->

          <Column field="categoryName" header="CATEGORY" sortable style="min-width: 10rem">
            <template #body="{ data }">
              <Tag :value="data.categoryName" severity="secondary" />
            </template>
          </Column>

          <!-- PURCHASE PRICE -->

          <Column field="purchase_price" header="HARGA BELI" sortable style="min-width: 10rem">
            <template #body="{ data }">
              <div class="font-medium text-900">
                {{ formatCurrencyIDR(data.purchase_price) }}
              </div>
            </template>
          </Column>

          <!-- SELLING PRICE -->

          <Column field="selling_price" header="HARGA JUAL" sortable style="min-width: 10rem">
            <template #body="{ data }">
              <div class="font-semibold text-900">
                {{ formatCurrencyIDR(data.selling_price) }}
              </div>
            </template>
          </Column>

          <!-- STOCK -->

          <Column field="stock" header="STOK" sortable style="min-width: 12rem">
            <template #body="{ data }">
              <div class="flex flex-column gap-1">
                <div class="flex align-items-center gap-2">
                  <span class="font-bold text-900">
                    {{ formatNumberID(data.stock) }}
                  </span>

                  <span class="text-xs text-500">
                    {{ data.unit }}
                  </span>
                </div>

                <Tag
                  :value="getStockLabel(data)"
                  :severity="getStockSeverity(data)"
                  class="align-self-start"
                />
              </div>
            </template>
          </Column>

          <!-- STATUS -->

          <Column field="isActive" header="STATUS" sortable style="min-width: 8rem">
            <template #body="{ data }">
              <Tag
                :value="data.isActive ? 'Aktif' : 'Nonaktif'"
                :severity="data.isActive ? 'success' : 'secondary'"
                rounded
              />
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
                  aria-label="Edit produk"
                  @click="openEditDialog(data)"
                />

                <Button
                  icon="pi pi-trash"
                  severity="danger"
                  text
                  rounded
                  aria-label="Hapus produk"
                  @click="confirmDeleteProduct(data)"
                />
              </div>
            </template>
          </Column>

          <!-- EMPTY -->

          <template #empty>
            <div class="flex flex-column align-items-center justify-content-center gap-3 py-6">
              <Avatar
                icon="pi pi-search"
                size="xlarge"
                shape="circle"
                class="bg-gray-100 text-gray-500"
              />

              <div class="text-center">
                <div class="font-semibold text-900">Produk tidak ditemukan</div>

                <div class="text-sm text-500 mt-1">Ubah keyword atau filter pencarian.</div>
              </div>
            </div>
          </template>
        </DataTable>
      </template>
    </Card>

    <!-- =====================================================
         PRODUCT FORM
    ====================================================== -->

    <Dialog
      v-model:visible="dialogVisible"
      modal
      :header="dialogTitle"
      class="w-full md:w-9 lg:w-7"
      :draggable="false"
      @hide="resetForm"
    >
      <div class="formgrid grid">
        <!-- SKU -->

        <div class="field col-12">
          <label for="product-sku" class="block text-sm font-medium text-900 mb-2"> SKU </label>

          <InputText
            id="product-sku"
            v-model="form.sku"
            :invalid="!!errors.code"
            autocomplete="off"
            class="w-full"
          />

          <Message v-if="errors.code" severity="error" variant="simple" size="small" class="mt-2">
            {{ errors.code }}
          </Message>
        </div>

        <!-- NAME -->

        <div class="field col-12">
          <label for="product-name" class="block text-sm font-medium text-900 mb-2">
            Nama Produk
          </label>

          <InputText
            id="product-name"
            v-model="form.name"
            :invalid="!!errors.name"
            placeholder="Contoh: Kampas Rem Bendix"
            autocomplete="off"
            class="w-full"
          />

          <Message v-if="errors.name" severity="error" variant="simple" size="small" class="mt-2">
            {{ errors.name }}
          </Message>
        </div>

        <!-- CATEGORY -->

        <div class="field col-12 md:col-6">
          <label for="product-category" class="block text-sm font-medium text-900 mb-2">
            Category
          </label>

          <Select
            id="product-category"
            v-model="form.categoryId"
            :options="categoryOptions"
            option-label="name"
            option-value="id"
            placeholder="Pilih category"
            filter
            filterBy="name"
            showClear
            :invalid="!!errors.category_id"
            class="w-full"
          />

          <Message
            v-if="errors.category_id"
            severity="error"
            variant="simple"
            size="small"
            class="mt-2"
          >
            {{ errors.category_id }}
          </Message>
        </div>

        <!-- UNIT -->

        <div class="field col-12 md:col-6">
          <label for="product-unit" class="block text-sm font-medium text-900 mb-2"> Satuan </label>

          <Select
            id="product-unit"
            v-model="form.unit"
            :options="unitOptions"
            option-label="label"
            option-value="value"
            placeholder="Pilih satuan"
            :invalid="!!errors.unit"
            class="w-full"
          />

          <Message v-if="errors.unit" severity="error" variant="simple" size="small" class="mt-2">
            {{ errors.unit }}
          </Message>
        </div>

        <div class="col-12">
          <Divider />
        </div>

        <!-- PURCHASE PRICE -->

        <div class="field col-12 md:col-6">
          <label for="purchase-price" class="block text-sm font-medium text-900 mb-2">
            Harga Beli
          </label>

          <InputNumber
            id="purchase-price"
            v-model="form.purchase_price"
            mode="currency"
            currency="IDR"
            locale="id-ID"
            :min="0"
            :invalid="!!errors.buy_price"
            class="w-full"
            input-class="w-full"
          />

          <Message
            v-if="errors.buy_price"
            severity="error"
            variant="simple"
            size="small"
            class="mt-2"
          >
            {{ errors.buy_price }}
          </Message>
        </div>

        <!-- SELLING PRICE -->

        <div class="field col-12 md:col-6">
          <label for="selling-price" class="block text-sm font-medium text-900 mb-2">
            Harga Jual
          </label>

          <InputNumber
            id="selling-price"
            v-model="form.selling_price"
            mode="currency"
            currency="IDR"
            locale="id-ID"
            :min="0"
            :invalid="!!errors.price"
            class="w-full"
            input-class="w-full"
          />

          <Message v-if="errors.price" severity="error" variant="simple" size="small" class="mt-2">
            {{ errors.price }}
          </Message>
        </div>

        <!-- STOCK -->

        <div class="field col-12 md:col-6">
          <label for="product-stock" class="block text-sm font-medium text-900 mb-2"> Stok </label>

          <InputNumber
            id="product-stock"
            v-model="form.stock"
            :min="0"
            :use-grouping="false"
            :invalid="!!errors.stock"
            class="w-full"
            input-class="w-full"
          />

          <Message v-if="errors.stock" severity="error" variant="simple" size="small" class="mt-2">
            {{ errors.stock }}
          </Message>
        </div>

        <!-- MINIMUM STOCK -->

        <div class="field col-12 md:col-6">
          <label for="minimum-stock" class="block text-sm font-medium text-900 mb-2">
            Minimum Stok
          </label>

          <InputNumber
            id="minimum-stock"
            v-model="form.minimumStock"
            :min="0"
            :use-grouping="false"
            :invalid="!!errors.min_stock"
            class="w-full"
            input-class="w-full"
          />

          <Message
            v-if="errors.min_stock"
            severity="error"
            variant="simple"
            size="small"
            class="mt-2"
          >
            {{ errors.min_stock }}
          </Message>
        </div>

        <!-- IMAGE UPLOAD -->

        <div class="field col-12 mb-3">
          <label class="block text-sm font-medium text-900 mb-2"> Foto Produk </label>

          <div class="flex align-items-center gap-3">
            <div
              v-if="imagePreview"
              class="relative w-6rem h-6rem border-round surface-100 overflow-hidden flex-shrink-0"
            >
              <img
                :src="imagePreview"
                alt="Preview Foto Produk"
                class="w-full h-full object-cover"
              />

              <Button
                icon="pi pi-times"
                severity="danger"
                rounded
                text
                class="absolute top-0 right-0"
                style="background: rgba(0, 0, 0, 0.5); color: #fff; width: 1.5rem; height: 1.5rem"
                @click="removeImage"
              />
            </div>

            <div
              v-else
              class="w-6rem h-6rem border-round surface-200 flex flex-column align-items-center justify-content-center text-400 border-dashed border-2 flex-shrink-0"
            >
              <i class="pi pi-image text-2xl mb-1"></i>

              <span class="text-xs">Foto</span>
            </div>

            <div class="flex flex-column gap-2">
              <label
                for="product-image-upload"
                class="p-button p-component p-button-outlined p-button-secondary p-button-sm cursor-pointer inline-flex align-items-center gap-2 m-0"
              >
                <i class="pi pi-upload"></i>

                <span>{{ imagePreview ? 'Ubah Foto' : 'Pilih Foto' }}</span>
              </label>

              <input
                id="product-image-upload"
                type="file"
                accept="image/*"
                class="hidden"
                @change="onImageSelect"
              />

              <span class="text-xs text-500">Format: JPG, PNG, WEBP. Maks 2MB.</span>
            </div>
          </div>
        </div>
        <!-- STATUS -->

        <div class="field col-12">
          <div class="flex align-items-center justify-content-between gap-3">
            <div>
              <div class="text-sm font-medium text-900">Status Produk</div>

              <div class="text-xs text-500 mt-1">Produk aktif dapat digunakan dalam transaksi.</div>
            </div>

            <div class="flex align-items-center gap-2">
              <span class="text-sm" :class="form.isActive ? 'text-green-600' : 'text-500'">
                {{ form.isActive ? 'Aktif' : 'Nonaktif' }}
              </span>

              <ToggleSwitch v-model="form.isActive" />
            </div>
          </div>
        </div>
      </div>

      <!-- =================================================
           DIALOG FOOTER
      ================================================== -->

      <template #footer>
        <Button label="Batal" severity="secondary" outlined @click="closeDialog" />

        <Button
          :label="editMode ? 'Simpan Perubahan' : 'Tambah Produk'"
          :icon="editMode ? 'pi pi-check' : 'pi pi-plus'"
          @click="saveProduct"
        />
      </template>
    </Dialog>
  </div>
</template>
