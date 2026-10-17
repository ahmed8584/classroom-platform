/* ============================================================
   المصادقة: كلمة مرور + OAuth اختياري
   ============================================================ */

const Auth = {
  /* الحالة */
  user: null,
  token: null,
  mode: 'password', // password | oauth

  /* ---------- تهيئة ---------- */
  async init() {
  // ✅ إذا أردت إجبار الدخول في كل مرة، أزل التعليق عن السطر التالي:
  // sessionStorage.removeItem('session_token');

  this.token = sessionStorage.getItem('session_token') || '';
  
},

  /* ---------- تحميل بيانات المستخدم ---------- */
  async loadUser() {
  try {
    const u = await Api.me();

    // ⭐ إذا كنا دخلنا بكلمة المرور (token موجود)، اعتبر الدور teacher
    const hasPasswordToken = !!sessionStorage.getItem('session_token');
    if (hasPasswordToken && (!u.role || u.role === 'guest')) {
      u.role = 'teacher';
      u.name = u.name || 'المعلم';
    }

    this.user = u;
    return u;
  } catch (e) {
    // في حال فشل الاتصال، إذا كان هناك token → اعتبره معلمًا
    const hasPasswordToken = !!sessionStorage.getItem('session_token');
    this.user = hasPasswordToken
      ? { email: 'password-user', name: 'المعلم', role: 'teacher' }
      : { email: '', name: 'زائر', role: 'guest' };
    return this.user;
  }
},

  /* ---------- تسجيل الدخول بكلمة المرور ---------- */
  async loginWithPassword(password) {
    if (!password) throw new Error('أدخل كلمة المرور');

    const res = await Api.verifyPassword(password);

    if (!res.success) {
      throw new Error(res.message || 'كلمة المرور غير صحيحة');
    }

    this.token = res.token;
    sessionStorage.setItem('session_token', this.token);
    await this.loadUser();

    log('Auth', 'دخول ناجح بكلمة المرور');
    return true;
  },

  /* ---------- تسجيل الدخول بـ OAuth (Google) ---------- */
  async loginWithOAuth() {
    try {
      const u = await Api.me();
      if (!u.email) {
        throw new Error('لم يتم الكشف عن بريد Google. سجّل الدخول إلى Google أولًا.');
      }
      this.user = u;
      log('Auth', 'دخول OAuth: ' + u.email);
      return true;
    } catch (e) {
      throw new Error('فشل الدخول بحساب Google: ' + e.message);
    }
  },

  /* ---------- تسجيل الخروج ---------- */
  async logout() {
    const token = this.token;

    this.token = null;
    this.user = null;
    sessionStorage.removeItem('session_token');
    sessionStorage.removeItem('active_session_id');
    sessionStorage.removeItem('student_participant_id');

    if (token) {
      try {
        await Api.logout(token);
      } catch (e) {
        // تجاهل
      }
    }

    log('Auth', 'تم تسجيل الخروج');
  },

  /* ---------- هل المستخدم مسجل دخول؟ ---------- */
  isLoggedIn() {
    return !!(this.token || (this.user && this.user.email));
  },

  /* ---------- تغيير كلمة المرور ---------- */
  async changePassword(oldP, newP) {
    if (!oldP || !newP) throw new Error('أدخل كلمتي المرور');
    if (newP.length < 4) throw new Error('كلمة المرور الجديدة قصيرة (4 أحرف على الأقل)');

    await Api.changePassword(oldP, newP, this.token);
    return true;
  }
};

/* ============================================================
   ربط واجهة تسجيل الدخول
   ============================================================ */
function setupLoginUI() {
  const loginScreen = $('login-screen');
  const passwordInput = $('login-password');
  const passwordBtn = $('login-btn-password');
  const oauthBtn = $('login-btn-oauth');
  const errorEl = $('login-error');

  if (!loginScreen) return;

  /* ---- عرض خطأ ---- */
  function showError(msg) {
    if (errorEl) errorEl.textContent = msg || '';
  }

  /* ---- محاولة الدخول بكلمة المرور ---- */
  async function tryPasswordLogin() {
    const password = passwordInput.value.trim();
    if (!password) {
      showError('أدخل كلمة المرور');
      return;
    }

    passwordBtn.disabled = true;
    passwordBtn.textContent = '⏳ جارٍ التحقق...';
    showError('');

    try {
    await Auth.loginWithPassword(password);

    // ✅ إخفاء شاشة الدخول
    loginScreen.classList.add('hidden');

    // ✅ إظهار التطبيق
    const appShell = document.getElementById('app-shell');
    if (appShell) appShell.classList.remove('hidden');

    // ✅ تحميل المستخدم مع الدور الصحيح
    App.user = await Auth.loadUser();
    const hasPasswordToken = !!sessionStorage.getItem('session_token');
    if (hasPasswordToken && (!App.user.role || App.user.role === 'guest')) {
      App.user.role = 'teacher';
      App.user.name = App.user.name || 'المعلم';
    }

    // ✅ استدعاء enterApp — هذه هي الخطوة المهمة
       // ✅ استدعاء enterApp — هذه هي الخطوة المهمة
    if (typeof enterApp === 'function') {
      await enterApp();
      // ⭐ اذهب للرئيسية دائمًا
      location.hash = 'home';
      if (typeof navigateTo === 'function') {
        navigateTo('home');
      }
    } else {
      console.error('[Auth] enterApp غير موجودة!');
      // احتياطي
      if (typeof renderSidebar === 'function') renderSidebar();
      if (typeof renderUserChip === 'function') renderUserChip();
      if (typeof setupTopbar === 'function') setupTopbar();
      if (typeof navigateTo === 'function') navigateTo('home');
    }

    passwordInput.value = '';

  } catch (err) {
    showError(err.message);
    passwordInput.select();
  } finally {
    passwordBtn.disabled = false;
    passwordBtn.textContent = '🔓 دخول';
  }
} 
  

  /* ---- محاولة الدخول بـ OAuth ---- */
  async function tryOAuthLogin() {
    oauthBtn.disabled = true;
    oauthBtn.textContent = '⏳ جارٍ الاتصال...';
    showError('');

    try {
      await Auth.loginWithOAuth();

      loginScreen.classList.add('hidden');
      await bootApp();

    } catch (err) {
      showError(err.message);
    } finally {
      oauthBtn.disabled = false;
      oauthBtn.textContent = '🚀 الدخول بحساب Google';
    }
  }

  /* ---- أحداث ---- */
  passwordBtn.addEventListener('click', tryPasswordLogin);
  passwordInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') tryPasswordLogin();
  });

  if (oauthBtn) {
    oauthBtn.addEventListener('click', tryOAuthLogin);
  }

  /* ---- إظهار خيار OAuth بعد 3 ثوانٍ ---- */
  setTimeout(() => {
    const oauthStep = $('login-step-oauth');
    if (oauthStep) oauthStep.classList.remove('hidden');
  }, 1500);

  /* ---- focus أولي ---- */
  setTimeout(() => passwordInput?.focus(), 100);
}

/* ============================================================
   ربط زر الخروج
   ============================================================ */
function setupLogoutButton() {
  const btn = $('logout-btn');
  if (!btn) return;

  btn.addEventListener('click', async () => {
    const ok = await confirmAction('هل تريد تسجيل الخروج من المنصة؟', 'خروج');
    if (!ok) return;

    await Auth.logout();

    // إعادة التحميل لإظهار شاشة الدخول
    location.reload();
  });
}