// ===== Study Item Coding Tool — two-pane coding screen =====
// Shared by researcher.html (the researcher's login page) and the owner's
// "Code it yourself" preview, so both sides look and behave identically.
//
// CodingUI.mount(root, adapter)
//   adapter = {
//     meta:  { title, config, item_count, label, coded },
//     fetch: async (from, count) => [{ idx, data, codes, note }],
//     save:  async (idx, codes, note) => void (throws on failure),
//     extraButtons: [{ label, onClick }]   // e.g. "Back to editing"
//   }
const CodingUI = {
  _esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  },

  css: `
  .cu{display:flex;flex-direction:column;gap:10px;font-family:var(--font-body,inherit);color:var(--ink)}
  .cu-bar{display:flex;flex-wrap:wrap;align-items:center;gap:8px 12px}
  .cu-bar h2{margin:0;font-family:var(--font-heading,inherit);font-size:1.15rem;flex:1 1 auto}
  .cu-prog{flex:1 1 180px;min-width:140px}
  .cu-prog .t{font-size:.85rem;color:var(--ink-soft,#777)}
  .cu-prog .b{height:7px;border-radius:4px;background:var(--line,#ddd);overflow:hidden;margin-top:3px}
  .cu-prog .b i{display:block;height:100%;background:var(--green,#2f5233);width:0}
  .cu-instr{font-size:.9rem;background:var(--card,#fff);border:1px solid var(--line,#ddd);border-radius:8px;padding:8px 12px;white-space:pre-wrap}
  .cu-main{display:grid;grid-template-columns:minmax(0,1.25fr) minmax(0,1fr);gap:12px;min-height:340px}
  @media(max-width:760px){.cu-main{grid-template-columns:1fr}}
  .cu-pane{background:var(--card,#fff);border:1px solid var(--line,#ddd);border-radius:10px;padding:14px;display:flex;flex-direction:column;gap:10px;min-width:0}
  .cu-pane h3{margin:0;font-size:.8rem;text-transform:uppercase;letter-spacing:.06em;color:var(--ink-soft,#777)}
  .cu-who{font-weight:700}
  .cu-ctx{font-size:.85rem;color:var(--ink-soft,#777)}
  .cu-ctx b{color:var(--ink)}
  .cu-resp{flex:1;overflow:auto;max-height:55vh;white-space:pre-wrap;word-break:break-word;line-height:1.6;font-size:1.05rem;border-top:1px solid var(--line,#ddd);padding-top:10px}
  .cu-codes{display:flex;flex-direction:column;gap:6px;overflow:auto;max-height:55vh}
  .cu-code{display:flex;gap:8px;align-items:flex-start;text-align:left;font:inherit;color:inherit;cursor:pointer;background:transparent;border:1.5px solid var(--line,#ddd);border-radius:8px;padding:8px 10px}
  .cu-code:hover{border-color:var(--green,#2f5233)}
  .cu-code.on{background:var(--green,#2f5233);border-color:var(--green,#2f5233);color:#fff}
  .cu-code kbd{font:600 .75rem monospace;border:1px solid currentColor;border-radius:4px;padding:0 5px;opacity:.7;flex:none}
  .cu-code .l{font-weight:600}
  .cu-code .d{display:block;font-size:.82rem;opacity:.8;font-weight:400}
  .cu-code .d i{font-style:normal;font-weight:600}
  .cu-dim{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;font-weight:700;color:var(--green-dark,#223d26);margin:8px 0 0;border-bottom:1px solid var(--line,#ddd);padding-bottom:2px}
  .cu-dim:first-child{margin-top:0}
  .cu-r2{border-top:1px dashed var(--line,#ddd);margin-top:12px;padding-top:12px}
  .cu-col{font-size:.72rem;text-transform:uppercase;letter-spacing:.05em;color:var(--ink-soft,#777);margin-bottom:2px}
  .cu-tgt.multi{border:1.5px solid var(--line,#ddd);border-radius:8px;padding:10px;margin-bottom:10px;cursor:pointer}
  .cu-tgt.multi.act{border-color:var(--green,#2f5233);box-shadow:0 0 0 2px color-mix(in srgb,var(--green,#2f5233) 25%,transparent)}
  .cu-tgt .cu-th{font-size:.78rem;text-transform:uppercase;letter-spacing:.06em;font-weight:700;color:var(--green-dark,#223d26);margin-bottom:4px}
  .cu-tgt.ok .cu-th{color:var(--green,#2f5233)}
  .cu-note{width:100%;font:inherit;border:1.5px solid var(--line,#ddd);border-radius:8px;padding:8px;background:var(--paper,#fff);color:var(--ink);resize:vertical;min-height:54px}
  .cu-nav{display:flex;flex-wrap:wrap;align-items:center;gap:8px}
  .cu-nav .sp{flex:1}
  .cu button.b{font:inherit;font-weight:600;padding:8px 14px;border-radius:8px;border:1.5px solid var(--green,#2f5233);background:var(--green,#2f5233);color:#fff;cursor:pointer}
  .cu button.b.g{background:transparent;color:var(--green,#2f5233)}
  .cu button.b:disabled{opacity:.45;cursor:default}
  .cu-st{font-size:.85rem;min-width:70px;color:var(--ink-soft,#777)}
  .cu-st.bad{color:#b3261e}
  .cu label.f{font-size:.85rem;display:flex;gap:5px;align-items:center}
  .cu input[type=number]{width:70px;font:inherit;padding:5px;border:1.5px solid var(--line,#ddd);border-radius:6px;background:var(--paper,#fff);color:var(--ink)}
  `,

  // ----- targets: each row can hold several things to code ("targets"), each made of one or more linked columns -----
  targetsOf(cfg) {
    if (cfg.targets && cfg.targets.length) return cfg.targets;
    return [{ id: "t0", label: "", cols: [cfg.responseCol, cfg.responseCol2].filter(Boolean) }];
  },
  // Stored format (no database change): codes of the first target are plain ids, others are "targetId|codeId";
  // notes are plain text for the first target alone, otherwise a JSON object keyed by target id.
  decode(cfg, codes, note) {
    const T = this.targetsOf(cfg), first = T[0].id, st = {};
    T.forEach((t) => { st[t.id] = { codes: [], note: "" }; });
    (codes || []).forEach((c) => {
      c = String(c); const k = c.indexOf("|"), tid = k > 0 ? c.slice(0, k) : first, id = k > 0 ? c.slice(k + 1) : c;
      if (st[tid]) st[tid].codes.push(id);
    });
    let n = note || "";
    if (n[0] === "{") { try { const o = JSON.parse(n); Object.keys(o).forEach((k) => { if (st[k]) st[k].note = String(o[k]); }); n = null; } catch (e) {} }
    if (n !== null) st[first].note = n;
    return st;
  },
  encode(cfg, st) {
    const T = this.targetsOf(cfg), first = T[0].id, codes = [];
    T.forEach((t) => ((st[t.id] || {}).codes || []).forEach((id) => codes.push(t.id === first ? id : t.id + "|" + id)));
    const wn = T.filter((t) => st[t.id] && st[t.id].note);
    let note = "";
    if (wn.length === 1 && wn[0].id === first && st[first].note[0] !== "{") note = st[first].note;
    else if (wn.length) { const o = {}; wn.forEach((t) => { o[t.id] = st[t.id].note; }); note = JSON.stringify(o); }
    return { codes, note };
  },

  mount(root, adapter) {
    const E = this._esc, self = this;
    const meta = adapter.meta, cfg = meta.config || {};
    const codes = cfg.codes || [];
    const T = this.targetsOf(cfg), multiT = T.length > 1;
    const total = meta.item_count || 0;
    const cache = new Map(); // idx -> item (with .st = per-target state)
    const PAGE = 200;
    let pos = 0, ai = 0, onlyUncoded = false, saveTimer = null, dirty = false;
    let doneCount = meta.coded || 0;

    if (!document.getElementById("cu-css")) {
      const st = document.createElement("style"); st.id = "cu-css"; st.textContent = this.css; document.head.appendChild(st);
    }
    root.innerHTML = `<div class="cu">
      <div class="cu-bar"><h2>${E(meta.title)}</h2>
        <div class="cu-prog"><div class="t"></div><div class="b"><i></i></div></div>
        <label class="f"><input type="checkbox" class="u"> Uncoded only</label>
        <span class="x"></span></div>
      ${cfg.instructions ? `<div class="cu-instr">${E(cfg.instructions)}</div>` : ""}
      <div class="cu-main">
        <div class="cu-pane"><h3>Participant response</h3><div class="cu-head"></div><div class="cu-resp"></div></div>
        <div class="cu-pane"><h3 class="cu-ch"></h3><div class="cu-codes"></div>
          ${cfg.allowNote ? `<textarea class="cu-note" placeholder="Note (optional)"></textarea>` : ""}</div>
      </div>
      <div class="cu-nav"><button class="b g prev" type="button">← Previous</button>
        <button class="b next" type="button">Next →</button>
        <span class="cu-st"></span><span class="sp"></span>
        <label class="f">Go to # <input type="number" class="go" min="1" max="${total}"></label></div>
    </div>`;
    const $ = (s) => root.querySelector(s);
    const extra = $(".x");
    (adapter.extraButtons || []).forEach((b) => {
      const el = document.createElement("button"); el.type = "button"; el.className = "b g"; el.textContent = b.label;
      el.onclick = b.onClick; extra.appendChild(el);
    });
    const setSt = (t, bad) => { const s = $(".cu-st"); s.textContent = t; s.className = "cu-st" + (bad ? " bad" : ""); };

    const itemAt = (i) => cache.get(i);
    async function ensure(i) {
      if (cache.has(i)) return true;
      const from = Math.floor(i / PAGE) * PAGE;
      try {
        const items = await adapter.fetch(from, PAGE);
        items.forEach((it) => cache.set(it.idx, { ...it, st: self.decode(cfg, it.codes, it.note) }));
        return cache.has(i);
      } catch (e) { setSt("Load failed", true); return false; }
    }
    const tCoded = (it, t) => !!(it.st[t.id] && it.st[t.id].codes.length);
    const isCoded = (it) => !!it && T.every((t) => tCoded(it, t));
    function recount() {
      let n = 0; cache.forEach((it) => { if (isCoded(it)) n++; });
      if (cache.size >= total) doneCount = n; else doneCount = Math.max(n, doneCount);
      $(".cu-prog .t").textContent = `${doneCount} of ${total} coded`;
      $(".cu-prog i").style.width = total ? Math.min(100, (doneCount / total) * 100) + "%" : "0";
    }

    async function flush() {
      if (!dirty) return;
      clearTimeout(saveTimer); dirty = false;
      const it = itemAt(pos); if (!it) return;
      setSt("Saving…");
      const enc = self.encode(cfg, it.st);
      try { await adapter.save(it.idx, enc.codes, enc.note); setSt("Saved"); }
      catch (e) { dirty = true; setSt("Not saved — retry", true); throw e; }
    }
    function queue() { dirty = true; clearTimeout(saveTimer); saveTimer = setTimeout(() => flush().catch(() => {}), 600); }

    function drawTargets(it) {
      const d = it.data || {}, rs = $(".cu-resp"); rs.textContent = "";
      T.forEach((t, k) => {
        const blk = document.createElement("div");
        blk.className = "cu-tgt" + (multiT ? " multi" : "") + (k === ai ? " act" : "") + (multiT && tCoded(it, t) ? " ok" : "");
        if (multiT) blk.onclick = () => { ai = k; drawTargets(it); drawCodes(it); };
        if (multiT) { const h = document.createElement("div"); h.className = "cu-th"; h.textContent = (t.label || `Item ${k + 1}`) + (tCoded(it, t) ? " ✓" : ""); blk.appendChild(h); }
        t.cols.forEach((col, j) => {
          const w = document.createElement("div"); if (j) w.className = "cu-r2";
          if (t.cols.length > 1) { const h = document.createElement("div"); h.className = "cu-col"; h.textContent = col; w.appendChild(h); }
          const tx = document.createElement("div"); tx.textContent = d[col] == null ? "" : String(d[col]); w.appendChild(tx); blk.appendChild(w);
        });
        rs.appendChild(blk);
      });
    }
    function drawCodes(it) {
      const cur = it.st[T[ai].id];
      $(".cu-ch").textContent = (multiT ? `Codes for “${T[ai].label || "Item " + (ai + 1)}” ` : "Codes ") + (cfg.mode === "complex" ? "(add every code that applies)" : "(choose one)");
      const box = $(".cu-codes"); box.innerHTML = "";
      let lastDim = null;
      codes.forEach((c, n) => {
        if (cfg.mode === "complex" && (c.dimension || "") !== lastDim) {
          lastDim = c.dimension || "";
          if (lastDim) { const h = document.createElement("div"); h.className = "cu-dim"; h.textContent = lastDim; box.appendChild(h); }
        }
        const b = document.createElement("button"); b.type = "button";
        b.className = "cu-code" + (cur.codes.includes(c.id) ? " on" : "");
        b.innerHTML = `<kbd>${n < 9 ? n + 1 : ""}</kbd><span><span class="l">${E(c.label)}</span>${c.description ? `<span class="d">${E(c.description)}</span>` : ""}${c.include ? `<span class="d"><i>Include:</i> ${E(c.include)}</span>` : ""}${c.exclude ? `<span class="d"><i>Exclude:</i> ${E(c.exclude)}</span>` : ""}</span>`;
        b.onclick = () => toggle(c.id);
        box.appendChild(b);
      });
      const nt = $(".cu-note"); if (nt) nt.value = cur.note;
    }

    async function show(i, target) {
      if (i < 0 || i >= total) return;
      try { await flush(); } catch (e) { return; }
      if (!(await ensure(i))) return;
      pos = i;
      const it = itemAt(i), d = it.data || {};
      if (target == null) { const f = T.findIndex((t) => !tCoded(it, t)); target = f < 0 ? 0 : f; }
      ai = target;
      const ctx = (cfg.contextCols || []).filter((c) => d[c] != null && d[c] !== "");
      $(".cu-head").innerHTML = `<div class="cu-who">${cfg.participantCol ? E(d[cfg.participantCol]) : "Item " + (i + 1)} <span class="cu-ctx">· item ${i + 1} of ${total}</span></div>` +
        (ctx.length ? `<div class="cu-ctx">${ctx.map((c) => `<b>${E(c)}:</b> ${E(d[c])}`).join(" &nbsp; ")}</div>` : "");
      drawTargets(it); drawCodes(it);
      $(".go").value = i + 1;
      $(".prev").disabled = i === 0; $(".next").disabled = i >= total - 1;
      recount();
    }
    function toggle(id) {
      const it = itemAt(pos); if (!it) return;
      const cur = it.st[T[ai].id], has = cur.codes.includes(id);
      if (cfg.mode === "complex" || cfg.multi) cur.codes = has ? cur.codes.filter((x) => x !== id) : [...cur.codes, id];
      else cur.codes = has ? [] : [id];
      root.querySelectorAll(".cu-code").forEach((b, n) => b.classList.toggle("on", cur.codes.includes(codes[n].id)));
      drawTargets(it); recount(); queue();
      if (cfg.mode !== "complex" && !cfg.multi && cur.codes.length) {
        // single-code style: move on by itself — to the row's next uncoded item, else the next row
        setTimeout(() => {
          if (itemAt(pos) !== it) return;
          const nx = T.findIndex((t, k) => k !== ai && !tCoded(it, t));
          if (nx >= 0) { ai = nx; drawTargets(it); drawCodes(it); } else if (!onlyUncoded) step(1);
        }, 250);
      }
    }
    async function step(dir) {
      let i = pos + dir;
      if (onlyUncoded) {
        while (i >= 0 && i < total) {
          if (!(await ensure(i))) return;
          if (!isCoded(itemAt(i))) break;
          i += dir;
        }
        if (i < 0 || i >= total) { setSt("No more uncoded"); return; }
      }
      show(i);
    }

    $(".prev").onclick = () => step(-1);
    $(".next").onclick = () => step(1);
    $(".u").onchange = (e) => { onlyUncoded = e.target.checked; };
    $(".go").onchange = (e) => { const n = parseInt(e.target.value, 10); if (n >= 1 && n <= total) show(n - 1); };
    const nt = $(".cu-note");
    if (nt) nt.oninput = () => { const it = itemAt(pos); if (it) { it.st[T[ai].id].note = nt.value; queue(); } };
    const keyHandler = (e) => {
      if (!root.isConnected) return document.removeEventListener("keydown", keyHandler);
      const tag = (e.target.tagName || "").toLowerCase();
      if (tag === "textarea" || tag === "input" || e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === "ArrowRight") step(1);
      else if (e.key === "ArrowLeft") step(-1);
      else if (e.key === "ArrowDown" && multiT) { e.preventDefault(); const it = itemAt(pos); ai = (ai + 1) % T.length; drawTargets(it); drawCodes(it); }
      else if (e.key === "ArrowUp" && multiT) { e.preventDefault(); const it = itemAt(pos); ai = (ai + T.length - 1) % T.length; drawTargets(it); drawCodes(it); }
      else if (/^[1-9]$/.test(e.key) && codes[+e.key - 1]) toggle(codes[+e.key - 1].id);
    };
    document.addEventListener("keydown", keyHandler);
    window.addEventListener("beforeunload", () => { if (dirty) flush().catch(() => {}); });

    if (!total) { $(".cu-resp").textContent = "No items have been uploaded for this tool yet."; return { flush }; }
    (async () => {
      recount();
      for (let i = 0; i < total; i++) { if (!(await ensure(i))) break; if (!isCoded(itemAt(i))) { pos = i; break; } }
      show(pos);
    })();
    return { flush };
  },
};
