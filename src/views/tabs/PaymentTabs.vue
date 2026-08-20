<script setup lang="ts">
import { computed, onMounted, ref } from 'vue';

import Badge from 'primevue/badge';
import Button from 'primevue/button';
import Card from 'primevue/card';
import Dialog from 'primevue/dialog';
import Divider from 'primevue/divider';
import IconField from 'primevue/iconfield';
import Image from 'primevue/image';
import InputIcon from 'primevue/inputicon';
import InputNumber from 'primevue/inputnumber';
import InputText from 'primevue/inputtext';
import ProgressSpinner from 'primevue/progressspinner';
import Tag from 'primevue/tag';

import { formatCurrencyIDR } from '@/utils/format';
import type { Product } from '@/types/product';
import { getSession } from '@/services/authService';
import { fetchCategories } from '@/services/categoryService';
import { fetchProducts } from '@/services/productService';
import { createOrder } from '@/services/orderService';
import type { CreateOrderPayload } from '@/types/order';
import { useToast } from 'primevue/usetoast';

interface CategoryOption {
  id: number | 'all';
  name: string;
}

interface CartItem {
  productId: number;
  sku: string;
  name: string;
  price: number;
  quantity: number;
  stock: number;
}

const TAX_RATE = 0.11;

const toast = useToast();

const search = ref('');
const selectedCategoryId = ref<number | 'all'>('all');
const isLoadingCategories = ref(false);
const isLoadingProducts = ref(false);
const isSubmittingOrder = ref(false);

const categories = ref<CategoryOption[]>([]);
const products = ref<Product[]>([]);
const cart = ref<CartItem[]>([]);

const failedImageMap = ref<Record<number | string, boolean>>({});
const handleImageError = (productId: number | string) => {
  failedImageMap.value[productId] = true;
};

/* =========================================================
 * LOAD DATA
 * ======================================================= */

const loadCategories = async (): Promise<void> => {
  isLoadingCategories.value = true;
  try {
    const res = await fetchCategories({ limit: 100 });
    categories.value = [
      { id: 'all', name: 'Semua Produk' },
      ...res.data.map((c: Category) => ({ id: c.id as number, name: c.name })),
    ];
    console.log('[POS] Categories loaded:', categories.value.length);
  } catch (err) {
    console.error('[POS] Failed to load categories:', err);
  } finally {
    isLoadingCategories.value = false;
  }
};

const loadProducts = async (): Promise<void> => {
  isLoadingProducts.value = true;
  try {
    const params: Record<string, any> = { limit: 200, low_stock_priority: false };
    if (selectedCategoryId.value !== 'all') params.category_id = selectedCategoryId.value;
    if (search.value.trim()) params.q = search.value.trim();
    const res = await fetchProducts(params);
    products.value = res.data;
    console.log('[POS] Products loaded:', products.value.length);
  } catch (err) {
    console.error('[POS] Failed to load products:', err);
  } finally {
    isLoadingProducts.value = false;
  }
};

onMounted(async () => {
  await loadCategories();
  await loadProducts();
});

/* =========================================================
 * COMPUTED / FILTER
 * ======================================================= */

const filteredProducts = computed<Product[]>(() => products.value);

/* =========================================================
 * STOCK LABEL / SEVERITY
 * ======================================================= */

const isOutOfStock = (product: Product): boolean => {
  const effective = product.stock - (product.reserved ?? 0);
  return effective <= 0;
};

const isLowStock = (product: Product): boolean => {
  const effective = product.stock - (product.reserved ?? 0);
  if (effective <= 0) return false;
  const min = (product.minimumStock && product.minimumStock > 0) ? product.minimumStock : 5;
  return effective <= min;
};

const getProductStockSeverity = (product: Product): 'success' | 'warn' | 'danger' => {
  if (isOutOfStock(product)) return 'danger';
  if (isLowStock(product)) return 'warn';
  return 'success';
};

const getProductStockLabel = (product: Product): string => {
  if (isOutOfStock(product)) return 'HABIS';
  if (isLowStock(product)) return 'LOW STOCK';
  return '';
};

/* =========================================================
 * CART
 * ======================================================= */

const cartItemCount = computed<number>(() =>
  cart.value.reduce((total, item) => total + item.quantity, 0)
);

const subtotal = computed<number>(() =>
  cart.value.reduce((total, item) => total + item.price * item.quantity, 0)
);

const tax = computed<number>(() => subtotal.value * TAX_RATE);

const grandTotal = computed<number>(() => subtotal.value + tax.value);

const addToCart = (product: Product): void => {
  const effective = product.stock - (product.reserved ?? 0);
  if (effective <= 0) return;

  const existing = cart.value.find((item) => item.productId === product.id);

  if (existing) {
    if (existing.quantity >= effective) return;
    cart.value = cart.value.map((item) =>
      item.productId === product.id ? { ...item, quantity: item.quantity + 1 } : item
    );
    return;
  }

  cart.value = [
    ...cart.value,
    {
      productId: product.id,
      sku: product.sku,
      name: product.name,
      price: product.selling_price,
      quantity: 1,
      stock: effective,
    },
  ];
};

const increaseQuantity = (productId: number): void => {
  cart.value = cart.value.map((item) => {
    if (item.productId !== productId) return item;
    if (item.quantity >= item.stock) return item;
    return { ...item, quantity: item.quantity + 1 };
  });
};

const decreaseQuantity = (productId: number): void => {
  cart.value = cart.value
    .map((item) =>
      item.productId === productId ? { ...item, quantity: item.quantity - 1 } : item
    )
    .filter((item) => item.quantity > 0);
};

const removeCartItem = (productId: number): void => {
  cart.value = cart.value.filter((item) => item.productId !== productId);
};

const clearCart = (): void => {
  cart.value = [];
};

const handleCategorySelect = async (categoryId: number | 'all'): Promise<void> => {
  selectedCategoryId.value = categoryId;
  await loadProducts();
};

let searchDebounce: ReturnType<typeof setTimeout> | null = null;
const handleSearchInput = (): void => {
  if (searchDebounce) clearTimeout(searchDebounce);
  searchDebounce = setTimeout(() => loadProducts(), 400);
};

/* =========================================================
 * PAYMENT MODAL
 * ======================================================= */

const paymentModalVisible = ref(false);
const paymentAmount = ref<number | null>(null);

const kembalian = computed<number>(() => {
  if (!paymentAmount.value) return 0;
  return Math.max(0, paymentAmount.value - grandTotal.value);
});

const isPaymentInsufficient = computed<boolean>(() => {
  return !paymentAmount.value || paymentAmount.value < grandTotal.value;
});

/* =========================================================
 * SUCCESS MODAL
 * ======================================================= */

const successModalVisible = ref(false);

interface ReceiptData {
  items: CartItem[];
  subtotal: number;
  tax: number;
  grandTotal: number;
  paymentAmount: number;
  kembalian: number;
  transactionCode: string;
  date: string;
}

const receiptData = ref<ReceiptData | null>(null);

/* =========================================================
 * HANDLERS
 * ======================================================= */

const handlePay = (): void => {
  if (!cart.value.length) return;
  paymentAmount.value = null;
  paymentModalVisible.value = true;
};

const confirmPayment = async (): Promise<void> => {
  if (isPaymentInsufficient.value || isSubmittingOrder.value) return;

  isSubmittingOrder.value = true;

  try {
    const session = getSession();
    const payload: CreateOrderPayload = {
      user_id: session?.id || null, // ID Admin atau Kasir yang sedang login
      amount_paid: paymentAmount.value!,
      change_amount: kembalian.value,
      source: 'pos',
      payment_method: 'cash',
      notes: 'Pembelian via Kasir POS',
      order_type: 'pickup',
      tax_amount: tax.value,
      shipping_cost: 0,
      items: cart.value.map((item) => ({
        product_id: item.productId,
        quantity: item.quantity,
        unit_price: item.price,
      })),
    };

    const createdOrder = await createOrder(payload);

    // Simpan data struk dari response API / cart lokal
    receiptData.value = {
      items: [...cart.value],
      subtotal: subtotal.value,
      tax: tax.value,
      grandTotal: createdOrder.total_price || grandTotal.value,
      paymentAmount: createdOrder.amount_paid || paymentAmount.value!,
      kembalian: createdOrder.change_amount ?? kembalian.value,
      transactionCode: createdOrder.order_number,
      date: new Date(createdOrder.created_at || Date.now()).toLocaleString('id-ID', {
        day: '2-digit',
        month: 'long',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }),
    };

    // Tutup modal pembayaran, buka modal sukses
    paymentModalVisible.value = false;
    successModalVisible.value = true;

    // Reset cart & reload data stok produk
    cart.value = [];
    await loadProducts();
  } catch (err) {
    toast.add({
      severity: 'error',
      summary: 'Gagal membuat pesanan',
      detail: err instanceof Error ? err.message : 'Terjadi kesalahan saat memproses transaksi.',
      life: 4000,
    });
  } finally {
    isSubmittingOrder.value = false;
  }
};

const handlePrintReceipt = (): void => {
  successModalVisible.value = false;
  window.print();
};

const handleSkipReceipt = (): void => {
  successModalVisible.value = false;
  receiptData.value = null;
};
</script>

<template>
    <div class="grid m-0 min-h-screen">
        <!-- Product Area -->
        <section class="col-12 xl:col-8 p-3">
            <!-- Search -->
            <div class="mb-3">
                <IconField class="w-full">
                    <InputIcon class="pi pi-search" />
                    <InputText
                        v-model="search"
                        class="w-full"
                        placeholder="Cari produk atau SKU..."
                        @input="handleSearchInput"
                    />
                </IconField>
            </div>


            <!-- Categories -->
            <div class="flex align-items-center gap-2 overflow-x-auto pb-2 mb-3">
                <Button
                    v-for="category in categories"
                    :key="category.id"
                    :label="category.name"
                    size="small"
                    rounded
                    :severity="selectedCategoryId === category.id ? 'primary' : 'secondary'"
                    :outlined="selectedCategoryId !== category.id"
                    class="white-space-nowrap flex-shrink-0 w-auto"
                    @click="handleCategorySelect(category.id)"
                />

                <ProgressSpinner
                    v-if="isLoadingCategories"
                    style="width: 1.5rem; height: 1.5rem"
                    stroke-width="4"
                />
            </div>

            <!-- Products -->
            <div v-if="isLoadingProducts" class="flex justify-content-center align-items-center py-8">
                <ProgressSpinner style="width: 3rem; height: 3rem" stroke-width="4" />
            </div>

            <div v-else class="grid">
                <div
                    v-for="product in filteredProducts"
                    :key="product.id"
                    class="col-4"
                >
                    <div
                        class="surface-card border-1 border-200 border-round-lg overflow-hidden relative flex flex-column h-full transition-all duration-200 select-none font-sans"
                        :class="[
                            isOutOfStock(product)
                                ? 'cursor-not-allowed opacity-60'
                                : isLowStock(product)
                                ? 'cursor-pointer opacity-75 hover:shadow-2'
                                : 'cursor-pointer hover:shadow-2'
                        ]"
                        @click="addToCart(product)"
                    >
                        <!-- Header / Image Area -->
                        <div class="relative surface-100 overflow-hidden" style="height: 8.5rem">
                            <Image
                                v-if="product.imageUrl && !failedImageMap[product.id]"
                                :src="product.imageUrl"
                                :alt="product.name"
                                image-class="w-full h-full"
                                :image-style="{ height: '8.5rem', width: '100%', objectFit: 'cover' }"
                                @error="handleImageError(product.id)"
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

                            <!-- Stock Tag: Only shown when LOW STOCK or OUT OF STOCK -->
                            <span
                                v-if="isLowStock(product)"
                                class="absolute top-0 right-0 m-2 px-2 py-1 text-xs font-bold border-round-md bg-red-100 text-red-600 tracking-wide uppercase z-2 shadow-1"
                                style="font-size: 0.7rem; line-height: 1;"
                            >
                                LOW STOCK
                            </span>
                            <span
                                v-else-if="isOutOfStock(product)"
                                class="absolute top-0 right-0 m-2 px-2 py-1 text-xs font-bold border-round-md bg-gray-800 text-white tracking-wide uppercase z-2 shadow-1"
                                style="font-size: 0.7rem; line-height: 1;"
                            >
                                HABIS
                            </span>
                        </div>

                        <!-- Body Content -->
                        <div class="p-3 flex flex-column flex-1 justify-content-between gap-2">
                            <div>
                                <span class="text-xs text-400 font-semibold tracking-wider uppercase block mb-1">
                                    {{ product.sku }}
                                </span>
                                <div class="text-900 font-medium text-sm line-height-3 line-clamp-2" style="min-height: 2.4rem">
                                    {{ product.name }}
                                </div>
                            </div>

                            <div class="flex align-items-center justify-content-between mt-2 pt-1">
                                <span class="text-blue-600 text-lg font-bold">
                                    {{ formatCurrencyIDR(product.selling_price) }}
                                </span>

                                <Button
                                    v-if="!isOutOfStock(product)"
                                    icon="pi pi-plus"
                                    rounded
                                    text
                                    size="small"
                                    class="p-0 w-2rem h-2rem text-blue-600 hover:bg-blue-50"
                                    title="Tambah ke Keranjang"
                                    @click.stop="addToCart(product)"
                                />
                            </div>
                        </div>
                    </div>
                </div>

                <div v-if="!filteredProducts.length" class="col-12">
                    <div class="flex flex-column align-items-center justify-content-center gap-2 py-8 text-color-secondary">
                        <i class="pi pi-search text-4xl" />
                        <span>Produk tidak ditemukan</span>
                    </div>
                </div>
            </div>
        </section>

        <!-- Current Order -->
        <aside
            class="col-12 xl:col-4 surface-card border-left-1 surface-border p-0"
            style="position: sticky; top: 0; height: 100vh; overflow: hidden"
        >
            <div class="flex flex-column h-full">
                <!-- Order Header -->
                <div class="flex align-items-center justify-content-between px-3 py-3 flex-shrink-0">
                    <div class="flex align-items-center gap-2">
                        <i class="pi pi-shopping-cart text-xl" />
                        <span class="text-lg font-semibold">Current Order</span>
                    </div>
                    <Badge :value="`${cartItemCount} item`" severity="secondary" />
                </div>

                <Divider class="m-0 flex-shrink-0" />

                <!-- Cart Items — scrollable area -->
                <div class="flex-1 overflow-y-auto">
                    <!-- Empty state -->
                    <div
                        v-if="!cart.length"
                        class="flex flex-column align-items-center justify-content-center gap-3 h-full text-color-secondary py-8"
                    >
                        <i class="pi pi-shopping-cart text-6xl" />
                        <span>Keranjang masih kosong</span>
                    </div>

                    <!-- Cart Items -->
                    <div v-else class="flex flex-column">
                        <div
                            v-for="item in cart"
                            :key="item.productId"
                            class="px-3 py-3"
                        >
                            <div class="flex justify-content-between gap-3">
                                <div class="flex-1">
                                    <span class="text-xs text-color-secondary">
                                        {{ item.sku }}
                                    </span>

                                    <div class="font-medium text-sm mt-1">
                                        {{ item.name }}
                                    </div>

                                    <div class="text-primary font-semibold mt-2">
                                        {{ formatCurrencyIDR(item.price) }}
                                    </div>
                                </div>

                                <Button
                                    icon="pi pi-trash"
                                    severity="danger"
                                    text
                                    rounded
                                    size="small"
                                    title="Hapus dari Keranjang"
                                    @click="removeCartItem(item.productId)"
                                />
                            </div>

                            <div class="flex align-items-center justify-content-between gap-3 mt-3">
                                <div class="flex align-items-center gap-2">
                                    <Button
                                        icon="pi pi-minus"
                                        rounded
                                        outlined
                                        size="small"
                                        title="Kurangi Jumlah"
                                        @click="decreaseQuantity(item.productId)"
                                    />

                                    <span class="font-semibold text-center" style="min-width: 2rem">
                                        {{ item.quantity }}
                                    </span>

                                    <Button
                                        icon="pi pi-plus"
                                        rounded
                                        outlined
                                        size="small"
                                        title="Tambah Jumlah"
                                        :disabled="item.quantity >= item.stock"
                                        @click="increaseQuantity(item.productId)"
                                    />
                                </div>

                                <span class="font-semibold">
                                    {{ formatCurrencyIDR(item.price * item.quantity) }}
                                </span>
                            </div>

                            <Divider />
                        </div>
                    </div>
                </div>

                <!-- Summary — always visible at bottom of panel -->
                <div class="border-top-1 surface-border p-3 flex-shrink-0">
                    <div class="flex flex-column gap-2">
                        <div class="flex align-items-center justify-content-between text-sm">
                            <span class="text-color-secondary">Subtotal</span>
                            <span class="font-medium">{{ formatCurrencyIDR(subtotal) }}</span>
                        </div>

                        <div class="flex align-items-center justify-content-between text-sm">
                            <span class="text-color-secondary">Pajak (11%)</span>
                            <span class="font-medium">{{ formatCurrencyIDR(tax) }}</span>
                        </div>

                        <Divider class="my-1" />

                        <div class="flex align-items-center justify-content-between">
                            <span class="text-lg font-bold">Total</span>
                            <span class="text-xl font-bold text-primary">
                                {{ formatCurrencyIDR(grandTotal) }}
                            </span>
                        </div>

                        <Button
                            label="Bayar Sekarang"
                            icon="pi pi-wallet"
                            size="large"
                            class="w-full mt-1"
                            :disabled="!cart.length"
                            @click="handlePay"
                        />

                        <Button
                            label="Kosongkan Pesanan"
                            icon="pi pi-trash"
                            severity="secondary"
                            text
                            size="small"
                            class="w-full"
                            :disabled="!cart.length"
                            @click="clearCart"
                        />
                    </div>
                </div>
            </div>
        </aside>
    </div>

    <!-- =====================================================
         MODAL 1: INPUT NOMINAL PEMBAYARAN
    ====================================================== -->
    <Dialog
        v-model:visible="paymentModalVisible"
        modal
        append-to="body"
        header="Pembayaran"
        :draggable="false"
        style="width: 26rem"
    >
        <div class="flex flex-column gap-4">
            <!-- Ringkasan Order -->
            <div class="surface-ground border-round p-3 flex flex-column gap-2">
                <div class="flex justify-content-between text-sm">
                    <span class="text-color-secondary">Subtotal</span>
                    <span>{{ formatCurrencyIDR(subtotal) }}</span>
                </div>
                <div class="flex justify-content-between text-sm">
                    <span class="text-color-secondary">Pajak (11%)</span>
                    <span>{{ formatCurrencyIDR(tax) }}</span>
                </div>
                <Divider class="my-1" />
                <div class="flex justify-content-between font-bold text-lg">
                    <span>Total</span>
                    <span class="text-primary">{{ formatCurrencyIDR(grandTotal) }}</span>
                </div>
            </div>

            <!-- Input Nominal -->
            <div class="flex flex-column gap-2">
                <label class="font-medium text-sm">Nominal Dibayar</label>
                <InputNumber
                    v-model="paymentAmount"
                    :min="0"
                    :use-grouping="true"
                    mode="currency"
                    currency="IDR"
                    locale="id-ID"
                    placeholder="Masukkan nominal pembayaran"
                    class="w-full"
                    :invalid="paymentAmount !== null && isPaymentInsufficient"
                    @keyup.enter="confirmPayment"
                />
                <small v-if="paymentAmount !== null && isPaymentInsufficient" class="text-red-500">
                    Nominal kurang dari total pembayaran.
                </small>
            </div>

            <!-- Kembalian -->
            <div
                v-if="paymentAmount && !isPaymentInsufficient"
                class="surface-ground border-round p-3"
            >
                <div class="flex justify-content-between align-items-center">
                    <span class="font-medium text-sm">Kembalian</span>
                    <span class="text-2xl font-bold text-green-500">
                        {{ formatCurrencyIDR(kembalian) }}
                    </span>
                </div>
            </div>

            <!-- Quick Amount Buttons -->
            <div class="flex flex-column gap-2">
                <span class="text-xs text-color-secondary">Nominal cepat</span>
                <div class="flex flex-wrap gap-2">
                    <Button
                        v-for="amount in [50000, 100000, 200000, 500000]"
                        :key="amount"
                        :label="formatCurrencyIDR(amount)"
                        size="small"
                        severity="secondary"
                        outlined
                        @click="paymentAmount = amount"
                    />
                    <Button
                        label="Uang Pas"
                        size="small"
                        severity="secondary"
                        outlined
                        @click="paymentAmount = Math.ceil(grandTotal / 1000) * 1000"
                    />
                </div>
            </div>
        </div>

        <template #footer>
            <Button
                label="Batal"
                severity="secondary"
                outlined
                @click="paymentModalVisible = false"
            />
            <Button
                label="Konfirmasi Pembayaran"
                icon="pi pi-check"
                :disabled="isPaymentInsufficient"
                @click="confirmPayment"
            />
        </template>
    </Dialog>

    <!-- =====================================================
         MODAL 2: PEMBAYARAN BERHASIL
    ====================================================== -->
    <Dialog
        v-model:visible="successModalVisible"
        modal
        append-to="body"
        :closable="false"
        :draggable="false"
        style="width: 28rem"
    >
        <template #header>
            <div class="flex align-items-center gap-3 w-full">
                <div
                    class="flex align-items-center justify-content-center border-circle bg-green-100"
                    style="width: 3rem; height: 3rem"
                >
                    <i class="pi pi-check-circle text-green-500 text-2xl" />
                </div>
                <div>
                    <div class="font-bold text-lg text-900">Pembayaran Berhasil!</div>
                    <div class="text-xs text-color-secondary mt-1">
                        {{ receiptData?.transactionCode }} · {{ receiptData?.date }}
                    </div>
                </div>
            </div>
        </template>

        <div v-if="receiptData" class="flex flex-column gap-3">
            <!-- Item List -->
            <div class="surface-ground border-round p-3 flex flex-column gap-2">
                <div
                    v-for="item in receiptData.items"
                    :key="item.productId"
                    class="flex justify-content-between text-sm"
                >
                    <span class="text-900">{{ item.name }} <span class="text-color-secondary">×{{ item.quantity }}</span></span>
                    <span class="font-medium">{{ formatCurrencyIDR(item.price * item.quantity) }}</span>
                </div>
            </div>

            <!-- Ringkasan -->
            <div class="flex flex-column gap-2">
                <div class="flex justify-content-between text-sm">
                    <span class="text-color-secondary">Subtotal</span>
                    <span>{{ formatCurrencyIDR(receiptData.subtotal) }}</span>
                </div>
                <div class="flex justify-content-between text-sm">
                    <span class="text-color-secondary">Pajak (11%)</span>
                    <span>{{ formatCurrencyIDR(receiptData.tax) }}</span>
                </div>
                <Divider class="my-1" />
                <div class="flex justify-content-between font-bold">
                    <span>Total</span>
                    <span>{{ formatCurrencyIDR(receiptData.grandTotal) }}</span>
                </div>
                <div class="flex justify-content-between text-sm">
                    <span class="text-color-secondary">Dibayar</span>
                    <span>{{ formatCurrencyIDR(receiptData.paymentAmount) }}</span>
                </div>
                <div class="flex justify-content-between font-bold text-green-600">
                    <span>Kembalian</span>
                    <span>{{ formatCurrencyIDR(receiptData.kembalian) }}</span>
                </div>
            </div>
        </div>

        <template #footer>
            <Button
                label="Tidak, Terima Kasih"
                severity="secondary"
                outlined
                @click="handleSkipReceipt"
            />
            <Button
                label="Cetak Struk"
                icon="pi pi-print"
                @click="handlePrintReceipt"
            />
        </template>
    </Dialog>

</template>