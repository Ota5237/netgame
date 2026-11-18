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
