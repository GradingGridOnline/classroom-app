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
//   - termClassCount: how many session columns exist.

const FIXED_PARTICIPATION_TYPES = ["P", "A"];

function defaultAttendanceSettings() {
  return {
    participationTypes: ["P", "A", "L", "E"],
    infractionOptions: ["Sleeping", "Phone use", "Talking too much"],
    points: { P: 1, A: 0, L: 0.5, E: 1 },
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
    cleaned.forEach((t) => {
      newPoints[t] = this.settings.points[t] ?? 1;
    });
    this.settings.participationTypes = cleaned;
    this.settings.points = newPoints;
  },

  setPointValue(type, value) {
    this.settings.points[type] = Number(value) || 0;
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
  // A CSV/Excel file uploaded once per course, whose structure
  // (headers + rows) is kept as-is. Exporting a session copies that
  // template and fills in one column with each matched student's
  // attendance POINTS for that session (the point value of their
  // attendance code, from Attendance Settings).

  /** Best-effort guess at which template column identifies students and which receives the points, from header names. -1 means "no guess". */
  _guessTemplateMapping(headers) {
    const find = (re) => headers.findIndex((h) => re.test(String(h).trim()));
    let identifier = find(/user[_\s-]?id|student[_\s-]?id|school[_\s-]?id|学籍|学生番号/i);
    if (identifier < 0) identifier = find(/(^|[_\s-])id$/i);
    const value = find(/point|score|grade|点/i);
    return { identifier, value };
  },

  setExportTemplate(headers, rows) {
    const existing = this.settings.exportTemplate;
    // Keep the previous column choices only if the new template has
    // exactly the same headers — otherwise the old column numbers
    // could point at the wrong columns, so start from a fresh guess.
    const sameShape =
      existing &&
      existing.headers.length === headers.length &&
      existing.headers.every((h, i) => h === headers[i]);
    const guess = this._guessTemplateMapping(headers);
    this.settings.exportTemplate = {
      headers,
      rows,
      identifierColumn: sameShape ? existing.identifierColumn : guess.identifier,
      valueColumn: sameShape ? existing.valueColumn : guess.value,
      identifierField: existing ? existing.identifierField : "schoolId",
    };
  },

  updateExportMapping(fields) {
    if (!this.settings.exportTemplate) return;
    Object.assign(this.settings.exportTemplate, fields);
  },

  clearExportTemplate() {
    this.settings.exportTemplate = null;
  },

  /** Text used to compare a template cell against a roster student: full-width/half-width forms unified, spaces removed, case ignored — so "人26-0006" matches "人26‐0006", and "山田 太郎" matches "山田　太郎". */
  _normalizeMatchKey(value) {
    return String(value == null ? "" : value)
      .normalize("NFKC")
      .replace(/\s+/g, "")
      .toLowerCase();
  },

  _studentMatchField(student, field) {
    if (field === "name") return student.name;
    if (field === "email") return student.email;
    if (field === "classNumber") return student.classNumber;
    return student.schoolId;
  },

  /**
   * Builds the export for one session from the uploaded template and
   * current column mapping. The chosen points column is cleared on
   * every template row first, then filled in for each row matched to
   * a student (left blank if that student has nothing recorded for
   * the session) — so nothing left over in the template's own
   * points column can be mistaken for a real value.
   * Returns { csv, matchedRows, totalRows, unmatchedStudents } — the
   * last is a list of roster names that weren't found in the template.
   */
  buildExportCsv(sessionId, students) {
    const tpl = this.settings.exportTemplate;
    if (!tpl || !tpl.headers) throw new Error("No export template uploaded yet.");
    if (tpl.identifierColumn < 0 || tpl.valueColumn < 0) {
      throw new Error("Choose both the identifier column and the points column first.");
    }
    if (tpl.identifierColumn === tpl.valueColumn) {
      throw new Error("The identifier column and the points column can't be the same column.");
    }

    const lookup = new Map();
    students.forEach((s) => {
      const key = this._normalizeMatchKey(this._studentMatchField(s, tpl.identifierField));
      if (key && !lookup.has(key)) lookup.set(key, s);
    });

    const matchedIds = new Set();
    let matchedRows = 0;

    const outRows = tpl.rows.map((row) => {
      const newRow = [...row];
      while (newRow.length < tpl.headers.length) newRow.push("");
      newRow[tpl.valueColumn] = "";

      const key = this._normalizeMatchKey(row[tpl.identifierColumn]);
      const student = key ? lookup.get(key) : null;
      if (student) {
        matchedIds.add(student.id);
        matchedRows++;
        const record = this.getRecord(student.id, sessionId);
        if (record.code) newRow[tpl.valueColumn] = this.settings.points[record.code] ?? 0;
      }
      return newRow;
    });

    const sheet = XLSX.utils.aoa_to_sheet([tpl.headers, ...outRows]);
    return {
      csv: XLSX.utils.sheet_to_csv(sheet),
      matchedRows,
      totalRows: tpl.rows.length,
      unmatchedStudents: students.filter((s) => !matchedIds.has(s.id)).map((s) => s.name || "(unnamed)"),
    };
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

  stats(studentId) {
    let attended = 0;
    let absences = 0;
    let totalPoints = 0;
    let counted = 0; // sessions counted toward the percent/points denominator — excludes exempt

    this.sessions.forEach((s) => {
      const rec = this.getRecord(studentId, s.id);
      if (!rec.code) return; // not yet recorded — excluded from the average
      if (rec.code === "A") absences++;
      else attended++;

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
      attended,
      absences,
    };
  },
};

window.AttendanceModule = AttendanceModule;
