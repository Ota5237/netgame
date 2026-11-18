# ネットガーディアンズ（NET GUARDIANS）

コードを打って仮想世界《ネオグリッド》を守る、タイピング・サイバーディフェンスゲームです。

- マップのノードを `cd /forest/b2` のようなコマンドで進む
- リアルタイムバトルで、飛んでくる攻撃パケットを打って防ぎ、弱点コードを打って反撃
- AIエージェントの仲間をリクルート（ガチャ）で集め、5人のチームで戦う
- はじめての人向けのチュートリアル付き
- 苦手キーの分析と特訓、打鍵/分・正確率の成長グラフ
- 難易度（やさしい／ふつう／ハード）、エンドレスモード、デイリーチャレンジ、ランキング
- ボス戦前の会話とエンディング、その場で演奏する BGM（音量設定つき）

## 遊び方（自分のPCで）

```bash
pip install -r requirements.txt
python app.py
```

ブラウザで http://127.0.0.1:5050 を開きます。

## 構成

| ファイル | 内容 |
|---|---|
| `app.py` | Flask サーバー（画面の配信・セーブ API） |
| `templates/index.html` | 画面 |
| `static/js/core.js` | 共通（セーブ・効果音・画面切り替え・設定） |
| `static/js/story.js` / `tutorial.js` | オープニング・ボス会話・エンディング／チュートリアル |
| `static/js/hub.js` / `map.js` / `battle.js` | 拠点・ガチャ／マップ／バトル |
| `static/js/modes.js` | 苦手キー特訓・エンドレス・デイリー・ランキング |
| `static/js/music.js` | BGM（Web Audio） |
| `static/js/data.js` | 仲間・敵・セクター・打つコードのデータ |
| `static/js/art.js` | キャラクターと敵の絵（SVG） |
| `static/js/typing.js` | 入力判定 |
| `desktop.py` / `build_exe.bat` | Windows アプリ（exe）版 |
| `pythonanywhere_wsgi.py` | Web 公開用の設定 |

## Web で公開する

[DEPLOY_PYTHONANYWHERE.md](DEPLOY_PYTHONANYWHERE.md) を参照してください。
