/* ============================================================
   ai-ocr.js — النسخة المحصّنة (كل الدوال في window)
   ============================================================ */

window.AIOCR = {
  extracting: false,
  maxPages: 10,
  currentPage: 0,
  totalPages: 0
};

/* ============================================================
   تحويل صفحة PDF إلى صورة
   ============================================================ */
window.pdfPageToImage = async function(pdf, pageNum, scale = 1.5) {
  const page = await pdf.getPage(pageNum);
  const viewport = page.getViewport({ scale });
  
  const canvas = document.createElement('canvas');
  canvas.width = viewport.width;
  canvas.height = viewport.height;
  
  const ctx = canvas.getContext('2d');
  await page.render({ canvasContext: ctx, viewport }).promise;
  
  const base64 = canvas.toDataURL('image/jpeg', 0.75).split(',')[1];
  
  return {
    base64,
    mimeType: 'image/jpeg',
    sizeKB: Math.round(base64.length * 0.75 / 1024)
  };
};

/* ============================================================
   استخراج النص عبر Gemini Vision
   ============================================================ */
window.extractPdfWithVision = async function(pdfFile, onProgress, options = {}) {
  const file = pdfFile || window.AIMedia._lastPdfFile;
  if (!file) throw new Error('لا يوجد ملف PDF');
  
  if (onProgress) onProgress('قراءة ملف PDF...', 0);
  
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  
  const startPage = options.startPage || 1;
  const endPage = Math.min(
    options.endPage || pdf.numPages,
    startPage + window.AIOCR.maxPages - 1
  );
  
  window.AIOCR.totalPages = endPage - startPage + 1;
  window.AIOCR.currentPage = 0;
  
  const texts = [];
  
  for (let i = startPage; i <= endPage; i++) {
    window.AIOCR.currentPage = i - startPage + 1;
    
    if (onProgress) {
      onProgress(`استخراج صفحة ${i}/${endPage}...`, ((i - startPage) / (endPage - startPage + 1)) * 100);
    }
    
    try {
      const img = await window.pdfPageToImage(pdf, i);
      
      const result = await API.call('ocr.extract', {
        imageBase64: img.base64,
        mimeType: img.mimeType,
        pageNum: i
      });
      
      if (result.success && result.text) {
        texts.push({ page: i, text: result.text, chars: result.chars });
        if (onProgress) onProgress(`✅ صفحة ${i}: ${result.chars} حرف`, ((i - startPage + 0.5) / (endPage - startPage + 1)) * 100);
      } else {
        texts.push({ page: i, text: '', error: result.error || 'فشل' });
        if (onProgress) onProgress(`⚠️ صفحة ${i} فشلت`, ((i - startPage + 0.5) / (endPage - startPage + 1)) * 100);
      }
    } catch (err) {
      texts.push({ page: i, text: '', error: err.message });
      if (onProgress) onProgress(`❌ صفحة ${i}: ${err.message}`, 0);
    }
    
    if (i < endPage) await new Promise(r => setTimeout(r, 800));
  }
  
  const fullText = texts
    .filter(t => t.text)
    .map(t => `\n\n--- صفحة ${t.page} ---\n${t.text}`)
    .join('');
  
  const successPages = texts.filter(t => t.text).length;
  
  if (onProgress) {
    onProgress(`✅ اكتمل: ${successPages}/${texts.length} صفحة (${fullText.length} حرف)`, 100);
  }
  
  return {
    success: successPages > 0,
    text: fullText,
    chars: fullText.length,
    pages: texts.length,
    successPages,
    details: texts
  };
};

/* ============================================================
   نافذة OCR
   ============================================================ */
window.openOcrModal = function(pdfFile) {
  const file = pdfFile || window.AIMedia._lastPdfFile;
  if (!file) {
    if (typeof toast === 'function') toast('ارفع ملف PDF أولًا', 'warn');
    return;
  }
  
  if (typeof openModal !== 'function') {
    console.error('openModal غير موجودة — تأكد من تحميل ai.js');
    return;
  }
  
  openModal('🔄 استخراج النص بـ Gemini Vision', (body) => {
    body.innerHTML = `
      <div style="padding:14px;background:#fef3c7;border-radius:10px;margin-bottom:16px;font-size:13px;color:#92400e">
        <div style="font-weight:700;margin-bottom:6px">⚠️ تنبيه</div>
        <div>
          هذه الميزة ترسل كل صفحة كصورة إلى Gemini Vision.
          <br>
          • الحد الأقصى: <b>10 صفحات</b>
          <br>
          • الاستهلاك: <b>~10 طلبات</b> من حصة Gemini اليومية
        </div>
      </div>
      
      <label>عدد الصفحات:</label>
      <input type="number" id="ocr-pages-count" value="5" min="1" max="10">
      
      <div id="ocr-progress" style="display:none;margin-top:14px">
        <div style="background:#e2e8f0;border-radius:10px;overflow:hidden;height:20px">
          <div id="ocr-bar" style="height:100%;background:linear-gradient(90deg,#1e3a8a,#16a34a);width:0%;transition:width 0.3s"></div>
        </div>
        <div id="ocr-status" style="margin-top:8px;text-align:center;font-weight:600;color:#1e3a8a"></div>
      </div>
      
      <div id="ocr-result" style="display:none;margin-top:16px"></div>
      
      <div style="display:flex;gap:8px;margin-top:16px">
        <button class="btn btn-ghost" id="ocr-cancel" type="button" style="flex:1">إلغاء</button>
        <button class="btn btn-primary" id="ocr-start" type="button" style="flex:1">🚀 بدء الاستخراج</button>
      </div>
    `;
    
    document.getElementById('ocr-cancel').onclick = () => closeAllModals();
    
    document.getElementById('ocr-start').onclick = async () => {
      const count = Number(document.getElementById('ocr-pages-count').value) || 5;
      const startBtn = document.getElementById('ocr-start');
      startBtn.disabled = true;
      startBtn.textContent = '⏳ جاري...';
      
      document.getElementById('ocr-progress').style.display = 'block';
      
      try {
        const result = await window.extractPdfWithVision(file, (msg, pct) => {
          document.getElementById('ocr-status').textContent = msg;
          if (pct !== undefined) document.getElementById('ocr-bar').style.width = pct + '%';
        }, { startPage: 1, endPage: count });
        
        const resultDiv = document.getElementById('ocr-result');
        
        if (result.success) {
          resultDiv.innerHTML = `
            <div style="padding:14px;background:#dcfce7;border-radius:10px;margin-bottom:12px">
              <div style="font-weight:700;color:#166534">✅ تم استخراج ${result.successPages}/${result.pages} صفحة</div>
              <div style="font-size:13px;color:#166534">إجمالي: ${result.chars.toLocaleString('ar')} حرف</div>
            </div>
            <button class="btn btn-success" id="ocr-accept" type="button" style="width:100%">
              ✅ استخدام هذا النص
            </button>
          `;
          resultDiv.style.display = 'block';
          
          document.getElementById('ocr-accept').onclick = () => {
            window.AIMedia.pdfText = result.text;
            window.AIMedia.pdfFileName = file.name + ' (OCR)';
            window.AIMedia.pdfPageCount = result.successPages;
            
            closeAllModals();
            if (typeof toast === 'function') toast('✅ تم استخراج النص', 'success');
            
            const content = document.getElementById('source-content');
            if (content && typeof renderPdfSource === 'function') renderPdfSource(content);
            
            const quick = document.getElementById('ai-quick-generate');
            if (quick) {
              quick.style.display = 'block';
              setTimeout(() => quick.scrollIntoView({ behavior: 'smooth', block: 'center' }), 400);
            }
          };
          
          startBtn.style.display = 'none';
        } else {
          resultDiv.innerHTML = `
            <div style="padding:14px;background:#fee2e2;border-radius:10px;color:#991b1b">
              ❌ فشل الاستخراج
            </div>
          `;
          resultDiv.style.display = 'block';
          startBtn.disabled = false;
          startBtn.textContent = '🔄 إعادة المحاولة';
        }
      } catch (e) {
        document.getElementById('ocr-result').innerHTML = `
          <div style="padding:14px;background:#fee2e2;border-radius:10px;color:#991b1b">
            ❌ خطأ: ${escapeHtml(e.message)}
          </div>
        `;
        document.getElementById('ocr-result').style.display = 'block';
        startBtn.disabled = false;
        startBtn.textContent = '🔄 إعادة المحاولة';
      }
    };
  });
};

/* ============================================================
   دليل Google OCR
   ============================================================ */
window.openGoogleOcrGuide = function() {
  if (typeof openModal !== 'function') return;
  
  openModal('📖 Google OCR Guide', (body) => {
    body.innerHTML = `
      <div style="padding:14px;background:#eff6ff;border-radius:10px;margin-bottom:16px;font-size:13px;color:#1e40af">
        <b>💡 الأسرع والمجاني للـ PDF المصوّر</b>
      </div>
      <ol style="line-height:2.2;padding-right:20px">
        <li>افتح <a href="https://drive.google.com" target="_blank">drive.google.com</a></li>
        <li>ارفع ملف PDF</li>
        <li>انقر يمينًا → <b>Open with → Google Docs</b></li>
        <li>انتظر 20-30 ثانية</li>
        <li>Ctrl+A ثم Ctrl+C</li>
        <li>الصق في تبويب <b>📋 نص ملصق</b></li>
      </ol>
      <div style="margin-top:16px;padding:12px;background:#dcfce7;border-radius:8px;font-size:12px;color:#166534">
        ✅ مجاني • دقة 95%+ للعربية
      </div>
    `;
  });
};

console.log('✅ ai-ocr.js محمّل — كل الدوال في window');