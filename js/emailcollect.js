// ===== Email collection module =====
// Collects students' email addresses with our own page (collect.html) instead
// of a Google Form. One file per course: emailcollect-<courseId>.json — it just
// remembers which collection (if any) is currently open for this course.
//
// Flow:
//   1. createForm() saves a "collection" in Supabase: a random secret token
//      plus the School IDs on the roster. The QR code points to
//      collect.html?c=<token>.
//   2. A student scans the QR code, must type a School ID that is on the
//      list, and only then gets to enter their email. The server checks the
//      ID (see sql/collect-setup.sql) — students never see the ID list.
//   3. syncResponses() reads the saved answers, matches each to a student by
//      School ID, and returns the matches for the caller to write into the
//      roster. The collection stays open, so syncing again later just picks
//      up whatever came in since. (It also refreshes the allowed-ID list from
//      the current roster, so students added later can answer too.)
//   4. deleteForm() closes the collection and deletes its answers — the QR
//      code stops working.
//
// Nothing here uses Google any more.

const EmailCollectModule = {
  activeFormId: null,  // the collection's token (named like this so app.js doesn't care how it works)
  activeFormUrl: null, // the link inside the QR code
  questionIds: null,   // unused now; kept so older code that reads it doesn't break
  currentCourseId: null,

  fileName(courseId) {
    return `emailcollect-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    // Data from the old Google Form version has no "token" — treat it as "no active collection".
    this.activeFormId = data && data.token ? data.token : null;
    this.activeFormUrl = this.activeFormId ? this._urlFor(this.activeFormId) : null;
    this.questionIds = null;
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), { token: this.activeFormId });
  },

  hasActiveForm() {
    return !!this.activeFormId;
  },

  /** Same cleaning the server does: full-width -> normal, no spaces, lower-case. */
  _norm(value) {
    return String(value == null ? "" : value).trim().normalize("NFKC").replace(/\s+/g, "").toLowerCase();
  },

  _urlFor(token) {
    return new URL(`collect.html?c=${encodeURIComponent(token)}`, location.href).href;
  },

  _newToken() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  },

  _client() {
    if (!storage || !storage.client) throw new Error("Not signed in.");
    return storage.client;
  },

  _explain(error) {
    const text = `${(error && (error.code || "")) } ${(error && error.message) || ""}`;
    if (/PGRST205|42P01|schema cache|does not exist/i.test(text)) {
      return new Error(
        "The email-collection tables aren't set up in Supabase yet. Run collect-setup.sql in Supabase (SQL Editor), then try again."
      );
    }
    return new Error((error && error.message) || "Something went wrong.");
  },

  _schoolIds(students) {
    return Array.from(new Set(students.map((s) => this._norm(s.schoolId)).filter(Boolean)));
  },

  /** Opens a new collection for this course's roster and returns its QR link. */
  async createForm(students, courseName) {
    const ids = this._schoolIds(students);
    if (ids.length === 0) {
      throw new Error("No students on the roster have a School ID yet — add those first.");
    }
    const token = this._newToken();
    const { error } = await this._client()
      .from("collections")
      .insert({ token, course_name: courseName || "Class", school_ids: ids });
    if (error) throw this._explain(error);

    this.activeFormId = token;
    this.activeFormUrl = this._urlFor(token);
    await this.save();
    return { formId: token, url: this.activeFormUrl };
  },

  /**
   * Reads every saved answer and matches each to a student by School ID.
   * Returns { matches: [{ studentId, email, schoolId }], unmatchedCount, totalResponses }.
   */
  async syncResponses(students) {
    if (!this.activeFormId) {
      throw new Error('There\'s no active collection to sync from — click "Collect Email Addresses" first.');
    }
    const client = this._client();

    // Let students added since the QR code was made answer too.
    const { error: updateError } = await client
      .from("collections")
      .update({ school_ids: this._schoolIds(students) })
      .eq("token", this.activeFormId);
    if (updateError) throw this._explain(updateError);

    const { data, error } = await client
      .from("collection_responses")
      .select("school_id, email, submitted_at")
      .eq("token", this.activeFormId)
      .order("submitted_at", { ascending: true });
    if (error) throw this._explain(error);

    const matches = [];
    let unmatchedCount = 0;
    (data || []).forEach((row) => {
      const student = students.find((s) => this._norm(s.schoolId) === row.school_id);
      if (student) matches.push({ studentId: student.id, email: row.email, schoolId: row.school_id });
      else unmatchedCount++;
    });
    return { matches, unmatchedCount, totalResponses: (data || []).length };
  },

  /** Closes the collection and deletes its answers — the QR code stops working. */
  async deleteForm() {
    if (!this.activeFormId) return;
    const { error } = await this._client().from("collections").delete().eq("token", this.activeFormId);
    if (error) throw this._explain(error);
    this.activeFormId = null;
    this.activeFormUrl = null;
    this.questionIds = null;
    await this.save();
  },
};

window.EmailCollectModule = EmailCollectModule;
