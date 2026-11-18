# ネットガーディアンズを PythonAnywhere で公開する手順（GitHub 連携）

公開すると `https://ユーザー名.pythonanywhere.com` で誰でも遊べます。
Web 版のセーブは **各プレイヤーのブラウザの中だけ** に保存されます（サーバーには保存しません）。

流れ：**自分のPCで編集 → GitHub に push → PythonAnywhere で git pull → Reload**

---

## 1. GitHub にリポジトリを作って push する（最初の1回）

1. https://github.com/new で新しいリポジトリを作る
   - Repository name：例 `net-guardians`
   - **Public** を選ぶ
   - 「Add a README」などのチェックは **すべて外す**（中身は空で作る）
2. 自分のPCで、プロジェクトのフォルダから push する：

```bash
git remote add origin https://github.com/GitHubのユーザー名/net-guardians.git
git push -u origin main
```

初回はブラウザで GitHub へのログインを求められます。

## 2. PythonAnywhere のアカウントを作る

1. https://www.pythonanywhere.com/ で **Beginner（無料）** アカウントを作る
2. ここで決めたユーザー名が URL になります（例：`shiro` → `shiro.pythonanywhere.com`）

## 3. GitHub からコードを取り込む

**Consoles** → **Bash** を開いて実行：

```bash
git clone https://github.com/GitHubのユーザー名/net-guardians.git netguardians
ls netguardians        # app.py, static, templates などが見えればOK
```

## 4. Flask を入れる

同じ Bash コンソールで実行（`3.11` は、手順5で選ぶ Python のバージョンに合わせる）：

```bash
pip3.11 install --user "Flask>=3.0"
```

## 5. Web アプリを作る

1. **Web** タブ → **Add a new web app** → Next
2. **Manual configuration**（※「Flask」ではなく Manual）を選ぶ
3. Python のバージョンは手順4と同じもの（例：Python 3.11）を選ぶ

## 6. WSGI ファイルを設定する

1. Web タブの **Code** 欄にある「WSGI configuration file」のリンク（`/var/www/ユーザー名_pythonanywhere_com_wsgi.py`）を開く
2. 中身を **全部消して**、リポジトリの `pythonanywhere_wsgi.py` の中身を貼り付ける
3. `YOUR_USERNAME` を自分の **PythonAnywhere の** ユーザー名に書き換えて **Save**

## 7. 静的ファイルと HTTPS の設定

Web タブで：

- **Static files** に1行追加
  - URL：`/static/`
  - Directory：`/home/ユーザー名/netguardians/static/`
- **Security** の **Force HTTPS** を ON（アプリとしてインストールする機能に HTTPS が必要）

## 8. 公開！

Web タブ上部の緑の **Reload** ボタンを押して、`https://ユーザー名.pythonanywhere.com` を開く。
タイトル画面が出れば完成です。うまく表示されないときは、Web タブの **Error log** を見ると原因が分かります。

---

## 更新するとき（2回目から）

1. 自分のPCで変更をコミットして push：

```bash
git add -A
git commit -m "変更の内容"
git push
```

2. PythonAnywhere の Bash コンソールで取り込む：

```bash
cd ~/netguardians && git pull
```

3. Web タブで **Reload**

※ `static/sw.js` の `VERSION` を上げておくと、プレイヤー側の古いキャッシュが確実に入れ替わります。

## 無料アカウントの注意

- **3か月ごと** に Web タブの「Run until 3 months from today」ボタンを押さないと、公開が止まります（登録メールにお知らせが届きます）
- 公開できる Web アプリは1つ、URL は `ユーザー名.pythonanywhere.com` 固定です

## （予備）GitHub を使わずに zip でアップロードする場合

`python build_web_zip.py` で `dist/netguardians_web.zip` を作り、Files でアップロードして Bash で `unzip -o netguardians_web.zip`。以降は手順4から同じです。
