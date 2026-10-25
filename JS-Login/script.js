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

// Helper agar wadah notifikasi selalu ada meskipun HTML diubah
function ensureAlertContainer(referenceElement) {
  let container = document.getElementById('alert-container');
  if (!container && referenceElement && referenceElement.parentNode) {
    container = document.createElement('div');
    container.id = 'alert-container';
    referenceElement.parentNode.insertBefore(container, referenceElement);
  }
  return container;
}

// ==========================================
// 1. LOGIC HALAMAN LOGIN
// ==========================================
async function initLoginForm() {
  // Kompatibilitas ganda: id 'form-login' (standar) atau 'loginForm' (Kayna)
  const formLogin = document.getElementById('form-login') || document.getElementById('loginForm');
  if (!formLogin) return;

  ensureAlertContainer(formLogin);

  const urlParams = new URLSearchParams(window.location.search);

  // 1. Tangani jika pengguna baru saja logout (?logout=true atau ?action=logout)
  if (urlParams.get('logout') === 'true' || urlParams.get('action') === 'logout') {
    // Paksa signOut bersih & pastikan semua token terbakar habis
    await signOut();
    showAlert('Anda telah berhasil keluar dari akun.', 'info');
    // Hapus parameter logout dari URL agar bersih tanpa reload
    window.history.replaceState({}, document.title, window.location.pathname);
    return; // PENTING: BERHENTI DI SINI! JANGAN jalankan redirectIfLoggedIn()!
  }

  // 2. Tampilkan pesan jika user ditendang karena akun dinonaktifkan
  if (urlParams.get('error') === 'deactivated') {
    showAlert('Akun Anda telah dinonaktifkan oleh pihak kampus. Hubungi Administrator Perpustakaan.', 'error');
  }

  // 3. Jika bukan aksi logout, periksa apakah pengguna memiliki sesi aktif
  await redirectIfLoggedIn();

  // Kompatibilitas elemen input (input-email / email, input-password / password)
  const emailInput =
    document.getElementById('input-email') ||
    document.getElementById('email') ||
    formLogin.querySelector('input[type="email"]');

  const passwordInput =
    document.getElementById('input-password') ||
    document.getElementById('password') ||
    formLogin.querySelector('input[type="password"]');

  const submitBtn =
    formLogin.querySelector('button[type="submit"]') ||
    document.getElementById('btn-login') ||
    formLogin.querySelector('.signin-button');

  const googleBtn =
    document.getElementById('google-login-btn') ||
    document.querySelector('.google-button');

  // Pastikan link forgot-password tidak mati (href="#")
  const forgotPassLink = document.querySelector('a.forgot-password');
  if (forgotPassLink && (!forgotPassLink.getAttribute('href') || forgotPassLink.getAttribute('href') === '#')) {
    forgotPassLink.setAttribute('href', 'forgot-password.html');
  }

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
        // Navigasi Pasca-Login (Admin -> admin.html, User -> returnUrl / index.html)
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
  const formSignup = document.getElementById('form-signup') || document.getElementById('signupForm');
  if (!formSignup) return;

  ensureAlertContainer(formSignup);
  redirectIfLoggedIn();

  const namaInput =
    document.getElementById('input-nama') ||
    document.getElementById('nama') ||
    document.getElementById('name');

  const emailInput =
    document.getElementById('input-email-signup') ||
    document.getElementById('input-email') ||
    document.getElementById('email') ||
    formSignup.querySelector('input[type="email"]');

  const npmInput =
    document.getElementById('input-npm') ||
    document.getElementById('npm');

  const passwordInput =
    document.getElementById('input-password-signup') ||
    document.getElementById('input-password') ||
    document.getElementById('password') ||
    formSignup.querySelector('input[type="password"]');

  const submitBtn =
    formSignup.querySelector('button[type="submit"]') ||
    formSignup.querySelector('.signup-button');

  // Penyesuaian Dinamis Mahasiswa vs Dosen
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
  const formMintaEmail =
    document.getElementById('form-minta-email') ||
    document.getElementById('form-request-reset');

  const formPasswordBaru =
    document.getElementById('form-password-baru') ||
    document.getElementById('form-update-password');

  if (!formMintaEmail && !formPasswordBaru) return;

  const emailResetInput =
    document.getElementById('input-email-reset') ||
    document.getElementById('email-reset') ||
    formMintaEmail?.querySelector('input[type="email"]');

  const passBaruInput =
    document.getElementById('input-pass-baru') ||
    document.getElementById('password-baru') ||
    formPasswordBaru?.querySelector('input[type="password"]');

  const passKonfirmasiInput =
    document.getElementById('input-pass-konfirmasi') ||
    document.getElementById('password-konfirmasi') ||
    formPasswordBaru?.querySelectorAll('input[type="password"]')?.[1];

  // Dukungan Supabase Auth PKCE event listener (Aliran standar Supabase v2)
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
    ensureAlertContainer(formMintaEmail);
    const btnMinta =
      formMintaEmail.querySelector('button[type="submit"]') ||
      document.getElementById('btn-cari');

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
    ensureAlertContainer(formPasswordBaru);
    const btnSimpan =
      formPasswordBaru.querySelector('button[type="submit"]') ||
      document.getElementById('btn-simpan-password');

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
