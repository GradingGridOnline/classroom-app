// ===== Journal module (data) =====
// One file per course: journal-<courseId>.json
//  - entries: [{ id, date "YYYY-MM-DD", subject, text, rich, students:[studentId], tags:[string], mode "entry"|"list", done, sharedWith:[courseId], syncedTo:[courseId], createdAt, updatedAt }]
//    An entry shared with other courses has the same id in each course's file; syncShared() copies it (students stay per course).
//  - settings: { tags:[string] (the quick-pick tag list), snapshots:boolean (show attendance/score beside entries) }
// The screen lives in journalui.js. Loaded BEFORE app.js so Autosave can include it.
const JournalModule = {
  entries: [],
  settings: { tags: [], snapshots: true },
  currentCourseId: null,

  fileName(courseId) { return `journal-${courseId}.json`; },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    this.entries = data && Array.isArray(data.entries) ? data.entries : [];
    const s = (data && data.settings) || {};
    this.settings = { tags: Array.isArray(s.tags) ? s.tags : [], snapshots: s.snapshots !== false };
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), { entries: this.entries, settings: this.settings });
  },

  /** Formatting (bold, colour, caps…) kept next to the plain text, cleaned to a safe subset. */
  cleanRich(r) { return r && window.QuizRich ? QuizRich.clean(r) : ""; },

  newId() { return `jr-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`; },

  addEntry({ date, subject, text, rich, students, tags, mode, done, sharedWith }) {
    const now = new Date().toISOString();
    const e = { id: this.newId(), date, subject: (subject || "").trim(), text: (text || "").trim(), rich: this.cleanRich(rich), students: [...(students || [])], tags: this.cleanTags(tags), mode: mode === "list" ? "list" : "entry", done: mode === "list" && !!done, sharedWith: this.cleanIds(sharedWith), syncedTo: [], createdAt: now, updatedAt: now };
    this.entries.push(e);
    return e;
  },

  updateEntry(id, { date, subject, text, rich, students, tags, mode, done, sharedWith }) {
    const e = this.entries.find((x) => x.id === id);
    if (!e) return null;
    e.date = date; e.subject = (subject || "").trim(); e.text = (text || "").trim(); e.rich = this.cleanRich(rich); e.students = [...(students || [])]; e.tags = this.cleanTags(tags);
    e.mode = mode === "list" ? "list" : "entry"; e.done = e.mode === "list" && !!done; e.sharedWith = this.cleanIds(sharedWith);
    e.updatedAt = new Date().toISOString();
    return e;
  },

  removeEntry(id) { this.entries = this.entries.filter((e) => e.id !== id); },

  setPinned(id, v) { const e = this.entries.find((x) => x.id === id); if (e) { e.pinned = !!v; e.updatedAt = new Date().toISOString(); } return e; },

  cleanIds(ids) { return [...new Set((ids || []).filter((x) => x && x !== this.currentCourseId))]; },

  /** Copies a shared entry into the other courses it is shared with (and removes it from courses it was taken out of). Returns the course ids that failed. */
  async syncShared(e) {
    const here = this.currentCourseId, targets = this.cleanIds(e.sharedWith);
    const removed = (e.syncedTo || []).filter((id) => !targets.includes(id));
    const members = [here, ...targets], failed = [];
    for (const id of removed) {
      try {
        const d = await storage.loadFile(this.fileName(id));
        if (d && Array.isArray(d.entries)) { d.entries = d.entries.filter((x) => x.id !== e.id); await storage.saveFile(this.fileName(id), d); }
      } catch (err) { failed.push(id); }
    }
    for (const id of targets) {
      try {
        const d = (await storage.loadFile(this.fileName(id))) || {};
        const entries = Array.isArray(d.entries) ? d.entries : [];
        const copy = JSON.parse(JSON.stringify(e));
        copy.sharedWith = members.filter((x) => x !== id); copy.syncedTo = copy.sharedWith.slice(); copy.students = []; copy.pinned = false;
        const i = entries.findIndex((x) => x.id === e.id);
        if (i >= 0) { copy.students = entries[i].students || []; copy.pinned = !!entries[i].pinned; entries[i] = copy; } else entries.push(copy);
        await storage.saveFile(this.fileName(id), { entries, settings: d.settings || { tags: [], snapshots: true } });
      } catch (err) { failed.push(id); }
    }
    e.syncedTo = targets.filter((id) => !failed.includes(id));
    return failed;
  },

  /** Removes a shared entry from the other courses too. */
  async removeShared(e) {
    for (const id of e.sharedWith || []) {
      try {
        const d = await storage.loadFile(this.fileName(id));
        if (d && Array.isArray(d.entries)) { d.entries = d.entries.filter((x) => x.id !== e.id); await storage.saveFile(this.fileName(id), d); }
      } catch (err) { /* that course keeps its copy */ }
    }
  },

  cleanTags(tags) {
    const seen = new Set(); const out = [];
    (tags || []).forEach((t) => { const v = String(t).trim().replace(/^#/, ""); const k = v.toLowerCase(); if (v && !seen.has(k)) { seen.add(k); out.push(v); } });
    return out;
  },

  /** Every tag in use or in the quick-pick list, alphabetical. */
  allTags() {
    const m = new Map();
    [...this.settings.tags, ...this.entries.flatMap((e) => e.tags || [])].forEach((t) => { if (!m.has(t.toLowerCase())) m.set(t.toLowerCase(), t); });
    return [...m.values()].sort((a, b) => a.localeCompare(b));
  },

  addSettingsTag(tag) { this.settings.tags = this.cleanTags([...this.settings.tags, tag]); },
  removeSettingsTag(tag) { this.settings.tags = this.settings.tags.filter((t) => t.toLowerCase() !== tag.toLowerCase()); },

  /** Entries matching { from, to, tag, student, word }, newest first. */
  search({ from, to, tag, student, word } = {}) {
    const w = (word || "").trim().toLowerCase();
    return this.entries.filter((e) =>
      (!from || e.date >= from) && (!to || e.date <= to) &&
      (!tag || (e.tags || []).some((t) => t.toLowerCase() === tag.toLowerCase())) &&
      (!student || (e.students || []).includes(student)) &&
      (!w || (e.text || "").toLowerCase().includes(w) || (e.subject || "").toLowerCase().includes(w) || (e.tags || []).some((t) => t.toLowerCase().includes(w)))
    ).sort((a, b) => b.date.localeCompare(a.date) || (b.createdAt || "").localeCompare(a.createdAt || ""));
  },
};
