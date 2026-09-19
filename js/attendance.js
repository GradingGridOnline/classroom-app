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
//   - scoreDisplayMode: "percent" or "points".

const FIXED_PARTICIPATION_TYPES = ["P", "A"];

function defaultAttendanceSettings() {
  return {
    participationTypes: ["P", "A", "L", "E"],
    infractionOptions: ["Sleeping", "Phone use", "Talking too much"],
    points: { P: 1, A: 0, L: 0.5, E: 1 },
    infractionPoints: { Sleeping: -0.2, "Phone use": -0.2, "Talking too much": -0.2 },
    termClassCount: 0,
    scoreDisplayMode: "percent",
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
        scoreDisplayMode: saved.scoreDisplayMode === "points" ? "points" : "percent",
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

  setScoreDisplayMode(mode) {
    this.settings.scoreDisplayMode = mode === "points" ? "points" : "percent";
  },

  setAbsenceLimit(n) {
    const num = Number(n);
    this.settings.absenceLimit = num > 0 ? num : null;
  },

  // ----- LMS export template -----
  // A CSV uploaded once per course, whose structure (headers + rows)
  // is kept as-is. Exporting a session copies that template and fills
  // in one column with each matched student's attendance code for
  // that session, leaving everything else untouched.

  setExportTemplate(headers, rows) {
    const existing = this.settings.exportTemplate;
    this.settings.exportTemplate = {
      headers,
      rows,
      identifierColumn: existing ? existing.identifierColumn : -1,
      valueColumn: existing ? existing.valueColumn : -1,
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

  /** Builds a CSV string for one session, using the uploaded template and current column mapping. */
  buildExportCsv(sessionId, students) {
    const tpl = this.settings.exportTemplate;
    if (!tpl || !tpl.headers) throw new Error("No export template uploaded yet.");
    if (tpl.identifierColumn < 0 || tpl.valueColumn < 0) {
      throw new Error("Choose both the identifier column and the attendance value column first.");
    }

    const outRows = tpl.rows.map((row) => {
      const newRow = [...row];
      const idValue = String(row[tpl.identifierColumn] ?? "").trim();
      const student = students.find((s) => {
        const field = tpl.identifierField === "name" ? s.name : s.schoolId;
        return String(field || "").trim() === idValue && idValue !== "";
      });
      if (student) {
        const record = this.getRecord(student.id, sessionId);
        newRow[tpl.valueColumn] = record.code || "";
      }
      return newRow;
    });

    const sheet = XLSX.utils.aoa_to_sheet([tpl.headers, ...outRows]);
    return XLSX.utils.sheet_to_csv(sheet);
  },

  // ----- Summary stats, computed from recorded sessions only -----

  stats(studentId) {
    let attended = 0;
    let absences = 0;
    let totalPoints = 0;
    let counted = 0;

    this.sessions.forEach((s) => {
      const rec = this.getRecord(studentId, s.id);
      if (!rec.code) return; // not yet recorded — excluded from the average
      counted++;
      if (rec.code === "A") absences++;
      else attended++;

      let pts = this.settings.points[rec.code] ?? 0;
      if (rec.infraction) pts += this.settings.infractionPoints[rec.infraction] ?? 0;
      totalPoints += pts;
    });

    // Percent is earned points out of the points actually possible across
    // the recorded sessions — not just a per-session count — so a
    // participation point value other than 1 (e.g. "P" worth 10 points)
    // doesn't distort the percentage.
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
