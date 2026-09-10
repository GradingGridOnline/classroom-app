// ===== Roster module =====
// Handles the student list for whichever course is currently open.
// Each student is { id, classNumber, name, schoolId, pronunciation }.
// Stored as one file per course: roster-<courseId>.json
//
// classNumber (1-MAX_STUDENTS) is a stable roll-call number that
// stays with a student once assigned — it's independent of schoolId
// (the university's own ID) and independent of list order. It's
// assigned automatically (lowest number not already in use) when a
// student is added or imported, but can be hand-edited afterward.

const MAX_STUDENTS = 100;

const RosterModule = {
  students: [],
  currentCourseId: null,

  fileName(courseId) {
    return `roster-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    this.students = data && Array.isArray(data.students) ? data.students : [];
    this._backfillClassNumbers();
    return this.students;
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      students: this.students,
    });
  },

  /** Assigns a Class Number to any student missing one (e.g. roster data saved before this feature existed). */
  _backfillClassNumbers() {
    this.students.forEach((s) => {
      if (!s.classNumber) s.classNumber = this.nextAvailableClassNumber();
    });
  },

  /** The lowest Class Number (1-MAX_STUDENTS) not currently in use. */
  nextAvailableClassNumber() {
    const used = new Set(this.students.map((s) => s.classNumber).filter(Boolean));
    for (let n = 1; n <= MAX_STUDENTS; n++) {
      if (!used.has(n)) return n;
    }
    return null; // every number 1-100 is taken
  },

  /** True if that Class Number is already used by a different student. */
  isClassNumberTaken(n, excludingStudentId) {
    return this.students.some((s) => s.classNumber === n && s.id !== excludingStudentId);
  },

  addStudent(fields = {}) {
    if (this.students.length >= MAX_STUDENTS) {
      throw new Error(`This course is at the ${MAX_STUDENTS}-student limit.`);
    }
    const student = {
      id: `student-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      classNumber: fields.classNumber || this.nextAvailableClassNumber(),
      name: fields.name || "",
      schoolId: fields.schoolId || "",
      pronunciation: fields.pronunciation || "",
    };
    this.students.push(student);
    return student;
  },

  removeStudent(id) {
    this.students = this.students.filter((s) => s.id !== id);
  },

  updateStudent(id, fields) {
    const student = this.students.find((s) => s.id === id);
    if (student) Object.assign(student, fields);
  },

  /**
   * Replaces the entire roster (used after a CSV/Excel import).
   * If the file supplied a class number for a row, that's used
   * (clamped to 1-MAX_STUDENTS); otherwise one is auto-assigned in
   * file order.
   */
  replaceAll(students) {
    if (students.length > MAX_STUDENTS) {
      throw new Error(
        `This file has ${students.length} students, which is more than the ${MAX_STUDENTS}-student limit. Trim the file and try again.`
      );
    }

    // Pass 1: reserve every valid, non-duplicate class number the file
    // itself provided, so a later auto-assigned row can't accidentally
    // steal a number an earlier row explicitly wanted.
    const used = new Set();
    const provided = students.map((s) => {
      const parsed = Number(s.classNumber);
      if (parsed && parsed >= 1 && parsed <= MAX_STUDENTS && !used.has(parsed)) {
        used.add(parsed);
        return parsed;
      }
      return null;
    });

    // Pass 2: fill in the rest in file order.
    const assignNext = () => {
      for (let n = 1; n <= MAX_STUDENTS; n++) {
        if (!used.has(n)) {
          used.add(n);
          return n;
        }
      }
      return null;
    };

    this.students = students.map((s, i) => ({
      id: `student-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      classNumber: provided[i] || assignNext(),
      name: s.name || "",
      schoolId: s.schoolId || "",
      pronunciation: s.pronunciation || "",
    }));
  },

  remainingSlots() {
    return MAX_STUDENTS - this.students.length;
  },
};

// Exposed for the read-only pop-out window (popout.html) — see seating.js.
window.RosterModule = RosterModule;
