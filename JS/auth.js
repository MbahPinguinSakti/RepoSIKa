import { supabase, CONFIG } from './utils.js';

const PROFILE_TABLE = 'users';

export function normalizeEmail(email) {
  return String(email ?? '').trim().toLowerCase();
}

export function getEmailDomain(email) {
  const parts = normalizeEmail(email).split('@');
  return parts.length === 2 ? parts[1] : '';
}

export function isCampusEmail(email) {
  return CONFIG.ALLOWED_DOMAINS.includes(getEmailDomain(email));
}

export function isStudentEmail(email) {
  return getEmailDomain(email) === CONFIG.STUDENT_DOMAIN;
}

// Validasi Form Login
export function validateLogin({ email, password }) {
  if (!normalizeEmail(email)) return 'Email wajib diisi.';
  if (!password) return 'Kata sandi wajib diisi.';
  if (!isCampusEmail(email)) {
    return 'Gunakan email kampus (@unsika.ac.id atau @student.unsika.ac.id).';
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
    if (!cleanNpm) return 'NPM wajib diisi untuk akun mahasiswa.';
    if (!/^[0-9]{10,15}$/.test(cleanNpm)) {
      return 'NPM harus berupa 10-15 digit angka yang valid.';
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

// 1. Pendaftaran Akun (Sign Up) - Poin 1: Metadata profil lengkap (nama, full_name, npm)
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

// 2. Masuk Akun (Sign In) - Poin 2: Cek Email Confirmed & Poin 3: Cek is_active
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

  // Poin 3: Penanganan Akun Tidak Aktif (is_active === false)
  const profile = await getProfile(data.user.id);
  if (profile && profile.is_active === false) {
    await supabase.auth.signOut();
    return {
      ok: false,
      message: 'Akun Anda dinonaktifkan oleh pihak kampus. Silakan hubungi Administrator Perpustakaan.',
      data: null,
    };
  }

  return { ok: true, message: 'Login berhasil.', data: { ...data, profile } };
}

// 3. Login dengan Google OAuth (Poin 4: Mendukung Return URL)
export async function signInWithGoogle({ returnUrl = null } = {}) {
  const targetReturn = returnUrl || getReturnUrl() || CONFIG.PAGES.HOME;
  const cleanTarget = targetReturn.replace(/^\//, '');

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      queryParams: {
        hd: 'student.unsika.ac.id', // Hosted Domain restriction dari Google
      },
      redirectTo: `${window.location.origin}/${cleanTarget}`,
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

  const { error } = await supabase.auth.resetPasswordForEmail(cleanEmail, {
    redirectTo: `${window.location.origin}/${CONFIG.PAGES.FORGOT_PASSWORD}`,
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

// 6. Keluar Akun (Sign Out)
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: getReadableErrorMessage(error), data: null };
  return { ok: true, message: 'Berhasil keluar.', data: null };
}

// ==========================================
// SESI & PROFIL PENGGUNA
// ==========================================

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data?.session ?? null;
}

export async function getProfile(userId) {
  let id = userId;
  if (!id) {
    const session = await getSession();
    id = session?.user?.id;
  }
  if (!id) return null;

  const { data, error } = await supabase
    .from(PROFILE_TABLE)
    .select('*')
    .eq('id', id)
    .maybeSingle();

  if (error) {
    console.error('[getProfile]', error);
    return null;
  }
  return data;
}

export async function isAdmin() {
  const profile = await getProfile();
  return profile?.role === 'admin';
}

function redirect(page) {
  window.location.replace(page);
}

// ==========================================
// ROUTE GUARDS & POST-LOGIN NAVIGATION (Poin 3 & 4)
// ==========================================

// Poin 4: Membaca parameter returnUrl dari URL secara aman
export function getReturnUrl() {
  const params = new URLSearchParams(window.location.search);
  const returnUrl = params.get('returnUrl');
  if (!returnUrl) return null;
  try {
    const decoded = decodeURIComponent(returnUrl).trim();
    // Validasi keamanan: hanya izinkan path relatif agar tidak terjadi open redirect
    if (decoded.startsWith('/') && !decoded.startsWith('//') && !decoded.includes('://')) {
      return decoded;
    }
  } catch (_) {}
  return null;
}

// Poin 4: Menentukan tujuan redirect pasca-login (Admin vs Mahasiswa vs Return URL)
export function resolvePostLoginRedirect(profile) {
  if (profile?.role === 'admin') {
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

  // Poin 3: Jika akun dinonaktifkan saat sesi masih aktif
  if (profile && profile.is_active === false) {
    await signOut();
    redirect(`${redirectTo}?error=deactivated`);
    return null;
  }

  return { session, profile };
}

// Guard untuk halaman Admin
export async function requireAdmin({ redirectTo = CONFIG.PAGES.HOME } = {}) {
  const auth = await requireAuth();
  if (!auth) return null;
  if (auth.profile?.role !== 'admin') {
    redirect(redirectTo);
    return null;
  }
  return auth;
}

// Guard untuk halaman login/register: jika sudah login, lempar sesuai role atau returnUrl
export async function redirectIfLoggedIn({ redirectTo = null } = {}) {
  const session = await getSession();
  if (session) {
    const profile = await getProfile(session.user.id);
    const target = redirectTo || resolvePostLoginRedirect(profile);
    redirect(target);
  }
}
