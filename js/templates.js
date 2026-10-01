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

    const [attendance, scoring, seating, reportcard] = await Promise.all(
      ["attendance", "scoring", "seating", "reportcard"].map((prefix) =>
        storage.loadFile(`${prefix}-${courseId}.json`)
      )
    );

    const data = {};

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
              project.roster = [];
              project.sourceBankName = "";
              project.values = {};
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

    const course = window.CoursesModule && window.CoursesModule.find(courseId);
    const template = {
      id: `template-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      sourceCourseName: course ? course.name : "",
      createdAt: new Date().toISOString(),
    };

    await storage.saveFile(this.fileName(template.id), data);
    this.templates.push(template);
    await this.save();
    return template;
  },

  /** Creates a new course from a template: the course is added to the list and its files are written, then the course list is saved. Rolls the course back out of the list if anything fails. */
  async createCourse(templateId, courseName) {
    const data = await storage.loadFile(this.fileName(templateId));
    if (!data) throw new Error("That template's data couldn't be found.");

    const course = CoursesModule.add(courseName); // throws on an empty name or too many courses
    try {
      const id = course.id;

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

      await CoursesModule.save();
    } catch (err) {
      CoursesModule.remove(course.id);
      throw err;
    }
    return course;
  },
};

window.TemplatesModule = TemplatesModule;
