// ===== Roster module =====
// Handles the student list for whichever course is currently open.
// Each student is { id, name, schoolId, pronunciation }.
// Stored as one file per course: roster-<courseId>.json

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
    return this.students;
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      students: this.students,
    });
  },

  addStudent(fields = {}) {
    if (this.students.length >= MAX_STUDENTS) {
      throw new Error(`This course is at the ${MAX_STUDENTS}-student limit.`);
    }
    const student = {
      id: `student-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
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

  /** Replaces the entire roster (used after a CSV/Excel import). */
  replaceAll(students) {
    if (students.length > MAX_STUDENTS) {
      throw new Error(
        `This file has ${students.length} students, which is more than the ${MAX_STUDENTS}-student limit. Trim the file and try again.`
      );
    }
    this.students = students.map((s) => ({
      id: `student-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: s.name || "",
      schoolId: s.schoolId || "",
      pronunciation: s.pronunciation || "",
    }));
  },

  remainingSlots() {
    return MAX_STUDENTS - this.students.length;
  },
};
