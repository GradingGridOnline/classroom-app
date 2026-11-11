// ===== Class Material → Quiz Library =====
// Three sections: This Course's Quizzes (make new ones here), All Quizzes (manage every course's quizzes: copy, edit…,
// but no "new"), and Templates (Library items; a copy in a course keeps a live link, so editing the template updates it).
// Built on the Library engine in qtsbank.js (QTSBank.core).
(function () {
  const CMX = window.ClassMaterial; if (!CMX) return;
  const mk = CMX.mk;
  const core = () => window.QTSBank && QTSBank.core;
  const KINDS = [["standard", "Quiz"], ["answers", "Answer Collection"], ["survey", "Research Survey"], ["formative", "Formative Survey"]];
  const F = { q: "", course: "", type: "" };
  const open2 = { mine: true, all: true, tpl: true };
  let busy = false, note = "";

  const live = () => ScoringModule.currentCourseId;
  const typeKey = (d) => (d.kind === "answers" ? "answers" : d.kind === "survey" ? "survey" : d.kind === "formative" ? "formative" : "quiz");
  async function saveNow() { try { if (window.GGOAutosave && GGOAutosave.enabled()) await GGOAutosave.flush(); else await ScoringModule.save(); } catch (e) {} }
  const rebuildTabs = () => { try { if (typeof renderScoringToolTabs === "function") renderScoringToolTabs(); } catch (e) {} };

  function openEditor(toolId, testId) {
    QuizBankUI.open(toolId, testId);
    window.showTab("scoring");
    if (typeof showScoringMode === "function") showScoringMode(toolId);
  }
  /** The open course's Test & Quiz Bank (made if the course has none). */
  function liveTool() {
    let tool = ScoringModule.tools.find((t) => t.type === "testbank");
    if (!tool) { tool = ScoringModule.addTool("testbank"); rebuildTabs(); }
    return tool;
  }

  // ---------- making things ----------
  async function newQuiz(kind, label, count) {
    const name = prompt(`${label} name:`, `${label} ${count + 1}`); if (name === null || !name.trim()) return;
    const tool = liveTool(), t = ScoringModule.addQuizTest(tool.id, name.trim(), kind);
    await saveNow(); openEditor(tool.id, t.id);
  }
  function uploadQuiz() {
    QuizSheet.pick(async (p, f) => {
      try {
        const tool = liveTool(), t = ScoringModule.addQuizTest(tool.id, p.name || f.name.replace(/\.[^.]+$/, ""), p.kind);
        Object.assign(t.quiz.settings, p.settings); t.quiz.sections = p.sections;
        ScoringModule.normalizeQuiz(t); ScoringModule.regradeQuiz(tool.id, t.id);
        alert(QuizSheet.summary({ ...p, name: t.name })); await saveNow(); openEditor(tool.id, t.id);
      } catch (e) { alert(`Couldn't make the quiz: ${e.message}`); }
    });
  }
  async function newTemplate(kind, label, count) {
    const c = core(); const name = prompt(`${label} template name:`, `${label} template ${count + 1}`); if (name === null || !name.trim()) return;
    const lib = await c.libLoad(true);
    if (lib.items.length >= c.MAX_LIB) throw new Error(`The Library is at its limit of ${c.MAX_LIB} items.`);
    const item = c.newItem({ name: name.trim(), quiz: { kind, settings: { labelStyle: "upper", defaultOptions: 4, timeLimit: 0, attemptsAllowed: 1, attemptRule: "best" }, sections: [{ id: c.rid("sec"), title: "Section 1", questions: [], notes: [] }] } }, name.trim());
    lib.items.push(item); await c.libSave();
    await c.openTplEditor({ id: item.id });
  }
  function uploadTemplate() {
    QuizSheet.pick(async (p, f) => {
      try {
        const c = core(), lib = await c.libLoad(true);
        if (lib.items.length >= c.MAX_LIB) throw new Error(`The Library is at its limit of ${c.MAX_LIB} items.`);
        const name = p.name || f.name.replace(/\.[^.]+$/, "");
        const item = c.newItem({ name, quiz: { kind: p.kind, settings: p.settings, sections: p.sections } }, name);
        lib.items.push(item); await c.libSave(); alert(QuizSheet.summary({ ...p, name })); await c.openTplEditor({ id: item.id });
      } catch (e) { say(`Couldn't do that: ${e.message}`); }
    });
  }

  // ---------- copying ----------
  function chooseCourses(title, hint, model, note2) {
    const c = core();
    return c.dialog((box, done) => {
      box.appendChild(mk("h3", "", title)); box.appendChild(mk("p", "hint", hint));
      const cbs = model.courses.map((co) => { const l = mk("label", "qts-check"); const cb = mk("input"); cb.type = "checkbox"; cb.value = co.id; l.append(cb, mk("span", "", co.name + (co.id === live() ? " (this course)" : ""))); box.appendChild(l); return cb; });
      const msg = mk("p", "hint"); box.appendChild(msg);
      const acts = mk("div", "qts-actions");
      const no = mk("button", "btn btn-ghost", "Cancel"); no.type = "button"; no.addEventListener("click", () => done(null));
      const go = mk("button", "btn btn-primary", "Copy"); go.type = "button";
      go.addEventListener("click", () => { const ids = cbs.filter((b) => b.checked).map((b) => b.value); if (!ids.length) { msg.textContent = "Tick at least one course."; return; } done(ids); });
      acts.append(no, go); box.appendChild(acts);
    });
  }
  /** An independent copy of a course quiz (no Library link) in the chosen courses. */
  async function copyQuiz(row, model) {
    const c = core(), full = await c.fullOf(row); if (!full || !full.quiz) throw new Error("That quiz no longer exists.");
    const ids = await chooseCourses(`Copy “${full.name}” to courses`, "Each course gets its own separate copy of the questions (no link back). Students' answers aren't copied.", model);
    if (!ids) return "";
    let n = 0; const errs = [];
    for (const cid of ids) {
      try {
        const course = model.courses.find((x) => x.id === cid), toolId = course && course.tools.length ? course.tools[0].toolId : "__new";
        const t = JSON.parse(JSON.stringify({ id: c.rid("test"), name: cid === row.courseId ? `${full.name} (copy)` : full.name, maxPoints: full.maxPoints, sourceFile: "Quiz editor", rows: [], scores: {}, unmatched: [], createdAt: new Date().toISOString(), quiz: { kind: full.quiz.kind, settings: full.quiz.settings || {}, sections: full.quiz.sections || [], style: full.quiz.style } }));
        t.quiz.token = null; t.quiz.submissions = [];
        await c.courseAdd(cid, toolId, t); n++;
      } catch (e) { errs.push(`${(model.courses.find((x) => x.id === cid) || {}).name || cid}: ${e.message}`); }
    }
    if (live()) rebuildTabs();
    return `Copied to ${n} course${n === 1 ? "" : "s"}.${errs.length ? ` Couldn't copy to: ${errs.join("; ")}` : ""}`;
  }
  /** A template copied to this course, with a live link to it. */
  async function templateToHere(item) {
    const c = core(); await c.libLoad(true);
    const tool = liveTool();
    await c.courseAdd(live(), tool.id, c.useOf(c.itemById(item.id), item.name));
    rebuildTabs();
    return `“${item.name}” copied to this course. It stays linked to the template.`;
  }

  /** Links an own quiz to a template: its questions become the template's (answers kept and regraded). */
  async function linkToTemplate(r, c) {
    const lib = await c.libLoad(true);
    if (!lib.items.length) throw new Error("there are no templates yet");
    if (r.d.qr) throw new Error("its QR code is open — close it first");
    const pick = await c.dialog((box, done) => {
      box.appendChild(mk("h3", "", `Link “${r.d.name}” to a template`));
      box.appendChild(mk("p", "hint", `This quiz's questions are replaced by the template's, and it then follows the template's edits.${r.d.answers ? ` Its ${r.d.answers} student answer(s) are kept and regraded.` : ""}`));
      const s = mk("select"); lib.items.forEach((it) => { const o = mk("option", "", it.name); o.value = it.id; s.appendChild(o); }); box.appendChild(s);
      const acts = mk("div", "qts-actions"), no = mk("button", "btn btn-ghost", "Cancel"), go = mk("button", "btn btn-primary", "Link");
      no.type = go.type = "button"; no.addEventListener("click", () => done(null)); go.addEventListener("click", () => done(s.value)); acts.append(no, go); box.appendChild(acts);
    });
    if (!pick) return "";
    const item = c.itemById(pick);
    await c.applyUpdate(r, item);
    return `Linked to “${item.name}”.`;
  }

  // ---------- editing in another course ----------
  async function editElsewhere(row) {
    if (row.courseId === live()) { openEditor(row.toolId, row.id); return ""; }
    if (!confirm(`“${row.d.name}” is in ${row.courseName}. Open that course to edit it?`)) return "";
    const course = CoursesModule.courses.find((x) => x.id === row.courseId); if (!course) throw new Error("That course isn't available.");
    await saveNow();
    await openCourseDetail(course);
    openEditor(row.toolId, row.id);
    return "";
  }

  // ---------- drawing ----------
  let statusEl = null;
  const say = (t) => { note = t || ""; if (statusEl) statusEl.textContent = note; };
  const act = (host, fn) => async () => { try { const m = await fn(); if (m) note = m; else if (m === "") return; await draw(host); } catch (e) { say(`Couldn't do that: ${e.message}`); } };
  const b = (label, fn, title) => { const x = mk("button", "btn btn-ghost btn-small", label); x.type = "button"; if (title) x.title = title; x.addEventListener("click", (e) => { e.stopPropagation(); fn(); }); return x; };

  function section(host, key, title, hint, tools) {
    const d = mk("details", "cmq-sec"); d.open = open2[key]; d.addEventListener("toggle", () => { open2[key] = d.open; });
    d.appendChild(mk("summary", "cmq-sum", title));
    d.appendChild(mk("p", "hint", hint));
    const bar = mk("div", "qts-head"); tools.forEach((t) => bar.appendChild(t)); d.appendChild(bar);
    const body = mk("div"); d.appendChild(body); host.appendChild(d);
    return body;
  }
  function table(cols, rows) {
    const tb = mk("table", "source-grid qts-grid"), hr = mk("tr");
    cols.forEach((x) => hr.appendChild(mk("th", "nosort", x)));
    const th = mk("thead"); th.appendChild(hr); tb.appendChild(th);
    const body = mk("tbody"); tb.appendChild(body);
    if (!rows.length) { const tr = mk("tr"); const td = mk("td", "hint", "Nothing here yet."); td.colSpan = cols.length; tr.appendChild(td); body.appendChild(tr); }
    rows.forEach((cells) => { const tr = mk("tr"); cells.forEach((cell, i) => { if (cell instanceof Node) tr.appendChild(cell); else tr.appendChild(mk("td", i === 0 || cell === "" ? "qts-name" : "qts-n", cell == null || cell === "" ? "—" : String(cell))); }); body.appendChild(tr); });
    const w = mk("div", "qts-wrap"); w.appendChild(tb); return w;
  }
  const ctl = (...btns) => { const td = mk("td", "qts-ctl"); btns.filter(Boolean).forEach((x) => td.appendChild(x)); return td; };
  const sel = (label, key, opts, host) => { const l = mk("label", "", label), s = mk("select"); opts.forEach(([v, t]) => { const o = mk("option", "", t); o.value = v; s.appendChild(o); }); s.value = F[key]; s.addEventListener("change", () => { F[key] = s.value; draw(host); }); l.appendChild(s); return l; };
  const search = (host) => { const l = mk("label", "", "Search"), i = mk("input"); i.type = "search"; i.value = F.q; i.placeholder = "Name"; i.addEventListener("input", () => { F.q = i.value; const pos = i.selectionStart; draw(host, true).then(() => { const n = host.querySelector(".cmq-search input"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } }); }); l.appendChild(i); l.classList.add("cmq-search"); return l; };

  let model = null;
  async function draw(host, keepModel) {
    const c = core();
    if (!c) { host.textContent = "The Quiz Library engine isn't loaded."; return; }
    if (busy) return; busy = true;
    try {
      if (!keepModel || !model) {
        host.textContent = ""; host.appendChild(mk("p", "hint", "Loading your Quiz Library…"));
        await c.libEnsure(); model = await c.loadModel({ flush: true });
        const r = await c.syncPass(); if (r.updated) { model = await c.loadModel({}); note = note || `${r.updated} course quiz${r.updated === 1 ? "" : "zes"} updated from their templates.`; }
      }
    } catch (e) { host.textContent = ""; host.appendChild(mk("p", "hint", `Couldn't load: ${e.message}`)); busy = false; return; }
    busy = false;
    host.textContent = ""; host.classList.add("qts-root");
    const lib = c.getLib(), cid = live(), q = F.q.toLowerCase();
    const nm = (x) => String(x || "").toLowerCase().includes(q);
    statusEl = mk("p", "result", note); host.appendChild(statusEl); note = "";
    const rerun = act(host, async () => "");
    const refresh = b("Refresh", () => { model = null; draw(host); });
    const rows = model.rows.filter((r) => r.d.kind !== "test");
    const itemName = (id) => { const it = c.itemById(id); return it ? it.name : ""; };
    const sourceCell = (r) => { const it = r.d.libId && c.itemById(r.d.libId); return !it ? "Own" : `Template: ${it.name}${c.isStale(r.d, it) ? " — update available" : ""}`; };

    // ---- 1. this course ----
    const mine = rows.filter((r) => r.courseId === cid);
    const nq = mine.length;
    const tools1 = KINDS.map(([k, l]) => b(`+ New ${l}`, act(host, async () => { await newQuiz(k, l, nq); return ""; })));
    if (window.QuizSheet) tools1.push(b("Upload quiz contents", uploadQuiz, "Make a new quiz in this course from a filled-in CSV or Excel sheet."), b("Export quiz template", () => QuizSheet.example("standard"), "Downloads an example sheet showing what to type where."));
    tools1.push(refresh);
    const body1 = section(host, "mine", `This Course's Quizzes (${mine.length})`, "Quizzes, surveys and answer collections for this course. Make new ones here; students' answers and scores stay in this course.", tools1);
    body1.appendChild(table(["Name", "Type", "Questions", "Max", "Answers", "Source", "Control"], mine.filter((r) => nm(r.d.name)).map((r) => {
      const d = r.d, it = d.libId && c.itemById(d.libId), stale = it && c.isStale(d, it);
      const ex = c.exportMenuItems(r, say);
      return [d.name || "(untitled)", c.KIND_LABEL[typeKey(d)], d.questions, d.max, d.answers, mk("td", stale ? "qts-stale" : "qts-n", sourceCell(r)),
        ctl(b("Edit", act(host, () => editElsewhere(r))),
          b("Rename", act(host, async () => { const v = prompt("New name:", d.name); if (v === null || !v.trim()) return ""; await c.editCourseTest(r, (t) => { t.name = v.trim(); }); return "Renamed."; })),
          b("Copy to course…", act(host, () => copyQuiz(r, model))),
          it ? null : b("Save as template", act(host, async () => { const x = await c.addToLibrary(r); return `“${x.name}” is now a template, and this quiz is linked to it.`; }), "Puts this quiz in Templates and links it, so edits go to every copy."),
          stale ? b("Update (re-grade)", act(host, () => c.updateOne(r))) : null,
          it ? b("Unlink", act(host, async () => { if (!confirm("Unlink this quiz from its template? Template edits will no longer reach it. (You can link it again later.)")) return ""; await c.makeOwn(r); return "Unlinked: this quiz is now its own copy."; }), "Stop following the template")
             : b("Link…", act(host, () => linkToTemplate(r, c)), "Link this quiz to a template so it follows the template's edits"),
          b("Delete", act(host, async () => { if (d.qr) throw new Error("close its QR code first (Test & Quiz Bank → QR Code → Close QR Code)"); if (!confirm(`Delete “${d.name}” from this course?${d.answers ? `\n\nIt has ${d.answers} student(s)' answers, which will be lost.` : ""}`)) return ""; await c.courseRemove(r.courseId, r.toolId, r.id); rebuildTabs(); return "Deleted."; })),
          ex.length ? c.menuButton("Export", () => ex) : null)];
    })));

    // ---- 2. all quizzes ----
    const body2 = section(host, "all", `All Quizzes (${rows.length})`, "Every quiz across your courses. Copy, edit, rename or export them here; new quizzes are made in “This Course's Quizzes”.", [
      search(host), sel("Course", "course", [["", "All courses"], ...model.courses.map((x) => [x.id, x.name])], host), sel("Type", "type", [["", "All"], ["quiz", "Quiz"], ["answers", "Answer Collection"], ["survey", "Research Survey"], ["formative", "Formative Survey"]], host), refresh]);
    body2.appendChild(table(["Course", "Name", "Type", "Questions", "Max", "Answers", "Source", "Control"], rows.filter((r) => nm(r.d.name) && (!F.course || r.courseId === F.course) && (!F.type || typeKey(r.d) === F.type)).sort((a, z) => (a.courseName + a.d.name).localeCompare(z.courseName + z.d.name)).map((r) => {
      const d = r.d, ex = c.exportMenuItems(r, say);
      return [mk("td", "qts-n", r.courseName), mk("td", "qts-name", d.name || "(untitled)"), mk("td", "qts-n", c.KIND_LABEL[typeKey(d)]), mk("td", "qts-n", String(d.questions == null ? "—" : d.questions)), mk("td", "qts-n", d.max == null ? "—" : String(d.max)), mk("td", "qts-n", String(d.answers || 0)), mk("td", "qts-n", sourceCell(r)),
        ctl(b("Edit", act(host, () => editElsewhere(r))),
          b("Copy to course…", act(host, () => copyQuiz(r, model))),
          b("Rename", act(host, async () => { const v = prompt("New name:", d.name); if (v === null || !v.trim()) return ""; await c.editCourseTest(r, (t) => { t.name = v.trim(); }); return "Renamed."; })),
          b("Delete", act(host, async () => { if (d.qr) throw new Error("close its QR code first"); if (!confirm(`Delete “${d.name}” from ${r.courseName}?${d.answers ? `\n\nIt has ${d.answers} student(s)' answers, which will be lost.` : ""}`)) return ""; await c.courseRemove(r.courseId, r.toolId, r.id); if (r.courseId === cid) rebuildTabs(); return "Deleted."; })),
          ex.length ? c.menuButton("Export", () => ex) : null)];
    })));

    // ---- 3. templates ----
    const tools3 = KINDS.map(([k, l]) => b(`+ New ${l} template`, act(host, async () => { await newTemplate(k, l, lib.items.length); return ""; })));
    if (window.QuizSheet) tools3.push(b("Upload quiz contents", uploadTemplate, "Make a new template from a filled-in CSV or Excel sheet."), b("Export quiz template", () => QuizSheet.example("standard")));
    tools3.push(refresh);
    const body3 = section(host, "tpl", `Templates (${lib.items.length})`, "A template is a quiz kept once. Copy it to this course (or others) and the copy stays linked: edit the template and every linked copy follows (a course with student answers shows “Update available”).", tools3);
    body3.appendChild(table(["Name", "Type", "Questions", "Max", "Used in", "Status", "Control"], lib.items.filter((it) => nm(it.name)).sort((a, z) => String(a.name).localeCompare(String(z.name))).map((it) => {
      const uses = model.rows.filter((r) => r.d.libId === it.id), stale = uses.filter((r) => c.isStale(r.d, it));
      const ex = c.exportMenuItems({ courseId: c.LIB, toolId: "", id: it.id, d: { kind: c.kindKey(it.kind) } }, say);
      const style = window.QRStyles && QRStyles.menuButton ? QRStyles.menuButton(() => it.style || null, async (st) => { await c.libLoad(true); const x = c.itemById(it.id); if (!x) return; x.style = st || undefined; x.hash = c.hashOf(c.itemTest(x)); x.rev += 1; x.updatedAt = new Date().toISOString(); await c.libSave(); await c.syncPass(x.id); model = null; draw(host); }, say, "btn btn-ghost btn-small") : null;
      return [it.name || "(untitled)", c.KIND_LABEL[c.kindKey(it.kind)], c.qCount(it), it.kind === "survey" || it.kind === "formative" ? null : it.max, uses.length ? `${uses.length} course quiz${uses.length === 1 ? "" : "zes"}` : "", stale.length ? mk("td", "qts-stale", `Update available (${stale.length})`) : "Up to date",
        ctl(b("Copy to this course", act(host, () => templateToHere(it)), "Adds a linked copy to this course."),
          b("Copy to courses…", act(host, () => c.addDialog({ courseId: c.LIB, toolId: "", id: it.id }))),
          b("Edit", act(host, async () => { await c.openTplEditor({ id: it.id }); return ""; })),
          stale.length ? b("Update all (re-grade)", act(host, async () => { const m = await c.updateAll(it, uses); return m; })) : null,
          b("Rename", act(host, async () => { const v = prompt("New name:", it.name); if (v === null || !v.trim()) return ""; await c.libLoad(true); const x = c.itemById(it.id); if (x) { x.name = v.trim(); await c.libSave(); } return "Renamed."; })),
          style,
          b("Delete", act(host, async () => { if (!confirm(`Delete the template “${it.name}”?\n\n${uses.length ? `The ${uses.length} course quiz${uses.length === 1 ? "" : "zes"} linked to it keep their questions and students' answers, and become own copies.` : "No course quiz uses it."}`)) return ""; await c.libLoad(true); const l2 = c.getLib(); l2.items = l2.items.filter((x) => x.id !== it.id); await c.libSave(); for (const u of uses) { try { await c.makeOwn(u); } catch (e) {} } return "Template deleted."; })),
          ex.length ? c.menuButton("Export", () => ex) : null)];
    })));
  }

  CMX.quizLibrary = (host) => { host.classList.add("qts-root"); model = null; draw(host); };
  const css = mk("style");
  css.textContent = ".cmq-sec { margin:0 0 18px; border:1px solid var(--line); border-radius:10px; padding:8px 12px; background:var(--card); } .cmq-sum { font-family:var(--font-heading); font-size:1.2rem; font-weight:700; cursor:pointer; padding:4px 0; } .cmq-sec[open] > .cmq-sum { margin-bottom:4px; } .cm-sections { margin-bottom:12px; }";
  document.head.appendChild(css);
})();
