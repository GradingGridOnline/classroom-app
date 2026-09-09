// ===== Courses module =====
// Handles the list of courses (up to MAX_COURSES). Each course is just
// { id, name } — the seating grid size and roster live in their own
// per-course files, added in later features.

const MAX_COURSES = 20;

const CoursesModule = {
  courses: [],

  async load() {
    const data = await storage.loadFile("courses.json");
    this.courses = data && Array.isArray(data.courses) ? data.courses : [];
    return this.courses;
  },

  async save() {
    await storage.saveFile("courses.json", { courses: this.courses });
  },

  add(name) {
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Course name can't be empty.");
    if (this.courses.length >= MAX_COURSES) {
      throw new Error(`You've reached the limit of ${MAX_COURSES} courses.`);
    }
    const course = {
      id: `course-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: trimmed,
    };
    this.courses.push(course);
    return course;
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
};
