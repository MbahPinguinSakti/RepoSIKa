-- ==============================================================================
-- REPOSIKA: SUPABASE SECURITY ADVISOR WARNINGS REMEDIATION PATCH
-- Menyelesaikan Linter 0011 (Search Path Mutable), 0028 (Anon Function Executable),
-- dan 0029 (Authenticated Trigger Function Executable).
--
-- Eksekusi: Supabase Dashboard -> SQL Editor -> New query -> Paste -> Run
-- ==============================================================================

-- ------------------------------------------------------------------------------
-- 1. BERSIHKAN FUNGSI LAWAS (handle_new_user)
-- ------------------------------------------------------------------------------
DROP FUNCTION IF EXISTS public.handle_new_user() CASCADE;


-- ------------------------------------------------------------------------------
-- 2. PERBAIKI LINT 0011: FUNCTION SEARCH PATH MUTABLE (Pin search_path = public)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.protect_user_roles()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
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


-- ------------------------------------------------------------------------------
-- 3. PERBAIKI is_admin(): GANTI MENJADI SECURITY INVOKER (Least Privilege)
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.users
    WHERE id = auth.uid() AND role = 'admin' AND aktif = true
  );
$$;


-- ------------------------------------------------------------------------------
-- 4. CABUT IZIN EKSEKUSI API DARI FUNGSI TRIGGER (Linter 0028 & 0029)
-- Fungsi trigger hanya dijalankan internal oleh Postgres engine, bukan via REST RPC
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_campus_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_user_roles() FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------------------------
-- 5. CABUT IZIN ANON DARI SEMUA FUNGSI RPC SECURITY DEFINER (Linter 0028)
-- ------------------------------------------------------------------------------
-- 5.1 increment_material_views
REVOKE EXECUTE ON FUNCTION public.increment_material_views(int8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_material_views(int8) TO authenticated;

-- 5.2 set_user_role
REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

-- 5.3 delete_user_by_admin
REVOKE EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated;

-- 5.4 is_admin
REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ------------------------------------------------------------------------------
-- 6. VERIFIKASI HASIL PENANGANAN WARNING
-- ------------------------------------------------------------------------------
SELECT 
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  p.proconfig AS search_path_setting,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_admin', 'increment_material_views', 'set_user_role', 'delete_user_by_admin', 'handle_new_campus_user', 'protect_user_roles');
