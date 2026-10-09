// ===== Attendance module =====
// One file per course: attendance-<courseId>.json
//
// - sessions: one per class meeting, count driven entirely by
//   settings.termClassCount (see setTermClassCount) rather than
//   added/removed one at a time.
// - records: sparse map "studentId|sessionId" -> { code, infraction, memo }
//   code is "" (not recorded) or one of settings.participationTypes.
// - notes: studentId -> a general, ongoing note about that student
//   (separate from the per-session memo).
// - settings: editable configuration.
//   - participationTypes: always starts with the fixed "P" and "A"
//     codes (the bulk-present button and the Absences count both
//     depend on these exact codes existing), followed by any number
//     of custom types (default: "L", "E") that can be freely renamed,
//     added, or removed.
//   - infractionOptions: a freely editable list.
//   - points / infractionPoints: the point value each participation
//     type / infraction contributes toward the computed score.
//   - participationCounts / absenceCounts: how much of a class each
//     participation type counts as, toward the "Attended" and
//     "Absences" totals. Stored as the text the user typed (so "1/3"
//     stays "1/3") — whole numbers, decimals, and fractions all work.
//     e.g. P = 1 attended / 0 absent; Late = 1/2 attended; a custom
//     "Very late" = 0 attended / 1/3 absent.
//   - termClassCount: how many session columns exist.

const FIXED_PARTICIPATION_TYPES = ["P", "A"];

// What a column in the LMS export template can be filled with.
const EXPORT_FIELD_OPTIONS = [
  ["", "(leave blank)"],
  ["name", "Student Name"],
  ["schoolId", "School ID"],
  ["email", "Email Address"],
  ["classNumber", "Class #"],
  ["pronunciation", "Pronunciation"],
  ["points", "Attendance Points"],
];

function defaultAttendanceSettings() {
  return {
    participationTypes: ["P", "A", "L", "E"],
    infractionOptions: ["Sleeping", "Phone use", "Talking too much"],
    points: { P: 1, A: 0, L: 0.5, E: 1 },
    participationCounts: { P: "1", A: "0", L: "1", E: "1" },
    absenceCounts: { P: "0", A: "1", L: "0", E: "0" },
    infractionPoints: { Sleeping: -0.2, "Phone use": -0.2, "Talking too much": -0.2 },
    termClassCount: 0,
    absenceLimit: null,
    exportTemplate: null,
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
    const defaults = defaultAttendanceSettings();

    if (data) {
      this.sessions = Array.isArray(data.sessions) ? data.sessions : [];
      this.records = data.records || {};
      this.notes = data.notes || {};
      const saved = data.settings || {};
      this.settings = {
        participationTypes: this._withFixedTypes(saved.participationTypes || defaults.participationTypes),
        infractionOptions: saved.infractionOptions || defaults.infractionOptions,
        points: { ...defaults.points, ...saved.points },
        participationCounts: { ...defaults.participationCounts, ...saved.participationCounts },
        absenceCounts: { ...defaults.absenceCounts, ...saved.absenceCounts },
        infractionPoints: { ...defaults.infractionPoints, ...saved.infractionPoints },
        termClassCount:
          typeof saved.termClassCount === "number" ? saved.termClassCount : this.sessions.length,
        absenceLimit: typeof saved.absenceLimit === "number" ? saved.absenceLimit : null,
        exportTemplate: saved.exportTemplate || null,
      };
    } else {
      this.sessions = [];
      this.records = {};
      this.notes = {};
      this.settings = defaults;
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

  _withFixedTypes(list) {
    const rest = list.filter((t) => !FIXED_PARTICIPATION_TYPES.includes(t));
    return [...FIXED_PARTICIPATION_TYPES, ...rest];
  },

  // ----- Sessions (class meetings / columns) -----
  // The number of sessions is controlled entirely by term class count.

  setTermClassCount(count) {
    count = Math.max(0, Math.min(100, Math.round(Number(count) || 0)));

    if (count > this.sessions.length) {
      while (this.sessions.length < count) {
        this.sessions.push({
          id: `session-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          number: this.sessions.length + 1,
          date: "",
        });
      }
    } else if (count < this.sessions.length) {
      const removed = this.sessions.slice(count);
      this.sessions = this.sessions.slice(0, count);
      removed.forEach((s) => {
        Object.keys(this.records).forEach((key) => {
          if (key.endsWith(`|${s.id}`)) delete this.records[key];
        });
      });
    }

    this.settings.termClassCount = count;
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

  // ----- Settings: participation types -----

  /** Renames/adds/removes participation types, always keeping P and A first and fixed. */
  setParticipationTypes(list) {
    const custom = list.map((s) => s.trim()).filter((s) => s && !FIXED_PARTICIPATION_TYPES.includes(s));
    const cleaned = this._withFixedTypes(custom);
    const newPoints = {};
    const newAttended = {};
    const newAbsent = {};
    cleaned.forEach((t) => {
      newPoints[t] = this.settings.points[t] ?? 1;
      newAttended[t] = this.settings.participationCounts[t] ?? "1"; // a new type counts as a full class...
      newAbsent[t] = this.settings.absenceCounts[t] ?? "0"; // ...and no absence, until changed
    });
    this.settings.participationTypes = cleaned;
    this.settings.points = newPoints;
    this.settings.participationCounts = newAttended;
    this.settings.absenceCounts = newAbsent;
  },

  setPointValue(type, value) {
    this.settings.points[type] = Number(value) || 0;
  },

  /**
   * Turns text like "1", "0.5", ".5", or "1/3" into a number (0 or
   * more), or null if it isn't one. Blank counts as 0.
   */
  parseCount(text) {
    const trimmed = String(text == null ? "" : text).trim();
    if (trimmed === "") return 0;
    const fraction = /^(\d+(?:\.\d+)?)\s*\/\s*(\d+(?:\.\d+)?)$/.exec(trimmed);
    if (fraction) {
      const denominator = Number(fraction[2]);
      return denominator > 0 ? Number(fraction[1]) / denominator : null;
    }
    const num = Number(trimmed);
    return Number.isNaN(num) || num < 0 ? null : num;
  },

  /** How much of a class a code counts as: which is "participation" (toward Attended) or "absence" (toward Absences). */
  countFor(code, which) {
    const map = which === "absence" ? this.settings.absenceCounts : this.settings.participationCounts;
    const fallback = which === "absence" ? 0 : 1;
    const parsed = this.parseCount(map[code]);
    return parsed === null ? fallback : parsed;
  },

  _setCount(map, type, value) {
    if (this.parseCount(value) === null) {
      throw new Error('Enter a number, a decimal, or a fraction like 1/3 (0 or more).');
    }
    map[type] = String(value == null ? "" : value).trim() || "0";
  },

  /** How much of a class this type counts toward "Attended" (e.g. "1", "0.5", "1/2"). */
  setParticipationCount(type, value) {
    this._setCount(this.settings.participationCounts, type, value);
  },

  /** How much of an absence this type counts toward "Absences" (e.g. "0", "1", "1/3"). */
  setAbsenceCount(type, value) {
    this._setCount(this.settings.absenceCounts, type, value);
  },

  // ----- Settings: infractions -----

  setInfractionOptions(list) {
    const cleaned = list.map((s) => s.trim()).filter(Boolean);
    const newPoints = {};
    cleaned.forEach((t) => {
      newPoints[t] = this.settings.infractionPoints[t] ?? -0.2;
    });
    this.settings.infractionOptions = cleaned;
    this.settings.infractionPoints = newPoints;
  },

  setInfractionPointValue(infraction, value) {
    this.settings.infractionPoints[infraction] = Number(value) || 0;
  },

  setAbsenceLimit(n) {
    const num = Number(n);
    this.settings.absenceLimit = num > 0 ? num : null;
  },

  // ----- LMS export template -----
  // A CSV/Excel file uploaded once per course. Only its HEADER ROW is
  // used — it just says which columns the LMS expects, in what order.
  // Any student rows in the file are ignored. Each column is then
  // assigned what should go in it (student name, School ID, email,
  // class number, pronunciation, or attendance points, or left blank),
  // and an export writes the header row followed by one row per
  // student on the roster.
  // Saved shape: { headers: [...], columnFields: [ "" | "name" | ... ] }
  // (columnFields lines up with headers, one entry per column).

  /** Best-effort guess at what a template column is for, from its header text. "" means "leave blank". */
  _guessColumnField(header) {
    const h = String(header == null ? "" : header).trim();
    if (/point|score|grade|点/i.test(h)) return "points";
    if (/user[_\s-]?id|student[_\s-]?id|school[_\s-]?id|学籍|学生番号|^id$/i.test(h)) return "schoolId";
    if (/mail|メール/i.test(h)) return "email";
    if (/name|氏名|名前/i.test(h)) return "name";
    return "";
  },

  setExportTemplate(headers /*, rows — ignored on purpose */) {
    const existing = this.settings.exportTemplate;
    // Keep the previous column assignments only if the new template
    // has exactly the same headers; otherwise start from a fresh guess.
    const sameShape =
      existing &&
      Array.isArray(existing.columnFields) &&
      existing.headers.length === headers.length &&
      existing.headers.every((h, i) => h === headers[i]);
    this.settings.exportTemplate = {
      headers,
      columnFields: sameShape ? existing.columnFields : headers.map((h) => this._guessColumnField(h)),
    };
  },

  /** Makes sure a saved template has columnFields — templates saved by an older version (which matched student rows inside the template) are converted, keeping their old identifier/points column choices. */
  _ensureExportMapping(tpl) {
    if (Array.isArray(tpl.columnFields) && tpl.columnFields.length === tpl.headers.length) return;
    tpl.columnFields = tpl.headers.map((h) => this._guessColumnField(h));
    if (typeof tpl.identifierColumn === "number" && tpl.identifierColumn >= 0 && tpl.identifierColumn < tpl.headers.length) {
      tpl.columnFields[tpl.identifierColumn] = tpl.identifierField || "schoolId";
    }
    if (typeof tpl.valueColumn === "number" && tpl.valueColumn >= 0 && tpl.valueColumn < tpl.headers.length) {
      tpl.columnFields[tpl.valueColumn] = "points";
    }
  },

  setExportColumnField(index, field) {
    const tpl = this.settings.exportTemplate;
    if (!tpl) return;
    this._ensureExportMapping(tpl);
    tpl.columnFields[index] = field || "";
  },

  clearExportTemplate() {
    this.settings.exportTemplate = null;
  },

  /**
   * Builds the export CSV for one session: the template's header row,
   * then one row per given student (in the order given), with each
   * column filled according to its assigned field. "points" is the
   * point value of that student's attendance code for this session,
   * with that session's infraction deducted (the infraction's point
   * value is added, so a negative value lowers the points) — the same
   * calculation as the Attendance score. Blank if nothing is recorded
   * for them yet.
   */
  buildExportCsv(sessionId, students) {
    const tpl = this.settings.exportTemplate;
    if (!tpl || !tpl.headers) throw new Error("No export template uploaded yet.");
    this._ensureExportMapping(tpl);
    if (!tpl.columnFields.includes("points")) {
      throw new Error("Choose which template column should receive the attendance points first.");
    }

    const rows = students.map((student) =>
      tpl.columnFields.map((field) => {
        if (!field) return "";
        if (field === "points") {
          const record = this.getRecord(student.id, sessionId);
          if (!record.code) return "";
          let pts = this.settings.points[record.code] ?? 0;
          if (record.infraction) pts += this.settings.infractionPoints[record.infraction] ?? 0;
          return Math.round(pts * 100) / 100; // avoids results like 0.7999999999999999
        }
        const value = student[field];
        return value == null ? "" : value;
      })
    );

    const sheet = XLSX.utils.aoa_to_sheet([tpl.headers, ...rows]);
    return XLSX.utils.sheet_to_csv(sheet);
  },

  // ----- Summary stats, computed from recorded sessions only -----

  /** Per-session detail for one student — code, infraction, and memo for every session, in session order. Used by Student Consultation to show the full attendance picture, not just the summary stats. */
  sessionBreakdown(studentId) {
    return this.sessions.map((s) => {
      const rec = this.getRecord(studentId, s.id);
      return {
        sessionId: s.id,
        number: s.number,
        date: s.date,
        code: rec.code || "",
        infraction: rec.infraction || "",
        memo: rec.memo || "",
      };
    });
  },

  /** Attendance raw points: { earned, possible }. Possible = the highest point value per class, times every non-exempt class. Infraction deductions count against earned. */
  rawPoints(studentId) {
    const maxPerSession = Math.max(0, ...Object.values(this.settings.points || {}));
    let earned = 0;
    let classes = 0;
    this.sessions.forEach((s) => {
      const rec = this.getRecord(studentId, s.id);
      if (rec.code && rec.code.toUpperCase() === "E") return;
      classes++;
      if (!rec.code) return;
      earned += this.settings.points[rec.code] ?? 0;
      if (rec.infraction) earned += this.settings.infractionPoints[rec.infraction] ?? 0;
    });
    return { earned: Math.round(earned * 100) / 100, possible: Math.round(classes * maxPerSession * 100) / 100 };
  },

  stats(studentId) {
    let attended = 0;
    let absences = 0;
    let totalPoints = 0;
    let counted = 0; // sessions counted toward the percent/points denominator — excludes exempt

    this.sessions.forEach((s) => {
      const rec = this.getRecord(studentId, s.id);
      if (!rec.code) return; // not yet recorded — excluded from the average
      attended += this.countFor(rec.code, "participation");
      absences += this.countFor(rec.code, "absence");

      // "E" (Exempt) is excluded entirely from the points calculation —
      // same convention as Scoring's "E" — so it neither helps nor hurts
      // the percentage, rather than being scored as its own point value.
      if (rec.code.toUpperCase() === "E") return;

      counted++;
      let pts = this.settings.points[rec.code] ?? 0;
      if (rec.infraction) pts += this.settings.infractionPoints[rec.infraction] ?? 0;
      totalPoints += pts;
    });

    // Percent is earned points out of the points actually possible across
    // the recorded (non-exempt) sessions — not just a per-session count —
    // so a participation point value other than 1 (e.g. "P" worth 10
    // points) doesn't distort the percentage.
    const maxPerSession = Math.max(0, ...Object.values(this.settings.points));
    const possiblePoints = counted * maxPerSession;

    return {
      percent: possiblePoints > 0 ? Math.round((totalPoints / possiblePoints) * 100) : null,
      points: counted > 0 ? Math.round(totalPoints * 10) / 10 : null,
      attended: Math.round(attended * 100) / 100,
      absences: Math.round(absences * 100) / 100,
    };
  },
};

window.AttendanceModule = AttendanceModule;
