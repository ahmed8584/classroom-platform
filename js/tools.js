/* ============================================================
   tools.js — الأدوات الصفية التفاعلية
   العجلة + المؤقت + ساعة الإيقاف + المجموعات + المقارنة + الرسم البياني
   ============================================================ */

/* ============================================================
   حالة الأدوات
   ============================================================ */
const ToolsState = {
  wheelRotation: 0,
  wheelSpinning: false,
  wheelStudents: [],
  timer: {
    interval: null,
    remaining: 0,
    total: 0
  },
  stopwatch: {
    interval: null,
    startTime: 0,
    elapsed: 0,
    laps: []
  },
  charts: {
    analytics: null,
    comparison: null
  }
};

/* ============================================================
   🎡 العجلة — Canvas
   ============================================================ */
async function renderWheelTool() {
  const content = document.getElementById('content');
  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-tools-wheel');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-tools-wheel';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  // احصل على الطلاب من RosterState إن وُجدت
  const students = (typeof RosterState !== 'undefined' && RosterState.students)
    ? RosterState.students
    : [];

  ToolsState.wheelStudents = students;

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>🎡 عجلة اختيار طالب عشوائي</h2>
        <button class="btn btn-ghost btn-sm" onclick="loadStudentsForWheel()">🔄 تحديث القائمة</button>
      </div>

      ${!students.length
        ? '<div class="empty">لا يوجد طلاب. اختر صفًا من صفحة الطلاب أولًا.</div>'
        : `
        <div class="wheel-wrap">
          <div class="wheel-pointer"></div>
          <canvas id="wheel-canvas" width="600" height="600"></canvas>
          <div class="wheel-center" id="wheel-center-btn">ابدأ</div>
        </div>

        <div class="row row-center" style="margin-top:14px">
          <button class="btn btn-ghost" id="btn-redraw-wheel" type="button">🔄 إعادة رسم</button>
          <button class="btn btn-success" id="btn-spin-wheel" type="button">🎯 لف العجلة</button>
          <button class="btn btn-accent" id="btn-random-pick" type="button">🎲 اختيار سريع</button>
        </div>

        <div id="wheel-result" class="empty" style="font-size:20px;font-weight:800">
          لم يتم الاختيار بعد
        </div>
        `}
    </div>
  `;

  if (students.length) {
    drawWheel();
    document.getElementById('btn-spin-wheel').onclick = spinWheel;
    document.getElementById('btn-redraw-wheel').onclick = drawWheel;
    document.getElementById('btn-random-pick').onclick = randomPickStudent;
    document.getElementById('wheel-center-btn').onclick = spinWheel;
  }
}

async function loadStudentsForWheel() {
  if (typeof loadStudents === 'function' && RosterState.currentClassId) {
    await loadStudents();
  }
  await renderWheelTool();
}

/* ألوان العجلة */
const WHEEL_COLORS = [
  '#1e3a8a', '#2563eb', '#16a34a', '#dc2626', '#f59e0b',
  '#7c3aed', '#0891b2', '#ea580c', '#be185d', '#65a30d'
];

function drawWheel() {
  const canvas = document.getElementById('wheel-canvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const size = canvas.width;
  const c = size / 2;
  const r = c - 20;

  ctx.clearRect(0, 0, size, size);

  const students = ToolsState.wheelStudents;
  if (!students.length) return;

  const step = (2 * Math.PI) / students.length;

  students.forEach((s, i) => {
    const start = i * step - Math.PI / 2;
    const end = start + step;

    // قطاع
    ctx.beginPath();
    ctx.moveTo(c, c);
    ctx.arc(c, c, r, start, end);
    ctx.closePath();
    ctx.fillStyle = WHEEL_COLORS[i % WHEEL_COLORS.length];
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 3;
    ctx.stroke();

    // اسم الطالب
    ctx.save();
    ctx.translate(c, c);
    ctx.rotate(start + step / 2);
    ctx.textAlign = 'right';
    ctx.fillStyle = '#fff';
    ctx.font = 'bold 22px Segoe UI, Tahoma, sans-serif';
    const label = s.name.length > 15 ? s.name.slice(0, 14) + '…' : s.name;
    ctx.fillText(label, r - 20, 8);
    ctx.restore();
  });

  canvas.style.transform = `rotate(${ToolsState.wheelRotation}deg)`;
}

function spinWheel() {
  if (ToolsState.wheelSpinning) return;

  const students = ToolsState.wheelStudents;
  if (!students.length) {
    toast('لا يوجد طلاب', 'warn');
    return;
  }

  ToolsState.wheelSpinning = true;
  const canvas = document.getElementById('wheel-canvas');
  const duration = 4500;
  const startRot = ToolsState.wheelRotation;
  const targetRot = startRot + 360 * (5 + Math.floor(Math.random() * 4)) + Math.random() * 360;
  const t0 = performance.now();

  function animate(t) {
    const p = Math.min((t - t0) / duration, 1);
    const eased = 1 - Math.pow(1 - p, 3);
    ToolsState.wheelRotation = startRot + (targetRot - startRot) * eased;
    canvas.style.transform = `rotate(${ToolsState.wheelRotation}deg)`;

    if (p < 1) {
      requestAnimationFrame(animate);
    } else {
      ToolsState.wheelSpinning = false;

      const anglePerSeg = 360 / students.length;
      const normalized = ((-ToolsState.wheelRotation % 360) + 360) % 360;
      const idx = Math.floor(normalized / anglePerSeg) % students.length;
      const winner = students[idx];

      document.getElementById('wheel-result').innerHTML =
        `<div style="font-size:28px;font-weight:900;color:var(--primary)">
          🎉 ${escapeHtml(winner.name)}
        </div>`;

      flash('🎉 ' + winner.name, 2000);
      toast('الفائز: ' + winner.name, 'success');
      playBeep(880, 0.6);
    }
  }
  requestAnimationFrame(animate);
}

function randomPickStudent() {
  const students = ToolsState.wheelStudents;
  if (!students.length) {
    toast('لا يوجد طلاب', 'warn');
    return;
  }

  const winner = students[Math.floor(Math.random() * students.length)];
  document.getElementById('wheel-result').innerHTML =
    `<div style="font-size:28px;font-weight:900;color:var(--success)">
      🎲 ${escapeHtml(winner.name)}
    </div>`;
  flash('🎲 ' + winner.name, 1800);
}

/* ============================================================
   ⏱️ المؤقت التنازلي
   ============================================================ */
function renderTimerTool() {
  const content = document.getElementById('content');
  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-tools-timer');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-tools-timer';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>⏱️ المؤقت التنازلي</h2>
      </div>

      <div class="row row-center" style="margin-bottom:16px">
        <input type="number" id="timer-min" value="5" min="0" max="99" style="width:80px;text-align:center">
        <span style="font-weight:700">دقيقة</span>
        <input type="number" id="timer-sec" value="0" min="0" max="59" style="width:80px;text-align:center">
        <span style="font-weight:700">ثانية</span>
      </div>

      <div class="timer-display" id="timer-display">05:00</div>

      <div class="row row-center">
        <button class="btn btn-success" id="btn-timer-start" type="button">▶️ بدء</button>
        <button class="btn btn-ghost" id="btn-timer-pause" type="button">⏸️ إيقاف</button>
        <button class="btn btn-danger" id="btn-timer-reset" type="button">🔄 إعادة</button>
      </div>

      <div class="row row-center" style="margin-top:18px;gap:8px;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm timer-preset" data-min="1" type="button">1 د</button>
        <button class="btn btn-ghost btn-sm timer-preset" data-min="3" type="button">3 د</button>
        <button class="btn btn-ghost btn-sm timer-preset" data-min="5" type="button">5 د</button>
        <button class="btn btn-ghost btn-sm timer-preset" data-min="10" type="button">10 د</button>
        <button class="btn btn-ghost btn-sm timer-preset" data-min="15" type="button">15 د</button>
        <button class="btn btn-ghost btn-sm timer-preset" data-min="20" type="button">20 د</button>
      </div>

      <div id="timer-status" style="margin-top:16px;text-align:center;font-size:13px;color:var(--text-muted)"></div>
    </div>
  `;

  updateTimerDisplay();
  updateNotifStatus();

  document.getElementById('btn-timer-start').onclick = startTimer;
  document.getElementById('btn-timer-pause').onclick = pauseTimer;
  document.getElementById('btn-timer-reset').onclick = resetTimer;

  page.querySelectorAll('.timer-preset').forEach(btn => {
    btn.onclick = () => {
      document.getElementById('timer-min').value = btn.dataset.min;
      document.getElementById('timer-sec').value = 0;
      resetTimer();
    };
  });
}

function updateTimerDisplay() {
  const el = document.getElementById('timer-display');
  if (!el) return;
  el.textContent = formatTime(ToolsState.timer.remaining);
}

function startTimer() {
  if (ToolsState.timer.interval) return;

  const min = Number(document.getElementById('timer-min').value) || 0;
  const sec = Number(document.getElementById('timer-sec').value) || 0;

  if (!ToolsState.timer.remaining) {
    ToolsState.timer.remaining = min * 60 + sec;
    ToolsState.timer.total = ToolsState.timer.remaining;
  }

  if (ToolsState.timer.remaining <= 0) {
    toast('أدخل وقتًا صحيحًا', 'warn');
    return;
  }

  updateTimerDisplay();

  ToolsState.timer.interval = setInterval(() => {
    ToolsState.timer.remaining--;
    updateTimerDisplay();

    if (ToolsState.timer.remaining <= 0) {
      clearInterval(ToolsState.timer.interval);
      ToolsState.timer.interval = null;

      flash('⏰ انتهى الوقت!', 2500);
      playBeep(880, 1.2);
      sendNotification('⏰ انتهى الوقت!', 'المؤقت وصل إلى الصفر');
      toast('انتهى الوقت!', 'success');
    }
  }, 1000);
}

function pauseTimer() {
  clearInterval(ToolsState.timer.interval);
  ToolsState.timer.interval = null;
}

function resetTimer() {
  pauseTimer();
  ToolsState.timer.remaining = 0;
  ToolsState.timer.total = 0;
  updateTimerDisplay();
}

/* ============================================================
   ⏲️ ساعة الإيقاف
   ============================================================ */
function renderStopwatchTool() {
  const content = document.getElementById('content');
  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-tools-stopwatch');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-tools-stopwatch';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>⏲️ ساعة الإيقاف</h2>
      </div>

      <div class="stopwatch-display" id="sw-display">00:00.0</div>

      <div class="row row-center">
        <button class="btn btn-success" id="btn-sw-start" type="button">▶️ بدء</button>
        <button class="btn btn-ghost" id="btn-sw-pause" type="button">⏸️ إيقاف</button>
        <button class="btn btn-danger" id="btn-sw-reset" type="button">🔄 تصفير</button>
        <button class="btn btn-accent" id="btn-sw-lap" type="button">🚩 لفة</button>
      </div>

      <div id="sw-laps" style="margin-top:20px"></div>
    </div>
  `;

  renderStopwatch();

  document.getElementById('btn-sw-start').onclick = startStopwatch;
  document.getElementById('btn-sw-pause').onclick = pauseStopwatch;
  document.getElementById('btn-sw-reset').onclick = resetStopwatch;
  document.getElementById('btn-sw-lap').onclick = lapStopwatch;
}

function renderStopwatch() {
  const el = document.getElementById('sw-display');
  if (!el) return;

  const elapsed = ToolsState.stopwatch.elapsed;
  const m = Math.floor(elapsed / 60000);
  const s = Math.floor((elapsed % 60000) / 1000);
  const d = Math.floor((elapsed % 1000) / 100);

  el.textContent = String(m).padStart(2, '0') + ':' +
                   String(s).padStart(2, '0') + '.' + d;
}

function startStopwatch() {
  if (ToolsState.stopwatch.interval) return;

  ToolsState.stopwatch.startTime = Date.now() - ToolsState.stopwatch.elapsed;

  ToolsState.stopwatch.interval = setInterval(() => {
    ToolsState.stopwatch.elapsed = Date.now() - ToolsState.stopwatch.startTime;
    renderStopwatch();
  }, 100);
}

function pauseStopwatch() {
  clearInterval(ToolsState.stopwatch.interval);
  ToolsState.stopwatch.interval = null;
}

function resetStopwatch() {
  pauseStopwatch();
  ToolsState.stopwatch.elapsed = 0;
  ToolsState.stopwatch.laps = [];
  renderStopwatch();

  const laps = document.getElementById('sw-laps');
  if (laps) laps.innerHTML = '';
}

function lapStopwatch() {
  if (!ToolsState.stopwatch.elapsed) return;

  const time = ToolsState.stopwatch.elapsed;
  ToolsState.stopwatch.laps.push(time);

  const lapsContainer = document.getElementById('sw-laps');
  if (!lapsContainer) return;

  const lapNum = ToolsState.stopwatch.laps.length;
  const lapDiv = document.createElement('div');
  lapDiv.style.cssText = 'padding:10px 14px;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center';
  lapDiv.innerHTML = `
    <span style="font-weight:700">لفة ${lapNum}</span>
    <span style="font-family:monospace;font-size:16px;font-weight:700;color:var(--primary)">
      ${(time / 1000).toFixed(2)} ث
    </span>
  `;

  lapsContainer.prepend(lapDiv);
}

/* ============================================================
   👥 المجموعات العشوائية
   ============================================================ */
function renderGroupsTool() {
  const content = document.getElementById('content');
  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-tools-groups');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-tools-groups';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>👥 تقسيم المجموعات</h2>
      </div>
      <div class="row">
        <label style="font-weight:700">عدد المجموعات:</label>
        <input type="number" id="groups-count" value="3" min="2" max="10" style="width:90px;text-align:center">
        <button class="btn btn-primary" id="btn-divide-groups" type="button">🎲 تقسيم عشوائي</button>
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-top:8px">
        💡 يُقسّم طلاب الصف المحدد حاليًا في صفحة الطلاب.
      </p>
    </div>

    <div id="groups-result"></div>
  `;

  document.getElementById('btn-divide-groups').onclick = divideGroupsNow;
}

function divideGroupsNow() {
  const students = (typeof RosterState !== 'undefined' && RosterState.students)
    ? RosterState.students
    : [];

  if (!students.length) {
    toast('لا يوجد طلاب. اختر صفًا أولًا.', 'warn');
    return;
  }

  const n = Number(document.getElementById('groups-count').value) || 2;
  if (n < 2) {
    toast('عدد المجموعات يجب أن يكون 2 على الأقل', 'warn');
    return;
  }

  if (students.length < n) {
    toast(`عدد الطلاب (${students.length}) أقل من عدد المجموعات (${n})`, 'warn');
    return;
  }

  const shuffled = shuffle(students);
  const groups = Array.from({ length: n }, () => []);

  shuffled.forEach((s, i) => {
    groups[i % n].push(s);
  });

  const colors = ['#1e3a8a', '#16a34a', '#f59e0b', '#dc2626', '#7c3aed', '#0891b2', '#ea580c'];

  document.getElementById('groups-result').innerHTML = groups.map((g, i) => `
    <div class="group-card" style="border-color:${colors[i % colors.length]}">
      <h3 style="color:${colors[i % colors.length]}">
        مجموعة ${i + 1} (${g.length} طالب)
      </h3>
      <ul>
        ${g.map(s => `<li>${avatarHTML(s, 'sm')} ${escapeHtml(s.name)}</li>`).join('')}
      </ul>
    </div>
  `).join('');

  toast('تم التقسيم', 'success');
}

/* ============================================================
   ⚖️ المقارنة (ف1 vs ف2)
   ============================================================ */
async function renderComparisonTool() {
  const content = document.getElementById('content');
  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-tools-comparison');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-tools-comparison';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>⚖️ مقارنة الفصلين</h2>
        <button class="btn btn-ghost btn-sm" id="btn-refresh-comparison" type="button">🔄 تحديث</button>
      </div>
      <div id="comparison-stats" class="row" style="gap:12px;margin-bottom:18px"></div>
      <div id="comparison-list"></div>
    </div>
  `;

  document.getElementById('btn-refresh-comparison').onclick = loadComparisonData;
  await loadComparisonData();
}

async function loadComparisonData() {
  const listContainer = document.getElementById('comparison-list');
  const statsContainer = document.getElementById('comparison-stats');

  if (!listContainer) return;

  if (!RosterState.currentClassId) {
    listContainer.innerHTML = '<div class="empty">اختر صفًا أولًا من صفحة الطلاب</div>';
    statsContainer.innerHTML = '';
    return;
  }

  listContainer.innerHTML = '<div class="empty">جارٍ التحميل...</div>';

  try {
    const data = await Api.compare(RosterState.currentClassId);

    if (!data.length) {
      listContainer.innerHTML = '<div class="empty">لا يوجد طلاب في هذا الصف</div>';
      statsContainer.innerHTML = '';
      return;
    }

    // إحصائيات
    const s1Total = data.reduce((a, s) => a + (s.s1 || 0), 0);
    const s2Total = data.reduce((a, s) => a + (s.s2 || 0), 0);
    const improved = data.filter(s => s.diff > 0).length;
    const declined = data.filter(s => s.diff < 0).length;
    const same = data.filter(s => s.diff === 0).length;

    statsContainer.innerHTML = `
      <div class="stat-card">
        <div class="stat-label">مجموع ف1</div>
        <div class="stat-value">${s1Total}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">مجموع ف2</div>
        <div class="stat-value">${s2Total}</div>
      </div>
      <div class="stat-card green">
        <div class="stat-label">📈 تحسّن</div>
        <div class="stat-value">${improved}</div>
      </div>
      <div class="stat-card red">
        <div class="stat-label">📉 تراجع</div>
        <div class="stat-value">${declined}</div>
      </div>
      <div class="stat-card">
        <div class="stat-label">➖ ثابت</div>
        <div class="stat-value" style="color:var(--text-muted)">${same}</div>
      </div>
    `;

    // قائمة
    listContainer.innerHTML = data.map(s => {
      const trend = s.diff > 0 ? '📈' : s.diff < 0 ? '📉' : '➖';
      const rowCls = s.diff > 0 ? 'up' : s.diff < 0 ? 'down' : 'same';
      const diffText = s.diff > 0 ? '+' + s.diff : String(s.diff);
      const studentObj = RosterState.students.find(x => x.id === s.id);
      const av = studentObj ? avatarHTML(studentObj, 'sm') : '';

      return `
        <div class="comparison-row ${rowCls}">
          <div class="cmp-name">${av} ${escapeHtml(s.name)}</div>
          <div class="cmp-sem">ف1: <b>${s.s1 || 0}</b></div>
          <div class="cmp-sem">ف2: <b>${s.s2 || 0}</b></div>
          <div class="cmp-sem">المجموع: <b>${s.total || 0}</b></div>
          <div class="cmp-diff">${trend} ${diffText}</div>
        </div>
      `;
    }).join('');
  } catch (e) {
    listContainer.innerHTML = `<div class="empty">خطأ: ${escapeHtml(e.message)}</div>`;
  }
}

/* ============================================================
   📈 الرسم البياني العام
   ============================================================ */
async function renderAnalyticsTool() {
  const content = document.getElementById('content');
  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-tools-analytics');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-tools-analytics';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>📈 تطور نقاط الطلاب</h2>
        <div class="row">
          <button class="btn btn-ghost btn-sm chart-type-btn active" data-chart="bar" type="button">📊 أعمدة</button>
          <button class="btn btn-ghost btn-sm chart-type-btn" data-chart="line" type="button">📈 خطي</button>
          <button class="btn btn-ghost btn-sm chart-type-btn" data-chart="doughnut" type="button">🍩 دائري</button>
        </div>
      </div>
      <div class="chart-container">
        <canvas id="analytics-chart"></canvas>
      </div>
    </div>
  `;

  page.querySelectorAll('.chart-type-btn').forEach(btn => {
    btn.onclick = () => {
      page.querySelectorAll('.chart-type-btn').forEach(b => b.classList.remove('active'));
      btn.classList.add('active');
      renderAnalyticsChart(btn.dataset.chart);
    };
  });

  await renderAnalyticsChart('bar');
}

async function renderAnalyticsChart(type = 'bar') {
  const canvas = document.getElementById('analytics-chart');
  if (!canvas) return;

  if (!RosterState.currentClassId) {
    toast('اختر صفًا أولًا', 'warn');
    return;
  }

  const students = RosterState.students;
  if (!students.length) {
    toast('لا يوجد طلاب في هذا الصف', 'warn');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (ToolsState.charts.analytics) {
    ToolsState.charts.analytics.destroy();
  }

  const labels = students.map(s => s.name);
  const s1Data = students.map(s => s.s1 || 0);
  const s2Data = students.map(s => s.s2 || 0);

  if (type === 'doughnut') {
    const total1 = s1Data.reduce((a, b) => a + b, 0);
    const total2 = s2Data.reduce((a, b) => a + b, 0);

    ToolsState.charts.analytics = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: ['الفصل الأول', 'الفصل الثاني'],
        datasets: [{
          data: [total1, total2],
          backgroundColor: ['#1e3a8a', '#16a34a'],
          borderColor: '#fff',
          borderWidth: 3
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom', labels: { font: { size: 14 } } }
        }
      }
    });
  } else {
    ToolsState.charts.analytics = new Chart(ctx, {
      type: type,
      data: {
        labels: labels,
        datasets: [
          {
            label: 'الفصل الأول',
            data: s1Data,
            backgroundColor: type === 'line' ? 'rgba(30,58,138,0.1)' : '#1e3a8a',
            borderColor: '#1e3a8a',
            borderWidth: 2,
            fill: type === 'line',
            tension: 0.3,
            borderRadius: 6
          },
          {
            label: 'الفصل الثاني',
            data: s2Data,
            backgroundColor: type === 'line' ? 'rgba(22,163,74,0.1)' : '#16a34a',
            borderColor: '#16a34a',
            borderWidth: 2,
            fill: type === 'line',
            tension: 0.3,
            borderRadius: 6
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { font: { size: 14, weight: 'bold' } } }
        },
        scales: {
          y: { beginAtZero: true, ticks: { stepSize: 1 } }
        }
      }
    });
  }
}

/* ============================================================
   🔔 الإشعارات
   ============================================================ */
function updateNotifStatus() {
  const el = document.getElementById('timer-status');
  if (!el) return;

  if (!('Notification' in window)) {
    el.textContent = '⚠️ المتصفح لا يدعم الإشعارات';
    el.style.color = 'var(--text-muted)';
    return;
  }

  if (Notification.permission === 'granted') {
    el.textContent = '✅ الإشعارات مُفعّلة — ستصلك عند انتهاء المؤقت';
    el.style.color = 'var(--success)';
  } else if (Notification.permission === 'denied') {
    el.textContent = '⚠️ الإشعارات مرفوضة — فعّلها من إعدادات المتصفح';
    el.style.color = 'var(--danger)';
  } else {
    el.textContent = 'ℹ️ الإشعارات غير مُفعّلة — اضغط زر 🔔 في الأعلى';
    el.style.color = 'var(--text-muted)';
  }
}

async function requestNotifPermission() {
  if (!('Notification' in window)) {
    toast('المتصفح لا يدعم الإشعارات', 'warn');
    return;
  }

  if (Notification.permission === 'granted') {
    toast('الإشعارات مُفعّلة مسبقًا ✓', 'success');
    return;
  }

  if (Notification.permission === 'denied') {
    toast('الإشعارات مرفوضة — فعّلها من إعدادات المتصفح', 'error');
    return;
  }

  const perm = await Notification.requestPermission();
  updateNotifStatus();

  if (perm === 'granted') {
    toast('✅ تم تفعيل الإشعارات', 'success');
    sendNotification('الإشعارات مُفعّلة!', 'ستصلك تنبيهات عند انتهاء المؤقت.');
  } else {
    toast('لم يتم تفعيل الإشعارات', 'warn');
  }
}