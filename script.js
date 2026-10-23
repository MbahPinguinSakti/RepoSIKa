// Konfigurasi kredensial koneksi Supabase
const supabaseUrl = 'https://xxxxxx.supabase.co';
const supabaseKey = 'eyJhbGciOiJIUzI1NiIsIn...';
const supabaseClient = window.supabase.createClient(supabaseUrl, supabaseKey);


// ==========================================
// KODE KHUSUS HALAMAN LOGIN (index.html)
// ==========================================
const emailInput = document.getElementById('input-email');
const passwordInput = document.getElementById('input-password');
const formLogin = document.getElementById('form-login');
const googleButton = document.getElementById('google-login-btn');

// Pengamanan: Cek apakah form login ADA di halaman yang sedang dibuka
if (formLogin) {
    formLogin.addEventListener('submit', async function (event) {
        event.preventDefault();

        const emailUser = emailInput.value;
        const passwordUser = passwordInput.value;

        if (emailUser === "" || passwordUser === "") {
            alert("Mohon maaf, kolom email dan password wajib diisi.");
        } else {
            const hasil = await supabaseClient.auth.signInWithPassword({
                email: emailUser,
                password: passwordUser
            });

            if (hasil.error) {
                alert("Proses masuk gagal: " + hasil.error.message);
            } else {
                alert("Proses masuk berhasil.");
                window.location.href = 'dashboard.html';
            }
        }
    });
}

// Pengamanan: Cek apakah tombol Google ADA di halaman yang sedang dibuka
if (googleButton) {
    googleButton.addEventListener('click', async function () {
        const { data, error } = await supabaseClient.auth.signInWithOAuth({
            provider: 'google',
            options: {
                queryParams: {
                    hd: 'student.unsika.ac.id'
                }
            }
        });

        if (error) {
            alert("Terjadi kendala saat menghubungkan ke Google: " + error.message);
        }
    });
}


// ==========================================
// KODE KHUSUS HALAMAN LUPA PASSWORD (forgot-password.html)
// ==========================================
const btnCari = document.getElementById('btn-cari');
const inputEmailReset = document.getElementById('input-email-reset');

// Pengamanan: Cek apakah tombol Cari ADA di halaman yang sedang dibuka
if (btnCari) {
    btnCari.addEventListener('click', async function () {
        const emailUser = inputEmailReset.value.trim();

        if (emailUser === "") {
            alert("Mohon maaf, alamat email tidak boleh kosong. Silakan isi terlebih dahulu.");
            return;
        }

        if (!emailUser.includes('@')) {
            alert("Format email tidak valid. Pastikan Anda menggunakan karakter '@' pada alamat email.");
            return;
        }

        alert("Mohon tunggu sebentar, sistem sedang memproses permintaan Anda...");

        const { data, error } = await supabaseClient.auth.resetPasswordForEmail(emailUser);

        if (error) {
            alert("Terjadi kendala pada sistem peladen: " + error.message);
        } else {
            alert("Instruksi pemulihan kata sandi telah berhasil dikirim. Silakan periksa kotak masuk pada surel " + emailUser);
            inputEmailReset.value = "";
        }
    });
}

// ==========================================
// KODE PENGECEKAN TOKEN & GANTI PASSWORD BARU
// ==========================================
const formMintaEmail = document.getElementById('form-minta-email');
const formPasswordBaru = document.getElementById('form-password-baru');
const btnSimpanPassword = document.getElementById('btn-simpan-password');
const inputPassBaru = document.getElementById('input-pass-baru');
const inputPassKonfirmasi = document.getElementById('input-pass-konfirmasi');

// Cek apakah URL mengandung hash/token recovery dari Supabase
if (window.location.hash && window.location.hash.includes('type=recovery')) {
    // Kalau ada tokennya, sembunyikan form email, tampilkan form password baru
    if (formMintaEmail && formPasswordBaru) {
        formMintaEmail.style.display = 'none';
        formPasswordBaru.style.display = 'block';
    }
}

// Logika saat tombol "Simpan Kata Sandi Baru" diklik
if (btnSimpanPassword) {
    btnSimpanPassword.addEventListener('click', async function () {
        const passwordBaru = inputPassBaru.value;
        const passwordKonfirmasi = inputPassKonfirmasi.value;

        // Validasi input kosong atau kurang dari 6 karakter
        if (passwordBaru === "" || passwordKonfirmasi === "") {
            alert("Mohon maaf, kolom kata sandi tidak boleh kosong.");
            return;
        }

        if (passwordBaru.length < 6) {
            alert("Kata sandi terlalu pendek! Minimal harus 6 karakter.");
            return;
        }

        // Cek apakah password baru dan konfirmasinya sama
        if (passwordBaru !== passwordKonfirmasi) {
            alert("Konfirmasi kata sandi tidak cocok! Silakan periksa kembali.");
            return;
        }

        alert("Menyimpan kata sandi baru ke server...");

        // Kirim permintaan pembaruan password ke Supabase
        const { data, error } = await supabaseClient.auth.updateUser({
            password: passwordBaru
        });

        if (error) {
            alert("Gagal memperbarui kata sandi: " + error.message);
        } else {
            alert("Kata sandi berhasil diperbarui! Silakan login kembali dengan kata sandi baru.");
            // Lempar user kembali ke halaman login (index.html)
            window.location.href = 'index.html';
        }
    });
}