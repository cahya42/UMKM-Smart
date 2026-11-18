import { z } from 'zod'

export const BUSINESS_TYPES = [
  'Perdagangan',
  'Produksi',
  'Makanan dan Minuman',
  'Jasa',
  'Kerajinan',
  'Pertanian',
  'Lainnya',
]

export const businessProfileSchema = z.object({
  businessName: z
    .string({ required_error: 'Nama usaha wajib diisi' })
    .trim()
    .min(2, 'Nama usaha minimal 2 karakter')
    .max(80, 'Nama usaha maksimal 80 karakter'),
  ownerName: z.string().trim().max(80, 'Nama pemilik maksimal 80 karakter').optional().default(''),
  businessType: z.string().min(1, 'Pilih jenis usaha'),
  address: z.string().trim().max(300, 'Alamat maksimal 300 karakter').optional().default(''),
  phone: z
    .string()
    .trim()
    .max(30, 'Nomor telepon maksimal 30 karakter')
    .refine((value) => value === '' || /^[0-9+()\-\s]+$/.test(value), {
      message: 'Nomor telepon hanya boleh berisi angka, spasi, +, -, dan tanda kurung',
    })
    .optional()
    .default(''),
  email: z
    .string()
    .trim()
    .refine((value) => value === '' || z.string().email().safeParse(value).success, {
      message: 'Format email tidak valid',
    })
    .optional()
    .default(''),
  description: z.string().trim().max(600, 'Deskripsi maksimal 600 karakter').optional().default(''),
  startDate: z
    .string()
    .optional()
    .default('')
    .refine((value) => value === '' || /^\d{4}-\d{2}-\d{2}$/.test(value), {
      message: 'Format tanggal mulai tidak valid',
    }),
})

const moneyField = z
  .number({ invalid_type_error: 'Masukkan angka nominal' })
  .min(0, 'Nominal tidak boleh negatif')
  .max(999_999_999_999, 'Nominal terlalu besar')

const quantityField = z
  .number({ invalid_type_error: 'Masukkan angka jumlah' })
  .min(0, 'Jumlah tidak boleh negatif')
  .max(1_000_000, 'Jumlah terlalu besar')

export const productSchema = z.object({
  name: z
    .string({ required_error: 'Nama produk wajib diisi' })
    .trim()
    .min(2, 'Nama produk minimal 2 karakter')
    .max(100, 'Nama produk maksimal 100 karakter'),
  sku: z.string().trim().max(40, 'SKU maksimal 40 karakter').optional().default(''),
  type: z.enum(['barang', 'jasa'], { errorMap: () => ({ message: 'Pilih jenis produk' }) }),
  categoryId: z.string().optional().default(''),
  unitId: z.string().min(1, 'Pilih satuan produk'),
  purchasePrice: moneyField,
  sellingPrice: moneyField,
  hpp: moneyField,
  stockQty: quantityField,
  minStock: quantityField,
  note: z.string().trim().max(300, 'Catatan maksimal 300 karakter').optional().default(''),
})

export const categorySchema = z.object({
  name: z
    .string({ required_error: 'Nama kategori wajib diisi' })
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter')
    .max(60, 'Nama kategori maksimal 60 karakter'),
})

export const unitSchema = z.object({
  name: z
    .string({ required_error: 'Nama satuan wajib diisi' })
    .trim()
    .min(1, 'Nama satuan wajib diisi')
    .max(20, 'Nama satuan maksimal 20 karakter'),
  description: z.string().trim().max(80, 'Keterangan maksimal 80 karakter').optional().default(''),
})

const DATE_KEY_PATTERN = /^\d{4}-\d{2}-\d{2}$/

export const costComponentSchema = z.object({
  costType: z.enum(['bahan', 'tenaga_kerja', 'overhead', 'lainnya'], {
    errorMap: () => ({ message: 'Pilih jenis komponen biaya' }),
  }),
  name: z
    .string({ required_error: 'Nama komponen wajib diisi' })
    .trim()
    .min(1, 'Nama komponen wajib diisi')
    .max(80, 'Nama komponen maksimal 80 karakter'),
  quantity: z
    .number({ invalid_type_error: 'Masukkan angka jumlah' })
    .gt(0, 'Jumlah komponen harus lebih dari 0')
    .max(1_000_000, 'Jumlah terlalu besar'),
  unitLabel: z.string().trim().max(20, 'Satuan maksimal 20 karakter').optional().default(''),
  unitCost: moneyField,
})

export const productCostSchema = z.object({
  productId: z.string().min(1, 'Pilih produk'),
  businessType: z.string().trim().min(1, 'Pilih jenis usaha'),
  effectiveDate: z.string().regex(DATE_KEY_PATTERN, 'Tanggal berlaku tidak valid'),
  batchQuantity: z
    .number({ invalid_type_error: 'Masukkan angka jumlah unit' })
    .gt(0, 'Jumlah unit per batch harus lebih dari 0')
    .max(1_000_000, 'Jumlah unit terlalu besar'),
  sellingPrice: moneyField,
  targetMargin: z
    .number({ invalid_type_error: 'Masukkan angka target margin' })
    .min(0, 'Target margin tidak boleh negatif')
    .max(99, 'Target margin harus di bawah 100%'),
  note: z.string().trim().max(300, 'Catatan maksimal 300 karakter').optional().default(''),
  components: z.array(costComponentSchema).min(1, 'Tambahkan minimal satu komponen biaya'),
})

export const saleItemSchema = z.object({
  productId: z.string().min(1, 'Pilih produk'),
  qty: z
    .number({ invalid_type_error: 'Masukkan angka jumlah' })
    .gt(0, 'Jumlah harus lebih dari 0')
    .max(1_000_000, 'Jumlah terlalu besar'),
  price: moneyField,
  discount: moneyField,
})

export const saleSchema = z.object({
  date: z.string().regex(DATE_KEY_PATTERN, 'Tanggal penjualan tidak valid'),
  customerName: z.string().trim().max(80, 'Nama pelanggan maksimal 80 karakter').optional().default(''),
  paymentMethod: z.enum(['tunai', 'transfer', 'qris', 'ewallet', 'lainnya'], {
    errorMap: () => ({ message: 'Pilih metode pembayaran' }),
  }),
  cashAccountId: z.string().min(1, 'Pilih akun kas penerima uang'),
  discount: moneyField,
  note: z.string().trim().max(200, 'Catatan maksimal 200 karakter').optional().default(''),
  items: z.array(saleItemSchema).min(1, 'Tambahkan minimal satu produk'),
})

export const expenseSchema = z.object({
  date: z.string().regex(DATE_KEY_PATTERN, 'Tanggal pengeluaran tidak valid'),
  expenseCategoryId: z.string().min(1, 'Pilih kategori pengeluaran'),
  cashAccountId: z.string().min(1, 'Pilih akun kas sumber dana'),
  amount: moneyField.refine((value) => value > 0, { message: 'Nominal harus lebih dari 0' }),
  description: z
    .string({ required_error: 'Keterangan wajib diisi' })
    .trim()
    .min(3, 'Keterangan minimal 3 karakter')
    .max(200, 'Keterangan maksimal 200 karakter'),
  note: z.string().trim().max(200, 'Catatan maksimal 200 karakter').optional().default(''),
})

export const expenseCategorySchema = z.object({
  name: z
    .string({ required_error: 'Nama kategori wajib diisi' })
    .trim()
    .min(2, 'Nama kategori minimal 2 karakter')
    .max(60, 'Nama kategori maksimal 60 karakter'),
})

export const cashAccountSchema = z.object({
  name: z
    .string({ required_error: 'Nama akun wajib diisi' })
    .trim()
    .min(2, 'Nama akun minimal 2 karakter')
    .max(60, 'Nama akun maksimal 60 karakter'),
  type: z.enum(['tunai', 'bank', 'ewallet'], {
    errorMap: () => ({ message: 'Pilih jenis akun kas' }),
  }),
  openingBalance: moneyField,
  note: z.string().trim().max(200, 'Catatan maksimal 200 karakter').optional().default(''),
})

export const cashTransferSchema = z
  .object({
    date: z.string().regex(DATE_KEY_PATTERN, 'Tanggal transfer tidak valid'),
    fromAccountId: z.string().min(1, 'Pilih akun sumber'),
    toAccountId: z.string().min(1, 'Pilih akun tujuan'),
    amount: moneyField.refine((value) => value > 0, { message: 'Nominal harus lebih dari 0' }),
    note: z.string().trim().max(200, 'Catatan maksimal 200 karakter').optional().default(''),
  })
  .refine((value) => value.fromAccountId !== value.toAccountId, {
    message: 'Akun sumber dan tujuan harus berbeda',
    path: ['toAccountId'],
  })

export const stockMovementSchema = z.object({
  productId: z.string().min(1, 'Pilih produk'),
  type: z.enum(['masuk', 'keluar', 'penyesuaian']),
  quantity: quantityField,
  date: z.string().regex(DATE_KEY_PATTERN, 'Tanggal tidak valid'),
  note: z.string().trim().max(200, 'Keterangan maksimal 200 karakter').optional().default(''),
  unitCost: moneyField.optional().default(0),
  supplierName: z.string().trim().max(80, 'Nama pemasok maksimal 80 karakter').optional().default(''),
  reason: z.string().trim().max(80, 'Alasan maksimal 80 karakter').optional().default(''),
})

export const licenseActivationSchema = z.object({
  email: z.string().trim().min(1, 'Email pembeli wajib diisi').email('Format email tidak valid'),
  token: z
    .string()
    .trim()
    .min(8, 'Token lisensi minimal 8 karakter')
    .max(200, 'Token lisensi terlalu panjang'),
})

/** Mengubah error Zod menjadi objek { field: pesan } untuk form. */
export function toFieldErrors(error) {
  const fieldErrors = {}
  for (const issue of error.issues) {
    const key = issue.path[0]
    if (key && !fieldErrors[key]) fieldErrors[key] = issue.message
  }
  return fieldErrors
}
