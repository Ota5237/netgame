// 仲間（AIエージェント）と敵（不正プログラム）の SVG
window.Art = (function () {
  let uid = 0;
  const hsl = (h, s, l) => `hsl(${h} ${s}% ${l}%)`;

  function rng(seed) {
    let s = 0;
    for (const c of seed) s = (s * 31 + c.charCodeAt(0)) >>> 0;
    return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296);
  }
  // 色を明るく(amt>0)・暗く(amt<0)する
  function shade(hex, amt) {
    const n = parseInt(hex.slice(1), 16);
    const ch = [n >> 16, (n >> 8) & 255, n & 255].map(c => Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt));
    return '#' + ch.map(c => c.toString(16).padStart(2, '0')).join('');
  }

  // ========================================================
  // 仲間：アニメ調のバストアップ（viewBox 0 0 100 100）
  // ========================================================
  const SKIN = [['#ffe4d2', '#f1c2a5'], ['#f7d0b2', '#e2a985'], ['#e2ac85', '#c88e66'], ['#a86c47', '#8a5434']];
  const ROLE_STYLE = {
    attacker: { cloth: '#2a1220', accent: '#ff4d6d' },
    defender: { cloth: '#12213f', accent: '#4db2ff' },
    healer: { cloth: '#0f2e27', accent: '#3ddc97' },
    hacker: { cloth: '#1e1436', accent: '#b98bff' },
    scanner: { cloth: '#2c2510', accent: '#ffd166' },
  };
  const LINE = '#2b1d2c'; // 目・眉などの線

  // 前髪の毛束：根元 x0〜x1、毛先 (tx, ty)
  const lock = (x0, x1, tx, ty, base = 25) =>
    `M${x0} ${base} Q${x0 + (tx - x0) * 0.25} ${ty - 6} ${tx} ${ty} Q${x1 - (x1 - tx) * 0.1} ${(base + ty) / 2} ${x1} ${base} Z`;
  const CAP = 'M29.5 42 Q28 17 50 15 Q72 17 70.5 42 Q67 30 50 28 Q33 30 29.5 42 Z';
  const BANGS = {
    straight: [[31, 39, 34, 41], [36, 44, 39, 42], [41, 49, 45, 41.5], [47, 55, 51, 42], [52, 60, 56, 41.5], [57, 65, 61, 42], [62, 70, 66, 41]],
    side: [[30, 40, 33, 43], [35, 46, 41, 42], [41, 53, 49, 40], [48, 60, 57, 37], [55, 66, 63, 35], [61, 71, 68, 39]],
    spiky: [[29, 38, 31, 43], [34, 43, 37, 37], [38, 48, 41, 42], [44, 53, 48, 35], [49, 58, 54, 41], [54, 63, 59, 34], [59, 68, 64, 40], [64, 72, 70, 36]],
    parted: [[47, 50, 36, 43], [44, 49, 32, 40], [49, 52, 42, 38], [50, 53, 64, 43], [51, 56, 68, 40], [48, 51, 58, 38]],
    messy: [[29, 38, 32, 42], [34, 44, 40, 40], [40, 50, 44, 34], [45, 55, 52, 42], [51, 60, 57, 36], [56, 66, 63, 41], [62, 71, 68, 37]],
    swept: [[30, 42, 33, 38], [38, 52, 46, 33], [46, 60, 59, 31], [54, 68, 66, 33], [58, 70, 63, 43]],
  };

  function backHair(L, fill) {
    switch (L.back) {
      case 'long':
        return `<path d="M27.5 40 Q24 13 50 11.5 Q76 13 72.5 40 L75 70 Q77 85 71 95 L63 93 Q66 78 64 62 L36 62 Q34 78 37 93 L29 95 Q23 85 25 70 Z" fill="${fill}"/>`;
      case 'bob':
        return `<path d="M26 42 Q23.5 12.5 50 11.5 Q76.5 12.5 74 42 Q76.5 59 71 67 L64 64 L36 64 L29 67 Q23.5 59 26 42 Z" fill="${fill}"/>`;
      case 'ponytail':
        return `<path d="M60 17 Q86 18 86 46 Q86 68 74 82 Q79 60 72 42 Q69 30 60 26 Z" fill="${fill}"/>
          <path d="M28 44 Q25 14 50 12.5 Q75 14 72 44 Q73 54 70 60 L30 60 Q27 54 28 44 Z" fill="${fill}"/>`;
      case 'twintails':
        return `<path d="M31 25 Q13 28 11 52 Q10 72 20 86 Q19 64 25 50 Q29 40 34 33 Z" fill="${fill}"/>
          <path d="M69 25 Q87 28 89 52 Q90 72 80 86 Q81 64 75 50 Q71 40 66 33 Z" fill="${fill}"/>
          <path d="M28 44 Q25 14 50 12.5 Q75 14 72 44 Q73 54 70 60 L30 60 Q27 54 28 44 Z" fill="${fill}"/>`;
      case 'buns':
        return `<circle cx="32" cy="16" r="8" fill="${fill}"/><circle cx="68" cy="16" r="8" fill="${fill}"/>
          <path d="M28 44 Q25 14 50 12.5 Q75 14 72 44 Q73 56 70 62 L30 62 Q27 56 28 44 Z" fill="${fill}"/>`;
      case 'spiky':
        return `<path d="M27 46 L22 32 L30 29 L26 17 L37 20 L39 8 L48 15 L56 5 L61 16 L72 10 L71 23 L80 26 L74 34 L76 46 Z" fill="${fill}"/>`;
      case 'tail':
        return `<path d="M64 52 Q80 58 78 80 Q76 90 70 94 Q72 76 64 62 Z" fill="${fill}"/>
          <path d="M28 46 Q25 14 50 12.5 Q75 14 72 46 Q71 36 50 33 Q29 36 28 46 Z" fill="${fill}"/>`;
      default: // short
        return `<path d="M28.5 46 Q25.5 14 50 12.5 Q74.5 14 71.5 46 Q71 36 50 33 Q29 36 28.5 46 Z" fill="${fill}"/>`;
    }
  }

  function avatar(ch, opts = {}) {
    const id = 'a' + (++uid);
    const L = ch.look || { g: 'f', back: 'bob', bangs: 'side', hc: '#3df5ff', eye: '#ff3d9a', skin: 0, acc: [] };
    const fem = L.g === 'f';
    const acc = new Set(L.acc || []);
    const st = ROLE_STYLE[ch.role] || ROLE_STYLE.scanner;
    const [skin, skinS] = SKIN[L.skin || 0];
    const hc = L.hc, hc2 = L.hc2 || shade(hc, -0.28), hcL = shade(hc, 0.45), hcD = shade(L.hc2 || hc, -0.45);
    const hair = `url(#${id}h)`;
    const eyeD = shade(L.eye, -0.55), eyeL = shade(L.eye, 0.35);
    const parts = [];

    // --- 後ろ ---
    parts.push(`<circle cx="50" cy="54" r="40" fill="${st.accent}" opacity=".10"/>`);
    if (acc.has('halo')) parts.push(`<ellipse cx="50" cy="8.5" rx="17" ry="3.6" fill="none" stroke="#ffd166" stroke-width="2.2" filter="url(#${id}g)"/>`);
    if (acc.has('hood')) parts.push(`<path d="M18 100 Q12 36 50 9 Q88 36 82 100 Z" fill="${shade(st.cloth, 0.04)}"/>`);
    parts.push(backHair(L, hair));

    // --- 体 ---
    if (fem) {
      parts.push(`<path d="M17 100 Q19 84 35 78.5 L45 74.5 L50 80 L55 74.5 L65 78.5 Q81 84 83 100 Z" fill="${st.cloth}"/>`);
      parts.push(`<path d="M45.5 60 L45.5 74.5 L50 83 L54.5 74.5 L54.5 60 Z" fill="${skinS}"/>`);
      parts.push(`<path d="M35 78.5 L45 74.5 L48.5 90 L42 100 L38 100 Z M65 78.5 L55 74.5 L51.5 90 L58 100 L62 100 Z" fill="${shade(st.cloth, 0.18)}"/>`);
      parts.push(`<rect x="45.2" y="67.5" width="9.6" height="2.6" rx="1.2" fill="${st.accent}" filter="url(#${id}g)"/>`);
      parts.push(`<path d="M24 92 L34 84 M76 92 L66 84" stroke="${st.accent}" stroke-width="1.6" filter="url(#${id}g)"/>`);
    } else {
      parts.push(`<path d="M11 100 Q13 82 33 77 L44 73 L50 79 L56 73 L67 77 Q87 82 89 100 Z" fill="${st.cloth}"/>`);
      parts.push(`<path d="M44 60 L44 74 Q50 78 56 74 L56 60 Z" fill="${skinS}"/>`);
      parts.push(`<path d="M39 73 L43.5 65 L50 76 L56.5 65 L61 73 L57 82 L50 77 L43 82 Z" fill="${shade(st.cloth, 0.2)}"/>`);
      parts.push(`<path d="M50 78 V100" stroke="${st.accent}" stroke-width="1.2" opacity=".8" filter="url(#${id}g)"/>`);
      parts.push(`<path d="M20 92 L32 84 M80 92 L68 84" stroke="${st.accent}" stroke-width="1.8" filter="url(#${id}g)"/>`);
    }

    // --- 顔 ---
    parts.push(`<ellipse cx="32.4" cy="49" rx="2.4" ry="3.6" fill="${skinS}"/><ellipse cx="67.6" cy="49" rx="2.4" ry="3.6" fill="${skinS}"/>`);
    parts.push(fem
      ? `<path d="M33 42 Q33 23.5 50 23 Q67 23.5 67 42 Q67 55 59.5 62 Q54.5 67 50 67.5 Q45.5 67 40.5 62 Q33 55 33 42 Z" fill="${skin}"/>`
      : `<path d="M32.5 42 Q32.5 23.5 50 23 Q67.5 23.5 67.5 42 Q67.5 55 62 61.5 Q56 68 50 68.5 Q44 68 38 61.5 Q32.5 55 32.5 42 Z" fill="${skin}"/>`);

    // 目
    const ir = fem ? [4.1, 5.1] : [3.5, 4.2];
    const eyeY = fem ? 48 : 48.5;
    const eye = (x, dir) => { // dir: -1=左目(外側が左) / 1=右目
      const [rx, ry] = ir;
      const outer = x + dir * (rx + 1.7), inner = x - dir * (rx + 1.4);
      const lidTop = eyeY - ry - (fem ? 1.4 : 0.4);
      let s = `<ellipse cx="${x}" cy="${eyeY + 0.4}" rx="${rx + 1.3}" ry="${ry}" fill="#fff"/>
        <ellipse cx="${x}" cy="${eyeY + 0.8}" rx="${rx}" ry="${ry - 0.1}" fill="url(#${id}i)"/>
        <ellipse cx="${x}" cy="${eyeY + 1.3}" rx="${rx * 0.46}" ry="${ry * 0.5}" fill="${eyeD}"/>
        <circle cx="${x - rx * 0.32}" cy="${eyeY - ry * 0.28}" r="${fem ? 1.45 : 1.2}" fill="#fff"/>
        <circle cx="${x + rx * 0.38}" cy="${eyeY + ry * 0.48}" r=".65" fill="#fff" opacity=".9"/>
        <path d="M${inner} ${eyeY - ry * 0.45} Q${x} ${lidTop - 0.4} ${outer} ${eyeY - ry * (fem ? 0.55 : 0.2)}" fill="none" stroke="${LINE}" stroke-width="${fem ? 1.9 : 2.2}" stroke-linecap="round"/>
        <path d="M${x - rx * 0.6} ${eyeY + ry + 0.7} Q${x} ${eyeY + ry + 1.3} ${x + rx * 0.6} ${eyeY + ry + 0.7}" fill="none" stroke="${LINE}" stroke-width=".7" opacity=".35"/>`;
      if (fem) s += `<path d="M${outer} ${eyeY - ry * 0.55} l${dir * 1.7} -1.6 M${outer - dir * 0.6} ${eyeY - ry * 0.25} l${dir * 1.6} -0.4" stroke="${LINE}" stroke-width="1.1" stroke-linecap="round"/>`;
      return s;
    };
    parts.push(eye(42.2, -1), eye(57.8, 1));
    // 眉
    parts.push(fem
      ? `<path d="M38 40.6 Q42 39 46 40.3 M54 40.3 Q58 39 62 40.6" fill="none" stroke="${shade(hc, -0.45)}" stroke-width="1" stroke-linecap="round"/>`
      : `<path d="M37.3 40.3 L46.4 41.6 M62.7 40.3 L53.6 41.6" fill="none" stroke="${shade(hc, -0.5)}" stroke-width="1.7" stroke-linecap="round"/>`);
    // 鼻・口・ほお
    parts.push(`<path d="M50.6 53 Q51.3 54.4 50.1 55" fill="none" stroke="${skinS}" stroke-width=".9" stroke-linecap="round"/>`);
    parts.push(fem
      ? `<path d="M47.6 59 Q50 61 52.4 59" fill="none" stroke="#c4566a" stroke-width="1.15" stroke-linecap="round"/>
         <ellipse cx="38.3" cy="55" rx="3.1" ry="1.6" fill="#ff8fa8" opacity=".38"/><ellipse cx="61.7" cy="55" rx="3.1" ry="1.6" fill="#ff8fa8" opacity=".38"/>`
      : `<path d="M47 59.6 Q50.5 60.6 53.4 58.9" fill="none" stroke="#8a4a4a" stroke-width="1.15" stroke-linecap="round"/>`);
    if (acc.has('mask')) {
      parts.push(`<path d="M34 53.5 Q50 51 66 53.5 L63.5 62 Q50 71 36.5 62 Z" fill="#141925"/><path d="M40 58 H60" stroke="${st.accent}" stroke-width="1.2" filter="url(#${id}g)"/>`);
    }

    // --- 前髪 ---
    if (fem) {
      const len = L.back === 'long' ? 92 : L.back === 'bob' ? 62 : 64;
      parts.push(`<path d="M32 34 Q27.5 ${len * 0.55} 30 ${len} Q33 ${len - 8} 34.5 ${len * 0.6} Q35 44 36.5 36 Z" fill="${hair}"/>`);
      parts.push(`<path d="M68 34 Q72.5 ${len * 0.55} 70 ${len} Q67 ${len - 8} 65.5 ${len * 0.6} Q65 44 63.5 36 Z" fill="${hair}"/>`);
    }
    parts.push(`<path d="${CAP}" fill="${hair}"/>`);
    (BANGS[L.bangs] || BANGS.side).forEach(([x0, x1, tx, ty]) => parts.push(`<path d="${lock(x0, x1, tx, ty)}" fill="${hair}"/>`));
    parts.push(`<path d="M37 24 Q50 18.5 63 24" fill="none" stroke="${hcL}" stroke-width="1.8" stroke-linecap="round" opacity=".6"/>`);
    if (acc.has('hood')) parts.push(`<path d="M22 72 Q20 28 50 13 Q80 28 78 72 L73 72 Q74 32 50 20 Q26 32 27 72 Z" fill="${shade(st.cloth, 0.1)}"/><path d="M27 70 Q26 32 50 20 Q74 32 73 70" fill="none" stroke="${st.accent}" stroke-width="1.1" opacity=".9" filter="url(#${id}g)"/>`);
    if (L.back === 'ponytail' || L.back === 'twintails') parts.push(`<circle cx="${L.back === 'ponytail' ? 63 : 32}" cy="21" r="2.4" fill="${st.accent}"/>${L.back === 'twintails' ? `<circle cx="68" cy="21" r="2.4" fill="${st.accent}"/>` : ''}`);

    // --- アクセサリー ---
    if (acc.has('clip')) parts.push(`<path d="M61 29.5 l3.4 -1.5 l1.5 3.4 l-3.4 1.5 Z" fill="${st.accent}"/><circle cx="66.5" cy="29.5" r="1.4" fill="#fff" opacity=".8"/>`);
    if (acc.has('glasses')) parts.push(`<g fill="rgba(170,215,255,.14)" stroke="#2a3150" stroke-width="1.2"><rect x="35.5" y="43" width="13" height="10" rx="2.6"/><rect x="51.5" y="43" width="13" height="10" rx="2.6"/></g><path d="M48.5 47 H51.5" stroke="#2a3150" stroke-width="1.2"/>`);
    if (acc.has('visor')) parts.push(`<path d="M31 42.5 L69 42.5 L67 53 L33 53 Z" fill="${st.accent}" opacity=".3"/><path d="M31 42.5 L69 42.5 M33 53 L67 53" stroke="${st.accent}" stroke-width="1.3" filter="url(#${id}g)"/>`);
    if (acc.has('goggles')) parts.push(`<rect x="29" y="26" width="42" height="3" rx="1.5" fill="#1b2233"/><rect x="34" y="21.5" width="13.5" height="9" rx="4" fill="#1b2233"/><rect x="52.5" y="21.5" width="13.5" height="9" rx="4" fill="#1b2233"/><rect x="35.5" y="23" width="10.5" height="6" rx="3" fill="${st.accent}" opacity=".85"/><rect x="54" y="23" width="10.5" height="6" rx="3" fill="${st.accent}" opacity=".85"/><path d="M37 24.5 h3 M55.5 24.5 h3" stroke="#fff" stroke-width="1" opacity=".8"/>`);
    if (acc.has('headphones')) parts.push(`<path d="M27.5 47 Q26 10.5 50 10 Q74 10.5 72.5 47" fill="none" stroke="#1b2233" stroke-width="3.2"/><path d="M28.5 40 Q28 13 50 12.6 Q72 13 71.5 40" fill="none" stroke="${st.accent}" stroke-width=".8" opacity=".9"/><rect x="23" y="41" width="8.5" height="13.5" rx="3.4" fill="#1b2233" stroke="${st.accent}" stroke-width="1"/><rect x="68.5" y="41" width="8.5" height="13.5" rx="3.4" fill="#1b2233" stroke="${st.accent}" stroke-width="1"/><rect x="25.5" y="45" width="3.5" height="5.5" rx="1.5" fill="${st.accent}" filter="url(#${id}g)"/><rect x="71" y="45" width="3.5" height="5.5" rx="1.5" fill="${st.accent}" filter="url(#${id}g)"/>`);
    if (acc.has('earpiece')) parts.push(`<rect x="66.3" y="44.5" width="4.4" height="7.5" rx="1.8" fill="#1b2233" stroke="${st.accent}" stroke-width=".9"/><path d="M68 52 Q67 58.5 58 59.5" fill="none" stroke="#1b2233" stroke-width="1.1"/><circle cx="58" cy="59.5" r="1.1" fill="${st.accent}"/>`);
    if (acc.has('halo')) parts.push(`<path d="M24 22 l1 2.6 2.6 1 -2.6 1 -1 2.6 -1 -2.6 -2.6 -1 2.6 -1 Z M78 30 l.8 2 2 .8 -2 .8 -.8 2 -.8 -2 -2 -.8 2 -.8 Z" fill="#ffe9a8"/>`);

    const body = parts.join('');
    return `<svg viewBox="0 0 100 100" class="av">
      <defs>
        <linearGradient id="${id}h" gradientUnits="userSpaceOnUse" x1="0" y1="8" x2="0" y2="${L.back === 'long' || L.back === 'twintails' ? 95 : 72}"><stop offset="0" stop-color="${hcL}"/><stop offset=".35" stop-color="${hc}"/><stop offset="1" stop-color="${L.hc2 ? hc2 : hcD}"/></linearGradient>
        <linearGradient id="${id}i" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${eyeD}"/><stop offset=".55" stop-color="${L.eye}"/><stop offset="1" stop-color="${eyeL}"/></linearGradient>
        <filter id="${id}g" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="1.1" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
        <filter id="${id}s"><feFlood flood-color="#1c2a44"/><feComposite in2="SourceAlpha" operator="in"/></filter>
      </defs>
      ${opts.silhouette ? `<g filter="url(#${id}s)">${body}</g>` : body}
    </svg>`;
  }

  // ========================================================
  // 敵
  // ========================================================
  function enemy(key, e) {
    const id = 'e' + (++uid);
    const r = rng(key);
    const n = e.boss ? 18 : 12;
    const R = e.boss ? 44 : 38;
    const pts = [];
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const rr = R * (i % 2 ? 0.72 + r() * 0.12 : 0.95 + r() * 0.08);
      pts.push(`${(50 + Math.cos(a) * rr).toFixed(1)},${(52 + Math.sin(a) * rr).toFixed(1)}`);
    }
    const h = e.hue;
    const stripes = Array.from({ length: 3 }, () =>
      `<rect x="${(10 + r() * 50).toFixed(0)}" y="${(20 + r() * 60).toFixed(0)}" width="${(18 + r() * 26).toFixed(0)}" height="2.5" fill="${hsl((h + 180) % 360, 100, 70)}" opacity=".7"/>`).join('');
    const crown = e.boss
      ? `<path d="M30 16 L36 2 L44 13 L50 0 L56 13 L64 2 L70 16 Z" fill="${hsl(h, 90, 55)}" stroke="#fff" stroke-width="1.5"/>`
      : '';
    return `<svg viewBox="0 0 100 100" class="en">
      <defs><radialGradient id="${id}g" cx=".4" cy=".35" r=".75"><stop offset="0" stop-color="${hsl(h, 90, 62)}"/><stop offset="1" stop-color="${hsl(h, 80, 22)}"/></radialGradient></defs>
      ${crown}
      <polygon points="${pts.join(' ')}" fill="url(#${id}g)" stroke="${hsl(h, 100, 70)}" stroke-width="2"/>
      ${stripes}
      <circle cx="50" cy="50" r="${e.boss ? 15 : 12}" fill="#0a0f1e"/>
      <circle cx="50" cy="50" r="${e.boss ? 8 : 6}" fill="${hsl((h + 40) % 360, 100, 60)}"/>
      <circle cx="47" cy="47" r="2.5" fill="#fff"/>
      <path d="M36 70 l5 -4 l5 4 l5 -4 l5 4 l5 -4 l5 4" fill="none" stroke="#0a0f1e" stroke-width="3"/>
    </svg>`;
  }

  return { avatar, enemy };
})();
