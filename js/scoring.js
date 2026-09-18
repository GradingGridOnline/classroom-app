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

const MAX_CATEGORIES = 10; // a cap, not a fixed starting count — add categories as needed
const MAX_ITEMS_PER_CATEGORY = 50;

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
  scoreDisplayMode: "percent", // "percent" or "points"
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
      this.scoreDisplayMode = data.scoreDisplayMode === "points" ? "points" : "percent";
    } else {
      this.categories = [];
      this.records = {};
      this.weights = { attendance: 0 };
      this.scoreDisplayMode = "percent";
    }
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      categories: this.categories,
      records: this.records,
      weights: this.weights,
      scoreDisplayMode: this.scoreDisplayMode,
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

  /** Weighted total across the 10 categories plus Attendance (via AttendanceModule), normalized by the sum of weights actually entered. Returns percent or raw points based on scoreDisplayMode. */
  totalScore(studentId) {
    if (this.scoreDisplayMode === "points") {
      return this.totalRawPoints(studentId);
    }

    // percent mode
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

    return weightTotal > 0 ? Math.round(weightedSum / weightTotal) : null;
  },
};

window.ScoringModule = ScoringModule;
