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

/** Hue (degrees, 0-360) for a group number — used by a CSS custom property rather than a fixed color list, so it scales cleanly to any MAX_GROUP. */
function groupHueDeg(group) {
  return Math.round(((group - 1) * 360) / MAX_GROUP);
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
    } else {
      this.rows = DEFAULT_GRID_SIZE;
      this.cols = DEFAULT_GRID_SIZE;
      this.active = {};
      this.seats = {};
      this.locks = {};
      this.groups = {};
      this.labels = {};
      this.banks = SeatingModule_defaultBanks();
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
    });
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
  // Seating Chart" click.

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

  async loadBank(index) {
    const snapshot = this.banks[index].snapshot;
    if (!snapshot) throw new Error("That memory bank is empty.");
    this.rows = snapshot.rows;
    this.cols = snapshot.cols;
    this.active = { ...(snapshot.active || {}) };
    this.seats = { ...snapshot.seats };
    this.locks = { ...snapshot.locks };
    this.groups = { ...snapshot.groups };
    this.labels = { ...(snapshot.labels || {}) };
    await this.save();
  },

  async deleteBank(index) {
    this.banks[index].snapshot = null;
    await this.save();
  },

  async renameBank(index, name) {
    const trimmed = (name || "").trim();
    this.banks[index].name = trimmed || `Bank ${index + 1}`;
    await this.save();
  },

  /** Fills empty ACTIVE desks only, in row-major order, with the given student IDs. */
  autoFill(studentIds) {
    let i = 0;
    for (let r = 0; r < this.rows && i < studentIds.length; r++) {
      for (let c = 0; c < this.cols && i < studentIds.length; c++) {
        if (this.isActive(r, c) && !this.studentAt(r, c)) {
          this.seats[this.key(r, c)] = studentIds[i++];
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
