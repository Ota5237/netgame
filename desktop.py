"""ネットガーディアンズ - Windows アプリ版の起動スクリプト

ゲーム用の Flask サーバーを裏で動かし、専用ウィンドウ（WebView2）で表示する。
開発中に試す:  python desktop.py
exe を作る:    build_exe.bat
"""
import ctypes
import json
import os
import socket
import threading
import webbrowser

from werkzeug.serving import make_server

from app import app, write_save

TITLE = "ネットガーディアンズ"


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


def message(text):
    ctypes.windll.user32.MessageBoxW(0, text, TITLE, 0x40)


def main():
    port = int(os.environ.get("GAME_PORT", 0)) or free_port()
    server = make_server("127.0.0.1", port, app, threaded=True)
    threading.Thread(target=server.serve_forever, daemon=True).start()
    url = f"http://127.0.0.1:{port}/"

    try:
        import webview
    except ImportError:
        webview = None

    if webview is None:
        open_in_browser(url, server)
        return

    window = webview.create_window(
        TITLE, url, width=1180, height=860, min_size=(820, 640), background_color="#070b17",
    )

    # 閉じる直前の進行を確実に保存する（ブラウザ側の自動保存が間に合わない場合に備える）。
    # closing の中で evaluate_js を呼ぶと画面の処理と待ち合って固まるため、
    # いったん閉じるのを止め、別スレッドで保存してから閉じ直す。
    flushed = threading.Event()

    def grab_and_save():
        try:
            data = window.evaluate_js("window.__gameState ? window.__gameState() : null")
            if data:
                save = json.loads(data)
                if isinstance(save, dict) and isinstance(save.get("name"), str):
                    write_save(save)
        except Exception:
            pass

    def flush_then_close():
        worker = threading.Thread(target=grab_and_save, daemon=True)
        worker.start()
        worker.join(timeout=2)  # 応答がなくても 2 秒で閉じる
        flushed.set()
        window.destroy()

    def on_closing():
        if flushed.is_set():
            return True
        threading.Thread(target=flush_then_close, daemon=True).start()
        return False

    window.events.closing += on_closing
    try:
        webview.start()
    except Exception:
        # WebView2 が使えない PC では、いつものブラウザで開く
        open_in_browser(url, server)


def open_in_browser(url, server):
    webbrowser.open(url)
    message("ブラウザでゲームを開きました。\n\nあそび終わったら「OK」を押してください（ゲームが終了します）。")
    server.shutdown()


if __name__ == "__main__":
    main()
