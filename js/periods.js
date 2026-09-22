// ===== Periods module =====
// Global (not per-course) list of class periods — e.g. "Period 1" running
// 9:00-10:30 — managed from Global Settings. A course is then assigned one
// of these periods (see CoursesModule.setPeriod), so its schedule info
// (period name + time) can be reused across every course that meets then,
// rather than re-entered per course. Stored as a single top-level file:
// periods.json — shared across every course, same as courses.json.

const MAX_PERIODS = 20;

const PeriodsModule = {
  periods: [], // [{ id, name, startTime, endTime }]

  async load() {
    const data = await storage.loadFile("periods.json");
    this.periods = data && Array.isArray(data.periods) ? data.periods : [];
    return this.periods;
  },

  async save() {
    await storage.saveFile("periods.json", { periods: this.periods });
  },

  add(name, startTime, endTime) {
    const trimmed = (name || "").trim();
    if (!trimmed) throw new Error("Period name can't be empty.");
    if (this.periods.length >= MAX_PERIODS) {
      throw new Error(`You've reached the limit of ${MAX_PERIODS} periods.`);
    }
    const period = {
      id: `period-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
      startTime: startTime || "",
      endTime: endTime || "",
    };
    this.periods.push(period);
    return period;
  },

  update(id, fields) {
    const period = this.find(id);
    if (!period) return;
    if (typeof fields.name === "string") {
      const trimmed = fields.name.trim();
      if (trimmed) period.name = trimmed;
    }
    if (typeof fields.startTime === "string") period.startTime = fields.startTime;
    if (typeof fields.endTime === "string") period.endTime = fields.endTime;
  },

  remove(id) {
    this.periods = this.periods.filter((p) => p.id !== id);
  },

  find(id) {
    return this.periods.find((p) => p.id === id) || null;
  },

  /** "Period 2 (9:00-10:30)"-style label, for dropdowns and printouts. Falls back gracefully if start/end times aren't set. */
  label(id) {
    const period = this.find(id);
    if (!period) return "";
    const time = period.startTime && period.endTime ? ` (${period.startTime}-${period.endTime})` : "";
    return `${period.name}${time}`;
  },
};

// Exposed for the read-only pop-out window and print sheets that need
// period/time info without a full module load.
window.PeriodsModule = PeriodsModule;
