/**
 * reportService.ts
 * Service untuk mengambil data laporan penjualan & inventaris dari backend API / ekspor laporan.
 */

import { apiFetch, BASE_URL } from './api'

export interface ReportSummary {
  grossRevenue: number
  totalTransactions: number
  lowStock: number
  profitMargin: number
}

export interface TrendItem {
  label: string
  value: number
}

export interface CategoryItem {
  name: string
  value: number
  color: string
}

export interface ReportParams {
  startDate?: string
  endDate?: string
}

/**
 * Format Date object to YYYY-MM-DD string
 */
export function formatDateToApi(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

/**
 * Fetch report summary & chart data
 */
export async function fetchReportSummary(params?: ReportParams): Promise<{
  summary: ReportSummary
  dailyTrend: TrendItem[]
  monthlyTrend: TrendItem[]
  topCategories: CategoryItem[]
}> {
  const queryParams = new URLSearchParams()
  if (params?.startDate) queryParams.append('start_date', params.startDate)
  if (params?.endDate) queryParams.append('end_date', params.endDate)

  const queryString = queryParams.toString()
  const endpoint = `/api/v1/reports/summary${queryString ? `?${queryString}` : ''}`

  try {
    const res = await apiFetch<any>(endpoint)
    if (res && res.data) {
      return {
        summary: res.data.summary,
        dailyTrend: res.data.dailyTrend || [],
        monthlyTrend: res.data.monthlyTrend || [],
        topCategories: res.data.topCategories || [],
      }
    }
  } catch {
    // If endpoint is not yet defined on backend, fallback gracefully
  }

  return {
    summary: {
      grossRevenue: 0,
      totalTransactions: 0,
      lowStock: 0,
      profitMargin: 0,
    },
    dailyTrend: [],
    monthlyTrend: [],
    topCategories: [],
  }
}

/**
 * Get export URL for downloading report in excel or pdf
 */
export function getExportUrl(format: 'excel' | 'pdf', startDate?: Date, endDate?: Date): string {
  const queryParams = new URLSearchParams()
  if (startDate) queryParams.append('start_date', formatDateToApi(startDate))
  if (endDate) queryParams.append('end_date', formatDateToApi(endDate))

  const queryString = queryParams.toString()
  return `${BASE_URL}/api/v1/reports/export/${format}${queryString ? `?${queryString}` : ''}`
}
