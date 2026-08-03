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