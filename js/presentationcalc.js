// ===== Presentation Calculator module =====
// One file per course: presentationcalc-<courseId>.json
//
// Step 1: a roster snapshot — one entry per seated student, carrying
// over that desk's Group Number from one of the Seating Chart's 6
// saved memory banks. This is an explicit IMPORT (via importFromBank),
// not a live link — so it stays put as a fixed presentation-order
// roster even if seats get rearranged afterward. Re-import any time
// (from the same or a different bank) to refresh it.
//
// Only seated students (active desk + occupied) are included — an
// unseated student has no group, so there's nothing meaningful to
// assign them to for presentation purposes.

const MAX_RUBRIC_BANK = 30;
const MAX_ACTIVE_RUBRICS = 10;
const MAX_RUBRIC_POINTS = 20; // ceiling for the selectable point-value dropdown

// Named distinctly from emailcollect.js's FORMS_API_BASE/DRIVE_API_BASE —
// non-module <script> tags share one global scope, so reusing those exact
// names here would be a fatal "duplicate variable" SyntaxError.
const PC_FORMS_API_BASE = "https://forms.googleapis.com/v1/forms";
const PC_DRIVE_API_BASE = "https://www.googleapis.com/drive/v3/files";

const PresentationCalcModule = {
  roster: [], // [{ studentId, classNumber, name, pronunciation, schoolId, group }]
  sourceBankName: null, // which memory bank the current roster was imported from, for display
  rubricBank: [], // [{ id, text }] — manually-entered rubric descriptions
  teacherRubrics: [], // [{ id, rubricId, points }] — Active Teacher Rubrics grid
  audienceRubrics: [], // [{ id, rubricId, points }] — Active Audience Rubrics grid
  scoreForms: [], // [{ id, kind, formId, url, createdAt, questionMap }] — archived score-collection Google Forms; never auto-deleted
  currentCourseId: null,

  fileName(courseId) {
    return `presentationcalc-${courseId}.json`;
  },

  async load(courseId) {
    this.currentCourseId = courseId;
    const data = await storage.loadFile(this.fileName(courseId));
    this.roster = data && Array.isArray(data.roster) ? data.roster : [];
    this.sourceBankName = data ? data.sourceBankName || null : null;
    this.rubricBank = data && Array.isArray(data.rubricBank) ? data.rubricBank : [];
    this.teacherRubrics = data && Array.isArray(data.teacherRubrics) ? data.teacherRubrics : [];
    this.audienceRubrics = data && Array.isArray(data.audienceRubrics) ? data.audienceRubrics : [];
    this.scoreForms = data && Array.isArray(data.scoreForms) ? data.scoreForms : [];
  },

  async save() {
    if (!this.currentCourseId) throw new Error("No course selected.");
    await storage.saveFile(this.fileName(this.currentCourseId), {
      roster: this.roster,
      sourceBankName: this.sourceBankName,
      rubricBank: this.rubricBank,
      teacherRubrics: this.teacherRubrics,
      audienceRubrics: this.audienceRubrics,
      scoreForms: this.scoreForms,
    });
  },

  /**
   * Builds this module's roster from one of the Seating Chart's saved
   * memory banks — one entry per active, occupied desk in that bank's
   * snapshot, carrying over that desk's Group Number. Overwrites
   * whatever was here before. Caller is responsible for calling save()
   * afterward to persist it.
   */
  importFromBank(bank, roster) {
    if (!bank || !bank.snapshot) {
      throw new Error("That memory bank is empty — save a seating arrangement into it first.");
    }
    const { rows, cols, active, seats, groups } = bank.snapshot;

    const entries = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        const key = `${r}-${c}`;
        if (!active || !active[key]) continue;
        const studentId = seats[key];
        if (!studentId) continue;
        const student = roster.students.find((s) => s.id === studentId);
        if (!student) continue;
        entries.push({
          studentId: student.id,
          classNumber: student.classNumber,
          name: student.name,
          pronunciation: student.pronunciation,
          schoolId: student.schoolId,
          group: (groups && groups[key]) || 0,
        });
      }
    }
    // Group first (ungrouped/0 last), then by Class Number within a group,
    // so students naturally cluster by table in the order they'll present.
    entries.sort((a, b) => {
      const groupA = a.group || Infinity;
      const groupB = b.group || Infinity;
      if (groupA !== groupB) return groupA - groupB;
      return (a.classNumber || 0) - (b.classNumber || 0);
    });
    this.roster = entries;
    this.sourceBankName = bank.name;
  },

  isEmpty() {
    return this.roster.length === 0;
  },

  // ----- Rubric Bank: manually-entered rubric text, one per row -----

  addRubricBankRow() {
    if (this.rubricBank.length >= MAX_RUBRIC_BANK) {
      throw new Error(`You've reached the limit of ${MAX_RUBRIC_BANK} rubrics.`);
    }
    const rubric = { id: `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: "" };
    this.rubricBank.push(rubric);
    return rubric;
  },

  /** Removing a rubric also clears it from any active-grid row that had it selected. */
  removeRubricBankRow(id) {
    this.rubricBank = this.rubricBank.filter((r) => r.id !== id);
    [this.teacherRubrics, this.audienceRubrics].forEach((list) => {
      list.forEach((entry) => {
        if (entry.rubricId === id) entry.rubricId = null;
      });
    });
  },

  setRubricBankText(id, text) {
    const rubric = this.rubricBank.find((r) => r.id === id);
    if (rubric) rubric.text = text;
  },

  findRubric(id) {
    return this.rubricBank.find((r) => r.id === id) || null;
  },

  // ----- Active rubric grids (Teacher / Audience) — each row picks a rubric from the bank and a point value -----

  _activeList(kind) {
    return kind === "audience" ? this.audienceRubrics : this.teacherRubrics;
  },

  addActiveRubric(kind) {
    const list = this._activeList(kind);
    if (list.length >= MAX_ACTIVE_RUBRICS) {
      throw new Error(`You've reached the limit of ${MAX_ACTIVE_RUBRICS} active rubrics.`);
    }
    const entry = { id: `active-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, rubricId: null, points: 0 };
    list.push(entry);
    return entry;
  },

  removeActiveRubric(kind, id) {
    if (kind === "audience") this.audienceRubrics = this.audienceRubrics.filter((e) => e.id !== id);
    else this.teacherRubrics = this.teacherRubrics.filter((e) => e.id !== id);
  },

  setActiveRubricSelection(kind, id, rubricId) {
    const entry = this._activeList(kind).find((e) => e.id === id);
    if (entry) entry.rubricId = rubricId || null;
  },

  setActiveRubricPoints(kind, id, points) {
    const entry = this._activeList(kind).find((e) => e.id === id);
    if (entry) entry.points = Math.max(0, Math.min(MAX_RUBRIC_POINTS, Math.round(Number(points) || 0)));
  },

  /** Distinct Group Numbers present in the roster (ungrouped/0 excluded), ascending. */
  groupList() {
    const groups = new Set();
    this.roster.forEach((entry) => {
      if (entry.group) groups.add(entry.group);
    });
    return Array.from(groups).sort((a, b) => a - b);
  },

  // ----- Get Pres. Scores: archived Google Forms for collecting rubric scores -----

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

  /**
   * Creates, configures, and publishes a new Google Form for collecting
   * rubric scores — one "Group N" section header per group in the
   * roster, followed by one radio-button question per active rubric
   * (kind: "teacher" or "audience"), each scored 0 to that rubric's
   * assigned point value. Unlike email collection's form, this form is
   * never auto-deleted — it's archived in scoreForms so its data can be
   * recalled or the form destroyed later, at the user's choice.
   *
   * The audience form also gets a required "School ID" short-answer
   * question first, so each response can be tied back to who submitted
   * it, entered manually rather than picked from a roster dropdown.
   *
   * After publishing, the form is explicitly granted "anyone with the
   * link" responder access (Drive permissions.create) — required since
   * Google Forms created via API are no longer automatically reachable
   * without it, and without this grant a school's Google org can fall
   * back to requiring sign-in, which is exactly what can strand a
   * student mid-form if they get logged out. With this grant, no
   * sign-in is required at all, so there's nothing to get logged out
   * of. Note: Google doesn't expose "resume a partially-filled
   * response after reopening the link" via the Forms API — that's a
   * Forms UI-only setting ("Edit after submit"), so this covers access,
   * not mid-submission resume.
   */
  async createScoreForm(kind, courseName) {
    const activeList = this._activeList(kind);
    const selected = activeList.filter((e) => e.rubricId && this.findRubric(e.rubricId));
    if (selected.length === 0) {
      throw new Error(
        `No active ${kind === "audience" ? "Audience" : "Teacher"} Rubrics are set up yet — select at least one rubric and point value on the Rubrics page first.`
      );
    }
    const groups = this.groupList();
    if (groups.length === 0) {
      throw new Error("No groups found — import a seating arrangement with Group Numbers set on the Student Groups page first.");
    }

    const label = kind === "audience" ? "Audience Scores" : "Teacher Scores";
    const created = await this._apiFetch(PC_FORMS_API_BASE, {
      method: "POST",
      body: JSON.stringify({ info: { title: `${courseName || "Class"} — ${label}` } }),
    });
    const formId = created.formId;

    // Build a School ID question (audience only), then one Group-header
    // item plus one question per active rubric for every group —
    // tracking, in parallel, which array index maps to which piece of
    // meaning so the batchUpdate replies (which return question IDs in
    // request order) can be matched back up.
    const requests = [];
    const meta = []; // null for a header item; {type:"schoolId"} or {group, rubricId, rubricText} for a question
    let index = 0;

    if (kind === "audience") {
      requests.push({
        createItem: {
          item: {
            title: "School ID",
            description: "Enter your School ID — used to identify your scores.",
            questionItem: {
              question: { required: true, textQuestion: { paragraph: false } },
            },
          },
          location: { index: index++ },
        },
      });
      meta.push({ type: "schoolId" });
    }

    groups.forEach((group) => {
      requests.push({
        createItem: {
          item: { title: `Group ${group}`, textItem: {} },
          location: { index: index++ },
        },
      });
      meta.push(null);

      selected.forEach((entry) => {
        const rubric = this.findRubric(entry.rubricId);
        const rubricText = (rubric && rubric.text) || "(untitled rubric)";
        const maxPoints = Math.max(0, entry.points || 0);
        const options = [];
        for (let n = 0; n <= maxPoints; n++) options.push({ value: String(n) });

        requests.push({
          createItem: {
            item: {
              title: rubricText,
              questionItem: {
                question: { required: true, choiceQuestion: { type: "RADIO", options } },
              },
            },
            location: { index: index++ },
          },
        });
        meta.push({ group, rubricId: entry.rubricId, rubricText });
      });
    });

    const batchResult = await this._apiFetch(`${PC_FORMS_API_BASE}/${formId}:batchUpdate`, {
      method: "POST",
      body: JSON.stringify({ requests }),
    });

    const questionMap = {};
    let schoolIdQuestionId = null;
    batchResult.replies.forEach((reply, i) => {
      const info = meta[i];
      if (!info) return; // a Group header item — no question to map
      const questionId = reply.createItem.questionId[0];
      questionMap[questionId] = info;
      if (info.type === "schoolId") schoolIdQuestionId = questionId;
    });

    await this._apiFetch(`${PC_FORMS_API_BASE}/${formId}:setPublishSettings`, {
      method: "POST",
      body: JSON.stringify({
        publishSettings: { publishState: { isPublished: true, isAcceptingResponses: true } },
      }),
    });

    // Explicitly grant public "anyone with the link" responder access —
    // see the method comment above for why this is necessary.
    try {
      await this._apiFetch(`${PC_DRIVE_API_BASE}/${formId}/permissions`, {
        method: "POST",
        body: JSON.stringify({ type: "anyone", view: "published", role: "reader" }),
      });
    } catch (err) {
      // Non-fatal — the form still works for anyone the org's default
      // sharing already covers; surface this so the user knows sign-in
      // might still be required for some respondents.
      console.warn("Couldn't grant public responder access:", err.message);
    }

    const formDetail = await this._apiFetch(`${PC_FORMS_API_BASE}/${formId}`);

    const record = {
      id: `scoreform-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      name: `${label} — ${new Date().toLocaleDateString()}`,
      kind,
      formId,
      url: formDetail.responderUri,
      createdAt: new Date().toISOString(),
      questionMap,
      schoolIdQuestionId,
    };
    this.scoreForms.push(record);
    await this.save();
    return record;
  },

  /** Renames an archived form's display name (in this app only — doesn't change the Google Form's own title). */
  renameScoreForm(recordId, name) {
    const record = this.scoreForms.find((f) => f.id === recordId);
    if (!record) return;
    const trimmed = (name || "").trim();
    record.name = trimmed || record.name;
  },

  /**
   * Reads every response currently on an archived form and maps each
   * answer back to its (group, rubric) via the form's stored
   * questionMap. Audience forms also attach the respondent's School ID
   * (from that response's School ID question) to each entry. The form
   * itself is left untouched — nothing is deleted here, so this can be
   * called repeatedly as more responses come in.
   */
  async recallScoreFormResponses(recordId) {
    const record = this.scoreForms.find((f) => f.id === recordId);
    if (!record) throw new Error("That form is no longer in the archive.");

    const data = await this._apiFetch(`${PC_FORMS_API_BASE}/${record.formId}/responses`);
    const responses = data.responses || [];

    const entries = []; // { schoolId, group, rubricText, value }
    responses.forEach((response) => {
      const answers = response.answers || {};

      let schoolId = "";
      if (record.schoolIdQuestionId && answers[record.schoolIdQuestionId]) {
        const a = answers[record.schoolIdQuestionId];
        schoolId = a.textAnswers && a.textAnswers.answers[0] ? a.textAnswers.answers[0].value.trim() : "";
      }

      Object.entries(answers).forEach(([questionId, answer]) => {
        const info = record.questionMap[questionId];
        if (!info || info.type === "schoolId") return; // already handled above
        const value =
          answer.textAnswers && answer.textAnswers.answers[0] ? answer.textAnswers.answers[0].value : "";
        entries.push({ schoolId, group: info.group, rubricText: info.rubricText, value });
      });
    });

    return { record, entries, responseCount: responses.length };
  },

  /** Permanently deletes an archived form from Drive and removes it from the archive. */
  async deleteScoreForm(recordId) {
    const record = this.scoreForms.find((f) => f.id === recordId);
    if (!record) return;

    try {
      await this._apiFetch(`${PC_DRIVE_API_BASE}/${record.formId}`, { method: "DELETE" });
    } catch (err) {
      this.scoreForms = this.scoreForms.filter((f) => f.id !== recordId);
      await this.save();
      throw new Error(`Removed from the archive, but deleting the form itself failed: ${err.message}`);
    }

    this.scoreForms = this.scoreForms.filter((f) => f.id !== recordId);
    await this.save();
  },
};

window.PresentationCalcModule = PresentationCalcModule;
window.MAX_RUBRIC_POINTS = MAX_RUBRIC_POINTS;
