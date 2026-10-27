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

// Toast notification interaktif (menggantikan alert box statis)
let _toastTimeout = null;
export function showAlert(message, type, containerId) {
  if (!type) type = 'info';
  if (!containerId) containerId = 'alert-container';
  let toast = document.getElementById('rsk-toast-notification');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'rsk-toast-notification';
    toast.setAttribute('role', 'alert');
    toast.setAttribute('aria-live', 'polite');
    const s = toast.style;
    s.position = 'fixed';
    s.bottom = '28px';
    s.left = '50%';
    s.transform = 'translateX(-50%) translateY(28px)';
    s.zIndex = '99999';
    s.minWidth = '280px';
    s.maxWidth = '440px';
    s.width = '90vw';
    s.padding = '14px 18px';
    s.borderRadius = '14px';
    s.fontFamily = "Poppins,Arial,sans-serif";
    s.fontSize = '13.5px';
    s.fontWeight = '500';
    s.lineHeight = '1.45';
    s.display = 'flex';
    s.alignItems = 'center';
    s.gap = '12px';
    s.boxShadow = '0 12px 32px rgba(0,0,0,0.18)';
    s.opacity = '0';
    s.transition = 'opacity 0.3s ease,transform 0.35s ease';
    s.cursor = 'pointer';
    document.body.appendChild(toast);
  }
  const cfg = {
    error:   { icon: 'fa-circle-xmark',         bg: '#fee2e2', color: '#991b1b', border: '#f87171' },
    success: { icon: 'fa-circle-check',          bg: '#dcfce7', color: '#166534', border: '#86efac' },
    info:    { icon: 'fa-circle-info',           bg: '#e0f2fe', color: '#075985', border: '#7dd3fc' },
    warning: { icon: 'fa-triangle-exclamation', bg: '#fef9c3', color: '#854d0e', border: '#fde047' },
  };
  const cc = cfg[type] || cfg.info;
  toast.style.background = cc.bg;
  toast.style.color = cc.color;
  toast.style.border = '1px solid ' + cc.border;
  toast.innerHTML = [
    '<i class="fa-solid ' + cc.icon + '" style="font-size:18px;flex-shrink:0;"></i>',
    '<span style="flex:1;">' + message + '</span>',
    '<i class="fa-solid fa-xmark rsk-toast-close" style="font-size:14px;opacity:0.55;cursor:pointer;flex-shrink:0;"></i>',
  ].join('');
  const closeToast = function() {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(28px)';
  };
  toast.querySelector('.rsk-toast-close').addEventListener('click', function(e) { e.stopPropagation(); closeToast(); });
  toast.onclick = closeToast;
  requestAnimationFrame(function() {
    requestAnimationFrame(function() {
      toast.style.opacity = '1';
      toast.style.transform = 'translateX(-50%) translateY(0)';
    });
  });
  clearTimeout(_toastTimeout);
  var dur = type === 'error' ? 6500 : type === 'success' ? 4000 : 5000;
  _toastTimeout = setTimeout(closeToast, dur);
  var staticCont = document.getElementById(containerId);
  if (staticCont) staticCont.replaceChildren();
}

export function clearAlert(containerId) {
  if (!containerId) containerId = 'alert-container';
  var toast = document.getElementById('rsk-toast-notification');
  if (toast) {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(-50%) translateY(28px)';
  }
  var staticCont = document.getElementById(containerId);
  if (staticCont) staticCont.replaceChildren();
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

// Resolusi URL Foto Profil Dinamis (Google OAuth Avatar / Profile DB / UI-Avatars)
export function resolveAvatarUrl(user, profile) {
  // 1. Google OAuth avatar
  const googleAvatar = user?.user_metadata?.avatar_url || user?.user_metadata?.picture;
  if (googleAvatar) return googleAvatar;

  // 2. Profile / users table avatar jika ada
  if (profile?.avatar_url) return profile.avatar_url;
  if (profile?.foto_profil) return profile.foto_profil;

  // 3. Dynamic UI-Avatars berdasarkan nama / prefix email
  const name = profile?.nama || user?.user_metadata?.nama || user?.email?.split('@')[0] || 'Civitas';
  const bg = (profile?.role === 'admin' || profile?.role === 'dosen') ? '2563eb' : '788744';
  return `https://ui-avatars.com/api/?name=${encodeURIComponent(name)}&background=${bg}&color=fff&size=128&bold=true`;
}

// Pasang Avatar pada elemen DOM (.avatar)
export function applyAvatar(element, user, profile) {
  if (!element) return;
  const name = profile?.nama || user?.user_metadata?.nama || user?.email?.split('@')[0] || 'Civitas';
  const initial = name.trim().charAt(0).toUpperCase() || '🎓';
  const avatarUrl = resolveAvatarUrl(user, profile);

  element.style.overflow = 'hidden';
  element.style.display = 'inline-flex';
  element.style.alignItems = 'center';
  element.style.justifyContent = 'center';
  element.innerHTML = `<img src="${avatarUrl}" alt="${escapeHtml(name)}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;display:block;" onerror="this.onerror=null; this.parentElement.textContent='${initial}';">`;
}
