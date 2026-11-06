/* =========================================================
   ターミナル演習（疑似ターミナル）
   すべてブラウザの中のシミュレーション。本物のコマンドは実行されない。
   ========================================================= */
const TERM = { m: null, idx: 0, cwd: HOME, goal: 0, hints: 0, hist: [], histPos: 0, st: {}, done: false };

function termSave() {
  if (!save.terminal) save.terminal = {};
  return save.terminal;
}

/* ---------------- 仮想ファイルシステム ---------------- */
function normPath(p, cwd) {
  if (!p) return cwd;
  if (p === "~" || p.startsWith("~/")) p = HOME + p.slice(1);
  const parts = (p.startsWith("/") ? p : cwd + "/" + p).split("/");
  const out = [];
  parts.forEach(x => {
    if (!x || x === ".") return;
    if (x === "..") out.pop(); else out.push(x);
  });
  return "/" + out.join("/");
}
function getNode(path) {
  let n = TERM.m.fs;
  for (const part of path.split("/").filter(Boolean)) {
    if (n === null || typeof n !== "object" || !(part in n)) return undefined;
    n = n[part];
  }
  return n;
}
const isDir = (n) => n !== null && typeof n === "object";
const baseName = (p) => p.split("/").filter(Boolean).pop() || "/";
function walk(path, fn) {
  const n = getNode(path);
  fn(path, n);
  if (isDir(n)) Object.keys(n).sort().forEach(k => walk((path === "/" ? "" : path) + "/" + k, fn));
}
function globToRe(g) {
  return new RegExp("^" + g.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*").replace(/\?/g, ".") + "$");
}
function shortPath(p) {
  if (p === HOME) return "~";
  if (p.startsWith(HOME + "/")) return "~" + p.slice(HOME.length);
  return p;
}

/* ---------------- 字句解析（クォート・| ・&& ・; に対応） ---------------- */
function tokenize(line) {
  const toks = [];
  let cur = "", q = null, has = false;
  const push = () => { if (has) toks.push({ t: "w", v: cur }); cur = ""; has = false; };
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (q) { if (ch === q) q = null; else cur += ch; continue; }
    if (ch === '"' || ch === "'") { q = ch; has = true; continue; }
    if (/\s/.test(ch)) { push(); continue; }
    if (ch === "|" ) { push(); toks.push({ t: "op", v: "|" }); continue; }
    if (ch === ";") { push(); toks.push({ t: "op", v: ";" }); continue; }
    if (ch === "&" && line[i + 1] === "&") { push(); toks.push({ t: "op", v: "&&" }); i++; continue; }
    cur += ch; has = true;
  }
  push();
  return toks;
}

/* ---------------- 出力 ---------------- */
function termPrint(text, cls) {
  const out = $("term-out");
  String(text).split("\n").forEach(line => {
    out.appendChild(el("div", line === "" ? " " : line, cls ? "tl " + cls : "tl"));
  });
  out.scrollTop = out.scrollHeight;
}
function promptText() {
  return `whitehat@${TERM.m.host}:${shortPath(TERM.cwd)}$ `;
}

/* ---------------- コマンド ---------------- */
function splitOpts(args) {
  const flags = new Set(), rest = [];
  args.forEach(a => {
    if (/^-[a-zA-Z]+$/.test(a)) a.slice(1).split("").forEach(f => flags.add(f));
    else rest.push(a);
  });
  return { flags, rest };
}
function readFiles(files, stdin, cmdName) {
  if (!files.length) return { text: stdin || "", err: stdin === null ? `${cmdName}: ファイル名を指定してください` : "" };
  const texts = [], errs = [];
  files.forEach(f => {
    const n = getNode(normPath(f, TERM.cwd));
    if (n === undefined) errs.push(`${cmdName}: ${f}: そのようなファイルやディレクトリはありません`);
    else if (isDir(n)) errs.push(`${cmdName}: ${f}: ディレクトリです`);
    else texts.push(n);
  });
  return { text: texts.join("\n"), err: errs.join("\n") };
}
function lineCount(n) { return n === undefined ? 10 : n; }
function parseN(args) {
  let n, files = [];
  for (let i = 0; i < args.length; i++) {
    if (args[i] === "-n") { n = parseInt(args[++i], 10); }
    else if (/^-\d+$/.test(args[i])) n = parseInt(args[i].slice(1), 10);
    else files.push(args[i]);
  }
  return { n: lineCount(n), files };
}

const MAN = {
  ls: "ls [-a] [-l] [フォルダ]\n  フォルダの中身を表示する。-a で隠しファイルも、-l で詳しく表示。",
  cd: "cd [フォルダ]\n  フォルダを移動する。cd .. で1つ上、cd だけでホームへ。",
  pwd: "pwd\n  今いる場所（フォルダ）を表示する。",
  cat: "cat ファイル\n  ファイルの中身を表示する。",
  head: "head [-n 行数] ファイル\n  ファイルの最初の部分（初期値10行）を表示する。",
  tail: "tail [-n 行数] ファイル\n  ファイルの最後の部分（初期値10行）を表示する。",
  grep: "grep [-i] [-n] [-c] [-v] [-r] 文字 [ファイル]\n  文字を含む行を表示する。\n  -i 大文字小文字を区別しない / -n 行番号 / -c 件数 / -v 含まない行 / -r フォルダ内を全部検索",
  wc: "wc [-l] [ファイル]\n  行数などを数える。-l で行数だけ。",
  sort: "sort [-r] [-n]\n  行を並べ替える。-r で逆順、-n で数字として並べる。",
  uniq: "uniq [-c]\n  となり合った同じ行をまとめる。-c で回数も表示。sort と組み合わせて使う。",
  find: "find [場所] -name 名前\n  ファイルを探す。名前には * （何でも）が使える。",
  ping: "ping ホスト\n  相手のコンピューターが応答するか確認する。",
  nmap: "nmap [-sV] ホスト\n  開いているポートを調べる（ポートスキャン）。-sV でバージョンも表示。\n  ※ 許可なく他人のコンピューターに使ってはいけない。",
  curl: "curl URL\n  Webページなどを取得して表示する。",
  git: "git log / git show コミット番号\n  Gitの変更履歴を表示する。",
  submit: "submit 答え\n  見つけた答えを報告する。",
  hint: "hint\n  今の目標のヒントを表示する（使った回数は記録される）。",
  echo: "echo 文字\n  文字をそのまま表示する。",
  whoami: "whoami\n  今のユーザー名を表示する。",
  clear: "clear\n  画面をきれいにする。",
  history: "history\n  これまでに入力したコマンドを表示する。",
};

function runCmd(cmd, args, stdin) {
  const m = TERM.m;
  const { flags, rest } = splitOpts(args);
  const ctx = { cmd, args, flags, paths: rest.map(a => normPath(a, TERM.cwd)), cwd: TERM.cwd, target: null };
  let out = "", err = "";

  switch (cmd) {
    case "help": {
      out = "使えるコマンド：\n" + COMMAND_HELP.map(h => `  ${h.cmd.padEnd(14)} ${h.desc}`).join("\n") + "\n\nくわしくは「man コマンド名」。↑↓キーで過去のコマンド、Tabキーでファイル名を補完。";
      break;
    }
    case "man": out = MAN[args[0]] || (args[0] ? `${args[0]} の説明はありません` : "使い方: man コマンド名"); break;
    case "pwd": out = TERM.cwd; break;
    case "whoami": out = "whitehat"; break;
    case "hostname": out = m.host; break;
    case "echo": out = args.join(" "); break;
    case "date": out = new Date().toLocaleString("ja-JP"); break;
    case "history": out = TERM.hist.map((h, i) => `  ${String(i + 1).padStart(3)}  ${h}`).join("\n"); break;
    case "clear": $("term-out").innerHTML = ""; break;
    case "ls": {
      const p = ctx.paths[0] || TERM.cwd;
      ctx.target = p;
      const n = getNode(p);
      if (n === undefined) { err = `ls: ${rest[0]}: そのようなファイルやディレクトリはありません`; break; }
      if (!isDir(n)) { out = rest[0]; break; }
      let names = Object.keys(n).sort();
      if (!flags.has("a")) names = names.filter(x => !x.startsWith("."));
      else names = [".", ".."].concat(names);
      if (flags.has("l")) {
        out = names.map(x => {
          const c = x === "." || x === ".." ? {} : n[x];
          const d = isDir(c);
          const size = d ? 4096 : new Blob([c]).size;
          return `${d ? "drwxr-xr-x" : "-rw-r--r--"} 1 whitehat whitehat ${String(size).padStart(6)} Nov  6 09:00 ${x}${d && x !== "." && x !== ".." ? "/" : ""}`;
        }).join("\n");
      } else {
        out = names.map(x => (x !== "." && x !== ".." && isDir(n[x])) ? x + "/" : x).join("  ");
      }
      break;
    }
    case "cd": {
      const p = ctx.paths[0] || HOME;
      const n = getNode(p);
      if (n === undefined) err = `cd: ${rest[0]}: そのようなファイルやディレクトリはありません`;
      else if (!isDir(n)) err = `cd: ${rest[0]}: ディレクトリではありません`;
      else TERM.cwd = p;
      ctx.target = TERM.cwd;
      break;
    }
    case "cat": {
      const r = readFiles(rest, stdin, "cat");
      out = r.text; err = r.err;
      break;
    }
    case "head": case "tail": {
      const { n, files } = parseN(args);
      ctx.paths = files.map(a => normPath(a, TERM.cwd));
      const r = readFiles(files, stdin, cmd);
      const lines = r.text.split("\n");
      out = (cmd === "head" ? lines.slice(0, n) : lines.slice(-n)).join("\n");
      err = r.err;
      break;
    }
    case "grep": {
      if (!rest.length) { err = "使い方: grep [-i -n -c -v -r] 文字 [ファイル]"; break; }
      const pat = rest[0];
      const files = rest.slice(1);
      const test = (line) => {
        const hit = flags.has("i") ? line.toLowerCase().includes(pat.toLowerCase()) : line.includes(pat);
        return flags.has("v") ? !hit : hit;
      };
      const results = [];
      const scan = (text, label) => {
        const lines = text.split("\n");
        let count = 0;
        lines.forEach((line, i) => {
          if (!test(line)) return;
          count++;
          if (!flags.has("c")) results.push((label ? label + ":" : "") + (flags.has("n") ? (i + 1) + ":" : "") + line);
        });
        if (flags.has("c")) results.push((label ? label + ":" : "") + count);
      };
      if (flags.has("r")) {
        const roots = files.length ? files : ["."];
        roots.forEach(f => {
          const root = normPath(f, TERM.cwd);
          if (getNode(root) === undefined) { err = `grep: ${f}: そのようなファイルやディレクトリはありません`; return; }
          walk(root, (p, n) => {
            if (isDir(n)) return;
            const rel = f === "." ? "." + p.slice(TERM.cwd === "/" ? 0 : TERM.cwd.length) : (f.replace(/\/$/, "") + p.slice(root.length));
            scan(n, rel);
          });
        });
      } else if (files.length) {
        files.forEach(f => {
          const n = getNode(normPath(f, TERM.cwd));
          if (n === undefined) err = `grep: ${f}: そのようなファイルやディレクトリはありません`;
          else if (isDir(n)) err = `grep: ${f}: ディレクトリです（フォルダの中を探すなら -r を付けよう）`;
          else scan(n, files.length > 1 ? f : "");
        });
      } else if (stdin !== null) {
        scan(stdin, "");
      } else {
        err = "grep: 探すファイルを指定してください（例：grep 401 access.log）";
      }
      out = results.join("\n");
      break;
    }
    case "wc": {
      const r = readFiles(rest, stdin, "wc");
      err = r.err;
      const text = r.text;
      const lines = text === "" ? 0 : text.split("\n").length;
      out = flags.has("l") ? String(lines) : `${lines} ${text.split(/\s+/).filter(Boolean).length} ${text.length}`;
      break;
    }
    case "sort": {
      const r = readFiles(rest, stdin, "sort");
      err = r.err;
      let lines = r.text.split("\n");
      lines.sort(flags.has("n") ? (a, b) => parseFloat(a) - parseFloat(b) : undefined);
      if (flags.has("r")) lines.reverse();
      out = lines.join("\n");
      break;
    }
    case "uniq": {
      const r = readFiles(rest, stdin, "uniq");
      err = r.err;
      const res = [];
      r.text.split("\n").forEach(line => {
        const last = res[res.length - 1];
        if (last && last.line === line) last.n++; else res.push({ line, n: 1 });
      });
      out = res.map(x => flags.has("c") ? `${String(x.n).padStart(7)} ${x.line}` : x.line).join("\n");
      break;
    }
    case "find": {
      let start = ".", name = null, type = null;
      for (let i = 0; i < args.length; i++) {
        if (args[i] === "-name") name = args[++i];
        else if (args[i] === "-type") type = args[++i];
        else if (!args[i].startsWith("-") && i === 0) start = args[i];
      }
      const root = normPath(start, TERM.cwd);
      if (getNode(root) === undefined) { err = `find: '${start}': そのようなファイルやディレクトリはありません`; break; }
      const re = name ? globToRe(name) : null;
      const res = [];
      walk(root, (p, n) => {
        if (re && !re.test(baseName(p))) return;
        if (type === "f" && isDir(n)) return;
        if (type === "d" && !isDir(n)) return;
        const shown = start === "/" ? p : start.replace(/\/$/, "") + p.slice(root.length);
        res.push(shown || start);
      });
      out = res.join("\n");
      break;
    }
    case "ping": case "nmap": case "curl": {
      const hostArg = rest.find(a => /\d+\.\d+\.\d+\.\d+/.test(a) || a.includes("://") || /[a-z]\.[a-z]/i.test(a));
      if (!hostArg) { err = `使い方: ${MAN[cmd].split("\n")[0]}`; break; }
      const ip = (hostArg.match(/\d+\.\d+\.\d+\.\d+/) || [hostArg.replace(/^https?:\/\//, "").split("/")[0]])[0];
      if (!m.net) { err = `${cmd}: このミッションでは外部のコンピューターは調べません`; break; }
      if (!(m.scope || []).includes(ip)) {
        err = `⚠ ${ip} は診断の許可をもらっていない相手です。\n  ホワイトハッカーは、許可された範囲（${(m.scope || []).join(", ")}）だけを調べます。`;
        break;
      }
      const host = m.net[ip];
      if (cmd === "ping") {
        out = `PING ${ip} 56(84) bytes of data.\n` + [12, 9, 11, 10].map((t, i) => `64 bytes from ${ip}: icmp_seq=${i + 1} ttl=64 time=${t}.${i}ms`).join("\n") + `\n--- ${ip} ping statistics ---\n4 packets transmitted, 4 received, 0% packet loss`;
      } else if (cmd === "nmap") {
        const v = flags.has("V") || args.includes("-sV");
        out = `Starting Nmap ( シミュレーション ) at 2026-11-06\nNmap scan report for ${host.name} (${ip})\nHost is up (0.010s latency).\nPORT      STATE SERVICE${v ? "   VERSION" : ""}\n` +
          host.ports.map(p => `${(p.port + "/tcp").padEnd(9)} open  ${p.service.padEnd(8)}${v ? " " + p.version : ""}`).join("\n") +
          `\n\nNmap done: 1 IP address (1 host up) scanned`;
      } else {
        let path = "/";
        const mm = hostArg.match(/^(?:https?:\/\/)?[^/]+(\/.*)?$/);
        if (mm && mm[1]) path = mm[1];
        const page = host.web[path] !== undefined ? host.web[path] : host.web[path + "/"];
        out = page !== undefined ? page : "<h1>404 Not Found</h1>";
      }
      break;
    }
    case "git": {
      const g = m.git;
      if (!g || !(TERM.cwd === g.root || TERM.cwd.startsWith(g.root + "/"))) { err = "fatal: not a git repository（Gitで管理されたフォルダの中で使おう）"; break; }
      if (args[0] === "log") {
        out = args.includes("--oneline")
          ? g.log.map(c => `${c.hash} ${c.msg}`).join("\n")
          : g.log.map(c => `commit ${c.hash}\nAuthor: dev <dev@club-app.example>\nDate:   ${c.date}\n\n    ${c.msg}\n`).join("\n");
      } else if (args[0] === "show") {
        const h = args[1];
        const key = h && Object.keys(g.show).find(k => k.startsWith(h) && h.length >= 4);
        if (!h) err = "使い方: git show コミット番号";
        else if (!key) err = `fatal: bad object ${h}`;
        else out = `commit ${key}\n\n` + g.show[key];
      } else if (args[0] === "status") {
        out = "On branch main\nnothing to commit, working tree clean";
      } else {
        err = "このシミュレーターで使える git コマンド： git log / git log --oneline / git show コミット番号 / git status";
      }
      break;
    }
    case "rm": {
      err = "⚠ このシミュレーターではファイルを消せません。\n  インシデント対応中は、怪しいファイルも「証拠」なのですぐに消してはいけません。";
      break;
    }
    case "sudo": err = "⚠ sudo（管理者権限での実行）はこのシミュレーターでは使えません。"; break;
    case "ssh": case "telnet": case "wget": case "chmod": case "mkdir": case "touch": case "vi": case "vim": case "nano":
      err = `${cmd}: このシミュレーターでは使えないコマンドです（help で使えるコマンドを確認）`; break;
    default:
      if (m.custom && m.custom[cmd]) out = m.custom[cmd](args, TERM.st);
      else err = `${cmd}: コマンドが見つかりません（help で使えるコマンドを確認）`;
  }
  return { out, err, ctx };
}

/* ---------------- 実行 ---------------- */
function execLine(line) {
  termPrint(promptText() + line, "cmdline");
  const trimmed = line.trim();
  if (!trimmed) return;
  TERM.hist.push(trimmed);
  TERM.histPos = TERM.hist.length;

  const toks = tokenize(trimmed);
  if (!toks.length) return;
  const first = toks[0];
  if (first.t === "w" && first.v === "submit") { submitAnswer(toks.slice(1).map(t => t.v).join(" ")); return; }
  if (first.t === "w" && first.v === "hint") { showTermHint(); return; }
  if (first.t === "w" && first.v === "exit") { termPrint("ログアウトします…"); setTimeout(openTermSelect, 400); return; }

  // ; と && で区切った各コマンド列（パイプライン）を順に実行
  const lists = [];
  let cur = [[]], sep = null;
  toks.forEach(t => {
    if (t.t === "op" && t.v === "|") cur.push([]);
    else if (t.t === "op") { lists.push({ pipe: cur, sep }); cur = [[]]; sep = t.v; }
    else cur[cur.length - 1].push(t.v);
  });
  lists.push({ pipe: cur, sep });

  let lastOk = true;
  for (const { pipe, sep: s } of lists) {
    if (s === "&&" && !lastOk) break;
    let stdin = null, ok = true;
    const ctxs = [];
    for (let i = 0; i < pipe.length; i++) {
      const words = pipe[i];
      if (!words.length) { termPrint("構文エラー：| の前後にコマンドがありません", "err"); ok = false; break; }
      const r = runCmd(words[0], words.slice(1), stdin);
      if (r.err) { termPrint(r.err, "err"); ok = false; }
      ctxs.push(r.ctx);
      if (i === pipe.length - 1) { if (r.out !== "") termPrint(r.out); }
      else stdin = r.out;
    }
    // 結果を表示してから、目標を達成したかを判定する
    ctxs.forEach(checkCmdGoal);
    lastOk = ok;
  }
  renderTermGoals();
}

/* ---------------- 目標 ---------------- */
const normAns = (s) => String(s).trim().replace(/^["'「]|["'」]$/g, "").trim().toLowerCase();

function completeGoal() {
  const g = TERM.m.goals[TERM.goal];
  SFX.good();
  termPrint(`✔ 目標${TERM.goal + 1} 達成！ ${g.explain}`, "ok");
  TERM.goal++;
  if (TERM.goal >= TERM.m.goals.length) finishTerm();
  else termPrint(`▶ 次の目標：${TERM.m.goals[TERM.goal].text}`, "goal");
}
function checkCmdGoal(ctx) {
  if (TERM.done) return;
  // 1つのコマンドで続けて達成できる目標はまとめて達成
  while (!TERM.done) {
    const g = TERM.m.goals[TERM.goal];
    if (g.type !== "cmd") return;
    let ok = false;
    try { ok = g.test(ctx); } catch (e) { ok = false; }
    if (!ok) return;
    completeGoal();
  }
}
function submitAnswer(ans) {
  if (TERM.done) { termPrint("このミッションはクリア済みです。"); return; }
  if (!ans) { termPrint("使い方: submit 答え（例：submit 203.0.113.77）", "err"); return; }
  const g = TERM.m.goals[TERM.goal];
  if (g.type !== "answer") { termPrint("今の目標は、コマンドを実行することです（hint でヒント）。", "err"); return; }
  if (g.answers.some(a => normAns(a) === normAns(ans))) completeGoal();
  else { SFX.bad(); termPrint(`✘ 「${ans}」はちがうようです。もう一度調べてみよう（hint でヒント）。`, "err"); }
  renderTermGoals();
}
function showTermHint() {
  if (TERM.done) return;
  TERM.hints++;
  termPrint("💡 ヒント：" + TERM.m.goals[TERM.goal].hint, "hint");
  renderTermGoals();
}

function renderTermGoals() {
  const box = $("term-goals");
  box.innerHTML = "";
  TERM.m.goals.forEach((g, i) => {
    const state = i < TERM.goal ? "done" : i === TERM.goal && !TERM.done ? "now" : "todo";
    const li = el("li", null, state);
    li.textContent = (state === "done" ? "✔ " : state === "now" ? "▶ " : "・ ") + (i <= TERM.goal || TERM.done ? g.text : "？？？（前の目標をクリアすると表示）");
    box.appendChild(li);
  });
  $("term-progress").textContent = `${Math.min(TERM.goal, TERM.m.goals.length)} / ${TERM.m.goals.length}　ヒント使用 ${TERM.hints}回`;
}

function finishTerm() {
  TERM.done = true;
  const stars = TERM.hints === 0 ? 3 : TERM.hints <= 2 ? 2 : 1;
  const ts = termSave();
  const prev = ts[TERM.m.id];
  ts[TERM.m.id] = { cleared: true, stars: Math.max(stars, prev ? prev.stars : 0) };
  persist();
  SFX.fanfare();
  termPrint("", "");
  termPrint(`★ MISSION COMPLETE ★　評価：${"★".repeat(stars)}${"☆".repeat(3 - stars)}`, "ok");
  termPrint(TERM.m.summary, "goal");
  unlock("term_first");
  if (TERM.hints === 0) unlock("term_nohint");
  if (TERMINAL_MISSIONS.every(x => ts[x.id] && ts[x.id].cleared)) unlock("term_all");
  const c = $("term-clear");
  c.style.display = "";
  $("term-clear-stars").textContent = "★".repeat(stars) + "☆".repeat(3 - stars);
  $("term-clear-text").textContent = TERM.m.summary;
  const next = TERMINAL_MISSIONS[TERM.idx + 1];
  $("btn-term-next").style.display = next ? "" : "none";
  renderTermGoals();
}

/* ---------------- 画面 ---------------- */
function openTermSelect() {
  const list = $("term-list");
  list.innerHTML = "";
  const ts = termSave();
  TERMINAL_MISSIONS.forEach((m, i) => {
    const s = ts[m.id];
    const b = el("button");
    b.append(
      el("b", `${i + 1}. ${m.title}`),
      el("small", `【${m.level}】 学べるコマンド：${m.learn}`),
      el("small", s && s.cleared ? `クリア済み ${"★".repeat(s.stars)}${"☆".repeat(3 - s.stars)}` : "未クリア")
    );
    b.addEventListener("click", () => startTerm(i));
    list.appendChild(b);
  });
  const cl = $("cmd-list");
  if (!cl.childElementCount) {
    COMMAND_HELP.forEach(h => {
      const d = el("div", null, "cmd-item");
      d.append(el("b", h.cmd), el("span", h.desc), el("code", h.ex));
      cl.appendChild(d);
    });
  }
  show("s-term-select");
}

function startTerm(i) {
  stopTimer();
  TERM.idx = i;
  TERM.m = TERMINAL_MISSIONS[i];
  TERM.cwd = HOME;
  TERM.goal = 0;
  TERM.hints = 0;
  TERM.hist = [];
  TERM.histPos = 0;
  TERM.st = {};
  TERM.done = false;
  $("term-title").textContent = `TERMINAL ${i + 1}：${TERM.m.title}`;
  $("term-story").textContent = TERM.m.story;
  $("term-clear").style.display = "none";
  $("term-out").innerHTML = "";
  const chips = $("term-chips");
  chips.innerHTML = "";
  TERM.m.chips.forEach(c => {
    const b = el("button", c.trim());
    b.addEventListener("click", () => {
      const inp = $("term-input");
      const v = inp.value;
      inp.value = c.startsWith("|") ? v.replace(/\s*$/, " ") + c + " " : (v && !v.endsWith(" ") ? v + " " : v) + c;
      inp.focus();
    });
    chips.appendChild(b);
  });
  termPrint("========================================================", "dim");
  termPrint(` ${TERM.m.host} に接続しました（シミュレーション）`, "dim");
  termPrint(" 本物のコンピューターには一切つながっていません。", "dim");
  termPrint(" help でコマンド一覧、hint でヒントを表示できます。", "dim");
  termPrint("========================================================", "dim");
  termPrint(`▶ 目標：${TERM.m.goals[0].text}`, "goal");
  renderTermGoals();
  updatePrompt();
  show("s-term");
  setTimeout(() => $("term-input").focus(), 50);
}

function updatePrompt() {
  $("term-prompt").textContent = promptText();
}

/* Tab補完：最後の単語を、フォルダの中のファイル名で補う */
function complete() {
  const inp = $("term-input");
  const v = inp.value;
  const m = v.match(/(\S*)$/);
  const word = m ? m[1] : "";
  const slash = word.lastIndexOf("/");
  const dirPart = slash >= 0 ? word.slice(0, slash + 1) : "";
  const prefix = slash >= 0 ? word.slice(slash + 1) : word;
  const dir = getNode(normPath(dirPart || ".", TERM.cwd));
  if (!isDir(dir)) return;
  const cands = Object.keys(dir).filter(k => k.startsWith(prefix) && (prefix.startsWith(".") || !k.startsWith(".")));
  if (cands.length === 1) {
    const k = cands[0];
    inp.value = v.slice(0, v.length - word.length) + dirPart + k + (isDir(dir[k]) ? "/" : " ");
  } else if (cands.length > 1) {
    termPrint(promptText() + v, "cmdline");
    termPrint(cands.map(k => isDir(dir[k]) ? k + "/" : k).join("  "));
  }
}

$("term-form").addEventListener("submit", (e) => {
  e.preventDefault();
  const inp = $("term-input");
  const line = inp.value;
  inp.value = "";
  execLine(line);
  updatePrompt();
});
$("term-input").addEventListener("keydown", (e) => {
  if (e.key === "Tab") { e.preventDefault(); complete(); }
  else if (e.key === "ArrowUp") {
    e.preventDefault();
    if (TERM.histPos > 0) { TERM.histPos--; e.target.value = TERM.hist[TERM.histPos]; }
  } else if (e.key === "ArrowDown") {
    e.preventDefault();
    if (TERM.histPos < TERM.hist.length - 1) { TERM.histPos++; e.target.value = TERM.hist[TERM.histPos]; }
    else { TERM.histPos = TERM.hist.length; e.target.value = ""; }
  } else if (e.key === "l" && e.ctrlKey) { e.preventDefault(); $("term-out").innerHTML = ""; }
});
$("term-out").addEventListener("click", () => { if (!window.getSelection().toString()) $("term-input").focus(); });
$("btn-terminal").addEventListener("click", openTermSelect);
$("btn-term-back").addEventListener("click", openTermSelect);
$("btn-term-hint").addEventListener("click", () => { execLine("hint"); updatePrompt(); });
$("btn-term-next").addEventListener("click", () => startTerm(TERM.idx + 1));
$("btn-term-list").addEventListener("click", openTermSelect);
