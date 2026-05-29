const SS_ID = '1K77jslRU-eL-h4YM5VMCafl9anqIu3njQGKA3rwFsXg';
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

function testSM2() {
  const r1 = sm2Update(2.5, 1, 0, 4);
  Logger.log('第1次答對: interval=%s ef=%s rep=%s', r1.interval, r1.ef.toFixed(2), r1.repetitions);

  const r2 = sm2Update(r1.ef, r1.interval, r1.repetitions, 5);
  Logger.log('第2次答對: interval=%s ef=%s rep=%s', r2.interval, r2.ef.toFixed(2), r2.repetitions);

  const r3 = sm2Update(r2.ef, r2.interval, r2.repetitions, 3);
  Logger.log('第3次答對: interval=%s ef=%s rep=%s', r3.interval, r3.ef.toFixed(2), r3.repetitions);

  const r4 = sm2Update(r3.ef, r3.interval, r3.repetitions, 1);
  Logger.log('答錯: interval=%s ef=%s rep=%s', r4.interval, r4.ef.toFixed(2), r4.repetitions);
}

function initVocab(csvText) {
  const { vocab, progress } = getSheets();
  const lines = csvText.trim().split('\n').slice(1);
  const todayStr = today();

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

function testInitVocab() {
  const csv = `vietnamese,chinese,word_type,example
táo,蘋果,n,Tôi ăn táo
cảm ơn,謝謝,phrase,Cảm ơn bạn
bệnh viện,醫院,n,`;
  const result = initVocab(csv);
  Logger.log('匯入筆數: %s', result.imported);
}

function getTodayCards() {
  const { vocab, progress } = getSheets();
  const todayStr = today();

  const vocabRows = vocab.getDataRange().getValues().slice(1);
  const progressRows = progress.getDataRange().getValues().slice(1);

  const vocabMap = {};
  vocabRows.forEach(r => { vocabMap[r[0]] = { vietnamese: r[1], chinese: r[2], word_type: r[3], example: r[4] }; });

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

  const allWords = vocabRows.map(r => ({ word_id: r[0], vietnamese: r[1], chinese: r[2], word_type: r[3] }));

  return { cards, allWords, today: todayStr };
}

function testGetTodayCards() {
  const result = getTodayCards();
  Logger.log('今日卡片數: %s', result.cards.length);
  Logger.log('全部詞彙數: %s', result.allWords.length);
  if (result.cards.length > 0) {
    Logger.log('第一張: %s', JSON.stringify(result.cards[0]));
  }
}

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

function testSubmitAnswer() {
  const { cards } = getTodayCards();
  if (cards.length === 0) { Logger.log('沒有今日卡片'); return; }

  const wordId = cards[0].word_id;
  Logger.log('測試 word_id: %s', wordId);

  const r1 = submitAnswer(wordId, 4);
  Logger.log('答對後 next_review: %s interval: %s', r1.next_review, r1.interval);

  const r2 = submitAnswer(wordId, 1);
  Logger.log('答錯後 next_review: %s interval: %s', r2.next_review, r2.interval);
}

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