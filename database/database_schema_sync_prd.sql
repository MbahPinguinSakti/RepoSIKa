-- ==============================================================================
-- REPOSIKA: SUPABASE DATABASE SCHEMA SYNC & RLS STANDARDIZATION
-- Berkas ini dibuat untuk menyelaraskan skema Supabase dengan spesifikasi PRD Enterprise
-- Menghadirkan View Bahasa Inggris (PRD) yang dipetakan ke tabel Bahasa Indonesia (Live Tim)
-- Serta menetapkan aturan Row Level Security (RLS) lengkap
-- ==============================================================================

-- ==============================================================================
-- 1. PRD COMPATIBILITY VIEWS (NON-DESTRUCTIVE - DATA LIVE AMAN)
-- ==============================================================================

-- 1.1 PROFILES (PRD) <-> USERS (LIVE)
-- Proteksi Security Invoker: View menjalankan RLS dari pemanggil (bukan bypass)
CREATE OR REPLACE VIEW public.profiles 
WITH (security_invoker = on) AS
SELECT 
  id,
  npm,
  nama,
  role,
  aktif AS is_active,
  terakhir_login AS last_login,
  dibuat_pada AS created_at
FROM public.users;

-- 1.2 COURSES (PRD) <-> MATKUL (LIVE)
CREATE OR REPLACE VIEW public.courses 
WITH (security_invoker = on) AS
SELECT 
  id,
  kode AS code,
  nama AS title,
  semester,
  deskripsi AS description
FROM public.matkul;

-- 1.3 MATERIALS (PRD) <-> MATERI (LIVE)
CREATE OR REPLACE VIEW public.materials 
WITH (security_invoker = on) AS
SELECT 
  id,
  matkul_id AS course_id,
  user_id,
  judul AS title,
  deskripsi AS description,
  tahun_akademik AS academic_year,
  file_path,
  jumlah_dilihat AS views_count,
  dibuat_pada AS created_at
FROM public.materi;

-- 1.4 BOOKMARKS (PRD) <-> FAVORIT (LIVE)
CREATE OR REPLACE VIEW public.bookmarks 
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  materi_id AS material_id,
  dibuat_pada AS created_at
FROM public.favorit;

-- 1.5 READING_HISTORIES (PRD) <-> RIWAYAT_BACA (LIVE)
CREATE OR REPLACE VIEW public.reading_histories 
WITH (security_invoker = on) AS
SELECT 
  id,
  user_id,
  materi_id AS material_id,
  dibaca_pada AS read_at
FROM public.riwayat_baca;

-- Izin akses dibatasi: data privat (profiles, bookmarks, reading_histories) hanya untuk authenticated
GRANT SELECT ON public.courses TO authenticated, anon;
GRANT SELECT ON public.materials TO authenticated, anon;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.bookmarks TO authenticated;
GRANT SELECT ON public.reading_histories TO authenticated;


-- ==============================================================================
-- 2. KEBIJAKAN ROW LEVEL SECURITY (RLS) UNTUK SEMUA TABEL
-- ==============================================================================

-- Aktifkan RLS pada seluruh tabel inti
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matkul ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.materi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.favorit ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.riwayat_baca ENABLE ROW LEVEL SECURITY;

-- 2.1 Kebijakan RLS Tabel USERS
DROP POLICY IF EXISTS "Authenticated users can read users" ON public.users;
CREATE POLICY "Authenticated users can read users" ON public.users
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "Users can update own profile" ON public.users;
-- Defense-in-Depth: Cegah manipulasi kolom role langsung di RLS level
CREATE POLICY "Users can update own profile" ON public.users
  FOR UPDATE TO authenticated 
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id AND role = (SELECT u.role FROM public.users u WHERE u.id = auth.uid()));

-- 2.2 Kebijakan RLS Tabel MATKUL
DROP POLICY IF EXISTS "Anyone can view matkul" ON public.matkul;
CREATE POLICY "Anyone can view matkul" ON public.matkul
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Admin can manage matkul" ON public.matkul;
CREATE POLICY "Admin can manage matkul" ON public.matkul
  FOR ALL TO authenticated USING (public.is_admin());

-- 2.3 Kebijakan RLS Tabel MATERI
DROP POLICY IF EXISTS "Anyone can view materi" ON public.materi;
CREATE POLICY "Anyone can view materi" ON public.materi
  FOR SELECT TO authenticated, anon USING (true);

DROP POLICY IF EXISTS "Admin can manage materi" ON public.materi;
DROP POLICY IF EXISTS "Admin and Dosen can manage materi" ON public.materi;
CREATE POLICY "Admin and Dosen can manage materi" ON public.materi
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND (role = 'admin' OR role = 'dosen') AND aktif = true
    )
  );

-- 2.4 Kebijakan RLS Tabel FAVORIT (BOOKMARKS)
DROP POLICY IF EXISTS "Users manage own favorit" ON public.favorit;
CREATE POLICY "Users manage own favorit" ON public.favorit
  FOR ALL TO authenticated USING (auth.uid() = user_id);

-- 2.5 Kebijakan RLS Tabel RIWAYAT_BACA (READING_HISTORIES)
DROP POLICY IF EXISTS "Users manage own riwayat" ON public.riwayat_baca;
CREATE POLICY "Users manage own riwayat" ON public.riwayat_baca
  FOR ALL TO authenticated USING (auth.uid() = user_id);
