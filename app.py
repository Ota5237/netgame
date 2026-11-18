"""ネットガーディアンズ - Flask サーバー

起動:  python app.py  →  http://127.0.0.1:5050
Web 公開（PythonAnywhere など）では 環境変数 SERVER_SAVE=0 にして、セーブをブラウザ内だけにする。
"""
import json
import os
import re
import sqlite3
import sys
import tempfile
import threading
import time
from datetime import datetime, timedelta, timezone
from pathlib import Path

from flask import Flask, jsonify, render_template, request, send_from_directory

BASE_DIR = Path(__file__).resolve().parent
FROZEN = getattr(sys, "frozen", False)  # exe（PyInstaller）として動いているか

if FROZEN:
    # exe の中身は一時フォルダに展開される。セーブはユーザーの AppData に置く
    RES_DIR = Path(sys._MEIPASS)
    DEFAULT_SAVE = Path(os.environ.get("APPDATA", Path.home())) / "NetGuardians" / "save.json"
else:
    RES_DIR = BASE_DIR
    DEFAULT_SAVE = BASE_DIR / "data" / "save.json"

# 環境変数 GAME_SAVE で保存先を変えられる（テスト時に本番のセーブを触らないため）
SAVE_FILE = Path(os.environ.get("GAME_SAVE", DEFAULT_SAVE))
SAVE_VERSION = 2  # ネットガーディアンズのセーブ形式
# サーバーにセーブを置くか。Web 公開では 0 にする（セーブが1つしかないため、全員で上書きし合ってしまう）
SERVER_SAVE = os.environ.get("SERVER_SAVE", "1") != "0"
MAX_SAVE_BYTES = 200_000
# ランキング（エンドレス・デイリー）の保存先。サーバー保存をしない Web 版でも使う
RANKING_DB = Path(os.environ.get("RANKING_DB", DEFAULT_SAVE.with_name("ranking.db")))

app = Flask(__name__, template_folder=str(RES_DIR / "templates"), static_folder=str(RES_DIR / "static"))


def read_save():
    try:
        return json.loads(SAVE_FILE.read_text(encoding="utf-8"))
    except (FileNotFoundError, json.JSONDecodeError):
        return None


def write_save(data):
    SAVE_FILE.parent.mkdir(parents=True, exist_ok=True)
    # 旧ゲーム（タイプっこ育成日記）のセーブを上書きする前に、一度だけバックアップする
    old = read_save()
    if old is not None and old.get("v") != SAVE_VERSION and data.get("v") == SAVE_VERSION:
        backup = SAVE_FILE.with_name("save_v1_backup.json")
        if not backup.exists():
            backup.write_text(json.dumps(old, ensure_ascii=False), encoding="utf-8")
    # 書き込み途中で落ちても壊れないよう、一時ファイルに書いてから置き換える
    fd, tmp = tempfile.mkstemp(dir=SAVE_FILE.parent, suffix=".tmp")
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        json.dump(data, f, ensure_ascii=False)
    os.replace(tmp, SAVE_FILE)


@app.get("/")
def index():
    return render_template("index.html", server_save=SERVER_SAVE)


@app.get("/sw.js")
def service_worker():
    # Service Worker はサイト全体（/）を管理するため、ルート直下から配信する
    res = send_from_directory(app.static_folder, "sw.js", mimetype="text/javascript")
    res.headers["Cache-Control"] = "no-cache"
    return res


@app.get("/favicon.ico")
def favicon():
    return send_from_directory(app.static_folder, "icons/favicon-32.png", mimetype="image/png")


@app.before_request
def server_save_only():
    # Web 公開版では、セーブ API を使えないようにする
    if not SERVER_SAVE and request.path.startswith("/api/save"):
        return jsonify({"error": "server save is disabled"}), 404


@app.get("/api/save")
def get_save():
    return jsonify({"save": read_save()})


@app.post("/api/save")
def post_save():
    if request.content_length and request.content_length > MAX_SAVE_BYTES:
        return jsonify({"error": "too large"}), 413
    data = request.get_json(silent=True)
    if not isinstance(data, dict) or not isinstance(data.get("name"), str):
        return jsonify({"error": "invalid save"}), 400
    write_save(data)
    return jsonify({"ok": True})


@app.delete("/api/save")
def delete_save():
    SAVE_FILE.unlink(missing_ok=True)
    return jsonify({"ok": True})


# =========================================================
# ランキング
# =========================================================
MODE_RE = re.compile(r"^(endless|daily-\d{8})$")
_db_lock = threading.Lock()
_last_post = {}  # IP ごとの最後の登録時刻（連続登録を防ぐ）


def db():
    RANKING_DB.parent.mkdir(parents=True, exist_ok=True)
    con = sqlite3.connect(RANKING_DB)
    con.execute("""CREATE TABLE IF NOT EXISTS scores (
        id INTEGER PRIMARY KEY, mode TEXT NOT NULL, name TEXT NOT NULL, score INTEGER NOT NULL,
        wave INTEGER NOT NULL, kpm INTEGER NOT NULL, acc REAL NOT NULL, created TEXT NOT NULL)""")
    con.execute("CREATE INDEX IF NOT EXISTS idx_mode_score ON scores(mode, score DESC)")
    return con


def top_scores(con, mode, limit=10):
    # 同じ名前は いちばん良いスコアだけを出す
    rows = con.execute("""SELECT name, MAX(score) AS best FROM scores WHERE mode = ? GROUP BY name
        ORDER BY best DESC LIMIT ?""", (mode, limit)).fetchall()
    out = []
    for name, best in rows:
        wave, kpm, acc = con.execute("""SELECT wave, kpm, acc FROM scores WHERE mode = ? AND name = ? AND score = ?
            ORDER BY id LIMIT 1""", (mode, name, best)).fetchone()
        out.append({"name": name, "score": best, "wave": wave, "kpm": kpm, "acc": acc})
    return out


def valid_daily(mode):
    # デイリーは前後1日までの日付だけ受け付ける（タイムゾーンの差を考慮）
    if not mode.startswith("daily-"):
        return True
    today = datetime.now(timezone.utc).date()
    ok = {(today + timedelta(days=d)).strftime("%Y%m%d") for d in (-1, 0, 1)}
    return mode[6:] in ok


@app.get("/api/ranking")
def get_ranking():
    mode = request.args.get("mode", "endless")
    if not MODE_RE.match(mode):
        return jsonify({"error": "bad mode"}), 400
    with _db_lock, db() as con:
        return jsonify({"mode": mode, "top": top_scores(con, mode)})


@app.post("/api/ranking")
def post_ranking():
    data = request.get_json(silent=True) or {}
    mode = str(data.get("mode", ""))
    name = re.sub(r"[\x00-\x1f\x7f]", "", str(data.get("name", ""))).strip()[:12]
    try:
        score, wave, kpm = int(data.get("score")), int(data.get("wave")), int(data.get("kpm"))
        acc = float(data.get("acc"))
    except (TypeError, ValueError):
        return jsonify({"error": "invalid"}), 400
    if (not MODE_RE.match(mode) or not valid_daily(mode) or not name
            or not 0 <= score <= 5_000_000 or not 0 <= wave <= 999 or not 0 <= kpm <= 2000 or not 0 <= acc <= 100):
        return jsonify({"error": "invalid"}), 400
    ip = request.headers.get("X-Real-IP") or request.remote_addr or "?"
    now = time.time()
    if now - _last_post.get(ip, 0) < 5:
        return jsonify({"error": "too many requests"}), 429
    _last_post[ip] = now
    with _db_lock, db() as con:
        con.execute("INSERT INTO scores (mode, name, score, wave, kpm, acc, created) VALUES (?, ?, ?, ?, ?, ?, ?)",
                    (mode, name, score, wave, kpm, round(acc, 1), datetime.now(timezone.utc).isoformat()))
        rank = con.execute("""SELECT COUNT(*) FROM (SELECT name, MAX(score) AS best FROM scores WHERE mode = ?
            GROUP BY name) WHERE best > ?""", (mode, score)).fetchone()[0] + 1
        return jsonify({"ok": True, "rank": rank, "top": top_scores(con, mode)})


if __name__ == "__main__":
    # 5000番は他のアプリと重なりやすいので 5050 を既定にする（環境変数 PORT で変更可）
    app.run(debug=True, port=int(os.environ.get("PORT", 5050)))
