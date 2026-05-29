# 越南語詞彙學習系統 設計文件

**日期：** 2026-05-29  
**架構：** GitHub Pages + Google Apps Script + Google Sheets

---

## 目標

每天用 SM-2 間隔重複演算法練習越南語單字，追蹤弱點，長期累積詞彙量。

---

## 資料結構

### Sheet 1：`vocabulary`（題庫）

| 欄位 | 說明 |
|------|------|
| A: word_id | 唯一編號（自動遞增） |
| B: vietnamese | 越南文（含音調符號） |
| C: chinese | 中文意思 |
| D: word_type | 詞性（n/v/adj/phrase） |
| E: example | 例句（可空白） |

CSV 匯入格式：`vietnamese,chinese,word_type,example`

### Sheet 2：`progress`（學習進度）

| 欄位 | 說明 | 初始值 |
|------|------|--------|
| A: word_id | 對應 vocabulary | — |
| B: next_review | 下次複習日（yyyy-MM-dd） | 今天 |
| C: ease_factor | SM-2 難易係數 EF | 2.5 |
| D: interval | 目前間隔天數 | 1 |
| E: repetitions | 累計答對次數 | 0 |
| F: last_quality | 上次評分 0–5 | — |

---

## SM-2 演算法

答題後前端傳 quality（0–5）給 GAS：

- **quality ≥ 3（答對）**
  - repetitions += 1
  - interval：第1次=1天，第2次=6天，之後 = interval × EF
  - EF = EF + (0.1 - (5 - quality) × (0.08 + (5 - quality) × 0.02))，最低 1.3
  - next_review = 今天 + interval 天

- **quality < 3（答錯）**
  - repetitions = 0，interval = 1，EF 不變
  - next_review = 明天

---

## GAS API（doGet / doPost）

| action | 說明 |
|--------|------|
| `getTodayCards` | 撈 next_review ≤ 今天的單字，最多 30 張 |
| `submitAnswer` | 接收 word_id + quality，更新 progress |
| `initVocab` | CSV 初始化，寫入 vocabulary + 建立 progress 行 |
| `getAudio` | 代理 Google Translate TTS，回傳 base64 音檔（繞過 CORS） |

---

## 前端流程（GitHub Pages）

```
畫面 1：首頁
  ├─ 顯示今日待複習數、新單字數、連續天數
  └─ [開始答題] 按鈕

畫面 2：答題（單頁切換）
  ├─ 進度條 + 方向標籤（越→中 / 中→越）
  ├─ 單字卡 + [🔊 發音] 按鈕
  ├─ 偶數題：4選1選擇題
  ├─ 奇數題：文字輸入題
  ├─ 答對且缺音調 → 黃底提示正確寫法，算過
  └─ 答錯 → 紅框顯示錯誤，綠底顯示正確答案，可再聽發音

畫面 3：今日結算
  ├─ 答對率 + 題數
  ├─ 需加強單字清單（本次答錯的）
  ├─ 連續天數
  └─ 明日待複習數
```

---

## 題型細節

**選擇題**
- 正確答案 1 個 + 從同詞性隨機抽 3 個干擾項
- 點選後立即顯示對錯，不需按確認

**輸入題**
- 輸入後按確認或 Enter
- 比對邏輯：先完全比對，若不符再比對去除音調版本
- 缺音調 → quality = 3（算對，但提示）
- 完全正確 → quality = 4 或 5

---

## 發音

- 前端呼叫 GAS `getAudio?word=táo`
- GAS 用 UrlFetchApp 抓 Google Translate TTS（`tl=vi`）
- 回傳 base64，前端用 `new Audio("data:audio/mpeg;base64,...")` 播放
- 無法取得時靜默失敗（不阻斷答題流程）

---

## 視覺風格

- 背景：`#fafaf5`（米白）
- 重點色：`#c45c00`（橘）
- 文字：`#1c1c1c`
- 邊框：`2px solid #1c1c1c`
- 圓角：8px
- 字型：無襯線（系統預設）

---

## 不在此版本範圍

- 聲調辨識（錄音對比）
- 多用戶支援
- 離線模式
- 例句練習
