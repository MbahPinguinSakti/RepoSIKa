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
    await initDashboardPage();
  }

  if (pathname.includes('daftar-matkul')) {
    await initDaftarMatkulPage();
  }

  if (pathname.includes('detail-matkul')) {
    await initDetailMatkulPage();
  }

  if (pathname.includes('riwayat-favorit')) {
    await initRiwayatFavoritPage();
  }

  // 4. Inisialisasi Activity Switcher (FR-05)
  initActivitySwitcher();
});

// 1. MANAJEMEN TEMA (FR-06: Global Light / Dark Mode via localStorage)
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

// 2. SESI PENGGUNA & SIDEBAR
async function initUserSession() {
  state.user = await getCurrentUser();

  if (state.user) {
    state.profile = await getCurrentUserProfile();
  }

  // Update Nama Pengguna di Header
  const userNameEl = document.querySelector('.page-heading h1');
  if (userNameEl) {
    const rawName = state.profile?.nama || state.user?.user_metadata?.nama || state.user?.email?.split('@')[0] || 'Civitas';
    userNameEl.textContent = `Welcome Back, ${rawName.split(' ')[0]}!`;
  }

  // Update Avatar Pengguna
  const avatarEl = document.querySelector('.avatar');
  if (avatarEl && state.profile?.nama) {
    const initial = state.profile.nama.trim().charAt(0).toUpperCase();
    avatarEl.textContent = initial || '🎓';
  }

  // Handler Tombol Logout
  const logoutLinks = document.querySelectorAll('a[href="login.html"], .sidebar-options span:has(.fa-right-from-bracket), .side-bottom-link:has(.fa-right-from-bracket)');
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

// 3. DASHBOARD & MOTHER BUTTON (FR-02, FR-03)
async function initDashboardPage() {
  initMotherButtonModal();
  initDashboardSearchAndFilter();
  await loadDashboardData();
}

// Modal Tahun Ajaran (Mother Button UI)
function initMotherButtonModal() {
  const modalOverlay = document.getElementById('tahun-ajaran');
  if (!modalOverlay) return;

  // Tombol tutup modal
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

  // Tutup dengan tombol Escape (FR-02 & Non-Functional A11y)
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

  const filterCards = () => {
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const checkedSemesters = filterForm
      ? Array.from(filterForm.querySelectorAll('input[name="semester[]"]:checked')).map((cb) => cb.value)
      : [];

    const cards = document.querySelectorAll('.overview-card, .course-card, .learning-card');
    cards.forEach((card) => {
      const title = card.querySelector('h2, h3, p, strong')?.textContent?.toLowerCase() || '';
      const text = card.textContent?.toLowerCase() || '';
      const cardSemester = card.getAttribute('data-semester');

      const matchesSearch = !keyword || title.includes(keyword) || text.includes(keyword);
      let matchesSemester = true;

      if (checkedSemesters.length > 0) {
        if (cardSemester) {
          matchesSemester = checkedSemesters.includes(String(cardSemester));
        } else {
          matchesSemester = checkedSemesters.some((sem) => text.includes(`semester ${sem}`));
        }
      }

      card.style.display = matchesSearch && matchesSemester ? '' : 'none';
    });
  };

  if (searchInput) searchInput.addEventListener('input', filterCards);
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

    // Jika di halaman daftar-matkul.html dan ada data matkul, render dinamis
    const courseGrid = document.querySelector('.course-grid');
    if (courseGrid && state.allMatkul.length > 0) {
      courseGrid.innerHTML = state.allMatkul.map((m, i) => {
        const colors = ['', 'cover-green', 'cover-orange'];
        const colorClass = colors[i % 3];

        return `
          <article class="course-card card" data-semester="${m.semester || 1}" data-matkul-id="${m.id}">
            <div class="course-cover ${colorClass}">
              <div class="cover-illustration">
                <i class="fa-solid fa-laptop-code" aria-hidden="true"></i>
              </div>
              <div class="cover-text">
                <span class="cover-code">${escapeHtml(m.kode || '')}</span>
                <h2 class="cover-title">${escapeHtml(m.nama).toUpperCase()}</h2>
              </div>
            </div>
            <div class="course-body">
              <span class="course-category">
                <i class="fa-solid fa-graduation-cap"></i> Semester ${m.semester || 1}
              </span>
              <p class="course-meta">${escapeHtml(m.deskripsi || 'Mata Kuliah Program Studi')}</p>
              <div class="course-footer">
                <a class="btn btn-open-modal" href="#tahun-ajaran" data-matkul-id="${m.id}">
                  Lihat Materi <i class="fa-solid fa-arrow-right"></i>
                </a>
              </div>
            </div>
          </article>
        `;
      }).join('');
    }

    // Pasang listener pada seluruh kartu / tombol modal
    document.querySelectorAll('a[href="#tahun-ajaran"], .btn-open-modal').forEach((btn, index) => {
      btn.addEventListener('click', () => {
        const explicitId = btn.getAttribute('data-matkul-id') || btn.closest('[data-matkul-id]')?.getAttribute('data-matkul-id');
        if (explicitId) {
          state.selectedMatkulId = explicitId;
        } else if (state.allMatkul[index]) {
          state.selectedMatkulId = state.allMatkul[index].id;
        }
      });
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

// 4. DAFTAR MATA KULIAH (daftar-matkul.html)
async function initDaftarMatkulPage() {
  initMotherButtonModal();
  initDashboardSearchAndFilter();
  await loadDashboardData();
}

// 5. DETAIL MATKUL & PREVIEW MATERI (detail-matkul.html)
async function initDetailMatkulPage() {
  const urlParams = new URLSearchParams(window.location.search);
  const matkulId = urlParams.get('matkul_id');
  const tahunAjaran = urlParams.get('tahun') || '2024/2025';

  if (matkulId) {
    try {
      const matkul = await matkulService.getById(matkulId);
      if (matkul) {
        const heading = document.querySelector('.course-info h1');
        if (heading) heading.textContent = matkul.nama;

        const coverTitle = document.querySelector('.cover-title');
        if (coverTitle) coverTitle.innerHTML = escapeHtml(matkul.nama).toUpperCase().replace(/\s+/g, '<br>');

        const tags = document.querySelectorAll('.course-tags span');
        if (tags[0] && matkul.semester) tags[0].innerHTML = `<i class="fa-solid fa-graduation-cap"></i> Semester ${matkul.semester}`;
        if (tags[1] && tahunAjaran) tags[1].innerHTML = `<i class="fa-regular fa-calendar-days"></i> Tahun ${escapeHtml(tahunAjaran)}`;
      }

      // Ambil daftar materi asli dari database untuk matkul ini
      const materiList = await materiService.getByMatkul(matkulId);
      state.allMateri = materiList || [];

      // Update total counter materi
      const totalCountEl = document.querySelector('.total-material strong');
      if (totalCountEl) totalCountEl.textContent = `${state.allMateri.length} Materi`;

      if (state.allMateri.length > 0) {
        await renderMaterialRows(state.allMateri);
      }
    } catch (e) {
      console.warn('Gagal memuat detail matkul / materi:', e.message);
    }
  }

  // Setup interaksi materi
  initBookmarkButtons();
  initReadButtons();
}

async function renderMaterialRows(materiList) {
  const container = document.querySelector('.material-list');
  if (!container) return;

  // Cek apakah user telah memfavoritkan materi-materi ini
  let userBookmarks = [];
  if (state.user) {
    try {
      const favs = await favoritService.getByUser(state.user.id);
      userBookmarks = favs ? favs.map((f) => f.materi?.id || f.materi_id) : [];
    } catch (e) {
      console.warn('Bookmarks check:', e);
    }
  }

  container.innerHTML = materiList.map((m, idx) => {
    const isFav = userBookmarks.includes(m.id);
    const starClass = isFav ? 'fa-solid' : 'fa-regular';
    const starStyle = isFav ? 'color: #eab308;' : '';
    const dateFormatted = m.dibuat_pada ? new Date(m.dibuat_pada).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Terbaru';
    const activeClass = idx === 0 ? 'active' : '';

    return `
      <article class="material-row ${activeClass}" data-materi-id="${m.id}" data-title="${escapeHtml(m.judul)}">
        <span class="pdf-icon">PDF</span>
        <div class="material-info">
          <h3>${escapeHtml(m.judul)}</h3>
          <p>Materi ${idx + 1} • ${dateFormatted} • ${m.jumlah_dilihat || 0}x dilihat</p>
        </div>
        <span class="bookmark-icon" data-materi-id="${m.id}" title="Simpan ke favorit">
          <i class="${starClass} fa-bookmark" style="${starStyle}"></i>
        </span>
        <button type="button" class="read-button" data-materi-id="${m.id}">
          Baca Materi
        </button>
        <i class="fa-solid fa-ellipsis-vertical more-icon"></i>
      </article>
    `;
  }).join('');
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

      if (isBookmarked) {
        icon.classList.remove('fa-solid');
        icon.classList.add('fa-regular');
        icon.style.color = '';
      } else {
        icon.classList.remove('fa-regular');
        icon.classList.add('fa-solid');
        icon.style.color = '#eab308';
      }

      try {
        const materiId = btn.getAttribute('data-materi-id') || (index + 1);
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
      const title = row?.getAttribute('data-title') || row?.querySelector('h3')?.textContent || 'Materi Perkuliahan';
      const materiId = btn.getAttribute('data-materi-id') || row?.getAttribute('data-materi-id') || (idx + 1);

      // Update Panel Preview di Kanan jika ada
      const previewTitle = document.querySelector('.preview-header h2');
      if (previewTitle) previewTitle.textContent = title;

      // Catat Riwayat Akses ke Supabase (FR-05)
      try {
        await riwayatBacaService.catat(state.user.id, materiId);
      } catch (err) {
        console.warn('Pencatatan riwayat:', err.message);
      }

      // Watermark Dinamis Mahasiswa (FR-04: Nama - NPM - Timestamp)
      applyDynamicWatermark();

      // Buka Halaman Reader Terproteksi Penuh
      window.location.href = `reader.html?title=${encodeURIComponent(title)}&materi_id=${encodeURIComponent(materiId)}`;
    });
  });

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
  document.addEventListener('contextmenu', (e) => {
    if (e.target.closest('.pdf-viewer, .preview-panel, .pdf-paper')) {
      e.preventDefault();
      alert('Tindakan dilarang: Hak cipta materi perkuliahan terproteksi.');
    }
  });

  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      alert('Peringatan: Dokumen akademik tidak dapat dicetak atau diunduh bebas.');
    }
  });
}

// 6. RIWAYAT & FAVORIT (riwayat-favorit.html)
async function initRiwayatFavoritPage() {
  if (!state.user) {
    alert('Silakan login terlebih dahulu untuk melihat riwayat dan materi favorit Anda.');
    window.location.href = `login.html?returnUrl=${encodeURIComponent(window.location.href)}`;
    return;
  }

  try {
    const riwayatList = await riwayatBacaService.getByUser(state.user.id);
    const favoritList = await favoritService.getByUser(state.user.id);

    // Update Badge Tab
    const badgeRiwayat = document.querySelector('label[for="tab-riwayat"] span');
    if (badgeRiwayat) {
      badgeRiwayat.textContent = `Riwayat Belajar (${riwayatList ? riwayatList.length : 0})`;
    }

    const badgeFavorit = document.querySelector('label[for="tab-favorit"] span');
    if (badgeFavorit) {
      badgeFavorit.textContent = `Materi Favorit (${favoritList ? favoritList.length : 0})`;
    }

    // Render Panel Riwayat
    renderRiwayatList(riwayatList || []);

    // Render Panel Favorit
    renderFavoritList(favoritList || []);

  } catch (err) {
    console.warn('Gagal memuat list riwayat/favorit:', err.message);
  }

  // Handler Hapus Riwayat
  const clearRiwayatBtn = document.querySelector('#panel-riwayat .clear-btn');
  if (clearRiwayatBtn) {
    clearRiwayatBtn.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin menghapus seluruh riwayat membaca Anda?')) {
        try {
          await riwayatBacaService.hapusSemuaUser(state.user.id);
          alert('Riwayat membaca berhasil dibersihkan.');
          window.location.reload();
        } catch (err) {
          alert('Gagal membersihkan riwayat: ' + err.message);
        }
      }
    });
  }

  // Handler Hapus Semua Favorit
  const clearFavoritBtn = document.querySelector('#panel-favorit .clear-btn');
  if (clearFavoritBtn) {
    clearFavoritBtn.addEventListener('click', async () => {
      if (confirm('Apakah Anda yakin ingin menghapus seluruh materi favorit Anda?')) {
        try {
          const favs = await favoritService.getByUser(state.user.id);
          for (const f of (favs || [])) {
            if (f.materi_id || f.materi?.id) {
              await favoritService.hapus(state.user.id, f.materi_id || f.materi?.id);
            }
          }
          alert('Semua materi favorit berhasil dihapus.');
          window.location.reload();
        } catch (err) {
          alert('Gagal menghapus favorit: ' + err.message);
        }
      }
    });
  }
}

function renderRiwayatList(list) {
  const container = document.querySelector('#panel-riwayat .material-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--muted, #64748b);">
        <i class="fa-regular fa-clock" style="font-size: 32px; margin-bottom: 8px;"></i>
        <p>Belum ada riwayat membaca. Jelajahi katalog mata kuliah untuk mulai belajar!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((item) => {
    const d = item.dibaca_pada ? new Date(item.dibaca_pada) : new Date();
    const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const timeStr = d.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' });
    const materiId = item.materi?.id || item.materi_id;
    const title = item.materi?.judul || 'Materi Perkuliahan';

    return `
      <article class="material-row history-row" data-history-id="${item.id}">
        <div class="pdf-icon">
          <i class="fa-solid fa-file-pdf"></i>
        </div>
        <div class="material-details">
          <h3>${escapeHtml(title)}</h3>
          <p>Telah dibaca • ${escapeHtml(item.materi?.matkul?.nama || 'Mata Kuliah')}</p>
        </div>
        <div class="row-date">
          <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
          <small>${timeStr}</small>
        </div>
        <a class="btn row-btn" href="reader.html?materi_id=${materiId}&title=${encodeURIComponent(title)}">
          Lanjut Baca <i class="fa-solid fa-angle-right"></i>
        </a>
      </article>
    `;
  }).join('');
}

function renderFavoritList(list) {
  const container = document.querySelector('#panel-favorit .material-list');
  if (!container) return;

  if (list.length === 0) {
    container.innerHTML = `
      <div style="text-align: center; padding: 40px; color: var(--muted, #64748b);">
        <i class="fa-regular fa-bookmark" style="font-size: 32px; margin-bottom: 8px;"></i>
        <p>Belum ada materi favorit. Buka detail mata kuliah dan klik ikon bookmark untuk menyimpan!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = list.map((item) => {
    const d = item.dibuat_pada ? new Date(item.dibuat_pada) : new Date();
    const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });
    const materiId = item.materi?.id || item.materi_id;
    const title = item.materi?.judul || 'Materi Favorit';

    return `
      <article class="material-row favorite-row" data-fav-id="${item.id}">
        <div class="pdf-icon">
          <i class="fa-solid fa-file-pdf"></i>
        </div>
        <div class="material-details">
          <h3>${escapeHtml(title)}</h3>
          <p>Disimpan • ${escapeHtml(item.materi?.matkul?.nama || 'Mata Kuliah')}</p>
        </div>
        <div class="row-date">
          <span><i class="fa-regular fa-calendar"></i> ${dateStr}</span>
          <small>Disimpan</small>
        </div>
        <a class="btn row-btn" href="reader.html?materi_id=${materiId}&title=${encodeURIComponent(title)}">
          <i class="fa-regular fa-eye"></i> Baca Materi
        </a>
      </article>
    `;
  }).join('');
}

// 7. ACTIVITY SWITCHER 3D FLIP (FR-05)
function initActivitySwitcher() {
  const switcher = document.querySelector('.activity-switcher');
  if (!switcher) return;

  let isFlipped = false;
  state.activityInterval = setInterval(() => {
    isFlipped = !isFlipped;
    switcher.classList.toggle('flipped', isFlipped);
  }, 2000);

  // Pembersihan interval saat halaman ditutup (PRD FR-05)
  window.addEventListener('beforeunload', () => {
    if (state.activityInterval) {
      clearInterval(state.activityInterval);
    }
  });
}
