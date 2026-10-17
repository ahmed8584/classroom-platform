/* ============================================================
   الاتصال بـ Apps Script API
   يستخدم fetch مع POST (لتفادي قيود URL)
   ============================================================ */

const API = {
  /* رابط الخادم */
  url: null,

  /* هل الاتصال جاهز؟ */
  ready: false,

  /* ---------- تهيئة ---------- */
  init() {
    this.url = window.APP_CONFIG?.API_URL;
    if (!this.url || this.url.includes('ضع_هنا')) {
      console.warn('⚠️ لم يتم ضبط API_URL في config.js');
      return false;
    }
    this.ready = true;
    log('API', 'جاهز: ' + this.url.slice(0, 60) + '...');
    return true;
  },

  /* ---------- استدعاء عام ---------- */
  async call(action, params = {}) {
    if (!this.ready) {
      throw new Error('الخادم غير مهيأ. تحقق من config.js');
    }

    // ⭐ أضف token كلمة المرور تلقائيًا
    const token = sessionStorage.getItem('session_token');
    const payload = { action, ...params };
    if (token && !payload.token) {
      payload.token = token;
    }
    try {
      const res = await fetch(this.url, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload),
        redirect: 'follow'
      });

      if (!res.ok) {
        throw new Error(`خطأ في الاتصال (${res.status})`);
      }

      const data = await res.json();

      if (!data.ok) {
        throw new Error(data.error || 'خطأ غير معروف');
      }

      return data.data;
    } catch (err) {
      log('API ERROR', { action, error: err.message });

      if (err.message.includes('Failed to fetch')) {
        throw new Error('تعذّر الاتصال بالخادم. تحقق من الإنترنت.');
      }
      throw err;
    }
  },

  /* ---------- GET (للاختبارات) ---------- */
  async get(action, params = {}) {
    if (!this.url) throw new Error('API not initialized');

    const query = new URLSearchParams({ action, ...params }).toString();
    const res = await fetch(`${this.url}?${query}`);
    const data = await res.json();

    if (!data.ok) throw new Error(data.error);
    return data.data;
  },

  /* ---------- رفع دفعة (bulk) ---------- */
  async callBulk(action, items, params = {}) {
    return this.call(action, { ...params, items: JSON.stringify(items) });
  }
};

/* ============================================================
   واجهة مبسّطة للاستدعاءات الشائعة
   ============================================================ */

const Api = {
  // Auth
  me:              () => API.call('me'),
  verifyPassword:  (password) => API.call('password.verify', { password }),
  validateToken:   (token) => API.call('password.validate', { token }),
  changePassword:  (oldP, newP, token) => API.call('password.change', { old: oldP, newP, token }),
  logout:          (token) => API.call('password.logout', { token }),

  // Classes
  listClasses:     () => API.call('classes.list'),
  createClass:     (data) => API.call('classes.create', data),
  deleteClass:     (id) => API.call('classes.delete', { id }),
  copyClass:       (data) => API.call('classes.copy', data),
  promoteClass:    (data) => API.call('classes.promote', data),
  resetClassPoints:(classId, semester) => API.call('classes.reset', { classId, semester }),

  // Roster
  listRoster:      (classId) => API.call('roster.list', { classId }),
  addRoster:       (data) => API.call('roster.add', data),
  bulkRoster:      (classId, students) => API.call('roster.bulk', { classId, students }),
  updateRoster:    (data) => API.call('roster.update', data),
  deleteRoster:    (id) => API.call('roster.delete', { id }),
  deleteAllRoster: (classId) => API.call('roster.deleteAll', { classId }),

  // Points
  addPoints:       (data) => API.call('points.add', data),
  addPointsBulk:   (ids, delta, reason, semester) =>
                     API.call('points.bulk', { ids, delta, reason, semester }),
  resetPoints:     (classId, semester) => API.call('points.reset', { classId, semester }),

  // Analytics
  leaderboard:     (classId, semester) => API.call('analytics.leaderboard', { classId, semester }),
  compare:         (classId) => API.call('analytics.compare', { classId }),
  chart:           (classId) => API.call('analytics.chart', { classId }),
  exportClass:     (classId) => API.call('analytics.export', { classId }),

  // Lessons
  listLessons:     () => API.call('lessons.list'),
  getLesson:       (id) => API.call('lessons.get', { id }),
  saveLesson:      (data) => API.call('lessons.save', data),
  deleteLesson:    (id) => API.call('lessons.delete', { id }),

  // Questions
  listQuestions:   () => API.call('questions.list'),
  saveQuestion:    (data) => API.call('questions.save', data),
  deleteQuestion:  (id) => API.call('questions.delete', { id }),
  randomQuestions: (count) => API.call('questions.random', { count }),

  // Sessions
  createSession:   (data) => API.call('sessions.create', data),
  getSession:      (id) => API.call('sessions.get', { id }),
  updateSession:   (data) => API.call('sessions.update', data),
  sessionByCode:   (code) => API.call('sessions.byCode', { code }),
  listSessions:    () => API.call('sessions.list'),

  // Join & Answers
  join:            (data) => API.call('join', data),
  listParticipants:(sessionId) => API.call('participants.list', { sessionId }),
  submitAnswer:    (data) => API.call('answer.submit', data),

  // Games & Reports
  saveGame:        (data) => API.call('game.save', data),
  listGames:       (sessionId) => API.call('game.list', { sessionId }),
  sessionReport:   (id) => API.call('report.session', { id }),

  // AI
  aiGenerate:      (data) => API.call('ai.generate', data)
};