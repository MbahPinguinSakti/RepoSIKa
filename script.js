
// Konfigurasi kredensial koneksi Supabase
const supabaseUrl = 'wkwkwk';
const supabaseKey = 'wkwkwkk';
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
// KODE PENDAFTARAN AKUN BARU (SIGN UP)
// ==========================================
const formSignupElement = document.getElementById('form-signup');
const inputNamaLengkap = document.getElementById('input-nama');
const inputNpmSignup = document.getElementById('input-npm');
const inputEmailSignup = document.getElementById('input-email-signup');
const inputPasswordSignup = document.getElementById('input-password-signup');

if (formSignupElement) {
    formSignupElement.addEventListener('submit', async function (event) {
        event.preventDefault(); // Tahan biar nggak refresh

        const nama = inputNamaLengkap.value;
        const npm = inputNpmSignup.value;
        const email = inputEmailSignup.value;
        const password = inputPasswordSignup.value;

        // Validasi receh biar password nggak kekecilan
        if (password.length < 6) {
            alert("Kata sandi terlalu pendek! Minimal 6 karakter.");
            return;
        }

        alert("Sedang mendaftarkan akun lu ke server, tunggu bentar...");

        // Kirim data ke Supabase (Tiket Utama + Koper Metadata)
        const { data, error } = await supabaseClient.auth.signUp({
            email: email,
            password: password,
            options: {
                data: {
                    nama_lengkap: nama,
                    npm: npm
                }
            }
        });

        if (error) {
            alert("Gagal daftar nih: " + error.message);
        } else {
            alert("Pendaftaran sukses! Cek email kampus lu buat klik link konfirmasi (jika ada).");
            formSignupElement.reset(); // Bersihin kotak input form daftar
            linkKeLogin.click(); // Pindah otomatis ke form login
        }
    });
}


// ==========================================
// KODE KHUSUS HALAMAN LUPA PASSWORD
// ==========================================
const formMintaEmail = document.getElementById('form-minta-email');
const inputEmailReset = document.getElementById('input-email-reset');

if (formMintaEmail && inputEmailReset) {
    formMintaEmail.addEventListener('submit', async function (event) {
        event.preventDefault();

        const emailUser = inputEmailReset.value.trim();

        if (emailUser === '') {
            alert('Alamat email wajib diisi.');
            return;
        }

        try {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(
                emailUser,
                {
                    redirectTo: window.location.origin + window.location.pathname
                }
            );

            if (error) {
                alert('Gagal mengirim tautan pemulihan: ' + error.message);
                return;
            }

            alert('Jika email terdaftar, instruksi pemulihan akan dikirim ke ' + emailUser);
            inputEmailReset.value = '';
        } catch (error) {
            alert('Terjadi kesalahan: ' + error.message);
        }
    });
}


// ==========================================
// KODE GANTI PASSWORD BARU
// ==========================================
const formPasswordBaru = document.getElementById('form-password-baru');
const inputPassBaru = document.getElementById('input-pass-baru');
const inputPassKonfirmasi = document.getElementById('input-pass-konfirmasi');

let sesiRecoverySiap = false;

async function siapkanPemulihanPassword() {
    const hash = new URLSearchParams(window.location.hash.substring(1));
    const accessToken = hash.get('access_token');
    const refreshToken = hash.get('refresh_token');
    const jenisToken = hash.get('type');

    if (jenisToken !== 'recovery' || !accessToken || !refreshToken) {
        return;
    }

    const { error } = await supabaseClient.auth.setSession({
        access_token: accessToken,
        refresh_token: refreshToken
    });

    if (error) {
        alert('Tautan pemulihan tidak valid atau sudah kedaluwarsa.');
        return;
    }

    sesiRecoverySiap = true;

    if (formMintaEmail && formPasswordBaru) {
        formMintaEmail.style.display = 'none';
        formPasswordBaru.style.display = 'block';
    }

    // Hapus token dari URL setelah sesi berhasil dibuat.
    window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
}

if (formPasswordBaru && inputPassBaru && inputPassKonfirmasi) {
    formPasswordBaru.addEventListener('submit', async function (event) {
        event.preventDefault();

        if (!sesiRecoverySiap) {
            alert('Silakan buka tautan pemulihan dari email terlebih dahulu.');
            return;
        }

        const passwordBaru = inputPassBaru.value;
        const passwordKonfirmasi = inputPassKonfirmasi.value;

        if (passwordBaru.length < 6) {
            alert('Kata sandi minimal harus 6 karakter.');
            return;
        }

        if (passwordBaru !== passwordKonfirmasi) {
            alert('Konfirmasi kata sandi tidak cocok.');
            return;
        }

        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: passwordBaru
            });

            if (error) {
                alert('Gagal memperbarui kata sandi: ' + error.message);
                return;
            }

            alert('Kata sandi berhasil diperbarui. Silakan login kembali.');
            window.location.replace('index.html');
        } catch (error) {
            alert('Terjadi kesalahan: ' + error.message);
        }
    });
}

// Jalankan pengecekan token pemulihan
siapkanPemulihanPassword().catch(function (error) {
    console.error('Kesalahan pemulihan password:', error);
});