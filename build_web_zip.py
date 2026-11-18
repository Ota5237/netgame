"""Web 公開（PythonAnywhere）用のアップロード zip を作る。

使い方:  python build_web_zip.py
できあがり:  dist/netguardians_web.zip（中身は netguardians/ フォルダ）
セーブデータ（data/）や exe 用のファイルは入れない。
"""
import zipfile
from pathlib import Path

BASE = Path(__file__).resolve().parent
OUT = BASE / "dist" / "netguardians_web.zip"
FILES = ["app.py", "requirements.txt", "pythonanywhere_wsgi.py"]
DIRS = ["templates", "static"]
SKIP = {".ico"}  # exe 用のアイコンは不要


def main():
    OUT.parent.mkdir(exist_ok=True)
    count = 0
    with zipfile.ZipFile(OUT, "w", zipfile.ZIP_DEFLATED) as z:
        for name in FILES:
            z.write(BASE / name, f"netguardians/{name}")
            count += 1
        for d in DIRS:
            for path in sorted((BASE / d).rglob("*")):
                if path.is_file() and path.suffix not in SKIP and "__pycache__" not in path.parts:
                    z.write(path, "netguardians/" + path.relative_to(BASE).as_posix())
                    count += 1
    print(f"できました: {OUT}（{count} ファイル, {OUT.stat().st_size // 1024} KB）")


if __name__ == "__main__":
    main()
