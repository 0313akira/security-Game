#!/bin/sh
# src/ のファイルを1つの index.html にまとめる（ダウンロードしてそのまま遊べるように）
cd "$(dirname "$0")"
python3 - <<'PY'
t = open("src/template.html", encoding="utf-8").read()
for key, path in (("/*STYLE*/", "src/style.css"), ("/*DATA*/", "src/data.js"), ("/*APP*/", "src/app.js"), ("/*TDATA*/", "src/terminal-data.js"), ("/*TERM*/", "src/terminal.js")):
    src = open(path, encoding="utf-8").read().rstrip("\n")
    if path.endswith(".js"):
        src = src.replace("</script", "<\\/script")  # 文字列中の </script> でタグが閉じないように
    t = t.replace(key, src)
open("index.html", "w", encoding="utf-8").write(t)
print("index.html を作成しました")
PY
