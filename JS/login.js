import { signIn, redirectIfLoggedIn } from './auth.js';
import { showAlert, clearAlert, CONFIG } from './utils.js';

// Jika pengguna sudah memiliki sesi login aktif, langsung alihkan ke halaman utama
redirectIfLoggedIn({ redirectTo: CONFIG.PAGES.HOME });

document.addEventListener('DOMContentLoaded', () => {
  const form = document.getElementById('loginForm');
  const emailInput = document.getElementById('email');
  const passwordInput = document.getElementById('password');
  const submitBtn = form?.querySelector('.signin-button');

  if (!form) return;

  form.addEventListener('submit', async (event) => {
    event.preventDefault();
    clearAlert();

    const email = emailInput?.value?.trim() ?? '';
    const password = passwordInput?.value ?? '';

    // Efek loading tombol
    const originalText = submitBtn ? submitBtn.textContent : 'Sign In';
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Memproses...';
    }

    try {
      const result = await signIn({ email, password });
      if (!result.ok) {
        showAlert(result.message, 'error');
      } else {
        showAlert('Login berhasil! Mengalihkan...', 'success');
        setTimeout(() => {
          window.location.replace(CONFIG.PAGES.HOME);
        }, 800);
      }
    } catch (err) {
      console.error('[login]', err);
      showAlert('Terjadi kesalahan tidak terduga. Silakan coba lagi.', 'error');
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });
});

