// ===== Course templates module =====
// A template is a reusable course STRUCTURE — everything except the
// students and their data. Index: templates.json =
// { templates: [{ id, name, sourceCourseName, createdAt }] }; each
// template's contents live in template-<id>.json:
//   attendance: { settings }     — participation types, point values,
//                                  infractions, term class count,
//                                  absence limit, LMS export columns
//   scoring:    { categories, weights, tools } — categories/items/weights
//                                  and scoring tools (Progress Tracker,
//                                  Presentation Calc and Test & Quiz Bank
//                                  setups), with all entered scores,
//                                  rosters, imported groups and uploaded
//                                  tests left out
//   seating:    { rows, cols, active, groups, labels, showGroupsInPopout }
//                                — the desk layout, with nobody seated
//   reportcard: { selectedItemIds }
// Not included: the roster, attendance records/notes, scores, seated
// students, memory banks, and email-collection form tracking.
//
// Saving a template and creating a course from one are explicit
// actions, so they write to Google Drive immediately.

const MAX_TEMPLATES = 20;

const TemplatesModule = {
  templates: [],

  async load() {
    const data = await storage.loadFile("templates.json");
    this.templates = data && Array.isArray(data.templates) ? data.templates : [];
    return this.templates;
  },

  async save() {
    await storage.saveFile("templates.json", { templates: this.templates });
  },

  fileName(id) {
    return `template-${id}.json`;
  },

  find(id) {
    return this.templates.find((t) => t.id === id);
  },

  /** Renames a template in the list (saved with the "Save Courses & Periods" button). */
  rename(id, name) {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("Template name can't be empty.");
    const template = this.find(id);
    if (template) template.name = trimmed;
  },

  /** Removes a template from the list (saved with the "Save Courses & Periods" button). Its data file just becomes unused. */
  remove(id) {
    this.templates = this.templates.filter((t) => t.id !== id);
  },

  _clone(value) {
    return JSON.parse(JSON.stringify(value));
  },

  /** Builds a template from what's last saved for a course, stores it, and saves the template list. */
  async saveFromCourse(courseId, name) {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("Template name can't be empty.");
    if (this.templates.length >= MAX_TEMPLATES) {
      throw new Error(`You've reached the limit of ${MAX_TEMPLATES} templates.`);
    }

    const data = await this._buildData(courseId);

    const course = window.CoursesModule && window.CoursesModule.find(courseId);
    const template = {
      id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      sourceCourseName: course ? course.name : "",
      createdAt: new Date().toISOString(),
      linkable: false, // whether courses can be linked to this template (switch in the Templates section)
    };

    await storage.saveFile(this.fileName(template.id), data);
    this.templates.push(template);
    await this.save();
    return template;
  },

  /** Builds a template's contents from what's last saved for a course. */
  async _buildData(courseId) {
    const [attendance, scoring, seating, reportcard] = await Promise.all(
      ["attendance", "scoring", "seating", "reportcard"].map((prefix) =>
        storage.loadFile(`${prefix}-${courseId}.json`)
      )
    );

    const data = {};

    // Rubrics live in one shared bank; the template carries its own copy of the ones its projects use.
    await RubricBankModule.ensureLoaded();
    const rubricMap = new Map();
    const collectRubrics = (project) => {
      (project.rubricBank || []).forEach((r) => rubricMap.set(r.id, { id: r.id, text: r.text }));
      [...(project.teacherRubrics || []), ...(project.audienceRubrics || [])].forEach((e) => {
        const r = RubricBankModule.find(e.rubricId);
        if (r) rubricMap.set(r.id, { id: r.id, text: r.text });
      });
      project.rubricBank = [];
    };

    if (attendance && attendance.settings) {
      const settings = this._clone(attendance.settings);
      if (settings.exportTemplate) delete settings.exportTemplate.rows; // never keep student rows from an uploaded file
      if (typeof settings.termClassCount !== "number") {
        settings.termClassCount = Array.isArray(attendance.sessions) ? attendance.sessions.length : 0;
      }
      data.attendance = { settings };
    }

    if (scoring) {
      const tools = (Array.isArray(scoring.tools) ? this._clone(scoring.tools) : []).map((tool) => {
        if (tool.config && typeof tool.config === "object") {
          tool.config.values = {}; // entered scores
          if (tool.type === "presentation") {
            // Keep each project's rubrics and settings; drop its imported students + groups and entered scores.
            const clearProject = (project) => {
              collectRubrics(project);
              project.roster = [];
              project.sourceBankName = "";
              project.values = {};
              project.scoreUploads = []; // uploaded score sheets
            };
            if (Array.isArray(tool.config.projects)) tool.config.projects.forEach(clearProject);
            else clearProject(tool.config); // saved before projects existed
          }
          if (tool.type === "testbank") {
            tool.config.tests = []; // uploaded tests/quizzes and their scores
          }
          if (tool.type === "table" && Array.isArray(tool.config.columns)) {
            tool.config.columns.forEach((column) => {
              if (column.testSource) column.testSource = { toolId: "", testId: "" }; // the tests aren't kept
            });
          }
        }
        return tool;
      });
      const categories = this._clone(scoring.categories || []);
      categories.forEach((category) =>
        (category.items || []).forEach((item) => {
          if (item.scoreSources) {
            item.scoreSources.testSelections = {}; // the tests themselves aren't kept
            item.scoreSources.projectSelections = {}; // neither are the imported groups
          }
        })
      );
      data.scoring = {
        categories,
        weights: this._clone(scoring.weights || {}),
        tools,
      };
      data.rubricBank = [...rubricMap.values()];
    }

    if (seating) {
      data.seating = {
        rows: seating.rows,
        cols: seating.cols,
        active: this._clone(seating.active || {}),
        groups: this._clone(seating.groups || {}),
        labels: this._clone(seating.labels || {}),
        showGroupsInPopout: seating.showGroupsInPopout !== false,
      };
    }

    if (reportcard && Array.isArray(reportcard.selectedItemIds)) {
      data.reportcard = { selectedItemIds: [...reportcard.selectedItemIds] };
    }

    if (Object.keys(data).length === 0) {
      throw new Error("This course has nothing saved yet to make a template from — save something in it first.");
    }

    return data;
  },

  /** Replaces a template's structure with what's last saved for a course. The template's own seating layout is kept. */
  async updateFromCourse(templateId, courseId) {
    const template = this.find(templateId);
    if (!template) throw new Error("That template no longer exists.");
    const previous = await storage.loadFile(this.fileName(templateId));
    const data = await this._buildData(courseId);
    if (previous && previous.seating) data.seating = previous.seating;
    else delete data.seating;
    await storage.saveFile(this.fileName(templateId), data);
  },

  // ----- Linking a course to a template -----
  // A linked course mirrors its template's structure (scoring categories, items, weights and
  // tools; attendance settings; report card item choices) while keeping its own students,
  // scores, attendance records, groups, uploads and seating. Items, categories, tools, columns
  // and projects are matched first by id, then (for the first link of an existing course) by
  // position, so scores already entered under matching items are kept.
  // A Presentation Calc's projects belong to the course: their rubrics, weights and settings are
  // copied from the template only when the course doesn't have that project yet.

  /** Pairs each template element with an element of the course's old list: same id first, then leftovers in order (and, if typeKey is given, of the same type). */
  _pair(oldList, tmplList, typeKey) {
    const used = new Set();
    const pairs = tmplList.map((t) => {
      const o = oldList.find((x) => x.id === t.id && !used.has(x)) || null;
      if (o) used.add(o);
      return { tmpl: t, old: o };
    });
    pairs.forEach((p) => {
      if (p.old) return;
      const o = oldList.find((x) => !used.has(x) && (!typeKey || x[typeKey] === p.tmpl[typeKey]));
      if (o) {
        used.add(o);
        p.old = o;
      }
    });
    return pairs;
  },

  /** Returns a scoring file object: the template's structure with the old object's scores and individual data carried over. */
  _applyScoring(tmplS, oldScoring) {
    const old = this._clone(oldScoring || {});
    old.categories = Array.isArray(old.categories) ? old.categories : [];
    old.tools = Array.isArray(old.tools) ? old.tools : [];
    const categories = this._clone(tmplS.categories || []);
    const tools = this._clone(tmplS.tools || []);

    // Categories and items
    const itemMap = {}; // old item id -> new item id
    const itemPairs = [];
    this._pair(old.categories, categories).forEach(({ tmpl: newCat, old: oldCat }) => {
      if (!oldCat) return;
      this._pair(oldCat.items || [], newCat.items || []).forEach(({ tmpl: newItem, old: oldItem }) => {
        if (!oldItem) return;
        itemMap[oldItem.id] = newItem.id;
        itemPairs.push({ newItem, oldItem });
      });
    });

    // Tools: first work out which old tool goes with which template tool...
    const toolMap = {}; // old tool id -> new tool id
    const toolPairs = this._pair(old.tools, tools, "type");
    toolPairs.forEach(({ tmpl: nt, old: ot }) => {
      if (ot) toolMap[ot.id] = nt.id;
    });

    // ...then carry over each tool's own data.
    const projectIdMap = {}; // old project id -> final project id
    toolPairs.forEach(({ tmpl: nt, old: ot }) => {
      if (!ot) return;
      const oc = ot.config && typeof ot.config === "object" ? ot.config : {};
      const nc = (nt.config = nt.config && typeof nt.config === "object" ? nt.config : {});

      if (nt.type === "table") {
        nc.values = {};
        const colMap = {};
        this._pair(Array.isArray(oc.columns) ? oc.columns : [], Array.isArray(nc.columns) ? nc.columns : []).forEach(
          ({ tmpl: newCol, old: oldCol }) => {
            if (!oldCol) return;
            colMap[oldCol.id] = newCol.id;
            if (newCol.type === "test" && oldCol.testSource) {
              newCol.testSource = { toolId: toolMap[oldCol.testSource.toolId] || "", testId: oldCol.testSource.testId || "" };
            }
          }
        );
        Object.entries(oc.values || {}).forEach(([key, value]) => {
          const i = key.indexOf("|");
          const line = key.slice(0, i);
          const col = key.slice(i + 1);
          if (colMap[col]) nc.values[`${line}|${colMap[col]}`] = value;
        });
      } else if (nt.type === "testbank") {
        nc.tests = Array.isArray(oc.tests) ? oc.tests : [];
      } else if (nt.type === "presentation") {
        const oldProjects = Array.isArray(oc.projects) ? oc.projects : [];
        const tmplProjects = Array.isArray(nc.projects) ? nc.projects : [];
        const used = new Set();
        const projects = [];
        this._pair(oldProjects, tmplProjects).forEach(({ tmpl: tp, old: op }) => {
          if (op) {
            used.add(op);
            projectIdMap[op.id] = tp.id;
            op.id = tp.id;
            projects.push(op);
          } else {
            projects.push(tp);
          }
        });
        oldProjects.forEach((op) => {
          if (!used.has(op)) {
            projectIdMap[op.id] = op.id;
            projects.push(op);
          }
        });
        nc.projects = projects;
      }
    });

    // Each item keeps its own choices of which test / project it pulls from.
    itemPairs.forEach(({ newItem, oldItem }) => {
      if (!newItem.scoreSources || typeof newItem.scoreSources !== "object") return;
      const oldSrc = oldItem.scoreSources || {};
      const src = newItem.scoreSources;
      src.testSelections = {};
      src.projectSelections = {};
      Object.entries(oldSrc.testSelections || {}).forEach(([toolId, testId]) => {
        if (toolMap[toolId]) src.testSelections[toolMap[toolId]] = testId;
      });
      Object.entries(oldSrc.projectSelections || {}).forEach(([toolId, projectId]) => {
        if (toolMap[toolId]) src.projectSelections[toolMap[toolId]] = projectIdMap[projectId] || projectId;
      });
    });

    // Scores follow their items.
    const records = {};
    Object.entries(old.records || {}).forEach(([key, value]) => {
      const i = key.indexOf("|");
      const newItemId = itemMap[key.slice(i + 1)];
      if (newItemId) records[`${key.slice(0, i)}|${newItemId}`] = value;
    });

    return {
      categories,
      records,
      weights: this._clone(tmplS.weights || {}),
      tools,
      presentationMigrated: true,
    };
  },

  /** Returns an attendance file object: the template's settings (and number of classes) with the old sessions' dates, records and notes kept. */
  _applyAttendance(tmplA, oldAttendance) {
    const old = oldAttendance || {};
    const settings = this._clone(tmplA.settings || {});
    const count = Math.max(0, Math.min(100, Math.round(Number(settings.termClassCount) || 0)));
    const sessions = (Array.isArray(old.sessions) ? old.sessions : []).slice(0, count);
    while (sessions.length < count) {
      sessions.push({
        id: `session-${Date.now()}-${sessions.length}-${Math.random().toString(36).slice(2, 7)}`,
        number: sessions.length + 1,
        date: "",
      });
    }
    const keep = new Set(sessions.map((s) => s.id));
    const records = {};
    Object.entries(old.records || {}).forEach(([key, value]) => {
      if (keep.has(key.slice(key.indexOf("|") + 1))) records[key] = value;
    });
    return { sessions, records, notes: old.notes || {}, settings };
  },

  /** Links a course (not currently open) to a template: rewrites its saved files to follow the template, then records the link. */
  async linkCourse(courseId, templateId) {
    const template = this.find(templateId);
    const data = await storage.loadFile(this.fileName(templateId));
    if (!template || !data) throw new Error("That template's data couldn't be found.");

    const [attendance, scoring, reportcard] = await Promise.all(
      ["attendance", "scoring", "reportcard"].map((prefix) => storage.loadFile(`${prefix}-${courseId}.json`))
    );

    await RubricBankModule.ensureLoaded();
    RubricBankModule.mergeIn(data.rubricBank);

    if (data.scoring) await storage.saveFile(`scoring-${courseId}.json`, this._applyScoring(data.scoring, scoring));
    if (data.attendance) await storage.saveFile(`attendance-${courseId}.json`, this._applyAttendance(data.attendance, attendance));
    if (data.reportcard) {
      await storage.saveFile(`reportcard-${courseId}.json`, {
        ...(reportcard || {}),
        selectedItemIds: [...(data.reportcard.selectedItemIds || [])],
      });
    }
    if (RubricBankModule.dirty) await RubricBankModule.save();

    CoursesModule.setTemplate(courseId, templateId);
    await CoursesModule.save();
  },

  /** For the course that is currently open: re-applies the template's structure to the data already loaded in memory (nothing is saved until the tabs' own Save buttons are used). */
  async syncLoadedCourse(templateId) {
    const data = await storage.loadFile(this.fileName(templateId));
    if (!data) throw new Error("That template's data couldn't be found.");
    await RubricBankModule.ensureLoaded();
    RubricBankModule.mergeIn(data.rubricBank);

    if (data.scoring) {
      const out = this._applyScoring(data.scoring, {
        categories: ScoringModule.categories,
        records: ScoringModule.records,
        weights: ScoringModule.weights,
        tools: ScoringModule.tools,
      });
      ScoringModule.categories = out.categories;
      ScoringModule.records = out.records;
      ScoringModule.weights = out.weights;
      ScoringModule.tools = out.tools;
      ScoringModule._mergeLegacyRubricBanks();
    }

    if (data.attendance) {
      const out = this._applyAttendance(data.attendance, {
        sessions: AttendanceModule.sessions,
        records: AttendanceModule.records,
        notes: AttendanceModule.notes,
      });
      AttendanceModule.sessions = out.sessions;
      AttendanceModule.records = out.records;
      AttendanceModule.settings = {
        ...defaultAttendanceSettings(),
        ...out.settings,
        participationTypes: AttendanceModule._withFixedTypes(out.settings.participationTypes || ["P", "A", "L", "E"]),
      };
    }

    if (data.reportcard && Array.isArray(data.reportcard.selectedItemIds)) {
      ReportCardModule.selectedItemIds = new Set(data.reportcard.selectedItemIds);
    }
  },

  /** Creates a new course from a template: the course is added to the list and its files are written, then the course list is saved. Rolls the course back out of the list if anything fails. */
  async createCourse(templateId, courseName) {
    const data = await storage.loadFile(this.fileName(templateId));
    if (!data) throw new Error("That template's data couldn't be found.");

    const course = CoursesModule.add(courseName); // throws on an empty name or too many courses
    try {
      const id = course.id;

      // Merge the template's rubrics into the shared bank (templates saved before the shared bank kept them inside each project).
      await RubricBankModule.ensureLoaded();
      RubricBankModule.mergeIn(data.rubricBank);
      ((data.scoring && data.scoring.tools) || []).forEach((tool) => {
        if (tool.type !== "presentation" || !tool.config) return;
        const projects = Array.isArray(tool.config.projects) ? tool.config.projects : [tool.config];
        projects.forEach((p) => {
          RubricBankModule.mergeIn(p.rubricBank);
          p.rubricBank = [];
        });
      });

      if (data.attendance) {
        const settings = this._clone(data.attendance.settings || {});
        const count = Math.max(0, Math.min(100, Math.round(Number(settings.termClassCount) || 0)));
        const sessions = [];
        for (let i = 0; i < count; i++) {
          sessions.push({
            id: `session-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`,
            number: i + 1,
            date: "",
          });
        }
        await storage.saveFile(`attendance-${id}.json`, { sessions, records: {}, notes: {}, settings });
      }

      if (data.scoring) {
        await storage.saveFile(`scoring-${id}.json`, {
          categories: this._clone(data.scoring.categories || []),
          records: {},
          weights: this._clone(data.scoring.weights || {}),
          tools: this._clone(data.scoring.tools || []),
          presentationMigrated: true,
        });
      }

      if (data.seating) {
        await storage.saveFile(`seating-${id}.json`, {
          ...this._clone(data.seating),
          seats: {},
          locks: {},
        });
      }

      if (data.reportcard) {
        await storage.saveFile(`reportcard-${id}.json`, this._clone(data.reportcard));
      }

      if (RubricBankModule.dirty) await RubricBankModule.save();
      await CoursesModule.save();
    } catch (err) {
      CoursesModule.remove(course.id);
      throw err;
    }
    return course;
  },
};

window.TemplatesModule = TemplatesModule;
