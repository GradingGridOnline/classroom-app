// ===== Presentation Calculator module =====
// One file per course: presentationcalc-<courseId>.json
//
// Step 1: a roster snapshot — one entry per seated student, carrying
// over that desk's Group Number from one of the Seating Chart's 6
// saved memory banks. This is an explicit IMPORT (via importFromBank),
// not a live link — so it stays put as a fixed presentation-order
// roster even if seats get rearranged afterward. Re-import any time
// (from the same or a different bank) to refresh it.
//
// Only seated students (active desk + occupied) are included — an
// unseated student has no group, so there's nothing meaningful to
// assign them to for presentation purposes.

const MAX_RUBRIC_BANK = 30;
const MAX_ACTIVE_RUBRICS = 10;
const MAX_RUBRIC_POINTS = 20; // ceiling for the selectable point-value dropdown

const PresentationCalcModule = {
  roster: [], // [{ studentId, classNumber, name, pronunciation, schoolId, group }]
  sourceBankName: null, // which memory bank the current roster was imported from, for display
  rubricBank: [], // [{ id, text }] — manually-entered rubric descriptions
  teacherRubrics: [], // [{ id, rubricId, points }] — Active Teacher Rubrics grid
  audienceRubrics: [], // [{ id, rubricId, points }] — Active Audience Rubrics grid
  currentCourseId: null,

  fileName(courseId) {
    return `presentationcalc-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    this.roster = data && Array.isArray(data.roster) ? data.roster : [];
    this.sourceBankName = data ? data.sourceBankName || null : null;
    this.rubricBank = data && Array.isArray(data.rubricBank) ? data.rubricBank : [];
    this.teacherRubrics = data && Array.isArray(data.teacherRubrics) ? data.teacherRubrics : [];
    this.audienceRubrics = data && Array.isArray(data.audienceRubrics) ? data.audienceRubrics : [];
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      roster: this.roster,
      sourceBankName: this.sourceBankName,
      rubricBank: this.rubricBank,
      teacherRubrics: this.teacherRubrics,
      audienceRubrics: this.audienceRubrics,
    });
  },

  /**
   * Builds this module's roster from one of the Seating Chart's saved
   * memory banks — one entry per active, occupied desk in that bank's
   * snapshot, carrying over that desk's Group Number. Overwrites
   * whatever was here before. Caller is responsible for calling save()
   * afterward to persist it.
   */
  importFromBank(bank, roster) {
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
        const student = roster.students.find((s) => s.id === studentId);
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
    // Group first (ungrouped/0 last), then by Class Number within a group,
    // so students naturally cluster by table in the order they'll present.
    entries.sort((a, b) => {
      const groupA = a.group || Infinity;
      const groupB = b.group || Infinity;
      if (groupA !== groupB) return groupA - groupB;
      return (a.classNumber || 0) - (b.classNumber || 0);
    });
    this.roster = entries;
    this.sourceBankName = bank.name;
  },

  isEmpty() {
    return this.roster.length === 0;
  },

  // ----- Rubric Bank: manually-entered rubric text, one per row -----

  addRubricBankRow() {
    if (this.rubricBank.length >= MAX_RUBRIC_BANK) {
      throw new Error(`You've reached the limit of ${MAX_RUBRIC_BANK} rubrics.`);
    }
    const rubric = { id: `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: "" };
    this.rubricBank.push(rubric);
    return rubric;
  },

  /** Removing a rubric also clears it from any active-grid row that had it selected. */
  removeRubricBankRow(id) {
    this.rubricBank = this.rubricBank.filter((r) => r.id !== id);
    [this.teacherRubrics, this.audienceRubrics].forEach((list) => {
      list.forEach((entry) => {
        if (entry.rubricId === id) entry.rubricId = null;
      });
    });
  },

  setRubricBankText(id, text) {
    const rubric = this.rubricBank.find((r) => r.id === id);
    if (rubric) rubric.text = text;
  },

  findRubric(id) {
    return this.rubricBank.find((r) => r.id === id) || null;
  },

  // ----- Active rubric grids (Teacher / Audience) — each row picks a rubric from the bank and a point value -----

  _activeList(kind) {
    return kind === "audience" ? this.audienceRubrics : this.teacherRubrics;
  },

  addActiveRubric(kind) {
    const list = this._activeList(kind);
    if (list.length >= MAX_ACTIVE_RUBRICS) {
      throw new Error(`You've reached the limit of ${MAX_ACTIVE_RUBRICS} active rubrics.`);
    }
    const entry = { id: `active-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, rubricId: null, points: 0 };
    list.push(entry);
    return entry;
  },

  removeActiveRubric(kind, id) {
    if (kind === "audience") this.audienceRubrics = this.audienceRubrics.filter((e) => e.id !== id);
    else this.teacherRubrics = this.teacherRubrics.filter((e) => e.id !== id);
  },

  setActiveRubricSelection(kind, id, rubricId) {
    const entry = this._activeList(kind).find((e) => e.id === id);
    if (entry) entry.rubricId = rubricId || null;
  },

  setActiveRubricPoints(kind, id, points) {
    const entry = this._activeList(kind).find((e) => e.id === id);
    if (entry) entry.points = Math.max(0, Math.min(MAX_RUBRIC_POINTS, Math.round(Number(points) || 0)));
  },
};

window.PresentationCalcModule = PresentationCalcModule;
window.MAX_RUBRIC_POINTS = MAX_RUBRIC_POINTS;
