/* ============================================================
   ai-media.js — إدارة مصادر المحتوى للـ AI
   PDF + صور + نص ملصق + أوصاف مخصصة
   ============================================================ */

const AIMedia = {
  // ... الموجود ...
  selectedPresetType: null,   // ⭐ النوع المختار من القوالب (أو null)
  // الحالة
  currentSource: 'none',        // none | pdf | image | text
  pdfText: '',
  pdfFileName: '',
  pdfPageCount: 0,
  imageBase64: '',
  imageFileName: '',
  pastedText: '',
  customInstructions: '',
  savedPresets: [],

  // حدود
  MAX_PDF_SIZE: 30 * 1024 * 1024,     // 30MB
  MAX_PDF_PAGES: 100,
  MAX_TEXT_LENGTH: 50000,             // 50k حرف
  MAX_PDF_TEXT_SENT: 30000,           // 30k حرف لـ Gemini

  // مكتبة PDF.js
  pdfjsLoaded: false,
  pdfjsLoading: null
};

/* ============================================================
   تحميل مكتبة PDF.js عند الحاجة
   ============================================================ */
/* ============================================================
   تحميل مكتبة PDF.js — نسخة محسّنة
   ============================================================ */
async function loadPdfJs() {
  if (AIMedia.pdfjsLoaded && window.pdfjsLib) return true;
  if (AIMedia.pdfjsLoading) return AIMedia.pdfjsLoading;

  AIMedia.pdfjsLoading = new Promise((resolve, reject) => {
    // إذا كانت المكتبة محمّلة مسبقًا
    if (window.pdfjsLib) {
      try {
        window.pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
        AIMedia.pdfjsLoaded = true;
        resolve(true);
        return;
      } catch (e) {}
    }

    const script = document.createElement('script');
    // ✅ استخدام cdnjs (أكثر استقرارًا من jsdelivr)
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    script.async = true;

    const timeout = setTimeout(() => {
      reject(new Error('انتهت مهلة تحميل PDF.js — تحقق من الإنترنت'));
    }, 20000);

    script.onload = () => {
      clearTimeout(timeout);

      if (!window.pdfjsLib) {
        reject(new Error('PDF.js لم يُسجّل في window'));
        return;
      }

      // ✅ Worker من نفس المصدر (cdnjs)
      window.pdfjsLib.GlobalWorkerOptions.workerSrc =
        'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';

      AIMedia.pdfjsLoaded = true;
      log('PDF.js', 'تم التحميل — الإصدار: ' + window.pdfjsLib.version);
      resolve(true);
    };

    script.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('فشل تحميل PDF.js من CDN'));
    };

    document.head.appendChild(script);
  });

  return AIMedia.pdfjsLoading;
}

/* ============================================================
   استخراج النص من PDF
   ============================================================ */
async function extractPdfText(file, onProgress) {
  // 1) تحقق من الحجم
  if (file.size > AIMedia.MAX_PDF_SIZE) {
    throw new Error(`حجم الملف كبير (${(file.size / 1024 / 1024).toFixed(1)}MB). الحد: 30MB`);
  }

  // 2) حمّل المكتبة
  if (onProgress) onProgress('جارٍ تحميل مكتبة PDF...');
  await loadPdfJs();

  // 3) اقرأ الملف
  if (onProgress) onProgress('جارٍ قراءة الملف...');
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  const totalPages = pdf.numPages;

  if (totalPages > AIMedia.MAX_PDF_PAGES) {
    log('PDF', `الملف ${totalPages} صفحة — سيُقتصر على ${AIMedia.MAX_PDF_PAGES}`);
  }

  const pagesToRead = Math.min(totalPages, AIMedia.MAX_PDF_PAGES);
  let fullText = '';

  // 4) استخرج النص صفحة بصفحة
  for (let i = 1; i <= pagesToRead; i++) {
    if (onProgress) onProgress(`جارٍ استخراج الصفحة ${i}/${pagesToRead}...`);

    try {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items.map(item => item.str).join(' ');
      fullText += `\n\n--- صفحة ${i} ---\n${pageText}`;
    } catch (e) {
      log('PDF', `فشل استخراج صفحة ${i}: ${e.message}`);
    }
  }

  // 5) اقتصاص إذا كان طويلًا
  let wasTrimmed = false;
  if (fullText.length > AIMedia.MAX_TEXT_LENGTH) {
    fullText = fullText.slice(0, AIMedia.MAX_TEXT_LENGTH);
    wasTrimmed = true;
  }

  return {
    text: fullText,
    pages: totalPages,
    pagesRead: pagesToRead,
    chars: fullText.length,
    trimmed: wasTrimmed,
    fileName: file.name
  };
}

/* ============================================================
   تحويل صورة إلى Base64
   ============================================================ */
async function imageToBase64(file) {
  // تحقق من النوع
  if (!file.type.startsWith('image/')) {
    throw new Error('الملف ليس صورة');
  }

  // تحقق من الحجم (5MB)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('حجم الصورة كبير (الحد: 5MB)');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result = "data:image/jpeg;base64,xxxxx"
      const base64 = reader.result.split(',')[1];
      resolve({
        base64,
        mimeType: file.type,
        fileName: file.name,
        size: file.size
      });
    };
    reader.onerror = () => reject(new Error('فشل قراءة الصورة'));
    reader.readAsDataURL(file);
  });
}

/* ============================================================
   التحقق من النص الملصق
   ============================================================ */
function validatePastedText(text) {
  const trimmed = String(text || '').trim();

  if (trimmed.length < 50) {
    throw new Error('النص قصير جدًا (50 حرفًا على الأقل)');
  }

  if (trimmed.length > AIMedia.MAX_TEXT_LENGTH) {
    return {
      text: trimmed.slice(0, AIMedia.MAX_TEXT_LENGTH),
      chars: AIMedia.MAX_TEXT_LENGTH,
      trimmed: true
    };
  }

  return {
    text: trimmed,
    chars: trimmed.length,
    trimmed: false
  };
}

/* ============================================================
   بناء نص المصدر النهائي للإرسال
   ============================================================ */
function buildSourceTextForAI() {
  switch (AIMedia.currentSource) {
    case 'pdf':
      return AIMedia.pdfText
        ? AIMedia.pdfText.slice(0, AIMedia.MAX_PDF_TEXT_SENT)
        : '';

    case 'text':
      return AIMedia.pastedText
        ? AIMedia.pastedText.slice(0, AIMedia.MAX_PDF_TEXT_SENT)
        : '';

    case 'image':
      // الصور تُرسل بشكل منفصل (vision)
      return '';

    default:
      return '';
  }
}

/* ============================================================
   التحقق: هل المصدر جاهز للإرسال؟
   ============================================================ */
function isSourceReady() {
  switch (AIMedia.currentSource) {
    case 'none':
      return true;

    case 'pdf':
      return !!(AIMedia.pdfText && AIMedia.pdfText.length > 50);

    case 'text':
      return !!(AIMedia.pastedText && AIMedia.pastedText.length > 50);

    case 'image':
      return !!AIMedia.imageBase64;

    default:
      return false;
  }
}

/* ============================================================
   مسح كل المصادر
   ============================================================ */
function resetAllSources() {
  AIMedia.currentSource = 'none';
  AIMedia.pdfText = '';
  AIMedia.pdfFileName = '';
  AIMedia.pdfPageCount = 0;
  AIMedia.imageBase64 = '';
  AIMedia.imageFileName = '';
  AIMedia.pastedText = '';
  AIMedia.customInstructions = '';
}

/* ============================================================
   حفظ / استرجاع الأوصاف المفضلة
   ============================================================ */
function loadSavedPresets() {
  try {
    const stored = localStorage.getItem('ai_custom_presets');
    AIMedia.savedPresets = stored ? JSON.parse(stored) : [];
  } catch (e) {
    AIMedia.savedPresets = [];
  }
  return AIMedia.savedPresets;
}

function saveCustomPreset(name, text) {
  loadSavedPresets();

  // إذا وُجد بنفس الاسم، حدّثه
  const existing = AIMedia.savedPresets.findIndex(p => p.name === name);
  if (existing >= 0) {
    AIMedia.savedPresets[existing].text = text;
  } else {
    // حد 10 presets
    if (AIMedia.savedPresets.length >= 10) {
      AIMedia.savedPresets.shift();
    }
    AIMedia.savedPresets.push({ name, text, at: Date.now() });
  }

  try {
    localStorage.setItem('ai_custom_presets', JSON.stringify(AIMedia.savedPresets));
    toast('✅ تم حفظ الوصف', 'success');
  } catch (e) {
    toast('فشل الحفظ (مساحة ممتلئة)', 'error');
  }

  return AIMedia.savedPresets;
}

function deleteCustomPreset(name) {
  loadSavedPresets();
  AIMedia.savedPresets = AIMedia.savedPresets.filter(p => p.name !== name);

  try {
    localStorage.setItem('ai_custom_presets', JSON.stringify(AIMedia.savedPresets));
    toast('تم الحذف', 'success');
  } catch (e) {}

  return AIMedia.savedPresets;
}

/* ============================================================
   قوالب سريعة للوصف
   ============================================================ */
const QUICK_INSTRUCTION_TEMPLATES = [
  {
    icon: '✍️',
    label: 'حسب وصفي',
    text: '',                  // ← لا نص — فقط يُفعّل وضع "حر"
    isFreeMode: true           // ⭐ علامة خاصة
  },
  {
    icon: '📋',
    label: 'خطة كاملة',
    text: 'استخرج الأهداف التعليمية والمفاهيم الأساسية من المحتوى، وأعدّ خطة درس متكاملة مع: تمهيد، شرح، نشاط، تقويم، وبطاقة خروج.'
  },
  // ... باقي القوالب كما هي
  {
    icon: '📋',
    label: 'خطة كاملة',
    text: 'استخرج الأهداف التعليمية والمفاهيم الأساسية من المحتوى، وأعدّ خطة درس متكاملة مع: تمهيد، شرح، نشاط، تقويم، وبطاقة خروج.'
  },
  {
    icon: '❓',
    label: 'أسئلة فقط',
    text: 'أنشئ 10 أسئلة اختيار من متعدد متدرجة الصعوبة من المحتوى المرفق، مع الإشارة إلى الإجابة الصحيحة لكل سؤال.'
  },
  {
    icon: '📝',
    label: 'ملخص',
    text: 'لخّص كل مفهوم رئيسي في المحتوى في 3 نقاط مختصرة، مع مثال عملي واحد لكل مفهوم.'
  },
  {
    icon: '🎮',
    label: 'أنشطة',
    text: 'حوّل كل مفهوم رئيسي إلى نشاط تفاعلي صفي (فردي أو جماعي)، مع شرح موجز للخطوات والأدوات المطلوبة.'
  },
  {
    icon: '🧪',
    label: 'تقويم',
    text: 'أعدّ تقويمًا قبليًا (5 أسئلة) وتقويمًا بعديًا (5 أسئلة) من المحتوى، مع معايير التصحيح ومستويات الأداء.'
  },
  {
    icon: '💡',
    label: 'تطبيقات',
    text: 'اقترح 5 تطبيقات عملية أو أمثلة من الحياة اليومية لكل مفهوم رئيسي، مع شرح طريقة ربطها بالدرس.'
  },
  {
    icon: '⭐',
    label: 'إثراء',
    text: 'أعدّ 3 تحديات إثرائية للطلبة المتقدمين من المحتوى، تتطلب تفكيرًا ناقدًا أو إبداعًا.'
  },
  {
    icon: '💪',
    label: 'علاجي',
    text: 'أنشئ خطة علاجية للطلبة المتعثرين في الموضوع، مع: تشخيص الصعوبات، أنشطة مبسطة، وتقويم متدرج.'
  }
];

/* ============================================================
   تنسيق معلومات الملف للعرض
   ============================================================ */
function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / 1024 / 1024).toFixed(2) + ' MB';
}

function getSourceSummary() {
  switch (AIMedia.currentSource) {
    case 'pdf':
      return `📄 ${AIMedia.pdfFileName} • ${AIMedia.pdfPageCount} صفحة • ${AIMedia.pdfText.length.toLocaleString('ar')} حرف`;

    case 'text':
      return `📋 نص ملصق • ${AIMedia.pastedText.length.toLocaleString('ar')} حرف`;

    case 'image':
      return `🖼️ ${AIMedia.imageFileName}`;

    default:
      return 'من معرفة الذكاء الاصطناعي فقط';
  }
}

/* ============================================================
   بناء UI قسم المصادر
   ============================================================ */
function buildSourceSection(container) {
  loadSavedPresets();

  container.innerHTML = `
        <div class="card">
      <div class="card-header">
        <h2>📚 مصدر المحتوى (اختياري)</h2>
        <div class="row" style="gap:8px">
          <span id="source-badge" style="font-size:12px;color:var(--text-muted)"></span>
          <button class="btn btn-danger btn-sm" id="btn-clear-all-source" type="button">🗑️ مسح الكل</button>
        </div>
      </div>

      <p style="color:var(--text-muted);font-size:13px;margin-bottom:14px">
        💡 بدون مصدر: يعتمد AI على معرفته العامة. مع مصدر: يولّد من منهجك الفعلي.
      </p>

      <div class="source-tabs" id="source-tabs">
        <button class="source-tab active" data-source="none" type="button">
          <span style="font-size:20px">🤖</span>
          <span>من معرفتي</span>
        </button>
        <button class="source-tab" data-source="pdf" type="button">
          <span style="font-size:20px">📄</span>
          <span>ملف PDF</span>
        </button>
        <button class="source-tab" data-source="image" type="button">
          <span style="font-size:20px">🖼️</span>
          <span>صورة</span>
        </button>
        <button class="source-tab" data-source="text" type="button">
          <span style="font-size:20px">📋</span>
          <span>نص ملصق</span>
        </button>
      </div>

      <div id="source-content" style="margin-top:16px"></div>
    </div>

    <div class="card">
      <div class="card-header">
        <h2>✍️ وصف ما تريده من المحتوى (اختياري)</h2>
        <button class="btn btn-ghost btn-sm" id="btn-save-preset" type="button" style="display:none">💾 حفظ وصف</button>
      </div>

      <p style="color:var(--text-muted);font-size:13px;margin-bottom:12px">
        💡 يمكنك تحديد ما تريده بدقة: "ركّز على الوحدة الأولى"، "بسّط المستوى"، "أهمل الأمثلة المحلولة"، إلخ.
      </p>

      <textarea id="custom-instructions" rows="4"
        placeholder="مثال: استخرج المفاهيم الأساسية من الوحدة الأولى فقط، وأعدّ خطة لـ 3 حصص، مع 5 أسئلة لكل حصة..."
        style="font-size:14px;line-height:1.6"></textarea>

      <div style="margin-top:14px">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">
          💡 قوالب سريعة:
        </div>
        <div class="preset-templates" id="preset-templates"></div>
      </div>

            <div id="ai-quick-generate" style="margin-top:18px;padding:16px;background:linear-gradient(135deg,#eff6ff,#f5f3ff);border-radius:12px;border:2px solid var(--primary);display:none">
        <button class="btn btn-primary btn-lg" id="btn-quick-generate" type="button"
          style="width:100%;font-size:17px;padding:16px;font-weight:800;box-shadow:0 6px 16px rgba(30,58,138,0.25)">
          ✨ توليد المحتوى الآن
        </button>

        <div style="margin-top:10px;font-size:12px;color:var(--text-muted);text-align:center" id="quick-gen-hint">
          💡 اكتب وصفًا أو اختر قالبًا سريعًا
        </div>
      </div>

      <div id="saved-presets-section" style="margin-top:16px;display:none">
        <div style="font-size:12px;font-weight:700;color:var(--text-muted);margin-bottom:8px">
          ⭐ أوصافي المحفوظة:
        </div>
        <div id="saved-presets-list"></div>
      </div>
    </div>
  `;

  bindSourceEvents(container);
  renderQuickTemplates(container);
  renderSavedPresets(container);
}
/* ============================================================
   ربط أحداث قسم المصادر
   ============================================================ */
function bindSourceEvents(container) {
  // ⭐ زر "مسح الكل"
  const clearBtn = container.querySelector('#btn-clear-all-source');
  if (clearBtn) {
    clearBtn.onclick = async () => {
      const ok = await confirmAction(
        '🗑️ هل تريد مسح المصدر والوصف معًا؟<br><br>ستحتاج إلى رفع الملف مرة أخرى.',
        'مسح الكل'
      );
      if (!ok) return;

      clearAIMedia();

      buildSourceSection(container);
      toast('✅ تم مسح كل شيء', 'success');
    };
  }

  // ... باقي الكود (bindSourceEvents كما هو)
  // تبديل التبويبات
  container.querySelectorAll('.source-tab').forEach(tab => {
    tab.onclick = () => {
      const source = tab.dataset.source;
      if (AIMedia.currentSource !== source) {
        AIMedia.currentSource = source;
        container.querySelectorAll('.source-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.source === source);
        });
        renderSourceContent(container);
        
      }
    };
  });

  // الوصف المخصص
  const instr = container.querySelector('#custom-instructions');
  instr.value = AIMedia.customInstructions;
  instr.oninput = (e) => {
    AIMedia.customInstructions = e.target.value;
    const saveBtn = container.querySelector('#btn-save-preset');
    if (saveBtn) {
      saveBtn.style.display = e.target.value.trim().length > 10 ? 'inline-block' : 'none';
    }
    // ⭐ أظهر زر التوليد عند الكتابة
    updateQuickGenerateVisibility();
  };

  // حفظ الوصف
  const saveBtn = container.querySelector('#btn-save-preset');
  if (saveBtn) {
    saveBtn.onclick = () => {
      const text = AIMedia.customInstructions.trim();
      if (text.length < 10) {
        toast('الوصف قصير جدًا', 'warn');
        return;
      }
      const name = prompt('اسم الوصف:');
      if (!name || !name.trim()) return;

      saveCustomPreset(name.trim(), text);
      renderSavedPresets(container);
    };
  }

  // ⭐ زر التوليد السريع
  const quickBtn = container.querySelector('#btn-quick-generate');
  if (quickBtn) {
    quickBtn.onclick = () => {
      // تحديد النوع:
      // 1) إذا اختار قالبًا سريعًا → استخدم النوع المُقترح
      // 2) إذا كتب وصفًا حرًا → استخدم "free" (وصف مخصص)
      const presetId = AIMedia.selectedPresetType || 'free';

      if (typeof generateAIContent === 'function') {
        generateAIContent(presetId);
      }
    };
  }

  // ابدأ بعرض المحتوى الحالي
  renderSourceContent(container);
  updateSourceBadge();
  updateQuickGenerateVisibility();
}

/* ============================================================
   إظهار/إخفاء زر التوليد السريع
   ============================================================ */
function updateQuickGenerateVisibility() {
  const quick = document.getElementById('ai-quick-generate');
  if (!quick) return;

  const hasInstructions = AIMedia.customInstructions && AIMedia.customInstructions.trim().length > 10;
  const hasSource = AIMedia.currentSource !== 'none' && isSourceReady();
  const hasTopic = document.getElementById('ai-topic')?.value.trim().length > 0;

  if (hasInstructions || hasSource || hasTopic) {
    quick.style.display = 'block';
  } else {
    quick.style.display = 'none';
  }

  // ⭐ حدّث النص التوضيحي حسب الحالة
  const hint = document.getElementById('quick-gen-hint');
  if (hint) {
    const preset = AIMedia.selectedPresetType;
    const presetInfo = AIState.presets.find(p => p.id === preset);

    if (preset && presetInfo) {
      hint.textContent = '📌 سيُولّد: ' + presetInfo.icon + ' ' + presetInfo.title;
      hint.style.color = 'var(--success)';
      hint.style.fontWeight = '700';
    } else if (hasInstructions) {
      hint.textContent = '✨ سيُولّد حسب وصفك الحر';
      hint.style.color = 'var(--primary)';
      hint.style.fontWeight = '700';
    } else {
      hint.textContent = '💡 اكتب وصفًا أو اختر قالبًا سريعًا';
      hint.style.color = 'var(--text-muted)';
      hint.style.fontWeight = '400';
    }
  }
}

/* ============================================================
   عرض المحتوى حسب النوع
   ============================================================ */
function renderSourceContent(container) {
  const content = container.querySelector('#source-content');
  if (!content) return;

  switch (AIMedia.currentSource) {
    case 'none':
      content.innerHTML = `
        <div style="padding:20px;background:#f1f5f9;border-radius:10px;text-align:center;color:var(--text-muted);font-size:14px">
          🤖 سيعتمد المساعد على معرفته العامة بالمنهج والموضوع
        </div>
      `;
      break;

    case 'pdf':
      renderPdfSource(content);
      break;

    case 'image':
      renderImageSource(content);
      break;

    case 'text':
      renderTextSource(content);
      break;
  }
}

/* ----- PDF ----- */
function renderPdfSource(content) {
  if (AIMedia.pdfText) {
    // ✅ نص موجود
    const isOcr = AIMedia.pdfFileName && AIMedia.pdfFileName.includes('(OCR)');
    const isEmpty = AIMedia.pdfText.length < 500;

    content.innerHTML = `
      <div style="padding:16px;background:${isOcr ? '#dcfce7' : isEmpty ? '#fef3c7' : '#dcfce7'};border-radius:10px;border:1px solid ${isOcr ? '#16a34a' : isEmpty ? '#f59e0b' : '#16a34a'}">
        <div style="display:flex;justify-content:space-between;align-items:start;gap:10px;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div style="font-weight:700;margin-bottom:4px;color:${isOcr ? '#166534' : isEmpty ? '#92400e' : '#166534'}">
              ${isOcr ? '✅' : isEmpty ? '⚠️' : '✅'} ${escapeHtml(AIMedia.pdfFileName)}
            </div>
            <div style="font-size:12px;color:${isOcr ? '#166534' : isEmpty ? '#92400e' : '#166534'}">
              ${AIMedia.pdfPageCount} صفحة • ${AIMedia.pdfText.length.toLocaleString('ar')} حرف
            </div>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-reset-pdf" type="button">🗑️ حذف</button>
        </div>

        ${isEmpty && !isOcr ? `
          <div style="margin-top:12px;padding:10px;background:#fff;border-radius:8px;font-size:13px;color:#92400e">
            ⚠️ <b>هذا PDF مصوّر (Scanned)</b> — لا يحتوي على نص قابل للاستخراج
            <br>
            💡 استخدم أحد الحلول أدناه
          </div>
        ` : ''}

        <details style="margin-top:12px">
          <summary style="cursor:pointer;font-size:13px;font-weight:700;color:var(--primary)">
            👁️ معاينة النص (${AIMedia.pdfText.length.toLocaleString('ar')} حرف)
          </summary>
          <div style="margin-top:8px;padding:10px;background:#fff;border-radius:6px;max-height:200px;overflow-y:auto;font-size:12px;line-height:1.6;font-family:monospace;white-space:pre-wrap">
            ${escapeHtml(AIMedia.pdfText.slice(0, 3000))}
            ${AIMedia.pdfText.length > 3000 ? '\n\n...' : ''}
          </div>
        </details>
      </div>

      ${isEmpty && !isOcr ? `
        <div style="margin-top:14px;display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:8px">
          <button class="btn btn-primary" id="btn-ocr-vision" type="button" style="padding:14px">
            🔄 استخراج تلقائي بـ AI
          </button>
          <button class="btn btn-ghost" id="btn-ocr-google-guide" type="button" style="padding:14px">
            📖 دليل Google OCR
          </button>
          <button class="btn btn-ghost" id="btn-switch-to-image" type="button" style="padding:14px">
            🖼️ استخدام صور
          </button>
        </div>
      ` : ''}
    `;

    content.querySelector('#btn-reset-pdf').onclick = () => {
      AIMedia.pdfText = '';
      AIMedia.pdfFileName = '';
      AIMedia.pdfPageCount = 0;
      renderPdfSource(content);
      updateSourceBadge();
    };

    // ⭐ أزرار OCR (تظهر فقط لـ PDF مصوّر)
    const ocrBtn = content.querySelector('#btn-ocr-vision');
    if (ocrBtn) {
      ocrBtn.onclick = async () => {
        // احصل على ملف PDF من الذاكرة
        const file = AIMedia._lastPdfFile;
        if (!file) {
          toast('أعد رفع الملف أولًا', 'warn');
          return;
        }
        if (typeof openOcrModal === 'function') {
          openOcrModal(file);
        }
      };
    }

    const guideBtn = content.querySelector('#btn-ocr-google-guide');
    if (guideBtn) {
      guideBtn.onclick = () => {
        if (typeof openGoogleOcrGuide === 'function') {
          openGoogleOcrGuide();
        }
      };
    }

    const imgBtn = content.querySelector('#btn-switch-to-image');
    if (imgBtn) {
      imgBtn.onclick = () => {
        AIMedia.currentSource = 'image';
        document.querySelectorAll('.source-tab').forEach(t => {
          t.classList.toggle('active', t.dataset.source === 'image');
        });
        renderSourceContent(document.getElementById('ai-source-section'));
        updateSourceBadge();
      };
    }

  } else {
    // لا يوجد ملف — منطقة الرفع
    content.innerHTML = `
      <div id="pdf-drop-zone" class="drop-zone">
        <div class="drop-icon">📄</div>
        <div class="drop-title">اضغط لاختيار ملف PDF أو اسحبه هنا</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
          الحد: 30MB • 100 صفحة
        </div>
        <div id="pdf-status" style="font-size:13px;color:var(--primary);margin-top:10px;min-height:20px;font-weight:600"></div>
      </div>
      <input type="file" id="pdf-file-input" accept=".pdf,application/pdf" style="display:none">
    `;

    const dropZone = content.querySelector('#pdf-drop-zone');
    const fileInput = content.querySelector('#pdf-file-input');
    const statusEl = content.querySelector('#pdf-status');

    dropZone.onclick = () => fileInput.click();
    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) await handlePdfFile(file, statusEl, content);
    };

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = async (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) await handlePdfFile(file, statusEl, content);
    };
  }
}

async function handlePdfFile(file, statusEl, container) {
  // ⭐ احفظ الملف للاستخدام لاحقًا
  AIMedia._lastPdfFile = file;

  // ... باقي الكود
  if (!file.name.toLowerCase().endsWith('.pdf')) {
    statusEl.textContent = '⚠️ الملف ليس PDF';
    statusEl.style.color = 'var(--danger)';
    return;
  }
  AIMedia._lastPdfFile = file;

  try {
    statusEl.textContent = '⏳ جارٍ المعالجة...';
    statusEl.style.color = 'var(--primary)';

    const result = await extractPdfText(file, (msg) => {
      statusEl.textContent = '⏳ ' + msg;
    });

    AIMedia.pdfText = result.text;
    AIMedia.pdfFileName = result.fileName;
    AIMedia.pdfPageCount = result.pages;

    statusEl.textContent = `✅ تم استخراج ${result.pages} صفحة (${result.chars.toLocaleString('ar')} حرف)`;
    statusEl.style.color = 'var(--success)';

    // أعد عرض القسم
    setTimeout(() => {
      renderPdfSource(container);
      updateSourceBadge();
    }, 500);

    if (result.trimmed) {
      toast('⚠️ الملف كبير — تم اقتصاص النص إلى 50,000 حرف', 'warn', 5000);
    } else {
      toast('✅ تم استخراج PDF', 'success');
    }
    // ✅ أظهر زر التوليد
    const cta = document.getElementById('ai-generate-cta');
    if (cta) {
      cta.style.display = 'block';
      cta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (err) {
    statusEl.textContent = '❌ ' + err.message;
    statusEl.style.color = 'var(--danger)';
    toast(err.message, 'error');
  }
}

/* ----- Image ----- */
function renderImageSource(content) {
  if (AIMedia.imageBase64) {
    content.innerHTML = `
      <div style="padding:16px;background:#dcfce7;border-radius:10px;border:1px solid #16a34a">
        <div style="display:flex;justify-content:space-between;align-items:center;gap:10px;flex-wrap:wrap">
          <div>
            <div style="font-weight:700;color:#166534">✅ ${escapeHtml(AIMedia.imageFileName)}</div>
            <div style="font-size:12px;color:#166534">جاهزة للتحليل بواسطة Gemini Vision</div>
          </div>
          <button class="btn btn-danger btn-sm" id="btn-reset-image" type="button">🗑️ حذف</button>
        </div>
      </div>
    `;

    content.querySelector('#btn-reset-image').onclick = () => {
      AIMedia.imageBase64 = '';
      AIMedia.imageFileName = '';
      renderImageSource(content);
      updateSourceBadge();
    };
  } else {
    content.innerHTML = `
      <div id="img-drop-zone" class="drop-zone">
        <div class="drop-icon">🖼️</div>
        <div class="drop-title">اضغط لاختيار صورة أو اسحبها هنا</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px">
          JPG, PNG, WEBP • الحد: 5MB
        </div>
        <div id="img-status" style="font-size:13px;color:var(--primary);margin-top:10px;min-height:20px;font-weight:600"></div>
      </div>
      <input type="file" id="img-file-input" accept="image/*" style="display:none">
    `;

    const dropZone = content.querySelector('#img-drop-zone');
    const fileInput = content.querySelector('#img-file-input');
    const statusEl = content.querySelector('#img-status');

    dropZone.onclick = () => fileInput.click();

    fileInput.onchange = async (e) => {
      const file = e.target.files[0];
      if (file) await handleImageFile(file, statusEl, content);
    };

    dropZone.ondragover = (e) => {
      e.preventDefault();
      dropZone.classList.add('dragover');
    };
    dropZone.ondragleave = () => dropZone.classList.remove('dragover');
    dropZone.ondrop = async (e) => {
      e.preventDefault();
      dropZone.classList.remove('dragover');
      const file = e.dataTransfer.files[0];
      if (file) await handleImageFile(file, statusEl, content);
    };
  }
}

async function handleImageFile(file, statusEl, container) {
  try {
    statusEl.textContent = '⏳ جارٍ المعالجة...';

    const result = await imageToBase64(file);
    AIMedia.imageBase64 = result.base64;
    AIMedia.imageFileName = result.fileName;

    statusEl.textContent = `✅ ${formatFileSize(result.size)}`;
    statusEl.style.color = 'var(--success)';

    setTimeout(() => {
      renderImageSource(container);
      updateSourceBadge();
    }, 400);

    toast('✅ تم تحميل الصورة', 'success');

    // ✅ أظهر زر التوليد
    const cta = document.getElementById('ai-generate-cta');
    if (cta) {
      cta.style.display = 'block';
      cta.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  } catch (err) {
    statusEl.textContent = '❌ ' + err.message;
    statusEl.style.color = 'var(--danger)';
  }
}

/* ----- Text ----- */
function renderTextSource(content) {
  content.innerHTML = `
    <label>الصق النص هنا (من أي مصدر: كتاب إلكتروني، صفحة ويب، ...)</label>
    <textarea id="pasted-text-input" rows="8"
      placeholder="الصق هنا..."
      style="font-size:14px;line-height:1.6">${escapeHtml(AIMedia.pastedText)}</textarea>
    <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--text-muted)">
      <span id="text-length-info">0 حرف</span>
      <span id="text-warning" style="color:var(--warn);display:none">⚠️ النص طويل — سيُقتصر على 50,000 حرف</span>
    </div>
  `;

  const textarea = content.querySelector('#pasted-text-input');
  const lenInfo = content.querySelector('#text-length-info');
  const warning = content.querySelector('#text-warning');

  textarea.oninput = (e) => {
    const text = e.target.value;
    AIMedia.pastedText = text;

    lenInfo.textContent = `${text.length.toLocaleString('ar')} حرف`;
    warning.style.display = text.length > AIMedia.MAX_TEXT_LENGTH ? 'inline' : 'none';

    updateSourceBadge();
  };

  textarea.oninput({ target: textarea });
}

/* ============================================================
   عرض القوالب السريعة
   ============================================================ */
function renderQuickTemplates(container) {
  const templates = container.querySelector('#preset-templates');
  if (!templates) return;

  templates.innerHTML = QUICK_INSTRUCTION_TEMPLATES.map((t, i) => `
    <button class="preset-btn ${t.isFreeMode ? 'preset-btn-free' : ''}"
            data-preset-idx="${i}" type="button">
      <span style="font-size:16px">${t.icon}</span>
      <span>${t.label}</span>
    </button>
  `).join('');

  // ✅ اجعل "حسب وصفي" مفعّلًا افتراضيًا
  const freeBtn = templates.querySelector('[data-preset-idx="0"]');
  if (freeBtn && !AIMedia.selectedPresetType) {
    freeBtn.classList.add('preset-btn-active');
    AIMedia.selectedPresetType = null;   // null = حر
  }

  templates.querySelectorAll('[data-preset-idx]').forEach(btn => {
    btn.onclick = () => {
      const idx = Number(btn.dataset.presetIdx);
      const template = QUICK_INSTRUCTION_TEMPLATES[idx];
      const instr = container.querySelector('#custom-instructions');

      // ⭐ إذا كان "حسب وصفي" → نمط حر
      if (template.isFreeMode) {
        // أزل التفعيل من كل الأزرار
        templates.querySelectorAll('.preset-btn').forEach(b => {
          b.classList.remove('preset-btn-active');
        });
        btn.classList.add('preset-btn-active');

        AIMedia.selectedPresetType = null;

        // حدّث النص التوضيحي
        updateQuickGenerateVisibility();

        instr.focus();
        toast('✍️ سيُولّد حسب وصفك الحر', 'success');
        return;
      }

      // قالب عادي → أضف النص
      if (instr.value.trim() && !instr.dataset.fromPreset) {
        instr.value = instr.value + '\n\n' + template.text;
      } else {
        instr.value = template.text;
      }
      instr.dataset.fromPreset = '1';

      AIMedia.customInstructions = instr.value;

      // ⭐ احفظ النوع
      const typeMap = {
        1: 'lesson-plan',
        2: 'questions',
        3: 'lesson-plan',
        4: 'activities',
        5: 'questions',
        6: 'activities',
        7: 'enrichment',
        8: 'remedial'
      };
      AIMedia.selectedPresetType = typeMap[idx] || null;

      // فعّل الزر واضغط البقية
      templates.querySelectorAll('.preset-btn').forEach(b => {
        b.classList.remove('preset-btn-active');
      });
      btn.classList.add('preset-btn-active');

      instr.focus();

      const saveBtn = container.querySelector('#btn-save-preset');
      if (saveBtn) saveBtn.style.display = 'inline-block';

      updateQuickGenerateVisibility();

      // انزلق لزر التوليد
      const quick = document.getElementById('ai-quick-generate');
      if (quick) {
        quick.scrollIntoView({ behavior: 'smooth', block: 'center' });
        quick.style.transition = 'box-shadow 0.3s';
        quick.style.boxShadow = '0 0 0 4px rgba(30, 58, 138, 0.3)';
        setTimeout(() => {
          quick.style.boxShadow = '';
        }, 800);
      }
    };
  });
}

/* ============================================================
   عرض الأوصاف المحفوظة
   ============================================================ */
function renderSavedPresets(container) {
  const section = container.querySelector('#saved-presets-section');
  const list = container.querySelector('#saved-presets-list');
  if (!section || !list) return;

  loadSavedPresets();

  if (!AIMedia.savedPresets.length) {
    section.style.display = 'none';
    return;
  }

  section.style.display = 'block';

  list.innerHTML = AIMedia.savedPresets.map(p => `
    <div style="display:flex;gap:8px;padding:8px 12px;background:#f8fafc;border-radius:8px;margin-bottom:6px;align-items:center">
      <button class="btn btn-ghost btn-sm" data-use-preset="${escapeHtml(p.name)}" type="button"
        style="flex:1;text-align:right;justify-content:flex-start">
        ⭐ ${escapeHtml(p.name)}
      </button>
      <button class="btn btn-danger btn-sm" data-del-preset="${escapeHtml(p.name)}" type="button">🗑️</button>
    </div>
  `).join('');

  list.querySelectorAll('[data-use-preset]').forEach(btn => {
    btn.onclick = () => {
      const preset = AIMedia.savedPresets.find(p => p.name === btn.dataset.usePreset);
      if (!preset) return;

      const instr = container.querySelector('#custom-instructions');
      instr.value = preset.text;
      AIMedia.customInstructions = preset.text;
      instr.focus();
      toast('✅ تم تحميل الوصف', 'success');
    };
  });

  list.querySelectorAll('[data-del-preset]').forEach(btn => {
    btn.onclick = async () => {
      const ok = await confirmAction(`حذف الوصف "${btn.dataset.delPreset}"؟`, 'حذف');
      if (!ok) return;
      deleteCustomPreset(btn.dataset.delPreset);
      renderSavedPresets(container);
    };
  });
}

/* ============================================================
   تحديث شارة المصدر
   ============================================================ */
function updateSourceBadge() {
  const badge = document.getElementById('source-badge');
  if (!badge) return;

  if (AIMedia.currentSource === 'none') {
    badge.textContent = '';
    return;
  }

  if (!isSourceReady()) {
    badge.textContent = '⚠️ المصدر غير جاهز';
    badge.style.color = 'var(--warn)';
    return;
  }

  badge.textContent = '✅ جاهز';
  badge.style.color = 'var(--success)';
}
// ⭐ اجعل AIMedia متاحة عالميًا
window.AIMedia = AIMedia;

console.log('✅ ai-media.js: AIMedia جاهز في window');
/* ============================================================
   دالة مسح شاملة لكل حالة AI
   ============================================================ */
function clearAIMedia() {
  // 1) امسح البيانات
  AIMedia.pdfText = '';
  AIMedia.pdfFileName = '';
  AIMedia.pdfPageCount = 0;
  AIMedia.imageBase64 = '';
  AIMedia.imageFileName = '';
  AIMedia.pastedText = '';
  AIMedia.customInstructions = '';
  AIMedia.currentSource = 'none';
  AIMedia.selectedPresetType = null;
  AIMedia._lastPdfFile = null;

  // 2) امسح النتيجة السابقة (إن وجدت)
  const resultCard = document.getElementById('ai-result-card');
  if (resultCard) resultCard.style.display = 'none';

  const output = document.getElementById('ai-output');
  if (output) output.innerHTML = '';

  // 3) أخفِ زر التوليد السريع
  const quick = document.getElementById('ai-quick-generate');
  if (quick) quick.style.display = 'none';

  // 4) امسح الحقول
  ['ai-grade', 'ai-subject', 'ai-topic'].forEach(id => {
    const el = document.getElementById(id);
    if (el && el.dataset.fromUser !== '1') el.value = '';
  });

  // ⚠️ لا تمسح الصف/المادة/الموضوع — قد يريد المعلم الاحتفاظ بها
  // إذا أردت مسحها أيضًا:
  // ['ai-grade', 'ai-subject', 'ai-topic'].forEach(id => {
  //   const el = document.getElementById(id);
  //   if (el) el.value = '';
  // });

  log('AI', 'تم مسح كل الحالة');
}

// ⭐ اجعلها عالمية
window.clearAIMedia = clearAIMedia;