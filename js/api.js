/* ============================================================
   الاتصال بـ Apps Script API
   يستخدم JSONP (يدعم CORS من GitHub Pages)
   ============================================================ */

const API = {
  url: null,
  ready: false,

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

  /* ---------- استدعاء JSONP (يعمل من GitHub Pages) ---------- */
  call(action, params = {}) {
    return new Promise((resolve, reject) => {
      if (!this.ready) {
        return reject(new Error('الخادم غير مهيأ. تحقق من config.js'));
      }

      const token = sessionStorage.getItem('session_token');
      const payload = { action, ...params };
      if (token && !payload.token) {
        payload.token = token;
      }

      const callbackName = 'jsonp_cb_' + Date.now() + '_' + Math.floor(Math.random() * 9999);
      
      window[callbackName] = (data) => {
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        
        if (data && data.ok) {
          resolve(data.data);
        } else {
          reject(new Error(data?.error || 'خطأ غير معروف'));
        }
      };

      const query = new URLSearchParams({ ...payload, callback: callbackName }).toString();
      const script = document.createElement('script');
      script.src = this.url + '?' + query;

      script.onerror = () => {
        delete window[callbackName];
        if (script.parentNode) script.parentNode.removeChild(script);
        reject(new Error('فشل الاتصال بالخادم. تحقق من الإنترنت.'));
      };

      document.body.appendChild(script);
    });
  },

  async get(action, params = {}) {
    return this.call(action, params);
  }
};

const Api = {
  me:              () => API.call('me'),
  verifyPassword:  (password) => API.call('password.verify', { password }),
  validateToken:   (token) => API.call('password.validate', { token }),
  changePassword:  (oldP, newP, token) => API.call('password.change', { old: oldP, newP, token }),
  logout:          (token) => API.call('password.logout', { token }),
  
  listClasses:     () => API.call('classes.list'),
  createClass:     (data) => API.call('classes.create', data),
  deleteClass:     (id) => API.call('classes.delete', { id }),
  copyClass:       (data) => API.call('classes.copy', data),
  promoteClass:    (data) => API.call('classes.promote', data),
  resetClassPoints:(classId, semester) => API.call('classes.reset', { classId, semester }),

  listRoster:      (classId) => API.call('roster.list', { classId }),
  addRoster:       (data) => API.call('roster.add', data),
  bulkRoster:      (classId, students) => API.call('roster.bulk', { classId, students }),
  updateRoster:    (data) => API.call('roster.update', data),
  deleteRoster:    (id) => API.call('roster.delete', { id }),
  deleteAllRoster: (classId) => API.call('roster.deleteAll', { classId }),

  addPoints:       (data) => API.call('points.add', data),
  addPointsBulk:   (ids, delta, reason, semester) => API.call('points.bulk', { ids, delta, reason, semester }),
  resetPoints:     (classId, semester) => API.call('points.reset', { classId, semester }),

  leaderboard:     (classId, semester) => API.call('analytics.leaderboard', { classId, semester }),
  compare:         (classId) => API.call('analytics.compare', { classId }),
  chart:           (classId) => API.call('analytics.chart', { classId }),
  exportClass:     (classId) => API.call('analytics.export', { classId }),

  listLessons:     () => API.call('lessons.list'),
  getLesson:       (id) => API.call('lessons.get', { id }),
  saveLesson:      (data) => API.call('lessons.save', data),
  deleteLesson:    (id) => API.call('lessons.delete', { id }),

  listQuestions:   () => API.call('questions.list'),
  saveQuestion:    (data) => API.call('questions.save', data),
  deleteQuestion:  (id) => API.call('questions.delete', { id }),
  randomQuestions: (count) => API.call('questions.random', { count }),

  createSession:   (data) => API.call('sessions.create', data),
  getSession:      (id) => API.call('sessions.get', { id }),
  updateSession:   (data) => API.call('sessions.update', data),
  sessionByCode:   (code) => API.call('sessions.byCode', { code }),
  listSessions:    () => API.call('sessions.list'),

  join:            (data) => API.call('join', data),
  listParticipants:(sessionId) => API.call('participants.list', { sessionId }),
  submitAnswer:    (data) => API.call('answer.submit', data),

  saveGame:        (data) => API.call('game.save', data),
  listGames:       (sessionId) => API.call('game.list', { sessionId }),
  sessionReport:   (id) => API.call('report.session', { id }),

  aiGenerate:      (data) => API.call('ai.generate', data)
};
