// ネットガーディアンズ：タイトル・オープニング・コールサイン登録
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

// =========================================================
// タイトル・オープニング・登録
// =========================================================
const STORY = [
  { scene: 'city', text: '西暦20XX年。\n人々のくらしは、巨大な仮想世界《ネオグリッド》に ささえられていた。' },
  { scene: 'alert', text: 'ある日、正体不明の 不正プログラムが あふれだし、\nネオグリッドは 少しずつ こわれはじめた。' },
  { scene: 'term', text: '立ち上がったのは、コードで 世界を守る ホワイトハッカー――\nそう、きみだ。' },
  { scene: 'team', text: 'AIエージェントの 仲間を集め、5人のチームで\nネオグリッドを 取りもどせ！' },
  { scene: 'term2', text: 'まずは コールサイン（きみの名前）を 登録しよう。' },
];
let titleReadyAt = 0, setupReadyAt = 0;
const story = { i: 0, timer: null, typing: false, replay: false };

function showTitle() {
  show('title');
  $('#titleGreet').textContent = S ? `おかえり、${S.name}。システム待機中…` : '';
  titleReadyAt = Date.now() + 700;
}
function leaveTitle() {
  if (Date.now() < titleReadyAt) return;
  Snd.boot();
  if (S) { showHub(); toast(`ログイン完了。おかえり、<b>${esc(S.name)}</b>。`); }
  else startStory(false);
}
function towers() {
  return '<div class="towers">' + Array.from({ length: 11 }, (_, i) =>
    `<i style="left:${4 + i * 9}%;height:${rand(18, 55).toFixed(0)}%;animation-delay:${(i * 0.17).toFixed(2)}s"></i>`).join('') + '</div>';
}
function sceneHTML(scene) {
  switch (scene) {
    case 'city': return towers();
    case 'alert': return towers() + '<div class="alert-veil"></div><div class="alert-box glitch" data-text="⚠ UNKNOWN PROCESS DETECTED">⚠ UNKNOWN PROCESS DETECTED</div>';
    case 'term': return `<div class="mini-term"><pre>&gt; whoami
white_hacker
&gt; sudo protect --grid neogrid<span class="cursor">_</span></pre></div>`;
    case 'term2': return `<div class="mini-term"><pre>&gt; register --callsign<span class="cursor">_</span></pre></div>`;
    case 'restore': return towers() + `<div class="mini-term"><pre>&gt; status --grid
<span class="c-lime">ALL SYSTEMS ONLINE</span>
threats: 0<span class="cursor">_</span></pre></div>`;
    case 'thanks': return '<div class="thanks"><h1 class="logo glitch" data-text="THANK YOU">THANK YOU</h1><p>FOR PLAYING ― NET GUARDIANS</p></div>';
    case 'team': {
      const ids = ['kernel', 'neon', 'quartz', 'hash', 'vector'];
      return `<div class="team-line">${ids.map((id, i) =>
        `<div class="tl-av" style="animation-delay:${i * 0.18}s">${A.avatar(D.CHARS[id], { silhouette: i % 2 === 1 })}</div>`).join('')}</div>`;
    }
  }
  return '';
}
// lines：台本（省略時はオープニング）、onEnd：終わったときの処理
function startStory(replay, lines = STORY, onEnd = null) {
  story.replay = replay; story.i = 0; story.lines = lines; story.onEnd = onEnd;
  show('story'); playScene();
}
function playScene() {
  const sc = story.lines[story.i], prev = story.lines[story.i - 1];
  if (!prev || prev.scene !== sc.scene) $('#storyStage').innerHTML = sceneHTML(sc.scene);
  const el = $('#storyText');
  el.textContent = '';
  $('#storyNext').classList.remove('show');
  story.typing = true;
  let n = 0;
  clearInterval(story.timer);
  story.timer = setInterval(() => {
    n++;
    el.textContent = sc.text.slice(0, n);
    if (n % 2 && !/\s/.test(sc.text[n - 1])) Snd.key();
    if (n >= sc.text.length) finishLine();
  }, 50);
}
function finishLine() {
  clearInterval(story.timer);
  story.typing = false;
  $('#storyText').textContent = story.lines[story.i].text;
  $('#storyNext').classList.add('show');
}
function advanceStory() {
  if (story.typing) { finishLine(); return; }
  story.i++;
  if (story.i >= story.lines.length) endStory(); else playScene();
}
function endStory() {
  clearInterval(story.timer);
  if (story.onEnd) { const f = story.onEnd; story.onEnd = null; f(); return; }
  if (story.replay && S) { showHub(); return; }
  show('setup');
  setupReadyAt = Date.now() + 500; // ストーリーを Enter 連打で進めた勢いで決定しないように
  setTimeout(() => $('#nameInput').focus(), 60);
}
function register() {
  const name = $('#nameInput').value.trim();
  if (!name) { bump($('#nameInput'), 'shake'); return; }
  S = migrate(newSave(name.slice(0, 12)));
  save(true);
  Snd.boot();
  showHub();
  modal(`<h2>ようこそ、${esc(S.name)}！</h2>
    <p>ネオグリッド防衛チームへの 登録が 完了した。はじめの仲間 3人と <b class="c-gold">300 CR</b> を支給した。</p>
    <div class="party-row center">${S.party.map(id => `<div class="mini-av">${A.avatar(D.CHARS[id])}<small>${D.CHARS[id].name}</small></div>`).join('')}</div>
    <p>はじめてなら、練習用の <b>トレーニング・サーバー</b>で、実際に遊びながら 操作を覚えよう。
    <br><small class="dim">修了すると ボーナス <b class="c-gold">300 CR</b>。あとで 拠点の TRAINING からも始められます。</small></p>
    <div class="row-btns"><button class="btn primary" data-act="tut">チュートリアルを始める（Enter）</button><button class="btn ghost" data-act="skip">スキップ</button></div>`,
  { action: startTutorial, actions: { tut: startTutorial, skip: hubGuide }, closable: false, delay: 300 });
}

// =========================================================
// ボス戦の前の会話
// =========================================================
const BOSS_TALK = {
  trojan: { lines: ['ククク… ようこそ、ガーディアン。', 'おまえに ちょっとした 贈り物を 用意した。', '開けてごらん？ ……中身は わたしだがな！'],
    navi: 'あれが データの森を 荒らした トロイ！ 弱点コードを 打ちこんで！' },
  ransom: { lines: ['ファイアウォールの データは すべて 預かった。', '返してほしければ…… 力ずくで 取り返してみろ！'],
    navi: 'ランサムの攻撃は 重いよ。ディフェンダーの シールドを 活用して！' },
  chaos: { lines: ['秩序？ ルール？ くだらない。', 'このネットの すべてを ぐちゃぐちゃに してやる！'],
    navi: 'カオスコアは 攻撃が とても速い！ 落ち着いて、1文字ずつ 正確にね。' },
  omega: { lines: ['よく ここまで 来たな、ガーディアン。', 'ネオグリッドは わたしが 書き換える。', '消えろ。 ――END OF LINE。'],
    navi: 'これが 最後の戦い……！ みんなの力を 合わせよう！' },
};
function bossIntro(node, go) {
  const sec = sectorOf(S.run.sector), key = sec.boss, e = D.ENEMIES[key], talk = BOSS_TALK[key];
  if (!talk) { go(); return; }
  modal(`<div class="boss-talk">
      <div class="bt-art">${A.enemy(key, e)}</div>
      <div class="bt-lines"><b class="c-red">${e.name}</b>${talk.lines.map((l, i) => `<p style="animation-delay:${0.3 + i * 0.9}s">「${l}」</p>`).join('')}</div>
    </div>
    <div class="bt-navi" style="animation-delay:${0.4 + talk.lines.length * 0.9}s"><div class="g-av">${A.avatar(NAVI)}</div><p>${talk.navi}</p></div>
    <button class="btn primary" data-act>戦闘開始（Enter）</button>`, { action: go, closable: false, delay: 600 });
  Snd.lose();
}

// =========================================================
// エンディング（セクター4を初めてクリアしたとき）
// =========================================================
const ENDING = [
  { scene: 'restore', text: 'オメガが 消え、ネオグリッドに 静けさが もどった。' },
  { scene: 'restore', text: 'こわれた データは 少しずつ 修復され、\n人々の くらしにも 光が もどっていく。' },
  { scene: 'team', text: 'ありがとう、ガーディアン。\nきみと 仲間たちの コードが、この世界を 守ったんだ。' },
  { scene: 'thanks', text: '――そして 今日も、どこかで 新しい不正プログラムが 生まれている。\nENDLESS で、きみの 腕を みがき続けよう！' },
];
function playEnding() {
  S.story.ending = true;
  save(true);
  startStory(true, ENDING, () => { showHub(); toast('🎬 エンディングは 拠点の LOG から いつでも 見られます'); });
}
