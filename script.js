
/* ==========================================
   KONFIGURASI SUPABASE
========================================== */

const supabaseUrl = 'https://gnolcaozgtfbswusdfey.supabase.co';
const supabaseKey = 'sb_publishable_yz2s8eb99UnlrNibA8kFWw_nocOfML2';

const supabaseClient = window.supabase.createClient(
    supabaseUrl,
    supabaseKey
);


/* ==========================================
   KODE LOGIN
   Digunakan oleh login.html
========================================== */

const emailInput = document.getElementById('input-email');
const passwordInput = document.getElementById('input-password');
const formLogin = document.getElementById('form-login');
const googleButton = document.getElementById('google-login-btn');

if (formLogin && emailInput && passwordInput) {
    formLogin.addEventListener('submit', async function (event) {
        event.preventDefault();

        const emailUser = emailInput.value.trim();
        const passwordUser = passwordInput.value;

        if (!emailUser || !passwordUser) {
            alert('Mohon isi email dan password.');
            return;
        }

        const tombolLogin = formLogin.querySelector(
            'button[type="submit"]'
        );

        if (tombolLogin) tombolLogin.disabled = true;

        try {
            const { error } = await supabaseClient.auth.signInWithPassword({
                email: emailUser,
                password: passwordUser
            });

            if (error) {
                alert('Proses login gagal: ' + error.message);
                return;
            }

            alert('Login berhasil.');
            window.location.href = 'dashboard.html';

        } catch (error) {
            console.error('Kesalahan login:', error);
            alert('Terjadi kesalahan saat login.');

        } finally {
            if (tombolLogin) tombolLogin.disabled = false;
        }
    });
}


/* ==========================================
   LOGIN GOOGLE OAUTH
========================================== */

if (googleButton) {
    googleButton.addEventListener('click', async function () {
        googleButton.disabled = true;

        try {
            const { error } = await supabaseClient.auth.signInWithOAuth({
                provider: 'google',
                options: {
                    queryParams: {
                        hd: 'student.unsika.ac.id'
                    },
                    redirectTo: window.location.origin + '/dashboard.html'
                }
            });

            if (error) {
                alert('Gagal menghubungkan ke Google: ' + error.message);
                googleButton.disabled = false;
            }

        } catch (error) {
            console.error('Kesalahan Google OAuth:', error);
            alert('Terjadi kendala saat menghubungkan ke Google.');
            googleButton.disabled = false;
        }
    });
}


/* ==========================================
   PENDAFTARAN AKUN BARU (SIGN UP)
========================================== */

const formSignupElement = document.getElementById('form-signup');
const inputNamaLengkap = document.getElementById('input-nama');
const inputNpmSignup = document.getElementById('input-npm');
const inputEmailSignup = document.getElementById('input-email-signup');
const inputPasswordSignup = document.getElementById('input-password-signup');

if (
    formSignupElement &&
    inputNamaLengkap &&
    inputNpmSignup &&
    inputEmailSignup &&
    inputPasswordSignup
) {
    formSignupElement.addEventListener('submit', async function (event) {
        event.preventDefault();

        const nama = inputNamaLengkap.value.trim();
        const npm = inputNpmSignup.value.trim();
        const email = inputEmailSignup.value.trim();
        const password = inputPasswordSignup.value;

        if (!nama || !npm || !email || !password) {
            alert('Semua kolom wajib diisi.');
            return;
        }

        if (password.length < 6) {
            alert('Password minimal 6 karakter.');
            return;
        }

        const tombolDaftar = formSignupElement.querySelector(
            'button[type="submit"]'
        );

        if (tombolDaftar) tombolDaftar.disabled = true;

        try {
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
                alert('Pendaftaran gagal: ' + error.message);
                return;
            }

            if (data.session) {
                alert('Pendaftaran berhasil. Silakan login.');
                window.location.href = 'login.html';
            } else {
                alert(
                    'Permintaan pendaftaran berhasil. ' +
                    'Periksa email untuk konfirmasi akun sebelum login.'
                );

                formSignupElement.reset();
            }

        } catch (error) {
            console.error('Kesalahan signup:', error);
            alert('Terjadi kesalahan saat mendaftar.');

        } finally {
            if (tombolDaftar) tombolDaftar.disabled = false;
        }
    });
}


/* ==========================================
   LUPA PASSWORD: KIRIM EMAIL PEMULIHAN
========================================== */

const formMintaEmail = document.getElementById('form-minta-email');
const inputEmailReset = document.getElementById('input-email-reset');

if (formMintaEmail && inputEmailReset) {
    formMintaEmail.addEventListener('submit', async function (event) {
        event.preventDefault();

        const emailUser = inputEmailReset.value.trim();

        if (!emailUser) {
            alert('Alamat email wajib diisi.');
            return;
        }

        try {
            const { error } = await supabaseClient.auth.resetPasswordForEmail(
                emailUser,
                {
                    redirectTo: window.location.origin +
                        window.location.pathname
                }
            );

            if (error) {
                alert('Gagal mengirim tautan pemulihan: ' + error.message);
                return;
            }

            alert(
                'Jika email terdaftar, instruksi pemulihan akan dikirim ke ' +
                emailUser
            );

            inputEmailReset.value = '';

        } catch (error) {
            console.error('Kesalahan reset password:', error);
            alert('Terjadi kesalahan saat meminta pemulihan password.');
        }
    });
}


/* ==========================================
   PEMULIHAN SESI DAN GANTI PASSWORD BARU
========================================== */

const formPasswordBaru = document.getElementById('form-password-baru');
const inputPassBaru = document.getElementById('input-pass-baru');
const inputPassKonfirmasi = document.getElementById('input-pass-konfirmasi');

let sesiRecoverySiap = false;

async function siapkanPemulihanPassword() {
    const hash = new URLSearchParams(
        window.location.hash.substring(1)
    );

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

    window.history.replaceState(
        null,
        document.title,
        window.location.pathname + window.location.search
    );
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
            alert('Password minimal 6 karakter.');
            return;
        }

        if (passwordBaru !== passwordKonfirmasi) {
            alert('Konfirmasi password tidak cocok.');
            return;
        }

        try {
            const { error } = await supabaseClient.auth.updateUser({
                password: passwordBaru
            });

            if (error) {
                alert('Gagal memperbarui password: ' + error.message);
                return;
            }

            alert('Password berhasil diperbarui. Silakan login kembali.');

            await supabaseClient.auth.signOut();

            window.location.replace('login.html');

        } catch (error) {
            console.error('Kesalahan update password:', error);
            alert('Terjadi kesalahan saat memperbarui password.');
        }
    });
}


/* ==========================================
   JALANKAN PEMERIKSAAN TOKEN PEMULIHAN
========================================== */

siapkanPemulihanPassword().catch(function (error) {
    console.error('Kesalahan pemulihan password:', error);
});
