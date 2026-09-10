// ===== Seating chart module =====
// One seating chart per course, stored as seating-<courseId>.json.
// seats is a sparse map: "row-col" -> studentId. Missing key = empty desk.

const MAX_GRID_SIZE = 10;
const DEFAULT_GRID_SIZE = 6;

function clamp(n, min, max) {
  return Math.max(min, Math.min(max, n));
}

const SeatingModule = {
  rows: DEFAULT_GRID_SIZE,
  cols: DEFAULT_GRID_SIZE,
  seats: {},
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
    } else {
      this.rows = DEFAULT_GRID_SIZE;
      this.cols = DEFAULT_GRID_SIZE;
      this.seats = {};
    }
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      rows: this.rows,
      cols: this.cols,
      seats: this.seats,
    });
  },

  /** Resizing keeps any seats that still fall within the new bounds. */
  setSize(rows, cols) {
    rows = clamp(rows, 1, MAX_GRID_SIZE);
    cols = clamp(cols, 1, MAX_GRID_SIZE);
    const kept = {};
    for (const key in this.seats) {
      const [r, c] = key.split("-").map(Number);
      if (r < rows && c < cols) kept[key] = this.seats[key];
    }
    this.rows = rows;
    this.cols = cols;
    this.seats = kept;
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

  unseatAt(r, c) {
    delete this.seats[this.key(r, c)];
  },

  unseatStudent(studentId) {
    for (const key in this.seats) {
      if (this.seats[key] === studentId) delete this.seats[key];
    }
  },

  seatedStudentIds() {
    return new Set(Object.values(this.seats));
  },

  clear() {
    this.seats = {};
  },

  /** Fills empty desks, in row-major order, with the given student IDs. */
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
