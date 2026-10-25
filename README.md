# 🎓 RepoSIKa — Repositori Akademik Kampus UNSIKA

> **Platform arsip dan repositori materi perkuliahan terpusat berbasis web untuk civitas akademika Universitas Singaperbangsa Karawang (UNSIKA).**

[![Live Demo](https://img.shields.io/badge/Demo-reposika.vercel.app-000000?style=for-the-badge&logo=vercel)](https://reposika.vercel.app)
[![PRD Compliance](https://img.shields.io/badge/PRD%20Compliance-100%25-brightgreen?style=for-the-badge)](https://github.com/MbahPinguinSakti/RepoSIKa)
[![Backend](https://img.shields.io/badge/Backend-Supabase-3ECF8E?style=for-the-badge&logo=supabase)](https://supabase.com)
[![Security Hardened](https://img.shields.io/badge/Security-Hardened%20RLS-blue?style=for-the-badge)](https://github.com/MbahPinguinSakti/RepoSIKa)

---

## 🌐 Live Deployment

Aplikasi **RepoSIKa** telah di-deploy dan dapat diakses secara publik di:
👉 **[https://reposika.vercel.app](https://reposika.vercel.app)**

---

## 🚀 Fitur Utama (Kepatuhan Penuh PRD)

### 1. Autentikasi Kampus & Domain Whitelist (FR-01)
- **Validasi Domain Ketat:** Pendaftaran dan login eksklusif untuk civitas akademika dengan domain `@unsika.ac.id` dan `@student.unsika.ac.id`.
- **Integrasi Google OAuth:** Login sekali klik dengan akun kampus tanpa perlu menghafal kata sandi terpisah.
- **Dual Layer Verification:** Validasi regex di sisi klien dan *database trigger* PostgreSQL di sisi Supabase.

### 2. Navigasi Bertingkat Mother Button (FR-02)
- Kartu mata kuliah berfungsi sebagai *Mother Button* interaktif yang memicu modal pemilihan Tahun Ajaran (contoh: 2024/2025, 2025/2026).
- Mencegah akses tamu (*guest protection*) dengan me-redirect ke login secara terarah dan aman.

### 3. Pencarian & Kurasi Materi Dinamis (FR-03)
- **Instant Search:** Pencarian judul materi dan deskripsi secara *real-time*.
- **Filter Multi-Kategori:** Filter cepat semester (1–8), format berkas (PDF, PPT, DOC), dan status materi.
- **Pengurutan Fleksibel:** Pengurutan materi berdasarkan nama, materi terbaru, dan jumlah tayangan terbanyak (*most viewed*).
- **Sanitasi XSS Universal:** Seluruh input dan render teks diamankan menggunakan `escapeHtml()`.

### 4. Pembaca Materi Terproteksi / Protected Online Reader (FR-04)
- **Canvas-based Rendering:** Menampilkan dokumen PDF langsung di canvas browser via PDF.js v3.11.174 tanpa mengekspos link unduhan langsung (*no direct download button*).
- **Dynamic Watermark:** Watermark visual semi-transparan yang mencantumkan identitas pengguna (`Nama • NPM • Timestamp Akses`) untuk mencegah pembajakan dan distribusi ilegal.
- **Anti-Print & Shortcut Safeguard:** Mencegah pencetakan dokumen melalui `@media print { display: none; }` dan memblokir shortcut `Ctrl+P` / `Cmd+P`.
- **Izin Seleksi Teks:** Teks tetap dapat disorot dan disalin (*text selection enabled*) untuk memudahkan pencatatan mahasiswa.
- **Tampilan Responsif:** Lebar kontainer adaptif di layar smartphone maupun desktop (menggantikan layout kaku 800px).

### 5. Riwayat Akses & Activity Switcher (FR-05)
- Pencatatan riwayat baca otomatis saat membuka materi.
- Penambahan jumlah tayangan (*views counter*) secara atomik via Supabase RPC `increment_material_views()`.
- Fitur favorit / bookmark materi perkuliahan untuk akses cepat.
- Widget navigasi 3D flip switcher di navbar untuk beralih antara riwayat dan daftar favorit.

### 6. Personalisasi Tema Global (FR-06)
- Dukungan mode Gelap (*Dark Mode*) dan Terang (*Light Mode*) yang konsisten di semua halaman.
- Preferensi tersimpan otomatis di `localStorage` (`repo_theme`).

### 7. Manajemen Materi Perkuliahan / CRUD Admin (FR-07)
- Formulir pengunggahan materi baru terhubung ke Supabase Storage Bucket.
- Manajemen materi per mata kuliah dengan aksi hapus *cascade* (menghapus berkas fisik di *storage* sekaligus baris di tabel database).

### 8. Manajemen Pengguna & Anti-Privilege Escalation (FR-08)
- Tabel manajemen pengguna interaktif untuk administrator.
- Pengubahan role pengguna (Mahasiswa ⇄ Admin) dilindungi oleh PostgreSQL RPC `set_user_role` dan database trigger `protect_user_roles()`.
- Proteksi anti-lockout (*self-demotion* dan *self-deletion blocked*) agar admin tidak terkunci secara tidak sengaja.

### 9. Prioritas Monitoring Akun (FR-09)
- Pengurutan akun nonaktif di baris teratas (`ORDER BY is_active ASC`) untuk mempermudah audit akun oleh administrator.

---

## 🛡️ Arsitektur Keamanan & Performa

| Fitur | Implementasi & Manfaat |
|---|---|
| **Anti-Looping Logout** | Mengeliminasi sisa token `sb-*` di `localStorage`, menghapus `sessionStorage`, dan menangani parameter `?logout=true` di `login.html` untuk memutus siklus refresh/bounce ke dashboard. |
| **Smart Profile Caching** | Cache profil pengguna in-memory dengan validitas TTL 5 menit untuk menghemat beban query database (N+1 query reduction). |
| **Cascade Integrity** | Menghubungkan relasi materi dan mata kuliah dengan constraint foreign key cascade untuk mencegah data yatim (*orphaned records*). |
| **Row Level Security (RLS)** | Kebijakan keamanan baris aktif di PostgreSQL untuk membatasi hak akses CRUD hanya untuk entitas yang berhak. |

---

## 🛠️ Tech Stack

- **Frontend:** HTML5 Semantik, CSS3 (Modular Stylesheet, CSS Custom Properties), Modern JavaScript (ES6+ Modules)
- **Backend as a Service (BaaS):** [Supabase](https://supabase.com/)
  - Supabase Auth (Email Password & Google OAuth)
  - PostgreSQL Database (Tables, Views, Triggers, RPC Stored Procedures)
  - Supabase Storage (Materi Perkuliahan Bucket)
  - Row Level Security (RLS)
- **PDF Engine:** [PDF.js](https://mozilla.github.io/pdf.js/) v3.11.174
- **Iconography & Typography:** FontAwesome 6.5.2, Google Fonts (Poppins)
- **Deployment & Hosting:** [Vercel](https://vercel.com/) (Clean URLs, Auto-Deploy via GitHub CI/CD)

---

## 📁 Struktur Direktori Proyek

```
RepoSIKa/
├── index.html                      # Landing & Dashboard Utama Mahasiswa
├── dashboard.html                  # Alias Dashboard Mahasiswa
├── daftar-matkul.html              # Katalog Semua Mata Kuliah & Semester
├── detail-matkul.html              # Katalog Materi per Mata Kuliah (Mother Button Target)
├── riwayat-favorit.html            # Tab Riwayat Baca & Materi Favorit
├── reader.html                     # Pembaca PDF Terproteksi (Watermark & Anti-Print)
├── login.html                      # Halaman Masuk Akun Civitas Kampus
├── signup.html                     # Pendaftaran Akun Mahasiswa/Dosen Baru
├── forgot-password.html            # Pemulihan Kata Sandi Akun
├── coming-soon.html                # Halaman Placeholder Fitur Lanjutan
│
├── admin-dashboard.html            # Panel Utama Administrator (Statistik & Manajemen User)
├── admin-semua-materi.html         # Katalog Manajemen Semua Materi Perkuliahan
├── admin-detail-matkul.html        # Manajemen & Aksi Hapus Cascade Materi per Matkul
├── admin-materi.html               # Formulir Pengunggahan Materi Baru
│
├── CSS-App/                        # Stylesheet Modular Aplikasi Mahasiswa
│   ├── base.css                    # Variabel Warna, Reset CSS, Font & Navbar/Sidebar
│   ├── dashboard.css               # Tampilan Grid Dashboard, Mother Button, & Hero
│   ├── daftar-matkul.css           # Tampilan Daftar Mata Kuliah
│   ├── detail-matkul.css           # Tampilan Detail Materi, Filter, & Search
│   ├── riwayat-favorit.css         # Tampilan Tab Riwayat & Favorit
│   └── coming-soon.css             # Desain Halaman Fitur Mendatang
│
├── CSS-Admin/                      # Stylesheet Khusus Panel Administrator
│   ├── admin-base.css              # Layout Dasar & Navigasi Admin
│   ├── admin-dashboard.css         # Statistik Grid & Tabel Pengguna
│   ├── admin-detail-matkul.html    # Tata Letak Detail Matkul Admin
│   ├── admin-materi.css            # Styling Form Unggah Materi
│   └── admin-semua-materi.css      # Tabel & Filter Materi Admin
│
├── CSS-login/                      # Stylesheet Khusus Otentikasi
│   ├── login.css                   # Desain Formulir Masuk & Efek Responsif
│   └── signup.css                  # Desain Formulir Pendaftaran Akun
│
├── JS-App/                         # Logika Aplikasi Mahasiswa & Admin
│   ├── app.js                      # Controller Dashboard, Filter, Mother Button, & Bookmark
│   ├── admin.js                    # Controller Panel Admin, Modal Tambah User, & CRUD
│   ├── db-services.js              # Layanan Database Supabase (CRUD, Profil, Riwayat, Favorit)
│   └── alur-project.js             # State Controller & Inisialisasi Alur Proyek
│
├── JS-Login/                       # Modul Otentikasi & Keamanan Sesi
│   ├── auth.js                     # Guard Autentikasi, Google OAuth, Sesi, & Anti-Loop Logout
│   ├── script.js                   # Event Handler Form Login, Peringatan, & Parameter Intercept
│   └── utils.js                    # Konfigurasi Supabase Client, XSS Sanitizer, & Helper
│
├── database/                       # Skrip SQL Backend PostgreSQL Supabase
│   ├── supabase_rpc_and_triggers.sql # Database Triggers, Stored Procedures (RPC), & Policies
│   └── database_schema_sync_prd.sql  # Compatibility Views PRD & Row Level Security (RLS)
│
├── assets/                         # Aset Gambar, Ikon, & Ilustrasi
├── vercel.json                     # Konfigurasi Routing & Clean URLs Vercel
└── .gitignore                      # Proteksi File Sensitif & Environment Variables
```

---

## 💻 Panduan Menjalankan Secara Lokal (Local Development)

### 1. Clone Repositori
```bash
git clone https://github.com/MbahPinguinSakti/RepoSIKa.git
cd RepoSIKa
```

### 2. Jalankan Local Web Server
Karena proyek ini menggunakan ES6 Modules (`import`/`export`), aplikasi harus dijalankan melalui web server lokal (bukan double-click `file://`):

**Menggunakan VS Code:**
- Pasang ekstensi **Live Server**.
- Klik kanan pada `index.html` > pilih **"Open with Live Server"**.

**Menggunakan Node.js:**
```bash
npx serve .
# atau
npx http-server .
```

**Menggunakan Python:**
```bash
python -m http.server 3000
```
Buka browser pada alamat `http://localhost:3000`.

---

## 🗄️ Konfigurasi Backend Supabase

Jika ingin menghubungkan ke instance Supabase baru:

1. Buat proyek baru di [Supabase Dashboard](https://supabase.com/).
2. Buka **SQL Editor** pada dashboard Supabase Anda.
3. Jalankan skrip [database/supabase_rpc_and_triggers.sql](database/supabase_rpc_and_triggers.sql) untuk mengaktifkan:
   - Trigger anti-eskalasi role (`protect_user_roles()`)
   - RPC function `set_user_role`
   - RPC function `increment_material_views`
   - RPC function `delete_user_by_admin`
4. Jalankan skrip [database/database_schema_sync_prd.sql](database/database_schema_sync_prd.sql) untuk sinkronisasi schema view dan Row Level Security (RLS).
5. Pada menu **Authentication > URL Configuration**:
   - Atur **Site URL** ke `https://reposika.vercel.app` (atau URL domain Anda).
   - Tambahkan `https://reposika.vercel.app/**` dan `http://localhost:*` pada **Redirect URLs**.

---

## 👥 Tim Pengembang & Kontributor

Aplikasi **RepoSIKa** berhasil diwujudkan berkat kolaborasi, kerja keras, dan dedikasi seluruh anggota tim:

- **Project Manager:** Zahran *(Koordinasi seluruh anggota & manajemen proyek)*
- **Mentor:** Edward *(Pembimbing & Technical Mentor)*
- **UI/UX Designer:** Azra *(Perancangan desain antarmuka web)*
- **Frontend (Slicing):** Kayna *(Slicing / konversi desain Figma ke kode antarmuka)*
- **Frontend (Implementasi Data):** Mukhlash *(Implementasi data dinamis & filtering)*
- **Backend (Logic Auth & Security):** Aji *(Logika autentikasi, security hardening, & cloud deployment)*
- **Backend (Logic Apps):** Ardhi *(Logika aplikasi & integrasi layanan)*
- **Database:** Aurelia Putri Herlina *(Perancangan skema database & relasi)*

---

### 📋 Tabel Pembagian Peran

| No | Nama | Peran (Role) | Tanggung Jawab Utama |
|:--:|---|---|---|
| 1 | **Zahran** | **Project Manager** | Koordinasi tim & pengawalan alur kerja |
| 2 | **Edward** | **Mentor** | Pembimbing teknis & repositori |
| 3 | **Azra** | **UI/UX Designer** | Desain antarmuka & pengalaman pengguna (UI/UX) |
| 4 | **Kayna** | **Frontend Developer** | Slicing / mengubah desain ke kode antarmuka |
| 5 | **Mukhlash** | **Frontend Developer** | Implementasi data dinamis ke komponen frontend |
| 6 | **Aji** | **Backend Developer** | Logika autentikasi, keamanan akses, & deployment |
| 7 | **Ardhi** | **Backend Developer** | Logika pemrosesan aplikasi & fungsionalitas sistem |
| 8 | **Aurelia Putri Herlina** | **Database Specialist** | Perancangan skema database & struktur tabel |

---

## 📄 Lisensi & Hak Cipta

Dikembangkan untuk keperluan akademik civitas akademika **Universitas Singaperbangsa Karawang (UNSIKA)**. Seluruh materi perkuliahan yang diunggah merupakan hak cipta masing-masing dosen pengampu mata kuliah.
