// ===== Journal module (screen) =====
// Tab "Journal" (after Report Card). Layout follows the module convention: Main button top-left, Save top-right,
// the entries, then collapsible Sections: Counts & Timeline, Search & Report, and Journal Settings (last).
// Load AFTER app.js and layout.js.
(function () {
  const J = JournalModule;
  const mk = (tag, cls, text) => { const n = document.createElement(tag); if (cls) n.className = cls; if (text !== undefined) n.textContent = text; return n; };
  const btn = (label, cls, fn) => { const b = mk("button", cls || "btn btn-ghost btn-small", label); b.type = "button"; b.addEventListener("click", fn); return b; };
  const reportBtn = document.getElementById("tab-reportcard-btn");
  const reportPanel = document.getElementById("reportcard-panel");
  if (!reportBtn || !reportPanel) return;

  const tabBtn = mk("button", "tab-btn", "Journal"); tabBtn.id = "tab-journal-btn";
  reportBtn.after(tabBtn);
  const panel = mk("div", "tab-panel"); panel.id = "journal-panel"; panel.hidden = true;
  reportPanel.after(panel);

  const css = mk("style");
  css.textContent = `
:is(#journal-panel, #journal-modal) .jr-form { border:1px solid var(--line,#ccc); border-radius:8px; padding:10px; margin:0 0 12px; display:grid; gap:8px; }
:is(#journal-panel, #journal-modal) .jr-row { display:flex; gap:10px; flex-wrap:wrap; align-items:center; }
:is(#journal-panel, #journal-modal) textarea { width:100%; min-height:90px; font:inherit; padding:6px; box-sizing:border-box; }
:is(#journal-panel, #journal-modal) .jr-chip { display:inline-block; border:1px solid var(--line,#ccc); border-radius:999px; padding:1px 9px; margin:2px 3px 2px 0; font-size:.8rem; cursor:pointer; background:transparent; color:inherit; }
:is(#journal-panel, #journal-modal) .jr-chip { border-color:currentColor; }
:is(#journal-panel, #journal-modal) .jr-chip.on { background:var(--ink,#222); color:var(--card,#fff); border-color:var(--ink,#222); }
:is(#journal-panel, #journal-modal) .jr-chip.on.static { background:transparent; color:inherit; border-color:currentColor; }
:is(#journal-panel, #journal-modal) .jr-chip.static { cursor:default; }
:is(#journal-panel, #journal-modal) .jr-entry { border:1px solid var(--line,#ccc); border-radius:8px; padding:8px 10px; margin:0 0 8px; }
:is(#journal-panel, #journal-modal) .jr-entry .jr-meta { font-size:.82rem; opacity:.85; }
:is(#journal-panel, #journal-modal) .jr-entry .jr-text { white-space:pre-wrap; margin:4px 0; display:-webkit-box; -webkit-line-clamp:3; line-clamp:3; -webkit-box-orient:vertical; overflow:hidden; }
:is(#journal-panel, #journal-modal) .jr-entry .jr-text.full { display:block; }
:is(#journal-panel, #journal-modal) .jr-entry .jr-subject { font-weight:700; font-size:1rem; }
:is(#journal-panel, #journal-modal) .jr-entry details summary { cursor:pointer; font-size:.85rem; }
:is(#journal-panel, #journal-modal) .jr-chip.tagbtn { cursor:pointer; }
:is(#journal-panel, #journal-modal) .jr-bar.click { cursor:pointer; }
:is(#journal-panel, #journal-modal) .jr-filterbar { margin:0 0 8px; }
:is(#journal-panel, #journal-modal) .jr-snap { font-size:.8rem; opacity:.8; border-top:1px dashed var(--line,#ccc); margin-top:4px; padding-top:3px; }
:is(#journal-panel, #journal-modal) .jr-pick { position:relative; }
:is(#journal-panel, #journal-modal) .jr-pick-list { max-height:220px; overflow:auto; border:1px solid var(--line,#ccc); border-radius:6px; padding:4px 8px; margin-top:4px; }
:is(#journal-panel, #journal-modal) .jr-pick-list label { display:block; font-size:.88rem; }
:is(#journal-panel, #journal-modal) .jr-bar { display:flex; align-items:center; gap:6px; font-size:.85rem; margin:2px 0; }
:is(#journal-panel, #journal-modal) .jr-bar i { display:inline-block; height:12px; background:var(--green,#3d5a40); border-radius:3px; min-width:2px; }
:is(#journal-panel, #journal-modal) .jr-two { display:grid; grid-template-columns:repeat(auto-fit,minmax(260px,1fr)); gap:16px; }
:is(#journal-panel, #journal-modal) table.jr-table { border-collapse:collapse; font-size:.85rem; width:100%; }
:is(#journal-panel, #journal-modal) table.jr-table th, :is(#journal-panel, #journal-modal) table.jr-table td { border:1px solid var(--line,#ccc); padding:2px 6px; text-align:left; vertical-align:top; }
:is(#journal-panel, #journal-modal) .jr-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin:0 0 8px; }
:is(#journal-panel, #journal-modal) .jr-filters label { display:flex; flex-direction:column; font-size:.78rem; gap:1px; }

/* ----- the book ----- */
:is(#journal-panel, #journal-modal) .jr-bookwrap { margin:0 0 16px; }
:is(#journal-panel, #journal-modal) .jr-bookrow { display:flex; align-items:stretch; gap:8px; }
:is(#journal-panel, #journal-modal) .jr-turn { flex:0 0 38px; font-size:2rem; line-height:1; cursor:pointer; border:1px solid var(--line,#ccc); border-radius:var(--radius,8px); background:var(--card,#fff); color:var(--green-dark,#333); }
:is(#journal-panel, #journal-modal) .jr-turn:disabled { opacity:.3; cursor:default; }
:is(#journal-panel, #journal-modal) .jr-book { --jr-ms:260ms; flex:1; min-width:0; display:grid; grid-template-columns:1fr 14px 1fr; perspective:1600px; position:relative;
  border:6px solid var(--jr-cover,#5a6f5d); border-radius:10px; background:var(--jr-cover,#5a6f5d); box-shadow:0 4px 14px rgba(0,0,0,.25); }
:is(#journal-panel, #journal-modal) .jr-page { background:var(--jr-page,#fffdf6); color:var(--ink,#222); padding:12px 14px 26px; min-height:320px; position:relative; min-width:0; }
:is(#journal-panel, #journal-modal) .jr-page-left { border-radius:5px 0 0 5px; transform-origin:right center; box-shadow:inset -22px 0 22px -22px rgba(0,0,0,.35); }
:is(#journal-panel, #journal-modal) .jr-page-right { border-radius:0 5px 5px 0; transform-origin:left center; box-shadow:inset 22px 0 22px -22px rgba(0,0,0,.35); }
:is(#journal-panel, #journal-modal) .jr-spine { background:linear-gradient(90deg,rgba(0,0,0,.28),rgba(0,0,0,.05) 50%,rgba(0,0,0,.28)), var(--jr-page,#fffdf6); }
:is(#journal-panel, #journal-modal) .jr-pageno { position:absolute; bottom:6px; left:0; right:0; text-align:center; font-size:.8rem; opacity:.6; }
:is(#journal-panel, #journal-modal) .jr-bookinfo { text-align:center; font-size:.82rem; opacity:.75; margin-top:4px; }
:is(#journal-panel, #journal-modal) .jr-book .jr-entry { border:0; border-bottom:1px dashed var(--line,#ccc); border-radius:0; padding:6px 2px; margin:0 0 6px; background:transparent; }
:is(#journal-panel, #journal-modal) .jr-book .jr-form { background:transparent; }
@media (max-width:760px) { :is(#journal-panel, #journal-modal) .jr-book { grid-template-columns:1fr; } :is(#journal-panel, #journal-modal) .jr-spine { display:none; } :is(#journal-panel, #journal-modal) .jr-turn { flex-basis:30px; } }

/* page-turn animations (each theme picks its own style) */
@keyframes jr-flip-out-next { to { transform:rotateY(-88deg); filter:brightness(.8); } }
@keyframes jr-flip-in-next  { from { transform:rotateY(88deg); filter:brightness(.8); } }
@keyframes jr-flip-out-prev { to { transform:rotateY(88deg); filter:brightness(.8); } }
@keyframes jr-flip-in-prev  { from { transform:rotateY(-88deg); filter:brightness(.8); } }
@keyframes jr-fade-out { to { opacity:0; transform:translateX(-10px); } }
@keyframes jr-fade-in  { from { opacity:0; transform:translateX(10px); } }
@keyframes jr-glitch-out { 0% { opacity:1; } 30% { transform:translateX(-6px) skewX(-6deg); filter:hue-rotate(60deg); } 60% { transform:translateX(5px) skewX(5deg); opacity:.5; } 100% { opacity:0; transform:translateX(-10px); clip-path:inset(0 0 60% 0); } }
@keyframes jr-glitch-in  { 0% { opacity:0; clip-path:inset(60% 0 0 0); transform:translateX(10px); } 40% { opacity:.6; transform:translateX(-5px) skewX(5deg); filter:hue-rotate(-60deg); } 100% { opacity:1; clip-path:inset(0); } }
@keyframes jr-wipe-out { to { clip-path:inset(0 0 0 100%); filter:drop-shadow(0 0 6px #00d9ff); } }
@keyframes jr-wipe-in  { from { clip-path:inset(0 100% 0 0); filter:drop-shadow(0 0 6px #00d9ff); } }
/* left page turns for "prev", right page for "next" */
:is(#journal-panel, #journal-modal) .jr-book.jr-out-next .jr-page-right { animation:var(--jr-out-next,jr-flip-out-next) var(--jr-ms) ease-in forwards; }
:is(#journal-panel, #journal-modal) .jr-book.jr-in-next  .jr-page-left  { animation:var(--jr-in-next,jr-flip-in-next) var(--jr-ms) ease-out; }
:is(#journal-panel, #journal-modal) .jr-book.jr-out-prev .jr-page-left  { animation:var(--jr-out-prev,jr-flip-out-prev) var(--jr-ms) ease-in forwards; }
:is(#journal-panel, #journal-modal) .jr-book.jr-in-prev  .jr-page-right { animation:var(--jr-in-prev,jr-flip-in-prev) var(--jr-ms) ease-out; }

/* theme looks */
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#7a5238; --jr-page:#f3e5c4; --jr-ms:340ms; border-radius:6px; box-shadow:0 5px 0 #5c3d29, 0 10px 18px rgba(0,0,0,.35); }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-page { background:linear-gradient(180deg,#f6ebcf,#eddcb6); outline:1px solid rgba(122,82,56,.45); outline-offset:-7px; font-family:var(--font-body); }
[data-theme="vintage"] :is(#journal-panel, #journal-modal) .jr-turn { background:#7a5238; color:#f3e5c4; border-color:#5c3d29; }
[data-theme="dark"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#5b5651; --jr-page:#2b2927; }
[data-theme="cyberpunk"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#0073e6; --jr-page:#ffffff; --jr-ms:300ms; --jr-out-next:jr-glitch-out; --jr-in-next:jr-glitch-in; --jr-out-prev:jr-glitch-out; --jr-in-prev:jr-glitch-in; border-width:2px; border-radius:2px; box-shadow:0 0 14px rgba(0,190,255,.55); }
[data-theme="cyberpunk"] :is(#journal-panel, #journal-modal) .jr-page { border-radius:0; }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#00d9ff; --jr-page:#0c1a22; --jr-ms:320ms; --jr-out-next:jr-wipe-out; --jr-in-next:jr-wipe-in; --jr-out-prev:jr-wipe-out; --jr-in-prev:jr-wipe-in; border-width:1px; border-radius:0; box-shadow:0 0 18px rgba(0,217,255,.5); }
[data-theme="tron-legacy"] :is(#journal-panel, #journal-modal) .jr-page { border-radius:0; box-shadow:none; }
[data-theme="basic"] :is(#journal-panel, #journal-modal) .jr-book { --jr-cover:#6b7d8f; --jr-page:#ffffff; --jr-ms:220ms; --jr-out-next:jr-fade-out; --jr-in-next:jr-fade-in; --jr-out-prev:jr-fade-out; --jr-in-prev:jr-fade-in; border-width:2px; border-radius:2px; box-shadow:none; }

#journal-modal { position:fixed; inset:0; z-index:20050; background:rgba(0,0,0,.5); display:flex; align-items:center; justify-content:center; padding:16px; }
#journal-modal .jr-modal-box { background:var(--card,#fff); color:var(--ink,#222); border:1px solid var(--line,#ccc); border-radius:var(--radius,10px); box-shadow:0 12px 40px rgba(0,0,0,.45); width:min(780px,94vw); max-height:88vh; overflow:auto; padding:18px 20px; }
#journal-modal .jr-modal-head { display:flex; align-items:flex-start; gap:12px; justify-content:space-between; }
#journal-modal .jr-modal-title { font-family:var(--font-heading); font-size:1.4rem; margin:0 0 4px; color:var(--green-dark,#222); }
#journal-modal .jr-modal-text { white-space:pre-wrap; margin:10px 0; line-height:1.5; font-size:1rem; }
#journal-modal .jr-modal-row { margin:6px 0; }
`;
  document.head.appendChild(css);

  let editingId = null;   // entry being edited
  let creating = false;   // new-entry form open
  let spread = null;    // which two-page spread is showing (null = open at the latest entry)
  let turning = false;  // a page-turn animation is running
  const PER_PAGE = 3;
  let tagFilter = new Set(); // tags ticked in the By-tag list: only entries with any of them are listed
  let sel = { from: "", to: "", tag: "", student: "", word: "" };

  const students = () => RosterModule.students.slice().sort((a, b) => (a.classNumber || 0) - (b.classNumber || 0));
  const sName = (id) => { const s = RosterModule.students.find((x) => x.id === id); return s ? `#${s.classNumber || "—"} ${s.name || "(unnamed)"}` : "(removed student)"; };
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`; };
  const attOk = () => AttendanceModule.currentCourseId === J.currentCourseId;
  const scoreOk = () => ScoringModule.currentCourseId === J.currentCourseId;

  /** Attendance that day + attendance-so-far + current score, for the entry's students (or the class). */
  function snapParts(e) {
    const out = [];
    const sess = attOk() ? AttendanceModule.sessions.find((s) => s.date && s.date === e.date) : null;
    if (e.students.length) {
      e.students.forEach((id) => {
        if (!RosterModule.students.some((s) => s.id === id)) return;
        const bits = [];
        if (attOk()) {
          const rec = sess ? AttendanceModule.getRecord(id, sess.id) : null;
          bits.push(`that day: ${rec && rec.code ? rec.code + (rec.infraction ? " (" + rec.infraction + ")" : "") : "—"}`);
          const st = AttendanceModule.stats(id);
          bits.push(`attended ${st.attended}, absences ${st.absences}`);
        }
        if (scoreOk()) { const pct = ScoringModule.weightedPercent(id); bits.push(`score now: ${pct === null || pct === undefined ? "—" : Math.round(pct) + "%"}`); }
        out.push({ who: sName(id), text: bits.join(" · ") });
      });
    } else if (sess) {
      const n = {};
      RosterModule.students.forEach((s) => { const c = AttendanceModule.getRecord(s.id, sess.id).code; if (c) n[c] = (n[c] || 0) + 1; });
      const t = Object.entries(n).map(([c, k]) => `${c} ${k}`).join(", ");
      if (t) out.push({ who: "Class", text: `attendance that day: ${t}` });
    }
    return out;
  }

  // ---------- the entry form ----------
  function buildForm(entry, onDone, onCancel) {
    const f = mk("div", "jr-form");
    const st = { date: entry ? entry.date : today(), subject: entry ? entry.subject || "" : "", students: new Set(entry ? entry.students : []), tags: new Set(entry ? entry.tags : []) };
    const row = mk("div", "jr-row");
    const date = mk("input"); date.type = "date"; date.value = st.date; date.addEventListener("input", () => { st.date = date.value; });
    const dl = mk("label", "", "Date "); dl.appendChild(date); row.appendChild(dl);

    const det = mk("details", "jr-pick"); const sum = mk("summary"); det.appendChild(sum);
    const list = mk("div", "jr-pick-list");
    const upd = () => { sum.textContent = st.students.size ? `Students (${st.students.size}): ${[...st.students].map((id) => sName(id)).join(", ").slice(0, 80)}` : "Students (optional — none = whole class)"; };
    students().forEach((s) => {
      const l = mk("label"); const c = mk("input"); c.type = "checkbox"; c.checked = st.students.has(s.id);
      c.addEventListener("change", () => { c.checked ? st.students.add(s.id) : st.students.delete(s.id); upd(); });
      l.append(c, document.createTextNode(` ${sName(s.id)}`)); list.appendChild(l);
    });
    if (!students().length) list.appendChild(mk("em", "", "No students in this course's roster."));
    det.appendChild(list); upd(); row.appendChild(det);
    f.appendChild(row);

    const subj = mk("input"); subj.placeholder = "Subject"; subj.value = st.subject; subj.style.width = "100%"; subj.addEventListener("input", () => { st.subject = subj.value; });
    f.appendChild(subj);
    const text = mk("textarea"); text.placeholder = "Journal entry…"; text.value = entry ? entry.text : ""; f.appendChild(text);

    const tagBox = mk("div");
    const drawTags = () => {
      tagBox.innerHTML = ""; tagBox.appendChild(mk("div", "", "Tags:"));
      const all = J.cleanTags([...J.allTags(), ...st.tags]);
      all.forEach((t) => {
        const on = [...st.tags].some((x) => x.toLowerCase() === t.toLowerCase());
        const c = btn(t, "jr-chip" + (on ? " on" : ""), () => {
          if (on) st.tags = new Set([...st.tags].filter((x) => x.toLowerCase() !== t.toLowerCase())); else st.tags.add(t);
          drawTags();
        });
        c.setAttribute("aria-pressed", String(on)); tagBox.appendChild(c);
      });
      const ni = mk("input"); ni.placeholder = "new tag…"; ni.size = 12;
      const addTag = () => { const v = ni.value.trim(); if (v) { J.cleanTags([v]).forEach((x) => st.tags.add(x)); drawTags(); } };
      ni.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); addTag(); } });
      tagBox.append(ni, btn("Add tag", "btn btn-ghost btn-small", addTag));
    };
    drawTags(); f.appendChild(tagBox);

    const acts = mk("div", "jr-row");
    acts.appendChild(btn(entry ? "Save changes" : "Add entry", "btn btn-primary btn-small", () => {
      if (!st.date) { alert("Choose a date."); return; }
      if (!text.value.trim() && !st.subject.trim() && !st.tags.size) { alert("Write something first."); return; }
      const data = { date: st.date, subject: st.subject, text: text.value, students: [...st.students], tags: [...st.tags] };
      if (entry) J.updateEntry(entry.id, data); else { J.addEntry(data); spread = null; }
      editingId = null; creating = false; render();
      if (onDone) onDone();
    }));
    acts.appendChild(btn("Cancel", "btn btn-ghost btn-small", () => { editingId = null; creating = false; if (onCancel) onCancel(); else render(); }));
    f.appendChild(acts);
    return f;
  }

  function entryCard(e) {
    if (editingId === e.id) return buildForm(e);
    const c = mk("div", "jr-entry");
    c.appendChild(mk("div", "jr-subject", e.subject || "(no subject)"));
    c.appendChild(mk("div", "jr-meta", e.date));
    if (e.tags.length) { const t = mk("div"); e.tags.forEach((x) => t.appendChild(mk("span", "jr-chip static", x))); c.appendChild(t); }
    if (e.students.length) {
      const d = mk("details"); d.appendChild(mk("summary", "", `Students (${e.students.length})`));
      d.appendChild(mk("div", "jr-meta", e.students.map(sName).join(", "))); c.appendChild(d);
    } else c.appendChild(mk("div", "jr-meta", "Whole class"));
    const tx = mk("div", "jr-text", e.text); c.appendChild(tx);
    c.appendChild(btn("Show full entry", "btn btn-ghost btn-small", () => openEntry(e.id)));
    if (J.settings.snapshots) {
      const sn = snapParts(e);
      if (sn.length) { const d = mk("div", "jr-snap"); sn.forEach((p) => d.appendChild(mk("div", "", `${p.who}: ${p.text}`))); c.appendChild(d); }
    }
    const a = mk("div", "jr-row");
    a.appendChild(btn("Edit", "btn btn-ghost btn-small", () => { editingId = e.id; creating = false; render(); }));
    a.appendChild(btn("Delete", "btn btn-ghost btn-small", () => { if (confirm("Delete this entry?")) { J.removeEntry(e.id); render(); } }));
    c.appendChild(a);
    return c;
  }

  // ---------- the full-entry window ----------
  function openEntry(id) {
    const existing = document.getElementById("journal-modal"); if (existing) existing.remove();
    const root = mk("div"); root.id = "journal-modal";
    const box = mk("div", "jr-modal-box"); root.appendChild(box);
    const close = () => { root.remove(); document.removeEventListener("keydown", onKey); };
    const onKey = (ev) => { if (ev.key === "Escape") close(); };
    document.addEventListener("keydown", onKey);
    root.addEventListener("mousedown", (ev) => { if (ev.target === root) close(); });
    function show() {
      const e = J.entries.find((x) => x.id === id); if (!e) { close(); return; }
      box.innerHTML = "";
      const head = mk("div", "jr-modal-head");
      const hl = mk("div"); hl.appendChild(mk("h3", "jr-modal-title", e.subject || "(no subject)")); hl.appendChild(mk("div", "jr-meta", e.date));
      head.appendChild(hl); head.appendChild(btn("✕ Close", "btn btn-ghost btn-small", close)); box.appendChild(head);
      if (e.tags.length) { const t = mk("div", "jr-modal-row"); e.tags.forEach((x) => t.appendChild(mk("span", "jr-chip static", x))); box.appendChild(t); }
      box.appendChild(mk("div", "jr-meta jr-modal-row", e.students.length ? `Students (${e.students.length}): ${e.students.map(sName).join(", ")}` : "Whole class"));
      box.appendChild(mk("div", "jr-modal-text", e.text));
      if (J.settings.snapshots) { const sn = snapParts(e); if (sn.length) { const d = mk("div", "jr-snap"); sn.forEach((p) => d.appendChild(mk("div", "", `${p.who}: ${p.text}`))); box.appendChild(d); } }
      const a = mk("div", "jr-row jr-modal-row");
      a.appendChild(btn("Edit", "btn btn-primary btn-small", () => { box.innerHTML = ""; box.appendChild(buildForm(e, show, show)); }));
      a.appendChild(btn("Delete", "btn btn-ghost btn-small", () => { if (confirm("Delete this entry?")) { J.removeEntry(e.id); close(); render(); } }));
      box.appendChild(a);
    }
    show();
    document.body.appendChild(root);
  }

  // ---------- the book: two pages showing, page-turn buttons on either side ----------
  const spreads = (n) => Math.max(1, Math.ceil(n / (PER_PAGE * 2)));
  function buildBook(sorted) {
    const wrap = mk("div", "jr-bookwrap");
    const total = spreads(sorted.length);
    spread = spread === null ? total - 1 : Math.max(0, Math.min(spread, total - 1));
    const prev = btn("‹", "jr-turn jr-turn-prev", () => turn(-1)); prev.title = "Previous pages"; prev.setAttribute("aria-label", "Previous pages");
    const next = btn("›", "jr-turn jr-turn-next", () => turn(1)); next.title = "Next pages"; next.setAttribute("aria-label", "Next pages");
    const book = mk("div", "jr-book");
    const left = mk("div", "jr-page jr-page-left"), right = mk("div", "jr-page jr-page-right");
    book.append(left, mk("div", "jr-spine"), right);
    const info = mk("div", "jr-bookinfo");
    function fill() {
      const base = spread * PER_PAGE * 2;
      [[left, base], [right, base + PER_PAGE]].forEach(([pg, from], i) => {
        pg.innerHTML = "";
        sorted.slice(from, from + PER_PAGE).forEach((e) => pg.appendChild(entryCard(e)));
        pg.appendChild(mk("div", "jr-pageno", String(spread * 2 + i + 1)));
      });
      prev.disabled = spread === 0; next.disabled = spread >= total - 1;
      info.textContent = `Pages ${spread * 2 + 1}–${spread * 2 + 2} of ${total * 2} · ${sorted.length} entr${sorted.length === 1 ? "y" : "ies"}`;
    }
    function turn(dir) {
      if (turning || spread + dir < 0 || spread + dir >= total) return;
      const reduce = window.matchMedia && matchMedia("(prefers-reduced-motion: reduce)").matches;
      const T = reduce ? 0 : parseInt(getComputedStyle(book).getPropertyValue("--jr-ms")) || 260;
      const name = dir > 0 ? "next" : "prev";
      turning = true; editingId = null;
      book.classList.add(`jr-out-${name}`);
      setTimeout(() => {
        spread += dir; fill();
        book.classList.remove(`jr-out-${name}`); book.classList.add(`jr-in-${name}`);
        setTimeout(() => { book.classList.remove(`jr-in-${name}`); turning = false; }, T);
      }, T);
    }
    fill();
    const row = mk("div", "jr-bookrow"); row.append(prev, book, next);
    wrap.append(row, info);
    return wrap;
  }

  // ---------- sections ----------
  function section(id, title) {
    const s = mk("div", "settings-section"); s.id = `journal-sec-${id}`;
    s.appendChild(mk("h3", "", title));
    return s;
  }
  const bars = (rows, fmt, onClick) => {
    const max = Math.max(1, ...rows.map((r) => r[1])); const box = mk("div");
    rows.forEach(([label, n]) => { const d = mk("div", "jr-bar" + (onClick ? " click" : "")); if (onClick) d.addEventListener("click", () => onClick(label)); const i = mk("i"); i.style.width = `${Math.round((n / max) * 160)}px`; d.append(mk("span", "", fmt ? fmt(label) : label), i, mk("span", "", String(n))); box.appendChild(d); });
    if (!rows.length) box.appendChild(mk("p", "hint", "Nothing yet."));
    return box;
  };

  function countsSection() {
    const s = section("counts", "Entry Counts & Timeline"); const body = mk("div"); s.appendChild(body);
    const E = J.entries;
    const days = new Set(E.map((e) => e.date)).size;
    const mentioned = new Set(E.flatMap((e) => e.students)).size;
    body.appendChild(mk("p", "hint", `${E.length} entr${E.length === 1 ? "y" : "ies"} on ${days} day${days === 1 ? "" : "s"}; ${mentioned} of ${RosterModule.students.length} students mentioned.`));
    const months = {}; E.forEach((e) => { const m = e.date.slice(0, 7); months[m] = (months[m] || 0) + 1; });
    const mrows = Object.entries(months).sort((a, b) => a[0].localeCompare(b[0]));
    const two = mk("div", "jr-two");
    const c1 = mk("div"); c1.appendChild(mk("h4", "", "Timeline (entries per month)")); c1.appendChild(bars(mrows)); two.appendChild(c1);
    const tags = {}; E.forEach((e) => e.tags.forEach((t) => { const k = t.toLowerCase(); tags[k] = tags[k] || { name: t, n: 0 }; tags[k].n++; }));
    const c2 = mk("div"); c2.appendChild(mk("h4", "", "By tag (click tags to list their entries)"));
    const tl = Object.values(tags).sort((a, b) => b.n - a.n);
    const maxN = Math.max(1, ...tl.map((t) => t.n));
    tl.forEach((t) => {
      const on = [...tagFilter].some((x) => x.toLowerCase() === t.name.toLowerCase());
      const d = mk("div", "jr-bar");
      const chip = btn(t.name, "jr-chip" + (on ? " on" : ""), () => {
        tagFilter = new Set([...tagFilter].filter((x) => x.toLowerCase() !== t.name.toLowerCase()));
        if (!on) tagFilter.add(t.name);
        spread = null; const y = window.scrollY; render(); window.scrollTo({ top: y });
      });
      chip.setAttribute("aria-pressed", String(on));
      const i = mk("i"); i.style.width = `${Math.round((t.n / maxN) * 160)}px`;
      d.append(chip, i, mk("span", "", String(t.n))); c2.appendChild(d);
    });
    if (!tl.length) c2.appendChild(mk("p", "hint", "Nothing yet."));
    two.appendChild(c2);
    body.appendChild(two);
    const per = students().map((st) => [sName(st.id), E.filter((e) => e.students.includes(st.id)).length]).sort((a, b) => a[1] - b[1] || a[0].localeCompare(b[0], undefined, { numeric: true }));
    body.appendChild(mk("h4", "", "By student (fewest entries first)"));
    body.appendChild(bars(per));
    return s;
  }

  function csvText(rows) {
    return "﻿" + rows.map((r) => r.map((c) => `"${String(c ?? "").replace(/"/g, '""')}"`).join(",")).join("\r\n");
  }
  function exportRows(list) {
    const rows = [["Date", "Subject", "Students", "Tags", "Entry", "Attendance / score snapshot"]];
    list.forEach((e) => rows.push([e.date, e.subject || "", e.students.length ? e.students.map(sName).join("; ") : "whole class", e.tags.join("; "), e.text, snapParts(e).map((p) => `${p.who}: ${p.text}`).join(" | ")]));
    return rows;
  }

  function searchSection() {
    const s = section("search", "Search & Report"); const body = mk("div"); s.appendChild(body);
    const f = mk("div", "jr-filters");
    const lab = (t, input) => { const l = mk("label", "", t); l.appendChild(input); f.appendChild(l); return input; };
    const from = lab("From", Object.assign(mk("input"), { type: "date", value: sel.from }));
    const to = lab("To", Object.assign(mk("input"), { type: "date", value: sel.to }));
    const tag = mk("select"); tag.appendChild(Object.assign(mk("option"), { value: "", textContent: "Any" })); J.allTags().forEach((t) => tag.appendChild(Object.assign(mk("option"), { value: t, textContent: t }))); tag.value = sel.tag; lab("Tag", tag);
    const stu = mk("select"); stu.appendChild(Object.assign(mk("option"), { value: "", textContent: "Anyone" })); students().forEach((x) => stu.appendChild(Object.assign(mk("option"), { value: x.id, textContent: sName(x.id) }))); stu.value = sel.student; lab("Student", stu);
    const word = lab("Word", Object.assign(mk("input"), { type: "search", value: sel.word, placeholder: "keyword…" }));
    body.appendChild(f);
    const out = mk("div"); body.appendChild(out);
    const run = () => {
      sel = { from: from.value, to: to.value, tag: tag.value, student: stu.value, word: word.value };
      const list = J.search(sel); out.innerHTML = "";
      const bar = mk("div", "jr-row"); bar.appendChild(mk("span", "hint", `${list.length} matching entr${list.length === 1 ? "y" : "ies"}`));
      bar.appendChild(btn("Export CSV", "btn btn-ghost btn-small", () => {
        const a = mk("a"); a.href = URL.createObjectURL(new Blob([csvText(exportRows(list))], { type: "text/csv;charset=utf-8" }));
        a.download = `journal-${today()}.csv`; document.body.appendChild(a); a.click(); a.remove();
      }));
      out.appendChild(bar);
      if (!list.length) return;
      const t = mk("table", "jr-table"); const hr = mk("tr"); ["Date", "Subject", "Students", "Tags", "Entry", "Snapshot"].forEach((h) => hr.appendChild(mk("th", "", h)));
      const th = mk("thead"); th.appendChild(hr); t.appendChild(th); const tb = mk("tbody"); t.appendChild(tb);
      list.forEach((e) => { const tr = mk("tr"); [e.date, e.subject || "", e.students.length ? e.students.map(sName).join(", ") : "whole class", e.tags.join(", "), e.text, snapParts(e).map((p) => `${p.who}: ${p.text}`).join("\n")].forEach((v) => { const td = mk("td", "", v); td.style.whiteSpace = "pre-wrap"; tr.appendChild(td); }); tb.appendChild(tr); });
      out.appendChild(t);
    };
    [from, to, tag, stu].forEach((i) => i.addEventListener("change", run));
    word.addEventListener("input", run);
    run();
    return s;
  }

  function settingsSection() {
    const s = section("settings", "Journal Settings"); const body = mk("div"); s.appendChild(body);
    const l = mk("label"); const c = mk("input"); c.type = "checkbox"; c.checked = J.settings.snapshots;
    c.addEventListener("change", () => { J.settings.snapshots = c.checked; render(); });
    l.append(c, document.createTextNode(" Show attendance / score snapshot beside entries")); body.appendChild(l);
    body.appendChild(mk("h4", "", "Quick-pick tags"));
    const box = mk("div");
    J.settings.tags.forEach((t) => { const chip = mk("span", "jr-chip static", t + " "); chip.appendChild(btn("✕", "btn btn-ghost btn-small", () => { J.removeSettingsTag(t); render(); })); box.appendChild(chip); });
    if (!J.settings.tags.length) box.appendChild(mk("p", "hint", "None yet. Tags you type into an entry are also offered next time."));
    body.appendChild(box);
    const ni = mk("input"); ni.placeholder = "add a tag…";
    const add = () => { if (ni.value.trim()) { J.addSettingsTag(ni.value); render(); } };
    ni.addEventListener("keydown", (ev) => { if (ev.key === "Enter") add(); });
    body.append(ni, btn("Add", "btn btn-ghost btn-small", add));
    return s;
  }

  // ---------- the panel ----------
  const status = mk("span", "result");
  function render() {
    panel.innerHTML = "";
    const bar = mk("div", "panel-toolbar");
    const left = mk("div", "panel-toolbar-buttons");
    left.appendChild(btn("+ New Entry", "btn btn-ghost", () => { creating = true; editingId = null; render(); }));
    bar.appendChild(left);
    const right = mk("div", "panel-toolbar-buttons"); right.appendChild(status);
    right.appendChild(btn("Save Journal", "btn btn-primary", async () => {
      try { status.textContent = "Saving…"; await J.save(); status.textContent = "Saved ✓"; } catch (e) { status.textContent = `Couldn't save: ${e.message}`; }
    }));
    bar.appendChild(right); panel.appendChild(bar);

    if (creating) panel.appendChild(buildForm(null));
    if (tagFilter.size) {
      const fb = mk("div", "jr-filterbar jr-row"); fb.appendChild(mk("span", "", `Showing entries tagged: ${[...tagFilter].join(", ")}`));
      fb.appendChild(btn("Show all entries", "btn btn-ghost btn-small", () => { tagFilter = new Set(); spread = null; render(); })); panel.appendChild(fb);
    }
    const want = [...tagFilter].map((t) => t.toLowerCase());
    const sorted = J.entries.filter((e) => !want.length || e.tags.some((t) => want.includes(t.toLowerCase()))).sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt || "").localeCompare(b.createdAt || ""));
    if (!sorted.length && !creating) panel.appendChild(mk("p", "hint", "No entries to show. Click “+ New Entry”."));
    if (sorted.length) panel.appendChild(buildBook(sorted));

    [["journal-counts", countsSection()], ["journal-search", searchSection()], ["journal-settings", settingsSection()]].forEach(([id, sec]) => {
      panel.appendChild(sec);
      if (window.GGOSections) window.GGOSections.add(id, `#${sec.id}`);
    });
  }

  let loadedFor = null;
  async function ensureLoaded() {
    const cid = AttendanceModule.currentCourseId || ScoringModule.currentCourseId;
    if (!cid) { status.textContent = ""; return; }
    if (loadedFor === cid && J.currentCourseId === cid) return;
    try { status.textContent = "Loading…"; await J.load(cid); loadedFor = cid; status.textContent = ""; editingId = null; creating = false; spread = null; }
    catch (e) { J.entries = []; status.textContent = `Couldn't load journal: ${e.message}`; }
  }

  const origShowTab = window.showTab;
  window.showTab = function (tab) {
    origShowTab.apply(this, arguments);
    const on = tab === "journal";
    panel.hidden = !on;
    tabBtn.classList.toggle("tab-btn-active", on);
    if (on) { spread = null; ensureLoaded().then(render); } // opens at the latest entry
  };
  tabBtn.addEventListener("click", () => window.showTab("journal"));
  window.JournalUI = { render, ensureLoaded };
})();
