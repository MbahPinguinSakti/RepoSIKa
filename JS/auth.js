
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

// Validasi form (sisi klien saja, validasi mutlak ada di trigger DB)
export function validateLogin({ email, password }) {
  if (!normalizeEmail(email)) return 'Email wajib diisi.';
  if (!password) return 'Kata sandi wajib diisi.';
  if (!isCampusEmail(email)) {
    return 'Gunakan email kampus (@unsika.ac.id atau @student.unsika.ac.id).';
  }
  return null; // null = valid
}

export function validateRegistration({ email, password, nama, npm }) {
  const loginError = validateLogin({ email, password });
  if (loginError) return loginError;

  if (password.length < 8) return 'Kata sandi minimal 8 karakter.';
  if (!String(nama ?? '').trim()) return 'Nama lengkap wajib diisi.';

  if (isStudentEmail(email)) {
    const cleanNpm = String(npm ?? '').trim();
    if (!cleanNpm) return 'NPM wajib diisi untuk akun mahasiswa.';
    if (!/^\d+$/.test(cleanNpm)) return 'NPM hanya boleh berisi angka.';
  }
  return null;
}

// Pesan error ramah pengguna (FR-01)
export function getReadableErrorMessage(error) {
  const raw = String(error?.message ?? error ?? '').toLowerCase();

  if (!raw) return 'Terjadi kesalahan. Silakan coba lagi.';
  if (raw.includes('invalid login credentials')) return 'Email atau kata sandi salah.';
  if (raw.includes('email not confirmed')) return 'Email belum diverifikasi. Cek kotak masuk kamu.';
  if (raw.includes('already registered') || raw.includes('already been registered'))
    return 'Email ini sudah terdaftar. Silakan login.';
  if (raw.includes('hanya email kampus')) // pesan dari trigger database
    return 'Hanya email kampus (@unsika.ac.id / @student.unsika.ac.id) yang bisa mendaftar.';
  if (raw.includes('database error saving new user'))
    return 'Pendaftaran ditolak. Pastikan kamu memakai email kampus yang valid.';
  if (raw.includes('password should be at least')) return 'Kata sandi terlalu pendek.';
  if (raw.includes('rate limit') || raw.includes('too many requests'))
    return 'Terlalu banyak percobaan. Tunggu beberapa saat lalu coba lagi.';
  if (raw.includes('failed to fetch') || raw.includes('network'))
    return 'Koneksi bermasalah. Periksa internet kamu.';
  if (raw.includes('invalid email')) return 'Format email tidak valid.';

  return 'Terjadi kesalahan. Silakan coba lagi.';
}


// Main ACTIONS
export async function signUp({ email, password, nama, npm }) {
  const validationError = validateRegistration({ email, password, nama, npm });
  if (validationError) return { ok: false, message: validationError, data: null };

  const { data, error } = await supabase.auth.signUp({
    email: normalizeEmail(email),
    password,
    options: {
      // Dibaca oleh trigger handle_new_campus_user di database.
      // Role TIDAK dikirim dari sini (di-hardcode di sisi database).
      data: { nama: nama.trim(), npm: String(npm ?? '').trim() || null },
    },
  });

  if (error) return { ok: false, message: getReadableErrorMessage(error), data: null };

  // Kalau email confirmation aktif, Supabase mengembalikan user palsu
  // dengan identities kosong untuk email yang sudah terdaftar.
  if (data.user && Array.isArray(data.user.identities) && data.user.identities.length === 0) {
    return { ok: false, message: 'Email ini sudah terdaftar. Silakan login.', data: null };
  }

  // session null = butuh verifikasi email dulu
  const needsEmailConfirmation = !data.session;
  return {
    ok: true,
    message: needsEmailConfirmation
      ? 'Pendaftaran berhasil. Cek email kampus kamu untuk verifikasi.'
      : 'Pendaftaran berhasil.',
    data: { ...data, needsEmailConfirmation },
  };
}

export async function signIn({ email, password }) {
  const validationError = validateLogin({ email, password });
  if (validationError) return { ok: false, message: validationError, data: null };

  const { data, error } = await supabase.auth.signInWithPassword({
    email: normalizeEmail(email),
    password,
  });

  if (error) return { ok: false, message: getReadableErrorMessage(error), data: null };
  return { ok: true, message: 'Login berhasil.', data };
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) return { ok: false, message: getReadableErrorMessage(error), data: null };
  return { ok: true, message: 'Berhasil keluar.', data: null };
}

// Session & profil
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

// Route guard for UX
function redirect(page) {
  window.location.replace(page);
}

/**
 * Panggil di awal halaman yang butuh login (reader, bookmark, dst).
 * Return { session, profile } kalau lolos, null kalau di-redirect.
 */
export async function requireAuth({ redirectTo = CONFIG.PAGES.LOGIN } = {}) {
  const session = await getSession();
  if (!session) {
    redirect(redirectTo);
    return null;
  }
  const profile = await getProfile(session.user.id);
  return { session, profile };
}

/**
 * Panggil di halaman admin. Bukan admin -> balik ke HOME.
 */
export async function requireAdmin({ redirectTo = CONFIG.PAGES.HOME } = {}) {
  const auth = await requireAuth();
  if (!auth) return null;
  if (auth.profile?.role !== 'admin') {
    redirect(redirectTo);
    return null;
  }
  return auth;
}

/**
 * Panggil di halaman login/register: kalau sudah login, lempar ke HOME.
 */
export async function redirectIfLoggedIn({ redirectTo = CONFIG.PAGES.HOME } = {}) {
  const session = await getSession();
  if (session) redirect(redirectTo);
}
