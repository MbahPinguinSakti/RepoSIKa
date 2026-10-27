import { supabase, CONFIG } from './utils.js';

// Mendukung nama tabel 'users' (skema aktual tim) dengan fallback ke 'profiles' (PRD)
const PROFILE_TABLE = 'users';

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function getEmailDomain(email) {
  const parts = normalizeEmail(email).split('@');
  return parts.length === 2 ? parts[1] : '';
}

export function isCampusEmail(email) {
  const normalized = normalizeEmail(email);
  const parts = normalized.split('@');
  if (parts.length !== 2) return false;

  const [localPart, domain] = parts;

  // Validasi ketat format username (local-part) sebelum '@'
  // Wajib ada, alfanumerik diawal/akhir, tidak boleh karakter khusus liar
  if (!localPart || !/^[a-zA-Z0-9]+([._-][a-zA-Z0-9]+)*$/.test(localPart)) {
    return false;
  }

  return CONFIG.ALLOWED_DOMAINS.includes(domain);
}

export function isStudentEmail(email) {
  return isCampusEmail(email) && getEmailDomain(email) === CONFIG.STUDENT_DOMAIN;
}

// Helper universal status akun (mendukung kolom 'aktif' di database tim & 'is_active' di PRD)
export function isUserActive(profile) {
  if (!profile) return true;
  if (profile.aktif !== undefined) return profile.aktif !== false;
  if (profile.is_active !== undefined) return profile.is_active !== false;
  return true;
}

// Validasi Form Login
export function validateLogin({ email, password }) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return 'Email wajib diisi.';
  if (!password) return 'Kata sandi wajib diisi.';
  if (!isCampusEmail(cleanEmail)) {
    return 'Format email tidak valid. Gunakan email resmi civitas akademika (@unsika.ac.id atau @student.unsika.ac.id) dengan username yang benar.';
  }
  return null; // null = valid
}

// Validasi Form Registrasi (Poin 1: Validasi Regex NPM)
export function validateRegistration({ email, password, nama, npm }) {
  const loginError = validateLogin({ email, password });
  if (loginError) return loginError;

  const passwordValue = String(password ?? '');
  if (passwordValue.length < 8) return 'Kata sandi minimal 8 karakter.';

  const cleanNama = String(nama ?? '').trim();
  if (!cleanNama) return 'Nama lengkap wajib diisi.';

  if (isStudentEmail(email)) {
    const cleanNpm = String(npm ?? '').trim();
    if (!cleanNpm) {
      return 'NPM wajib diisi untuk akun mahasiswa.';
    }
    if (!/^\d+$/.test(cleanNpm)) {
      return 'NPM hanya boleh berisi angka.';
    }
  }

  return null;
}

// Validasi Reset Password Baru
export function validateResetPassword(password, confirmPassword) {
  if (!password) return 'Kata sandi baru wajib diisi.';
  if (password.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (password !== confirmPassword) return 'Konfirmasi kata sandi tidak cocok.';
  return null;
}

// Terjemahan Pesan Error Supabase agar Ramah Pengguna
export function getReadableErrorMessage(error) {
  const raw = String(error?.message ?? error ?? '').toLowerCase();

  if (!raw) return 'Terjadi kesalahan. Silakan coba lagi.';
  if (raw.includes('invalid login credentials')) return 'Email atau kata sandi salah.';
  if (raw.includes('email not confirmed')) return 'Email belum diverifikasi. Cek kotak masuk email kampus kamu.';
  if (raw.includes('already registered') || raw.includes('already been registered'))
    return 'Email ini sudah terdaftar. Silakan login.';
  if (raw.includes('hanya email kampus'))
    return 'Hanya email kampus (@unsika.ac.id / @student.unsika.ac.id) yang bisa mendaftar.';
  if (raw.includes('database error saving new user'))
    return 'Pendaftaran ditolak sistem. Pastikan kamu memakai email kampus yang valid.';
  if (raw.includes('password should be at least')) return 'Kata sandi terlalu pendek (minimal 8 karakter).';
  if (raw.includes('rate limit') || raw.includes('too many requests'))
    return 'Terlalu banyak percobaan. Tunggu beberapa menit lalu coba lagi.';
  if (raw.includes('failed to fetch') || raw.includes('network'))
    return 'Koneksi bermasalah. Periksa koneksi internet kamu.';
  if (raw.includes('invalid email')) return 'Format email tidak valid.';
  if (raw.includes('session') && raw.includes('expired'))
    return 'Tautan pemulihan sudah kedaluwarsa atau tidak valid.';
  if (raw.includes('provider is not enabled'))
    return 'Login Google saat ini belum diaktifkan di server. Silakan login dengan email & password.';

  return 'Terjadi kesalahan sistem: ' + (error?.message || 'Silakan coba lagi nanti.');
}

// ==========================================
// AKSI UTAMA AUTENTIKASI
// ==========================================

// 1. Pendaftaran Akun (Sign Up) - Mengirim 'nama' (skema tim) & 'full_name' (PRD)
export async function signUp({ email, password, nama, npm }) {
  const validationError = validateRegistration({ email, password, nama, npm });
  if (validationError) return { ok: false, message: validationError, data: null };

  const cleanNama = String(nama ?? '').trim();
  const cleanNpm = isStudentEmail(email) ? String(npm ?? '').trim() : null;

  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      data: {
        nama: cleanNama,
        full_name: cleanNama,
        npm: cleanNpm,
      },
    },
  });

  if (error) return { ok: false, message: getReadableErrorMessage(error), data: null };

  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, message: 'Email ini sudah terdaftar. Silakan login.', data: null };
  }

  const needsEmailConfirmation = !data.session;
  return {
    ok: true,
    message: needsEmailConfirmation
      ? 'Pendaftaran berhasil! Cek email kampus kamu untuk verifikasi akun sebelum login.'
      : 'Pendaftaran berhasil. Silakan login.',
    data: { ...data, needsEmailConfirmation },
  };
}

// 2. Masuk Akun (Sign In) - Poin 2: Cek Email Confirmed, Poin 3: Cek status aktif, & FR-08: Update timestamp login
export async function signIn({ email, password }) {
  const validationError = validateLogin({ email, password });
  if (validationError) return { ok: false, message: validationError, data: null };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error) return { ok: false, message: getReadableErrorMessage(error), data: null };

  // Poin 2: Verifikasi Email (wajibkan email_confirmed_at ada)
  if (data.user && !data.user.email_confirmed_at && !data.user.confirmed_at) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: 'Email kampus kamu belum diverifikasi. Cek inbox email kampus untuk klik tautan konfirmasi akun.',
      data: null,
    };
  }

  // Poin 3: Penanganan Akun Tidak Aktif (mendukung kolom 'aktif' & 'is_active')
  const profile = await getProfile(data.user.id);
  if (profile && !isUserActive(profile)) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: 'Akun Anda dinonaktifkan oleh pihak kampus. Silakan hubungi Administrator Perpustakaan.',
      data: null,
    };
  }

  // PRD FR-08: Pencatatan Timestamp login (mendukung 'terakhir_login' & 'last_login')
  const nowIso = new Date().toISOString();
  supabase
    .from(PROFILE_TABLE)
    .update({ terakhir_login: nowIso })
    .eq('id', data.user.id)
    .then(({ error: updateErr }) => {
      if (updateErr) {
        supabase.from('profiles').update({ last_login: nowIso }).eq('id', data.user.id);
      }
    })
    .catch(() => {});

  return { ok: true, message: 'Login berhasil.', data: { ...data, profile } };
}

// 3. Login dengan Google OAuth (PRD FR-01 & Item A: Jaga path subfolder/localhost)
export async function signInWithGoogle({ returnUrl = null } = {}) {
  // Selalu arahkan callback ke login.html terlebih dahulu agar redirectIfLoggedIn
  // dapat memeriksa role akun (Admin langsung ke admin-dashboard, Mahasiswa ke index/returnUrl)
  const returnParam = returnUrl || getReturnUrl();
  const loginUrl = new URL(CONFIG.PAGES.LOGIN, window.location.href);
  if (returnParam) {
    loginUrl.searchParams.set('returnUrl', returnParam);
  }
  const redirectUrl = loginUrl.href;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: {
        // Tampilkan pemilih akun Google agar dosen & mahasiswa bisa memilih akun kampus mereka
        prompt: 'select_account',
      },
      redirectTo: redirectUrl,
    },
  });

  if (error) return { ok: false, message: getReadableErrorMessage(error), data: null };
  return { ok: true, message: 'Mengarahkan ke Google...', data };
}

// 4. Minta Tautan Lupa Password
export async function resetPasswordForEmail(email) {
  const cleanEmail = normalizeEmail(email);
  if (!cleanEmail) return { ok: false, message: 'Email wajib diisi.' };
  if (!isCampusEmail(cleanEmail)) {
    return { ok: false, message: 'Gunakan email kampus yang terdaftar (@unsika.ac.id / @student.unsika.ac.id).' };
  }

  // Item A: Jaga path subfolder untuk link reset password
  const redirectUrl = new URL(CONFIG.PAGES.FORGOT_PASSWORD, window.location.href).href;

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: redirectUrl,
  });

  if (error) return { ok: false, message: getReadableErrorMessage(error) };
  return {
    ok: true,
    message: `Jika email ${cleanEmail} terdaftar, tautan pemulihan kata sandi telah dikirim. Periksa kotak masuk kamu.`,
  };
}

// 5. Perbarui Kata Sandi Baru
export async function updatePassword(newPassword, confirmPassword) {
  const validationError = validateResetPassword(newPassword, confirmPassword);
  if (validationError) return { ok: false, message: validationError };

  const { data, error } = await supabase.auth.updateUser({
    password: newPassword,
  });

  if (error) return { ok: false, message: getReadableErrorMessage(error), data: null };
  return { ok: true, message: 'Kata sandi berhasil diperbarui. Silakan login kembali.', data };
}

// 6. Keluar Akun (Sign Out) - Server Revocation & Pembersihan Menyeluruh (Anti-Looping)
export async function signOut() {
  // 1. Upayakan pencabutan (revoke) token sesi di server Supabase secara global
  try {
    const serverRevokePromise = supabase.auth.signOut({ scope: 'global' });
    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 2000));
    await Promise.race([serverRevokePromise, timeoutPromise]);
  } catch (err) {
    // Jika timeout jaringan atau offline, abaikan error revoke server dan lanjutkan pembersihan lokal
    console.warn('[SignOut] Server revoke token bypassed/fallback:', err.message || err);
  }

  // 2. Bersihkan seluruh cache aplikasi dan auth tokens di localStorage & sessionStorage
  try {
    sessionStorage.clear();
    for (let i = localStorage.length - 1; i >= 0; i--) {
      const key = localStorage.key(i);
      if (key && (key.startsWith('sb-') || key.includes('auth') || key.includes('token') || key.startsWith('reposika_'))) {
        localStorage.removeItem(key);
      }
    }
  } catch (_) {}

  // 3. Pastikan state lokal Supabase client ter-reset
  try {
    await supabase.auth.signOut({ scope: 'local' });
  } catch (e) {
    console.warn('[SignOut] Local cleanup notice:', e);
  }

  return { ok: true, message: 'Berhasil keluar.', data: null };
}

// ==========================================
// SESI & PROFIL PENGGUNA
// ==========================================

export async function getCurrentUser() {
  const session = await getSession();
  return session?.user ?? null;
}

export async function getCurrentUserProfile() {
  return await getProfile();
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

// Pengambilan Data Profil dengan Caching Cerdas (Mencegah N+1 Query & Menghemat Jaringan)
export async function getProfile(userId, { forceRefresh = false } = {}) {
  let id = userId;
  if (!id) {
    const session = await getSession();
    id = session?.user?.id;
  }
  if (!id) return null;

  // Periksa cache sesi lokal jika bukan forceRefresh
  const cacheKey = `reposika_profile_${id}`;
  if (!forceRefresh) {
    try {
      const cached = sessionStorage.getItem(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (Date.now() - (parsed._cachedAt || 0) < 180000) { // 3 menit
          return parsed.data;
        }
      }
    } catch (_) {}
  }

  // Prioritaskan query ke tabel 'users' (skema tim aktual di Supabase)
  let { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  // Fallback ke 'profiles' jika database dimigrasi ke nama PRD
  if (error && (error.code === 'PGRST205' || String(error.message).includes('users'))) {
    const fallbackRes = await supabase
      .from('profiles')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (!fallbackRes.error) {
      data = fallbackRes.data;
      error = null;
    }
  }

  if (error) {
    console.error('[getProfile]', error);
    return null;
  }
  if (data) {
    try {
      sessionStorage.setItem(cacheKey, JSON.stringify({ data, _cachedAt: Date.now() }));
    } catch (_) {}
  }
  return data;
}

export async function isAdmin() {
  const profile = await getProfile();
  return profile?.role === 'admin' || profile?.role === 'dosen';
}

function redirect(page) {
  window.location.replace(page);
}

// ==========================================
// ROUTE GUARDS & POST-LOGIN NAVIGATION (Poin 3 & 4)
// ==========================================

// Poin 4 & Item D: Membaca parameter returnUrl dari URL secara aman & fleksibel
export function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  const returnUrl = params.get('returnUrl');
  if (!returnUrl) return null;
  try {
    const decoded = decodeURIComponent(returnUrl).trim();
    // Validasi keamanan: tidak boleh ada protokol atau protocol-relative (mencegah open redirect)
    if (decoded.includes('://') || decoded.startsWith('//')) {
      return null;
    }
    // Izinkan format relatif /path atau path.html?param=...
    if (decoded.startsWith('/') || /^[a-zA-Z0-9_\-\.\/]+(\?.*)?$/.test(decoded)) {
      return decoded;
    }
  } catch (_) {}
  return null;
}

// Poin 4: Menentukan tujuan redirect pasca-login (Admin vs Mahasiswa vs Return URL)
export function resolvePostLoginRedirect(profile) {
  if (profile?.role === 'admin' || profile?.role === 'dosen') {
    return CONFIG.PAGES.ADMIN;
  }
  const returnUrl = getReturnUrl();
  if (returnUrl) return returnUrl;
  return CONFIG.PAGES.HOME;
}

// Guard untuk halaman member (Poin 3 & 4)
export async function requireAuth({ redirectTo = CONFIG.PAGES.LOGIN } = {}) {
  const session = await getSession();
  if (!session) {
    // Poin 4: Simpan URL saat ini ke returnUrl agar user tidak kehilangan halaman asalnya
    const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
    redirect(`${redirectTo}?returnUrl=${currentPath}`);
    return null;
  }

  const profile = await getProfile(session.user.id);

  // Poin 3: Jika akun dinonaktifkan saat sesi masih aktif (mendukung 'aktif' & 'is_active')
  if (profile && !isUserActive(profile)) {
    await signOut();
    redirect(`${redirectTo}?error=deactivated`);
    return null;
  }

  return { session, profile, user: session.user };
}

// Guard untuk halaman Admin
export async function requireAdmin({ redirectTo = CONFIG.PAGES.HOME } = {}) {
  const auth = await requireAuth();
  if (!auth) return null;
  if (auth.profile?.role !== 'admin' && auth.profile?.role !== 'dosen') {
    redirect(redirectTo);
    return null;
  }
  return auth;
}

// Guard untuk halaman login/register: jika sudah login, lempar sesuai role atau returnUrl (Item B: tangani akun non-aktif)
export async function redirectIfLoggedIn({ redirectTo = null } = {}) {
  const session = await getSession();
  if (session) {
    const profile = await getProfile(session.user.id);

    // Item B: Jika akun dinonaktifkan, jangan dilempar ke Home, tapi logout & redirect dengan status error
    if (profile && !isUserActive(profile)) {
      await signOut();
      window.location.replace(`${CONFIG.PAGES.LOGIN}?error=deactivated`);
      return;
    }

    const target = redirectTo || resolvePostLoginRedirect(profile);
    redirect(target);
  }
}
