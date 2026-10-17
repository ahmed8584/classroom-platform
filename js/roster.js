/* ============================================================
   roster.js — إدارة الطلاب والصفوف والنقاط
   ============================================================ */

/* ============================================================
   حالة وحدة roster
   ============================================================ */
const RosterState = {
  classes: [],          // قائمة الصفوف
  currentClassId: null, // الصف المحدد حاليًا
  students: [],         // طلاب الصف الحالي
  selected: new Set(),  // IDs الطلاب المحددين
  semester: sessionStorage.getItem('semester') || 's1',
  chart: null,          // Chart.js instance
  editingId: null,      // الطالب الجاري تعديله
  editingColor: null    // لون الأفاتار المؤقت
};

/* ============================================================
   عرض الصفحة الرئيسية
   ============================================================ */
async function renderRosterPage() {
  const content = document.getElementById('content');
  if (!content) return;

  // أزل الصفحات القديمة وأضف صفحة roster
  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-roster');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-roster';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="class-bar">
      <label style="font-weight:700;color:var(--text-muted);font-size:13px">📚 الصف:</label>
      <select class="class-selector" id="roster-class-selector">
        <option value="">— اختر صفًا —</option>
      </select>
      <button class="btn btn-ghost btn-sm" id="btn-manage-classes" type="button">⚙️ إدارة الصفوف</button>
      <div class="semester-toggle">
        <button class="sem-btn ${RosterState.semester === 's1' ? 'active' : ''}" data-sem="s1" type="button">📘 الفصل الأول</button>
        <button class="sem-btn ${RosterState.semester === 's2' ? 'active' : ''}" data-sem="s2" type="button">📗 الفصل الثاني</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>➕ إضافة طالب جديد</h2>
      </div>
      <div class="row">
        <input type="text" id="new-student-name" placeholder="اسم الطالب" style="flex:1;min-width:200px">
        <button class="btn btn-primary" id="btn-add-student" type="button">إضافة</button>
      </div>
      <p style="color:var(--text-muted);font-size:12px;margin-top:8px">
        💡 لإضافة مجموعة كبيرة، استخدم زر <b>📥 استيراد Excel</b>.
      </p>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📋 قائمة الطلاب (<span id="student-count">0</span>)</h2>
        <div class="row">
          <button class="btn btn-success btn-sm" id="btn-import-excel" type="button">📥 استيراد Excel</button>
          <button class="btn btn-ghost btn-sm" id="btn-export-excel" type="button">📤 تصدير Excel</button>
          <button class="btn btn-danger btn-sm" id="btn-reset-class-points" type="button">🗑️ تصفير نقاط الفصل</button>
        </div>
      </div>
      <div id="students-list"></div>
    </div>

    <div class="card" id="points-card" style="display:none">
      <div class="card-header">
        <h2>🏆 منح وسحب النقاط</h2>
        <button class="btn btn-ghost btn-sm" id="btn-clear-selection" type="button">إلغاء التحديد</button>
      </div>
      <div class="row" style="margin-bottom:12px">
        <label style="font-weight:600">القيمة:</label>
        <input type="number" id="points-value" value="1" min="1" style="width:90px;text-align:center">
        <input type="text" id="points-reason" placeholder="السبب (اختياري)" style="flex:1;min-width:150px">
      </div>
      <div class="row">
        <button class="btn btn-success" id="btn-plus-selected" type="button">➕ إضافة للمحدد</button>
        <button class="btn btn-danger" id="btn-minus-selected" type="button">➖ خصم من المحدد</button>
      </div>
    </div>
  `;

  bindRosterEvents();
  await loadClassesAndPopulate();
}

/* ============================================================
   ربط الأحداث
   ============================================================ */
function bindRosterEvents() {
  const page = document.getElementById('page-roster');
  if (!page) return;

  // اختيار الصف
  page.querySelector('#roster-class-selector').onchange = (e) => {
    switchClass(e.target.value);
  };

  // إدارة الصفوف
  page.querySelector('#btn-manage-classes').onclick = () => openClassesModal();

  // تبديل الفصل الدراسي
  page.querySelectorAll('.sem-btn').forEach(btn => {
    btn.onclick = () => {
      RosterState.semester = btn.dataset.sem;
      sessionStorage.setItem('semester', RosterState.semester);
      page.querySelectorAll('.sem-btn').forEach(b => {
        b.classList.toggle('active', b.dataset.sem === RosterState.semester);
      });
      renderStudentsList();
    };
  });

  // إضافة طالب
  page.querySelector('#btn-add-student').onclick = addStudent;
  page.querySelector('#new-student-name').onkeypress = (e) => {
    if (e.key === 'Enter') addStudent();
  };

  // استيراد / تصدير
  page.querySelector('#btn-import-excel').onclick = openImportModal;
  page.querySelector('#btn-export-excel').onclick = exportToExcel;

  // تصفير نقاط الفصل
  page.querySelector('#btn-reset-class-points').onclick = resetClassPoints;

  // منح/خصم نقاط
  page.querySelector('#btn-plus-selected').onclick = () => applyPoints(1);
  page.querySelector('#btn-minus-selected').onclick = () => applyPoints(-1);
  page.querySelector('#btn-clear-selection').onclick = () => {
    RosterState.selected.clear();
    renderStudentsList();
  };
}

/* ============================================================
   تحميل الصفوف
   ============================================================ */
async function loadClassesAndPopulate() {
  try {
    const classes = await Api.listClasses();
    RosterState.classes = classes || [];

    const selector = document.getElementById('roster-class-selector');
    if (!selector) return;

    if (!RosterState.classes.length) {
      selector.innerHTML = '<option value="">— لا يوجد صفوف —</option>';
      RosterState.currentClassId = null;
      RosterState.students = [];
      renderStudentsList();
      return;
    }

    selector.innerHTML = '<option value="">— اختر صفًا —</option>' +
      RosterState.classes.map(c => {
        const label = c.name || c.grade + (c.section ? ' - شعبة ' + c.section : '');
        return `<option value="${c.id}">${escapeHtml(label)}</option>`;
      }).join('');

    // اختر الأول تلقائيًا
    if (!RosterState.currentClassId && RosterState.classes.length) {
      RosterState.currentClassId = RosterState.classes[0].id;
      selector.value = RosterState.currentClassId;
      await loadStudents();
    } else if (RosterState.currentClassId) {
      selector.value = RosterState.currentClassId;
      await loadStudents();
    }
  } catch (e) {
    toast('خطأ في تحميل الصفوف: ' + e.message, 'error');
  }
}

/* ============================================================
   تبديل الصف
   ============================================================ */
async function switchClass(classId) {
  RosterState.currentClassId = classId || null;
  RosterState.selected.clear();

  if (!classId) {
    RosterState.students = [];
    renderStudentsList();
    return;
  }

  await loadStudents();
}

/* ============================================================
   تحميل الطلاب
   ============================================================ */
async function loadStudents() {
  if (!RosterState.currentClassId) {
    RosterState.students = [];
    renderStudentsList();
    return;
  }

  try {
    const students = await Api.listRoster(RosterState.currentClassId);
    RosterState.students = students || [];

    // احتفظ فقط بالتحديد الصالح
    const validIds = new Set(RosterState.students.map(s => s.id));
    RosterState.selected.forEach(id => {
      if (!validIds.has(id)) RosterState.selected.delete(id);
    });

    renderStudentsList();
  } catch (e) {
    toast('خطأ في تحميل الطلاب: ' + e.message, 'error');
  }
}

/* ============================================================
   عرض قائمة الطلاب
   ============================================================ */
function renderStudentsList() {
  const list = document.getElementById('students-list');
  const count = document.getElementById('student-count');
  const pointsCard = document.getElementById('points-card');

  if (!list) return;

  count.textContent = RosterState.students.length;

  if (!RosterState.currentClassId) {
    list.innerHTML = '<div class="empty">👆 اختر صفًا أولًا</div>';
    if (pointsCard) pointsCard.style.display = 'none';
    return;
  }

  if (!RosterState.students.length) {
    list.innerHTML = '<div class="empty">لا يوجد طلاب في هذا الصف بعد</div>';
    if (pointsCard) pointsCard.style.display = 'none';
    return;
  }

  if (pointsCard) pointsCard.style.display = RosterState.selected.size > 0 ? 'block' : 'none';

  const sem = RosterState.semester;
  const color = window.APP_CONFIG.AVATAR_COLORS;

  list.innerHTML = RosterState.students.map(s => {
    const selected = RosterState.selected.has(s.id);
    const avatarColor = getStudentColor(s);
    const initial = getInitial(s.name);
    const s1Active = sem === 's1' ? 'active' : '';
    const s2Active = sem === 's2' ? 'active s2' : '';
    const notesHtml = s.notes
      ? `<div class="s-notes">📝 ${escapeHtml(s.notes)}</div>`
      : '';

    return `
      <div class="student-card ${selected ? 'selected' : ''}" data-id="${s.id}">
        <div class="student-avatar" style="background:${avatarColor}" data-view="${s.id}">${escapeHtml(initial)}</div>
        <div class="name">${escapeHtml(s.name)}</div>
        <div class="points-pair">
          <span class="${s1Active}">ف1: ${s.s1 || 0}</span>
          <span class="${s2Active}">ف2: ${s.s2 || 0}</span>
        </div>
        ${notesHtml}
        <div class="actions" style="margin-top:8px;display:flex;gap:6px;flex-wrap:wrap">
          <button class="btn btn-success btn-sm" data-quick="${s.id}" data-delta="1">+1</button>
          <button class="btn btn-success btn-sm" data-quick="${s.id}" data-delta="5">+5</button>
          <button class="btn btn-danger btn-sm" data-quick="${s.id}" data-delta="-1">-1</button>
          <button class="btn btn-ghost btn-sm" data-edit="${s.id}">✏️</button>
          <button class="btn btn-danger btn-sm" data-delete="${s.id}">🗑️</button>
        </div>
      </div>
    `;
  }).join('');

  // ربط الأحداث بعد البناء
  list.querySelectorAll('.student-card').forEach(card => {
    card.addEventListener('click', (e) => {
      // إذا كان النقر على زر، لا تفعّل التحديد
      if (e.target.closest('button')) return;
      toggleSelect(card.dataset.id);
    });
  });

  list.querySelectorAll('[data-quick]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      quickAddPoints(btn.dataset.quick, Number(btn.dataset.delta));
    };
  });

  list.querySelectorAll('[data-edit]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      openEditStudentModal(btn.dataset.edit);
    };
  });

  list.querySelectorAll('[data-delete]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      deleteStudent(btn.dataset.delete);
    };
  });

  list.querySelectorAll('[data-view]').forEach(avatar => {
    avatar.onclick = (e) => {
      e.stopPropagation();
      openStudentDetailsModal(avatar.dataset.view);
    };
  });
}

/* ============================================================
   تحديد طالب
   ============================================================ */
function toggleSelect(id) {
  if (RosterState.selected.has(id)) {
    RosterState.selected.delete(id);
  } else {
    RosterState.selected.add(id);
  }
  renderStudentsList();
}

/* ============================================================
   إضافة طالب
   ============================================================ */
async function addStudent() {
  if (!RosterState.currentClassId) {
    toast('اختر صفًا أولًا', 'warn');
    return;
  }

  const input = document.getElementById('new-student-name');
  const name = input.value.trim();
  if (!name) {
    toast('أدخل اسم الطالب', 'warn');
    return;
  }

  try {
    await Api.addRoster({
      name,
      classId: RosterState.currentClassId
    });
    input.value = '';
    toast('تمت إضافة ' + name, 'success');
    await loadStudents();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   حذف طالب
   ============================================================ */
async function deleteStudent(id) {
  const s = RosterState.students.find(x => x.id === id);
  if (!s) return;

  const ok = await confirmAction(
    `🗑️ هل تريد حذف الطالب "${s.name}"؟<br><br>سيتم حذف نقاطه نهائيًا.`,
    'حذف'
  );
  if (!ok) return;

  try {
    await Api.deleteRoster(id);
    toast('تم حذف الطالب', 'success');
    await loadStudents();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   نقاط سريعة
   ============================================================ */
async function quickAddPoints(id, delta) {
  const reasonInput = document.getElementById('points-reason');
  const reason = reasonInput ? reasonInput.value.trim() : '';

  try {
    const res = await Api.addPoints({
      id,
      delta,
      reason,
      semester: RosterState.semester
    });

    const s = RosterState.students.find(x => x.id === id);
    if (s) s[RosterState.semester] = res.newValue;

    renderStudentsList();
    const semLabel = RosterState.semester === 's1' ? 'ف1' : 'ف2';
    toast(`${delta > 0 ? '+' : ''}${delta} ${semLabel}`, delta > 0 ? 'success' : 'warn');
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   نقاط جماعية
   ============================================================ */
async function applyPoints(sign) {
  const ids = Array.from(RosterState.selected);
  if (!ids.length) {
    toast('لم تحدد أي طالب', 'warn');
    return;
  }

  const valueInput = document.getElementById('points-value');
  const value = Math.abs(Number(valueInput.value) || 1);
  const delta = sign * value;
  const reasonInput = document.getElementById('points-reason');
  const reason = reasonInput ? reasonInput.value.trim() : '';

  try {
    const results = await Api.addPointsBulk(
      ids,
      delta,
      reason,
      RosterState.semester
    );

    results.forEach(r => {
      const s = RosterState.students.find(x => x.id === r.id);
      if (s) s[RosterState.semester] = r.newValue;
    });

    RosterState.selected.clear();
    renderStudentsList();

    toast(`تم تحديث ${results.length} طالب`, 'success');
    flash(delta > 0 ? '👏 أحسنتم!' : '💪 حاولوا مرة أخرى', 1200);
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   تصفير نقاط الفصل
   ============================================================ */
async function resetClassPoints() {
  if (!RosterState.currentClassId) {
    toast('اختر صفًا أولًا', 'warn');
    return;
  }

  const cls = RosterState.classes.find(c => c.id === RosterState.currentClassId);
  const semLabel = RosterState.semester === 's1' ? 'الفصل الأول' : 'الفصل الثاني';

  const ok = await confirmAction(
    `⚠️ سيتم تصفير نقاط <b>${semLabel}</b> لجميع طلاب:<br><b>${cls ? cls.name || cls.grade : ''}</b><br><br>متابعة؟`,
    'تصفير'
  );
  if (!ok) return;

  try {
    const res = await Api.resetPoints(RosterState.currentClassId, RosterState.semester);
    toast(`تم تصفير ${res.count} طالب`, 'success');
    await loadStudents();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   نافذة تعديل الطالب
   ============================================================ */
function openEditStudentModal(id) {
  const s = RosterState.students.find(x => x.id === id);
  if (!s) return;

  RosterState.editingId = id;
  RosterState.editingColor = getStudentColor(s);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button class="btn btn-danger" id="btn-delete-from-edit" type="button">🗑️ حذف</button>
    <button class="btn btn-ghost" id="btn-cancel-edit" type="button">إلغاء</button>
    <button class="btn btn-primary" id="btn-save-edit" type="button">💾 حفظ</button>
  `;

  openModal('✏️ تعديل بيانات الطالب', (body) => {
    body.innerHTML = `
      <div style="text-align:center;margin-bottom:16px">
        <div id="edit-avatar-preview" class="student-avatar lg" style="background:${RosterState.editingColor};margin:0 auto"></div>
      </div>

      <label>الاسم:</label>
      <input type="text" id="edit-name" value="${escapeHtml(s.name)}">

      <label>🎨 لون الأفاتار:</label>
      <div class="color-picker" id="color-picker"></div>

      <label>📝 ملاحظات:</label>
      <textarea id="edit-notes" rows="3" placeholder="ملاحظات عن الطالب (اختياري)">${escapeHtml(s.notes || '')}</textarea>

      <div style="margin-top:14px;padding:12px;background:var(--bg);border-radius:8px;font-size:13px">
        <div style="margin-bottom:6px"><b>النقاط الحالية:</b></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          <span style="background:#dbeafe;color:var(--primary);padding:4px 12px;border-radius:6px;font-weight:600">ف1: ${s.s1 || 0}</span>
          <span style="background:#dcfce7;color:var(--success);padding:4px 12px;border-radius:6px;font-weight:600">ف2: ${s.s2 || 0}</span>
        </div>
      </div>
    `;

    // بناء منتقي الألوان
    const colors = window.APP_CONFIG.AVATAR_COLORS;
    const picker = body.querySelector('#color-picker');
    picker.innerHTML = colors.map(c => `
      <div class="color-swatch ${c === RosterState.editingColor ? 'selected' : ''}" 
           style="background:${c}" 
           data-color="${c}"></div>
    `).join('');

    picker.querySelectorAll('.color-swatch').forEach(sw => {
      sw.onclick = () => {
        RosterState.editingColor = sw.dataset.color;
        picker.querySelectorAll('.color-swatch').forEach(x => x.classList.remove('selected'));
        sw.classList.add('selected');
        const preview = body.querySelector('#edit-avatar-preview');
        preview.style.background = RosterState.editingColor;
      };
    });

    // تحديث معاينة الأفاتار عند تغيير الاسم
    const nameInput = body.querySelector('#edit-name');
    nameInput.oninput = () => {
      const preview = body.querySelector('#edit-avatar-preview');
      preview.textContent = getInitial(nameInput.value);
    };
    nameInput.oninput(); // استدعِ مرة للتهيئة
  }, { footer });

  document.getElementById('btn-cancel-edit').onclick = closeAllModals;
  document.getElementById('btn-save-edit').onclick = saveStudentEdit;
  document.getElementById('btn-delete-from-edit').onclick = async () => {
    closeAllModals();
    await deleteStudent(id);
  };
}

/* ============================================================
   حفظ تعديل الطالب
   ============================================================ */
async function saveStudentEdit() {
  const id = RosterState.editingId;
  if (!id) return;

  const name = document.getElementById('edit-name').value.trim();
  const notes = document.getElementById('edit-notes').value.trim();

  if (!name) {
    toast('الاسم مطلوب', 'warn');
    return;
  }

  try {
    await Api.updateRoster({
      id,
      name,
      notes,
      avatar: RosterState.editingColor
    });
    toast('تم حفظ التعديلات', 'success');
    closeAllModals();
    await loadStudents();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   نافذة تفاصيل الطالب
   ============================================================ */
function openStudentDetailsModal(id) {
  const s = RosterState.students.find(x => x.id === id);
  if (!s) return;

  const color = getStudentColor(s);
  const initial = getInitial(s.name);
  const s1 = s.s1 || 0;
  const s2 = s.s2 || 0;
  const diff = s2 - s1;
  const diffColor = diff > 0 ? 'var(--success)' : diff < 0 ? 'var(--danger)' : 'var(--text-muted)';

  openModal('👤 تفاصيل الطالب', (body) => {
    body.innerHTML = `
      <div style="text-align:center;margin-bottom:20px">
        <div class="student-avatar lg" style="background:${color};margin:0 auto 12px">${escapeHtml(initial)}</div>
        <h3 style="color:var(--primary);font-size:20px;margin-bottom:4px">${escapeHtml(s.name)}</h3>
        ${s.notes ? `<p style="color:var(--text-muted);font-size:13px;font-style:italic">📝 ${escapeHtml(s.notes)}</p>` : ''}
      </div>

      <div class="row" style="gap:12px;margin-bottom:20px">
        <div class="stat-card">
          <div class="stat-label">الفصل الأول</div>
          <div class="stat-value">${s1}</div>
        </div>
        <div class="stat-card green">
          <div class="stat-label">الفصل الثاني</div>
          <div class="stat-value">${s2}</div>
        </div>
        <div class="stat-card" style="border-right-color:${diffColor}">
          <div class="stat-label">الفرق</div>
          <div class="stat-value" style="color:${diffColor}">${diff > 0 ? '+' : ''}${diff}</div>
        </div>
      </div>

      <div class="chart-container" style="height:240px">
        <canvas id="student-chart"></canvas>
      </div>
    `;

    // ارسم الرسم البياني بعد بناء المحتوى
    setTimeout(() => {
      const canvas = document.getElementById('student-chart');
      if (!canvas) return;

      if (RosterState.chart) RosterState.chart.destroy();

      RosterState.chart = new Chart(canvas.getContext('2d'), {
        type: 'bar',
        data: {
          labels: ['الفصل الأول', 'الفصل الثاني'],
          datasets: [{
            label: 'النقاط',
            data: [s1, s2],
            backgroundColor: [color, color],
            borderRadius: 10,
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: { legend: { display: false } },
          scales: {
            y: { beginAtZero: true, ticks: { stepSize: 1 } }
          }
        }
      });
    }, 100);
  });
}

/* ============================================================
   استيراد Excel / CSV
   ============================================================ */
function openImportModal() {
  if (!RosterState.currentClassId) {
    toast('اختر صفًا أولًا', 'warn');
    return;
  }

  const cls = RosterState.classes.find(c => c.id === RosterState.currentClassId);

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button class="btn btn-ghost" id="btn-cancel-import" type="button">إلغاء</button>
    <button class="btn btn-success" id="btn-do-import" type="button" disabled>📥 استيراد الآن</button>
  `;

  openModal('📥 استيراد الطلاب', (body) => {
    body.innerHTML = `
      <p style="color:var(--text-muted);font-size:13px;margin-bottom:14px">
        سيتم إضافة الطلاب إلى: <b>${escapeHtml(cls ? cls.name || cls.grade : '')}</b>
      </p>

      <div id="import-drop-zone" class="drop-zone">
        <div class="drop-icon">📄</div>
        <div class="drop-title">اضغط لاختيار ملف أو اسحبه هنا</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">xlsx, xls, csv</div>
        <div id="import-file-name" style="font-size:13px;color:var(--success);margin-top:8px;font-weight:700;min-height:16px"></div>
      </div>

      <input type="file" id="import-file-input" accept=".xlsx,.xls,.csv" style="display:none">
    `;

    const dropZone = body.querySelector('#import-drop-zone');
    const fileInput = body.querySelector('#import-file-input');
    const fileName = body.querySelector('#import-file-name');
    const importBtn = document.getElementById('btn-do-import');

    let selectedFile = null;

    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = (e) => {
      const f = e.target.files[0];
      if (!f) return;
      selectedFile = f;
      fileName.textContent = '✓ ' + f.name;
      dropZone.classList.add('has-file');
      importBtn.disabled = false;
    };

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const f = e.dataTransfer.files[0];
      if (f) {
        selectedFile = f;
        fileName.textContent = '✓ ' + f.name;
        dropZone.classList.add('has-file');
        importBtn.disabled = false;
      }
    };

    importBtn.onclick = async () => {
      if (!selectedFile) return;

      try {
        importBtn.disabled = true;
        importBtn.textContent = '⏳ جارٍ الاستيراد...';

        const students = await parseExcelFile(selectedFile);
        if (!students.length) {
          toast('لم يتم العثور على أسماء', 'warn');
          return;
        }

        const res = await Api.bulkRoster(RosterState.currentClassId, students);
        toast(`تم استيراد ${res.added} طالب (تم تجاهل ${res.skipped || 0})`, 'success');
        closeAllModals();
        await loadStudents();
      } catch (e) {
        toast('خطأ: ' + e.message, 'error');
      } finally {
        importBtn.disabled = false;
        importBtn.textContent = '📥 استيراد الآن';
      }
    };
  }, { footer });

  document.getElementById('btn-cancel-import').onclick = closeAllModals;
}

/* ============================================================
   تحليل ملف Excel/CSV
   ============================================================ */
function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target.result);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });

        const students = [];
        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row || !row[0]) continue;
          const name = String(row[0]).trim();
          if (name) students.push({ name });
        }
        resolve(students);
      } catch (err) {
        reject(new Error('فشل قراءة الملف: ' + err.message));
      }
    };

    reader.onerror = () => reject(new Error('فشل قراءة الملف'));
    reader.readAsArrayBuffer(file);
  });
}

/* ============================================================
   تصدير Excel (3 أوراق)
   ============================================================ */
async function exportToExcel() {
  if (!RosterState.currentClassId) {
    toast('اختر صفًا أولًا', 'warn');
    return;
  }

  if (!RosterState.students.length) {
    toast('لا يوجد طلاب لتصديرهم', 'warn');
    return;
  }

  try {
    const cls = RosterState.classes.find(c => c.id === RosterState.currentClassId);
    const className = cls ? (cls.name || cls.grade) : 'الصف';
    const exportDate = new Date().toISOString().slice(0, 10);

    const wb = XLSX.utils.book_new();

    // ورقة 1: القائمة الكاملة
    const rows1 = [['م', 'الاسم', 'الفصل الأول', 'الفصل الثاني', 'المجموع', 'الفرق', 'ملاحظات']];
    RosterState.students.forEach((s, i) => {
      const s1 = s.s1 || 0;
      const s2 = s.s2 || 0;
      rows1.push([i + 1, s.name, s1, s2, s1 + s2, s2 - s1, s.notes || '']);
    });
    const ws1 = XLSX.utils.aoa_to_sheet(rows1);
    ws1['!cols'] = [{ wch: 6 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 10 }, { wch: 10 }, { wch: 22 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'القائمة');

    // ورقة 2: المقارنة (مرتبة)
    const sorted = RosterState.students.slice().sort((a, b) => {
      const totalA = (a.s1 || 0) + (a.s2 || 0);
      const totalB = (b.s1 || 0) + (b.s2 || 0);
      return totalB - totalA;
    });
    const rows2 = [['الترتيب', 'الاسم', 'الفصل الأول', 'الفصل الثاني', 'الفرق', 'الاتجاه']];
    sorted.forEach((s, i) => {
      const s1 = s.s1 || 0;
      const s2 = s.s2 || 0;
      const diff = s2 - s1;
      const trend = diff > 0 ? '📈 تحسّن' : diff < 0 ? '📉 تراجع' : '➖ ثابت';
      rows2.push([i + 1, s.name, s1, s2, diff, trend]);
    });
    const ws2 = XLSX.utils.aoa_to_sheet(rows2);
    ws2['!cols'] = [{ wch: 8 }, { wch: 26 }, { wch: 12 }, { wch: 12 }, { wch: 8 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'المقارنة');

    // ورقة 3: الإحصائيات
    const s1Total = RosterState.students.reduce((a, s) => a + (s.s1 || 0), 0);
    const s2Total = RosterState.students.reduce((a, s) => a + (s.s2 || 0), 0);
    const improved = RosterState.students.filter(s => (s.s2 || 0) > (s.s1 || 0)).length;
    const declined = RosterState.students.filter(s => (s.s2 || 0) < (s.s1 || 0)).length;
    const count = RosterState.students.length || 1;

    const rows3 = [
      ['البيان', 'القيمة'],
      ['الصف', className],
      ['تاريخ التصدير', exportDate],
      ['عدد الطلاب', RosterState.students.length],
      ['مجموع الفصل الأول', s1Total],
      ['مجموع الفصل الثاني', s2Total],
      ['متوسط الفصل الأول', (s1Total / count).toFixed(1)],
      ['متوسط الفصل الثاني', (s2Total / count).toFixed(1)],
      ['عدد المتحسنين', improved],
      ['عدد المتراجعين', declined]
    ];
    const ws3 = XLSX.utils.aoa_to_sheet(rows3);
    ws3['!cols'] = [{ wch: 22 }, { wch: 28 }];
    XLSX.utils.book_append_sheet(wb, ws3, 'إحصائيات');

    // احفظ الملف
    const safeName = className.replace(/[\/\\:*?"<>|]/g, '-');
    XLSX.writeFile(wb, `${safeName}_${exportDate}.xlsx`);
    toast('تم تصدير الملف', 'success');
  } catch (e) {
    toast('خطأ في التصدير: ' + e.message, 'error');
  }
}

/* ============================================================
   نافذة إدارة الصفوف (إنشاء / حذف)
   ============================================================ */
function openClassesModal() {
  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `<button class="btn btn-ghost" id="btn-close-classes" type="button">إغلاق</button>`;

  openModal('⚙️ إدارة الصفوف', (body) => {
    body.innerHTML = `
      <div class="card" style="box-shadow:none;border:1px solid var(--border)">
        <h3>➕ إنشاء صف جديد</h3>
        <div class="row" style="margin-top:8px">
          <select id="new-class-grade" style="flex:1"></select>
          <select id="new-class-section" style="width:140px"></select>
          <button class="btn btn-primary" id="btn-create-class" type="button">إنشاء</button>
        </div>
      </div>

      <div class="card" style="box-shadow:none;border:1px solid var(--border)">
        <h3>📋 الصفوف الحالية</h3>
        <div id="classes-list-modal" style="margin-top:10px"></div>
      </div>
    `;

    // املأ القوائم
    const grades = window.APP_CONFIG.GRADES_LIST;
    const sections = window.APP_CONFIG.SECTIONS_LIST;
    body.querySelector('#new-class-grade').innerHTML =
      '<option value="">— اختر الصف —</option>' +
      grades.map(g => `<option value="${g}">${g}</option>`).join('');
    body.querySelector('#new-class-section').innerHTML =
      '<option value="">بدون شعبة</option>' +
      sections.map(s => `<option value="${s}">شعبة ${s}</option>`).join('');

    // اعرض الصفوف
    renderClassesModalList(body.querySelector('#classes-list-modal'));

    // زر الإنشاء
    body.querySelector('#btn-create-class').onclick = async () => {
      const grade = body.querySelector('#new-class-grade').value;
      const section = body.querySelector('#new-class-section').value;
      if (!grade) {
        toast('اختر الصف', 'warn');
        return;
      }
      try {
        await Api.createClass({
          name: grade + (section ? ' - شعبة ' + section : ''),
          grade,
          section
        });
        toast('تم إنشاء الصف', 'success');
        await loadClassesAndPopulate();
        renderClassesModalList(body.querySelector('#classes-list-modal'));
        body.querySelector('#new-class-grade').value = '';
        body.querySelector('#new-class-section').value = '';
      } catch (e) {
        toast(e.message, 'error');
      }
    };
  }, { footer });

  document.getElementById('btn-close-classes').onclick = closeAllModals;
}

/* ============================================================
   عرض الصفوف في نافذة الإدارة
   ============================================================ */
function renderClassesModalList(container) {
  if (!container) return;

  if (!RosterState.classes.length) {
    container.innerHTML = '<div class="empty">لا يوجد صفوف</div>';
    return;
  }

  container.innerHTML = RosterState.classes.map(c => `
    <div class="student-row" style="padding:10px 12px">
      <div style="flex:1">
        <div style="font-weight:700">${escapeHtml(c.name || c.grade)}</div>
        <div style="font-size:12px;color:var(--text-muted)">
          ${escapeHtml(c.grade || '')} ${c.section ? ' - شعبة ' + escapeHtml(c.section) : ''}
        </div>
      </div>
      <button class="btn btn-danger btn-sm" data-del-class="${c.id}" type="button">🗑️</button>
    </div>
  `).join('');

  container.querySelectorAll('[data-del-class]').forEach(btn => {
    btn.onclick = async () => {
      const id = btn.dataset.delClass;
      const cls = RosterState.classes.find(c => c.id === id);
      if (!cls) return;

      const ok = await confirmAction(
        `⚠️ سيتم حذف الصف "<b>${escapeHtml(cls.name || cls.grade)}</b>" مع جميع طلابه.<br><br>هل أنت متأكد؟`,
        'حذف الصف'
      );
      if (!ok) return;

      try {
        await Api.deleteClass(id);
        toast('تم حذف الصف', 'success');
        if (RosterState.currentClassId === id) RosterState.currentClassId = null;
        await loadClassesAndPopulate();
        renderClassesModalList(container);
      } catch (e) {
        toast(e.message, 'error');
      }
    };
  });
}