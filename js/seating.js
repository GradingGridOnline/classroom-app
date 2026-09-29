// ===== Seating chart module =====
// One seating chart per course, stored as seating-<courseId>.json.
//
// Every grid cell starts INACTIVE — meaning no desk exists there yet.
// Clicking an inactive cell activates it; only an active desk can hold
// a student, a lock, a group color, or a label.
//
// - active: sparse map "row-col" -> true. Whether a desk exists here.
// - seats:  sparse map "row-col" -> studentId. Missing key = empty desk.
// - locks:  sparse map "row-col" -> true. Only ever set on an occupied
//   desk; a locked desk is skipped by Clear Seating and by Auto-Fill.
// - groups: sparse map "row-col" -> group number (1-MAX_GROUP). A
//   property of the DESK POSITION, not the student — represents a
//   physical table-group color in the room, so it survives Clear
//   Seating and stays put even if the desk is empty.
// - labels: sparse map "row-col" -> free-text note (e.g. "do not sit
//   here"). Also a desk-position property, survives Clear Seating.
// Deactivating a desk clears all four of the above for that position.

const MAX_GRID_SIZE = 10;
const MAX_BANKS = 6;
const DEFAULT_GRID_SIZE = 6;
const MAX_GROUP = 20;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

/** Hue (degrees, 0-360) for a group number. Steps by the golden angle
 * (~137.5°) rather than dividing the wheel evenly by MAX_GROUP —
 * evenly-spaced steps put neighboring group numbers right next to
 * each other on the color wheel (e.g. 18° apart at MAX_GROUP=20),
 * which is what made them hard to tell apart. The golden angle scatters
 * each successive hue far from the last regardless of MAX_GROUP, while
 * still filling the wheel evenly overall. */
const GROUP_HUE_STEP_DEG = 137.508;
function groupHueDeg(group) {
  return Math.round((group * GROUP_HUE_STEP_DEG) % 360);
}

const SeatingModule = {
  rows: DEFAULT_GRID_SIZE,
  cols: DEFAULT_GRID_SIZE,
  active: {},
  seats: {},
  locks: {},
  groups: {},
  labels: {},
  banks: SeatingModule_defaultBanks(),
  showGroupsInPopout: true,
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
      this.labels = data.labels || {};
      // Backward compatibility: charts saved before the "active desk"
      // system existed have no `active` map at all. Treat every
      // position that already has a seat, lock, or group as active,
      // so nothing already saved appears to vanish.
      if (data.active) {
        this.active = data.active;
      } else {
        this.active = {};
        for (const key of new Set([
          ...Object.keys(this.seats),
          ...Object.keys(this.locks),
          ...Object.keys(this.groups),
        ])) {
          this.active[key] = true;
        }
      }
      this.banks = this._normalizeBanks(data.banks);
      this.showGroupsInPopout = data.showGroupsInPopout !== false; // default true
    } else {
      this.rows = DEFAULT_GRID_SIZE;
      this.cols = DEFAULT_GRID_SIZE;
      this.active = {};
      this.seats = {};
      this.locks = {};
      this.groups = {};
      this.labels = {};
      this.banks = SeatingModule_defaultBanks();
      this.showGroupsInPopout = true;
    }
  },

  /** Always returns an array of exactly MAX_BANKS { name, snapshot } slots, migrating older saved shapes. */
  _normalizeBanks(banks) {
    const arr = Array.isArray(banks) ? banks.slice(0, MAX_BANKS) : [];
    const normalized = arr.map((entry, i) => {
      if (!entry) return { name: `Bank ${i + 1}`, snapshot: null };
      if ("snapshot" in entry) return entry; // already the current shape
      return { name: `Bank ${i + 1}`, snapshot: entry }; // old shape: a bare snapshot
    });
    while (normalized.length < MAX_BANKS) {
      normalized.push({ name: `Bank ${normalized.length + 1}`, snapshot: null });
    }
    return normalized;
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      rows: this.rows,
      cols: this.cols,
      active: this.active,
      seats: this.seats,
      locks: this.locks,
      groups: this.groups,
      labels: this.labels,
      banks: this.banks,
      showGroupsInPopout: this.showGroupsInPopout,
    });
  },

  /** Only flips the flag locally — persisting it is left to the explicit "Save Seating Chart" button, like every other seating change. */
  toggleShowGroupsInPopout() {
    this.showGroupsInPopout = !this.showGroupsInPopout;
  },

  /** Resizing keeps anything that still falls within the new bounds. */
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
    this.active = filterMap(this.active);
    this.seats = filterMap(this.seats);
    this.locks = filterMap(this.locks);
    this.groups = filterMap(this.groups);
    this.labels = filterMap(this.labels);
    this.rows = rows;
    this.cols = cols;
  },

  /**
   * Removes any row or column that currently has zero active desks
   * anywhere in it, shifting the remaining rows/columns together so
   * every existing desk (and its seat/lock/group/label) keeps its
   * same relative position — just renumbered to close the gap. A
   * no-op if every row and column already has at least one desk, or
   * if there are no active desks at all (nothing meaningful to keep).
   * Returns true if anything was actually trimmed.
   */
  trimEmptyRowsAndColumns() {
    const usedRows = new Set();
    const usedCols = new Set();
    for (const key in this.active) {
      const [r, c] = key.split("-").map(Number);
      usedRows.add(r);
      usedCols.add(c);
    }
    if (usedRows.size === 0 || usedCols.size === 0) return false;

    const keepRows = [];
    for (let r = 0; r < this.rows; r++) if (usedRows.has(r)) keepRows.push(r);
    const keepCols = [];
    for (let c = 0; c < this.cols; c++) if (usedCols.has(c)) keepCols.push(c);

    if (keepRows.length === this.rows && keepCols.length === this.cols) return false;

    const rowIndex = new Map(keepRows.map((oldR, newR) => [oldR, newR]));
    const colIndex = new Map(keepCols.map((oldC, newC) => [oldC, newC]));

    const remap = (map) => {
      const result = {};
      for (const key in map) {
        const [r, c] = key.split("-").map(Number);
        if (rowIndex.has(r) && colIndex.has(c)) {
          result[`${rowIndex.get(r)}-${colIndex.get(c)}`] = map[key];
        }
      }
      return result;
    };

    this.active = remap(this.active);
    this.seats = remap(this.seats);
    this.locks = remap(this.locks);
    this.groups = remap(this.groups);
    this.labels = remap(this.labels);
    this.rows = keepRows.length;
    this.cols = keepCols.length;
    return true;
  },

  key(r, c) {
    return `${r}-${c}`;
  },

  isActive(r, c) {
    return !!this.active[this.key(r, c)];
  },

  activate(r, c) {
    this.active[this.key(r, c)] = true;
  },

  /** Removes the desk entirely: clears active, seat, lock, group, and label for this position. */
  deactivate(r, c) {
    const key = this.key(r, c);
    delete this.active[key];
    delete this.seats[key];
    delete this.locks[key];
    delete this.groups[key];
    delete this.labels[key];
  },

  studentAt(r, c) {
    return this.seats[this.key(r, c)] || null;
  },

  /** Seats a student at (r, c) — the desk must already be active. First removes them from any other seat. */
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

  /** Sets a desk's group (1-MAX_GROUP). 0 or blank clears it. */
  setGroup(r, c, value) {
    const key = this.key(r, c);
    const n = Math.round(Number(value));
    if (!n || n < 1) {
      delete this.groups[key];
    } else {
      this.groups[key] = clamp(n, 1, MAX_GROUP);
    }
  },

  getLabel(r, c) {
    return this.labels[this.key(r, c)] || "";
  },

  setLabel(r, c, text) {
    const key = this.key(r, c);
    const trimmed = (text || "").trim();
    if (trimmed) this.labels[key] = trimmed;
    else delete this.labels[key];
  },

  /** Removes every unlocked student. Locked desks, and all group colors/labels, are untouched. */
  clear() {
    for (const key in this.seats) {
      if (!this.locks[key]) delete this.seats[key];
    }
  },

  // ----- Memory banks -----
  // Each bank is { name, snapshot }. snapshot is a full grid capture
  // (size + active + seats + locks + groups + labels) or null if
  // that slot hasn't been saved into yet. A slot's name persists
  // independently of its snapshot, so you can label a slot before
  // ever saving into it. Save/Load/Delete/Rename all persist to
  // Drive immediately, rather than waiting for a separate "Save
  // Seating Chart" click — this is a deliberate exception to the
  // rest of the app's deferred-save convention, since saving into (or
  // loading from) a named slot IS itself the explicit save action,
  // not an incidental side effect of editing something else.

  bankIsEmpty(index) {
    return !this.banks[index].snapshot;
  },

  async saveBank(index) {
    this.banks[index].snapshot = {
      rows: this.rows,
      cols: this.cols,
      active: { ...this.active },
      seats: { ...this.seats },
      locks: { ...this.locks },
      groups: { ...this.groups },
      labels: { ...this.labels },
      savedAt: new Date().toISOString(),
    };
    await this.save();
  },

  2. js/seating.js (4 deletions)
Find await this.save(); inside saveBank, loadBank, deleteBank, and renameBank (the four methods under "Memory banks"). Delete that line in each. Leave the one in the main save() method alone.


  /** Fills empty ACTIVE desks only, in row-major order, with the given student IDs shuffled into random order first. Desks carrying a label (e.g. "do not sit here") are skipped, same as locked and inactive desks. */
  autoFill(studentIds) {
    const shuffled = [...studentIds];
    for (let i = shuffled.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    let i = 0;
    for (let r = 0; r < this.rows && i < shuffled.length; r++) {
      for (let c = 0; c < this.cols && i < shuffled.length; c++) {
        if (this.isActive(r, c) && !this.studentAt(r, c) && !this.getLabel(r, c)) {
          this.seats[this.key(r, c)] = shuffled[i++];
        }
      }
    }
  },

  /**
   * Fills empty ACTIVE desks only, in ascending Class Number order,
   * traversing the grid column by column left-to-right, and within
   * each column bottom-to-top (row index descending) — i.e. starting
   * at the bottom-left desk, filling upward, then moving one column
   * right and repeating. Desks carrying a label are skipped, same as
   * locked and inactive desks. `students` are full student objects
   * (not bare ids), since sorting needs each one's classNumber.
   */
  autoFillNumericalOrder(students) {
    const sorted = [...students].sort(
      (a, b) => (a.classNumber || Infinity) - (b.classNumber || Infinity)
    );
    let i = 0;
    for (let c = 0; c < this.cols && i < sorted.length; c++) {
      for (let r = this.rows - 1; r >= 0 && i < sorted.length; r--) {
        if (this.isActive(r, c) && !this.studentAt(r, c) && !this.getLabel(r, c)) {
          this.seats[this.key(r, c)] = sorted[i++].id;
        }
      }
    }
  },
};

function SeatingModule_defaultBanks() {
  const arr = [];
  for (let i = 0; i < MAX_BANKS; i++) arr.push({ name: `Bank ${i + 1}`, snapshot: null });
  return arr;
}

// Exposed on window so the read-only pop-out window (popout.html) can
// read live data from this window via window.opener, without needing
// its own Google sign-in or a duplicate copy of the data.
window.SeatingModule = SeatingModule;
window.MAX_GROUP = MAX_GROUP;
window.groupHueDeg = groupHueDeg;
