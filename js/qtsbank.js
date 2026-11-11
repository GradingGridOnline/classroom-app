// ===== Quiz Library: every quiz's questions and settings live ONCE, in the Library (quizlibrary.json) =====
// A tab to the right of Journal, and the same grid inside every course's Test & Quiz Bank. A course "uses" a Library item:
// it keeps its own students' answers, scores, QR code and name, plus a working copy of the questions (libId / libRev /
// libHash). Editing a used quiz's questions in a course (or "Edit questions…" in the Library) updates the item; courses
// with no student answers follow automatically, courses with answers show "Update available" and one "Update (re-grade)"
// button. "Make my own copy" detaches a course's quiz for good. On first load, old families and master templates are
// moved into Library items (asking which version wins where copies drifted apart).
// quizlibindex.json lists what each course holds so the grid doesn't read every course. Load AFTER app.js and quizbank.js.

(function () {

  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const flush = () => { try { if (window.GGOAutosave && GGOAutosave.enabled()) GGOAutosave.flush(); } catch (e) {} };
  const nowIso = () => new Date().toISOString();
  const live = (courseId) => ScoringModule.currentCourseId === courseId;
  const LIB = "__lib__", LIB_FILE = "quizlibrary.json", OLD_FILE = "sharedtests.json", MAX_LIB = 300;
  const day = (iso) => (iso ? String(iso).slice(0, 10) : "");

  // ---------- the tab + panel ----------
  const reportBtn = document.getElementById("tab-reportcard-btn");
  const reportPanel = document.getElementById("reportcard-panel");
  if (!reportBtn || !reportPanel) return;
  const tabBtn = mk("button", "tab-btn", "Quiz Library"); tabBtn.id = "tab-qts-btn";
  (document.getElementById("tab-journal-btn") || reportBtn).after(tabBtn);
  tabBtn.style.display = "none"; // the Quiz Library now lives inside Class Material (js/classmaterial-quiz.js)
  const panel = mk("div", "tab-panel"); panel.id = "qts-panel"; panel.hidden = true;
  reportPanel.after(panel);

  const css = mk("style");
  css.textContent = `
.qts-root .qts-head { display:flex; gap:8px; align-items:center; flex-wrap:wrap; margin:0 0 6px; }
.qts-root .qts-head input[type=search] { flex:1; min-width:160px; max-width:280px; padding:4px 8px; }
.qts-root .qts-filters { display:flex; gap:10px; flex-wrap:wrap; align-items:flex-end; margin:0 0 8px; }
.qts-root .qts-filters label { display:flex; flex-direction:column; font-size:.78rem; gap:1px; }
.qts-root .qts-filters select { padding:2px 4px; font-size:.85rem; }
.qts-root .qts-wrap { overflow-x:auto; }
table.source-grid.qts-grid { font-size:.85rem; min-width:0; }
table.qts-grid th { border:1px solid #000; background:#e6e6e6; color:#000; padding:2px 6px; text-align:left; white-space:nowrap; cursor:pointer; height:24px; font-weight:700; user-select:none; }
table.qts-grid th.nosort { cursor:default; }
table.qts-grid td { padding:0 6px; vertical-align:middle; }
table.qts-grid td.qts-n { text-align:center; white-space:nowrap; }
table.qts-grid td.qts-ctl { display:table-cell; }
table.qts-grid td.qts-ctl .btn { margin:2px 3px 2px 0; }
table.qts-grid td.qts-name { min-width:9em; font-weight:600; }
table.qts-grid .btn { padding:1px 8px; margin:1px 0; font-size:.8rem; }
table.qts-grid tr.qts-me td { background:#fff6c8; }
table.qts-grid td.qts-detail { padding:6px; background:#f4f4f4; }
table.qts-grid .qts-link { cursor:pointer; text-decoration:underline; }
.qts-root h4.qts-h { font-size:1.2rem; margin:28px 0 6px; border-top:1px solid var(--line); padding-top:14px; }
.qts-root h4.qts-h:first-of-type { border-top:0; padding-top:0; margin-top:8px; }
.qts-root .qts-ties-title { font-weight:700; margin:0 0 4px; color:#000; }
.qts-root .qts-ties-hint { font-size:.8rem; margin:0 0 4px; color:#333; }
.qts-menu { position:fixed; z-index:20010; background:var(--card,#fff); color:var(--ink,#222); border:1px solid var(--line,#ccc); border-radius:8px; box-shadow:0 6px 20px rgba(0,0,0,.25); padding:4px; min-width:210px; max-height:70vh; overflow:auto; }
.qts-menu button { display:block; width:100%; text-align:left; border:0; background:transparent; color:inherit; font:inherit; font-size:.9rem; padding:6px 8px; border-radius:5px; cursor:pointer; }
.qts-menu button:hover { background:color-mix(in srgb, var(--green,#3d5a40) 16%, transparent); }
.qts-menu hr { border:0; border-top:1px solid var(--line,#ccc); margin:4px 0; }
#qts-overlay { position:fixed; inset:0; z-index:20012; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
#qts-box { background:var(--card,#fff); color:var(--ink,#222); width:min(520px,100%); max-height:90vh; overflow:auto; border-radius:10px; border:2px solid var(--green,#3d5a40); padding:16px 18px; box-shadow:0 12px 40px rgba(0,0,0,.5); }
#qts-box h3 { margin:0 0 8px; } #qts-box select { width:100%; margin:4px 0 10px; }
#qts-box label.qts-check { display:flex; gap:8px; align-items:center; margin:4px 0; }
#qts-box .qts-actions { display:flex; gap:8px; justify-content:flex-end; margin-top:12px; flex-wrap:wrap; }
.qts-toast { position:fixed; left:50%; bottom:20px; transform:translateX(-50%); z-index:20020; background:#222; color:#fff; padding:8px 14px; border-radius:8px; max-width:90vw; box-shadow:0 6px 20px rgba(0,0,0,.4); }
.qts-badge { display:inline-block; font-size:.78rem; padding:1px 8px; border-radius:10px; border:1px solid #888; background:#eee; color:#000; margin:0 4px; }
.qts-stale, td.qts-stale { background:#ffe9a8 !important; color:#000 !important; font-weight:700; }
.qts-badge.qts-stale { border-color:#a06a00; }
`;
  document.head.appendChild(css);
  let toastEl = null, toastTimer = null;
  function toast(msg) {
    if (!msg) return;
    if (toastEl) toastEl.remove();
    toastEl = mk("div", "qts-toast", msg); document.body.appendChild(toastEl);
    clearTimeout(toastTimer); toastTimer = setTimeout(() => { if (toastEl) toastEl.remove(); toastEl = null; }, 6000);
  }

  // ---------- content fingerprints ----------
  function stable(v) {
    if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
    if (v && typeof v === "object") return `{${Object.keys(v).sort().map((k) => `${JSON.stringify(k)}:${stable(v[k])}`).join(",")}}`;
    return JSON.stringify(v === undefined ? null : v);
  }
  function fingerprint(str) { // cyrb53
    let h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (let i = 0; i < str.length; i++) { const c = str.charCodeAt(i); h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677); }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  /** The part of a quiz that is copied and synced: kind, settings, sections (not name, answers, scores, token). */
  function contentOf(test) {
    if (!test || !test.quiz) return null;
    const t = { quiz: { kind: test.quiz.kind, settings: clone(test.quiz.settings || {}), sections: clone(test.quiz.sections || []) } };
    const q = ScoringModule.normalizeQuiz(t);
    return { kind: q.kind, settings: q.settings, sections: q.sections, style: test.quiz.style ? clone(test.quiz.style) : null, max: isSurveyKind(q.kind) ? 0 : ScoringModule.quizTotal(q) };
  }
  function hashOf(test) {
    const c = contentOf(test);
    return c ? fingerprint(stable(c.style ? { k: c.kind, s: c.settings, c: c.sections, st: c.style } : { k: c.kind, s: c.settings, c: c.sections })) : "";
  }


  const KIND_LABEL = { quiz: "Quiz", answers: "Answer Collection", survey: "Research Survey", formative: "Formative Survey", test: "Test" };
  /** One-line facts about a full test object (what the index stores and the grid shows). */
  function describe(test) {
    const quizOn = !!test.quiz;
    let kind = "test", questions = null, max = Number(test.maxPoints) || 0, answers = Object.keys(test.scores || {}).length, qr = false, edited = false;
    if (quizOn) {
      const c = contentOf(test);
      kind = c.kind === "answers" ? "answers" : c.kind === "survey" ? "survey" : c.kind === "formative" ? "formative" : "quiz";
      questions = c.sections.reduce((a, sec) => a + (sec.questions || []).length, 0);
      max = isSurveyKind(kind) ? null : c.max;
      answers = new Set((test.quiz.submissions || []).map((x) => x.sid)).size;
      qr = !!test.quiz.token;
      if (test.libId && test.libHash) edited = hashOf(test) !== test.libHash;
    }
    return { id: test.id, name: test.name || "", kind, questions, max, answers, qr, edited, libId: test.libId || "", libRev: Number(test.libRev) || 0 };
  }

  // ---------- the Library (quizlibrary.json) ----------
  // items: [{ id, name, kind, settings, sections, max, hash, rev, createdAt, updatedAt }]. A course quiz linked to an item
  // carries libId / libRev (the revision it matches) / libHash (fingerprint of its questions when last in step).
  let lib = null;
  async function libLoad(force) {
    if (lib && !force) return lib;
    let d = null;
    try { d = await storage.loadFile(LIB_FILE); } catch (e) { d = null; }
    lib = d && typeof d === "object" ? d : {};
    lib.items = Array.isArray(lib.items) ? lib.items : [];
    return lib;
  }
  async function libSave() { await storage.saveFile(LIB_FILE, { migrated: !!lib.migrated, items: lib.items }); }
  const itemById = (id) => (lib ? lib.items.find((x) => x.id === id) : null) || null;
  /** A test-shaped copy of a Library item (for exports, the editor, and adding to courses). */
  const itemTest = (item) => ({ id: item.id, name: item.name, maxPoints: item.max, sourceFile: "Quiz editor", rows: [], scores: {}, unmatched: [], quiz: { kind: item.kind, settings: clone(item.settings || {}), sections: clone(item.sections || []), style: item.style ? clone(item.style) : undefined, token: null, submissions: [] } });
  function newItem(test, name) {
    const c = contentOf(test);
    return { id: rid("lib"), name: name || test.name || "Untitled", kind: c.kind, settings: c.settings, sections: c.sections, style: c.style, max: c.max, hash: hashOf(test), rev: 1, createdAt: nowIso(), updatedAt: nowIso() };
  }
  /** A new course test that uses a Library item. */
  function useOf(item, name) {
    const t = itemTest(item);
    t.id = rid("test"); t.name = name || item.name; t.createdAt = nowIso(); t.libId = item.id; t.libRev = item.rev;
    t.libHash = hashOf(t);
    return t;
  }

  // ---------- the index (quizlibindex.json): what each course holds, so the grid doesn't read every course ----------
  const INDEX_FILE = "quizlibindex.json";
  const isTmp = (id) => String(id).startsWith("tmpledit-");
  function describeTools(tools) {
    return (tools || []).filter((t) => t.type === "testbank").map((t) => ({
      toolId: t.id, toolName: t.name,
      tests: ((t.config && Array.isArray(t.config.tests)) ? t.config.tests : []).map(describe),
    }));
  }
  const Index = {
    queue: new Map(), gone: new Set(), timer: null, running: null,
    queueCourse(courseId, tools) { if (isTmp(courseId)) return; this.gone.delete(courseId); this.queue.set(courseId, describeTools(tools)); this.arm(); },
    queueDelete(courseId) { this.queue.delete(courseId); this.gone.add(courseId); this.arm(); },
    arm() { clearTimeout(this.timer); this.timer = setTimeout(() => this.flush().catch(() => {}), 1500); },
    async flush() {
      clearTimeout(this.timer);
      if (this.running) { try { await this.running; } catch (e) {} }
      if (!this.queue.size && !this.gone.size) return;
      const q = new Map(this.queue), g = new Set(this.gone);
      this.queue.clear(); this.gone.clear();
      this.running = (async () => {
        const idx = (await storage.loadFile(INDEX_FILE)) || {};
        idx.courses = idx.courses || {};
        q.forEach((tools, id) => { idx.courses[id] = { at: nowIso(), tools }; });
        g.forEach((id) => { delete idx.courses[id]; });
        await storage.saveFile(INDEX_FILE, idx);
      })();
      try { await this.running; } finally { this.running = null; }
    },
    async load() { await this.flush().catch(() => {}); const d = await storage.loadFile(INDEX_FILE); return d && d.courses ? d : { courses: {} }; },
  };
  // Edits to a linked quiz's questions are sent to the Library after a quiet moment.
  const Push = {
    delay: 6000, pending: new Map(), timer: null, chain: Promise.resolve(),
    note(ref) { this.pending.set(ref.id, ref); this.arm(); },
    arm(ms) { clearTimeout(this.timer); this.timer = setTimeout(() => this.run().catch(() => {}), ms == null ? this.delay : ms); },
    run() {
      clearTimeout(this.timer);
      const refs = [...this.pending.values()]; this.pending.clear();
      this.chain = this.chain.then(async () => {
        for (const r of refs) {
          try { const res = await pushToLibrary(r); if (res && res.msg) toast(res.msg); } catch (e) { toast(`Couldn't update the Library: ${e.message}`); }
        }
      });
      return this.chain;
    },
  };
  // Every save/delete of a course's scoring file refreshes that course's index entry and spots edited linked quizzes.
  function hookStorage(P) {
    if (!P || P.__qtsHooked) return;
    P.__qtsHooked = true;
    const rawSave = P.saveFile, rawDelete = P.deleteFile;
    P.saveFile = async function (name, data) {
      const r = await rawSave.apply(this, arguments);
      const m = /^scoring-(.+)\.json$/.exec(String(name));
      if (m && data && Array.isArray(data.tools) && !isTmp(m[1])) {
        try {
          Index.queueCourse(m[1], data.tools);
          data.tools.forEach((tool) => {
            if (tool.type !== "testbank" || !tool.config) return;
            (tool.config.tests || []).forEach((t) => { if (t.libId && t.quiz && t.libHash && hashOf(t) !== t.libHash) Push.note({ courseId: m[1], toolId: tool.id, id: t.id }); });
          });
        } catch (e) {}
      }
      return r;
    };
    if (rawDelete) {
      P.deleteFile = async function (name) {
        const r = await rawDelete.apply(this, arguments);
        const m = /^scoring-(.+)\.json$/.exec(String(name));
        if (m) Index.queueDelete(m[1]);
        return r;
      };
    }
  }
  if (typeof SupabaseProvider !== "undefined") hookStorage(SupabaseProvider.prototype);
  window.addEventListener("beforeunload", () => { try { if (Index.queue.size) Index.flush(); } catch (e) {} });

  const invalidate = () => {};

  // ---------- reading everything ----------
  async function loadModel(opts) {
    opts = opts || {};
    if (opts.flush && window.GGOAutosave && GGOAutosave.enabled()) await GGOAutosave.flush();
    await libEnsure();
    const m = { courses: [], rows: [], items: lib.items, legacy: [] };
    const idx = opts.rebuild ? { courses: {} } : await Index.load();
    let changedIdx = !!opts.rebuild;
    for (const c of CoursesModule.activeCourses()) {
      let tools;
      if (live(c.id)) {
        tools = describeTools(ScoringModule.tools); // the open course is always read live
      } else if (idx.courses[c.id]) {
        tools = idx.courses[c.id].tools;
      } else {
        let data = null;
        try { data = await storage.loadFile(`scoring-${c.id}.json`); } catch (e) { data = null; }
        tools = describeTools((data && data.tools) || []);
        idx.courses[c.id] = { at: nowIso(), tools };
        changedIdx = true;
      }
      m.courses.push({ id: c.id, name: c.name, tools: tools.map((t) => ({ toolId: t.toolId, toolName: t.toolName })) });
      tools.forEach((t) => t.tests.forEach((d) => m.rows.push({ courseId: c.id, courseName: c.name, toolId: t.toolId, toolName: t.toolName, id: d.id, d })));
    }
    if (changedIdx) { try { await storage.saveFile(INDEX_FILE, idx); } catch (e) {} }
    // Old group lists (kept only so their items can be imported into the Library).
    try {
      if (window.GroupShare) {
        const groups = await GroupShare.myGroups(true);
        for (const g of groups || []) {
          const d = await GroupShare.loadDoc(g.id, "tests");
          if (d && Array.isArray(d.items) && d.items.length) m.legacy.push({ key: g.id, label: `the old group list “${g.name}”`, items: d.items });
        }
      }
    } catch (e) { /* groups are optional */ }
    return m;
  }
  const sameRef = (a, b) => a.courseId === b.courseId && a.id === b.id;
  const isStale = (d, item) => !!item && d.libRev < item.rev;

  // ---------- reading / writing one item in any course ----------
  async function courseFile(courseId) { return await storage.loadFile(`scoring-${courseId}.json`); }
  /** The complete test object (questions, answers…) for a row. */
  async function fullOf(ref) {
    if (ref.courseId === LIB) { await libLoad(); const it = itemById(ref.id); return it ? itemTest(it) : null; }
    if (live(ref.courseId)) return ScoringModule.findTest(ref.toolId, ref.id);
    const data = await courseFile(ref.courseId);
    const tool = ((data && data.tools) || []).find((t) => t.id === ref.toolId);
    return (tool && tool.config && (tool.config.tests || []).find((x) => x.id === ref.id)) || null;
  }
  /** Writes a change to one course test (open course: in memory + autosave; other course: that file). */
  async function editCourseTest(ref, fn) {
    if (live(ref.courseId)) { const t = ScoringModule.findTest(ref.toolId, ref.id); if (!t) throw new Error("That item no longer exists."); const r = fn(t, true); flush(); return r; }
    const data = await courseFile(ref.courseId);
    const tool = ((data && data.tools) || []).find((x) => x.id === ref.toolId);
    const t = tool && tool.config && (tool.config.tests || []).find((x) => x.id === ref.id);
    if (!t) throw new Error("That item no longer exists.");
    const r = fn(t, false);
    await storage.saveFile(`scoring-${ref.courseId}.json`, data);
    return r;
  }
  async function courseAdd(courseId, toolId, test) {
    if (live(courseId)) {
      let id = toolId;
      if (id === "__new") id = ScoringModule.addTool("testbank").id;
      const cfg = ScoringModule.getTestBankConfig(id);
      if (!cfg) throw new Error("That Test & Quiz Bank no longer exists.");
      if (cfg.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`That bank is at its limit of ${MAX_TESTS_PER_BANK}.`);
      cfg.tests.push(test); flush(); return id;
    }
    const data = (await storage.loadFile(`scoring-${courseId}.json`)) || { categories: [], records: {}, weights: { attendance: 0 }, tools: [], presentationMigrated: true };
    data.tools = data.tools || [];
    let tool;
    if (toolId === "__new") {
      if (data.tools.length >= MAX_SCORING_TOOLS) throw new Error(`That course already has ${MAX_SCORING_TOOLS} scoring tabs.`);
      const n = data.tools.filter((t) => t.type === "testbank").length;
      tool = { id: rid("tool"), type: "testbank", name: n === 0 ? "Test & Quiz Bank" : `Test & Quiz Bank ${n + 1}`, config: { tests: [] } };
      data.tools.push(tool);
    } else tool = data.tools.find((t) => t.id === toolId);
    if (!tool) throw new Error("That Test & Quiz Bank no longer exists.");
    if (!tool.config || typeof tool.config !== "object") tool.config = {};
    if (!Array.isArray(tool.config.tests)) tool.config.tests = [];
    if (tool.config.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`That bank is at its limit of ${MAX_TESTS_PER_BANK}.`);
    tool.config.tests.push(test);
    await storage.saveFile(`scoring-${courseId}.json`, data);
    return tool.id;
  }
  async function courseRemove(courseId, toolId, testId) {
    if (live(courseId)) { ScoringModule.removeTest(toolId, testId); flush(); return; }
    const data = await storage.loadFile(`scoring-${courseId}.json`);
    if (!data) return;
    const tool = (data.tools || []).find((t) => t.id === toolId);
    if (tool && tool.config && Array.isArray(tool.config.tests)) tool.config.tests = tool.config.tests.filter((t) => t.id !== testId);
    (data.categories || []).forEach((c) => (c.items || []).forEach((i) => {
      const sel = i.scoreSources && i.scoreSources.testSelections;
      if (sel && sel[toolId] === testId) delete sel[toolId];
    }));
    (data.tools || []).forEach((t) => {
      if (t.type !== "table" || !t.config) return;
      (Array.isArray(t.config.projects) ? t.config.projects : [t.config]).forEach((pc) => (pc.columns || []).forEach((col) => { if (col.testSource && col.testSource.toolId === toolId && col.testSource.testId === testId) col.testSource = { toolId: "", testId: "" }; }));
    });
    await storage.saveFile(`scoring-${courseId}.json`, data);
  }
  /** Regrades a quiz that lives in a course that is NOT open, using that course's own roster. */
  function detachedRegrade(test, students) {
    const rm = window.RosterModule;
    const oldStudents = rm.students, oldFind = ScoringModule.findTest;
    try {
      rm.students = students || [];
      ScoringModule.findTest = () => test;
      ScoringModule.regradeQuiz("x", test.id);
    } finally { rm.students = oldStudents; ScoringModule.findTest = oldFind; }
  }

  // ---------- keeping courses in step with the Library ----------
  /** Replaces a course quiz's questions with the Library item's and regrades any answers. Name, answers, scores and QR link stay. */
  async function applyUpdate(ref, item) {
    const probe = await fullOf(ref);
    if (!probe) throw new Error("That item no longer exists.");
    if (probe.quiz && probe.quiz.token) throw new Error("its QR code is open — close it first (Test & Quiz Bank → QR Code → Close QR Code)");
    let students = null;
    if (!live(ref.courseId) && probe.quiz && (probe.quiz.submissions || []).length) {
      const r = await storage.loadFile(`roster-${ref.courseId}.json`);
      students = (r && r.students) || [];
    }
    await editCourseTest(ref, (t, isLive) => {
      t.quiz = { ...(t.quiz || {}), kind: item.kind, settings: clone(item.settings || {}), sections: clone(item.sections || []), style: item.style ? clone(item.style) : undefined };
      if (!Array.isArray(t.quiz.submissions)) t.quiz.submissions = [];
      t.maxPoints = item.max; t.libId = item.id; t.libRev = item.rev;
      if (isLive) ScoringModule.regradeQuiz(ref.toolId, t.id);
      else if (t.quiz.submissions.length) detachedRegrade(t, students);
      t.libHash = hashOf(t);
    });
  }
  /** What an update will change, in words. */
  async function impactText(target, item) {
    const t = await fullOf(target);
    if (!t || !t.quiz) return "";
    const old = contentOf(t);
    const count = (secs) => secs.reduce((a, sec) => a + (sec.questions || []).length, 0);
    const students = new Set((t.quiz.submissions || []).map((x) => x.sid)).size;
    let msg = `\n\nQuestions: ${count(old.sections)} → ${count(item.sections || [])}. Max score: ${old.max} → ${item.max}.`;
    if (students) msg += `\n${students} student(s) have answered it. Their answers are kept and regraded against the new questions (a new question counts as unanswered), so scores can change.`;
    if (t.libHash && hashOf(t) !== t.libHash) msg += "\nThis course's own changes to the questions will be replaced. (To keep them, choose “Make my own copy” instead.)";
    return msg;
  }
  /** Updates courses that have no answers (and no open QR). Others keep showing "Update available". */
  async function syncPass(libId, courseId) {
    await libLoad(true);
    const model = await loadModel({});
    let updated = 0, waiting = 0;
    for (const r of model.rows) {
      if (!r.d.libId || (libId && r.d.libId !== libId) || (courseId && r.courseId !== courseId)) continue;
      const item = itemById(r.d.libId);
      if (!isStale(r.d, item)) continue;
      if (r.d.answers > 0 || r.d.qr || r.d.edited) { waiting++; continue; }
      try { await applyUpdate(r, item); updated++; } catch (e) { waiting++; }
    }
    return { updated, waiting };
  }
  /** Sends an edited linked quiz's questions to its Library item, then updates the other courses that can be. */
  async function pushToLibrary(ref) {
    const t = await fullOf(ref);
    if (!t || !t.libId || !t.quiz) return null;
    await libLoad(true);
    const item = itemById(t.libId);
    if (!item) return null; // the item was deleted: this is now an own copy
    const h = hashOf(t);
    if (h === t.libHash) return null;
    if ((Number(t.libRev) || 0) < item.rev) return { msg: `“${t.name}” has changes of its own, but the Library item has a newer version. Update it, or choose “Make my own copy”.` };
    if (h !== item.hash) {
      const c = contentOf(t);
      Object.assign(item, { kind: c.kind, settings: c.settings, sections: c.sections, style: c.style, max: c.max, hash: h, rev: item.rev + 1, updatedAt: nowIso() });
      await libSave();
    }
    await editCourseTest(ref, (x) => { x.libRev = item.rev; x.libHash = h; });
    const r = await syncPass(item.id);
    const parts = [];
    if (r.updated) parts.push(`${r.updated} other ${r.updated === 1 ? "course" : "courses"} updated`);
    if (r.waiting) parts.push(`${r.waiting} ${r.waiting === 1 ? "has" : "have"} an update waiting`);
    return { item, msg: `Library: “${item.name}” saved${parts.length ? ` — ${parts.join(", ")}` : ""}.` };
  }
  /** Makes a course quiz independent of the Library (one way: it can't rejoin). */
  async function makeOwn(ref) {
    await editCourseTest(ref, (t) => { delete t.libId; delete t.libRev; delete t.libHash; });
    return "That quiz is now its own copy. Library changes no longer reach it.";
  }
  /** Puts a course quiz into the Library (new item) and links it. Returns the item. */
  async function addToLibrary(ref) {
    const full = await fullOf(ref);
    if (!full || !full.quiz) throw new Error("Only quizzes and surveys can go in the Library.");
    await libLoad(true);
    if (full.libId && itemById(full.libId)) { await pushToLibrary(ref); return itemById(full.libId); }
    if (lib.items.length >= MAX_LIB) throw new Error(`The Library is at its limit of ${MAX_LIB} items.`);
    const item = newItem(full);
    lib.items.push(item); await libSave();
    await editCourseTest(ref, (t) => { t.libId = item.id; t.libRev = item.rev; t.libHash = hashOf(t); });
    return item;
  }

  // ---------- one-time move from families and master templates into the Library ----------
  async function migrate() {
    const groups = new Map(), solos = [];
    const docs = new Map();
    const visit = [];
    for (const c of CoursesModule.activeCourses()) {
      let tools;
      if (live(c.id)) tools = ScoringModule.tools;
      else {
        let data = null; try { data = await courseFile(c.id); } catch (e) { data = null; }
        if (!data) continue;
        docs.set(c.id, data); tools = data.tools || [];
      }
      tools.forEach((tool) => { if (tool.type === "testbank" && tool.config) (tool.config.tests || []).forEach((t) => visit.push({ courseId: c.id, courseName: c.name, toolId: tool.id, t })); });
    }
    let tdoc = null; try { tdoc = await storage.loadFile(OLD_FILE); } catch (e) { tdoc = null; }
    const tpls = ((tdoc && Array.isArray(tdoc.items)) ? tdoc.items : []).filter((x) => x && x.quiz);
    const place = (m) => { if (m.t.fam) { if (!groups.has(m.t.fam)) groups.set(m.t.fam, []); groups.get(m.t.fam).push(m); } else solos.push([m]); };
    tpls.forEach((t) => place({ courseId: LIB, courseName: "Master template", tpl: true, t }));
    visit.forEach((m) => { if (m.t.quiz && m.t.fam) place(m); });
    const links = new Map(); // courseId -> Map(testId -> {libId, libRev})
    const items = [];
    const link = (m, item, rev) => { if (m.tpl) return; if (!links.has(m.courseId)) links.set(m.courseId, new Map()); links.get(m.courseId).set(m.t.id, { libId: item.id, libRev: rev }); };
    for (const members of [...groups.values(), ...solos]) {
      if (members.length === 1 && !members[0].tpl) continue; // a lone copy: just an own copy
      members.sort((a, b) => (b.tpl ? 1 : 0) - (a.tpl ? 1 : 0));
      const byHash = new Map();
      members.forEach((m) => { const h = hashOf(m.t); m.h = h; if (!byHash.has(h)) byHash.set(h, []); byHash.get(h).push(m); });
      let winner = members[0].h, split = false;
      if (byHash.size > 1) {
        const pick = await dialog((box, done) => {
          box.appendChild(mk("h3", "", `“${members[0].t.name}” has different versions`));
          box.appendChild(mk("p", "hint", "Copies of this quiz have drifted apart. Choose the version the Library keeps. The others stay as they are until you update them (courses with no student answers update on their own), or keep them as separate Library items."));
          let chosen = members[0].h;
          members.forEach((m) => {
            const l = mk("label", "qts-check"); const r = mk("input"); r.type = "radio"; r.name = "qlv"; r.checked = m === members[0];
            r.addEventListener("change", () => { chosen = m.h; });
            const d = describe(m.t);
            l.append(r, mk("span", "", `${m.tpl ? "Master template" : m.courseName} — “${m.t.name}” — ${d.questions} questions${d.answers ? `, ${d.answers} student(s) answered` : ""}`));
            box.appendChild(l);
          });
          const acts = mk("div", "qts-actions");
          const sep = mk("button", "btn btn-ghost", "Keep as separate items"); sep.type = "button"; sep.addEventListener("click", () => done({ split: true }));
          const go = mk("button", "btn btn-primary", "Use the chosen version"); go.type = "button"; go.addEventListener("click", () => done({ h: chosen }));
          acts.append(sep, go); box.appendChild(acts);
        });
        if (!pick || pick.split) split = true; else winner = pick.h;
      }
      const parts = split ? [...byHash.values()] : [byHash.get(winner)];
      parts.forEach((ms) => {
        if (items.length + lib.items.length >= MAX_LIB) return;
        const item = newItem(ms[0].t, ms[0].t.name);
        items.push(item);
        ms.forEach((m) => link(m, item, 1));
        if (!split) members.forEach((m) => { if (!ms.includes(m)) link(m, item, 0); }); // other versions: update available
      });
    }
    // Write the links, and drop the old family markers from every course quiz we visited.
    const byCourse = new Map();
    visit.forEach((m) => { if (!byCourse.has(m.courseId)) byCourse.set(m.courseId, []); byCourse.get(m.courseId).push(m); });
    for (const [cid, ms] of byCourse) {
      let dirty = false;
      ms.forEach((m) => {
        const l = links.get(cid) && links.get(cid).get(m.t.id);
        if (m.t.fam || m.t.famLeft || m.t.master || m.t.clone) { delete m.t.fam; delete m.t.famLeft; delete m.t.master; delete m.t.clone; dirty = true; }
        if (l) { m.t.libId = l.libId; m.t.libRev = l.libRev; m.t.libHash = hashOf(m.t); dirty = true; }
      });
      if (!dirty) continue;
      if (live(cid)) flush(); else await storage.saveFile(`scoring-${cid}.json`, docs.get(cid));
    }
    lib.items = lib.items.concat(items);
    lib.migrated = true;
    await libSave();
  }
  async function libEnsure() {
    await libLoad();
    if (!lib.migrated) await migrate();
    return lib;
  }

  // ---------- menus ----------
  let openMenu = null;
  const closeMenu = () => { if (openMenu) { openMenu.remove(); openMenu = null; } };
  document.addEventListener("click", (e) => { if (openMenu && !openMenu.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", closeMenu, true);
  function menuButton(label, getItems) {
    const b = mk("button", "btn btn-ghost btn-small", `${label} ▾`); b.type = "button";
    b.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openMenu) { closeMenu(); return; }
      const list = mk("div", "qts-menu"); openMenu = list;
      getItems().forEach((it) => {
        if (it === "-") { list.appendChild(mk("hr")); return; }
        const i = mk("button", "", it.label); i.type = "button";
        i.addEventListener("click", (ev) => { ev.stopPropagation(); closeMenu(); it.onClick(); });
        list.appendChild(i);
      });
      document.body.appendChild(list);
      const r = b.getBoundingClientRect();
      const below = r.bottom + 4;
      list.style.top = `${below + list.offsetHeight > window.innerHeight ? Math.max(8, r.top - list.offsetHeight - 4) : below}px`;
      list.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - list.offsetWidth - 8))}px`;
    });
    return b;
  }
  function dialog(build) {
    return new Promise((resolve) => {
      const ov = mk("div"); ov.id = "qts-overlay";
      const box = mk("div"); box.id = "qts-box"; ov.appendChild(box);
      const done = (v) => { ov.remove(); resolve(v); };
      build(box, done);
      ov.addEventListener("mousedown", (e) => { if (e.target === ov) done(null); });
      document.body.appendChild(ov);
    });
  }


  function exportMenuItems(row, say) {
    const d = row.d;
    let labels;
    if (d.kind === "test") labels = [["CSV: Scores", "csv"], ["Excel: Scores", "xlsx"]];
    else if (!window.QuizExport) labels = [];
    else {
      const stub = { name: "x", quiz: { kind: d.kind === "answers" ? "answers" : d.kind === "survey" ? "survey" : d.kind === "formative" ? "formative" : "standard", settings: {}, sections: [], submissions: [] } };
      labels = window.QuizExport.items(stub, false).map((it) => [it.label, null]);
    }
    return labels.map(([label, fmt]) => ({
      label,
      onClick: async () => {
        try {
          say("Preparing export…");
          const test = await fullOf(row);
          if (!test) throw new Error("That item no longer exists.");
          if (!test.quiz) {
            const rows = [["Student", "School ID", "Score", "Max score"]];
            (test.rows || []).forEach((r) => rows.push([r.name || "", r.schoolId || "", r.score === undefined ? "" : r.score, Number(test.maxPoints) || ""]));
            QuizExport.download(`${test.name || "test"} - scores`, rows, fmt);
          } else {
            const hit = window.QuizExport.items(test, false).find((x) => x.label === label);
            if (hit) hit.onClick();
          }
          say("");
        } catch (e) { say(`Couldn't export: ${e.message}`); }
      },
    }));
  }


  // ---------- adding to courses ----------
  /** src: a Library item { courseId: LIB, id } or a course quiz { courseId, toolId, id } (it is added to the Library first). */
  async function addDialog(src) {
    const model = await loadModel({});
    const full = await fullOf(src);
    if (!full) throw new Error("That item no longer exists.");
    if (!full.quiz) throw new Error("Only quizzes and surveys can be added to courses.");
    const fromLib = src.courseId === LIB;
    const itemId = fromLib ? src.id : full.libId;
    const using = new Set(model.rows.filter((r) => itemId && r.d.libId === itemId).map((r) => r.courseId));
    const picked = await dialog((box, done) => {
      box.appendChild(mk("h3", "", `Add “${full.name}” to courses`));
      box.appendChild(mk("p", "hint", fromLib || (full.libId && itemById(full.libId))
        ? "Each course gets its own quiz to run: students' answers and scores stay in that course. The questions stay in the Library, so later changes reach every course that uses it."
        : "This quiz is put in the Library first. Each course then gets its own quiz to run (answers and scores stay in that course), and later changes to the questions reach every course that uses it."));
      const boxes = [];
      model.courses.forEach((c) => {
        const l = mk("label", "qts-check"); const cb = mk("input"); cb.type = "checkbox"; cb.value = c.id;
        l.append(cb, mk("span", "", c.name + (c.id === src.courseId ? " (this course — adds a second copy)" : using.has(c.id) ? " (already uses it)" : "")));
        boxes.push(cb); box.appendChild(l);
      });
      const msg = mk("p", "hint"); box.appendChild(msg);
      const acts = mk("div", "qts-actions");
      const cancel = mk("button", "btn btn-ghost", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", () => done(null));
      const go = mk("button", "btn btn-primary", "Add"); go.type = "button";
      go.addEventListener("click", () => { const ids = boxes.filter((b) => b.checked).map((b) => b.value); if (!ids.length) { msg.textContent = "Tick at least one course."; return; } done(ids); });
      acts.append(cancel, go); box.appendChild(acts);
    });
    if (!picked) return "";
    let item;
    if (fromLib) { await libLoad(true); item = itemById(src.id); } else item = await addToLibrary(src);
    if (!item) throw new Error("That Library item no longer exists.");
    const errs = []; let n = 0;
    for (const cid of picked) {
      try {
        const course = model.courses.find((x) => x.id === cid);
        const toolId = cid === src.courseId && src.toolId ? src.toolId : course && course.tools.length ? course.tools[0].toolId : "__new";
        await courseAdd(cid, toolId, useOf(item, cid === src.courseId ? `${item.name} (copy)` : item.name));
        n++;
      } catch (e) { errs.push(`${(model.courses.find((c) => c.id === cid) || {}).name || cid}: ${e.message}`); }
    }
    return `Added “${item.name}” to ${n} course${n === 1 ? "" : "s"}.${errs.length ? ` Couldn't add to: ${errs.join("; ")}` : ""}`;
  }
  /** One Library item (or a course quiz, which is put in the Library first) into one specific Test & Quiz Bank. */
  async function useIn(src, courseId, toolId) {
    let item;
    if (src.courseId === LIB) { await libLoad(true); item = itemById(src.id); } else item = await addToLibrary(src);
    if (!item) throw new Error("That Library item no longer exists.");
    await courseAdd(courseId, toolId, useOf(item, item.name));
    return `Added “${item.name}” to this course.`;
  }
  async function updateOne(row) {
    await libLoad(true);
    const item = itemById(row.d.libId);
    if (!item) throw new Error("the Library item no longer exists");
    if (row.d.qr) throw new Error("its QR code is open — close it first (Test & Quiz Bank → QR Code → Close QR Code)");
    if (row.d.answers > 0 || row.d.edited) {
      if (!confirm(`Update “${row.d.name}”${row.courseName ? ` (${row.courseName})` : ""} to the newest version of “${item.name}”?${await impactText(row, item)}`)) return "";
    }
    await applyUpdate(row, item);
    return `Updated “${row.d.name}”.`;
  }
  async function updateAll(item, uses) {
    const stale = uses.filter((r) => isStale(r.d, item));
    const withAns = stale.filter((r) => r.d.answers > 0);
    if (!stale.length) return "Everything is already up to date.";
    if (!confirm(`Update ${stale.length} course${stale.length === 1 ? "" : "s"} to the newest “${item.name}”?${withAns.length ? `\n\n${withAns.length} of them have student answers, which are kept and regraded against the new questions (scores can change).` : ""}`)) return "";
    let n = 0; const skipped = [];
    for (const r of stale) { try { await applyUpdate(r, item); n++; } catch (e) { skipped.push(`${r.courseName}: ${e.message}`); } }
    return `Updated ${n}.${skipped.length ? ` Skipped — ${skipped.join("; ")}` : ""}`;
  }

  // ---------- the Library grid (tab, and inside each Test & Quiz Bank) ----------
  // ctx (optional, inside a Test & Quiz Bank): { toolId, rerender }
  let pendingMsg = "";
  const openUses = new Set(); // Library item ids whose "Used in" list is open
  const COLS = [["name", "Name"], ["type", "Type"], ["q", "Questions"], ["max", "Max"], ["used", "Used in"], ["status", "Status"]];
  const kindKey = (k) => (k === "answers" ? "answers" : k === "formative" ? "formative" : isSurveyKind(k) ? "survey" : "quiz");
  const qCount = (item) => (item.sections || []).reduce((a, sec) => a + (sec.questions || []).length, 0);
  const courseWord = (n) => `${n} course${n === 1 ? "" : "s"}`;
  function useStatus(d, item) {
    if (!isStale(d, item)) return "Up to date";
    return d.qr ? "Update available (close its QR first)" : d.edited ? "Update available (has its own changes)" : "Update available";
  }
  function makeView(host, ctx) {
    ctx = ctx || {};
    let model = null, busy = false, statusEl = null;
    const F = { q: "", course: "", type: "", status: "" };
    let sort = [{ key: "name", dir: 1 }];
    const inTool = !!ctx.toolId;
    host.classList.add("qts-root");
    const say = (t) => { if (statusEl) statusEl.textContent = t; };

    async function refresh(msg, force, rebuild) {
      if (busy) return;
      busy = true;
      host.textContent = "";
      host.appendChild(mk("p", "hint", "Loading your Library…"));
      try {
        model = await loadModel({ flush: !inTool, rebuild: !!rebuild });
        const r = await syncPass();
        if (r.updated) { model = await loadModel({}); msg = msg || `${courseWord(r.updated)} updated to the newest version.`; }
      } catch (e) { host.textContent = ""; host.appendChild(mk("p", "hint", `Couldn't load: ${e.message}`)); busy = false; return; }
      busy = false;
      render(msg);
    }
    const changed = async (msg) => {
      try { await Index.flush(); } catch (e) {}
      if (inTool && ctx.rerender) { pendingMsg = msg || ""; ctx.rerender(); } else await refresh(msg);
    };
    const run = (fn) => async () => { try { const m = await fn(); if (m !== undefined && m !== "") await changed(m); else if (m === "") say(""); } catch (e) { say(`Couldn't do that: ${e.message}`); } };

    function gridRows() {
      const out = [];
      model.items.forEach((item) => {
        const uses = model.rows.filter((r) => r.d.libId === item.id);
        const stale = uses.filter((r) => isStale(r.d, item));
        out.push({ kind: "item", item, uses, stale, name: item.name, type: kindKey(item.kind), q: qCount(item), max: item.kind === "survey" || item.kind === "formative" ? null : item.max, status: stale.length ? "Update available" : "Up to date" });
      });
      model.rows.forEach((r) => {
        if (r.d.libId && itemById(r.d.libId)) return;
        out.push({ kind: "own", r, name: r.d.name, type: r.d.kind, q: r.d.questions, max: r.d.max, status: "Own copy" });
      });
      return out;
    }
    function visibleRows() {
      const q = F.q.toLowerCase();
      const rows = gridRows().filter((g) => {
        if (q && !String(g.name).toLowerCase().includes(q)) return false;
        if (F.course && !(g.kind === "item" ? g.uses.some((u) => u.courseId === F.course) : g.r.courseId === F.course)) return false;
        if (F.type && g.type !== F.type) return false;
        if (F.status && g.status !== F.status) return false;
        return true;
      });
      const val = (g, k) => {
        switch (k) {
          case "name": return String(g.name).toLowerCase();
          case "type": return g.type;
          case "q": return g.q == null ? -1 : g.q;
          case "max": return g.max == null ? -1 : g.max;
          case "used": return g.kind === "item" ? new Set(g.uses.map((u) => u.courseId)).size : 1;
          default: return g.status;
        }
      };
      rows.sort((a, b) => { for (const s of sort) { const x = val(a, s.key), y = val(b, s.key); if (x !== y) return (x < y ? -1 : 1) * s.dir; } return String(a.name).localeCompare(String(b.name)); });
      return rows;
    }

    function itemMenu(g) {
      const item = g.item, ref = { courseId: LIB, toolId: "", id: item.id };
      const items = [];
      if (inTool) items.push({ label: "Use in this course", onClick: run(() => useIn(ref, ScoringModule.currentCourseId, ctx.toolId)) });
      items.push({ label: "Add to courses…", onClick: run(() => addDialog(ref)) });
      items.push({ label: "Edit questions…", onClick: run(() => openTplEditor({ id: item.id })) });
      if (g.stale.length) items.push({ label: "Update all courses (re-grade)", onClick: run(() => updateAll(item, g.uses)) });
      items.push("-",
        { label: "Rename…", onClick: run(async () => {
          const v = prompt("New name:", item.name); if (v === null || !v.trim()) return "";
          await libLoad(true); const it = itemById(item.id); if (it) { it.name = v.trim(); await libSave(); } return "Renamed.";
        }) },
        { label: "Delete from Library…", onClick: run(async () => {
          if (!confirm(`Delete “${item.name}” from the Library?\n\n${g.uses.length ? `The ${g.uses.length} course quiz${g.uses.length === 1 ? "" : "zes"} using it keep their questions and students' answers, and become own copies.` : "No course uses it."}`)) return "";
          await libLoad(true);
          lib.items = lib.items.filter((x) => x.id !== item.id); await libSave();
          for (const u of g.uses) { try { await makeOwn(u); } catch (e) {} }
          return "Deleted from the Library.";
        }) });
      const ex = exportMenuItems({ courseId: LIB, toolId: "", id: item.id, d: { kind: kindKey(item.kind) } }, say);
      if (ex.length) items.push("-", ...ex);
      return items;
    }
    function ownMenu(g) {
      const r = g.r, d = r.d, items = [];
      if (d.kind !== "test") {
        if (inTool && r.courseId !== ScoringModule.currentCourseId) items.push({ label: "Use in this course (adds it to the Library)", onClick: run(() => useIn(r, ScoringModule.currentCourseId, ctx.toolId)) });
        items.push({ label: "Add to courses… (adds it to the Library)", onClick: run(() => addDialog(r)) });
        items.push({ label: "Add to the Library only", onClick: run(async () => { const it = await addToLibrary(r); return `“${it.name}” is in the Library.`; }) });
        items.push("-");
      }
      items.push(
        { label: "Rename…", onClick: run(async () => {
          const v = prompt("New name:", d.name); if (v === null || !v.trim()) return "";
          await editCourseTest(r, (t) => { t.name = v.trim(); }); return "Renamed.";
        }) },
        { label: "Delete…", onClick: run(async () => {
          if (d.qr) throw new Error("close its QR code first (Test & Quiz Bank → QR Code → Close QR Code)");
          if (!confirm(`Delete “${d.name}” from ${r.courseName}?${d.answers ? `\n\nIt has ${d.answers} student(s)' answers/scores, which will be lost.` : ""}`)) return "";
          await courseRemove(r.courseId, r.toolId, r.id); return "Deleted.";
        }) });
      const ex = exportMenuItems(r, say);
      if (ex.length) items.push("-", ...ex);
      return items;
    }
    function useMenu(u, item) {
      const items = [];
      if (isStale(u.d, item)) items.push({ label: "Update (re-grade)", onClick: run(() => updateOne(u)) });
      items.push({ label: "Make my own copy", onClick: run(async () => { if (!confirm(`Make “${u.d.name}” (${u.courseName}) its own copy? Library changes will no longer reach it, and it can't rejoin.`)) return ""; return makeOwn(u); }) },
        { label: "Remove from this course…", onClick: run(async () => {
          if (u.d.qr) throw new Error("close its QR code first");
          if (!confirm(`Remove “${u.d.name}” from ${u.courseName}?${u.d.answers ? `\n\nIt has ${u.d.answers} student(s)' answers, which will be lost.` : ""}\nThe Library item stays.`)) return "";
          await courseRemove(u.courseId, u.toolId, u.id); return "Removed from the course.";
        }) });
      return items;
    }
    function usesTable(g, span) {
      const tr = mk("tr"); const td = mk("td", "qts-detail"); td.colSpan = span;
      const tb = mk("table", "source-grid qts-grid");
      const hr = mk("tr"); ["Course", "Its name", "Students answered", "Status", ""].forEach((x) => hr.appendChild(mk("th", "nosort", x)));
      const th = mk("thead"); th.appendChild(hr); tb.appendChild(th);
      const body = mk("tbody"); tb.appendChild(body);
      g.uses.forEach((u) => {
        const r = mk("tr");
        r.append(mk("td", "", `${u.courseName} › ${u.toolName}`), mk("td", "qts-name", u.d.name || "(untitled)"), mk("td", "qts-n", String(u.d.answers || 0)), mk("td", isStale(u.d, g.item) ? "qts-stale" : "", useStatus(u.d, g.item)));
        const c = mk("td"); c.appendChild(menuButton("Menu", () => useMenu(u, g.item))); r.appendChild(c); body.appendChild(r);
      });
      const sc = mk("div", "qts-wrap"); sc.appendChild(tb); td.appendChild(sc); tr.appendChild(td);
      return tr;
    }
    function selectFilter(label, key, options) {
      const l = mk("label", "", label); const s = mk("select");
      options.forEach(([v, t]) => { const o = mk("option", "", t); o.value = v; s.appendChild(o); });
      s.value = F[key];
      s.addEventListener("change", () => { F[key] = s.value; render(); });
      l.appendChild(s); return l;
    }

    function render(msg) {
      host.textContent = "";
      const head = mk("div", "qts-head");
      if (!inTool) head.appendChild(mk("h3", "", "Quiz Library"));
      const re = mk("button", "btn btn-ghost btn-small", "Refresh"); re.type = "button"; re.addEventListener("click", () => refresh("", true));
      const rb = mk("button", "btn btn-ghost btn-small", "Rebuild index"); rb.type = "button";
      rb.title = "Re-reads every course once. Use it if the list looks out of date (for example after changes made on another device).";
      rb.addEventListener("click", () => { if (confirm("Re-read every course to rebuild the Library's list of where quizzes are used? This reads all your courses' scoring data once.")) refresh("", true, true); });
      if (!inTool) [["standard", "Quiz"], ["answers", "Answer Collection"], ["survey", "Research Survey"], ["formative", "Formative Survey"]].forEach(([kind, label]) => {
        const nb = mk("button", "btn btn-ghost btn-small", `+ New ${label}`); nb.type = "button";
        nb.addEventListener("click", run(async () => { // a new item made right in the Library (no course needed); opens in the editor
          const name = prompt(`${label} name:`, `${label} ${model.items.length + 1}`); if (name === null || !name.trim()) return "";
          await libLoad(true);
          if (lib.items.length >= MAX_LIB) throw new Error(`The Library is at its limit of ${MAX_LIB} items.`);
          const item = newItem({ name: name.trim(), quiz: { kind, settings: { labelStyle: "upper", defaultOptions: 4, timeLimit: 0, attemptsAllowed: 1, attemptRule: "best" }, sections: [{ id: rid("sec"), title: "Section 1", questions: [], notes: [] }] } }, name.trim());
          lib.items.push(item); await libSave(); invalidate();
          await openTplEditor({ id: item.id });
          return "";
        }));
        head.appendChild(nb);
      });
      if (!inTool && window.QuizSheet) {
        const up = mk("button", "btn btn-ghost btn-small", "Upload quiz contents"); up.type = "button"; up.title = "Make a new Library item from a filled-in CSV or Excel sheet (see “Export quiz template”).";
        up.addEventListener("click", () => QuizSheet.pick(async (p, f) => {
          try {
            await libLoad(true);
            if (lib.items.length >= MAX_LIB) throw new Error(`The Library is at its limit of ${MAX_LIB} items.`);
            const name = p.name || f.name.replace(/\.[^.]+$/, "");
            const item = newItem({ name, quiz: { kind: p.kind, settings: p.settings, sections: p.sections } }, name);
            lib.items.push(item); await libSave(); invalidate();
            alert(QuizSheet.summary({ ...p, name }));
            await openTplEditor({ id: item.id });
          } catch (e) { say(`Couldn't do that: ${e.message}`); }
        }));
        const ex = mk("button", "btn btn-ghost btn-small", "Export quiz template"); ex.type = "button"; ex.title = "Downloads an example sheet (CSV) showing what to type where. Fill it in (in Excel too) and upload it.";
        ex.addEventListener("click", () => QuizSheet.example("standard"));
        head.append(up, ex);
      }
      head.append(re, rb);
      host.appendChild(head);
      statusEl = mk("p", "result", msg || ""); host.appendChild(statusEl);
      if (!model) return;
      host.appendChild(mk("p", "hint", "Each quiz's questions live here once. A course that uses an item keeps its own students' answers, scores and QR code. Edit an item and every course that uses it follows; a course that already has student answers shows “Update available” until you update it."));

      (model.legacy || []).forEach((old) => {
        const p = mk("p", "hint"); p.style.cssText = "border:1px solid var(--line);border-radius:6px;padding:6px 8px;";
        p.appendChild(document.createTextNode(`${old.label} still holds ${old.items.length} item${old.items.length === 1 ? "" : "s"}. `));
        const b = mk("button", "btn btn-ghost btn-small", "Import into the Library…"); b.type = "button"; b.addEventListener("click", run(() => importLegacy(old)));
        p.appendChild(b); host.appendChild(p);
      });

      const filters = mk("div", "qts-filters");
      const sl = mk("label", "", "Search"); const si = mk("input"); si.type = "search"; si.value = F.q; si.placeholder = "Name";
      si.addEventListener("input", () => { F.q = si.value; const pos = si.selectionStart; render(); const n = host.querySelector(".qts-filters input[type=search]"); if (n) { n.focus(); try { n.setSelectionRange(pos, pos); } catch (e) {} } });
      sl.appendChild(si);
      filters.append(
        sl,
        selectFilter("Course", "course", [["", "All courses"], ...model.courses.map((c) => [c.id, c.name])]),
        selectFilter("Type", "type", [["", "All"], ["quiz", "Quiz"], ["test", "Test"], ["survey", "Research Survey"], ["formative", "Formative Survey"], ["answers", "Answer Collection"]]),
        selectFilter("Status", "status", [["", "All"], ["Up to date", "Up to date"], ["Update available", "Update available"], ["Own copy", "Own copy"]]),
      );
      host.appendChild(filters);

      const rows = visibleRows();
      const tb = mk("table", "source-grid qts-grid");
      const hr = mk("tr");
      COLS.forEach(([k, label]) => {
        const pos = sort.findIndex((x) => x.key === k);
        const th = mk("th", "", label + (pos < 0 ? " ⇅" : ` ${sort[pos].dir > 0 ? "▲" : "▼"}${sort.length > 1 ? pos + 1 : ""}`));
        th.title = "Click: sort ascending. Click again: descending. A third click turns it off. A second sorted column sorts within the first.";
        th.addEventListener("click", () => {
          if (pos < 0) { sort = sort.length >= 2 ? [sort[0], { key: k, dir: 1 }] : [...sort, { key: k, dir: 1 }]; }
          else if (sort[pos].dir > 0) sort[pos].dir = -1;
          else sort.splice(pos, 1);
          render();
        });
        hr.appendChild(th);
      });
      hr.appendChild(mk("th", "nosort", "Control"));
      const th = mk("thead"); th.appendChild(hr); tb.appendChild(th);
      const body = mk("tbody"); tb.appendChild(body);
      if (!rows.length) { const tr = mk("tr"); const td = mk("td", "hint", gridRows().length ? "Nothing matches these filters." : "Nothing here yet. Use “+ New Quiz” above, or open a quiz's controls → “Add to courses…” to put it in the Library."); td.colSpan = COLS.length + 1; tr.appendChild(td); body.appendChild(tr); }
      rows.forEach((g) => {
        const tr = mk("tr");
        const num = (v) => mk("td", "qts-n", v == null || v === "" ? "—" : String(v));
        let used;
        if (g.kind === "item") {
          const n = new Set(g.uses.map((u) => u.courseId)).size;
          if (!g.uses.length) used = mk("td", "qts-n", "—");
          else {
            used = mk("td", "qts-n"); const a = mk("span", "qts-link", courseWord(n) + (g.uses.length > n ? ` (${g.uses.length} copies)` : ""));
            a.title = "Click to show or hide where it is used."; a.addEventListener("click", () => { if (openUses.has(g.item.id)) openUses.delete(g.item.id); else openUses.add(g.item.id); render(); });
            used.appendChild(a);
          }
        } else used = mk("td", "qts-n", g.r.courseName);
        const st = mk("td", `qts-n${g.status === "Update available" ? " qts-stale" : ""}`, g.kind === "item" && g.stale.length > 1 ? `Update available (${g.stale.length})` : g.status);
        tr.append(mk("td", "qts-name", g.name || "(untitled)"), mk("td", "", KIND_LABEL[g.type] || "Quiz"), num(g.q), num(g.max), used, st);
        const td = mk("td", "qts-ctl");
        const all = g.kind === "item" ? itemMenu(g) : ownMenu(g);
        const cut = all.lastIndexOf("-");
        const exps = cut >= 0 ? all.slice(cut + 1) : [];
        const expMenu = exps.length && exps.every((x) => /^(CSV|Excel)/.test(x.label)) ? exps : null;
        (expMenu ? all.slice(0, cut) : all).forEach((it) => { // the controls sit side by side
          if (it === "-") return;
          const b = mk("button", "btn btn-ghost btn-small", it.label.replace(/…$/, "")); b.type = "button"; b.title = it.label;
          b.addEventListener("click", (ev) => { ev.stopPropagation(); it.onClick(); }); td.appendChild(b);
        });
        if (g.kind === "item" && window.QRStyles && QRStyles.menuButton) {
          const sb = QRStyles.menuButton(() => g.item.style || null, async (st) => {
            await libLoad(true); const it = itemById(g.item.id); if (!it) return;
            it.style = st || undefined; it.hash = hashOf(itemTest(it)); it.rev += 1; it.updatedAt = nowIso(); await libSave();
            await syncPass(it.id); await refresh("");
          }, say, "btn btn-ghost btn-small");
          td.insertBefore(sb, td.children[3] || null);
        }
        if (expMenu) td.appendChild(menuButton("Export", () => expMenu));
        tr.appendChild(td);
        body.appendChild(tr);
        if (g.kind === "item" && openUses.has(g.item.id) && g.uses.length) body.appendChild(usesTable(g, COLS.length + 1));
      });
      const sc = mk("div", "qts-wrap"); sc.appendChild(tb); host.appendChild(sc);
      host.appendChild(mk("p", "hint", `${rows.length} shown. “Own copy” = a quiz that belongs to one course only. Its menu → “Add to courses…” puts it in the Library.`));
    }

    return { refresh, render };
  }

  // ---------- importing the old group lists ----------
  async function importLegacy(old) {
    const quizzes = old.items.filter((x) => x && x.quiz);
    if (!quizzes.length) throw new Error("There are no quizzes or surveys in that list to import.");
    const pick = await dialog((box, done) => {
      box.appendChild(mk("h3", "", "Import into the Library"));
      box.appendChild(mk("p", "hint", `Choose the items from ${old.label}. They are added to the Library; use “Add to courses…” to put them in courses.`));
      const cbs = quizzes.map((it) => { const l = mk("label", "qts-check"); const cb = mk("input"); cb.type = "checkbox"; cb.checked = true; l.append(cb, mk("span", "", it.name || "(untitled)")); box.appendChild(l); return cb; });
      const acts = mk("div", "qts-actions");
      const cancel = mk("button", "btn btn-ghost", "Cancel"); cancel.type = "button"; cancel.addEventListener("click", () => done(null));
      const go = mk("button", "btn btn-primary", "Import"); go.type = "button";
      go.addEventListener("click", () => done(quizzes.filter((_, i) => cbs[i].checked)));
      acts.append(cancel, go); box.appendChild(acts);
    });
    if (!pick || !pick.length) return "";
    await libLoad(true);
    let n = 0;
    for (const it of pick) {
      if (lib.items.length >= MAX_LIB) break;
      lib.items.push(newItem({ quiz: it.quiz, name: it.name, maxPoints: it.maxPoints }, it.name)); n++;
    }
    await libSave();
    return `Imported ${n} item${n === 1 ? "" : "s"} into the Library.`;
  }

  // ---------- editing a Library item's questions ----------
  // The item is loaded into a hidden course (like course templates are), edited in the normal Test & Quiz Bank editor, then written back.
  let tedit = null;
  const tbanner = mk("div"); tbanner.hidden = true;
  tbanner.style.cssText = "margin:0 0 16px;padding:12px 16px;border:2px solid #c2571a;border-radius:8px;background:color-mix(in srgb, #c2571a 14%, var(--card));";
  const tbText = mk("div"); tbText.style.fontWeight = "700";
  const tbHint = mk("div", "hint", "You're editing a template (no students here). Saving updates every course quiz linked to it; courses with student answers show “Update available”.");
  const tbBar = mk("div", "panel-toolbar-buttons"); tbBar.style.marginTop = "10px";
  const tbStatus = mk("p", "result"); tbStatus.style.margin = "8px 0 0";
  const tbBtn = (label, cls, fn) => { const b = mk("button", cls, label); b.type = "button"; b.addEventListener("click", fn); tbBar.appendChild(b); return b; };
  tbanner.append(tbText, tbHint, tbBar, tbStatus);
  if (typeof el !== "undefined" && el.courseDetailTitle) el.courseDetailTitle.parentElement.insertAdjacentElement("afterend", tbanner);
  async function saveTpl() {
    if (!tedit) return false;
    tbStatus.textContent = "Saving…";
    try {
      await ScoringModule.save();
      const data = await storage.loadFile(`scoring-${tedit.cid}.json`);
      const t = data && data.tools && data.tools[0] && data.tools[0].config.tests.find((x) => x.id === tedit.id);
      if (!t || !t.quiz) throw new Error("the edited copy couldn't be found");
      await libLoad(true);
      const item = itemById(tedit.id);
      if (!item) throw new Error("the Library item no longer exists");
      const c = contentOf(t), h = hashOf(t);
      if (h !== item.hash) Object.assign(item, { kind: c.kind, settings: c.settings, sections: c.sections, style: c.style, max: c.max, hash: h, rev: item.rev + 1, updatedAt: nowIso() });
      if (t.name) item.name = t.name;
      await libSave();
      const r = await syncPass(item.id);
      tbStatus.textContent = `Saved ✓${r.updated ? ` — ${r.updated} course${r.updated === 1 ? "" : "s"} updated` : ""}${r.waiting ? ` — ${r.waiting} waiting for you to update` : ""}`;
      return true;
    } catch (e) { tbStatus.textContent = `Couldn't save: ${e.message}`; return false; }
  }
  async function closeTpl(save) {
    if (!tedit) return;
    if (save && !(await saveTpl())) return;
    const { cid, back } = tedit; tedit = null;
    CoursesModule.courses = CoursesModule.courses.filter((c) => !c.editingTemplateId);
    tbanner.hidden = true; el.tabRosterBtn.style.display = "";
    const home = back && CoursesModule.courses.find((c) => c.id === back);
    if (home) { await openCourseDetail(home); window.showTab("classmaterial"); if (window.ClassMaterial && ClassMaterial.show) ClassMaterial.show("quiz"); }
    else await showCourses();
    ["roster", "seating", "attendance", "scoring", "reportcard"].forEach((p) => { try { Promise.resolve(storage.deleteFile(`${p}-${cid}.json`)).catch(() => {}); } catch (e) {} });
    invalidate();
  }
  tbBtn("Save template", "btn btn-primary btn-small", () => saveTpl());
  tbBtn("Save & back to Quiz Library", "btn btn-ghost btn-small", () => closeTpl(true));
  tbBtn("Close without saving", "btn btn-ghost btn-small", () => { if (confirm("Close without saving? Changes since your last save will be lost.")) closeTpl(false); });
  if (typeof el !== "undefined" && el.backToCoursesBtn) el.backToCoursesBtn.addEventListener("click", (e) => { if (!tedit) return; e.stopImmediatePropagation(); closeTpl(true); }, true);
  async function openTplEditor(row) {
    if (tedit) throw new Error("close the Library item you're editing first");
    const item = await fullOf({ courseId: LIB, id: row.id });
    if (!item || !item.quiz) throw new Error("only quizzes and surveys have questions to edit");
    if (!window.QuizBankUI) throw new Error("the quiz editor isn't available");
    if (window.GGOAutosave && GGOAutosave.enabled()) await GGOAutosave.flush();
    const cid = `tmpledit-qts-${Date.now().toString(36)}`, toolId = "tpl-tool";
    const test = clone(item); test.quiz = { ...clone(item.quiz), token: null, submissions: [] };
    await storage.saveFile(`roster-${cid}.json`, { students: [] });
    await storage.saveFile(`scoring-${cid}.json`, { categories: [], records: {}, weights: {}, presentationMigrated: true, tools: [{ id: toolId, type: "testbank", name: "Test & Quiz Bank", config: { tests: [test] } }] });
    const course = { id: cid, name: `Library: ${item.name}`, periodId: null, archived: false, templateId: null, editingTemplateId: "qts" };
    CoursesModule.courses.push(course);
    const back = ScoringModule.currentCourseId && !isTmp(ScoringModule.currentCourseId) ? ScoringModule.currentCourseId : null;
    tedit = { cid, id: item.id, back };
    await openCourseDetail(course);
    tbText.textContent = `Editing template “${item.name}”`; tbStatus.textContent = ""; tbanner.hidden = false;
    el.tabRosterBtn.style.display = "none";
    window.QuizBankUI.open(toolId, item.id);
    showTab("scoring");
    if (typeof renderScoring === "function") renderScoring();
    return "";
  }



  // ---------- the tab ----------
  const tabView = makeView(panel, null);
  const origShowTab = window.showTab;
  window.showTab = function (tab) {
    origShowTab.apply(this, arguments);
    const on = tab === "qts";
    panel.hidden = !on;
    tabBtn.classList.toggle("tab-btn-active", on);
    if (on) tabView.refresh("", true);
  };
  tabBtn.addEventListener("click", () => window.showTab("qts"));

  // ---------- inside a Test & Quiz Bank + helpers for quizbank.js ----------
  const lastSync = new Map();
  let firstLoad = true;
  window.QTSBank = {
    invalidate,
    hookStorage, // exposed for testing
    flushIndex: () => Index.flush(),
    pushNow: () => Push.run(),
    setDelay(ms) { Push.delay = ms; },
    /** "Add to courses…" for a quiz in the open course. Resolves to a message ("" if cancelled). */
    addToCourses: (courseId, toolId, test) => addDialog({ courseId, toolId, id: test.id }),
    /** Buttons for a quiz that uses a Library item (badge, Update (re-grade), Make my own copy). */
    statusButtons(courseId, toolId, t, say, rerender) {
      if (!t.libId || !t.quiz) return [];
      const item = itemById(t.libId);
      if (!item) return [];
      const stale = (Number(t.libRev) || 0) < item.rev;
      const ref = { courseId, toolId, id: t.id, courseName: "", d: describe(t) };
      const out = [mk("span", `qts-badge${stale ? " qts-stale" : ""}`, stale ? "Update available" : "Library: up to date")];
      const btn = (label, fn) => { const b = mk("button", "btn btn-ghost btn-small", label); b.type = "button"; b.addEventListener("click", async () => { try { const m = await fn(); if (m) { say(m); rerender(); } } catch (e) { say(`Couldn't do that: ${e.message}`); } }); return b; };
      if (stale) out.push(btn("Update (re-grade)", () => updateOne(ref)));
      out.push(btn("Make my own copy", async () => (confirm(`Make “${t.name}” its own copy? Library changes will no longer reach it, and it can't rejoin.`) ? makeOwn(ref) : "")));
      return out;
    },
    /** A line for the quiz editor: which Library item this is and how many courses use it. */
    usedInNote(test) {
      if (!test.libId) return null;
      const p = mk("p", "hint", "");
      loadModel({}).then((m) => {
        const item = itemById(test.libId);
        if (!item) { p.remove(); return; }
        const n = new Set(m.rows.filter((r) => r.d.libId === item.id).map((r) => r.courseId)).size;
        p.textContent = `Library item “${item.name}” · used in ${courseWord(n)}. Changes to the questions here go to all of them (a course with student answers shows “Update available”).`;
      }).catch(() => p.remove());
      return p;
    },
    buildSection(tool, container) {
      const { section, body } = makePresSection("Quiz Library");
      section.classList.add("qz-sec-shared");
      body.appendChild(mk("p", "hint", "The Quiz Library has moved to the Class Material tab: this course's quizzes, all quizzes, and templates."));
      const go = mk("button", "btn btn-ghost", "Open Quiz Library"); go.type = "button";
      go.addEventListener("click", () => { window.showTab("classmaterial"); if (window.ClassMaterial && ClassMaterial.show) ClassMaterial.show("quiz"); });
      body.appendChild(go);
      const cid = ScoringModule.currentCourseId;
      if (firstLoad) { firstLoad = false; libEnsure().catch(() => {}); }
      if (cid && Date.now() - (lastSync.get(cid) || 0) > 20000) {
        lastSync.set(cid, Date.now());
        syncPass(null, cid).then((r) => { if (r.updated) { try { renderScoringToolView(tool, container); } catch (e) {} } }).catch(() => {});
      }
      return section;
    },
    core: { addDialog, rid, clone, LIB, libLoad, libSave, libEnsure, getLib: () => lib, itemById, newItem, useOf, itemTest, loadModel, fullOf, courseAdd, courseRemove, editCourseTest, syncPass, applyUpdate, updateOne, updateAll, makeOwn, addToLibrary, openTplEditor, exportMenuItems, menuButton, dialog, isStale, useStatus, KIND_LABEL, kindKey, hashOf, contentOf, describe, MAX_LIB, toast, qCount },
  };
})();
