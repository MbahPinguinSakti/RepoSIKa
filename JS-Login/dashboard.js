
import { supabase } from "./utils.js";

async function tampilkanNamaPengguna() {
  const { data: { user }, error } =
    await supabase.auth.getUser();

  if (error) {
    console.error("Gagal mengambil pengguna:", error.message);
    return;
  }

  if (!user) {
    window.location.href = "./login.html";
    return;
  }

  const nama =
    user.user_metadata?.nama ||
    user.user_metadata?.full_name ||
    user.email?.split("@")[0] ||
    "Pengguna";

  const elemenNama = document.getElementById("welcome-name");

  if (elemenNama) {
    elemenNama.textContent = nama;
  } else {
    console.error('Elemen dengan id "welcome-name" tidak ditemukan.');
  }
}

tampilkanNamaPengguna();

// ==========================================
// 2. LOGIKA PENCARIAN (KHUSUS ALL MATERI DOANG)
// ==========================================
const searchInput = document.getElementById('dashboard-material-search');

if (searchInput) {
  searchInput.addEventListener('input', (e) => {
    const keyword = e.target.value.toLowerCase().trim();

    // Saring data array-nya aja (ini cuma ngaruh ke bagian All Materi)
    const filteredData = dataMateri.filter(item => {
      return item.judul.toLowerCase().includes(keyword);
    });

    // Cetak ulang kartu di bagian "All Materi" sesuai hasil saringan
    renderSemuaMateri(filteredData);

    // Bagian Continue Learning dibiarin aja, nggak usah disentuh-sentuh
  });
}

// 3. Logika Memilih Tahun Ajaran
// Tangkap semua tombol link yang ada di dalam pop-up tahun ajaran
const yearChoices = document.querySelectorAll('.year-choices a');

yearChoices.forEach(choice => {
  choice.addEventListener('click', (e) => {
    // Tahan bentar, jangan langsung pindah halaman!
    e.preventDefault();

    // Ambil teks tahun yang diklik (misal: "2024/2025")
    const selectedYear = choice.textContent.trim();

    // Titipin catetannya ke localStorage
    localStorage.setItem('tahun_ajaran', selectedYear);

    // Ambil alamat tujuan dari atribut href di HTML (yaitu "detail-matkul.html")
    const targetPage = choice.getAttribute('href');

    // Sekarang baru gas pindah halaman!
    window.location.href = targetPage;
  });
});

// --- DATA DUMMY YANG UDAH DI-UPGRADE BUAT FILTER ---
const dataMateri = [
  {
    judul: "Konsep Sistem Informasi",
    label: "KONSEP<br>SISTEM<br>INFORMASI",
    icon: "fa-laptop-code",
    coverClass: "",
    status: "Not started",
    btnText: "Start",
    // Tambahan buat dicocokin sama value checkbox HTML:
    semester: "1",
    format: "dokumen",
    statusFilter: "belum_mulai"
  },
  {
    judul: "Algoritma dan Dasar Pemrograman",
    label: "ALGORITMA<br>DAN DASAR<br>PEMROGRAMAN",
    icon: "fa-code",
    coverClass: "",
    status: "Progress: 80%",
    btnText: "Continue",
    semester: "1",
    format: "video",
    statusFilter: "sedang_dipelajari"
  },
  {
    judul: "Matematika Diskrit",
    label: "MATEMATIKA<br>DISKRIT",
    icon: "fa-calculator",
    coverClass: "cover-green",
    status: "Progress: 50%",
    btnText: "Continue",
    semester: "3",
    format: "slide",
    statusFilter: "sedang_dipelajari"
  },
  {
    judul: "Bahasa Indonesia",
    label: "DI KELAS<br>MATA KULIAH DASAR<br>UMUM (MKDU)",
    icon: "fa-graduation-cap",
    coverClass: "cover-orange",
    status: "Progress: 40%",
    btnText: "Continue",
    semester: "1",
    format: "dokumen",
    statusFilter: "sedang_dipelajari"
  }
];


// --- FUNGSI BUAT NYETAK KARTU KE HTML ---
const overviewGrid = document.querySelector('.overview-grid');

function renderSemuaMateri(data) {
  // Pastikan grid-nya beneran ada biar nggak error
  if (!overviewGrid) return;

  // --- TAMBAHAN BARU 1: Tangkap elemen angka pill-nya ---
  const countPill = document.querySelector('.count-pill');

  // Kosongin dulu wadahnya
  overviewGrid.innerHTML = '';

  // --- TAMBAHAN BARU 2: Update angka sesuai jumlah data ---
  if (countPill) {
    countPill.textContent = data.length;
  }

  // Looping (Ulangi) cetak kartu sebanyak isi dataMateri
  data.forEach(item => {
    // Kita pakai template literal (backtick ` `) buat nulis HTML di dalam JS
    const cardHTML = `
      <article class="overview-card card">
        <div class="course-cover ${item.coverClass}">
          <div class="cover-illustration">
            <i class="fa-solid ${item.icon}" aria-hidden="true"></i>
          </div>
          <span class="cover-label">${item.label}</span>
        </div>
        
        <span class="material-type">
          <i class="fa-solid fa-book"></i> Materi
        </span>
        
        <h3>${item.judul}</h3>
        
        <div class="overview-footer">
          <span>${item.status}</span>
          <a class="btn" href="#tahun-ajaran">${item.btnText}</a>
        </div>
      </article>
    `;

    // Suntikin HTML-nya ke dalam grid
    overviewGrid.innerHTML += cardHTML;
  });
}

// Jalanin fungsinya biar kartunya langsung muncul pas halaman dibuka
renderSemuaMateri(dataMateri);

// ==========================================
// 4. LOGIKA FITUR FILTER (SEMESTER, FORMAT, STATUS)
// ==========================================
const filterForm = document.getElementById('dashboard-filter-form');

if (filterForm) {
  // Pakai event 'change' biar filternya langsung bereaksi (real-time) tiap kali lu nyentang
  filterForm.addEventListener('change', jalankanFilter);

  // Kalau tombol reset diklik, balikin semua ke awal
  filterForm.addEventListener('reset', () => {
    setTimeout(() => {
      jalankanFilter(); // Dikasih jeda dikit biar form-nya beneran kosong dulu
    }, 50);
  });
}

function jalankanFilter() {
  // 1. Ambil data apa aja yang lagi dicentang
  const checkedSemesters = Array.from(document.querySelectorAll('input[name="semester[]"]:checked')).map(cb => cb.value);
  const checkedFormats = Array.from(document.querySelectorAll('input[name="format[]"]:checked')).map(cb => cb.value);
  const checkedStatuses = Array.from(document.querySelectorAll('input[name="status[]"]:checked')).map(cb => cb.value);

  // --- LOGIKA BARU: Update 3 Label Hijau ---
  const filterTags = document.querySelectorAll('.filter-tag');

  if (filterTags.length >= 3) {
    // Label 1: Semester (Index 0)
    if (checkedSemesters.length === 0) {
      filterTags[0].textContent = "All semester";
    } else {
      filterTags[0].textContent = "Smstr: " + checkedSemesters.join(', ');
    }

    // Label 2: Format (Index 1)
    if (checkedFormats.length === 0) {
      filterTags[1].textContent = "All format";
    } else {
      filterTags[1].textContent = "Format: " + checkedFormats.join(', ');
    }

    // Label 3: Status (Index 2)
    if (checkedStatuses.length === 0) {
      filterTags[2].textContent = "All status";
    } else {
      filterTags[2].textContent = "Status: " + checkedStatuses.join(', ').replace(/_/g, ' ');
    }
  }
  // ------------------------------------------

  // 2. Saring datanya sesuai centangan
  const filteredData = dataMateri.filter(item => {
    const lolosSemester = checkedSemesters.length === 0 || checkedSemesters.includes(item.semester);
    const lolosFormat = checkedFormats.length === 0 || checkedFormats.includes(item.format);
    const lolosStatus = checkedStatuses.length === 0 || checkedStatuses.includes(item.statusFilter);

    return lolosSemester && lolosFormat && lolosStatus;
  });

  // 3. Cetak ulang kartunya
  renderSemuaMateri(filteredData);
}

// ==========================================
// 5. LOGIKA FITUR SORT (URUTKAN MATERI)
// ==========================================
const sortRadios = document.querySelectorAll('input[name="dashboard-sort"]');

sortRadios.forEach(radio => {
  radio.addEventListener('change', (e) => {
    const sortValue = e.target.value;

    // Fotokopi datanya dulu biar array aslinya nggak berantakan
    let sortedData = [...dataMateri];

    if (sortValue === 'nama-az') {
      // Urutkan berdasarkan judul A sampai Z
      sortedData.sort((a, b) => {
        // localeCompare itu fungsi sakti JS buat ngecek abjad
        return a.judul.localeCompare(b.judul);
      });
    }
    else if (sortValue === 'terlama') {
      // Simulasi aja: dibalik urutannya dari belakang ke depan
      sortedData.reverse();
    }
    // Kalau 'terbaru', dia bakal pakai data awal bawaan karena kita belum punya data 'tanggal_upload'

    // Suruh koki JS cetak ulang pakai data yang udah baris rapi!
    renderSemuaMateri(sortedData);
  });
});