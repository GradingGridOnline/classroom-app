// ===== Courses module =====
// Handles the list of courses (up to MAX_COURSES). Each course is
// { id, name, periodId, archived, templateId } — the seating grid,
// roster, etc. live in their own per-course files.
//
// - archived: true moves a course out of the main list into the
//   "Archived Courses" section (nothing is deleted).
// - templateId: the id of the template this course is linked to (its
//   structure mirrors that template), or null for a standalone course.
// - Display order: `sortMode` is "manual" (the order of the `courses`
//   array, changed with the up/down buttons), "name" (A-Z), or
//   "period" (by the period's start time). Only manual order is ever
//   stored in the array itself; the other two are computed on the fly.

const MAX_COURSES = 20;

// Every file that belongs to a single course is named "<prefix>-<courseId>.json".
// Duplicating a course copies each of these. (Email-collection form
// tracking is deliberately left out — it points at one real Google Form.)
const COURSE_DATA_PREFIXES = ["roster", "seating", "attendance", "scoring", "reportcard"];

const COURSE_SORT_MODES = {
  manual: "Custom order",
  name: "Name (A–Z)",
  period: "Period",
};

const CoursesModule = {
  courses: [],
  sortMode: "manual",
  // How a course's day of the week is written everywhere: style "full" (Monday) or "short" (Mon); hyphen between day and period.
  dayFormat: { style: "full", hyphen: true },
  DAYS_FULL: ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"],
  DAYS_SHORT: ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"],

  /** A day number (0 = Sunday … 6 = Saturday) as text in the chosen style; "" if none. */
  dayName(day) {
    if (day === null || day === undefined || day === "" || !(day >= 0 && day <= 6)) return "";
    return (this.dayFormat.style === "short" ? this.DAYS_SHORT : this.DAYS_FULL)[Number(day)];
  },

  /** "Monday-Period 2" / "Mon Period 2" / just the day or just the period, per the global day format; "" if the course has neither. */
  scheduleName(course) {
    if (!course) return "";
    const day = this.dayName(course.weekday);
    const period = course.periodId && window.PeriodsModule ? PeriodsModule.find(course.periodId) : null;
    const pn = period ? period.name : "";
    return day && pn ? day + (this.dayFormat.hyphen ? "-" : " ") + pn : day || pn;
  },

  /** scheduleName plus the period's times, e.g. "Mon-Period 2 (09:00–10:30)". */
  scheduleLine(course) {
    const name = this.scheduleName(course);
    const period = course && course.periodId && window.PeriodsModule ? PeriodsModule.find(course.periodId) : null;
    const time = period ? (period.startTime && period.endTime ? `${period.startTime}–${period.endTime}` : period.startTime || period.endTime || "") : "";
    return time ? `${name} (${time})` : name;
  },

  async load() {
    const data = await storage.loadFile("courses.json");
    this.courses = data && Array.isArray(data.courses) ? data.courses : [];
    this.sortMode = data && COURSE_SORT_MODES[data.sortMode] ? data.sortMode : "manual";
    const df = data && data.dayFormat && typeof data.dayFormat === "object" ? data.dayFormat : {};
    this.dayFormat = { style: df.style === "short" ? "short" : "full", hyphen: df.hyphen !== false };
    this._backfill();
    return this.courses;
  },

  /** Ensures courses saved before period assignment / archiving / template links existed get sensible defaults. */
  _backfill() {
    this.courses.forEach((c) => {
      if (!("periodId" in c)) c.periodId = null;
      if (!(c.weekday >= 0 && c.weekday <= 6)) c.weekday = null;
      if (typeof c.archived !== "boolean") c.archived = false;
      if (!("templateId" in c)) c.templateId = null;
    });
  },

  async save() {
    await storage.saveFile("courses.json", { courses: this.courses, sortMode: this.sortMode, dayFormat: this.dayFormat });
  },

  _newId() {
    return `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  },

  add(name) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Course name can't be empty.");
    if (this.courses.length >= MAX_COURSES) {
      throw new Error(`You've reached the limit of ${MAX_COURSES} courses.`);
    }
    const course = { id: this._newId(), name: trimmed, periodId: null, archived: false, templateId: null };
    this.courses.push(course);
    return course;
  },

  /** Sets (or clears, with "" / null) the day of the week a course meets: 0 = Sunday … 6 = Saturday. */
  setWeekday(id, day) {
    const course = this.find(id);
    if (course) course.weekday = day === "" || day === null || day === undefined ? null : Number(day);
  },

  /** Assigns (or clears, with null) which global Period this course meets during. */
  setPeriod(id, periodId) {
    const course = this.find(id);
    if (course) course.periodId = periodId || null;
  },

  /** Links the course to a template (or, with null, makes it standalone). Only records the link — see TemplatesModule.linkCourse for the rest. */
  setTemplate(id, templateId) {
    const course = this.find(id);
    if (course) course.templateId = templateId || null;
  },

  rename(id, name) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Course name can't be empty.");
    const course = this.find(id);
    if (course) course.name = trimmed;
  },

  remove(id) {
    this.courses = this.courses.filter((c) => c.id !== id);
  },

  find(id) {
    return this.courses.find((c) => c.id === id);
  },

  // ----- Archiving -----

  setArchived(id, archived) {
    const course = this.find(id);
    if (course) course.archived = !!archived;
  },

  archivedCourses() {
    return this.courses.filter((c) => c.archived);
  },

  // ----- Display order -----

  /** The non-archived courses, in the order they should be shown for the current sort mode. */
  activeCourses() {
    const active = this.courses.filter((c) => !c.archived);

    if (this.sortMode === "name") {
      return [...active].sort((a, b) =>
        a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
      );
    }

    if (this.sortMode === "period") {
      const periods = (window.PeriodsModule && window.PeriodsModule.periods) || [];
      const info = (course) => {
        const idx = periods.findIndex((p) => p.id === course.periodId);
        if (idx === -1) return { has: false };
        return { has: true, time: periods[idx].startTime || "99:99", idx, day: course.weekday >= 0 ? ((course.weekday + 6) % 7) + 1 : 0 }; // Monday first; no day sorts first
      };
      return [...active].sort((a, b) => {
        const ia = info(a);
        const ib = info(b);
        if (ia.has !== ib.has) return ia.has ? -1 : 1; // courses with no period go last
        if (ia.has) {
          if (ia.day !== ib.day) return ia.day - ib.day;
          if (ia.time !== ib.time) return ia.time < ib.time ? -1 : 1;
          if (ia.idx !== ib.idx) return ia.idx - ib.idx;
        }
        return a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" });
      });
    }

    return active; // manual: the array order
  },

  /** Switches the sort mode. Going from an automatic order to "manual" freezes the order currently on screen as the starting manual order, so nothing jumps around. */
  setSortMode(mode) {
    if (!COURSE_SORT_MODES[mode]) return;
    if (mode === "manual" && this.sortMode !== "manual") {
      const displayed = this.activeCourses();
      this.courses = [...displayed, ...this.courses.filter((c) => c.archived)];
    }
    this.sortMode = mode;
  },

  /** Manual mode only: moves a course one place up (direction -1) or down (+1) among the non-archived courses. */
  move(id, direction) {
    if (this.sortMode !== "manual") return;
    const active = this.courses.filter((c) => !c.archived);
    const i = active.findIndex((c) => c.id === id);
    const j = i + direction;
    if (i < 0 || j < 0 || j >= active.length) return;
    const a = this.courses.indexOf(active[i]);
    const b = this.courses.indexOf(active[j]);
    [this.courses[a], this.courses[b]] = [this.courses[b], this.courses[a]];
  },

  // ----- Duplicating -----

  /**
   * Copies a course and everything saved for it (roster, seating chart,
   * attendance, scoring, report card settings) into a new course named
   * "<name> (copy)", placed right after the original (and linked to the
   * same template, if any). Copies what was last SAVED to Google Drive.
   * This is an explicit action, so the copied files — and the course
   * list — are written immediately.
   */
  async duplicate(id) {
    const source = this.find(id);
    if (!source) throw new Error("That course no longer exists.");
    if (this.courses.length >= MAX_COURSES) {
      throw new Error(`You've reached the limit of ${MAX_COURSES} courses.`);
    }

    const copy = {
      id: this._newId(),
      name: `${source.name} (copy)`,
      periodId: source.periodId,
      weekday: source.weekday === undefined ? null : source.weekday,
      archived: false,
      templateId: source.templateId || null,
    };

    for (const prefix of COURSE_DATA_PREFIXES) {
      const data = await storage.loadFile(`${prefix}-${id}.json`);
      if (data) await storage.saveFile(`${prefix}-${copy.id}.json`, data);
    }

    this.courses.splice(this.courses.indexOf(source) + 1, 0, copy);
    await this.save();
    return copy;
  },
};

// Exposed for the read-only pop-out window (popout.html) — see seating.js.
window.CoursesModule = CoursesModule;
