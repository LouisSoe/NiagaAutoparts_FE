import { z } from 'zod'

/* =========================================================
 * SCHEMAS
 * ======================================================= */

/**
 * Customer Form Validation Schema
 */
export const customerSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama wajib diisi')
    .max(100, 'Nama maksimal 100 karakter'),
  phone: z
    .string()
    .min(1, 'Nomor HP/Telepon wajib diisi')
    .regex(/^[0-9+--\s()]+$/, 'Format nomor telepon tidak valid'),
  email: z
    .string()
    .email('Format email tidak valid')
    .or(z.literal(''))
    .optional()
    .nullable(),
  address: z
    .string()
    .or(z.literal(''))
    .optional()
    .nullable(),
  type: z.string().optional().nullable(),
  code: z.string().optional(),
})

/**
 * User Form Validation Schema
 */
export const userSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama lengkap wajib diisi'),
  email: z
    .string()
    .min(1, 'Email wajib diisi')
    .email('Format email tidak valid'),
  role: z
    .string()
    .min(1, 'Role wajib dipilih'),
  password: z
    .string()
    .optional()
    .refine((val) => !val || val.length >= 6, {
      message: 'Password minimal 6 karakter',
    }),
})

/**
 * Category Form Validation Schema
 */
export const categorySchema = z.object({
  name: z
    .string()
    .min(1, 'Nama kategori wajib diisi')
    .max(100, 'Nama kategori maksimal 100 karakter'),
  slug: z
    .string()
    .optional(),
  description: z
    .string()
    .or(z.literal(''))
    .optional()
    .nullable(),
})

/**
 * Product Form Validation Schema
 */
export const productSchema = z.object({
  name: z
    .string()
    .min(1, 'Nama produk wajib diisi')
    .max(150, 'Nama produk maksimal 150 karakter'),
  code: z
    .string()
    .min(1, 'Kode produk wajib diisi'),
  price: z
    .number({ message: 'Harga jual harus berupa angka' })
    .min(0, 'Harga jual tidak boleh negatif'),
  buy_price: z
    .number({ message: 'Harga beli harus berupa angka' })
    .min(0, 'Harga beli tidak boleh negatif')
    .optional()
    .nullable(),
  stock: z
    .number({ message: 'Stok harus berupa angka' })
    .min(0, 'Stok tidak boleh negatif'),
  min_stock: z
    .number({ message: 'Stok minimal harus berupa angka' })
    .min(0, 'Stok minimal tidak boleh negatif')
    .optional()
    .nullable(),
  category_id: z
    .number({ message: 'Kategori wajib dipilih' })
    .nullable()
    .refine((val) => val !== null && val > 0, {
      message: 'Kategori wajib dipilih',
    }),
  description: z
    .string()
    .or(z.literal(''))
    .optional()
    .nullable(),
})

/**
 * Delivery Schedule Form Validation Schema
 */
export const deliveryScheduleSchema = z.object({
  day_of_week: z
    .string()
    .min(1, 'Hari wajib dipilih'),
  slot_name: z
    .string()
    .min(1, 'Nama slot wajib diisi')
    .max(50, 'Nama slot maksimal 50 karakter'),
  start_time: z
    .string()
    .min(1, 'Waktu mulai wajib diisi')
    .regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Format waktu mulai tidak valid (contoh: 09:00)'),
  end_time: z
    .string()
    .min(1, 'Waktu selesai wajib diisi')
    .regex(/^([01]\d|2[0-3]):([0-5]\d)(:([0-5]\d))?$/, 'Format waktu selesai tidak valid (contoh: 12:00)'),
  max_capacity: z
    .number({ message: 'Kapasitas maksimal harus berupa angka' })
    .min(1, 'Kapasitas minimal 1'),
  is_active: z.boolean().optional(),
})

/* =========================================================
 * HELPER FUNCTION
 * ======================================================= */

export type ValidationErrors<T> = Record<keyof T | string, string>

/**
 * Validate object data against a Zod schema.
 * Returns { success: boolean, errors: Record<string, string> }
 */
export function validateForm<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: boolean; errors: ValidationErrors<T> } {
  const result = schema.safeParse(data)

  if (result.success) {
    return { success: true, errors: {} }
  }

  const errors: Record<string, string> = {}
  for (const issue of result.error.issues) {
    const field = issue.path[0]
    if (field && !errors[field]) {
      errors[field.toString()] = issue.message
    }
  }

  return { success: false, errors }
}
