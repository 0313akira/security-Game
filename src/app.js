/* =========================================================
   ゲーム処理
   ========================================================= */
const $ = (id) => document.getElementById(id);
const el = (tag, text, cls) => {
  const e = document.createElement(tag);
  if (text !== undefined && text !== null) e.textContent = text;
  if (cls) e.className = cls;
  return e;
};
const shuffle = (arr) => {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};
const pct = (x) => Math.round(x * 100) + "%";

/* ---------------- セーブデータ（このブラウザだけに保存） ---------------- */
const SAVE_KEY = "whm-save-v2";
function defaultSave() {
  return { diff: "normal", sound: true, topics: {}, achievements: {}, lastVariant: {}, quizStreak: 0, lessonsRead: [], best: {} };
}
let save = defaultSave();
try {
  const raw = localStorage.getItem(SAVE_KEY);
  if (raw) save = Object.assign(defaultSave(), JSON.parse(raw));
} catch (e) { /* 保存できない環境でも遊べるようにする */ }
function persist() {
  try { localStorage.setItem(SAVE_KEY, JSON.stringify(save)); } catch (e) { }
}
function topicStat(id) {
  if (!save.topics[id]) save.topics[id] = { plays: 0, found: 0, total: 0, fp: 0, quizOk: 0, quizN: 0, missed: {} };
  return save.topics[id];
}
function topicRate(s) {
  if (!s || s.plays === 0) return null;
  const detect = s.total ? s.found / s.total : 0;
  const quiz = s.quizN ? s.quizOk / s.quizN : 0;
  return detect * 0.7 + quiz * 0.3;
}

/* ---------------- 効果音（Web Audio） ---------------- */
let audioCtx = null;
function tone(seq, type = "square", vol = 0.06) {
  if (!save.sound) return;
  try {
    audioCtx = audioCtx || new (window.AudioContext || window.webkitAudioContext)();
    let t = audioCtx.currentTime;
    seq.forEach(([freq, dur]) => {
      const o = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      o.type = type;
      o.frequency.value = freq;
      g.gain.setValueAtTime(vol, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
      o.connect(g).connect(audioCtx.destination);
      o.start(t);
      o.stop(t + dur);
      t += dur * 0.9;
    });
  } catch (e) { }
}
const SFX = {
  click: () => tone([[880, 0.05]], "square", 0.03),
  unclick: () => tone([[440, 0.05]], "square", 0.03),
  good: () => tone([[660, 0.08], [880, 0.08], [1320, 0.15]], "square", 0.05),
  bad: () => tone([[200, 0.12], [150, 0.2]], "sawtooth", 0.05),
  fanfare: () => tone([[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.35]], "square", 0.06),
  ach: () => tone([[988, 0.08], [1319, 0.25]], "triangle", 0.08),
  tick: () => tone([[1200, 0.03]], "square", 0.02),
};

/* ---------------- トースト ---------------- */
function toast(msg, kind) {
  const t = el("div", msg, "toast" + (kind ? " " + kind : ""));
  $("toasts").appendChild(t);
  setTimeout(() => t.remove(), kind === "ach" ? 3000 : 1400);
}

/* ---------------- 実績 ---------------- */
let newAchThisRun = [];
function unlock(id) {
  if (save.achievements[id]) return;
  const a = ACHIEVEMENTS.find(x => x.id === id);
  if (!a) return;
  save.achievements[id] = new Date().toISOString().slice(0, 10);
  persist();
  newAchThisRun.push(a);
  SFX.ach();
  toast(`🏆 実績解除：${a.icon} ${a.name}`, "ach");
  updateAchCount();
}
function updateAchCount() {
  $("ach-count").textContent = `${Object.keys(save.achievements).length} / ${ACHIEVEMENTS.length} 解除`;
}

/* ---------------- 画面内ダイアログ（alert / confirm の代わり） ---------------- */
function dialog(message, buttons) {
  const box = $("dialog");
  $("dialog-msg").textContent = message;
  const row = $("dialog-btns");
  row.innerHTML = "";
  buttons.forEach(b => {
    const btn = el("button", b.label, b.primary ? "primary" : "ghost");
    btn.addEventListener("click", () => { box.hidden = true; if (b.onClick) b.onClick(); });
    row.appendChild(btn);
  });
  box.hidden = false;
  const first = row.querySelector(".primary") || row.firstChild;
  if (first) first.focus();
}
const askConfirm = (message, yesLabel, onYes) => dialog(message, [{ label: "やめる" }, { label: yesLabel, primary: true, onClick: onYes }]);
const notice = (message, onOk) => dialog(message, [{ label: "OK", primary: true, onClick: onOk }]);

/* ---------------- 画面切り替え ---------------- */
let stopTimer = () => {};
function show(id) {
  document.querySelectorAll(".screen").forEach(s => s.classList.remove("active"));
  $(id).classList.add("active");
  window.scrollTo(0, 0);
}
function goTitle() {
  stopTimer();
  renderTitle();
  show("s-title");
}

/* ---------------- タイトル ---------------- */
function renderTitle() {
  const chips = $("diff-chips");
  chips.innerHTML = "";
  Object.entries(DIFFS).forEach(([key, d]) => {
    const b = el("button", d.label, save.diff === key ? "on" : "");
    b.addEventListener("click", () => { save.diff = key; persist(); SFX.click(); renderTitle(); });
    chips.appendChild(b);
  });
  $("diff-desc").textContent = DIFFS[save.diff].desc;
  const parts = [];
  ["story", "quick"].forEach(m => {
    const b = save.best[`${m}_${save.diff}`];
    if (b) parts.push(`${m === "story" ? "ストーリー" : "クイック"}（${DIFFS[save.diff].label}）ベスト：${b.score}点 ${b.rank}ランク`);
  });
  $("best-score").textContent = parts.join(" ／ ");
  $("btn-sound").textContent = save.sound ? "🔊 音あり" : "🔈 音なし";
  updateAchCount();
}

/* ---------------- プレイの状態 ---------------- */
const run = { mode: "story", queue: [], pos: 0, score: 0, max: 0, results: [], diff: "normal" };
const M = { topic: null, variant: null, vIdx: 0, marks: new Set(), hintUsed: false, timeLeft: 0, timeLimit: 0, quiz: null, gain: 0, hits: 0, fps: 0, bonus: 0, submitted: false };

function startRun(mode, queue) {
  run.mode = mode;
  run.queue = queue;
  run.pos = 0;
  run.score = 0;
  run.max = 0;
  run.results = [];
  run.diff = save.diff;
  newAchThisRun = [];
  startMission();
}

function startStory() {
  const box = $("prologue-text");
  box.innerHTML = "";
  PROLOGUE.forEach((line, i) => {
    const p = el("p", line);
    p.style.animationDelay = (i * 0.5) + "s";
    box.appendChild(p);
  });
  show("s-prologue");
}

function startQuick() {
  startRun("quick", shuffle(TOPICS.map((_, i) => i)).slice(0, 5));
}

function weakQueue() {
  const played = [], unplayed = [];
  TOPICS.forEach((t, i) => {
    const r = topicRate(save.topics[t.id]);
    if (r === null) unplayed.push(i); else played.push({ i, r: r + Math.random() * 0.01 });
  });
  played.sort((a, b) => a.r - b.r);
  const weak = played.filter(p => p.r < 0.8).map(p => p.i);
  const rest = played.filter(p => p.r >= 0.8).map(p => p.i);
  return weak.concat(shuffle(unplayed), rest).slice(0, 5);
}
function startWeak() {
  if (Object.keys(save.topics).length === 0) {
    notice("まだプレイ記録がありません。まずはストーリーモードかクイックプレイで遊んでみよう！");
    return;
  }
  startRun("weak", weakQueue());
}

function pickVariant(topic) {
  const n = topic.variants.length;
  const last = save.lastVariant[topic.id];
  let idx = Math.floor(Math.random() * n);
  if (n > 1 && idx === last) idx = (idx + 1 + Math.floor(Math.random() * (n - 1))) % n;
  save.lastVariant[topic.id] = idx;
  persist();
  return idx;
}

/* ---------------- ミッション ---------------- */
function renderCode(container, variant, decorate) {
  container.innerHTML = "";
  variant.lines.forEach((text, i) => {
    const btn = el("button", null, "ln");
    btn.append(el("span", String(i + 1), "no"), el("span", text || " "));
    decorate(btn, i);
    container.appendChild(btn);
  });
}

function startMission() {
  const d = DIFFS[run.diff];
  const topicIdx = run.queue[run.pos];
  M.topic = TOPICS[topicIdx];
  M.vIdx = pickVariant(M.topic);
  M.variant = M.topic.variants[M.vIdx];
  M.marks = new Set();
  M.hintUsed = false;
  M.submitted = false;
  run.max += M.variant.vulns.length * 100 + 50 + (d.timer ? 50 : 0);  // 上級は時間ボーナス分も満点に含める

  const v = M.variant;
  $("hud-stage").textContent = `${run.pos + 1}/${run.queue.length}`;
  $("hud-score").textContent = run.score;
  $("hud-marks").textContent = 0;
  $("hud-total").textContent = d.showCount ? v.vulns.length : "？";
  $("hud-diff").textContent = d.label;
  $("hud-type").textContent = `${CATS[M.topic.cat]} / ${v.type}`;
  $("g-story").style.display = run.mode === "story" ? "block" : "none";
  $("g-story").textContent = "STORY：" + M.topic.story;
  $("g-title").textContent = `MISSION ${run.mode === "story" ? topicIdx + 1 : run.pos + 1}：${v.title}`;
  $("g-client").textContent = v.client;
  $("g-scenario").textContent = v.scenario;
  $("g-hint").style.display = "none";
  $("g-hint").textContent = "ヒント：" + v.hint;

  const hb = $("btn-hint");
  hb.style.display = d.hint ? "" : "none";
  hb.disabled = false;
  hb.textContent = d.hintCost ? `ヒント (-${d.hintCost})` : "ヒント（無料）";

  renderCode($("g-code"), v, (btn, idx) => {
    btn.addEventListener("click", () => {
      if (M.submitted) return;
      if (M.marks.has(idx)) { M.marks.delete(idx); btn.classList.remove("marked"); SFX.unclick(); }
      else { M.marks.add(idx); btn.classList.add("marked"); SFX.click(); }
      $("hud-marks").textContent = M.marks.size;
    });
  });

  stopTimer();
  $("hud-timer-wrap").style.display = d.timer ? "" : "none";
  if (d.timer) {
    M.timeLimit = 40 + v.lines.length * 6;
    M.timeLeft = M.timeLimit;
    const tw = $("hud-timer-wrap");
    tw.classList.remove("low");
    $("hud-timer").textContent = M.timeLeft;
    const id = setInterval(() => {
      M.timeLeft--;
      $("hud-timer").textContent = M.timeLeft;
      if (M.timeLeft <= 10) { tw.classList.add("low"); SFX.tick(); }
      if (M.timeLeft <= 0) { stopTimer(); toast("時間切れ！"); submit(true); }
    }, 1000);
    stopTimer = () => { clearInterval(id); stopTimer = () => {}; };
  }
  show("s-game");
}

function useHint() {
  if (M.hintUsed) return;
  M.hintUsed = true;
  $("g-hint").style.display = "block";
  $("btn-hint").disabled = true;
  const cost = DIFFS[run.diff].hintCost;
  if (cost) toast(`ヒント使用 -${cost}`);
}

function submit(timeUp, force) {
  if (M.submitted) return;
  const d = DIFFS[run.diff];
  const v = M.variant;
  if (!timeUp && !force && M.marks.size === 0) {
    askConfirm("1行もマークしていません。このまま提出しますか？", "提出する", () => submit(false, true));
    return;
  }
  M.submitted = true;
  stopTimer();

  const vulnLines = new Set(v.vulns.map(x => x.line));
  const neutral = new Set(v.neutral || []);
  let hits = 0, fps = 0;
  M.marks.forEach(m => {
    if (vulnLines.has(m)) hits++;
    else if (!neutral.has(m)) fps++;
  });
  let gain = hits * 100 - fps * d.fp - (M.hintUsed ? d.hintCost : 0);
  let bonus = 0;
  if (d.timer && hits === v.vulns.length && fps === 0 && M.timeLeft > 0) bonus = Math.round(50 * M.timeLeft / M.timeLimit);  // 最大+50
  gain += bonus;
  M.gain = gain; M.hits = hits; M.fps = fps; M.bonus = bonus;
  run.score += gain;

  // 記録
  const st = topicStat(M.topic.id);
  st.plays++; st.found += hits; st.total += v.vulns.length; st.fp += fps;
  v.vulns.forEach(x => { if (!M.marks.has(x.line)) { const k = x.name.replace(/[①②③④⑤]$/, ""); st.missed[k] = (st.missed[k] || 0) + 1; } });
  persist();

  if (hits === v.vulns.length && fps === 0) SFX.good(); else SFX.bad();
  if (d.timer && hits === v.vulns.length && M.timeLeft >= M.timeLimit / 2) unlock("speed");

  // 表示
  $("r-title").textContent = `診断結果：${hits} / ${v.vulns.length} 件発見`;
  updateGain();
  $("r-bonus").textContent = bonus ? `⚡ 残り時間ボーナス +${bonus}` : (timeUp ? "時間切れ" : "");
  renderCode($("r-code"), v, (btn, idx) => {
    btn.classList.add("done");
    if (vulnLines.has(idx)) btn.classList.add(M.marks.has(idx) ? "hit" : "miss");
    else if (M.marks.has(idx) && !neutral.has(idx)) btn.classList.add("fp");
    else if (M.marks.has(idx)) btn.classList.add("marked");
  });
  const list = $("r-list");
  list.innerHTML = "";
  v.vulns.forEach(x => {
    const found = M.marks.has(x.line);
    const div = el("div", null, "result-item " + (found ? "ok" : "ng"));
    div.append(
      el("h4", `${found ? "✔ 発見" : "✘ 見逃し"}　${x.line + 1}行目：${x.name}`),
      el("div", x.why),
      el("div", "【対策】\n" + x.fix, "fix")
    );
    list.appendChild(div);
  });
  if (fps > 0) {
    list.appendChild(el("div", `安全な行を ${fps} 行マークしました（-${fps * d.fp}）。本物の診断でも「誤検知」は相手の時間を奪うので、根拠を持って報告しよう。`, "result-item"));
  }
  if (neutral.size) {
    list.appendChild(el("div", `※ ${[...neutral].map(n => n + 1).join("・")}行目は「怪しいとも言える」行なので、マークしても減点なしです。`, "sub"));
  }

  // クイズ（ランダムに1問、選択肢もシャッフル）
  const q = M.topic.quizzes[Math.floor(Math.random() * M.topic.quizzes.length)];
  const order = shuffle(q.choices.map((_, i) => i));
  M.quiz = { q, order, answer: order.indexOf(q.answer) };
  $("q-text").textContent = q.q;
  $("q-explain").style.display = "none";
  $("btn-next").disabled = true;
  $("btn-next").textContent = run.pos < run.queue.length - 1 ? "次のミッションへ" : "結果を見る";
  const qc = $("q-choices");
  qc.innerHTML = "";
  order.forEach((orig, i) => {
    const b = el("button", `${"ABCD"[i]}. ${q.choices[orig]}`);
    b.addEventListener("click", () => answerQuiz(i));
    qc.appendChild(b);
  });
  show("s-result");
}

function updateGain() {
  const g = $("r-gain");
  g.textContent = (M.gain >= 0 ? "+" : "") + M.gain;
  g.classList.toggle("neg", M.gain < 0);
}

function answerQuiz(i) {
  const btns = $("q-choices").querySelectorAll("button");
  btns.forEach((b, j) => {
    b.disabled = true;
    if (j === M.quiz.answer) b.classList.add("correct");
    else if (j === i) b.classList.add("wrong");
  });
  const ok = i === M.quiz.answer;
  const st = topicStat(M.topic.id);
  st.quizN++;
  if (ok) {
    st.quizOk++;
    M.gain += 50; run.score += 50;
    save.quizStreak++;
    SFX.good(); toast("正解！ +50");
    if (save.quizStreak >= 10) unlock("quiz10");
  } else {
    save.quizStreak = 0;
    SFX.bad(); toast("ざんねん…");
  }
  persist();
  updateGain();
  const ex = $("q-explain");
  ex.textContent = (ok ? "正解！ " : "不正解。 ") + M.quiz.q.explain;
  ex.style.display = "block";

  const perfect = M.hits === M.variant.vulns.length && M.fps === 0 && ok;
  run.results.push({ topic: M.topic, title: M.variant.title, gain: M.gain, hits: M.hits, total: M.variant.vulns.length, fps: M.fps, quizOk: ok, hint: M.hintUsed, perfect });

  // 実績（ミッション単位）
  unlock("first");
  if (perfect) {
    unlock("perfect");
    const map = { phishing: "phish_eye", sqli: "sqli_hunter", xss: "xss_hunter", network: "net_guard", logs: "detective" };
    if (map[M.topic.id]) unlock(map[M.topic.id]);
  }
  if (TOPICS.every(t => save.topics[t.id] && save.topics[t.id].plays > 0)) unlock("all_topics");
  $("btn-next").disabled = false;
}

function nextMission() {
  if (run.pos < run.queue.length - 1) { run.pos++; startMission(); }
  else finishRun();
}

/* ---------------- 最終結果 ---------------- */
function finishRun() {
  const modeName = { story: "ストーリーモード", quick: "クイックプレイ", weak: "苦手克服モード", single: "ステージ選択" }[run.mode];
  const ratio = run.max ? run.score / run.max : 0;
  const r = RANKS.find(x => ratio >= x.min);
  SFX.fanfare();
  $("f-mode").textContent = `${modeName}（${DIFFS[run.diff].label}）完了`;
  $("f-rank").textContent = r.rank;
  $("f-title").textContent = r.title;
  $("f-score").textContent = `${run.score} / ${run.max} 点`;
  $("f-msg").textContent = r.msg;
  $("f-epilogue").textContent = run.mode === "story" ? "EPILOGUE：" + EPILOGUE : "";

  // 実績（プレイ単位）
  const totalFp = run.results.reduce((s, x) => s + x.fps, 0);
  const usedHint = run.results.some(x => x.hint);
  if (run.mode === "story") {
    unlock("story");
    if (run.diff === "hard") unlock("story_hard");
    if (!usedHint) unlock("no_hint");
  }
  if ((run.mode === "story" || run.mode === "quick") && r.rank === "S") unlock("rank_s");
  if (run.results.length >= 5 && totalFp === 0) unlock("no_fp");
  if (run.mode === "weak") unlock("weak");

  // ベストスコア
  if (run.mode === "story" || run.mode === "quick") {
    const key = `${run.mode}_${run.diff}`;
    if (!save.best[key] || run.score > save.best[key].score) {
      save.best[key] = { score: run.score, rank: r.rank };
      persist();
      toast("ベストスコア更新！");
    }
  }

  // 新しい実績
  const ac = $("f-ach");
  ac.innerHTML = "";
  $("f-ach-card").style.display = newAchThisRun.length ? "" : "none";
  newAchThisRun.forEach(a => ac.appendChild(el("div", `${a.icon} ${a.name} ― ${a.desc}`, "new-ach")));

  // 分野別
  const cats = {};
  run.results.forEach(x => {
    const c = cats[x.topic.cat] || (cats[x.topic.cat] = { hits: 0, total: 0 });
    c.hits += x.hits; c.total += x.total;
  });
  const ct = $("f-cats");
  ct.innerHTML = "";
  ct.appendChild(headerRow(["分野", "発見率", "", "判定"]));
  Object.entries(cats).forEach(([k, c]) => {
    const rate = c.total ? c.hits / c.total : 0;
    ct.appendChild(dataRow([CATS[k], pct(rate), barEl(rate), judgeTag(rate)]));
  });

  const tbl = $("f-table");
  tbl.innerHTML = "";
  tbl.appendChild(headerRow(["#", "ミッション", "発見", "クイズ", "点数"]));
  run.results.forEach((x, i) => {
    tbl.appendChild(dataRow([String(i + 1), `${x.title}${x.perfect ? " 💎" : ""}`, `${x.hits}/${x.total}`, x.quizOk ? "○" : "×", String(x.gain)]));
  });
  show("s-final");
}

function headerRow(cols) {
  const tr = el("tr");
  cols.forEach(c => tr.appendChild(el("th", c)));
  return tr;
}
function dataRow(cols) {
  const tr = el("tr");
  cols.forEach(c => {
    const td = el("td");
    if (c instanceof Node) td.appendChild(c); else td.textContent = c;
    tr.appendChild(td);
  });
  return tr;
}
function barEl(rate) {
  const b = el("div", null, "bar" + (rate < 0.5 ? " low" : rate < 0.8 ? " mid" : ""));
  const i = el("i");
  i.style.width = Math.max(0, Math.min(100, rate * 100)) + "%";
  b.appendChild(i);
  return b;
}
function judgeTag(rate) {
  if (rate >= 0.8) return el("span", "得意", "tag good");
  if (rate >= 0.5) return el("span", "もう少し", "tag mid");
  return el("span", "苦手", "tag bad");
}

/* ---------------- ステージ選択 ---------------- */
function buildSelect() {
  const grid = $("stage-grid");
  TOPICS.forEach((t, i) => {
    const b = el("button");
    b.append(el("b", `${i + 1}. ${t.name}`), el("small", `${CATS[t.cat]} ／ ${t.variants.length}パターン`));
    b.addEventListener("click", () => startRun("single", [i]));
    grid.appendChild(b);
  });
}

/* ---------------- 学習テキスト ---------------- */
function renderLesson(i, container, withPlay) {
  const t = TOPICS[i], L = t.lesson;
  const box = el("div", null, "card lesson");
  box.id = "lesson-" + i;
  box.dataset.idx = i;
  box.append(
    el("div", `第${i + 1}章　${CATS[t.cat]}`, "sub"),
    el("h3", t.name),
    el("h4", "どんなもの？"), el("p", L.what),
    el("h4", "具体例"), el("p", L.exampleLabel), el("div", L.example, "ex"),
    el("h4", "何が危ない？"), el("p", L.danger),
    el("h4", "対策")
  );
  const ul = el("ul");
  L.defense.forEach(d => ul.appendChild(el("li", d)));
  box.appendChild(ul);
  box.appendChild(el("div", "💡 " + L.tip, "tip"));
  const exam = el("div", null, "exam");
  exam.appendChild(el("b", "🎓 試験に出るポイント"));
  exam.appendChild(el("div", t.examPoint));
  const dl = el("dl");
  t.terms.forEach(x => { dl.append(el("dt", x.t), el("dd", x.d)); });
  exam.appendChild(dl);
  box.appendChild(exam);
  if (withPlay) {
    const row = el("div", null, "row");
    row.style.marginTop = "12px";
    const b = el("button", `▶ この題材で挑戦`);
    b.addEventListener("click", () => startRun("single", [i]));
    row.appendChild(b);
    box.appendChild(row);
  }
  container.appendChild(box);
}

function markLessonRead(i) {
  if (save.lessonsRead.includes(i)) return;
  save.lessonsRead.push(i);
  persist();
  const a = document.querySelector(`#text-toc a[data-idx="${i}"]`);
  if (a) a.classList.add("read");
  if (save.lessonsRead.length >= TOPICS.length) unlock("scholar");
}

function buildText() {
  const toc = $("text-toc"), body = $("text-body");
  TOPICS.forEach((t, i) => {
    const a = el("a", `第${i + 1}章　${t.name}`);
    a.href = "#lesson-" + i;
    a.dataset.idx = i;
    if (save.lessonsRead.includes(i)) a.classList.add("read");
    a.addEventListener("click", (e) => { e.preventDefault(); $("lesson-" + i).scrollIntoView({ behavior: "smooth" }); });
    toc.appendChild(a);
    renderLesson(i, body, true);
  });
  // 章の最後まで画面に入ったら「読んだ」とみなす
  if ("IntersectionObserver" in window) {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(en => {
        if (en.isIntersecting && $("s-text").classList.contains("active")) markLessonRead(Number(en.target.parentElement.dataset.idx));
      });
    }, { threshold: 0.5 });
    body.querySelectorAll(".lesson .exam").forEach(e => io.observe(e));
  }
}

function openLessonModal(i) {
  const mb = $("modal-body");
  mb.innerHTML = "";
  renderLesson(i, mb, false);
  mb.firstChild.classList.remove("card");
  $("modal").classList.add("open");
  markLessonRead(i);
}

/* ---------------- 用語集・用語クイズ ---------------- */
const ALL_TERMS = [];
TOPICS.forEach(t => t.terms.forEach(x => { if (!ALL_TERMS.some(y => y.t === x.t)) ALL_TERMS.push({ ...x, topic: t.name }); }));

function renderGlossary(filter) {
  const list = $("gl-list");
  list.innerHTML = "";
  const f = (filter || "").trim().toLowerCase();
  const items = ALL_TERMS.filter(x => !f || (x.t + x.d + x.topic).toLowerCase().includes(f));
  if (!items.length) { list.appendChild(el("p", "見つかりませんでした。", "sub")); return; }
  items.forEach(x => {
    const d = el("div", null, "gl-item");
    d.append(el("b", x.t), el("small", x.topic), el("div", x.d));
    list.appendChild(d);
  });
}

const GQ = { qs: [], pos: 0, ok: 0 };
function startGQuiz() {
  GQ.qs = shuffle(ALL_TERMS).slice(0, 10).map(x => {
    const wrong = shuffle(ALL_TERMS.filter(y => y.t !== x.t)).slice(0, 3).map(y => y.t);
    const choices = shuffle([x.t, ...wrong]);
    return { term: x, choices, answer: choices.indexOf(x.t) };
  });
  GQ.pos = 0; GQ.ok = 0;
  renderGQ();
  show("s-gquiz");
}
function renderGQ() {
  const q = GQ.qs[GQ.pos];
  $("gq-progress").textContent = `${GQ.pos + 1} / ${GQ.qs.length}　正解 ${GQ.ok}`;
  $("gq-def").textContent = q.term.d;
  $("gq-explain").textContent = "";
  $("btn-gq-next").disabled = true;
  $("btn-gq-next").textContent = GQ.pos < GQ.qs.length - 1 ? "次へ" : "結果を見る";
  const box = $("gq-choices");
  box.innerHTML = "";
  q.choices.forEach((c, i) => {
    const b = el("button", `${"ABCD"[i]}. ${c}`);
    b.addEventListener("click", () => {
      box.querySelectorAll("button").forEach((x, j) => {
        x.disabled = true;
        if (j === q.answer) x.classList.add("correct");
        else if (j === i) x.classList.add("wrong");
      });
      if (i === q.answer) { GQ.ok++; SFX.good(); } else SFX.bad();
      $("gq-progress").textContent = `${GQ.pos + 1} / ${GQ.qs.length}　正解 ${GQ.ok}`;
      $("gq-explain").textContent = `（${q.term.topic}）`;
      $("btn-gq-next").disabled = false;
    });
    box.appendChild(b);
  });
}
function nextGQ() {
  if (GQ.pos < GQ.qs.length - 1) { GQ.pos++; renderGQ(); return; }
  SFX.fanfare();
  if (GQ.ok >= 9) unlock("glossary");
  notice(`用語クイズ終了！ ${GQ.qs.length}問中 ${GQ.ok}問正解。${GQ.ok >= 9 ? "すばらしい！" : GQ.ok >= 6 ? "いい調子！" : "用語集で復習しよう！"}`, () => show("s-glossary"));
}

/* ---------------- 成績・苦手リスト ---------------- */
function renderStats() {
  const has = Object.keys(save.topics).length > 0;
  $("stats-empty").textContent = has ? "" : "まだ記録がありません。プレイすると、ここに分野別の得意・苦手が表示されます。";

  const cats = {};
  Object.keys(CATS).forEach(k => cats[k] = { found: 0, total: 0, quizOk: 0, quizN: 0, plays: 0 });
  TOPICS.forEach(t => {
    const s = save.topics[t.id];
    if (!s) return;
    const c = cats[t.cat];
    c.found += s.found; c.total += s.total; c.quizOk += s.quizOk; c.quizN += s.quizN; c.plays += s.plays;
  });
  const ct = $("stats-cats");
  ct.innerHTML = "";
  ct.appendChild(headerRow(["分野", "正解率", "", "判定"]));
  Object.entries(cats).forEach(([k, c]) => {
    const r = topicRate(c);
    ct.appendChild(dataRow([CATS[k], r === null ? "―" : pct(r), r === null ? "未プレイ" : barEl(r), r === null ? "" : judgeTag(r)]));
  });

  const rows = TOPICS.map((t, i) => ({ t, i, s: save.topics[t.id], r: topicRate(save.topics[t.id]) }));
  rows.sort((a, b) => (a.r === null ? 2 : a.r) - (b.r === null ? 2 : b.r));
  const tt = $("stats-topics");
  tt.innerHTML = "";
  tt.appendChild(headerRow(["題材", "正解率", "", "回数", ""]));
  rows.forEach(x => {
    const b = el("button", "練習");
    b.style.padding = "4px 10px";
    b.addEventListener("click", () => startRun("single", [x.i]));
    tt.appendChild(dataRow([x.t.name, x.r === null ? "―" : pct(x.r), x.r === null ? el("span", "未プレイ", "sub") : barEl(x.r), x.s ? String(x.s.plays) : "0", b]));
  });

  const missed = [];
  TOPICS.forEach(t => {
    const s = save.topics[t.id];
    if (s) Object.entries(s.missed).forEach(([name, n]) => missed.push({ name, n, topic: t.name }));
  });
  missed.sort((a, b) => b.n - a.n);
  const ml = $("stats-missed");
  ml.innerHTML = "";
  if (!missed.length) ml.appendChild(el("p", has ? "見逃しはありません。すばらしい！" : "―", "sub"));
  else {
    const ul = el("ul");
    missed.slice(0, 10).forEach(m => ul.appendChild(el("li", `${m.name}（${m.topic}）… ${m.n}回見逃し`)));
    ml.appendChild(ul);
  }
}

/* ---------------- 実績画面 ---------------- */
function renderAch() {
  const g = $("ach-grid");
  g.innerHTML = "";
  const n = Object.keys(save.achievements).length;
  $("ach-summary").textContent = `${n} / ${ACHIEVEMENTS.length} 個 解除済み`;
  ACHIEVEMENTS.forEach(a => {
    const got = save.achievements[a.id];
    const d = el("div", null, "ach" + (got ? "" : " locked"));
    const info = el("div");
    info.append(el("b", got ? a.name : "？？？"), el("small", a.desc + (got ? `（${got}）` : "")));
    d.append(el("div", a.icon, "ic"), info);
    g.appendChild(d);
  });
}

/* ---------------- イベント ---------------- */
$("btn-story").addEventListener("click", startStory);
$("btn-prologue-go").addEventListener("click", () => startRun("story", TOPICS.map((_, i) => i)));
$("btn-quick").addEventListener("click", startQuick);
$("btn-weak").addEventListener("click", startWeak);
$("btn-stats-weak").addEventListener("click", startWeak);
$("btn-select").addEventListener("click", () => show("s-select"));
$("btn-text").addEventListener("click", () => show("s-text"));
$("btn-glossary").addEventListener("click", () => { renderGlossary($("gl-search").value); show("s-glossary"); });
$("gl-search").addEventListener("input", (e) => renderGlossary(e.target.value));
$("btn-gquiz").addEventListener("click", startGQuiz);
$("btn-gq-next").addEventListener("click", nextGQ);
$("btn-gq-quit").addEventListener("click", () => show("s-glossary"));
$("btn-stats").addEventListener("click", () => { renderStats(); show("s-stats"); });
$("btn-final-stats").addEventListener("click", () => { renderStats(); show("s-stats"); });
$("btn-ach").addEventListener("click", () => { renderAch(); show("s-ach"); });
$("btn-reset").addEventListener("click", () => askConfirm("プレイ記録・実績・ベストスコアをすべて消します。よろしいですか？", "消す", () => {
  const keep = { diff: save.diff, sound: save.sound };
  save = Object.assign(defaultSave(), keep);
  persist();
  document.querySelectorAll("#text-toc a").forEach(a => a.classList.remove("read"));
  renderStats();
  toast("記録をリセットしました");
}));
$("btn-sound").addEventListener("click", () => { save.sound = !save.sound; persist(); renderTitle(); SFX.click(); });
$("btn-hint").addEventListener("click", useHint);
$("btn-quit").addEventListener("click", () => askConfirm("ミッションを中断してタイトルに戻りますか？", "中断する", goTitle));
$("btn-submit").addEventListener("click", () => submit(false));
$("btn-next").addEventListener("click", nextMission);
$("btn-retry").addEventListener("click", () => {
  if (run.mode === "story") startStory();
  else if (run.mode === "quick") startQuick();
  else if (run.mode === "weak") startWeak();
  else startRun("single", run.queue);
});
$("btn-review").addEventListener("click", () => openLessonModal(TOPICS.indexOf(M.topic)));
$("btn-text-top").addEventListener("click", () => window.scrollTo({ top: 0, behavior: "smooth" }));
$("btn-modal-close").addEventListener("click", () => $("modal").classList.remove("open"));
$("modal").addEventListener("click", (e) => { if (e.target.id === "modal") $("modal").classList.remove("open"); });
document.querySelectorAll("[data-back]").forEach(b => b.addEventListener("click", goTitle));

buildSelect();
buildText();
renderTitle();
