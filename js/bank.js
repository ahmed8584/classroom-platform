/* ============================================================
   bank.js — بنك الأسئلة
   ============================================================ */

const BankState = {
  questions: [],
  filterType: 'all',
  filterDifficulty: 'all',
  searchQuery: '',
  editingId: null,
  tempOptions: ['', '', '', '']
};

/* ============================================================
   عرض الصفحة
   ============================================================ */
async function renderBankPage() {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-bank');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-bank';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="card">
      <div class="card-header">
        <h2>➕ إضافة سؤال جديد</h2>
        <button class="btn btn-primary" id="btn-open-question-form" type="button">إضافة سؤال</button>
      </div>
      <p style="color:var(--text-muted);font-size:13px">
        💡 يمكنك إضافة أسئلة: اختيار من متعدد، صح/خطأ، إجابة قصيرة.
      </p>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>🔍 بحث وتصفية</h2>
      </div>
      <div class="row">
        <input type="text" id="bank-search" placeholder="ابحث في نص السؤال..." style="flex:1;min-width:200px">
        <select id="bank-filter-type" style="width:160px">
          <option value="all">كل الأنواع</option>
          <option value="mcq">اختيار متعدد</option>
          <option value="tf">صح/خطأ</option>
          <option value="short">إجابة قصيرة</option>
        </select>
        <select id="bank-filter-difficulty" style="width:160px">
          <option value="all">كل المستويات</option>
          <option value="easy">سهل</option>
          <option value="medium">متوسط</option>
          <option value="hard">صعب</option>
        </select>
        <button class="btn btn-ghost btn-sm" id="btn-clear-bank-filters" type="button">🔄 مسح</button>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>📚 الأسئلة (<span id="bank-count">0</span>)</h2>
      </div>
      <div id="bank-list"></div>
    </div>
  `;

  bindBankEvents();
  await loadQuestionsList();
}

/* ============================================================
   ربط الأحداث
   ============================================================ */
function bindBankEvents() {
  const page = document.getElementById('page-bank');
  if (!page) return;

  page.querySelector('#btn-open-question-form').onclick = openQuestionForm;
  page.querySelector('#bank-search').oninput = (e) => {
    BankState.searchQuery = e.target.value.toLowerCase();
    renderBankList();
  };
  page.querySelector('#bank-filter-type').onchange = (e) => {
    BankState.filterType = e.target.value;
    renderBankList();
  };
  page.querySelector('#bank-filter-difficulty').onchange = (e) => {
    BankState.filterDifficulty = e.target.value;
    renderBankList();
  };
  page.querySelector('#btn-clear-bank-filters').onclick = () => {
    BankState.searchQuery = '';
    BankState.filterType = 'all';
    BankState.filterDifficulty = 'all';
    page.querySelector('#bank-search').value = '';
    page.querySelector('#bank-filter-type').value = 'all';
    page.querySelector('#bank-filter-difficulty').value = 'all';
    renderBankList();
  };
}

/* ============================================================
   تحميل قائمة الأسئلة
   ============================================================ */
async function loadQuestionsList() {
  try {
    const list = await Api.listQuestions();
    BankState.questions = (list || []).map(q => ({
      ...q,
      options: safeParseJSON(q.optionsJson),
      points: Number(q.points) || 1
    }));
    renderBankList();
  } catch (e) {
    toast('خطأ في تحميل الأسئلة: ' + e.message, 'error');
  }
}

function safeParseJSON(str) {
  try {
    if (!str) return [];
    if (Array.isArray(str)) return str;
    return JSON.parse(str);
  } catch (e) {
    return [];
  }
}

/* ============================================================
   عرض قائمة الأسئلة
   ============================================================ */
function renderBankList() {
  const container = document.getElementById('bank-list');
  const countEl = document.getElementById('bank-count');
  if (!container) return;

  let filtered = BankState.questions;

  if (BankState.searchQuery) {
    filtered = filtered.filter(q =>
      (q.text || '').toLowerCase().includes(BankState.searchQuery)
    );
  }

  if (BankState.filterType !== 'all') {
    filtered = filtered.filter(q => q.type === BankState.filterType);
  }

  if (BankState.filterDifficulty !== 'all') {
    filtered = filtered.filter(q => q.difficulty === BankState.filterDifficulty);
  }

  countEl.textContent = filtered.length;

  if (!filtered.length) {
    container.innerHTML = '<div class="empty">لا يوجد أسئلة مطابقة</div>';
    return;
  }

  const typeLabel = {
    mcq: '🎯 اختيار متعدد',
    tf: '✅ صح/خطأ',
    short: '✏️ إجابة قصيرة'
  };

  const difficultyLabel = {
    easy: '🟢 سهل',
    medium: '🟡 متوسط',
    hard: '🔴 صعب'
  };

  container.innerHTML = filtered.map(q => `
    <div class="q-preview" style="padding:14px;border:1px solid var(--border);border-radius:10px;margin-bottom:8px;background:#f8fafc">
      <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:200px">
          <div style="font-weight:700;margin-bottom:6px">${escapeHtml(q.text || '')}</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;font-size:12px;color:var(--text-muted)">
            <span>${typeLabel[q.type] || q.type}</span>
            <span>${difficultyLabel[q.difficulty] || 'متوسط'}</span>
            <span>⭐ ${q.points} نقطة</span>
          </div>
          ${q.options && q.options.length ? `
            <div style="margin-top:8px;padding:8px;background:#fff;border-radius:6px;font-size:13px">
              ${q.options.map(opt => `
                <div style="padding:3px 0">
                  ${String(opt).trim().toLowerCase() === String(q.answer || '').trim().toLowerCase()
                    ? '✅' : '⬜'}
                  ${escapeHtml(opt)}
                </div>
              `).join('')}
            </div>
          ` : ''}
        </div>
        <div style="display:flex;gap:6px;flex-shrink:0">
          <button class="btn btn-ghost btn-sm" data-edit-q="${q.id}" type="button">✏️</button>
          <button class="btn btn-danger btn-sm" data-del-q="${q.id}" type="button">🗑️</button>
        </div>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('[data-edit-q]').forEach(btn => {
    btn.onclick = () => openQuestionForm(btn.dataset.editQ);
  });

  container.querySelectorAll('[data-del-q]').forEach(btn => {
    btn.onclick = () => deleteQuestion(btn.dataset.delQ);
  });
}

/* ============================================================
   نموذج إضافة/تعديل سؤال
   ============================================================ */
function openQuestionForm(editId = null) {
  BankState.editingId = editId;
  const existing = editId ? BankState.questions.find(q => q.id === editId) : null;

  if (existing && existing.options && existing.options.length) {
    BankState.tempOptions = [...existing.options];
  } else {
    BankState.tempOptions = ['', '', '', ''];
  }

  const footer = document.createElement('div');
  footer.className = 'modal-footer';
  footer.innerHTML = `
    <button class="btn btn-ghost" id="btn-cancel-q" type="button">إلغاء</button>
    <button class="btn btn-primary" id="btn-save-q" type="button">💾 حفظ</button>
  `;

  openModal(existing ? '✏️ تعديل السؤال' : '➕ سؤال جديد', (body) => {
    body.innerHTML = `
      <label>نوع السؤال</label>
      <select id="q-type">
        <option value="mcq" ${existing && existing.type === 'mcq' ? 'selected' : ''}>اختيار متعدد</option>
        <option value="tf" ${existing && existing.type === 'tf' ? 'selected' : ''}>صح/خطأ</option>
        <option value="short" ${existing && existing.type === 'short' ? 'selected' : ''}>إجابة قصيرة</option>
      </select>

      <label>نص السؤال</label>
      <textarea id="q-text" rows="2" placeholder="اكتب السؤال هنا...">${existing ? escapeHtml(existing.text || '') : ''}</textarea>

      <div id="q-options-area"></div>

      <label>الإجابة الصحيحة</label>
      <input type="text" id="q-answer" value="${existing ? escapeHtml(existing.answer || '') : ''}" placeholder="النص المطابق للإجابة">

      <label>مستوى الصعوبة</label>
      <select id="q-difficulty">
        <option value="easy" ${existing && existing.difficulty === 'easy' ? 'selected' : ''}>سهل</option>
        <option value="medium" ${existing && existing.difficulty === 'medium' ? 'selected' : ''}>متوسط</option>
        <option value="hard" ${existing && existing.difficulty === 'hard' ? 'selected' : ''}>صعب</option>
      </select>

      <label>النقاط</label>
      <input type="number" id="q-points" value="${existing ? existing.points : 1}" min="1" max="20">

      <label>كلمات مفتاحية (اختياري)</label>
      <input type="text" id="q-tags" value="${existing ? escapeHtml(existing.tags || '') : ''}" placeholder="رياضيات، جبر، معادلات">
    `;

    const typeSelect = body.querySelector('#q-type');
    const optionsArea = body.querySelector('#q-options-area');

    function renderOptions() {
      const type = typeSelect.value;
      if (type === 'tf') {
        optionsArea.innerHTML = `
          <label>الخيارات (صح/خطأ)</label>
          <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:13px;color:var(--text-muted)">
            ⚙️ خيارا "صح" و "خطأ" يُضافان تلقائيًا. اكتب في الإجابة إما "صح" أو "خطأ".
          </div>
        `;
      } else if (type === 'short') {
        optionsArea.innerHTML = `
          <div style="padding:10px;background:var(--bg);border-radius:8px;font-size:13px;color:var(--text-muted);margin-top:10px">
            💡 اكتب الإجابة النموذجية في حقل "الإجابة الصحيحة". لا خيارات.
          </div>
        `;
      } else {
        optionsArea.innerHTML = `
          <label>الخيارات</label>
          <div id="q-options-list"></div>
        `;
        const optionsList = body.querySelector('#q-options-list');
        BankState.tempOptions.forEach((opt, i) => {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:8px;margin-bottom:6px;align-items:center';
          row.innerHTML = `
            <input type="text" value="${escapeHtml(opt)}" placeholder="الخيار ${i + 1}" data-opt-idx="${i}" style="flex:1">
            <button class="btn btn-ghost btn-sm" type="button" data-pick="${i}" title="تعيين كإجابة صحيحة">✔</button>
          `;
          optionsList.appendChild(row);
        });
        optionsList.querySelectorAll('input[data-opt-idx]').forEach(inp => {
          inp.oninput = (e) => {
            BankState.tempOptions[Number(e.target.dataset.optIdx)] = e.target.value;
          };
        });
        optionsList.querySelectorAll('[data-pick]').forEach(btn => {
          btn.onclick = () => {
            const idx = Number(btn.dataset.pick);
            const val = BankState.tempOptions[idx];
            if (!val) {
              toast('اكتب الخيار أولًا', 'warn');
              return;
            }
            body.querySelector('#q-answer').value = val;
            toast('تم تعيين الإجابة: ' + val, 'success');
          };
        });
      }
    }

    typeSelect.onchange = renderOptions;
    renderOptions();
  }, { footer });

  document.getElementById('btn-cancel-q').onclick = closeAllModals;
  document.getElementById('btn-save-q').onclick = saveQuestionForm;
}

/* ============================================================
   حفظ السؤال
   ============================================================ */
async function saveQuestionForm() {
  const type = document.getElementById('q-type').value;
  const text = document.getElementById('q-text').value.trim();
  const answer = document.getElementById('q-answer').value.trim();
  const difficulty = document.getElementById('q-difficulty').value;
  const points = Number(document.getElementById('q-points').value) || 1;
  const tags = document.getElementById('q-tags').value.trim();

  if (!text) {
    toast('أدخل نص السؤال', 'warn');
    return;
  }
  if (!answer) {
    toast('أدخل الإجابة الصحيحة', 'warn');
    return;
  }

  let options = [];
  if (type === 'tf') {
    options = ['صح', 'خطأ'];
  } else if (type === 'mcq') {
    options = BankState.tempOptions.filter(o => String(o).trim());
    if (options.length < 2) {
      toast('أدخل خيارين على الأقل', 'warn');
      return;
    }
  }

  const payload = {
    id: BankState.editingId || undefined,
    type,
    text,
    options,
    answer,
    difficulty,
    points,
    tags
  };

  try {
    await Api.saveQuestion(payload);
    toast('تم الحفظ', 'success');
    closeAllModals();
    await loadQuestionsList();
  } catch (e) {
    toast(e.message, 'error');
  }
}

/* ============================================================
   حذف سؤال
   ============================================================ */
async function deleteQuestion(id) {
  const q = BankState.questions.find(x => x.id === id);
  if (!q) return;

  const ok = await confirmAction(
    `🗑️ حذف السؤال؟<br><br>"${escapeHtml((q.text || '').slice(0, 80))}..."`,
    'حذف'
  );
  if (!ok) return;

  try {
    await Api.deleteQuestion(id);
    toast('تم الحذف', 'success');
    await loadQuestionsList();
  } catch (e) {
    toast(e.message, 'error');
  }
}