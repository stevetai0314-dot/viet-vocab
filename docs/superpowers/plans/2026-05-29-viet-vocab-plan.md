# 越南語詞彙學習系統 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 建立 GitHub Pages + GAS 越南語詞彙練習系統，支援 SM-2 間隔重複、選擇題/輸入題、發音播放。

**Architecture:** GitHub Pages 提供靜態前端（HTML/CSS/JS），Google Apps Script 部署為 Web App 處理資料讀寫與 TTS proxy，Google Sheets 作為資料庫儲存題庫與學習進度。

**Tech Stack:** 原生 HTML/CSS/JS（無框架）、Google Apps Script、Google Sheets、Google Translate TTS via GAS UrlFetchApp

---

## 檔案結構

```
viet-vocab/
├── index.html          ← 主應用程式（三個畫面單頁切換）
├── style.css           ← 復古風格樣式
├── app.js              ← 前端邏輯（狀態機、API 呼叫、答題流程）
├── gas/
│   ├── Code.gs         ← GAS 後端（需貼入 Apps Script 編輯器）
│   └── appsscript.json ← GAS 設定檔
└── docs/
    └── superpowers/
        ├── specs/2026-05-29-viet-vocab-design.md
        └── plans/2026-05-29-viet-vocab-plan.md
```

---

## Task 1：建立 Google Sheets 結構

**Files:**
- Create: `gas/Code.gs`

- [ ] **Step 1：在 Google Drive 新建試算表**

前往 https://sheets.new，建立新試算表，命名為「越南語詞彙學習」。
記下網址中的試算表 ID（`/d/` 和 `/edit` 之間的字串），例如：
`1mxgL9IR2uggzlIVRss0RDtb-3OX2ReUV0KpEFyrmm9k`

- [ ] **Step 2：建立 vocabulary 工作表**

在試算表中：
- 將 Sheet1 重命名為 `vocabulary`
- 在第一行填入標頭：`word_id | vietnamese | chinese | word_type | example`
- 新增第二個工作表，命名為 `progress`
- 在 progress 第一行填入標頭：`word_id | next_review | ease_factor | interval | repetitions | last_quality`

- [ ] **Step 3：建立 GAS 專案**

在試算表中點選「擴充功能 → Apps Script」，開啟 GAS 編輯器。
刪除預設的空白函式，準備貼入後續程式碼。

- [ ] **Step 4：寫入試算表 ID 常數**

在 `Code.gs` 最頂端建立：

```javascript
const SS_ID = 'YOUR_SPREADSHEET_ID_HERE'; // 替換成你的試算表 ID
const TZ = 'Asia/Ho_Chi_Minh';

function getSheets() {
  const ss = SpreadsheetApp.openById(SS_ID);
  return {
    vocab: ss.getSheetByName('vocabulary'),
    progress: ss.getSheetByName('progress')
  };
}

function today() {
  return Utilities.formatDate(new Date(), TZ, 'yyyy-MM-dd');
}
```

- [ ] **Step 5：儲存並執行 `getSheets` 測試連線**

在 GAS 編輯器按「儲存」，選擇 `getSheets` 函式點「執行」。
若看到「執行完成」且無錯誤 → 連線正常。

- [ ] **Step 6：Commit**

```bash
git init
git add gas/Code.gs
git commit -m "chore: init GAS scaffold with Sheets connection"
```

---

## Task 2：GAS — SM-2 演算法

**Files:**
- Modify: `gas/Code.gs`

- [ ] **Step 1：寫入 SM-2 函式**

在 `Code.gs` 加入：

```javascript
function sm2Update(ef, interval, repetitions, quality) {
  if (quality >= 3) {
    let newInterval;
    if (repetitions === 0) newInterval = 1;
    else if (repetitions === 1) newInterval = 6;
    else newInterval = Math.round(interval * ef);

    const newEF = Math.max(1.3, ef + 0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
    return { interval: newInterval, ef: newEF, repetitions: repetitions + 1 };
  } else {
    return { interval: 1, ef: ef, repetitions: 0 };
  }
}
```

- [ ] **Step 2：寫入測試函式**

```javascript
function testSM2() {
  // 全新單字，第一次答對 (quality=4)
  const r1 = sm2Update(2.5, 1, 0, 4);
  Logger.log('第1次答對: interval=%s ef=%s rep=%s', r1.interval, r1.ef.toFixed(2), r1.repetitions);
  // 期望: interval=1, ef≈2.5, rep=1

  // 第二次答對 (quality=5)
  const r2 = sm2Update(r1.ef, r1.interval, r1.repetitions, 5);
  Logger.log('第2次答對: interval=%s ef=%s rep=%s', r2.interval, r2.ef.toFixed(2), r2.repetitions);
  // 期望: interval=6, ef>2.5, rep=2

  // 第三次答對 (quality=3)
  const r3 = sm2Update(r2.ef, r2.interval, r2.repetitions, 3);
  Logger.log('第3次答對: interval=%s ef=%s rep=%s', r3.interval, r3.ef.toFixed(2), r3.repetitions);
  // 期望: interval=6*ef≈15, rep=3

  // 答錯 (quality=1)
  const r4 = sm2Update(r3.ef, r3.interval, r3.repetitions, 1);
  Logger.log('答錯: interval=%s ef=%s rep=%s', r4.interval, r4.ef.toFixed(2), r4.repetitions);
  // 期望: interval=1, rep=0, ef 不變
}
```

- [ ] **Step 3：執行 `testSM2`，確認 log 輸出符合期望**

在 GAS 編輯器選擇 `testSM2` → 執行 → 查看「執行記錄」。
期望輸出：
```
第1次答對: interval=1 ef=2.50 rep=1
第2次答對: interval=6 ef=2.60 rep=2
第3次答對: interval=15 ef=2.58 rep=3
答錯: interval=1 ef=2.58 rep=0
```

- [ ] **Step 4：Commit**

```bash
git add gas/Code.gs
git commit -m "feat: add SM-2 algorithm with tests"
```

---

## Task 3：GAS — initVocab（CSV 匯入）

**Files:**
- Modify: `gas/Code.gs`

- [ ] **Step 1：寫入 initVocab 函式**

```javascript
function initVocab(csvText) {
  const { vocab, progress } = getSheets();
  const lines = csvText.trim().split('\n').slice(1); // 跳過 header
  const todayStr = today();

  // 找出目前最大 word_id
  const vocabData = vocab.getDataRange().getValues();
  let maxId = vocabData.length <= 1 ? 0 : Math.max(...vocabData.slice(1).map(r => Number(r[0]) || 0));

  const vocabRows = [];
  const progressRows = [];

  lines.forEach(line => {
    const cols = line.split(',').map(s => s.trim().replace(/^"|"$/g, ''));
    if (!cols[0]) return;
    maxId++;
    vocabRows.push([maxId, cols[0], cols[1] || '', cols[2] || '', cols[3] || '']);
    progressRows.push([maxId, todayStr, 2.5, 1, 0, '']);
  });

  if (vocabRows.length > 0) {
    vocab.getRange(vocab.getLastRow() + 1, 1, vocabRows.length, 5).setValues(vocabRows);
    progress.getRange(progress.getLastRow() + 1, 1, progressRows.length, 6).setValues(progressRows);
  }
  return { imported: vocabRows.length };
}
```

- [ ] **Step 2：寫入測試函式**

```javascript
function testInitVocab() {
  const csv = `vietnamese,chinese,word_type,example
táo,蘋果,n,Tôi ăn táo
cảm ơn,謝謝,phrase,Cảm ơn bạn
bệnh viện,醫院,n,`;
  const result = initVocab(csv);
  Logger.log('匯入筆數: %s', result.imported); // 期望: 3
}
```

- [ ] **Step 3：執行 `testInitVocab`，確認 log 顯示「匯入筆數: 3」**

並至試算表確認 vocabulary 和 progress 各新增 3 行。

- [ ] **Step 4：Commit**

```bash
git add gas/Code.gs
git commit -m "feat: add initVocab CSV import"
```

---

## Task 4：GAS — getTodayCards

**Files:**
- Modify: `gas/Code.gs`

- [ ] **Step 1：寫入 getTodayCards**

```javascript
function getTodayCards() {
  const { vocab, progress } = getSheets();
  const todayStr = today();

  const vocabRows = vocab.getDataRange().getValues().slice(1);
  const progressRows = progress.getDataRange().getValues().slice(1);

  // 建立 vocab 查詢 map
  const vocabMap = {};
  vocabRows.forEach(r => { vocabMap[r[0]] = { vietnamese: r[1], chinese: r[2], word_type: r[3], example: r[4] }; });

  // 篩選今日到期
  const cards = progressRows
    .filter(r => r[1] <= todayStr)
    .map(r => ({
      word_id: r[0],
      next_review: r[1],
      ease_factor: r[2],
      interval: r[3],
      repetitions: r[4],
      ...vocabMap[r[0]]
    }));

  // 全部詞彙（用於產生干擾選項）
  const allWords = vocabRows.map(r => ({ word_id: r[0], vietnamese: r[1], chinese: r[2], word_type: r[3] }));

  return { cards, allWords, today: todayStr };
}
```

- [ ] **Step 2：寫入測試函式**

```javascript
function testGetTodayCards() {
  const result = getTodayCards();
  Logger.log('今日卡片數: %s', result.cards.length);
  Logger.log('全部詞彙數: %s', result.allWords.length);
  if (result.cards.length > 0) {
    Logger.log('第一張: %s', JSON.stringify(result.cards[0]));
  }
}
```

- [ ] **Step 3：執行 `testGetTodayCards`，確認剛才匯入的 3 個詞彙出現**

- [ ] **Step 4：Commit**

```bash
git add gas/Code.gs
git commit -m "feat: add getTodayCards"
```

---

## Task 5：GAS — submitAnswer

**Files:**
- Modify: `gas/Code.gs`

- [ ] **Step 1：寫入 submitAnswer**

```javascript
function submitAnswer(wordId, quality) {
  const { progress } = getSheets();
  const rows = progress.getDataRange().getValues();

  for (let i = 1; i < rows.length; i++) {
    if (rows[i][0] == wordId) {
      const ef = Number(rows[i][2]);
      const interval = Number(rows[i][3]);
      const repetitions = Number(rows[i][4]);

      const updated = sm2Update(ef, interval, repetitions, quality);

      const nextDate = new Date();
      nextDate.setDate(nextDate.getDate() + updated.interval);
      const nextStr = Utilities.formatDate(nextDate, TZ, 'yyyy-MM-dd');

      progress.getRange(i + 1, 2, 1, 5).setValues([[
        nextStr,
        updated.ef,
        updated.interval,
        updated.repetitions,
        quality
      ]]);

      return { next_review: nextStr, interval: updated.interval };
    }
  }
  return { error: 'word_id not found' };
}
```

- [ ] **Step 2：寫入測試函式**

```javascript
function testSubmitAnswer() {
  // 先取得今日卡片，取第一張的 word_id
  const { cards } = getTodayCards();
  if (cards.length === 0) { Logger.log('沒有今日卡片'); return; }

  const wordId = cards[0].word_id;
  Logger.log('測試 word_id: %s', wordId);

  // 答對
  const r1 = submitAnswer(wordId, 4);
  Logger.log('答對後 next_review: %s interval: %s', r1.next_review, r1.interval);
  // 期望: interval=1（第一次），next_review = 明天

  // 答錯（重置）
  const r2 = submitAnswer(wordId, 1);
  Logger.log('答錯後 next_review: %s interval: %s', r2.next_review, r2.interval);
  // 期望: interval=1，next_review = 明天
}
```

- [ ] **Step 3：執行 `testSubmitAnswer`，確認 Sheets 內的 progress 有更新**

- [ ] **Step 4：Commit**

```bash
git add gas/Code.gs
git commit -m "feat: add submitAnswer with SM-2 update"
```

---

## Task 6：GAS — getAudio + doGet/doPost 路由

**Files:**
- Modify: `gas/Code.gs`
- Create: `gas/appsscript.json`

- [ ] **Step 1：寫入 getAudio**

```javascript
function getAudio(word) {
  try {
    const url = 'https://translate.google.com/translate_tts?ie=UTF-8&q='
      + encodeURIComponent(word) + '&tl=vi&client=tw-ob';
    const response = UrlFetchApp.fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0' },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() !== 200) return { error: 'tts_failed' };
    const base64 = Utilities.base64Encode(response.getContent());
    return { audio: 'data:audio/mpeg;base64,' + base64 };
  } catch (e) {
    return { error: e.message };
  }
}
```

- [ ] **Step 2：寫入 doGet 和 doPost 路由**

```javascript
function doGet(e) {
  const action = e.parameter.action;
  let result;

  if (action === 'getTodayCards') {
    result = getTodayCards();
  } else if (action === 'getAudio') {
    result = getAudio(e.parameter.word || '');
  } else {
    result = { error: 'unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  const body = JSON.parse(e.postData.contents);
  const action = body.action;
  let result;

  if (action === 'submitAnswer') {
    result = submitAnswer(body.word_id, Number(body.quality));
  } else if (action === 'initVocab') {
    result = initVocab(body.csv);
  } else {
    result = { error: 'unknown action' };
  }

  return ContentService
    .createTextOutput(JSON.stringify(result))
    .setMimeType(ContentService.MimeType.JSON);
}
```

- [ ] **Step 3：建立 `gas/appsscript.json`**

```json
{
  "timeZone": "Asia/Ho_Chi_Minh",
  "dependencies": {},
  "exceptionLogging": "STACKDRIVER",
  "runtimeVersion": "V8",
  "webapp": {
    "executeAs": "USER_DEPLOYING",
    "access": "ANYONE_ANONYMOUS"
  }
}
```

- [ ] **Step 4：部署 GAS 為 Web App**

在 GAS 編輯器：
1. 點選「部署 → 管理部署」
2. 點「建立新部署」→ 選「網路應用程式」
3. 執行身分：「我（你的帳號）」
4. 存取權：「所有人」
5. 點「部署」→ 複製 Web App URL

URL 格式：`https://script.google.com/macros/s/XXXXXX/exec`

- [ ] **Step 5：測試 API**

用瀏覽器開啟：
`https://script.google.com/macros/s/XXXXXX/exec?action=getTodayCards`

期望看到 JSON，包含 `cards` 陣列。

- [ ] **Step 6：Commit**

```bash
git add gas/Code.gs gas/appsscript.json
git commit -m "feat: add GAS web app routing + audio proxy"
```

---

## Task 7：HTML 骨架 + CSS 復古風格

**Files:**
- Create: `index.html`
- Create: `style.css`

- [ ] **Step 1：建立 `index.html`**

```html
<!DOCTYPE html>
<html lang="zh-TW">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>越南語每日練習</title>
  <link rel="stylesheet" href="style.css">
</head>
<body>

  <!-- 畫面 1：首頁 -->
  <div id="screen-home" class="screen">
    <div class="card-container">
      <header>
        <h1>🇻🇳 越南語每日練習</h1>
        <p id="today-date" class="date-label"></p>
      </header>
      <div class="stats-grid">
        <div class="stat-box">
          <span id="count-review" class="stat-num">—</span>
          <span class="stat-label">今日待複習</span>
        </div>
        <div class="stat-box">
          <span id="count-new" class="stat-num">—</span>
          <span class="stat-label">新單字</span>
        </div>
      </div>
      <div class="streak-bar">
        <span>連續 <span id="streak-count">0</span> 天 🔥</span>
      </div>
      <button id="btn-start" class="btn-primary" disabled>載入中...</button>
    </div>
  </div>

  <!-- 畫面 2：答題 -->
  <div id="screen-quiz" class="screen hidden">
    <div class="card-container">
      <div class="quiz-meta">
        <span id="quiz-progress">0 / 0</span>
        <span id="quiz-direction" class="tag"></span>
      </div>
      <div class="progress-bar"><div id="progress-fill"></div></div>

      <div id="word-card" class="word-card">
        <div id="word-display"></div>
        <button id="btn-audio" class="btn-audio">🔊</button>
      </div>

      <!-- 選擇題 -->
      <div id="choice-area" class="hidden">
        <div class="choices" id="choices"></div>
      </div>

      <!-- 輸入題 -->
      <div id="input-area" class="hidden">
        <input type="text" id="answer-input" class="answer-input" placeholder="輸入答案..." autocomplete="off">
        <button id="btn-submit" class="btn-primary">確認</button>
      </div>

      <!-- 答題回饋 -->
      <div id="feedback" class="hidden"></div>
      <button id="btn-next" class="btn-primary hidden">下一題 →</button>
    </div>
  </div>

  <!-- 畫面 3：結算 -->
  <div id="screen-result" class="screen hidden">
    <div class="card-container">
      <div class="result-header">
        <div class="result-emoji">🎉</div>
        <h2>今日完成！</h2>
      </div>
      <div class="score-box">
        <span id="score-pct" class="score-pct">—%</span>
        <span id="score-detail" class="score-detail"></span>
      </div>
      <div id="weak-list" class="weak-list"></div>
      <div class="tomorrow-info">
        明日待複習：<span id="tomorrow-count">—</span> 題
      </div>
      <div class="streak-bar">
        連續 <span id="result-streak">0</span> 天 🔥
      </div>
    </div>
  </div>

  <script src="app.js"></script>
</body>
</html>
```

- [ ] **Step 2：建立 `style.css`**

```css
:root {
  --bg: #fafaf5;
  --ink: #1c1c1c;
  --accent: #c45c00;
  --border: 2px solid #1c1c1c;
  --radius: 8px;
  --muted: #888;
  --success-bg: #f0fff4;
  --success-border: #38a169;
  --error-bg: #fff5f5;
  --error-border: #e53e3e;
  --warn-bg: #fef3c7;
}

* { box-sizing: border-box; margin: 0; padding: 0; }

body {
  background: var(--bg);
  color: var(--ink);
  font-family: -apple-system, BlinkMacSystemFont, sans-serif;
  min-height: 100vh;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 24px 16px;
}

.screen { width: 100%; max-width: 400px; }
.hidden { display: none !important; }

.card-container {
  border: var(--border);
  border-radius: var(--radius);
  padding: 24px;
  background: var(--bg);
}

header { text-align: center; border-bottom: var(--border); padding-bottom: 16px; margin-bottom: 20px; }
h1 { font-size: 20px; letter-spacing: 1px; }
h2 { font-size: 18px; }
.date-label { font-size: 12px; color: var(--muted); margin-top: 4px; }

.stats-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 16px; }
.stat-box { border: var(--border); border-radius: var(--radius); padding: 16px; text-align: center; }
.stat-num { display: block; font-size: 32px; font-weight: bold; color: var(--accent); }
.stat-label { font-size: 11px; color: var(--muted); }

.streak-bar { text-align: center; font-size: 13px; margin-bottom: 16px; color: var(--muted); }

.btn-primary {
  width: 100%;
  background: var(--ink);
  color: var(--bg);
  border: var(--border);
  border-radius: var(--radius);
  padding: 12px;
  font-size: 14px;
  font-weight: bold;
  cursor: pointer;
  letter-spacing: 1px;
}
.btn-primary:disabled { opacity: 0.5; cursor: not-allowed; }

/* Quiz */
.quiz-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; font-size: 12px; color: var(--muted); }
.tag { background: var(--ink); color: var(--bg); padding: 2px 8px; border-radius: 4px; font-size: 11px; }

.progress-bar { width: 100%; height: 3px; background: #eee; border-radius: 2px; margin-bottom: 18px; }
#progress-fill { height: 100%; background: var(--accent); border-radius: 2px; transition: width 0.3s; }

.word-card { border: var(--border); border-radius: var(--radius); padding: 24px; text-align: center; margin-bottom: 16px; }
#word-display { font-size: 34px; font-weight: bold; letter-spacing: 2px; margin-bottom: 12px; }

.btn-audio {
  background: var(--accent);
  border: none;
  border-radius: 20px;
  padding: 6px 16px;
  font-size: 13px;
  color: #fff;
  cursor: pointer;
}

.choices { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; }
.choice-btn {
  border: 1px solid #ccc;
  border-radius: var(--radius);
  padding: 12px;
  font-size: 14px;
  background: var(--bg);
  cursor: pointer;
  text-align: center;
}
.choice-btn:hover { border-color: var(--ink); }
.choice-btn.correct { background: var(--accent); color: #fff; border-color: var(--accent); font-weight: bold; }
.choice-btn.wrong { background: var(--error-bg); border-color: var(--error-border); color: var(--error-border); }

.answer-input {
  width: 100%;
  border: var(--border);
  border-radius: var(--radius);
  padding: 12px;
  font-size: 14px;
  margin-bottom: 10px;
  background: var(--bg);
}
.answer-input.correct { border-color: var(--success-border); background: var(--success-bg); }
.answer-input.wrong { border-color: var(--error-border); background: var(--error-bg); }

#feedback { border-radius: var(--radius); padding: 12px; margin-bottom: 10px; font-size: 13px; }
#feedback.tone-warn { background: var(--warn-bg); border: 1px solid var(--accent); }
#feedback.show-correct { background: var(--success-bg); border: 1px solid var(--success-border); }
#feedback.show-wrong { background: var(--error-bg); border: 1px solid var(--error-border); }

#btn-next { margin-top: 8px; }

/* Result */
.result-header { text-align: center; border-bottom: var(--border); padding-bottom: 16px; margin-bottom: 20px; }
.result-emoji { font-size: 40px; margin-bottom: 8px; }
.score-box { border: 2px solid var(--accent); border-radius: var(--radius); padding: 16px; text-align: center; margin-bottom: 16px; }
.score-pct { display: block; font-size: 40px; font-weight: bold; color: var(--accent); }
.score-detail { font-size: 12px; color: var(--muted); }

.weak-list { border: 1px solid #ddd; border-radius: var(--radius); padding: 12px; margin-bottom: 16px; }
.weak-list h4 { font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: var(--muted); margin-bottom: 8px; }
.weak-item { display: flex; justify-content: space-between; font-size: 13px; padding: 5px 0; border-bottom: 1px solid #f0f0f0; }
.weak-item:last-child { border-bottom: none; }

.tomorrow-info { font-size: 12px; color: var(--muted); text-align: center; margin-bottom: 8px; }
```

- [ ] **Step 3：在瀏覽器直接開啟 `index.html`，確認三個畫面 HTML 結構正確（只看到首頁，其他 hidden）**

- [ ] **Step 4：Commit**

```bash
git add index.html style.css
git commit -m "feat: add HTML skeleton and retro CSS"
```

---

## Task 8：app.js — 初始化與 API 層

**Files:**
- Create: `app.js`

- [ ] **Step 1：建立 `app.js`，填入 GAS URL 和 API 函式**

將 `YOUR_GAS_URL` 替換成 Task 6 Step 4 取得的 Web App URL。

```javascript
const GAS_URL = 'YOUR_GAS_URL'; // 替換成你的 GAS Web App URL

// ─── API ───────────────────────────────────────────────
async function apiGet(params) {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${GAS_URL}?${qs}`);
  return res.json();
}

async function apiPost(body) {
  const res = await fetch(GAS_URL, {
    method: 'POST',
    body: JSON.stringify(body)
  });
  return res.json();
}

// ─── 音調處理 ───────────────────────────────────────────
const VIET_MAP = {
  'à':'a','á':'a','ả':'a','ã':'a','ạ':'a',
  'ă':'a','ắ':'a','ằ':'a','ẳ':'a','ẵ':'a','ặ':'a',
  'â':'a','ấ':'a','ầ':'a','ẩ':'a','ẫ':'a','ậ':'a',
  'è':'e','é':'e','ẻ':'e','ẽ':'e','ẹ':'e',
  'ê':'e','ế':'e','ề':'e','ể':'e','ễ':'e','ệ':'e',
  'ì':'i','í':'i','ỉ':'i','ĩ':'i','ị':'i',
  'ò':'o','ó':'o','ỏ':'o','õ':'o','ọ':'o',
  'ô':'o','ố':'o','ồ':'o','ổ':'o','ỗ':'o','ộ':'o',
  'ơ':'o','ớ':'o','ờ':'o','ở':'o','ỡ':'o','ợ':'o',
  'ù':'u','ú':'u','ủ':'u','ũ':'u','ụ':'u',
  'ư':'u','ứ':'u','ừ':'u','ử':'u','ữ':'u','ự':'u',
  'ỳ':'y','ý':'y','ỷ':'y','ỹ':'y','ỵ':'y','đ':'d'
};

function stripTones(str) {
  return str.toLowerCase().split('').map(c => VIET_MAP[c] || c).join('').trim();
}

// ─── 應用程式狀態 ───────────────────────────────────────
const state = {
  cards: [],       // 今日卡片
  allWords: [],    // 全部詞彙（干擾選項用）
  index: 0,        // 目前題目
  results: [],     // { word_id, vietnamese, chinese, correct }
  streak: 0
};
```

- [ ] **Step 2：加入畫面切換函式**

```javascript
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}
```

- [ ] **Step 3：加入首頁初始化**

```javascript
async function initHome() {
  const dateEl = document.getElementById('today-date');
  dateEl.textContent = new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

  const data = await apiGet({ action: 'getTodayCards' });
  state.cards = data.cards || [];
  state.allWords = data.allWords || [];

  document.getElementById('count-review').textContent = state.cards.length;
  document.getElementById('count-new').textContent = state.cards.filter(c => c.repetitions === 0).length;

  const streak = Number(localStorage.getItem('streak') || 0);
  state.streak = streak;
  document.getElementById('streak-count').textContent = streak;

  const btn = document.getElementById('btn-start');
  if (state.cards.length > 0) {
    btn.textContent = '開始答題 →';
    btn.disabled = false;
    btn.onclick = startQuiz;
  } else {
    btn.textContent = '今日已完成 ✓';
    btn.disabled = true;
  }
}

document.addEventListener('DOMContentLoaded', initHome);
```

- [ ] **Step 4：在瀏覽器開啟，確認首頁顯示正確的待複習數字（需網路連線到 GAS）**

- [ ] **Step 5：Commit**

```bash
git add app.js
git commit -m "feat: add app.js init, API layer, home screen"
```

---

## Task 9：app.js — 答題流程（選擇題 + 輸入題）

**Files:**
- Modify: `app.js`

- [ ] **Step 1：加入 startQuiz 和出題邏輯**

```javascript
function startQuiz() {
  state.index = 0;
  state.results = [];
  showScreen('screen-quiz');
  showCard();
}

function getDistractors(correct, wordType) {
  const pool = state.allWords.filter(w =>
    w.word_id !== correct.word_id && w.word_type === wordType
  );
  // 若同詞性不足，從全部補
  const fallback = state.allWords.filter(w => w.word_id !== correct.word_id);
  const source = pool.length >= 3 ? pool : fallback;
  const shuffled = source.sort(() => Math.random() - 0.5).slice(0, 3);
  return shuffled;
}

function showCard() {
  const card = state.cards[state.index];
  const total = state.cards.length;
  const isChoice = state.index % 2 === 0; // 偶數題：選擇；奇數題：輸入
  const isVietToChinese = state.index % 4 < 2; // 每4題交替方向

  // 更新進度
  document.getElementById('quiz-progress').textContent = `${state.index + 1} / ${total}`;
  document.getElementById('progress-fill').style.width = `${((state.index + 1) / total) * 100}%`;
  document.getElementById('quiz-direction').textContent = isVietToChinese ? '越 → 中' : '中 → 越';

  // 顯示單字
  document.getElementById('word-display').textContent = isVietToChinese ? card.vietnamese : card.chinese;

  // 音檔按鈕（永遠播越南文）
  document.getElementById('btn-audio').onclick = () => playAudio(card.vietnamese);

  // 重置回饋
  const feedback = document.getElementById('feedback');
  feedback.className = 'hidden';
  feedback.innerHTML = '';
  document.getElementById('btn-next').classList.add('hidden');

  if (isChoice) {
    showChoiceQuestion(card, isVietToChinese);
  } else {
    showInputQuestion(card, isVietToChinese);
  }
}
```

- [ ] **Step 2：加入選擇題**

```javascript
function showChoiceQuestion(card, isVietToChinese) {
  document.getElementById('choice-area').classList.remove('hidden');
  document.getElementById('input-area').classList.add('hidden');

  const distractors = getDistractors(card, card.word_type);
  const options = [card, ...distractors].sort(() => Math.random() - 0.5);

  const container = document.getElementById('choices');
  container.innerHTML = '';

  options.forEach(opt => {
    const btn = document.createElement('button');
    btn.className = 'choice-btn';
    btn.textContent = isVietToChinese ? opt.chinese : opt.vietnamese;
    btn.onclick = () => handleChoiceAnswer(card, opt, btn, isVietToChinese);
    container.appendChild(btn);
  });
}

function handleChoiceAnswer(card, chosen, btn, isVietToChinese) {
  const isCorrect = chosen.word_id === card.word_id;
  const quality = isCorrect ? 4 : 1;

  // 標記所有按鈕
  document.querySelectorAll('.choice-btn').forEach(b => {
    const val = b.textContent;
    const isThisCorrect = isVietToChinese ? val === card.chinese : val === card.vietnamese;
    if (isThisCorrect) b.classList.add('correct');
    else if (b === btn && !isCorrect) b.classList.add('wrong');
    b.disabled = true;
  });

  recordAndShowNext(card, quality, isCorrect, null);
}
```

- [ ] **Step 3：加入輸入題**

```javascript
function showInputQuestion(card, isVietToChinese) {
  document.getElementById('input-area').classList.remove('hidden');
  document.getElementById('choice-area').classList.add('hidden');

  const input = document.getElementById('answer-input');
  input.value = '';
  input.className = 'answer-input';
  input.focus();

  const correctAnswer = isVietToChinese ? card.chinese : card.vietnamese;

  const submit = () => handleInputAnswer(card, input.value, correctAnswer, isVietToChinese);
  document.getElementById('btn-submit').onclick = submit;
  input.onkeydown = e => { if (e.key === 'Enter') submit(); };
}

function handleInputAnswer(card, userInput, correctAnswer, isVietToChinese) {
  const trimmed = userInput.trim();
  const exact = trimmed.toLowerCase() === correctAnswer.toLowerCase();
  const noTone = !exact && !isVietToChinese && stripTones(trimmed) === stripTones(correctAnswer);

  let quality, feedbackClass, feedbackHTML;

  if (exact) {
    quality = 4;
    feedbackClass = 'show-correct';
    feedbackHTML = `<strong>✓ 正確！</strong>`;
  } else if (noTone) {
    quality = 3;
    feedbackClass = 'tone-warn';
    feedbackHTML = `⚠️ 算對！注意音調：<strong>${correctAnswer}</strong>`;
  } else {
    quality = 1;
    feedbackClass = 'show-wrong';
    feedbackHTML = `✗ 正確答案：<strong>${correctAnswer}</strong>`;
  }

  const input = document.getElementById('answer-input');
  input.className = 'answer-input ' + (quality >= 3 ? 'correct' : 'wrong');
  input.disabled = true;
  document.getElementById('btn-submit').disabled = true;

  recordAndShowNext(card, quality, quality >= 3, feedbackClass, feedbackHTML);
}
```

- [ ] **Step 4：加入回饋顯示與下一題**

```javascript
function recordAndShowNext(card, quality, isCorrect, feedbackClass, feedbackHTML) {
  state.results.push({ word_id: card.word_id, vietnamese: card.vietnamese, chinese: card.chinese, correct: isCorrect });

  apiPost({ action: 'submitAnswer', word_id: card.word_id, quality }).catch(() => {});

  if (feedbackClass && feedbackHTML) {
    const fb = document.getElementById('feedback');
    fb.className = feedbackClass;
    fb.innerHTML = feedbackHTML;
  }

  const btnNext = document.getElementById('btn-next');
  btnNext.classList.remove('hidden');
  btnNext.onclick = () => {
    state.index++;
    if (state.index < state.cards.length) {
      // 重置輸入狀態
      document.getElementById('answer-input').disabled = false;
      document.getElementById('btn-submit').disabled = false;
      showCard();
    } else {
      showResult();
    }
  };
}
```

- [ ] **Step 5：在瀏覽器測試完整答題流程（需連線 GAS）**

點「開始答題」→ 答幾題選擇題和輸入題 → 確認對錯顯示正確。

- [ ] **Step 6：Commit**

```bash
git add app.js
git commit -m "feat: add quiz flow - choice and input questions"
```

---

## Task 10：app.js — 發音 + 結算畫面

**Files:**
- Modify: `app.js`

- [ ] **Step 1：加入發音函式**

```javascript
async function playAudio(word) {
  try {
    const data = await apiGet({ action: 'getAudio', word });
    if (data.audio) {
      const audio = new Audio(data.audio);
      audio.play();
    }
  } catch (e) {
    // 靜默失敗，不阻斷答題
  }
}
```

- [ ] **Step 2：加入結算畫面**

```javascript
function showResult() {
  showScreen('screen-result');

  const correct = state.results.filter(r => r.correct).length;
  const total = state.results.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  document.getElementById('score-pct').textContent = `${pct}%`;
  document.getElementById('score-detail').textContent = `答對 ${correct} / ${total} 題`;

  // 連續天數
  const lastDate = localStorage.getItem('lastDate');
  const todayStr = new Date().toISOString().split('T')[0];
  let streak = Number(localStorage.getItem('streak') || 0);
  if (lastDate === todayStr) {
    // 今天已算過
  } else if (lastDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
    streak += 1;
  } else {
    streak = 1;
  }
  localStorage.setItem('streak', streak);
  localStorage.setItem('lastDate', todayStr);
  document.getElementById('result-streak').textContent = streak;

  // 需加強的單字
  const weak = state.results.filter(r => !r.correct);
  const weakList = document.getElementById('weak-list');
  if (weak.length > 0) {
    weakList.innerHTML = '<h4>需要加強</h4>' +
      weak.map(w => `<div class="weak-item"><span>${w.vietnamese}</span><span style="color:var(--muted)">${w.chinese}</span></div>`).join('');
  } else {
    weakList.innerHTML = '<h4>全部答對 🎯</h4>';
  }

  // 明日待複習（重新查詢）
  apiGet({ action: 'getTodayCards' }).then(data => {
    document.getElementById('tomorrow-count').textContent = (data.cards || []).length;
  }).catch(() => {});
}
```

- [ ] **Step 3：完整測試：首頁 → 答完全部題目 → 結算畫面正確顯示**

- [ ] **Step 4：Commit**

```bash
git add app.js
git commit -m "feat: add audio playback and result screen"
```

---

## Task 11：部署到 GitHub Pages

**Files:**
- Create: `.gitignore`

- [ ] **Step 1：建立 `.gitignore`**

```
.superpowers/
*.DS_Store
```

- [ ] **Step 2：在 GitHub 建立新 repo**

前往 https://github.com/new，建立 `viet-vocab` repo（public）。

- [ ] **Step 3：推送並啟用 GitHub Pages**

```bash
git remote add origin https://github.com/你的帳號/viet-vocab.git
git branch -M main
git push -u origin main
```

在 GitHub repo Settings → Pages → Source 選 `main` branch，根目錄 `/`。

- [ ] **Step 4：確認網址可開啟**

幾分鐘後開啟 `https://你的帳號.github.io/viet-vocab/`，
確認首頁顯示、能取得今日卡片、能完整答題。

- [ ] **Step 5：Final commit**

```bash
git add .gitignore
git commit -m "chore: add gitignore"
git push
```

---

## 完成後驗收清單

- [ ] GAS API 四個 endpoint 全部正常回應
- [ ] 匯入一批越南語單字（至少 20 個）後，能看到今日卡片
- [ ] 選擇題答對/答錯顯示正確
- [ ] 輸入題缺音調顯示黃底提示
- [ ] 發音按鈕能播放越南語音檔
- [ ] 結算畫面顯示答對率 + 弱點單字
- [ ] 明天重新開啟，間隔重複正確調度（答錯的明天出現，答對的推遲）
