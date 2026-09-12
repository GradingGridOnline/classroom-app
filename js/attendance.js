// ===== Attendance module =====
// One file per course: attendance-<courseId>.json
//
// - sessions: ordered list of class meetings [{ id, number, date }]
// - records: sparse map "studentId|sessionId" -> { code, infraction, memo }
//   code is "" (not recorded), "P" (present), "A" (absent), "L" (late),
//   or "E" (excused).
// - notes: studentId -> a general, ongoing note about that student
//   (separate from the per-session memo).
// - settings: editable configuration — the infraction option list, and
//   the point value each attendance code contributes toward the
//   computed "current score".

const ATTENDANCE_CODES = ["", "P", "A", "L", "E"];
const ATTENDANCE_CODE_LABELS = {
  "": "—",
  P: "P (Present)",
  A: "A (Absent)",
  L: "L (Late)",
  E: "E (Excused)",
};

function defaultAttendanceSettings() {
  return {
    infractionOptions: ["Sleeping", "Phone use", "Talking too much"],
    points: { P: 1, L: 0.5, E: 1, A: 0 },
  };
}

const AttendanceModule = {
  sessions: [],
  records: {},
  notes: {},
  settings: defaultAttendanceSettings(),
  currentCourseId: null,

  fileName(courseId) {
    return `attendance-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    if (data) {
      this.sessions = Array.isArray(data.sessions) ? data.sessions : [];
      this.records = data.records || {};
      this.notes = data.notes || {};
      const defaults = defaultAttendanceSettings();
      this.settings = {
        infractionOptions:
          (data.settings && data.settings.infractionOptions) || defaults.infractionOptions,
        points: { ...defaults.points, ...(data.settings && data.settings.points) },
      };
    } else {
      this.sessions = [];
      this.records = {};
      this.notes = {};
      this.settings = defaultAttendanceSettings();
    }
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      sessions: this.sessions,
      records: this.records,
      notes: this.notes,
      settings: this.settings,
    });
  },

  // ----- Sessions (class meetings / columns) -----

  addSession() {
    const nextNumber = this.sessions.length
      ? Math.max(...this.sessions.map((s) => s.number)) + 1
      : 1;
    const session = {
      id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      number: nextNumber,
      date: "",
    };
    this.sessions.push(session);
    return session;
  },

  removeSession(sessionId) {
    this.sessions = this.sessions.filter((s) => s.id !== sessionId);
    Object.keys(this.records).forEach((key) => {
      if (key.endsWith(`|${sessionId}`)) delete this.records[key];
    });
  },

  setSessionDate(sessionId, date) {
    const session = this.sessions.find((s) => s.id === sessionId);
    if (session) session.date = date;
  },

  // ----- Per-student, per-session records -----

  recordKey(studentId, sessionId) {
    return `${studentId}|${sessionId}`;
  },

  getRecord(studentId, sessionId) {
    return this.records[this.recordKey(studentId, sessionId)] || { code: "", infraction: "", memo: "" };
  },

  setRecord(studentId, sessionId, fields) {
    const key = this.recordKey(studentId, sessionId);
    const existing = this.records[key] || { code: "", infraction: "", memo: "" };
    this.records[key] = { ...existing, ...fields };
  },

  /** The header "P" button — marks every given student present for one session in one action. */
  markAllPresent(sessionId, studentIds) {
    studentIds.forEach((id) => this.setRecord(id, sessionId, { code: "P" }));
  },

  // ----- General per-student notes -----

  getNote(studentId) {
    return this.notes[studentId] || "";
  },

  setNote(studentId, text) {
    const trimmed = (text || "").trim();
    if (trimmed) this.notes[studentId] = trimmed;
    else delete this.notes[studentId];
  },

  // ----- Summary stats, computed from recorded sessions only -----

  stats(studentId) {
    let attended = 0;
    let absences = 0;
    let points = 0;
    let counted = 0;

    this.sessions.forEach((s) => {
      const rec = this.getRecord(studentId, s.id);
      if (!rec.code) return; // not yet recorded — excluded from the average
      counted++;
      if (rec.code === "A") absences++;
      else attended++;
      points += this.settings.points[rec.code] ?? 0;
    });

    return {
      score: counted > 0 ? Math.round((points / counted) * 100) : null,
      attended,
      absences,
    };
  },

  // ----- Settings -----

  updateSettings(next) {
    this.settings = { ...this.settings, ...next };
  },
};

window.AttendanceModule = AttendanceModule;
