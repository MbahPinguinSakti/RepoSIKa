// JS-App/app.js
// Controller Aplikasi Utama RepoSIKa (Dashboard, Katalog, Detail Materi, Riwayat & Favorit)
// Sesuai Spesifikasi PRD (FR-02, FR-03, FR-04, FR-05, FR-06)

import { supabase, escapeHtml, CONFIG } from '../JS-Login/utils.js';
import {
  getCurrentUser,
  getCurrentUserProfile,
  signOut,
} from '../JS-Login/auth.js';
import {
  matkulService,
  materiService,
  riwayatBacaService,
  favoritService,
} from './db-services.js';
import {
  alurJelajah,
  alurBaca,
  alurFavorit,
  alurRiwayat,
} from './alur-project.js';

// State aplikasi
const state = {
  user: null,
  profile: null,
  selectedMatkulId: null,
  allMatkul: [],
  allMateri: [],
  activityInterval: null,
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inisialisasi Tema Gelap / Terang (FR-06)
  initThemeManager();

  // 2. Cek Sesi Pengguna & Setup Navigasi / Header
  await initUserSession();

  // 3. Inisialisasi Fitur Sesuai Halaman yang Aktif
  const pathname = window.location.pathname.toLowerCase();

  if (pathname.includes('dashboard') || pathname.endsWith('/') || pathname.endsWith('index.html')) {
    initDashboardPage();
  }

  if (pathname.includes('daftar-matkul')) {
    initDaftarMatkulPage();
  }

  if (pathname.includes('detail-matkul')) {
    initDetailMatkulPage();
  }

  if (pathname.includes('riwayat-favorit')) {
    initRiwayatFavoritPage();
  }

  // 4. Inisialisasi Activity Switcher (FR-05)
  initActivitySwitcher();
});

// =========================================================================
// 1. MANAJEMEN TEMA (FR-06: Global Light / Dark Mode via localStorage)
// =========================================================================
function initThemeManager() {
  const themeDarkCheckbox = document.getElementById('theme-dark');
  const savedTheme = localStorage.getItem(CONFIG.THEME_KEY) || 'light';

  const applyTheme = (isDark) => {
    if (themeDarkCheckbox) themeDarkCheckbox.checked = isDark;
    if (isDark) {
      document.body.classList.add('dark-theme');
    } else {
      document.body.classList.remove('dark-theme');
    }
  };

  applyTheme(savedTheme === 'dark');

  if (themeDarkCheckbox) {
    themeDarkCheckbox.addEventListener('change', () => {
      const isDark = themeDarkCheckbox.checked;
      localStorage.setItem(CONFIG.THEME_KEY, isDark ? 'dark' : 'light');
      applyTheme(isDark);
    });
  }

  // Tombol icon tema di header
  const themeIcons = document.querySelectorAll('.theme-icon, .theme-label');
  themeIcons.forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!themeDarkCheckbox) {
        const currentIsDark = document.body.classList.contains('dark-theme');
        const nextIsDark = !currentIsDark;
        localStorage.setItem(CONFIG.THEME_KEY, nextIsDark ? 'dark' : 'light');
        applyTheme(nextIsDark);
      }
    });
  });
}

// =========================================================================
// 2. SESI PENGGUNA & SIDEBAR
// =========================================================================
async function initUserSession() {
  state.user = await getCurrentUser();

  if (state.user) {
    state.profile = await getCurrentUserProfile();
  }

  // Update Nama Pengguna di Header
  const userNameEl = document.querySelector('.page-heading h1');
  if (userNameEl) {
    const rawName = state.profile?.nama || state.user?.user_metadata?.nama || state.user?.email?.split('@')[0] || 'Mahasiswa';
    userNameEl.textContent = `Welcome Back, ${rawName.split(' ')[0]}!`;
  }

  // Update Avatar Pengguna
  const avatarEl = document.querySelector('.avatar');
  if (avatarEl && state.profile?.nama) {
    const initial = state.profile.nama.trim().charAt(0).toUpperCase();
    avatarEl.textContent = initial || '🎓';
  }

  // Handler Tombol Logout
  const logoutLinks = document.querySelectorAll('a[href="login.html"], .sidebar-options span:has(.fa-right-from-bracket)');
  logoutLinks.forEach((link) => {
    link.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
        await signOut();
        window.location.href = 'login.html';
      }
    });
  });
}

// =========================================================================
// 3. DASHBOARD & MOTHER BUTTON (FR-02, FR-03)
// =========================================================================
async function initDashboardPage() {
  initMotherButtonModal();
  initDashboardSearchAndFilter();
  await loadDashboardData();
}

// Modal Tahun Ajaran (Mother Button UI)
function initMotherButtonModal() {
  const modalOverlay = document.getElementById('tahun-ajaran');
  if (!modalOverlay) return;

  // Tombol tutup modal (&times;)
  const closeBtn = modalOverlay.querySelector('.close-dialog');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      closeModal();
    });
  }

  // Tutup dengan klik di luar area modal (backdrop)
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      closeModal();
    }
  });

  // Tutup dengan menekan tombol keyboard Escape (FR-02 & Non-Functional A11y)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && window.location.hash === '#tahun-ajaran') {
      closeModal();
    }
  });

  // Pilihan Tahun Ajaran (Redirect Guest vs Logged-In)
  const yearChoices = modalOverlay.querySelectorAll('.year-choices a');
  yearChoices.forEach((choice) => {
    choice.addEventListener('click', (e) => {
      e.preventDefault();
      const tahunText = choice.textContent.trim();
      const matkulId = state.selectedMatkulId || '';

      const targetUrl = `detail-matkul.html?matkul_id=${encodeURIComponent(matkulId)}&tahun=${encodeURIComponent(tahunText)}`;

      // FR-02: Jika Pengunjung (Guest), tahan akses dan arahkan ke login.html
      if (!state.user) {
        window.location.href = `login.html?returnUrl=${encodeURIComponent(targetUrl)}`;
      } else {
        window.location.href = targetUrl;
      }
    });
  });

  function closeModal() {
    window.history.pushState('', document.title, window.location.pathname + window.location.search);
    modalOverlay.style.display = 'none';
    setTimeout(() => {
      modalOverlay.style.display = '';
    }, 100);
  }
}

// Handler Search & Filter Semester
function initDashboardSearchAndFilter() {
  const searchInput = document.getElementById('dashboard-material-search') || document.querySelector('input[type="search"]');
  const filterForm = document.getElementById('dashboard-filter-form');
  const sortSelect = document.querySelector('.rf-sort-menu, select');

  const filterCards = () => {
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const checkedSemesters = filterForm
      ? Array.from(filterForm.querySelectorAll('input[name="semester[]"]:checked')).map((cb) => cb.value)
      : [];

    const cards = document.querySelectorAll('.overview-card, .course-card, .learning-card');
    cards.forEach((card) => {
      const title = card.querySelector('h3, p, strong')?.textContent?.toLowerCase() || '';
      const text = card.textContent?.toLowerCase() || '';

      const matchesSearch = !keyword || title.includes(keyword) || text.includes(keyword);
      let matchesSemester = true;

      if (checkedSemesters.length > 0) {
        matchesSemester = checkedSemesters.some((sem) => text.includes(`semester ${sem}`));
      }

      if (matchesSearch && matchesSemester) {
        card.style.display = '';
      } else {
        card.style.display = 'none';
      }
    });
  };

  if (searchInput) {
    searchInput.addEventListener('input', filterCards);
  }

  if (filterForm) {
    filterForm.addEventListener('change', filterCards);
    filterForm.addEventListener('reset', () => setTimeout(filterCards, 50));
  }
}

// Mengambil Data Mata Kuliah dari Supabase (Aurelia: 'matkul')
async function loadDashboardData() {
  try {
    const matkulList = await matkulService.getAll();
    state.allMatkul = matkulList || [];

    // Jika database punya mata kuliah, pasang event klik kartu matkul -> buka modal
    const cards = document.querySelectorAll('.overview-card, .learning-card');
    cards.forEach((card, index) => {
      const openBtn = card.querySelector('a[href="#tahun-ajaran"], .btn');
      if (openBtn) {
        openBtn.addEventListener('click', (e) => {
          // Set ID matkul terkait
          if (state.allMatkul[index]) {
            state.selectedMatkulId = state.allMatkul[index].id;
          }
        });
      }
    });

    // Update jumlah materi total
    const countPill = document.querySelector('.count-pill');
    if (countPill && state.allMatkul.length > 0) {
      countPill.textContent = state.allMatkul.length;
    }
  } catch (err) {
    console.warn('[Dashboard Data] Tabel matkul kosong atau belum terisi:', err.message);
  }
}

// =========================================================================
// 4. DAFTAR MATA KULIAH (daftar-matkul.html)
// =========================================================================
async function initDaftarMatkulPage() {
  initMotherButtonModal();
  initDashboardSearchAndFilter();
  await loadDashboardData();
}

// =========================================================================
// 5. DETAIL MATKUL & PREVIEW MATERI (detail-matkul.html)
// =========================================================================
async function initDetailMatkulPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const matkulId = urlParams.get('matkul_id');
  const tahunAjaran = urlParams.get('tahun') || '2024/2025';

  // 1. Ambil info matkul dari DB jika ID tersedia
  if (matkulId) {
    try {
      const matkul = await matkulService.getById(matkulId);
      if (matkul) {
        const heading = document.querySelector('.course-info h1');
        if (heading) heading.textContent = escapeHtml(matkul.nama);

        const coverTitle = document.querySelector('.cover-title');
        if (coverTitle) coverTitle.textContent = escapeHtml(matkul.nama.toUpperCase());

        const tags = document.querySelectorAll('.course-tags span');
        if (tags[0] && matkul.semester) tags[0].innerHTML = `<i class="fa-solid fa-graduation-cap"></i> Semester ${matkul.semester}`;
        if (tags[1] && tahunAjaran) tags[1].innerHTML = `<i class="fa-regular fa-calendar-days"></i> Tahun ${escapeHtml(tahunAjaran)}`;
      }
    } catch (e) {
      console.warn('Gagal memuat detail matkul:', e.message);
    }
  }

  // 2. Setup Tombol Bookmark (★/☆)
  initBookmarkButtons();

  // 3. Setup Tombol "Baca Materi" & Proteksi Reader (FR-04)
  initReadButtons();
}

function initBookmarkButtons() {
  const bookmarkIcons = document.querySelectorAll('.bookmark-icon, .preview-actions i.fa-bookmark');
  bookmarkIcons.forEach((btn, index) => {
    btn.style.cursor = 'pointer';
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();

      if (!state.user) {
        alert('Silakan login terlebih dahulu untuk menyimpan materi favorit.');
        window.location.href = `login.html?returnUrl=${encodeURIComponent(window.location.href)}`;
        return;
      }

      const icon = btn.querySelector('i') || btn;
      const isBookmarked = icon.classList.contains('fa-solid');

      // Animasi visual seketika
      if (isBookmarked) {
        icon.classList.remove('fa-solid');
        icon.classList.add('fa-regular');
      } else {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        icon.style.color = '#eab308'; // Kuning emas
      }

      try {
        // Sinkronisasi ke tabel favorit di Supabase
        const materiId = index + 1; // ID materi referensi
        await favoritService.toggle(state.user.id, materiId);
      } catch (err) {
        console.warn('Sinkronisasi favorit:', err.message);
      }
    });
  });
}

function initReadButtons() {
  const readButtons = document.querySelectorAll('.read-button');
  readButtons.forEach((btn, idx) => {
    btn.addEventListener('click', async (e) => {
      e.preventDefault();

      if (!state.user) {
        alert('Akses materi dibatasi khusus civitas akademika. Silakan login terlebih dahulu.');
        window.location.href = `login.html?returnUrl=${encodeURIComponent(window.location.href)}`;
        return;
      }

      const row = btn.closest('.material-row');
      const title = row?.querySelector('h3')?.textContent || 'Materi Perkuliahan';

      // Update Panel Preview di Kanan
      const previewTitle = document.querySelector('.preview-header h2');
      if (previewTitle) previewTitle.textContent = title;

      // Catat Riwayat Akses ke Supabase (FR-05)
      try {
        const materiId = idx + 1;
        await riwayatBacaService.catat(state.user.id, materiId);
      } catch (err) {
        console.warn('Pencatatan riwayat:', err.message);
      }

      // Watermark Dinamis Mahasiswa (FR-04: Nama - NPM - Timestamp)
      applyDynamicWatermark();

      // Buka Halaman Reader Terproteksi Penuh jika tombol diklik
      if (confirm(`Buka pembaca daring terproteksi untuk "${title}"?`)) {
        window.location.href = `reader.html?title=${encodeURIComponent(title)}&materi_id=${idx + 1}`;
      }
    });
  });

  // Pasang watermark dinamis pada preview saat halaman dimuat
  applyDynamicWatermark();
  applyContentProtection();
}

function applyDynamicWatermark() {
  const watermarks = document.querySelectorAll('.watermark');
  if (watermarks.length === 0) return;

  const nama = state.profile?.nama || state.user?.user_metadata?.nama || 'Civitas Akademika';
  const npm = state.profile?.npm || state.user?.user_metadata?.npm || 'UNSIKA';
  const dateStr = new Date().toLocaleDateString('id-ID', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });

  const watermarkText = `${escapeHtml(nama)} • ${escapeHtml(npm)} • ${dateStr}`;

  watermarks.forEach((wm) => {
    wm.textContent = watermarkText;
    wm.style.opacity = '0.35';
    wm.style.pointerEvents = 'none';
    wm.style.userSelect = 'none';
  });
}

// FR-04 & Fase 2: Proteksi Konten Pembaca PDF (Anti-Download & Anti-Print)
function applyContentProtection() {
  // 1. Matikan klik kanan (Context Menu)
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.pdf-viewer, .preview-panel, .pdf-paper')) {
      e.preventDefault();
      alert('Tindakan dilarang: Hak cipta materi perkuliahan terproteksi.');
    }
  });

  // 2. Blokir pintasan tombol cetak (Ctrl + P / Cmd + P) & Simpan (Ctrl + S)
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      alert('Peringatan: Dokumen akademik tidak dapat dicetak atau diunduh bebas.');
    }
  });
}

// =========================================================================
// 6. RIWAYAT & FAVORIT (riwayat-favorit.html)
// =========================================================================
async function initRiwayatFavoritPage() {
  if (!state.user) {
    alert('Silakan login terlebih dahulu untuk melihat riwayat dan materi favorit Anda.');
    window.location.href = `login.html?returnUrl=${encodeURIComponent(window.location.href)}`;
    return;
  }

  // 1. Muat data riwayat dari Supabase
  try {
    const riwayatList = await riwayatBacaService.getByUser(state.user.id);
    const favoritList = await favoritService.getByUser(state.user.id);

    // Update jumlah counter jika ada
    const badgeRiwayat = document.querySelector('label[for="tab-riwayat"] span');
    if (badgeRiwayat && riwayatList) {
      badgeRiwayat.textContent = `Riwayat Belajar (${riwayatList.length})`;
    }

    const badgeFavorit = document.querySelector('label[for="tab-favorit"] span');
    if (badgeFavorit && favoritList) {
      badgeFavorit.textContent = `Materi Favorit (${favoritList.length})`;
    }
  } catch (err) {
    console.warn('Gagal memuat list riwayat/favorit:', err.message);
  }

  // 2. Handler Tombol Hapus Riwayat
  const clearBtn = document.querySelector('.clear-btn');
  if (clearBtn) {
    clearBtn.addEventListener('click', async () => {
      if (confirm('Hapus seluruh riwayat baca akun Anda?')) {
        try {
          await riwayatBacaService.hapusSemuaUser(state.user.id);
          alert('Riwayat berhasil dibersihkan.');
          window.location.reload();
        } catch (err) {
          alert('Gagal membersihkan riwayat: ' + err.message);
        }
      }
    });
  }
}

// =========================================================================
// 7. ACTIVITY SWITCHER 3D FLIP (FR-05)
// =========================================================================
function initActivitySwitcher() {
  const switcher = document.querySelector('.activity-switcher');
  if (!switcher) return;

  let isBookmarkActive = true;
  state.activityInterval = setInterval(() => {
    isBookmarkActive = !isBookmarkActive;
    switcher.classList.toggle('flipped', !isBookmarkActive);
  }, 2000);

  // Bersihkan interval saat halaman ditutup atau berpindah
  window.addEventListener('beforeunload', () => {
    if (state.activityInterval) {
      clearInterval(state.activityInterval);
    }
  });
}

