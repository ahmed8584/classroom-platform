/* ============================================================
   ai.js — مساعد المعلم الذكي
   ============================================================ */

const AIState = {
  lastResult: '',
  generating: false,
  presets: [
    {
      id: 'lesson-plan',
      icon: '📋',
      title: 'خطة درس كاملة',
      desc: 'خطة متكاملة مع أهداف وأنشطة',
      prompt: (p) => `أنشئ خطة درس متكاملة بالعربية للصف ${p.grade}، مادة ${p.subject}، موضوع "${p.topic}"، مدة ${p.duration} دقيقة.
اتبع هذا الهيكل:
1) أهداف التعلم (قابلة للقياس)
2) تمهيد جذاب
3) شرح مختصر
4) نشاط تفاعلي
5) تقويم ختامي
6) بطاقة خروج`
    },
    {
      id: 'questions',
      icon: '❓',
      title: 'أسئلة متدرجة',
      desc: 'أسئلة من السهل إلى الصعب',
      prompt: (p) => `أنشئ ${p.count} أسئلة اختيار من متعدد بالعربية للصف ${p.grade}، مادة ${p.subject}، موضوع "${p.topic}".
لكل سؤال 4 خيارات، وحدّد الإجابة الصحيحة بوضوح. رتّبها من السهل إلى الصعب.`
    },
    {
      id: 'activities',
      icon: '🎮',
      title: 'أنشطة تفاعلية',
      desc: 'أفكار أنشطة صفية ملهمة',
      prompt: (p) => `اقترح 5 أنشطة تفاعلية صفية بالعربية للصف ${p.grade}، مادة ${p.subject}، موضوع "${p.topic}".
لكل نشاط: الاسم، الهدف، المدة، الخطوات، الأدوات.`
    },
    {
      id: 'remedial',
      icon: '💪',
      title: 'خطة علاجية',
      desc: 'للطلبة المتعثرين',
      prompt: (p) => `أنشئ خطة علاجية للطلبة المتعثرين في موضوع "${p.topic}" بمادة ${p.subject}، الصف ${p.grade}.
تضمّن: تشخيص الصعوبات، أنشطة علاجية، تقويم تكويني، استراتيجيات دعم.`
    },
    {
      id: 'enrichment',
      icon: '⭐',
      title: 'تحديات إثرائية',
      desc: 'للطلبة المتقدمين',
      prompt: (p) => `أنشئ 3 تحديات إثرائية للطلبة المتقدمين في موضوع "${p.topic}" بمادة ${p.subject}، الصف ${p.grade}.
تحديات تفتح آفاقًا للإبداع والتفكير الناقد.`
    },
    {
      id: 'intro',
      icon: '💡',
      title: 'مقدمة جذابة',
      desc: 'افتح درسك بسؤال مثير',
      prompt: (p) => `اقترح 3 طرق جذابة لبدء حصة "${p.topic}" بمادة ${p.subject} للصف ${p.grade}.
استخدم: سؤال محير، قصة قصيرة، أو مثال من الحياة اليومية.`
    }
  ]
};

/* ============================================================
   عرض الصفحة
   ============================================================ */
function renderAIPage() {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-ai');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-ai';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="welcome-hero" style="margin-bottom:20px">
      <h1>🤖 مساعد المعلم الذكي</h1>
      <p>أنشئ خططًا، أسئلة، وأنشطة — من معرفتك أو من منهجك الفعلي</p>
    </div>
    <!-- زر التوليد الذكي -->
    <div class="card" id="ai-generate-cta" style="display:none">
      <div style="text-align:center;padding:8px">
        <div style="font-size:13px;color:var(--text-muted);margin-bottom:12px">
          ✨ جاهز للتوليد؟ اختر النوع المطلوب:
        </div>
        <div class="row row-center" style="gap:10px;flex-wrap:wrap">
          ${AIState.presets.map(p => `
            <button class="btn btn-primary" data-quick-preset="${p.id}" type="button"
              style="font-size:14px;padding:12px 20px">
              ${p.icon} ${p.title}
            </button>
          `).join('')}
        </div>
        <div style="margin-top:14px;font-size:12px;color:var(--text-muted)">
          💡 أو اختر من المكتبة أدناه
        </div>
      </div>
    </div>
    <!-- إعدادات المحتوى -->
    <div class="card">
      <div class="card-header">
        <h2>⚙️ إعدادات المحتوى</h2>
      </div>

      <div class="row" style="gap:12px;flex-wrap:wrap">
        <div style="flex:1;min-width:140px">
          <label>الصف</label>
          <input type="text" id="ai-grade" placeholder="مثال: سابع">
        </div>
        <div style="flex:1;min-width:140px">
          <label>المادة</label>
          <input type="text" id="ai-subject" placeholder="مثال: رياضيات">
        </div>
        <div style="flex:2;min-width:200px">
          <label>الموضوع</label>
          <input type="text" id="ai-topic" placeholder="مثال: المعادلات الخطية">
        </div>
      </div>

      <div class="row" style="gap:12px;margin-top:10px;flex-wrap:wrap">
        <div style="flex:1;min-width:100px">
          <label>المدة (د)</label>
          <input type="number" id="ai-duration" value="45" min="10" max="180">
        </div>
        <div style="flex:1;min-width:100px">
          <label>عدد الأسئلة</label>
          <input type="number" id="ai-count" value="5" min="3" max="20">
        </div>
        <div style="flex:1;min-width:140px">
          <label>مستوى الصعوبة</label>
          <select id="ai-difficulty">
            <option value="easy">سهل</option>
            <option value="medium" selected>متوسط</option>
            <option value="hard">صعب</option>
          </select>
        </div>
      </div>
    </div>

    <!-- قسم المصادر — جديد -->
    <div id="ai-source-section"></div>

    <!-- اختيار نوع المحتوى -->
    <div class="card">
      <div class="card-header">
        <h2>✨ اختر نوع المحتوى</h2>
      </div>
      <div class="tiles-row" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))">
        ${AIState.presets.map(p => `
          <button class="tile" data-ai-preset="${p.id}" type="button" style="cursor:pointer">
            <span class="tile-icon">${p.icon}</span>
            <span class="tile-title">${p.title}</span>
            <span class="tile-desc">${p.desc}</span>
          </button>
        `).join('')}
      </div>
    </div>

    <!-- النتيجة -->
    <div class="card" id="ai-result-card" style="display:none">
      <div class="card-header">
        <h2>📝 النتيجة</h2>
        <div class="row">
          <button class="btn btn-ghost btn-sm" id="btn-copy-ai" type="button">📋 نسخ</button>
          <button class="btn btn-ghost btn-sm" id="btn-save-ai" type="button">💾 حفظ في درس</button>
          <button class="btn btn-primary btn-sm" id="btn-regenerate-ai" type="button">🔄 إعادة توليد</button>
        </div>
      </div>
      <div id="ai-output"
           style="white-space:pre-wrap;line-height:1.9;font-size:15px;padding:16px;background:#f8fafc;border-radius:10px;min-height:100px">
      </div>
    </div>
  `;

  // اربط بطاقات التوليد
  page.querySelectorAll('[data-ai-preset]').forEach(btn => {
    btn.onclick = () => generateAIContent(btn.dataset.aiPreset);
  });

  // ابنِ قسم المصادر — جديد
    // ابنِ قسم المصادر — جديد
  const sourceSection = document.getElementById('ai-source-section');
  if (sourceSection) {
    buildSourceSection(sourceSection);
  }

  // اربط الأزرار السريعة الجديدة
  page.querySelectorAll('[data-quick-preset]').forEach(btn => {
    btn.onclick = () => generateAIContent(btn.dataset.quickPreset);
  });

  // اربط الأزرار الموجودة في القائمة السفلية
  page.querySelectorAll('[data-ai-preset]').forEach(btn => {
    btn.onclick = () => generateAIContent(btn.dataset.aiPreset);
  });

  // ✅ راقب الوصف — أظهر زر التوليد عند الكتابة
    // ✅ راقب الوصف — أظهر زر التوليد عند الكتابة
  setupGenerateCTAWatcher();

  // ✅ راقب حقل الموضوع أيضًا
  const topicInput = document.getElementById('ai-topic');
  if (topicInput) {
    topicInput.addEventListener('input', () => {
      if (typeof updateQuickGenerateVisibility === 'function') {
        updateQuickGenerateVisibility();
      }
    });
  }
}


/* ============================================================
   مراقبة حقل الوصف — إظهار زر التوليد عند الكتابة
   ============================================================ */
function setupGenerateCTAWatcher() {
  const cta = document.getElementById('ai-generate-cta');
  if (!cta) return;

  const checkCTA = () => {
    const hasSource = AIMedia.currentSource !== 'none' && isSourceReady();
    const hasInstructions = AIMedia.customInstructions && AIMedia.customInstructions.trim().length > 10;
    const hasTopic = document.getElementById('ai-topic')?.value.trim().length > 0;

    // أظهر زر التوليد عند وجود أي تفاعل
    if (hasSource || hasInstructions || hasTopic) {
      cta.style.display = 'block';
    } else {
      cta.style.display = 'none';
    }
  };

  // راقب التغييرات
  const topicInput = document.getElementById('ai-topic');
  if (topicInput) {
    topicInput.addEventListener('input', checkCTA);
  }

  // MutationObserver على حقل الوصف (لأنه يُعاد بناؤه)
  const observer = new MutationObserver(checkCTA);
  const sourceSection = document.getElementById('ai-source-section');
  if (sourceSection) {
    observer.observe(sourceSection, { childList: true, subtree: true, characterData: true, attributes: true });
  }

  // راقب الوصف كل ثانية (احتياطي)
  setInterval(checkCTA, 1000);

  checkCTA();
}

/* ============================================================
   توليد المحتوى
   ============================================================ */
async function generateAIContent(presetId) {
  if (AIState.generating) return;

    let preset = AIState.presets.find(p => p.id === presetId);

  // ⭐ إذا لم يُوجد النوع، أو كان "free" → استخدم وصفًا حرًا
  if (!preset || presetId === 'free') {
    preset = {
      id: 'free',
      icon: '✍️',
      title: 'حسب الوصف الحر',
      desc: 'يُولّد وفق تعليماتك الخاصة',
      prompt: (params) => {
        // إذا لم يكن هناك وصف مخصص، اطلب محتوى عام
        if (!AIMedia.customInstructions || !AIMedia.customInstructions.trim()) {
          return `أعدّ محتوى تعليميًا شاملاً عن "${params.topic}" لمادة ${params.subject} للصف ${params.grade}.`;
        }
        // وإلا استخدم الوصف المخصص
        return AIMedia.customInstructions.trim();
      }
    };
  }

  const grade = document.getElementById('ai-grade').value.trim();
  const subject = document.getElementById('ai-subject').value.trim();
  const topic = document.getElementById('ai-topic').value.trim();
  const duration = Number(document.getElementById('ai-duration').value) || 45;
  const count = Number(document.getElementById('ai-count').value) || 5;
  const difficulty = document.getElementById('ai-difficulty').value;

  if (!grade || !subject || !topic) {
    toast('أدخل الصف والمادة والموضوع', 'warn');
    return;
  }

  // ⭐ تحقق من المصدر
  if (AIMedia.currentSource !== 'none' && !isSourceReady()) {
    toast('المصدر غير جاهز — أكمل رفع الملف أولًا', 'warn');
    return;
  }

  AIState.generating = true;

  const resultCard = document.getElementById('ai-result-card');
  const output = document.getElementById('ai-output');
  resultCard.style.display = 'block';
  output.innerHTML = `
    <div style="text-align:center;padding:40px">
      <div style="font-size:40px;animation:float 2s ease-in-out infinite">🤖</div>
      <div style="margin-top:16px;font-weight:700;color:var(--primary)">
        جارٍ التوليد...
      </div>
      <div style="font-size:13px;color:var(--text-muted);margin-top:6px">
        ${AIMedia.currentSource !== 'none'
          ? '⏳ قد يستغرق 15-30 ثانية (يحلّل المصدر)'
          : '⏳ قد يستغرق 10-20 ثانية'}
      </div>
    </div>
  `;

  // ⭐ اجهز البيانات
  const params = {
    grade, subject, topic, duration, count, difficulty,
    prompt: preset.prompt({ grade, subject, topic, duration, count, difficulty }),

    // مصدر المحتوى
    sourceText: buildSourceTextForAI(),
    sourceType: AIMedia.currentSource,

    // وصف مخصص
    customInstructions: AIMedia.customInstructions.trim(),

    // للصور (base64)
    imageBase64: AIMedia.imageBase64 || '',
    imageMimeType: AIMedia.imageBase64 ? 'image/jpeg' : ''
  };

  try {
    const res = await Api.aiGenerate(params);

    if (res.configured) {
      if (res.text && res.text.trim()) {
        output.textContent = res.text;
        AIState.lastResult = res.text;
        toast('✨ تم التوليد' + (res.model ? ' (' + res.model + ')' : ''), 'success');
      } else {
        output.innerHTML = `
          <div style="padding:16px;background:#fee2e2;border-radius:10px;color:#991b1b">
            <div style="font-weight:800;font-size:16px;margin-bottom:8px">❌ فشل توليد المحتوى</div>
            <div style="font-family:monospace;font-size:12px;background:#fff;padding:12px;border-radius:6px;word-break:break-all">
              ${escapeHtml(res.error || 'سبب غير معروف')}
            </div>
          </div>
        `;
        AIState.lastResult = '';
        toast('فشل التوليد', 'error');
      }
    } else {
      output.innerHTML = `
        <div style="padding:12px;background:#fff3c4;border-radius:8px;margin-bottom:16px;font-size:13px">
          ⚠️ ${escapeHtml(res.message || 'لم يتم ربط AI')}
        </div>
        <div style="white-space:pre-wrap">${escapeHtml(res.fallback || '')}</div>
      `;
      AIState.lastResult = res.fallback || '';
    }
  } catch (e) {
    output.innerHTML = `<div style="color:var(--danger);padding:20px;text-align:center">❌ خطأ: ${escapeHtml(e.message)}</div>`;
    toast(e.message, 'error');
  } finally {
    AIState.generating = false;

    const copyBtn = document.getElementById('btn-copy-ai');
    const saveBtn = document.getElementById('btn-save-ai');
    const regenBtn = document.getElementById('btn-regenerate-ai');

    if (copyBtn) copyBtn.onclick = copyAIResult;
    if (saveBtn) saveBtn.onclick = saveAIResultToLesson;
    if (regenBtn) regenBtn.onclick = () => generateAIContent(presetId);
  }
}

/* ============================================================
   نسخ النتيجة
   ============================================================ */
function copyAIResult() {
  if (!AIState.lastResult) {
    toast('لا يوجد محتوى لنسخه', 'warn');
    return;
  }

  navigator.clipboard.writeText(AIState.lastResult)
    .then(() => toast('📋 تم النسخ', 'success'))
    .catch(() => {
      // بديل قديم
      const ta = document.createElement('textarea');
      ta.value = AIState.lastResult;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
      toast('📋 تم النسخ', 'success');
    });
}

/* ============================================================
   حفظ في درس جديد
   ============================================================ */
async function saveAIResultToLesson() {
  if (!AIState.lastResult) {
    toast('لا يوجد محتوى لحفظه', 'warn');
    return;
  }

  const topic = document.getElementById('ai-topic').value.trim() || 'درس جديد';
  const subject = document.getElementById('ai-subject').value.trim();
  const grade = document.getElementById('ai-grade').value.trim();

  const ok = await confirmAction(
    `💾 حفظ النتيجة كدرس جديد بعنوان "<b>${escapeHtml(topic)}</b>"؟`,
    'حفظ'
  );
  if (!ok) return;

  try {
    const lesson = await Api.saveLesson({
      title: topic,
      subject,
      grade,
      blocks: [{
        type: 'content',
        title: 'محتوى مُولَّد بواسطة AI',
        body: AIState.lastResult
      }]
    });

    toast('💾 تم حفظ الدرس في الاستوديو', 'success');

    // انتقل إلى الاستوديو
    if (typeof renderStudioPage === 'function') {
      setTimeout(() => renderStudioPage(lesson.id), 800);
    }
  } catch (e) {
    toast(e.message, 'error');
  }
}