@echo off
rem ネットガーディアンズ：Windows アプリ（exe）を作る
rem できあがり → dist\NetGuardians.exe
chcp 65001 > nul
cd /d "%~dp0"

if not exist .venv-build (
  echo [1/3] ビルド用の Python 環境を作っています...
  python -m venv .venv-build || goto :error
  .venv-build\Scripts\python -m pip install -q -r requirements-build.txt || goto :error
)

echo [2/3] アイコンを作っています...
.venv-build\Scripts\python -c "from PIL import Image; Image.open('static/icons/icon-512.png').save('static/icons/app.ico', sizes=[(16,16),(24,24),(32,32),(48,48),(64,64),(128,128),(256,256)])" || goto :error

echo [3/3] exe を作っています（1〜2分かかります）...
.venv-build\Scripts\pyinstaller --noconfirm --clean --log-level WARN ^
  --onefile --windowed --name NetGuardians ^
  --icon static\icons\app.ico ^
  --add-data "templates;templates" --add-data "static;static" ^
  desktop.py || goto :error

echo.
echo できました: dist\NetGuardians.exe
exit /b 0

:error
echo.
echo エラーで止まりました。上のメッセージを確認してください。
exit /b 1
