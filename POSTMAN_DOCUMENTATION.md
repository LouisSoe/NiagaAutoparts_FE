# Dokumen API & Postman Collection — NiagaGudang AutoParts

Dokumentasi ini berisi panduan penggunaan API untuk **Products**, **Categories**, **Users**, **Customers**, dan **Webhooks**.

File Postman Collection resmi yang dapat di-import langsung ke Postman berada di:
[postman_collection.json](file:///c:/Kuliah/smt4/NiagaGudang/postman_collection.json)

---

## 🚀 Cara Import ke Postman

1. Buka aplikasi **Postman**.
2. Klik tombol **Import** (di pojok kiri atas).
3. Pilih file [`postman_collection.json`](file:///c:/Kuliah/smt4/NiagaGudang/postman_collection.json).
4. Pastikan Environment Variable `base_url` diatur ke `http://localhost:8080`.

---

## 📦 Endpoint Reference

### 1. Products (`/api/v1/products`)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/products` | Ambil semua produk aktif |
| `GET` | `/api/v1/products?q=kampas` | Cari produk fuzzy search by name/sku/category |
| `GET` | `/api/v1/products/:id` | Ambil detail produk berdasarkan ID & referensi harga pasar |
| `POST` | `/api/v1/products` | Tambah produk baru |
| `PUT` | `/api/v1/products/:id` | Update data produk |
| `DELETE` | `/api/v1/products/:id` | Soft delete produk (`is_active = false`) |

#### Contoh Payload `POST /api/v1/products`:
```json
{
  "sku": "KR-HB-003",
  "name": "Kampas Rem Honda Vario Depan",
  "category_id": 1,
  "description": "Kampas rem ori AHM Vario",
  "stock": 25,
  "reserved": 0,
  "location": "Rak A1-B3",
  "price": 40000,
  "unit": "pcs",
  "is_active": true
}
```

---

### 2. Categories (`/api/v1/categories`)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/categories` | Ambil semua kategori |
| `GET` | `/api/v1/categories/:id` | Ambil detail kategori by ID |
| `POST` | `/api/v1/categories` | Tambah kategori baru |
| `PUT` | `/api/v1/categories/:id` | Update data kategori |
| `DELETE` | `/api/v1/categories/:id` | Hapus kategori |

#### Contoh Payload `POST /api/v1/categories`:
```json
{
  "name": "Aksesoris",
  "slug": "aksesoris",
  "description": "Kategori suku cadang dan aksesoris kendaraan"
}
```

---

### 3. Users (`/api/v1/users`)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/users` | Ambil semua pengguna |
| `GET` | `/api/v1/users/:id` | Ambil detail pengguna by ID |
| `POST` | `/api/v1/users` | Tambah pengguna baru (password otomatis di-hash `bcrypt`) |
| `PUT` | `/api/v1/users/:id` | Update data pengguna |
| `DELETE` | `/api/v1/users/:id` | Hapus pengguna |

#### Contoh Payload `POST /api/v1/users`:
```json
{
  "username": "budi_staff",
  "email": "budi@niagagudang.com",
  "password": "rahasia123",
  "name": "Budi Santoso",
  "role": "staff",
  "phone": "081234567890"
}
```

---

### 4. Customers (`/api/v1/customers`)

| Method | Endpoint | Deskripsi |
|---|---|---|
| `GET` | `/api/v1/customers` | Ambil semua pelanggan |
| `GET` | `/api/v1/customers/:id` | Ambil detail pelanggan by ID |
| `POST` | `/api/v1/customers` | Tambah pelanggan baru |
| `PUT` | `/api/v1/customers/:id` | Update data pelanggan |
| `DELETE` | `/api/v1/customers/:id` | Hapus pelanggan |

#### Contoh Payload `POST /api/v1/customers`:
```json
{
  "name": "Ahmad Yani",
  "phone_number": "6285712345678",
  "email": "ahmad@gmail.com",
  "address": "Jl. Merdeka No. 45 Jakarta",
  "notes": "Pelanggan langganan oli"
}
```

---

### 5. Webhooks

| Method | Endpoint | Deskripsi |
|---|---|---|
| `POST` | `/webhook` | Simulasi webhook masuk dari Fonnte (WhatsApp) |
| `POST` | `/telegram/webhook` | Simulasi webhook masuk dari Telegram Bot |

#### Contoh Payload `POST /webhook` (WhatsApp Fonnte):
```json
{
  "sender": "628123456789",
  "message": "stok kampas rem beat"
}
```
