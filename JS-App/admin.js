// JS-App/admin.js
// Controller Khusus Panel Administrator RepoSIKa
// Memenuhi Kebutuhan PRD: FR-07 (CRUD Materi), FR-08 (Manajemen User), FR-09 (Prioritas Akun Nonaktif)

import { supabase, escapeHtml, CONFIG } from '../JS-Login/utils.js';
import {
  requireAdmin,
  signOut,
  getCurrentUserProfile,
} from '../JS-Login/auth.js';
import {
  usersService,
  matkulService,
  materiService,
} from './db-services.js';
import { alurUpload } from './alur-project.js';

// State Admin
const adminState = {
  adminUser: null,
  adminProfile: null,
  allUsers: [],
  allMatkul: [],
};

document.addEventListener('DOMContentLoaded', async () => {
  // 1. Inisialisasi Tema Gelap / Terang untuk Halaman Admin
  initAdminTheme();

  // 2. Proteksi Halaman Admin (FR-08: Mahasiswa Biasa Mental / 403)
  const auth = await requireAdmin({ redirectTo: 'login.html' });
  if (!auth) return;

  adminState.adminUser = auth.user;
  adminState.adminProfile = auth.profile;

  // Tampilkan Nama Admin di Header
  const headerGreeting = document.querySelector('.page-header h1');
  if (headerGreeting && adminState.adminProfile?.nama) {
    headerGreeting.textContent = `Welcome Back, ${adminState.adminProfile.nama.split(' ')[0]}!`;
  }

  // Handler Tombol Logout Admin
  const logoutBtn = document.querySelector('nav.side-footer a:has(.fa-right-from-bracket)');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', async (e) => {
      e.preventDefault();
      if (confirm('Keluar dari Panel Administrator?')) {
        await signOut();
        window.location.href = 'login.html';
      }
    });
  }

  // 3. Inisialisasi Modal Akun & Bantuan Admin
  initAdminModals();

  // 4. Deteksi Halaman Admin yang Sedang Aktif
  const path = window.location.pathname.toLowerCase();

  if (path.includes('admin-dashboard')) {
    await initAdminDashboard();
  }

  if (path.includes('admin-materi')) {
    await initAdminMateriUpload();
  }

  if (path.includes('admin-semua-materi')) {
    await initAdminSemuaMateri();
  }

  if (path.includes('admin-detail-matkul')) {
    await initAdminDetailMatkul();
  }
});

// =========================================================================
// 1. TEMA ADMIN (Sync dengan localStorage 'repo_theme')
// =========================================================================
function initAdminTheme() {
  const themeToggle = document.getElementById('theme-toggle');
  const savedTheme = localStorage.getItem(CONFIG.THEME_KEY) || 'light';

  if (themeToggle) {
    themeToggle.checked = savedTheme === 'dark';
    themeToggle.addEventListener('change', () => {
      localStorage.setItem(CONFIG.THEME_KEY, themeToggle.checked ? 'dark' : 'light');
    });
  }
}

// =========================================================================
// 2. DASHBOARD ADMIN (FR-08, FR-09: Statistik & Manajemen User)
// =========================================================================
async function initAdminDashboard() {
  await loadAdminStats();
  await loadRecentLogins();
  await loadUserManagementTable();
  initUserSearch();
}

// Memuat Ringkasan Statistik Sistem
async function loadAdminStats() {
  try {
    // 1. Ambil data pengguna
    const { data: users } = await supabase.from('users').select('id, aktif');
    // 2. Ambil total materi
    const { count: totalMateri } = await supabase.from('materi').select('*', { count: 'exact', head: true });

    const totalUsers = users ? users.length : 0;
    const activeUsers = users ? users.filter((u) => u.aktif).length : 0;
    const inactiveUsers = totalUsers - activeUsers;

    // Pasang ke 4 kartu statistik di HTML
    const statCards = document.querySelectorAll('.stats .card.stat strong');
    if (statCards[0]) statCards[0].textContent = totalUsers;
    if (statCards[1]) statCards[1].textContent = totalMateri ?? 0;
    if (statCards[2]) statCards[2].textContent = activeUsers;
    if (statCards[3]) statCards[3].textContent = inactiveUsers;
  } catch (err) {
    console.warn('[Admin Stats] Gagal memuat ringkasan:', err.message);
  }
}

// Memuat Aktivitas Login Terbaru
async function loadRecentLogins() {
  const loginTableBody = document.querySelector('.overview .table-scroll tbody');
  if (!loginTableBody) return;

  try {
    const { data: recentLogins } = await supabase
      .from('users')
      .select('nama, email, terakhir_login, aktif')
      .order('terakhir_login', { ascending: false, nullsFirst: false })
      .limit(5);

    if (recentLogins && recentLogins.length > 0) {
      loginTableBody.innerHTML = recentLogins
        .map((u, i) => {
          const waktu = u.terakhir_login
            ? new Date(u.terakhir_login).toLocaleString('id-ID', {
                day: '2-digit',
                month: 'short',
                year: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })
            : 'Belum pernah login';

          const dotColor = u.aktif ? '#70d74d' : '#f87171';

          return `
            <tr>
              <td>${i + 1}</td>
              <td>${escapeHtml(u.nama)}</td>
              <td>${escapeHtml(u.email || '-')}</td>
              <td>${waktu}</td>
              <td><i class="fa-solid fa-circle" style="color: ${dotColor}; font-size: 9px;" title="${u.aktif ? 'Aktif' : 'Non-Aktif'}"></i></td>
            </tr>
          `;
        })
        .join('');
    }
  } catch (err) {
    console.warn('[Admin Recent Logins]', err.message);
  }
}

// FR-09: Prioritas Monitoring Akun (Status Tidak Aktif WAJIB Ditampilkan di Atas)
async function loadUserManagementTable() {
  const userTableBody = document.querySelector('#manajemen-user tbody');
  if (!userTableBody) return;

  userTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Memuat data pengguna...</td></tr>';

  try {
    // Sesuai PRD FR-09: ORDER BY aktif ASC (akun tidak aktif tampil paling atas)
    const { data: users, error } = await supabase
      .from('users')
      .select('*')
      .order('aktif', { ascending: true }) // false (0) muncul sebelum true (1)
      .order('dibuat_pada', { ascending: false });

    if (error) throw error;

    adminState.allUsers = users || [];
    renderUserRows(adminState.allUsers);
  } catch (err) {
    console.error('[Admin Users]', err);
    userTableBody.innerHTML = `<tr><td colspan="8" style="text-align: center; color: red;">Gagal memuat pengguna: ${err.message}</td></tr>`;
  }
}

function renderUserRows(users) {
  const userTableBody = document.querySelector('#manajemen-user tbody');
  if (!userTableBody) return;

  if (users.length === 0) {
    userTableBody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 20px;">Belum ada data pengguna terdaftar.</td></tr>';
    return;
  }

  userTableBody.innerHTML = users
    .map((u) => {
      const isAktif = Boolean(u.aktif);
      const statusBadge = isAktif
        ? '<span class="badge active">Aktif</span>'
        : '<span class="badge inactive" style="background: #fee2e2; color: #991b1b; border: 1px solid #f87171;">Tidak Aktif</span>';

      const lastLogin = u.terakhir_login
        ? new Date(u.terakhir_login).toLocaleString('id-ID', {
            day: '2-digit',
            month: 'short',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
          })
        : '-';

      const suspendText = isAktif ? 'Suspend' : 'Aktifkan';
      const suspendClass = isAktif ? 'color: #ea580c;' : 'color: #16a34a; font-weight: bold;';

      return `
        <tr data-user-id="${u.id}">
          <td><input type="checkbox" aria-label="Pilih ${escapeHtml(u.nama)}"></td>
          <td><strong>${escapeHtml(u.nama)}</strong></td>
          <td>${escapeHtml(u.email || '-')}</td>
          <td>${escapeHtml(u.npm || '-')}</td>
          <td>
            <select class="role-select" data-user-id="${u.id}" style="padding: 3px 6px; border-radius: 4px; border: 1px solid #cbd5e1; font-size: 12px; font-weight: 500; cursor: pointer; background: white;">
              <option value="mahasiswa" ${u.role === 'mahasiswa' ? 'selected' : ''}>Mahasiswa</option>
              <option value="dosen" ${u.role === 'dosen' ? 'selected' : ''}>Dosen</option>
              <option value="admin" ${u.role === 'admin' ? 'selected' : ''}>Admin</option>
            </select>
          </td>
          <td>${statusBadge}</td>
          <td><small>${lastLogin}</small></td>
          <td>
            <button type="button" class="icon-btn btn-toggle-suspend" style="${suspendClass}" title="${suspendText} Akun">
              ${suspendText}
            </button>
            <button type="button" class="icon-btn btn-delete-user" style="color: #dc2626;" title="Hapus Akun">
              <i class="fa-solid fa-trash-can"></i>
            </button>
          </td>
        </tr>
      `;
    })
    .join('');

  
  // Event handler untuk ubah role pengguna (FR-08: set_user_role)
  userTableBody.querySelectorAll('.role-select').forEach((select) => {
    select.addEventListener('change', async () => {
      const userId = select.getAttribute('data-user-id');
      const newRole = select.value;
      const user = adminState.allUsers.find((u) => u.id === userId);
      if (!user) return;

      if (confirm(`Ubah hak akses pengguna "${user.nama}" menjadi role "${newRole}"?`)) {
        try {
          await usersService.setRole(userId, newRole);
          user.role = newRole;
          alert(`Role "${user.nama}" berhasil diubah menjadi "${newRole}".`);
        } catch (err) {
          alert('Gagal mengubah role: ' + err.message);
          select.value = user.role || 'mahasiswa';
        }
      } else {
        select.value = user.role || 'mahasiswa';
      }
    });
  });

  // Event handler untuk tombol Suspend/Aktifkan
  userTableBody.querySelectorAll('.btn-toggle-suspend').forEach((btn) => {
    btn.addEventListener('click', async (e) => {
      const row = btn.closest('tr');
      const userId = row.getAttribute('data-user-id');
      const user = adminState.allUsers.find((u) => u.id === userId);
      if (!user) return;

      const newStatus = !user.aktif;
      const aksiText = newStatus ? 'mengaktifkan kembali' : 'menonaktifkan (suspend)';

      if (confirm(`Apakah Anda yakin ingin ${aksiText} akun "${user.nama}"?`)) {
        btn.textContent = 'Memproses...';
        btn.disabled = true;
        try {
          await usersService.setAktif(userId, newStatus);
          user.aktif = newStatus;
          renderUserRows(adminState.allUsers);
        } catch (err) {
          alert('Gagal memperbarui status: ' + err.message);
          btn.textContent = user.aktif ? 'Suspend' : 'Aktifkan';
          btn.disabled = false;
        }
      }
    });
  });

  // Event handler untuk tombol Hapus User
  userTableBody.querySelectorAll('.btn-delete-user').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const row = btn.closest('tr');
      const userId = row.getAttribute('data-user-id');
      const user = adminState.allUsers.find((u) => u.id === userId);
      if (!user) return;

      if (confirm(`PERINGATAN: Hapus permanen akun pengguna "${user.nama}" (${user.email})?`)) {
        try {
          await usersService.remove(userId);
          adminState.allUsers = adminState.allUsers.filter((u) => u.id !== userId);
          renderUserRows(adminState.allUsers);
        } catch (err) {
          alert('Gagal menghapus akun: ' + err.message);
        }
      }
    });
  });
}

function initUserSearch() {
  const searchInput = document.querySelector('.user-search input');
  if (!searchInput) return;

  searchInput.addEventListener('input', () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      renderUserRows(adminState.allUsers);
      return;
    }
    const filtered = adminState.allUsers.filter(
      (u) =>
        (u.nama && u.nama.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.npm && u.npm.toLowerCase().includes(q))
    );
    renderUserRows(filtered);
  });
}

// =========================================================================
// 3. UPLOAD MATERI KULIAH (FR-07: admin-materi.html)
// =========================================================================
async function initAdminMateriUpload() {
  const form = document.querySelector('form.material-grid');
  if (!form) return;

  const matkulInput = form.querySelector('input[name="mata_kuliah"]');
  const semesterSelect = form.querySelector('select[name="semester"]');
  const judulInput = form.querySelector('input[name="judul_materi"]');
  const tahunInput = form.querySelector('input[name="tahun_ajaran"]');
  const fileInput = document.getElementById('file-materi');
  const submitBtn = form.querySelector('.submit-row button.btn');

  // Preview nama file yang dipilih
  if (fileInput) {
    fileInput.addEventListener('change', () => {
      const caption = document.querySelector('.file-caption small');
      if (caption && fileInput.files[0]) {
        caption.textContent = `File dipilih: ${fileInput.files[0].name} (${(fileInput.files[0].size / (1024 * 1024)).toFixed(2)} MB)`;
        caption.style.color = '#15803d';
        caption.style.fontWeight = 'bold';
      }
    });
  }

  // Submit Handler Upload Materi
  if (submitBtn) {
    submitBtn.addEventListener('click', async (e) => {
      e.preventDefault();

      const namaMatkul = matkulInput?.value?.trim() || '';
      const semesterVal = semesterSelect?.value || '1';
      const judul = judulInput?.value?.trim() || '';
      const tahun = tahunInput?.value?.trim() || '2024/2025';
      const file = fileInput?.files?.[0];

      if (!namaMatkul || !judul) {
        alert('Mohon isi nama mata kuliah dan judul materi.');
        return;
      }

      if (!file) {
        alert('Mohon pilih file materi (PDF/PPT/DOCX) terlebih dahulu.');
        return;
      }

      const originalText = submitBtn.innerHTML;
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Mengunggah berkas...';

      try {
        // 1. Cari atau buat baris matkul jika belum ada di tabel 'matkul'
        let matkulId = null;
        const kodeMatkul = namaMatkul.slice(0, 3).toUpperCase() + semesterVal;

        const { data: existingMatkul } = await supabase
          .from('matkul')
          .select('id')
          .ilike('nama', namaMatkul)
          .maybeSingle();

        if (existingMatkul) {
          matkulId = existingMatkul.id;
        } else {
          const { data: newMatkul, error: mkError } = await supabase
            .from('matkul')
            .insert({
              kode: kodeMatkul,
              nama: namaMatkul,
              semester: parseInt(semesterVal, 10),
              deskripsi: `Mata kuliah ${namaMatkul} semester ${semesterVal}`,
            })
            .select()
            .single();

          if (mkError) throw mkError;
          matkulId = newMatkul.id;
        }

        // 2. Upload materi ke Storage dan simpan metadata (FR-07)
        await alurUpload.uploadMateri(file, {
          matkul_id: matkulId,
          judul,
          tahun_akademik: tahun,
          deskripsi: `Materi perkuliahan ${namaMatkul}`,
        });

        alert(`Materi "${judul}" berhasil diunggah dan disimpan ke repositori.`);
        window.location.href = 'admin-dashboard.html';
      } catch (err) {
        console.error('[Upload Materi Error]', err);
        alert('Gagal mengunggah materi: ' + err.message);
      } finally {
        submitBtn.disabled = false;
        submitBtn.innerHTML = originalText;
      }
    });
  }
}



// =========================================================================
// 4. SEMUA MATERI ADMIN (FR-07: admin-semua-materi.html)
// =========================================================================
async function initAdminSemuaMateri() {
  const grid = document.querySelector('.matkul-grid');
  const countEl = document.querySelector('.materi-count');
  const searchInput = document.querySelector('.materi-search input');
  const filterSelect = document.querySelector('.materi-filter select');

  if (!grid) return;

  grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; margin-bottom: 12px; color: #788744;"></i><p>Memuat daftar mata kuliah...</p></div>';

  try {
    // 1. Ambil seluruh mata kuliah
    const matkulList = await matkulService.getAll();
    adminState.allMatkul = matkulList || [];

    // 2. Ambil seluruh materi untuk menghitung jumlah per matkul
    const { data: allMateri } = await supabase.from('materi').select('id, matkul_id');
    const materiCountMap = {};
    (allMateri || []).forEach((m) => {
      materiCountMap[m.matkul_id] = (materiCountMap[m.matkul_id] || 0) + 1;
    });

    if (countEl) {
      countEl.textContent = `${adminState.allMatkul.length} Mata Kuliah`;
    }

    const renderMatkulCards = (courses) => {
      if (courses.length === 0) {
        grid.innerHTML = '<div style="grid-column: 1/-1; text-align: center; padding: 40px; color: #64748b;"><i class="fa-solid fa-book-open" style="font-size: 32px; margin-bottom: 10px;"></i><p>Tidak ada mata kuliah yang cocok dengan pencarian.</p></div>';
        return;
      }

      grid.innerHTML = courses
        .map((m) => {
          const count = materiCountMap[m.id] || 0;
          return `
            <article class="matkul-card" data-semester="${m.semester || 1}" data-matkul-id="${m.id}">
              <div class="matkul-top">
                <span class="matkul-icon">
                  <i class="fa-solid fa-book-bookmark"></i>
                </span>
                <span class="semester-badge">Semester ${m.semester || 1}</span>
              </div>
              <div class="matkul-content">
                <h3>${escapeHtml(m.nama)}</h3>
                <p>${escapeHtml(m.deskripsi || 'Materi perkuliahan ' + m.nama)}</p>
              </div>
              <div class="matkul-bottom">
                <span class="jumlah-materi">
                  <i class="fa-regular fa-file-lines"></i>
                  ${count} Materi
                </span>
                <a href="admin-detail-matkul.html?matkul_id=${m.id}" class="lihat-materi">
                  Lihat Materi <i class="fa-solid fa-arrow-right"></i>
                </a>
              </div>
            </article>
          `;
        })
        .join('');
    };

    renderMatkulCards(adminState.allMatkul);

    // Filter & Search handler
    const handleFilter = () => {
      const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const sem = filterSelect ? filterSelect.value : 'semua';

      const filtered = adminState.allMatkul.filter((m) => {
        const matchesQuery = !q || (m.nama && m.nama.toLowerCase().includes(q)) || (m.kode && m.kode.toLowerCase().includes(q));
        const matchesSem = sem === 'semua' || String(m.semester) === String(sem);
        return matchesQuery && matchesSem;
      });

      renderMatkulCards(filtered);
    };

    if (searchInput) searchInput.addEventListener('input', handleFilter);
    if (filterSelect) filterSelect.addEventListener('change', handleFilter);

  } catch (err) {
    console.error('[Admin Semua Materi]', err);
    grid.innerHTML = `<div style="grid-column: 1/-1; text-align: center; color: red; padding: 20px;">Gagal memuat mata kuliah: ${err.message}</div>`;
  }
}

// =========================================================================
// 5. DETAIL MATKUL & MANAJEMEN BERKAS (FR-07: admin-detail-matkul.html)
// =========================================================================
async function initAdminDetailMatkul() {
  const urlParams = new URLSearchParams(window.location.search);
  const matkulId = urlParams.get('matkul_id');

  const titleEl = document.querySelector('.detail-header-info h1');
  const subEl = document.querySelector('.detail-header-info p');
  const countEl = document.querySelector('.detail-count');
  const listContainer = document.querySelector('.material-list');
  const searchInput = document.querySelector('.detail-search input');
  const sortSelect = document.querySelector('.detail-sort select');

  if (!listContainer) return;

  if (!matkulId) {
    listContainer.innerHTML = '<div style="text-align: center; padding: 30px; color: #dc2626;"><p>Mata kuliah tidak ditemukan. Silakan pilih dari halaman Semua Materi.</p><a href="admin-semua-materi.html" class="btn" style="margin-top: 10px; display: inline-block;">Kembali</a></div>';
    return;
  }

  listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;"><i class="fa-solid fa-spinner fa-spin" style="font-size: 28px; margin-bottom: 12px; color: #788744;"></i><p>Memuat materi perkuliahan...</p></div>';

  try {
    // 1. Ambil data matkul
    const matkul = await matkulService.getById(matkulId);
    if (matkul) {
      if (titleEl) titleEl.textContent = matkul.nama;
    }

    // 2. Ambil materi untuk matkul ini
    let materiList = await materiService.getByMatkul(matkulId);
    materiList = materiList || [];

    const updateCounts = (total) => {
      if (subEl && matkul) {
        subEl.innerHTML = `Semester ${matkul.semester || 1} <span>•</span> ${total} Materi`;
      }
      if (countEl) {
        countEl.textContent = `${total} Materi`;
      }
    };

    updateCounts(materiList.length);

    const renderItems = (items) => {
      if (items.length === 0) {
        listContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: #64748b;"><i class="fa-regular fa-file-lines" style="font-size: 32px; margin-bottom: 10px;"></i><p>Belum ada berkas materi untuk mata kuliah ini.</p><a href="admin-materi.html" class="btn" style="margin-top: 12px; display: inline-block; font-size: 13px;"><i class="fa-solid fa-plus"></i> Unggah Materi Pertama</a></div>';
        return;
      }

      listContainer.innerHTML = items
        .map((m) => {
          const d = m.dibuat_pada ? new Date(m.dibuat_pada) : new Date();
          const dateStr = d.toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' });

          return `
            <article class="material-item" data-materi-id="${m.id}">
              <div class="material-icon pdf">
                <i class="fa-solid fa-file-pdf"></i>
              </div>
              <div class="material-info">
                <h3>${escapeHtml(m.judul)}</h3>
                <p>${escapeHtml(m.tahun_akademik || 'Tahun Ajaran')} <span>•</span> ${m.jumlah_dilihat || 0}x dilihat</p>
              </div>
              <time datetime="${m.dibuat_pada || ''}">${dateStr}</time>
              <div style="display: flex; gap: 8px; align-items: center; margin-left: auto;">
                <a href="reader.html?materi_id=${m.id}&title=${encodeURIComponent(m.judul)}" class="btn-read-admin" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #e0e7ff; color: #4338ca; border-radius: 6px; text-decoration: none; font-size: 13px; font-weight: 600;" title="Buka Pembaca Terproteksi">
                  <i class="fa-regular fa-eye"></i> Baca
                </a>
                <button type="button" class="btn-delete-admin-materi" data-materi-id="${m.id}" data-file-path="${escapeHtml(m.file_path || '')}" data-title="${escapeHtml(m.judul)}" style="display: inline-flex; align-items: center; gap: 6px; padding: 6px 12px; background: #fee2e2; color: #dc2626; border: 1px solid #f87171; border-radius: 6px; cursor: pointer; font-size: 13px; font-weight: 600;" title="Hapus Berkas & Data Materi">
                  <i class="fa-solid fa-trash-can"></i> Hapus
                </button>
              </div>
            </article>
          `;
        })
        .join('');

      // Handler Tombol Hapus Materi (FR-07: Cascade Storage + Database)
      listContainer.querySelectorAll('.btn-delete-admin-materi').forEach((btn) => {
        btn.addEventListener('click', async () => {
          const id = btn.getAttribute('data-materi-id');
          const filePath = btn.getAttribute('data-file-path');
          const title = btn.getAttribute('data-title');

          if (confirm(`PERINGATAN: Hapus materi "${title}"?\nBerkas di private storage dan baris database akan dihapus permanen.`)) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Menghapus...';

            try {
              // 1. Hapus berkas dari Supabase Storage jika ada
              if (filePath) {
                await supabase.storage.from('materi').remove([filePath]);
              }
              // 2. Hapus baris dari tabel materi
              await materiService.remove(id);

              alert(`Materi "${title}" berhasil dihapus.`);
              materiList = materiList.filter((x) => String(x.id) !== String(id));
              updateCounts(materiList.length);
              renderItems(materiList);
            } catch (err) {
              alert('Gagal menghapus materi: ' + err.message);
              btn.disabled = false;
              btn.innerHTML = '<i class="fa-solid fa-trash-can"></i> Hapus';
            }
          }
        });
      });
    };

    renderItems(materiList);

    // Live search & sort handler
    const applySearchAndSort = () => {
      const q = searchInput ? searchInput.value.trim().toLowerCase() : '';
      const sort = sortSelect ? sortSelect.value : 'terbaru';

      let filtered = materiList.filter((m) => !q || (m.judul && m.judul.toLowerCase().includes(q)));

      if (sort === 'terbaru') {
        filtered.sort((a, b) => new Date(b.dibuat_pada || 0) - new Date(a.dibuat_pada || 0));
      } else if (sort === 'terlama') {
        filtered.sort((a, b) => new Date(a.dibuat_pada || 0) - new Date(b.dibuat_pada || 0));
      } else if (sort === 'az') {
        filtered.sort((a, b) => (a.judul || '').localeCompare(b.judul || ''));
      }

      renderItems(filtered);
    };

    if (searchInput) searchInput.addEventListener('input', applySearchAndSort);
    if (sortSelect) sortSelect.addEventListener('change', applySearchAndSort);

  } catch (err) {
    console.error('[Admin Detail Matkul]', err);
    listContainer.innerHTML = `<div style="text-align: center; color: red; padding: 20px;">Gagal memuat materi: ${err.message}</div>`;
  }
}

// =========================================================================
// 6. MODAL PROFIL & BANTUAN ADMIN (Interaktif Avatar & Menu Footer)
// =========================================================================
function initAdminModals() {
  const avatar = document.querySelector('.page-header .avatar');
  const profileLink = document.querySelector('.side-footer a:has(.fa-user)');

  const showProfileModal = () => {
    const nama = adminState.adminProfile?.nama || 'Administrator';
    const email = adminState.adminUser?.email || '-';
    const npm = adminState.adminProfile?.npm || 'Staf Kampus';
    const role = adminState.adminProfile?.role || 'admin';

    let modal = document.getElementById('admin-profile-modal');
    if (!modal) {
      modal = document.createElement('div');
      modal.id = 'admin-profile-modal';
      modal.style.cssText = 'position: fixed; inset: 0; background: rgba(0,0,0,0.5); backdrop-filter: blur(4px); display: flex; align-items: center; justify-content: center; z-index: 9999; animation: fadeInScale 0.2s ease;';
      document.body.appendChild(modal);
    }

    modal.innerHTML = `
      <div style="background: white; border-radius: 16px; padding: 28px; width: 90%; max-width: 420px; box-shadow: 0 20px 40px rgba(0,0,0,0.2); font-family: 'Poppins', sans-serif; position: relative;">
        <button type="button" id="close-admin-profile" style="position: absolute; top: 16px; right: 16px; background: none; border: none; font-size: 20px; cursor: pointer; color: #64748b;">&times;</button>
        <div style="text-align: center; margin-bottom: 20px;">
          <div style="width: 70px; height: 70px; border-radius: 50%; background: #e0e7ff; color: #4338ca; font-size: 32px; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 12px; font-weight: bold;">
            👩🏻
          </div>
          <h2 style="margin: 0; font-size: 18px; color: #1e293b;">${escapeHtml(nama)}</h2>
          <span style="display: inline-block; padding: 3px 10px; background: #fef3c7; color: #92400e; border-radius: 12px; font-size: 12px; font-weight: 600; text-transform: uppercase; margin-top: 6px;">
            ${escapeHtml(role)}
          </span>
        </div>
        <div style="background: #f8fafc; border-radius: 10px; padding: 14px; margin-bottom: 20px; font-size: 13px;">
          <div style="margin-bottom: 8px;"><strong>Email:</strong> ${escapeHtml(email)}</div>
          <div><strong>Identitas:</strong> ${escapeHtml(npm)}</div>
        </div>
        <div style="display: flex; gap: 10px;">
          <button type="button" id="admin-modal-logout" style="flex: 1; padding: 10px; background: #dc2626; color: white; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            <i class="fa-solid fa-right-from-bracket"></i> Keluar
          </button>
          <button type="button" id="admin-modal-close-btn" style="flex: 1; padding: 10px; background: #e2e8f0; color: #334155; border: none; border-radius: 8px; font-weight: 600; cursor: pointer;">
            Tutup
          </button>
        </div>
      </div>
    `;

    modal.style.display = 'flex';

    const closeModal = () => { modal.style.display = 'none'; };
    modal.querySelector('#close-admin-profile').addEventListener('click', closeModal);
    modal.querySelector('#admin-modal-close-btn').addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    modal.querySelector('#admin-modal-logout').addEventListener('click', async () => {
      if (confirm('Keluar dari sesi Administrator?')) {
        await signOut();
        window.location.href = 'login.html';
      }
    });
  };

  if (avatar) {
    avatar.style.cursor = 'pointer';
    avatar.setAttribute('title', 'Lihat Akun Admin');
    avatar.addEventListener('click', showProfileModal);
  }

  if (profileLink) {
    profileLink.addEventListener('click', (e) => {
      e.preventDefault();
      showProfileModal();
    });
  }
}
