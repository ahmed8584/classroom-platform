/* ============================================================
   دوال مساعدة عامة
   ============================================================ */

/* ---------- إنشاء عنصر DOM ---------- */
function h(tag, attrs, ...children) {
  const el = document.createElement(tag);

  if (attrs) {
    for (const [key, value] of Object.entries(attrs)) {
      if (value === null || value === undefined || value === false) continue;

      if (key === 'onclick' || key === 'oninput' || key === 'onchange'
          || key === 'onsubmit' || key === 'onkeydown') {
        el[key] = value;
      } else if (key === 'class' || key === 'className') {
        el.className = value;
      } else if (key === 'style' && typeof value === 'object') {
        Object.assign(el.style, value);
      } else if (key === 'html') {
        el.innerHTML = value;
      } else if (key === 'text') {
        el.textContent = value;
      } else if (key === 'dataset' && typeof value === 'object') {
        Object.assign(el.dataset, value);
      } else {
        el.setAttribute(key, value);
      }
    }
  }

  children.flat().forEach(child => {
    if (child === null || child === undefined || child === false) return;
    if (child instanceof Node) {
      el.appendChild(child);
    } else {
      el.appendChild(document.createTextNode(String(child)));
    }
  });

  return el;
}

/* ---------- اختصار document.getElementById ---------- */
function $(id) {
  return document.getElementById(id);
}

/* ---------- اختصار querySelector ---------- */
function $$(selector) {
  return document.querySelector(selector);
}

function $$$(selector) {
  return document.querySelectorAll(selector);
}

/* ---------- Toast (رسائل منبثقة) ---------- */
function toast(message, type = 'info', duration = 2500) {
  const container = $('toast-container');
  if (!container) return;

  const icons = {
    info: 'ℹ️',
    success: '✅',
    error: '❌',
    warn: '⚠️'
  };

  const el = h('div', { class: `toast toast-${type}` },
    h('span', {}, icons[type] || ''),
    h('span', {}, message)
  );

  container.appendChild(el);

  requestAnimationFrame(() => el.classList.add('show'));

  setTimeout(() => {
    el.classList.remove('show');
    setTimeout(() => el.remove(), 300);
  }, duration);
}

/* ---------- Flash (شاشة ملء عند الإنجاز) ---------- */
function flash(text, duration = 1800) {
  const overlay = $('flash-overlay');
  if (!overlay) return;

  overlay.textContent = text;
  overlay.classList.add('show', 'flash');

  setTimeout(() => {
    overlay.classList.remove('show', 'flash');
  }, duration);
}

/* ---------- تأخير ---------- */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* ---------- خلط مصفوفة (Fisher-Yates) ---------- */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/* ---------- اختيار عنصر عشوائي ---------- */
function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

/* ---------- حماية HTML من الأحرف الخاصة ---------- */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;'
  }[c]));
}

/* ---------- تهيئة نص للعرض كـ HTML آمن ---------- */
function safe(str) {
  return escapeHtml(str);
}

/* ---------- تنسيق الوقت (ثواني → MM:SS) ---------- */
function formatTime(seconds) {
  seconds = Math.max(0, Math.floor(seconds));
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
}

/* ---------- أول حرف من الاسم ---------- */
function getInitial(name) {
  if (!name) return '؟';
  return String(name).trim().charAt(0);
}

/* ---------- توليد معرف فريد ---------- */
function uid(prefix = 'id') {
  return prefix + '_' + Date.now().toString(36)
    + Math.random().toString(36).slice(2, 6);
}

/* ---------- لون ثابت من الاسم ---------- */
function colorFromName(name) {
  const colors = window.APP_CONFIG?.AVATAR_COLORS || ['#1e3a8a'];
  if (!name) return colors[0];

  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = name.charCodeAt(i) + ((hash << 5) - hash);
  }
  return colors[Math.abs(hash) % colors.length];
}

/* ---------- الحصول على لون الطالب ---------- */
function getStudentColor(student) {
  if (!student) return colorFromName('');
  const colors = window.APP_CONFIG?.AVATAR_COLORS || [];
  if (student.avatar && colors.includes(student.avatar)) {
    return student.avatar;
  }
  return colorFromName(student.name);
}

/* ---------- بناء HTML للأفاتار ---------- */
function avatarHTML(student, size = 'md') {
  if (!student) return '';
  const color = getStudentColor(student);
  const initial = getInitial(student.name);
  const sizeClass = size === 'sm' ? ' sm' : size === 'lg' ? ' lg' : '';

  return `<div class="student-avatar${sizeClass}" style="background:${color}">${escapeHtml(initial)}</div>`;
}

/* ---------- Modal ---------- */
function openModal(title, buildFn, options = {}) {
  closeAllModals();

  const overlay = h('div', { class: 'modal-overlay' });
  const modal = h('div', { class: 'modal' });

  const header = h('div', { class: 'modal-header' },
    h('h2', {}, title),
    h('button', { class: 'modal-close', type: 'button', onclick: closeAllModals }, '✕')
  );

  const body = h('div', { class: 'modal-body' });

  modal.appendChild(header);
  modal.appendChild(body);

  if (options.footer) {
    modal.appendChild(options.footer);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener('click', (e) => {
    if (e.target === overlay && options.closeOnBackdrop !== false) {
      closeAllModals();
    }
  });

  document.addEventListener('keydown', function escHandler(e) {
    if (e.key === 'Escape') {
      closeAllModals();
      document.removeEventListener('keydown', escHandler);
    }
  });

  if (buildFn) buildFn(body, modal);

  return { overlay, modal, body };
}

function closeAllModals() {
  document.querySelectorAll('.modal-overlay').forEach(m => m.remove());
}

/* ---------- تنزيل ملف ---------- */
function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

/* ---------- تأكيد مع رسالة عربية ---------- */
function confirmAction(message, confirmText = 'تأكيد') {
  return new Promise(resolve => {
    const footer = h('div', { class: 'modal-footer' },
      h('button', {
        class: 'btn btn-ghost',
        type: 'button',
        onclick: () => { closeAllModals(); resolve(false); }
      }, 'إلغاء'),
      h('button', {
        class: 'btn btn-danger',
        type: 'button',
        onclick: () => { closeAllModals(); resolve(true); }
      }, confirmText)
    );

    openModal('تأكيد الإجراء', (body) => {
      body.appendChild(h('p', { style: 'font-size:15px;line-height:1.7' }, message));
    }, { footer });
  });
}

/* ---------- إشعار المتصفح ---------- */
function sendNotification(title, body) {
  try {
    if (!('Notification' in window)) return;
    if (Notification.permission !== 'granted') return;

    new Notification(title, {
      body,
      icon: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><text y="78" font-size="78">🎓</text></svg>',
      tag: 'classroom-notification'
    });
  } catch (e) {
    // تجاهل الأخطاء
  }
}

/* ---------- صوت بسيط ---------- */
function playBeep(frequency = 880, duration = 0.8) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.frequency.value = frequency;
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);

    osc.start();
    osc.stop(ctx.currentTime + duration);
  } catch (e) {
    // تجاهل
  }
}

/* ---------- تسجيل في Console بتنسيق ---------- */
function log(label, data) {
  console.log(`%c[${label}]`, 'color:#2563eb;font-weight:bold', data ?? '');
}