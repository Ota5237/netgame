// ネットガーディアンズ：キーボードだけで操作するための仕組み
//   矢印キー：近くのボタンへ移動 ／ Enter：決定 ／ Esc：もどる ／ 画面ごとのショートカットキー
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

const NAV_SEL = 'button:not([disabled]):not([hidden]), [data-nav], input[type=range], input[type=text]';
const MENU_SCREENS = ['hub', 'party', 'gacha'];

// いま操作できる範囲（モーダル → 一時停止 → 画面＋ヘッダー の順に優先）
function navScope() {
  if (modalOpen()) return $('#modal .modal-box');
  const pause = $('#pauseOverlay');
  if (pause && !pause.classList.contains('hidden')) return pause;
  if (MENU_SCREENS.includes(document.body.dataset.screen)) return document;
  return null;
}
function navItems(scope) {
  return [...scope.querySelectorAll(NAV_SEL)].filter(el => {
    if (!el.getClientRects().length) return false; // 見えていないもの
    if (scope !== document) return true;
    return el.closest('.screen.active') || el.closest('.top') || el.closest('#guide');
  });
}
const center = el => { const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; };

// 押した方向にある、いちばん近い要素へフォーカスを移す
function navMove(dir) {
  const scope = navScope();
  if (!scope) return false;
  const items = navItems(scope);
  if (!items.length) return false;
  const cur = document.activeElement;
  if (!items.includes(cur)) { focusEl(preferredFocus(items)); return true; }
  const c = center(cur);
  let best = null, bestScore = Infinity;
  items.forEach(el => {
    if (el === cur) return;
    const p = center(el), dx = p.x - c.x, dy = p.y - c.y;
    const along = { left: -dx, right: dx, up: -dy, down: dy }[dir];
    const across = dir === 'left' || dir === 'right' ? Math.abs(dy) : Math.abs(dx);
    if (along <= 4) return;
    const score = along + across * 2.2;
    if (score < bestScore) { bestScore = score; best = el; }
  });
  if (best) focusEl(best);
  return true;
}
function preferredFocus(items) {
  return items.find(el => el.matches('.diff.on, .btn.primary')) || items[0];
}
function focusEl(el) {
  if (!el) return;
  el.focus({ preventScroll: true });
  el.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
// モーダルなどが開いたとき、主なボタンに合わせておく
function focusDefault(scope) {
  setTimeout(() => {
    const s = scope || navScope();
    if (!s) return;
    const items = navItems(s);
    if (items.length) focusEl(preferredFocus(items));
  }, 30);
}

const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };

// 矢印・Enter の共通処理。処理したら true
function navKey(e) {
  const dir = ARROWS[e.key];
  const el = document.activeElement;
  if (dir) {
    // 音量スライダーは ←→ で値を変える
    if (el && el.type === 'range' && (dir === 'left' || dir === 'right')) return false;
    if (el && el.type === 'text') return false;
    e.preventDefault();
    return navMove(dir);
  }
  if (e.key === 'Enter' && el && el.matches && el.matches('[data-nav]')) {
    e.preventDefault();
    el.click();
    return true;
  }
  return false;
}

// 拠点・編成・ガチャの画面でのキー操作
function menuKey(e) {
  if (e.ctrlKey || e.metaKey || e.altKey || e.isComposing) return;
  if (navKey(e)) return;
  const scr = document.body.dataset.screen;
  if (e.key === 'Escape' && scr !== 'hub') { e.preventDefault(); showHub(); return; }
  const k = e.key.toLowerCase();
  if (scr === 'hub') {
    if (k === 'g') { e.preventDefault(); showGacha(); }
    else if (k === 't') { e.preventDefault(); showParty(); }
    else if (k === 's') { e.preventDefault(); openSettings(); }
    else if (k === 'm') { e.preventDefault(); $('#soundBtn').click(); }
  } else if (scr === 'gacha' && !gachaBusy) {
    if (k === '1') { e.preventDefault(); pull(1); }
    else if (k === '0') { e.preventDefault(); pull(10); }
  }
}

// 画面ごとの操作ガイド（画面の下に表示）
const KEY_HINTS = {
  hub: '↑↓←→ 選択　Enter 決定　<kbd>G</kbd> リクルート　<kbd>T</kbd> チーム編成　<kbd>S</kbd> 設定　<kbd>M</kbd> 音のオン／オフ',
  party: '↑↓←→ 選択　Enter チームに入れる／外す　Esc 拠点へ',
  gacha: '<kbd>1</kbd> 1回解読　<kbd>0</kbd> 10回解読　Enter 演出をスキップ　Esc 拠点へ',
  map: 'コマンドを打って移動　Backspace やり直し　Esc 拠点へ（進行は保存）',
};
function updateKeyHint() {
  const bar = $('#keyHint');
  if (!bar) return;
  const html = KEY_HINTS[document.body.dataset.screen];
  bar.hidden = !html;
  if (html) bar.innerHTML = '⌨ ' + html;
}
