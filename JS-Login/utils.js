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
    HOME: 'index.html',
    ADMIN: 'admin-dashboard.html',
  },

  THEME_KEY: 'repo_theme',
};

export const supabase = createClient(CONFIG.SUPABASE_URL, CONFIG.SUPABASE_ANON_KEY);

// Sanitasi XSS Berlapis (FR-03 & Standar OWASP Encoding)
export function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  let str = String(value);

  // 1. Netralkan tag script dan protokol payload berbahaya
  str = str.replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
           .replace(/<\s*script[^>]*>/gi, '')
           .replace(/javascript\s*:/gi, 'blocked:')
           .replace(/data\s*:/gi, 'blocked:');

  // 2. Encoding karakter khusus OWASP
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
    .replace(/`/g, '&#96;')
    .replace(/\//g, '&#x2F;');
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
