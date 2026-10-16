// ===== Presentation Calc online forms =====
// Lets students score presentations on their phones instead of with CSV sheets.
//   Audience form: scan QR -> School ID -> score every OTHER group on the active Audience rubrics.
//   Peer form:     scan QR -> School ID -> rate each member of your own group.
// A form is saved in Supabase (see presentation-forms-setup.sql). Students never see the class list:
// the server checks the School ID and only then returns the questions.
// Each launched QR code is a DATA SET stored in the project (project.scoreUploads, with token =
// the form is still open). "Get Responses" copies the saved answers into the data set; the
// calculations only read the data set marked "in use" for each kind (see ScoringModule).

const PresentationFormsModule = {
  KINDS: ["teacher", "audience", "peer"],

  _client() {
    if (typeof storage === "undefined" || !storage || !storage.client) throw new Error("Not signed in.");
    return storage.client;
  },

  _explain(error) {
    const text = `${(error && error.code) || ""} ${(error && error.message) || ""}`;
    if (/PGRST20[25]|42P01|42883|schema cache|does not exist|Could not find the function/i.test(text)) {
      return new Error("Supabase needs the presentation-forms update. Run presentation-forms-setup.sql in Supabase (SQL Editor), then try again.");
    }
    return new Error((error && error.message) || "Something went wrong.");
  },

  _newToken() {
    const bytes = new Uint8Array(16);
    crypto.getRandomValues(bytes);
    return Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  },

  urlFor(token) {
    return new URL(`presform.html?c=${encodeURIComponent(token)}`, location.href).href;
  },

  setOf(project, uploadId) {
    return (project.scoreUploads || []).find((u) => u.id === uploadId) || null;
  },

  /** What students see and who may answer, built from the project as it is right now. */
  build(toolId, projectId, kind) {
    const project = ScoringModule.getPresentationProject(toolId, projectId);
    if (!project) throw new Error("That project no longer exists.");
    const ts = project.templateSettings;
    const groups = ScoringModule.presentationGroups(toolId, projectId);
    if (groups.length === 0) throw new Error('No groups yet — import a seating arrangement with Group Numbers on the "Student Groups" subtab first.');
    const courseStudents = (window.RosterModule && RosterModule.students) || [];
    const byId = new Map(courseStudents.map((s) => [s.id, s]));
    const groupOf = new Map(project.roster.map((e) => [e.studentId, e.group || null]));

    if (kind === "audience" || kind === "teacher") {
      const isTeacher = kind === "teacher";
      const rubrics = ScoringModule.presentationColumns(toolId, projectId)
        .filter((c) => c.kind === kind)
        .map((c) => ({ id: c.entryId, text: c.text, points: c.points }));
      if (rubrics.length === 0) throw new Error(`Activate at least one ${isTeacher ? "Teacher" : "Audience"} rubric first (the "Rubrics" subtab).`);
      const custom = (ts.audienceInstructions || "").trim();
      const config = {
        instructions: isTeacher
          ? "Score each group that presents. Higher numbers are good, lower numbers are bad. You can leave a comment for each group."
          : custom || "Rate each group that presents. Higher numbers are good, lower numbers are bad. You can leave a comment for each group. Only the teacher can see your answer.",
        comments: isTeacher ? true : ts.audienceComments !== false,
        rubrics,
        groups,
      };
      if (isTeacher) return { config, people: [] }; // teachers type their name; there is no list to check
      const people = courseStudents
        .filter((s) => String(s.schoolId || "").trim())
        .map((s) => ({ sid: String(s.schoolId).trim(), name: s.name || "", studentId: s.id, group: groupOf.get(s.id) || null }));
      return { config, people };
    }

    const highest = ts.peerHighestScore;
    const custom = (ts.peerInstructions || "").trim();
    const config = {
      instructions:
        custom ||
        `Rate how much each member of your group contributed to your presentation. If a member did a good job and worked hard, rate them a ${highest}. If they didn't work hard, give them a 0. Only the teacher can see your answer.`,
      highest,
    };
    const people = project.roster
      .filter((e) => e.group)
      .map((e) => {
        const live = byId.get(e.studentId);
        return {
          sid: String((live ? live.schoolId : e.schoolId) || "").trim(),
          name: (live ? live.name : e.name) || (e.classNumber ? `#${e.classNumber}` : "(unnamed)"),
          studentId: e.studentId,
          group: e.group,
          order: e.classNumber || 0,
        };
      })
      .filter((p) => p.sid);
    if (people.length === 0) throw new Error("None of the students in the groups have a School ID yet.");
    // Students who aren't in a group can still type their ID and are told there is nothing for them to rate.
    const inGroups = new Set(project.roster.filter((e) => e.group).map((e) => e.studentId));
    courseStudents.forEach((s) => {
      const sid = String(s.schoolId || "").trim();
      if (sid && !inGroups.has(s.id)) people.push({ sid, name: s.name || "", studentId: s.id, group: null });
    });
    return { config, people };
  },

  /** Saves the questions + allowed students to the server. Returns { shared: [School IDs left out because several students have them], people }. */
  async _publish(toolId, projectId, kind, token) {
    const project = ScoringModule.getPresentationProject(toolId, projectId);
    const { config, people } = this.build(toolId, projectId, kind);
    const title = `${project.name}${kind === "peer" ? " — rate your group members" : kind === "teacher" ? " — teacher scores" : " — score the presentations"}`;
    const { data, error } = await this._client().rpc("pres_publish", { p_token: token, p_title: title, p_config: config, p_people: people });
    if (error) throw this._explain(error);
    return { shared: data || [], people };
  },

  /** Opens a new form and stores a new (empty) data set for it. Returns { set, url, shared, count }. */
  async create(toolId, projectId, kind, name) {
    const project = ScoringModule.getPresentationProject(toolId, projectId);
    if (!project) throw new Error("That project no longer exists.");
    this.build(toolId, projectId, kind); // fail early with a readable message
    const token = this._newToken();
    const client = this._client();
    const { error } = await client.from("pres_forms").insert({ token, kind, title: project.name });
    if (error) throw this._explain(error);
    let result;
    try {
      result = await this._publish(toolId, projectId, kind, token);
    } catch (err) {
      await client.from("pres_forms").delete().eq("token", token);
      throw err;
    }
    const set = ScoringModule.addPresentationUpload(toolId, projectId, { kind, name, token, respondentCount: 0 });
    return { set, url: this.urlFor(token), shared: result.shared, count: result.people.length };
  },

  /**
   * Copies every saved answer into the data set (replacing what it held) and first refreshes the
   * form so it follows the current rubrics, groups and roster. Returns { responses, expected, missing: [names], note }.
   */
  async sync(toolId, projectId, uploadId) {
    const project = ScoringModule.getPresentationProject(toolId, projectId);
    const set = project && this.setOf(project, uploadId);
    if (!set || !set.token) throw new Error("This data set's form is closed, so there is nothing new to get.");
    const kind = set.kind;
    let note = "";
    try {
      await this._publish(toolId, projectId, kind, set.token);
    } catch (err) {
      note = ` (The form could not be refreshed: ${err.message})`;
    }
    const client = this._client();
    const { data: rows, error } = await client.from("pres_responses").select("respondent, payload, submitted_at").eq("token", set.token).order("submitted_at", { ascending: true });
    if (error) throw this._explain(error);
    const { data: form, error: formError } = await client.from("pres_forms").select("people").eq("token", set.token).maybeSingle();
    if (formError) throw this._explain(formError);
    const people = (form && form.people) || [];

    const scores = [];
    const comments = [];
    const ratings = [];
    (rows || []).forEach((row) => {
      const who = row.respondent;
      const p = row.payload || {};
      if (kind !== "peer") {
        Object.entries(p.scores || {}).forEach(([group, perRubric]) =>
          Object.entries(perRubric || {}).forEach(([entryId, value]) => scores.push([who, Number(group), entryId, Number(value)]))
        );
        Object.entries(p.comments || {}).forEach(([group, text]) => text && comments.push([who, Number(group), String(text)]));
        if (p.global && kind === "teacher") comments.push([who, 0, String(p.global)]); // only teachers can leave a comment for everyone
      } else {
        Object.entries(p.ratings || {}).forEach(([studentId, value]) => ratings.push([who, studentId, Number(value)]));
      }
    });
    set.scores = scores;
    set.comments = comments;
    set.ratings = ratings;
    set.respondentCount = (rows || []).length;
    set.syncedAt = new Date().toISOString();

    const answered = new Set((rows || []).map((r) => String(r.respondent)));
    const missing = kind === "teacher" ? [] : people.filter((p) => !answered.has(String(p.sid))).map((p) => p.name || p.sid);
    return { responses: set.respondentCount, expected: kind === "teacher" ? 0 : people.length, missing, note };
  },

  /** Closes the form (its QR code stops working) and deletes the answers on the server. The data set stays. */
  async close(toolId, projectId, uploadId) {
    const project = ScoringModule.getPresentationProject(toolId, projectId);
    const set = project && this.setOf(project, uploadId);
    if (!set || !set.token) return;
    const { error } = await this._client().from("pres_forms").delete().eq("token", set.token);
    if (error) throw this._explain(error);
    set.token = null;
  },

  /** Deletes a data set; if its form is still open, closes it first. */
  async remove(toolId, projectId, uploadId) {
    await this.close(toolId, projectId, uploadId);
    ScoringModule.removePresentationUpload(toolId, projectId, uploadId);
  },
};

window.PresentationFormsModule = PresentationFormsModule;
