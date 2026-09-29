// ===== Scoring module =====
// One file per course: scoring-<courseId>.json
//
// - categories: added as needed (up to MAX_CATEGORIES), renamable,
//   removable. Each has { id, name, items }. The number of items is a
//   count setting (like Attendance's term class count), not an "add
//   item" button — set it and that many item-columns appear.
// - items: { id, name, maxPoints }.
// - records: sparse map "studentId|itemId" -> "" (blank), "E"
//   (exempt), or a numeric string (points earned, 0-maxPoints).
// - weights: percentage weight per category id, plus one for
//   "attendance" — pulled from AttendanceModule's percent score
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

// A Progress Tracker column's type. "score" is a plain enterable
// number; "score_max" is also an enterable number but out of a set
// maximum (column.maxPoints), so it's limited to 0-max and shown as
// "/max" in its header. The last column of every Progress Tracker is
// always a fixed, read-only "Total Score" (the sum of that row's
// entries) — it isn't stored as a column, it's added automatically.
const TABLE_COLUMN_TYPES = ["score", "score_max"];

// The set of scoring tool types that can be added from Main Scores'
// Settings. Add a new entry here (and a matching renderer in app.js)
// to offer a new kind of tool. The key ("table") is what's saved in
// each course's data, so it stays as-is; only the label users see
// changed.
const SCORING_TOOL_TYPES = {
  table: "Progress Tracker",
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
    } else {
      this.categories = [];
      this.records = {};
      this.weights = { attendance: 0 };
      this.tools = [];
    }
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      categories: this.categories,
      records: this.records,
      weights: this.weights,
      tools: this.tools,
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
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        if (item.scoreSources && item.scoreSources.toolWeights) {
          delete item.scoreSources.toolWeights[toolId];
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

  /** The maximum for a "score_max" column — unused by "score" columns. */
  setTableColumnMaxPoints(toolId, columnId, value) {
    const cfg = this.getTableConfig(toolId);
    const column = cfg && cfg.columns.find((c) => c.id === columnId);
    if (!column) return;
    column.maxPoints = Math.max(0, Number(value) || 0);
  },

  // ----- Progress Tracker cell values -----
  // Keyed by "lineId|columnId", where lineId is an identity row's key
  // directly — a student id, or a group number as a string (see
  // getTableIdentityRows). The Total Score column stores nothing
  // here; it's computed from the other columns on the same line.

  getTableValue(toolId, lineId, columnId) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return "";
    return cfg.values[`${lineId}|${columnId}`] || "";
  },

  /** value: "" (blank) or a number. A "score_max" column also requires 0 up to its maximum (when a maximum is set). Throws on anything else. */
  setTableValue(toolId, lineId, columnId, value) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg) return;
    const column = cfg.columns.find((c) => c.id === columnId);
    const key = `${lineId}|${columnId}`;
    const trimmed = value == null ? "" : String(value).trim();

    if (trimmed === "") {
      delete cfg.values[key];
      return;
    }
    const num = Number(trimmed);
    if (Number.isNaN(num)) throw new Error("Enter a number.");
    if (column && column.type === "score_max") {
      if (num < 0 || (column.maxPoints > 0 && num > column.maxPoints)) {
        throw new Error(
          column.maxPoints > 0 ? `Enter a number from 0 to ${column.maxPoints}.` : "Enter a number of 0 or more."
        );
      }
    }
    cfg.values[key] = String(num);
  },

  /** The fixed Total Score for one line: the sum of every column's value on that line (blank/non-numeric entries count as 0). Returns null if the tracker has no columns at all, so the caller can show "—" instead of a bare 0. */
  computeTableScoreSum(toolId, lineId) {
    const cfg = this.getTableConfig(toolId);
    if (!cfg || cfg.columns.length === 0) return null;
    let sum = 0;
    cfg.columns.forEach((col) => {
      const raw = cfg.values[`${lineId}|${col.id}`];
      const num = Number(raw);
      if (raw !== undefined && !Number.isNaN(num)) sum += num;
    });
    return sum;
  },

  /** Deletes any stored cell values whose lineId is in `lineIds` and/or whose columnId is in `columnIds` — called when columns are removed so their old values don't linger as orphaned data. */
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
    if (!item) return { manualWeight: 100, toolWeights: {} };
    if (!item.scoreSources || typeof item.scoreSources !== "object") {
      item.scoreSources = {};
    }
    if (typeof item.scoreSources.manualWeight !== "number") item.scoreSources.manualWeight = 100;
    if (!item.scoreSources.toolWeights || typeof item.scoreSources.toolWeights !== "object") {
      item.scoreSources.toolWeights = {};
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
   * isn't a Progress Tracker, has no columns, or the student isn't
   * seated/grouped (in "groups" mode). Otherwise { raw: true, value }
   * — the sum is used as-is, on the assumption its scale already
   * matches the item's own points.
   */
  _toolContributionForStudent(tool, studentId) {
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
    return { raw: true, value: sum };
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
  computeItemEffectiveScore(studentId, item) {
    const sourcesCfg = this.getItemScoreSources(item.id);
    const sources = [];

    if (sourcesCfg.manualWeight > 0) {
      const rec = this.getRecord(studentId, item.id);
      if (rec !== "" && rec !== "E") {
        sources.push({ weight: sourcesCfg.manualWeight, points: Number(rec) });
      }
    }

    Object.entries(sourcesCfg.toolWeights).forEach(([toolId, weight]) => {
      if (!(weight > 0)) return;
      const tool = this.findTool(toolId);
      if (!tool) return;
      const contribution = this._toolContributionForStudent(tool, studentId);
      if (!contribution) return;
      const points = contribution.raw ? contribution.value : contribution.value * item.maxPoints;
      sources.push({ weight, points });
    });

    if (sources.length === 0) return null;
    const weightTotal = sources.reduce((sum, s) => sum + s.weight, 0);
    if (weightTotal <= 0) return null;
    const weightedSum = sources.reduce((sum, s) => sum + s.points * s.weight, 0);
    return weightedSum / weightTotal;
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

  /** Raw sum of all earned points across all categories (excludes exempt and not-yet-recorded items), using each item's blended Score Sources result. */
  totalRawPoints(studentId) {
    let total = 0;
    this.categories.forEach((category) => {
      category.items.forEach((item) => {
        const rec = this.getRecord(studentId, item.id);
        if (rec === "E") return;
        const effective = this.computeItemEffectiveScore(studentId, item);
        if (effective !== null) total += effective;
      });
    });
    return total;
  },

  /** The weighted average percent (0-100) across categories plus Attendance, normalized by the sum of weights actually entered — "how well are they doing, relative to what's been weighted so far." Used for the secondary percentage shown under Total Score/Attendance, and by Student Consultation's own Percent mode. */
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

  /**
   * The actual Total Score, in points: each category's percent (as a
   * 0-1 fraction) times its own weight, summed with Attendance's the
   * same way — NOT normalized by the sum of weights, unlike
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
      const weight = this.weights[category.id] || 0;
      if (weight <= 0) return;
      const { percent } = this.categoryScore(studentId, category.id);
      if (percent === null) return;
      total += (percent / 100) * weight;
      any = true;
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
