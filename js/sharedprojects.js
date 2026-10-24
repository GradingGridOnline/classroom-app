// ===== Shared Projects: a bank of Presentation Calc project setups, shown at the bottom of each Presentation Calc =====
// Not a module of its own. A shared project keeps a project's setup — rubrics (with their wording), weights, totals
// settings, QR-form/score-sheet settings — but NOT students, groups, scores or uploaded data. "Add to this course"
// makes a new project from it. Your own list is the same in every course; groups you belong to have a list too.
// Load AFTER app.js, groupshare.js and sectionlist.js.

(function () {
  const MAX_SHARED = 100;
  const FILE = "sharedprojects.json";
  const mk = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const btn = (label, cls, fn) => { const b = mk("button", cls, label); b.type = "button"; b.addEventListener("click", fn); return b; };
  const clone = (o) => JSON.parse(JSON.stringify(o));
  const rid = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const flush = () => { try { if (window.GGOAutosave && GGOAutosave.enabled()) GGOAutosave.flush(); } catch (e) {} };

  const Shared = {
    items: [], sections: [], loaded: false, scope: "mine",
    async load() {
      const d = this.scope === "mine" ? await storage.loadFile(FILE) : await GroupShare.loadDoc(this.scope, "projects");
      this.items = d && Array.isArray(d.items) ? d.items : [];
      this.sections = d && Array.isArray(d.sections) ? d.sections.filter((s) => s && s.id) : [];
      this.loaded = true;
    },
    async ensureLoaded() { if (!this.loaded) await this.load(); },
    async save() {
      const doc = { items: this.items, sections: this.sections };
      if (this.scope === "mine") await storage.saveFile(FILE, doc);
      else {
        try { await GroupShare.saveDoc(this.scope, "projects", doc); }
        catch (e) { throw new Error(`${e.message} (If this mentions a constraint, run sql/shared-projects.sql in Supabase once.)`); }
      }
    },
    /** A copy of a project's setup without students, groups, scores or uploads; the rubrics' wording travels with it. */
    snapshot(project, courseName) {
      const p = clone(project);
      const used = new Map();
      (p.rubricBank || []).forEach((r) => used.set(r.id, { id: r.id, text: r.text }));
      [...(p.teacherRubrics || []), ...(p.audienceRubrics || [])].forEach((e) => {
        const r = window.RubricBankModule && RubricBankModule.find(e.rubricId);
        if (r) used.set(r.id, { id: r.id, text: r.text });
      });
      p.rubricBank = [];
      p.roster = []; p.sourceBankName = ""; p.values = {}; p.scoreUploads = []; p.selectedUploads = {};
      delete p.forms;
      return {
        id: rid("sproj"), name: project.name, createdAt: new Date().toISOString(), sourceCourseName: courseName || "",
        rubrics: [...used.values()], project: p,
      };
    },
    async addFromCourse(project, courseName) {
      await this.load();
      if (this.items.length >= MAX_SHARED) throw new Error(`The shared list is at its limit of ${MAX_SHARED}.`);
      this.items.push(this.snapshot(project, courseName));
      await this.save();
    },
    async rename(id, name) {
      const t = (name || "").trim(); if (!t) throw new Error("The name can't be empty.");
      await this.load();
      const it = this.items.find((x) => x.id === id); if (it) { it.name = t; it.project.name = t; await this.save(); }
    },
    async remove(id) { await this.load(); this.items = this.items.filter((x) => x.id !== id); await this.save(); },
    /** Makes a new project in this Presentation Calc from a shared one. */
    async copyToCourse(toolId, item) {
      await RubricBankModule.ensureLoaded();
      RubricBankModule.mergeIn(item.rubrics);
      const p = ScoringModule.addPresentationProject(toolId, item.name);
      const src = clone(item.project);
      delete src.id;
      Object.assign(p, src, { id: p.id, name: item.name, roster: [], values: {}, scoreUploads: [], selectedUploads: {}, sourceBankName: "", rubricBank: [] });
      ScoringModule._normalizeProject(p);
      if (RubricBankModule.dirty) await RubricBankModule.save();
      return p;
    },
  };
  window.SharedProjectsModule = Shared;

  function build(tool, container) {
    const rerender = () => renderScoringToolView(tool, container);
    const { section, body } = makePresSection("Shared Projects");
    section.classList.add("qz-sec-shared");
    body.appendChild(mk("p", "hint", "Project setups you can reuse in any course: rubrics, weights and form settings — never students, groups or scores. “Add to this course” makes a new project here from one. Use “Copy this project to Shared” to put the project you're looking at on the list."));
    const stat = mk("p", "result", "");
    const say = (t) => { stat.textContent = t; };

    const toolbar = mk("div", "panel-toolbar");
    const scopeBox = mk("span", "hint"); scopeBox.hidden = true;
    const cur = presentationToolProject.get(tool.id);
    const curProject = cur ? ScoringModule.getPresentationProject(tool.id, cur) : null;
    const tbtns = mk("div", "panel-toolbar-buttons");
    const copyBtn = btn(curProject ? `Copy “${curProject.name}” to Shared` : "Copy this project to Shared", "btn btn-primary btn-small", async () => {
      try {
        say("Copying…");
        const course = window.CoursesModule && CoursesModule.find(RosterModule.currentCourseId);
        await Shared.addFromCourse(curProject, course ? course.name : "");
        say(`“${curProject.name}” copied to the shared list (no students or scores).`);
        draw();
      } catch (e) { say(`Couldn't do that: ${e.message}`); }
    });
    copyBtn.disabled = !curProject;
    if (!curProject) copyBtn.title = "Open a project first";
    tbtns.appendChild(copyBtn);
    toolbar.append(scopeBox, tbtns);
    body.append(toolbar, stat);

    const list = mk("div");
    body.appendChild(list);

    if (window.GroupShare) {
      GroupShare.myGroups().then((groups) => {
        if (!groups.length) { Shared.scope = "mine"; return; }
        scopeBox.hidden = false;
        scopeBox.appendChild(document.createTextNode("Showing: "));
        const sel = mk("select");
        const o0 = mk("option", "", "My own shared list"); o0.value = "mine"; sel.appendChild(o0);
        groups.forEach((g) => { const o = mk("option", "", `Group: ${g.name}`); o.value = g.id; sel.appendChild(o); });
        sel.value = groups.some((g) => g.id === Shared.scope) ? Shared.scope : "mine";
        sel.addEventListener("change", () => {
          Shared.scope = sel.value; Shared.loaded = false;
          list.textContent = ""; list.appendChild(mk("p", "hint", "Loading…"));
          Shared.ensureLoaded().then(draw).catch((err) => { list.textContent = ""; list.appendChild(mk("p", "hint", `Couldn't load: ${err.message}`)); });
        });
        scopeBox.appendChild(sel);
        if (Shared.scope !== "mine" && !Shared.loaded) Shared.ensureLoaded().then(draw).catch(() => {});
      });
    }

    function draw() {
      list.textContent = "";
      list.appendChild(SectionedBank.build({
        sections: Shared.sections, items: Shared.items,
        headers: ["Project", "Teacher rubrics", "Audience rubrics", "From course", "Section", "Order", ""],
        emptyText: "Nothing shared yet — open a project and use “Copy this project to Shared”.",
        persist: () => Shared.save(), redraw: draw,
        buildRow(item, hp) {
          const tr = mk("tr");
          const nameTd = mk("td");
          const inp = mk("input"); inp.type = "text"; inp.value = item.name;
          inp.addEventListener("change", async () => { try { await Shared.rename(item.id, inp.value); say("Renamed."); } catch (e) { say(`Couldn't do that: ${e.message}`); } draw(); });
          nameTd.appendChild(inp); tr.appendChild(nameTd);
          tr.appendChild(mk("td", "", String((item.project.teacherRubrics || []).length)));
          tr.appendChild(mk("td", "", String((item.project.audienceRubrics || []).length)));
          tr.appendChild(mk("td", "hint", item.sourceCourseName || "—"));
          const s = mk("td"); s.appendChild(hp.sectionSelect(item)); tr.appendChild(s);
          const o = mk("td"); o.appendChild(hp.arrows(item)); tr.appendChild(o);
          const a = mk("td");
          a.appendChild(btn("Add to this course", "btn btn-primary btn-small", async () => {
            try {
              const p = await Shared.copyToCourse(tool.id, item);
              presentationToolProject.set(tool.id, p.id);
              presentationToolPage.set(tool.id, "rubrics");
              flush();
            } catch (e) { say(`Couldn't do that: ${e.message}`); return; }
            rerender();
          }));
          a.appendChild(btn("Delete", "btn btn-ghost btn-small", async () => {
            if (!confirm(`Remove “${item.name}” from the shared list? Projects already made from it are not affected.`)) return;
            try { await Shared.remove(item.id); say("Removed."); } catch (e) { say(`Couldn't do that: ${e.message}`); }
            draw();
          }));
          tr.appendChild(a);
          return tr;
        },
      }));
    }
    list.appendChild(mk("p", "hint", "Loading shared projects…"));
    Shared.ensureLoaded().then(draw).catch((err) => { list.textContent = ""; list.appendChild(mk("p", "hint", `Couldn't load the shared list: ${err.message}`)); });
    return section;
  }

  const orig = SCORING_TOOL_RENDERERS.presentation;
  SCORING_TOOL_RENDERERS.presentation = function (tool, container) {
    orig(tool, container);
    container.appendChild(build(tool, container));
  };
})();
