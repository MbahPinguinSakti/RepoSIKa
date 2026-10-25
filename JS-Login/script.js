import {
  signIn,
  signUp,
  signInWithGoogle,
  resetPasswordForEmail,
  updatePassword,
  redirectIfLoggedIn,
  signOut,
  getReturnUrl,
  resolvePostLoginRedirect,
} from './auth.js';
import { supabase, showAlert, clearAlert, CONFIG } from './utils.js';

document.addEventListener('DOMContentLoaded', () => {
  // 1. Inisialisasi Halaman Login
  initLoginForm();

  // 2. Inisialisasi Halaman Pendaftaran (Sign Up)
  initSignupForm();

  // 3. Inisialisasi Halaman Lupa Password (Recovery)
  initForgotPassword();
});

// ==========================================
// 1. LOGIC HALAMAN LOGIN
// ==========================================
function initLoginForm() {
  const formLogin = document.getElementById('form-login');
  if (!formLogin) return;

  // Jika sudah login, langsung alihkan sesuai role / returnUrl
  redirectIfLoggedIn();

  // Poin 3: Tampilkan pesan jika user ditendang karena akun dinonaktifkan
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get('error') === 'deactivated') {
    showAlert('Akun Anda telah dinonaktifkan oleh pihak kampus. Hubungi Administrator Perpustakaan.', 'error');
  }

  const emailInput = document.getElementById('input-email');
  const passwordInput = document.getElementById('input-password');
  const submitBtn = formLogin.querySelector('button[type="submit"]');
  const googleBtn = document.getElementById('google-login-btn');

  formLogin.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    const email = emailInput?.value?.trim() ?? '';
    const password = passwordInput?.value ?? '';

    const originalText = submitBtn ? submitBtn.textContent : 'Masuk';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Memproses...';
    }

    try {
      const result = await signIn({ email, password });
      if (!result.ok) {
        showAlert(result.message, 'error');
      } else {
        // Poin 4: Navigasi Pasca-Login (Admin -> admin.html, User -> returnUrl / index.html)
        const targetPage = resolvePostLoginRedirect(result.data?.profile);
        showAlert('Login berhasil! Mengalihkan...', 'success');
        setTimeout(() => {
          window.location.replace(targetPage);
        }, 800);
      }
    } catch (err) {
      console.error('[Login Error]', err);
      showAlert('Terjadi kendala pada sistem. Silakan coba lagi.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });


  if (googleBtn) {
    googleBtn.addEventListener('click', async () => {
      clearAlert();
      googleBtn.disabled = true;
      try {
        const result = await signInWithGoogle({ returnUrl: getReturnUrl() });
        if (!result.ok) {
          showAlert(result.message, 'error');
          googleBtn.disabled = false;
        }
      } catch (err) {
        console.error('[Google OAuth Error]', err);
        showAlert('Gagal menghubungkan ke Google.', 'error');
        googleBtn.disabled = false;
      }
    });
  }
}

// ==========================================
// 2. LOGIC HALAMAN PENDAFTARAN (SIGN UP)
// ==========================================
function initSignupForm() {
  const formSignup = document.getElementById('form-signup');
  if (!formSignup) return;

  redirectIfLoggedIn();

  const namaInput = document.getElementById('input-nama');
  const emailInput = document.getElementById('input-email-signup');
  const npmInput = document.getElementById('input-npm');
  const passwordInput = document.getElementById('input-password-signup');
  const submitBtn = formSignup.querySelector('button[type="submit"]');

  // Item E & Poin 1: Penyesuaian Dinamis Mahasiswa vs Dosen
  if (emailInput && npmInput) {
    const handleEmailInput = () => {
      const emailVal = emailInput.value.trim().toLowerCase();
      const isStudent = emailVal.includes(`@${CONFIG.STUDENT_DOMAIN}`);

      // Dosen tidak wajib isi NPM, Mahasiswa wajib isi NPM
      npmInput.required = isStudent;

      const npmLabel = npmInput.closest('.form-group')?.querySelector('label');
      if (npmLabel) {
        npmLabel.textContent = isStudent ? 'NPM (Wajib untuk Mahasiswa)' : 'NPM (Khusus Mahasiswa)';
      }

      // Auto-ekstrak jika student
      if (isStudent) {
        const potentialNpm = emailVal.split('@')[0];
        if (/^\d+$/.test(potentialNpm) && (!npmInput.value || /^\d+$/.test(npmInput.value))) {
          npmInput.value = potentialNpm;
        }
      }
    };

    emailInput.addEventListener('input', handleEmailInput);
    emailInput.addEventListener('change', handleEmailInput);
  }

  formSignup.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    const nama = namaInput?.value?.trim() ?? '';
    const email = emailInput?.value?.trim() ?? '';
    const npm = npmInput?.value?.trim() ?? '';
    const password = passwordInput?.value ?? '';

    const originalText = submitBtn ? submitBtn.textContent : 'Daftar';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Mendaftarkan...';
    }

    try {
      const result = await signUp({ email, password, nama, npm });
      if (!result.ok) {
        showAlert(result.message, 'error');
      } else {
        showAlert(result.message, 'success');
        formSignup.reset();
        setTimeout(() => {
          window.location.replace(CONFIG.PAGES.LOGIN);
        }, 2500);
      }
    } catch (err) {
      console.error('[Sign Up Error]', err);
      showAlert('Gagal melakukan pendaftaran. Silakan coba lagi.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
}

// ==========================================
// 3. LOGIC LUPA PASSWORD & RECOVERY
// ==========================================
function initForgotPassword() {
  const formMintaEmail = document.getElementById('form-minta-email');
  const formPasswordBaru = document.getElementById('form-password-baru');

  if (!formMintaEmail && !formPasswordBaru) return;

  const emailResetInput = document.getElementById('input-email-reset');
  const passBaruInput = document.getElementById('input-pass-baru');
  const passKonfirmasiInput = document.getElementById('input-pass-konfirmasi');

  // Item C: Dukungan Supabase Auth PKCE event listener (Aliran standar Supabase v2)
  supabase.auth.onAuthStateChange((event) => {
    if (event === 'PASSWORD_RECOVERY') {
      if (formMintaEmail) formMintaEmail.style.display = 'none';
      if (formPasswordBaru) formPasswordBaru.style.display = 'block';
      showAlert('Tautan pemulihan diverifikasi. Silakan masukkan kata sandi baru Anda.', 'info');
    }
  });

  // Deteksi hash token recovery di URL (fallback flow)
  const hash = new URLSearchParams(window.location.hash.substring(1));
  const accessToken = hash.get('access_token');
  const refreshToken = hash.get('refresh_token');
  const tokenType = hash.get('type');

  if (tokenType === 'recovery' && accessToken && refreshToken) {
    supabase.auth
      .setSession({ access_token: accessToken, refresh_token: refreshToken })
      .then(({ error }) => {
        if (error) {
          showAlert('Tautan pemulihan tidak valid atau sudah kedaluwarsa.', 'error');
          return;
        }
        if (formMintaEmail) formMintaEmail.style.display = 'none';
        if (formPasswordBaru) formPasswordBaru.style.display = 'block';

        window.history.replaceState(null, document.title, window.location.pathname + window.location.search);
      })
      .catch((err) => {
        console.error('[Recovery Session Error]', err);
        showAlert('Gagal memverifikasi tautan pemulihan.', 'error');
      });
  }

  // Submit minta link reset password
  if (formMintaEmail) {
    const btnMinta = formMintaEmail.querySelector('button[type="submit"]');

    formMintaEmail.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearAlert();

      const email = emailResetInput?.value?.trim() ?? '';
      const originalText = btnMinta ? btnMinta.textContent : 'Kirim Tautan Pemulihan';
      if (btnMinta) {
        btnMinta.disabled = true;
        btnMinta.textContent = 'Mengirim...';
      }

      try {
        const result = await resetPasswordForEmail(email);
        if (!result.ok) {
          showAlert(result.message, 'error');
        } else {
          showAlert(result.message, 'success');
          if (emailResetInput) emailResetInput.value = '';
        }
      } catch (err) {
        console.error('[Reset Email Error]', err);
        showAlert('Gagal mengirim tautan pemulihan. Silakan coba lagi.', 'error');
      } finally {
        if (btnMinta) {
          btnMinta.disabled = false;
          btnMinta.textContent = originalText;
        }
      }
    });
  }

  // Submit simpan password baru
  if (formPasswordBaru) {
    const btnSimpan = formPasswordBaru.querySelector('button[type="submit"]');

    formPasswordBaru.addEventListener('submit', async (event) => {
      event.preventDefault();
      clearAlert();

      const passBaru = passBaruInput?.value ?? '';
      const passKonfirmasi = passKonfirmasiInput?.value ?? '';

      const originalText = btnSimpan ? btnSimpan.textContent : 'Simpan Kata Sandi Baru';
      if (btnSimpan) {
        btnSimpan.disabled = true;
        btnSimpan.textContent = 'Menyimpan...';
      }

      try {
        const result = await updatePassword(passBaru, passKonfirmasi);
        if (!result.ok) {
          showAlert(result.message, 'error');
        } else {
          showAlert('Kata sandi berhasil diperbarui! Mengalihkan ke login...', 'success');
          await signOut();
          setTimeout(() => {
            window.location.replace(CONFIG.PAGES.LOGIN);
          }, 1500);
        }
      } catch (err) {
        console.error('[Update Password Error]', err);
        showAlert('Gagal memperbarui kata sandi.', 'error');
      } finally {
        if (btnSimpan) {
          btnSimpan.disabled = false;
          btnSimpan.textContent = originalText;
        }
      }
    });
  }
}
