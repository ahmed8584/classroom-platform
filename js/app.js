/* ============================================================
   app.js — المدير الرئيسي للتطبيق
   ============================================================ */

const App = {
  user: null,
  currentRoute: null,
  isStudent: false,
  sidebarOpen: false,
  pollInterval: null,
  ready: false
};

/* ============================================================
   خريطة الصفحات (Route → renderFunction)
   ============================================================ */
const ROUTES = {
  home: {
    title: 'الرئيسية',
    icon: '🏠',
    render: () => showTilesHome(),
    roles: ['teacher', 'admin', 'guest']
  },
  roster: {
    title: 'الطلاب',
    icon: '👥',
    render: () => renderRosterPage(),
    roles: ['teacher', 'admin'],
    section: 'الأساسيات'
  },
  points: {
    title: 'التعزيز',
    icon: '🏆',
    render: () => renderPointsFromRoster(),
    roles: ['teacher', 'admin'],
    section: 'الأساسيات'
  },
  bank: {
    title: 'بنك الأسئلة',
    icon: '📚',
    render: () => renderBankPage(),
    roles: ['teacher', 'admin'],
    section: 'الأساسيات'
  },
  studio: {
    title: 'استوديو الدروس',
    icon: '🎨',
    render: () => renderStudioPage(),
    roles: ['teacher', 'admin'],
    section: 'الأساسيات'
  },
  games: {
    title: 'مكتبة الألعاب',
    icon: '🎮',
    render: () => renderGamesPage(),
    roles: ['teacher', 'admin'],
    section: 'الأنشطة'
  },
  tools: {
    title: 'الأدوات الصفية',
    icon: '🛠️',
    render: () => renderToolsHub(),
    roles: ['teacher', 'admin'],
    section: 'الأنشطة'
  },
  live: {
    title: 'شاشة الحصة',
    icon: '📺',
    render: () => renderLivePage(),
    roles: ['teacher', 'admin'],
    section: 'الأنشطة'
  },
  ai: {
    title: 'المساعد الذكي',
    icon: '✨',
    render: () => renderAIPage(),
    roles: ['teacher', 'admin'],
    section: 'الذكاء'
  },
  analytics: {
    title: 'الرسم البياني',
    icon: '📈',
    render: () => renderAnalyticsTool(),
    roles: ['teacher', 'admin'],
    section: 'التحليل'
  },
  compare: {
    title: 'المقارنة',
    icon: '⚖️',
    render: () => renderComparisonTool(),
    roles: ['teacher', 'admin'],
    section: 'التحليل'
  },
  reports: {
    title: 'التقارير',
    icon: '📋',
    render: () => renderReportsPage(),
    roles: ['teacher', 'admin'],
    section: 'التحليل'
  },
  join: {
    title: 'الانضمام',
    icon: '🚀',
    render: () => renderJoinPage(),
    roles: ['guest', 'student', 'teacher', 'admin']
  },
  settings: {
    title: 'الإعدادات',
    icon: '⚙️',
    render: () => renderSettingsPage(),
    roles: ['teacher', 'admin']
  }
};

/* ============================================================
   البدء
   ============================================================ */
async function bootApp() {
  if (App.ready) return;

  log('App', 'بدء التشغيل...');

  // 1) تهيئة API
  if (!API.init()) {
    toast('تعذّر تهيئة الاتصال بالخادم', 'error');
    return;
  }

  // 2) جرّب استعادة الجلسة
  const hasSession = await Auth.init();

  // 3) أظهر شاشة الدخول أو التطبيق
  if (hasSession) {
    await enterApp();
  } else {
    showLoginScreen();
  }

  App.ready = true;
  log('App', 'جاهز');
}

/* ============================================================
   شاشة الدخول
   ============================================================ */
function showLoginScreen() {
  const loginScreen = document.getElementById('login-screen');
  const appShell = document.getElementById('app-shell');

  if (loginScreen) loginScreen.classList.remove('hidden');
  if (appShell) appShell.classList.add('hidden');

  // ✅ ربط أحداث تسجيل الدخول
  setupLoginUI();
  setupLogoutButton();
}

/* ============================================================
   دخول التطبيق
   ============================================================ */
async function enterApp() {
  const loginScreen = document.getElementById('login-screen');
  const appShell = document.getElementById('app-shell');

  if (loginScreen) loginScreen.classList.add('hidden');
  if (appShell) appShell.classList.remove('hidden');

  // 1) حمّل بيانات المستخدم
  // 1) حمّل بيانات المستخدم
App.user = await Auth.loadUser();

// ⭐ ضمان الدور
const hasPasswordToken = !!sessionStorage.getItem('session_token');
if (hasPasswordToken && (!App.user.role || App.user.role === 'guest')) {
  App.user.role = 'teacher';
  App.user.name = App.user.name || 'المعلم';
};

  // اكتشف الدور: طالب إن كان لديه participant_id
  const participantId = sessionStorage.getItem('student_participant_id');
  App.isStudent = !!participantId;

  // 2) حدّث الـ Sidebar و Chip
  renderSidebar();
  renderUserChip();
  setupTopbar();

  // 3) اذهب للصفحة الحالية أو الرئيسية
  const hash = location.hash.replace('#', '').split('?')[0] || 'home';
  navigateTo(hash || 'home');

  // 4) اسمع لتغيرات الـ hash
  window.addEventListener('hashchange', () => {
    const newHash = location.hash.replace('#', '').split('?')[0] || 'home';
    navigateTo(newHash, false);
  });

  // 5) إن كان طالبًا، اعرض شاشة الطالب
  if (App.isStudent) {
    navigateTo('join', false);
  }

  log('App', 'تم دخول التطبيق - الدور: ' + (App.isStudent ? 'طالب' : (App.user?.role || 'معلم')));
}

/* ============================================================
   Sidebar
   ============================================================ */
function renderSidebar() {
  const nav = document.getElementById('sidebar-nav');
  if (!nav) return;

  const userRole = App.isStudent ? 'student' : (App.user?.role || 'teacher');

  // نظّم الروابط حسب الأقسام
  const sections = {};
  Object.entries(ROUTES).forEach(([key, route]) => {
    if (route.roles && !route.roles.includes(userRole)) return;
    const section = route.section || 'أساسي';
    if (!sections[section]) sections[section] = [];
    sections[section].push({ key, ...route });
  });

  let html = '';

  // ترتيب الأقسام يدويًا
  const sectionOrder = ['أساسي', 'الأساسيات', 'الأنشطة', 'الذكاء', 'التحليل'];

  sectionOrder.forEach(sectionName => {
    if (!sections[sectionName]) return;

    html += `<div class="nav-section-title">${sectionName}</div>`;

    sections[sectionName].forEach(route => {
      html += `
        <a class="nav-link" data-route="${route.key}" href="#${route.key}">
          <span class="nav-icon">${route.icon}</span>
          <span>${route.title}</span>
        </a>
      `;
    });

    delete sections[sectionName];
  });

  // أي أقسام متبقية
  Object.entries(sections).forEach(([sectionName, routes]) => {
    html += `<div class="nav-section-title">${sectionName}</div>`;
    routes.forEach(route => {
      html += `
        <a class="nav-link" data-route="${route.key}" href="#${route.key}">
          <span class="nav-icon">${route.icon}</span>
          <span>${route.title}</span>
        </a>
      `;
    });
  });

  nav.innerHTML = html;

  // ربط الأحداث
  nav.querySelectorAll('.nav-link').forEach(link => {
    link.onclick = (e) => {
      e.preventDefault();
      const route = link.dataset.route;
      navigateTo(route);
      closeSidebarOnMobile();
    };
  });
}

function updateActiveSidebarLink(routeKey) {
  document.querySelectorAll('.nav-link').forEach(link => {
    link.classList.toggle('active', link.dataset.route === routeKey);
  });
}

/* ============================================================
   User Chip
   ============================================================ */
function renderUserChip() {
  const nameEl = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');

  if (!nameEl || !avatarEl) return;

  const name = App.isStudent
    ? (sessionStorage.getItem('student_name') || 'طالب')
    : (App.user?.name || App.user?.email?.split('@')[0] || 'معلم');

  nameEl.textContent = name;
  avatarEl.textContent = name.charAt(0) || '؟';

  // لون عشوائي ثابت
  const colors = window.APP_CONFIG.AVATAR_COLORS;
  const colorIdx = name.charCodeAt(0) % colors.length;
  avatarEl.style.background = colors[colorIdx];
}

/* ============================================================
   Topbar
   ============================================================ */
function setupTopbar() {
  // زر القائمة على الجوال
  const menuBtn = document.getElementById('menu-toggle');
  if (menuBtn) {
    menuBtn.onclick = toggleSidebar;
  }

  // ⭐ زر الرجوع للرئيسية
  const backBtn = document.getElementById('btn-back-home');
  if (backBtn) {
    backBtn.onclick = () => {
      navigateTo('home');
      closeSidebarOnMobile();
    };
  }

  // زر الإشعارات
  const notifBtn = document.getElementById('btn-notif');
  if (notifBtn) {
    notifBtn.onclick = async () => {
      if (typeof requestNotifPermission === 'function') {
        await requestNotifPermission();
      }
    };
  }

  // رابط جدول البيانات
  const sheetLink = document.getElementById('sheet-link');
  if (sheetLink) {
    sheetLink.onclick = (e) => {
      e.preventDefault();
      toast('رابط الجدول متاح من لوحة الإدارة', 'info');
    };
  }
}

/* ============================================================
   Sidebar على الجوال
   ============================================================ */
function toggleSidebar() {
  const sidebar = document.getElementById('sidebar');
  if (!sidebar) return;
  App.sidebarOpen = !App.sidebarOpen;
  sidebar.classList.toggle('open', App.sidebarOpen);
}

function closeSidebarOnMobile() {
  if (window.innerWidth <= 900) {
    const sidebar = document.getElementById('sidebar');
    if (sidebar) {
      sidebar.classList.remove('open');
      App.sidebarOpen = false;
    }
  }
}

/* ============================================================
   التنقل (Routing)
   ============================================================ */
async function navigateTo(routeKey, updateHash = true) {
  // ⭐ مسح حالة AI عند مغادرة صفحة AI
  if (App.currentRoute === 'ai' && routeKey !== 'ai') {
    if (typeof clearAIMedia === 'function') {
      clearAIMedia();
      log('App', 'تم مسح حالة AI عند المغادرة');
    }
  }

  // ... باقي الكود كما هو
  const route = ROUTES[routeKey];
  if (!route) {
    routeKey = 'home';
  }

  // تحقق من الصلاحية
  const userRole = App.isStudent ? 'student' : (App.user?.role || 'teacher');
  const effectiveRoute = ROUTES[routeKey] || ROUTES.home;

  if (effectiveRoute.roles && !effectiveRoute.roles.includes(userRole)) {
    toast('لا تملك صلاحية الوصول لهذه الصفحة', 'warn');
    if (routeKey !== 'home') {
      navigateTo('home');
    }
    return;
  }

  App.currentRoute = routeKey;

  // حدّث العنوان
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = effectiveRoute.title;
// مسار التنقل
const breadcrumb = document.getElementById('breadcrumb');
if (breadcrumb) {
  if (routeKey === 'home') {
    breadcrumb.textContent = '';
  } else {
    breadcrumb.textContent = '🏠 الرئيسية / ' + effectiveRoute.title;
  }
}
  // حدّث Sidebar
  updateActiveSidebarLink(routeKey);

  // حدّث hash
  if (updateHash && location.hash !== '#' + routeKey) {
    location.hash = routeKey;
  }

  // استدعِ دالة العرض
  try {
    await effectiveRoute.render();
  } catch (e) {
    log('navigateTo error', e.message);
    toast('خطأ في تحميل الصفحة: ' + e.message, 'error');
  }

  // ارجع لأعلى الصفحة
  const content = document.getElementById('content');
  if (content) content.scrollTop = 0;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

/* ============================================================
   صفحة Tiles الرئيسية
   ============================================================ */
function showTilesHome() {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-home');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-home';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  // ✅ اربط أحداث النقر لكل Tiles موجودة
  bindExistingTiles();

  // ✅ إذا لم تكن Tiles موجودة، ابنها ديناميكيًا
  const tilesContainer = page.querySelector('.tiles-grid');
  if (tilesContainer && tilesContainer.children.length === 0) {
    buildTiles(tilesContainer);
  }
}

/* ============================================================
   ربط أحداث Tiles الموجودة في index.html
   (تدعم data-goto + data-tile-route)
   ============================================================ */
function bindExistingTiles() {
  // Tiles بـ data-goto (من index.html)
  document.querySelectorAll('.tile[data-goto]').forEach(tile => {
    // تجنّب ربط الحدث مرتين
    if (tile.dataset.bound === '1') return;
    tile.dataset.bound = '1';

    tile.onclick = (e) => {
      e.preventDefault();
      const route = tile.dataset.goto;
      console.log('[Tile] نقر (data-goto):', route);
      navigateTo(route);
    };
  });

  // Tiles بـ data-tile-route (من buildTiles)
  document.querySelectorAll('.tile[data-tile-route]').forEach(tile => {
    if (tile.dataset.bound === '1') return;
    tile.dataset.bound = '1';

    tile.onclick = (e) => {
      e.preventDefault();
      const route = tile.dataset.tileRoute;
      console.log('[Tile] نقر (data-tile-route):', route);
      navigateTo(route);
    };
  });
}

function buildTiles(container) {
  const userRole = App.isStudent ? 'student' : (App.user?.role || 'teacher');

  // المجموعات
  const groups = [
    {
      title: '👨‍🏫 أدوات المعلم',
      routes: ['roster', 'points', 'studio', 'bank']
    },
    {
      title: '🎮 الأنشطة والألعاب',
      routes: ['games', 'live', 'tools']
    },
    {
      title: '📊 التحليل والمتابعة',
      routes: ['analytics', 'compare', 'reports']
    },
    {
      title: '🤖 الذكاء والإدارة',
      routes: ['ai', 'settings']
    }
  ];

  container.innerHTML = groups.map(group => {
    const validRoutes = group.routes
      .map(key => ({ key, ...ROUTES[key] }))
      .filter(r => r.roles && r.roles.includes(userRole));

    if (!validRoutes.length) return '';

    return `
      <div class="tiles-group">
        <h3 class="tiles-group-title">${group.title}</h3>
        <div class="tiles-row">
          ${validRoutes.map(r => `
            <button class="tile" data-tile-route="${r.key}" type="button">
              <span class="tile-icon">${r.icon}</span>
              <span class="tile-title">${r.title}</span>
            </button>
          `).join('')}
        </div>
      </div>
    `;
  }).join('');

  // ربط الأحداث
    // استخدم الدالة الموحدة
  bindExistingTiles();
}

/* ============================================================
   صفحة الأدوات (Hub)
   ============================================================ */
function renderToolsHub() {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-tools');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-tools';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="welcome-hero">
      <h1>🛠️ الأدوات الصفية</h1>
      <p>اختر الأداة التي تريد استخدامها</p>
    </div>
    <div class="tiles-row" style="grid-template-columns:repeat(auto-fill,minmax(200px,1fr))">
      <button class="tile" data-tool="wheel" type="button">
        <span class="tile-icon">🎡</span>
        <span class="tile-title">العجلة</span>
        <span class="tile-desc">اختيار طالب عشوائي</span>
      </button>
      <button class="tile tile-general" data-tool="timer" type="button">
        <span class="tile-icon">⏱️</span>
        <span class="tile-title">المؤقت</span>
        <span class="tile-desc">مؤقت تنازلي</span>
      </button>
      <button class="tile tile-general" data-tool="stopwatch" type="button">
        <span class="tile-icon">⏲️</span>
        <span class="tile-title">ساعة الإيقاف</span>
        <span class="tile-desc">مع Laps</span>
      </button>
      <button class="tile tile-purple" data-tool="groups" type="button">
        <span class="tile-icon">👥</span>
        <span class="tile-title">المجموعات</span>
        <span class="tile-desc">تقسيم عشوائي</span>
      </button>
      <button class="tile tile-accent" data-tool="matching" type="button">
        <span class="tile-icon">🔗</span>
        <span class="tile-title">التوصيل</span>
        <span class="tile-desc">توصيل الكلمات</span>
      </button>
      <button class="tile tile-warn" data-tool="dice" type="button">
        <span class="tile-icon">🎲</span>
        <span class="tile-title">النرد</span>
        <span class="tile-desc">رمي النرد</span>
      </button>
    </div>
  `;

  // ربط الأحداث
  page.querySelectorAll('[data-tool]').forEach(btn => {
    btn.onclick = () => {
      const tool = btn.dataset.tool;
      if (tool === 'wheel') renderWheelTool();
      else if (tool === 'timer') renderTimerTool();
      else if (tool === 'stopwatch') renderStopwatchTool();
      else if (tool === 'groups') renderGroupsTool();
      else if (tool === 'matching') gMatching();
      else if (tool === 'dice') gDice();
    };
  });
}

/* ============================================================
   صفحة الإعدادات
   ============================================================ */
function renderSettingsPage() {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-settings');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-settings';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>👤 الملف الشخصي</h2>
      </div>
      <div class="row" style="gap:14px;align-items:center">
        <div id="settings-avatar" class="student-avatar lg" style="background:var(--primary)">؟</div>
        <div style="flex:1">
          <div id="settings-name" style="font-weight:700;font-size:18px">—</div>
          <div id="settings-email" style="color:var(--text-muted);font-size:13px">—</div>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>🔒 تغيير كلمة المرور</h2>
      </div>
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <input type="password" id="pwd-old" placeholder="الحالية" style="flex:1;min-width:160px">
        <input type="password" id="pwd-new" placeholder="الجديدة" style="flex:1;min-width:160px">
        <input type="password" id="pwd-confirm" placeholder="تأكيد" style="flex:1;min-width:160px">
      </div>
      <button class="btn btn-primary" id="btn-change-pwd" type="button" style="margin-top:12px">💾 حفظ</button>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>🔔 الإشعارات</h2>
      </div>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">
        فعّل الإشعارات لتصلك تنبيهات عند انتهاء المؤقت أو عند نشاط طالب.
      </p>
      <button class="btn btn-primary" id="btn-settings-notif" type="button">🔔 تفعيل الإشعارات</button>
      <div id="settings-notif-status" style="margin-top:10px;font-size:13px;color:var(--text-muted)"></div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📊 معلومات النظام</h2>
      </div>
      <div id="settings-system-info" style="font-size:13px;line-height:2">
        <div>جارٍ التحميل...</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>🚪 الخروج</h2>
      </div>
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">
        عند الخروج ستُطلب كلمة المرور مرة أخرى للدخول.
      </p>
      <button class="btn btn-danger" id="btn-settings-logout" type="button">🚪 تسجيل الخروج</button>
    </div>
  `;

  // الملف الشخصي
  const user = App.user || {};
  const name = user.name || user.email?.split('@')[0] || 'معلم';
  const email = user.email || '—';
  document.getElementById('settings-avatar').textContent = name.charAt(0);
  document.getElementById('settings-name').textContent = name;
  document.getElementById('settings-email').textContent = email;

  // كلمة المرور
  document.getElementById('btn-change-pwd').onclick = async () => {
    const oldP = document.getElementById('pwd-old').value;
    const newP = document.getElementById('pwd-new').value;
    const confirmP = document.getElementById('pwd-confirm').value;

    if (!oldP || !newP) {
      toast('أكمل الحقول', 'warn');
      return;
    }
    if (newP !== confirmP) {
      toast('التأكيد لا يطابق', 'warn');
      return;
    }
    if (newP.length < 4) {
      toast('كلمة المرور قصيرة (4 أحرف على الأقل)', 'warn');
      return;
    }

    try {
      await Auth.changePassword(oldP, newP);
      toast('✅ تم تغيير كلمة المرور', 'success');
      document.getElementById('pwd-old').value = '';
      document.getElementById('pwd-new').value = '';
      document.getElementById('pwd-confirm').value = '';
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  // الإشعارات
  document.getElementById('btn-settings-notif').onclick = async () => {
    if (typeof requestNotifPermission === 'function') {
      await requestNotifPermission();
      updateSettingsNotifStatus();
    }
  };
  updateSettingsNotifStatus();

  // الخروج
  document.getElementById('btn-settings-logout').onclick = async () => {
    const ok = await confirmAction('🚪 هل تريد تسجيل الخروج؟', 'خروج');
    if (!ok) return;
    await Auth.logout();
    location.reload();
  };

  // معلومات النظام
  loadSystemInfo();
}

function updateSettingsNotifStatus() {
  const el = document.getElementById('settings-notif-status');
  if (!el) return;

  if (!('Notification' in window)) {
    el.textContent = '⚠️ المتصفح لا يدعم الإشعارات';
    el.style.color = 'var(--text-muted)';
    return;
  }

  if (Notification.permission === 'granted') {
    el.textContent = '✅ الإشعارات مُفعّلة';
    el.style.color = 'var(--success)';
  } else if (Notification.permission === 'denied') {
    el.textContent = '⚠️ الإشعارات مرفوضة — فعّلها من إعدادات المتصفح';
    el.style.color = 'var(--danger)';
  } else {
    el.textContent = 'ℹ️ الإشعارات غير مُفعّلة';
    el.style.color = 'var(--text-muted)';
  }
}

async function loadSystemInfo() {
  const el = document.getElementById('settings-system-info');
  if (!el) return;

  try {
    const stats = await API.call('admin.stats');
    el.innerHTML = `
      <div>📊 <b>عدد الصفوف:</b> ${stats.classes || 0}</div>
      <div>📚 <b>عدد الدروس:</b> ${stats.lessons || 0}</div>
      <div>❓ <b>عدد الأسئلة:</b> ${stats.questions || 0}</div>
      <div>📺 <b>عدد الحصص:</b> ${stats.sessions || 0}</div>
      <div>👥 <b>عدد الطلاب:</b> ${stats.roster || 0}</div>
      <div>🎮 <b>نتائج الألعاب:</b> ${stats.games || 0}</div>
    `;
  } catch (e) {
    el.innerHTML = '<div style="color:var(--text-muted)">غير متاح (يتطلب صلاحية أدمن)</div>';
  }
}

/* ============================================================
   صفحة التقارير
   ============================================================ */
async function renderReportsPage() {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-reports');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-reports';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>📋 الحصص السابقة</h2>
        <button class="btn btn-ghost btn-sm" id="btn-refresh-reports" type="button">🔄 تحديث</button>
      </div>
      <div id="reports-list">
        <div class="empty">جارٍ التحميل...</div>
      </div>
    </div>
  `;

  document.getElementById('btn-refresh-reports').onclick = loadReportsList;
  await loadReportsList();
}

async function loadReportsList() {
  const container = document.getElementById('reports-list');
  if (!container) return;

  try {
    const sessions = await Api.listSessions();

    if (!sessions.length) {
      container.innerHTML = '<div class="empty">لا توجد حصص بعد</div>';
      return;
    }

    const sorted = sessions.sort((a, b) =>
      new Date(b.startedAt || 0) - new Date(a.startedAt || 0)
    );

    container.innerHTML = sorted.map(s => {
      const status = {
        waiting: '⏳',
        running: '🟢',
        ended: '⚫'
      }[s.status] || '';

      const date = s.startedAt
        ? new Date(s.startedAt).toLocaleString('ar-OM', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        : '—';

      return `
        <div class="student-row" style="padding:14px">
          <div style="flex:1">
            <div style="font-weight:700">${status} رمز: ${escapeHtml(s.code)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px">${date}</div>
          </div>
          <button class="btn btn-primary btn-sm" data-view-report="${s.id}" type="button">عرض التقرير</button>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-view-report]').forEach(btn => {
      btn.onclick = () => viewSessionReport(btn.dataset.viewReport);
    });
  } catch (e) {
    container.innerHTML = `<div class="empty">خطأ: ${escapeHtml(e.message)}</div>`;
  }
}

async function viewSessionReport(sessionId) {
  try {
    const report = await Api.sessionReport(sessionId);

    const summary = report.summary || [];
    const participants = report.participants || [];
    const hardest = report.hardest || [];

    openModal('📊 تقرير الحصة', (body) => {
      body.innerHTML = `
        <div style="background:#eff6ff;padding:14px;border-radius:10px;margin-bottom:16px">
          <h3 style="color:var(--primary);margin-bottom:8px">📌 ملخص</h3>
          ${summary.map(l => `<div style="line-height:1.8">${escapeHtml(l)}</div>`).join('')}
        </div>

        <h3 style="margin-bottom:12px">👥 المشاركون (${participants.length})</h3>
        ${participants.length ? participants.map((p, i) => `
          <div class="student-row" style="padding:10px">
            <div style="width:30px;font-weight:900;color:var(--primary)">${i + 1}</div>
            <div style="flex:1;font-weight:700">${escapeHtml(p.name)}</div>
            <div style="font-weight:900;color:var(--primary)">${p.score || 0}</div>
          </div>
        `).join('') : '<div class="empty">لا مشاركون</div>'}

        ${hardest.length ? `
          <h3 style="margin:20px 0 12px">⚠️ الأسئلة الأصعب</h3>
          ${hardest.map(h => `
            <div style="padding:10px;background:#fee2e2;border-radius:8px;margin-bottom:6px">
              <div style="font-size:13px">نسبة الإتقان: ${Math.round((h.rate || 0) * 100)}%</div>
            </div>
          `).join('')}
        ` : ''}
      `;
    });
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
  }
}

/* ============================================================
   صفحة النقاط (من Roster)
   ============================================================ */
function renderPointsFromRoster() {
  // أعد استخدام صفحة roster مع التركيز على النقاط
  return renderRosterPage().then(() => {
    const card = document.getElementById('points-card');
    if (card) {
      card.style.display = 'block';
      card.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  });
}

/* ============================================================
   Boot
   ============================================================ */
document.addEventListener('DOMContentLoaded', () => {
  bootApp().catch(e => {
    console.error('Boot error:', e);
    toast('خطأ في بدء التطبيق: ' + e.message, 'error', 6000);
  });
});