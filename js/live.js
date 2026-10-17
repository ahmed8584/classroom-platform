/* ============================================================
   live.js — شاشة الحصة المباشرة
   ============================================================ */

const LiveState = {
  currentSession: null,
  participants: [],
  pollInterval: null,
  currentLesson: null
};

/* ============================================================
   عرض الصفحة الرئيسية للحصص
   ============================================================ */
async function renderLivePage(sessionId = null) {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-live');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-live';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  if (sessionId) {
    await loadAndShowSession(sessionId);
  } else {
    showLiveHome();
  }
}

/* ============================================================
   الصفحة الرئيسية: قائمة الحصص
   ============================================================ */
async function showLiveHome() {
  const page = document.getElementById('page-live');
  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>📺 شاشة الحصة المباشرة</h2>
        <button class="btn btn-primary" id="btn-new-session" type="button">➕ حصة جديدة</button>
      </div>
      <p style="color:var(--text-muted);font-size:13px">
        💡 لبدء حصة جديدة، اختر درسًا من الاستوديو ثم اضغط "🚀 بدء حصة".
      </p>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📚 الحصص السابقة</h2>
        <button class="btn btn-ghost btn-sm" id="btn-refresh-sessions" type="button">🔄 تحديث</button>
      </div>
      <div id="live-sessions-list"></div>
    </div>
  `;

  document.getElementById('btn-new-session').onclick = () => {
    if (typeof renderStudioPage === 'function') renderStudioPage();
  };
  document.getElementById('btn-refresh-sessions').onclick = loadSessionsList;

  await loadSessionsList();
}

async function loadSessionsList() {
  const container = document.getElementById('live-sessions-list');
  if (!container) return;

  container.innerHTML = '<div class="empty">جارٍ التحميل...</div>';

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
        waiting: '⏳ بانتظار البدء',
        running: '🟢 جارية',
        ended: '⚫ منتهية'
      }[s.status] || s.status;

      const date = s.startedAt
        ? new Date(s.startedAt).toLocaleString('ar-OM', {
            year: 'numeric', month: 'short', day: 'numeric',
            hour: '2-digit', minute: '2-digit'
          })
        : '—';

      return `
        <div class="student-row" style="padding:14px">
          <div style="flex:1">
            <div style="font-weight:700;font-size:16px">رمز: ${escapeHtml(s.code)}</div>
            <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
              ${status} • ${date}
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-primary btn-sm" data-open-session="${s.id}" type="button">فتح</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-open-session]').forEach(btn => {
      btn.onclick = () => loadAndShowSession(btn.dataset.openSession);
    });
  } catch (e) {
    container.innerHTML = `<div class="empty">خطأ: ${escapeHtml(e.message)}</div>`;
  }
}

/* ============================================================
   عرض حصة محددة
   ============================================================ */
async function loadAndShowSession(sessionId) {
  try {
    const session = await Api.getSession(sessionId);
    LiveState.currentSession = session;

    let lesson = null;
    if (session.lessonId) {
      try {
        lesson = await Api.getLesson(session.lessonId);
        LiveState.currentLesson = lesson;
      } catch (e) {
        // تجاهل
      }
    }

    // احفظ الجلسة النشطة
    sessionStorage.setItem('active_session_id', sessionId);

    renderSessionScreen();
    startPolling(sessionId);
  } catch (e) {
    toast('خطأ: ' + e.message, 'error');
    showLiveHome();
  }
}

function renderSessionScreen() {
  const page = document.getElementById('page-live');
  const session = LiveState.currentSession;
  if (!page || !session) return;

  const lesson = LiveState.currentLesson;
  const isEnded = session.status === 'ended';

  page.innerHTML = `
    <div class="card" style="text-align:center;background:linear-gradient(135deg,#eff6ff,#f5f3ff)">
      <div style="font-size:14px;color:var(--text-muted);margin-bottom:8px">
        📺 شاشة الحصة — عرض للطلاب
      </div>
      <div style="font-size:16px;color:var(--text-muted);margin-bottom:6px">
        رمز الانضمام:
      </div>
      <div class="code" style="font-family:monospace;font-size:52px;letter-spacing:10px;color:var(--primary);font-weight:900;padding:16px;background:#fff;border-radius:14px;display:inline-block;box-shadow:var(--shadow);margin-bottom:12px">
        ${escapeHtml(session.code)}
      </div>
      <div style="font-size:13px;color:var(--text-muted)">
        👉 يدخل الطالب إلى المنصة → يختار "انضمام" → يُدخل الرمز واسمه
      </div>
    </div>

    ${lesson ? `
      <div class="card">
        <div class="card-header">
          <h2>📖 ${escapeHtml(lesson.title || 'الحصة')}</h2>
        </div>
        <div style="color:var(--text-muted);font-size:13px">
          ${escapeHtml(lesson.subject || '')} ${lesson.grade ? '• ' + escapeHtml(lesson.grade) : ''}
        </div>
      </div>
    ` : ''}

    <div class="card">
      <div class="card-header">
        <h2>👥 المشاركون (<span id="live-participants-count">0</span>)</h2>
        <div class="row">
          <button class="btn btn-ghost btn-sm" id="btn-refresh-participants" type="button">🔄 تحديث</button>
          <button class="btn btn-ghost btn-sm" id="btn-open-games-live" type="button">🎮 الألعاب</button>
        </div>
      </div>
      <div id="live-participants-list">
        <div class="empty">لا يوجد مشاركون بعد</div>
      </div>
    </div>

    <div class="card">
      <div class="row row-end">
        ${!isEnded ? `
          <button class="btn btn-danger" id="btn-end-session" type="button">🔴 إنهاء الحصة</button>
        ` : `
          <button class="btn btn-ghost" id="btn-reopen-session" type="button">🔄 إعادة فتح</button>
        `}
        <button class="btn btn-ghost" id="btn-back-to-sessions" type="button">⬅️ قائمة الحصص</button>
      </div>
    </div>
  `;

  // الأحداث
  document.getElementById('btn-refresh-participants').onclick = refreshParticipants;
  document.getElementById('btn-open-games-live').onclick = () => {
    if (typeof renderGamesPage === 'function') renderGamesPage();
  };
  document.getElementById('btn-back-to-sessions').onclick = () => {
    stopPolling();
    showLiveHome();
  };

  const endBtn = document.getElementById('btn-end-session');
  if (endBtn) {
    endBtn.onclick = endCurrentSession;
  }

  const reopenBtn = document.getElementById('btn-reopen-session');
  if (reopenBtn) {
    reopenBtn.onclick = reopenCurrentSession;
  }

  refreshParticipants();
}

/* ============================================================
   التحديث الدوري للمشاركين
   ============================================================ */
function startPolling(sessionId) {
  stopPolling();
  LiveState.pollInterval = setInterval(() => {
    refreshParticipants();
  }, window.APP_CONFIG.POLL_INTERVAL || 3000);
}

function stopPolling() {
  if (LiveState.pollInterval) {
    clearInterval(LiveState.pollInterval);
    LiveState.pollInterval = null;
  }
}

async function refreshParticipants() {
  const session = LiveState.currentSession;
  if (!session) return;

  try {
    const participants = await Api.listParticipants(session.id);
    LiveState.participants = participants || [];
    renderParticipantsList();
  } catch (e) {
    log('refreshParticipants error', e.message);
  }
}

function renderParticipantsList() {
  const container = document.getElementById('live-participants-list');
  const countEl = document.getElementById('live-participants-count');
  if (!container) return;

  const list = LiveState.participants;

  if (countEl) countEl.textContent = list.length;

  if (!list.length) {
    container.innerHTML = '<div class="empty">لا يوجد مشاركون بعد</div>';
    return;
  }

  const sorted = [...list].sort((a, b) => (b.score || 0) - (a.score || 0));

  container.innerHTML = sorted.map((p, i) => {
    const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : '';
    const initial = getInitial(p.name);
    const color = colorFromName(p.name);

    return `
      <div class="student-row" style="padding:12px;align-items:center">
        <div class="student-avatar" style="background:${color}">${escapeHtml(initial)}</div>
        <div style="flex:1">
          <div style="font-weight:700">${medal} ${escapeHtml(p.name)}</div>
        </div>
        <div style="font-size:18px;font-weight:900;color:var(--primary)">
          ${p.score || 0}
        </div>
      </div>
    `;
  }).join('');
}

/* ============================================================
   إنهاء / إعادة فتح الحصة
   ============================================================ */
async function endCurrentSession() {
  const session = LiveState.currentSession;
  if (!session) return;

  const ok = await confirmAction(
    '🔴 هل تريد إنهاء الحصة؟<br><br>لن يتمكن الطلاب من الانضمام بعد ذلك.',
    'إنهاء'
  );
  if (!ok) return;

  try {
    await Api.updateSession({ id: session.id, status: 'ended' });
    session.status = 'ended';
    stopPolling();
    toast('تم إنهاء الحصة', 'success');
    renderSessionScreen();
  } catch (e) {
    toast(e.message, 'error');
  }
}

async function reopenCurrentSession() {
  const session = LiveState.currentSession;
  if (!session) return;

  try {
    await Api.updateSession({ id: session.id, status: 'running' });
    session.status = 'running';
    toast('تم إعادة فتح الحصة', 'success');
    renderSessionScreen();
    startPolling(session.id);
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   صفحة انضمام الطالب
   ============================================================ */
async function renderJoinPage() {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-join');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-join';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  // تحقق إن كان الطالب منضمًا مسبقًا
  const savedId = sessionStorage.getItem('student_participant_id');
  const savedName = sessionStorage.getItem('student_name');
  const savedSessionId = sessionStorage.getItem('active_session_id');

  if (savedId && savedName && savedSessionId) {
    renderStudentScreen();
    return;
  }

  page.innerHTML = `
    <div style="max-width:520px;margin:40px auto">
      <div class="card" style="text-align:center;padding:32px 24px">
        <div style="font-size:60px;line-height:1;margin-bottom:16px">🎓</div>
        <h2 style="color:var(--primary);margin-bottom:8px">الانضمام إلى حصة</h2>
        <p style="color:var(--text-muted);font-size:14px;margin-bottom:20px">
          أدخل رمز الحصة الذي عرضه المعلم
        </p>

        <label style="text-align:right">رمز الحصة</label>
        <input type="text" id="join-code" maxlength="6"
               style="text-transform:uppercase;text-align:center;font-size:32px;letter-spacing:8px;font-family:monospace;font-weight:800"
               placeholder="ABC123">

        <label style="text-align:right;margin-top:14px">اسمك</label>
        <input type="text" id="join-name" placeholder="اكتب اسمك">

        <button class="btn btn-primary btn-lg" id="join-btn"
                style="width:100%;margin-top:20px;font-size:16px" type="button">
          🚀 دخول
        </button>

        <div id="join-error" style="color:var(--danger);font-size:13px;margin-top:12px;min-height:20px;font-weight:600"></div>
      </div>
    </div>
  `;

  const codeInput = document.getElementById('join-code');
  const nameInput = document.getElementById('join-name');
  const btn = document.getElementById('join-btn');
  const errEl = document.getElementById('join-error');

  setTimeout(() => codeInput.focus(), 100);

  async function doJoin() {
    const code = codeInput.value.trim().toUpperCase();
    const name = nameInput.value.trim();

    if (!code) { errEl.textContent = 'أدخل رمز الحصة'; return; }
    if (!name) { errEl.textContent = 'أدخل اسمك'; return; }

    errEl.textContent = '';
    btn.disabled = true;
    btn.textContent = '⏳ جارٍ الدخول...';

    try {
      const studentCode = localStorage.getItem('student_code')
        || 'st_' + Date.now().toString(36);
      localStorage.setItem('student_code', studentCode);

      const participant = await Api.join({ code, name, studentCode });

      sessionStorage.setItem('student_participant_id', participant.id);
      sessionStorage.setItem('student_name', name);
      sessionStorage.setItem('active_session_id', participant.sessionId);

      flash('🎉 مرحبًا ' + name, 1500);
      setTimeout(() => renderStudentScreen(), 800);
    } catch (e) {
      errEl.textContent = e.message;
    } finally {
      btn.disabled = false;
      btn.textContent = '🚀 دخول';
    }
  }

  btn.onclick = doJoin;
  codeInput.onkeydown = (e) => { if (e.key === 'Enter') nameInput.focus(); };
  nameInput.onkeydown = (e) => { if (e.key === 'Enter') doJoin(); };
}

/* ============================================================
   شاشة الطالب
   ============================================================ */
async function renderStudentScreen() {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-student');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-student';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  const participantId = sessionStorage.getItem('student_participant_id');
  const name = sessionStorage.getItem('student_name') || 'طالب';
  const sessionId = sessionStorage.getItem('active_session_id');

  if (!participantId || !sessionId) {
    renderJoinPage();
    return;
  }

  page.innerHTML = `
    <div class="card" style="text-align:center;background:linear-gradient(135deg,#eff6ff,#f5f3ff)">
      <div style="font-size:60px;line-height:1">👋</div>
      <h2 style="color:var(--primary);margin:12px 0 6px">مرحبًا ${escapeHtml(name)}</h2>
      <p style="color:var(--text-muted);font-size:14px">أنت الآن في الحصة</p>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📊 تقدمك</h2>
      </div>
      <div id="student-progress">
        <div class="empty">جارٍ التحميل...</div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>🎮 الألعاب المتاحة</h2>
      </div>
      <p style="color:var(--text-muted);font-size:13px">
        انتظر تعليمات المعلم لبدء النشاط.
      </p>
    </div>

    <div class="card">
      <div class="row row-center">
        <button class="btn btn-ghost" id="btn-student-logout" type="button">🚪 خروج من الحصة</button>
      </div>
    </div>
  `;

  document.getElementById('btn-student-logout').onclick = () => {
    sessionStorage.removeItem('student_participant_id');
    sessionStorage.removeItem('student_name');
    sessionStorage.removeItem('active_session_id');
    renderJoinPage();
  };

  // جدّد نقاط الطالب دوريًا
  async function refreshStudentProgress() {
    try {
      const participants = await Api.listParticipants(sessionId);
      const me = participants.find(p => p.id === participantId);
      if (!me) return;

      const container = document.getElementById('student-progress');
      if (!container) return;

      const rank = participants
        .sort((a, b) => (b.score || 0) - (a.score || 0))
        .findIndex(p => p.id === participantId) + 1;

      container.innerHTML = `
        <div class="row" style="gap:12px">
          <div class="stat-card">
            <div class="stat-label">نقاطك</div>
            <div class="stat-value">${me.score || 0}</div>
          </div>
          <div class="stat-card green">
            <div class="stat-label">ترتيبك</div>
            <div class="stat-value">${rank} / ${participants.length}</div>
          </div>
        </div>
      `;
    } catch (e) {
      log('student refresh error', e.message);
    }
  }

  await refreshStudentProgress();
  setInterval(refreshStudentProgress, window.APP_CONFIG.POLL_INTERVAL || 3000);
}