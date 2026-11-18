// ネットガーディアンズ：バトル（リアルタイム）・仲間の行動
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

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
