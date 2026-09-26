// ===== Scoring module =====
// One file per course: scoring-<courseId>.json
//
// - categories: exactly 10 fixed slots (like the seating chart's 6
//   memory banks — always present, renamable, not addable/removable).
//   Each has { id, name, items }. The number of items is a count
//   setting (like Attendance's term class count), not an "add item"
//   button — set it and that many item-columns appear.
// - items: { id, name, maxPoints }.
// - records: sparse map "studentId|itemId" -> "" (blank), "E"
//   (exempt), or a numeric string (points earned, 0-maxPoints).
// - weights: percentage weight per category id, plus one for
//   "attendance" — pulled from AttendanceModule's percent score
//   rather than stored here.
// - tools: extra tabs alongside "Main Scores" (the score-entry screen
//   above), added/removed from Main Scores' own Settings. Each is
//   { id, type, name } — `type` picks which scoring tool it is (only
//   "table" exists so far, and it isn't wired to anything yet), and
//   `name` is a display label, auto-numbered when more than one of
//   the same type exists (e.g. "Table", "Table 2"). A tool's own
//   settings/content live in its own tab, not here.

const MAX_CATEGORIES = 10; // a cap, not a fixed starting count — add categories as needed
const MAX_ITEMS_PER_CATEGORY = 50;
const MAX_SCORING_TOOLS = 10;
const MAX_TABLE_ROWS = 50;
const MAX_TABLE_SUBROWS = 20;
const MAX_TABLE_COLUMNS = 20;

// A column's type. "score" is a plain enterable number; the three
// "total_score_*" types are read-only and computed from that line's
// "score" columns — raw sum, sum shown out of a set total ("points"),
// or that sum as a percentage of a set total ("percentage"). The
// points/percentage variants use column.maxPoints as their total.
const TABLE_COLUMN_TYPES = [
  "description",
  "score",
  "total_score_raw",
  "total_score_points",
  "total_score_percentage",
];

// The set of scoring tool types that can be added from Main Scores'
// Settings. Add a new entry here (and a matching renderer in app.js)
// to offer a new kind of tool.
const SCORING_TOOL_TYPES = {
  table: "Table",
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
  scoreDisplayMode: "percent", // "percent" or "points" — for the Total Score column
  attendanceDisplayMode: "percent", // "percent" or "points" — for the Attendance column
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
      this.scoreDisplayMode = data.scoreDisplayMode === "points" ? "points" : "percent";
      this.attendanceDisplayMode = data.attendanceDisplayMode === "points" ? "points" : "percent";
    } else {
      this.categories = [];
      this.records = {};
      this.weights = { attendance: 0 };
      this.tools = [];
      this.scoreDisplayMode = "percent";
      this.attendanceDisplayMode = "percent";
    }
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      categories: this.categories,
      records: this.records,
      weights: this.weights,
      tools: this.tools,
      scoreDisplayMode: this.scoreDisplayMode,
      attendanceDisplayMode: this.attendanceDisplayMode,
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

  setScoreDisplayMode(mode) {
    this.scoreDisplayMode = mode === "points" ? "points" : "percent";
  },

  setAttendanceDisplayMode(mode) {
    this.attendanceDisplayMode = mode === "points" ? "points" : "percent";
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
  },

  renameTool(toolId, name) {
    const tool = this.findTool(toolId);
    if (tool) tool.name = (name || "").trim() || tool.name;
  },

  findTool(toolId) {
    return this.tools.find((t) => t.id === toolId) || null;
  },

  // ----- Table tool config -----
  // tool.config for a "table"-type tool: { firstColumn: { name, mode },
  // rows: [{ id, name, subrows: [{ id, name }] }], columns: [{ id,
  // name, type, labeled, maxPoints }] }. firstColumn.mode is
  // "students" or "groups" and has no `type` of its own — it's a
  // separate toggle, not one of the column types below. columns[].type
  // is one of TABLE_COLUMN_TYPES: "description", "score" (a plain
  // enterable number), or one of the three read-only "total_score_*"
  // types, each summing that line's "score" columns — raw, out of
  // maxPoints ("points"), or as a percentage of maxPoints
  // ("percentage"). `labeled` is true once a user has renamed a
  // column, at which point its type no longer shows next to its name
  // in the header. Nothing here is wired to real data yet — this only
  // defines the Table's shape.

  /** Returns tool.config for a table tool, creating/normalizing it (and any missing pieces) in place first. Returns null if the tool doesn't exist. */
  getTableConfig(toolId) {
    const tool = this.findTool(toolId);
    if (!tool) return null;
    if (!tool.config || typeof tool.config !== "object") tool.config = {};
    const cfg = tool.config;

    if (!cfg.firstColumn || typeof cfg.firstColumn !== "object") cfg.firstColumn = {};
    if (cfg.firstColumn.mode !== "groups" && cfg.firstColumn.mode !== "students") {
      cfg.firstColumn.mode = "students";
    }
    if (typeof cfg.firstColumn.name !== "string" || !cfg.firstColumn.name.trim()) {
      cfg.firstColumn.name = cfg.firstColumn.mode === "groups" ? "Group" : "Student";
    }

    if (!Array.isArray(cfg.rows)) cfg.rows = [];
    cfg.rows.forEach((row) => {
      if (!Array.isArray(row.subrows)) row.subrows = [];
    });

    if (!Array.isArray(cfg.columns)) cfg.columns = [];
    cfg.columns.forEach((column, i) => {
      if (column.type === "cum_score") column.type = "total_score_raw"; // legacy type key
      if (!TABLE_COLUMN_TYPES.includes(column.type)) column.type = "description";
      if (typeof column.labeled !== "boolean") {
        // Data saved before the "labeled" flag existed — best guess:
        // if the name isn't the auto-generated default for this slot,
        // a user must have already set it, so don't show the type hint.
        column.labeled = column.name !== `Column ${i + 1}`;
      }
      if (typeof column.maxPoints !== "number") column.maxPoints = 0;
    });

    if (!cfg.values || typeof cfg.values !== "object") cfg.values = {};

    return cfg;
  },

  setTableFirstColumnMode(toolId, mode) {
    const cfg = this.getTableConfig(toolId);
    if (cfg) cfg.firstColumn.mode = mode === "groups" ? "groups" : "students";
  },

  setTableFirstColumnName(toolId, name) {
    const cfg = this.getTableConfig(toolId);
    if (cfg) cfg.firstColumn.name = (name || "").trim() || cfg.firstColumn.name;
  },

  /** Sets the row count, adding default-named trailing rows or trimming from the end. */
  setTableRowCount(toolId, count) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return;
    count = Math.max(0, Math.min(MAX_TABLE_ROWS, Math.round(Number(count) || 0)));
    if (count > cfg.rows.length) {
      while (cfg.rows.length < count) {
        const n = cfg.rows.length + 1;
        cfg.rows.push({
          id: `row-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: `Row ${n}`,
          subrows: [],
        });
      }
    } else if (count < cfg.rows.length) {
      const removed = cfg.rows.slice(count);
      const lineIds = new Set();
      removed.forEach((r) => {
        if (r.subrows.length === 0) lineIds.add(r.id);
        else r.subrows.forEach((s) => lineIds.add(s.id));
      });
      cfg.rows = cfg.rows.slice(0, count);
      this._purgeTableValues(cfg, { lineIds });
    }
  },

  setTableRowName(toolId, rowId, name) {
    const cfg = this.getTableConfig(toolId);
    const row = cfg && cfg.rows.find((r) => r.id === rowId);
    if (row) row.name = (name || "").trim() || row.name;
  },

  /** Sets one row's subrow count, adding default-named trailing subrows or trimming from the end. */
  setTableSubrowCount(toolId, rowId, count) {
    const cfg = this.getTableConfig(toolId);
    const row = cfg && cfg.rows.find((r) => r.id === rowId);
    if (!row) return;
    count = Math.max(0, Math.min(MAX_TABLE_SUBROWS, Math.round(Number(count) || 0)));
    if (count > row.subrows.length) {
      while (row.subrows.length < count) {
        const n = row.subrows.length + 1;
        row.subrows.push({
          id: `subrow-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          name: `Subrow ${n}`,
        });
      }
    } else if (count < row.subrows.length) {
      const removed = row.subrows.slice(count);
      const lineIds = new Set(removed.map((s) => s.id));
      row.subrows = row.subrows.slice(0, count);
      this._purgeTableValues(cfg, { lineIds });
    }
  },

  setTableSubrowName(toolId, rowId, subrowId, name) {
    const cfg = this.getTableConfig(toolId);
    const row = cfg && cfg.rows.find((r) => r.id === rowId);
    const subrow = row && row.subrows.find((s) => s.id === subrowId);
    if (subrow) subrow.name = (name || "").trim() || subrow.name;
  },

  /** Sets the column count (not including the first column), adding default-named/typed trailing columns or trimming from the end. */
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
          type: "description",
          labeled: false,
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
    // Once a user has set a column's name, the type hint next to it
    // in the header goes away — the label itself is assumed to make
    // the column's purpose clear from here on.
    column.labeled = true;
  },

  setTableColumnType(toolId, columnId, type) {
    const cfg = this.getTableConfig(toolId);
    const column = cfg && cfg.columns.find((c) => c.id === columnId);
    if (!column) return;
    column.type = TABLE_COLUMN_TYPES.includes(type) ? type : "description";
  },

  /** The total possible score for a "total_score_points" or "total_score_percentage" column — unused by the other types. */
  setTableColumnMaxPoints(toolId, columnId, value) {
    const cfg = this.getTableConfig(toolId);
    const column = cfg && cfg.columns.find((c) => c.id === columnId);
    if (!column) return;
    column.maxPoints = Math.max(0, Number(value) || 0);
  },

  // ----- Table cell values -----
  // Keyed by "lineId|columnId", where lineId is a row's id (for a row
  // with no subrows) or a subrow's id (for one of a row's subrows) —
  // whichever the grid actually draws as its own line. The three
  // "total_score_*" columns store nothing here; they're computed from
  // the "score" columns on the same line.

  getTableValue(toolId, lineId, columnId) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return "";
    return cfg.values[`${lineId}|${columnId}`] || "";
  },

  setTableValue(toolId, lineId, columnId, value) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return;
    const key = `${lineId}|${columnId}`;
    const trimmed = value == null ? "" : String(value).trim();
    if (trimmed === "") delete cfg.values[key];
    else cfg.values[key] = trimmed;
  },

  /** Sum of every "score"-type column's value on this line, parsed as a number (blank/non-numeric entries count as 0 toward the sum). Returns null if the table has no score columns at all, so the caller can show "—" instead of a bare 0. Shared by all three "total_score_*" column types. */
  computeTableScoreSum(toolId, lineId) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return null;
    let hasScoreColumn = false;
    let sum = 0;
    cfg.columns.forEach((col) => {
      if (col.type !== "score") return;
      hasScoreColumn = true;
      const raw = cfg.values[`${lineId}|${col.id}`];
      const num = Number(raw);
      if (raw !== undefined && !Number.isNaN(num)) sum += num;
    });
    return hasScoreColumn ? sum : null;
  },

  /** Deletes any stored cell values whose lineId is in `lineIds` and/or whose columnId is in `columnIds` — called when rows, subrows, or columns are removed so their old values don't linger as orphaned data. */
  _purgeTableValues(cfg, { lineIds, columnIds } = {}) {
    if (!lineIds && !columnIds) return;
    Object.keys(cfg.values).forEach((key) => {
      const sepIndex = key.indexOf("|");
      const lineId = key.slice(0, sepIndex);
      const columnId = key.slice(sepIndex + 1);
      if ((lineIds && lineIds.has(lineId)) || (columnIds && columnIds.has(columnId))) {
        delete cfg.values[key];
      }
    });
  },

  /** Attendance's contribution, in the same { earned, possible, percent } shape as categoryScore, so it can be rendered as a column alongside the other categories. Points mode uses AttendanceModule's raw points instead of possible/earned. */
  attendanceScore(studentId) {
    if (!window.AttendanceModule) return { earned: 0, possible: 0, percent: null, points: null };
    const stats = window.AttendanceModule.stats(studentId);
    return { earned: null, possible: null, percent: stats.percent, points: stats.points };
  },

  // ----- Scores -----

  /** { earned, possible, percent } for one student in one category. Exempt items are excluded from both earned and possible. */
  categoryScore(studentId, categoryId) {
    const category = this.findCategory(categoryId);
    if (!category) return { earned: 0, possible: 0, percent: null };

    let earned = 0;
    let possible = 0;
    category.items.forEach((item) => {
      const rec = this.getRecord(studentId, item.id);
      if (rec === "" || rec === "E") return;
      earned += Number(rec);
      possible += item.maxPoints;
    });

    return { earned, possible, percent: possible > 0 ? Math.round((earned / possible) * 100) : null };
  },

  /** Raw sum of all earned points across all categories (excludes exempt and blank items). */
  totalRawPoints(studentId) {
    let total = 0;
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        const rec = this.getRecord(studentId, item.id);
        if (rec !== "" && rec !== "E") {
          total += Number(rec);
        }
      });
    });
    return total;
  },

  /** The weighted average percent (0-100) across categories plus Attendance, normalized by the sum of weights actually entered. Shared by both display modes below. */
  weightedPercent(studentId) {
    let weightedSum = 0;
    let weightTotal = 0;

    this.categories.forEach((category) => {
      const weight = this.weights[category.id] || 0;
      if (weight <= 0) return;
      const { percent } = this.categoryScore(studentId, category.id);
      if (percent === null) return; // nothing recorded yet in this category — excluded, not zeroed
      weightedSum += percent * weight;
      weightTotal += weight;
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

  /** Weighted total across the 10 categories plus Attendance. Percent mode returns the weighted percent (0-100, rounded); points mode returns that same weighted percent scaled ×100. */
  totalScore(studentId) {
    const percent = this.weightedPercent(studentId);
    if (percent === null) return null;
    return this.scoreDisplayMode === "points" ? Math.round(percent * 100) : Math.round(percent);
  },
};

window.ScoringModule = ScoringModule;
