import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.45.4/+esm';

export const CONFIG = {
  SUPABASE_URL: 'GANTI_DENGAN_PROJECT_URL',
  SUPABASE_ANON_KEY: 'GANTI_DENGAN_ANON_KEY',

  // Whitelist domain kampus (FR-01)
  ALLOWED_DOMAINS: ['unsika.ac.id', 'student.unsika.ac.id'],
  STUDENT_DOMAIN: 'student.unsika.ac.id',

  // Nama file halaman. Sesuaikan dengan struktur repo.
  PAGES: {
    LOGIN: 'login.html',
    HOME: 'index.html',
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

// alerting for user 
export function showAlert(message, type = 'info', containerId = 'alert-container') {
  const container = document.getElementById(containerId);
  if (!container) {
    console.warn(`[showAlert] #${containerId} tidak ditemukan. Pesan:`, message);
    return;
  }
  const el = document.createElement('div');
  el.className = `alert alert-${type}`;
  el.setAttribute('role', 'alert');
  el.textContent = message;

  container.replaceChildren(el); // satu alert pada satu waktu
  if (type !== 'error') {
    setTimeout(() => el.remove(), 5000);
  }
}

export function clearAlert(containerId = 'alert-container') {
  document.getElementById(containerId)?.replaceChildren();
}

// Tema gelap/terang (FR-06). Pakai atribut data-theme di <html>.
// Frontend tinggal bikin CSS: [data-theme="dark"] { ... }
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
