// ネットガーディアンズ：共通：定数・セーブ・サウンド・画面の共通処理・仲間のステータス
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

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
