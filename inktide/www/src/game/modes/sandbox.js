// Sandbox mode: free play in any stage (test rooms, and the fallback while a stage's real mode is
// not available). No completion. Implements the story-mode hooks entities call defensively
// (dialogue, objective, addPearls, collectPostcard, checkpoint, complete) in a lightweight way so
// every stage object still gives feedback.
export class SandboxMode {
  constructor(app, stageId = null, opts = {}) {
    this.app = app;
    this.stageId = stageId;
    this.opts = opts;
    this.kind = 'sandbox';
    this.session = null;
  }

  start(session) {
    this.session = session;
    session.hud?.setObjective('Free play');
    session.hud?.hint?.('{fire} shoot · {swim} swim · {jump} jump', 5);
  }

  respawnPoint(session) { return session.spawnPoint; }

  step(session, dt) { void session; void dt; }

  update(session, dt) { void session; void dt; }

  // ---- hooks used by stage entities (all optional in the contract) ----
  objective(text) { this.session?.hud?.setObjective(text || 'Free play'); }

  addPearls(n = 1) {
    const s = this.session;
    if (!s) return;
    s.pearls = (s.pearls || 0) + n;
  }

  collectPostcard(id) {
    this.session?.hud?.toast('Lost Postcard found!', 'normal');
    void id;
  }

  checkpoint(pos, yaw) { this.session?.setCheckpoint(pos, yaw); }

  /**
   * Dialogue in sandbox: show the first line as a toast and resolve right away. Ids from
   * story/script.js (NPCs and triggers in test rooms use them) resolve through its resolveLines.
   */
  async dialogue(idOrLines) {
    let lines = Array.isArray(idOrLines) ? idOrLines : idOrLines?.lines;
    if (!lines && typeof idOrLines === 'string') {
      try { lines = (await import('../../story/script.js')).resolveLines?.(idOrLines)?.lines; } catch { lines = null; }
    }
    const first = (lines || []).find((l) => l && l.text);
    if (first && this.session) this.session.hud?.toast(String(first.text).replace(/[{}*]/g, ''), 'normal');
  }

  async cutscene(fn) {
    const cs = {
      camera: () => Promise.resolve(),
      say: (lines) => this.dialogue(lines),
      wait: (s) => new Promise((r) => setTimeout(r, (s || 0) * 1000)),
    };
    try { await fn?.(cs); } catch (e) { console.warn('sandbox cutscene', e); }
  }

  complete() {
    this.session?.hud?.toast('Stage clear! (free play)', 'big');
    this.session?.audio?.sfx('victory', { volume: 0.7 });
  }

  dispose() { this.session = null; }
}
