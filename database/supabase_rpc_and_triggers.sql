-- ==============================================================================
-- REPOSIKA: SUPABASE RPC FUNCTIONS, TRIGGERS, & SECURITY DEFINER POLICIES
-- Berkas ini dibuat untuk memenuhi seluruh kebutuhan PRD Modul FR-01, FR-05, FR-08, FR-09
-- Jalankan skrip ini langsung di Supabase SQL Editor (Dashboard > SQL Editor > New query > Run)
-- ==============================================================================

-- 1. HELPER KEAMANAN: Memeriksa apakah pemanggil adalah Admin
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND aktif = true
  );
$$;


-- ==============================================================================
-- 2. FR-05: ATOMIC INCREMENT VIEWS COUNTER (Mencegah Race Condition & Pelanggaran RLS)
-- Dipanggil oleh mahasiswa saat membuka materi: supabase.rpc('increment_material_views', { p_materi_id: ... })
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.increment_material_views(p_materi_id int8)
RETURNS int4
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_views int4;
BEGIN
  -- Naikkan jumlah dilihat secara atomic
  UPDATE public.materi
  SET jumlah_dilihat = COALESCE(jumlah_dilihat, 0) + 1
  WHERE id = p_materi_id
  RETURNING jumlah_dilihat INTO v_new_views;

  RETURN COALESCE(v_new_views, 0);
END;
$$;

-- Berikan izin eksekusi ke pengguna terautentikasi (mahasiswa & admin)
GRANT EXECUTE ON FUNCTION public.increment_material_views(int8) TO authenticated;


-- ==============================================================================
-- 3. FR-08: UBAH ROLE PENGGUNA OLEH ADMIN (set_user_role)
-- Dipanggil dari panel admin: supabase.rpc('set_user_role', { p_user_id: '...', p_new_role: 'admin' })
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.set_user_role(p_user_id uuid, p_new_role text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Pastikan hanya admin yang dapat menjalankan fungsi ini
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Administrator yang berhak mengubah role pengguna.';
  END IF;

  -- Cegah admin mengubah role dirinya sendiri secara tidak sengaja
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Tindakan dibatalkan: Anda tidak dapat mengubah role akun Anda sendiri!';
  END IF;

  -- Validasi role yang diperbolehkan (hanya mahasiswa dan admin yang dapat ditoggle)
  IF p_new_role NOT IN ('mahasiswa', 'admin') THEN
    RAISE EXCEPTION 'Role tidak valid. Role pengguna hanya dapat diubah menjadi mahasiswa atau admin.';
  END IF;

  -- Perbarui kolom role di tabel public.users
  UPDATE public.users
  SET role = p_new_role
  WHERE id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;


-- ==============================================================================
-- 4. FR-08: HAPUS AKUN SECARA MENYELURUH OLEH ADMIN (delete_user_by_admin)
-- Menghapus baris dari public.users DAN auth.users secara otomatis (Cascade)
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(p_user_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- Pastikan hanya admin yang dapat menghapus akun
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Administrator yang berhak menghapus akun pengguna.';
  END IF;

  -- Cegah admin menghapus dirinya sendiri secara tidak sengaja
  IF p_user_id = auth.uid() THEN
    RAISE EXCEPTION 'Tindakan dibatalkan: Anda tidak dapat menghapus akun Anda sendiri.';
  END IF;

  -- Hapus dari auth.users (akan otomatis cascade menghapus foreign key di public.users)
  DELETE FROM auth.users WHERE id = p_user_id;

  -- Jaga-jaga jika FK belum cascade
  DELETE FROM public.users WHERE id = p_user_id;

  RETURN true;
END;
$$;

GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated;


-- ==============================================================================
-- 5. FR-01: TRIGGER OTOMATIS VALIDASI EMAIL KAMPUS & SINKRONISASI USER BARU
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.handle_new_campus_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_email text;
  v_nama text;
  v_npm text;
  v_role text := 'mahasiswa';
  v_local_part text;
BEGIN
  v_email := LOWER(NEW.email);

  -- Validasi mutlak whitelist domain kampus @unsika.ac.id / @student.unsika.ac.id (FR-01)
  IF v_email NOT LIKE '%@unsika.ac.id' AND v_email NOT LIKE '%@student.unsika.ac.id' THEN
    RAISE EXCEPTION 'Pendaftaran ditolak: Sistem hanya menerima email resmi kampus UNSIKA (@unsika.ac.id / @student.unsika.ac.id).';
  END IF;

  -- Validasi format username sebelum '@' (mencegah email kosong / karakter liar)
  v_local_part := SPLIT_PART(v_email, '@', 1);
  IF LENGTH(v_local_part) < 2 OR v_local_part !~ '^[a-zA-Z0-9._-]+$' THEN
    RAISE EXCEPTION 'Pendaftaran ditolak: Format alamat email sebelum tanda @ tidak valid.';
  END IF;

  -- Ekstraksi nama dari user_metadata (auth signup / google oauth)
  v_nama := COALESCE(
    NEW.raw_user_meta_data->>'nama',
    NEW.raw_user_meta_data->>'full_name',
    NEW.raw_user_meta_data->>'name',
    SPLIT_PART(v_email, '@', 1)
  );

  -- Ekstraksi NPM (bila ada di metadata atau auto-ambil prefix email student)
  v_npm := NEW.raw_user_meta_data->>'npm';
  IF v_npm IS NULL AND v_email LIKE '%@student.unsika.ac.id' THEN
    v_npm := SPLIT_PART(v_email, '@', 1);
  END IF;

  -- Dosen otomatis role 'dosen' bila berdomain @unsika.ac.id tanpa prefix student
  IF v_email LIKE '%@unsika.ac.id' AND v_email NOT LIKE '%@student.unsika.ac.id' THEN
    v_role := 'dosen';
  END IF;

  -- Simpan ke tabel public.users
  INSERT INTO public.users (id, npm, nama, role, aktif, dibuat_pada, email)
  VALUES (
    NEW.id,
    v_npm,
    v_nama,
    v_role,
    true,
    NOW(),
    v_email
  )
  ON CONFLICT (id) DO UPDATE
  SET
    nama = EXCLUDED.nama,
    email = EXCLUDED.email,
    terakhir_login = NOW();

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_campus_user();


-- ==============================================================================
-- 6. NON-FUNCTIONAL: TRIGGER ANTI-ESCALATION ROLE
-- Mencegah pengguna biasa mengubah kolom 'role' akunnya sendiri lewat Console F12
-- ==============================================================================
CREATE OR REPLACE FUNCTION public.protect_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Jika kolom role mencoba diubah
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    -- Cegah siapapun mengubah role akun dirinya sendiri
    IF auth.uid() = OLD.id THEN
      RAISE EXCEPTION 'Akses ditolak: Anda tidak dapat mengubah role akun Anda sendiri demi integritas sistem!';
    END IF;

    -- Cegah pengubahan role ke atau dari dosen
    IF NEW.role = 'dosen' OR OLD.role = 'dosen' THEN
      RAISE EXCEPTION 'Akses ditolak: Role dosen bersifat institusional permanen dan tidak dapat diubah!';
    END IF;

    -- Jika yang menjalankan kueri adalah user biasa via client API
    IF auth.role() = 'authenticated' AND NOT public.is_admin() THEN
      RAISE EXCEPTION 'Akses ditolak: Anda tidak memiliki izin untuk mengubah role akun!';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_protect_user_roles ON public.users;

CREATE TRIGGER tr_protect_user_roles
BEFORE UPDATE ON public.users
FOR EACH ROW
EXECUTE FUNCTION public.protect_user_roles();


-- ==============================================================================
-- 7. DATABASE INTEGRITY: CASCADE CONSTRAINTS (Mencegah Orphaned Records)
-- ==============================================================================
ALTER TABLE public.materi
  DROP CONSTRAINT IF EXISTS fk_materi_matkul,
  ADD CONSTRAINT fk_materi_matkul FOREIGN KEY (matkul_id) REFERENCES public.matkul(id) ON DELETE CASCADE;

ALTER TABLE public.riwayat_baca
  DROP CONSTRAINT IF EXISTS fk_riwayat_materi,
  ADD CONSTRAINT fk_riwayat_materi FOREIGN KEY (materi_id) REFERENCES public.materi(id) ON DELETE CASCADE;

ALTER TABLE public.favorit
  DROP CONSTRAINT IF EXISTS fk_favorit_materi,
  ADD CONSTRAINT fk_favorit_materi FOREIGN KEY (materi_id) REFERENCES public.materi(id) ON DELETE CASCADE;
