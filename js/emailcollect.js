// ===== Email collection module =====
// One file per course: emailcollect-<courseId>.json — just tracks
// which Google Form (if any) is currently active for this course.
//
// Flow:
//   1. createForm() makes a real Google Form (via the Forms API) with
//      a "Student ID" dropdown (populated from the roster) and an
//      "Email Address" question, publishes it, and remembers its ID.
//   2. Students scan the QR code (built from the form's link) and
//      submit their ID + email.
//   3. syncResponses() reads every response via the Forms API,
//      matches each one to a student by School ID, and returns the
//      matches for the caller to write into the roster.
//   4. After a successful sync, the whole form is deleted (via the
//      Drive API, since a Form is just a Drive file) so the next
//      "Collect Email Addresses" click starts fresh. Google's API has
//      no way to just clear a form's responses, so deleting the whole
//      form is how we get the same "ready to do it again" result.

const FORMS_API_BASE = "https://forms.googleapis.com/v1/forms";
const DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";

const EmailCollectModule = {
  activeFormId: null,
  activeFormUrl: null,
  questionIds: null, // { studentId: "...", email: "..." } — set right after creating the form
  currentCourseId: null,

  fileName(courseId) {
    return `emailcollect-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    if (data) {
      this.activeFormId = data.activeFormId || null;
      this.activeFormUrl = data.activeFormUrl || null;
      this.questionIds = data.questionIds || null;
    } else {
      this.activeFormId = null;
      this.activeFormUrl = null;
      this.questionIds = null;
    }
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      activeFormId: this.activeFormId,
      activeFormUrl: this.activeFormUrl,
      questionIds: this.questionIds,
    });
  },

  hasActiveForm() {
    return !!this.activeFormId;
  },

  async _apiFetch(url, options = {}) {
    const token = await storage.getAccessToken();
    const response = await fetch(url, {
      ...options,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
        ...(options.headers || {}),
      },
    });
    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`Google API error (${response.status}): ${text.slice(0, 300)}`);
    }
    if (response.status === 204) return null; // no content (e.g. DELETE)
    return response.json();
  },

  /** Creates, configures, and publishes a new Google Form for collecting emails from the given students' School IDs. */
  async createForm(students, courseName) {
    const schoolIds = students.map((s) => String(s.schoolId || "").trim()).filter(Boolean);
    if (schoolIds.length === 0) {
      throw new Error("No students on the roster have a School ID yet — add those first.");
    }

    // 1. Create the form (title only — Forms API requires items to be added separately).
    const created = await this._apiFetch(FORMS_API_BASE, {
      method: "POST",
      body: JSON.stringify({
        info: { title: `${courseName || "Class"} — Email Address Collection` },
      }),
    });
    const formId = created.formId;

    // 2. Add the two questions.
    const batchResult = await this._apiFetch(`${FORMS_API_BASE}/${formId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({
        requests: [
          {
            createItem: {
              item: {
                title: "Student ID",
                questionItem: {
                  question: {
                    required: true,
                    choiceQuestion: {
                      type: "DROP_DOWN",
                      options: schoolIds.map((id) => ({ value: id })),
                    },
                  },
                },
              },
              location: { index: 0 },
            },
          },
          {
            createItem: {
              item: {
                title: "Email Address",
                questionItem: {
                  question: { required: true, textQuestion: { paragraph: false } },
                },
              },
              location: { index: 1 },
            },
          },
        ],
      }),
    });

    const studentIdQuestionId = batchResult.replies[0].createItem.questionId[0];
    const emailQuestionId = batchResult.replies[1].createItem.questionId[0];

    // 3. Publish it, so students can actually submit responses.
    await this._apiFetch(`${FORMS_API_BASE}/${formId}:setPublishSettings`, {
      method: "POST",
      body: JSON.stringify({
        publishSettings: { isPublished: true, isAcceptingResponses: true },
      }),
    });

    // 4. Get the responder link to build the QR code from.
    const formDetail = await this._apiFetch(`${FORMS_API_BASE}/${formId}`);

    this.activeFormId = formId;
    this.activeFormUrl = formDetail.responderUri;
    this.questionIds = { studentId: studentIdQuestionId, email: emailQuestionId };
    await this.save();

    return { formId, url: this.activeFormUrl };
  },

  /**
   * Reads every response from the active form, matches each to a
   * student by School ID, and returns the matches. Deletes the form
   * afterward (see the module comment above for why).
   */
  async syncResponses(students) {
    if (!this.activeFormId) throw new Error("There's no active form to sync from — click \"Collect Email Addresses\" first.");

    const data = await this._apiFetch(`${FORMS_API_BASE}/${this.activeFormId}/responses`);
    const responses = data.responses || [];

    const matches = []; // { studentId, email, schoolId }
    let unmatchedCount = 0;

    responses.forEach((response) => {
      const idAnswer = response.answers && response.answers[this.questionIds.studentId];
      const emailAnswer = response.answers && response.answers[this.questionIds.email];
      const schoolId = idAnswer && idAnswer.textAnswers && idAnswer.textAnswers.answers[0]
        ? idAnswer.textAnswers.answers[0].value.trim()
        : "";
      const email = emailAnswer && emailAnswer.textAnswers && emailAnswer.textAnswers.answers[0]
        ? emailAnswer.textAnswers.answers[0].value.trim()
        : "";
      if (!schoolId || !email) return;

      const student = students.find((s) => String(s.schoolId || "").trim() === schoolId);
      if (student) matches.push({ studentId: student.id, email, schoolId });
      else unmatchedCount++;
    });

    // Delete the whole form now that we've read it — see module comment.
    try {
      await this._apiFetch(`${DRIVE_API_BASE}/${this.activeFormId}`, { method: "DELETE" });
    } catch (err) {
      // Non-fatal: the sync itself succeeded even if cleanup failed.
      // The stale form just won't get cleared automatically this time.
      console.warn("Couldn't delete the form after syncing:", err.message);
    }

    this.activeFormId = null;
    this.activeFormUrl = null;
    this.questionIds = null;
    await this.save();

    return { matches, unmatchedCount, totalResponses: responses.length };
  },
};

window.EmailCollectModule = EmailCollectModule;
