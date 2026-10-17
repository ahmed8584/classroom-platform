/* ============================================================
   studio.js — استوديو إنشاء الدروس
   ============================================================ */

const StudioState = {
  lessons: [],
  currentLesson: null,
  blockTypes: [
    { type: 'welcome', label: '👋 شاشة ترحيب', icon: '👋' },
    { type: 'objectives', label: '🎯 أهداف التعلم', icon: '🎯' },
    { type: 'intro', label: '💡 سؤال تمهيدي', icon: '💡' },
    { type: 'content', label: '📖 محتوى / شرح', icon: '📖' },
    { type: 'mcq', label: '❓ سؤال اختيار متعدد', icon: '❓' },
    { type: 'tf', label: '✅ سؤال صح/خطأ', icon: '✅' },
    { type: 'short', label: '✏️ سؤال إجابة قصيرة', icon: '✏️' },
    { type: 'group', label: '👥 نشاط جماعي', icon: '👥' },
    { type: 'challenge', label: '⚡ تحدٍّ', icon: '⚡' },
    { type: 'assessment', label: '📊 تقويم ختامي', icon: '📊' },
    { type: 'exit', label: '🚪 بطاقة خروج', icon: '🚪' },
    { type: 'results', label: '🏆 النتائج', icon: '🏆' }
  ]
};

/* ============================================================
   عرض صفحة الاستوديو
   ============================================================ */
async function renderStudioPage(lessonId = null) {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-studio');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-studio';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  if (lessonId) {
    try {
      const l = await Api.getLesson(lessonId);
      StudioState.currentLesson = {
        id: l.id,
        title: l.title || '',
        subject: l.subject || '',
        grade: l.grade || '',
        classId: l.classId || '',
        blocks: safeParseJSON(l.blocksJson) || []
      };
    } catch (e) {
      toast('لم يتم العثور على الدرس', 'error');
      StudioState.currentLesson = null;
    }
  } else if (!StudioState.currentLesson) {
    StudioState.currentLesson = {
      title: 'درس جديد',
      subject: '',
      grade: '',
      classId: '',
      blocks: [
        { type: 'welcome', title: 'مرحبًا', body: 'أهلًا بكم في الحصة' }
      ]
    };
  }

  renderStudioEditor();
}

/* ============================================================
   محرر الدرس
   ============================================================ */
function renderStudioEditor() {
  const page = document.getElementById('page-studio');
  if (!page) return;

  const lesson = StudioState.currentLesson;
  if (!lesson) {
    page.innerHTML = `
      <div class="card">
        <div class="card-header">
          <h2>🎨 استوديو الدروس</h2>
          <button class="btn btn-primary" id="btn-new-lesson" type="button">➕ درس جديد</button>
        </div>
        <div class="empty">اختر درسًا أو أنشئ درسًا جديدًا</div>
        <div id="studio-lessons-list" style="margin-top:20px"></div>
      </div>
    `;
    document.getElementById('btn-new-lesson').onclick = () => createNewLesson();
    loadLessonsListInto('studio-lessons-list');
    return;
  }

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>📝 معلومات الدرس</h2>
        <div class="row">
          <button class="btn btn-ghost btn-sm" id="btn-back-to-lessons" type="button">📚 قائمة الدروس</button>
          <button class="btn btn-ghost btn-sm" id="btn-new-lesson-2" type="button">➕ درس جديد</button>
        </div>
      </div>
      <div class="row" style="gap:10px;flex-wrap:wrap">
        <div style="flex:2;min-width:220px">
          <label>عنوان الدرس</label>
          <input type="text" id="lesson-title" value="${escapeHtml(lesson.title || '')}">
        </div>
        <div style="flex:1;min-width:140px">
          <label>المادة</label>
          <input type="text" id="lesson-subject" value="${escapeHtml(lesson.subject || '')}">
        </div>
        <div style="flex:1;min-width:140px">
          <label>الصف</label>
          <input type="text" id="lesson-grade" value="${escapeHtml(lesson.grade || '')}">
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>🧩 وحدات الحصة (${lesson.blocks.length})</h2>
        <button class="btn btn-accent" id="btn-add-block" type="button">➕ إضافة وحدة</button>
      </div>
      <div id="studio-blocks"></div>
    </div>

    <div class="card">
      <div class="row row-end">
        <button class="btn btn-ghost" id="btn-preview-lesson" type="button">👁️ معاينة</button>
        <button class="btn btn-primary btn-lg" id="btn-save-lesson" type="button">💾 حفظ الدرس</button>
        ${lesson.id ? `<button class="btn btn-accent" id="btn-launch-session" type="button">🚀 بدء حصة</button>` : ''}
      </div>
    </div>
  `;

  bindStudioEvents();
  renderBlocks();
}

/* ============================================================
   ربط الأحداث
   ============================================================ */
function bindStudioEvents() {
  const page = document.getElementById('page-studio');
  if (!page) return;

  page.querySelector('#btn-back-to-lessons')?.addEventListener('click', () => {
    StudioState.currentLesson = null;
    renderStudioEditor();
  });

  page.querySelector('#btn-new-lesson-2')?.addEventListener('click', createNewLesson);
  page.querySelector('#btn-new-lesson')?.addEventListener('click', createNewLesson);

  page.querySelector('#lesson-title')?.addEventListener('input', (e) => {
    StudioState.currentLesson.title = e.target.value;
  });
  page.querySelector('#lesson-subject')?.addEventListener('input', (e) => {
    StudioState.currentLesson.subject = e.target.value;
  });
  page.querySelector('#lesson-grade')?.addEventListener('input', (e) => {
    StudioState.currentLesson.grade = e.target.value;
  });

  page.querySelector('#btn-add-block')?.addEventListener('click', openAddBlockModal);
  page.querySelector('#btn-save-lesson')?.addEventListener('click', saveCurrentLesson);
  page.querySelector('#btn-preview-lesson')?.addEventListener('click', previewLesson);
  page.querySelector('#btn-launch-session')?.addEventListener('click', launchSession);
}

/* ============================================================
   عرض الوحدات
   ============================================================ */
function renderBlocks() {
  const container = document.getElementById('studio-blocks');
  if (!container) return;

  const blocks = StudioState.currentLesson.blocks;

  if (!blocks.length) {
    container.innerHTML = '<div class="empty">لا توجد وحدات. اضغط "إضافة وحدة" للبدء</div>';
    return;
  }

  container.innerHTML = blocks.map((b, i) => {
    const meta = StudioState.blockTypes.find(t => t.type === b.type) || { icon: '📄', label: b.type };
    const bodyPreview = b.body ? String(b.body).slice(0, 60) + (b.body.length > 60 ? '...' : '') : '';

    return `
      <div class="q-preview" style="padding:14px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:#fff">
        <div style="display:flex;gap:8px;align-items:center;flex-wrap:wrap">
          <span style="font-size:22px">${meta.icon}</span>
          <div style="flex:1;min-width:150px">
            <div style="font-weight:700">${escapeHtml(b.title || meta.label)}</div>
            <div style="font-size:12px;color:var(--text-muted)">${meta.label}</div>
            ${bodyPreview ? `<div style="font-size:13px;color:var(--text-muted);margin-top:4px">${escapeHtml(bodyPreview)}</div>` : ''}
          </div>
          <div style="display:flex;gap:4px">
            <button class="btn btn-ghost btn-sm" data-block-up="${i}" type="button" ${i === 0 ? 'disabled' : ''}>⬆️</button>
            <button class="btn btn-ghost btn-sm" data-block-down="${i}" type="button" ${i === blocks.length - 1 ? 'disabled' : ''}>⬇️</button>
            <button class="btn btn-ghost btn-sm" data-block-edit="${i}" type="button">✏️</button>
            <button class="btn btn-danger btn-sm" data-block-del="${i}" type="button">🗑️</button>
          </div>
        </div>
      </div>
    `;
  }).join('');

  container.querySelectorAll('[data-block-up]').forEach(b => {
    b.onclick = () => moveBlock(Number(b.dataset.blockUp), -1);
  });
  container.querySelectorAll('[data-block-down]').forEach(b => {
    b.onclick = () => moveBlock(Number(b.dataset.blockDown), 1);
  });
  container.querySelectorAll('[data-block-edit]').forEach(b => {
    b.onclick = () => openEditBlockModal(Number(b.dataset.blockEdit));
  });
  container.querySelectorAll('[data-block-del]').forEach(b => {
    b.onclick = () => deleteBlock(Number(b.dataset.blockDel));
  });
}

/* ============================================================
   إضافة وحدة
   ============================================================ */
function openAddBlockModal() {
  openModal('➕ إضافة وحدة', (body) => {
    body.innerHTML = `
      <label>نوع الوحدة</label>
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:10px;margin-top:10px">
        ${StudioState.blockTypes.map(t => `
          <button class="tile" style="padding:14px;cursor:pointer" data-block-type="${t.type}" type="button">
            <div style="font-size:28px">${t.icon}</div>
            <div style="font-weight:700;font-size:13px;margin-top:6px">${t.label}</div>
          </button>
        `).join('')}
      </div>
    `;

    body.querySelectorAll('[data-block-type]').forEach(btn => {
      btn.onclick = () => {
        const type = btn.dataset.blockType;
        const meta = StudioState.blockTypes.find(t => t.type === type);
        StudioState.currentLesson.blocks.push({
          type,
          title: meta.label.replace(/^[^\s]+\s/, ''),
          body: ''
        });
        closeAllModals();
        renderStudioEditor();
        toast('تمت إضافة الوحدة', 'success');
      };
    });
  });
}

/* ============================================================
   تعديل وحدة
   ============================================================ */
function openEditBlockModal(index) {
  const block = StudioState.currentLesson.blocks[index];
  if (!block) return;

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button class="btn btn-ghost" id="btn-cancel-block" type="button">إلغاء</button>
    <button class="btn btn-primary" id="btn-save-block" type="button">💾 حفظ</button>
  `;

  openModal('✏️ تعديل الوحدة', (body) => {
    body.innerHTML = `
      <label>العنوان</label>
      <input type="text" id="block-title" value="${escapeHtml(block.title || '')}">

      <label>المحتوى / النص</label>
      <textarea id="block-body" rows="5" placeholder="اكتب النص هنا...">${escapeHtml(block.body || '')}</textarea>
    `;
  }, { footer });

  document.getElementById('btn-cancel-block').onclick = closeAllModals;
  document.getElementById('btn-save-block').onclick = () => {
    block.title = document.getElementById('block-title').value;
    block.body = document.getElementById('block-body').value;
    closeAllModals();
    renderBlocks();
    toast('تم الحفظ', 'success');
  };
}

/* ============================================================
   تحريك وحذف
   ============================================================ */
function moveBlock(index, direction) {
  const blocks = StudioState.currentLesson.blocks;
  const newIndex = index + direction;
  if (newIndex < 0 || newIndex >= blocks.length) return;

  [blocks[index], blocks[newIndex]] = [blocks[newIndex], blocks[index]];
  renderBlocks();
}

function deleteBlock(index) {
  const blocks = StudioState.currentLesson.blocks;
  blocks.splice(index, 1);
  renderBlocks();
  toast('تم حذف الوحدة', 'success');
}

/* ============================================================
   إنشاء درس جديد
   ============================================================ */
function createNewLesson() {
  StudioState.currentLesson = {
    title: 'درس جديد',
    subject: '',
    grade: '',
    classId: '',
    blocks: [
      { type: 'welcome', title: 'مرحبًا', body: 'أهلًا بكم في الحصة' }
    ]
  };
  renderStudioEditor();
}

/* ============================================================
   حفظ الدرس
   ============================================================ */
async function saveCurrentLesson() {
  const lesson = StudioState.currentLesson;
  if (!lesson) return;

  if (!lesson.title || !lesson.title.trim()) {
    toast('أدخل عنوان الدرس', 'warn');
    return;
  }

  try {
    const res = await Api.saveLesson({
      id: lesson.id,
      title: lesson.title,
      subject: lesson.subject,
      grade: lesson.grade,
      classId: lesson.classId,
      blocks: lesson.blocks
    });

    if (!lesson.id && res.id) {
      lesson.id = res.id;
    }

    toast('💾 تم حفظ الدرس', 'success');
    renderStudioEditor();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   معاينة الدرس
   ============================================================ */
function previewLesson() {
  const lesson = StudioState.currentLesson;
  if (!lesson || !lesson.blocks.length) {
    toast('أضف وحدات أولًا', 'warn');
    return;
  }

  let currentIdx = 0;

  function showBlock() {
    const block = lesson.blocks[currentIdx];
    const meta = StudioState.blockTypes.find(t => t.type === block.type) || { icon: '📄', label: 'وحدة' };

    closeAllModals();

    const footer = document.createElement('div');
    footer.className = 'modal-footer';
    footer.innerHTML = `
      <button class="btn btn-ghost" id="btn-prev-block" type="button" ${currentIdx === 0 ? 'disabled' : ''}>⬅️ السابق</button>
      <span style="flex:1;text-align:center;font-weight:700;color:var(--text-muted)">
        ${currentIdx + 1} / ${lesson.blocks.length}
      </span>
      <button class="btn btn-primary" id="btn-next-block" type="button" ${currentIdx === lesson.blocks.length - 1 ? 'disabled' : ''}>التالي ➡️</button>
    `;

    openModal(`👁️ ${meta.icon} ${block.title || meta.label}`, (body) => {
      body.innerHTML = `
        <div style="padding:20px;background:var(--bg);border-radius:12px;min-height:200px;line-height:1.8;font-size:16px">
          ${block.body ? escapeHtml(block.body).replace(/\n/g, '<br>') : '<em style="color:var(--text-muted)">(لا يوجد محتوى)</em>'}
        </div>
      `;
    }, { footer });

    document.getElementById('btn-prev-block').onclick = () => {
      if (currentIdx > 0) { currentIdx--; showBlock(); }
    };
    document.getElementById('btn-next-block').onclick = () => {
      if (currentIdx < lesson.blocks.length - 1) { currentIdx++; showBlock(); }
    };
  }

  showBlock();
}

/* ============================================================
   بدء حصة من الدرس
   ============================================================ */
async function launchSession() {
  const lesson = StudioState.currentLesson;
  if (!lesson || !lesson.id) {
    toast('احفظ الدرس أولًا', 'warn');
    return;
  }

  try {
    const session = await Api.createSession({ lessonId: lesson.id });
    toast('🚀 تم إنشاء الحصة — الرمز: ' + session.code, 'success', 5000);
    flash('🚀 ' + session.code, 2500);

    // انتقل إلى شاشة الحصة
    if (typeof renderLivePage === 'function') {
      setTimeout(() => renderLivePage(session.id), 1500);
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   قائمة الدروس
   ============================================================ */
async function loadLessonsListInto(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;

  container.innerHTML = '<div class="empty">جارٍ التحميل...</div>';

  try {
    const lessons = await Api.listLessons();
    StudioState.lessons = lessons || [];

    if (!lessons.length) {
      container.innerHTML = '<div class="empty">لا توجد دروس بعد</div>';
      return;
    }

    container.innerHTML = lessons.map(l => {
      const blocks = safeParseJSON(l.blocksJson);
      const blockCount = Array.isArray(blocks) ? blocks.length : 0;
      return `
        <div class="student-row" style="padding:14px">
          <div style="flex:1">
            <div style="font-weight:700">${escapeHtml(l.title || 'بدون عنوان')}</div>
            <div style="font-size:12px;color:var(--text-muted)">
              ${escapeHtml(l.subject || '')} ${l.grade ? '• ' + escapeHtml(l.grade) : ''} • ${blockCount} وحدة
            </div>
          </div>
          <div style="display:flex;gap:6px">
            <button class="btn btn-ghost btn-sm" data-open-lesson="${l.id}" type="button">فتح</button>
            <button class="btn btn-danger btn-sm" data-del-lesson="${l.id}" type="button">🗑️</button>
          </div>
        </div>
      `;
    }).join('');

    container.querySelectorAll('[data-open-lesson]').forEach(btn => {
      btn.onclick = () => {
        StudioState.currentLesson = null;
        renderStudioPage(btn.dataset.openLesson);
      };
    });

    container.querySelectorAll('[data-del-lesson]').forEach(btn => {
      btn.onclick = async () => {
        const id = btn.dataset.delLesson;
        const l = StudioState.lessons.find(x => x.id === id);
        if (!l) return;
        const ok = await confirmAction(`🗑️ حذف الدرس "${escapeHtml(l.title)}"؟`, 'حذف');
        if (!ok) return;
        try {
          await Api.deleteLesson(id);
          toast('تم الحذف', 'success');
          loadLessonsListInto(containerId);
        } catch (e) {
          toast(e.message, 'error');
        }
      };
    });
  } catch (e) {
    container.innerHTML = `<div class="empty">خطأ: ${escapeHtml(e.message)}</div>`;
  }
}