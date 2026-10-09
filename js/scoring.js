// ===== Scoring module =====
// One file per course: scoring-<courseId>.json
//
// - categories: added as needed (up to MAX_CATEGORIES), renamable,
//   removable. Each has { id, name, items }. The number of items is a
//   count setting (like Attendance's term class count), not an "add
//   item" button — set it and that many item-columns appear.
// - items: { id, name, maxPoints, weight }. `weight` is the item's share of
//   the Total Score; a category's weight is the sum of its items' weights.
// - records: sparse map "studentId|itemId" -> "" (blank), "E"
//   (exempt), or a numeric string (points earned, 0-maxPoints).
// - weights: only { attendance } now (category weights come from the items); older files' per-category weights are
//   split across their items when loaded. Attendance — pulled from AttendanceModule's percent score
//   rather than stored here.
// - tools: extra tabs alongside "Main Scores" (the score-entry screen
//   above), added/removed from Main Scores' own Settings. Each is
//   { id, type, name } — `type` picks which scoring tool it is (only
//   "table" exists so far — shown to the user as "Progress Tracker"),
//   and `name` is a display label, auto-numbered when more than one of
//   the same type exists (e.g. "Progress Tracker", "Progress Tracker
//   2"). A tool's own settings/content live in its own tab, not here.

const MAX_CATEGORIES = 10; // a cap, not a fixed starting count — add categories as needed
const MAX_ITEMS_PER_CATEGORY = 50;
const MAX_SCORING_TOOLS = 10;
const MAX_TABLE_COLUMNS = 20;
const MAX_TESTS_PER_BANK = 60;
const MAX_PRES_PROJECTS = 20;
const MAX_RUBRIC_BANK = 30;
const MAX_ACTIVE_RUBRICS = 10;
const MAX_RUBRIC_POINTS = 10; // ceiling for the selectable point-value dropdown

// A Progress Tracker column's type. "score" is a plain enterable
// number; "score_max" is also an enterable number but out of a set
// maximum (column.maxPoints), so it's limited to 0-max and shown as
// "/max" in its header; "test" is read-only and pulls each student's
// score from a test/quiz in a Test & Quiz Bank (column.testSource =
// { toolId, testId }) — students-mode trackers only. The last column of every Progress Tracker is
// always a fixed, read-only "Total Score" (the sum of that row's
// entries) — it isn't stored as a column, it's added automatically.
// (Older trackers also had a "score_max" column type; those are converted to "score" and the whole tracker becomes "max" mode — see getTableConfig.)
const TABLE_COLUMN_TYPES = ["score", "test"];
const MAX_TABLE_SUBROWS = 20;

// The set of scoring tool types that can be added from Main Scores'
// Settings. Add a new entry here (and a matching renderer in app.js)
// to offer a new kind of tool. The key ("table") is what's saved in
// each course's data, so it stays as-is; only the label users see
// changed.
const SCORING_TOOL_TYPES = {
  table: "Progress Tracker",
  presentation: "Presentation Calc",
  testbank: "Test & Quiz Bank",
};

function defaultScoringWeights(categories) {
  const weights = { attendance: 0 };
  categories.forEach((c) => {
    weights[c.id] = 0;
  });
  return weights;
}

const ScoringModule = {
  categories: [],
  records: {},
  weights: {},
  tools: [], // [{ id, type, name }] — extra tabs alongside Main Scores
  presentationMigrated: false, // true once any old standalone Presentation Calc data has been carried over
  currentCourseId: null,

  fileName(courseId) {
    return `scoring-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    if (data) {
      this.categories = this._normalizeCategories(data.categories);
      this.records = data.records || {};
      this.weights = { ...defaultScoringWeights(this.categories), ...(data.weights || {}) };
      this.tools = Array.isArray(data.tools) ? data.tools : [];
      this._renameLegacyTools();
      this._migrateCategoryWeightsToItems();
    } else {
      this.categories = [];
      this.records = {};
      this.weights = { attendance: 0 };
      this.tools = [];
    }
    this.presentationMigrated = !!(data && data.presentationMigrated);
    if (!this.presentationMigrated) await this._migrateLegacyPresentationCalc(courseId);
    await RubricBankModule.ensureLoaded();
    this._mergeLegacyRubricBanks();
  },

  /** Files from before item-level weights: split each category's weight across its items in proportion to their max points (so Total Score doesn't change). Only done for categories whose items have no weights yet. */
  _migrateCategoryWeightsToItems() {
    this.categories.forEach((category) => {
      const items = category.items || [];
      const needs = items.length > 0 && items.every((i) => typeof i.weight !== "number");
      if (needs) {
        const catWeight = Number(this.weights[category.id]) || 0;
        const maxSum = items.reduce((sum, i) => sum + (Number(i.maxPoints) || 0), 0);
        items.forEach((i) => {
          i.weight = catWeight > 0 && maxSum > 0 ? Math.round(((catWeight * (Number(i.maxPoints) || 0)) / maxSum) * 100) / 100 : 0;
        });
      } else {
        items.forEach((i) => {
          if (typeof i.weight !== "number") i.weight = 0;
        });
      }
    });
  },

  /** Older data kept a rubricBank inside each project. Move those into the shared bank (ids are kept, so active-rubric references still work). */
  _mergeLegacyRubricBanks() {
    this.tools.forEach((tool) => {
      if (tool.type !== "presentation") return;
      this.presentationProjects(tool.id).forEach((project) => {
        if (project.rubricBank.length > 0) {
          RubricBankModule.mergeIn(project.rubricBank);
          project.rubricBank = [];
        }
      });
    });
  },

  /** Presentation Calc used to be its own tab with its own file (presentationcalc-<courseId>.json). If that file has a roster or rubrics in it, carry them into a new Presentation Calc scoring tool (once). The old file is left untouched in Drive; its Google Forms scoring data is not carried over. */
  async _migrateLegacyPresentationCalc(courseId) {
    this.presentationMigrated = true;
    try {
      const legacy = await storage.loadFile(`presentationcalc-${courseId}.json`);
      if (!legacy) return;
      const hasContent = ["roster", "rubricBank", "teacherRubrics", "audienceRubrics"].some(
        (key) => Array.isArray(legacy[key]) && legacy[key].length > 0
      );
      if (!hasContent || this.tools.length >= MAX_SCORING_TOOLS) return;
      const tool = this.addTool("presentation");
      const project = this.addPresentationProject(tool.id, "Project 1");
      project.roster = Array.isArray(legacy.roster) ? legacy.roster : [];
      project.sourceBankName = legacy.sourceBankName || "";
      project.rubricBank = Array.isArray(legacy.rubricBank) ? legacy.rubricBank : [];
      project.teacherRubrics = Array.isArray(legacy.teacherRubrics) ? legacy.teacherRubrics : [];
      project.audienceRubrics = Array.isArray(legacy.audienceRubrics) ? legacy.audienceRubrics : [];
    } catch (e) {
      // Non-fatal — the scoring data itself has already loaded.
    }
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      categories: this.categories,
      records: this.records,
      weights: this.weights,
      tools: this.tools,
      presentationMigrated: this.presentationMigrated,
    });
  },

  /** Tools created before the rename were auto-named "Table" / "Table 2"; give those the new name. A tool the user renamed themselves is left alone. */
  _renameLegacyTools() {
    this.tools.forEach((tool) => {
      if (tool.type !== "table") return;
      const match = /^Table(?: (\d+))?$/.exec(tool.name || "");
      if (match) tool.name = match[1] ? `Progress Tracker ${match[1]}` : "Progress Tracker";
    });
  },

  _normalizeCategories(categories) {
    const arr = Array.isArray(categories) ? categories.slice(0, MAX_CATEGORIES) : [];
    return arr.map((c, i) => ({
      id: c.id || `category-${i + 1}-${Date.now()}`,
      name: c.name || `Category ${i + 1}`,
      items: Array.isArray(c.items) ? c.items : [],
    }));
  },

  addCategory() {
    if (this.categories.length >= MAX_CATEGORIES) {
      throw new Error(`You've reached the limit of ${MAX_CATEGORIES} categories.`);
    }
    const category = {
      id: `category-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `Category ${this.categories.length + 1}`,
      items: [],
    };
    this.categories.push(category);
    this.weights[category.id] = 0;
    return category;
  },

  removeCategory(categoryId) {
    const category = this.findCategory(categoryId);
    if (!category) return;
    const itemIds = new Set(category.items.map((i) => i.id));
    this.categories = this.categories.filter((c) => c.id !== categoryId);
    delete this.weights[categoryId];
    Object.keys(this.records).forEach((key) => {
      const itemId = key.split("|")[1];
      if (itemIds.has(itemId)) delete this.records[key];
    });
  },

  findCategory(categoryId) {
    return this.categories.find((c) => c.id === categoryId);
  },

  setCategoryName(categoryId, name) {
    const category = this.findCategory(categoryId);
    if (category) category.name = (name || "").trim() || category.name;
  },

  /** Sets how many item-columns a category has, adding or removing trailing items. */
  setItemCount(categoryId, count) {
    const category = this.findCategory(categoryId);
    if (!category) return;
    count = Math.max(0, Math.min(MAX_ITEMS_PER_CATEGORY, Math.round(Number(count) || 0)));

    if (count > category.items.length) {
      while (category.items.length < count) {
        const n = category.items.length + 1;
        category.items.push({
          id: `item-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: `Item ${n}`,
          maxPoints: 10,
          weight: 0,
        });
      }
    } else if (count < category.items.length) {
      const removed = category.items.slice(count);
      category.items = category.items.slice(0, count);
      removed.forEach((item) => {
        Object.keys(this.records).forEach((key) => {
          if (key.endsWith(`|${item.id}`)) delete this.records[key];
        });
      });
    }
  },

  findItem(itemId) {
    for (const category of this.categories) {
      const item = category.items.find((i) => i.id === itemId);
      if (item) return item;
    }
    return null;
  },

  setItemName(itemId, name) {
    const item = this.findItem(itemId);
    if (item) item.name = (name || "").trim() || item.name;
  },

  setItemMaxPoints(itemId, points) {
    const item = this.findItem(itemId);
    if (item) item.maxPoints = Math.max(0, Number(points) || 0);
  },

  setItemWeight(itemId, weight) {
    const item = this.findItem(itemId);
    if (item) item.weight = Math.max(0, Number(weight) || 0);
  },

  /** A category's weight: the sum of its items' weights. */
  categoryWeight(categoryId) {
    const category = this.findCategory(categoryId);
    if (!category) return 0;
    return Math.round(category.items.reduce((sum, i) => sum + (Number(i.weight) || 0), 0) * 100) / 100;
  },

  /** Sum of every item's weight plus Attendance's. */
  totalWeight() {
    const items = this.categories.reduce((sum, c) => sum + this.categoryWeight(c.id), 0);
    return Math.round((items + (this.weights.attendance || 0)) * 100) / 100;
  },

  // ----- Per-student, per-item records -----

  recordKey(studentId, itemId) {
    return `${studentId}|${itemId}`;
  },

  getRecord(studentId, itemId) {
    return this.records[this.recordKey(studentId, itemId)] || "";
  },

  /** value: "" (blank), "E" (exempt, case-insensitive), or a number 0-item.maxPoints. Throws on anything else. */
  setRecord(studentId, itemId, value) {
    const trimmed = String(value || "").trim();
    const key = this.recordKey(studentId, itemId);

    if (trimmed === "") {
      delete this.records[key];
      return;
    }
    if (trimmed.toUpperCase() === "E") {
      this.records[key] = "E";
      return;
    }
    const item = this.findItem(itemId);
    const num = Number(trimmed);
    if (Number.isNaN(num) || num < 0 || (item && num > item.maxPoints)) {
      throw new Error(
        item ? `Enter a number from 0 to ${item.maxPoints}, or "E" for exempt.` : 'Enter a number, or "E" for exempt.'
      );
    }
    this.records[key] = String(num);
  },

  setWeight(key, value) {
    this.weights[key] = Math.max(0, Number(value) || 0);
  },

  // ----- Scoring tools (extra tabs alongside Main Scores) -----

  /** Adds a new tool of the given type (must be a key in SCORING_TOOL_TYPES) and returns it. Auto-numbers the name when more than one of the same type exists. */
  addTool(type) {
    if (!SCORING_TOOL_TYPES[type]) {
      throw new Error(`Unknown scoring tool type: ${type}`);
    }
    if (this.tools.length >= MAX_SCORING_TOOLS) {
      throw new Error(`You've reached the limit of ${MAX_SCORING_TOOLS} scoring tools.`);
    }
    const label = SCORING_TOOL_TYPES[type];
    const countOfType = this.tools.filter((t) => t.type === type).length;
    const tool = {
      id: `tool-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      type,
      name: countOfType === 0 ? label : `${label} ${countOfType + 1}`,
    };
    this.tools.push(tool);
    return tool;
  },

  removeTool(toolId) {
    this.tools = this.tools.filter((t) => t.id !== toolId);
    this._clearTableTestSources(toolId);
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        if (item.scoreSources && item.scoreSources.toolWeights) {
          delete item.scoreSources.toolWeights[toolId];
        }
        if (item.scoreSources && item.scoreSources.testSelections) {
          delete item.scoreSources.testSelections[toolId];
        }
        if (item.scoreSources && item.scoreSources.projectSelections) {
          delete item.scoreSources.projectSelections[toolId];
        }
      });
    });
  },

  /** Clears any Progress Tracker column that pulls from the given Test & Quiz Bank (and, if testId is given, only that test). */
  _clearTableTestSources(sourceToolId, testId) {
    this.tools.forEach((tool) => {
      if (tool.type !== "table" || !tool.config || !Array.isArray(tool.config.columns)) return;
      tool.config.columns.forEach((column) => {
        const source = column.testSource;
        if (source && source.toolId === sourceToolId && (!testId || source.testId === testId)) {
          column.testSource = { toolId: "", testId: "" };
        }
      });
    });
  },

  renameTool(toolId, name) {
    const tool = this.findTool(toolId);
    if (tool) tool.name = (name || "").trim() || tool.name;
  },

  findTool(toolId) {
    return this.tools.find((t) => t.id === toolId) || null;
  },

  // ----- Progress Tracker (type "table") config -----
  // tool.config: { firstColumn: { name, mode }, columns: [{ id, name,
  // type, maxPoints }], values }. firstColumn.mode is "students" or
  // "groups" and drives where rows come from: in "students" mode
  // there's one row per current roster student, keyed and named by
  // that student (their name shown, non-editable — it's always
  // whatever the roster currently says); in "groups" mode there's one
  // row per distinct group number currently in use on the live
  // Seating Chart, keyed and named by that number. Rows are never
  // manually added, removed, or renamed — this is what keeps them
  // reliably matched to Score Sources. firstColumn.name is not
  // user-editable: it's always "Student" or "Group" to match the mode.
  // columns[].type is "score" or "score_max" (see TABLE_COLUMN_TYPES).
  // A fixed, read-only "Total Score" column always follows the last
  // configured column — it's computed (see computeTableScoreSum), not
  // stored. Main Scores items can draw on it via Score Sources (see
  // computeItemEffectiveScore below).

  /** Returns tool.config for a Progress Tracker, creating/normalizing it (and migrating any older Table-tool data) in place first. Returns null if the tool doesn't exist. */
  getTableConfig(toolId) {
    const tool = this.findTool(toolId);
    if (!tool) return null;
    if (!tool.config || typeof tool.config !== "object") tool.config = {};
    const cfg = tool.config;

    if (!cfg.firstColumn || typeof cfg.firstColumn !== "object") cfg.firstColumn = {};
    if (cfg.firstColumn.mode !== "groups" && cfg.firstColumn.mode !== "students") {
      cfg.firstColumn.mode = "students";
    }
    // Fixed — follows the mode, never user-edited.
    cfg.firstColumn.name = cfg.firstColumn.mode === "groups" ? "Group" : "Student";

    if (!cfg.values || typeof cfg.values !== "object") cfg.values = {};
    if (!Array.isArray(cfg.columns)) cfg.columns = [];

    // The whole tracker is either "raw" (plain points, no maximums) or "max" (every column has a
    // maximum, and the Total Score's maximum is their sum). Older trackers become "max" if any
    // column was "score_max" or their Total Score was set to "out of a maximum".
    if (cfg.mode !== "raw" && cfg.mode !== "max") {
      const wasMax = cfg.columns.some((c) => c.type === "score_max") || (cfg.totalColumn && cfg.totalColumn.mode === "max");
      cfg.mode = wasMax ? "max" : "raw";
    }
    // Optional sub-rows, shared by every row: [{ id, name }]; their scores live in subValues,
    // keyed "lineId|subRowId|columnId".
    if (!Array.isArray(cfg.subRows)) cfg.subRows = [];
    if (!cfg.subValues || typeof cfg.subValues !== "object") cfg.subValues = {};

    // The fixed Total Score column's own setting: "raw" (the plain sum)
    // or "max" (the sum shown out of totalColumn.maxPoints, and sent to
    // Main Scores as a percentage × 100 — see _toolContributionForStudent).
    if (!cfg.totalColumn || typeof cfg.totalColumn !== "object") cfg.totalColumn = {};
    if (cfg.totalColumn.mode !== "max") cfg.totalColumn.mode = "raw";
    if (typeof cfg.totalColumn.maxPoints !== "number") cfg.totalColumn.maxPoints = 0;

    // Migration from the old Table tool: its computed "total score"
    // columns are gone (the fixed Total Score column replaces them),
    // and its "description" columns become plain score columns.
    const droppedIds = new Set();
    cfg.columns = cfg.columns.filter((column) => {
      const legacyTotal =
        column.type === "cum_score" ||
        column.type === "total_score_raw" ||
        column.type === "total_score_points" ||
        column.type === "total_score_percentage";
      if (legacyTotal) droppedIds.add(column.id);
      return !legacyTotal;
    });
    cfg.columns.forEach((column) => {
      if (!TABLE_COLUMN_TYPES.includes(column.type)) column.type = "score";
      if (typeof column.maxPoints !== "number") column.maxPoints = 0;
      if (column.type === "test" && (!column.testSource || typeof column.testSource !== "object")) {
        column.testSource = { toolId: "", testId: "" };
      }
    });
    if (droppedIds.size > 0) this._purgeTableValues(cfg, { columnIds: droppedIds });

    return cfg;
  },

  setTableFirstColumnMode(toolId, mode) {
    const cfg = this.getTableConfig(toolId);
    if (cfg) {
      cfg.firstColumn.mode = mode === "groups" ? "groups" : "students";
      cfg.firstColumn.name = cfg.firstColumn.mode === "groups" ? "Group" : "Student";
    }
  },

  /** Every distinct group number currently in use on the live Seating Chart (ungrouped desks excluded), ascending. */
  _liveSeatingGroups() {
    if (!window.SeatingModule) return [];
    const seating = window.SeatingModule;
    const groups = new Set();
    for (let r = 0; r < seating.rows; r++) {
      for (let c = 0; c < seating.cols; c++) {
        if (!seating.isActive(r, c)) continue;
        const g = seating.getGroup(r, c);
        if (g) groups.add(g);
      }
    }
    return Array.from(groups).sort((a, b) => a - b);
  },

  /** This tracker's identity rows, live: one per roster student ({ key: studentId, label: student's name }) in "students" mode, or one per group currently on the Seating Chart ({ key: String(groupNumber), label: same }) in "groups" mode. This — not any stored list — is what the grid and Score Sources both use, so rows can never drift out of sync with the roster or seating chart. */
  getTableIdentityRows(toolId) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return [];
    if (cfg.firstColumn.mode === "groups") {
      return this._liveSeatingGroups().map((n) => ({ key: String(n), label: String(n) }));
    }
    const students = (window.RosterModule && window.RosterModule.students) || [];
    return students.map((s) => ({ key: s.id, label: s.name || "(unnamed)" }));
  },

  /** Sets the column count (not including the first column or the fixed Total Score column), adding default trailing "score" columns or trimming from the end. */
  setTableColumnCount(toolId, count) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return;
    count = Math.max(0, Math.min(MAX_TABLE_COLUMNS, Math.round(Number(count) || 0)));
    if (count > cfg.columns.length) {
      while (cfg.columns.length < count) {
        const n = cfg.columns.length + 1;
        cfg.columns.push({
          id: `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: `Column ${n}`,
          type: "score",
          maxPoints: 0,
        });
      }
    } else if (count < cfg.columns.length) {
      const removed = cfg.columns.slice(count);
      const columnIds = new Set(removed.map((c) => c.id));
      cfg.columns = cfg.columns.slice(0, count);
      this._purgeTableValues(cfg, { columnIds });
    }
  },

  setTableColumnName(toolId, columnId, name) {
    const cfg = this.getTableConfig(toolId);
    const column = cfg && cfg.columns.find((c) => c.id === columnId);
    if (!column) return;
    column.name = (name || "").trim() || column.name;
  },

  setTableColumnType(toolId, columnId, type) {
    const cfg = this.getTableConfig(toolId);
    const column = cfg && cfg.columns.find((c) => c.id === columnId);
    if (!column) return;
    column.type = TABLE_COLUMN_TYPES.includes(type) ? type : "score";
  },

  /** Which test/quiz a "test" column pulls from (pass "" for both to clear it). */
  setTableColumnTestSource(toolId, columnId, sourceToolId, testId) {
    const cfg = this.getTableConfig(toolId);
    const column = cfg && cfg.columns.find((c) => c.id === columnId);
    if (!column) return;
    column.testSource = { toolId: sourceToolId || "", testId: testId || "" };
  },

  /** The maximum for a "score_max" column — unused by "score" columns. */
  setTableColumnMaxPoints(toolId, columnId, value) {
    const cfg = this.getTableConfig(toolId);
    const column = cfg && cfg.columns.find((c) => c.id === columnId);
    if (!column) return;
    column.maxPoints = Math.max(0, Number(value) || 0);
  },

  /** "raw" (plain sum) or "max" (sum out of a set maximum) for the fixed Total Score column. */
  setTableTotalMode(toolId, mode, projectId) {
    const cfg = this._configForTool(toolId, projectId);
    if (cfg) cfg.totalColumn.mode = mode === "max" ? "max" : "raw";
  },

  /** The maximum for the Total Score column when its mode is "max". */
  setTableTotalMaxPoints(toolId, value, projectId) {
    const cfg = this._configForTool(toolId, projectId);
    if (cfg) cfg.totalColumn.maxPoints = Math.max(0, Number(value) || 0);
  },

  /** The object that carries the totalColumn setting: a Progress Tracker's config, or — for a Presentation Calc — the given project. */
  _configForTool(toolId, projectId) {
    const tool = this.findTool(toolId);
    if (!tool) return null;
    return tool.type === "presentation" ? this.getPresentationProject(toolId, projectId) : this.getTableConfig(toolId);
  },

  /** What a tool sends to Main Scores for a row total: the plain sum in "raw" mode, or percentage × 100 in "max" mode (null if "max" has no maximum set). Used as-is by the Score Sources blend. */
  _totalContribution(cfg, sum) {
    if (cfg.totalColumn.mode === "max") {
      if (!(cfg.totalColumn.maxPoints > 0)) return null;
      return { raw: true, value: (sum / cfg.totalColumn.maxPoints) * 100 };
    }
    return { raw: true, value: sum };
  },

  setTableMode(toolId, mode) {
    const cfg = this.getTableConfig(toolId);
    if (cfg) cfg.mode = mode === "max" ? "max" : "raw";
  },

  /** Sets how many sub-rows every row has (0 = none), adding default-named ones or trimming from the end. */
  setTableSubRowCount(toolId, count) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return;
    count = Math.max(0, Math.min(MAX_TABLE_SUBROWS, Math.round(Number(count) || 0)));
    if (count > cfg.subRows.length) {
      while (cfg.subRows.length < count) {
        cfg.subRows.push({
          id: `sub-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: `Sub-row ${cfg.subRows.length + 1}`,
        });
      }
    } else if (count < cfg.subRows.length) {
      const removed = cfg.subRows.slice(count);
      cfg.subRows = cfg.subRows.slice(0, count);
      this._purgeTableValues(cfg, { subIds: new Set(removed.map((r) => r.id)) });
    }
  },

  setTableSubRowName(toolId, subId, name) {
    const cfg = this.getTableConfig(toolId);
    const sub = cfg && cfg.subRows.find((r) => r.id === subId);
    if (sub) sub.name = (name || "").trim() || sub.name;
  },

  /** The maximum for one column's main-row box in "max" mode: the column's maximum, times the number of sub-rows when it is split into sub-rows (test/quiz columns aren't). 0 in "raw" mode. */
  tableColumnMax(toolId, column) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg || cfg.mode !== "max") return 0;
    const split = column.type !== "test" && cfg.subRows.length > 0;
    return (column.maxPoints || 0) * (split ? cfg.subRows.length : 1);
  },

  /** The maximum for the Total Score column in "max" mode: the sum of every column's maximum (0 in "raw" mode). Automatic — not chosen by the user. */
  tableMaxTotal(toolId) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg || cfg.mode !== "max") return 0;
    return cfg.columns.reduce((sum, col) => sum + this.tableColumnMax(toolId, col), 0);
  },

  // ----- Progress Tracker cell values -----
  // Keyed by "lineId|columnId", where lineId is an identity row's key
  // directly — a student id, or a group number as a string (see
  // getTableIdentityRows). The Total Score column stores nothing
  // here; it's computed from the other columns on the same line.

  getTableValue(toolId, lineId, columnId, subId) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return "";
    if (subId) return cfg.subValues[`${lineId}|${subId}|${columnId}`] || "";
    return cfg.values[`${lineId}|${columnId}`] || "";
  },

  /** value: "" (blank) or a number. In "max" mode the number must also be from 0 up to the column's maximum (when one is set). subId (optional) is a sub-row. Throws on anything else. */
  setTableValue(toolId, lineId, columnId, value, subId) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return;
    const column = cfg.columns.find((c) => c.id === columnId);
    const store = subId ? cfg.subValues : cfg.values;
    const key = subId ? `${lineId}|${subId}|${columnId}` : `${lineId}|${columnId}`;
    const trimmed = value == null ? "" : String(value).trim();

    if (trimmed === "") {
      delete store[key];
      return;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num)) throw new Error("Enter a number.");
    if (cfg.mode === "max") {
      const max = column ? column.maxPoints || 0 : 0;
      if (num < 0 || (max > 0 && num > max)) {
        throw new Error(max > 0 ? `Enter a number from 0 to ${max}.` : "Enter a number of 0 or more.");
      }
    }
    store[key] = String(num);
  },

  /** One main-row box's value as a number, or null if blank. For a "test" column that's the student's score on the chosen test/quiz (students-mode trackers only). When the tracker has sub-rows, it's the sum of that column's sub-row scores (null if none entered); otherwise it's the number typed into the box. */
  tableCellNumber(toolId, lineId, column) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return null;
    if (column.type === "test") {
      if (cfg.firstColumn.mode !== "students") return null;
      const source = column.testSource || {};
      return source.toolId && source.testId ? this.testScore(source.toolId, source.testId, lineId) : null;
    }
    if (cfg.subRows.length > 0) {
      let sum = 0;
      let any = false;
      cfg.subRows.forEach((sub) => {
        const raw = cfg.subValues[`${lineId}|${sub.id}|${column.id}`];
        if (raw === undefined) return;
        const num = Number(raw);
        if (!Number.isNaN(num)) {
          sum += num;
          any = true;
        }
      });
      return any ? sum : null;
    }
    const raw = cfg.values[`${lineId}|${column.id}`];
    if (raw === undefined) return null;
    const num = Number(raw);
    return Number.isNaN(num) ? null : num;
  },

  /** The fixed Total Score for one line: the sum of every column's value on that line (blank/non-numeric entries count as 0). Returns null if the tracker has no columns at all, so the caller can show "—" instead of a bare 0. */
  computeTableScoreSum(toolId, lineId) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg || cfg.columns.length === 0) return null;
    let sum = 0;
    cfg.columns.forEach((col) => {
      const num = this.tableCellNumber(toolId, lineId, col);
      if (num !== null) sum += num;
    });
    return sum;
  },

  /** Deletes any stored cell values whose lineId is in `lineIds`, whose columnId is in `columnIds`, and/or (sub-row values) whose sub-row id is in `subIds` — called when columns or sub-rows are removed so their old values don't linger as orphaned data. */
  _purgeTableValues(cfg, { lineIds, columnIds, subIds } = {}) {
    if (!lineIds && !columnIds && !subIds) return;
    Object.keys(cfg.values).forEach((key) => {
      const sepIndex = key.indexOf("|");
      const lineId = key.slice(0, sepIndex);
      const columnId = key.slice(sepIndex + 1);
      if ((lineIds && lineIds.has(lineId)) || (columnIds && columnIds.has(columnId))) {
        delete cfg.values[key];
      }
    });
    Object.keys(cfg.subValues || {}).forEach((key) => {
      const [lineId, subId, columnId] = key.split("|");
      if (
        (lineIds && lineIds.has(lineId)) ||
        (columnIds && columnIds.has(columnId)) ||
        (subIds && subIds.has(subId))
      ) {
        delete cfg.subValues[key];
      }
    });
  },

  // ----- Presentation Calc tool (type "presentation") -----
  // tool.config: { projects: [project, ...] }. A Presentation Calc holds
  // any number of PROJECTS (one per presentation assignment); each has
  // its own groups, rubrics, scores and templates:
  //   project: {
  //     id, name,
  //     roster: [{ studentId, classNumber, name, pronunciation, schoolId, group }]
  //       — a snapshot of one Seating Chart memory bank (seated students
  //       only, with that desk's Group Number). An explicit IMPORT, not a
  //       live link, so it stays a fixed presentation-order roster even
  //       if seats get rearranged afterward.
  //     sourceBankName,
  //     rubricBank: [{ id, text }] — manually-entered rubric descriptions,
  //     teacherRubrics / audienceRubrics: [{ id, rubricId, points, weight }] —
  //       the active rubrics; each becomes one score column, worth up to
  //       `points` (at most MAX_RUBRIC_POINTS). `weight` is a PERCENTAGE
  //       (null = not set) that the column's score counts for in the
  //       group's Total Score — see _weightedTotal,
  //     peerWeight: the percentage weight (null = not set) of the fixed Peer Evaluation column,
  //     weightsArePercent: marks projects already converted from the earlier multiplier weights,
  //     values: "group|entryId" -> score entered for that group (the
  //       Peer Evaluation column uses entryId "peer"),
  //     totalColumn: { mode, maxPoints } — same raw / out-of-max setting
  //       as the Progress Tracker's Total Score column,
  //     templateSettings: instructions etc. for the score-sheet CSVs,
  //     scoreUploads: score-sheet CSVs uploaded back from participants
  //       (see "uploaded score sheets" below)
  //   }
  // Scores are entered per GROUP (each presentation group gets one
  // score per active rubric); every student in a group shares their
  // group's Total Score. Which project a Main Scores item pulls from is
  // stored on the item (scoreSources.projectSelections[toolId]).

  /** Fills in any missing pieces of one project, in place. */
  _normalizeProject(project) {
    if (!project.id) project.id = `project-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    if (typeof project.name !== "string" || !project.name.trim()) project.name = "Project";
    if (!Array.isArray(project.roster)) project.roster = [];
    if (typeof project.sourceBankName !== "string") project.sourceBankName = "";
    ["rubricBank", "teacherRubrics", "audienceRubrics"].forEach((key) => {
      if (!Array.isArray(project[key])) project[key] = [];
    });
    // Weights used to be multipliers (default 1); they are now percentages (null = not set). The
    // one-time conversion turns the old default of 1 into "not set" so existing totals don't change.
    if (!project.weightsArePercent) {
      [project.teacherRubrics, project.audienceRubrics].forEach((list) => {
        list.forEach((entry) => {
          if (entry.weight === 1) entry.weight = null;
        });
      });
      if (project.peerWeight === 1) project.peerWeight = null;
      project.weightsArePercent = true;
    }
    [project.teacherRubrics, project.audienceRubrics].forEach((list) => {
      list.forEach((entry) => {
        if (typeof entry.points === "number" && entry.points > MAX_RUBRIC_POINTS) entry.points = MAX_RUBRIC_POINTS;
        if (typeof entry.weight !== "number" || !(entry.weight >= 0)) entry.weight = null;
      });
    });
    if (typeof project.peerWeight !== "number" || !(project.peerWeight >= 0)) project.peerWeight = null;
    if (!project.values || typeof project.values !== "object") project.values = {};
    if (!project.totalColumn || typeof project.totalColumn !== "object") project.totalColumn = {};
    if (project.totalColumn.mode !== "max") project.totalColumn.mode = "raw";
    if (typeof project.totalColumn.maxPoints !== "number") project.totalColumn.maxPoints = 0;

    if (!Array.isArray(project.scoreUploads)) project.scoreUploads = [];
    project.scoreUploads.forEach((upload) => {
      ["scores", "comments", "ratings"].forEach((key) => {
        if (!Array.isArray(upload[key])) upload[key] = [];
      });
    });

    // Settings for the Templates page (score-sheet CSVs).
    if (!project.templateSettings || typeof project.templateSettings !== "object") project.templateSettings = {};
    const ts = project.templateSettings;
    if (typeof ts.audienceInstructions !== "string") ts.audienceInstructions = "";
    if (typeof ts.audienceComments !== "boolean") ts.audienceComments = true;
    if (typeof ts.peerInstructions !== "string") ts.peerInstructions = "";
    if (typeof ts.emailSubject !== "string") ts.emailSubject = "";
    if (typeof ts.emailMessage !== "string") ts.emailMessage = "";
    ts.peerHighestScore = Math.max(1, Math.min(10, Math.round(Number(ts.peerHighestScore) || 10)));
    return project;
  },

  /** Returns tool.config for a Presentation Calc ({ projects }), creating/normalizing it in place first. A Presentation Calc saved before projects existed (its roster/rubrics/scores sat directly in the config) is converted into one project called "Project 1", and any Main Scores item already pulling from the tool is pointed at it. Null if the tool doesn't exist. */
  getPresentationConfig(toolId) {
    const tool = this.findTool(toolId);
    if (!tool) return null;
    if (!tool.config || typeof tool.config !== "object") tool.config = {};
    const cfg = tool.config;

    if (!Array.isArray(cfg.projects)) {
      cfg.projects = [];
      const flatKeys = ["roster", "sourceBankName", "rubricBank", "teacherRubrics", "audienceRubrics", "values", "totalColumn", "templateSettings"];
      const hasContent =
        ["roster", "rubricBank", "teacherRubrics", "audienceRubrics"].some((key) => Array.isArray(cfg[key]) && cfg[key].length > 0) ||
        (cfg.values && typeof cfg.values === "object" && Object.keys(cfg.values).length > 0);
      if (hasContent) {
        const project = { name: "Project 1" };
        flatKeys.forEach((key) => {
          if (key in cfg) project[key] = cfg[key];
        });
        this._normalizeProject(project);
        cfg.projects.push(project);
        this.categories.forEach((category) => {
          category.items.forEach((item) => {
            const sources = item.scoreSources;
            if (sources && sources.toolWeights && sources.toolWeights[toolId] > 0) {
              if (!sources.projectSelections || typeof sources.projectSelections !== "object") sources.projectSelections = {};
              sources.projectSelections[toolId] = project.id;
            }
          });
        });
      }
      flatKeys.forEach((key) => delete cfg[key]);
    }

    cfg.projects.forEach((project) => this._normalizeProject(project));
    return cfg;
  },

  presentationProjects(toolId) {
    const cfg = this.getPresentationConfig(toolId);
    return cfg ? cfg.projects : [];
  },

  getPresentationProject(toolId, projectId) {
    return this.presentationProjects(toolId).find((p) => p.id === projectId) || null;
  },

  /** Adds a new, empty project (named `name`, or "Project N" if blank) and returns it. */
  addPresentationProject(toolId, name) {
    const cfg = this.getPresentationConfig(toolId);
    if (!cfg) throw new Error("That Presentation Calc no longer exists.");
    if (cfg.projects.length >= MAX_PRES_PROJECTS) {
      throw new Error(`You've reached the limit of ${MAX_PRES_PROJECTS} projects.`);
    }
    const project = this._normalizeProject({ name: (name || "").trim() || `Project ${cfg.projects.length + 1}` });
    cfg.projects.push(project);
    return project;
  },

  renamePresentationProject(toolId, projectId, name) {
    const project = this.getPresentationProject(toolId, projectId);
    if (project) project.name = (name || "").trim() || project.name;
  },

  /** Removes a project, and clears it from any Main Scores item that was pulling from it. */
  removePresentationProject(toolId, projectId) {
    const cfg = this.getPresentationConfig(toolId);
    if (!cfg) return;
    cfg.projects = cfg.projects.filter((p) => p.id !== projectId);
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        const selections = item.scoreSources && item.scoreSources.projectSelections;
        if (selections && selections[toolId] === projectId) delete selections[toolId];
      });
    });
  },

  /** Replaces a project's roster snapshot with the seated students of one Seating Chart memory bank (active + occupied desks only), ordered by group then Class Number. */
  importPresentationRoster(toolId, projectId, bank, rosterModule) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return;
    if (!bank || !bank.snapshot) {
      throw new Error("That memory bank is empty — save a seating arrangement into it first.");
    }
    const { rows, cols, active, seats, groups } = bank.snapshot;

    const entries = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}-${c}`;
        if (!active || !active[key]) continue;
        const studentId = seats[key];
        if (!studentId) continue;
        const student = rosterModule.students.find((s) => s.id === studentId);
        if (!student) continue;
        entries.push({
          studentId: student.id,
          classNumber: student.classNumber,
          name: student.name,
          pronunciation: student.pronunciation,
          schoolId: student.schoolId,
          group: (groups && groups[key]) || 0,
        });
      }
    }
    entries.sort((a, b) => {
      const groupA = a.group || Infinity;
      const groupB = b.group || Infinity;
      if (groupA !== groupB) return groupA - groupB;
      return (a.classNumber || 0) - (b.classNumber || 0);
    });
    project.roster = entries;
    project.sourceBankName = bank.name;
  },

  /** Distinct Group Numbers in a project's roster snapshot (ungrouped excluded), ascending. */
  presentationGroups(toolId, projectId) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return [];
    const groups = new Set();
    project.roster.forEach((entry) => {
      if (entry.group) groups.add(entry.group);
    });
    return Array.from(groups).sort((a, b) => a - b);
  },

  // Rubric bank

  /** Removes a rubric from the shared bank, and clears it from every active rubric in this course's projects. */
  presRemoveRubricBankRow(rubricId) {
    RubricBankModule.remove(rubricId);
    this.tools.forEach((tool) => {
      if (tool.type !== "presentation") return;
      this.presentationProjects(tool.id).forEach((project) => {
        [project.teacherRubrics, project.audienceRubrics].forEach((list) =>
          list.forEach((entry) => {
            if (entry.rubricId === rubricId) entry.rubricId = null;
          })
        );
      });
    });
  },

  // Active rubrics (each one is a score column)

  _presActiveList(project, kind) {
    return kind === "audience" ? project.audienceRubrics : project.teacherRubrics;
  },

  presAddActiveRubric(toolId, projectId, kind) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return;
    const list = this._presActiveList(project, kind);
    if (list.length >= MAX_ACTIVE_RUBRICS) {
      throw new Error(`You've reached the limit of ${MAX_ACTIVE_RUBRICS} active rubrics.`);
    }
    list.push({ id: `active-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, rubricId: null, points: 0, weight: null });
  },

  presRemoveActiveRubric(toolId, projectId, kind, entryId) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return;
    if (kind === "audience") project.audienceRubrics = project.audienceRubrics.filter((e) => e.id !== entryId);
    else project.teacherRubrics = project.teacherRubrics.filter((e) => e.id !== entryId);
    Object.keys(project.values).forEach((key) => {
      if (key.endsWith(`|${entryId}`)) delete project.values[key];
    });
  },

  presSetActiveSelection(toolId, projectId, kind, entryId, rubricId) {
    const project = this.getPresentationProject(toolId, projectId);
    const entry = project && this._presActiveList(project, kind).find((e) => e.id === entryId);
    if (entry) entry.rubricId = rubricId || null;
  },

  presSetActivePoints(toolId, projectId, kind, entryId, points) {
    const project = this.getPresentationProject(toolId, projectId);
    const entry = project && this._presActiveList(project, kind).find((e) => e.id === entryId);
    if (entry) entry.points = Math.max(0, Math.min(MAX_RUBRIC_POINTS, Math.round(Number(points) || 0)));
  },

  /** Sets an active rubric's weight, a percentage (0 or more; decimals fine). Blank or invalid means "not set". */
  presSetActiveWeight(toolId, projectId, kind, entryId, value) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return;
    const text = String(value == null ? "" : value).trim();
    const num = Number(text);
    const weight = text !== "" && !Number.isNaN(num) && num >= 0 ? num : null;
    if (kind === "peer") {
      project.peerWeight = weight; // the fixed Peer Evaluation column
      return;
    }
    const entry = this._presActiveList(project, kind).find((e) => e.id === entryId);
    if (entry) entry.weight = weight;
  },

  // Score columns + entered values

  /** A project's score columns: every active rubric that has a rubric chosen (Teacher ones first, then Audience), then the fixed Peer Evaluation column, as { entryId, kind, text, label, points, weight }. */
  presentationColumns(toolId, projectId) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return [];
    const columns = [];
    [
      ["teacher", project.teacherRubrics],
      ["audience", project.audienceRubrics],
    ].forEach(([kind, list]) => {
      list.forEach((entry) => {
        const rubric = RubricBankModule.find(entry.rubricId);
        if (!rubric) return;
        columns.push({
          entryId: entry.id,
          kind,
          text: rubric.text || "(untitled rubric)",
          label: `${kind === "teacher" ? "Teacher" : "Audience"}: ${rubric.text || "(untitled rubric)"}`,
          points: entry.points || 0,
          weight: typeof entry.weight === "number" ? entry.weight : null,
        });
      });
    });

    // The fixed Peer Evaluation column always comes last (just before the Total Score). Its scores run from 0 up to the project's highest peer score (set on the Templates page).
    columns.push({
      entryId: "peer",
      kind: "peer",
      text: "Peer Evaluation",
      label: "Peer Evaluation",
      points: project.templateSettings.peerHighestScore,
      weight: project.peerWeight,
    });
    return columns;
  },

  getPresentationValue(toolId, projectId, group, entryId) {
    const project = this.getPresentationProject(toolId, projectId);
    return project ? project.values[`${group}|${entryId}`] || "" : "";
  },

  /** value: "" (blank) or a number from 0 up to that rubric's points. Throws on anything else. */
  setPresentationValue(toolId, projectId, group, entryId, value) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return;
    const key = `${group}|${entryId}`;
    const trimmed = value == null ? "" : String(value).trim();
    if (trimmed === "") {
      delete project.values[key];
      return;
    }
    const num = Number(trimmed);
    const column = this.presentationColumns(toolId, projectId).find((c) => c.entryId === entryId);
    const max = column ? column.points : 0;
    if (Number.isNaN(num) || num < 0 || (max > 0 && num > max)) {
      throw new Error(max > 0 ? `Enter a number from 0 to ${max}.` : "Enter a number of 0 or more.");
    }
    project.values[key] = String(num);
  },

  /**
   * Combines one row's scores into a Total. `scoreOf(column)` gives the
   * score (number, or null if none). Returns { total, max }:
   *  - With NO weights set anywhere: the plain sum of the scores, out of
   *    the sum of the columns' points.
   *  - With weights set (percentages): each column counts
   *    score ÷ points × weight, so weights adding up to 100 make the
   *    Total out of 100; a column with no weight counts for nothing. max
   *    is the sum of the weights.
   * total is null when the row has no scores at all.
   */
  _weightedTotal(columns, scoreOf) {
    const weighted = columns.some((c) => c.weight !== null && c.weight !== undefined);
    let total = 0;
    let anyScore = false;
    let max = 0;
    columns.forEach((col) => {
      const score = scoreOf(col);
      if (score !== null && score !== undefined) anyScore = true;
      const value = score === null || score === undefined ? 0 : score;
      if (weighted) {
        if (!(col.weight > 0)) return;
        max += col.weight;
        if (col.points > 0) total += (value / col.points) * col.weight;
      } else {
        max += col.points;
        total += value;
      }
    });
    return { total: anyScore ? total : null, max };
  },

  /** The sum of a project's rubric weights, for the check that they add up to 100: { total, anySet }. */
  presentationWeightSum(toolId, projectId) {
    const columns = this.presentationColumns(toolId, projectId);
    const anySet = columns.some((c) => c.weight !== null && c.weight !== undefined);
    return { total: columns.reduce((sum, c) => sum + (c.weight > 0 ? c.weight : 0), 0), anySet };
  },

  /** Total Score for one group (see _weightedTotal; blank counts as 0 and a row with nothing entered totals 0). Null if there are no score columns yet. */
  computePresentationSum(toolId, projectId, group) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return null;
    const columns = this.presentationColumns(toolId, projectId);
    if (!columns.some((c) => c.kind !== "peer")) return null; // no rubrics yet
    const result = this._weightedTotal(columns, (col) => {
      const raw = project.values[`${group}|${col.entryId}`];
      if (raw === undefined) return null;
      const num = Number(raw);
      return Number.isNaN(num) ? null : num;
    });
    return result.total === null ? 0 : result.total;
  },

  // ----- Presentation Calc: score-sheet templates (CSV) -----

  /**
   * Builds the rows (arrays of three cells: columns A, B, C) of one of
   * three score-sheet CSV templates for a project: kind "teacher",
   * "audience", or "peer". Row/column positions follow the layout
   * described for the Templates page:
   *
   * Teacher / Audience — per group: "Group N" in A (first group at A3),
   *   a 0 in B on the next row, then each active rubric of that kind: its
   *   text in A and its scores, highest to 0, down column B (the first
   *   rubric's scores begin two rows below it, later ones one row below
   *   — e.g. A5 with B7:B17, then A21 with B22:B32). Next comes
   *   "Comments" in A with "short" in C, and the next group follows.
   *   After the last group: "Global Comments" / "short". (Audience: A1
   *   holds the instructions, and turning Comments off simply leaves out
   *   every "Comments"/"Global Comments" and its "short".)
   * Peer — A1 holds the instructions; per group: "Group N" in A (first
   *   at A3), then each student in the group (by class number) in A with
   *   scores from the highest allowed score down to 0 in B starting one
   *   row below the name.
   * Each element after the first starts 4 rows after the previous one's
   * last row. Throws a readable Error if there's nothing to build from.
   */
  buildPresentationTemplateRows(toolId, projectId, kind) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) throw new Error("That project no longer exists.");
    const settings = project.templateSettings;

    const groups = this.presentationGroups(toolId, projectId);
    if (groups.length === 0) {
      throw new Error('No groups yet — open "Student Groups" and import a seating arrangement that has Group Numbers set.');
    }

    const rows = [];
    const put = (row, col, value) => {
      while (rows.length < row) rows.push(["", "", ""]);
      rows[row - 1][col] = value; // col 0 = A, 1 = B, 2 = C
    };

    if (kind === "peer") {
      const highest = settings.peerHighestScore;
      const custom = settings.peerInstructions.trim();
      put(
        1,
        0,
        custom ||
          `Rate each member in your group, including yourself. If a member did a good job and worked hard, rate them a ${highest}. If they didn't work hard, give them a 0. Only the teacher can see your answer.`
      );

      let row = 3;
      groups.forEach((group) => {
        put(row, 0, `Group ${group}`);
        const members = project.roster
          .filter((entry) => entry.group === group)
          .sort((a, b) => (a.classNumber || 0) - (b.classNumber || 0));
        let studentRow = row + 1;
        members.forEach((entry) => {
          put(studentRow, 0, entry.name || (entry.classNumber ? `#${entry.classNumber}` : "(unnamed)"));
          for (let i = 0; i <= highest; i++) put(studentRow + 1 + i, 1, highest - i);
          studentRow = studentRow + 1 + highest + 4; // last score row + 4
        });
        row = studentRow;
      });
      return rows;
    }

    const isAudience = kind === "audience";
    const columns = this.presentationColumns(toolId, projectId).filter(
      (c) => c.kind === (isAudience ? "audience" : "teacher")
    );
    if (columns.length === 0) {
      throw new Error(
        `No active ${isAudience ? "Audience" : "Teacher"} rubrics yet — open "Rubrics" and activate at least one with a rubric chosen.`
      );
    }
    const commentsOn = isAudience ? settings.audienceComments : true;

    if (isAudience) {
      const custom = settings.audienceInstructions.trim();
      put(
        1,
        0,
        custom ||
          "Rate each group that presents. Higher numbers are good, lower numbers are bad. You can leave a comment for each group. Only the teacher can see your answer."
      );
    }

    let row = 3;
    groups.forEach((group) => {
      put(row, 0, `Group ${group}`);
      put(row + 1, 1, 0);
      let elementRow = row + 2; // where the next rubric (or Comments) goes
      columns.forEach((col, index) => {
        put(elementRow, 0, col.text);
        const scoreStart = index === 0 ? elementRow + 2 : elementRow + 1;
        for (let i = 0; i <= col.points; i++) put(scoreStart + i, 1, col.points - i);
        elementRow = scoreStart + col.points + 4; // last score row + 4
      });
      if (commentsOn) {
        put(elementRow, 0, "Comments");
        put(elementRow, 2, "short");
      }
      row = elementRow + 4;
    });
    if (commentsOn) {
      put(row, 0, "Global Comments");
      put(row, 2, "short");
    }
    return rows;
  },

  // ----- Presentation Calc: uploaded score sheets -----
  // project.scoreUploads: one entry per uploaded CSV —
  //   { id, kind: "teacher" | "audience" | "peer", fileName, importedAt,
  //     respondentCount,
  //     scores:   [[respondentKey, group, entryId, value]],  teacher/audience: one score for one
  //                                                         group on one active rubric
  //     comments: [[respondentKey, group, text]],           teacher/audience; group 0 = global comment
  //     ratings:  [[raterKey, studentId, value]] }          peer: one student's rating of another
  // respondentKey is the value in the file's "name" column: a student's
  // School ID, or an actual name (a teacher or other non-student), or a
  // unique "#..." key when that cell is blank. If the same respondent
  // appears more than once for the same thing, the latest upload/row
  // wins when scores are combined.
  // Own-group / self rating rule: when a respondent's value is the School
  // ID of a student, that student's scores for THEIR OWN group, and their
  // rating of THEMSELVES in a peer evaluation, are not counted (see
  // presentationCountedScores / presentationCountedRatings). Other
  // respondents (a teacher's name, etc.) count for every group.

  addPresentationUpload(toolId, projectId, upload) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) throw new Error("That project no longer exists.");
    const record = {
      id: upload.id || `upload-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      kind: upload.kind,
      fileName: upload.fileName || "",
      importedAt: new Date().toISOString(),
      respondentCount: upload.respondentCount || 0,
      scores: upload.scores || [],
      comments: upload.comments || [],
      ratings: upload.ratings || [],
    };
    project.scoreUploads.push(record);
    return record;
  },

  removePresentationUpload(toolId, projectId, uploadId) {
    const project = this.getPresentationProject(toolId, projectId);
    if (project) project.scoreUploads = project.scoreUploads.filter((u) => u.id !== uploadId);
  },

  presentationUploads(toolId, projectId, kind) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return [];
    return project.scoreUploads.filter((u) => !kind || u.kind === kind);
  },

  /** The course-roster student whose School ID matches `value` (spacing/full-width differences ignored), or null — which is also how an actual name (a teacher, say) is told apart from a student's ID. */
  studentBySchoolId(value) {
    const key = this._matchKey(value);
    if (!key || String(value).startsWith("#")) return null;
    const students = (window.RosterModule && window.RosterModule.students) || [];
    return students.find((s) => this._matchKey(s.schoolId) === key) || null;
  },

  /** An upload's scores with the ones that must not count taken out: a student's score for their own group (group taken from the project's roster snapshot). Returns { counted, excluded } (excluded is how many were left out). Teacher/audience uploads. */
  presentationCountedScores(toolId, projectId, upload) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return { counted: [], excluded: 0 };
    const groupOf = new Map(project.roster.map((e) => [e.studentId, e.group]));
    const counted = [];
    let excluded = 0;
    upload.scores.forEach((record) => {
      const [respondentKey, group] = record;
      const student = this.studentBySchoolId(respondentKey);
      if (student && groupOf.get(student.id) === group) excluded++;
      else counted.push(record);
    });
    return { counted, excluded };
  },

  /** A peer upload's ratings with self-ratings taken out (a student's rating of themselves). Returns { counted, excluded }. */
  presentationCountedRatings(upload) {
    const counted = [];
    let excluded = 0;
    upload.ratings.forEach((record) => {
      const [raterKey, studentId] = record;
      const rater = this.studentBySchoolId(raterKey);
      if (rater && rater.id === studentId) excluded++;
      else counted.push(record);
    });
    return { counted, excluded };
  },

  /** Average of uploaded scores per "group|entryId" across every upload of one kind (teacher/audience), as { key: { group, entryId, avg, count } }. */
  presentationSheetAverages(toolId, projectId, kind) {
    const latest = new Map();
    this.presentationUploads(toolId, projectId, kind).forEach((upload) => {
      this.presentationCountedScores(toolId, projectId, upload).counted.forEach(([respondentKey, group, entryId, value]) => {
        latest.set(`${respondentKey}|${group}|${entryId}`, { group, entryId, value });
      });
    });
    const totals = {};
    latest.forEach(({ group, entryId, value }) => {
      const key = `${group}|${entryId}`;
      if (!totals[key]) totals[key] = { group, entryId, sum: 0, count: 0 };
      totals[key].sum += value;
      totals[key].count += 1;
    });
    Object.values(totals).forEach((t) => {
      t.avg = t.sum / t.count;
    });
    return totals;
  },

  /** Fills the Scores grid's cells for one kind (teacher/audience) with the averages from the uploaded sheets, limited to each rubric's points. Returns { applied, clamped }. */
  presApplySheetAverages(toolId, projectId, kind) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return { applied: 0, clamped: 0 };
    const columns = this.presentationColumns(toolId, projectId).filter((c) => c.kind === kind);
    const groups = new Set(this.presentationGroups(toolId, projectId));
    let applied = 0;
    let clamped = 0;
    Object.entries(this.presentationSheetAverages(toolId, projectId, kind)).forEach(([key, stat]) => {
      const column = columns.find((c) => c.entryId === stat.entryId);
      if (!column || !groups.has(stat.group)) return;
      let value = stat.avg;
      if (value < 0) value = 0;
      if (column.points > 0 && value > column.points) {
        value = column.points;
        clamped++;
      }
      project.values[key] = String(Math.round(value * 100) / 100);
      applied++;
    });
    return { applied, clamped };
  },

  /** Fills the Peer Evaluation column: for each group, the average of its members' average peer ratings (self-ratings excluded), limited to the project's highest peer score. Returns { applied, clamped }. */
  presApplyPeerAverages(toolId, projectId) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return { applied: 0, clamped: 0 };
    const averages = this.presentationPeerAverages(toolId, projectId);
    const highest = project.templateSettings.peerHighestScore;
    let applied = 0;
    let clamped = 0;
    this.presentationGroups(toolId, projectId).forEach((group) => {
      const memberAverages = project.roster
        .filter((entry) => entry.group === group && averages[entry.studentId])
        .map((entry) => averages[entry.studentId].avg);
      if (memberAverages.length === 0) return;
      let value = memberAverages.reduce((sum, v) => sum + v, 0) / memberAverages.length;
      if (value < 0) value = 0;
      if (value > highest) {
        value = highest;
        clamped++;
      }
      project.values[`${group}|peer`] = String(Math.round(value * 100) / 100);
      applied++;
    });
    return { applied, clamped };
  },

  /** Average peer rating received by each student across every peer upload, as { studentId: { avg, count } }. */
  presentationPeerAverages(toolId, projectId) {
    const latest = new Map();
    this.presentationUploads(toolId, projectId, "peer").forEach((upload) => {
      this.presentationCountedRatings(upload).counted.forEach(([raterKey, studentId, value]) => {
        latest.set(`${raterKey}|${studentId}`, { studentId, value });
      });
    });
    const totals = {};
    latest.forEach(({ studentId, value }) => {
      if (!totals[studentId]) totals[studentId] = { sum: 0, count: 0 };
      totals[studentId].sum += value;
      totals[studentId].count += 1;
    });
    Object.values(totals).forEach((t) => {
      t.avg = t.sum / t.count;
    });
    return totals;
  },

  // ----- Presentation Calc: data for the printed reports -----

  /** Comments from the uploaded Teacher and Audience sheets, organized for printing:
   *  { global: { teacher: [text], audience: [text] }, groups: { [group]: { teacher: [text], audience: [text] } } }.
   *  If a respondent appears in more than one upload, their latest comment for that group wins. */
  presentationComments(toolId, projectId) {
    const result = { global: { teacher: [], audience: [] }, groups: {} };
    ["teacher", "audience"].forEach((kind) => {
      const latest = new Map();
      this.presentationUploads(toolId, projectId, kind).forEach((upload) => {
        upload.comments.forEach(([respondentKey, group, text]) => {
          latest.set(`${respondentKey}|${group}`, { group, text });
        });
      });
      latest.forEach(({ group, text }) => {
        if (!group) {
          result.global[kind].push(text);
        } else {
          if (!result.groups[group]) result.groups[group] = { teacher: [], audience: [] };
          result.groups[group][kind].push(text);
        }
      });
    });
    return result;
  },

  /**
   * The score table for one printed page. Pass { group } for a group's
   * page, or { studentId } for one student's page. Returns
   * { rows: [{ label, score, max, classAverage, isTotal }] }: one row per
   * score column (Teacher / Audience rubrics, then Peer Evaluation) and a
   * final weighted Total row. `score` is the group's entered score for
   * that rubric; max is the rubric's points; classAverage averages the
   * score over every student in the class (each student counted with
   * their own group's score).
   * On a STUDENT page the Peer Evaluation row (and so the Total) is that
   * student's own average peer rating (self-ratings excluded) — falling
   * back to their group's Peer Evaluation cell if they have none — so
   * students in the same group can differ. On a GROUP page it is the
   * group's Peer Evaluation cell.
   */
  presentationScoreRows(toolId, projectId, { group, studentId }) {
    const project = this.getPresentationProject(toolId, projectId);
    if (!project) return { rows: [] };
    const columns = this.presentationColumns(toolId, projectId);
    const roster = project.roster.filter((e) => e.group);
    const peerAverages = this.presentationPeerAverages(toolId, projectId);
    const perStudentPeer = !!studentId;

    const groupValue = (g, col) => {
      const raw = project.values[`${g}|${col.entryId}`];
      if (raw === undefined) return null;
      const num = Number(raw);
      return Number.isNaN(num) ? null : num;
    };
    const scoreFor = (entry, col) => {
      if (col.kind === "peer" && perStudentPeer) {
        const mine = peerAverages[entry.studentId];
        if (mine) return mine.avg;
      }
      return groupValue(entry.group, col);
    };
    const totalFor = (entry) => this._weightedTotal(columns, (col) => scoreFor(entry, col)).total;
    const average = (values) => {
      const present = values.filter((v) => v !== null);
      return present.length > 0 ? present.reduce((sum, v) => sum + v, 0) / present.length : null;
    };

    const target = studentId ? roster.find((e) => e.studentId === studentId) : { group };
    if (!target) return { rows: [] };

    const rows = columns.map((col) => ({
      label: col.label,
      score: scoreFor(target, col),
      max: col.points,
      classAverage: average(roster.map((entry) => scoreFor(entry, col))),
      isTotal: false,
    }));
    rows.push({
      label: "Total (weighted)",
      score: totalFor(target),
      max: this._weightedTotal(columns, () => null).max,
      classAverage: average(roster.map((entry) => totalFor(entry))),
      isTotal: true,
    });
    return { rows };
  },

  /** A student's contribution from one project: their group's Total Score (group taken from that project's imported roster snapshot). Null if they aren't in the snapshot or have no group. */
  _presentationContribution(tool, studentId, projectId) {
    const project = this.getPresentationProject(tool.id, projectId);
    if (!project) return null;
    const entry = project.roster.find((e) => e.studentId === studentId);
    if (!entry || !entry.group) return null;
    const sum = this.computePresentationSum(tool.id, projectId, entry.group);
    if (sum === null) return null;
    return this._totalContribution(project, sum);
  },

  // ----- Test & Quiz Bank tool (type "testbank") -----
  // tool.config: { tests: [{ id, name, maxPoints, sourceFile, rows,
  // scores, unmatched }] }.
  //   rows: what was read from the uploaded file — [{ name, schoolId,
  //     score }], kept so students can be re-matched later (e.g. after
  //     the roster changes).
  //   scores: studentId -> score (numeric string), built by matching
  //     rows to the current roster — School ID first, then name.
  //   unmatched: rows that matched no one on the roster.
  //   maxPoints: optional. When set, a score pulled into a Main Scores
  //     item is scaled to that item's own points (score ÷ maxPoints ×
  //     item max); when 0/blank, the score is used as-is.
  // Which test an item pulls from is stored on the item itself
  // (scoreSources.testSelections[toolId]) — see getItemScoreSources.

  getTestBankConfig(toolId) {
    const tool = this.findTool(toolId);
    if (!tool) return null;
    if (!tool.config || typeof tool.config !== "object") tool.config = {};
    const cfg = tool.config;
    if (!Array.isArray(cfg.tests)) cfg.tests = [];
    cfg.tests.forEach((test) => {
      if (!Array.isArray(test.rows)) test.rows = [];
      if (!test.scores || typeof test.scores !== "object") test.scores = {};
      if (!Array.isArray(test.unmatched)) test.unmatched = [];
      if (typeof test.maxPoints !== "number") test.maxPoints = 0;
      if (typeof test.sourceFile !== "string") test.sourceFile = "";
    });
    return cfg;
  },

  testBankTests(toolId) {
    const cfg = this.getTestBankConfig(toolId);
    return cfg ? cfg.tests : [];
  },

  findTest(toolId, testId) {
    return this.testBankTests(toolId).find((t) => t.id === testId) || null;
  },

  /** Text used to compare a file's name/ID against the roster: full-width/half-width forms unified, spaces removed, case ignored. */
  _matchKey(value) {
    return String(value == null ? "" : value)
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
  },

  /** Rebuilds test.scores / test.unmatched from test.rows against the current roster. School ID is tried first (when the row has one), then name. */
  _matchTestRows(test) {
    const students = (window.RosterModule && window.RosterModule.students) || [];
    const byId = new Map();
    const byName = new Map();
    students.forEach((s) => {
      const idKey = this._matchKey(s.schoolId);
      if (idKey && !byId.has(idKey)) byId.set(idKey, s);
      const nameKey = this._matchKey(s.name);
      if (nameKey && !byName.has(nameKey)) byName.set(nameKey, s);
    });

    test.scores = {};
    test.unmatched = [];
    test.rows.forEach((row) => {
      let student = null;
      const idKey = this._matchKey(row.schoolId);
      if (idKey) student = byId.get(idKey) || null;
      if (!student) {
        const nameKey = this._matchKey(row.name);
        if (nameKey) student = byName.get(nameKey) || null;
      }
      if (student) test.scores[student.id] = row.score;
      else test.unmatched.push({ name: row.name, schoolId: row.schoolId, score: row.score });
    });
  },

  /** Adds a test/quiz built from rows [{ name, schoolId, score }] and matches it to the roster. */
  addTest(toolId, { name, maxPoints, rows, sourceFile }) {
    const cfg = this.getTestBankConfig(toolId);
    if (!cfg) throw new Error("That Test & Quiz Bank no longer exists.");
    if (cfg.tests.length >= MAX_TESTS_PER_BANK) {
      throw new Error(`This bank is at its limit of ${MAX_TESTS_PER_BANK} tests/quizzes.`);
    }
    const test = {
      id: `test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: (name || "").trim() || "Untitled test",
      maxPoints: Math.max(0, Number(maxPoints) || 0),
      sourceFile: sourceFile || "",
      rows,
      scores: {},
      unmatched: [],
    };
    this._matchTestRows(test);
    cfg.tests.push(test);
    return test;
  },

  renameTest(toolId, testId, name) {
    const test = this.findTest(toolId, testId);
    if (test) test.name = (name || "").trim() || test.name;
  },

  setTestMaxPoints(toolId, testId, value) {
    const test = this.findTest(toolId, testId);
    if (test) test.maxPoints = Math.max(0, Number(value) || 0);
  },

  rematchTest(toolId, testId) {
    const test = this.findTest(toolId, testId);
    if (test) this._matchTestRows(test);
  },

  /** Removes a test/quiz, and clears it from any item that was pulling from it. */
  removeTest(toolId, testId) {
    const cfg = this.getTestBankConfig(toolId);
    if (!cfg) return;
    cfg.tests = cfg.tests.filter((t) => t.id !== testId);
    this._clearTableTestSources(toolId, testId);
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        const selections = item.scoreSources && item.scoreSources.testSelections;
        if (selections && selections[toolId] === testId) delete selections[toolId];
      });
    });
  },

  /** One student's score on one test/quiz as a number, or null if they have none. */
  testScore(toolId, testId, studentId) {
    const test = this.findTest(toolId, testId);
    if (!test) return null;
    const raw = test.scores[studentId];
    if (raw === undefined || raw === "") return null;
    const num = Number(raw);
    return Number.isNaN(num) ? null : num;
  },

  /** Sets which test/quiz an item pulls from for a Test & Quiz Bank ("" clears it). */
  setItemTestSelection(itemId, toolId, testId) {
    const sources = this.getItemScoreSources(itemId);
    if (testId) sources.testSelections[toolId] = testId;
    else delete sources.testSelections[toolId];
  },

  /** Sets which project an item pulls from for a Presentation Calc ("" clears it). */
  setItemProjectSelection(itemId, toolId, projectId) {
    const sources = this.getItemScoreSources(itemId);
    if (projectId) sources.projectSelections[toolId] = projectId;
    else delete sources.projectSelections[toolId];
  },

  /** Attendance's contribution, in the same { earned, possible, percent } shape as categoryScore, so it can be rendered as a column alongside the other categories. Points mode uses AttendanceModule's raw points instead of possible/earned. */
  attendanceScore(studentId) {
    if (!window.AttendanceModule) return { earned: 0, possible: 0, percent: null, points: null };
    const stats = window.AttendanceModule.stats(studentId);
    return { earned: null, possible: null, percent: stats.percent, points: stats.points };
  },

  // ----- Item Score Sources -----
  // Each item can optionally draw part (or all) of its grade from
  // Scoring Tools instead of purely manual entry. item.scoreSources =
  // { manualWeight, toolWeights: { toolId: weight } }. manualWeight
  // defaults to 100 so an item behaves exactly as before until this
  // is actually configured. A tool with weight 0 (the default for
  // every tool) contributes nothing; any other weight brings it into
  // the weighted blend computed by computeItemEffectiveScore.

  /** Returns item.scoreSources, creating/normalizing it in place first. */
  getItemScoreSources(itemId) {
    const item = this.findItem(itemId);
    if (!item) return { manualWeight: 100, toolWeights: {}, testSelections: {}, projectSelections: {} };
    if (!item.scoreSources || typeof item.scoreSources !== "object") {
      item.scoreSources = {};
    }
    if (typeof item.scoreSources.manualWeight !== "number") item.scoreSources.manualWeight = 100;
    if (!item.scoreSources.toolWeights || typeof item.scoreSources.toolWeights !== "object") {
      item.scoreSources.toolWeights = {};
    }
    // Which project to pull from, for each Presentation Calc tool: { toolId: projectId }.
    if (!item.scoreSources.projectSelections || typeof item.scoreSources.projectSelections !== "object") {
      item.scoreSources.projectSelections = {};
    }
    // Which test/quiz to pull from, for each Test & Quiz Bank tool: { toolId: testId }.
    if (!item.scoreSources.testSelections || typeof item.scoreSources.testSelections !== "object") {
      item.scoreSources.testSelections = {};
    }
    return item.scoreSources;
  },

  setItemManualWeight(itemId, weight) {
    const sources = this.getItemScoreSources(itemId);
    sources.manualWeight = Math.max(0, Number(weight) || 0);
  },

  setItemToolWeight(itemId, toolId, weight) {
    const sources = this.getItemScoreSources(itemId);
    const n = Math.max(0, Number(weight) || 0);
    if (n === 0) delete sources.toolWeights[toolId];
    else sources.toolWeights[toolId] = n;
  },

  /** The current Seating Chart's group number for a student (from the live chart, not a memory bank), or null if they're unseated or at an ungrouped desk. */
  _studentGroupNumber(studentId) {
    if (!window.SeatingModule) return null;
    const seats = window.SeatingModule.seats || {};
    const key = Object.keys(seats).find((k) => seats[k] === studentId);
    if (!key) return null;
    const [r, c] = key.split("-").map(Number);
    return window.SeatingModule.getGroup(r, c) || null;
  },

  /**
   * What one Scoring Tool contributes for one student: that tracker's
   * fixed Total Score. The student's identity row is found directly —
   * by their own id in "students" mode, or by their current Seating
   * Chart group number in "groups" mode — since rows are always kept
   * in sync with the roster/seating chart (see getTableIdentityRows),
   * so there's no name-matching to go stale. Returns null if the tool
   * isn't a Progress Tracker, has no columns, the Total Score is in
   * "max" mode with no maximum set, or the student isn't seated/grouped
   * (in "groups" mode). Otherwise { raw: true, value } — the plain sum
   * in "raw" mode, or the percentage × 100 in "max" mode — used as-is
   * (so an item fed this way should have a max of 100 to line up).
   */
  _toolContributionForStudent(tool, studentId) {
    if (tool.type === "presentation") return null; // handled in computeItemEffectiveScore (needs the chosen project)
    if (tool.type !== "table") return null;
    const cfg = this.getTableConfig(tool.id);
    if (!cfg) return null;

    let rowKey;
    if (cfg.firstColumn.mode === "groups") {
      const groupNumber = this._studentGroupNumber(studentId);
      if (!groupNumber) return null;
      rowKey = String(groupNumber);
    } else {
      rowKey = studentId;
    }

    const sum = this.computeTableScoreSum(tool.id, rowKey);
    if (sum === null) return null;

    // "Out of a max" mode sends the percentage × 100 (e.g. 17 out of 20
    // → 85), which then goes through the item's Score Sources weights
    // like any other contribution. Raw mode sends the plain sum.
    return this._totalContribution(
      { totalColumn: { mode: cfg.mode === "max" ? "max" : "raw", maxPoints: this.tableMaxTotal(tool.id) } },
      sum
    );
  },

  /**
   * The score actually used for grading one student on one item — a
   * weighted blend of the manual entry and any Scoring Tools weighted
   * above 0 in that item's Score Sources, all expressed on the item's
   * own 0-maxPoints scale (a tool's Total Score is used as-is). With
   * every tool at weight 0 (the default), this is exactly the manual
   * entry — nothing changes unless Score Sources are actually set up.
   * Returns null when nothing usable is available (same meaning as a
   * blank manual entry). The caller is responsible for handling "E"
   * (exempt) before reaching this — it isn't a Score Sources concept.
   */
  itemSourceBreakdown(studentId, item) {
    const sourcesCfg = this.getItemScoreSources(item.id);
    const sources = []; // { weight, points } — points are on the item's own 0-maxPoints scale
    let configuredWeight = 0; // every source with a weight above 0, whether or not it has a score yet

    if (sourcesCfg.manualWeight > 0) {
      configuredWeight += sourcesCfg.manualWeight;
      const rec = this.getRecord(studentId, item.id);
      if (rec !== "" && rec !== "E") {
        sources.push({ key: "manual", label: "Manual", weight: sourcesCfg.manualWeight, points: Number(rec) });
      }
    }

    Object.entries(sourcesCfg.toolWeights).forEach(([toolId, weight]) => {
      if (!(weight > 0)) return;
      configuredWeight += weight;
      const tool = this.findTool(toolId);
      if (!tool) return;
      const label = tool.name;
      if (tool.type === "testbank") {
        // A Test & Quiz Bank contributes one chosen test/quiz's score. If
        // the test has a maximum, the score is scaled to this item's own
        // points; otherwise it's used as-is.
        const testId = sourcesCfg.testSelections[toolId];
        const test = testId ? this.findTest(toolId, testId) : null;
        const value = test ? this.testScore(toolId, testId, studentId) : null;
        if (value === null) return;
        const testPoints = test.maxPoints > 0 ? (value / test.maxPoints) * item.maxPoints : value;
        sources.push({ key: toolId, label, weight, points: testPoints });
        return;
      }
      if (tool.type === "presentation") {
        const projectId = sourcesCfg.projectSelections[toolId];
        const project = projectId ? this.getPresentationProject(toolId, projectId) : null;
        const entry = project && project.roster.find((e) => e.studentId === studentId);
        if (!entry || !entry.group) return;
        const sum = this.computePresentationSum(toolId, projectId, entry.group);
        if (sum === null) return;
        const pPoints = this._scaleToItem(sum, project.totalColumn, item);
        if (pPoints === null) return;
        sources.push({ key: toolId, label, weight, points: pPoints });
        return;
      }
      const sum = this._trackerSumForStudent(tool, studentId);
      if (sum === null) return;
      const cfg = this.getTableConfig(tool.id);
      const points = this._scaleToItem(sum, { mode: cfg.mode === "max" ? "max" : "raw", maxPoints: this.tableMaxTotal(tool.id) }, item);
      if (points === null) return;
      sources.push({ key: toolId, label, weight, points });
    });

    sources.forEach((src) => {
      src.contribution = (src.points * src.weight) / 100; // points × its percentage
    });
    return { sources, configuredWeight };
  },

  /** The composite score for one student on one item: every source's points × its percentage, added together. Percentages are NOT capped — two sources at 100% give 200% of the score. Null when no source has a score yet. */
  computeItemEffectiveScore(studentId, item) {
    const { sources } = this.itemSourceBreakdown(studentId, item);
    if (sources.length === 0) return null;
    return sources.reduce((sum, src) => sum + src.contribution, 0);
  },

  /** A scoring tool's total, rescaled to the item: sum ÷ tool maximum × item maximum (so a perfect tool score = the item's full points). A tool with no maximum set (plain "raw" mode) is used as-is. Returns null if "max" mode has no maximum yet. */
  _scaleToItem(sum, totalCfg, item) {
    const max = Number(totalCfg && totalCfg.maxPoints) || 0;
    if (totalCfg && totalCfg.mode === "max") {
      if (!(max > 0)) return null;
      return (sum / max) * item.maxPoints;
    }
    return sum;
  },

  /** A Progress Tracker's Total Score for one student (or their group), or null if unavailable. */
  _trackerSumForStudent(tool, studentId) {
    if (tool.type !== "table") return null;
    const cfg = this.getTableConfig(tool.id);
    if (!cfg) return null;
    let rowKey;
    if (cfg.firstColumn.mode === "groups") {
      const groupNumber = this._studentGroupNumber(studentId);
      if (!groupNumber) return null;
      rowKey = String(groupNumber);
    } else {
      rowKey = studentId;
    }
    return this.computeTableScoreSum(tool.id, rowKey);
  },

  // ----- Scores -----

  /** { earned, possible, percent } for one student in one category. Exempt items are excluded from both earned and possible; everything else runs through computeItemEffectiveScore, so a blended Score Sources result feeds in exactly like a plain manual entry would. */
  categoryScore(studentId, categoryId) {
    const category = this.findCategory(categoryId);
    if (!category) return { earned: 0, possible: 0, percent: null };

    let earned = 0;
    let possible = 0;
    category.items.forEach((item) => {
      const rec = this.getRecord(studentId, item.id);
      if (rec === "E") return;
      const effective = this.computeItemEffectiveScore(studentId, item);
      if (effective === null) return;
      earned += effective;
      possible += item.maxPoints;
    });

    return { earned, possible, percent: possible > 0 ? Math.round((earned / possible) * 100) : null };
  },

  /** Raw Points: accumulated points earned / the maximum possible. Possible = the max points of EVERY non-exempt item in every category (Scoring Settings) plus Attendance's possible points; earned = what the student has so far (blended Score Sources included) plus Attendance's earned points. */
  rawPointsSummary(studentId) {
    const r2 = (n) => Math.round(n * 100) / 100;
    let itemsEarned = 0;
    let itemsPossible = 0;
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        if (this.getRecord(studentId, item.id) === "E") return;
        itemsPossible += Number(item.maxPoints) || 0;
        const effective = this.computeItemEffectiveScore(studentId, item);
        if (effective !== null) itemsEarned += effective;
      });
    });
    const att = window.AttendanceModule ? window.AttendanceModule.rawPoints(studentId) : { earned: 0, possible: 0 };
    const earned = r2(itemsEarned + att.earned);
    const possible = r2(itemsPossible + att.possible);
    return {
      earned,
      possible,
      percent: possible > 0 ? (earned / possible) * 100 : null,
      items: { earned: r2(itemsEarned), possible: r2(itemsPossible) },
      attendance: att,
    };
  },

  /** Earned raw points (items + Attendance). */
  totalRawPoints(studentId) {
    return this.rawPointsSummary(studentId).earned;
  },

  /** The weighted average percent (0-100) across categories plus Attendance, normalized by the sum of weights actually entered — "how well are they doing, relative to what's been weighted so far." Used for the secondary percentage shown under Total Score/Attendance, and by Student Consultation's own Percent mode. */
  weightedPercent(studentId) {
    let weightedSum = 0;
    let weightTotal = 0;

    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        const weight = Number(item.weight) || 0;
        if (weight <= 0 || !(item.maxPoints > 0)) return;
        if (this.getRecord(studentId, item.id) === "E") return;
        const effective = this.computeItemEffectiveScore(studentId, item);
        if (effective === null) return; // nothing recorded yet — excluded, not zeroed
        weightedSum += (effective / item.maxPoints) * 100 * weight;
        weightTotal += weight;
      });
    });

    const attendanceWeight = this.weights.attendance || 0;
    if (attendanceWeight > 0 && window.AttendanceModule) {
      const attendancePercent = window.AttendanceModule.stats(studentId).percent;
      if (attendancePercent !== null) {
        weightedSum += attendancePercent * attendanceWeight;
        weightTotal += attendanceWeight;
      }
    }

    return weightTotal > 0 ? weightedSum / weightTotal : null;
  },

  /**
   * The actual Total Score, in points: each item's score (as a 0-1
   * fraction of its max) times the item's own weight, summed with
   * Attendance's the same way — NOT normalized by the sum of weights, unlike
   * weightedPercent. So with weights set to sum to 100 (the Scoring
   * Settings weight-total box turns green there), a perfect score in
   * everything gives exactly 100 points. A category or Attendance
   * with nothing recorded yet is skipped (contributes nothing, same
   * as elsewhere) rather than counted as zero, so a partially-graded
   * student shows a partial total rather than being penalized for
   * ungraded work. Returns null only if nothing anywhere has been
   * graded yet.
   */
  totalPoints(studentId) {
    let total = 0;
    let any = false;

    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        const weight = Number(item.weight) || 0;
        if (weight <= 0 || !(item.maxPoints > 0)) return;
        if (this.getRecord(studentId, item.id) === "E") return;
        const effective = this.computeItemEffectiveScore(studentId, item);
        if (effective === null) return;
        total += (effective / item.maxPoints) * weight; // item score as a fraction × the item's weight
        any = true;
      });
    });

    const attendanceWeight = this.weights.attendance || 0;
    if (attendanceWeight > 0 && window.AttendanceModule) {
      const attendancePercent = window.AttendanceModule.stats(studentId).percent;
      if (attendancePercent !== null) {
        total += (attendancePercent / 100) * attendanceWeight;
        any = true;
      }
    }

    return any ? Math.round(total * 10) / 10 : null;
  },
};

window.ScoringModule = ScoringModule;
