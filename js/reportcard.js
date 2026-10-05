// ===== Report Card module =====
// studentDetail() reads from RosterModule / ScoringModule /
// AttendanceModule to assemble one student's full picture — used by
// both Student Consultation and the printed report card.
//
// Saved state (reportcard-<courseId>.json):
//  - selectedItemIds: which scoring items appear on a printed report
//    card. Defaults to every current item selected the first time (so
//    printing works immediately without requiring setup) — after that,
//    it's exactly what's been saved.
//  - emailSubject / emailMessage: the wording used when report cards
//    are emailed to students (blank = the standard wording).

const ReportCardModule = {
  selectedItemIds: new Set(),
  emailSubject: "",
  emailMessage: "",
  currentCourseId: null,

  fileName(courseId) {
    return `reportcard-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    if (data && Array.isArray(data.selectedItemIds)) {
      this.selectedItemIds = new Set(data.selectedItemIds);
    } else {
      this.selectAll(); // first time — default to everything included
    }
    this.emailSubject = data && typeof data.emailSubject === "string" ? data.emailSubject : "";
    this.emailMessage = data && typeof data.emailMessage === "string" ? data.emailMessage : "";
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      selectedItemIds: Array.from(this.selectedItemIds),
      emailSubject: this.emailSubject,
      emailMessage: this.emailMessage,
    });
  },

  allItemIds() {
    return ScoringModule.categories.flatMap((c) => c.items.map((i) => i.id));
  },

  selectAll() {
    this.selectedItemIds = new Set(this.allItemIds());
  },

  selectNone() {
    this.selectedItemIds = new Set();
  },

  isItemSelected(itemId) {
    return this.selectedItemIds.has(itemId);
  },

  toggleItemSelected(itemId) {
    if (this.selectedItemIds.has(itemId)) this.selectedItemIds.delete(itemId);
    else this.selectedItemIds.add(itemId);
  },

  /** Full detail for one student: every category's items, each category's subtotal, attendance, and the overall total. `total` is in points — see ScoringModule.totalPoints. */
  studentDetail(studentId) {
    const categories = ScoringModule.categories.map((category) => ({
      id: category.id,
      name: category.name,
      weight: ScoringModule.weights[category.id] || 0,
      subtotal: ScoringModule.categoryScore(studentId, category.id),
      items: category.items.map((item) => ({
        id: item.id,
        name: item.name,
        maxPoints: item.maxPoints,
        record: ScoringModule.getRecord(studentId, item.id), // "" | "E" | numeric string
      })),
    }));

    return {
      categories,
      total: ScoringModule.totalPoints(studentId),
      attendance: AttendanceModule.stats(studentId),
      attendanceWeight: ScoringModule.weights.attendance || 0,
      attendanceSessions: AttendanceModule.sessionBreakdown(studentId),
      attendanceNote: AttendanceModule.getNote(studentId),
    };
  },
};

window.ReportCardModule = ReportCardModule;
