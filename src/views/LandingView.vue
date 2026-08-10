<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'

import Badge from 'primevue/badge'
import Button from 'primevue/button'
import Card from 'primevue/card'
import Dialog from 'primevue/dialog'
import Divider from 'primevue/divider'
import Drawer from 'primevue/drawer'
import IconField from 'primevue/iconfield'
import Image from 'primevue/image'
import InputIcon from 'primevue/inputicon'
import InputText from 'primevue/inputtext'
import Menu from 'primevue/menu'
import Popover from 'primevue/popover'
import ProgressSpinner from 'primevue/progressspinner'
import RadioButton from 'primevue/radiobutton'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'

import { formatCurrencyIDR } from '@/utils/format'
import { getSession, clearSession } from '@/services/authService'
import { fetchCategories } from '@/services/categoryService'
import { fetchProducts } from '@/services/productService'
import { createOrder } from '@/services/orderService'
import { createSnapToken, loadSnapScript } from '@/services/paymentService'
import type { Category } from '@/types/category'
import type { Product } from '@/types/product'

interface CategoryOption {
  id: number | 'all'
  name: string
  icon: string
}

interface CartItem {
  productId: number
  sku: string
  name: string
  price: number
  quantity: number
  stock: number // Effective stock limit
  imageUrl?: string | null
}

const TAX_RATE = 0.11
const toast = useToast()
const router = useRouter()

const searchQuery = ref('')
const selectedCategoryId = ref<number | 'all'>('all')

const profilePopover = ref()
const currentSession = ref(getSession())
const isLoggedIn = computed(() => !!currentSession.value && !currentSession.value.isGuest)
const currentUserName = computed(() => currentSession.value?.name || currentSession.value?.username || 'User')

const toggleProfilePopover = (event: Event) => {
  currentSession.value = getSession()
  profilePopover.value.toggle(event)
}

const handleLogout = () => {
  clearSession()
  currentSession.value = null
  if (profilePopover.value) {
    profilePopover.value.hide()
  }
  toast.add({
    severity: 'info',
    summary: 'Logout Berhasil',
    detail: 'Anda telah keluar dari akun.',
    life: 3000,
  })
}

const isLoadingCategories = ref(false)
const isLoadingProducts = ref(false)

const categories = ref<CategoryOption[]>([])
const products = ref<Product[]>([])

/* =========================================================
 * CART STATE & COMPUTED
 * ======================================================= */
const isCartOpen = ref(false)
const cart = ref<CartItem[]>([])

const cartCount = computed<number>(() =>
  cart.value.reduce((total, item) => total + item.quantity, 0)
)

const subtotal = computed<number>(() =>
  cart.value.reduce((total, item) => total + item.price * item.quantity, 0)
)

const tax = computed<number>(() => subtotal.value * TAX_RATE)

const grandTotal = computed<number>(() => subtotal.value + tax.value)

/* =========================================================
 * CATEGORY ICON HELPER
 * ======================================================= */
const getCategoryIcon = (name: string): string => {
  const n = name.toLowerCase()
  if (n.includes('mesin') || n.includes('engine')) return 'pi pi-cog'
  if (n.includes('rem') || n.includes('brake')) return 'pi pi-sliders-h'
  if (n.includes('suspensi') || n.includes('suspension')) return 'pi pi-arrows-v'
  if (n.includes('listrik') || n.includes('electric') || n.includes('kelistrikan')) return 'pi pi-bolt'
  if (n.includes('filter')) return 'pi pi-filter'
  if (n.includes('oli') || n.includes('oil')) return 'pi pi-tint'
  if (n.includes('ban') || n.includes('wheel') || n.includes('velg')) return 'pi pi-spin pi-spinner'
  return 'pi pi-box'
}

/* =========================================================
 * STOCK EVALUATION HELPERS
 * ======================================================= */
const getEffectiveStock = (product: Product): number => {
  return Math.max(0, product.stock - (product.reserved ?? 0))
}

const isOutOfStock = (product: Product): boolean => {
  return getEffectiveStock(product) <= 0
}

const isLowStock = (product: Product): boolean => {
  const effective = getEffectiveStock(product)
  if (effective <= 0) return false
  const min = product.minimumStock && product.minimumStock > 0 ? product.minimumStock : 5
  return effective <= min
}

const isCartMaxed = (product: Product): boolean => {
  const effective = getEffectiveStock(product)
  const cartItem = cart.value.find((i) => i.productId === product.id)
  return cartItem ? cartItem.quantity >= effective : false
}

/* =========================================================
 * DATA LOADERS
 * ======================================================= */
const loadCategories = async (): Promise<void> => {
  isLoadingCategories.value = true
  try {
    const res = await fetchCategories({ limit: 100 })
    categories.value = [
      { id: 'all', name: 'Semua Kategori', icon: 'pi pi-th-large' },
      ...res.data.map((c: Category) => ({
        id: c.id as number,
        name: c.name,
        icon: getCategoryIcon(c.name),
      })),
    ]
  } catch (err) {
    console.error('[LandingView] Failed to load categories:', err)
  } finally {
    isLoadingCategories.value = false
  }
}

const loadProducts = async (): Promise<void> => {
  isLoadingProducts.value = true
  try {
    const params: Record<string, any> = { limit: 100, low_stock_priority: false }
    if (selectedCategoryId.value !== 'all') params.category_id = selectedCategoryId.value
    if (searchQuery.value.trim()) params.q = searchQuery.value.trim()
    const res = await fetchProducts(params)
    products.value = res.data
  } catch (err) {
    console.error('[LandingView] Failed to load products:', err)
  } finally {
    isLoadingProducts.value = false
  }
}

const handleCategorySelect = async (catId: number | 'all'): Promise<void> => {
  selectedCategoryId.value = catId
  await loadProducts()
}

let searchTimeout: ReturnType<typeof setTimeout> | null = null
const handleSearchInput = (): void => {
  if (searchTimeout) clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadProducts()
  }, 400)
}

/* =========================================================
 * CART HANDLERS WITH EFFECTIVE STOCK LIMIT
 * ======================================================= */
const handleAddToCart = (product: Product): void => {
  const effective = getEffectiveStock(product)

  if (effective <= 0) {
    toast.add({
      severity: 'error',
      summary: 'Stok Habis',
      detail: `Stok produk ${product.name} sedang habis.`,
      life: 3000,
    })
    return
  }

  const existing = cart.value.find((item) => item.productId === product.id)

  if (existing) {
    if (existing.quantity >= effective) {
      toast.add({
        severity: 'warn',
        summary: 'Batas Stok Tercapai',
        detail: `Stok efektif ${product.name} hanya tersedia ${effective} item.`,
        life: 3500,
      })
      return
    }
    cart.value = cart.value.map((item) =>
      item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
    )
  } else {
    cart.value = [
      ...cart.value,
      {
        productId: product.id,
        sku: product.sku,
        name: product.name,
        price: product.selling_price,
        quantity: 1,
        stock: effective,
        imageUrl: product.imageUrl,
      },
    ]
  }

  toast.add({
    severity: 'success',
    summary: 'Keranjang',
    detail: `${product.name} ditambahkan ke keranjang`,
    life: 2500,
  })
}

const increaseQuantity = (productId: number): void => {
  const item = cart.value.find((i) => i.productId === productId)
  if (!item) return

  if (item.quantity >= item.stock) {
    toast.add({
      severity: 'warn',
      summary: 'Batas Stok Tercapai',
      detail: `Stok efektif item ini hanya tersedia ${item.stock} item.`,
      life: 3000,
    })
    return
  }

  cart.value = cart.value.map((i) =>
    i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
  )
}

const decreaseQuantity = (productId: number): void => {
  cart.value = cart.value
    .map((item) =>
      item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item
    )
    .filter((item) => item.quantity > 0)
}

const removeCartItem = (productId: number): void => {
  cart.value = cart.value.filter((item) => item.productId !== productId)
}

/* =========================================================
 * CHECKOUT & PAYMENT MODAL STATE & LOGIC
 * ======================================================= */
const isCheckoutModalOpen = ref(false)
const isSuccessModalOpen = ref(false)
const isSubmittingCheckout = ref(false)
const isUserLoggedIn = ref(false)

const customerForm = ref({
  name: '',
  email: '',
  phone: '',
  address: '',
})

const paymentMethod = ref<'midtrans' | 'cash'>('midtrans')
const createdOrderNumber = ref('')
const createdOrderStatus = ref('')

const openCheckoutModal = (): void => {
  const session = getSession()
  if (session && !session.isGuest) {
    isUserLoggedIn.value = true
    customerForm.value.name = session.name || ''
    customerForm.value.email = session.email || ''
    customerForm.value.phone = ''
  } else {
    isUserLoggedIn.value = false
  }
  isCartOpen.value = false
  isCheckoutModalOpen.value = true
}

const handleProcessCheckout = async (): Promise<void> => {
  if (!customerForm.value.name.trim()) {
    toast.add({
      severity: 'error',
      summary: 'Data Tidak Lengkap',
      detail: 'Nama pemesan wajib diisi.',
      life: 3000,
    })
    return
  }
  if (!customerForm.value.phone.trim()) {
    toast.add({
      severity: 'error',
      summary: 'Data Tidak Lengkap',
      detail: 'Nomor telepon wajib diisi untuk konfirmasi pengambilan.',
      life: 3000,
    })
    return
  }

  isSubmittingCheckout.value = true

  try {
    const session = getSession()
    const payload = {
      user_id: session?.id ?? null,
      amount_paid: 0,
      change_amount: 0,
      source: 'web',
      payment_method: paymentMethod.value,
      status: 'reserved',
      notes: customerForm.value.address
        ? `Alamat/Catatan: ${customerForm.value.address}`
        : 'Pesanan Web App',
      items: cart.value.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
      })),
    }

    const order = await createOrder(payload)
    createdOrderNumber.value = order.order_number
    createdOrderStatus.value = paymentMethod.value === 'midtrans' ? 'Menunggu Pembayaran Midtrans' : 'Menunggu Konfirmasi Admin / Ambil di Toko'

    if (paymentMethod.value === 'midtrans') {
      try {
        await loadSnapScript()
        const snap = await createSnapToken(order.id)

        isCheckoutModalOpen.value = false

        if ((window as any).snap) {
          ;(window as any).snap.pay(snap.token, {
            onSuccess: () => {
              toast.add({
                severity: 'success',
                summary: 'Pembayaran Berhasil',
                detail: `Pesanan ${order.order_number} telah berhasil dibayar!`,
                life: 5000,
              })
              createdOrderStatus.value = 'Pembayaran Lunas (Paid)'
              cart.value = []
              isSuccessModalOpen.value = true
            },
            onPending: () => {
              toast.add({
                severity: 'info',
                summary: 'Menunggu Pembayaran',
                detail: `Silakan selesaikan pembayaran untuk pesanan ${order.order_number}.`,
                life: 5000,
              })
              cart.value = []
              isSuccessModalOpen.value = true
            },
            onError: () => {
              toast.add({
                severity: 'error',
                summary: 'Pembayaran Gagal',
                detail: 'Proses pembayaran Midtrans mengalami kendala.',
                life: 4000,
              })
            },
            onClose: () => {
              toast.add({
                severity: 'warn',
                summary: 'Popup Ditutup',
                detail: `Pesanan ${order.order_number} tersimpan. Anda dapat membayar sewaktu-waktu.`,
                life: 4000,
              })
              cart.value = []
              isSuccessModalOpen.value = true
            },
          })
        }
      } catch (err: any) {
        toast.add({
          severity: 'error',
          summary: 'Midtrans Error',
          detail: err.message || 'Gagal menghubungkan pembayaran Midtrans.',
          life: 4000,
        })
      }
    } else {
      // Cash payment
      cart.value = []
      isCheckoutModalOpen.value = false
      isSuccessModalOpen.value = true
      toast.add({
        severity: 'success',
        summary: 'Order Berhasil',
        detail: `Order ${order.order_number} berhasil dibuat. Silakan bayar & ambil barang di toko!`,
        life: 5000,
      })
    }
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Checkout Gagal',
      detail: err.message || 'Terjadi kesalahan saat memproses order.',
      life: 4000,
    })
  } finally {
    isSubmittingCheckout.value = false
  }
}

onMounted(async () => {
  await loadCategories()
  await loadProducts()
})
</script>

<template>
  <div class="min-h-screen bg-gray-50 flex flex-column font-sans text-900">
    <!-- ==========================================
         1. TOP NAVBAR
    =========================================== -->
    <header class="bg-white border-bottom-1 surface-border sticky top-0 z-5 shadow-1">
      <div class="max-w-7xl mx-auto px-4 py-3 flex align-items-center justify-content-between gap-3">
        <!-- Logo -->
        <div class="flex align-items-center gap-2">
          <span class="text-2xl font-extrabold text-blue-700 tracking-tight cursor-pointer">
            Niaga AutoParts
          </span>
        </div>

        <!-- Right Search & Actions -->
        <div class="flex align-items-center gap-3">
          <IconField class="w-14rem md:w-18rem">
            <InputIcon class="pi pi-search text-400" />
            <InputText
              v-model="searchQuery"
              placeholder="Cari nomor suku cadang..."
              class="w-full border-round-lg surface-100 border-none text-sm"
              @input="handleSearchInput"
              @keyup.enter="loadProducts"
            />
          </IconField>

          <!-- Cart Icon Button with Badge -->
          <div class="relative flex align-items-center">
            <Button
              icon="pi pi-shopping-bag"
              rounded
              text
              severity="secondary"
              aria-label="Shopping Cart"
              @click="isCartOpen = true"
            />
            <Badge
              v-if="cartCount > 0"
              :value="String(cartCount)"
              severity="primary"
              class="absolute top-0 right-0 pointer-events-none"
              style="transform: translate(20%, -20%);"
            />
          </div>

          <!-- User Profile Button & Popover -->
          <div class="relative">
            <Button
              icon="pi pi-user"
              rounded
              text
              severity="secondary"
              aria-label="User Profile"
              @click="toggleProfilePopover"
            />
            <Popover ref="profilePopover">
              <div class="p-3 w-14rem flex flex-column gap-3">
                <template v-if="isLoggedIn">
                  <div class="flex align-items-center gap-2 pb-2 border-bottom-1 surface-border">
                    <div class="w-2rem h-2rem border-circle bg-blue-100 text-blue-700 flex align-items-center justify-content-center font-bold">
                      <i class="pi pi-user text-sm"></i>
                    </div>
                    <div class="flex flex-column min-w-0">
                      <span class="font-semibold text-sm text-900 truncate">{{ currentUserName }}</span>
                      <span class="text-xs text-500 capitalize">{{ currentSession?.role || 'User' }}</span>
                    </div>
                  </div>
                  <Button
                    label="Logout"
                    icon="pi pi-sign-out"
                    severity="danger"
                    outlined
                    size="small"
                    class="w-full"
                    @click="handleLogout"
                  />
                </template>
                <template v-else>
                  <div class="text-sm text-600 mb-1">Anda belum login.</div>
                  <Button
                    label="Login"
                    icon="pi pi-sign-in"
                    severity="primary"
                    size="small"
                    class="w-full"
                    @click="router.push('/login')"
                  />
                </template>
              </div>
            </Popover>
          </div>
        </div>
      </div>
    </header>

    <!-- MAIN CONTENT CONTAINER -->
    <main class="max-w-7xl mx-auto px-4 py-3 flex-1 w-full flex flex-column gap-4 md:gap-5">
      <!-- ==========================================
           2. HERO BANNER
      =========================================== -->
      <section class="relative border-round-2xl overflow-hidden shadow-3 bg-gray-900 text-white min-h-16rem flex align-items-center p-5 md:p-6">
        <!-- Background Image with Overlay -->
        <div
          class="absolute inset-0 bg-cover bg-center z-0"
          style="background-image: url('/images/hero_engine.png'); opacity: 0.35;"
        />
        <div
          class="absolute inset-0 z-1"
          style="background: linear-gradient(to right, rgba(15, 23, 42, 0.95) 0%, rgba(15, 23, 42, 0.7) 60%, rgba(15, 23, 42, 0.4) 100%);"
        />

        <!-- Banner Content -->
        <div class="relative z-2 max-w-3xl flex flex-column gap-2">
          <h1 class="text-2xl md:text-4xl font-extrabold line-height-2 m-0 text-white tracking-tight">
            Temukan Suku Cadang Berkualitas<br />untuk Kendaraan Anda
          </h1>
          <p class="text-gray-300 text-sm md:text-base line-height-3 m-0 max-w-2xl font-normal">
            Presisi mekanis untuk performa optimal. Cari berdasarkan model, SKU, atau kategori untuk inventaris real-time.
          </p>
        </div>
      </section>

      <!-- ==========================================
           3. KATEGORI UTAMA (INTEGRATED WITH API)
      =========================================== -->
      <section>
        <div class="flex align-items-center justify-content-between mb-3">
          <h2 class="text-lg md:text-xl font-bold text-900 m-0 tracking-tight">
            Kategori Utama
          </h2>
          <ProgressSpinner
            v-if="isLoadingCategories"
            style="width: 1.25rem; height: 1.25rem"
            stroke-width="4"
          />
        </div>

        <div class="grid">
          <div
            v-for="cat in categories"
            :key="cat.id"
            class="col-6 sm:col-4 md:col-3"
          >
            <Card
              class="shadow-none border-1 border-round-xl text-center cursor-pointer transition-all duration-200"
              :class="[
                selectedCategoryId === cat.id
                  ? 'border-blue-600 surface-50 shadow-2'
                  : 'surface-border hover:shadow-2'
              ]"
              @click="handleCategorySelect(cat.id)"
            >
              <template #content>
                <div class="flex flex-column align-items-center justify-content-center gap-2 p-1">
                  <div
                    class="border-round-lg p-2 flex align-items-center justify-content-center"
                    :class="[selectedCategoryId === cat.id ? 'bg-blue-600 text-white' : 'surface-100 text-700']"
                    style="width: 2.75rem; height: 2.75rem"
                  >
                    <i :class="[cat.icon, 'text-xl']" />
                  </div>
                  <span
                    class="font-semibold text-xs text-center"
                    :class="[selectedCategoryId === cat.id ? 'text-blue-700' : 'text-800']"
                  >
                    {{ cat.name }}
                  </span>
                </div>
              </template>
            </Card>
          </div>
        </div>
      </section>

      <!-- ==========================================
           4. PRODUK UNGGULAN (INTEGRATED WITH API)
      =========================================== -->
      <section>
        <div class="flex align-items-center justify-content-between mb-3">
          <h2 class="text-lg md:text-xl font-bold text-900 m-0 tracking-tight">
            Produk Unggulan
          </h2>
          <Button
            label="Lihat Semua"
            icon="pi pi-arrow-right"
            iconPos="right"
            text
            size="small"
            class="p-0 font-semibold text-blue-600 text-xs"
            @click="handleCategorySelect('all')"
          />
        </div>

        <!-- Spinner Loading Products -->
        <div v-if="isLoadingProducts" class="flex justify-content-center align-items-center py-6">
          <ProgressSpinner style="width: 2.5rem; height: 2.5rem" stroke-width="4" />
        </div>

        <!-- Products Grid -->
        <div v-else class="grid">
          <div
            v-for="product in products"
            :key="product.id"
            class="col-6 md:col-4 lg:col-3"
          >
            <Card
              class="shadow-none border-1 surface-border border-round-xl overflow-hidden relative flex flex-column h-full transition-all duration-200 hover:shadow-2"
              :class="{ 'opacity-70': isLowStock(product) || isOutOfStock(product) }"
            >
              <template #header>
                <div class="relative surface-100 overflow-hidden" style="height: 8.5rem">
                  <Image
                    v-if="product.imageUrl"
                    :src="product.imageUrl"
                    :alt="product.name"
                    imageClass="w-full h-full object-cover"
                    :imageStyle="{ height: '8.5rem', width: '100%', objectFit: 'cover' }"
                  />
                  <div
                    v-else
                    class="flex align-items-center justify-content-center h-full surface-100"
                  >
                    <i class="pi pi-image text-4xl text-400" />
                  </div>

                  <!-- Overlay for Low Stock / Out of Stock -->
                  <div
                    v-if="isLowStock(product) || isOutOfStock(product)"
                    class="absolute inset-0 bg-white-alpha-40 pointer-events-none z-1"
                  />

                  <!-- Tag Badge: Only shown when LOW STOCK -->
                  <Tag
                    v-if="isLowStock(product)"
                    value="LOW STOCK"
                    severity="warn"
                    class="absolute top-0 right-0 m-2 text-xs font-bold uppercase tracking-wider z-2"
                    style="font-size: 0.65rem; line-height: 1;"
                  />
                </div>
              </template>

              <template #content>
                <div class="flex flex-column h-full justify-content-between gap-1.5 p-1">
                  <div>
                    <span class="text-xs text-400 font-semibold uppercase tracking-wider block mb-0.5" style="font-size: 0.7rem">
                      {{ product.sku }}
                    </span>
                    <div class="text-900 font-medium text-sm line-height-2 line-clamp-2 mb-1">
                      {{ product.name }}
                    </div>
                  </div>

                  <!-- Price & Cart Button -->
                  <div class="flex align-items-center justify-content-between mt-1 pt-1">
                    <span class="text-blue-600 text-base font-bold">
                      {{ formatCurrencyIDR(product.selling_price) }}
                    </span>

                    <Button
                      icon="pi pi-shopping-cart"
                      severity="secondary"
                      rounded
                      size="small"
                      class="surface-100 hover:surface-200 border-none text-700 p-0"
                      style="width: 2rem; height: 2rem"
                      :disabled="isOutOfStock(product) || isCartMaxed(product)"
                      @click="handleAddToCart(product)"
                    />
                  </div>
                </div>
              </template>
            </Card>
          </div>

          <!-- Empty State -->
          <div v-if="!products.length" class="col-12">
            <div class="flex flex-column align-items-center justify-content-center gap-2 py-8 text-color-secondary">
              <i class="pi pi-search text-4xl" />
              <span>Produk tidak ditemukan</span>
            </div>
          </div>
        </div>
      </section>
    </main>

    <!-- ==========================================
         5. DRAWER KERANJANG BELANJA (CART DRAWER)
    =========================================== -->
    <Drawer
      v-model:visible="isCartOpen"
      header="Keranjang Belanja"
      position="right"
      style="width: 26rem"
    >
      <div class="flex flex-column h-full">
        <!-- Empty Cart -->
        <div
          v-if="!cart.length"
          class="flex flex-column align-items-center justify-content-center gap-3 my-auto py-8 text-color-secondary"
        >
          <i class="pi pi-shopping-bag text-6xl text-300" />
          <span class="font-medium text-base">Keranjang Anda masih kosong</span>
        </div>

        <!-- Cart Items List -->
        <div v-else class="flex-1 overflow-y-auto flex flex-column gap-3 pr-1">
          <div
            v-for="item in cart"
            :key="item.productId"
            class="surface-card border-1 surface-border border-round-xl p-3 flex flex-column gap-2"
          >
            <div class="flex justify-content-between gap-3">
              <div class="flex-1">
                <span class="text-xs text-400 font-semibold uppercase tracking-wider block">
                  {{ item.sku }}
                </span>
                <div class="font-semibold text-sm text-900 mt-1">
                  {{ item.name }}
                </div>
                <div class="text-blue-600 font-bold text-sm mt-1">
                  {{ formatCurrencyIDR(item.price) }}
                </div>
              </div>
              <Button
                icon="pi pi-trash"
                severity="danger"
                text
                rounded
                size="small"
                aria-label="Hapus Item"
                @click="removeCartItem(item.productId)"
              />
            </div>

            <Divider class="my-1" />

            <div class="flex align-items-center justify-content-between">
              <div class="flex align-items-center gap-2">
                <Button
                  icon="pi pi-minus"
                  rounded
                  outlined
                  size="small"
                  class="w-2rem h-2rem p-0"
                  @click="decreaseQuantity(item.productId)"
                />
                <span class="font-semibold text-sm text-center" style="min-width: 1.5rem">
                  {{ item.quantity }}
                </span>
                <Button
                  icon="pi pi-plus"
                  rounded
                  outlined
                  size="small"
                  class="w-2rem h-2rem p-0"
                  :disabled="item.quantity >= item.stock"
                  @click="increaseQuantity(item.productId)"
                />
              </div>

              <span class="font-bold text-900 text-sm">
                {{ formatCurrencyIDR(item.price * item.quantity) }}
              </span>
            </div>
          </div>
        </div>

        <!-- Summary & Checkout Footer -->
        <div v-if="cart.length" class="border-top-1 surface-border pt-3 mt-auto">
          <div class="flex flex-column gap-2">
            <div class="flex justify-content-between text-sm">
              <span class="text-color-secondary">Subtotal</span>
              <span class="font-medium">{{ formatCurrencyIDR(subtotal) }}</span>
            </div>
            <div class="flex justify-content-between text-sm">
              <span class="text-color-secondary">Pajak (11%)</span>
              <span class="font-medium">{{ formatCurrencyIDR(tax) }}</span>
            </div>
            <Divider class="my-1" />
            <div class="flex justify-content-between text-lg font-bold">
              <span>Total</span>
              <span class="text-blue-600">{{ formatCurrencyIDR(grandTotal) }}</span>
            </div>
            <Button
              label="Lanjut ke Pembayaran"
              icon="pi pi-check"
              class="w-full mt-2 font-semibold"
              severity="primary"
              @click="openCheckoutModal"
            />
          </div>
        </div>
      </div>
    </Drawer>

    <!-- ==========================================
         6. MODAL CHECKOUT & FORM PEMBAYARAN
    =========================================== -->
    <Dialog
      v-model:visible="isCheckoutModalOpen"
      modal
      header="Konfirmasi Checkout & Pembayaran"
      style="width: 32rem"
      :breakpoints="{ '960px': '75vw', '641px': '95vw' }"
    >
      <div class="flex flex-column gap-4 pt-2">
        <!-- 1. Status Login Info -->
        <div
          class="p-3 border-round-xl flex align-items-center justify-content-between"
          :class="isUserLoggedIn ? 'bg-blue-50 border-1 border-blue-200' : 'bg-gray-100 border-1 border-gray-200'"
        >
          <div class="flex align-items-center gap-2">
            <i :class="[isUserLoggedIn ? 'pi pi-user-check text-blue-600' : 'pi pi-user text-600', 'text-xl']" />
            <div>
              <div class="font-bold text-sm" :class="isUserLoggedIn ? 'text-blue-900' : 'text-800'">
                {{ isUserLoggedIn ? 'Customer Terdaftar' : 'Pemesanan Tanpa Akun (Guest)' }}
              </div>
              <div class="text-xs text-500">
                {{ isUserLoggedIn ? 'Data diri diisi otomatis dari sesi Anda' : 'Silakan isi data kontak di bawah' }}
              </div>
            </div>
          </div>
          <Tag :severity="isUserLoggedIn ? 'info' : 'secondary'" :value="isUserLoggedIn ? 'Autofill' : 'Guest'" />
        </div>

        <!-- 2. Form Data Diri -->
        <div class="flex flex-column gap-3">
          <div class="font-semibold text-sm text-900 border-bottom-1 surface-border pb-1">
            Data Pemesan
          </div>
          <div class="flex flex-column gap-1">
            <label for="cust-name" class="text-xs font-semibold text-700">Nama Lengkap *</label>
            <InputText id="cust-name" v-model="customerForm.name" placeholder="Masukkan nama lengkap" class="w-full text-sm" />
          </div>
          <div class="grid">
            <div class="col-12 sm:col-6 flex flex-column gap-1">
              <label for="cust-phone" class="text-xs font-semibold text-700">Nomor Telepon / WA *</label>
              <InputText id="cust-phone" v-model="customerForm.phone" placeholder="08xxxxxxxxxx" class="w-full text-sm" />
            </div>
            <div class="col-12 sm:col-6 flex flex-column gap-1">
              <label for="cust-email" class="text-xs font-semibold text-700">Email</label>
              <InputText id="cust-email" v-model="customerForm.email" placeholder="nama@email.com" class="w-full text-sm" />
            </div>
          </div>
          <div class="flex flex-column gap-1">
            <label for="cust-address" class="text-xs font-semibold text-700">Alamat Pengiriman / Catatan</label>
            <Textarea id="cust-address" v-model="customerForm.address" rows="2" placeholder="Catatan khusus atau alamat pengambilan..." class="w-full text-sm" />
          </div>
        </div>

        <!-- 3. Pilih Metode Pembayaran -->
        <div class="flex flex-column gap-3">
          <div class="font-semibold text-sm text-900 border-bottom-1 surface-border pb-1">
            Pilih Metode Pembayaran
          </div>
          <div class="flex flex-column gap-2">
            <div
              class="p-3 border-1 border-round-xl cursor-pointer flex align-items-center justify-content-between transition-all"
              :class="paymentMethod === 'midtrans' ? 'border-blue-600 bg-blue-50 shadow-1' : 'surface-border hover:surface-100'"
              @click="paymentMethod = 'midtrans'"
            >
              <div class="flex align-items-center gap-3">
                <RadioButton v-model="paymentMethod" value="midtrans" />
                <div>
                  <div class="font-bold text-sm text-900">Pembayaran Online (Midtrans)</div>
                  <div class="text-xs text-500">QRIS, Bank Transfer, GoPay, ShopeePay, Kartu Kredit</div>
                </div>
              </div>
              <i class="pi pi-credit-card text-xl text-blue-600" />
            </div>

            <div
              class="p-3 border-1 border-round-xl cursor-pointer flex align-items-center justify-content-between transition-all"
              :class="paymentMethod === 'cash' ? 'border-blue-600 bg-blue-50 shadow-1' : 'surface-border hover:surface-100'"
              @click="paymentMethod = 'cash'"
            >
              <div class="flex align-items-center gap-3">
                <RadioButton v-model="paymentMethod" value="cash" />
                <div>
                  <div class="font-bold text-sm text-900">Bayar Cash di Toko</div>
                  <div class="text-xs text-500">Bayar saat mengambil barang di toko secara langsung</div>
                </div>
              </div>
              <i class="pi pi-money-bill text-xl text-green-600" />
            </div>
          </div>
        </div>

        <!-- 4. Ringkasan Total & Tombol Bayar -->
        <div class="surface-100 border-round-xl p-3 flex flex-column gap-2 mt-1">
          <div class="flex justify-content-between text-xs text-600">
            <span>Jumlah Item:</span>
            <span class="font-semibold">{{ cartCount }} item</span>
          </div>
          <div class="flex justify-content-between text-xs text-600">
            <span>Pajak (11%):</span>
            <span class="font-semibold">{{ formatCurrencyIDR(tax) }}</span>
          </div>
          <Divider class="my-1" />
          <div class="flex justify-content-between align-items-center">
            <span class="font-bold text-sm text-900">Total Pembayaran:</span>
            <span class="font-extrabold text-lg text-blue-600">{{ formatCurrencyIDR(grandTotal) }}</span>
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-content-end gap-2 w-full pt-2">
          <Button label="Batal" severity="secondary" text @click="isCheckoutModalOpen = false" />
          <Button
            :label="paymentMethod === 'midtrans' ? 'Bayar via Midtrans' : 'Konfirmasi Pesanan'"
            :icon="isSubmittingCheckout ? 'pi pi-spin pi-spinner' : 'pi pi-check'"
            severity="primary"
            class="font-semibold"
            :disabled="isSubmittingCheckout"
            @click="handleProcessCheckout"
          />
        </div>
      </template>
    </Dialog>

    <!-- ==========================================
         7. MODAL SUCCESS / NOTIFIKASI ORDER
    =========================================== -->
    <Dialog
      v-model:visible="isSuccessModalOpen"
      modal
      header="Status Pesanan"
      style="width: 28rem"
    >
      <div class="flex flex-column align-items-center justify-content-center text-center gap-3 py-3">
        <div class="bg-green-100 border-circle p-3 flex align-items-center justify-content-center" style="width: 4.5rem; height: 4.5rem">
          <i class="pi pi-check-circle text-4xl text-green-600" />
        </div>
        <div>
          <h3 class="text-xl font-bold text-900 m-0 mb-1">Pesanan Berhasil Dibuat!</h3>
          <p class="text-sm text-600 m-0">Kode Pesanan Anda:</p>
          <div class="text-lg font-mono font-bold text-blue-600 bg-blue-50 py-1.5 px-3 border-round-lg border-1 border-blue-200 mt-1 inline-block">
            {{ createdOrderNumber }}
          </div>
        </div>

        <div class="surface-100 border-round-xl p-3 text-left w-full flex flex-column gap-1 text-xs text-700">
          <div class="flex justify-content-between">
            <span class="text-500">Status Pembayaran:</span>
            <span class="font-bold text-blue-700">{{ createdOrderStatus }}</span>
          </div>
          <div class="flex justify-content-between">
            <span class="text-500">Metode:</span>
            <span class="font-semibold uppercase">{{ paymentMethod }}</span>
          </div>
        </div>

        <p class="text-xs text-500 m-0 line-height-3">
          Tunjukkan Kode Pesanan di atas saat datang ke toko untuk pengambilan barang. Reservasi stok berlaku selama 15 menit.
        </p>
      </div>

      <template #footer>
        <div class="flex justify-content-center w-full">
          <Button label="Kembali ke Katalog" severity="primary" class="w-full font-semibold" @click="isSuccessModalOpen = false" />
        </div>
      </template>
    </Dialog>

    <!-- ==========================================
         8. FOOTER
    =========================================== -->
    <footer class="bg-gray-900 text-white mt-auto border-top-1 surface-border py-5 px-4">
      <div class="max-w-7xl mx-auto flex flex-column md:flex-row align-items-center justify-content-between gap-4">
        <div>
          <div class="text-xl font-bold tracking-tight text-white mb-1">
            Niaga AutoParts
          </div>
          <div class="text-xs text-gray-400 font-normal">
            © 2024 Niaga AutoParts. Precision Engineering.
          </div>
        </div>

        <div class="flex flex-wrap align-items-center gap-4 text-xs text-gray-400 font-medium">
          <a href="#" class="hover:text-white transition-colors cursor-pointer">Privacy Policy</a>
          <a href="#" class="hover:text-white transition-colors cursor-pointer">Terms of Service</a>
          <a href="#" class="hover:text-white transition-colors cursor-pointer">Shipping Info</a>
          <a href="#" class="hover:text-white transition-colors cursor-pointer">Contact Us</a>
        </div>
      </div>
    </footer>
  </div>
</template>
