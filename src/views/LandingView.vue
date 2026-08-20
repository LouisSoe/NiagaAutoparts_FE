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
import Select from 'primevue/select'
import Tag from 'primevue/tag'
import Textarea from 'primevue/textarea'
import { useToast } from 'primevue/usetoast'

import { formatCurrencyIDR } from '@/utils/format'
import { getSession, clearSession, updateUserProfile } from '@/services/authService'
import { fetchCategories } from '@/services/categoryService'
import { fetchProducts } from '@/services/productService'
import { fetchCustomerByUserId, updateCustomerByUserId } from '@/services/customerService'
import { createOrder, fetchOrders } from '@/services/orderService'
import { createSnapToken, loadSnapScript } from '@/services/paymentService'
import { deliveryService } from '@/services/deliveryService'
import DeliveryScheduleSelector from '@/components/DeliveryScheduleSelector.vue'
import LocationMapPicker from '@/components/LocationMapPicker.vue'
import RescheduleNotificationModal from '@/components/RescheduleNotificationModal.vue'
import type { Category } from '@/types/category'
import type { Product } from '@/types/product'
import type { CreateOrderPayload } from '@/types/order'
import type { DeliverySchedule, DeliveryDetails } from '@/types/delivery'

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

// Delivery State
const deliveryMethod = ref<'pickup' | 'delivery'>('pickup')
const getTodayFormatted = () => {
  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}
const deliveryDate = ref(getTodayFormatted())
const selectedScheduleId = ref<number | null>(null)
const selectedSchedule = ref<DeliverySchedule | null>(null)
const deliveryLatitude = ref<number | null>(null)
const deliveryLongitude = ref<number | null>(null)
const deliveryNotes = ref('')
const shippingDistance = ref(0)
const shippingFee = ref(0)

// Active Delivery for Reschedule Modal
const isRescheduleModalOpen = ref(false)
const activeDeliveryForModal = ref<DeliveryDetails | null>(null)

const grandTotalWithDelivery = computed<number>(() => {
  const base = grandTotal.value
  return deliveryMethod.value === 'delivery' ? base + shippingFee.value : base
})

const onUpdateDistanceAndFee = (info: { distanceKm: number; shippingFee: number }) => {
  shippingDistance.value = info.distanceKm
  shippingFee.value = info.shippingFee
}

const customerForm = ref({
  name: '',
  email: '',
  phone: '',
  address: '',
})

const paymentMethod = ref<'midtrans' | 'cash'>('midtrans')
const createdOrderNumber = ref('')
const createdOrderStatus = ref('')
const lastCreatedOrderId = ref<number | null>(null)
const lastCreatedSnapToken = ref<string | null>(null)

const failedImageMap = ref<Record<number | string, boolean>>({})
const handleImageError = (productId: number | string) => {
  failedImageMap.value[productId] = true
}

/* =========================================================
 * PROFILE MODAL STATE & LOGIC
 * ======================================================= */
const isProfileModalOpen = ref(false)
const isLoadingProfile = ref(false)
const isSavingProfile = ref(false)
const isLocatingProfile = ref(false)
const profileGeoError = ref<string | null>(null)

const CUSTOMER_TYPE_OPTIONS = [
  { label: 'Perorangan (Individual)', value: 'INDIVIDUAL' },
  { label: 'Bengkel (Workshop)', value: 'WORKSHOP' },
  { label: 'Perusahaan (Company)', value: 'COMPANY' },
]

const profileForm = ref({
  name: '',
  email: '',
  phone: '',
  address: '',
  notes: '',
  latitude: null as number | null,
  longitude: null as number | null,
  type_customer: 'INDIVIDUAL',
})

const manualProfileLat = ref<string>('')
const manualProfileLng = ref<string>('')

const openProfileModal = async (): Promise<void> => {
  const session = getSession()
  profilePopover.value?.hide()
  isProfileModalOpen.value = true
  profileGeoError.value = null

  if (session) {
    profileForm.value = {
      name: session.name || '',
      email: session.email || '',
      phone: session.phone || '',
      address: session.address || '',
      notes: '',
      latitude: null,
      longitude: null,
      type_customer: 'INDIVIDUAL',
    }
    manualProfileLat.value = ''
    manualProfileLng.value = ''

    // Fetch customer data from API GET /api/v1/customers/user/:userId
    if (session.id) {
      isLoadingProfile.value = true
      try {
        const customerData = await fetchCustomerByUserId(session.id)
        if (customerData) {
          if (customerData.name) profileForm.value.name = customerData.name
          if (customerData.phone) profileForm.value.phone = customerData.phone
          if (customerData.email) profileForm.value.email = customerData.email
          if (customerData.address) profileForm.value.address = customerData.address
          if (customerData.notes) profileForm.value.notes = customerData.notes
          if (customerData.type_customer) profileForm.value.type_customer = customerData.type_customer
          if (customerData.latitude !== undefined && customerData.latitude !== null && customerData.latitude !== 0) {
            profileForm.value.latitude = customerData.latitude
            manualProfileLat.value = String(customerData.latitude)
          }
          if (customerData.longitude !== undefined && customerData.longitude !== null && customerData.longitude !== 0) {
            profileForm.value.longitude = customerData.longitude
            manualProfileLng.value = String(customerData.longitude)
          }
        }
      } catch (err) {
        console.error('[LandingView] Error loading profile from API:', err)
      } finally {
        isLoadingProfile.value = false
      }
    }
  }
}

const handleGetProfileDeviceLocation = () => {
  if (!navigator.geolocation) {
    profileGeoError.value = 'Browser Anda tidak mendukung deteksi lokasi otomatis.'
    return
  }

  isLocatingProfile.value = true
  profileGeoError.value = null

  navigator.geolocation.getCurrentPosition(
    (position) => {
      const lat = Math.round(position.coords.latitude * 1000000) / 1000000
      const lng = Math.round(position.coords.longitude * 1000000) / 1000000
      profileForm.value.latitude = lat
      profileForm.value.longitude = lng
      manualProfileLat.value = String(lat)
      manualProfileLng.value = String(lng)
      isLocatingProfile.value = false
    },
    (err) => {
      console.warn('[ProfileModal] Geolocation error:', err)
      profileGeoError.value = 'Izin lokasi tidak diberikan atau GPS tidak aktif.'
      isLocatingProfile.value = false
    },
    { enableHighAccuracy: true, timeout: 10000 }
  )
}

const handleManualProfileCoordChange = () => {
  const latNum = parseFloat(manualProfileLat.value)
  const lngNum = parseFloat(manualProfileLng.value)

  if (!isNaN(latNum) && !isNaN(lngNum)) {
    profileForm.value.latitude = latNum
    profileForm.value.longitude = lngNum
    profileGeoError.value = null
  }
}

const handleSaveProfile = async (): Promise<void> => {
  if (!profileForm.value.name.trim()) {
    toast.add({
      severity: 'error',
      summary: 'Data Tidak Lengkap',
      detail: 'Nama lengkap tidak boleh kosong.',
      life: 3000,
    })
    return
  }

  if (!profileForm.value.phone.trim()) {
    toast.add({
      severity: 'error',
      summary: 'Data Tidak Lengkap',
      detail: 'Nomor telepon tidak boleh kosong.',
      life: 3000,
    })
    return
  }

  isSavingProfile.value = true

  try {
    const session = getSession()

    // Sync session data
    updateUserProfile({
      name: profileForm.value.name.trim(),
      email: profileForm.value.email.trim(),
      phone: profileForm.value.phone.trim(),
      address: profileForm.value.address.trim(),
    })
    currentSession.value = getSession()

    // Call API PUT /api/v1/customers/user/:userId
    if (session?.id) {
      await updateCustomerByUserId(session.id, {
        name: profileForm.value.name.trim(),
        phone: profileForm.value.phone.trim(),
        address: profileForm.value.address.trim(),
        notes: profileForm.value.notes.trim() || undefined,
        type_customer: profileForm.value.type_customer || 'INDIVIDUAL',
        latitude: profileForm.value.latitude !== null ? profileForm.value.latitude : undefined,
        longitude: profileForm.value.longitude !== null ? profileForm.value.longitude : undefined,
      })
    }

    toast.add({
      severity: 'success',
      summary: 'Profil Diperbarui',
      detail: 'Data profil & alamat pengiriman Anda berhasil disimpan ke sistem.',
      life: 3000,
    })
    isProfileModalOpen.value = false
  } catch (err: any) {
    toast.add({
      severity: 'error',
      summary: 'Gagal Menyimpan Profil',
      detail: err?.message || 'Terjadi kesalahan saat menyimpan data profil.',
      life: 4000,
    })
  } finally {
    isSavingProfile.value = false
  }
}

/* =========================================================
 * CUSTOMER ORDERS MODAL STATE & LOGIC
 * ======================================================= */
const isCustomerOrdersOpen = ref(false)
const isLoadingCustomerOrders = ref(false)
const customerOrders = ref<Order[]>([])
const orderSearchQuery = ref('')
const selectedOrderSourceFilter = ref<'all' | 'web' | 'telegram' | 'pos'>('all')
const searchValidationWarning = ref('')

const filteredCustomerOrders = computed(() => {
  if (selectedOrderSourceFilter.value === 'all') {
    return customerOrders.value
  }
  return customerOrders.value.filter((o) => o.source === selectedOrderSourceFilter.value)
})

const isExactOrderNumber = (str: string): boolean => {
  return /^APT-\d{8}-[A-Z0-9]{4}$/i.test(str)
}

const isValidPhoneNumber = (str: string): boolean => {
  const cleanDigits = str.replace(/\D/g, '')
  return cleanDigits.length >= 11
}

const fetchCustomerOrders = async (): Promise<void> => {
  searchValidationWarning.value = ''
  const session = getSession()
  const query = orderSearchQuery.value.trim()
  const isLoggedInUser = !!(session && !session.isGuest && session.id)

  // Validation for Guest Accounts
  if (!isLoggedInUser) {
    if (!query) {
      searchValidationWarning.value = 'Silakan masukkan Kode Pesanan atau Nomor HP.'
      toast.add({
        severity: 'warn',
        summary: 'Pencarian Kosong',
        detail: searchValidationWarning.value,
        life: 4000,
      })
      return
    }

    const validOrder = isExactOrderNumber(query)
    const validPhone = isValidPhoneNumber(query)

    if (!validOrder && !validPhone) {
      searchValidationWarning.value = 'Format tidak sesuai. Gunakan Kode Pesanan lengkap (cth: APT-20260811-FE0M) atau No. HP minimal 11 digit.'
      toast.add({
        severity: 'warn',
        summary: 'Format Pencarian Tidak Valid',
        detail: searchValidationWarning.value,
        life: 5000,
      })
      return
    }
  }

  isLoadingCustomerOrders.value = true
  try {
    const params: Record<string, any> = { limit: 50 }
    if (query) {
      params.q = query
    }
    if (isLoggedInUser) {
      params.user_id = session.id
    }

    console.log('[LandingView] Fetching orders with params:', params)
    const res = await fetchOrders(params)
    customerOrders.value = res.data

    if (!res.data || res.data.length === 0) {
      toast.add({
        severity: 'info',
        summary: 'Pesanan Tidak Ditemukan',
        detail: query ? `Tidak ada pesanan yang cocok dengan "${query}".` : 'Belum ada pesanan.',
        life: 3000,
      })
    }
  } catch (err: any) {
    console.error('[LandingView] Error fetching customer orders:', err)
    toast.add({
      severity: 'error',
      summary: 'Gagal Memuat Pesanan',
      detail: err.message || 'Tidak dapat mengambil daftar pesanan.',
      life: 3000,
    })
  } finally {
    isLoadingCustomerOrders.value = false
  }
}

const openCustomerOrdersModal = async (): Promise<void> => {
  if (profilePopover.value) {
    profilePopover.value.hide()
  }
  isCustomerOrdersOpen.value = true

  const session = getSession()
  if (session && !session.isGuest && session.id) {
    await fetchCustomerOrders()
  }
}

const getOrderStatusSeverity = (status: string) => {
  const s = status.toLowerCase()
  if (['paid', 'settlement', 'completed', 'success'].includes(s)) return 'success'
  if (['pending', 'reserved', 'unpaid'].includes(s)) return 'warn'
  if (['cancelled', 'failed', 'expired'].includes(s)) return 'danger'
  return 'secondary'
}

const getOrderStatusLabel = (status: string) => {
  const s = status.toLowerCase()
  if (['paid', 'settlement', 'completed', 'success'].includes(s)) return 'Lunas'
  if (['pending', 'reserved', 'unpaid'].includes(s)) return 'Menunggu Pembayaran'
  if (['cancelled', 'failed', 'expired'].includes(s)) return 'Dibatalkan / Kadaluarsa'
  return status
}

const viewOrderDetails = (orderNumber: string) => {
  isCustomerOrdersOpen.value = false
  router.push({ name: 'payment-finish', query: { order_id: orderNumber } })
}

const currentCustomerId = ref<number | null>(null)

const openCheckoutModal = async (): Promise<void> => {
  const session = getSession()
  currentCustomerId.value = null
  if (session && !session.isGuest) {
    isUserLoggedIn.value = true
    // Isi awal dari session
    customerForm.value.name = session.name || ''
    customerForm.value.email = session.email || ''
    customerForm.value.phone = session.phone || ''
    customerForm.value.address = session.address || ''

    // Fetch data customer terlengkap dari backend (GET /api/v1/customers/user/:user_id)
    if (session.id) {
      const customerData = await fetchCustomerByUserId(session.id)
      if (customerData) {
        if (customerData.id) currentCustomerId.value = customerData.id
        if (customerData.name) customerForm.value.name = customerData.name
        if (customerData.phone) customerForm.value.phone = customerData.phone
        if (customerData.address) customerForm.value.address = customerData.address
        if (customerData.notes) deliveryNotes.value = customerData.notes
        if (customerData.latitude !== undefined && customerData.latitude !== null && customerData.latitude !== 0) {
          deliveryLatitude.value = customerData.latitude
        }
        if (customerData.longitude !== undefined && customerData.longitude !== null && customerData.longitude !== 0) {
          deliveryLongitude.value = customerData.longitude
        }
      }
    }
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
      detail: 'Nomor telepon wajib diisi untuk konfirmasi.',
      life: 3000,
    })
    return
  }

  if (deliveryMethod.value === 'delivery') {
    if (!customerForm.value.address.trim()) {
      toast.add({
        severity: 'error',
        summary: 'Alamat Wajib Diisi',
        detail: 'Silakan lengkapi alamat pengantaran barang Anda.',
        life: 3500,
      })
      return
    }
    if (!selectedScheduleId.value) {
      toast.add({
        severity: 'error',
        summary: 'Slot Belum Dipilih',
        detail: 'Silakan pilih slot waktu pengantaran yang tersedia.',
        life: 3500,
      })
      return
    }
    if (deliveryLatitude.value === null || deliveryLongitude.value === null) {
      toast.add({
        severity: 'warn',
        summary: 'Titik Lokasi GPS Disarankan',
        detail: 'Mohon tentukan titik lokasi GPS Anda agar kurir dapat mengantar tepat waktu.',
        life: 4000,
      })
    }
  }

  isSubmittingCheckout.value = true

  try {
    const session = getSession()
    const isLoggedInUser = Boolean(session && !session.isGuest && session.id)
    
    const deliveryNoteText = deliveryMethod.value === 'delivery'
      ? `[DELIVERY] Tgl: ${deliveryDate.value}, Slot #${selectedScheduleId.value}, Alamat: ${customerForm.value.address}. Catatan: ${deliveryNotes.value || '-'}`
      : `[PICKUP TOKO] Catatan: ${customerForm.value.address || '-'}`

    const currentShippingCost = deliveryMethod.value === 'delivery' ? shippingFee.value : 0
    const currentTaxAmount = tax.value

    const payload: CreateOrderPayload = {
      ...(isLoggedInUser ? { user_id: session!.id } : {}),
      ...(currentCustomerId.value ? { customer_id: currentCustomerId.value } : {}),
      customer_name: customerForm.value.name,
      customer_phone: customerForm.value.phone,
      customer_email: customerForm.value.email || undefined,
      address: customerForm.value.address || undefined,
      amount_paid: 0,
      change_amount: 0,
      source: 'web',
      payment_method: paymentMethod.value,
      status: 'reserved',
      notes: deliveryNoteText,
      order_type: deliveryMethod.value,
      tax_amount: currentTaxAmount,
      shipping_cost: currentShippingCost,
      items: cart.value.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
      })),
    }

    const order = await createOrder(payload)
    createdOrderNumber.value = order.order_number
    createdOrderStatus.value = paymentMethod.value === 'midtrans' ? 'Menunggu Pembayaran Midtrans' : 'Menunggu Konfirmasi Admin'
    lastCreatedOrderId.value = order.id

    // Jika opsi delivery dipilih, kirim permintaan pengantaran ke endpoint /api/v1/deliveries/request
    if (deliveryMethod.value === 'delivery' && selectedScheduleId.value) {
      try {
        await deliveryService.requestDelivery({
          order_id: order.id,
          schedule_id: selectedScheduleId.value,
          delivery_date: deliveryDate.value,
          address: customerForm.value.address,
          latitude: deliveryLatitude.value ?? 0,
          longitude: deliveryLongitude.value ?? 0,
          notes: deliveryNotes.value || undefined,
        })
      } catch (delivErr: any) {
        console.error('[LandingView] Delivery request notice:', delivErr)
      }
    }

    if (paymentMethod.value === 'midtrans') {
      try {
        await loadSnapScript()
        const snap = await createSnapToken(order.id)
        lastCreatedSnapToken.value = snap.token

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
              createdOrderStatus.value = 'Pembayaran Gagal'
              isSuccessModalOpen.value = true
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
        detail: `Order ${order.order_number} berhasil dibuat. Silakan bayar & konfirmasi pesanan!`,
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

const reopenMidtransPayment = async (): Promise<void> => {
  if (!lastCreatedOrderId.value) {
    if (createdOrderNumber.value) {
      router.push({ name: 'payment-finish', query: { order_id: createdOrderNumber.value } })
    }
    return
  }

  isSuccessModalOpen.value = false

  try {
    await loadSnapScript()
    let token = lastCreatedSnapToken.value
    if (!token) {
      const snapRes = await createSnapToken(lastCreatedOrderId.value)
      token = snapRes.token
      lastCreatedSnapToken.value = token
    }

    if ((window as any).snap && token) {
      ;(window as any).snap.pay(token, {
        onSuccess: () => {
          toast.add({
            severity: 'success',
            summary: 'Pembayaran Berhasil',
            detail: `Pesanan ${createdOrderNumber.value} telah berhasil dibayar!`,
            life: 5000,
          })
          createdOrderStatus.value = 'Pembayaran Lunas (Paid)'
          isSuccessModalOpen.value = true
        },
        onPending: () => {
          toast.add({
            severity: 'info',
            summary: 'Menunggu Pembayaran',
            detail: `Silakan selesaikan pembayaran untuk pesanan ${createdOrderNumber.value}.`,
            life: 5000,
          })
          createdOrderStatus.value = 'Menunggu Pembayaran Midtrans'
          isSuccessModalOpen.value = true
        },
        onError: () => {
          toast.add({
            severity: 'error',
            summary: 'Pembayaran Gagal',
            detail: 'Proses pembayaran Midtrans mengalami kendala.',
            life: 4000,
          })
          createdOrderStatus.value = 'Pembayaran Gagal'
          isSuccessModalOpen.value = true
        },
        onClose: () => {
          toast.add({
            severity: 'warn',
            summary: 'Popup Ditutup',
            detail: `Pesanan ${createdOrderNumber.value} tersimpan. Anda dapat membayar sewaktu-waktu.`,
            life: 4000,
          })
          createdOrderStatus.value = 'Menunggu Pembayaran Midtrans'
          isSuccessModalOpen.value = true
        },
      })
    }
  } catch (err: any) {
    console.warn('[LandingView] Failed to generate Snap Token, checking latest order status from server:', err)
    if (lastCreatedOrderId.value) {
      try {
        const latestOrder = await fetchOrderById(lastCreatedOrderId.value)
        const status = (latestOrder.status || '').toLowerCase()
        if (['paid', 'settlement', 'success', 'completed'].includes(status)) {
          createdOrderStatus.value = 'Pembayaran Lunas (Paid)'
          toast.add({
            severity: 'success',
            summary: 'Pembayaran Berhasil',
            detail: `Pesanan ${latestOrder.order_number} telah berhasil dibayar!`,
            life: 5000,
          })
        } else {
          createdOrderStatus.value = latestOrder.status
          toast.add({
            severity: 'info',
            summary: 'Transaksi Midtrans Sudah Dibuat',
            detail: 'Kode pesanan ini sudah pernah dikirim ke Midtrans. Silakan selesaikan pembayaran di aplikasi bank/e-wallet Anda.',
            life: 5000,
          })
        }
        isSuccessModalOpen.value = true
        return
      } catch (checkErr) {
        console.error('[LandingView] Error checking order status:', checkErr)
      }
    }
    toast.add({
      severity: 'error',
      summary: 'Midtrans Error',
      detail: err.message || 'Gagal membuka kembali pembayaran Midtrans.',
      life: 4000,
    })
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

          <!-- Customer Orders Button -->
          <Button
            icon="pi pi-receipt"
            label="Pesanan Saya"
            rounded
            text
            severity="secondary"
            class="hidden sm:inline-flex text-xs font-semibold"
            title="Lihat riwayat pesanan saya"
            @click="openCustomerOrdersModal"
          />

          <!-- Cart Icon Button with Badge -->
          <div class="relative flex align-items-center">
            <Button
              icon="pi pi-shopping-bag"
              rounded
              text
              severity="secondary"
              aria-label="Shopping Cart"
              title="Buka Keranjang Belanja"
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
              title="Menu Akun & Profil"
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
                    label="Pesanan Saya"
                    icon="pi pi-receipt"
                    severity="secondary"
                    outlined
                    size="small"
                    class="w-full"
                    @click="openCustomerOrdersModal"
                  />
                  <Button
                    label="Profil Saya"
                    icon="pi pi-user-edit"
                    severity="secondary"
                    outlined
                    size="small"
                    class="w-full"
                    @click="openProfileModal"
                  />
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
                    label="Cek Pesanan"
                    icon="pi pi-receipt"
                    severity="secondary"
                    outlined
                    size="small"
                    class="w-full mb-1"
                    @click="openCustomerOrdersModal"
                  />
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
              :class="{ 'opacity-70': isOutOfStock(product) }"
            >
              <template #header>
                <div class="relative surface-100 overflow-hidden" style="height: 8.5rem">
                  <Image
                    v-if="product.imageUrl && !failedImageMap[product.id]"
                    :src="product.imageUrl"
                    :alt="product.name"
                    imageClass="w-full h-full object-cover"
                    :imageStyle="{ height: '8.5rem', width: '100%', objectFit: 'cover' }"
                    @error="handleImageError(product.id)"
                  />
                  <div
                    v-else
                    class="flex align-items-center justify-content-center h-full surface-100"
                  >
                    <i class="pi pi-image text-4xl text-400" />
                  </div>

                  <!-- Overlay for Out of Stock -->
                  <div
                    v-if="isOutOfStock(product)"
                    class="absolute inset-0 bg-white-alpha-40 pointer-events-none z-1"
                  />

                  <!-- Tag Badge: Out of Stock -->
                  <Tag
                    v-if="isOutOfStock(product)"
                    value="STOK HABIS"
                    severity="danger"
                    class="absolute top-0 right-0 m-2 text-xs font-bold uppercase tracking-wider z-2"
                    style="font-size: 0.65rem; line-height: 1;"
                  />
                  <!-- Tag Badge: Low Stock -->
                  <Tag
                    v-else-if="isLowStock(product)"
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
                      :title="isOutOfStock(product) ? 'Stok habis' : isCartMaxed(product) ? 'Jumlah maksimal stok tercapai' : 'Tambah ke Keranjang'"
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
                title="Hapus item dari keranjang"
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
                  title="Kurangi jumlah"
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
                  title="Tambah jumlah"
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
      header="Konfirmasi Checkout & Pengantaran"
      style="width: 36rem"
      :breakpoints="{ '960px': '85vw', '641px': '95vw' }"
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
        </div>

        <!-- 3. Metode Pengiriman (Ambil di Toko vs Diantar Kurir) -->
        <div class="flex flex-column gap-3">
          <div class="font-semibold text-sm text-900 border-bottom-1 surface-border pb-1">
            Metode Pengiriman
          </div>
          <div class="grid grid-nogutter gap-2">
            <div class="col">
              <div
                class="p-3 border-1 border-round-xl cursor-pointer flex align-items-center gap-3 transition-all h-full"
                :class="deliveryMethod === 'pickup' ? 'border-blue-600 bg-blue-50 shadow-1' : 'surface-border hover:surface-100'"
                @click="deliveryMethod = 'pickup'"
              >
                <RadioButton v-model="deliveryMethod" value="pickup" />
                <div>
                  <div class="font-bold text-sm text-900 flex align-items-center gap-1">
                    <i class="pi pi-building text-primary" /> Ambil di Toko
                  </div>
                  <div class="text-xs text-500">Ambil sendiri langsung di gudang</div>
                </div>
              </div>
            </div>
            <div class="col">
              <div
                class="p-3 border-1 border-round-xl cursor-pointer flex align-items-center gap-3 transition-all h-full"
                :class="deliveryMethod === 'delivery' ? 'border-blue-600 bg-blue-50 shadow-1' : 'surface-border hover:surface-100'"
                @click="deliveryMethod = 'delivery'"
              >
                <RadioButton v-model="deliveryMethod" value="delivery" />
                <div>
                  <div class="font-bold text-sm text-900 flex align-items-center gap-1">
                    <i class="pi pi-truck text-primary" /> Diantar Kurir
                  </div>
                  <div class="text-xs text-500">Pilih slot jadwal & titik GPS</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Bagian Jika Delivery Dipilih: Slot Jadwal & Map Picker -->
          <div v-if="deliveryMethod === 'delivery'" class="flex flex-column gap-3 mt-1 surface-50 p-3 border-round-xl border-1 surface-border">
            <DeliveryScheduleSelector
              v-model:selectedDate="deliveryDate"
              v-model:selectedScheduleId="selectedScheduleId"
              @selectSchedule="(sched) => (selectedSchedule = sched)"
            />

            <Divider class="my-1" />

            <LocationMapPicker
              v-model:latitude="deliveryLatitude"
              v-model:longitude="deliveryLongitude"
              v-model:address="customerForm.address"
              v-model:notes="deliveryNotes"
              @updateDistanceAndFee="onUpdateDistanceAndFee"
            />
          </div>

          <!-- Bagian Jika Pickup Dipilih -->
          <div v-else class="flex flex-column gap-1">
            <label for="cust-address-pickup" class="text-xs font-semibold text-700">Catatan Pengambilan (Opsional)</label>
            <Textarea id="cust-address-pickup" v-model="customerForm.address" rows="2" placeholder="Catatan jam pengambilan atau info lainnya..." class="w-full text-sm" />
          </div>
        </div>

        <!-- 4. Pilih Metode Pembayaran -->
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
                  <div class="font-bold text-sm text-900">{{ deliveryMethod === 'delivery' ? 'Bayar Cash ke Kurir (COD)' : 'Bayar Cash di Toko' }}</div>
                  <div class="text-xs text-500">{{ deliveryMethod === 'delivery' ? 'Bayar tunai saat barang diantar oleh kurir' : 'Bayar saat mengambil barang di toko secara langsung' }}</div>
                </div>
              </div>
              <i class="pi pi-money-bill text-xl text-green-600" />
            </div>
          </div>
        </div>

        <!-- 5. Ringkasan Total & Tombol Bayar -->
        <div class="surface-100 border-round-xl p-3 flex flex-column gap-2 mt-1">
          <div class="flex justify-content-between text-xs text-600">
            <span>Subtotal Produk ({{ cartCount }} item):</span>
            <span class="font-semibold">{{ formatCurrencyIDR(subtotal) }}</span>
          </div>
          <div class="flex justify-content-between text-xs text-600">
            <span>Pajak (11%):</span>
            <span class="font-semibold">{{ formatCurrencyIDR(tax) }}</span>
          </div>
          <div v-if="deliveryMethod === 'delivery'" class="flex justify-content-between text-xs text-600">
            <span>Ongkir Pengantaran Kurir ({{ shippingDistance }} km):</span>
            <span class="font-semibold text-blue-700">{{ formatCurrencyIDR(shippingFee) }}</span>
          </div>
          <Divider class="my-1" />
          <div class="flex justify-content-between align-items-center">
            <span class="font-bold text-sm text-900">Total Pembayaran:</span>
            <span class="font-extrabold text-lg text-blue-600">{{ formatCurrencyIDR(grandTotalWithDelivery) }}</span>
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
      style="width: 90vw; max-width: 28rem;"
      class="border-round-2xl"
    >
      <div class="flex flex-column align-items-center justify-content-center text-center gap-3 py-2">
        <!-- Dynamic Status Icon -->
        <div 
          class="border-circle p-3 flex align-items-center justify-content-center"
          :class="[
            createdOrderStatus.includes('Lunas') || createdOrderStatus.includes('Paid') ? 'bg-green-100' :
            createdOrderStatus.includes('Gagal') ? 'bg-red-100' : 'bg-orange-100'
          ]"
          style="width: 4.5rem; height: 4.5rem"
        >
          <i 
            :class="[
              createdOrderStatus.includes('Lunas') || createdOrderStatus.includes('Paid') ? 'pi pi-check-circle text-green-600' :
              createdOrderStatus.includes('Gagal') ? 'pi pi-times-circle text-red-600' : 'pi pi-clock text-orange-600',
              'text-4xl'
            ]" 
          />
        </div>

        <div>
          <h3 class="text-xl font-bold text-900 m-0 mb-1">
            {{ createdOrderStatus.includes('Lunas') ? 'Pembayaran Berhasil!' : 'Pesanan Berhasil Dibuat!' }}
          </h3>
          <p class="text-sm text-600 m-0">Kode Pesanan Anda:</p>
          <div class="text-lg font-mono font-bold text-blue-600 bg-blue-50 py-1.5 px-3 border-round-lg border-1 border-blue-200 mt-1.5 inline-block">
            {{ createdOrderNumber }}
          </div>
        </div>

        <div class="surface-100 border-round-xl p-3 text-left w-full flex flex-column gap-1.5 text-xs text-700">
          <div class="flex justify-content-between align-items-center">
            <span class="text-500">Status Pembayaran:</span>
            <Tag 
              :severity="
                createdOrderStatus.includes('Lunas') ? 'success' :
                createdOrderStatus.includes('Gagal') ? 'danger' : 'warn'
              "
              :value="createdOrderStatus"
              class="text-xs uppercase"
            />
          </div>
          <div class="flex justify-content-between align-items-center">
            <span class="text-500">Metode Pembayaran:</span>
            <span class="font-semibold uppercase text-800">{{ paymentMethod }}</span>
          </div>
        </div>

        <p class="text-xs text-500 m-0 line-height-3">
          <template v-if="createdOrderStatus.includes('Menunggu')">
            Pesanan Anda telah tersimpan. Silakan selesaikan pembayaran atau tunjukkan Kode Pesanan di atas saat mengambil barang di toko.
          </template>
          <template v-else-if="createdOrderStatus.includes('Lunas')">
            Terima kasih! Pembayaran Anda telah kami terima. Tunjukkan Kode Pesanan di atas saat datang ke toko untuk pengambilan barang.
          </template>
          <template v-else>
            Tunjukkan Kode Pesanan di atas saat datang ke toko untuk pengambilan barang. Reservasi stok berlaku selama 15 menit.
          </template>
        </p>
      </div>

      <template #footer>
        <div class="flex flex-column sm:flex-row gap-2 w-full pt-1">
          <Button 
            v-if="createdOrderStatus.includes('Menunggu') && paymentMethod === 'midtrans'"
            label="Bayar / Cek Status" 
            icon="pi pi-external-link" 
            severity="warn" 
            class="w-full text-xs font-semibold" 
            @click="isSuccessModalOpen = false; router.push({ name: 'payment-finish', query: { order_id: createdOrderNumber } })" 
          />
          <Button 
            label="Kembali ke Katalog" 
            severity="primary" 
            outlined
            class="w-full text-xs font-semibold" 
            @click="isSuccessModalOpen = false" 
          />
        </div>
      </template>
    </Dialog>

    <!-- ==========================================
         7.5. MODAL PROFIL CUSTOMER
    =========================================== -->
    <Dialog
      v-model:visible="isProfileModalOpen"
      modal
      header="Profil & Alamat Pelanggan"
      style="width: 90vw; max-width: 36rem"
      class="border-round-2xl"
    >
      <div v-if="isLoadingProfile" class="flex flex-column align-items-center justify-content-center py-6 gap-3">
        <ProgressSpinner style="width: 36px; height: 36px" strokeWidth="4" />
        <span class="text-sm text-500">Memuat data profil...</span>
      </div>

      <div v-else class="flex flex-column gap-3 pt-2">
        <!-- Header Info Box -->
        <div class="flex align-items-center gap-3 p-3 bg-blue-50 border-round-xl border-1 border-blue-200">
          <div class="w-3rem h-3rem border-circle bg-blue-600 text-white flex align-items-center justify-content-center font-bold text-xl flex-shrink-0">
            <i class="pi pi-user text-2xl"></i>
          </div>
          <div>
            <div class="font-bold text-base text-blue-900">{{ currentUserName }}</div>
            <div class="text-xs text-600">Kelola data profil, tipe pelanggan, dan koordinat GPS pengantaran Anda.</div>
          </div>
        </div>

        <!-- Nama & Tipe Customer -->
        <div class="grid">
          <div class="col-12 sm:col-7 flex flex-column gap-1">
            <label for="prof-name" class="text-xs font-semibold text-700">Nama Lengkap *</label>
            <InputText id="prof-name" v-model="profileForm.name" placeholder="Masukkan nama lengkap" class="w-full text-sm" />
          </div>
          <div class="col-12 sm:col-5 flex flex-column gap-1">
            <label for="prof-type" class="text-xs font-semibold text-700">Tipe Pelanggan</label>
            <Select
              id="prof-type"
              v-model="profileForm.type_customer"
              :options="CUSTOMER_TYPE_OPTIONS"
              optionLabel="label"
              optionValue="value"
              placeholder="Pilih Tipe"
              class="w-full text-sm"
            />
          </div>
        </div>

        <!-- Nomor Telepon & Email -->
        <div class="grid">
          <div class="col-12 sm:col-6 flex flex-column gap-1">
            <label for="prof-phone" class="text-xs font-semibold text-700">Nomor Telepon / WA *</label>
            <InputText id="prof-phone" v-model="profileForm.phone" placeholder="08xxxxxxxxxx" class="w-full text-sm" />
          </div>
          <div class="col-12 sm:col-6 flex flex-column gap-1">
            <label for="prof-email" class="text-xs font-semibold text-700">Email</label>
            <InputText id="prof-email" v-model="profileForm.email" placeholder="nama@email.com" class="w-full text-sm" />
          </div>
        </div>

        <!-- Alamat Utama -->
        <div class="flex flex-column gap-1">
          <label for="prof-address" class="text-xs font-semibold text-700">Alamat Pengiriman Utama *</label>
          <Textarea id="prof-address" v-model="profileForm.address" rows="2" placeholder="Masukkan jalan, RT/RW, Kelurahan, Kecamatan, Kota..." class="w-full text-sm" />
        </div>

        <!-- Catatan / Patokan Khusus -->
        <div class="flex flex-column gap-1">
          <label for="prof-notes" class="text-xs font-semibold text-700">Patokan / Catatan Kurir</label>
          <InputText id="prof-notes" v-model="profileForm.notes" placeholder="Cth: Pagar hitam samping warung madura" class="w-full text-sm" />
        </div>

        <!-- Titik Koordinat GPS / Pin Point -->
        <div class="surface-50 border-round-xl p-3 border-1 surface-border flex flex-column gap-2 mt-1">
          <div class="flex align-items-center justify-content-between flex-wrap gap-2">
            <div class="flex align-items-center gap-1">
              <i class="pi pi-map-marker text-red-500 font-bold" />
              <span class="text-xs font-bold text-900">Titik Koordinat GPS Rumah / Bengkel</span>
            </div>
            <Button
              label="Gunakan Lokasi Saya"
              icon="pi pi-compass"
              size="small"
              outlined
              severity="primary"
              class="text-xs p-1 px-2"
              :loading="isLocatingProfile"
              @click="handleGetProfileDeviceLocation"
            />
          </div>

          <div v-if="profileGeoError" class="text-xs text-red-600 bg-red-50 p-2 border-round border-1 border-red-200">
            <i class="pi pi-exclamation-triangle mr-1" />
            {{ profileGeoError }}
          </div>

          <div class="grid grid-nogutter gap-2 mt-1">
            <div class="col flex flex-column gap-1">
              <span class="text-xs text-500">Latitude</span>
              <InputText
                v-model="manualProfileLat"
                placeholder="-7.95607"
                class="w-full text-xs font-mono p-2"
                @blur="handleManualProfileCoordChange"
              />
            </div>
            <div class="col flex flex-column gap-1">
              <span class="text-xs text-500">Longitude</span>
              <InputText
                v-model="manualProfileLng"
                placeholder="112.620339"
                class="w-full text-xs font-mono p-2"
                @blur="handleManualProfileCoordChange"
              />
            </div>
          </div>
          <div class="text-xs text-500 italic">
            * Titik koordinat ini akan tersimpan permanen sebagai alamat pengantaran default Anda saat checkout.
          </div>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-content-end gap-2 w-full pt-2">
          <Button label="Batal" severity="secondary" outlined size="small" :disabled="isSavingProfile" @click="isProfileModalOpen = false" />
          <Button
            label="Simpan Profil"
            icon="pi pi-check"
            severity="primary"
            size="small"
            :loading="isSavingProfile"
            @click="handleSaveProfile"
          />
        </div>
      </template>
    </Dialog>

    <!-- ==========================================
         7.6. MODAL DAFTAR PESANAN CUSTOMER
    =========================================== -->
    <Dialog
      v-model:visible="isCustomerOrdersOpen"
      modal
      header="Daftar Pesanan Saya"
      dismissableMask
      style="width: 90vw; max-width: 44rem;"
      class="border-round-2xl"
    >
      <div class="flex flex-column gap-3 pt-1">
        <!-- Search Box & Button -->
        <form @submit.prevent="fetchCustomerOrders" class="flex gap-2 w-full">
          <IconField class="flex-1 min-w-0">
            <InputIcon class="pi pi-search text-400" />
            <InputText
              v-model="orderSearchQuery"
              placeholder="Kode Pesanan (APT-...) atau No. HP (11+ digit)..."
              class="w-full text-sm border-round-lg"
            />
          </IconField>
          <Button
            type="submit"
            label="Cari"
            icon="pi pi-search"
            size="small"
            severity="primary"
            :disabled="!orderSearchQuery.trim()"
            :loading="isLoadingCustomerOrders"
          />
        </form>

        <!-- Search Validation Warning -->
        <Message
          v-if="searchValidationWarning"
          severity="warn"
          class="w-full text-xs m-0"
          :closable="true"
          @close="searchValidationWarning = ''"
        >
          {{ searchValidationWarning }}
        </Message>

        <!-- Filter Source Chips -->
        <div class="flex gap-1.5 align-items-center text-xs overflow-x-auto pb-1">
          <span class="text-500 font-medium mr-1">Sumber:</span>
          <Button
            label="Semua"
            :severity="selectedOrderSourceFilter === 'all' ? 'primary' : 'secondary'"
            :outlined="selectedOrderSourceFilter !== 'all'"
            size="small"
            class="text-xs px-2.5 py-1"
            @click="selectedOrderSourceFilter = 'all'"
          />
          <Button
            label="Website"
            icon="pi pi-globe"
            :severity="selectedOrderSourceFilter === 'web' ? 'primary' : 'secondary'"
            :outlined="selectedOrderSourceFilter !== 'web'"
            size="small"
            class="text-xs px-2.5 py-1"
            @click="selectedOrderSourceFilter = 'web'"
          />
          <Button
            label="Telegram Bot"
            icon="pi pi-send"
            :severity="selectedOrderSourceFilter === 'telegram' ? 'primary' : 'secondary'"
            :outlined="selectedOrderSourceFilter !== 'telegram'"
            size="small"
            class="text-xs px-2.5 py-1"
            @click="selectedOrderSourceFilter = 'telegram'"
          />
          <Button
            label="Kasir POS"
            icon="pi pi-shopping-cart"
            :severity="selectedOrderSourceFilter === 'pos' ? 'primary' : 'secondary'"
            :outlined="selectedOrderSourceFilter !== 'pos'"
            size="small"
            class="text-xs px-2.5 py-1"
            @click="selectedOrderSourceFilter = 'pos'"
          />
        </div>

        <!-- Loading State -->
        <div v-if="isLoadingCustomerOrders" class="flex justify-content-center align-items-center py-6">
          <ProgressSpinner style="width: 2.5rem; height: 2.5rem" stroke-width="4" />
        </div>

        <!-- Orders List -->
        <div v-else-if="filteredCustomerOrders.length" class="flex flex-column gap-3 overflow-y-auto pr-1" style="max-height: 28rem;">
          <div
            v-for="ord in filteredCustomerOrders"
            :key="ord.id"
            class="surface-card border-1 surface-border border-round-xl p-3 flex flex-column gap-2 hover:shadow-1 transition-all"
          >
            <div class="flex justify-content-between align-items-center">
              <span class="font-mono font-bold text-900 text-sm">{{ ord.order_number }}</span>
              <Tag
                :severity="getOrderStatusSeverity(ord.status)"
                :value="getOrderStatusLabel(ord.status)"
                class="text-xs px-2 py-1 uppercase"
              />
            </div>

            <div class="flex justify-content-between align-items-center text-xs text-color-secondary">
              <span><i class="pi pi-calendar mr-1"></i>{{ new Date(ord.created_at).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) }}</span>
              <span class="flex align-items-center gap-1">
                <span class="capitalize bg-blue-50 text-blue-700 px-2 py-0.5 border-round font-medium">
                  <i class="pi pi-credit-card mr-1"></i>{{ ord.payment_method === 'midtrans' ? 'Midtrans' : (ord.payment_method === 'cash' ? 'Tunai' : (ord.payment_method || '-')) }}
                </span>
                <span v-if="ord.order_type" class="capitalize bg-gray-100 text-700 px-2 py-0.5 border-round font-medium">
                  {{ ord.order_type === 'delivery' ? '🚚 Delivery' : '🏪 Pickup' }}
                </span>
              </span>
            </div>

            <!-- Items Breakdown -->
            <div v-if="ord.items && ord.items.length" class="surface-100 border-round-lg p-2.5 text-xs flex flex-column gap-1.5">
              <div v-for="item in ord.items" :key="item.id" class="flex justify-content-between align-items-center">
                <span class="text-700 font-medium truncate max-w-16rem">{{ item.product_name || `Produk #${item.product_id}` }} ×{{ item.quantity }}</span>
                <span class="font-semibold text-800">{{ formatCurrencyIDR(item.subtotal) }}</span>
              </div>
            </div>

            <div class="flex justify-content-between align-items-center pt-2 border-top-1 surface-border">
              <div>
                <span class="text-xs text-color-secondary block">Total Harga</span>
                <span class="font-bold text-blue-700 text-base">{{ formatCurrencyIDR(ord.total_price) }}</span>
              </div>
              <Button
                label="Detail Status"
                icon="pi pi-external-link"
                iconPos="right"
                size="small"
                severity="primary"
                outlined
                @click="viewOrderDetails(ord.order_number)"
              />
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-column align-items-center justify-content-center py-6 text-color-secondary gap-2">
          <i class="pi pi-inbox text-4xl text-400" />
          <p class="m-0 text-sm font-medium">Belum ada pesanan ditemukan.</p>
        </div>
      </div>

      <template #footer>
        <div class="flex justify-content-between align-items-center w-full pt-2">
          <span class="text-xs text-color-secondary">* Otomatis terhubung dengan token sesi akun Anda</span>
          <Button label="Tutup" severity="secondary" outlined size="small" @click="isCustomerOrdersOpen = false" />
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
    <!-- ==========================================
         7.7. MODAL NOTIFIKASI RESCHEDULE
    =========================================== -->
    <RescheduleNotificationModal
      v-model:visible="isRescheduleModalOpen"
      :delivery="activeDeliveryForModal"
      @accepted="() => {
        toast.add({
          severity: 'success',
          summary: 'Jadwal Baru Diterima',
          detail: 'Konfirmasi jadwal baru telah diteruskan ke kurir.',
          life: 4000
        })
      }"
    />
  </div>
</template>
