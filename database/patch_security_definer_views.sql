-- ==============================================================================
-- REPOSIKA: SUPABASE SECURITY ADVISOR REMEDIATION PATCH
-- Linter Rule: 0010_security_definer_view
-- Deskripsi: Mengubah 5 View Compatibility dari SECURITY DEFINER menjadi SECURITY INVOKER
-- sehingga view menjalankan Row Level Security (RLS) pengguna yang melakukan kueri.
-- Eksekusi: Supabase Dashboard -> SQL Editor -> New query -> Run
-- ==============================================================================

-- 1. courses view (PRD -> matkul)
ALTER VIEW IF EXISTS public.courses SET (security_invoker = true);

-- 2. materials view (PRD -> materi)
ALTER VIEW IF EXISTS public.materials SET (security_invoker = true);

-- 3. bookmarks view (PRD -> favorit)
ALTER VIEW IF EXISTS public.bookmarks SET (security_invoker = true);

-- 4. reading_histories view (PRD -> riwayat_baca)
ALTER VIEW IF EXISTS public.reading_histories SET (security_invoker = true);

-- 5. profiles view (PRD -> users)
ALTER VIEW IF EXISTS public.profiles SET (security_invoker = true);

-- Konfirmasi izin akses sesuai prinsip Least Privilege
GRANT SELECT ON public.courses TO authenticated, anon;
GRANT SELECT ON public.materials TO authenticated, anon;
GRANT SELECT ON public.profiles TO authenticated;
GRANT SELECT ON public.bookmarks TO authenticated;
GRANT SELECT ON public.reading_histories TO authenticated;

-- Verifikasi status security_invoker pada PostgreSQL pg_views & pg_class
SELECT 
  c.relname AS view_name,
  c.relrowsecurity AS has_rls,
  CASE 
    WHEN 'security_invoker=true' = ANY(c.reloptions) OR 'security_invoker=on' = ANY(c.reloptions) THEN 'SECURITY INVOKER (SAFE)'
    ELSE 'SECURITY DEFINER (VULNERABLE)'
  END AS security_status
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' 
  AND c.relkind = 'v'
  AND c.relname IN ('courses', 'materials', 'bookmarks', 'reading_histories', 'profiles');

