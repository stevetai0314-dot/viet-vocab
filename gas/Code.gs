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