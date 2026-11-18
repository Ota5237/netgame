// ネットガーディアンズ：特別なモード（苦手キー特訓・エンドレス・デイリー）
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

// =========================================================
// 苦手キー特訓（60秒・負けなし）
// =========================================================
const DRILL_SEC = 60;

// 苦手なキーを多く含むコードを集める
function drillPool(keys) {
  const tierMax = Math.min(3, (S.cleared || 0) + 1);
  const base = new Set();
  for (let t = 1; t <= tierMax; t++) D.VULN[t].forEach(x => base.add(x));
  if (S.difficulty === 'hard') D.VULN.hard.forEach(x => base.add(x));
  const list = [...base];
  if (!keys.length) return list;
  // 苦手なキーは、まだ行っていないセクターのコードからも探す（記号などは後半のコードに多いため）
  const all = new Set(list);
  [1, 2, 3, 'hard'].forEach(t => D.VULN[t].forEach(x => all.add(x)));
  const score = t => { let n = 0; for (const ch of t) if (keys.includes(ch)) n++; return n / Math.sqrt(t.length); };
  const scored = [...all].map(t => [t, score(t)]).filter(x => x[1] > 0);
  // キーごとに偏らないよう、それぞれのキーを含むコードを順番に取り出す
  const picked = [];
  for (let round = 0; picked.length < 40 && round < 20; round++) {
    keys.forEach(k => {
      const c = scored.filter(x => x[0].includes(k) && !picked.includes(x[0])).sort((a, b) => b[1] - a[1])[0];
      if (c && picked.length < 40) picked.push(c[0]);
    });
  }
  return picked.length >= 12 ? picked : picked.concat(list.filter(t => !picked.includes(t))).slice(0, 40);
}

function startDrill() {
  const keys = weakKeys().map(w => w.k);
  const tier = Math.min(3, (S.cleared || 0) + 1);
  const sec = { ...D.SECTORS[0], id: -1, name: '特訓サーバー', tier, hpMul: 1, dmgMul: 0.6, reward: 0 };
  Snd.move();
  beginBattle({
    mode: 'drill', sec, list: [['drone']], hpRatio: 1,
    title: keys.length ? `特訓サーバー ― 苦手キー特訓（${keys.map(keyLabel).join(' ')}）` : '特訓サーバー ― 全体練習',
    extra: { drill: { keys, pool: drillPool(keys), end: DRILL_SEC } },
  });
  toast(keys.length ? `苦手なキー <b>${keys.map(keyLabel).join(' ')}</b> を 多くふくむコードで 練習しよう！` : 'まだ記録が少ないので、全体の練習をしよう！');
}

function drillResult() {
  const elapsed = Math.max(1, Math.min(B.time, DRILL_SEC));
  const kpm = Math.round(B.keys / (elapsed / 60));
  const acc = B.keys + B.miss ? Math.round(B.keys / (B.keys + B.miss) * 1000) / 10 : 0;
  const cr = Math.round(B.keys / 8), exp = Math.round(B.keys / 12);
  S.cr += cr;
  const ups = S.party.filter(id => addExp(id, exp));
  S.rec.drills = (S.rec.drills || 0) + 1;
  S.rec.totalKeys += B.keys;
  recordHist(kpm, acc);
  save(true);
  const rows = B.drill.keys.map(k => {
    const h = B.kh[k] || 0, m = B.km[k] || 0;
    const a = h + m ? Math.round(h / (h + m) * 100) : null;
    return `<tr><td><span class="kc">${esc(keyLabel(k))}</span></td><td>${a === null ? '<span class="dim">出題なし</span>' : `<b class="${a >= 95 ? 'c-lime' : a >= 85 ? 'c-gold' : 'c-red'}">${a}%</b>`}</td><td class="dim">${h + m} 回</td></tr>`;
  }).join('');
  modal(`<h2 class="res-title win">DRILL COMPLETE</h2>
    <div class="res-grid">
      <div><small>打鍵/分</small><b>${kpm}</b></div><div><small>正確率</small><b>${acc}%</b></div>
      <div><small>打ったキー</small><b>${B.keys}</b></div><div><small>撃破</small><b>${B.kills}</b></div>
    </div>
    ${rows ? `<h3 class="set-h">苦手キーの 今回の正確率</h3><table class="ktable">${rows}</table>` : ''}
    <div class="rewards"><div>💠 <b class="c-gold">+${cr} CR</b></div><div>⬆ チーム全員 EXP <b>+${exp}</b>${ups.length ? '　<span class="c-lime">レベルアップ！</span>' : ''}</div></div>
    <button class="btn primary" data-act>拠点へ（Enter）</button>`, { action: showHub, closable: false, delay: 700 });
  updateHud();
}

// =========================================================
// エンドレス・デイリー（ウェーブ制）
// =========================================================
const DAILY_RULES = [
  { id: 'fast', name: '高速パケット', desc: '敵の弾が いつもより速い', mod: { travel: 0.75 } },
  { id: 'symbols', name: '記号ラッシュ', desc: '大文字や記号の多いコードが よく出る', mod: { symbols: true } },
  { id: 'haste', name: 'スキル全開', desc: 'スキルの待ち時間が 半分', mod: { haste: true } },
  { id: 'noskill', name: 'スキル封印', desc: 'スキルが 使えない（タイピングのみ）', mod: { noskill: true } },
  { id: 'heavy', name: '重装甲', desc: '敵の体力 1.5倍・スコア 1.3倍', mod: { hp: 1.5, score: 1.3 } },
];
const ENDLESS_UNLOCK = 1; // セクター1クリアで解放

// 日付の文字列（YYYYMMDD、プレイヤーのPCの日付）
function todayKey() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
}
// 日付から決まる乱数（同じ日なら全員同じお題になる）
function seeded(seed) {
  let a = 0;
  for (const c of String(seed)) a = (a * 31 + c.charCodeAt(0)) >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function dailyPlan(key = todayKey()) {
  const r = seeded('daily' + key);
  const rule = DAILY_RULES[Math.floor(r() * DAILY_RULES.length)];
  const secIdx = Math.floor(r() * 3);
  const sec = D.SECTORS[secIdx];
  const waves = [1, 2, 3].map(w => {
    if (w === 3) return [[sec.boss, { hp: 0.6 }]];
    return Array.from({ length: w + 1 }, () => [sec.enemies[Math.floor(r() * sec.enemies.length)]]);
  });
  return { key, rule, secIdx, waves };
}

// エンドレスの各ウェーブ：3ウェーブごとに次のセクターの敵、5ウェーブごとにボス
function endlessWave(w) {
  const idx = Math.min(3, Math.floor((w - 1) / 3));
  const sec = D.SECTORS[idx];
  const hpMul = sec.hpMul * (1 + (w - 1) * 0.08);
  const list = w % 5 === 0
    ? [[sec.boss, { hp: 0.6 }]]
    : Array.from({ length: Math.min(3, 1 + Math.floor(w / 3)) }, () => [pick(sec.enemies)]);
  return { sec: { ...sec, hpMul }, list };
}

function startEndless() {
  const first = endlessWave(1);
  Snd.move();
  beginBattle({ mode: 'endless', sec: first.sec, list: first.list, hpRatio: 1, title: 'ENDLESS ― WAVE 1', extra: { wave: 1, score: 0 } });
  waveBanner(1);
}
function startDaily() {
  const plan = dailyPlan();
  const sec = { ...D.SECTORS[plan.secIdx] };
  if (plan.rule.mod.hp) sec.hpMul *= plan.rule.mod.hp;
  Snd.move();
  beginBattle({
    mode: 'daily', sec, list: plan.waves[0], hpRatio: 1, title: `DAILY ― ${plan.rule.name} ― WAVE 1/3`,
    extra: { wave: 1, score: 0, daily: plan, mod: plan.rule.mod },
  });
  if (plan.rule.mod.noskill) B.skills.forEach(s => { s.readyAt = 1e9; });
  if (plan.rule.mod.haste) B.skills.forEach(s => { s.cd *= 0.5; s.readyAt *= 0.5; });
  waveBanner(1);
  toast(`今日のルール：<b>${plan.rule.name}</b>（${plan.rule.desc}）`, 3500);
}
function waveBanner(w) {
  floatAt({ x: B.w / 2, y: B.h * 0.42 }, `WAVE ${w}`, 'wave');
}

// 全員倒したら次のウェーブへ（デイリーは3ウェーブで終わり）
function nextWave() {
  B.score += 300 * B.wave;
  if (B.mode === 'daily' && B.wave >= 3) { B.ending = true; setTimeout(() => endBattle('clear'), 800); return; }
  B.wave++;
  const heal = Math.round(B.maxHp * 0.15);
  B.hp = Math.min(B.maxHp, B.hp + heal);
  [...B.packets].forEach(p => removePacket(p));
  setTimeout(() => {
    if (!B || B.ended) return;
    let list;
    if (B.mode === 'endless') { const w = endlessWave(B.wave); B.sec = w.sec; list = w.list; }
    else list = B.daily.waves[B.wave - 1];
    setEnemies(list);
    $('#btlTitle').textContent = B.mode === 'endless' ? `ENDLESS ― WAVE ${B.wave}` : `DAILY ― ${B.daily.rule.name} ― WAVE ${B.wave}/3`;
    waveBanner(B.wave);
    floatAt(corePt(), '+' + heal, 'heal');
    Snd.skill();
  }, 900);
}

// 結果（ランキングへの登録は、プレイヤーがボタンを押したときだけ）
let lastRun = null;
function waveResult(result) {
  const elapsed = Math.max(1, B.time);
  const kpm = Math.round(B.keys / (elapsed / 60));
  const acc = B.keys + B.miss ? Math.round(B.keys / (B.keys + B.miss) * 1000) / 10 : 0;
  const daily = B.mode === 'daily';
  const cleared = daily && result === 'clear';
  const waveDone = cleared ? 3 : B.wave - 1;
  const score = Math.round((B.score + B.keys * 2) * ((B.mod && B.mod.score) || 1) * (acc / 100));
  const cr = Math.round(score / 40);
  let bonus = 0;
  const exp = Math.max(10, waveDone * 15);
  const ups = S.party.filter(id => addExp(id, exp));
  if (daily) {
    const d = S.daily[B.daily.key] || {};
    if (cleared && !d.cleared) { bonus = 200; d.cleared = true; }
    d.best = Math.max(d.best || 0, score);
    S.daily = { [B.daily.key]: d }; // 今日の分だけ残す
  } else {
    S.rec.endlessBest = Math.max(S.rec.endlessBest || 0, score);
    S.rec.endlessWave = Math.max(S.rec.endlessWave || 0, waveDone);
  }
  S.cr += cr + bonus;
  S.rec.totalKeys += B.keys; S.rec.blocked += B.blocked;
  recordHist(kpm, acc);
  save(true);
  lastRun = { mode: daily ? `daily-${B.daily.key}` : 'endless', score, wave: waveDone, kpm, acc };
  const title = daily ? (cleared ? 'DAILY CLEAR' : 'DAILY OVER') : 'ENDLESS OVER';
  modal(`<h2 class="res-title ${cleared ? 'win' : 'lose'}">${title}</h2>
    <p class="center">${daily ? `今日のルール：${B.daily.rule.name}` : `WAVE ${waveDone} まで 防衛した！`}</p>
    <div class="res-grid">
      <div><small>スコア</small><b class="c-gold">${score.toLocaleString()}</b></div><div><small>${daily ? 'クリアしたウェーブ' : '到達ウェーブ'}</small><b>${waveDone}</b></div>
      <div><small>打鍵/分</small><b>${kpm}</b></div><div><small>正確率</small><b>${acc}%</b></div>
    </div>
    <div class="rewards"><div>💠 <b class="c-gold">+${cr} CR</b>${bonus ? `　🎁 デイリー初クリア <b class="c-gold">+${bonus} CR</b>` : ''}</div>
      <div>⬆ チーム全員 EXP <b>+${exp}</b>${ups.length ? '　<span class="c-lime">レベルアップ！</span>' : ''}</div></div>
    <div class="rank-box">
      <p class="small dim">ランキングには コールサイン「${esc(S.name)}」とスコアが 公開されます。</p>
      <div class="row-btns"><button class="btn" data-submit>🏆 ランキングに登録</button></div>
      <div id="rankMsg" class="small"></div>
    </div>
    <button class="btn primary" data-act>拠点へ（Enter）</button>`, { action: showHub, closable: false, delay: 800 });
  updateHud();
}

async function submitScore() {
  if (!lastRun || lastRun.sent) return;
  const btn = document.querySelector('[data-submit]');
  if (btn) btn.disabled = true;
  try {
    const res = await fetch('/api/ranking', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ...lastRun, name: S.name }),
    });
    const j = await res.json();
    if (!res.ok) throw new Error(j.error || res.status);
    lastRun.sent = true;
    $('#rankMsg').innerHTML = `<p class="c-lime">登録しました！ 今回のスコアは <b>${j.rank} 位</b> です。</p>` + rankTable(j.top);
  } catch (e) {
    if (btn) btn.disabled = false;
    $('#rankMsg').innerHTML = '<p class="c-red">ランキングに つながりませんでした。少し待って もう一度 試してね。</p>';
  }
}

function rankTable(top) {
  if (!top || !top.length) return '<p class="dim">まだ だれも 登録していないよ。一番乗りのチャンス！</p>';
  return `<table class="ktable rank-table">${top.map((t, i) => `<tr class="${S && t.name === S.name ? 'me' : ''}">
    <td>${i < 3 ? ['🥇', '🥈', '🥉'][i] : i + 1}</td><td>${esc(t.name)}</td><td class="c-gold">${t.score.toLocaleString()}</td>
    <td class="dim">W${t.wave}</td><td class="dim">${t.kpm} 打/分</td></tr>`).join('')}</table>`;
}
async function openRanking(mode) {
  const label = mode === 'endless' ? 'エンドレス' : `デイリー（${mode.slice(6, 10)}/${mode.slice(10, 12)}/${mode.slice(12)}）`;
  modal(`<h2>🏆 ランキング ― ${label}</h2><div id="rankList"><p class="dim">読み込み中…</p></div>
    <button class="btn primary" data-act>閉じる（Enter）</button>`, { action: null });
  try {
    const res = await fetch('/api/ranking?mode=' + encodeURIComponent(mode));
    const j = await res.json();
    $('#rankList').innerHTML = rankTable(j.top);
  } catch (e) {
    $('#rankList').innerHTML = '<p class="c-red">ランキングに つながりませんでした（オフラインかもしれません）。</p>';
  }
}
