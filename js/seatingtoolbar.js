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

  /** Random seating. Excluded students are never seated; if there are more free desks than students, the unused desks are the ones at the BACK of the room (the top rows), because the front (bottom) rows are filled first. */
  S.autoFillRandom = function (students) {
    const desks = [];
    for (let r = this.rows - 1; r >= 0; r--) for (let c = 0; c < this.cols; c++) if (freeDesk(r, c)) desks.push([r, c]);
    const chosen = desks.slice(0, students.length);
    const order = shuffle(students);
    chosen.forEach(([r, c], i) => { this.seats[this.key(r, c)] = order[i].id; });
    return chosen.length;
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

  function drawSetup() {
    panel.textContent = "";
    panel.appendChild(el("p", "hint", "Drag across blank spaces to add desks; drag across empty desks to remove them. Click one spot to add or remove a single desk. A desk with a student in it is never removed. Top = back of the classroom. Click Set Up Desks again to close."));

    const grid = el("div", "ds-grid");
    grid.style.gridTemplateColumns = `repeat(${N}, 30px)`;
    for (let r = 0; r < N; r++) {
      for (let c = 0; c < N; c++) {
        const cell = el("div", "ds-cell");
        cell.dataset.r = r; cell.dataset.c = c;
        if (S.isActive(r, c)) cell.classList.add("on");
        if (isSeated(r, c)) { cell.classList.add("seated"); cell.textContent = "●"; cell.title = "A student sits here"; }
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
    drag = { a, b: a, erase: S.isActive(a.r, a.c) };
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
    for (let r = R.r1; r <= R.r2; r++) {
      for (let c = R.c1; c <= R.c2; c++) {
        if (erase) {
          if (!S.isActive(r, c)) continue;
          if (S.studentAt(r, c)) { refused++; continue; }
          S.deactivate(r, c);
        } else if (!S.isActive(r, c)) {
          S.activate(r, c);
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
      splitButton("Auto-Fill", "Randomly seats everyone who has no desk (excluded students are skipped)", fill("Auto-Fill", (st) => S.autoFillRandom(st)), [
        { label: "Numerical Order — Columns", title: "Class Number order: bottom-left desk, up the column, then the next column", onClick: fill("Numerical order (columns)", (st) => { const before = S.seatedStudentIds().size; S.autoFillNumericalOrder(st); return S.seatedStudentIds().size - before; }) },
        { label: "Numerical Order — Rows", title: "Class Number order: bottom-left desk, along the row, then the row above", onClick: fill("Numerical order (rows)", (st) => S.autoFillNumericalRows(st)) },
      ]),
      buttonsBar.children[1]
    );
    toolbar.insertAdjacentElement("afterend", panel);
  }
})();
