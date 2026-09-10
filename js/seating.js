// ===== Seating chart module =====
// One seating chart per course, stored as seating-<courseId>.json.
//
// - seats: sparse map "row-col" -> studentId. Missing key = empty desk.
// - locks: sparse map "row-col" -> true. Only ever set on an occupied
//   desk; a locked desk is skipped by Clear Seating and by Auto-Fill.
// - groups: sparse map "row-col" -> group number (1-8). This is a
//   property of the DESK POSITION, not the student — it represents a
//   physical table-group color in the room, so it survives Clear
//   Seating and stays put even if the desk is empty or the student
//   assigned to it changes.

const MAX_GRID_SIZE = 10;
const MAX_BANKS = 6;
const DEFAULT_GRID_SIZE = 6;
const MAX_GROUP = 8;

// A cohesive 8-color palette. Used as a light background tint in the
// default theme, and as a border/glow color (over a dark fill) in the
// cyberpunk theme — see the [data-theme="cyberpunk"] .desk-grouped
// rule in style.css.
const GROUP_COLORS = [
  "#e8b4b8", // 1 dusty rose
  "#b4d8e8", // 2 dusty blue
  "#c8e8b4", // 3 sage green
  "#e8d8b4", // 4 wheat
  "#d4b4e8", // 5 lavender
  "#e8c8b4", // 6 peach
  "#b4e8d8", // 7 mint
  "#d8b4c8", // 8 mauve
];

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const SeatingModule = {
  rows: DEFAULT_GRID_SIZE,
  cols: DEFAULT_GRID_SIZE,
  seats: {},
  locks: {},
  groups: {},
  banks: new Array(MAX_BANKS).fill(null), // 6 memory-bank slots — see saveBank/loadBank/deleteBank below
  currentCourseId: null,

  fileName(courseId) {
    return `seating-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    if (data) {
      this.rows = clamp(data.rows || DEFAULT_GRID_SIZE, 1, MAX_GRID_SIZE);
      this.cols = clamp(data.cols || DEFAULT_GRID_SIZE, 1, MAX_GRID_SIZE);
      this.seats = data.seats || {};
      this.locks = data.locks || {};
      this.groups = data.groups || {};
      this.banks = this._normalizeBanks(data.banks);
    } else {
      this.rows = DEFAULT_GRID_SIZE;
      this.cols = DEFAULT_GRID_SIZE;
      this.seats = {};
      this.locks = {};
      this.groups = {};
      this.banks = new Array(MAX_BANKS).fill(null);
    }
  },

  /** Always returns an array of exactly MAX_BANKS slots, however the saved data looked. */
  _normalizeBanks(banks) {
    const arr = Array.isArray(banks) ? banks.slice(0, MAX_BANKS) : [];
    while (arr.length < MAX_BANKS) arr.push(null);
    return arr;
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      rows: this.rows,
      cols: this.cols,
      seats: this.seats,
      locks: this.locks,
      groups: this.groups,
      banks: this.banks,
    });
  },

  /** Resizing keeps any seats/locks/groups that still fall within the new bounds. */
  setSize(rows, cols) {
    rows = clamp(rows, 1, MAX_GRID_SIZE);
    cols = clamp(cols, 1, MAX_GRID_SIZE);
    const inBounds = (key) => {
      const [r, c] = key.split("-").map(Number);
      return r < rows && c < cols;
    };
    const filterMap = (map) => {
      const kept = {};
      for (const key in map) if (inBounds(key)) kept[key] = map[key];
      return kept;
    };
    this.seats = filterMap(this.seats);
    this.locks = filterMap(this.locks);
    this.groups = filterMap(this.groups);
    this.rows = rows;
    this.cols = cols;
  },

  key(r, c) {
    return `${r}-${c}`;
  },

  studentAt(r, c) {
    return this.seats[this.key(r, c)] || null;
  },

  /** Seats a student at (r, c), first removing them from any other seat. */
  seatStudent(r, c, studentId) {
    this.unseatStudent(studentId);
    this.seats[this.key(r, c)] = studentId;
  },

  /** Unseats whoever is at (r, c). No-op if that desk is locked. */
  unseatAt(r, c) {
    const key = this.key(r, c);
    if (this.locks[key]) return;
    delete this.seats[key];
    delete this.locks[key];
  },

  unseatStudent(studentId) {
    for (const key in this.seats) {
      if (this.seats[key] === studentId) {
        delete this.seats[key];
        delete this.locks[key];
      }
    }
  },

  seatedStudentIds() {
    return new Set(Object.values(this.seats));
  },

  isLocked(r, c) {
    return !!this.locks[this.key(r, c)];
  },

  /** Locking/unlocking only has meaning on an occupied desk. */
  toggleLock(r, c) {
    const key = this.key(r, c);
    if (!this.seats[key]) return;
    if (this.locks[key]) delete this.locks[key];
    else this.locks[key] = true;
  },

  getGroup(r, c) {
    return this.groups[this.key(r, c)] || 0;
  },

  /** Cycles a desk's group: none -> 1 -> 2 -> ... -> MAX_GROUP -> none. */
  cycleGroup(r, c) {
    const key = this.key(r, c);
    const next = (this.groups[key] || 0) + 1;
    if (next > MAX_GROUP) delete this.groups[key];
    else this.groups[key] = next;
  },

  /** Removes every unlocked student. Locked desks, and all group colors, are untouched. */
  clear() {
    for (const key in this.seats) {
      if (!this.locks[key]) delete this.seats[key];
    }
  },

  // ----- Memory banks -----
  // Each bank is a full snapshot of the grid (size + seats + locks +
  // groups). Save/Load/Delete all persist to Drive immediately, so a
  // bank action always sticks right away rather than waiting for a
  // separate "Save Seating Chart" click.

  bankIsEmpty(index) {
    return !this.banks[index];
  },

  async saveBank(index) {
    this.banks[index] = {
      rows: this.rows,
      cols: this.cols,
      seats: { ...this.seats },
      locks: { ...this.locks },
      groups: { ...this.groups },
      savedAt: new Date().toISOString(),
    };
    await this.save();
  },

  async loadBank(index) {
    const bank = this.banks[index];
    if (!bank) throw new Error("That memory bank is empty.");
    this.rows = bank.rows;
    this.cols = bank.cols;
    this.seats = { ...bank.seats };
    this.locks = { ...bank.locks };
    this.groups = { ...bank.groups };
    await this.save();
  },

  async deleteBank(index) {
    this.banks[index] = null;
    await this.save();
  },

  /** Fills empty desks, in row-major order, with the given student IDs. Locked desks are already occupied, so they're naturally skipped. */
  autoFill(studentIds) {
    let i = 0;
    for (let r = 0; r < this.rows && i < studentIds.length; r++) {
      for (let c = 0; c < this.cols && i < studentIds.length; c++) {
        if (!this.studentAt(r, c)) {
          this.seats[this.key(r, c)] = studentIds[i++];
        }
      }
    }
  },
};

// Exposed on window so the read-only pop-out window (popout.html) can
// read live data from this window via window.opener, without needing
// its own Google sign-in or a duplicate copy of the data.
window.SeatingModule = SeatingModule;
window.GROUP_COLORS = GROUP_COLORS;
window.MAX_GROUP = MAX_GROUP;
