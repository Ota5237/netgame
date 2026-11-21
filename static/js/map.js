// ネットガーディアンズ：マップ
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

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
    cur.next.forEach(k => { const n = cols[pc + 1][k]; MT.add(`n${k}`, nodeCmd(sec, n.id), 'node', { c: pc + 1, k }); });
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
  S.hit[ch] = (S.hit[ch] || 0) + 1;
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
    if (node.type === 'boss') bossIntro(node, () => startBattle(node));
    else startBattle(node);
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
