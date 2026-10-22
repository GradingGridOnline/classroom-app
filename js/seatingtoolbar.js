// ===== Seating Chart toolbar: split buttons, Set Up Desks, new Auto-Fill choices =====
// Load AFTER app.js. Replaces the Rows / Columns / Apply Size / Trim / Auto-Fill / Auto-Fill (Numerical)
// buttons with two split buttons (a main action plus a ▾ menu on its right edge):
//   [Set Up Desks | ▾ Trim Unused Desks]      [Auto-Fill | ▾ Numerical Order — Columns / Rows]

(function () {
  const S = SeatingModule;
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const say = (t) => { const s = $("seating-status"); if (s) s.textContent = t; };
  const redrawChart = () => { try { renderSeating(); } catch (e) {} };

  // ---------- seating logic ----------
  const isSeated = (r, c) => !!S.seats[S.key(r, c)] && S.isActive(r, c);
  const freeDesk = (r, c) => S.isActive(r, c) && !S.studentAt(r, c) && !S.getLabel(r, c);
  const eligible = () => {
    const seated = S.seatedStudentIds();
    return RosterModule.students.filter((st) => !seated.has(st.id) && !st.excludeFromSeating);
  };
  const shuffle = (list) => {
    const a = [...list];
    for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  };

  const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const NEIGHBORS = [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]];
  const parseKey = (k) => k.split("-").map(Number);
  const adjacent = (k1, k2) => { const [r1, c1] = parseKey(k1), [r2, c2] = parseKey(k2); return Math.max(Math.abs(r1 - r2), Math.abs(c1 - c2)) <= 1; };

  /** Where each student currently sits: id -> desk key. */
  const seatMap = () => { const m = new Map(); for (const k in S.seats) m.set(S.seats[k], k); return m; };
  /** Complete separation pairs (both students chosen, different, still on the roster and not excluded). */
  S.activeSeparations = function () {
    const ok = new Set(RosterModule.students.filter((st) => !st.excludeFromSeating).map((st) => st.id));
    return (this.separations || []).filter((p) => p[0] && p[1] && p[0] !== p[1] && ok.has(p[0]) && ok.has(p[1]));
  };
  S.maxSeparations = function () {
    return Math.floor(RosterModule.students.filter((st) => !st.excludeFromSeating).length / 2);
  };

  /**
   * Random seating of `students` onto free desks. Rules:
   *  - students in a Keep-Apart pair always end up at least one empty desk apart (not touching, even diagonally);
   *  - students who sat next to each other in an earlier random Auto-Fill are not put next to each other again,
   *    until no such arrangement is possible any more — then that memory starts over;
   *  - if there are more free desks than students, the unused ones are at the back of the room.
   * Returns { seated, apartFailed: [names], cycled: bool }.
   */
  S.autoFillRandom = function (students) {
    const desks = [];
    for (let r = this.rows - 1; r >= 0; r--) for (let c = 0; c < this.cols; c++) if (freeDesk(r, c)) desks.push(this.key(r, c));
    const pairs = this.activeSeparations();
    const partners = new Map();
    pairs.forEach(([a, b]) => { (partners.get(a) || partners.set(a, []).get(a)).push(b); (partners.get(b) || partners.set(b, []).get(b)).push(a); });

    const attempt = (deskSet, useHistory, hist) => {
      const placed = new Map(seatMap());               // id -> key (existing seats + new ones)
      const occupant = new Map(Object.entries(this.seats).map(([k, id]) => [k, id]));
      const open = new Set(deskSet);
      const result = [];
      // students with partners first: they are the hardest to place
      const order = shuffle(students).sort((x, y) => (partners.has(y.id) ? 1 : 0) - (partners.has(x.id) ? 1 : 0));
      for (const st of order) {
        const cands = [];
        for (const k of open) {
          let ok = true;
          for (const pid of partners.get(st.id) || []) { const pk = placed.get(pid); if (pk && adjacent(k, pk)) { ok = false; break; } }
          if (ok && useHistory) {
            const [r, c] = parseKey(k);
            for (const [dr, dc] of NEIGHBORS) {
              const other = occupant.get(`${r + dr}-${c + dc}`);
              if (other && hist.has(pairKey(st.id, other))) { ok = false; break; }
            }
          }
          if (ok) cands.push(k);
        }
        if (!cands.length) return null;
        const pick = cands[Math.floor(Math.random() * cands.length)];
        open.delete(pick); placed.set(st.id, pick); occupant.set(pick, st.id); result.push([pick, st.id]);
      }
      return result;
    };
    const tryMany = (deskSet, useHistory, hist, tries) => {
      for (let i = 0; i < tries; i++) { const r = attempt(deskSet, useHistory, hist); if (r) return r; }
      return null;
    };

    const front = desks.slice(0, students.length);
    let hist = new Set(this.neighborHistory || []);
    let cycled = false;
    let result = tryMany(front, true, hist, 300);
    if (!result && hist.size) { // every arrangement avoiding the old neighbors has been used: start the memory over
      cycled = true; hist = new Set();
      result = tryMany(front, false, hist, 300);
    }
    if (!result && desks.length > front.length) result = tryMany(desks, false, hist, 300); // keep-apart pairs may need desks further back
    let apartFailed = [];
    if (!result) { // no way to keep every pair apart: seat anyway, and say which pairs touch
      const order = shuffle(students);
      result = front.map((k, i) => [k, order[i].id]);
    }
    result.forEach(([k, id]) => { this.seats[k] = id; });
    const pos = seatMap();
    pairs.forEach(([a, b]) => {
      if (pos.has(a) && pos.has(b) && adjacent(pos.get(a), pos.get(b))) {
        const nm = (id) => (RosterModule.students.find((x) => x.id === id) || {}).name || "?";
        apartFailed.push(`${nm(a)} & ${nm(b)}`);
      }
    });
    // remember who is next to whom now
    const keep = cycled ? new Set() : new Set(this.neighborHistory || []);
    const occ = new Map(Object.entries(this.seats));
    for (const [k, id] of occ) {
      const [r, c] = parseKey(k);
      for (const [dr, dc] of NEIGHBORS) { const other = occ.get(`${r + dr}-${c + dc}`); if (other) keep.add(pairKey(id, other)); }
    }
    this.neighborHistory = [...keep];
    return { seated: result.length, apartFailed, cycled };
  };
  /** Class Number order, starting at the bottom-left desk and filling along each row to the right, then up a row. */
  S.autoFillNumericalRows = function (students) {
    const sorted = [...students].sort((a, b) => (a.classNumber || Infinity) - (b.classNumber || Infinity));
    let i = 0;
    for (let r = this.rows - 1; r >= 0 && i < sorted.length; r--) {
      for (let c = 0; c < this.cols && i < sorted.length; c++) if (freeDesk(r, c)) this.seats[this.key(r, c)] = sorted[i++].id;
    }
    return i;
  };
  /** Removes every row and column that has no seated student in it (desks included); the remaining desks keep their relative places, closed up toward the bottom-left corner. */
  S.trimUnusedDesks = function () {
    const rows = new Set(), cols = new Set();
    for (const key in this.seats) {
      if (!this.active[key]) continue;
      const [r, c] = key.split("-").map(Number);
      rows.add(r); cols.add(c);
    }
    if (!rows.size) return "none";
    const keepR = []; for (let r = 0; r < this.rows; r++) if (rows.has(r)) keepR.push(r);
    const keepC = []; for (let c = 0; c < this.cols; c++) if (cols.has(c)) keepC.push(c);
    if (keepR.length === this.rows && keepC.length === this.cols) return "same";
    const ri = new Map(keepR.map((o, n) => [o, n])), ci = new Map(keepC.map((o, n) => [o, n]));
    const remap = (map) => {
      const out = {};
      for (const key in map) { const [r, c] = key.split("-").map(Number); if (ri.has(r) && ci.has(c)) out[`${ri.get(r)}-${ci.get(c)}`] = map[key]; }
      return out;
    };
    this.active = remap(this.active); this.seats = remap(this.seats); this.locks = remap(this.locks);
    this.groups = remap(this.groups); this.labels = remap(this.labels);
    this.rows = keepR.length; this.cols = keepC.length;
    return "ok";
  };

  // ---------- styles ----------
  const css = document.createElement("style");
  css.textContent = `
.split-btn { display:inline-flex; align-items:stretch; }
.split-btn > .btn:first-child { border-top-right-radius:0; border-bottom-right-radius:0; }
.split-btn > .split-caret { border-top-left-radius:0; border-bottom-left-radius:0; border-left-width:0; padding-left:8px; padding-right:8px; min-width:0; }
.split-menu { position:fixed; z-index:10000; display:flex; flex-direction:column; gap:2px; padding:6px; min-width:210px; background:var(--card); border:2px solid var(--green); border-radius:8px; box-shadow:0 8px 24px rgba(0,0,0,.4); }
.split-menu .btn { text-align:left; width:100%; border-color:transparent; }
.split-menu .btn:hover { background:color-mix(in srgb, var(--green) 22%, transparent); }
#desk-setup { margin:0 0 14px; padding:10px 12px; border:2px solid var(--green); border-radius:8px; background:color-mix(in srgb, var(--green) 8%, var(--card)); }
#desk-setup[hidden] { display:none; }
#desk-setup .ds-top { display:flex; gap:12px; align-items:center; flex-wrap:wrap; margin-bottom:8px; }
.ds-grid { display:grid; gap:3px; width:max-content; max-width:100%; user-select:none; touch-action:none; margin:6px 0; }
.ds-cell { width:30px; height:26px; border:1px dashed var(--ink-soft); border-radius:4px; background:transparent; display:flex; align-items:center; justify-content:center; font-size:.7rem; cursor:crosshair; }
.ds-cell.on { border:1px solid var(--green); background:color-mix(in srgb, var(--green) 40%, var(--card)); }
.ds-cell.seated { font-weight:700; }
.ds-cell.pv-add { background:color-mix(in srgb, #2e8b57 55%, transparent); border:1px solid #2e8b57; }
.ds-cell.pv-erase { background:color-mix(in srgb, #d3302f 45%, transparent); border:1px solid #d3302f; }
.ds-front { text-align:center; font-style:italic; font-size:.8rem; color:var(--ink-soft); width:max-content; min-width:100%; }
.desk-inactive { cursor:default; } .desk-inactive:hover { opacity:.4; border-color:var(--line); }
.desk-label-box { position:absolute; top:2px; right:2px; width:2.9em; height:15px; padding:0 2px; box-sizing:border-box; text-align:center; font-size:.58rem; line-height:13px; border:1px solid var(--line); border-radius:3px; background:var(--card); color:var(--ink-soft); cursor:pointer; opacity:.6; }
.desk-label-box:hover, .desk-label-box-active { opacity:1; }
.desk-label-box-active { border-color:var(--green); color:var(--ink); font-weight:700; }
.desk-label-box:focus { outline:none; }
.ds-size { display:flex; align-items:center; gap:6px; margin-top:4px; font-weight:700; }
.ds-size input { width:3.2em; text-align:center; }
`;
  document.head.appendChild(css);

  // ---------- split button + floating menu ----------
  let openMenu = null;
  const closeMenu = () => { if (openMenu) { openMenu.remove(); openMenu = null; } };
  document.addEventListener("click", (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", closeMenu);
  function splitButton(label, title, onMain, items) {
    const wrap = el("span", "split-btn");
    const main = el("button", "btn btn-ghost", label);
    main.type = "button";
    main.title = title;
    main.addEventListener("click", onMain);
    const caret = el("button", "btn btn-ghost split-caret", "▾");
    caret.type = "button";
    caret.title = "More options";
    caret.setAttribute("aria-haspopup", "true");
    caret.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openMenu) { closeMenu(); return; }
      const menu = el("div", "split-menu");
      items.forEach((it) => {
        const b = el("button", "btn btn-ghost btn-small", it.label);
        b.type = "button";
        b.title = it.title || "";
        b.addEventListener("click", (ev) => { ev.stopPropagation(); closeMenu(); it.onClick(); });
        menu.appendChild(b);
      });
      document.body.appendChild(menu);
      const r = wrap.getBoundingClientRect();
      menu.style.top = `${r.bottom + 4}px`;
      menu.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - menu.offsetWidth - 8))}px`;
      openMenu = menu;
    });
    wrap.append(main, caret);
    return wrap;
  }

  // ---------- Set Up Desks panel ----------
  const panel = el("div");
  panel.id = "desk-setup";
  panel.hidden = true;
  let drag = null;
  const N = MAX_GRID_SIZE; // the drawing area is always the largest classroom; the chart's size follows the desks drawn

  /** The chart is exactly as big as the desks drawn: empty rows/columns above and to the left of the first desk are dropped (everything shifts up/left), and the size follows the farthest desk. */
  function resizeToDesks() {
    let minR = Infinity, minC = Infinity, maxR = -1, maxC = -1;
    for (const key in S.active) {
      const [r, c] = key.split("-").map(Number);
      minR = Math.min(minR, r); minC = Math.min(minC, c);
      maxR = Math.max(maxR, r); maxC = Math.max(maxC, c);
    }
    if (maxR < 0) { S.setSize(1, 1); return; }
    if (minR > 0 || minC > 0) {
      const shift = (map) => {
        const out = {};
        for (const key in map) { const [r, c] = key.split("-").map(Number); out[`${r - minR}-${c - minC}`] = map[key]; }
        return out;
      };
      ["active", "seats", "locks", "groups", "labels"].forEach((k) => {
        // keep only entries that sit at or after the first desk (anything earlier belonged to a removed desk)
        const kept = {};
        for (const key in S[k]) { const [r, c] = key.split("-").map(Number); if (r >= minR && c >= minC) kept[key] = S[k][key]; }
        S[k] = shift(kept);
      });
      maxR -= minR; maxC -= minC;
    }
    S.rows = Math.max(1, Math.min(MAX_GRID_SIZE, maxR + 1));
    S.cols = Math.max(1, Math.min(MAX_GRID_SIZE, maxC + 1));
  }

  // The drawing area shows the classroom anchored at its BOTTOM-left (the front of the room, desk number one).
  const rowOffset = () => N - Math.min(N, S.rows); // blank schematic rows above the chart
  const toRow = (displayRow) => displayRow - rowOffset();
  /** Moves every desk (and its seat/lock/group/label) down by k rows, making room above for new desks. */
  function shiftDown(k) {
    ["active", "seats", "locks", "groups", "labels"].forEach((m) => {
      const out = {};
      for (const key in S[m]) { const [r, c] = key.split("-").map(Number); out[`${r + k}-${c}`] = S[m][key]; }
      S[m] = out;
    });
    S.rows += k;
  }

  function drawSetup() {
    panel.textContent = "";
    panel.appendChild(el("p", "hint", "Drag across blank spaces to add desks; drag across empty desks to remove them. Click one spot to add or remove a single desk. A desk with a student in it is never removed. Top = back of the classroom. Click Set Up Desks again to close."));

    const grid = el("div", "ds-grid");
    grid.style.gridTemplateColumns = `repeat(${N}, 30px)`;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = el("div", "ds-cell");
        cell.dataset.r = r; cell.dataset.c = c;
        const rr = toRow(r);
        if (S.isActive(rr, c)) cell.classList.add("on");
        if (isSeated(rr, c)) { cell.classList.add("seated"); cell.textContent = "●"; cell.title = "A student sits here"; }
        grid.appendChild(cell);
      }
    }
    panel.appendChild(grid);
    panel.appendChild(el("div", "ds-front", "Front of Classroom"));
    panel.appendChild(el("div", "ds-size", `${S.rows} × ${S.cols}`));
  }

  const cellAt = (e) => {
    const t = document.elementFromPoint(e.clientX, e.clientY);
    const c = t && t.closest && t.closest(".ds-cell");
    return c && panel.contains(c) ? c : null;
  };
  const rect = (a, b) => ({ r1: Math.min(a.r, b.r), r2: Math.max(a.r, b.r), c1: Math.min(a.c, b.c), c2: Math.max(a.c, b.c) });
  function preview(a, b, erase) {
    const R = rect(a, b);
    const multi = !(R.r1 === R.r2 && R.c1 === R.c2);
    panel.querySelectorAll(".ds-cell").forEach((cell) => {
      const r = +cell.dataset.r, c = +cell.dataset.c;
      const inside = multi && r >= R.r1 && r <= R.r2 && c >= R.c1 && c <= R.c2;
      cell.classList.toggle("pv-add", inside && !erase);
      cell.classList.toggle("pv-erase", inside && erase);
    });
  }
  panel.addEventListener("pointerdown", (e) => {
    const cell = e.target.closest && e.target.closest(".ds-cell");
    if (!cell) return;
    e.preventDefault();
    const a = { r: +cell.dataset.r, c: +cell.dataset.c };
    // starting on a desk erases; starting on a blank space draws
    drag = { a, b: a, erase: S.isActive(toRow(a.r), a.c) };
  });
  panel.addEventListener("pointermove", (e) => {
    if (!drag) return;
    const cell = cellAt(e);
    if (!cell) return;
    drag.b = { r: +cell.dataset.r, c: +cell.dataset.c };
    preview(drag.a, drag.b, drag.erase);
  });
  window.addEventListener("pointerup", () => {
    if (!drag) return;
    const { a, b, erase } = drag;
    drag = null;
    const R = rect(a, b);
    let refused = 0;
    const off = rowOffset();
    let lift = 0;
    if (!erase && R.r1 - off < 0) { lift = off - R.r1; shiftDown(lift); } // drawing above the chart: add rows at the back
    for (let r = R.r1; r <= R.r2; r++) {
      const ir = r - off + lift;
      for (let c = R.c1; c <= R.c2; c++) {
        if (ir < 0 || ir >= S.rows + (erase ? 0 : N)) continue;
        if (erase) {
          if (!S.isActive(ir, c)) continue;
          if (S.studentAt(ir, c)) { refused++; continue; }
          S.deactivate(ir, c);
        } else if (!S.isActive(ir, c)) {
          S.activate(ir, c);
        }
      }
    }
    resizeToDesks();
    say(refused ? `${refused} desk${refused === 1 ? "" : "s"} with a student in ${refused === 1 ? "it was" : "them were"} not removed.` : "");
    redrawChart();
    drawSetup();
  });

  // ---------- fill actions ----------
  const afterFill = (n, what, students) => {
    selectedStudentId = null;
    redrawChart();
    const left = students.length - n;
    say(`${what}: seated ${n} student${n === 1 ? "" : "s"}.` + (left > 0 ? ` ${left} could not be seated — no free desks left.` : ""));
  };
  const fill = (what, fn) => () => {
    const students = eligible();
    if (!students.length) { say("Everyone who can be seated already has a desk."); return; }
    afterFill(fn(students), what, students);
  };

  const randomFill = () => {
    const students = eligible();
    if (!students.length) { say("Everyone who can be seated already has a desk."); return; }
    const res = S.autoFillRandom(students);
    selectedStudentId = null;
    redrawChart();
    const left = students.length - res.seated;
    say(`Auto-Fill: seated ${res.seated} student${res.seated === 1 ? "" : "s"}.` +
      (left > 0 ? ` ${left} could not be seated — no free desks left.` : "") +
      (res.cycled ? " Every new neighbor combination has now been used, so the \"not next to the same people\" memory started over." : "") +
      (res.apartFailed.length ? ` Couldn't keep apart: ${res.apartFailed.join(", ")} (not enough room).` : ""));
    if (!sepPanel.hidden) drawSep();
  };

  // ---------- Keep Students Apart panel ----------
  const sepPanel = el("div");
  sepPanel.id = "sep-setup";
  sepPanel.hidden = true;
  sepPanel.style.cssText = "margin:0 0 14px;padding:10px 12px;border:2px solid var(--green);border-radius:8px;background:color-mix(in srgb, var(--green) 8%, var(--card));";
  function studentOptions(select, chosen, taken) {
    const blank = el("option", "", "— choose a student —");
    blank.value = "";
    select.appendChild(blank);
    RosterModule.students.filter((st) => !st.excludeFromSeating)
      .sort((a, b) => (a.classNumber || 1e9) - (b.classNumber || 1e9))
      .forEach((st) => {
        const o = el("option", "", `${st.classNumber ? "#" + st.classNumber + " " : ""}${st.name || "(unnamed)"}${st.schoolId ? " (" + st.schoolId + ")" : ""}`);
        o.value = st.id;
        if (st.id === chosen) o.selected = true;
        if (taken.has(st.id) && st.id !== chosen) o.disabled = true;
        select.appendChild(o);
      });
  }
  function drawSep() {
    sepPanel.textContent = "";
    const max = S.maxSeparations();
    if (!Array.isArray(S.separations)) S.separations = [];
    const head = el("div");
    head.style.cssText = "display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:6px;";
    head.appendChild(el("strong", "", "Keep Students Apart"));
    head.appendChild(el("span", "hint", `${S.separations.length} of ${max} pairs`));
    const reset = el("button", "btn btn-ghost btn-small", "Reset \"not next to the same people\" memory");
    reset.type = "button";
    reset.title = "Forget who sat next to whom in earlier random Auto-Fills";
    reset.addEventListener("click", () => { S.neighborHistory = []; say("Auto-Fill memory cleared."); });
    head.appendChild(reset);
    const doneBtn = el("button", "btn btn-primary btn-small", "Done");
    doneBtn.type = "button";
    doneBtn.addEventListener("click", () => { sepPanel.hidden = true; });
    head.appendChild(doneBtn);
    sepPanel.appendChild(head);
    sepPanel.appendChild(el("p", "hint", "Each pair is kept at least one empty desk apart (not side by side, front/back, or diagonal) whenever Auto-Fill randomizes. Choose student 1, then student 2. A student can be in several pairs — for example A↔B, A↔C and B↔C keep three students apart from one another. Students who sat together in a recent random Auto-Fill are also kept from sitting together again until every combination has been used. Click Save Seating Chart to keep these pairs."));
    S.separations.forEach((pair, i) => {
      const row = el("div");
      row.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:4px 0;";
      row.appendChild(el("span", "hint", `Pair ${i + 1}`));
      [0, 1].forEach((slot) => {
        const sel = el("select");
        const other = pair[1 - slot];
        studentOptions(sel, pair[slot], new Set(other ? [other] : [])); // a student can be in several pairs, but not paired with themselves
        sel.addEventListener("change", () => {
          pair[slot] = sel.value;
          const dup = S.separations.some((q, qi) => qi !== i && pair[0] && pair[1] && ((q[0] === pair[0] && q[1] === pair[1]) || (q[0] === pair[1] && q[1] === pair[0])));
          if (dup) { pair[slot] = ""; say("That pair is already listed."); }
          drawSep();
        });
        row.appendChild(sel);
        if (slot === 0) row.appendChild(el("span", "", "↔"));
      });
      const rm = el("button", "btn btn-ghost btn-small", "×");
      rm.type = "button";
      rm.title = "Remove this pair";
      rm.addEventListener("click", () => { S.separations.splice(i, 1); drawSep(); });
      row.appendChild(rm);
      sepPanel.appendChild(row);
    });
    const add = el("button", "btn btn-ghost btn-small", "+ Add pair");
    add.type = "button";
    add.disabled = S.separations.length >= max;
    add.title = add.disabled ? `At most ${max} pairs (half the class)` : "";
    add.addEventListener("click", () => { S.separations.push(["", ""]); drawSep(); });
    sepPanel.appendChild(add);
  }

  const trim = () => {
    const res = S.trimUnusedDesks();
    if (res === "none") { say("Nothing to trim — no students are seated yet."); return; }
    if (res === "same") { say("Nothing to trim — every row and column has a seated student."); return; }
    selectedStudentId = null;
    redrawChart();
    if (!panel.hidden) drawSetup();
    say(`Trimmed unused desks: the classroom is now ${S.rows} × ${S.cols}.`);
  };

  // ---------- install ----------
  const buttonsBar = document.querySelector("#seating-panel .panel-toolbar-buttons");
  const toolbar = document.querySelector("#seating-panel .panel-toolbar");
  ["auto-fill-btn", "auto-fill-numerical-btn"].forEach((id) => { const b = $(id); if (b) b.style.display = "none"; });
  const oldSize = document.querySelector("#seating-panel .grid-size-controls");
  if (oldSize) oldSize.style.display = "none";
  if (buttonsBar && toolbar) {
    buttonsBar.insertBefore(
      splitButton("Set Up Desks", "Draw where the desks go", () => { panel.hidden = !panel.hidden; if (!panel.hidden) drawSetup(); }, [
        { label: "Trim Unused Desks", title: "Deletes rows and columns that have no seated students", onClick: trim },
      ]),
      buttonsBar.firstChild
    );
    buttonsBar.insertBefore(
      splitButton("Auto-Fill", "Randomly seats everyone who has no desk (excluded students are skipped)", randomFill, [
        { label: "Keep Students Apart…", title: "Pairs of students Auto-Fill keeps at least one desk apart", onClick: () => { sepPanel.hidden = !sepPanel.hidden; if (!sepPanel.hidden) drawSep(); } },
        { label: "Numerical Order — Columns", title: "Class Number order: bottom-left desk, up the column, then the next column", onClick: fill("Numerical order (columns)", (st) => { const before = S.seatedStudentIds().size; S.autoFillNumericalOrder(st); return S.seatedStudentIds().size - before; }) },
        { label: "Numerical Order — Rows", title: "Class Number order: bottom-left desk, along the row, then the row above", onClick: fill("Numerical order (rows)", (st) => S.autoFillNumericalRows(st)) },
      ]),
      buttonsBar.children[1]
    );
    toolbar.insertAdjacentElement("afterend", panel);
    panel.insertAdjacentElement("afterend", sepPanel);
  }
})();

// ===== Group Assignments: one "copy emails" button per group =====
(function () {
  const origRender = window.renderGroupList;
  if (typeof origRender !== "function") return;
  const bar = document.createElement("div");
  bar.id = "group-email-bar";
  bar.style.cssText = "display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:0 0 8px;";
  const note = document.createElement("span");
  note.className = "result";

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch (e) {}
    const ta = document.createElement("textarea");
    ta.value = text;
    ta.style.cssText = "position:fixed;opacity:0;";
    document.body.appendChild(ta);
    ta.select();
    let ok = false;
    try { ok = document.execCommand("copy"); } catch (e) {}
    ta.remove();
    return ok;
  }

  window.renderGroupList = function () {
    origRender.apply(this, arguments);
    const table = document.querySelector(".group-list-table");
    if (!table) return;
    // a "Copy" button between each student's email address and group number
    const headRow = table.querySelector("thead tr");
    if (headRow && headRow.children.length === 6) headRow.insertBefore(document.createElement("th"), headRow.children[5]);
    table.querySelectorAll("tbody tr").forEach((tr) => {
      if (tr.children.length === 1) { tr.children[0].colSpan = 7; return; }
      if (tr.children.length !== 6) return;
      const email = tr.children[4].textContent.trim();
      const td = document.createElement("td");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "btn btn-ghost btn-small";
      btn.textContent = "Copy";
      btn.disabled = !email;
      btn.title = email ? `Copy ${email}` : "No email address";
      btn.addEventListener("click", async () => {
        const ok = await copy(email);
        note.textContent = ok ? `Copied ${email}.` : "Couldn't copy — your browser blocked the clipboard.";
        if (!bar.isConnected) return;
      });
      td.appendChild(btn);
      tr.insertBefore(td, tr.children[5]);
    });
    if (!bar.isConnected) table.parentNode.insertBefore(bar, table);
    bar.textContent = "";
    const groups = new Map();
    computeGroupListEntries().forEach(({ student, group }) => {
      if (!group) return;
      if (!groups.has(group)) groups.set(group, []);
      groups.get(group).push(student);
    });
    if (!groups.size) return;
    const label = document.createElement("span");
    label.className = "hint";
    label.textContent = "Copy a group's email addresses:";
    bar.appendChild(label);
    [...groups.keys()].sort((a, b) => a - b).forEach((g) => {
      const members = groups.get(g);
      const emails = members.map((m) => String(m.email || "").trim()).filter(Boolean);
      const b = document.createElement("button");
      b.type = "button";
      b.className = "btn btn-ghost btn-small";
      b.textContent = `Group ${g} (${members.length})`;
      b.title = emails.length ? "Copies this group's email addresses, separated by commas" : "No email addresses for this group";
      b.addEventListener("click", async () => {
        if (!emails.length) { note.textContent = `Group ${g}: none of these students has an email address.`; return; }
        const ok = await copy(emails.join(", "));
        const missing = members.length - emails.length;
        note.textContent = ok
          ? `Copied ${emails.length} email address${emails.length === 1 ? "" : "es"} from Group ${g}.` + (missing ? ` ${missing} student${missing === 1 ? " has" : "s have"} no email address.` : "")
          : "Couldn't copy — your browser blocked the clipboard.";
      });
      bar.appendChild(b);
    });
    bar.appendChild(note);
  };
})();
