// ===== Email collection module =====
// Collects students' email addresses with our own page (collect.html).
// One file per course: emailcollect-<courseId>.json — it remembers the
// settings (how students identify themselves) and which collection, if
// any, is currently open for this course.
//
// Flow:
//   1. createForm() saves a "collection" in Supabase: a random secret token
//      plus the list of who may answer. The QR code points to
//      collect.html?c=<token>.
//   2. A student scans the QR code, must type their identifier (School ID by
//      default; the teacher can pick Name or any column kept from an uploaded
//      file), and only then gets to enter their email. The server checks it
//      (see sql/collect-setup.sql) — students never see the list.
//   3. pushAllowed() keeps that list equal to the roster. app.js calls it
//      whenever the roster changes (new student, edited value, new upload),
//      so a new student can answer right away and a replaced student's old
//      value stops working.
//   4. syncResponses() reads the saved answers, matches each to a student,
//      and returns the matches for the caller to write into the roster.
//   5. deleteForm() closes the collection and deletes its answers.
//
// All the matching rules ("Tanaka Aiko" = "aiko tanaka", full-width digits...)
// live in the database, so this file never has to guess how the server
// compares things: it sends the raw values and the server sends back the keys.

const EMAIL_FIELD_ID = "schoolId";
const EMAIL_FIELD_NAME = "name";

const EmailCollectModule = {
  activeFormId: null,   // the collection's token (named like this so app.js doesn't care how it works)
  activeFormUrl: null,  // the link inside the QR code
  questionIds: null,    // unused now; kept so older code that reads it doesn't break
  currentCourseId: null,

  // Settings (saved per course)
  matchField: EMAIL_FIELD_ID, // "schoolId", "name", or "extra:<column name>"
  matchLabel: "",             // wording students see; blank = the field's own name

  // What the server last told us (not saved)
  keyMap: new Map(),          // raw value -> { key, dup }
  lastPushedSig: null,

  fileName(courseId) {
    return `emailcollect-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    this.keyMap = new Map();
    this.lastPushedSig = null;
    const data = await storage.loadFile(this.fileName(courseId));
    // Data from the old Google Form version has no "token" — treat it as "no active collection".
    this.activeFormId = data && data.token ? data.token : null;
    this.activeFormUrl = this.activeFormId ? this._urlFor(this.activeFormId) : null;
    this.matchField = (data && data.matchField) || EMAIL_FIELD_ID;
    this.matchLabel = (data && data.matchLabel) || "";
    this.questionIds = null;
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      token: this.activeFormId,
      matchField: this.matchField,
      matchLabel: this.matchLabel,
    });
  },

  hasActiveForm() {
    return !!this.activeFormId;
  },

  // ----- settings helpers -----

  /** The choices for "students identify themselves with". Extra columns only exist if a file with extra columns was uploaded. */
  availableFields(students) {
    const fields = [
      { value: EMAIL_FIELD_ID, label: "School ID" },
      { value: EMAIL_FIELD_NAME, label: "Name" },
    ];
    const names = [];
    students.forEach((s) =>
      Object.keys(s.extra || {}).forEach((key) => {
        if (!names.includes(key)) names.push(key);
      })
    );
    names.forEach((key) => fields.push({ value: `extra:${key}`, label: `${key} (from your uploaded file)` }));
    return fields;
  },

  /** The field actually in use: the chosen one, or School ID if the chosen column no longer exists on the roster. */
  effectiveField(students) {
    const ok = this.availableFields(students).some((f) => f.value === this.matchField);
    return ok ? this.matchField : EMAIL_FIELD_ID;
  },

  defaultLabel(field) {
    if (field === EMAIL_FIELD_NAME) return "Name";
    if (field && field.startsWith("extra:")) return field.slice(6);
    return "School ID";
  },

  effectiveLabel(students) {
    return (this.matchLabel || "").trim() || this.defaultLabel(this.effectiveField(students));
  },

  _valueOf(student, field) {
    if (field === EMAIL_FIELD_NAME) return student.name || "";
    if (field && field.startsWith("extra:")) return (student.extra && student.extra[field.slice(6)]) || "";
    return student.schoolId || "";
  },

  _values(students) {
    const field = this.effectiveField(students);
    return students.map((s) => String(this._valueOf(s, field)).trim());
  },

  /** A fingerprint of everything the server needs to know; if it changes, the server list is stale. */
  signature(students) {
    return JSON.stringify([this.activeFormId, this.effectiveLabel(students), this._values(students).filter(Boolean)]);
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
    const text = `${(error && error.code) || ""} ${(error && error.message) || ""}`;
    if (/PGRST20[25]|42P01|42883|schema cache|does not exist|Could not find the function/i.test(text)) {
      return new Error(
        "Supabase needs its email-collection update. Run the latest collect-setup.sql in Supabase (SQL Editor), then try again."
      );
    }
    return new Error((error && error.message) || "Something went wrong.");
  },

  /** What the form currently covers, for the settings note: { inForm, blank, shared: [values] }. */
  describe(students) {
    const values = this._values(students);
    const blank = values.filter((v) => !v).length;
    const shared = [];
    let inForm = 0;
    values.forEach((v) => {
      if (!v) return;
      const info = this.keyMap.get(v);
      if (info && info.dup) {
        if (!shared.includes(v)) shared.push(v);
      } else inForm++;
    });
    return { inForm, blank, shared, known: this.keyMap.size > 0 };
  },

  /**
   * Tells the server who may answer (one value per student) and what to call it.
   * The server works out the keys, leaves out blanks and values shared by several
   * students, and sends back [{ value, key, dup }].
   */
  async pushAllowed(students) {
    if (!this.activeFormId) return null;
    const sig = this.signature(students);
    const { data, error } = await this._client().rpc("collect_set_ids", {
      p_token: this.activeFormId,
      p_label: this.effectiveLabel(students),
      p_values: this._values(students).filter(Boolean),
    });
    if (error) throw this._explain(error);
    this.keyMap = new Map((data || []).map((r) => [r.value, { key: r.key, dup: !!r.dup }]));
    this.lastPushedSig = sig;
    return this.describe(students);
  },

  /** Opens a new collection for this course's roster and returns its QR link. */
  async createForm(students, courseName) {
    const label = this.effectiveLabel(students);
    if (this._values(students).every((v) => !v)) {
      throw new Error(`No students on the roster have a ${label} yet — add those first.`);
    }
    const token = this._newToken();
    const client = this._client();
    const { error } = await client.from("collections").insert({ token, course_name: courseName || "Class" });
    if (error) throw this._explain(error);

    this.activeFormId = token;
    this.activeFormUrl = this._urlFor(token);
    try {
      await this.pushAllowed(students);
    } catch (err) {
      await client.from("collections").delete().eq("token", token); // don't leave a half-made form behind
      this.activeFormId = null;
      this.activeFormUrl = null;
      throw err;
    }
    await this.save();
    return { formId: token, url: this.activeFormUrl, summary: this.describe(students) };
  },

  /**
   * Reads every saved answer and matches each to a student.
   * Returns { matches: [{ studentId, email, schoolId }], unmatchedCount, totalResponses }
   * ("schoolId" in each match is whatever value identified the student).
   */
  async syncResponses(students) {
    if (!this.activeFormId) {
      throw new Error('There\'s no active collection to sync from — click "Collect Email Addresses" first.');
    }
    await this.pushAllowed(students); // makes sure the server's list (and our keys) match the roster right now

    const { data, error } = await this._client()
      .from("collection_responses")
      .select("school_id, email, submitted_at")
      .eq("token", this.activeFormId)
      .order("submitted_at", { ascending: true });
    if (error) throw this._explain(error);

    const field = this.effectiveField(students);
    const byKey = new Map();
    students.forEach((s) => {
      const value = String(this._valueOf(s, field)).trim();
      const info = value && this.keyMap.get(value);
      if (info && !info.dup) byKey.set(info.key, { student: s, value });
    });

    const matches = [];
    let unmatchedCount = 0;
    (data || []).forEach((row) => {
      const hit = byKey.get(row.school_id);
      if (hit) matches.push({ studentId: hit.student.id, email: row.email, schoolId: hit.value });
      else unmatchedCount++;
    });
    return { matches, unmatchedCount, totalResponses: (data || []).length };
  },

  /** Throws away the answers collected so far (used when the matching field is changed on a live form). */
  async clearResponses() {
    if (!this.activeFormId) return;
    const { error } = await this._client().from("collection_responses").delete().eq("token", this.activeFormId);
    if (error) throw this._explain(error);
  },

  /** Closes the collection and deletes its answers — the QR code stops working. */
  async deleteForm() {
    if (!this.activeFormId) return;
    const { error } = await this._client().from("collections").delete().eq("token", this.activeFormId);
    if (error) throw this._explain(error);
    this.activeFormId = null;
    this.activeFormUrl = null;
    this.questionIds = null;
    this.keyMap = new Map();
    this.lastPushedSig = null;
    await this.save();
  },
};

window.EmailCollectModule = EmailCollectModule;
