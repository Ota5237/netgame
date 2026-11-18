// ネットガーディアンズ：ゲームデータ（仲間・敵・セクター・打つコマンド）
window.GameData = (function () {
  const ROLES = {
    attacker: { name: 'アタッカー', icon: '⚔', color: '#ff5470', base: { hp: 80, atk: 14, def: 4 } },
    defender: { name: 'ディフェンダー', icon: '◈', color: '#4db2ff', base: { hp: 125, atk: 8, def: 11 } },
    healer: { name: 'ヒーラー', icon: '✚', color: '#3ddc97', base: { hp: 95, atk: 9, def: 6 } },
    hacker: { name: 'ハッカー', icon: '⌘', color: '#b98bff', base: { hp: 85, atk: 11, def: 5 } },
    scanner: { name: 'スキャナー', icon: '◎', color: '#ffd166', base: { hp: 85, atk: 12, def: 5 } },
  };

  const RARITY = {
    N: { rate: 60, mul: 1, color: '#9aa9bd', order: 0 },
    R: { rate: 30, mul: 1.25, color: '#4db2ff', order: 1 },
    SR: { rate: 8.5, mul: 1.6, color: '#c77dff', order: 2 },
    SSR: { rate: 1.5, mul: 2.1, color: '#ffd166', order: 3 },
  };

  // スキル効果 fx: dmg(敵1体/all) heal(%) shield(回数) slow(秒) stun(秒) clear(パケット全消し) crit(回数)
  const LIST = [
    // N
    ['bit', 'ビット', 'N', 'attacker', 190, 'ビット・ヒット', '敵1体にATK×2.0のダメージ', 12, { dmg: 2.0 }],
    ['byte', 'バイト', 'N', 'defender', 210, 'バイト・ウォール', '攻撃を2回ふせぐシールド', 15, { shield: 2 }],
    ['cache', 'キャッシュ', 'N', 'healer', 150, 'キャッシュ・フィックス', 'チームHPを15%回復', 16, { heal: 15 }],
    ['ping', 'ピング', 'N', 'scanner', 45, 'ピング・マーク', '次の3回の攻撃がクリティカル', 14, { crit: 3 }],
    ['node', 'ノード', 'N', 'hacker', 270, 'ノード・ラグ', 'パケットを4秒スロー', 18, { slow: 4 }],
    ['stack', 'スタック', 'N', 'defender', 30, 'スタック・プッシュ', '攻撃を2回ふせぎ、HP5%回復', 17, { shield: 2, heal: 5 }],
    // R
    ['hex', 'ヘックス', 'R', 'attacker', 0, 'ヘックス・バースト', '敵全体にATK×1.6のダメージ', 15, { dmg: 1.6, all: true }],
    ['packet', 'パケット', 'R', 'attacker', 200, 'パケット・ラッシュ', '敵1体にATK×2.8のダメージ', 14, { dmg: 2.8 }],
    ['socket', 'ソケット', 'R', 'defender', 220, 'ソケット・ロック', '攻撃を3回ふせぐシールド', 15, { shield: 3 }],
    ['token', 'トークン', 'R', 'healer', 120, 'トークン・パッチ', 'チームHPを22%回復', 16, { heal: 22 }],
    ['query', 'クエリ', 'R', 'scanner', 55, 'クエリ・ファインド', '次の4回の攻撃がクリティカル', 14, { crit: 4 }],
    ['proxy', 'プロキシ', 'R', 'hacker', 290, 'プロキシ・ジャム', '敵の攻撃を3秒停止', 18, { stun: 3 }],
    ['router', 'ルーター', 'R', 'hacker', 180, 'ルーター・ドロップ', '飛んでいるパケットを全消去', 20, { clear: true }],
    // SR
    ['sigma', 'シグマ', 'SR', 'attacker', 350, 'シグマ・サム', '敵1体にATK×3.8のダメージ', 14, { dmg: 3.8 }],
    ['quartz', 'クオーツ', 'SR', 'defender', 185, 'クオーツ・ガード', '攻撃を4回ふせぎ、HP8%回復', 16, { shield: 4, heal: 8 }],
    ['neon', 'ネオン', 'SR', 'healer', 310, 'ネオン・リブート', 'チームHPを35%回復', 18, { heal: 35 }],
    ['vector', 'ベクター', 'SR', 'scanner', 60, 'ベクター・ロック', '次の6回の攻撃がクリティカル', 15, { crit: 6 }],
    ['lambda', 'ラムダ', 'SR', 'hacker', 260, 'ラムダ・マップ', 'パケットを6秒スロー＋全消去', 22, { slow: 6, clear: true }],
    // SSR
    ['kernel', 'カーネル', 'SSR', 'attacker', 15, 'カーネル・パージ', '敵全体にATK×3.2のダメージ', 16, { dmg: 3.2, all: true }],
    ['hash', 'ハッシュ', 'SSR', 'hacker', 200, 'ハッシュ・フリーズ', '敵の攻撃を5秒停止＋全消去', 22, { stun: 5, clear: true }],
    ['aurora', 'オーロラ', 'SSR', 'healer', 165, 'オーロラ・リストア', 'HP50%回復＋シールド2回', 22, { heal: 50, shield: 2 }],
  ];

  const VERB = {
    bit: 'hit', byte: 'wall', cache: 'fix', ping: 'mark', node: 'lag', stack: 'push',
    hex: 'burst', packet: 'rush', socket: 'lock', token: 'patch', query: 'find', proxy: 'jam', router: 'drop',
    sigma: 'sum', quartz: 'guard', neon: 'reboot', vector: 'aim', lambda: 'map',
    kernel: 'purge', hash: 'freeze', aurora: 'restore',
  };

  // 見た目：g=性別(m/f) back=後ろ髪 bangs=前髪 hc=髪色(hc2=毛先の色) eye=瞳 skin=肌(0〜3) acc=アクセサリー
  const LOOKS = {
    bit: { g: 'm', back: 'spiky', bangs: 'spiky', hc: '#ff5a3c', eye: '#ffc233', skin: 0, acc: [] },
    byte: { g: 'm', back: 'short', bangs: 'parted', hc: '#6b4a2e', eye: '#4db2ff', skin: 1, acc: ['glasses'] },
    cache: { g: 'f', back: 'bob', bangs: 'straight', hc: '#4fd6b0', eye: '#1fae7f', skin: 0, acc: ['clip'] },
    ping: { g: 'f', back: 'twintails', bangs: 'side', hc: '#ffd34d', eye: '#ff6fa0', skin: 0, acc: ['goggles'] },
    node: { g: 'm', back: 'short', bangs: 'messy', hc: '#5b4b8a', eye: '#b98bff', skin: 2, acc: ['hood'] },
    stack: { g: 'f', back: 'ponytail', bangs: 'side', hc: '#ff9a3d', eye: '#4db2ff', skin: 1, acc: ['earpiece'] },
    hex: { g: 'm', back: 'short', bangs: 'swept', hc: '#c2185b', eye: '#ff4d6d', skin: 0, acc: ['earpiece'] },
    packet: { g: 'f', back: 'ponytail', bangs: 'straight', hc: '#ff6fb5', eye: '#ff3d9a', skin: 0, acc: ['clip'] },
    socket: { g: 'm', back: 'short', bangs: 'parted', hc: '#22325e', eye: '#4db2ff', skin: 3, acc: ['headphones'] },
    token: { g: 'f', back: 'long', bangs: 'side', hc: '#8fdc84', eye: '#2fbf71', skin: 0, acc: ['clip'] },
    query: { g: 'f', back: 'bob', bangs: 'straight', hc: '#c98b4a', eye: '#ffb000', skin: 1, acc: ['goggles'] },
    proxy: { g: 'm', back: 'short', bangs: 'messy', hc: '#23262f', eye: '#9dff4d', skin: 1, acc: ['hood', 'mask'] },
    router: { g: 'm', back: 'short', bangs: 'swept', hc: '#21b5a8', eye: '#3df5ff', skin: 2, acc: ['earpiece'] },
    sigma: { g: 'm', back: 'tail', bangs: 'parted', hc: '#cfd8e6', eye: '#c77dff', skin: 0, acc: ['headphones'] },
    quartz: { g: 'f', back: 'long', bangs: 'straight', hc: '#b39dff', eye: '#7b5cff', skin: 0, acc: ['headphones'] },
    neon: { g: 'f', back: 'buns', bangs: 'side', hc: '#ff4fa3', eye: '#3df5ff', skin: 0, acc: ['headphones'] },
    vector: { g: 'm', back: 'spiky', bangs: 'spiky', hc: '#3a86ff', eye: '#3df5ff', skin: 1, acc: ['visor'] },
    lambda: { g: 'f', back: 'long', bangs: 'straight', hc: '#7a3cff', eye: '#ff3d9a', skin: 0, acc: ['headphones'] },
    kernel: { g: 'm', back: 'spiky', bangs: 'spiky', hc: '#f2f4ff', eye: '#ffc233', skin: 0, acc: ['halo', 'earpiece'] },
    hash: { g: 'f', back: 'long', bangs: 'straight', hc: '#1a1d2b', hc2: '#1fb8d6', eye: '#3df5ff', skin: 0, acc: ['halo', 'hood'] },
    aurora: { g: 'f', back: 'long', bangs: 'side', hc: '#9eefff', hc2: '#ffb3e6', eye: '#c77dff', skin: 0, acc: ['halo', 'headphones'] },
  };

  const CHARS = {};
  LIST.forEach(([id, name, rarity, role, hue, skillName, skillDesc, cd, fx]) => {
    const b = ROLES[role].base, m = RARITY[rarity].mul;
    CHARS[id] = {
      id, name, rarity, role, hue, look: LOOKS[id],
      hp: Math.round(b.hp * m), atk: Math.round(b.atk * m), def: Math.round(b.def * m),
      skill: { cmd: `/${id}.${VERB[id]}()`, name: skillName, desc: skillDesc, cd, fx },
    };
  });

  // ---------- 打つコード ----------
  // 攻撃（敵の弱点コード）
  const VULN = {
    1: ['scan()', 'patch(1)', 'trace.ip', 'kill bug', 'debug -v', 'fix(err)', 'clean()', 'reset()', 'ls -a',
      'git pull', 'make test', 'undo()', 'zip.log', 'quit()', 'echo ok', 'view.log', 'halt()', 'join(team)',
      'ok = 1', 'run.av()', 'pop()', 'xor(a)', 'new.key()', 'wipe.tmp', 'heal(1)', 'mute.ad()'],
    2: ['scan --deep', 'patch(cve_204)', 'trace.route(ip)', 'chmod 600 key', 'grep -r virus', 'kill -9 4021',
      'fw.enable()', 'sha256(data)', 'ssh -p 22 gw', 'diff a.txt b.txt', 'unzip safe.zip', 'ping -c 4 host',
      'tail -f sys.log', 'mv bad.exe trash/', 'export safe=1', 'netstat -an', 'rm cache.tmp', 'job.stop(13)',
      'vpn.connect()', 'avscan(dir)', 'quarantine(x)', 'lock(port_80)', 'backup --full', 'x += 1;', 'ip.ban(66)',
      'yank.proc(7)', 'online = false;', 'heal.all()', 'opt -o fast', 'z = x ^ y;'],
    3: ['quarantine("trojan.exe");', 'for(i=0;i<n;i++)', 'if(err){retry();}', 'await scan.deep(net);',
      'const key = hash(pw);', 'iptables -A INPUT -j DROP', 'find / -name "*.bad"', 'while(ok){guard();}',
      'def heal(sys): return 1', 'import firewall as fw', 'sudo apt upgrade -y', 'chmod -R 700 /secure',
      'try{fix()}catch(e){log(e)}', 'node.isolate([7,9]);', 'jwt.verify(token, key)', 'grep -E "err|warn" log',
      'kill -TERM $(pidof worm)', 'let safe = !infected;', 'ufw deny from 10.0.0.66', 'mount -o ro /core',
      'xargs rm < bad.list', 'yield guard.next();', 'useShield(true);', 'velocity *= 0.5;', 'object.freeze(cfg);',
      'patch --apply fix_12.diff', 'rsync -a /safe /backup'],
  };

  // ハード用：大文字・記号の多いコード（1文字目がかぶらないよう、いろいろな文字で始める）
  VULN.hard = ['Array.isArray(x)', 'JSON.parse(raw)', 'Math.max(a, b)', 'console.log("OK");', 'IF ERR THEN HALT',
    'new Shield(Level.MAX)', 'Object.keys(Cfg)', 'API_KEY = null;', 'fw.Block("10.0.0.66")', 'Promise.all(tasks)',
    'X-Guard: ON', 'git commit -m "FIX"', 'Path("/core").exists()', 'SELECT * FROM logs;', 'DROP TABLE virus;',
    '#define SAFE 1', 'try { Patch(); }', 'User.Role = "GUEST"', 'Kill(PID_WORM);', 'ENV["MODE"] = "SAFE"',
    'Lock(Port.HTTPS)', 'Queue.push({id: 7})', 'ZIP_LEVEL = 9;', 'Verify(Sign(Key))', '$HOME/.cache'];

  // ---------- 敵 ----------
  // pool: 敵が飛ばす攻撃パケット（打って防ぐ）
  const ENEMIES = {
    // チュートリアル用（トレーニング・サーバー）
    dummy: { name: '練習用ダミー', hp: 70, power: 0, interval: 9999, travel: 12, hue: 190, pool: ['idle()'] },
    turret: { name: '練習用タレット', hp: 80, power: 6, interval: 3.4, travel: 12, hue: 45,
      pool: ['ping()', 'echo.hi', 'test(1)', 'knock()', 'beep()', 'wave()', 'yo.yo', 'zap()'] },
    sparring: { name: 'スパーリングbot', hp: 110, power: 6, interval: 4.2, travel: 12, hue: 140,
      pool: ['jab()', 'hook()', 'feint()', 'kick.low', 'uppercut()', 'guard.up', 'dodge()', 'step(2)'] },
    // セクター1
    spam: { name: 'スパム', hp: 60, power: 10, interval: 5.5, travel: 10, hue: 330,
      pool: ['spam.send()', 'buy.now()', 'click_me', 'free.gift()', 'ad.popup()', 'win.prize', 'junk.mail', 'opt.in()', 'hot.deal', 'like.me()'] },
    worm: { name: 'ワーム', hp: 85, power: 12, interval: 6, travel: 10, hue: 20,
      pool: ['worm.copy()', 'self.clone()', 'spread(net)', 'dup.file', 'grow(1)', 'eat.disk', 'crawl()', 'multiply', 'jump.host', 'nest()'] },
    bug: { name: 'バグ', hp: 50, power: 8, interval: 4.8, travel: 9.5, hue: 90,
      pool: ['null.ref', 'err(404)', 'loop()', 'typo.err', 'undef.x', 'nan.val', 'oops()', 'glitch', 'bad.int', 'zero/0'] },
    trojan: { name: 'トロイ', hp: 460, power: 15, interval: 3.4, travel: 9, hue: 280, boss: true,
      pool: ['open.door()', 'gift.box()', 'hide(src)', 'back.door', 'fake.app()', 'sleep(9)', 'wake.up()', 'take.ctrl()', 'mask.on()', 'lure(user)', 'rat.run()', 'install()'] },
    // セクター2
    adware: { name: 'アドウェア', hp: 110, power: 15, interval: 5, travel: 9, hue: 50,
      pool: ['banner.show()', 'popup(99)', 'track.user()', 'cookie.set()', 'redirect(url)', 'inject.ad()', 'auto.play()', 'nag.loop()'] },
    keylog: { name: 'キーロガー', hp: 95, power: 17, interval: 5.5, travel: 8.5, hue: 200,
      pool: ['hook.keys()', 'log.input()', 'send(dump)', 'capture(kbd)', 'read.buf()', 'upload(log)', 'quiet.mode', 'evade(av)'] },
    botnet: { name: 'ボットネット', hp: 140, power: 13, interval: 4.2, travel: 9, hue: 0,
      pool: ['bot.join()', 'zombie.wake()', 'cmd(ctrl)', 'flood(gw)', 'swarm.go()', 'ping.storm', 'relay(c2)', 'mass.req()'] },
    ransom: { name: 'ランサム', hp: 900, power: 22, interval: 3.0, travel: 8.5, hue: 350, boss: true,
      pool: ['encrypt(disk)', 'lock.files()', 'demand(btc)', 'timer.start()', 'delete.backup', 'note.drop()', 'key.hide()', 'spread --lan', 'wipe(shadow)', 'pay.or.lose()'] },
    // セクター3
    rootkit: { name: 'ルートキット', hp: 170, power: 22, interval: 5, travel: 8.5, hue: 260,
      pool: ['hide.proc(1)', 'patch.kernel()', 'hook.syscall()', 'mask(pid)', 'stealth = true;', 'root.access()', 'load.mod(rk)', 'evict(log)'] },
    phantom: { name: 'ファントム', hp: 140, power: 20, interval: 4.5, travel: 8, hue: 180,
      pool: ['fade.out()', 'spoof(ip)', 'mimic(user)', 'ghost.run()', 'vanish(trace)', 'shadow.copy()', 'phase(2)', 'blink.jump()'] },
    zeroday: { name: 'ゼロデイ', hp: 200, power: 26, interval: 5.5, travel: 8, hue: 310,
      pool: ['exploit(cve_0)', 'unknown.vector()', 'overflow(buf)', 'chain.attack()', 'escalate(root)', 'drop.payload()', 'race.cond()', 'bypass(fw)'] },
    chaos: { name: 'カオスコア', hp: 1600, power: 30, interval: 2.8, travel: 8, hue: 300, boss: true,
      pool: ['corrupt(all)', 'entropy++;', 'scramble(mem)', 'tear.down()', 'fork.bomb()', 'void.call()', 'glitch(core)', 'unmake(net)', 'riot.mode()', 'kaos.loop()', 'null.world()', 'break(*);'] },
    // セクター4
    glitch: { name: 'グリッチ', hp: 230, power: 28, interval: 4.5, travel: 7.5, hue: 160,
      pool: ['bit.flip()', 'skew(time)', 'tear(frame)', 'noise(255)', 'desync()', 'jitter(50)', 'warp.addr()', 'mangle(pkt)'] },
    daemon: { name: 'デーモン', hp: 280, power: 30, interval: 5, travel: 7.5, hue: 15,
      pool: ['spawn(child)', 'persist()', 'cron.add(evil)', 'respawn --loop', 'listen(:666)', 'nohup evil &', 'daemonize()', 'fork(9)'] },
    mirror: { name: 'ミラー', hp: 250, power: 27, interval: 4.2, travel: 7.5, hue: 220,
      pool: ['reflect(atk)', 'copy.you()', 'echo.back()', 'swap(role)', 'invert(fw)', 'parrot(cmd)', 'clone.key()', 'mirror.mode'] },
    omega: { name: 'オメガ', hp: 3000, power: 38, interval: 2.5, travel: 7.5, hue: 0, boss: true,
      pool: ['omega.init()', 'delete(world);', 'rewrite(core)', 'end.of.line', 'absorb(all)', 'final.form()', 'shutdown -h now', 'yield null;', 'crash(grid)', 'take.over()', 'kill(guard)', 'zero.fill()'] },
  };

  const SECTORS = [
    { id: 1, name: 'データの森', en: 'DATA FOREST', desc: 'データの木々が生いしげる、ネオグリッドの入口。', theme: 'forest',
      cmd: id => `cd /forest/${id}`, enemies: ['spam', 'worm', 'bug'], boss: 'trojan', tier: 1, hpMul: 1.8, dmgMul: 1, reward: 1 },
    { id: 2, name: 'ファイアウォール山脈', en: 'FIREWALL RIDGE', desc: '燃えるファイアウォールがそびえる山岳地帯。', theme: 'ridge',
      cmd: id => `ssh fw-${id}`, enemies: ['adware', 'keylog', 'botnet'], boss: 'ransom', tier: 2, hpMul: 1.8, dmgMul: 1, reward: 2 },
    { id: 3, name: '深層ネット海溝', en: 'DEEP NET TRENCH', desc: '光のとどかない、データの深海。', theme: 'trench',
      cmd: id => `dive --to ${id}`, enemies: ['rootkit', 'phantom', 'zeroday'], boss: 'chaos', tier: 3, hpMul: 1.8, dmgMul: 1, reward: 3 },
    { id: 4, name: 'コアサーバー', en: 'CORE SERVER', desc: 'ネオグリッドの心臓部。すべての元凶がいる。', theme: 'core',
      cmd: id => `connect("${id}")`, enemies: ['glitch', 'daemon', 'mirror'], boss: 'omega', tier: 3, hpMul: 2.3, dmgMul: 1.15, reward: 4 },
  ];

  // チュートリアル専用ステージ（拠点のセクター一覧には出さない）
  const TUTORIAL = { id: 0, name: 'トレーニング・サーバー', en: 'TRAINING SERVER', desc: '基本を練習するための安全なサーバー。', theme: 'training',
    cmd: id => `cd /training/${id}`, enemies: ['spam', 'bug'], boss: 'spam', tier: 1, hpMul: 1, dmgMul: 1, reward: 0 };

  const NODE_TYPES = {
    lesson: { icon: '✎', name: 'レッスン' },
    exam: { icon: '★', name: '卒業テスト' },
    start: { icon: '▶', name: 'スタート' },
    battle: { icon: '⚠', name: '戦闘' },
    elite: { icon: '☢', name: '強敵' },
    cache: { icon: '◆', name: 'データキャッシュ' },
    repair: { icon: '✚', name: '修復ポイント' },
    boss: { icon: '◉', name: 'ボス' },
  };

  return { ROLES, RARITY, CHARS, VULN, ENEMIES, SECTORS, TUTORIAL, NODE_TYPES, STARTERS: ['bit', 'byte', 'cache'] };
})();
