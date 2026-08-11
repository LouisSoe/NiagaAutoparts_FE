export const formatCurrencyIDR = (value: number): string => {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value)
}

export const formatNumberID = (value: number): string => {
  return new Intl.NumberFormat('id-ID').format(value)
}

export const getInitials = (
  value: string,
  maxLength: number = 2
): string => {
  return value
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, maxLength)
    .map((word) => word.charAt(0))
    .join('')
    .toUpperCase()
}

export const formatDateID = (dateStr?: string | Date): string => {
  if (!dateStr) return '-'
  const d = new Date(dateStr)
  if (isNaN(d.getTime())) return '-'
  return new Intl.DateTimeFormat('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  }).format(d)
}