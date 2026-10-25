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

  // 3. Deteksi Halaman Admin yang Sedang Aktif
  const path = window.location.pathname.toLowerCase();

  if (path.includes('admin-dashboard')) {
    initAdminDashboard();
  }

  if (path.includes('admin-materi')) {
    initAdminMateriUpload();
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

  userTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Memuat data pengguna...</td></tr>';

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
    userTableBody.innerHTML = `<tr><td colspan="7" style="text-align: center; color: red;">Gagal memuat pengguna: ${err.message}</td></tr>`;
  }
}

function renderUserRows(users) {
  const userTableBody = document.querySelector('#manajemen-user tbody');
  if (!userTableBody) return;

  if (users.length === 0) {
    userTableBody.innerHTML = '<tr><td colspan="7" style="text-align: center; padding: 20px;">Belum ada data pengguna terdaftar.</td></tr>';
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
