// Turf Clash on-screen overlay (DOM, styled by styles/turf.css): arena title card, READY? / GO!,
// the last-minute banner, final countdown numbers, FINISH! and the judging caption. Lives next to
// the HUD in #hud-root so hiding the HUD during cutscenes keeps the overlay visible.
export class TurfOverlay {
  constructor() {
    const root = this.root = document.createElement('div');
    root.className = 'turf-ovl';
    root.innerHTML = `
      <div class="turf-title hidden">
        <div class="tt-kicker">TURF CLASH</div>
        <div class="tt-name"></div>
        <div class="tt-rule">Ink the most ground in 3 minutes!</div>
        <div class="tt-teams"><span class="tt-team a">ALPHA</span><span class="tt-vs">VS</span><span class="tt-team b">BRAVO</span></div>
      </div>
      <div class="turf-big"></div>
      <div class="turf-count"></div>
      <div class="turf-caption hidden"></div>`;
    (document.getElementById('hud-root') || document.body).appendChild(root);
    this.el = {
      title: root.querySelector('.turf-title'), name: root.querySelector('.tt-name'),
      big: root.querySelector('.turf-big'), count: root.querySelector('.turf-count'), caption: root.querySelector('.turf-caption'),
    };
    this._bigT = null;
  }

  setColors(a, b) {
    this.root.style.setProperty('--turf-a', a);
    this.root.style.setProperty('--turf-b', b);
    document.documentElement.style.setProperty('--turf-a', a);
    document.documentElement.style.setProperty('--turf-b', b);
  }

  title(name) {
    this.el.name.textContent = name;
    this.el.title.classList.remove('hidden', 'out');
    void this.el.title.offsetWidth;
    this.el.title.classList.add('in');
  }

  hideTitle() {
    this.el.title.classList.add('out');
    setTimeout(() => this.el.title.classList.add('hidden'), 400);
  }

  /** Big centred word (READY?, GO!, FINISH!, 1 MINUTE LEFT!). kind: ready | go | finish | warn */
  big(text, kind = 'ready', secs = 1.2) {
    const b = this.el.big;
    b.textContent = text;
    b.className = `turf-big show ${kind}`;
    clearTimeout(this._bigT);
    if (secs > 0) this._bigT = setTimeout(() => { b.className = 'turf-big'; }, secs * 1000);
    else b.classList.add('stay');
  }

  count(n) {
    const c = this.el.count;
    c.textContent = String(n);
    c.className = 'turf-count';
    void c.offsetWidth;
    c.className = `turf-count show${n <= 3 ? ' hot' : ''}`;
  }

  caption(text, kind = '') {
    const c = this.el.caption;
    if (!text) { c.classList.add('hidden'); return; }
    c.textContent = text;
    c.className = `turf-caption ${kind}`;
  }

  dispose() {
    clearTimeout(this._bigT);
    this.root.remove();
  }
}
