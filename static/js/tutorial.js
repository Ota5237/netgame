// ネットガーディアンズ：チュートリアル（トレーニング・サーバー）
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

// =========================================================
// チュートリアル（トレーニング・サーバー）
// 実際に遊びながら、ナビが その場で 説明する
// =========================================================
const NAVI = { role: 'scanner', look: { g: 'f', back: 'bob', bangs: 'side', hc: '#3df5ff', eye: '#ff3d9a', skin: 0, acc: ['headphones'] } };
let guideHTML = '';
// pos: 'tr'(右上) / 'br'(右下) / 'in-arena'(戦闘エリアの左下)。tut: 光らせる対象（CSS の body[data-tut~=...]）
function guide(title, html, { pos = 'in-arena', tut = '', closable = false } = {}) {
  const g = $('#guide');
  (pos === 'in-arena' ? $('#arena') : document.body).appendChild(g);
  g.className = 'guide ' + pos;
  if (!$('#guideAv').innerHTML) $('#guideAv').innerHTML = A.avatar(NAVI);
  $('#guideClose').hidden = !closable;
  document.body.dataset.tut = tut;
  const key = title + html;
  if (key !== guideHTML) {
    guideHTML = key;
    $('#guideTitle').textContent = title;
    $('#guideText').innerHTML = html;
    bump(g, 'pop');
  }
}
function hideGuide() {
  const g = $('#guide');
  if (!g) return;
  g.className = 'guide hidden';
  guideHTML = '';
  document.body.dataset.tut = '';
  document.querySelectorAll('.tut-hub').forEach(e => e.classList.remove('tut-hub'));
}

function tutMap() {
  const n = (type, id, lesson) => ({ type, id, lesson, next: [0] });
  const cols = [[n('start', 'gate')], [n('lesson', 't1', 1)], [n('lesson', 't2', 2)], [n('lesson', 't3', 3)], [n('exam', 'exam', 4)]];
  cols[4][0].next = [];
  return cols;
}
function startTutorial() {
  if (S.run && S.run.sector !== 0 && !confirm('進行中のランを破棄して、チュートリアルを始めますか？')) return;
  S.run = { sector: 0, cols: tutMap(), pos: [0, 0], visited: ['0-0'], hpRatio: 1 };
  save(true);
  Snd.move();
  showMap();
}
function mapGuide() {
  const run = S.run, [c] = run.pos;
  const next = run.cols[c + 1] && run.cols[c + 1][0];
  if (!next) return;
  const cmd = `<code class="c-gold">${esc(D.TUTORIAL.cmd(next.id))}</code>`;
  const steps = [
    ['STEP 1 マップを進もう', `ここは 練習用の《トレーニング・サーバー》。<br>マップでは、行き先ノードの <b>コマンド</b>を打つと 移動できるよ。<br>まずは ${cmd} と打ってみよう！`],
    ['NEXT ▶ 防御の練習', `ナイス！ 攻撃は バッチリだね。<br>次は 敵の攻撃を ふせぐ練習。${cmd} で進もう。`],
    ['NEXT ▶ スキルの練習', `いい調子！ 次は 仲間の <b>スキル</b>を 使ってみよう。<br>${cmd} で進もう。`],
    ['NEXT ▶ 卒業テスト', `最後は <b>卒業テスト</b>！ ここまで覚えたことを 全部使おう。<br>${cmd} で進もう。`],
  ];
  const [title, text] = steps[Math.min(c, steps.length - 1)];
  guide(title, text + '<br><small class="dim">打ちまちがえたら Backspace で やり直せるよ。</small>', { pos: 'tr', tut: 'map' });
}
function battleGuide() {
  const t = B.tut;
  if (!t) return;
  if (t.lesson === 1) {
    guide('STEP 2 攻撃してみよう', `敵の下にある <b class="c-cyan">青い枠のコード</b>が <b>弱点コード</b>。<br>そのまま打つと、中央のチームから 攻撃弾が飛ぶよ。<br>何回か当てて、ダミーを 倒そう！`, { tut: 'attack' });
  } else if (t.lesson === 2 && !t.introDone && !B.freeze) {
    guide('STEP 3 防御の練習', `練習用タレットが 攻撃してくるよ。<br>飛んでくる弾を よく見ていてね…！`);
  } else if (t.lesson === 2 && !t.introDone) {
    const p = B.packets[0];
    guide('STEP 3 時間を止めたよ！', `これが 敵の <b class="c-red">攻撃パケット</b>。チームに届くと HP が減っちゃう。<br>弾の上のコード ${p ? `<code class="c-gold">${esc(p.text)}</code> ` : ''}を打つと、迎撃して 撃ち落とせるよ。<br><b>打ってみよう！</b>（打ち終わるまで 時間は止まったまま）`, { tut: 'defense' });
  } else if (t.lesson === 2 && t.hideVuln) {
    guide('STEP 3 ナイス迎撃！', `時間が 動きだしたよ。続けて飛んでくる弾も 撃ち落とそう。<br>届くと チームHP が減るよ。<br><b>撃ち落とした数：<span class="c-gold">${t.blocks} / 3</span></b>`, { tut: 'defense' });
  } else if (t.lesson === 2) {
    guide('STEP 3 反撃しよう！', `防御は バッチリ！ 敵の攻撃が 止まったよ。<br>今のうちに、敵の下に出た <b class="c-cyan">弱点コード</b>を打って 倒そう。<br>💡 <b>打ち始めの1文字</b>で 狙いが決まるよ。`, { tut: 'attack' });
  } else if (t.lesson === 3 && !t.skillUsed) {
    guide('STEP 4 スキルを使おう', `下の <b class="c-gold">スキル欄</b>が 金色に光ったら 使えるよ。<br><code class="c-gold">${esc(B.skills[0].cmd)}</code> のように <b>/</b> から打つと 発動！`, { tut: 'skill' });
  } else if (t.lesson === 3) {
    guide('STEP 4 スキル発動！', `スキルは 時間がたつと また使える。弾を ふせぐと 少し早く たまるよ。<br>さあ、<b class="c-cyan">弱点コード</b>や スキルで 倒そう！`, { tut: 'attack skill' });
  } else {
    guide('STEP 5 卒業テスト', `2体を相手に、攻撃・防御・スキルを 全部使って 勝とう！<br><small class="dim">チュートリアル中は HP が0になっても 負けないよ。Esc で一時停止もできる。</small>`);
  }
}
function tutBlocked() {
  const t = B.tut;
  t.blocks++;
  if (!t.introDone) { t.introDone = true; B.freeze = false; } // 止めていた時間を動かす
  if (t.hideVuln && t.blocks >= 3) {
    // 防御ができたら、敵の攻撃を止めて 反撃の練習へ
    t.noFire = true;
    [...B.packets].forEach(p => { burst(packetHead(p), 'cyan'); removePacket(p); });
    t.hideVuln = false;
    B.enemies.filter(e => e.hp > 0).forEach(newVuln);
  }
  battleGuide();
}
function tutSkillUsed() {
  const t = B.tut;
  t.skillUsed = true;
  t.hideVuln = false;
  B.enemies.filter(e => e.hp > 0 && !e.vulnId).forEach(newVuln);
  B.skills.forEach((x, i) => { if (i > 0) x.readyAt = B.time + x.cd * 0.4; });
  battleGuide();
}
function tutorialWin() {
  const L = B.tut.lesson;
  hideGuide();
  Snd.win();
  if (L >= 4) { completeTutorial(); return; }
  S.run.inBattle = false;
  S.run.hpRatio = 1;
  save(true);
  const msg = { 1: '攻撃の しかたを マスターした！', 2: '防御の しかたを マスターした！', 3: 'スキルの 使い方を マスターした！' }[L];
  modal(`<h2 class="res-title win">LESSON CLEAR</h2><p class="center">${msg}</p>
    <button class="btn primary" data-act>マップへ（Enter）</button>`, { action: showMap, closable: false, delay: 500 });
}
function completeTutorial() {
  const first = !S.tutorialDone;
  S.tutorialDone = true;
  S.run = null;
  if (first) S.cr += 300;
  save(true);
  updateHud();
  modal(`<h2 class="res-title win">TRAINING COMPLETE</h2>
    <p class="center">おめでとう！ 基本の操作を すべて マスターした。</p>
    ${first ? '<div class="rewards"><div>🎓 修了ボーナス <b class="c-gold">+300 CR</b></div></div>' : ''}
    <p class="center">次は 拠点で 仲間を集めて、本番の ミッションへ！</p>
    <button class="btn primary" data-act>拠点へ（Enter）</button>`, { action: () => { showHub(); hubGuide(); }, closable: false, delay: 600 });
}
function hubGuide() {
  if (document.body.dataset.screen !== 'hub') showHub();
  ['#goGachaBtn', '#editPartyBtn', "[data-sector='1']"].forEach(sel => { const el = $(sel); if (el) el.classList.add('tut-hub'); });
  guide('拠点の 使いかた', `① <b>リクルート端末</b>で、CR を使って 仲間を集める<br>② <b>チーム編成</b>で、最大5人の チームを組む<br>③ <b>MISSION</b> の「出撃」で セクター1 へ！<br><small class="dim">チュートリアルは MISSION の TRAINING から いつでも やり直せるよ。</small>`,
    { pos: 'br', tut: 'hub', closable: true });
}
