// ネットガーディアンズ：キー入力・起動・PWA（いちばん最後に読み込む）
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

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
  S = migrate(await load());
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
    if (e.target.closest('[data-drill]')) { startDrill(); return; }
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
  $('#settingsBtn').onclick = openSettings;
  // スマホ・タブレット（タッチ操作が中心の端末）で開いたら、キーボードが必要なことを知らせる
  if (matchMedia('(hover: none) and (pointer: coarse)').matches) $('#mobileNote').hidden = false;
  $('#soundBtn').onclick = () => { if (!S) return; S.sound = !S.sound; save(); updateHud(); };
  $('#pauseBtn').onclick = () => togglePause();
  $('#resumeBtn').onclick = () => togglePause(false);
  $('#retreatBtn').onclick = () => {
    if (!B || B.ended) return;
    B.paused = false; $('#pauseOverlay').classList.add('hidden');
    B.ending = true; endBattle('retreat');
  };
  $('#modal').addEventListener('click', e => {
    const df = e.target.closest('[data-diff]');
    if (df) { setDifficulty(df.dataset.diff); return; }
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
