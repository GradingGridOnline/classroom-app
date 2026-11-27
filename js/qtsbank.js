// ===== Quizzes: every quiz's questions and settings live ONCE, in the Library (quizlibrary.json) =====
// Rules (Nov 2026): a quiz exists once and has no per-course versions. Every course quiz is linked to a Library item;
// an edit made anywhere reaches every course using it, and answers already given are re-graded (a course whose QR code
// is open waits until it closes). A variation is a separate quiz (Duplicate). The notes below describe the engine.
// Shown in Class Material → Quizzes (js/classmaterial-quiz.js). A course "uses" a Library item:
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
  // A "batch" (one opening of the Quizzes list, one sync) reads the Library and the index at most once each:
  // inside it, forced reloads reuse what was read, and the index is updated in memory before being saved.
  let batchDepth = 0, libFresh = false;
  async function batch(fn) {
    batchDepth++;
    try { return await fn(); } finally { if (--batchDepth === 0) { libFresh = false; Index.cache = null; } }
  }
  async function libLoad(force) {
    if (lib && (!force || (batchDepth && libFresh))) return lib;
    let d = null;
    try { d = await storage.loadFile(LIB_FILE); } catch (e) { d = null; }
    lib = d && typeof d === "object" ? d : {};
    lib.items = Array.isArray(lib.items) ? lib.items : [];
    if (batchDepth) libFresh = true;
    return lib;
  }
  async function libSave() { await storage.saveFile(LIB_FILE, { migrated: !!lib.migrated, oneQuiz: !!lib.oneQuiz, items: lib.items }); }
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
    queue: new Map(), gone: new Set(), timer: null, running: null, cache: null,
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
        const idx = this.cache || (await storage.loadFile(INDEX_FILE)) || {};
        idx.courses = idx.courses || {};
        q.forEach((tools, id) => { idx.courses[id] = { at: nowIso(), tools }; });
        g.forEach((id) => { delete idx.courses[id]; });
        await storage.saveFile(INDEX_FILE, idx);
        if (batchDepth) this.cache = idx;
      })();
      try { await this.running; } finally { this.running = null; }
    },
    async load() {
      await this.flush().catch(() => {});
      if (batchDepth && this.cache) return this.cache;
      const d = await storage.loadFile(INDEX_FILE);
      const out = d && d.courses ? d : { courses: {} };
      if (batchDepth) this.cache = out;
      return out;
    },
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
    if (changedIdx) { try { await storage.saveFile(INDEX_FILE, idx); if (batchDepth) Index.cache = idx; } catch (e) {} }
    // (The old group lists are no longer looked up here: the Quizzes list doesn't import them, and it saved
    //  one Supabase query per group every time the list loaded.)
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
      if (!cfg) throw new Error("That course's Quizzes & Tests tab no longer exists.");
      if (cfg.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`That bank is at its limit of ${MAX_TESTS_PER_BANK}.`);
      cfg.tests.push(test); flush(); return id;
    }
    const data = (await storage.loadFile(`scoring-${courseId}.json`)) || { categories: [], records: {}, weights: { attendance: 0 }, tools: [], presentationMigrated: true };
    data.tools = data.tools || [];
    let tool;
    if (toolId === "__new") {
      if (data.tools.length >= MAX_SCORING_TOOLS) throw new Error(`That course already has ${MAX_SCORING_TOOLS} scoring tabs.`);
      const n = data.tools.filter((t) => t.type === "testbank").length;
      tool = { id: rid("tool"), type: "testbank", name: n === 0 ? "Quizzes & Tests" : `Quizzes & Tests ${n + 1}`, config: { tests: [] } };
      data.tools.push(tool);
    } else tool = data.tools.find((t) => t.id === toolId);
    if (!tool) throw new Error("That course's Quizzes & Tests tab no longer exists.");
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
    if (probe.quiz && probe.quiz.token) throw new Error("its QR code is open — close it first (open the quiz → Give it → Close)");
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
  /** Brings every course quiz up to its Library item's newest questions, re-grading answers already given.
   *  Only a course whose QR code is open (or whose own edits haven't reached the Library yet) waits. */
  async function syncPass(libId, courseId) {
    await libLoad(true);
    const model = await loadModel({});
    let updated = 0, waiting = 0, regraded = 0;
    for (const r of model.rows) {
      if (!r.d.libId || (libId && r.d.libId !== libId) || (courseId && r.courseId !== courseId)) continue;
      const item = itemById(r.d.libId);
      if (!isStale(r.d, item)) continue;
      if (r.d.qr || r.d.edited) { waiting++; continue; }
      try { await applyUpdate(r, item); updated++; regraded += r.d.answers || 0; } catch (e) { waiting++; }
    }
    return { updated, waiting, regraded };
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
    // The newest edit wins: if the quiz was also changed elsewhere since this course last caught up, this edit replaces it.
    if (h !== item.hash) {
      const c = contentOf(t);
      Object.assign(item, { kind: c.kind, settings: c.settings, sections: c.sections, style: c.style, max: c.max, hash: h, rev: item.rev + 1, updatedAt: nowIso() });
      await libSave();
    }
    await editCourseTest(ref, (x) => { x.libRev = item.rev; x.libHash = h; });
    const r = await syncPass(item.id);
    return { item, msg: syncWords(item, r) };
  }
  /** "“Quiz” saved — 2 other courses updated (31 students re-graded), 1 waiting for its QR code to close." */
  function syncWords(item, r) {
    const parts = [];
    if (r.updated) parts.push(`${r.updated} other ${r.updated === 1 ? "course" : "courses"} updated${r.regraded ? ` (${r.regraded} student${r.regraded === 1 ? "" : "s"} re-graded)` : ""}`);
    if (r.waiting) parts.push(`${r.waiting} waiting for ${r.waiting === 1 ? "its" : "their"} QR code to close`);
    return `“${item.name}” saved${parts.length ? ` — ${parts.join(", ")}` : ""}.`;
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

  // ---------- every course quiz belongs to a Library item ----------
  /** Links each course quiz that has no Library item. A quiz with the same name and the same questions as an
   *  existing item joins it (copies made the old way); anything else becomes a new item. Answers stay put. */
  async function adoptOrphans() {
    await libLoad(true);
    const model = await loadModel({});
    const norm = (x) => String(x || "").trim().toLowerCase();
    let made = 0, joined = 0, dirty = false;
    for (const r of model.rows) {
      if (r.d.kind === "test" || (r.d.libId && itemById(r.d.libId))) continue;
      const full = await fullOf(r);
      if (!full || !full.quiz) continue;
      const h = hashOf(full);
      let item = (r.d.questions || 0) > 0 ? lib.items.find((it) => it.hash === h && norm(it.name) === norm(full.name)) : null;
      if (item) joined++;
      else {
        if (lib.items.length >= MAX_LIB) break;
        item = newItem(full); lib.items.push(item); made++;
      }
      dirty = true;
      await editCourseTest(r, (t) => { t.libId = item.id; t.libRev = item.rev; t.libHash = hashOf(t); });
    }
    if (dirty) await libSave();
    return { made, joined };
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
    if (!lib.oneQuiz) { // Nov 2026: every course quiz gets a Library item (once; later orphans are caught by adoptOrphans)
      lib.oneQuiz = true; await libSave(); // saved first: adoptOrphans reloads the Library and calls loadModel → libEnsure
      try { await adoptOrphans(); } catch (e) { /* any quiz missed here is picked up when Class Material → Quizzes opens */ }
    }
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


  // ---------- small helpers ----------
  const kindKey = (k) => (k === "answers" ? "answers" : k === "formative" ? "formative" : isSurveyKind(k) ? "survey" : "quiz");
  const qCount = (item) => (item.sections || []).reduce((a, sec) => a + (sec.questions || []).length, 0);
  const courseWord = (n) => `${n} course${n === 1 ? "" : "s"}`;

  // ---------- editing a Library item's questions ----------
  // The item is loaded into a hidden course (like course templates are), edited in the normal Test & Quiz Bank editor, then written back.
  let tedit = null;
  const tbanner = mk("div"); tbanner.hidden = true;
  tbanner.style.cssText = "margin:0 0 16px;padding:12px 16px;border:2px solid #c2571a;border-radius:8px;background:color-mix(in srgb, #c2571a 14%, var(--card));";
  const tbText = mk("div"); tbText.style.fontWeight = "700";
  const tbHint = mk("div", "hint", "No students here. Saving puts your changes in every course that uses this quiz and re-grades the answers already given (a course whose QR code is open gets them when it closes).");
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
      tbStatus.textContent = `Saved ✓${r.updated ? ` — ${r.updated} course${r.updated === 1 ? "" : "s"} updated${r.regraded ? ` (${r.regraded} student${r.regraded === 1 ? "" : "s"} re-graded)` : ""}` : ""}${r.waiting ? ` — ${r.waiting} waiting for ${r.waiting === 1 ? "its" : "their"} QR code to close` : ""}`;
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
  tbBtn("Save", "btn btn-primary btn-small", () => saveTpl());
  tbBtn("Save & back to Quizzes", "btn btn-ghost btn-small", () => closeTpl(true));
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
    await storage.saveFile(`scoring-${cid}.json`, { categories: [], records: {}, weights: {}, presentationMigrated: true, tools: [{ id: toolId, type: "testbank", name: "Quizzes & Tests", config: { tests: [test] } }] });
    const course = { id: cid, name: `Quiz: ${item.name}`, periodId: null, archived: false, templateId: null, editingTemplateId: "qts" };
    CoursesModule.courses.push(course);
    const back = ScoringModule.currentCourseId && !isTmp(ScoringModule.currentCourseId) ? ScoringModule.currentCourseId : null;
    tedit = { cid, id: item.id, back };
    await openCourseDetail(course);
    tbText.textContent = `Editing quiz “${item.name}”`; tbStatus.textContent = ""; tbanner.hidden = false;
    el.tabRosterBtn.style.display = "none";
    window.QuizBankUI.open(toolId, item.id);
    showTab("scoring");
    if (typeof showScoringMode === "function") showScoringMode(toolId); // straight into the Test & Quiz Bank's editor
    else if (typeof renderScoring === "function") renderScoring();
    return "";
  }



  // ---------- inside a Test & Quiz Bank + helpers for quizbank.js ----------
  const lastSync = new Map();
  let firstLoad = true;
  window.QTSBank = {
    invalidate,
    hookStorage, // exposed for testing
    flushIndex: () => Index.flush(),
    pushNow: () => Push.run(),
    setDelay(ms) { Push.delay = ms; },
    /** Buttons for a quiz that uses a Library item (badge, Update (re-grade), Make my own copy). */
    statusButtons(courseId, toolId, t, say, rerender) {
      if (!t.libId || !t.quiz) return [];
      const item = itemById(t.libId);
      if (!item || (Number(t.libRev) || 0) >= item.rev) return [];
      const b = mk("span", "qts-badge qts-stale", t.quiz.token ? "Changes waiting — close the QR code to apply them" : "Updating…");
      b.title = "This quiz was changed in another course or in Class Material → Quizzes.";
      return [b];
    },
    /** Every course quiz that uses a Library quiz (from the index: no course files are opened). */
    async usesOf(libId) { const m = await batch(() => loadModel({})); return m.rows.filter((r) => r.d.libId === libId); },
    /** A line for the quiz editor: which Library item this is and how many courses use it. */
    usedInNote(test) {
      if (!test.libId) return null;
      const p = mk("p", "hint", "");
      loadModel({}).then((m) => {
        const item = itemById(test.libId);
        if (!item) { p.remove(); return; }
        const uses = m.rows.filter((r) => r.d.libId === item.id);
        const n = new Set(uses.map((r) => r.courseId)).size, ans = uses.reduce((a, r) => a + (r.d.answers || 0), 0);
        p.textContent = `Used in ${courseWord(n)}${ans ? ` · ${ans} student${ans === 1 ? "" : "s"} answered` : ""}. Changes here go to every course that uses this quiz${ans ? ", and answers already given are re-graded" : ""}.`;
      }).catch(() => p.remove());
      return p;
    },
    buildSection(tool, container) {
      const { section, body } = makePresSection("Quizzes");
      section.classList.add("qz-sec-shared");
      body.appendChild(mk("p", "hint", "Quizzes are made and shared between courses in Class Material → Quizzes. Each quiz exists once; editing it changes it in every course that uses it."));
      const go = mk("button", "btn btn-ghost", "Open Quizzes"); go.type = "button";
      go.addEventListener("click", () => { window.showTab("classmaterial"); if (window.ClassMaterial && ClassMaterial.show) ClassMaterial.show("quiz"); });
      body.appendChild(go);
      const cid = ScoringModule.currentCourseId;
      if (firstLoad) { firstLoad = false; libEnsure().catch(() => {}); }
      if (cid && Date.now() - (lastSync.get(cid) || 0) > 20000) {
        lastSync.set(cid, Date.now());
        batch(() => syncPass(null, cid)).then((r) => { if (r.updated) { try { renderScoringToolView(tool, container); } catch (e) {} } }).catch(() => {});
      }
      return section;
    },
    core: { batch, adoptOrphans, syncWords, rid, clone, LIB, libLoad, libSave, libEnsure, getLib: () => lib, itemById, newItem, useOf, itemTest, loadModel, fullOf, courseAdd, courseRemove, editCourseTest, syncPass, applyUpdate, addToLibrary, openTplEditor, exportMenuItems, menuButton, dialog, isStale, KIND_LABEL, kindKey, hashOf, contentOf, describe, MAX_LIB, toast, qCount },
  };
})();
