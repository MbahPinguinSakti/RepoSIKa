# 🎓 RepoSIKa — Repositori Akademik Kampus UNSIKA

> Platform arsip dan repositori materi perkuliahan terpusat berbasis web untuk civitas akademika Universitas Singaperbangsa Karawang (UNSIKA).

[![Status](https://img.shields.io/badge/PRD%20Compliance-100%25-brightgreen)](https://github.com/MbahPinguinSakti/RepoSIKa)
[![License](https://img.shields.io/badge/License-Academic%20Use-blue)](#)
[![Vercel Ready](https://img.shields.io/badge/Deploy-Vercel%20Ready-black?logo=vercel)](https://vercel.com)

---

## 🚀 Fitur Utama (Sesuai Spesifikasi PRD)

- **FR-01: Autentikasi Khusus Kampus (Domain Whitelist)**  
  Validasi email ganda (klien & database trigger PostgreSQL) khusus civitas akademika (`@unsika.ac.id` & `@student.unsika.ac.id`), terintegrasi dengan Google OAuth.
- **FR-02: Navigasi Bertingkat (Mother Button UI)**  
  Kartu mata kuliah bertindak sebagai Mother Button yang membuka modal pemilihan tahun ajaran (2024/2025, 2025/2026) dengan proteksi guest redirect.
- **FR-03: Pencarian & Kurasi Materi Dinamis**  
  Pencarian instan materi, filter cepat semester 1–8, format & status materi, radio pengurutan, tombol favorit/bookmark, dan sanitasi XSS universal (`escapeHtml()`).
- **FR-04: Pembaca Materi Terproteksi (Protected Online Reader)**  
  Pembaca daring PDF.js dengan temporary Signed URL (kedaluwarsa 60 menit), anti-print (`@media print` & pintasan `Ctrl+P`), watermark dinamis (`Nama • NPM • Waktu Akses`), serta izin seleksi/salin teks untuk belajar.
- **FR-05: Riwayat Akses & Activity Switcher**  
  Pencatatan riwayat baca otomatis, penambahan views atomik melalui Supabase RPC `increment_material_views()`, kartu *Continue Learning* dinamis, dan widget 3D flip switcher di navbar.
- **FR-06: Personalisasi Tema Global (Light/Dark Mode)**  
  Dukungan pergantian mode terang dan gelap yang tersinkronisasi di seluruh halaman melalui `localStorage` (`repo_theme`).
- **FR-07: Manajemen Materi Perkuliahan (CRUD Admin & Dosen)**  
  Unggah berkas materi, katalog manajemen materi per mata kuliah, dan penghapusan materi cascade (*storage file* + *database row*).
- **FR-08: Manajemen Pengguna & Multi-Tier Role Protection**  
  Tabel pengguna dinamis, modal Tambah Akun dengan validasi domain kampus, pengubahan role (Mahasiswa ⇄ Admin) via RPC `set_user_role`, penghapusan akun via `delete_user_by_admin`, serta proteksi anti-lockout (*self-demotion* / *self-deletion blocked*).
- **FR-09: Prioritas Monitoring Akun**  
  Pengurutan prioritas monitoring akun nonaktif (`ORDER BY aktif ASC / is_active ASC`) untuk audit cepat administrator.

---

## 🛠️ Tech Stack

- **Frontend:** Vanilla HTML5, CSS3 (Modular & Theme-aware), JavaScript Modern (ES6+ Modules)
- **Backend as a Service:** [Supabase](https://supabase.com/) (Auth, PostgreSQL Database, Row Level Security, Storage Bucket, RPC Functions, Database Triggers)
- **PDF Rendering:** [PDF.js](https://mozilla.github.io/pdf.js/) v3.11.174
- **Icons & Typography:** FontAwesome 6.5.2, Google Fonts (Poppins)
- **Deployment Platform:** Vercel / Netlify / Static Web Hosting

---

## 📦 Struktur Berkas

```
RepoSIKa/
├── index.html                  # Dashboard Utama Mahasiswa
├── dashboard.html              # Alias Dashboard
├── daftar-matkul.html          # Katalog Semua Mata Kuliah & Semester
├── detail-matkul.html          # Daftar Materi per Mata Kuliah
├── riwayat-favorit.html        # Tab Riwayat Baca & Materi Favorit
├── reader.html                 # Pembaca PDF Terproteksi (Watermark & Anti-Print)
├── login.html                  # Halaman Masuk Akun Kampus
├── signup.html                 # Pendaftaran Akun Civitas Baru
├── forgot-password.html        # Pemulihan Kata Sandi
│
├── admin-dashboard.html        # Panel Administrator Utama (Statistik & Manajemen User)
├── admin-semua-materi.html     # Katalog Manajemen Materi Admin
├── admin-detail-matkul.html    # Detail & Aksi Hapus Cascade Materi
├── admin-materi.html           # Form Unggah Materi Baru
│
├── JS-Login/                   # Modul Otentikasi & Utilitas Keamanan
│   ├── auth.js                 # Guard, Google OAuth, Sesi, & Role Resolver
│   └── utils.js                # Konfigurasi Supabase, XSS Sanitizer, Helper
├── JS-App/                     # Controller Aplikasi & Layanan Database
│   ├── app.js                  # Controller Dashboard Mahasiswa, Filter, & Modal
│   ├── admin.js                # Controller Panel Administrator & Modal Tambah Akun
│   ├── db-services.js          # Layanan Database Supabase (Users, Matkul, Materi, Favorit, Riwayat)
│   └── alur-project.js         # State Management Alur Proyek
│
├── database/supabase_rpc_and_triggers.sql # Skrip Backend PostgreSQL (Triggers, RPC Functions, Policies)
├── database/database_schema_sync_prd.sql  # Compatibility Views PRD & Row Level Security
├── vercel.json                 # Konfigurasi Deployment Vercel (Clean URLs)
└── .gitignore                  # Perlindungan Environment Variables & Rahasia
```

---

## 🚀 Panduan Deployment ke Vercel

1. Buka dashboard [Vercel](https://vercel.com/) dan login dengan akun GitHub Anda.
2. Klik tombol **"Add New Project"** > **"Project"**.
3. Pilih repositori **`MbahPinguinSakti/RepoSIKa`** lalu klik **"Import"**.
4. Di bagian *Framework Preset*, biarkan otomatis mendeteksi **"Other"**.
5. Klik **"Deploy"**. Dalam hitungan detik, aplikasi RepoSIKa akan aktif dan dapat diakses publik!

---

## 📄 Lisensi

Dikembangkan untuk keperluan akademik civitas akademika Universitas Singaperbangsa Karawang (UNSIKA).
