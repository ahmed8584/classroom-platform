/* ============================================================
   games.js — 18 لعبة تفاعلية
   موزّعة على 4 فئات: كلمات، أسئلة، أدوات، جماعية
   ============================================================ */

/* ============================================================
   سجل الألعاب
   ============================================================ */
const GAMES = {
  /* أ) ألعاب الكلمات */
  anagram:     { name: '🔤 ترتيب الحروف',    cat: 'words', run: gAnagram },
  fillblank:   { name: '✏️ املأ الفراغ',      cat: 'words', run: gFillBlank },
  wordle:      { name: '🎯 كلمة السر',        cat: 'words', run: gWordle },
  matching:    { name: '🔗 توصيل الكلمات',    cat: 'words', run: gMatching },
  wordsearch:  { name: '🔍 البحث عن الكلمات', cat: 'words', run: gWordSearch },

  /* ب) ألعاب الأسئلة */
  teamrace:    { name: '🏁 سباق الفرق',       cat: 'quiz',  run: gTeamRace },
  quizshow:    { name: '💰 من سيربح التحدي',   cat: 'quiz',  run: gQuizShow },
  speed:       { name: '⚡ تحدي السرعة',      cat: 'quiz',  run: gSpeed },
  multiselect: { name: '✅ اختيار متعدد',     cat: 'quiz',  run: gMultiSelect },
  rapidtf:     { name: '⚡ صح أم خطأ سريع',   cat: 'quiz',  run: gRapidTF },

  /* ج) أدوات صفية */
  dice:        { name: '🎲 رمي النرد',        cat: 'tools', run: gDice },
  randomcard:  { name: '🃏 بطاقة عشوائية',    cat: 'tools', run: gRandomCard },
  meter:       { name: '📊 مقياس الفهم',      cat: 'tools', run: gMeter },
  vote:        { name: '🗳️ تصويت فوري',       cat: 'tools', run: gVote },
  ordersteps:  { name: '📋 ترتيب الخطوات',    cat: 'tools', run: gOrderSteps },

  /* د) ألعاب جماعية */
  bingo:       { name: '🎱 بينغو',            cat: 'group', run: gBingo },
  jeopardy:    { name: '🎯 جيبوردي مصغر',    cat: 'group', run: gJeopardy },
  rounds:      { name: '🏆 مسابقة الجولات',   cat: 'group', run: gRounds }
};

const GAMES_CATEGORIES = {
  words: '🔤 ألعاب الكلمات',
  quiz:  '🎯 ألعاب الأسئلة',
  tools: '🛠️ أدوات صفية',
  group: '👥 ألعاب جماعية'
};

/* ============================================================
   عرض مكتبة الألعاب
   ============================================================ */
function renderGamesPage() {
  const content = document.getElementById('content');
  if (!content) return;

  content.querySelectorAll('.page').forEach(p => p.classList.remove('active'));

  let page = document.getElementById('page-games');
  if (!page) {
    page = document.createElement('div');
    page.id = 'page-games';
    page.className = 'page';
    content.appendChild(page);
  }
  page.classList.add('active');

  page.innerHTML = `
    <div class="welcome-hero" style="margin-bottom:24px">
      <h1>🎮 مكتبة الألعاب التعليمية</h1>
      <p>18 لعبة تفاعلية جاهزة للاستخدام الفوري</p>
    </div>
    <div id="games-categories"></div>
  `;

  const container = document.getElementById('games-categories');

  Object.entries(GAMES_CATEGORIES).forEach(([cat, catLabel]) => {
    const list = Object.entries(GAMES).filter(([_, g]) => g.cat === cat);
    if (!list.length) return;

    const section = document.createElement('div');
    section.className = 'card';
    section.innerHTML = `
      <h3 style="margin-bottom:14px">${catLabel} (${list.length})</h3>
      <div class="tiles-row" style="grid-template-columns:repeat(auto-fill,minmax(180px,1fr))"></div>
    `;

    const row = section.querySelector('.tiles-row');
    list.forEach(([id, g]) => {
      const icon = g.name.split(' ')[0];
      const label = g.name.split(' ').slice(1).join(' ');
      const tile = document.createElement('button');
      tile.className = 'tile';
      tile.type = 'button';
      tile.style.cursor = 'pointer';
      tile.innerHTML = `
        <span class="tile-icon">${icon}</span>
        <span class="tile-title">${label}</span>
      `;
      tile.onclick = () => g.run();
      row.appendChild(tile);
    });

    container.appendChild(section);
  });
}

/* ============================================================
   أدوات مساعدة داخل الألعاب
   ============================================================ */
function openGame(title, buildFn) {
  openModal(title, (body, modal) => {
    modal.style.maxWidth = '720px';
    body.innerHTML = '';
    buildFn(body, modal);
  });
}

async function saveGameResult(gameType, score, details = {}) {
  const sessionId = sessionStorage.getItem('active_session_id');
  if (!sessionId) return; // لا حصة نشطة
  try {
    await Api.saveGame({ sessionId, gameType, score, details });
  } catch (e) {
    log('Game save error', e.message);
  }
}

/* ============================================================
   أ) ألعاب الكلمات
   ============================================================ */

/* ----- 1) Anagram ----- */
function gAnagram() {
  openGame('🔤 ترتيب الحروف', (body) => {
    body.innerHTML = `
      <label>الكلمة المطلوبة</label>
      <input type="text" id="an-word" placeholder="مثال: الرياضيات">
      <button class="btn btn-primary" style="margin-top:12px" id="an-start" type="button">بدء</button>
      <div id="an-area" style="text-align:center;margin-top:20px"></div>
    `;
    body.querySelector('#an-start').onclick = () => {
      const word = body.querySelector('#an-word').value.trim();
      if (!word) return toast('أدخل كلمة', 'warn');
      const area = body.querySelector('#an-area');
      area.innerHTML = '';
      const letters = word.split('');
      const pool = shuffle(letters.map((L, i) => ({ L, i })));
      const picked = [];

      const slots = document.createElement('div');
      slots.style.marginBottom = '20px';
      const tiles = document.createElement('div');

      function render() {
        slots.innerHTML = '';
        for (let k = 0; k < letters.length; k++) {
          const item = picked[k];
          const el = document.createElement('span');
          el.className = 'an-slot';
          el.style.cssText = 'display:inline-block;width:46px;height:46px;line-height:46px;text-align:center;margin:4px;border-bottom:3px solid var(--primary);font-size:22px;font-weight:700';
          el.textContent = item ? item.L : '';
          slots.appendChild(el);
        }
        tiles.innerHTML = '';
        pool.forEach(p => {
          const used = picked.includes(p);
          const t = document.createElement('button');
          t.className = 'an-tile';
          t.style.cssText = `display:inline-block;padding:12px 16px;margin:4px;border:2px solid var(--primary);border-radius:10px;background:${used ? '#e2e8f0' : '#eff6ff'};font-size:22px;font-weight:700;cursor:${used ? 'not-allowed' : 'pointer'};opacity:${used ? '.3' : '1'}`;
          t.textContent = p.L;
          if (!used) t.onclick = () => { picked.push(p); render(); check(); };
          tiles.appendChild(t);
        });
        area.appendChild(slots);
        area.appendChild(tiles);
      }

      function check() {
        if (picked.length < letters.length) return;
        const word2 = picked.map(p => p.L).join('');
        if (word2 === word) {
          toast('🎉 صحيح!', 'success');
          saveGameResult('anagram', 1, { word });
        } else {
          toast('❌ حاول مرة أخرى', 'warn');
        }
      }

      render();
    };
  });
}

/* ----- 2) Fill Blank ----- */
function gFillBlank() {
  openGame('✏️ املأ الفراغ', (body) => {
    body.innerHTML = `
      <label>الجملة (استخدم ____ للفراغ)</label>
      <input type="text" id="fb-sentence" placeholder="عاصمة عمان هي ____">
      <label>الإجابة الصحيحة</label>
      <input type="text" id="fb-answer">
      <button class="btn btn-primary" style="margin-top:12px" id="fb-start" type="button">بدء</button>
      <div id="fb-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#fb-start').onclick = () => {
      const sent = body.querySelector('#fb-sentence').value;
      const ans = body.querySelector('#fb-answer').value.trim().toLowerCase();
      const area = body.querySelector('#fb-area');
      area.innerHTML = '';

      if (!sent.includes('____')) {
        toast('لم يتم وضع ____ في الجملة', 'warn');
        return;
      }

      const [before, after] = sent.split('____');
      area.innerHTML = `
        <div style="font-size:22px;line-height:2;margin-bottom:16px">
          ${escapeHtml(before)}
          <input type="text" id="fb-in" style="display:inline-block;width:180px;margin:0 8px">
          ${escapeHtml(after)}
        </div>
        <button class="btn btn-primary" id="fb-check" type="button">تحقق</button>
      `;
      area.querySelector('#fb-check').onclick = () => {
        const v = area.querySelector('#fb-in').value.trim().toLowerCase();
        if (v === ans) {
          toast('🎉 صحيح!', 'success');
          saveGameResult('fillblank', 1, {});
        } else {
          toast('❌ الإجابة الصحيحة: ' + ans, 'error');
        }
      };
    };
  });
}

/* ----- 3) Wordle ----- */
function gWordle() {
  openGame('🎯 كلمة السر', (body) => {
    body.innerHTML = `
      <label>الكلمة السرية (5 حروف)</label>
      <input type="text" id="wl-word" maxlength="5" placeholder="خمسة حروف" style="text-transform:uppercase">
      <button class="btn btn-primary" style="margin-top:12px" id="wl-start" type="button">بدء</button>
      <div id="wl-area" style="margin-top:20px;text-align:center"></div>
    `;
    body.querySelector('#wl-start').onclick = () => {
      const target = body.querySelector('#wl-word').value.trim().toUpperCase();
      if (target.length !== 5) return toast('يجب 5 حروف', 'warn');

      const area = body.querySelector('#wl-area');
      area.innerHTML = '';
      let attempts = 0;
      const guesses = [];

      function render() {
        area.innerHTML = '';
        for (let i = 0; i < 6; i++) {
          const row = document.createElement('div');
          row.style.cssText = 'display:flex;gap:4px;margin-bottom:6px;justify-content:center';
          const guess = guesses[i] || '';
          for (let k = 0; k < 5; k++) {
            const L = guess[k] || '';
            let cls = 'wl-cell';
            let bg = '#fff';
            if (L && target[k] === L) { bg = 'var(--success)'; }
            else if (L && target.includes(L)) { bg = 'var(--accent)'; }
            else if (L) { bg = '#475569'; }
            const cell = document.createElement('div');
            cell.style.cssText = `width:44px;height:44px;display:flex;align-items:center;justify-content:center;font-size:22px;font-weight:700;border:2px solid ${bg === '#fff' ? '#cbd5e1' : bg};border-radius:6px;background:${bg};color:${bg === '#fff' ? '#0f172a' : '#fff'};text-transform:uppercase`;
            cell.textContent = L;
            row.appendChild(cell);
          }
          area.appendChild(row);
        }
      }

      render();

      const inp = document.createElement('input');
      inp.type = 'text';
      inp.maxLength = 5;
      inp.placeholder = 'تخمين';
      inp.style.cssText = 'text-transform:uppercase;max-width:200px;margin:20px auto;display:block;text-align:center';
      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.textContent = 'إرسال';
      btn.onclick = () => {
        const g = inp.value.trim().toUpperCase();
        if (g.length !== 5) return toast('5 حروف', 'warn');
        guesses.push(g);
        attempts++;
        render();
        if (g === target) {
          toast('🎉 فزت!', 'success');
          saveGameResult('wordle', 6 - attempts, {});
        } else if (attempts >= 6) {
          toast('انتهت المحاولات. الكلمة: ' + target, 'error');
        }
        inp.value = '';
      };

      area.appendChild(inp);
      area.appendChild(btn);
    };
  });
}

/* ----- 4) Matching ----- */
function gMatching() {
  openGame('🔗 توصيل الكلمات', (body) => {
    body.innerHTML = `
      <label>أزواج (كل سطر: كلمة1 = كلمة2)</label>
      <textarea id="m-pairs" rows="6" placeholder="عمان = مسقط&#10;مصر = القاهرة"></textarea>
      <button class="btn btn-primary" style="margin-top:12px" id="m-start" type="button">بدء</button>
      <div id="m-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#m-start').onclick = () => {
      const lines = body.querySelector('#m-pairs').value.split('\n').filter(Boolean);
      const pairs = lines.map(l => l.split('=').map(s => s.trim())).filter(p => p.length === 2);
      if (!pairs.length) return toast('أدخل أزواجًا', 'warn');

      const lefts = shuffle(pairs.map((p, i) => ({ id: i, text: p[0], done: false })));
      const rights = shuffle(pairs.map((p, i) => ({ id: i, text: p[1], done: false })));

      const area = body.querySelector('#m-area');
      area.innerHTML = '';
      let selected = null;
      let correct = 0;

      const cols = document.createElement('div');
      cols.style.cssText = 'display:grid;grid-template-columns:1fr 1fr;gap:16px';
      const L = document.createElement('div');
      const R = document.createElement('div');

      function render() {
        L.innerHTML = '';
        R.innerHTML = '';
        lefts.forEach(x => {
          const el = document.createElement('div');
          el.className = 'match-item';
          el.style.cssText = `padding:12px;border:2px solid ${x.done ? 'var(--success)' : selected === x ? 'var(--primary)' : '#cbd5e1'};border-radius:10px;margin:6px 0;cursor:${x.done ? 'default' : 'pointer'};background:${x.done ? '#dcfce7' : selected === x ? '#dbeafe' : '#fff'};opacity:${x.done ? '.7' : '1'}`;
          el.textContent = x.text;
          if (!x.done) el.onclick = () => { selected = x; render(); };
          L.appendChild(el);
        });
        rights.forEach(x => {
          const el = document.createElement('div');
          el.className = 'match-item';
          el.style.cssText = `padding:12px;border:2px solid ${x.done ? 'var(--success)' : '#cbd5e1'};border-radius:10px;margin:6px 0;cursor:${x.done ? 'default' : 'pointer'};background:${x.done ? '#dcfce7' : '#fff'};opacity:${x.done ? '.7' : '1'}`;
          el.textContent = x.text;
          if (!x.done) el.onclick = () => {
            if (!selected) return toast('اختر من اليسار أولًا', 'warn');
            if (selected.id === x.id) {
              selected.done = true;
              x.done = true;
              correct++;
              saveGameResult('matching', correct, {});
              selected = null;
              render();
              if (correct === pairs.length) toast('🎉 أكملت!', 'success');
            } else {
              toast('❌', 'error');
              selected = null;
              render();
            }
          };
          R.appendChild(el);
        });
      }

      cols.appendChild(L);
      cols.appendChild(R);
      area.appendChild(cols);
      render();
    };
  });
}

/* ----- 5) Word Search ----- */
function gWordSearch() {
  openGame('🔍 البحث عن الكلمات', (body) => {
    body.innerHTML = `
      <label>الكلمات (مفصولة بفاصلة)</label>
      <input type="text" id="ws-words" placeholder="علم,قلم,كتاب">
      <button class="btn btn-primary" style="margin-top:12px" id="ws-start" type="button">توليد</button>
      <div id="ws-area" style="margin-top:20px;text-align:center"></div>
    `;
    body.querySelector('#ws-start').onclick = () => {
      const words = body.querySelector('#ws-words').value.split(',').map(w => w.trim()).filter(Boolean);
      if (!words.length) return toast('أدخل كلمات', 'warn');

      const N = Math.max(10, Math.max(...words.map(w => w.length)) + 2);
      const grid = Array.from({ length: N }, () => Array(N).fill(''));
      const placed = [];
      const dirs = [[0, 1], [1, 0], [1, 1]];

      words.forEach(w => {
        for (let t = 0; t < 50; t++) {
          const [dr, dc] = pick(dirs);
          const r = Math.floor(Math.random() * (N - dr * w.length));
          const c = Math.floor(Math.random() * (N - dc * w.length));
          let ok = true;
          for (let k = 0; k < w.length; k++) {
            const cell = grid[r + dr * k][c + dc * k];
            if (cell && cell !== w[k]) { ok = false; break; }
          }
          if (ok) {
            for (let k = 0; k < w.length; k++) grid[r + dr * k][c + dc * k] = w[k];
            placed.push({ word: w, r, c, dr, dc });
            break;
          }
        }
      });

      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        if (!grid[r][c]) grid[r][c] = String.fromCharCode(0x0621 + Math.floor(Math.random() * 28));
      }

      const area = body.querySelector('#ws-area');
      area.innerHTML = '';

      const g = document.createElement('div');
      g.style.cssText = `display:inline-grid;gap:2px;margin:10px auto;grid-template-columns:repeat(${N},32px)`;
      for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
        const cell = document.createElement('div');
        cell.style.cssText = 'width:32px;height:32px;display:flex;align-items:center;justify-content:center;border:1px solid #cbd5e1;font-weight:700;background:#fff';
        cell.dataset.r = r;
        cell.dataset.c = c;
        cell.textContent = grid[r][c];
        g.appendChild(cell);
      }
      area.appendChild(g);

      const wordList = document.createElement('div');
      wordList.style.marginTop = '14px';
      placed.forEach(p => {
        const btn = document.createElement('button');
        btn.className = 'btn btn-ghost btn-sm';
        btn.style.margin = '2px';
        btn.textContent = p.word;
        btn.onclick = () => {
          for (let k = 0; k < p.word.length; k++) {
            const cell = area.querySelector(`[data-r="${p.r + p.dr * k}"][data-c="${p.c + p.dc * k}"]`);
            if (cell) cell.style.background = '#dcfce7';
          }
          saveGameResult('wordsearch', 1, { word: p.word });
        };
        wordList.appendChild(btn);
      });
      area.appendChild(wordList);
    };
  });
}

/* ============================================================
   ب) ألعاب الأسئلة
   ============================================================ */

/* ----- 6) Team Race ----- */
function gTeamRace() {
  openGame('🏁 سباق الفرق', (body) => {
    body.innerHTML = `
      <label>أسماء الفرق (فاصلة)</label>
      <input type="text" id="tr-teams" placeholder="الفريق الأحمر, الفريق الأزرق">
      <label>هدف النقاط</label>
      <input type="number" id="tr-goal" value="5" min="1">
      <button class="btn btn-primary" style="margin-top:12px" id="tr-start" type="button">بدء</button>
      <div id="tr-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#tr-start').onclick = () => {
      const names = body.querySelector('#tr-teams').value.split(',').map(s => s.trim()).filter(Boolean);
      const goal = Number(body.querySelector('#tr-goal').value) || 5;
      if (names.length < 2) return toast('فريقان على الأقل', 'warn');

      const scores = names.map(() => 0);
      const area = body.querySelector('#tr-area');

      function render() {
        area.innerHTML = '';
        names.forEach((n, i) => {
          const pct = Math.min(100, (scores[i] / goal) * 100);
          const lane = document.createElement('div');
          lane.className = 'team-lane';
          lane.style.cssText = 'background:#eff6ff;border-radius:10px;padding:14px;margin:10px 0';
          lane.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:6px">
              <strong>${escapeHtml(n)}</strong>
              <span>${scores[i]} / ${goal}</span>
            </div>
            <div style="background:#e2e8f0;border-radius:10px;overflow:hidden">
              <div style="height:20px;background:var(--primary);border-radius:10px;transition:.4s;width:${pct}%"></div>
            </div>
            <div style="margin-top:8px;display:flex;gap:6px">
              <button class="btn btn-success btn-sm" data-plus="${i}">+1</button>
              <button class="btn btn-danger btn-sm" data-minus="${i}">-1</button>
            </div>
          `;
          area.appendChild(lane);
        });
        area.querySelectorAll('[data-plus]').forEach(b => {
          b.onclick = () => {
            const i = Number(b.dataset.plus);
            scores[i]++;
            if (scores[i] >= goal) {
              toast('🏆 ' + names[i] + ' فاز!', 'success');
              saveGameResult('teamrace', scores[i], { winner: names[i] });
            }
            render();
          };
        });
        area.querySelectorAll('[data-minus]').forEach(b => {
          b.onclick = () => {
            const i = Number(b.dataset.minus);
            scores[i] = Math.max(0, scores[i] - 1);
            render();
          };
        });
      }

      render();
    };
  });
}

/* ----- 7) Quiz Show ----- */
function gQuizShow() {
  openGame('💰 من سيربح التحدي', (body) => {
    body.innerHTML = `
      <label>أسئلة (سطر: سؤال|خيار1|خيار2|خيار3|خيار4|رقم الصحيح 1-4)</label>
      <textarea id="qs-data" rows="6" placeholder="عاصمة عمان؟|مسقط|صلالة|نزوى|صحار|1"></textarea>
      <button class="btn btn-primary" style="margin-top:12px" id="qs-start" type="button">بدء</button>
      <div id="qs-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#qs-start').onclick = () => {
      const qs = body.querySelector('#qs-data').value.split('\n').map(l => l.split('|').map(s => s.trim())).filter(a => a.length >= 6);
      if (!qs.length) return toast('لا أسئلة', 'warn');

      const area = body.querySelector('#qs-area');
      let idx = 0;
      let prize = 0;
      const levels = [100, 200, 400, 800, 1600, 3200, 6400, 12500, 25000, 50000];

      function show() {
        area.innerHTML = '';
        if (idx >= qs.length) {
          toast('🏆 المجموع: ' + prize, 'success');
          saveGameResult('quizshow', prize, {});
          return;
        }
        const [q, ...rest] = qs[idx];
        const correct = Number(rest[4]) - 1;

        area.innerHTML = `
          <div style="color:var(--text-muted);margin-bottom:8px">
            سؤال ${idx + 1}/${qs.length} — الجائزة: ${levels[idx] || 100000}
          </div>
          <h3 style="margin-bottom:14px">${escapeHtml(q)}</h3>
        `;
        rest.slice(0, 4).forEach((opt, i) => {
          const btn = document.createElement('button');
          btn.className = 'answer-opt';
          btn.style.cssText = 'display:block;width:100%;padding:14px;border:2px solid #e2e8f0;border-radius:12px;margin:8px 0;cursor:pointer;font-size:16px;font-weight:600;background:#fff;text-align:center';
          btn.textContent = opt;
          btn.onclick = () => {
            if (i === correct) {
              prize += levels[idx] || 100000;
              toast('✓ صحيح', 'success');
            } else {
              toast('✗ الإجابة: ' + rest[correct], 'error');
            }
            idx++;
            show();
          };
          area.appendChild(btn);
        });
      }
      show();
    };
  });
}

/* ----- 8) Speed ----- */
function gSpeed() {
  openGame('⚡ تحدي السرعة', (body) => {
    body.innerHTML = `
      <label>أسئلة (سطر: سؤال = إجابة)</label>
      <textarea id="sp-data" rows="6" placeholder="2+2 = 4&#10;5*3 = 15"></textarea>
      <label>ثوان لكل سؤال</label>
      <input type="number" id="sp-time" value="10" min="3" max="60">
      <button class="btn btn-primary" style="margin-top:12px" id="sp-start" type="button">بدء</button>
      <div id="sp-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#sp-start').onclick = () => {
      const items = body.querySelector('#sp-data').value.split('\n').map(l => l.split('=').map(s => s.trim())).filter(a => a.length === 2);
      const limit = Number(body.querySelector('#sp-time').value) || 10;
      if (!items.length) return toast('لا أسئلة', 'warn');

      const area = body.querySelector('#sp-area');
      let idx = 0;
      let score = 0;

      function tick() {
        area.innerHTML = '';
        if (idx >= items.length) {
          toast('🏁 انتهى! نقاطك: ' + score, 'success');
          saveGameResult('speed', score, {});
          return;
        }
        const [q, a] = items[idx];
        let left = limit;

        area.innerHTML = `
          <div style="color:var(--text-muted);margin-bottom:6px">سؤال ${idx + 1}/${items.length}</div>
          <h3>${escapeHtml(q)}</h3>
          <div id="sp-timer" style="font-size:56px;font-weight:900;text-align:center;color:var(--primary);margin:14px 0">${limit}</div>
          <input type="text" id="sp-in" placeholder="إجابتك">
          <button class="btn btn-primary" id="sp-submit" style="margin-top:10px">إرسال</button>
        `;

        const timerEl = area.querySelector('#sp-timer');
        const iv = setInterval(() => {
          left--;
          timerEl.textContent = left;
          if (left <= 0) { clearInterval(iv); idx++; tick(); }
        }, 1000);

        const submit = () => {
          clearInterval(iv);
          const v = area.querySelector('#sp-in').value.trim().toLowerCase();
          if (v === a.toLowerCase()) score++;
          idx++;
          tick();
        };

        area.querySelector('#sp-submit').onclick = submit;
        area.querySelector('#sp-in').onkeydown = (e) => { if (e.key === 'Enter') submit(); };
      }
      tick();
    };
  });
}

/* ----- 9) Multi Select ----- */
function gMultiSelect() {
  openGame('✅ اختيار متعدد', (body) => {
    body.innerHTML = `
      <label>السؤال</label>
      <input type="text" id="ms-q">
      <label>الخيارات (سطر لكل خيار، ضع * قبل الصحيح)</label>
      <textarea id="ms-opts" rows="5" placeholder="*عمان&#10;مسقط&#10;*صلالة"></textarea>
      <button class="btn btn-primary" style="margin-top:12px" id="ms-start" type="button">بدء</button>
      <div id="ms-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#ms-start').onclick = () => {
      const q = body.querySelector('#ms-q').value;
      const opts = body.querySelector('#ms-opts').value.split('\n').map(s => s.trim()).filter(Boolean);
      const correct = opts.filter(o => o.startsWith('*')).map(o => o.slice(1));
      const choices = opts.map(o => o.startsWith('*') ? o.slice(1) : o);

      if (!q || choices.length < 2) return toast('أكمل البيانات', 'warn');

      const area = body.querySelector('#ms-area');
      area.innerHTML = `<h3>${escapeHtml(q)}</h3>`;
      const selected = new Set();

      choices.forEach(c => {
        const el = document.createElement('div');
        el.className = 'answer-opt';
        el.style.cssText = 'padding:14px;border:2px solid #e2e8f0;border-radius:12px;margin:8px 0;cursor:pointer;text-align:center;font-weight:600';
        el.textContent = c;
        el.onclick = () => {
          if (selected.has(c)) {
            selected.delete(c);
            el.style.borderColor = '#e2e8f0';
            el.style.background = '#fff';
          } else {
            selected.add(c);
            el.style.borderColor = 'var(--primary)';
            el.style.background = '#dbeafe';
          }
        };
        area.appendChild(el);
      });

      const btn = document.createElement('button');
      btn.className = 'btn btn-primary';
      btn.style.marginTop = '10px';
      btn.textContent = 'تحقق';
      btn.onclick = () => {
        const ok = selected.size === correct.length && correct.every(c => selected.has(c));
        toast(ok ? '🎉 صحيح' : '❌ الإجابة: ' + correct.join(', '), ok ? 'success' : 'error');
        saveGameResult('multiselect', ok ? 1 : 0, {});
      };
      area.appendChild(btn);
    };
  });
}

/* ----- 10) Rapid TF ----- */
function gRapidTF() {
  openGame('⚡ صح أم خطأ سريع', (body) => {
    body.innerHTML = `
      <label>عبارات (سطر: عبارة = صح/خطأ)</label>
      <textarea id="tf-data" rows="6" placeholder="الأرض كروية = صح&#10;الشمس تدور حول الأرض = خطأ"></textarea>
      <button class="btn btn-primary" style="margin-top:12px" id="tf-start" type="button">بدء</button>
      <div id="tf-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#tf-start').onclick = () => {
      const items = body.querySelector('#tf-data').value.split('\n').map(l => l.split('=').map(s => s.trim())).filter(a => a.length === 2);
      if (!items.length) return toast('لا عبارات', 'warn');

      const area = body.querySelector('#tf-area');
      let idx = 0;
      let score = 0;

      function show() {
        area.innerHTML = '';
        if (idx >= items.length) {
          toast('🏁 النقاط: ' + score, 'success');
          saveGameResult('rapidtf', score, {});
          return;
        }
        const [text, ans] = items[idx];
        const correctBool = ans === 'صح' || ans.toLowerCase() === 'true';

        area.innerHTML = `
          <div style="color:var(--text-muted);margin-bottom:8px">عبارة ${idx + 1}/${items.length}</div>
          <h3 style="text-align:center;padding:20px;font-size:22px">${escapeHtml(text)}</h3>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <button class="answer-opt" id="tf-true" style="background:#dcfce7;padding:20px;font-size:20px;border-radius:12px;border:2px solid #16a34a;cursor:pointer;font-weight:700" type="button">✓ صح</button>
            <button class="answer-opt" id="tf-false" style="background:#fee2e2;padding:20px;font-size:20px;border-radius:12px;border:2px solid #dc2626;cursor:pointer;font-weight:700" type="button">✗ خطأ</button>
          </div>
        `;

        const pick2 = (v) => {
          if (v === correctBool) { score++; toast('✓', 'success'); }
          else toast('✗', 'error');
          idx++;
          show();
        };

        area.querySelector('#tf-true').onclick = () => pick2(true);
        area.querySelector('#tf-false').onclick = () => pick2(false);
      }
      show();
    };
  });
}

/* ============================================================
   ج) أدوات صفية
   ============================================================ */

/* ----- 11) Dice ----- */
function gDice() {
  openGame('🎲 رمي النرد', (body) => {
    const dice = document.createElement('div');
    dice.style.cssText = 'width:120px;height:120px;background:#fff;border:3px solid #0f172a;border-radius:14px;display:grid;grid-template-columns:repeat(3,1fr);grid-template-rows:repeat(3,1fr);padding:12px;gap:6px;margin:20px auto';
    const btn = document.createElement('button');
    btn.className = 'btn btn-primary';
    btn.textContent = '🎲 ارمِ النرد';
    btn.style.cssText = 'display:block;margin:0 auto';

    body.appendChild(dice);
    body.appendChild(btn);

    function roll() {
      const n = Math.floor(Math.random() * 6) + 1;
      dice.innerHTML = '';
      const pips = [[4], [0, 8], [0, 4, 8], [0, 2, 6, 8], [0, 2, 4, 6, 8], [0, 2, 3, 5, 6, 8]][n - 1];
      for (let i = 0; i < 9; i++) {
        const p = document.createElement('div');
        p.style.cssText = pips.includes(i) ? 'background:#0f172a;border-radius:50%' : '';
        dice.appendChild(p);
      }
      saveGameResult('dice', n, { value: n });
    }

    btn.onclick = roll;
    roll();
  });
}

/* ----- 12) Random Card ----- */
function gRandomCard() {
  openGame('🃏 بطاقة عشوائية', (body) => {
    body.innerHTML = `
      <label>قائمة (سطر لكل عنصر)</label>
      <textarea id="rc-data" rows="6" placeholder="سؤال 1&#10;سؤال 2&#10;سؤال 3"></textarea>
      <button class="btn btn-primary" style="margin-top:12px" id="rc-draw" type="button">🃏 اسحب بطاقة</button>
      <div id="rc-out" style="font-size:32px;text-align:center;padding:40px;font-weight:800;color:var(--primary);min-height:100px"></div>
    `;
    body.querySelector('#rc-draw').onclick = () => {
      const items = body.querySelector('#rc-data').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (!items.length) return toast('لا عناصر', 'warn');
      const c = pick(items);
      body.querySelector('#rc-out').textContent = c;
      saveGameResult('randomcard', 1, { picked: c });
    };
  });
}

/* ----- 13) Meter ----- */
function gMeter() {
  openGame('📊 مقياس الفهم', (body) => {
    const counts = { 'فهمت': 0, 'أحتاج مساعدة': 0, 'لم أفهم': 0 };
    const area = document.createElement('div');
    area.style.marginTop = '10px';

    function render() {
      area.innerHTML = '';
      Object.entries(counts).forEach(([k, v]) => {
        const btn = document.createElement('button');
        btn.style.cssText = 'display:block;width:100%;padding:20px;border:3px solid #cbd5e1;border-radius:14px;cursor:pointer;font-size:18px;font-weight:700;background:#fff;text-align:center;margin:8px 0';
        btn.textContent = k + ' (' + v + ')';
        btn.onclick = () => { counts[k]++; render(); };
        area.appendChild(btn);
      });
    }
    render();
    body.appendChild(area);
  });
}

/* ----- 14) Vote ----- */
function gVote() {
  openGame('🗳️ تصويت فوري', (body) => {
    body.innerHTML = `
      <label>خيارات (سطر لكل خيار)</label>
      <textarea id="vt-opts" rows="4" placeholder="نعم&#10;لا&#10;محايد"></textarea>
      <button class="btn btn-primary" style="margin-top:12px" id="vt-start" type="button">بدء</button>
      <div id="vt-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#vt-start').onclick = () => {
      const opts = body.querySelector('#vt-opts').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (opts.length < 2) return toast('خياران على الأقل', 'warn');

      const counts = opts.map(() => 0);
      const area = body.querySelector('#vt-area');

      function render() {
        area.innerHTML = '';
        const total = counts.reduce((a, b) => a + b, 0) || 1;
        opts.forEach((o, i) => {
          const pct = Math.round(counts[i] / total * 100);
          const div = document.createElement('div');
          div.style.margin = '10px 0';
          div.innerHTML = `
            <div style="display:flex;justify-content:space-between;margin-bottom:4px">
              <strong>${escapeHtml(o)}</strong>
              <span>${counts[i]} (${pct}%)</span>
            </div>
            <div style="background:#e2e8f0;border-radius:10px;overflow:hidden">
              <div style="height:30px;background:var(--primary);border-radius:10px;transition:.4s;width:${pct}%"></div>
            </div>
            <button class="btn btn-primary btn-sm" style="margin-top:6px" data-vote="${i}">+ صوت</button>
          `;
          area.appendChild(div);
        });

        area.querySelectorAll('[data-vote]').forEach(b => {
          b.onclick = () => {
            counts[Number(b.dataset.vote)]++;
            render();
          };
        });
      }
      render();
    };
  });
}

/* ----- 15) Order Steps ----- */
function gOrderSteps() {
  openGame('📋 ترتيب الخطوات', (body) => {
    body.innerHTML = `
      <label>الخطوات بالترتيب الصحيح (سطر لكل خطوة)</label>
      <textarea id="os-data" rows="6" placeholder="الخطوة 1&#10;الخطوة 2&#10;الخطوة 3"></textarea>
      <button class="btn btn-primary" style="margin-top:12px" id="os-start" type="button">بدء</button>
      <div id="os-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#os-start').onclick = () => {
      const correct = body.querySelector('#os-data').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (correct.length < 2) return toast('خطوتان على الأقل', 'warn');

      const mixed = shuffle(correct.map((t, i) => ({ t, i })));
      const area = body.querySelector('#os-area');
      area.innerHTML = '';

      const list = document.createElement('div');
      mixed.forEach(x => {
        const el = document.createElement('div');
        el.className = 'steps-item';
        el.style.cssText = 'padding:12px;border:2px solid #cbd5e1;border-radius:10px;margin:6px 0;background:#fff;cursor:pointer;font-size:16px';
        el.dataset.i = x.i;
        el.textContent = x.t;
        list.appendChild(el);
      });
      area.appendChild(list);

      let sel = null;
      list.onclick = (e) => {
        const el = e.target.closest('.steps-item');
        if (!el) return;
        if (!sel) {
          sel = el;
          el.style.borderColor = 'var(--primary)';
          el.style.background = '#dbeafe';
        } else if (sel === el) {
          sel.style.borderColor = '#cbd5e1';
          sel.style.background = '#fff';
          sel = null;
        } else {
          const parent = list;
          const selNext = sel.nextSibling;
          const elNext = el.nextSibling;
          parent.insertBefore(sel, elNext);
          parent.insertBefore(el, selNext);
          sel.style.borderColor = '#cbd5e1';
          sel.style.background = '#fff';
          el.style.borderColor = '#cbd5e1';
          el.style.background = '#fff';
          sel = null;
        }
      };

      const checkBtn = document.createElement('button');
      checkBtn.className = 'btn btn-primary';
      checkBtn.style.marginTop = '12px';
      checkBtn.textContent = 'تحقق';
      checkBtn.onclick = () => {
        const items = [...area.querySelectorAll('.steps-item')];
        const given = items.map(el => Number(el.dataset.i));
        const ok = given.every((v, i) => v === i);
        toast(ok ? '🎉 ترتيب صحيح' : '❌ ليس صحيحًا', ok ? 'success' : 'error');
        saveGameResult('ordersteps', ok ? 1 : 0, {});
      };
      area.appendChild(checkBtn);
    };
  });
}

/* ============================================================
   د) ألعاب جماعية
   ============================================================ */

/* ----- 16) Bingo ----- */
function gBingo() {
  openGame('🎱 بينغو', (body) => {
    body.innerHTML = `
      <label>عناصر البطاقة (سطر لكل عنصر — 24 عنصرًا)</label>
      <textarea id="bg-data" rows="6" placeholder="عنصر1&#10;عنصر2&#10;..."></textarea>
      <button class="btn btn-primary" style="margin-top:12px" id="bg-start" type="button">توليد بطاقة</button>
      <div id="bg-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#bg-start').onclick = () => {
      let items = body.querySelector('#bg-data').value.split('\n').map(s => s.trim()).filter(Boolean);
      if (items.length < 24) return toast('يجب 24 عنصرًا على الأقل', 'warn');
      items = shuffle(items).slice(0, 24);

      const cells = [...items.slice(0, 12), '★', ...items.slice(12)];
      const area = body.querySelector('#bg-area');
      area.innerHTML = '';

      const card = document.createElement('div');
      card.style.cssText = 'display:grid;grid-template-columns:repeat(5,1fr);gap:6px;max-width:420px;margin:auto';

      cells.forEach(c => {
        const el = document.createElement('div');
        el.style.cssText = 'padding:14px;border:2px solid #cbd5e1;border-radius:8px;text-align:center;font-weight:700;background:#fff;cursor:pointer;font-size:13px;user-select:none';
        el.textContent = c;
        if (c === '★') {
          el.style.background = 'var(--primary)';
          el.style.color = '#fff';
          el.style.cursor = 'default';
        } else {
          el.onclick = () => {
            if (el.style.background.includes('primary') || el.style.background.includes('rgb(30, 58, 138)')) {
              el.style.background = '#fff';
              el.style.color = '#000';
            } else {
              el.style.background = 'var(--primary)';
              el.style.color = '#fff';
            }
          };
        }
        card.appendChild(el);
      });
      area.appendChild(card);
    };
  });
}

/* ----- 17) Jeopardy ----- */
function gJeopardy() {
  openGame('🎯 جيبوردي مصغر', (body) => {
    body.innerHTML = `
      <label>الفئات (فاصلة)</label>
      <input type="text" id="jq-cats" placeholder="تاريخ, جغرافيا, علوم, رياضيات">
      <button class="btn btn-primary" style="margin-top:12px" id="jq-start" type="button">بدء</button>
      <div id="jq-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#jq-start').onclick = () => {
      const cats = body.querySelector('#jq-cats').value.split(',').map(s => s.trim()).filter(Boolean);
      if (cats.length < 2) return toast('فئتان على الأقل', 'warn');

      const vals = [100, 200, 300];
      const area = body.querySelector('#jq-area');
      area.innerHTML = '';

      const grid = document.createElement('div');
      grid.style.cssText = `display:grid;grid-template-columns:repeat(${cats.length},1fr);gap:8px;max-width:600px;margin:auto`;

      cats.forEach(c => {
        const header = document.createElement('div');
        header.style.cssText = 'font-weight:700;text-align:center;color:var(--primary);padding:10px';
        header.textContent = c;
        grid.appendChild(header);
      });

      vals.forEach(v => {
        cats.forEach(c => {
          const cell = document.createElement('div');
          cell.style.cssText = 'padding:20px;background:var(--primary);color:#fff;font-weight:700;font-size:20px;text-align:center;border-radius:10px;cursor:pointer';
          cell.textContent = v;
          cell.onclick = () => {
            const q = prompt(`سؤال ${c} بـ ${v} نقطة:`);
            if (q === null) return;
            const ans = prompt('الإجابة الصحيحة:');
            if (ans !== null) {
              cell.style.background = '#94a3b8';
              cell.style.pointerEvents = 'none';
              cell.textContent = '✓';
              saveGameResult('jeopardy', v, { cat: c, q, ans });
            }
          };
          grid.appendChild(cell);
        });
      });

      area.appendChild(grid);
    };
  });
}

/* ----- 18) Rounds ----- */
function gRounds() {
  openGame('🏆 مسابقة الجولات', (body) => {
    body.innerHTML = `
      <label>عدد الجولات</label>
      <input type="number" id="rd-n" value="3" min="2" max="10">
      <label>أسماء الفرق (فاصلة)</label>
      <input type="text" id="rd-teams" placeholder="فريق 1, فريق 2">
      <button class="btn btn-primary" style="margin-top:12px" id="rd-start" type="button">بدء</button>
      <div id="rd-area" style="margin-top:20px"></div>
    `;
    body.querySelector('#rd-start').onclick = () => {
      const n = Number(body.querySelector('#rd-n').value) || 3;
      const teams = body.querySelector('#rd-teams').value.split(',').map(s => s.trim()).filter(Boolean);
      if (teams.length < 2) return toast('فريقان على الأقل', 'warn');

      const scores = teams.map(() => 0);
      const area = body.querySelector('#rd-area');
      let round = 1;

      function render() {
        area.innerHTML = '';
        area.innerHTML = `<h3 style="text-align:center;color:var(--primary);margin-bottom:16px">الجولة ${round} / ${n}</h3>`;
        teams.forEach((t, i) => {
          const div = document.createElement('div');
          div.className = 'q-preview';
          div.style.cssText = 'padding:14px;margin:8px 0;border:1px solid var(--border);border-radius:10px;background:#f8fafc;display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:10px';
          div.innerHTML = `
            <strong style="font-size:16px">${escapeHtml(t)}</strong>
            <div style="display:flex;gap:6px;align-items:center">
              <span style="font-size:20px;font-weight:900;color:var(--primary)">${scores[i]}</span>
              <button class="btn btn-success btn-sm" data-plus="${i}">+1</button>
              <button class="btn btn-success btn-sm" data-plus2="${i}">+2</button>
              <button class="btn btn-danger btn-sm" data-minus="${i}">-1</button>
            </div>
          `;
          area.appendChild(div);
        });

        area.querySelectorAll('[data-plus]').forEach(b => {
          b.onclick = () => { scores[Number(b.dataset.plus)]++; render(); };
        });
        area.querySelectorAll('[data-plus2]').forEach(b => {
          b.onclick = () => { scores[Number(b.dataset.plus2)] += 2; render(); };
        });
        area.querySelectorAll('[data-minus]').forEach(b => {
          b.onclick = () => {
            const i = Number(b.dataset.minus);
            scores[i] = Math.max(0, scores[i] - 1);
            render();
          };
        });

        if (round < n) {
          const nextBtn = document.createElement('button');
          nextBtn.className = 'btn btn-accent';
          nextBtn.style.cssText = 'display:block;margin:16px auto';
          nextBtn.textContent = 'الجولة التالية';
          nextBtn.onclick = () => { round++; render(); };
          area.appendChild(nextBtn);
        } else {
          const finalBtn = document.createElement('button');
          finalBtn.className = 'btn btn-primary';
          finalBtn.style.cssText = 'display:block;margin:16px auto';
          finalBtn.textContent = '🏆 إعلان الفائز';
          finalBtn.onclick = () => {
            const max = Math.max(...scores);
            const winners = teams.filter((_, i) => scores[i] === max).join(' و ');
            toast('🏆 الفائز: ' + winners, 'success');
            saveGameResult('rounds', max, { winner: winners, scores });
          };
          area.appendChild(finalBtn);
        }
      }

      render();
    };
  });
}