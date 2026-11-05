// ===== Classroom Timer =====
// Adds a "Classroom Timer" button (top-right of every page) that opens a resizable pop-out window.
// Presets / preferences are saved in this browser (localStorage). Window follows the current theme.
// Load AFTER the other scripts (see index.html).
(function () {
  const LS_P = "ggo-timer-presets", LS_F = "ggo-timer-prefs";
  const read = (k, d) => { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } };
  const write = (k, v) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} };
  let presets = read(LS_P, [60, 120, 180, 300, 600, 900]).map(Number).filter((n) => n > 0);
  let prefs = Object.assign({ chime: true, analog: false }, read(LS_F, {}));

  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (ms) => {
    const s = Math.max(0, Math.ceil(ms / 1000)), h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), x = s % 60;
    return h ? `${h}:${pad(m)}:${pad(x)}` : `${m}:${pad(x)}`;
  };
  /** "2:00" -> 120, "90" -> 90 minutes, "1:30:00" -> 5400. 0 = invalid. */
  function parse(text) {
    const p = String(text).trim().split(":").map(Number);
    if (!p.length || p.some((n) => !isFinite(n) || n < 0)) return 0;
    const s = p.length === 1 ? p[0] * 60 : p.length === 2 ? p[0] * 60 + p[1] : p[0] * 3600 + p[1] * 60 + p[2];
    return Math.round(s);
  }

  // ----- the button on the main page -----
  const css = document.createElement("style");
  css.textContent = `
#ggo-timer-btn { position: fixed; top: 6px; right: 14px; z-index: 9000; background: var(--card); }
@media print { #ggo-timer-btn { display: none !important; } }`;
  document.head.appendChild(css);
  const btn = document.createElement("button");
  btn.id = "ggo-timer-btn";
  btn.type = "button";
  btn.className = "btn btn-ghost btn-small";
  btn.textContent = "Classroom Timer";
  document.body.appendChild(btn);

  let win = null;
  btn.addEventListener("click", () => {
    if (win && !win.closed) { win.focus(); return; }
    win = window.open("", "ggo-classroom-timer", "width=340,height=480,resizable=yes");
    if (!win) { alert("The timer window was blocked. Allow pop-ups for this site and try again."); return; }
    build(win);
  });

  // ----- the pop-out window -----
  function build(w) {
    const d = w.document;
    d.open();
    d.write('<!doctype html><html><head><meta charset="utf-8"><title>Classroom Timer</title><meta name="viewport" content="width=device-width, initial-scale=1"></head><body></body></html>');
    d.close();

    // copy the app's stylesheets (absolute URLs) so every theme works
    document.querySelectorAll('link[rel="stylesheet"]').forEach((l) => {
      const n = d.createElement("link");
      n.rel = "stylesheet";
      n.href = l.href;
      d.head.appendChild(n);
    });
    const st = d.createElement("style");
    st.textContent = `
html, body { height: 100%; }
body { margin: 0; display: flex; flex-direction: column; gap: 8px; padding: 8px; box-sizing: border-box; background: var(--paper); color: var(--ink); font-family: var(--font-body); overflow: hidden; }
body::before { display: none !important; }
.t-tabs { display: flex; flex-wrap: wrap; gap: 4px; flex: none; }
.stage { flex: 1 1 auto; min-height: 70px; container-type: size; display: flex; flex-direction: column; align-items: center; justify-content: center; background: var(--card); border: 1px solid var(--line); border-radius: var(--radius); box-shadow: var(--card-shadow); }
.stage .dg { font-family: var(--font-heading); font-weight: 700; font-size: min(22cqw, 52cqh); line-height: 1; color: var(--green-dark); }
.stage .nm { font-size: min(6cqw, 10cqh); color: var(--ink-soft); margin-top: 2%; }
.stage svg { width: min(88cqw, 82cqh); height: min(88cqw, 82cqh); }
.stage.done .dg, .stage.done svg { color: var(--marker); animation: tblink .7s steps(2) infinite; }
@keyframes tblink { 50% { opacity: .25; } }
.t-row { display: flex; gap: 6px; flex: none; }
.t-row .btn { flex: 1; }
.t-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; flex: none; max-height: 34%; overflow: auto; }
.t-grid .btn { padding: 8px 6px; font-size: 1rem; }
.t-pe { display: flex; gap: 2px; align-items: center; border: 1px solid var(--line); border-radius: var(--radius-small); background: var(--card); padding: 2px; }
.t-pe span { flex: 1; text-align: center; }
.t-add { display: flex; gap: 6px; grid-column: 1 / -1; }
.t-add input { flex: 1; min-width: 0; }`;
    d.head.appendChild(st);

    const el = (tag, cls, text) => { const e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
    const button = (label, cls, fn) => { const b = el("button", cls || "btn btn-ghost btn-small", label); b.type = "button"; b.addEventListener("click", fn); return b; };

    let timers = [mkTimer(1)], sel = 0, nextN = 2, editing = false, ctx = null;
    function mkTimer(n) { return { name: `Timer ${n}`, total: 0, remaining: 0, running: false, endAt: 0, done: false }; }
    const audio = () => {
      try {
        const AC = w.AudioContext || w.webkitAudioContext;
        ctx = ctx || new AC();
        if (ctx.state === "suspended") ctx.resume();
      } catch (e) {}
    };
    function chime() {
      if (!prefs.chime) return;
      audio();
      if (!ctx) return;
      [0, 0.4, 0.8].forEach((o, i) => {
        const osc = ctx.createOscillator(), g = ctx.createGain(), t = ctx.currentTime + o;
        osc.frequency.value = 880 + i * 220;
        osc.connect(g); g.connect(ctx.destination);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.3, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
        osc.start(t); osc.stop(t + 0.4);
      });
    }

    const tabs = el("div", "t-tabs");
    const stage = el("div", "stage");
    const controls = el("div", "t-row");
    const grid = el("div", "t-grid");
    const foot = el("div", "t-row");
    d.body.append(tabs, stage, controls, grid, foot);

    let tabBtns = [], startBtn = null;

    function renderTabs() {
      tabs.textContent = ""; tabBtns = [];
      timers.forEach((t, i) => {
        const b = button("", "btn btn-small " + (i === sel ? "btn-primary" : "btn-ghost"), () => { sel = i; renderAll(); });
        tabBtns.push(b); tabs.appendChild(b);
      });
      tabs.appendChild(button("+", "btn btn-ghost btn-small", () => { timers.push(mkTimer(nextN++)); sel = timers.length - 1; renderAll(); }));
      if (timers.length > 1) tabs.appendChild(button("Remove", "btn btn-ghost btn-small", () => { timers.splice(sel, 1); sel = Math.max(0, sel - 1); renderAll(); }));
    }
    function renderControls() {
      controls.textContent = "";
      startBtn = button("Start", "btn btn-primary", () => {
        audio();
        const t = timers[sel];
        if (t.running) { t.remaining = Math.max(0, t.endAt - Date.now()); t.running = false; }
        else {
          if (t.remaining <= 0) t.remaining = t.total;
          if (t.remaining <= 0) return;
          t.done = false; t.endAt = Date.now() + t.remaining; t.running = true;
        }
        paint();
      });
      controls.append(startBtn, button("Reset", "btn btn-ghost", () => {
        const t = timers[sel]; t.running = false; t.done = false; t.remaining = t.total; paint();
      }));
    }
    function renderGrid() {
      grid.textContent = "";
      presets.forEach((sec, i) => {
        if (!editing) {
          grid.appendChild(button(fmt(sec * 1000), "btn btn-ghost", () => {
            audio();
            const t = timers[sel];
            t.total = t.remaining = sec * 1000; t.done = false; t.endAt = Date.now() + t.remaining; t.running = true;
            paint();
          }));
          return;
        }
        const box = el("div", "t-pe");
        const mv = (dir) => { const j = i + dir; if (j < 0 || j >= presets.length) return; [presets[i], presets[j]] = [presets[j], presets[i]]; write(LS_P, presets); renderGrid(); };
        box.append(button("◀", "btn btn-ghost btn-small", () => mv(-1)), el("span", "", fmt(sec * 1000)), button("▶", "btn btn-ghost btn-small", () => mv(1)),
          button("✕", "btn btn-ghost btn-small", () => { presets.splice(i, 1); write(LS_P, presets); renderGrid(); }));
        grid.appendChild(box);
      });
      if (editing) {
        const add = el("div", "t-add");
        const inp = el("input"); inp.type = "text"; inp.placeholder = "e.g. 2:00 or 10 (minutes)";
        const go = () => { const s = parse(inp.value); if (!s) { inp.focus(); return; } presets.push(s); write(LS_P, presets); renderGrid(); };
        inp.addEventListener("keydown", (e) => { if (e.key === "Enter") go(); });
        add.append(inp, button("Add", "btn btn-primary btn-small", go));
        grid.appendChild(add);
      }
    }
    function renderFoot() {
      foot.textContent = "";
      foot.append(
        button(`Chime: ${prefs.chime ? "On" : "Off"}`, "btn btn-ghost btn-small", () => { prefs.chime = !prefs.chime; write(LS_F, prefs); if (prefs.chime) { audio(); } renderFoot(); }),
        button(`Display: ${prefs.analog ? "Analogue" : "Digital"}`, "btn btn-ghost btn-small", () => { prefs.analog = !prefs.analog; write(LS_F, prefs); renderFoot(); paint(); }),
        button(editing ? "Done" : "Edit presets", "btn btn-ghost btn-small", () => { editing = !editing; renderFoot(); renderGrid(); })
      );
    }
    function renderAll() { renderTabs(); renderControls(); renderGrid(); renderFoot(); paint(); }

    function paint() {
      timers.forEach((t, i) => { if (tabBtns[i]) tabBtns[i].textContent = `${t.name} · ${fmt(t.remaining)}`; });
      const t = timers[sel];
      if (startBtn) startBtn.textContent = t.running ? "Pause" : "Start";
      stage.classList.toggle("done", t.done);
      if (!prefs.analog) {
        stage.innerHTML = `<div class="dg">${fmt(t.remaining)}</div><div class="nm"></div>`;
      } else {
        const frac = t.total > 0 ? Math.min(1, t.remaining / t.total) : 0, a = frac * 2 * Math.PI;
        const x = 50 + 42 * Math.sin(a), y = 50 - 42 * Math.cos(a);
        const wedge = frac >= 0.9999 ? `<circle cx="50" cy="50" r="42" style="fill:var(--green);opacity:.45"/>`
          : frac > 0 ? `<path d="M50 50 L50 8 A42 42 0 ${frac > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)} Z" style="fill:var(--green);opacity:.45"/>` : "";
        let ticks = "";
        for (let k = 0; k < 12; k++) { const r = (k * Math.PI) / 6; ticks += `<line x1="${50 + 38 * Math.sin(r)}" y1="${50 - 38 * Math.cos(r)}" x2="${50 + 42 * Math.sin(r)}" y2="${50 - 42 * Math.cos(r)}" stroke="currentColor" stroke-width="1"/>`; }
        stage.innerHTML = `<svg viewBox="0 0 100 100" style="color:var(--ink)"><circle cx="50" cy="50" r="44" style="fill:none;stroke:var(--line)" stroke-width="1.5"/>${wedge}${ticks}<line x1="50" y1="50" x2="${x.toFixed(2)}" y2="${y.toFixed(2)}" style="stroke:var(--green-dark)" stroke-width="2" stroke-linecap="round"/><circle cx="50" cy="50" r="2.5" style="fill:var(--green-dark)"/><text x="50" y="72" text-anchor="middle" font-size="9" style="fill:var(--ink);font-family:var(--font-heading)">${fmt(t.remaining)}</text></svg>`;
      }
    }

    // ticking (runs inside the pop-out window) + theme sync
    w.setInterval(() => {
      const now = Date.now();
      timers.forEach((t) => {
        if (!t.running) return;
        t.remaining = t.endAt - now;
        if (t.remaining <= 0) { t.remaining = 0; t.running = false; t.done = true; chime(); }
      });
      const root = d.documentElement, src = document.documentElement;
      ["data-theme", "data-textsize"].forEach((a) => {
        const v = src.getAttribute(a);
        if (v) root.setAttribute(a, v); else root.removeAttribute(a);
      });
      paint();
    }, 250);

    renderAll();
  }
})();
