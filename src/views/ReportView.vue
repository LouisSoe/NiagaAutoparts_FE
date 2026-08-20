<script setup lang="ts">
import { computed, ref, onMounted, watch } from 'vue';

import Button from 'primevue/button';
import Card from 'primevue/card';
import Chart from 'primevue/chart';
import DatePicker from 'primevue/datepicker';
import SelectButton from 'primevue/selectbutton';
import ProgressSpinner from 'primevue/progressspinner';

import type { ChartData, ChartOptions } from 'chart.js';

import { formatCurrencyIDR } from '@/utils/format';
import { fetchOrders } from '@/services/orderService';
import { fetchProducts } from '@/services/productService';
import { getExportUrl, formatDateToApi } from '@/services/reportService';
import type { Order } from '@/types/order';

type TrendMode = 'daily' | 'monthly';

interface SummaryItem {
    label: string;
    value: string;
    icon: string;
    iconClass: string;
    borderClass: string;
    comparisonText: string;
    comparisonIcon?: string;
    comparisonClass: string;
}

interface TrendItem {
    label: string;
    value: number;
}

interface CategoryItem {
    name: string;
    value: number;
    color: string;
}

const getFirstDayOfMonth = (): Date => {
    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth(),
        1
    );
};

const getLastDayOfMonth = (): Date => {
    const now = new Date();

    return new Date(
        now.getFullYear(),
        now.getMonth() + 1,
        0
    );
};

const startDate = ref<Date>(getFirstDayOfMonth());
const endDate = ref<Date>(getLastDayOfMonth());

const trendMode = ref<TrendMode>('monthly');
const isLoading = ref<boolean>(false);

const trendModes = [
    {
        label: 'Harian',
        value: 'daily'
    },
    {
        label: 'Bulanan',
        value: 'monthly'
    }
] satisfies Array<{
    label: string;
    value: TrendMode;
}>;

/*
|--------------------------------------------------------------------------
| Dynamic Data State
|--------------------------------------------------------------------------
*/

const rawSummary = ref({
    grossRevenue: 0,
    totalTransactions: 0,
    lowStock: 0,
    profitMargin: 0
});

const dailyRevenue = ref<TrendItem[]>([]);
const monthlyRevenue = ref<TrendItem[]>([]);
const categoryItems = ref<CategoryItem[]>([]);

const loadReportData = async (): Promise<void> => {
    isLoading.value = true;
    try {
        const startStr = formatDateToApi(startDate.value);
        const endStr = formatDateToApi(endDate.value);

        const [ordersRes, productsRes] = await Promise.allSettled([
            fetchOrders({ limit: 500 }),
            fetchProducts({ limit: 500 })
        ]);

        let orders: Order[] = [];
        if (ordersRes.status === 'fulfilled') {
            orders = ordersRes.value.data;
        }

        // Filter orders by selected date range
        const filteredOrders = orders.filter((o) => {
            if (!o.created_at) return false;
            const dateStr = o.created_at.split('T')[0];
            return dateStr >= startStr && dateStr <= endStr;
        });

        // Map product purchase_price
        const productMap = new Map<number, any>();
        let lowStockCount = 0;
        if (productsRes.status === 'fulfilled') {
            productsRes.value.data.forEach((p) => {
                productMap.set(p.id, p);
            });
            lowStockCount = productsRes.value.data.filter(
                (p) => (p.stock - (p.reserved ?? 0)) <= (p.minimumStock || 5)
            ).length;
        }

        // 1. Calculate Summary
        let grossRev = 0;
        let totalCost = 0;
        const validPaidOrders = filteredOrders.filter(
            (o) => o.status === 'paid' || o.status === 'completed' || o.status === 'settlement'
        );

        validPaidOrders.forEach((o) => {
            grossRev += o.total_price;
            let orderCost = 0;
            if (o.items && o.items.length > 0) {
                o.items.forEach((it) => {
                    const prod = productMap.get(it.product_id);
                    const buyPrice = prod?.purchase_price ?? prod?.purchasePrice ?? (it.unit_price * 0.7);
                    orderCost += buyPrice * it.quantity;
                });
            } else {
                orderCost = o.total_price * 0.7;
            }
            totalCost += orderCost;
        });

        const margin = grossRev > 0 ? Math.round(((grossRev - totalCost) / grossRev) * 100 * 10) / 10 : 0;

        rawSummary.value = {
            grossRevenue: grossRev,
            totalTransactions: filteredOrders.length,
            lowStock: lowStockCount,
            profitMargin: margin
        };

        // 2. Calculate Daily Revenue Trend
        const dayMap = new Map<string, number>();
        // Pre-fill all days in the date range so days with 0 revenue are also represented
        const curDate = new Date(startDate.value);
        const lastDate = new Date(endDate.value);
        curDate.setHours(0, 0, 0, 0);
        lastDate.setHours(0, 0, 0, 0);

        // If range is reasonable (<= 90 days), fill daily dates
        const diffTime = Math.abs(lastDate.getTime() - curDate.getTime());
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;

        if (diffDays <= 90) {
            const tempDate = new Date(curDate);
            while (tempDate <= lastDate) {
                const dStr = formatDateToApi(tempDate);
                const dayLabel = `${String(tempDate.getDate()).padStart(2, '0')}/${String(tempDate.getMonth() + 1).padStart(2, '0')}`;
                dayMap.set(dStr, 0);
                tempDate.setDate(tempDate.getDate() + 1);
            }
        }

        validPaidOrders.forEach((o) => {
            if (o.created_at) {
                const dateKey = o.created_at.split('T')[0];
                dayMap.set(dateKey, (dayMap.get(dateKey) || 0) + o.total_price);
            }
        });

        const dailyList: TrendItem[] = [];
        Array.from(dayMap.keys()).sort().forEach((key) => {
            const parts = key.split('-');
            const label = parts.length === 3 ? `${parts[2]}/${parts[1]}` : key;
            dailyList.push({ label, value: dayMap.get(key) || 0 });
        });
        dailyRevenue.value = dailyList.length > 0 ? dailyList : [{ label: '01', value: 0 }];

        // 3. Calculate Monthly Revenue Trend for the selected filter range
        const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
        const monthMap = new Map<string, number>();

        // Pre-populate months within the selected date range
        const tempMonth = new Date(curDate.getFullYear(), curDate.getMonth(), 1);
        const endMonth = new Date(lastDate.getFullYear(), lastDate.getMonth(), 1);
        while (tempMonth <= endMonth) {
            const mKey = `${tempMonth.getFullYear()}-${String(tempMonth.getMonth() + 1).padStart(2, '0')}`;
            monthMap.set(mKey, 0);
            tempMonth.setMonth(tempMonth.getMonth() + 1);
        }

        validPaidOrders.forEach((o) => {
            if (o.created_at) {
                const d = new Date(o.created_at);
                const mKey = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
                monthMap.set(mKey, (monthMap.get(mKey) || 0) + o.total_price);
            }
        });

        const monthlyList: TrendItem[] = [];
        Array.from(monthMap.keys()).sort().forEach((mKey) => {
            const [y, m] = mKey.split('-');
            const mIdx = parseInt(m, 10) - 1;
            const name = monthNames[mIdx] || m;
            const label = curDate.getFullYear() === lastDate.getFullYear() ? name : `${name} '${y.slice(2)}`;
            monthlyList.push({ label, value: monthMap.get(mKey) || 0 });
        });
        monthlyRevenue.value = monthlyList.length > 0 ? monthlyList : monthNames.slice(0, 6).map(m => ({ label: m, value: 0 }));

        // 4. Category distribution from order items & products
        const productsMap = new Map<number, string>();
        if (productsRes.status === 'fulfilled') {
            productsRes.value.data.forEach((p) => {
                const catName = p.categoryName || p.category || 'Lainnya';
                productsMap.set(p.id, catName);
            });
        }

        const catMap = new Map<string, number>();
        filteredOrders.forEach((o) => {
            if (o.items) {
                o.items.forEach((item) => {
                    const catName = productsMap.get(item.product_id) || 'Lainnya';
                    catMap.set(catName, (catMap.get(catName) || 0) + item.subtotal);
                });
            }
        });

        const colors = ['#2563eb', '#111827', '#374151', '#737373', '#059669', '#d97706', '#dc2626'];
        const catList: CategoryItem[] = [];
        let totalVal = 0;
        catMap.forEach((val) => { totalVal += val; });

        let colorIdx = 0;
        catMap.forEach((val, name) => {
            const pct = totalVal > 0 ? Math.round((val / totalVal) * 100) : 0;
            catList.push({ name, value: pct, color: colors[colorIdx % colors.length] });
            colorIdx++;
        });

        categoryItems.value = catList;

    } catch (err) {
        console.error('[ReportView] Error loading report data:', err);
    } finally {
        isLoading.value = false;
    }
};

onMounted(() => {
    loadReportData();
});

watch([startDate, endDate], () => {
    loadReportData();
});

const summaryItems = computed<SummaryItem[]>(() => {
    const summary = rawSummary.value;

    return [
        {
            label: 'Pendapatan Kotor',
            value: formatCurrencyIDR(summary.grossRevenue),
            icon: 'pi pi-wallet',
            iconClass: 'text-blue-600',
            borderClass: 'border-left-3 border-blue-500',
            comparisonText: 'Total Periode Ini',
            comparisonIcon: 'pi pi-arrow-up-right',
            comparisonClass: 'text-green-600'
        },
        {
            label: 'Total Transaksi',
            value: new Intl.NumberFormat('id-ID').format(
                summary.totalTransactions
            ),
            icon: 'pi pi-receipt',
            iconClass: 'text-primary',
            borderClass: 'border-left-3 border-primary',
            comparisonText: 'Order Masuk',
            comparisonIcon: 'pi pi-arrow-up-right',
            comparisonClass: 'text-green-600'
        },
        {
            label: 'Stok Menipis',
            value: `${summary.lowStock} Item`,
            icon: 'pi pi-exclamation-triangle',
            iconClass: 'text-red-500',
            borderClass: 'border-left-3 border-red-500',
            comparisonText: 'Perlu Restock',
            comparisonIcon: 'pi pi-exclamation-triangle',
            comparisonClass: 'text-red-500'
        },
        {
            label: 'Margin Keuntungan',
            value: `${summary.profitMargin}%`,
            icon: 'pi pi-chart-bar',
            iconClass: 'text-blue-600',
            borderClass: 'border-left-3 border-indigo-300',
            comparisonText: 'Perkiraan Margin',
            comparisonIcon: 'pi pi-minus',
            comparisonClass: 'text-color-secondary'
        }
    ];
});

/*
|--------------------------------------------------------------------------
| Trend Pendapatan
|--------------------------------------------------------------------------
*/

const selectedTrend = computed<TrendItem[]>(() => {
    return trendMode.value === 'daily'
        ? dailyRevenue.value
        : monthlyRevenue.value;
});

const revenueChartData = computed<ChartData<'line'>>(() => ({
    labels: selectedTrend.value.map((item) => item.label),

    datasets: [
        {
            label: 'Pendapatan',
            data: selectedTrend.value.map((item) => item.value),
            borderColor: '#2563eb',
            backgroundColor: 'rgba(37, 99, 235, 0.12)',
            pointBackgroundColor: '#2563eb',
            pointBorderColor: '#2563eb',
            pointRadius: 3,
            pointHoverRadius: 5,
            borderWidth: 2,
            tension: 0.4,
            fill: true
        }
    ]
}));

const revenueChartOptions = computed<ChartOptions<'line'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,

    plugins: {
        legend: {
            display: false
        },

        tooltip: {
            callbacks: {
                label(context) {
                    const value = Number(context.raw ?? 0);

                    return `Pendapatan: ${formatCurrencyIDR(value)}`;
                }
            }
        }
    },

    interaction: {
        intersect: false,
        mode: 'index'
    },

    scales: {
        x: {
            grid: {
                display: false
            },

            ticks: {
                color: '#6b7280'
            },

            border: {
                display: false
            }
        },

        y: {
            beginAtZero: true,

            grid: {
                color: '#e5e7eb'
            },

            ticks: {
                color: '#6b7280',

                callback(value) {
                    const numericValue = Number(value);

                    if (numericValue >= 1_000_000) {
                        return `${numericValue / 1_000_000} jt`;
                    }

                    if (numericValue >= 1_000) {
                        return `${numericValue / 1_000} rb`;
                    }

                    return numericValue;
                }
            },

            border: {
                display: false
            }
        }
    }
}));

/*
|--------------------------------------------------------------------------
| Kategori Terlaris
|--------------------------------------------------------------------------
*/

const categoryChartData = computed<ChartData<'doughnut'>>(() => ({
    labels: categoryItems.value.map((item) => item.name),

    datasets: [
        {
            data: categoryItems.value.map((item) => item.value),
            backgroundColor: categoryItems.value.map(
                (item) => item.color
            ),
            borderWidth: 0,
            hoverOffset: 4
        }
    ]
}));

const categoryChartOptions = computed<ChartOptions<'doughnut'>>(() => ({
    responsive: true,
    maintainAspectRatio: false,

    cutout: '67%',

    plugins: {
        legend: {
            display: true,
            position: 'bottom',

            labels: {
                usePointStyle: true,
                pointStyle: 'rect',
                boxWidth: 8,
                boxHeight: 8,
                padding: 16,
                color: '#374151'
            }
        },

        tooltip: {
            callbacks: {
                label(context) {
                    const label = context.label ?? '';
                    const value = Number(context.raw ?? 0);

                    return `${label}: ${value}%`;
                }
            }
        }
    }
}));

/*
|--------------------------------------------------------------------------
| Export Handlers
|--------------------------------------------------------------------------
*/

const handleExportExcel = (): void => {
    window.open(
        getExportUrl('excel', startDate.value, endDate.value),
        '_blank',
        'noopener,noreferrer'
    );
};

const handleExportPdf = (): void => {
    window.open(
        getExportUrl('pdf', startDate.value, endDate.value),
        '_blank',
        'noopener,noreferrer'
    );
};
</script>

<template>
    <div class="flex flex-column gap-4">
        <!-- Header -->
        <div
            class="
                flex
                flex-column
                lg:flex-row
                lg:align-items-start
                justify-content-between
                gap-3
            "
        >
            <div>
                <h1 class="m-0 text-2xl font-semibold text-color">
                    Laporan Penjualan & Inventaris
                </h1>

                <p class="mt-2 mb-0 text-sm text-color-secondary">
                    Analisis performa bengkel dan manajemen stok suku
                    cadang.
                </p>
            </div>

            <div
                class="
                    flex
                    flex-column
                    md:flex-row
                    align-items-stretch
                    md:align-items-center
                    gap-2
                "
            >
                <!-- Start Date -->
                <DatePicker
                    v-model="startDate"
                    showIcon
                    :manualInput="false"
                    dateFormat="dd/mm/yy"
                    placeholder="Tanggal mulai"
                />

                <span
                    class="
                        hidden
                        md:inline
                        text-sm
                        text-color-secondary
                        white-space-nowrap
                    "
                >
                    sampai
                </span>

                <!-- End Date -->
                <DatePicker
                    v-model="endDate"
                    showIcon
                    :manualInput="false"
                    dateFormat="dd/mm/yy"
                    placeholder="Tanggal akhir"
                    :minDate="startDate"
                />

                <Button
                    label="Ekspor Excel"
                    icon="pi pi-download"
                    severity="secondary"
                    outlined
                    title="Ekspor laporan ke file Excel (.xlsx)"
                    @click="handleExportExcel"
                />

                <Button
                    label="Ekspor PDF"
                    icon="pi pi-file-pdf"
                    title="Ekspor laporan ke file PDF (.pdf)"
                    @click="handleExportPdf"
                />
            </div>
        </div>

        <!-- Summary -->
        <div class="grid">
            <div
                v-for="item in summaryItems"
                :key="item.label"
                class="col-12 sm:col-6 xl:col-3"
            >
                <Card
                    :class="[
                        'h-full shadow-none border-none',
                        item.borderClass
                    ]"
                >
                    <template #content>
                        <div class="flex flex-column gap-3">
                            <div
                                class="
                                    flex
                                    align-items-center
                                    justify-content-between
                                    gap-3
                                "
                            >
                                <span
                                    class="
                                        text-xs
                                        font-medium
                                        text-color-secondary
                                        uppercase
                                    "
                                >
                                    {{ item.label }}
                                </span>

                                <i
                                    :class="[
                                        item.icon,
                                        item.iconClass,
                                        'text-lg'
                                    ]"
                                />
                            </div>

                            <div class="text-2xl font-semibold text-color">
                                {{ item.value }}
                            </div>

                            <div
                                :class="[
                                    'flex align-items-center gap-1 text-xs font-medium',
                                    item.comparisonClass
                                ]"
                            >
                                <i
                                    v-if="item.comparisonIcon"
                                    :class="item.comparisonIcon"
                                />

                                <span>
                                    {{ item.comparisonText }}
                                </span>
                            </div>
                        </div>
                    </template>
                </Card>
            </div>
        </div>

        <!-- Charts -->
        <div class="grid">
            <!-- Revenue Chart -->
            <div class="col-12 xl:col-8">
                <Card
                    class="
                        h-full
                        shadow-none
                        border-1
                        surface-border
                    "
                >
                    <template #title>
                        <div
                            class="
                                flex
                                flex-column
                                sm:flex-row
                                sm:align-items-center
                                justify-content-between
                                gap-3
                            "
                        >
                            <span class="text-lg font-semibold">
                                Tren Pendapatan
                            </span>

                            <SelectButton
                                v-model="trendMode"
                                :options="trendModes"
                                optionLabel="label"
                                optionValue="value"
                                :allowEmpty="false"
                            />
                        </div>
                    </template>

                    <template #content>
                        <div style="height: 22rem">
                            <Chart
                                type="line"
                                :data="revenueChartData"
                                :options="revenueChartOptions"
                                class="h-full"
                            />
                        </div>
                    </template>
                </Card>
            </div>

            <!-- Category Chart -->
            <div class="col-12 xl:col-4">
                <Card
                    class="
                        h-full
                        shadow-none
                        border-1
                        surface-border
                    "
                >
                    <template #title>
                        <span class="text-lg font-semibold">
                            Kategori Terlaris
                        </span>
                    </template>

                    <template #content>
                        <div style="height: 22rem">
                            <Chart
                                type="doughnut"
                                :data="categoryChartData"
                                :options="categoryChartOptions"
                                class="h-full"
                            />
                        </div>
                    </template>
                </Card>
            </div>
        </div>
    </div>
</template>