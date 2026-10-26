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

  // 2b. Inisialisasi Modal Interaktif Akun, Settings, & Bantuan
  initUserModals();

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

    // Jika pengguna adalah Admin / Dosen dan sedang membuka dashboard mahasiswa tanpa flag ?as_student=1,
    // langsung arahkan ke admin-dashboard.html agar admin tidak tersangkut di tampilan mahasiswa.
    const urlParams = new URLSearchParams(window.location.search);
    if ((state.profile?.role === 'admin' || state.profile?.role === 'dosen') && !urlParams.has('as_student')) {
      const p = window.location.pathname.toLowerCase();
      if (p.includes('dashboard') || p.endsWith('/') || p.endsWith('index.html')) {
        window.location.replace(CONFIG.PAGES.ADMIN);
        return;
      }
    }
  }

  // Update Nama Pengguna di Header
  const userNameEl = document.querySelector('.page-heading h1');
  if (userNameEl) {
    const rawName = state.profile?.nama || state.user?.user_metadata?.nama || state.user?.email?.split('@')[0] || 'Civitas';
    userNameEl.textContent = `Welcome Back, ${rawName.split(' ')[0]}!`;
  }

  const welcomeName = document.getElementById('welcome-name');
  if (welcomeName) welcomeName.textContent = rawName.split(' ')[0];

  // Update Avatar Pengguna
  const avatarEl = document.querySelector('.avatar');
  if (avatarEl && state.profile?.nama) {
    const initial = state.profile.nama.trim().charAt(0).toUpperCase();
    avatarEl.textContent = initial || '🎓';
  }

  // Mode Pratinjau Mahasiswa untuk Admin / Dosen (?as_student=1)
  const urlParams = new URLSearchParams(window.location.search);
  if ((state.profile?.role === 'admin' || state.profile?.role === 'dosen') && urlParams.has('as_student')) {
    if (!document.getElementById('mode-mahasiswa-banner')) {
      const banner = document.createElement('div');
      banner.id = 'mode-mahasiswa-banner';
      banner.style.cssText = 'background: #2563eb; color: white; padding: 10px 20px; font-size: 13px; font-weight: 500; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; z-index: 9999; box-shadow: 0 2px 10px rgba(0,0,0,0.15);';
      banner.innerHTML = `
        <span><i class="fa-solid fa-graduation-cap"></i> Anda sedang melihat <strong>Mode Pratinjau Mahasiswa</strong> sebagai <strong>${escapeHtml((state.profile.role || '').toUpperCase())}</strong></span>
        <a href="admin-dashboard.html" style="color: white; font-weight: 700; text-decoration: underline; background: rgba(255,255,255,0.2); padding: 5px 12px; border-radius: 6px; transition: background 0.2s;">Kembali ke Panel Admin &rarr;</a>
      `;
      document.body.prepend(banner);
    }
  }

  // Handler Tombol Logout Pengguna
  const handleUserLogout = async (e) => {
    if (e) e.preventDefault();
    if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
      await signOut();
      window.location.replace('login.html?logout=true');
    }
  };

  const logoutLinks = document.querySelectorAll('a[href*="login"], .sidebar-options span:has(.fa-right-from-bracket), .side-bottom-link:has(.fa-right-from-bracket), .btn-logout');
  logoutLinks.forEach((link) => {
    link.addEventListener('click', handleUserLogout);
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

  // Hindari duplikasi event listener jika fungsi dipanggil ulang
  if (modalOverlay.dataset.initialized === 'true') return;
  modalOverlay.dataset.initialized = 'true';

  const openModal = (matkulId) => {
    if (matkulId) state.selectedMatkulId = matkulId;
    modalOverlay.classList.remove('is-closed');
    modalOverlay.classList.add('is-open');
    modalOverlay.style.display = 'flex';
  };

  const closeModal = () => {
    // Jika modal sudah tertutup, jangan lakukan apapun (mencegah loop / callback liar)
    if (modalOverlay.classList.contains('is-closed') && modalOverlay.style.display === 'none') {
      return;
    }

    modalOverlay.classList.remove('is-open');
    modalOverlay.classList.add('is-closed');
    modalOverlay.style.display = 'none';

    // Bersihkan hash #tahun-ajaran dari URL tanpa trigger reload
    if (window.location.hash === '#tahun-ajaran') {
      if (window.history && window.history.replaceState) {
        window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      } else {
        window.location.hash = '';
      }
    }
  };

  // Tombol tutup modal (X)
  const closeBtn = modalOverlay.querySelector('.close-dialog');
  if (closeBtn) {
    closeBtn.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    });
  }

  // Tutup dengan klik di luar area modal (backdrop)
  modalOverlay.addEventListener('click', (e) => {
    if (e.target === modalOverlay) {
      e.preventDefault();
      e.stopPropagation();
      closeModal();
    }
  });

  // Tutup dengan tombol Escape (FR-02 & Non-Functional A11y)
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      if (modalOverlay.classList.contains('is-open') || modalOverlay.style.display === 'flex' || window.location.hash === '#tahun-ajaran') {
        closeModal();
      }
    }
  });

  // Tangani navigasi back browser / popstate / hashchange (khususnya tombol Back di HP Android/iOS)
  window.addEventListener('hashchange', () => {
    if (window.location.hash === '#tahun-ajaran') {
      openModal();
    } else {
      closeModal();
    }
  });

  // Delegasi universal untuk seluruh tombol yang membuka modal tahun ajaran
  document.addEventListener('click', (e) => {
    const trigger = e.target.closest('a[href="#tahun-ajaran"], .btn-open-modal');
    if (trigger) {
      const explicitId = trigger.getAttribute('data-matkul-id') || trigger.closest('[data-matkul-id]')?.getAttribute('data-matkul-id');
      openModal(explicitId);
    }
  });

  // Sinkronisasi status awal modal saat halaman selesai dimuat
  if (window.location.hash === '#tahun-ajaran') {
    openModal();
  } else {
    modalOverlay.classList.add('is-closed');
    modalOverlay.style.display = 'none';
  }

  // Pilihan Tahun Ajaran (Redirect Guest vs Logged-In)
  const yearChoices = modalOverlay.querySelectorAll('.year-choices a');
  yearChoices.forEach((choice) => {
    choice.addEventListener('click', (e) => {
      e.preventDefault();
      const tahunText = choice.textContent.trim();
      let matkulId = state.selectedMatkulId || '';

      if (!matkulId && state.allMatkul && state.allMatkul.length > 0) {
        matkulId = state.allMatkul[0].id;
      }

      localStorage.setItem('tahun_ajaran', tahunText);
      const targetUrl = `detail-matkul.html?matkul_id=${encodeURIComponent(matkulId)}&tahun=${encodeURIComponent(tahunText)}`;

      // FR-02: Jika Pengunjung (Guest), tahan akses dan arahkan ke login.html
      if (!state.user) {
        window.location.href = `login.html?returnUrl=${encodeURIComponent(targetUrl)}`;
      } else {
        window.location.href = targetUrl;
      }
    });
  });
}

// Handler Search, Filter (Semester, Format, Status), & Sort
function initDashboardSearchAndFilter() {
  const searchInput = document.getElementById('dashboard-material-search') || document.querySelector('input[type="search"]');
  const filterForm = document.getElementById('dashboard-filter-form');
  const semesterRadios = document.querySelectorAll('.semester-radio, input[name="semester"]');
  const emptyNotice = document.querySelector('.filter-empty');
  const sortRadios = document.querySelectorAll('input[name="dashboard-sort"]');

  const filterCards = () => {
    const keyword = searchInput ? searchInput.value.trim().toLowerCase() : '';

    // 1. Cek checkbox dari dashboard.html (semester[], format[], status[])
    const checkedCheckboxes = filterForm
      ? Array.from(filterForm.querySelectorAll('input[name="semester[]"]:checked')).map((cb) => cb.value)
      : [];
    const checkedFormats = filterForm
      ? Array.from(filterForm.querySelectorAll('input[name="format[]"]:checked')).map((cb) => cb.value)
      : [];
    const checkedStatuses = filterForm
      ? Array.from(filterForm.querySelectorAll('input[name="status[]"]:checked')).map((cb) => cb.value)
      : [];

    // Update 3 label hijau (.filter-tag) sesuai desain Mukhlas
    const filterTags = document.querySelectorAll('.filter-tag');
    if (filterTags.length >= 3) {
      filterTags[0].textContent = checkedCheckboxes.length === 0 ? 'All semester' : 'Smstr: ' + checkedCheckboxes.join(', ');
      filterTags[1].textContent = checkedFormats.length === 0 ? 'All format' : 'Format: ' + checkedFormats.join(', ');
      filterTags[2].textContent = checkedStatuses.length === 0 ? 'All status' : 'Status: ' + checkedStatuses.join(', ').replace(/_/g, ' ');
    }

    // 2. Cek radio button dari daftar-matkul.html (semester-1 s/d semester-8 atau semester-all)
    let selectedRadioSem = null;
    const checkedRadio = document.querySelector('.semester-radio:checked, input[name="semester"]:checked');
    if (checkedRadio && checkedRadio.id && checkedRadio.id !== 'semester-all') {
      selectedRadioSem = checkedRadio.id.replace('semester-', '');
    }

    const cards = document.querySelectorAll('.overview-card, .course-card, .learning-card');
    let visibleCount = 0;

    cards.forEach((card) => {
      const title = card.querySelector('h2, h3, p, strong')?.textContent?.toLowerCase() || '';
      const text = card.textContent?.toLowerCase() || '';
      const cardSemester = card.getAttribute('data-semester');

      const matchesSearch = !keyword || title.includes(keyword) || text.includes(keyword);
      let matchesSemester = true;

      // Filter via Checkboxes (Dashboard)
      if (checkedCheckboxes.length > 0) {
        if (cardSemester) {
          matchesSemester = checkedCheckboxes.includes(String(cardSemester));
        } else {
          matchesSemester = checkedCheckboxes.some((sem) => text.includes(`semester ${sem}`));
        }
      }

      // Filter via Radio Button (Daftar Matkul)
      if (selectedRadioSem) {
        if (cardSemester) {
          matchesSemester = String(cardSemester) === String(selectedRadioSem);
        } else {
          matchesSemester = text.includes(`semester ${selectedRadioSem}`);
        }
      }

      const isVisible = matchesSearch && matchesSemester;
      card.style.display = isVisible ? '' : 'none';
      if (isVisible) visibleCount++;
    });

    if (emptyNotice) {
      emptyNotice.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    // Update counter pill
    const countPill = document.querySelector('.count-pill');
    if (countPill) {
      countPill.textContent = visibleCount;
    }
  };

  if (searchInput) searchInput.addEventListener('input', filterCards);
  if (filterForm) {
    filterForm.addEventListener('change', filterCards);
    filterForm.addEventListener('reset', () => setTimeout(filterCards, 50));
  }
  semesterRadios.forEach((radio) => {
    radio.addEventListener('change', filterCards);
  });

  // Logika fitur Sort (Urutkan Materi: terbaru, terlama, nama-az)
  sortRadios.forEach((radio) => {
    radio.addEventListener('change', (e) => {
      const sortValue = e.target.value;
      if (!state.allMatkul || state.allMatkul.length === 0) return;

      let sorted = [...state.allMatkul];
      if (sortValue === 'nama-az') {
        sorted.sort((a, b) => (a.nama || '').localeCompare(b.nama || ''));
      } else if (sortValue === 'terlama') {
        sorted.sort((a, b) => new Date(a.dibuat_pada || 0) - new Date(b.dibuat_pada || 0));
      } else if (sortValue === 'terbaru') {
        sorted.sort((a, b) => new Date(b.dibuat_pada || 0) - new Date(a.dibuat_pada || 0));
      }

      state.allMatkul = sorted;
      const overviewGrid = document.querySelector('.overview-grid');
      if (overviewGrid) {
        overviewGrid.innerHTML = sorted.map((m, i) => {
          const colors = ['', 'cover-green', 'cover-orange'];
          const colorClass = colors[i % 3];
          return `
            <article class="overview-card card" data-semester="${m.semester || 1}" data-matkul-id="${m.id}">
              <div class="course-cover ${colorClass}">
                <div class="cover-illustration">
                  <i class="fa-solid fa-laptop-code" aria-hidden="true"></i>
                </div>
                <span class="cover-label">
                  ${escapeHtml(m.nama).toUpperCase().replace(/\s+/g, '<br>')}
                </span>
              </div>
              <span class="material-type">
                <i class="fa-solid fa-book"></i> Materi
              </span>
              <h3>${escapeHtml(m.nama)}</h3>
              <div class="overview-footer">
                <span>Semester ${m.semester || 1}</span>
                <a class="btn btn-open-modal" href="#tahun-ajaran" data-matkul-id="${m.id}">
                  Start <i class="fa-solid fa-arrow-right"></i>
                </a>
              </div>
            </article>
          `;
        }).join('');

        // Re-attach modal listeners
        document.querySelectorAll('a[href="#tahun-ajaran"], .btn-open-modal').forEach((btn) => {
          btn.addEventListener('click', () => {
            const explicitId = btn.getAttribute('data-matkul-id') || btn.closest('[data-matkul-id]')?.getAttribute('data-matkul-id');
            if (explicitId) state.selectedMatkulId = explicitId;
          });
        });
      }

      filterCards();
    });
  });
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

    // Render Continue Learning secara dinamis berdasarkan riwayat_baca pengguna
    const learningGrid = document.querySelector('.learning-grid');
    if (learningGrid) {
      if (state.user) {
        try {
          const recentHistory = await riwayatBacaService.getByUser(state.user.id, 2);
          if (recentHistory && recentHistory.length > 0) {
            learningGrid.innerHTML = recentHistory.map((item, idx) => {
              const m = item.materi || {};
              const judul = m.judul || 'Materi Perkuliahan';
              const matkulNama = state.allMatkul.find(c => String(c.id) === String(m.matkul_id))?.nama || 'Mata Kuliah';
              const artClasses = ['code', 'math'];
              const artIcons = ['fa-laptop-code', 'fa-book-open'];
              const artLabels = ['</>', '📚'];
              const artClass = artClasses[idx % 2];
              const artIcon = artIcons[idx % 2];
              const artLabel = artLabels[idx % 2];

              const dateStr = item.dibaca_pada 
                ? new Date(item.dibaca_pada).toLocaleDateString('id-ID', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
                : 'Baru saja';

              return `
                <article class="learning-card">
                  <div class="learning-art ${artClass}">
                    <span class="pill" title="${escapeHtml(matkulNama)}">
                      ${escapeHtml(matkulNama.length > 18 ? matkulNama.slice(0, 16) + '...' : matkulNama)}
                    </span>
                    <i class="fa-solid ${artIcon} main-icon" aria-hidden="true"></i>
                    <span class="art-label">${artLabel}</span>
                  </div>
                  <div class="learning-info">
                    <strong><i class="fa-solid fa-book"></i> Materi Terakhir</strong>
                    <p title="${escapeHtml(judul)}">${escapeHtml(judul)}</p>
                    <span class="progress-note"><i class="fa-regular fa-clock"></i> Akses: ${dateStr}</span>
                    <div class="progress-track"><span style="width: 100%"></span></div>
                    <a class="btn" href="reader.html?materi_id=${encodeURIComponent(m.id || item.materi_id || '')}&title=${encodeURIComponent(judul)}">Lanjutkan Belajar</a>
                  </div>
                </article>
              `;
            }).join('');
          } else {
            learningGrid.innerHTML = `
              <div style="grid-column: 1 / -1; padding: 28px 20px; text-align: center; background: rgba(37, 99, 235, 0.04); border-radius: 12px; border: 1px dashed #cbd5e1;">
                <i class="fa-regular fa-folder-open" style="font-size: 28px; color: #64748b; margin-bottom: 8px;"></i>
                <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">Belum ada materi yang Anda pelajari. Mulai jelajahi materi perkuliahan di bawah ini untuk memulai belajar!</p>
                <a href="daftar-matkul.html" class="btn" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none;">
                  <i class="fa-solid fa-compass"></i> Jelajahi Katalog Materi
                </a>
              </div>
            `;
          }
        } catch (histErr) {
          console.warn('Gagal memuat riwayat continue learning:', histErr.message);
        }
      } else {
        learningGrid.innerHTML = `
          <div style="grid-column: 1 / -1; padding: 28px 20px; text-align: center; background: rgba(37, 99, 235, 0.04); border-radius: 12px; border: 1px dashed #cbd5e1;">
            <p style="margin: 0 0 12px 0; color: #64748b; font-size: 14px;">Masuk dengan akun kampus Anda untuk menyimpan dan melanjutkan riwayat membaca.</p>
            <a href="login.html" class="btn" style="display: inline-flex; align-items: center; gap: 8px; text-decoration: none;">
              <i class="fa-solid fa-right-to-bracket"></i> Masuk Sekarang
            </a>
          </div>
        `;
      }
    }

    // Jika di halaman index.html / dashboard.html (.overview-grid), render dinamis
    const overviewGrid = document.querySelector('.overview-grid');
    if (overviewGrid && state.allMatkul.length > 0) {
      overviewGrid.innerHTML = state.allMatkul.map((m, i) => {
        const colors = ['', 'cover-green', 'cover-orange'];
        const colorClass = colors[i % 3];

        return `
          <article class="overview-card card" data-semester="${m.semester || 1}" data-matkul-id="${m.id}">
            <div class="course-cover ${colorClass}">
              <div class="cover-illustration">
                <i class="fa-solid fa-laptop-code" aria-hidden="true"></i>
              </div>
              <span class="cover-label">
                ${escapeHtml(m.nama).toUpperCase().replace(/\s+/g, '<br>')}
              </span>
            </div>
            <span class="material-type">
              <i class="fa-solid fa-book"></i>
              Materi
            </span>
            <h3>${escapeHtml(m.nama)}</h3>
            <div class="overview-footer">
              <span>Semester ${m.semester || 1}</span>
              <a class="btn btn-open-modal" href="#tahun-ajaran" data-matkul-id="${m.id}">
                Start <i class="fa-solid fa-arrow-right"></i>
              </a>
            </div>
          </article>
        `;
      }).join('');
    }

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

  // Load status bookmark pengguna dari Supabase
  state.userBookmarks = [];
  if (state.user) {
    try {
      const favs = await favoritService.getByUser(state.user.id);
      state.userBookmarks = favs ? favs.map((f) => String(f.materi?.id || f.materi_id)) : [];
    } catch (e) {
      console.warn('Bookmarks check:', e);
    }
  }

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
        renderMaterialRows(state.allMateri);
        updatePreviewPanel(state.allMateri[0]);
      }
    } catch (e) {
      console.warn('Gagal memuat detail matkul / materi:', e.message);
    }
  }

  // Setup toolbar (Search & Sort) & Interaksi Materi
  initDetailToolbar();
  initBookmarkButtons();
  initReadButtons();
  initMaterialRowSelection();
}

function initDetailToolbar() {
  const searchInput = document.querySelector('.material-toolbar input[type="search"]');
  const sortSelect = document.querySelector('.material-toolbar select');

  const filterAndSort = () => {
    if (!state.allMateri || state.allMateri.length === 0) return;
    const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
    const sortBy = sortSelect ? sortSelect.value : 'terbaru';

    let result = state.allMateri.filter(m => {
      const title = (m.judul || '').toLowerCase();
      const desc = (m.deskripsi || '').toLowerCase();
      return title.includes(q) || desc.includes(q);
    });

    if (sortBy === 'terlama') {
      result.sort((a, b) => new Date(a.dibuat_pada || 0) - new Date(b.dibuat_pada || 0));
    } else if (sortBy === 'az') {
      result.sort((a, b) => (a.judul || '').localeCompare(b.judul || ''));
    } else {
      result.sort((a, b) => new Date(b.dibuat_pada || 0) - new Date(a.dibuat_pada || 0));
    }

    renderMaterialRows(result);
  };

  if (searchInput) searchInput.addEventListener('input', filterAndSort);
  if (sortSelect) sortSelect.addEventListener('change', filterAndSort);
}

function renderMaterialRows(materiList) {
  const container = document.querySelector('.material-list');
  if (!container) return;

  if (materiList.length === 0) {
    container.innerHTML = `
      <div style="padding: 30px 20px; text-align: center; color: #64748b; background: rgba(0,0,0,0.02); border-radius: 12px; grid-column: 1 / -1;">
        <i class="fa-regular fa-folder-open" style="font-size: 28px; margin-bottom: 8px; display: block;"></i>
        <p>Tidak ada materi yang sesuai dengan pencarian Anda.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = materiList.map((m, idx) => {
    const isFav = state.userBookmarks ? state.userBookmarks.includes(String(m.id)) : false;
    const starClass = isFav ? 'fa-solid' : 'fa-regular';
    const starStyle = isFav ? 'color: #eab308;' : '';
    const dateFormatted = m.dibuat_pada ? new Date(m.dibuat_pada).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' }) : 'Terbaru';
    const activeClass = (state.currentPreviewMateri && String(state.currentPreviewMateri.id) === String(m.id)) || (!state.currentPreviewMateri && idx === 0) ? 'active' : '';

    return `
      <article class="material-row ${activeClass}" data-materi-id="${m.id}" data-title="${escapeHtml(m.judul)}">
        <span class="pdf-icon">PDF</span>
        <div class="material-info">
          <h3>${escapeHtml(m.judul)}</h3>
          <p>Materi ${idx + 1} • ${dateFormatted} • ${m.jumlah_dilihat || 0}x dilihat</p>
        </div>
        <button type="button" class="bookmark-btn bookmark-icon" data-materi-id="${m.id}" title="${isFav ? 'Hapus dari favorit' : 'Simpan ke favorit'}" aria-label="Simpan ke favorit" style="background: none; border: none; padding: 6px 10px; cursor: pointer;">
          <i class="${starClass} fa-bookmark" style="${starStyle} font-size: 18px;"></i>
        </button>
        <button type="button" class="read-button" data-materi-id="${m.id}" title="Baca Materi">
          Baca Materi
        </button>
        <i class="fa-solid fa-ellipsis-vertical more-icon"></i>
      </article>
    `;
  }).join('');
}

// Handler Bookmark Universal (Sinkron List & Preview Panel)
async function toggleBookmark(materiId) {
  if (!state.user) {
    alert('Silakan login terlebih dahulu untuk menyimpan materi favorit.');
    window.location.href = `login.html?returnUrl=${encodeURIComponent(window.location.href)}`;
    return;
  }

  if (!materiId) return;

  try {
    const isNowFav = await favoritService.toggle(state.user.id, materiId);

    // Perbarui state lokal userBookmarks
    if (!state.userBookmarks) state.userBookmarks = [];
    const strId = String(materiId);
    if (isNowFav) {
      if (!state.userBookmarks.includes(strId)) state.userBookmarks.push(strId);
    } else {
      state.userBookmarks = state.userBookmarks.filter(id => id !== strId);
    }

    // 1. Update seluruh ikon di daftar materi
    const icons = document.querySelectorAll(`[data-materi-id="${materiId}"] .fa-bookmark, button[data-materi-id="${materiId}"] i.fa-bookmark`);
    icons.forEach(icon => {
      if (isNowFav) {
        icon.className = 'fa-solid fa-bookmark';
        icon.style.color = '#eab308';
      } else {
        icon.className = 'fa-regular fa-bookmark';
        icon.style.color = '';
      }
    });

    // 2. Update ikon bookmark di preview panel jika sedang menampilkan materi yang sama
    const previewBtn = document.querySelector('.preview-bookmark-btn');
    const previewIcon = document.querySelector('.preview-actions .fa-bookmark, .preview-bookmark-btn i');
    if (previewBtn && String(previewBtn.getAttribute('data-materi-id')) === strId) {
      if (isNowFav) {
        if (previewIcon) {
          previewIcon.className = 'fa-solid fa-bookmark';
          previewIcon.style.color = '#eab308';
        }
        previewBtn.setAttribute('title', 'Hapus dari favorit');
      } else {
        if (previewIcon) {
          previewIcon.className = 'fa-regular fa-bookmark';
          previewIcon.style.color = '';
        }
        previewBtn.setAttribute('title', 'Simpan ke favorit');
      }
    }

    // Feedback Toast Visual
    showNotificationToast(isNowFav ? 'Materi berhasil ditambahkan ke Favorit! ⭐' : 'Materi dihapus dari Favorit.');
  } catch (err) {
    console.error('Gagal toggle bookmark:', err);
    alert('Gagal memperbarui status favorit: ' + err.message);
  }
}

function initBookmarkButtons() {
  if (state.bookmarkDelegationInitialized) return;
  state.bookmarkDelegationInitialized = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.bookmark-icon, .bookmark-btn, .preview-bookmark-btn');
    if (!btn) return;

    e.preventDefault();
    e.stopPropagation();

    let materiId = btn.getAttribute('data-materi-id');
    if (!materiId) {
      const row = btn.closest('.material-row');
      materiId = row?.getAttribute('data-materi-id');
    }
    if (!materiId && state.currentPreviewMateri) {
      materiId = state.currentPreviewMateri.id;
    }
    if (!materiId && state.allMateri && state.allMateri.length > 0) {
      materiId = state.allMateri[0].id;
    }

    if (materiId) {
      toggleBookmark(materiId);
    }
  });
}

// Buka Halaman Reader & Catat Riwayat Akses ke Supabase (FR-05)
async function bukaReader(materiId, title) {
  if (!state.user) {
    alert('Akses materi dibatasi khusus civitas akademika. Silakan login terlebih dahulu.');
    window.location.href = `login.html?returnUrl=${encodeURIComponent(window.location.href)}`;
    return;
  }

  try {
    await riwayatBacaService.catat(state.user.id, materiId);
  } catch (err) {
    console.warn('Pencatatan riwayat:', err.message);
  }

  window.location.href = `reader.html?title=${encodeURIComponent(title || 'Materi Perkuliahan')}&materi_id=${encodeURIComponent(materiId)}`;
}

function initReadButtons() {
  if (state.readDelegationInitialized) return;
  state.readDelegationInitialized = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest('.read-button');
    if (!btn) return;

    e.preventDefault();
    const row = btn.closest('.material-row');
    const title = row?.getAttribute('data-title') || row?.querySelector('h3')?.textContent || 'Materi Perkuliahan';
    const materiId = btn.getAttribute('data-materi-id') || row?.getAttribute('data-materi-id') || 1;

    bukaReader(materiId, title);
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
  // Anti-Print & Anti-Download (Ctrl+P, Ctrl+S) tetap aktif sesuai FR-04.
  // Seleksi dan salin teks diizinkan untuk kenyamanan belajar mahasiswa.
  document.addEventListener('keydown', (e) => {
    if ((e.ctrlKey || e.metaKey) && (e.key === 'p' || e.key === 'P' || e.key === 's' || e.key === 'S')) {
      e.preventDefault();
      alert('Peringatan: Dokumen akademik tidak dapat dicetak atau diunduh bebas.');
    }
  });
}

// 6. RIWAYAT & FAVORIT (riwayat-favorit.html)
async function initRiwayatFavoritPage() {
  // Sync ARIA attributes on tab change (NFR Accessibility)
  const radioRiwayat = document.getElementById('tab-riwayat');
  const radioFavorit = document.getElementById('tab-favorit');
  const btnRiwayat = document.getElementById('tab-btn-riwayat');
  const btnFavorit = document.getElementById('tab-btn-favorit');

  const updateTabAria = () => {
    if (btnRiwayat && btnFavorit) {
      const isRiwayat = radioRiwayat ? radioRiwayat.checked : true;
      btnRiwayat.setAttribute('aria-selected', isRiwayat ? 'true' : 'false');
      btnFavorit.setAttribute('aria-selected', !isRiwayat ? 'true' : 'false');
    }
  };

  // Baca parameter URL tab (?tab=favorit atau ?tab=riwayat atau hash)
  const urlParams = new URLSearchParams(window.location.search);
  const targetTab = urlParams.get('tab') || (window.location.hash ? window.location.hash.replace('#', '') : '');
  if (targetTab === 'favorit' && radioFavorit) {
    radioFavorit.checked = true;
  } else if (targetTab === 'riwayat' && radioRiwayat) {
    radioRiwayat.checked = true;
  }
  updateTabAria();

  if (radioRiwayat) radioRiwayat.addEventListener('change', updateTabAria);
  if (radioFavorit) radioFavorit.addEventListener('change', updateTabAria);
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
  switcher.setAttribute('href', 'riwayat-favorit.html?tab=favorit');

  state.activityInterval = setInterval(() => {
    isFlipped = !isFlipped;
    switcher.classList.toggle('flipped', isFlipped);
    switcher.setAttribute('href', isFlipped ? 'riwayat-favorit.html?tab=riwayat' : 'riwayat-favorit.html?tab=favorit');
  }, 2500);

  // Pembersihan interval saat halaman ditutup (PRD FR-05)
  window.addEventListener('beforeunload', () => {
    if (state.activityInterval) {
      clearInterval(state.activityInterval);
    }
  });
}


// Helper untuk memperbarui panel preview di sebelah kanan (detail-matkul.html)
function updatePreviewPanel(materi) {
  if (!materi) return;
  state.currentPreviewMateri = materi;

  const previewHeader = document.querySelector('.preview-header h2');
  if (previewHeader) previewHeader.textContent = materi.judul;

  const paperTitle = document.querySelector('.pdf-paper h1, .paper-content h2');
  if (paperTitle) paperTitle.textContent = materi.judul;

  const paperDesc = document.querySelector('.pdf-paper p, .paper-content p');
  if (paperDesc && materi.deskripsi) paperDesc.textContent = materi.deskripsi;

  // Sinkronkan status bookmark di panel preview
  const previewBookmarkBtn = document.querySelector('.preview-bookmark-btn');
  const previewBookmarkIcon = document.querySelector('.preview-actions .fa-bookmark, .preview-bookmark-btn i');
  const isFav = state.userBookmarks ? state.userBookmarks.includes(String(materi.id)) : false;

  if (previewBookmarkBtn) {
    previewBookmarkBtn.setAttribute('data-materi-id', materi.id);
    previewBookmarkBtn.setAttribute('title', isFav ? 'Hapus dari favorit' : 'Simpan ke favorit');
  }

  if (previewBookmarkIcon) {
    previewBookmarkIcon.setAttribute('data-materi-id', materi.id);
    if (isFav) {
      previewBookmarkIcon.className = 'fa-solid fa-bookmark';
      previewBookmarkIcon.style.color = '#eab308';
    } else {
      previewBookmarkIcon.className = 'fa-regular fa-bookmark';
      previewBookmarkIcon.style.color = '';
    }
  }

  // Pasang aksi klik baca pada toolbar expand & kertas dokumen
  const expandBtn = document.querySelector('.btn-expand-preview, .pdf-toolbar .fa-expand');
  if (expandBtn) {
    expandBtn.style.cursor = 'pointer';
    expandBtn.onclick = (e) => {
      e.preventDefault();
      bukaReader(materi.id, materi.judul);
    };
  }

  const pdfPaper = document.querySelector('.pdf-paper');
  if (pdfPaper) {
    pdfPaper.style.cursor = 'pointer';
    pdfPaper.setAttribute('title', 'Klik untuk membaca materi');
    pdfPaper.onclick = (e) => {
      if (e.target.closest('.preview-actions, .bookmark-btn, .bookmark-icon')) return;
      bukaReader(materi.id, materi.judul);
    };
  }

  applyDynamicWatermark();
}

function initMaterialRowSelection() {
  document.querySelectorAll('.material-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.bookmark-icon, .read-button')) return;

      document.querySelectorAll('.material-row').forEach((r) => r.classList.remove('active'));
      row.classList.add('active');

      const materiId = row.getAttribute('data-materi-id');
      const materi = state.allMateri.find((m) => String(m.id) === String(materiId));
      if (materi) {
        updatePreviewPanel(materi);
      } else {
        const title = row.getAttribute('data-title') || row.querySelector('h3')?.textContent || '';
        updatePreviewPanel({ judul: title, id: materiId });
      }
    });
  });
}

// =========================================================================
// 8. MODAL INTERAKTIF: PROFIL, SETTINGS, & HELP & SUPPORT
// =========================================================================
function initUserModals() {
  const avatar = document.querySelector('.avatar');
  const profileLinks = document.querySelectorAll('.side-bottom-link:has(.fa-user), .sidebar-options span:has(.fa-user)');
  const settingsLinks = document.querySelectorAll('.side-bottom-link:has(.fa-gear), .sidebar-options span:has(.fa-gear)');
  const helpLinks = document.querySelectorAll('.side-bottom-link:has(.fa-circle-question), .help-link, .support');

  // Modal Container Generator
  function getOrCreateModal(id) {
    let m = document.getElementById(id);
    if (!m) {
      m = document.createElement('div');
      m.id = id;
      m.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: none; align-items: center; justify-content: center; z-index: 9999; animation: fadeInScale 0.2s ease;';
      document.body.appendChild(m);
    }
    return m;
  }

  // 1. Profil Modal
  const showProfile = () => {
    const rawName = state.profile?.nama || state.user?.user_metadata?.nama || state.user?.email?.split('@')[0] || 'Civitas Akademika';
    const email = state.user?.email || '-';
    const npm = state.profile?.npm || state.user?.user_metadata?.npm || 'Mahasiswa UNSIKA';
    const role = state.profile?.role || 'mahasiswa';
    const initial = rawName.charAt(0).toUpperCase();

    const m = getOrCreateModal('user-profile-modal');
    m.innerHTML = `
      <div style="background: var(--paper, white); color: var(--ink, #1e293b); border-radius: 16px; padding: 28px; width: 90%; max-width: 400px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); font-family: 'Poppins', sans-serif; position: relative;">
        <button type="button" class="close-modal" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--muted, #64748b);">&times;</button>
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 72px; height: 72px; border-radius: 50%; background: var(--olive, #788744); color: white; font-size: 30px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; font-weight: bold; box-shadow: 0 4px 12px rgba(120,135,68,0.3);">
            ${initial}
          </div>
          <h2 style="margin: 0; font-size: 18px;">${escapeHtml(rawName)}</h2>
          <span style="display: inline-block; padding: 3px 12px; background: rgba(120, 135, 68, 0.15); color: var(--olive, #788744); border-radius: 20px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-top: 6px;">
            ${escapeHtml(role)}
          </span>
        </div>
        <div style="background: var(--line, #f8fafc); border-radius: 12px; padding: 14px; margin-bottom: 20px; font-size: 13px;">
          <div style="margin-bottom: 8px;"><strong>Email:</strong> ${escapeHtml(email)}</div>
          <div style="margin-bottom: 8px;"><strong>NPM:</strong> ${escapeHtml(npm)}</div>
          <div><strong>Status Akun:</strong> <span style="color: #16a34a; font-weight: bold;">● Aktif</span></div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" class="btn-logout-modal" style="flex: 1; padding: 10px; background: #dc2626; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            <i class="fa-solid fa-right-from-bracket"></i> Keluar
          </button>
          <button type="button" class="btn-close-modal" style="flex: 1; padding: 10px; background: #e2e8f0; color: #334155; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Tutup
          </button>
        </div>
      </div>
    `;

    m.style.display = 'flex';
    const close = () => { m.style.display = 'none'; };
    m.querySelector('.close-modal').onclick = close;
    m.querySelector('.btn-close-modal').onclick = close;
    m.onclick = (e) => { if (e.target === m) close(); };
    m.querySelector('.btn-logout-modal').onclick = async () => {
      if (confirm('Apakah Anda yakin ingin keluar dari akun?')) {
        await signOut();
        window.location.replace('login.html?logout=true');
      }
    };
  };

  // 2. Settings Modal
  const showSettings = () => {
    const isDark = document.body.classList.contains('dark-theme');
    const m = getOrCreateModal('user-settings-modal');
    m.innerHTML = `
      <div style="background: var(--paper, white); color: var(--ink, #1e293b); border-radius: 16px; padding: 28px; width: 90%; max-width: 440px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); font-family: 'Poppins', sans-serif; position: relative;">
        <button type="button" class="close-modal" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--muted, #64748b);">&times;</button>
        <h2 style="margin: 0 0 16px; font-size: 18px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-gear" style="color: var(--olive, #788744);"></i> Pengaturan Tampilan
        </h2>
        <div style="border-top: 1px solid var(--line, #e2e8f0); padding-top: 14px; margin-bottom: 20px; font-size: 14px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px;">
            <div>
              <strong>Mode Gelap (Dark Mode)</strong>
              <p style="margin: 2px 0 0; font-size: 12px; color: var(--muted, #64748b);">Ubah tema ke mode gelap untuk kenyamanan mata.</p>
            </div>
            <input type="checkbox" id="settings-theme-toggle" ${isDark ? 'checked' : ''} style="width: 20px; height: 20px; cursor: pointer;">
          </div>
          <div style="margin-bottom: 12px;">
            <strong>Akses Sesi:</strong>
            <p style="margin: 2px 0 0; font-size: 12px; color: var(--muted, #64748b);">Tersambung ke Supabase Auth dengan otentikasi kampus UNSIKA.</p>
          </div>
        </div>
        <button type="button" class="btn-close-modal" style="width: 100%; padding: 10px; background: var(--olive, #788744); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Selesai
        </button>
      </div>
    `;

    m.style.display = 'flex';
    const close = () => { m.style.display = 'none'; };
    m.querySelector('.close-modal').onclick = close;
    m.querySelector('.btn-close-modal').onclick = close;
    m.onclick = (e) => { if (e.target === m) close(); };

    const toggle = m.querySelector('#settings-theme-toggle');
    if (toggle) {
      toggle.onchange = () => {
        const nextDark = toggle.checked;
        localStorage.setItem(CONFIG.THEME_KEY, nextDark ? 'dark' : 'light');
        if (nextDark) {
          document.body.classList.add('dark-theme');
        } else {
          document.body.classList.remove('dark-theme');
        }
        const darkInput = document.getElementById('theme-dark');
        if (darkInput) darkInput.checked = nextDark;
      };
    }
  };

  // 3. Help & Support Modal
  const showHelp = () => {
    const m = getOrCreateModal('user-help-modal');
    m.innerHTML = `
      <div style="background: var(--paper, white); color: var(--ink, #1e293b); border-radius: 16px; padding: 28px; width: 90%; max-width: 480px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); font-family: 'Poppins', sans-serif; position: relative; max-height: 85vh; overflow-y: auto;">
        <button type="button" class="close-modal" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 22px; cursor: pointer; color: var(--muted, #64748b);">&times;</button>
        <h2 style="margin: 0 0 16px; font-size: 18px; display: flex; align-items: center; gap: 8px;">
          <i class="fa-solid fa-circle-question" style="color: var(--olive, #788744);"></i> Bantuan & Dukungan (FAQ)
        </h2>
        <div style="font-size: 13px; line-height: 1.6;">
          <div style="margin-bottom: 14px; background: var(--line, #f8fafc); padding: 12px; border-radius: 8px;">
            <strong style="color: var(--ink, #1e293b);">Bagaimana cara membaca materi perkuliahan?</strong>
            <p style="margin: 4px 0 0; color: var(--muted, #64748b);">Pilih mata kuliah yang kamu inginkan, pilih tahun ajaran, lalu klik tombol "Baca Materi" untuk membuka pembaca daring terproteksi.</p>
          </div>
          <div style="margin-bottom: 14px; background: var(--line, #f8fafc); padding: 12px; border-radius: 8px;">
            <strong style="color: var(--ink, #1e293b);">Mengapa berkas tidak bisa dicetak atau diunduh bebas?</strong>
            <p style="margin: 4px 0 0; color: var(--muted, #64748b);">Sesuai kebijakan akademik kampus UNSIKA, seluruh materi perkuliahan dilindungi hak cipta untuk mencegah peredaran materi secara liar di luar civitas akademika.</p>
          </div>
          <div style="margin-bottom: 16px; background: var(--line, #f8fafc); padding: 12px; border-radius: 8px;">
            <strong style="color: var(--ink, #1e293b);">Layanan Bantuan Perpustakaan UNSIKA:</strong>
            <p style="margin: 4px 0 0; color: var(--muted, #64748b);">Gedung Perpustakaan UNSIKA Lt. 2<br>Email: <a href="mailto:perpustakaan@unsika.ac.id" style="color: var(--olive, #788744);">perpustakaan@unsika.ac.id</a></p>
          </div>
        </div>
        <button type="button" class="btn-close-modal" style="width: 100%; padding: 10px; background: var(--olive, #788744); color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
          Tutup Bantuan
        </button>
      </div>
    `;

    m.style.display = 'flex';
    const close = () => { m.style.display = 'none'; };
    m.querySelector('.close-modal').onclick = close;
    m.querySelector('.btn-close-modal').onclick = close;
    m.onclick = (e) => { if (e.target === m) close(); };
  };

  // Pasang event listener
  if (avatar) {
    avatar.style.cursor = 'pointer';
    avatar.setAttribute('title', 'Buka Profil Akun');
    avatar.onclick = showProfile;
  }

  profileLinks.forEach((el) => {
    el.style.cursor = 'pointer';
    el.classList.remove('disabled-link');
    el.onclick = (e) => { e.preventDefault(); showProfile(); };
  });

  settingsLinks.forEach((el) => {
    el.style.cursor = 'pointer';
    el.classList.remove('disabled-link');
    el.onclick = (e) => { e.preventDefault(); showSettings(); };
  });

  helpLinks.forEach((el) => {
    el.style.cursor = 'pointer';
    el.classList.remove('disabled-link');
    el.onclick = (e) => { e.preventDefault(); showHelp(); };
  });
}


function showNotificationToast(message) {
  let toast = document.getElementById('reposika-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'reposika-toast';
    toast.style.cssText = 'position: fixed; bottom: 24px; right: 24px; z-index: 9999; background: #1e293b; color: #ffffff; padding: 12px 20px; border-radius: 10px; font-size: 14px; font-weight: 500; font-family: "Poppins", sans-serif; box-shadow: 0 10px 25px rgba(0,0,0,0.25); display: flex; align-items: center; gap: 10px; transition: opacity 0.3s ease, transform 0.3s ease; opacity: 0; transform: translateY(10px); pointer-events: none;';
    document.body.appendChild(toast);
  }
  toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #22c55e;"></i> <span>${message}</span>`;
  toast.style.opacity = '1';
  toast.style.transform = 'translateY(0)';

  clearTimeout(toast._timeout);
  toast._timeout = setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
  }, 2500);
}
