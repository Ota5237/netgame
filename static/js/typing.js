// 複数の「打てる対象」を同時に扱う入力判定（マップの分岐・バトルのパケット/弱点/スキル）
// 打った文字列が前方一致する対象だけが残り、どれかと完全一致した時点で確定する。
window.MultiTyper = class MultiTyper {
  constructor() {
    this.buf = '';
    this.targets = new Map(); // id -> { id, text, kind, data }
  }
  add(id, text, kind, data) { this.targets.set(id, { id, text, kind, data }); }
  remove(id) { this.targets.delete(id); this.sync(); }
  clear() { this.targets.clear(); this.buf = ''; }
  reset() { this.buf = ''; }
  has(id) { return this.targets.has(id); }
  list() { return [...this.targets.values()]; }
  usedFirstChars() { return new Set(this.list().map(t => t.text[0])); }

  candidates(buf = this.buf) { return this.list().filter(t => t.text.startsWith(buf)); }

  // 狙っている対象がなくなったら入力をリセット
  sync() { if (this.buf && !this.candidates().length) this.buf = ''; }

  // 次に打つべき文字（ミス集計用。候補が1つに絞れている時だけ）
  expected() {
    const c = this.candidates();
    return this.buf && c.length === 1 ? c[0].text[this.buf.length] : '';
  }

  // 戻り値: { type: 'ok' | 'miss' | 'done', target }
  input(ch) {
    const nb = this.buf + ch;
    const m = this.candidates(nb);
    if (!m.length) return { type: 'miss' };
    this.buf = nb;
    const done = m.find(t => t.text === nb);
    if (done) { this.buf = ''; return { type: 'done', target: done }; }
    return { type: 'ok' };
  }

  // 対象の表示用 HTML（打った部分を色分け）
  render(t, esc) {
    if (this.buf && t.text.startsWith(this.buf)) {
      return `<span class="typed">${esc(this.buf)}</span><span class="rest">${esc(t.text.slice(this.buf.length))}</span>`;
    }
    return `<span class="rest">${esc(t.text)}</span>`;
  }
};
