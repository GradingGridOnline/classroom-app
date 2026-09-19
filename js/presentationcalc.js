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

const PresentationCalcModule = {
  roster: [], // [{ studentId, classNumber, name, pronunciation, schoolId, group }]
  sourceBankName: null, // which memory bank the current roster was imported from, for display
  currentCourseId: null,

  fileName(courseId) {
    return `presentationcalc-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    this.roster = data && Array.isArray(data.roster) ? data.roster : [];
    this.sourceBankName = data ? data.sourceBankName || null : null;
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      roster: this.roster,
      sourceBankName: this.sourceBankName,
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
};

window.PresentationCalcModule = PresentationCalcModule;
