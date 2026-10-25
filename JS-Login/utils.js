import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const CONFIG = {
  // Kredensial Supabase Project RepoSIKa
  SUPABASE_URL: 'https://gnolcaozgtfbswusdfey.supabase.co',
  SUPABASE_ANON_KEY: 'sb_publishable_yz2s8eb99UnlrNibA8kFWw_nocOfML2',

  // Whitelist domain kampus (FR-01)
  ALLOWED_DOMAINS: ['unsika.ac.id', 'student.unsika.ac.id'],
  STUDENT_DOMAIN: 'student.unsika.ac.id',

  // Mapping nama file halaman
  PAGES: {
    LOGIN: 'login.html',
    SIGNUP: 'signup.html',
    FORGOT_PASSWORD: 'forgot-password.html',
    HOME: 'dashboard.html',
    ADMIN: 'admin.html',
  },

  THEME_KEY: 'repo_theme',
};

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Sanitasi XSS (FR-03): pakai ini sebelum inject teks dinamis ke innerHTML
export function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

// Menampilkan pesan notifikasi ke pengguna
export function showAlert(message, type = 'info', containerId = 'alert-container') {
  const container = document.getElementById(containerId);
  if (!container) {
    // Fallback jika halaman belum memiliki container alert
    alert(message);
    return;
  }
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.setAttribute('role', 'alert');
  el.textContent = message;

  container.replaceChildren(el); // satu alert pada satu waktu
  el.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  if (type === 'success') {
    setTimeout(() => {
      if (el.parentNode === container) {
        el.remove();
      }
    }, 6000);
  }
}

export function clearAlert(containerId = 'alert-container') {
  document.getElementById(containerId)?.replaceChildren();
}

// Tema gelap/terang (FR-06). Pakai atribut data-theme di <html>.
export function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem(CONFIG.THEME_KEY); } catch (_) { /* abaikan */ }
  const theme = saved || (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', theme);
}

export function setupThemeToggle(buttonId = 'themeToggle') {
  const btn = document.getElementById(buttonId);
  if (!btn) return;
  btn.addEventListener('click', () => {
    const next = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', next);
    try { localStorage.setItem(CONFIG.THEME_KEY, next); } catch (_) { /* abaikan */ }
  });
}
