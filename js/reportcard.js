// ===== Report Card module =====
// For now this only reads from RosterModule / ScoringModule /
// AttendanceModule — it has no persisted data of its own yet. That
// will change when the Report Card (print, item-selection) mode is
// built next.

const ReportCardModule = {
  /** Full detail for one student: every category's items, each category's subtotal, attendance, and the overall total. */
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
      total: ScoringModule.totalScore(studentId),
      attendance: AttendanceModule.stats(studentId),
      attendanceWeight: ScoringModule.weights.attendance || 0,
    };
  },
};

window.ReportCardModule = ReportCardModule;
