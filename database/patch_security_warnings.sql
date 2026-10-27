-- ==============================================================================
-- REPOSIKA: SUPABASE SECURITY ADVISOR WARNINGS & ADMIN RLS PERMISSION PATCH
-- Menyelesaikan:
-- 1. Linter 0011 (Search Path Mutable)
-- 2. Linter 0028 (Anon Function Executable)
-- 3. Linter 0029 (Authenticated Trigger Function Executable)
-- 4. Error PGRST116 saat Admin suspend/aktifkan akun (izin RLS Admin di tabel users)
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
    IF auth.uid() = OLD.id THEN
      RAISE EXCEPTION 'Akses ditolak: Anda tidak dapat mengubah role akun Anda sendiri demi integritas sistem!';
    END IF;

    IF NEW.role = 'dosen' OR OLD.role = 'dosen' THEN
      RAISE EXCEPTION 'Akses ditolak: Role dosen bersifat institusional permanen dan tidak dapat diubah!';
    END IF;

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
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.handle_new_campus_user() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.protect_user_roles() FROM PUBLIC, anon, authenticated;


-- ------------------------------------------------------------------------------
-- 5. RPC SUSPEND / AKTIFKAN AKUN PENGGUNA OLEH ADMIN (set_user_active)
-- Mengatasi error PGRST116 secara mutlak & aman
-- ------------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.set_user_active(p_user_id uuid, p_aktif boolean)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.is_admin() THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Administrator yang berhak mengubah status akun pengguna.';
  END IF;

  IF p_user_id = auth.uid() AND NOT p_aktif THEN
    RAISE EXCEPTION 'Tindakan dibatalkan: Anda tidak dapat menonaktifkan (suspend) akun Anda sendiri!';
  END IF;

  UPDATE public.users
  SET aktif = p_aktif
  WHERE id = p_user_id;

  RETURN true;
END;
$$;


-- ------------------------------------------------------------------------------
-- 6. CABUT IZIN ANON DARI SEMUA FUNGSI RPC SECURITY DEFINER (Linter 0028)
-- ------------------------------------------------------------------------------
REVOKE EXECUTE ON FUNCTION public.increment_material_views(int8) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.increment_material_views(int8) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_user_role(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_role(uuid, text) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.set_user_active(uuid, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_user_active(uuid, boolean) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated;

REVOKE EXECUTE ON FUNCTION public.is_admin() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.is_admin() TO authenticated;


-- ------------------------------------------------------------------------------
-- 7. KEBIJAKAN RLS ADMIN PADA TABEL USERS (Mengatasi PGRST116 saat UPDATE/DELETE)
-- ------------------------------------------------------------------------------
DROP POLICY IF EXISTS "Admin can update users" ON public.users;
CREATE POLICY "Admin can update users" ON public.users
  FOR UPDATE TO authenticated
  USING (public.is_admin())
  WITH CHECK (public.is_admin());

DROP POLICY IF EXISTS "Admin can delete users" ON public.users;
CREATE POLICY "Admin can delete users" ON public.users
  FOR DELETE TO authenticated
  USING (public.is_admin());


-- ------------------------------------------------------------------------------
-- 8. VERIFIKASI STATUS HAK AKSES
-- ------------------------------------------------------------------------------
SELECT 
  p.proname AS function_name,
  p.prosecdef AS is_security_definer,
  has_function_privilege('anon', p.oid, 'EXECUTE') AS anon_can_execute,
  has_function_privilege('authenticated', p.oid, 'EXECUTE') AS auth_can_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public'
  AND p.proname IN ('is_admin', 'increment_material_views', 'set_user_role', 'set_user_active', 'delete_user_by_admin', 'handle_new_campus_user', 'protect_user_roles');
