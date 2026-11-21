// ネットガーディアンズ：BGM（音のファイルは使わず、Web Audio でその場で演奏する）と音量
// ※ js/*.js は1つのスコープを共有する通常のスクリプト。index.html の読み込み順に注意。

const Music = (function () {
  let ctx = null, bgmGain = null, seGain = null, noise = null;
  let track = null, trackName = '', step = 0, nextTime = 0, timer = null;

  // chords: [ルート音(MIDI番号), 'm'=短調 / 'M'=長調] を1小節ずつ。パターンは16分音符16個（x=鳴らす）
  const TRACKS = {
    title: { bpm: 92, chords: [[45, 'm'], [41, 'M'], [48, 'M'], [43, 'M']], arp: 'pad', bass: 'x.......x.......',
      kick: '................', snare: '................', hat: '................' },
    hub: { bpm: 96, chords: [[38, 'm'], [46, 'M'], [41, 'M'], [36, 'M']], arp: 'up8', bass: 'x.....x...x.....',
      kick: 'x.......x.......', snare: '....x.......x...', hat: '..x...x...x...x.' },
    map: { bpm: 112, chords: [[40, 'm'], [36, 'M'], [43, 'M'], [38, 'M']], arp: 'up16', bass: 'x..x..x.x..x..x.',
      kick: 'x...x...x...x...', snare: '................', hat: '..x...x...x...x.' },
    battle: { bpm: 138, chords: [[45, 'm'], [41, 'M'], [43, 'M'], [40, 'm']], arp: 'up16', bass: 'x.xx.xx.x.xx.xx.',
      kick: 'x...x...x...x...', snare: '....x.......x...', hat: 'xxxxxxxxxxxxxxxx' },
    boss: { bpm: 152, chords: [[38, 'm'], [38, 'm'], [46, 'M'], [45, 'M']], arp: 'down16', bass: 'xx.xx.xxxx.xx.x.',
      kick: 'x..xx...x..xx...', snare: '....x.......x..x', hat: 'xxxxxxxxxxxxxxxx' },
  };
  const freq = m => 440 * Math.pow(2, (m - 69) / 12);
  const enabled = () => !S || S.sound !== false;
  const vol = (k, d) => (S && typeof S[k] === 'number' ? S[k] : d);

  function ensure() {
    if (ctx) { if (ctx.state === 'suspended' && !document.hidden) ctx.resume(); return ctx; }
    try {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
      bgmGain = ctx.createGain(); bgmGain.connect(ctx.destination);
      seGain = ctx.createGain(); seGain.connect(ctx.destination);
      noise = ctx.createBuffer(1, ctx.sampleRate * 0.5, ctx.sampleRate);
      const d = noise.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
      applyVolume();
      document.addEventListener('visibilitychange', () => { if (document.hidden) ctx.suspend(); else ctx.resume(); });
    } catch (e) { ctx = null; }
    return ctx;
  }
  function applyVolume() {
    if (!ctx) return;
    bgmGain.gain.value = enabled() ? vol('bgmVol', 0.45) * 0.55 : 0;
    seGain.gain.value = enabled() ? vol('seVol', 0.8) * 1.2 : 0;
  }

  // ---- 楽器 ----
  function osc(type, f, t, dur, gain, filterHz) {
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.value = f;
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(gain, t + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    let node = o.connect(g);
    if (filterHz) { const fl = ctx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = filterHz; node = g.connect(fl); }
    node.connect(bgmGain);
    o.start(t); o.stop(t + dur + 0.02);
  }
  function hit(kind, t) {
    if (kind === 'kick') {
      const o = ctx.createOscillator(), g = ctx.createGain();
      o.frequency.setValueAtTime(150, t); o.frequency.exponentialRampToValueAtTime(40, t + 0.12);
      g.gain.setValueAtTime(0.55, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.16);
      o.connect(g).connect(bgmGain); o.start(t); o.stop(t + 0.18);
      return;
    }
    const src = ctx.createBufferSource(), fl = ctx.createBiquadFilter(), g = ctx.createGain();
    src.buffer = noise;
    const snare = kind === 'snare';
    fl.type = snare ? 'bandpass' : 'highpass'; fl.frequency.value = snare ? 1800 : 7000;
    const dur = snare ? 0.14 : 0.04;
    g.gain.setValueAtTime(snare ? 0.22 : 0.07, t); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    src.connect(fl).connect(g).connect(bgmGain); src.start(t); src.stop(t + dur + 0.02);
  }

  function scheduleStep(i, t) {
    const s = i % 16, bar = Math.floor(i / 16) % 4;
    const [root, q] = track.chords[bar];
    const tones = [0, q === 'm' ? 3 : 4, 7, 12];
    const sp = 60 / track.bpm / 4;
    if (track.bass[s] === 'x') osc('sawtooth', freq(root), t, sp * 1.7, 0.2, 650);
    if (track.kick[s] === 'x') hit('kick', t);
    if (track.snare[s] === 'x') hit('snare', t);
    if (track.hat[s] === 'x') hit('hat', t);
    if (track.arp === 'pad') {
      if (s === 0) tones.slice(0, 3).forEach(n => osc('triangle', freq(root + 24 + n), t, sp * 16, 0.05, 1800));
      if (s % 4 === 2) osc('sine', freq(root + 36 + tones[(s / 4 | 0) % 4]), t, sp * 3, 0.03);
    } else if (track.arp === 'up8') {
      if (s % 2 === 0) osc('triangle', freq(root + 24 + tones[(s / 2) % 4]), t, sp * 1.8, 0.07, 2600);
    } else {
      const idx = track.arp === 'down16' ? 3 - (s % 4) : s % 4;
      osc('square', freq(root + 24 + tones[idx]), t, sp * 0.9, 0.045, 2400);
    }
  }
  function tick() {
    if (!track || !ctx) return;
    const sp = 60 / track.bpm / 4;
    while (nextTime < ctx.currentTime + 0.15) { scheduleStep(step, nextTime); step++; nextTime += sp; }
  }

  function play(name) {
    if (name === trackName) return;
    trackName = name;
    track = TRACKS[name] || null;
    if (!ensure()) return;
    clearInterval(timer);
    if (!track) return;
    step = 0;
    nextTime = ctx.currentTime + 0.08;
    timer = setInterval(tick, 25);
  }
  function stop() { play(''); }

  return {
    ensure, play, stop, applyVolume,
    get se() { ensure(); return seGain; },
    get ctx() { return ensure(); },
    get noise() { ensure(); return noise; },
    get track() { return trackName; },
    get state() { return ctx ? ctx.state : 'none'; },
  };
})();

// 画面に合わせて曲を切り替える
function musicFor(screen) {
  if (screen === 'title' || screen === 'story' || screen === 'setup') return 'title';
  if (screen === 'map') return 'map';
  if (screen === 'battle') return B && B.enemies.some(e => e.boss) ? 'boss' : 'battle';
  return 'hub';
}

// 設定画面の音量スライダー
function renderSoundSettings() {
  const box = $('#settingsExtra');
  if (!box) return;
  const row = (key, label, def) => `<label class="vol"><span>${label}</span>
    <input type="range" min="0" max="100" value="${Math.round((typeof S[key] === 'number' ? S[key] : def) * 100)}" data-vol="${key}">
    <b>${Math.round((typeof S[key] === 'number' ? S[key] : def) * 100)}</b></label>`;
  box.innerHTML = `<h3 class="set-h">音量 <small class="dim">（🔊 ボタンで まとめて オン／オフ）</small></h3>
    ${row('bgmVol', '🎵 BGM', 0.45)}${row('seVol', '🔔 効果音', 0.8)}`;
  box.querySelectorAll('[data-vol]').forEach(inp => {
    inp.oninput = () => {
      S[inp.dataset.vol] = inp.value / 100;
      inp.nextElementSibling.textContent = inp.value;
      Music.applyVolume();
      if (inp.dataset.vol === 'seVol') Snd.key();
      save();
    };
  });
}
