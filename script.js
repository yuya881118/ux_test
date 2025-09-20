// UX検定 単語帳 - Vanilla JS
// ローカルストレージキー
const KEY_STATS = "ux_flashcards_stats_v1";
const KEY_WRONG = "ux_flashcards_wrong_v1";

// DOM取得
const drawer = document.getElementById("drawer");
const menuButton = document.getElementById("menuButton");
const closeDrawer = document.getElementById("closeDrawer");
const startButton = document.getElementById("startButton");
const quiz = document.getElementById("quiz");
const result = document.getElementById("result");
const intro = document.getElementById("intro");

const modeSel = document.getElementById("mode");
const secondsInput = document.getElementById("seconds");
const deckFilter = document.getElementById("deckFilter");
const shuffleCb = document.getElementById("shuffle");
const resetStatsBtn = document.getElementById("resetStats");

const questionText = document.getElementById("questionText");
const answerInput = document.getElementById("answerInput");
const timerEl = document.getElementById("timer");
const progressText = document.getElementById("progressText");
const progressBar = document.getElementById("progressBar");
const submitBtn = document.getElementById("submitBtn");
const skipBtn = document.getElementById("skipBtn");
const revealBtn = document.getElementById("revealBtn");
const instantResult = document.getElementById("instantResult");

const scoreLine = document.getElementById("scoreLine");
const reviewList = document.getElementById("reviewList");
const retryWrongBtn = document.getElementById("retryWrong");
const retryAllBtn = document.getElementById("retryAll");

let allCards = [];
let deck = [];
let idx = 0;
let timerId = null;
let remain = 20;
let answersExam = []; // 試験モード用: {q, a, user, correct}
let correctCount = 0;
let wrongList = [];  // 学習モード誤答、または試験モードの全回答を後で採点して格納

function openDrawer() {
  drawer.classList.remove("hidden");
  drawer.setAttribute("aria-hidden", "false");
}
function closeDrawerFn() {
  drawer.classList.add("hidden");
  drawer.setAttribute("aria-hidden", "true");
}
menuButton.addEventListener("click", openDrawer);
closeDrawer.addEventListener("click", closeDrawerFn);

resetStatsBtn.addEventListener("click", () => {
  if (confirm("学習履歴（正答率・誤答問題）をリセットしますか？")) {
    localStorage.removeItem(KEY_STATS);
    localStorage.removeItem(KEY_WRONG);
    alert("リセットしました。");
  }
});

function loadStats() {
  const s = localStorage.getItem(KEY_STATS);
  return s ? JSON.parse(s) : { total: 0, correct: 0 };
}
function saveStats(stats) {
  localStorage.setItem(KEY_STATS, JSON.stringify(stats));
}
function loadWrong() {
  const s = localStorage.getItem(KEY_WRONG);
  return s ? JSON.parse(s) : [];
}
function saveWrong(list) {
  localStorage.setItem(KEY_WRONG, JSON.stringify(list));
}

function updateProgress() {
  progressText.textContent = `${idx + 1} / ${deck.length}`;
  const ratio = ((idx) / deck.length) * 100;
  progressBar.style.width = `${ratio}%`;
}

function setTimer(sec) {
  clearInterval(timerId);
  remain = sec;
  timerEl.textContent = remain;
  timerId = setInterval(() => {
    remain--;
    timerEl.textContent = remain;
    if (remain <= 0) {
      clearInterval(timerId);
      handleSubmit(true); // タイムアップは強制送信扱い
    }
  }, 1000);
}

function renderQuestion() {
  const card = deck[idx];
  questionText.textContent = `【${card.category}】 ${card.q}`;
  answerInput.value = "";
  answerInput.focus();
  instantResult.classList.add("hidden");
  instantResult.textContent = "";
  updateProgress();
  setTimer(parseInt(secondsInput.value || "20", 10));
}

function startQuiz(source="all") {
  intro.classList.add("hidden");
  result.classList.add("hidden");
  quiz.classList.remove("hidden");

  // デッキ構築
  let base = [...allCards];
  if (deckFilter.value === "wrong") {
    const wrongSaved = loadWrong();
    base = base.filter(c => wrongSaved.some(w => w.q === c.q && w.a === c.a));
  } else if (deckFilter.value === "new") {
    const stats = loadStats();
    const wrongSaved = loadWrong();
    const seenSet = new Set(wrongSaved.map(w => w.q));
    base = base.filter(c => !seenSet.has(c.q)); // 簡易に未出題扱い
  }

  if (shuffleCb.checked) shuffle(base);
  deck = base;
  idx = 0;
  correctCount = 0;
  wrongList = [];
  answersExam = [];
  if (deck.length === 0) {
    alert("該当する問題がありません。設定を変更してください。");
    intro.classList.remove("hidden");
    quiz.classList.add("hidden");
    return;
  }
  renderQuestion();
}

function normalize(s) {
  return (s || "").toString().trim().toLowerCase()
    .replace(/（/g, "(").replace(/）/g, ")")
    .replace(/[　]/g, " ")
    .replace(/\s+/g, " ");
}

function handleSubmit(forced=false) {
  const card = deck[idx];
  const user = answerInput.value;
  const nUser = normalize(user);
  const nAns = card.accept ? card.accept.map(normalize) : [normalize(card.a)];

  if (modeSel.value === "study") {
    const ok = nAns.some(ans => nUser === ans || (nUser && ans.includes(nUser)) || (nUser && nUser.includes(ans)));
    const stats = loadStats();
    stats.total += 1;
    if (ok) {
      stats.correct += 1;
      correctCount += 1;
      instantResult.classList.remove("hidden");
      instantResult.textContent = "✅ 正解！";
      instantResult.style.borderColor = "#86efac";
      instantResult.style.background = "#ecfdf5";
    } else {
      wrongList.push({ ...card, user });
      const wrongSaved = loadWrong();
      wrongSaved.push({ q: card.q, a: card.a, category: card.category });
      saveWrong(wrongSaved.slice(-500)); // 上限
      instantResult.classList.remove("hidden");
      instantResult.innerHTML = `❌ 不正解<br/>正解：<b>${card.a}</b>`;
      instantResult.style.borderColor = "#fecaca";
      instantResult.style.background = "#fef2f2";
    }
    saveStats(stats);
  } else {
    // 試験モード: 後で判定
    answersExam.push({ card, user });
  }

  clearInterval(timerId);
  if (idx + 1 < deck.length) {
    idx += 1;
    renderQuestion();
  } else {
    finish();
  }
}

function finish() {
  quiz.classList.add("hidden");
  result.classList.remove("hidden");
  reviewList.innerHTML = "";
  let wrongs = [];

  if (modeSel.value === "exam") {
    // 採点
    let c = 0;
    answersExam.forEach(({card, user}) => {
      const nUser = normalize(user);
      const nAns = card.accept ? card.accept.map(normalize) : [normalize(card.a)];
      const ok = nAns.some(ans => nUser === ans || (nUser && ans.includes(nUser)) || (nUser && nUser.includes(ans)));
      if (ok) c += 1;
      else wrongs.push({ ...card, user });
    });
    correctCount = c;
    const stats = loadStats();
    stats.total += deck.length;
    stats.correct += c;
    saveStats(stats);

    // 永続化（誤答）
    if (wrongs.length) {
      const saved = loadWrong();
      wrongs.forEach(w => saved.push({ q: w.q, a: w.a, category: w.category }));
      saveWrong(saved.slice(-500));
    }
  } else {
    wrongs = wrongList;
  }

  const pct = Math.round((correctCount / deck.length) * 100);
  scoreLine.textContent = `正答数: ${correctCount} / ${deck.length}（正答率 ${pct}%）`;

  wrongs.forEach((w, i) => {
    const row = document.createElement("div");
    row.className = "review-item";
    row.innerHTML = `<div><b>${i+1}.【${w.category}】${w.q}</b> <span class="badge">正解: ${w.a}</span></div>`
      + (w.user ? `<div>あなたの回答: <code>${escapeHtml(w.user)}</code></div>` : "");
    reviewList.appendChild(row);
  });
}

function shuffle(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
}

function escapeHtml(str){
  return (str||"").replace(/[&<>"']/g, s=>({ "&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;" }[s]));
}

// イベント
startButton.addEventListener("click", () => startQuiz());
submitBtn.addEventListener("click", () => handleSubmit());
skipBtn.addEventListener("click", () => { answerInput.value=""; handleSubmit(true); });
revealBtn.addEventListener("click", () => {
  if (modeSel.value === "exam") {
    alert("試験モードでは解答表示はできません。");
  } else {
    const card = deck[idx];
    instantResult.classList.remove("hidden");
    instantResult.innerHTML = `🔍 ヒント/定義：<b>${card.a}</b>`;
  }
});
retryWrongBtn.addEventListener("click", () => { deckFilter.value = "wrong"; startQuiz(); });
retryAllBtn.addEventListener("click", () => { deckFilter.value = "all"; startQuiz(); });

// データ読み込み
fetch("data/ux_terms.json")
  .then(r => r.json())
  .then(data => {
    allCards = data;
    // 最初の所要数だけ
  })
  .catch(err => {
    console.error(err);
    alert("用語データの読み込みに失敗しました。");
  });
