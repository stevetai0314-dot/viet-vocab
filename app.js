const GAS_URL = 'YOUR_GAS_URL'; // 替換成你的 GAS Web App URL（部署後取得）

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
  cards: [],
  allWords: [],
  index: 0,
  results: [],
  streak: 0
};

// ─── 畫面切換 ───────────────────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.add('hidden'));
  document.getElementById(id).classList.remove('hidden');
}

// ─── 首頁 ───────────────────────────────────────────────
async function initHome() {
  document.getElementById('today-date').textContent =
    new Date().toLocaleDateString('zh-TW', { year: 'numeric', month: 'long', day: 'numeric', weekday: 'short' });

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

// ─── 答題流程 ───────────────────────────────────────────
function startQuiz() {
  state.index = 0;
  state.results = [];
  showScreen('screen-quiz');
  showCard();
}

function getDistractors(correct, wordType) {
  const pool = state.allWords.filter(w => w.word_id !== correct.word_id && w.word_type === wordType);
  const fallback = state.allWords.filter(w => w.word_id !== correct.word_id);
  const source = pool.length >= 3 ? pool : fallback;
  return source.sort(() => Math.random() - 0.5).slice(0, 3);
}

function showCard() {
  const card = state.cards[state.index];
  const total = state.cards.length;
  const isChoice = state.index % 2 === 0;
  const isVietToChinese = state.index % 4 < 2;

  document.getElementById('quiz-progress').textContent = `${state.index + 1} / ${total}`;
  document.getElementById('progress-fill').style.width = `${((state.index + 1) / total) * 100}%`;
  document.getElementById('quiz-direction').textContent = isVietToChinese ? '越 → 中' : '中 → 越';
  document.getElementById('word-display').textContent = isVietToChinese ? card.vietnamese : card.chinese;
  document.getElementById('btn-audio').onclick = () => playAudio(card.vietnamese);

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

function showChoiceQuestion(card, isVietToChinese) {
  document.getElementById('choice-area').classList.remove('hidden');
  document.getElementById('input-area').classList.add('hidden');

  const options = [card, ...getDistractors(card, card.word_type)].sort(() => Math.random() - 0.5);
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

  document.querySelectorAll('.choice-btn').forEach(b => {
    const val = b.textContent;
    const isThisCorrect = isVietToChinese ? val === card.chinese : val === card.vietnamese;
    if (isThisCorrect) b.classList.add('correct');
    else if (b === btn && !isCorrect) b.classList.add('wrong');
    b.disabled = true;
  });

  recordAndShowNext(card, quality, isCorrect, null, null);
}

function showInputQuestion(card, isVietToChinese) {
  document.getElementById('input-area').classList.remove('hidden');
  document.getElementById('choice-area').classList.add('hidden');

  const input = document.getElementById('answer-input');
  input.value = '';
  input.className = 'answer-input';
  input.disabled = false;
  input.focus();

  const correctAnswer = isVietToChinese ? card.chinese : card.vietnamese;
  const submit = () => handleInputAnswer(card, input.value, correctAnswer, isVietToChinese);

  document.getElementById('btn-submit').disabled = false;
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
      showCard();
    } else {
      showResult();
    }
  };
}

// ─── 發音 ───────────────────────────────────────────────
async function playAudio(word) {
  try {
    const data = await apiGet({ action: 'getAudio', word });
    if (data.audio) {
      new Audio(data.audio).play();
    }
  } catch (e) {
    // 靜默失敗
  }
}

// ─── 結算 ───────────────────────────────────────────────
function showResult() {
  showScreen('screen-result');

  const correct = state.results.filter(r => r.correct).length;
  const total = state.results.length;
  const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

  document.getElementById('score-pct').textContent = `${pct}%`;
  document.getElementById('score-detail').textContent = `答對 ${correct} / ${total} 題`;

  const lastDate = localStorage.getItem('lastDate');
  const todayStr = new Date().toISOString().split('T')[0];
  let streak = Number(localStorage.getItem('streak') || 0);
  if (lastDate === todayStr) {
    // 今天已算過，不重複計
  } else if (lastDate === new Date(Date.now() - 86400000).toISOString().split('T')[0]) {
    streak += 1;
  } else {
    streak = 1;
  }
  localStorage.setItem('streak', streak);
  localStorage.setItem('lastDate', todayStr);
  document.getElementById('result-streak').textContent = streak;

  const weak = state.results.filter(r => !r.correct);
  const weakList = document.getElementById('weak-list');
  if (weak.length > 0) {
    weakList.innerHTML = '<h4>需要加強</h4>' +
      weak.map(w => `<div class="weak-item"><span>${w.vietnamese}</span><span style="color:var(--muted)">${w.chinese}</span></div>`).join('');
  } else {
    weakList.innerHTML = '<h4>全部答對 🎯</h4>';
  }

  apiGet({ action: 'getTodayCards' }).then(data => {
    document.getElementById('tomorrow-count').textContent = (data.cards || []).length;
  }).catch(() => {});
}

// ─── 啟動 ───────────────────────────────────────────────
document.addEventListener('DOMContentLoaded', initHome);
