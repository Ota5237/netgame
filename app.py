"""ネットガーディアンズ - Flask サーバー

起動:  python app.py  →  http://127.0.0.1:5050
Web 公開（PythonAnywhere など）では 環境変数 SERVER_SAVE=0 にして、セーブをブラウザ内だけにする。
"""
import json
import os
import sys
import tempfile
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


if __name__ == "__main__":
    # 5000番は他のアプリと重なりやすいので 5050 を既定にする（環境変数 PORT で変更可）
    app.run(debug=True, port=int(os.environ.get("PORT", 5050)))
