// ネットガーディアンズ：拠点・チーム編成・ガチャ
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

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
  const wk = weakKeys();
  const drill = `<div class="sector th-drill">
      <div class="sec-info"><b>DRILL　苦手キー特訓</b><small>${DRILL_SEC}秒 ・ 負けなし ・ 打った数に応じて CR と EXP</small>
      <p class="dim">${wk.length ? '苦手なキー：' + wk.map(w => keycap(w.k)).join(' ') : 'まだ記録が少ないので、全体の練習になります。'}</p></div>
      <button class="btn" data-drill>特訓する</button>
    </div>`;
  const open = S.cleared >= ENDLESS_UNLOCK;
  const plan = dailyPlan(), today = S.daily[plan.key] || {};
  const lockNote = '<p class="dim">🔒 SECTOR 1 をクリアで解放</p>';
  const endless = `<div class="sector th-endless ${open ? '' : 'locked'}">
      <div class="sec-info"><b>${open ? '' : '🔒 '}ENDLESS　無限防衛</b><small>どこまで耐えられる？ ・ ランキングあり ・ 難易度「ふつう」固定</small>
      ${open ? `<p class="dim">自己ベスト：<b class="c-gold">${(S.rec.endlessBest || 0).toLocaleString()}</b> 点（WAVE ${S.rec.endlessWave || 0}）</p>` : lockNote}</div>
      <div class="sec-btns"><button class="btn small ghost" data-ranking="endless">🏆</button><button class="btn ${open ? 'primary' : ''}" data-endless ${open ? '' : 'disabled'}>挑戦</button></div>
    </div>`;
  const daily = `<div class="sector th-daily ${open ? '' : 'locked'}">
      <div class="sec-info"><b>${open ? '' : '🔒 '}DAILY　デイリーチャレンジ</b><small>今日のルール：${plan.rule.name}（${plan.rule.desc}）・ 3ウェーブ</small>
      ${open ? `<p class="dim">${today.cleared ? '<span class="c-lime">今日はクリア済み ✔</span>' : '初クリアで <b class="c-gold">+200 CR</b>'}${today.best ? ` ・ 今日のベスト <b class="c-gold">${today.best.toLocaleString()}</b> 点` : ''}</p>` : lockNote}</div>
      <div class="sec-btns"><button class="btn small ghost" data-ranking="daily-${plan.key}">🏆</button><button class="btn ${open ? 'primary' : ''}" data-daily ${open ? '' : 'disabled'}>挑戦</button></div>
    </div>`;
  $('#sectorList').innerHTML = training + drill + endless + daily + D.SECTORS.map(sec => {
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

  $('#endingBtn').hidden = !S.story.ending;
  $('#diffBadge').textContent = `難易度：${DIFFS[S.difficulty || 'normal'].name}${noSpace() ? ' ・ スペースなし' : ''}`;
  const r = S.rec;
  $('#recordBox').innerHTML = [
    ['クリア済みセクター', `${S.cleared} / ${D.SECTORS.length}`], ['勝利 / 戦闘', `${r.wins} / ${r.battles}`],
    ['最高 打鍵/分', r.bestKpm], ['最高 正確率', r.bestAcc + '%'], ['防いだパケット', r.blocked],
    ['撃破数', r.kills], ['総打鍵数', r.totalKeys], ['解読回数', r.pulls],
  ].map(([k, v]) => `<div><small>${k}</small><b>${v}</b></div>`).join('')
    + `<div class="rec-wide"><small>成長の記録</small>${growthChart()}</div>`
    + `<div class="rec-wide"><small>苦手なキー（ミス率）</small>${wk.length
      ? `<div class="weak-row">${wk.map(w => `${keycap(w.k)}<small class="c-red">${Math.round(w.rate * 100)}%</small>`).join('')}</div>`
      : '<p class="dim small">まだ苦手なキーは 見つかっていないよ。</p>'}</div>`
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
  setTimeout(() => document.querySelectorAll('#partySlots .acard[data-id], #ownedList .acard').forEach(el => { el.tabIndex = 0; el.dataset.nav = ''; }));
  $('#ownedList').innerHTML = ids.map(id => card(id, {
    cls: S.party.includes(id) ? 'in-party' : '',
    badge: S.party.includes(id) ? '<span class="badge">TEAM</span>' : '',
  })).join('');
  updateHud();
}
function toggleMember(id) {
  // 選び直したあとも、同じカードにフォーカスを戻す
  const inSlot = !!(document.activeElement && document.activeElement.closest && document.activeElement.closest('#partySlots'));
  setTimeout(() => {
    const el = document.querySelector(`${inSlot ? '#partySlots' : '#ownedList'} .acard[data-id="${id}"]`) || document.querySelector(`.acard[data-id="${id}"]`);
    if (el && document.body.dataset.screen === 'party') el.focus({ preventScroll: true });
  }, 20);
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
