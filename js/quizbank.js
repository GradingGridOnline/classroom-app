// ===== Quiz editor + QR answer form for the Test & Quiz Bank =====
// Load AFTER app.js. A quiz is a normal test in the bank (so Sources / Progress Tracker
// pulling keep working) with an extra `quiz` field:
//   quiz: { kind: "standard" | "answers" | "survey",   (survey: same questions, no answer key and no points)
//                     ("answers" = Answer Collection: no question text)
//           settings: { labelStyle, defaultOptions, timeLimit (minutes, 0 = none),
//                       attemptsAllowed (0 = unlimited), attemptRule: "best"|"latest"|"first" },
//           sections: [{ id, title, questions: [{ id, type: "mc"|"blank", text, points,
//                      choices: [..], correct: index, accepted: [..] }] }],
//           token (open QR form or null),
//           submissions: [{ sid, name, attempt, answers (as the student sent them),
//                           overrides ({ questionId: value } edits made by the teacher), at }] }
// The answer key stays in this app; the server only gets questions + who may answer.

(function () {
  const newId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const MAX_QUESTIONS = 200;
  const MAX_OPTIONS = 20;
  window.isSurveyKind = (k) => k === "survey" || k === "formative";
  /** Multiple-select answers are stored as a string of chosen option numbers, e.g. "0,2" ("" = none chosen). */
  const multiSet = (ans) => {
    const arr = Array.isArray(ans) ? ans : String(ans === undefined || ans === null ? "" : ans).split(",");
    return [...new Set(arr.filter((x) => x !== "" && x !== null && x !== undefined).map(Number).filter((n) => Number.isInteger(n) && n >= 0))].sort((a, b) => a - b);
  };
  const isChoiceQ = (q) => q.type === "mc" || q.type === "multi";
  const typeName = (q) => (q.type === "mc" ? "Multiple choice" : q.type === "multi" ? "Multiple select" : "Fill in the blank"); // Research Survey ("survey") and Formative Survey
  const r2 = (n) => Math.round(n * 100) / 100;
  const editing = new Map(); // toolId -> testId being edited
  const viewOf = new Map(); // toolId -> "build" | "review"
  window.QuizBankUI = { open(toolId, testId, view) { editing.set(toolId, testId); viewOf.set(toolId, view || "build"); } };
  const statusMsg = new Map(); // toolId|testId -> text

  // ---------- look & feel (injected so no other file needs changing) ----------
  if (!document.getElementById("qz-style")) {
    const st = document.createElement("style");
    st.id = "qz-style";
    st.textContent = `
      .qz-header { background: color-mix(in srgb, var(--green) 12%, var(--card)); border: 2px solid var(--green); border-radius: 10px; padding: 10px 14px; margin-bottom: 22px; }
      .qz-tab { font-weight: 700; padding: 8px 18px !important; border-width: 2px !important; }
      .pres-section.qz-sec-settings { border-color: #6a4fb3; }
      .pres-section.qz-sec-settings > .pres-section-head { background: #6a4fb3; color: #fff; }
      .pres-section.qz-sec-q0 { border-color: #1f6fb5; } .pres-section.qz-sec-q0 > .pres-section-head { background: #1f6fb5; color: #fff; }
      .pres-section.qz-sec-q1 { border-color: #2e8b57; } .pres-section.qz-sec-q1 > .pres-section-head { background: #2e8b57; color: #fff; }
      .pres-section.qz-sec-q2 { border-color: #b8860b; } .pres-section.qz-sec-q2 > .pres-section-head { background: #b8860b; color: #fff; }
      .pres-section.qz-sec-q3 { border-color: #a23b72; } .pres-section.qz-sec-q3 > .pres-section-head { background: #a23b72; color: #fff; }
      .pres-section.qz-sec-qr { border-color: #c2571a; } .pres-section.qz-sec-qr > .pres-section-head { background: #c2571a; color: #fff; }
      .pres-section.qz-sec-review { border-color: #0f7d73; } .pres-section.qz-sec-review > .pres-section-head { background: #0f7d73; color: #fff; }
      .pres-section.qz-sec-list { border-color: #4a5568; } .pres-section.qz-sec-list > .pres-section-head { background: #4a5568; color: #fff; }
      .category-manage-item.qz-q { border: 1px solid var(--line); border-left: 8px solid var(--qz-c); border-radius: 8px; padding: 12px 14px; background: var(--card); }
      .qz-q-mc { --qz-c: #2a7de1; } .qz-q-blank { --qz-c: #e08a1e; }
      .qz-qnum { background: var(--qz-c); color: #fff; border-radius: 999px; min-width: 2.6em; padding: 3px 12px; text-align: center; font-weight: 800; font-size: 1.05rem; }
      .qz-pill { border: 1.5px solid var(--qz-c); color: var(--qz-c); border-radius: 999px; padding: 1px 12px; font-size: .8rem; font-weight: 700; white-space: nowrap; }
      .qz-opt-row { margin-left: 26px; border-left: 3px solid var(--line); padding-left: 12px; }
      .qz-keyrow { background: color-mix(in srgb, #2e9e4f 16%, transparent); border-radius: 6px; padding: 6px 10px; }
      .pres-section.qz-sec-settings { border-style: dashed; background: color-mix(in srgb, #6a4fb3 14%, var(--card)); }
      .pres-section.qz-sec-settings > .pres-section-head { background: color-mix(in srgb, #6a4fb3 32%, transparent); color: inherit; font-style: italic; font-size: 1.05rem; border-bottom: 2px dashed #6a4fb3; }
      .pres-section.qz-sec-q0 { background: color-mix(in srgb, #1f6fb5 13%, var(--card)); }
      .pres-section.qz-sec-q1 { background: color-mix(in srgb, #2e8b57 13%, var(--card)); }
      .pres-section.qz-sec-q2 { background: color-mix(in srgb, #b8860b 14%, var(--card)); }
      .pres-section.qz-sec-q3 { background: color-mix(in srgb, #a23b72 13%, var(--card)); }
      .pres-section.qz-sec-review { background: color-mix(in srgb, #0f7d73 13%, var(--card)); }
      .pres-section.qz-sec-list { background: color-mix(in srgb, #4a5568 16%, var(--card)); }
      .pres-section.qz-sec-shared { border-color: #c2571a; background: color-mix(in srgb, #c2571a 12%, var(--card)); }
      .pres-section.qz-sec-shared > .pres-section-head { background: #c2571a; color: #fff; }
      .qz-act-share { border-color: #c2571a !important; border-width: 2px !important; font-weight: 600; }
      .qz-actions { display: flex; flex-wrap: wrap; gap: 6px; margin-bottom: 6px; }
      .qz-menu-btn { border-color: var(--qz-menu-c) !important; border-width: 2px !important; font-weight: 600; }
      .qz-menu-list { position: fixed; z-index: 10000; min-width: 190px; display: flex; flex-direction: column; gap: 2px; padding: 6px; background: var(--card); border: 2px solid var(--qz-menu-c); border-radius: 8px; box-shadow: 0 8px 24px rgba(0, 0, 0, .45); }
      .qz-menu-item { width: 100%; text-align: left; border-color: transparent !important; }
      .qz-menu-item:hover { background: color-mix(in srgb, var(--qz-menu-c) 25%, transparent) !important; }
      .qz-review thead th { background: #0f7d73 !important; color: #fff !important; }
      .qz-review td.qz-ok { background: rgba(46, 158, 79, .22) !important; }
      .qz-review td.qz-bad { background: rgba(211, 48, 47, .17) !important; }
      .qz-review tr.qz-key td { background: rgba(224, 168, 0, .28) !important; font-weight: 700; border-bottom: 3px solid #b8860b; }
      .qz-review tr.qz-newstudent td { border-top: 3px solid var(--ink-soft); }
      .qz-review tfoot td { background: #0f7d73 !important; color: #fff !important; font-weight: 700; }
    `;
    document.head.appendChild(st);
  }

  // ---------- option labels ----------
  const HIRA = "あいうえおかきくけこさしすせそたちつてと";
  const KATA = "アイウエオカキクケコサシスセソタチツテト";
  const LABEL_STYLES = [
    ["upper", "A, B, C"],
    ["lower", "a, b, c"],
    ["numbers", "1, 2, 3"],
    ["roman-upper", "I, II, III"],
    ["roman-lower", "i, ii, iii"],
    ["hiragana", "あ, い, う"],
    ["katakana", "ア, イ, ウ"],
  ];
  function roman(n) {
    let s = "";
    [[10, "x"], [9, "ix"], [5, "v"], [4, "iv"], [1, "i"]].forEach(([v, r]) => { while (n >= v) { s += r; n -= v; } });
    return s;
  }
  function optionLabel(style, i) {
    switch (style) {
      case "lower": return String.fromCharCode(97 + i);
      case "numbers": return String(i + 1);
      case "roman-upper": return roman(i + 1).toUpperCase();
      case "roman-lower": return roman(i + 1);
      case "hiragana": return HIRA[i] || String(i + 1);
      case "katakana": return KATA[i] || String(i + 1);
      default: return String.fromCharCode(65 + i);
    }
  }
  window.quizOptionLabel = optionLabel;

  // ---------- data + grading ----------
  Object.assign(ScoringModule, {
    normalizeQuiz(test) {
      const q = test && test.quiz;
      if (!q) return null;
      if (q.kind !== "answers" && !isSurveyKind(q.kind) && q.kind !== "formative") q.kind = "standard";
      if (!q.settings || typeof q.settings !== "object") q.settings = {};
      const st = q.settings;
      if (!LABEL_STYLES.some(([id]) => id === st.labelStyle)) st.labelStyle = "upper";
      st.defaultOptions = Math.max(2, Math.min(MAX_OPTIONS, Math.round(Number(st.defaultOptions) || 4)));
      st.timeLimit = Math.max(0, Math.min(600, Math.round(Number(st.timeLimit) || 0)));
      const att = Number(st.attemptsAllowed);
      st.attemptsAllowed = Number.isFinite(att) && att >= 0 ? Math.min(99, Math.round(att)) : 1;
      if (!["best", "latest", "first"].includes(st.attemptRule)) st.attemptRule = "best";
      st.showAttempts = st.showAttempts === true;
      if (!Array.isArray(q.sections)) q.sections = [];
      if (!Array.isArray(q.submissions)) q.submissions = [];
      if (typeof q.token !== "string") q.token = null;
      q.sections.forEach((s) => {
        if (!Array.isArray(s.questions)) s.questions = [];
        s.questions.forEach((x) => {
          if (!Array.isArray(x.choices)) x.choices = [];
          if (!Array.isArray(x.accepted)) x.accepted = [];
          x.points = isSurveyKind(q.kind) ? 0 : Number(x.points) || 0;
          if (typeof x.correct !== "number") x.correct = 0;
          if (x.type === "multi") {
            x.correctSet = multiSet(x.correctSet).filter((i) => i < x.choices.length);
            if (!x.correctSet.length) x.correctSet = [0];
            x.partial = x.partial === true;
          }
        });
      });
      q.submissions.forEach((s) => {
        if (!s.answers || typeof s.answers !== "object") s.answers = {};
        if (!s.overrides || typeof s.overrides !== "object") s.overrides = {};
        s.attempt = Number(s.attempt) || 1;
      });
      test.maxPoints = this.quizTotal(q); // a quiz's max score is always the sum of its question points
      return q;
    },
    /** Switches an item between Quiz, Answer Collection, Research Survey and Formative Survey. Points are set aside while it is a survey and come back when it is not. */
    setQuizKind(toolId, testId, kind) {
      const test = this.findTest(toolId, testId);
      const quiz = this.normalizeQuiz(test);
      if (!quiz || !["standard", "answers", "survey", "formative"].includes(kind) || quiz.kind === kind) return;
      const wasSurvey = isSurveyKind(quiz.kind), willSurvey = isSurveyKind(kind);
      quiz.sections.forEach((sec) => sec.questions.forEach((x) => {
        if (!wasSurvey && willSurvey) x.keptPoints = x.points;
        if (wasSurvey && !willSurvey) x.points = Number.isFinite(Number(x.keptPoints)) ? Number(x.keptPoints) : 1;
      }));
      quiz.kind = kind;
      if (kind === "formative" && !Array.isArray(quiz.runs)) quiz.runs = [];
      this.normalizeQuiz(test);
      this.regradeQuiz(toolId, testId);
    },
    /** Quizzes ignore manual max-score edits: their max is the sum of the question points. */
    setTestMaxPoints(toolId, testId, value) {
      const test = this.findTest(toolId, testId);
      if (!test) return;
      if (test.quiz) { this.normalizeQuiz(test); return; }
      test.maxPoints = Math.max(0, Number(value) || 0);
    },
    quizOf(toolId, testId) {
      return this.normalizeQuiz(this.findTest(toolId, testId));
    },
    quizTotal(quiz) {
      return r2(quiz.sections.reduce((a, s) => a + s.questions.reduce((b, x) => b + x.points, 0), 0));
    },
    quizQuestionCount(quiz) {
      return quiz.sections.reduce((a, s) => a + s.questions.length, 0);
    },
    /** kind: "standard" (questions with text) or "answers" (Answer Collection: numbers and options only). */
    addQuizTest(toolId, name, kind) {
      const cfg = this.getTestBankConfig(toolId);
      if (!cfg) throw new Error("That Test & Quiz Bank no longer exists.");
      if (cfg.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`This bank is at its limit of ${MAX_TESTS_PER_BANK} tests/quizzes.`);
      const test = {
        id: newId("test"), name: (name || "").trim() || "Untitled quiz", maxPoints: 0, sourceFile: "Quiz editor",
        rows: [], scores: {}, unmatched: [],
        quiz: {
          kind: kind === "answers" ? "answers" : kind === "survey" ? "survey" : kind === "formative" ? "formative" : "standard",
          settings: { labelStyle: "upper", defaultOptions: 4, timeLimit: 0, attemptsAllowed: 1, attemptRule: "best" },
          sections: [{ id: newId("sec"), title: "Section 1", questions: [] }],
          token: null, submissions: [],
        },
      };
      cfg.tests.push(test);
      return test;
    },
    addQuizSection(quiz) {
      quiz.sections.push({ id: newId("sec"), title: `Section ${quiz.sections.length + 1}`, questions: [] });
    },
    addQuizQuestion(quiz, section, type) {
      if (this.quizQuestionCount(quiz) >= MAX_QUESTIONS) throw new Error(`Limit of ${MAX_QUESTIONS} questions.`);
      section.questions.push({
        id: newId("q"), type, text: "", points: 1,
        choices: type === "mc" || type === "multi" ? Array(quiz.settings.defaultOptions).fill("") : [], correct: 0, accepted: type === "blank" ? [""] : [],
        ...(type === "multi" ? { correctSet: [0], partial: false } : {}),
      });
    },
    duplicateQuizQuestion(quiz, section, index) {
      if (this.quizQuestionCount(quiz) >= MAX_QUESTIONS) throw new Error(`Limit of ${MAX_QUESTIONS} questions.`);
      const copy = JSON.parse(JSON.stringify(section.questions[index]));
      copy.id = newId("q");
      section.questions.splice(index + 1, 0, copy);
    },
    /** Sets how many options a multiple-choice question has (2-20), keeping the existing option texts. */
    setQuizChoiceCount(q, count) {
      count = Math.max(2, Math.min(MAX_OPTIONS, Math.round(Number(count) || 0)));
      while (q.choices.length < count) q.choices.push("");
      q.choices.length = count;
      if (q.correct >= count) q.correct = 0;
      if (Array.isArray(q.correctSet)) { q.correctSet = q.correctSet.filter((i) => i < count); if (!q.correctSet.length) q.correctSet = [0]; }
    },
    /** A student's answers after the teacher's edits. */
    quizEffectiveAnswers(s) {
      return { ...(s.answers || {}), ...(s.overrides || {}) };
    },
    /** Is this answer correct? MC: chosen index equals the key. Blank: matches any accepted answer (spacing/case/full-width ignored; numbers compare as numbers). */
    quizAnswerCorrect(q, ans) {
      if (ans === undefined || ans === null || ans === "") return false;
      if (q.type === "mc") return Number(ans) === q.correct;
      if (q.type === "multi") return this.quizAnswerFraction(q, ans) === 1;
      const a = this._matchKey(ans);
      return q.accepted.some((acc) => {
        const k = this._matchKey(acc);
        if (!k || !a) return false;
        if (k === a) return true;
        return !Number.isNaN(Number(k)) && !Number.isNaN(Number(a)) && Number(k) === Number(a);
      });
    },
    /** 0..1 share of the question earned. Multiple select: all-or-nothing, or (with partial credit on) right picks minus wrong picks over the number of right answers. */
    quizAnswerFraction(q, ans) {
      if (q.type !== "multi") return this.quizAnswerCorrect(q, ans) ? 1 : 0;
      const picked = multiSet(ans), key = multiSet(q.correctSet);
      if (!picked.length) return 0;
      const hits = picked.filter((i) => key.includes(i)).length, wrong = picked.length - hits;
      if (hits === key.length && wrong === 0) return 1;
      return q.partial ? Math.max(0, (hits - wrong) / key.length) : 0;
    },
    gradeQuizQuestion(q, ans) {
      if (q.type === "multi") return r2(q.points * this.quizAnswerFraction(q, ans));
      return this.quizAnswerCorrect(q, ans) ? q.points : 0;
    },
    gradeQuizSubmission(quiz, answers) {
      let sum = 0;
      quiz.sections.forEach((s) => s.questions.forEach((x) => (sum += this.gradeQuizQuestion(x, (answers || {})[x.id]))));
      return r2(sum);
    },
    /** Rebuilds the test's scores from the stored attempts: one score per student, picked by the quiz's attempt rule (best / latest / first). */
    regradeQuiz(toolId, testId) {
      const test = this.findTest(toolId, testId);
      const quiz = this.normalizeQuiz(test);
      if (!quiz) return;
      test.maxPoints = this.quizTotal(quiz);
      if (isSurveyKind(quiz.kind)) { test.rows = []; test.maxPoints = 0; this._matchTestRows(test); return; } // surveys are not scored
      const bySid = new Map();
      quiz.submissions.forEach((s) => {
        if (!bySid.has(s.sid)) bySid.set(s.sid, []);
        bySid.get(s.sid).push(s);
      });
      const rule = quiz.settings.attemptRule;
      test.rows = [];
      bySid.forEach((list, sid) => {
        list.sort((a, b) => a.attempt - b.attempt);
        const scores = list.map((s) => this.gradeQuizSubmission(quiz, this.quizEffectiveAnswers(s)));
        const score = rule === "latest" ? scores[scores.length - 1] : rule === "first" ? scores[0] : Math.max(...scores);
        const named = list.find((s) => s.name);
        test.rows.push({ name: named ? named.name : "", schoolId: sid, score: String(score) });
      });
      this._matchTestRows(test);
    },
  });

  // ---------- QR form (Supabase) ----------
  const QuizForms = {
    client() {
      if (typeof storage === "undefined" || !storage || !storage.client) throw new Error("Not signed in.");
      return storage.client;
    },
    explain(error) {
      const t = `${(error && error.code) || ""} ${(error && error.message) || ""}`;
      if (/PGRST20[25]|42P01|42883|schema cache|does not exist|Could not find|column/i.test(t)) {
        return new Error("Supabase needs the quiz update. Run sql/quiz-setup.sql and then sql/quiz-update.sql in Supabase (SQL Editor), then try again.");
      }
      return new Error((error && error.message) || "Something went wrong.");
    },
    token() {
      const b = new Uint8Array(16);
      crypto.getRandomValues(b);
      return Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
    },
    urlFor(token) {
      return new URL(`quizform.html?c=${encodeURIComponent(token)}`, location.href).href;
    },
    /** Questions WITHOUT answers, plus who may answer (roster students with a School ID). */
    build(toolId, testId) {
      const test = ScoringModule.findTest(toolId, testId);
      const quiz = ScoringModule.quizOf(toolId, testId);
      if (ScoringModule.quizQuestionCount(quiz) === 0) throw new Error("Add at least one question first.");
      const people = RosterModule.students
        .filter((s) => String(s.schoolId || "").trim())
        .map((s) => ({ sid: String(s.schoolId).trim(), name: s.name || "" }));
      if (people.length === 0) throw new Error("No students on the roster have a School ID yet.");
      const answersOnly = quiz.kind === "answers";
      const config = {
        kind: quiz.kind === "formative" ? "survey" : quiz.kind, // the student form treats both survey types alike
        labelStyle: quiz.settings.labelStyle,
        timeLimit: quiz.settings.timeLimit,
        maxAttempts: quiz.settings.attemptsAllowed,
        showAttempts: quiz.settings.showAttempts && quiz.settings.attemptsAllowed !== 1,
        sections: quiz.sections.map((s) => ({
          title: s.title,
          questions: s.questions.map((x) => ({
            id: x.id, type: x.type, text: answersOnly ? "" : x.text, points: isSurveyKind(quiz.kind) ? 0 : x.points,
            choices: isChoiceQ(x) ? (answersOnly ? x.choices.map(() => "") : x.choices) : undefined,
            divider: x.dividerAfter ? true : undefined,
          })),
        })),
      };
      return { title: test.name, config, people };
    },
    async create(toolId, testId) {
      const quiz = ScoringModule.quizOf(toolId, testId);
      const { title, config, people } = this.build(toolId, testId);
      if (quiz.kind === "formative") archiveRun(quiz); // a new QR code starts a new run; the earlier answers are kept as a saved run
      const token = this.token();
      const { error } = await this.client().from("quiz_forms").insert({ token, title, config, people });
      if (error) throw this.explain(error);
      quiz.token = token;
      return this.urlFor(token);
    },
    /** Re-publishes the questions/settings/roster, copies answers (keeping the teacher's edits), grades. Returns { responses, students, expected, missing }. */
    async sync(toolId, testId) {
      const quiz = ScoringModule.quizOf(toolId, testId);
      if (!quiz.token) throw new Error("This quiz's QR code is closed.");
      const { title, config, people } = this.build(toolId, testId);
      const c = this.client();
      const up = await c.from("quiz_forms").update({ title, config, people }).eq("token", quiz.token);
      if (up.error) throw this.explain(up.error);
      const { data, error } = await c.from("quiz_responses").select("respondent, payload, submitted_at, attempt").eq("token", quiz.token);
      if (error) throw this.explain(error);
      const nameOf = new Map(people.map((p) => [p.sid, p.name]));
      const known = new Map(quiz.submissions.map((s) => [`${s.sid}|${s.attempt}`, s]));
      (data || []).forEach((r) => {
        const attempt = Number(r.attempt) || 1;
        const k = `${r.respondent}|${attempt}`;
        const rec = known.get(k) || { sid: r.respondent, attempt, overrides: {} };
        rec.name = nameOf.get(r.respondent) || rec.name || "";
        rec.answers = (r.payload && r.payload.answers) || {};
        rec.at = r.submitted_at;
        known.set(k, rec); // teacher edits (overrides) are kept
      });
      quiz.submissions = [...known.values()];
      ScoringModule.regradeQuiz(toolId, testId);
      const done = new Set(quiz.submissions.map((s) => s.sid));
      return {
        responses: quiz.submissions.length, students: done.size, expected: people.length,
        missing: people.filter((p) => !done.has(p.sid)).map((p) => p.name || p.sid),
      };
    },
    /** Closes the QR code and deletes server copies; graded answers stay in this app. */
    async close(toolId, testId) {
      const quiz = ScoringModule.quizOf(toolId, testId);
      if (!quiz.token) return;
      const { error } = await this.client().from("quiz_forms").delete().eq("token", quiz.token);
      if (error) throw this.explain(error);
      quiz.token = null;
    },
  };
  window.QuizFormsModule = QuizForms;

  // ---------- shared tests & quizzes (one list, visible from every course) ----------
  const MAX_SHARED_TESTS = 100;
  const SharedTests = {
    items: [], // [{ id, name, maxPoints, quiz | null, sourceCourseName, createdAt, section }]
    sections: [], // [{ id, name, collapsed }]
    loaded: false,
    scope: "mine", // "mine" or a group id (groups are made in the Admin screen)
    scopeLabel() { return this.scope === "mine" ? "Shared" : "the group's shared list"; },
    async load() {
      const data = this.scope === "mine" ? await storage.loadFile("sharedtests.json") : await window.GroupShare.loadDoc(this.scope, "tests");
      this.items = data && Array.isArray(data.items) ? data.items : [];
      this.sections = data && Array.isArray(data.sections) ? data.sections.filter((s) => s && s.id) : [];
      this.loaded = true;
    },
    async ensureLoaded() { if (!this.loaded) await this.load(); },
    async save() {
      const doc = { items: this.items, sections: this.sections };
      if (this.scope === "mine") await storage.saveFile("sharedtests.json", doc);
      else await window.GroupShare.saveDoc(this.scope, "tests", doc);
    },
    kindOf(item) { return item.quiz ? (item.quiz.kind === "answers" ? "Answer Collection" : isSurveyKind(item.quiz.kind) ? "Research Survey" : item.quiz.kind === "formative" ? "Formative Survey" : "Quiz") : "Test"; },
    /** A copy of a course's test or quiz WITHOUT students: no rows, scores, unmatched names, submitted answers or QR link. */
    snapshot(test, courseName) {
      const quiz = test.quiz ? ScoringModule.normalizeQuiz(test) : null;
      if (quiz && !test.fam) test.fam = newId("fam"); // a family id lets the QTS Bank find and sync this quiz's copies
      return {
        id: newId("shared"),
        fam: quiz ? test.fam : undefined,
        name: test.name,
        maxPoints: quiz ? ScoringModule.quizTotal(quiz) : Number(test.maxPoints) || 0,
        quiz: quiz ? JSON.parse(JSON.stringify({ kind: quiz.kind, settings: quiz.settings, sections: quiz.sections })) : null,
        sourceCourseName: courseName || "",
        createdAt: new Date().toISOString(),
      };
    },
    /** Adds a copy to the shared list (re-reads the list first so other devices' changes aren't lost). */
    async addFromCourse(test, courseName) {
      await this.load();
      if (this.items.length >= MAX_SHARED_TESTS) throw new Error(`The shared list is at its limit of ${MAX_SHARED_TESTS}.`);
      this.items.push(this.snapshot(test, courseName));
      await this.save();
    },
    async rename(id, name) {
      const trimmed = (name || "").trim();
      if (!trimmed) throw new Error("The name can't be empty.");
      await this.load();
      const item = this.items.find((x) => x.id === id);
      if (item) { item.name = trimmed; await this.save(); }
    },
    async remove(id) {
      await this.load();
      this.items = this.items.filter((x) => x.id !== id);
      await this.save();
    },
    /** Copies a shared item into this course's bank; the course's own students are used (nobody has answered yet). */
    copyToCourse(toolId, item) {
      const cfg = ScoringModule.getTestBankConfig(toolId);
      if (!cfg) throw new Error("That Test & Quiz Bank no longer exists.");
      if (cfg.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`This bank is at its limit of ${MAX_TESTS_PER_BANK} tests/quizzes.`);
      const test = {
        id: newId("test"), name: item.name, maxPoints: Number(item.maxPoints) || 0,
        sourceFile: item.quiz ? "Quiz editor" : "Shared test",
        rows: [], scores: {}, unmatched: [],
      };
      if (item.fam && item.quiz) test.fam = item.fam;
      if (item.quiz) {
        test.quiz = { ...JSON.parse(JSON.stringify(item.quiz)), token: null, submissions: [] };
        ScoringModule.normalizeQuiz(test);
      }
      cfg.tests.push(test);
      return test;
    },
  };
  window.SharedTestsModule = SharedTests;

  function flush() {
    try { if (window.GGOAutosave && window.GGOAutosave.enabled()) window.GGOAutosave.flush(); } catch (e) {}
  }

  // ---------- UI helpers ----------
  function h(tag, cls, text) {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }
  function button(label, cls, onClick) {
    const b = h("button", cls || "btn btn-ghost btn-small", label);
    b.type = "button";
    b.addEventListener("click", onClick);
    return b;
  }
  function textInput(value, placeholder, onChange, cls) {
    const i = h("input", cls);
    i.type = "text";
    i.value = value;
    if (placeholder) i.placeholder = placeholder;
    i.addEventListener("change", () => onChange(i.value));
    return i;
  }
  const kindName = (quiz) => (quiz.kind === "answers" ? "Answer Collection" : isSurveyKind(quiz.kind) ? "Research Survey" : quiz.kind === "formative" ? "Formative Survey" : "Quiz");

  // ---------- shared editor header ----------
  function editorHeader(tool, container, test, quiz, current) {
    const rerender = () => renderScoringToolView(tool, container);
    const bar = h("div", "panel-toolbar qz-header");
    const left = h("div", "panel-toolbar-buttons");
    left.appendChild(button("← Back to bank", "btn btn-ghost", () => { editing.delete(tool.id); rerender(); }));
    left.appendChild(h("label", "", "Type:"));
    const typeSel = h("select");
    [["standard", "Quiz"], ["answers", "Answer Collection"], ["survey", "Research Survey"], ["formative", "Formative Survey"]].forEach(([id, text]) => {
      const o = h("option", "", text); o.value = id; if (id === quiz.kind) o.selected = true; typeSel.appendChild(o);
    });
    typeSel.title = "Change this item between a Quiz, an Answer Collection and a Survey. Questions are kept; points are set aside for surveys and restored when you switch back.";
    typeSel.addEventListener("change", () => {
      const to = typeSel.value;
      const lose = isSurveyKind(to) && !isSurveyKind(quiz.kind) && quiz.submissions.length;
      if (lose && !confirm("Switching to a survey stops scoring: the answer key and points are kept but ignored, and students' scores are hidden until you switch back. Continue?")) { typeSel.value = quiz.kind; return; }
      ScoringModule.setQuizKind(tool.id, test.id, to);
      viewOf.set(tool.id, "build");
      if (quiz.token) alert("This item's QR code is open: click Get Responses in the list to publish the new type to students.");
      rerender();
    });
    left.appendChild(typeSel);
    left.appendChild(h("label", "", `${kindName(quiz)} name:`));
    left.appendChild(textInput(test.name, "", (v) => { ScoringModule.renameTest(tool.id, test.id, v); rerender(); }));
    left.appendChild(button("Edit questions", "qz-tab " + (current === "build" ? "btn btn-primary btn-small" : "btn btn-ghost btn-small"), () => { viewOf.set(tool.id, "build"); rerender(); }));
    bar.appendChild(left);
    bar.appendChild(h("span", "count-badge", isSurveyKind(quiz.kind) ? `${ScoringModule.quizQuestionCount(quiz)} questions` : `${ScoringModule.quizQuestionCount(quiz)} questions · ${ScoringModule.quizTotal(quiz)} points`));
    return bar;
  }

  /** A row of option checkboxes (A, B, C…) for picking a set of options. */
  function multiBoxes(q, style, current, onChange) {
    const wrap = h("span"); wrap.style.cssText = "display:inline-flex;flex-wrap:wrap;gap:4px 12px;align-items:center;";
    const set = new Set(current);
    q.choices.forEach((c, ci) => {
      const l = h("label"); l.style.whiteSpace = "nowrap";
      const cb = h("input"); cb.type = "checkbox"; cb.checked = set.has(ci);
      cb.addEventListener("change", () => { if (cb.checked) set.add(ci); else set.delete(ci); onChange([...set].sort((a, b) => a - b)); });
      l.append(cb, document.createTextNode(" " + optionLabel(style, ci)));
      wrap.appendChild(l);
    });
    return wrap;
  }

  // ---------- the question editor ----------
  function renderEditor(tool, container, testId) {
    const test = ScoringModule.findTest(tool.id, testId);
    const quiz = ScoringModule.quizOf(tool.id, testId);
    const answersOnly = quiz.kind === "answers";
    const isSurvey = isSurveyKind(quiz.kind);
    const style = quiz.settings.labelStyle;
    container.innerHTML = "";
    const rerender = () => renderScoringToolView(tool, container);
    const regrade = () => ScoringModule.regradeQuiz(tool.id, testId);

    container.appendChild(editorHeader(tool, container, test, quiz, "build"));

    // ----- quiz settings -----
    {
      const { section, body } = makePresSection(`⚙ ${kindName(quiz)} settings`);
      section.classList.add("qz-sec-settings");
      const addRow = (labelText, control) => {
        const row = h("div", "mapping-row");
        row.appendChild(h("label", "", labelText));
        row.appendChild(control);
        body.appendChild(row);
      };
      const sel = h("select");
      LABEL_STYLES.forEach(([id, text]) => {
        const o = h("option", "", text);
        o.value = id;
        if (id === style) o.selected = true;
        sel.appendChild(o);
      });
      sel.addEventListener("change", () => { quiz.settings.labelStyle = sel.value; rerender(); });
      addRow("Option labels", sel);
      addRow("Options in new multiple-choice questions", textInput(String(quiz.settings.defaultOptions), "", (v) => { quiz.settings.defaultOptions = Math.max(2, Math.min(MAX_OPTIONS, Math.round(Number(v) || 4))); rerender(); }, "point-value-input"));
      addRow("Time limit (minutes, 0 = none)", textInput(String(quiz.settings.timeLimit), "", (v) => { quiz.settings.timeLimit = Math.max(0, Math.min(600, Math.round(Number(v) || 0))); rerender(); }, "point-value-input"));
      addRow("Attempts per student (0 = unlimited)", textInput(String(quiz.settings.attemptsAllowed), "", (v) => { const a = Number(v); quiz.settings.attemptsAllowed = Number.isFinite(a) && a >= 0 ? Math.min(99, Math.round(a)) : 1; regrade(); rerender(); }, "point-value-input"));
      if (quiz.settings.attemptsAllowed !== 1) {
        const rule = h("select");
        [["best", "Best attempt"], ["latest", "Latest attempt"], ["first", "First attempt"]].forEach(([id, text]) => {
          const o = h("option", "", text);
          o.value = id;
          if (id === quiz.settings.attemptRule) o.selected = true;
          rule.appendChild(o);
        });
        rule.addEventListener("change", () => { quiz.settings.attemptRule = rule.value; regrade(); });
        if (!isSurvey) addRow("Score that counts", rule);
        const sa = h("input");
        sa.type = "checkbox";
        sa.checked = quiz.settings.showAttempts;
        sa.addEventListener("change", () => { quiz.settings.showAttempts = sa.checked; });
        addRow("Show students their attempt number and attempts left", sa);
      }
      body.appendChild(h("p", "hint", "The timer starts when a student enters their School ID, is shown on their screen, and their answers are submitted automatically when it runs out (late answers are refused). If the QR code is already open, click Get Responses (in the Tests & Quizzes list) to publish changed settings."));
      container.appendChild(section);
    }

    let n = 0;
    quiz.sections.forEach((sec, si) => {
      const { section, body } = makePresSection(`Section ${si + 1}: ${sec.title || "(untitled)"}`);
      section.classList.add("qz-sec-q" + (si % 4));
      const top = h("div", "panel-toolbar");
      top.appendChild(textInput(sec.title, "Section title", (v) => { sec.title = v; rerender(); }));
      const tb = h("div", "panel-toolbar-buttons");
      tb.appendChild(button("+ Multiple choice", "btn btn-ghost btn-small", () => { try { ScoringModule.addQuizQuestion(quiz, sec, "mc"); } catch (e) { alert(e.message); return; } rerender(); }));
      tb.appendChild(button("+ Multiple select", "btn btn-ghost btn-small", () => { try { ScoringModule.addQuizQuestion(quiz, sec, "multi"); } catch (e) { alert(e.message); return; } rerender(); }));
      tb.appendChild(button("+ Fill in the blank", "btn btn-ghost btn-small", () => { try { ScoringModule.addQuizQuestion(quiz, sec, "blank"); } catch (e) { alert(e.message); return; } rerender(); }));
      if (quiz.sections.length > 1) {
        tb.appendChild(button("Delete section", "btn btn-ghost btn-small", () => {
          if (!confirm(`Delete "${sec.title}" and its ${sec.questions.length} question(s)?`)) return;
          quiz.sections.splice(si, 1);
          regrade();
          rerender();
        }));
      }
      top.appendChild(tb);
      body.appendChild(top);

      sec.questions.forEach((q, qi) => {
        n++;
        const box = h("div", "category-manage-item qz-q " + (isChoiceQ(q) ? "qz-q-mc" : "qz-q-blank"));
        box.style.marginBottom = "14px";
        const row = h("div", "category-manage-top-row");
        row.appendChild(h("span", "qz-qnum", `Q${n}`));
        row.appendChild(h("span", "qz-pill", typeName(q)));
        if (answersOnly) {
          const spacer = h("span");
          spacer.style.flex = "1";
          row.appendChild(spacer);
        } else {
          const text = textInput(q.text, "Question text", (v) => { q.text = v; });
          text.style.flex = "1";
          text.style.maxWidth = "none";
          row.appendChild(text);
        }
        if (!isSurvey) {
          row.appendChild(h("span", "hint", "pts"));
          row.appendChild(textInput(String(q.points), "", (v) => { q.points = Math.max(0, Number(v) || 0); regrade(); rerender(); }, "point-value-input"));
        }
        row.appendChild(button(q.dividerAfter ? "Line below ✓" : "Line below", "btn btn-ghost btn-small", () => { q.dividerAfter = !q.dividerAfter; rerender(); }));
        row.appendChild(button("Duplicate", "btn btn-ghost btn-small", () => { try { ScoringModule.duplicateQuizQuestion(quiz, sec, qi); } catch (e) { alert(e.message); return; } regrade(); rerender(); }));
        row.appendChild(button("×", "btn btn-ghost btn-small", () => { sec.questions.splice(qi, 1); regrade(); rerender(); }));
        box.appendChild(row);
        if (q.dividerAfter) box.style.borderBottom = "4px double var(--line, #999)";

        if (isChoiceQ(q)) {
          const cnt = h("div", "mapping-row");
          cnt.appendChild(h("label", "", "Number of options"));
          cnt.appendChild(textInput(String(q.choices.length), "", (v) => { ScoringModule.setQuizChoiceCount(q, v); regrade(); rerender(); }, "point-value-input"));
          box.appendChild(cnt);
          if (!answersOnly) {
            q.choices.forEach((c, ci) => {
              const crow = h("div", "mapping-row qz-opt-row");
              crow.appendChild(h("label", "", optionLabel(style, ci)));
              const inp = textInput(c, "Option text", (v) => { q.choices[ci] = v.trim(); rerender(); });
              inp.style.flex = "1";
              crow.appendChild(inp);
              box.appendChild(crow);
            });
          }
          const keyRow = h("div", "mapping-row qz-keyrow");
          if (isSurvey) keyRow.style.display = "none"; // surveys have no answer key
          if (q.type === "multi") {
            keyRow.appendChild(h("label", "", "✔ Correct answers"));
            keyRow.appendChild(multiBoxes(q, style, multiSet(q.correctSet), (set) => { q.correctSet = set.length ? set : [0]; regrade(); rerender(); }));
            box.appendChild(keyRow);
            if (!isSurvey) {
              const pr = h("label", "mapping-row"); const pc = h("input"); pc.type = "checkbox"; pc.checked = q.partial === true;
              pc.addEventListener("change", () => { q.partial = pc.checked; regrade(); rerender(); });
              pr.append(pc, document.createTextNode(" Partial credit (right picks minus wrong picks, out of the number of right answers; otherwise all-or-nothing)"));
              box.appendChild(pr);
            }
          } else {
          keyRow.appendChild(h("label", "", "✔ Correct answer"));
          const sel = h("select");
          q.choices.forEach((c, ci) => {
            const o = h("option", "", answersOnly || !c ? optionLabel(style, ci) : `${optionLabel(style, ci)}: ${c}`);
            o.value = String(ci);
            if (ci === q.correct) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener("change", () => { q.correct = Number(sel.value); regrade(); });
          keyRow.appendChild(sel);
          box.appendChild(keyRow);
          }
        } else if (isSurvey) {
          box.appendChild(h("p", "hint", "Students type their own answer. Surveys have no answer key and no points."));
        } else {
          if (q.accepted.length === 0) q.accepted.push("");
          q.accepted.forEach((a, ai) => {
            const arow = h("div", "mapping-row" + (ai === 0 ? " qz-keyrow" : " qz-opt-row"));
            arow.appendChild(h("label", "", ai === 0 ? "✔ Correct answer" : `Alternate answer ${ai}`));
            const inp = textInput(a, ai === 0 ? "e.g. 42" : "Another accepted answer", (v) => { q.accepted[ai] = v.trim(); regrade(); });
            inp.style.flex = "1";
            arow.appendChild(inp);
            if (q.accepted.length > 1) arow.appendChild(button("×", "btn btn-ghost btn-small", () => { q.accepted.splice(ai, 1); regrade(); rerender(); }));
            box.appendChild(arow);
          });
          box.appendChild(button("+ Add alternate answer", "btn btn-ghost btn-small", () => { q.accepted.push(""); rerender(); }));
          box.appendChild(h("p", "hint", "Case, spacing and full-width/half-width forms are ignored; numbers match as numbers (42 = 042)."));
        }
        body.appendChild(box);
      });
      if (sec.questions.length === 0) body.appendChild(h("p", "hint", "No questions yet — use the buttons above."));
      container.appendChild(section);
    });
    container.appendChild(button("+ Add Section", "btn btn-ghost", () => { ScoringModule.addQuizSection(quiz); rerender(); }));

  }

  // ---------- the review grid ----------
  function renderReview(tool, container, testId) {
    const test = ScoringModule.findTest(tool.id, testId);
    const quiz = ScoringModule.quizOf(tool.id, testId);
    const style = quiz.settings.labelStyle;
    container.innerHTML = "";
    const regrade = () => ScoringModule.regradeQuiz(tool.id, testId);

    container.appendChild(editorHeader(tool, container, test, quiz, "review"));
    const { section, body } = makePresSection("Review & edit answers   ● correct   ✕ incorrect");
    section.classList.add("qz-sec-review");
    container.appendChild(section);
    body.appendChild(h("p", "hint", "● green = correct, ✕ red = incorrect. Change any student's answer in its box, or fix an answer in the \"Answer key\" row — scores update instantly. Edited answers get a yellow outline and are kept when you Get Responses again."));

    if (quiz.submissions.length === 0) {
      body.appendChild(h("p", "hint", "No answers yet. Launch the QR code from the Tests & Quizzes list, then click Get Responses."));
      return;
    }

    const qs = [];
    quiz.sections.forEach((s) => s.questions.forEach((q) => qs.push(q)));
    const total = ScoringModule.quizTotal(quiz);
    const wrap = h("div", "attendance-table-wrap");
    const table = h("table", "attendance-table qz-review");
    wrap.appendChild(table);
    body.appendChild(wrap);

    const thead = h("thead");
    const hr = h("tr");
    ["Student", "Attempt", "Score"].forEach((t) => hr.appendChild(h("th", "", t)));
    qs.forEach((q, i) => {
      const th = h("th");
      th.style.textAlign = "center";
      th.appendChild(h("div", "", `Q${i + 1}`));
      th.appendChild(h("div", "item-points-label", `${q.points} pt`));
      hr.appendChild(th);
    });
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = h("tbody");
    table.appendChild(tbody);

    // answer key row
    const keyTr = h("tr", "qz-key");
    const keyLabel = h("td", "", "🔑 Answer key");
    keyLabel.style.fontWeight = "700";
    keyTr.appendChild(keyLabel);
    keyTr.appendChild(h("td"));
    keyTr.appendChild(h("td"));
    qs.forEach((q) => {
      const td = h("td");
      if (q.type === "multi") {
        td.appendChild(multiBoxes(q, style, multiSet(q.correctSet), (set) => { q.correctSet = set.length ? set : [0]; regrade(); refresh(); }));
      } else if (q.type === "mc") {
        const sel = h("select");
        q.choices.forEach((c, ci) => {
          const o = h("option", "", optionLabel(style, ci));
          o.value = String(ci);
          if (ci === q.correct) o.selected = true;
          sel.appendChild(o);
        });
        sel.addEventListener("change", () => { q.correct = Number(sel.value); regrade(); refresh(); });
        td.appendChild(sel);
      } else {
        const inp = h("input");
        inp.type = "text";
        inp.value = q.accepted.filter(Boolean).join(" | ");
        inp.title = "Correct answer; separate alternate answers with |";
        inp.style.minWidth = "7em";
        inp.addEventListener("change", () => {
          q.accepted = inp.value.split("|").map((s) => s.trim()).filter(Boolean);
          if (q.accepted.length === 0) q.accepted = [""];
          regrade();
          refresh();
        });
        td.appendChild(inp);
      }
      keyTr.appendChild(td);
    });
    tbody.appendChild(keyTr);

    // student rows
    const rows = [];
    let lastSid = null;
    const sorted = [...quiz.submissions].sort((a, b) => (a.name || a.sid).localeCompare(b.name || b.sid) || a.attempt - b.attempt);
    sorted.forEach((s) => {
      const tr = h("tr", s.sid !== lastSid ? "qz-newstudent" : "");
      lastSid = s.sid;
      const nameTd = h("td", "", s.name || "(not on roster)");
      nameTd.appendChild(h("div", "hint", s.sid));
      tr.appendChild(nameTd);
      tr.appendChild(h("td", "", String(s.attempt)));
      const scoreTd = h("td");
      scoreTd.style.fontWeight = "700";
      scoreTd.style.whiteSpace = "nowrap";
      tr.appendChild(scoreTd);

      const cells = [];
      qs.forEach((q) => {
        const td = h("td");
        const cell = h("div");
        cell.style.cssText = "display:flex;align-items:center;gap:6px;padding:2px 4px;";
        let ctl;
        const current = ScoringModule.quizEffectiveAnswers(s)[q.id];
        const setOverride = (val) => {
          const orig = s.answers[q.id];
          const same = String(orig === undefined || orig === null ? "" : orig) === String(val);
          if (same) delete s.overrides[q.id];
          else s.overrides[q.id] = val;
          regrade();
          refresh();
        };
        if (q.type === "multi") {
          ctl = multiBoxes(q, style, multiSet(current), (set) => setOverride(set.join(",")));
        } else if (q.type === "mc") {
          ctl = h("select");
          const blank = h("option", "", "—");
          blank.value = "";
          ctl.appendChild(blank);
          q.choices.forEach((c, ci) => {
            const o = h("option", "", optionLabel(style, ci));
            o.value = String(ci);
            ctl.appendChild(o);
          });
          ctl.value = current === undefined || current === null || current === "" ? "" : String(current);
          ctl.addEventListener("change", () => setOverride(ctl.value === "" ? "" : Number(ctl.value)));
        } else {
          ctl = h("input");
          ctl.type = "text";
          ctl.value = current === undefined || current === null ? "" : String(current);
          ctl.style.minWidth = "6em";
          ctl.addEventListener("change", () => setOverride(ctl.value.trim()));
        }
        const mark = h("span");
        mark.style.cssText = "font-size:1.15rem;font-weight:700;min-width:1.2em;text-align:center;";
        cell.appendChild(ctl);
        cell.appendChild(mark);
        td.appendChild(cell);
        tr.appendChild(td);
        cells.push({ q, mark, cell, td });
      });
      tbody.appendChild(tr);
      rows.push({ s, cells, scoreTd });
    });

    // % correct footer
    const tfoot = h("tfoot");
    const ftr = h("tr");
    const fl = h("td", "attendance-footer-label", "% correct");
    ftr.appendChild(fl);
    ftr.appendChild(h("td"));
    ftr.appendChild(h("td"));
    const pctCells = qs.map(() => { const td = h("td"); td.style.textAlign = "center"; ftr.appendChild(td); return td; });
    tfoot.appendChild(ftr);
    table.appendChild(tfoot);

    function refresh() {
      const correctCount = qs.map(() => 0);
      rows.forEach((r) => {
        const eff = ScoringModule.quizEffectiveAnswers(r.s);
        r.cells.forEach((c, i) => {
          const frac = ScoringModule.quizAnswerFraction(c.q, eff[c.q.id]);
          const ok = frac === 1, part = frac > 0 && frac < 1;
          if (ok) correctCount[i]++;
          c.td.className = ok ? "qz-ok" : "qz-bad";
          c.mark.textContent = ok ? "●" : part ? "◐" : "✕";
          c.mark.style.color = ok ? "#1e9e4a" : part ? "#d28a00" : "#d3302f";
          const edited = Object.prototype.hasOwnProperty.call(r.s.overrides, c.q.id);
          c.cell.style.outline = edited ? "2px solid #e0a800" : "none";
          c.cell.title = edited ? "Edited by you" : "";
        });
        r.scoreTd.textContent = `${ScoringModule.gradeQuizSubmission(quiz, eff)} / ${total}`;
      });
      pctCells.forEach((td, i) => { td.textContent = `${Math.round((100 * correctCount[i]) / rows.length)}%`; });
    }
    refresh();
  }

  // ---------- CSV export ----------
  const sortedSubs = (quiz) => [...quiz.submissions].sort((a, b) => (a.name || a.sid).localeCompare(b.name || b.sid) || a.attempt - b.attempt);
  const allQuestions = (quiz) => {
    const out = [];
    quiz.sections.forEach((sec) => sec.questions.forEach((q) => out.push({ q, sec })));
    return out;
  };
  const optionText = (quiz, q, ans) => {
    if (ans === undefined || ans === null || ans === "") return "";
    if (q.type === "multi") return multiSet(ans).map((i) => optionText(quiz, q, i)).join(", ");
    if (q.type !== "mc") return String(ans);
    const i = Number(ans);
    const label = optionLabel(quiz.settings.labelStyle, i);
    const t = quiz.kind === "answers" ? "" : (q.choices[i] || "");
    return t ? `${label}: ${t}` : label;
  };
  function csvCell(v) {
    let t = v === undefined || v === null ? "" : String(v);
    if (/^[=+\-@\t\r]/.test(t) && Number.isNaN(Number(t))) t = "'" + t; // stops spreadsheets from running typed text as a formula
    return /[",\r\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t;
  }
  let exportSink = null; // set by QuizExport so the same row builders can produce Excel files
  function downloadCsv(filename, rows) {
    if (exportSink) { exportSink(filename, rows); return; }
    rawCsv(filename, rows);
  }
  function rawCsv(filename, rows) {
    const text = "\ufeff" + rows.map((r) => r.map(csvCell).join(",")).join("\r\n"); // BOM so Excel reads Japanese correctly
    const url = URL.createObjectURL(new Blob([text], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
  const safeName = (name, suffix) => `${String(name || "quiz").replace(/[\\/:*?"<>|]+/g, "_").trim() || "quiz"} - ${suffix}.csv`;
  const qHeader = (quiz, q, i) => (quiz.kind === "answers" || !q.text ? `Q${i + 1}` : `Q${i + 1}: ${q.text}`);

  /** One row per attempt: who, when, score (graded types), and each answer. */
  function exportResponses(test, quiz) {
    const qs = allQuestions(quiz);
    const graded = !isSurveyKind(quiz.kind);
    const head = ["Student", "School ID", "Attempt", "Submitted"];
    if (graded) head.push("Score", "Max score");
    head.push("Edited by teacher", ...qs.map((x, i) => qHeader(quiz, x.q, i)));
    const rows = [head];
    sortedSubs(quiz).forEach((s) => {
      const eff = ScoringModule.quizEffectiveAnswers(s);
      const edited = qs.map((x, i) => (Object.prototype.hasOwnProperty.call(s.overrides, x.q.id) ? `Q${i + 1}` : "")).filter(Boolean).join(" ");
      const row = [s.name || "", s.sid, s.attempt, s.at || ""];
      if (graded) row.push(ScoringModule.gradeQuizSubmission(quiz, eff), ScoringModule.quizTotal(quiz));
      row.push(edited, ...qs.map((x) => optionText(quiz, x.q, eff[x.q.id])));
      rows.push(row);
    });
    downloadCsv(safeName(test.name, "responses"), rows);
  }

  /** Graded types: points earned on each question for every attempt, and which attempt counts. */
  function exportScores(test, quiz) {
    const qs = allQuestions(quiz);
    const subs = sortedSubs(quiz);
    const totals = new Map(subs.map((s) => [s, ScoringModule.gradeQuizSubmission(quiz, ScoringModule.quizEffectiveAnswers(s))]));
    const counts = new Set();
    const bySid = new Map();
    subs.forEach((s) => { if (!bySid.has(s.sid)) bySid.set(s.sid, []); bySid.get(s.sid).push(s); });
    bySid.forEach((list) => {
      const rule = quiz.settings.attemptRule;
      let pick = list[list.length - 1];
      if (rule === "first") pick = list[0];
      if (rule === "best") pick = list.reduce((b, s) => (totals.get(s) > totals.get(b) ? s : b), list[0]);
      counts.add(pick);
    });
    const rows = [["Student", "School ID", "Attempt", ...qs.map((x, i) => `Q${i + 1} (${x.q.points} pt)`), "Total", "Max score", "Counts toward score"]];
    subs.forEach((s) => {
      const eff = ScoringModule.quizEffectiveAnswers(s);
      rows.push([s.name || "", s.sid, s.attempt, ...qs.map((x) => ScoringModule.gradeQuizQuestion(x.q, eff[x.q.id])), totals.get(s), ScoringModule.quizTotal(quiz), counts.has(s) ? "Yes" : ""]);
    });
    downloadCsv(safeName(test.name, "scores"), rows);
  }

  /** Tallies per question (long form): every option or distinct typed answer, how many chose it, and % (plus % correct for graded types). */
  function summaryTallies(quiz) {
    return allQuestions(quiz).map(({ q, sec }, i) => {
      const answers = quiz.submissions.map((s) => ScoringModule.quizEffectiveAnswers(s)[q.id]).map((a) => (a === undefined || a === null ? "" : a));
      const answered = answers.filter((a) => a !== "");
      const items = [];
      if (q.type === "multi") {
        q.choices.forEach((c, ci) => items.push({ label: optionText(quiz, q, ci), count: answered.filter((a) => multiSet(a).includes(ci)).length, correct: !isSurveyKind(quiz.kind) && multiSet(q.correctSet).includes(ci) }));
      } else if (q.type === "mc") {
        q.choices.forEach((c, ci) => items.push({ label: optionText(quiz, q, ci), count: answered.filter((a) => Number(a) === ci).length, correct: !isSurveyKind(quiz.kind) && ci === q.correct }));
      } else {
        const m = new Map();
        answered.forEach((a) => { const k = String(a).trim(); m.set(k, (m.get(k) || 0) + 1); });
        [...m.entries()].sort((a, b) => b[1] - a[1]).forEach(([label, count]) => items.push({ label, count, correct: !isSurveyKind(quiz.kind) && ScoringModule.quizAnswerCorrect(q, label) }));
      }
      return { n: i + 1, q, sec, total: answers.length, answered: answered.length, items };
    });
  }
  function exportSummary(test, quiz) {
    const graded = !isSurveyKind(quiz.kind);
    const rows = [["Question", "Section", "Question text", "Type", "Answer / option", "Count", "Percent of answers", ...(graded ? ["Correct answer"] : [])]];
    summaryTallies(quiz).forEach((t) => {
      const base = [`Q${t.n}`, t.sec.title || "", quiz.kind === "answers" ? "" : t.q.text, typeName(t.q)];
      if (t.items.length === 0) rows.push([...base, "(no answers)", 0, "", ...(graded ? [""] : [])]);
      t.items.forEach((it) => rows.push([...base, it.label, it.count, t.answered ? `${Math.round((1000 * it.count) / t.answered) / 10}%` : "", ...(graded ? [it.correct ? "Yes" : ""] : [])]));
      rows.push([...base, "(no answer)", t.total - t.answered, "", ...(graded ? [""] : [])]);
    });
    downloadCsv(safeName(test.name, "summary"), rows);
  }
  /** The questions and answer key (what is copied between lists; works for items with no answers). */
  function exportQuestions(test, quiz) {
    const rows = [["Section", "Q#", "Type", ...(quiz.kind === "answers" ? [] : ["Question text"]), ...(isSurveyKind(quiz.kind) ? [] : ["Points"]), "Options", ...(isSurveyKind(quiz.kind) ? [] : ["Correct answer", "Other accepted answers"])]];
    let n = 0;
    quiz.sections.forEach((sec) => (sec.questions || []).forEach((q) => {
      n++;
      const opts = isChoiceQ(q) ? q.choices.map((c, i) => `${optionLabel(quiz.settings.labelStyle, i)}${c && quiz.kind !== "answers" ? ": " + c : ""}`).join(" | ") : "";
      const correct = q.type === "multi" ? multiSet(q.correctSet).map((i) => optionLabel(quiz.settings.labelStyle, i)).join(", ") : q.type === "mc" ? optionLabel(quiz.settings.labelStyle, q.correct) : (q.accepted[0] || "");
      rows.push([sec.title || "", `Q${n}`, typeName(q), ...(quiz.kind === "answers" ? [] : [q.text || ""]), ...(isSurveyKind(quiz.kind) ? [] : [q.points]), opts, ...(isSurveyKind(quiz.kind) ? [] : [correct, q.type === "blank" ? q.accepted.slice(1).filter(Boolean).join(" | ") : ""])]);
    }));
    downloadCsv(safeName(test.name, "questions"), rows);
  }

  /** Used by the QTS Bank: CSV / Excel menu entries for one item. isLib = a list item (no students' answers). */
  window.QuizExport = {
    download(name, rows, fmt) {
      const base = String(name || "export").replace(/[\\/:*?"<>|]+/g, "_").trim() || "export";
      if (fmt === "xlsx" && window.XLSX) {
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(rows), "Sheet1");
        XLSX.writeFile(wb, `${base.replace(/\.csv$/i, "")}.xlsx`);
      } else {
        rawCsv(/\.csv$/i.test(base) ? base : `${base}.csv`, rows);
      }
    },
    items(test, isLib) {
      const copy = JSON.parse(JSON.stringify(test));
      const quiz = ScoringModule.normalizeQuiz(copy);
      if (!quiz) return [];
      const kinds = [["Questions & answer key", exportQuestions]];
      if (!isLib) {
        kinds.unshift(["Responses (one row per attempt)", exportResponses]);
        if (!isSurveyKind(quiz.kind)) kinds.push(["Scores per question", exportScores]);
        kinds.push(["Question summary", exportSummary]);
      }
      const out = [];
      kinds.forEach(([label, fn]) => ["csv", "xlsx"].forEach((fmt) => out.push({
        label: `${fmt === "csv" ? "CSV" : "Excel"}: ${label}`,
        onClick: () => {
          exportSink = (filename, rows) => window.QuizExport.download(filename, rows, fmt);
          try { fn(copy, quiz); } finally { exportSink = null; }
        },
      })));
      return out;
    },
  };

  function exportItems(test, quiz) {
    const items = [{ label: "Responses (one row per attempt)", onClick: () => exportResponses(test, quiz) }];
    if (!isSurveyKind(quiz.kind)) items.push({ label: "Scores per question", onClick: () => exportScores(test, quiz) });
    items.push({ label: "Question summary (counts per option)", onClick: () => exportSummary(test, quiz) });
    return items;
  }

  // ---------- Formative Surveys: every launch is a "run"; saved runs are compared side by side ----------
  /** Moves the current answers into a saved run (named "Run N"), leaving the survey ready for a fresh run. Returns true if anything was saved. */
  function archiveRun(quiz) {
    if (!quiz.submissions || !quiz.submissions.length) return false;
    if (!Array.isArray(quiz.runs)) quiz.runs = [];
    const latest = quiz.submissions.reduce((a, s) => (s.at && s.at > a ? s.at : a), "");
    quiz.runs.push({ id: newId("run"), name: `Run ${quiz.runs.length + 1}`, at: latest || new Date().toISOString(), submissions: JSON.parse(JSON.stringify(quiz.submissions)) });
    quiz.submissions = [];
    return true;
  }
  const latestPerStudent = (subs) => {
    const m = new Map();
    (subs || []).forEach((s) => { const o = m.get(s.sid); if (!o || (Number(s.attempt) || 1) >= (Number(o.attempt) || 1)) m.set(s.sid, s); });
    return [...m.values()];
  };
  /** The saved runs plus the current one (if it has answers), each as { name, at, subs, current }. */
  function formativeRuns(quiz) {
    const runs = (quiz.runs || []).map((r) => ({ id: r.id, name: r.name, at: r.at, subs: latestPerStudent(r.submissions), current: false }));
    if (quiz.submissions.length) {
      const latest = quiz.submissions.reduce((a, s) => (s.at && s.at > a ? s.at : a), "");
      runs.push({ id: "current", name: quiz.token ? "Current run (QR open)" : "Current run", at: latest, subs: latestPerStudent(quiz.submissions), current: true });
    }
    return runs;
  }
  function renderFormativeRuns(body, tool, container, test, quiz) {
    const rerender = () => renderScoringToolView(tool, container);
    body.appendChild(h("h4", "", "Runs"));
    body.appendChild(h("p", "hint", "Each time you launch a new QR code, the earlier answers are saved as a run. Compare runs below to see what changed. The current run is saved automatically when you launch the next QR code, or now with the button."));
    const bar = h("div", "qz-actions");
    bar.appendChild(button("Save current answers as a run", "btn btn-primary btn-small", () => {
      if (quiz.token) { alert("Close the QR code first (Test & Quiz Bank → QR Code → Close QR Code), so no more answers arrive."); return; }
      if (!quiz.submissions.length) { alert("There are no current answers to save."); return; }
      archiveRun(quiz); rerender();
    }));
    body.appendChild(bar);
    const runs = formativeRuns(quiz);
    if (!runs.length) { body.appendChild(h("p", "hint", "No runs yet.")); return runs; }
    const tbl = h("table", "source-grid qts-grid");
    const hr = h("tr"); ["Run", "Date", "Responses", ""].forEach((t) => hr.appendChild(h("th", "nosort", t)));
    const th = h("thead"); th.appendChild(hr); tbl.appendChild(th);
    const tb = h("tbody"); tbl.appendChild(tb);
    runs.forEach((r) => {
      const tr = h("tr");
      const nameTd = h("td");
      if (r.current) nameTd.textContent = r.name;
      else nameTd.appendChild(textInput(r.name, "", (v) => { const run = quiz.runs.find((x) => x.id === r.id); if (run) run.name = v.trim() || run.name; rerender(); }));
      tr.append(nameTd, h("td", "", r.at ? String(r.at).slice(0, 10) : "—"), h("td", "", String(r.subs.length)));
      const act = h("td");
      if (!r.current) act.appendChild(button("Delete", "btn btn-ghost btn-small", () => { if (!confirm(`Delete "${r.name}" and its ${r.subs.length} response(s)?`)) return; quiz.runs = quiz.runs.filter((x) => x.id !== r.id); rerender(); }));
      tr.appendChild(act); tb.appendChild(tr);
    });
    const wrap = h("div", "qts-wrap"); wrap.appendChild(tbl); body.appendChild(wrap);

    body.appendChild(h("h4", "", "Comparison across runs"));
    body.appendChild(h("p", "hint", "Percentages are of the students who answered each question in that run. “Average choice” is the mean option number (1 = first option), handy for scales like 1–5."));
    allQuestions(quiz).forEach(({ q }, i) => {
      const box = h("div", "category-manage-item"); box.style.marginBottom = "12px";
      box.appendChild(h("strong", "", `Q${i + 1}${q.text ? ": " + q.text : ""}`));
      const t = h("table", "source-grid qts-grid");
      const head = h("tr"); head.appendChild(h("th", "nosort", isChoiceQ(q) ? "Option" : "")); runs.forEach((r) => head.appendChild(h("th", "nosort", r.name)));
      const thd = h("thead"); thd.appendChild(head); t.appendChild(thd);
      const tbd = h("tbody"); t.appendChild(tbd);
      const per = runs.map((r) => {
        const vals = r.subs.map((s) => ScoringModule.quizEffectiveAnswers(s)[q.id]).filter((a) => a !== undefined && a !== null && a !== "");
        return { vals, n: vals.length };
      });
      if (isChoiceQ(q)) {
        q.choices.forEach((c, ci) => {
          const tr = h("tr"); tr.appendChild(h("td", "", optionText(quiz, q, ci) || `Option ${ci + 1}`));
          per.forEach((p) => { const k = p.vals.filter((a) => (q.type === "multi" ? multiSet(a).includes(ci) : Number(a) === ci)).length; tr.appendChild(h("td", "qts-n", p.n ? `${Math.round((k / p.n) * 100)}% (${k})` : "—")); });
          tbd.appendChild(tr);
        });
        if (q.type === "mc") {
          const avg = h("tr"); avg.appendChild(h("td", "", "Average choice"));
          per.forEach((p) => avg.appendChild(h("td", "qts-n", p.n ? (p.vals.reduce((a, v) => a + Number(v) + 1, 0) / p.n).toFixed(2) : "—")));
          tbd.appendChild(avg);
        }
      }
      const cnt = h("tr"); cnt.appendChild(h("td", "", "Answered"));
      per.forEach((p) => cnt.appendChild(h("td", "qts-n", String(p.n))));
      tbd.appendChild(cnt);
      const wr = h("div", "qts-wrap"); wr.appendChild(t); box.appendChild(wr); body.appendChild(box);
    });
    return runs;
  }

  // ---------- the survey results view: answers per student + a summary of every question ----------
  function renderSurveyResults(tool, container, test, quiz) {
    container.innerHTML = "";
    container.appendChild(editorHeader(tool, container, test, quiz, "results"));
    const { section, body } = makePresSection(quiz.kind === "formative" ? "Formative Survey results" : "Research Survey results");
    section.classList.add("qz-sec-review");
    container.appendChild(section);
    if (quiz.kind === "formative") renderFormativeRuns(body, tool, container, test, quiz);
    if (quiz.submissions.length === 0) {
      body.appendChild(h("p", "hint", "No answers yet. Launch the QR code from the Tests & Quizzes list, then click Get Responses."));
      return;
    }
    const bar = h("div", "qz-actions");
    exportItems(test, quiz).forEach((it) => bar.appendChild(button(`Export CSV: ${it.label}`, "btn btn-ghost btn-small", it.onClick)));
    body.appendChild(bar);

    // summary
    body.appendChild(h("h4", "", `${quiz.kind === "formative" ? "Current run — summary" : "Summary"} (${quiz.submissions.length} response${quiz.submissions.length === 1 ? "" : "s"})`));
    summaryTallies(quiz).forEach((t) => {
      const box = h("div", "category-manage-item");
      box.style.marginBottom = "10px";
      box.appendChild(h("strong", "", `Q${t.n}${quiz.kind !== "answers" && t.q.text ? ": " + t.q.text : ""}`));
      const tbl = h("table", "roster-table");
      tbl.style.maxWidth = "560px";
      t.items.slice(0, 60).forEach((it) => {
        const tr = h("tr");
        tr.appendChild(h("td", "", it.label || "(blank)"));
        const cnt = h("td", "", String(it.count));
        cnt.style.textAlign = "right";
        const pct = h("td");
        pct.style.width = "200px";
        const frac = t.answered ? it.count / t.answered : 0;
        const barEl = h("div");
        barEl.style.cssText = `height:14px;border-radius:7px;background:#0f7d73;width:${Math.round(frac * 100)}%;min-width:${it.count ? 3 : 0}px;`;
        barEl.title = `${Math.round(frac * 100)}%`;
        pct.appendChild(barEl);
        tr.append(cnt, pct, h("td", "", `${Math.round(frac * 100)}%`));
        tbl.appendChild(tr);
      });
      if (t.items.length === 0) tbl.appendChild(h("tr")).appendChild(h("td", "hint", "No answers."));
      box.appendChild(tbl);
      if (t.total - t.answered > 0) box.appendChild(h("p", "hint", `${t.total - t.answered} left blank.`));
      body.appendChild(box);
    });

    // every answer, per student
    body.appendChild(h("h4", "", "Every response"));
    const qs = allQuestions(quiz);
    const wrap = h("div", "attendance-table-wrap");
    const table = h("table", "attendance-table");
    const thead = h("thead");
    const hr = h("tr");
    ["Student", "Attempt", ...qs.map((x, i) => `Q${i + 1}`)].forEach((t) => hr.appendChild(h("th", "", t)));
    thead.appendChild(hr);
    table.appendChild(thead);
    const tbody = h("tbody");
    sortedSubs(quiz).forEach((s) => {
      const eff = ScoringModule.quizEffectiveAnswers(s);
      const tr = h("tr");
      const nameTd = h("td", "", s.name || "(not on roster)");
      nameTd.appendChild(h("div", "hint", s.sid));
      tr.append(nameTd, h("td", "", String(s.attempt)));
      qs.forEach((x) => tr.appendChild(h("td", "", optionText(quiz, x.q, eff[x.q.id]))));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
  }

  // ---------- the results view: a read-only grid of ● / ✕ ----------
  function renderResults(tool, container, testId) {
    const test = ScoringModule.findTest(tool.id, testId);
    const quiz = ScoringModule.quizOf(tool.id, testId);
    if (isSurveyKind(quiz.kind)) return renderSurveyResults(tool, container, test, quiz);
    const style = quiz.settings.labelStyle;
    container.innerHTML = "";
    container.appendChild(editorHeader(tool, container, test, quiz, "results"));

    if (!document.getElementById("qz-style2")) {
      const st = document.createElement("style");
      st.id = "qz-style2";
      st.textContent = `
        .qz-res td.qz-mark { text-align: center; font-size: 1.6rem; font-weight: 800; line-height: 1; padding: 6px 12px; }
        .qz-res .qz-yes { color: #1e9e4a; } .qz-res .qz-no { color: #d3302f; }
        .qz-res thead th { text-align: center; }
        .qz-res tr.qz-newstudent td { border-top: 3px solid var(--ink-soft); }
        .qz-res tfoot td { background: #0f7d73 !important; color: #fff !important; font-weight: 700; text-align: center; }
      `;
      document.head.appendChild(st);
    }

    const { section, body } = makePresSection("Results   ● correct   ✕ incorrect");
    section.classList.add("qz-sec-review");
    container.appendChild(section);

    if (quiz.submissions.length === 0) {
      body.appendChild(h("p", "hint", "No answers yet. Launch the QR code from the Tests & Quizzes list, then click Get Responses."));
      return;
    }
    body.appendChild(h("p", "hint", "Hover over a symbol to see the student's answer. To change an answer or fix the answer key, use \"Review answers & regrade\"."));

    const total = ScoringModule.quizTotal(quiz);
    const colors = ["#1f6fb5", "#2e8b57", "#b8860b", "#a23b72"];
    const qs = [];
    const wrap = h("div", "attendance-table-wrap");
    const table = h("table", "attendance-table qz-res");
    wrap.appendChild(table);
    body.appendChild(wrap);

    const thead = h("thead");
    const r1 = h("tr");
    const r2row = h("tr");
    ["Student", "Attempt", "Score"].forEach((t) => {
      const th = h("th", "", t);
      th.rowSpan = 2;
      r1.appendChild(th);
    });
    let num = 0;
    quiz.sections.forEach((sec, si) => {
      if (sec.questions.length === 0) return;
      const th = h("th", "", sec.title || `Section ${si + 1}`);
      th.colSpan = sec.questions.length;
      th.style.cssText = `background:${colors[si % 4]};color:#fff;`;
      r1.appendChild(th);
      sec.questions.forEach((q) => {
        num++;
        qs.push(q);
        const qth = h("th");
        qth.appendChild(h("div", "", `Q${num}`));
        qth.appendChild(h("div", "item-points-label", `${q.points} pt`));
        r2row.appendChild(qth);
      });
    });
    thead.append(r1, r2row);
    table.appendChild(thead);

    const answerText = (q, ans) => {
      if (ans === undefined || ans === null || ans === "") return "(no answer)";
      return q.type === "multi" ? multiSet(ans).map((i) => optionLabel(style, i)).join(", ") : q.type === "mc" ? optionLabel(style, Number(ans)) : String(ans);
    };

    const tbody = h("tbody");
    const correctCount = qs.map(() => 0);
    let lastSid = null;
    [...quiz.submissions].sort((a, b) => (a.name || a.sid).localeCompare(b.name || b.sid) || a.attempt - b.attempt).forEach((s) => {
      const eff = ScoringModule.quizEffectiveAnswers(s);
      const tr = h("tr", s.sid !== lastSid ? "qz-newstudent" : "");
      lastSid = s.sid;
      const nameTd = h("td", "", s.name || "(not on roster)");
      nameTd.appendChild(h("div", "hint", s.sid));
      tr.appendChild(nameTd);
      tr.appendChild(h("td", "", String(s.attempt)));
      const score = h("td", "", `${ScoringModule.gradeQuizSubmission(quiz, eff)} / ${total}`);
      score.style.cssText = "font-weight:700;white-space:nowrap;";
      tr.appendChild(score);
      qs.forEach((q, i) => {
        const ok = ScoringModule.quizAnswerCorrect(q, eff[q.id]);
        if (ok) correctCount[i]++;
        const td = h("td", "qz-mark " + (ok ? "qz-yes" : "qz-no"), ok ? "●" : "✕");
        td.title = answerText(q, eff[q.id]);
        tr.appendChild(td);
      });
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);

    const tfoot = h("tfoot");
    const ftr = h("tr");
    const fl = h("td", "", "% correct");
    fl.style.textAlign = "left";
    ftr.appendChild(fl);
    ftr.appendChild(h("td"));
    ftr.appendChild(h("td"));
    const count = quiz.submissions.length;
    qs.forEach((q, i) => ftr.appendChild(h("td", "", `${Math.round((100 * correctCount[i]) / count)}%`)));
    tfoot.appendChild(ftr);
    table.appendChild(tfoot);
  }

  // ---------- dropdown menus ----------
  let openMenu = null;
  function closeMenu() {
    if (!openMenu) return;
    openMenu.list.remove();
    openMenu.btn.setAttribute("aria-expanded", "false");
    openMenu = null;
  }
  document.addEventListener("click", (e) => { if (openMenu && !openMenu.list.contains(e.target)) closeMenu(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") closeMenu(); });
  window.addEventListener("resize", closeMenu);
  window.addEventListener("scroll", closeMenu, true);
  /** A button that opens a small menu; items = [{ label, onClick }]. The menu floats above the page so tables never clip it. */
  function menuButton(label, accent, items) {
    const btn = h("button", "btn btn-ghost btn-small qz-menu-btn", `${label} ▾`);
    btn.type = "button";
    btn.style.setProperty("--qz-menu-c", accent);
    btn.setAttribute("aria-haspopup", "true");
    btn.setAttribute("aria-expanded", "false");
    btn.addEventListener("click", (e) => {
      e.stopPropagation();
      if (openMenu && openMenu.btn === btn) { closeMenu(); return; }
      closeMenu();
      const list = h("div", "qz-menu-list");
      list.setAttribute("role", "menu");
      list.style.setProperty("--qz-menu-c", accent);
      items.forEach((it) => {
        const b = h("button", "btn btn-ghost btn-small qz-menu-item", it.label);
        b.type = "button";
        b.setAttribute("role", "menuitem");
        b.addEventListener("click", (ev) => { ev.stopPropagation(); closeMenu(); it.onClick(); });
        list.appendChild(b);
      });
      document.body.appendChild(list);
      const r = btn.getBoundingClientRect();
      const below = r.bottom + 4;
      list.style.top = `${below + list.offsetHeight > window.innerHeight ? Math.max(8, r.top - list.offsetHeight - 4) : below}px`;
      list.style.left = `${Math.max(8, Math.min(r.left, window.innerWidth - list.offsetWidth - 8))}px`;
      btn.setAttribute("aria-expanded", "true");
      openMenu = { list, btn };
    });
    return btn;
  }

  // ---------- the shared list section (below the Tests & Quizzes list) ----------
  function buildSharedSection(tool, container) {
    const rerender = () => renderScoringToolView(tool, container);
    const { section, body } = makePresSection("Shared Tests & Quizzes");
    section.classList.add("qz-sec-shared");
    body.appendChild(h("p", "hint", "This list is the same in every course. \"Add to this course\" copies the whole test or quiz here (this course's students are used). To put a copy of one of this course's tests or quizzes on this list, use \"Copy to Shared\" in its row above."));
    const statKey = `${tool.id}|shared`;
    const stat = h("p", "result", statusMsg.get(statKey) || "");
    const say = (t) => { statusMsg.set(statKey, t); stat.textContent = t; };
    body.appendChild(stat);
    const list = h("div");
    list.appendChild(h("p", "hint", "Loading shared tests…"));
    // Group picker: shown only if the administrator has put this user in a group
    const scopeRow = h("p", "hint");
    scopeRow.hidden = true;
    body.appendChild(scopeRow);
    if (window.GroupShare) {
      window.GroupShare.myGroups().then((groups) => {
        if (!groups.length) { SharedTests.scope = "mine"; return; }
        scopeRow.hidden = false;
        scopeRow.appendChild(document.createTextNode("Showing: "));
        const sel = document.createElement("select");
        const o0 = document.createElement("option"); o0.value = "mine"; o0.textContent = "My own shared list"; sel.appendChild(o0);
        groups.forEach((g) => { const o = document.createElement("option"); o.value = g.id; o.textContent = `Group: ${g.name}`; sel.appendChild(o); });
        if (groups.some((g) => g.id === SharedTests.scope)) sel.value = SharedTests.scope; else SharedTests.scope = "mine";
        sel.addEventListener("change", () => {
          SharedTests.scope = sel.value; SharedTests.loaded = false;
          list.textContent = ""; list.appendChild(h("p", "hint", "Loading…"));
          SharedTests.ensureLoaded().then(draw).catch((err) => { list.textContent = ""; list.appendChild(h("p", "hint", `Couldn't load: ${err.message}`)); });
        });
        scopeRow.appendChild(sel);
        scopeRow.appendChild(document.createTextNode("  (\"Copy to Shared\" above adds to the list shown here.)"));
        if (SharedTests.scope !== "mine" && !SharedTests.loaded) { SharedTests.ensureLoaded().then(draw).catch(() => {}); }
      });
    }

    const draw = () => {
      list.textContent = "";
      list.appendChild(SectionedBank.build({
        sections: SharedTests.sections,
        items: SharedTests.items,
        headers: ["Test / Quiz", "Max score", "Questions", "Type", "From course", "Section", "Order", ""],
        emptyText: 'Nothing shared yet — use "Copy to Shared" on a test or quiz above.',
        persist: () => SharedTests.save(),
        redraw: draw,
        buildRow(item, hp) {
          const tr = h("tr");
          const nameTd = h("td");
          nameTd.appendChild(textInput(item.name, "", async (v) => {
            try {
              await SharedTests.rename(item.id, v);
              say("Renamed.");
            } catch (err) { say(`Couldn't do that: ${err.message}`); }
            draw();
          }));
          tr.appendChild(nameTd);
          tr.appendChild(h("td", "", item.maxPoints ? String(item.maxPoints) : "—"));
          tr.appendChild(h("td", "", item.quiz ? String(item.quiz.sections.reduce((a, sec) => a + (sec.questions || []).length, 0)) : "—"));
          tr.appendChild(h("td", "", SharedTests.kindOf(item)));
          tr.appendChild(h("td", "hint", item.sourceCourseName || "—"));
          const secTd = h("td");
          secTd.appendChild(hp.sectionSelect(item));
          tr.appendChild(secTd);
          const orderTd = h("td");
          orderTd.appendChild(hp.arrows(item));
          tr.appendChild(orderTd);
          const actions = h("td");
          actions.appendChild(button("Add to this course", "btn btn-primary btn-small", () => {
            try {
              SharedTests.copyToCourse(tool.id, item);
              flush();
              say(`"${item.name}" added to this course.`);
            } catch (err) { say(`Couldn't do that: ${err.message}`); return; }
            rerender();
          }));
          actions.appendChild(button("Delete", "btn btn-ghost btn-small", async () => {
            if (!confirm(`Remove "${item.name}" from the shared list? Copies already in courses are not affected.`)) return;
            try {
              await SharedTests.remove(item.id);
              say(`"${item.name}" removed from the shared list.`);
            } catch (err) { say(`Couldn't do that: ${err.message}`); }
            draw();
          }));
          tr.appendChild(actions);
          return tr;
        },
      }));
    };
    SharedTests.ensureLoaded().then(draw).catch((err) => {
      list.textContent = "";
      list.appendChild(h("p", "hint", `Couldn't load the shared list: ${err.message}`));
    });
    return section;
  }

  // ---------- one combined section: the bank's own view + quiz buttons ----------
  function mergeBankView(tool, container) {
    const rerender = () => renderScoringToolView(tool, container);
    const tests = ScoringModule.testBankTests(tool.id);
    const { section, body } = makePresSection("Tests & Quizzes");
    section.classList.add("qz-sec-list");
    Array.from(container.children).forEach((k) => body.appendChild(k)); // hint, toolbar, import panel, table
    container.appendChild(section);

    const hint = body.querySelector("p.hint");
    if (hint) hint.textContent = "Upload a CSV or Excel file of scores, or build a quiz (questions with text) an Answer Collection (just question numbers and options, to match a paper test sheet) or a Survey (a quiz with no scoring) and collect answers from students' phones by QR code. Everything listed here can be used in Main Scores (Sources) and Progress Tracker columns.";

    const create = (kind, label) => () => {
      const count = tests.filter((t) => t.quiz).length + 1;
      const name = prompt(`${label} name:`, `${label} ${count}`);
      if (name === null) return;
      try {
        const t = ScoringModule.addQuizTest(tool.id, name, kind);
        editing.set(tool.id, t.id);
        viewOf.set(tool.id, "build");
      } catch (err) { alert(err.message); return; }
      rerender();
    };
    const btns = body.querySelector(".panel-toolbar-buttons");
    if (btns) {
      btns.insertBefore(button("+ New Formative Survey", "btn btn-ghost", create("formative", "Formative Survey")), btns.firstChild);
      btns.insertBefore(button("+ New Research Survey", "btn btn-ghost", create("survey", "Research Survey")), btns.firstChild);
      btns.insertBefore(button("+ New Answer Collection", "btn btn-ghost", create("answers", "Answer Collection")), btns.firstChild);
      btns.insertBefore(button("+ New Quiz", "btn btn-ghost", create("standard", "Quiz")), btns.firstChild);
    }

    // status line for the QR buttons
    const statKey = `${tool.id}|bank`;
    const stat = h("p", "result", statusMsg.get(statKey) || "");
    const say = (t) => { statusMsg.set(statKey, t); stat.textContent = t; };
    const guard = (fn) => async () => { try { await fn(); } catch (err) { say(`Couldn't do that: ${err.message}`); } };
    const openQr = (url) => window.open(`presqr.html?k=quiz&u=${encodeURIComponent(url)}${window.qrCourseQuery ? window.qrCourseQuery() : ""}`, "ggo-quiz-qr", "width=480,height=620");
    const table = body.querySelector("table.roster-table");
    if (table) table.parentNode.insertBefore(stat, table);

    const tbody = body.querySelector("table.roster-table tbody");
    if (!tbody) return;
    const mains = Array.from(tbody.children).filter((tr) => tr.children.length === 6); // skips the empty-state and detail rows
    tests.forEach((t, i) => {
      const tr = mains[i];
      if (!tr) return;
      const courseId = RosterModule.currentCourseId;
      const shareBtn = button("Copy to other courses…", "btn btn-ghost btn-small qz-act-share", guard(async () => {
        const msg = await QTSBank.copyToCourses(courseId, tool.id, t);
        if (msg) { say(msg); rerender(); }
      }));
      const tiesBtn = (t.fam && window.QTSBank)
        ? button(QTSBank.tiesOpen.has(t.id) ? "Hide Family Ties" : "Family Ties", "btn btn-ghost btn-small", () => { if (QTSBank.tiesOpen.has(t.id)) QTSBank.tiesOpen.delete(t.id); else QTSBank.tiesOpen.add(t.id); rerender(); })
        : (t.famLeft && window.QTSBank) ? button("Rejoin family…", "btn btn-ghost btn-small", guard(async () => { const msg = await QTSBank.rejoin(courseId, tool.id, t); if (msg) { say(msg); rerender(); } })) : null;
      if (!t.quiz) {
        const only = h("div", "qz-actions");
        only.appendChild(shareBtn);
        if (tiesBtn) only.appendChild(tiesBtn);
        tr.children[5].insertBefore(only, tr.children[5].firstChild);
        return;
      }
      const quiz = ScoringModule.normalizeQuiz(t);
      const go = (view) => () => { editing.set(tool.id, t.id); viewOf.set(tool.id, view); rerender(); };
      const students = new Set(quiz.submissions.map((x) => x.sid)).size;
      tr.children[4].textContent = quiz.token ? "QR open" : "";
      const maxCell = tr.children[1];
      maxCell.textContent = "";
      const isSurvey = isSurveyKind(quiz.kind);
      const maxText = h("span", "", isSurvey ? "—" : String(ScoringModule.quizTotal(quiz)));
      maxText.title = "Total of the question points. Change the points on the questions to change this.";
      maxText.style.fontWeight = "600";
      maxCell.appendChild(maxText);

      const group = h("div", "qz-actions");
      group.appendChild(button("Edit Questions", "btn btn-primary btn-small", go("build")));
      const qrItems = !quiz.token
        ? [{
          label: "Launch QR Code",
          onClick: guard(async () => {
            say("Creating QR code…");
            const url = await QuizForms.create(tool.id, t.id);
            flush();
            say(`QR code for "${t.name}" is open.`);
            rerender();
            openQr(url + (window.QRStyles ? QRStyles.query(quiz.style) : ""));
          }),
        }]
        : [
          { label: "Show QR Code", onClick: () => openQr(QuizForms.urlFor(quiz.token) + (window.QRStyles ? QRStyles.query(quiz.style) : "")) },
          {
            label: "Get Responses",
            onClick: guard(async () => {
              say("Getting responses…");
              const r = await QuizForms.sync(tool.id, t.id);
              flush();
              say(`${t.name}: ${r.responses} attempt(s) from ${r.students} of ${r.expected} student(s) collected and graded.` + (r.missing.length ? ` Not yet: ${r.missing.slice(0, 12).join(", ")}${r.missing.length > 12 ? "…" : ""}.` : ""));
              rerender();
            }),
          },
          {
            label: "Close QR Code",
            onClick: guard(async () => {
              if (!confirm("Close the QR code? Click Get Responses first if you haven't — the server's copies of the answers are deleted on close.")) return;
              await QuizForms.close(tool.id, t.id);
              flush();
              say(`QR code for "${t.name}" closed. Graded results are kept.`);
              rerender();
            }),
          },
        ];
      group.appendChild(menuButton("QR Code", "#c2571a", qrItems));
      if (window.QRStyles) {
        QRStyles.ensureLoaded().catch(() => {});
        group.appendChild(QRStyles.menuButton(() => quiz.style || null, (st) => { quiz.style = st || null; flush(); }, say, "btn btn-ghost btn-small qz-menu-btn"));
      }
      group.appendChild(isSurvey
        ? button(`Show Results (${students})`, "btn btn-ghost btn-small qz-menu-btn", go("results"))
        : menuButton("Results", "#0f7d73", [
          { label: "Show Results", onClick: go("results") },
          { label: `Review Results (${students})`, onClick: go("review") },
          {
            label: "Re-Calculate Results",
            onClick: guard(async () => {
              ScoringModule.regradeQuiz(tool.id, t.id);
              flush();
              say(`Results for "${t.name}" re-calculated.`);
              rerender();
            }),
          },
        ]));
      group.appendChild(menuButton("Export CSV", "#4a5568", exportItems(t, quiz)));
      group.appendChild(shareBtn);
      if (tiesBtn) group.appendChild(tiesBtn);
      // Keep the bank's own Delete button (same behavior); drop Details / Re-match for quizzes.
      const actions = tr.children[5];
      Array.from(actions.querySelectorAll("button")).forEach((b) => {
        if (b.textContent.trim() === "Delete") group.appendChild(b);
        else if (["Details", "Hide", "Re-match"].includes(b.textContent.trim())) b.remove();
      });
      actions.insertBefore(group, actions.firstChild);
    });

    // New narrow "Type" column right after the name.
    const headRow = table && table.querySelector("thead tr");
    if (headRow && headRow.children.length === 6) {
      const th = h("th", "", "Type");
      headRow.insertBefore(th, headRow.children[1]);
      mains.forEach((tr, i) => {
        const t = tests[i];
        if (!tr || !t) return;
        const td = h("td", "", t.quiz ? kindName(ScoringModule.normalizeQuiz(t)) : "Uploaded scores");
        td.style.whiteSpace = "nowrap";
        td.style.fontSize = "0.85em";
        tr.insertBefore(td, tr.children[1]);
      });
      tbody.querySelectorAll("td[colspan]").forEach((td) => {
        if (td.colSpan === 6) td.colSpan = 7;
      });
    }
    // Family Ties grid, directly under an item whose ties are open.
    if (window.QTSBank && QTSBank.tiesOpen) {
      mains.forEach((tr, i) => {
        const t = tests[i];
        if (!tr || !t || !t.fam || !QTSBank.tiesOpen.has(t.id)) return;
        const dr = h("tr"); const dt = h("td"); dt.colSpan = tr.children.length;
        dt.appendChild(QTSBank.buildTies(RosterModule.currentCourseId, tool.id, t, (m) => { say(m || ""); rerender(); }));
        dr.appendChild(dt); tr.after(dr);
      });
    }
  }

  // ---------- hook into the Test & Quiz Bank view ----------
  const original = SCORING_TOOL_RENDERERS.testbank;
  SCORING_TOOL_RENDERERS.testbank = function (tool, container) {
    const testId = editing.get(tool.id);
    if (testId && ScoringModule.quizOf(tool.id, testId)) {
      const view = viewOf.get(tool.id);
      if (view === "results") return renderResults(tool, container, testId);
      return view === "review" ? renderReview(tool, container, testId) : renderEditor(tool, container, testId);
    }
    editing.delete(tool.id);
    ScoringModule.testBankTests(tool.id).forEach((t) => { if (t.quiz) ScoringModule.normalizeQuiz(t); });
    original(tool, container);
    mergeBankView(tool, container);
    // The QTS Bank (js/qtsbank.js) replaces the old Shared list here: it holds every course's tests plus the Independent list.
    if (window.QTSBank && QTSBank.buildSection) { SharedTests.scope = "mine"; container.appendChild(QTSBank.buildSection(tool, container)); }
    else container.appendChild(buildSharedSection(tool, container));
  };
})();
