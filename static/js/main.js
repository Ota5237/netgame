(function () {
  const $ = s => document.querySelector(s);
  const D = GameData, A = Art;
  const SAVE_KEY = 'netguard_save_v2';
  const SAVE_VERSION = 2;
  const MAX_LV = 30, MAX_STARS = 5, PARTY_MAX = 5;
  const TRAVEL_MUL = 0.85; // パケットが届くまでの時間の倍率（小さいほど難しい）
  const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rand = (a, b) => a + Math.random() * (b - a);
  const randInt = (a, b) => Math.floor(rand(a, b + 1));
  const pick = arr => arr[Math.floor(Math.random() * arr.length)];
  const sectorOf = id => (id === 0 ? D.TUTORIAL : D.SECTORS.find(s => s.id === id));

  let S = null;

  // =========================================================
  // セーブ（サーバー優先・localStorage 予備。新しいほうを採用）
  // =========================================================
  function newSave(name) {
    const owned = {};
    D.STARTERS.forEach(id => { owned[id] = { lv: 1, exp: 0, stars: 1 }; });
    return {
      v: SAVE_VERSION, name, cr: 300, owned, party: [...D.STARTERS], cleared: 0, run: null,
      rec: { battles: 0, wins: 0, bestKpm: 0, bestAcc: 0, totalKeys: 0, blocked: 0, kills: 0, pulls: 0 },
      miss: {}, sound: true, tutorialDone: false, savedAt: Date.now(),
    };
  }
  const valid = s => s && s.v === SAVE_VERSION && typeof s.name === 'string';
  function loadLocal() {
    try { const s = JSON.parse(localStorage.getItem(SAVE_KEY)); if (valid(s)) return s; } catch (e) { }
    return null;
  }
  // Web 公開版（SERVER_SAVE=false）では、セーブはこのブラウザの中だけ
  const SERVER_SAVE = window.SERVER_SAVE !== false;
  async function load() {
    const local = loadLocal();
    if (!SERVER_SAVE) return local;
    let server = null;
    try {
      const res = await fetch('/api/save');
      if (res.ok) { const { save } = await res.json(); if (valid(save)) server = save; }
    } catch (e) { }
    if (server && local) return (local.savedAt || 0) > (server.savedAt || 0) ? local : server;
    return server || local;
  }
  let saveTimer = null;
  function save(now = false) {
    if (!S) return;
    S.savedAt = Date.now();
    try { localStorage.setItem(SAVE_KEY, JSON.stringify(S)); } catch (e) { }
    if (!SERVER_SAVE) return;
    const send = () => fetch('/api/save', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(S), keepalive: true,
    }).catch(() => { });
    clearTimeout(saveTimer);
    if (now) send(); else saveTimer = setTimeout(send, 500);
  }
  async function resetSave() {
    clearTimeout(saveTimer);
    try { localStorage.removeItem(SAVE_KEY); } catch (e) { }
    if (SERVER_SAVE) { try { await fetch('/api/save', { method: 'DELETE' }); } catch (e) { } }
  }
  // Windows アプリ版が、ウィンドウを閉じる直前に状態を受け取るために使う
  window.__gameState = () => (S ? JSON.stringify(S) : null);

  // =========================================================
  // サウンド
  // =========================================================
  const Snd = {
    ctx: null,
    tone(f, d = 0.08, type = 'square', v = 0.03, when = 0) {
      if (S && !S.sound) return;
      try {
        this.ctx = this.ctx || new (window.AudioContext || window.webkitAudioContext)();
        const t = this.ctx.currentTime + when;
        const o = this.ctx.createOscillator(), g = this.ctx.createGain();
        o.type = type; o.frequency.value = f;
        g.gain.setValueAtTime(v, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        o.connect(g).connect(this.ctx.destination); o.start(t); o.stop(t + d);
      } catch (e) { }
    },
    key() { this.tone(1700 + Math.random() * 200, 0.02, 'square', 0.012); },
    miss() { this.tone(110, 0.12, 'sawtooth', 0.04); },
    block() { this.tone(900, 0.05, 'square', 0.03); this.tone(1500, 0.08, 'square', 0.025, 0.04); },
    hurt() { this.tone(180, 0.18, 'sawtooth', 0.06); this.tone(90, 0.25, 'square', 0.04, 0.05); },
    attack() { this.tone(500, 0.05, 'triangle', 0.06); this.tone(1100, 0.1, 'triangle', 0.05, 0.04); },
    skill() { [660, 990, 1320, 1760].forEach((f, i) => this.tone(f, 0.12, 'square', 0.025, i * 0.05)); },
    move() { this.tone(1200, 0.05, 'sine', 0.05); this.tone(1800, 0.07, 'sine', 0.04, 0.05); },
    win() { [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.22, 'square', 0.028, i * 0.09)); },
    lose() { [440, 330, 220, 110].forEach((f, i) => this.tone(f, 0.3, 'sawtooth', 0.04, i * 0.16)); },
    boot() { [220, 440, 880, 1760].forEach((f, i) => this.tone(f, 0.15, 'square', 0.025, i * 0.07)); this.tone(2637, 0.4, 'sine', 0.04, 0.32); },
    reveal(r) {
      const n = { N: 1, R: 2, SR: 3, SSR: 5 }[r];
      for (let i = 0; i < n; i++) this.tone(880 * Math.pow(1.26, i), 0.14, 'triangle', 0.035, i * 0.06);
    },
  };

  // =========================================================
  // 画面・共通 UI
  // =========================================================
  function show(id) {
    document.querySelectorAll('.screen').forEach(e => e.classList.toggle('active', e.id === 'screen-' + id));
    document.body.dataset.screen = id;
    document.querySelectorAll('.ime-warn').forEach(e => e.classList.remove('show'));
    hideGuide();
  }
  let toastTimer = null;
  function toast(msg, ms = 2400) {
    const t = $('#toast');
    t.innerHTML = msg; t.classList.add('show');
    clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), ms);
  }
  // modal: action は Enter / ボタンで実行。closable なら Esc・背景クリックで閉じる
  // actions: data-act="キー" のボタンごとの処理（Enter は action）
  let modalAction = null, modalActions = null, modalClosable = true, modalReadyAt = 0;
  function modal(html, { action = null, actions = null, closable = true, delay = 0 } = {}) {
    $('#modalBody').innerHTML = html;
    $('#modal').classList.remove('hidden');
    modalAction = action; modalActions = actions; modalClosable = closable; modalReadyAt = Date.now() + delay;
  }
  function closeModal() { $('#modal').classList.add('hidden'); modalAction = null; modalActions = null; }
  function modalOpen() { return !$('#modal').classList.contains('hidden'); }
  function runModalAction(key) {
    if (Date.now() < modalReadyAt) return;
    const a = key && modalActions && modalActions[key] ? modalActions[key] : modalAction;
    closeModal(); if (a) a();
  }
  function bump(el, cls) { if (!el) return; el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
  function updateHud() {
    $('#hudName').textContent = S ? S.name : '';
    $('#hudCr').textContent = (S ? S.cr : 0).toLocaleString() + ' CR';
    $('#soundBtn').textContent = !S || S.sound ? '🔊' : '🔇';
  }

  // =========================================================
  // 仲間のステータス
  // =========================================================
  const needExp = lv => Math.floor(25 * Math.pow(lv, 1.5));
  function stats(id) {
    const c = D.CHARS[id], o = S.owned[id];
    const g = (1 + 0.08 * (o.lv - 1)) * (1 + 0.1 * (o.stars - 1));
    return { hp: Math.round(c.hp * g), atk: Math.round(c.atk * g), def: Math.round(c.def * g) };
  }
  function team() {
    let hp = 0, atk = 0, def = 0;
    S.party.forEach(id => { const s = stats(id); hp += s.hp; atk += s.atk; def += s.def; });
    return { hp: Math.round(hp * 0.6), atk, def };
  }
  function addExp(id, n) {
    const o = S.owned[id];
    if (o.lv >= MAX_LV) return false;
    o.exp += n;
    let up = false;
    while (o.lv < MAX_LV && o.exp >= needExp(o.lv)) { o.exp -= needExp(o.lv); o.lv++; up = true; }
    if (o.lv >= MAX_LV) o.exp = 0;
    return up;
  }
  const rarTag = r => `<span class="rar r-${r}">${r}</span>`;
  const stars = n => '★'.repeat(n) + '<span class="dim">' + '★'.repeat(MAX_STARS - n) + '</span>';
  function card(id, { cls = '', badge = '' } = {}) {
    const c = D.CHARS[id], o = S.owned[id], role = D.ROLES[c.role];
    const st = o ? stats(id) : c;
    return `<div class="acard rr-${c.rarity} ${cls}" data-id="${id}">
      ${badge}
      <div class="ac-top">${rarTag(c.rarity)}<span class="role" style="color:${role.color}" title="${role.name}">${role.icon} ${role.name}</span></div>
      <div class="ac-av">${A.avatar(c)}</div>
      <div class="ac-name">${c.name} <span class="sex ${c.look.g}" title="${c.look.g === 'm' ? '男性' : '女性'}">${c.look.g === 'm' ? '♂' : '♀'}</span></div>
      ${o ? `<div class="ac-lv">Lv.${o.lv} <span class="stars">${stars(o.stars)}</span></div>` : ''}
      <div class="ac-stats"><span>HP ${st.hp}</span><span>ATK ${st.atk}</span><span>DEF ${st.def}</span></div>
      <div class="ac-skill"><code>${esc(c.skill.cmd)}</code><small>${c.skill.desc}</small></div>
    </div>`;
  }
  function teamStatsHTML() {
    const t = team();
    return `<span>TEAM HP <b>${t.hp}</b></span><span>ATK <b>${t.atk}</b></span><span>DEF <b>${t.def}</b></span>`;
  }

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
      case 'team': {
        const ids = ['kernel', 'neon', 'quartz', 'hash', 'vector'];
        return `<div class="team-line">${ids.map((id, i) =>
          `<div class="tl-av" style="animation-delay:${i * 0.18}s">${A.avatar(D.CHARS[id], { silhouette: i % 2 === 1 })}</div>`).join('')}</div>`;
      }
    }
    return '';
  }
  function startStory(replay) {
    story.replay = replay; story.i = 0;
    show('story'); playScene();
  }
  function playScene() {
    const sc = STORY[story.i], prev = STORY[story.i - 1];
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
    $('#storyText').textContent = STORY[story.i].text;
    $('#storyNext').classList.add('show');
  }
  function advanceStory() {
    if (story.typing) { finishLine(); return; }
    story.i++;
    if (story.i >= STORY.length) endStory(); else playScene();
  }
  function endStory() {
    clearInterval(story.timer);
    if (story.replay && S) { showHub(); return; }
    show('setup');
    setupReadyAt = Date.now() + 500; // ストーリーを Enter 連打で進めた勢いで決定しないように
    setTimeout(() => $('#nameInput').focus(), 60);
  }
  function register() {
    const name = $('#nameInput').value.trim();
    if (!name) { bump($('#nameInput'), 'shake'); return; }
    S = newSave(name.slice(0, 12));
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

  // =========================================================
  // 拠点
  // =========================================================
  function showHub() { show('hub'); renderHub(); }
  function renderHub() {
    updateHud();
    const run = S.run;
    if (run) {
      const sec = sectorOf(run.sector);
      $('#runBox').innerHTML = `<div class="run-card">
        <div><b>進行中：${sec.name}</b> <small class="dim">ノード ${run.pos[0]}/${run.cols.length - 1} ・ HP ${Math.round(run.hpRatio * 100)}%</small></div>
        <div class="row-btns left"><button class="btn primary" id="continueRun">▶ つづきから</button><button class="btn small ghost" id="abandonRun">ランを破棄</button></div>
      </div>`;
      $('#continueRun').onclick = () => showMap();
      $('#abandonRun').onclick = () => {
        if (!confirm('進行中のランを破棄しますか？（獲得済みの CR・経験値は残ります）')) return;
        S.run = null; save(true); renderHub();
      };
    } else $('#runBox').innerHTML = '';

    const training = `<div class="sector th-training ${S.tutorialDone ? '' : 'tut-new'}">
        <div class="sec-info"><b>TRAINING　トレーニング・サーバー</b><small>TUTORIAL${S.tutorialDone ? ' ・ <span class="c-lime">修了 ✔</span>' : ' ・ <span class="c-gold">はじめての人は ここから！</span>'}</small>
        <p class="dim">実際に遊びながら、操作を覚えるチュートリアル。</p></div>
        <button class="btn ${S.tutorialDone ? '' : 'primary'}" data-tutorial>${S.tutorialDone ? 'もう一度' : 'はじめる'}</button>
      </div>`;
    $('#sectorList').innerHTML = training + D.SECTORS.map(sec => {
      const cleared = S.cleared >= sec.id, locked = sec.id > S.cleared + 1;
      return `<div class="sector th-${sec.theme} ${locked ? 'locked' : ''}">
        <div class="sec-info"><b>${locked ? '🔒 ' : ''}SECTOR ${sec.id}　${sec.name}</b><small>${sec.en}${cleared ? ' ・ <span class="c-lime">CLEAR ✔</span>' : ''}</small>
        <p class="dim">${locked ? `SECTOR ${sec.id - 1} をクリアで解放` : sec.desc}</p></div>
        <button class="btn ${locked ? '' : 'primary'}" data-sector="${sec.id}" ${locked ? 'disabled' : ''}>出撃</button>
      </div>`;
    }).join('');

    $('#hubParty').innerHTML = S.party.map(id => `<div class="mini-av">${A.avatar(D.CHARS[id])}<small>${D.CHARS[id].name} Lv.${S.owned[id].lv}</small></div>`).join('')
      + Array.from({ length: PARTY_MAX - S.party.length }, () => '<div class="mini-av empty"><span>＋</span><small>空き</small></div>').join('');
    $('#hubTeamStats').innerHTML = teamStatsHTML();

    const r = S.rec;
    $('#recordBox').innerHTML = [
      ['クリア済みセクター', `${S.cleared} / ${D.SECTORS.length}`], ['勝利 / 戦闘', `${r.wins} / ${r.battles}`],
      ['最高 打鍵/分', r.bestKpm], ['最高 正確率', r.bestAcc + '%'], ['防いだパケット', r.blocked],
      ['撃破数', r.kills], ['総打鍵数', r.totalKeys], ['解読回数', r.pulls],
    ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')
      + (SERVER_SAVE ? '' : '<p class="save-note dim">💾 セーブは このブラウザに保存されます。ブラウザのデータを消すと 進行も消えるので注意してね。</p>');
  }

  function startRun(secId) {
    if (S.run && !confirm('進行中のランを破棄して、新しく出撃しますか？')) return;
    S.run = { sector: secId, cols: genMap(), pos: [0, 0], visited: ['0-0'], hpRatio: 1 };
    save(true);
    Snd.move();
    showMap();
    toast(`${sectorOf(secId).name} に 侵入した。コマンドを打って進もう。`);
  }

  // =========================================================
  // チーム編成
  // =========================================================
  function showParty() { show('party'); renderParty(); }
  function renderParty() {
    $('#partySlots').innerHTML = Array.from({ length: PARTY_MAX }, (_, i) => {
      const id = S.party[i];
      return id ? card(id, { cls: 'in-slot' }) : '<div class="acard empty-slot"><span>空き</span></div>';
    }).join('');
    $('#partyStats').innerHTML = teamStatsHTML();
    const ids = Object.keys(S.owned).sort((a, b) =>
      D.RARITY[D.CHARS[b].rarity].order - D.RARITY[D.CHARS[a].rarity].order || S.owned[b].lv - S.owned[a].lv);
    $('#ownedCount').textContent = `${ids.length} / ${Object.keys(D.CHARS).length}`;
    $('#ownedList').innerHTML = ids.map(id => card(id, {
      cls: S.party.includes(id) ? 'in-party' : '',
      badge: S.party.includes(id) ? '<span class="badge">TEAM</span>' : '',
    })).join('');
    updateHud();
  }
  function toggleMember(id) {
    const i = S.party.indexOf(id);
    if (i >= 0) {
      if (S.party.length <= 1) { toast('チームには 最低1人 必要です'); return; }
      S.party.splice(i, 1);
    } else {
      if (S.party.length >= PARTY_MAX) { toast('チームは 5人まで。先に だれかを外してね'); return; }
      S.party.push(id);
    }
    Snd.move(); save(); renderParty();
  }

  // =========================================================
  // ガチャ（リクルート）
  // =========================================================
  const POOL = {};
  Object.values(D.CHARS).forEach(c => (POOL[c.rarity] = POOL[c.rarity] || []).push(c.id));
  const REFUND = { N: 20, R: 50, SR: 150, SSR: 400 };
  let gachaBusy = false, gachaSkip = null;

  function showGacha() { show('gacha'); updateHud(); }
  // minSR: 10連の最後の1枠（SR以上確定）
  function rollRarity(minSR = false) {
    const r = Math.random() * 100;
    if (r < 1.5) return 'SSR';
    if (minSR) return Math.random() < 0.15 ? 'SSR' : 'SR';
    if (r < 10) return 'SR';
    if (r < 40) return 'R';
    return 'N';
  }
  function pull(n) {
    if (gachaBusy) return;
    const cost = n === 10 ? 900 : 100;
    if (S.cr < cost) { toast(`CR が たりません（必要 ${cost} CR）。ミッションで かせごう！`); Snd.miss(); return; }
    S.cr -= cost;
    S.rec.pulls += n;
    const results = [];
    for (let i = 0; i < n; i++) {
      const needSR = n === 10 && i === n - 1 && !results.some(x => D.RARITY[D.CHARS[x.id].rarity].order >= 2);
      const rar = rollRarity(needSR);
      const id = pick(POOL[rar]);
      const o = S.owned[id];
      const res = { id };
      if (!o) { S.owned[id] = { lv: 1, exp: 0, stars: 1 }; res.isNew = true; }
      else if (o.stars < MAX_STARS) { o.stars++; res.starUp = o.stars; }
      else { S.cr += REFUND[rar]; res.refund = REFUND[rar]; }
      results.push(res);
    }
    save(true);
    updateHud();
    animateGacha(results);
  }
  function animateGacha(results) {
    gachaBusy = true;
    $('#pull1').disabled = $('#pull10').disabled = true;
    const best = Math.max(...results.map(r => D.RARITY[D.CHARS[r.id].rarity].order));
    const scr = $('#gachaScreen');
    const box = $('#gachaResult');
    box.innerHTML = results.map(r => `<div class="gcard hidden-card">${card(r.id, {
      badge: r.isNew ? '<span class="badge new">NEW</span>' : r.starUp ? `<span class="badge">★${r.starUp}</span>` : r.refund ? `<span class="badge">+${r.refund}CR</span>` : '',
    })}<div class="gcard-back">?</div></div>`).join('');
    box.classList.toggle('single', results.length === 1);
    const lines = ['> recruit.agent(' + results.length + ')', '  信号を解読中...'];
    const timers = [];
    let i = 0;
    const finish = () => {
      timers.forEach(clearTimeout);
      box.querySelectorAll('.gcard').forEach(g => g.classList.remove('hidden-card'));
      scr.textContent = lines.concat(['  解読完了。' + results.length + '体のエージェントが 仲間になった。']).join('\n');
      gachaBusy = false; gachaSkip = null;
      $('#pull1').disabled = $('#pull10').disabled = false;
    };
    gachaSkip = finish;
    let bar = '';
    const tick = () => {
      bar += '█';
      scr.textContent = lines.join('\n') + '\n  [' + bar.padEnd(16, '·') + ']' + (best >= 3 && bar.length > 10 ? '  !!! 強い信号を検出 !!!' : best >= 2 && bar.length > 12 ? '  ! 信号強度：高 !' : '');
      Snd.key();
      if (bar.length < 16) timers.push(setTimeout(tick, 55));
      else timers.push(setTimeout(revealNext, 250));
    };
    const revealNext = () => {
      const cards = box.querySelectorAll('.gcard');
      if (i >= cards.length) { finish(); return; }
      const r = results[i];
      const rar = D.CHARS[r.id].rarity;
      cards[i].classList.remove('hidden-card');
      cards[i].classList.add('revealed', 'flash-' + rar);
      Snd.reveal(rar);
      i++;
      timers.push(setTimeout(revealNext, rar === 'SSR' ? 700 : rar === 'SR' ? 420 : 170));
    };
    tick();
  }

  // =========================================================
  // マップ
  // =========================================================
  // 7列（スタート → 5列の分岐 → ボス）。ノードの id はコマンドに使われる（例: b3）
  function genMap() {
    const cols = [[{ type: 'start', id: 'gate', next: [] }]];
    for (let c = 1; c <= 5; c++) {
      const n = c === 1 ? 2 : randInt(2, 3);
      const col = [];
      for (let k = 0; k < n; k++) {
        const w = [['battle', 50], ['cache', 20], ['repair', c >= 2 ? 16 : 0], ['elite', c >= 3 ? 16 : 0]];
        let x = Math.random() * w.reduce((s, [, v]) => s + v, 0), type = 'battle';
        for (const [t, v] of w) { if ((x -= v) < 0) { type = t; break; } }
        col.push({ type, id: 'abc'[k] + c, next: [] });
      }
      cols.push(col);
    }
    if (!cols[5].some(n => n.type === 'repair')) cols[5][randInt(0, cols[5].length - 1)].type = 'repair';
    if (!cols.slice(1, 4).some(col => col.some(n => n.type === 'battle'))) cols[2][0].type = 'battle';
    cols.push([{ type: 'boss', id: 'core', next: [] }]);
    for (let c = 0; c < cols.length - 1; c++) {
      const a = cols[c], b = cols[c + 1];
      a.forEach((node, k) => {
        const t = Math.round(a.length === 1 ? (b.length - 1) / 2 : k * (b.length - 1) / (a.length - 1));
        node.next.push(Math.floor(t));
        if (b.length > 1 && Math.random() < 0.45) {
          const t2 = clamp(Math.floor(t) + (Math.random() < 0.5 ? -1 : 1), 0, b.length - 1);
          if (!node.next.includes(t2)) node.next.push(t2);
        }
      });
      if (a.length === 1) a[0].next = b.map((_, i) => i);
      b.forEach((_, j) => {
        if (!a.some(node => node.next.includes(j))) {
          let best = 0, bd = 9;
          a.forEach((node, k) => { const d = Math.abs(k / Math.max(1, a.length - 1) - j / Math.max(1, b.length - 1)); if (d < bd) { bd = d; best = k; } });
          a[best].next.push(j);
        }
      });
    }
    return cols;
  }

  let MT = null; // マップ用の入力判定
  const nodePos = (c, k, cols) => ({ x: 6 + c * (88 / (cols.length - 1)), y: (k + 1) / (cols[c].length + 1) * 100 });

  function showMap() {
    const run = S.run;
    if (run.inBattle) {
      toast('中断していた 戦闘を 再開します');
      startBattle(run.cols[run.pos[0]][run.pos[1]]);
      return;
    }
    show('map'); renderMap(true);
  }
  function terrainSVG(theme) {
    const lines = [];
    const r = () => Math.random();
    if (theme === 'forest') for (let i = 0; i < 26; i++) { const x = r() * 100, y = 10 + r() * 85, s = 2 + r() * 3; lines.push(`<path d="M${x} ${y} l${s} ${-s * 2.2} l${s} ${s * 2.2}z" class="tr"/>`); }
    if (theme === 'ridge') for (let i = 0; i < 4; i++) { let d = `M0 ${30 + i * 18}`; for (let x = 0; x <= 100; x += 5) d += ` L${x} ${30 + i * 18 + (x / 5 % 2 ? -6 - r() * 6 : 4)}`; lines.push(`<path d="${d}" class="tr-l"/>`); }
    if (theme === 'trench') for (let i = 0; i < 6; i++) { let d = `M0 ${15 + i * 15}`; for (let x = 0; x <= 100; x += 10) d += ` Q${x + 5} ${15 + i * 15 + (r() * 8 - 4)} ${x + 10} ${15 + i * 15}`; lines.push(`<path d="${d}" class="tr-l"/>`); }
    if (theme === 'training') for (let i = 1; i < 10; i++) lines.push(`<path d="M${i * 10} 0 V100 M0 ${i * 10} H100" class="tr-l"/>`);
    if (theme === 'core') for (let i = 0; i < 18; i++) { const x = r() * 100, y = r() * 100; lines.push(`<path d="M${x} ${y} h${4 + r() * 10} v${r() * 10 - 5} h${4 + r() * 8}" class="tr-l"/><circle cx="${x}" cy="${y}" r=".8" class="tr"/>`); }
    return `<svg class="terrain" viewBox="0 0 100 100" preserveAspectRatio="none">${lines.join('')}</svg>`;
  }
  let terrainCache = { key: '', svg: '' };

  function renderMap(rebuild) {
    updateHud();
    const run = S.run, sec = sectorOf(run.sector), cols = run.cols;
    const [pc, pk] = run.pos;
    const cur = cols[pc][pk];
    $('#mapSector').textContent = `SECTOR ${sec.id}　${sec.name}`;
    $('#mapSectorEn').textContent = sec.en;
    const t = team();
    $('#mapHpBar').style.width = run.hpRatio * 100 + '%';
    $('#mapHpBar').classList.toggle('low', run.hpRatio < 0.3);
    $('#mapHpText').textContent = `${Math.round(t.hp * run.hpRatio)} / ${t.hp}`;
    $('#mapPs1').textContent = `${S.name}@${sec.theme}:${cur.id}$ `;

    if (rebuild || !MT) {
      MT = new MultiTyper();
      cur.next.forEach(k => { const n = cols[pc + 1][k]; MT.add(`n${k}`, sec.cmd(n.id), 'node', { c: pc + 1, k }); });
      MT.add('exit', 'exit', 'exit');
    }

    const tkey = run.sector + JSON.stringify(cols.map(c => c.length));
    if (terrainCache.key !== tkey) terrainCache = { key: tkey, svg: terrainSVG(sec.theme) };
    const vis = new Set(run.visited);
    let edges = '';
    cols.forEach((col, c) => col.forEach((n, k) => n.next.forEach(j => {
      const a = nodePos(c, k, cols), b = nodePos(c + 1, j, cols);
      const walked = vis.has(`${c}-${k}`) && vis.has(`${c + 1}-${j}`);
      const open = c === pc && k === pk;
      edges += `<line x1="${a.x}" y1="${a.y}" x2="${b.x}" y2="${b.y}" class="${walked ? 'walked' : open ? 'open' : ''}"/>`;
    })));
    let nodes = '';
    cols.forEach((col, c) => col.forEach((n, k) => {
      const p = nodePos(c, k, cols);
      const isCur = c === pc && k === pk;
      const reach = c === pc + 1 && cur.next.includes(k);
      const st = isCur ? 'current' : reach ? 'reach' : vis.has(`${c}-${k}`) ? 'visited' : c <= pc ? 'passed' : '';
      const target = reach ? MT.targets.get(`n${k}`) : null;
      nodes += `<div class="mnode t-${n.type} ${st}" style="left:${p.x}%;top:${p.y}%" title="${D.NODE_TYPES[n.type].name}">
        <span class="ic">${D.NODE_TYPES[n.type].icon}</span><span class="nid">${n.id}</span>
        ${target ? `<code class="ncmd">${MT.render(target, esc)}</code>` : ''}</div>`;
    }));
    $('#mapArea').className = `map-area th-${sec.theme}`;
    $('#mapArea').innerHTML = terrainCache.svg + `<svg class="edges" viewBox="0 0 100 100" preserveAspectRatio="none">${edges}</svg>` + nodes;

    $('#mapOptions').innerHTML = MT.list().map(tg => {
      if (tg.kind === 'exit') return `<div class="opt exit"><span class="tag">拠点へ戻る</span><code>${MT.render(tg, esc)}</code></div>`;
      const n = cols[tg.data.c][tg.data.k];
      return `<div class="opt t-${n.type}"><span class="tag">${D.NODE_TYPES[n.type].icon} ${D.NODE_TYPES[n.type].name}</span><code>${MT.render(tg, esc)}</code></div>`;
    }).join('');
    $('#mapBuf').textContent = MT.buf;
    if (rebuild && run.sector === 0) mapGuide();
  }

  function mapKey(ch) {
    const exp = MT.expected();
    const r = MT.input(ch);
    if (r.type === 'miss') {
      if (exp) S.miss[exp] = (S.miss[exp] || 0) + 1;
      Snd.miss(); bump($('#screen-map .prompt'), 'shake');
      return;
    }
    Snd.key();
    if (r.type === 'done') {
      if (r.target.kind === 'exit') { save(true); showHub(); toast('拠点に戻った。進行は保存されています。'); return; }
      moveTo(r.target.data.c, r.target.data.k);
      return;
    }
    renderMap(false);
  }

  function moveTo(c, k) {
    const run = S.run, sec = sectorOf(run.sector), node = run.cols[c][k];
    run.pos = [c, k];
    run.visited.push(`${c}-${k}`);
    Snd.move();
    if (['battle', 'elite', 'boss', 'lesson', 'exam'].includes(node.type)) {
      run.inBattle = true; // 戦闘中にアプリを閉じても、再開時にこの戦闘からやり直す
      save(true);
      startBattle(node);
      return;
    }
    if (node.type === 'cache') {
      const cr = Math.round(randInt(40, 80) * sec.reward);
      S.cr += cr;
      toast(`◆ データキャッシュを解析！ <b class="c-gold">+${cr} CR</b>`);
    } else if (node.type === 'repair') {
      const before = run.hpRatio;
      run.hpRatio = Math.min(1, run.hpRatio + 0.4);
      toast(`✚ 修復ポイント：チームHPが ${Math.round((run.hpRatio - before) * 100)}% 回復した`);
    }
    save(true);
    renderMap(true);
  }

  // =========================================================
  // バトル（リアルタイム）
  // =========================================================
  let B = null;

  // ---------- 配置と軌道 ----------
  // 座標は戦闘エリアに対する割合（0〜1）で持ち、描くときに px に直す
  const CORE = { x: 0.5, y: 0.68 }; // チーム（中央あたり）
  function enemySlot(i, n, boss) {
    if (boss) return { x: 0.5, y: 0.15 };
    const slots = n === 1 ? [{ x: 0.5, y: 0.17 }]
      : n === 2 ? [{ x: 0.18, y: 0.24 }, { x: 0.82, y: 0.24 }]
        : [{ x: 0.16, y: 0.26 }, { x: 0.84, y: 0.26 }, { x: 0.5, y: 0.14 }];
    return slots[i];
  }
  const px = f => ({ x: f.x * B.w, y: f.y * B.h });
  function measure() {
    const r = $('#arena').getBoundingClientRect();
    B.w = r.width; B.h = r.height;
    // 戦闘エリアの大きさに合わせて、敵・チーム・文字を拡大縮小する
    B.s = clamp(Math.min(B.h / 500, B.w / 1000), 0.75, 1.7);
    const arena = $('#arena');
    arena.style.setProperty('--s', B.s.toFixed(3));
    arena.style.setProperty('--fs', clamp(B.s, 0.85, 1.35).toFixed(3));
    B.coreR = $('#shieldRing').getBoundingClientRect().width / 2 || 88;
    $('#fxSvg').setAttribute('viewBox', `0 0 ${B.w} ${B.h}`);
  }
  // a→b を結ぶ2次ベジェの制御点（bend の符号でカーブの向き、大きさで膨らみ）
  function ctrl(a, b, bend) {
    const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2;
    return { x: mx - (b.y - a.y) * bend, y: my + (b.x - a.x) * bend };
  }
  function bez(a, c, b, t) {
    const u = 1 - t;
    return { x: u * u * a.x + 2 * u * t * c.x + t * t * b.x, y: u * u * a.y + 2 * u * t * c.y + t * t * b.y };
  }
  const pathD = (a, c, b) => `M${a.x.toFixed(1)} ${a.y.toFixed(1)} Q${c.x.toFixed(1)} ${c.y.toFixed(1)} ${b.x.toFixed(1)} ${b.y.toFixed(1)}`;
  function trail(a, c, b, t, span) {
    const t0 = Math.max(0, t - span), pts = [];
    for (let i = 0; i <= 10; i++) { const q = bez(a, c, b, t0 + (t - t0) * i / 10); pts.push(q.x.toFixed(1) + ',' + q.y.toFixed(1)); }
    return pts.join(' ');
  }
  const SVGNS = 'http://www.w3.org/2000/svg';
  function svgEl(tag, cls) {
    const e = document.createElementNS(SVGNS, tag);
    e.setAttribute('class', cls);
    $('#fxSvg').appendChild(e);
    return e;
  }
  // 敵の弾：敵からチームの防御リングまで
  function packetGeo(p) {
    const e = px(p.from), core = px(CORE);
    // 敵の左右から発射する（敵の真下にある弱点コードの上を通らないように）
    const a = { x: e.x + p.side * (p.enemy.boss ? 100 : 64) * B.s, y: e.y + 6 * B.s };
    const dx = a.x - core.x, dy = a.y - core.y, len = Math.hypot(dx, dy) || 1;
    const b = { x: core.x + dx / len * B.coreR, y: core.y + dy / len * B.coreR };
    // 発射した側（外側）へふくらむ弧にする
    let c = ctrl(a, b, p.bend);
    if (Math.sign(c.x - (a.x + b.x) / 2) !== p.side) c = ctrl(a, b, -p.bend);
    return { a, c, b };
  }
  function packetHead(p) { const g = packetGeo(p); return bez(g.a, g.c, g.b, Math.min(1, p.t / p.T)); }

  // 自分側の弾（攻撃・迎撃・スキル）。from/to は関数（動く対象にも追従するため）
  function shoot(from, to, { T = 0.42, bend, cls = 'cyan', onHit = null } = {}) {
    const s = {
      from, to, T, cls, onHit, t: 0,
      bend: bend !== undefined ? bend : rand(0.22, 0.42) * (Math.random() < 0.5 ? -1 : 1),
      trail: svgEl('polyline', 'shot-trail ' + cls), head: svgEl('circle', 'shot-head ' + cls),
    };
    s.head.setAttribute('r', cls.includes('small') ? 4 : 7);
    B.shots.push(s);
  }
  function fxAt(pt, cls, text = '', ms = 900) {
    const f = document.createElement('div');
    f.className = cls;
    f.textContent = text;
    f.style.left = pt.x + 'px'; f.style.top = pt.y + 'px';
    $('#fxLayer').appendChild(f);
    setTimeout(() => f.remove(), ms);
  }
  const burst = (pt, color) => fxAt(pt, 'burst ' + color, '', 550);
  const floatAt = (pt, text, cls) => fxAt(pt, 'float ' + cls, text);

  // ---------- 戦闘の開始 ----------
  function startBattle(node) {
    const sec = sectorOf(S.run.sector);
    const mk = (key, mul = {}) => {
      const e = D.ENEMIES[key];
      const hp = Math.round(e.hp * sec.hpMul * (mul.hp || 1));
      return { key, name: (mul.prefix || '') + e.name, def: e, hp, maxHp: hp, power: e.power * (mul.power || 1), pending: 0, side: 1,
        interval: e.interval * (mul.interval || 1), travel: e.travel, pool: e.pool, timer: rand(1.2, 2.6), boss: !!e.boss };
    };
    let enemies;
    const L = node.lesson || 0; // チュートリアルのレッスン番号（1〜4）
    if (L === 1) enemies = [mk('dummy')];
    else if (L === 2) enemies = [mk('turret')];
    else if (L === 3) enemies = [mk('sparring')];
    else if (L === 4) enemies = [mk('spam', { hp: 0.7 }), mk('bug', { hp: 0.8 })];
    else if (node.type === 'boss') enemies = [mk(sec.boss)];
    else if (node.type === 'elite') enemies = [mk(pick(sec.enemies), { hp: 2.2, power: 1.3, interval: 0.85, prefix: '強化' }), mk(pick(sec.enemies))];
    else enemies = S.run.pos[0] >= 3 || Math.random() < 0.35 ? [mk(pick(sec.enemies)), mk(pick(sec.enemies))] : [mk(pick(sec.enemies))];
    // レッスン1〜3は、左下の説明と重ならないよう敵を右上に置く
    enemies.forEach((e, i) => { e.idx = i; e.pos = L && L < 4 ? { x: 0.74, y: 0.24 } : enemySlot(i, enemies.length, e.boss); });

    const t = team();
    B = {
      node, sec, enemies, packets: [], shots: [], maxHp: t.hp, hp: Math.max(1, Math.round(t.hp * S.run.hpRatio)), atk: t.atk, def: t.def,
      shield: 0, slowUntil: 0, stunUntil: 0, crit: 0, time: 0, last: performance.now(), paused: false, ended: false, ending: false,
      typer: new MultiTyper(), combo: 0, maxCombo: 0, keys: 0, miss: 0, blocked: 0, seq: 0, w: 800, h: 470, coreR: 88, s: 1,
      skills: S.party.map(id => ({ id, cmd: D.CHARS[id].skill.cmd, cd: D.CHARS[id].skill.cd, readyAt: D.CHARS[id].skill.cd * 0.5 })),
      tut: L ? { lesson: L, blocks: 0, hideVuln: L === 2 || L === 3, skillUsed: false, noFire: L === 1 || L === 3, introDone: false } : null,
      freeze: false, // チュートリアルの説明中、敵と弾の時間を止める
      noLose: !!L, // チュートリアル中は負けない
    };
    // レッスン1・2ではスキルを出さない。レッスン3は1人目のスキルだけ最初から使える
    if (L === 1 || L === 2) B.skills.forEach(s => { s.readyAt = 1e9; });
    if (L === 3) B.skills.forEach((s, i) => { s.readyAt = i === 0 ? 0 : 1e9; });
    if (L === 2) enemies[0].timer = 1.2;
    show('battle');
    $('#pauseOverlay').classList.add('hidden');
    $('#btlTitle').textContent = `${sec.name} ― ${D.NODE_TYPES[node.type].name}`;
    // チームは中央のコアを囲む陣形
    const n = S.party.length;
    B.members = S.party.map((id, i) => {
      const c = D.CHARS[id];
      const role = c.role;
      return { id, role, g: c.look.g, name: c.name, angle: -Math.PI / 2 + (i / n) * Math.PI * 2,
        atk: stats(id).atk, next: rand(3, 6) + AUTO[role].every * 0.3 };
    });
    $('#btlParty').innerHTML = B.members.map(m =>
      `<div class="bp-av" id="bm-${m.id}" title="${m.name}" style="left:calc(50% + ${(Math.cos(m.angle) * 58).toFixed(1)}px);top:calc(50% + ${(Math.sin(m.angle) * 58).toFixed(1)}px)">${A.avatar(D.CHARS[m.id])}</div>`).join('');
    $('#btlEnemies').innerHTML = enemies.map(e => `<div class="enemy ${e.boss ? 'boss' : ''}" id="en${e.idx}" style="left:${e.pos.x * 100}%;top:${e.pos.y * 100}%">
      <div class="en-art">${A.enemy(e.key, e.def)}</div>
      <div class="en-name">${e.name}</div>
      <div class="bar en-hp"><i></i></div>
      <code class="vuln"></code></div>`).join('');
    $('#skillBar').innerHTML = B.skills.map(s => {
      const c = D.CHARS[s.id];
      return `<div class="skill" id="sk-${s.id}" title="${c.skill.name}：${c.skill.desc}">
        <div class="sk-av">${A.avatar(c)}</div>
        <div class="sk-info"><b>${c.skill.name}</b><code class="sk-cmd"></code></div>
        <div class="sk-cd"></div></div>`;
    }).join('');
    $('#fxSvg').innerHTML = '';
    $('#fxLayer').innerHTML = '';
    measure();
    enemies.forEach(newVuln);
    if (node.type === 'boss') toast(`◉ ボス <b>${enemies[0].name}</b> が あらわれた！`);
    refreshLabels();
    if (L) battleGuide();
    const mine = B;
    // 前の戦闘のループが残っていても、この戦闘には干渉しないようにする
    const frame = now => { if (B !== mine || mine.ended) return; loop(now); requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
  }

  // 同時に画面にあるコードは、1文字目がかぶらないようにする（1文字目で狙いが決まる）
  function pickCode(pool) {
    const used = B.typer.usedFirstChars();
    const ok = pool.filter(t => !used.has(t[0]) && t[0] !== '/');
    return ok.length ? pick(ok) : null;
  }
  function vulnPool() {
    const tier = B.sec.tier;
    const lower = D.VULN[Math.max(1, tier - 1)];
    return Math.random() < 0.3 && tier > 1 ? lower : D.VULN[tier];
  }
  function newVuln(e) {
    if (B.tut && B.tut.hideVuln) { e.vulnId = null; return; } // チュートリアルで、まだ攻撃させない段階
    const text = pickCode(vulnPool()) || pickCode(D.VULN[1]) || pick(D.VULN[B.sec.tier]);
    e.vulnId = 'v' + e.idx + '-' + (++B.seq);
    B.typer.add(e.vulnId, text, 'vuln', e);
  }
  function spawnPacket(e) {
    const text = pickCode(e.pool);
    if (!text) { e.timer = 0.6; return; }
    // 同じ敵の弾は左右交互にカーブさせ、ラベルが重なりにくいようにする
    e.side = -e.side;
    const p = {
      id: 'p' + (++B.seq), text, t: 0, power: e.power, enemy: e,
      T: e.travel * TRAVEL_MUL * (1 + Math.max(0, text.length - 10) * 0.05),
      from: e.pos, side: e.side,
      bend: rand(0.25, 0.5),
    };
    p.guide = svgEl('path', 'pk-guide');
    p.trail = svgEl('polyline', 'pk-trail');
    p.head = svgEl('circle', 'pk-head');
    p.head.setAttribute('r', 6);
    p.el = document.createElement('div');
    p.el.className = 'packet';
    $('#fxLayer').appendChild(p.el);
    B.packets.push(p);
    B.typer.add(p.id, text, 'packet', p);
    bump($('#en' + e.idx + ' .en-art'), 'fire');
    refreshLabels();
  }
  function removePacket(p) {
    B.packets = B.packets.filter(x => x !== p);
    [p.el, p.guide, p.trail, p.head].forEach(el => el.remove());
    B.typer.remove(p.id);
  }

  function loop(now) {
    const dt = Math.min(0.05, Math.max(0, (now - B.last) / 1000));
    B.last = now;
    if (!B.paused) { B.time += dt; update(dt); }
    if (!B.ended) render();
  }
  function update(dt) {
    // 自分の弾は、決着の演出中も最後まで飛ばす
    B.shots.forEach(s => { s.t += dt / s.T; });
    B.shots.filter(s => s.t >= 1).forEach(s => {
      B.shots = B.shots.filter(x => x !== s);
      s.trail.remove(); s.head.remove();
      burst(s.to(), s.cls.split(' ')[0]);
      if (s.onHit) s.onHit();
    });
    if (B.ending) return;
    const now = B.time;
    const tut = B.tut;
    // 防御の練習：最初の1発が途中まで来たら、時間を止めて説明する
    if (tut && tut.lesson === 2 && !tut.introDone && !B.freeze) {
      const p = B.packets[0];
      if (p && p.t / p.T >= 0.32) { B.freeze = true; battleGuide(); refreshLabels(); }
    }
    B.enemies.forEach(e => {
      if (e.hp <= 0 || now < B.stunUntil || B.freeze) return;
      if (tut && tut.noFire) return; // 攻撃の練習中は、敵は撃ってこない
      if (tut && tut.lesson === 2 && !tut.introDone && B.packets.length) return; // 説明が終わるまでは1発だけ
      e.timer -= dt;
      if (e.timer <= 0) { spawnPacket(e); if (e.timer <= 0) e.timer = e.interval * rand(0.85, 1.15); }
    });
    const speed = B.freeze ? 0 : now < B.slowUntil ? 0.5 : 1;
    [...B.packets].forEach(p => { p.t += dt * speed * (p.jamUntil > now ? 0.35 : 1); if (p.t >= p.T) packetHit(p); });
    let changed = false;
    B.skills.forEach(s => {
      const key = 's:' + s.id;
      if (now >= s.readyAt && !B.typer.has(key)) {
        // スキルは「/」で始まるので、パケット・弱点とはかぶらない
        B.typer.add(key, s.cmd, 'skill', s); changed = true;
      }
    });
    if (changed) refreshLabels();
    if (!B.freeze && !(B.tut && B.tut.lesson < 4)) autoSupport(now);
  }
  function render() {
    $('#btlHpBar').style.width = clamp(B.hp / B.maxHp, 0, 1) * 100 + '%';
    $('#btlHpBar').classList.toggle('low', B.hp / B.maxHp < 0.3);
    $('#btlHpText').textContent = `${Math.max(0, Math.round(B.hp))} / ${B.maxHp}`;
    const slow = B.time < B.slowUntil;
    B.packets.forEach(p => {
      const g = packetGeo(p), k = Math.min(1, p.t / p.T);
      const h = bez(g.a, g.c, g.b, k);
      p.guide.setAttribute('d', pathD(g.a, g.c, g.b));
      p.trail.setAttribute('points', trail(g.a, g.c, g.b, k, 0.14));
      p.head.setAttribute('cx', h.x.toFixed(1)); p.head.setAttribute('cy', h.y.toFixed(1));
      p.el.style.left = h.x + 'px'; p.el.style.top = h.y + 'px';
      p.el.style.opacity = Math.min(1, k / 0.08); // 飛び始めにフェードイン
      const danger = k > 0.75;
      p.el.classList.toggle('danger', danger);
      p.el.classList.toggle('slow', slow);
      p.el.classList.toggle('jammed', p.jamUntil > B.time);
      p.head.classList.toggle('danger', danger);
    });
    B.shots.forEach(s => {
      const a = s.from(), b = s.to(), c = ctrl(a, b, s.bend);
      const k = 1 - Math.pow(1 - Math.min(1, s.t), 2); // 打ち出しは速く、着弾前に少しゆるむ
      const h = bez(a, c, b, k);
      s.trail.setAttribute('points', trail(a, c, b, k, 0.3));
      s.head.setAttribute('cx', h.x.toFixed(1)); s.head.setAttribute('cy', h.y.toFixed(1));
    });
    $('#shieldRing').classList.toggle('on', B.shield > 0);
    $('#arena').classList.toggle('frozen', !!B.freeze);
    $('#btlEnemies').classList.toggle('stunned', B.time < B.stunUntil);
    B.skills.forEach(s => {
      const el = document.getElementById('sk-' + s.id);
      const left = Math.max(0, s.readyAt - B.time);
      el.querySelector('.sk-cd').style.height = (left / s.cd) * 100 + '%';
      el.classList.toggle('ready', left <= 0);
    });
    const st = [];
    if (B.shield) st.push(`<span class="st sh">◈ シールド×${B.shield}</span>`);
    if (slow) st.push(`<span class="st sl">⏬ スロー ${(B.slowUntil - B.time).toFixed(1)}s</span>`);
    if (B.time < B.stunUntil) st.push(`<span class="st sn">⏸ 停止 ${(B.stunUntil - B.time).toFixed(1)}s</span>`);
    if (B.crit) st.push(`<span class="st cr">✦ クリティカル×${B.crit}</span>`);
    const html = st.join('');
    if ($('#btlStatus').innerHTML !== html) $('#btlStatus').innerHTML = html;
  }
  // 打った部分の色分けを、すべての対象に反映
  function refreshLabels() {
    const T = B.typer;
    B.packets.forEach(p => {
      const t = T.targets.get(p.id);
      if (!t) return;
      const locked = !!T.buf && t.text.startsWith(T.buf);
      p.el.innerHTML = T.render(t, esc);
      p.el.classList.toggle('locked', locked);
      p.trail.classList.toggle('locked', locked);
      p.guide.classList.toggle('locked', locked);
    });
    B.enemies.forEach(e => {
      const el = document.querySelector(`#en${e.idx} .vuln`);
      const t = T.targets.get(e.vulnId);
      el.innerHTML = e.hp > 0 && t ? T.render(t, esc) : '';
      el.classList.toggle('locked', !!(t && T.buf && t.text.startsWith(T.buf)));
      document.querySelector(`#en${e.idx} .en-hp i`).style.width = Math.max(0, e.hp / e.maxHp) * 100 + '%';
    });
    B.skills.forEach(s => {
      const t = T.targets.get('s:' + s.id);
      document.querySelector(`#sk-${s.id} .sk-cmd`).innerHTML = t ? T.render(t, esc) : esc(s.cmd);
    });
    $('#btlBuf').textContent = T.buf;
    $('#btlCombo').textContent = B.combo;
  }

  function battleKey(ch) {
    if (B.ending) return;
    const exp = B.typer.expected();
    const r = B.typer.input(ch);
    if (r.type === 'miss') {
      B.miss++; B.combo = 0;
      if (exp) S.miss[exp] = (S.miss[exp] || 0) + 1;
      Snd.miss(); bump($('.battle-term .prompt'), 'shake');
      refreshLabels();
      return;
    }
    B.keys++; B.combo++; B.maxCombo = Math.max(B.maxCombo, B.combo);
    Snd.key();
    if (r.type === 'done') {
      const t = r.target;
      if (t.kind === 'packet') blockPacket(t.data);
      else if (t.kind === 'vuln') attack(t.data, t.text);
      else if (t.kind === 'skill') useSkill(t.data);
    }
    refreshLabels();
  }
  const comboMul = () => 1 + Math.min(B.combo, 100) / 200;
  const corePt = () => px(CORE);

  // 防御：中央から迎撃弾を撃って、空中で撃ち落とす
  function blockPacket(p, quiet) {
    const pt = packetHead(p);
    removePacket(p);
    B.blocked++;
    B.skills.forEach(s => { s.readyAt -= 0.5; }); // 防御するとスキルの待ち時間が少し縮む
    if (B.tut && B.tut.lesson === 2) tutBlocked();
    if (quiet) { burst(pt, 'cyan'); return; }
    const m = nearestMember(pt);
    act(m);
    shoot(m ? () => memberPt(m) : corePt, () => pt, { T: 0.16, bend: rand(-0.15, 0.15), cls: 'cyan small' });
    floatAt(pt, 'BLOCK', 'block');
    Snd.block();
  }
  function enemyPt(e) { return px(e.pos); }
  function damageEnemy(e, dmg, crit) {
    if (e.hp <= 0) return;
    e.hp -= dmg;
    const el = document.getElementById('en' + e.idx);
    floatAt(enemyPt(e), (crit ? 'CRITICAL ' : '') + dmg, crit ? 'dmg crit' : 'dmg');
    bump(el.querySelector('.en-art'), 'hit');
    if (e.hp <= 0) killEnemy(e);
    refreshLabels();
  }
  // 攻撃：中央から敵へ、カーブを描く弾を撃つ。ダメージは着弾したとき
  function attack(e, text) {
    const crit = B.crit > 0;
    if (crit) B.crit--;
    const dmg = Math.round(B.atk * (0.35 + text.length * 0.05) * comboMul() * (crit ? 2 : 1));
    B.typer.remove(e.vulnId);
    Snd.attack();
    e.pending += dmg;
    if (e.hp - e.pending > 0) newVuln(e); // 着弾で倒しきれるなら、次の弱点は出さない
    const m = nextShooter();
    act(m);
    shoot(m ? () => memberPt(m) : corePt, () => enemyPt(e), {
      cls: crit ? 'gold' : 'cyan',
      onHit: () => { e.pending -= dmg; damageEnemy(e, dmg, crit); },
    });
  }
  function killEnemy(e) {
    e.hp = 0;
    B.typer.remove(e.vulnId);
    document.getElementById('en' + e.idx).classList.add('dead');
    burst(enemyPt(e), 'pink big');
    [...B.packets].filter(p => p.enemy === e).forEach(p => { burst(packetHead(p), 'pink'); removePacket(p); });
    S.rec.kills++;
    if (B.enemies.every(x => x.hp <= 0) && !B.ending) {
      B.ending = true;
      setTimeout(() => endBattle('win'), 800);
    }
  }
  function useSkill(s) {
    const c = D.CHARS[s.id], fx = c.skill.fx;
    s.readyAt = B.time + c.skill.cd;
    B.typer.remove('s:' + s.id);
    Snd.skill();
    bump(document.getElementById('sk-' + s.id), 'fired');
    bump($('#coreOrb'), 'cast');
    floatAt({ x: B.w / 2, y: B.h - 58 }, c.skill.name + '！', 'skillname');
    const caster = B.members.find(x => x.id === s.id);
    act(caster, 'cast');
    say(caster, c.skill.name + '！', 'skill');
    if (fx.heal) { B.hp = Math.min(B.maxHp, B.hp + B.maxHp * fx.heal / 100); floatAt(corePt(), '+' + Math.round(B.maxHp * fx.heal / 100), 'heal'); }
    if (fx.shield) { B.shield += fx.shield; bump($('#shieldRing'), 'pulse'); }
    if (fx.slow) B.slowUntil = Math.max(B.slowUntil, B.time + fx.slow);
    if (fx.stun) B.stunUntil = Math.max(B.stunUntil, B.time + fx.stun);
    if (fx.crit) B.crit += fx.crit;
    if (fx.clear) [...B.packets].forEach(p => blockPacket(p, true));
    if (B.tut && B.tut.lesson === 3 && !B.tut.skillUsed) tutSkillUsed();
    if (fx.dmg) {
      const alive = B.enemies.filter(e => e.hp - e.pending > 0);
      const pool = alive.length ? alive : B.enemies.filter(e => e.hp > 0);
      if (!pool.length) return;
      const targets = fx.all ? pool : [pool.reduce((a, b) => (b.hp < a.hp ? b : a), pool[0])];
      targets.forEach((e, i) => {
        const dmg = Math.round(B.atk * fx.dmg);
        e.pending += dmg;
        if (e.hp - e.pending <= 0) B.typer.remove(e.vulnId);
        // スキル弾は大きく弧を描いて、少しずつ時間差で飛ぶ
        setTimeout(() => shoot(caster ? () => memberPt(caster) : corePt, () => enemyPt(e), {
          T: 0.55, bend: (i % 2 ? -1 : 1) * rand(0.45, 0.6), cls: 'gold big',
          onHit: () => { e.pending -= dmg; damageEnemy(e, dmg, false); },
        }), i * 90);
      });
    }
  }
  // 敵の弾がチームの防御リングに届いた
  function packetHit(p) {
    const pt = packetHead(p);
    removePacket(p);
    if (B.shield > 0) {
      B.shield--;
      burst(pt, 'cyan');
      floatAt(pt, 'SHIELD', 'block');
      Snd.block();
    } else {
      const dmg = Math.max(1, Math.round(p.power * B.sec.dmgMul * (1 - B.def / (B.def + 80))));
      B.hp -= dmg;
      B.combo = 0;
      if (B.noLose && B.hp < 1) {
        B.hp = 1;
        if (!B.tut.warned) { B.tut.warned = true; toast('チュートリアル中なので、HP が0になっても 負けないよ。落ち着いて！'); }
      }
      burst(pt, 'red big');
      floatAt(corePt(), '-' + dmg, 'hurt');
      bump($('#arena'), 'hurt');
      bump($('#coreOrb'), 'hit');
      const victim = nearestMember(pt);
      if (victim) bump(document.getElementById('bm-' + victim.id), 'hurt');
      Snd.hurt();
      if (B.hp <= 0 && !B.ending) { B.ending = true; setTimeout(() => endBattle('lose'), 600); }
    }
    refreshLabels();
  }

  // ---------- 仲間の行動 ----------
  // 役割ごとの自動サポート。every = だいたいの間隔（秒）。タイピングが主役なので控えめにする
  const AUTO = {
    attacker: { every: 7 }, defender: { every: 9 }, healer: { every: 12 }, hacker: { every: 11 }, scanner: { every: 10 },
  };
  const LINES = {
    attacker: { m: ['援護する！', 'いくぜ！', 'くらえ！'], f: ['まかせて！', 'いっけー！', 'えいっ！'] },
    defender: { m: ['通さない！', 'ガードだ！'], f: ['ブロック！', '守るよ！'] },
    healer: { m: ['回復する！', '立て直すぞ'], f: ['回復するね！', 'だいじょうぶ？'] },
    hacker: { m: ['ジャミング開始', '遅くしてやる'], f: ['ジャミング！', '止まって！'] },
    scanner: { m: ['弱点を見つけた！', '解析完了'], f: ['弱点みっけ！', 'スキャン完了！'] },
  };
  function memberPt(m) {
    const c = px(CORE), r = 58 * B.s;
    return { x: c.x + Math.cos(m.angle) * r, y: c.y + Math.sin(m.angle) * r };
  }
  function nearestMember(pt) {
    let best = null, bd = Infinity;
    B.members.forEach(m => { const q = memberPt(m), d = Math.hypot(q.x - pt.x, q.y - pt.y); if (d < bd) { bd = d; best = m; } });
    return best;
  }
  // 通常攻撃を撃つ仲間：アタッカーとスキャナーを優先して交代で
  function nextShooter() {
    const pref = B.members.filter(m => m.role === 'attacker' || m.role === 'scanner');
    const list = pref.length ? pref : B.members;
    if (!list.length) return null;
    B.shooterIdx = ((B.shooterIdx || 0) + 1) % list.length;
    return list[B.shooterIdx];
  }
  function act(m, cls = 'act') { if (m) bump(document.getElementById('bm-' + m.id), cls); }
  function say(m, text, cls = '') {
    if (!m) return;
    const q = memberPt(m);
    fxAt({ x: q.x, y: q.y - 30 * B.s }, 'say ' + cls, text, 1300);
  }
  const line = m => pick(LINES[m.role][m.g] || LINES[m.role].m);

  function autoSupport(now) {
    const alive = B.enemies.filter(e => e.hp - e.pending > 0);
    B.members.forEach(m => {
      if (now < m.next) return;
      let done = false;
      if (m.role === 'attacker' && alive.length) {
        // 援護射撃：小さめのダメージ
        const e = pick(alive), dmg = Math.max(1, Math.round(m.atk * 0.9));
        e.pending += dmg;
        if (e.hp - e.pending <= 0) B.typer.remove(e.vulnId);
        shoot(() => memberPt(m), () => enemyPt(e), { T: 0.5, cls: 'cyan', onHit: () => { e.pending -= dmg; damageEnemy(e, dmg, false); } });
        done = true;
      } else if (m.role === 'defender') {
        // チームに届きそうな弾を1つ止める
        const p = B.packets.filter(x => x.t / x.T > 0.6).sort((a, b) => b.t / b.T - a.t / a.T)[0];
        if (p) {
          const pt = packetHead(p);
          removePacket(p);
          B.blocked++;
          shoot(() => memberPt(m), () => pt, { T: 0.18, bend: rand(-0.2, 0.2), cls: 'cyan small' });
          floatAt(pt, 'GUARD', 'block');
          Snd.block();
          done = true;
        }
      } else if (m.role === 'healer' && B.hp < B.maxHp * 0.7) {
        const v = Math.round(B.maxHp * 0.06);
        B.hp = Math.min(B.maxHp, B.hp + v);
        floatAt(corePt(), '+' + v, 'heal');
        burst(memberPt(m), 'green');
        done = true;
      } else if (m.role === 'hacker') {
        // いちばん近い弾を しばらく遅くする
        const p = B.packets.filter(x => !(x.jamUntil > now)).sort((a, b) => b.t / b.T - a.t / a.T)[0];
        if (p) {
          p.jamUntil = now + 3;
          shoot(() => memberPt(m), () => packetHead(p), { T: 0.25, bend: rand(-0.3, 0.3), cls: 'violet small' });
          done = true;
        }
      } else if (m.role === 'scanner' && alive.length) {
        B.crit += 1;
        burst(enemyPt(pick(alive)), 'gold');
        done = true;
      }
      if (done) {
        act(m);
        say(m, line(m));
        m.next = now + AUTO[m.role].every * rand(0.85, 1.15);
        refreshLabels();
      } else {
        m.next = now + 1; // 出番がないときは少し待って見直す
      }
    });
  }

  function togglePause(force) {
    if (!B || B.ended || B.ending) return;
    B.paused = force !== undefined ? force : !B.paused;
    $('#pauseOverlay').classList.toggle('hidden', !B.paused);
  }

  function endBattle(result) {
    B.ended = true;
    if (B.tut && result === 'win') { tutorialWin(); return; }
    const sec = B.sec, node = B.node, run = S.run;
    const elapsed = Math.max(1, B.time);
    const kpm = Math.round(B.keys / (elapsed / 60));
    const acc = B.keys + B.miss ? Math.round(B.keys / (B.keys + B.miss) * 1000) / 10 : 0;
    const r = S.rec;
    r.battles++; r.totalKeys += B.keys; r.blocked += B.blocked;
    if (B.keys >= 30) { r.bestKpm = Math.max(r.bestKpm, kpm); r.bestAcc = Math.max(r.bestAcc, acc); }

    let title, sub, rewards = '', ups = [], next;
    if (result === 'win') {
      r.wins++;
      const typeMul = node.type === 'boss' ? 3 : node.type === 'elite' ? 1.8 : 1;
      const cr = Math.round((30 + B.enemies.length * 12) * sec.reward * typeMul * rand(0.9, 1.1));
      const exp = Math.round((18 + B.enemies.length * 8) * sec.reward * typeMul);
      S.cr += cr;
      S.party.forEach(id => { if (addExp(id, exp)) ups.push(id); });
      run.hpRatio = clamp(B.hp / B.maxHp, 0.01, 1);
      run.inBattle = false;
      rewards = `<div>💠 <b class="c-gold">+${cr} CR</b></div><div>⬆ チーム全員 EXP <b>+${exp}</b></div>`;
      if (node.type === 'boss') {
        const bonus = 300 * sec.reward;
        S.cr += bonus;
        const first = S.cleared < sec.id;
        S.cleared = Math.max(S.cleared, sec.id);
        S.run = null;
        title = 'SECTOR CLEAR'; sub = `${sec.name} を 取りもどした！`;
        rewards += `<div>🏆 クリアボーナス <b class="c-gold">+${bonus} CR</b></div>`;
        if (first && sec.id < D.SECTORS.length) rewards += `<div class="c-lime">🔓 SECTOR ${sec.id + 1}「${D.SECTORS[sec.id].name}」が 解放された！</div>`;
        if (first && sec.id === D.SECTORS.length) rewards += '<div class="c-lime">🌐 ネオグリッドに 平和が もどった！ ありがとう、ガーディアン。</div>';
        next = showHub;
      } else {
        title = 'VICTORY'; sub = '不正プログラムを 駆除した！';
        next = showMap;
      }
      Snd.win();
    } else {
      S.run = null;
      title = result === 'retreat' ? 'RETREAT' : 'SYSTEM DOWN';
      sub = result === 'retreat' ? '撤退した。ランは終了です。' : 'チームのシステムが ダウンした…　ランは終了です。';
      next = showHub;
      Snd.lose();
    }
    save(true);
    const upHTML = ups.length ? `<div class="ups">${ups.map(id => `<div class="mini-av">${A.avatar(D.CHARS[id])}<small>${D.CHARS[id].name}<br><b class="c-lime">Lv.${S.owned[id].lv}</b></small></div>`).join('')}</div><p class="c-lime center">レベルアップ！</p>` : '';
    modal(`<h2 class="res-title ${result}">${title}</h2><p class="center">${sub}</p>
      <div class="res-grid">
        <div><small>打鍵/分</small><b>${kpm}</b></div><div><small>正確率</small><b>${acc}%</b></div>
        <div><small>防いだパケット</small><b>${B.blocked}</b></div><div><small>最大コンボ</small><b>${B.maxCombo}</b></div>
      </div>
      ${rewards ? `<div class="rewards">${rewards}</div>` : ''}
      ${upHTML}
      <button class="btn primary" data-act>続ける（Enter）</button>`, { action: next, closable: false, delay: 700 });
    updateHud();
  }

  // =========================================================
  // 入力・イベント
  // =========================================================
  function onKeyDown(e) {
    const scr = document.body.dataset.screen;
    if (modalOpen()) {
      if (e.key === 'Enter' && modalAction !== undefined) { e.preventDefault(); runModalAction(); }
      else if (e.key === 'Escape' && modalClosable) closeModal();
      return;
    }
    if (scr === 'title' || scr === 'story') {
      if (e.repeat || e.ctrlKey || e.metaKey || e.altKey) return;
      e.preventDefault();
      if (scr === 'title') leaveTitle();
      else if (e.key === 'Escape') endStory();
      else advanceStory();
      return;
    }
    if (scr === 'gacha' && gachaSkip && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); gachaSkip(); return; }
    if (scr !== 'map' && scr !== 'battle') return;
    if (scr === 'battle') {
      if (e.key === 'Escape') { togglePause(); return; }
      if (!B || B.paused || B.ended) return;
    }
    const warn = document.querySelector(`#screen-${scr} .ime-warn`);
    if (e.key === 'Process' || e.isComposing) { warn.classList.add('show'); return; }
    warn.classList.remove('show');
    const T = scr === 'map' ? MT : B.typer;
    if (e.key === 'Backspace') {
      e.preventDefault(); T.reset();
      if (scr === 'map') renderMap(false); else refreshLabels();
      return;
    }
    if (e.ctrlKey || e.metaKey || e.altKey || e.key.length !== 1) return;
    e.preventDefault();
    if (scr === 'map') mapKey(e.key); else battleKey(e.key);
  }

  async function init() {
    S = await load();
    updateHud();
    showTitle();

    $('#screen-title').addEventListener('click', leaveTitle);
    $('#screen-story').addEventListener('click', e => { if (e.target.closest('#skipBtn')) endStory(); else advanceStory(); });
    $('#startBtn').onclick = register;
    $('#nameInput').addEventListener('keydown', e => {
      if (e.key !== 'Enter' || e.isComposing || e.repeat || Date.now() < setupReadyAt) return;
      e.preventDefault(); register();
    });

    $('#sectorList').addEventListener('click', e => {
      if (e.target.closest('[data-tutorial]')) { startTutorial(); return; }
      const b = e.target.closest('[data-sector]'); if (b && !b.disabled) startRun(+b.dataset.sector);
    });
    $('#guideClose').onclick = hideGuide;
    $('#editPartyBtn').onclick = showParty;
    $('#goGachaBtn').onclick = showGacha;
    document.querySelectorAll('.back-hub').forEach(b => { b.onclick = showHub; });
    $('#partySlots').addEventListener('click', e => { const c = e.target.closest('.acard[data-id]'); if (c) toggleMember(c.dataset.id); });
    $('#ownedList').addEventListener('click', e => { const c = e.target.closest('.acard[data-id]'); if (c) toggleMember(c.dataset.id); });
    $('#pull1').onclick = () => pull(1);
    $('#pull10').onclick = () => pull(10);
    $('#gachaResult').addEventListener('click', () => { if (gachaSkip) gachaSkip(); });
    $('#openingBtn').onclick = () => startStory(true);
    $('#resetBtn').onclick = async () => {
      if (confirm('ほんとうに データを初期化しますか？（仲間・CR・進行がすべて消えます）')) { await resetSave(); location.reload(); }
    };
    $('#soundBtn').onclick = () => { if (!S) return; S.sound = !S.sound; save(); updateHud(); };
    $('#pauseBtn').onclick = () => togglePause();
    $('#resumeBtn').onclick = () => togglePause(false);
    $('#retreatBtn').onclick = () => {
      if (!B || B.ended) return;
      B.paused = false; $('#pauseOverlay').classList.add('hidden');
      B.ending = true; endBattle('retreat');
    };
    $('#modal').addEventListener('click', e => {
      const act = e.target.closest('[data-act]');
      if (act) runModalAction(act.dataset.act);
      else if (e.target.id === 'modal' && modalClosable) closeModal();
    });
    document.addEventListener('keydown', onKeyDown);
    // バトル中に別のウィンドウへ移ったら自動で一時停止
    window.addEventListener('blur', () => { if (document.body.dataset.screen === 'battle') togglePause(true); });
    window.addEventListener('online', () => { if (S) save(); });
    // 画面サイズが変わったら、弾の軌道の計算に使う戦闘エリアの大きさを測り直す
    window.addEventListener('resize', () => { if (B && !B.ended && document.body.dataset.screen === 'battle') measure(); });
  }

  // ---------- PWA ----------
  function setupPWA() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => navigator.serviceWorker.register('/sw.js').catch(() => { }));
    }
    let deferred = null;
    const btn = $('#installBtn');
    window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); deferred = e; btn.hidden = false; });
    btn.onclick = async () => {
      if (!deferred) return;
      deferred.prompt(); await deferred.userChoice; deferred = null; btn.hidden = true;
    };
    window.addEventListener('appinstalled', () => { btn.hidden = true; });
  }

  setupPWA();
  init();
})();
