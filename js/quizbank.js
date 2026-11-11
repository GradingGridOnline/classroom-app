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
  /** A section's questions and instruction notes in reading order: [{ q } | { note }]. Notes sit "start", "end", or "before"/"after" a question (note.q is its id). */
  window.quizSectionFlow = (sec) => QuizRich.flow(sec);
  const isChoiceQ = (q) => q.type === "mc" || q.type === "multi";
  const typeName = (q) => (q.type === "mc" ? "Multiple choice" : q.type === "multi" ? "Multiple select" : q.type === "para" ? "Long answer" : "Fill in the blank"); // Research Survey ("survey") and Formative Survey
  const r2 = (n) => Math.round(n * 100) / 100;
  const editing = new Map(); // toolId -> testId being edited
  const viewOf = new Map(); // toolId -> "build" | "results" ("review" opens Results in Edit mode)
  const resultMode = new Map(); // testId -> "view" | "edit": the one Results screen has two modes
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
      if (!Array.isArray(q.removed)) q.removed = []; // attempts the teacher deleted ("sid|attempt|time"): Get Responses won't bring them back
      if (typeof q.token !== "string") q.token = null;
      q.sections.forEach((s) => {
        if (!Array.isArray(s.questions)) s.questions = [];
        if (!Array.isArray(s.notes)) s.notes = [];
        s.notes = s.notes.filter((x) => x && typeof x === "object").map((x) => ({ id: x.id || newId("n"), text: String(x.text || ""), rich: window.QuizRich && x.rich ? QuizRich.clean(x.rich) : "", kind: ["text", "passage"].includes(x.kind) ? x.kind : "instructions", at: ["start", "end", "before", "after"].includes(x.at) ? x.at : "end", q: x.q || "", ...(x.hide ? { hide: true } : {}), ...(x.border ? { border: true } : {}) }));
        s.questions.forEach((x) => {
          if (x.group && !s.notes.some((nn) => nn.id === x.group && nn.kind === "passage")) delete x.group; // its Paragraph box was removed
          x.rich = window.QuizRich && x.rich ? QuizRich.clean(x.rich) : "";
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
        if (window.QuizRich) QuizRich.regroup(s);
      });
      q.submissions.forEach((s) => {
        if (!s.answers || typeof s.answers !== "object") s.answers = {};
        if (!s.overrides || typeof s.overrides !== "object") s.overrides = {};
        if (!s.marks || typeof s.marks !== "object") s.marks = {}; // points the teacher gave to paragraph answers: { questionId: n }
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
        ...(type === "para" ? { lines: 6 } : {}),
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
    /** Changes a question's type (multiple choice, multiple select, fill in the blank), keeping what can be kept: option texts, the correct option(s) and accepted answers. */
    setQuizQuestionType(q, type) {
      if (!["mc", "multi", "blank", "para"].includes(type) || q.type === type) return;
      const from = q.type;
      if ((from === "blank" || from === "para") && !q.choices.length) q.choices = Array(4).fill("");
      if (type === "para") {
        if (!(q.lines >= 1)) q.lines = 6;
      } else if (type !== "blank") {
        while (q.choices.length < 2) q.choices.push("");
        if (type === "multi") {
          const key = from === "mc" ? [q.correct] : multiSet(q.correctSet);
          q.correctSet = key.filter((i) => i < q.choices.length);
          if (!q.correctSet.length) q.correctSet = [0];
          q.partial = q.partial === true;
        } else {
          q.correct = from === "multi" ? multiSet(q.correctSet)[0] || 0 : q.correct || 0;
          if (q.correct >= q.choices.length) q.correct = 0;
        }
      } else if (!q.accepted.some(Boolean)) {
        const keys = from === "para" ? [] : from === "multi" ? multiSet(q.correctSet) : [q.correct];
        const texts = keys.map((i) => (q.choices[i] || "").trim()).filter(Boolean);
        q.accepted = texts.length ? [texts[0]] : [""];
      }
      q.type = type;
    },
    /** A student's answers after the teacher's edits. */
    quizEffectiveAnswers(s) {
      const eff = { ...(s.answers || {}), ...(s.overrides || {}) };
      Object.entries(s.marks || {}).forEach(([id, n]) => { eff["#" + id] = n; }); // paragraph marks travel as "#<questionId>"
      return eff;
    },
    /** Is this answer correct? MC: chosen index equals the key. Blank: matches any accepted answer (spacing/case/full-width ignored; numbers compare as numbers). */
    quizAnswerCorrect(q, ans) {
      if (ans === undefined || ans === null || ans === "") return false;
      if (q.type === "para") return false; // marked by hand (see quizAnswerFraction)
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
    quizAnswerFraction(q, ans, mark) {
      if (q.type === "para") return q.points > 0 ? Math.min(1, Math.max(0, Number(mark) || 0) / q.points) : 0;
      if (q.type !== "multi") return this.quizAnswerCorrect(q, ans) ? 1 : 0;
      const picked = multiSet(ans), key = multiSet(q.correctSet);
      if (!picked.length) return 0;
      const hits = picked.filter((i) => key.includes(i)).length, wrong = picked.length - hits;
      if (hits === key.length && wrong === 0) return 1;
      return q.partial ? Math.max(0, (hits - wrong) / key.length) : 0;
    },
    gradeQuizQuestion(q, ans, mark) {
      if (q.type === "para") return r2(q.points * this.quizAnswerFraction(q, ans, mark));
      if (q.type === "multi") return r2(q.points * this.quizAnswerFraction(q, ans));
      return this.quizAnswerCorrect(q, ans) ? q.points : 0;
    },
    gradeQuizSubmission(quiz, answers) {
      let sum = 0;
      quiz.sections.forEach((s) => s.questions.forEach((x) => (sum += this.gradeQuizQuestion(x, (answers || {})[x.id], (answers || {})["#" + x.id]))));
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
          notes: (s.notes || []).filter((x) => x.text.trim() && !x.hide).map((x) => ({ id: x.id, text: x.text, rich: x.rich || undefined, kind: x.kind, at: x.at, q: x.q, border: x.border ? true : undefined })),
          questions: s.questions.map((x) => ({
            id: x.id, type: x.type, text: answersOnly ? "" : x.text, rich: answersOnly ? undefined : x.rich || undefined, points: isSurveyKind(quiz.kind) ? 0 : x.points,
            choices: isChoiceQ(x) ? (answersOnly ? x.choices.map(() => "") : x.choices) : undefined,
            divider: QuizRich.dividers(s).has(x.id) ? true : undefined,
            group: x.group || undefined,
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
      const gone = new Set(quiz.removed || []);
      (data || []).forEach((r) => {
        const attempt = Number(r.attempt) || 1;
        if (gone.has(`${r.respondent}|${attempt}|${r.submitted_at}`)) return;
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
    /** Deletes one student's attempt: from this quiz (scores are re-calculated) and, if the QR code is open, from the server so the attempt no longer counts against them. Returns { serverCleared }. */
    async removeAttempt(toolId, testId, sub) {
      const quiz = ScoringModule.quizOf(toolId, testId);
      let serverCleared = !quiz.token;
      if (quiz.token) {
        try {
          const { error } = await this.client().from("quiz_responses").delete().eq("token", quiz.token).eq("respondent", sub.sid).eq("attempt", sub.attempt);
          serverCleared = !error;
        } catch (e) { serverCleared = false; }
        if (!serverCleared && sub.at) quiz.removed.push(`${sub.sid}|${sub.attempt}|${sub.at}`);
      }
      quiz.submissions = quiz.submissions.filter((x) => x !== sub);
      ScoringModule.regradeQuiz(toolId, testId);
      return { serverCleared };
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
      return {
        id: newId("shared"),
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
    i.addEventListener("keydown", (e) => { // Enter moves to the next box down (not while an IME is composing)
      if (e.key !== "Enter" || e.shiftKey || e.isComposing || e.keyCode === 229) return;
      e.preventDefault();
      const root = i.closest(".tab-panel") || document;
      const fields = Array.from(root.querySelectorAll("input[type=text], input:not([type]), textarea, [contenteditable=true]")).filter((x) => x.offsetParent !== null);
      const k = fields.indexOf(i);
      if (k >= 0 && fields[k + 1]) fields[k + 1].focus();
    });
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
    left.appendChild(button("Print", "btn btn-ghost btn-small", () => window.QuizPrint && QuizPrint.open(quiz, test.name)));
    left.appendChild(button("Export quiz template", "btn btn-ghost btn-small", () => exportTemplate(test, quiz))).title = "A CSV of this quiz laid out for Excel (an empty quiz gives an example sheet showing what to type where). Fill it in and use “Upload quiz contents” to make a new quiz from it.";
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

  /** A "Delete attempt" button for one student's response row. */
  function deleteAttemptBtn(tool, container, test, quiz, s) {
    return button("Delete attempt", "btn btn-ghost btn-small", async () => {
      if (!confirm(`Delete ${s.name || s.sid}'s attempt ${s.attempt} of "${test.name}"? Their answers and score for this attempt are erased and the score is re-calculated.`)) return;
      try {
        const r = await QuizForms.removeAttempt(tool.id, test.id, s);
        if (!r.serverCleared) alert("Deleted here. The server's copy couldn't be removed, so if the QR code is still open the student may not get another try; use Close QR Code to reset it. It won't come back when you Get Responses.");
      } catch (e) { alert(e.message); }
      renderScoringToolView(tool, container);
    });
  }

  // ---------- the question editor ----------
  // Quiz editor sections (settings, each question section) collapse by clicking their heading; the choice survives redraws.
  const collapsedSecs = new Set();
  function collapsible(section, body, key) {
    const head = section.querySelector(".pres-section-head");
    if (!head) return;
    const base = head.textContent;
    head.style.cursor = "pointer"; head.title = "Click to collapse or expand";
    const apply = () => { const c = collapsedSecs.has(key); hideEl(body, c); head.textContent = `${c ? "▸" : "▾"} ${base}`; };
    head.addEventListener("click", (e) => { if (e.target.closest("button, input, select, a, label")) return; if (collapsedSecs.has(key)) collapsedSecs.delete(key); else collapsedSecs.add(key); apply(); });
    apply();
  }
  /** A ▾/▸ button at the start of a row: collapsing hides the text editor (a one-line preview shows instead) and `rest` (the details below). */
  // .category-manage-item has display:flex !important, so hide with !important too
  function hideEl(e, hide) { if (hide) e.style.setProperty("display", "none", "important"); else e.style.removeProperty("display"); }
  function foldable(row, editorEl, rest, key, previewText) {
    const tg = h("button", "btn btn-ghost btn-small", "▾"); tg.type = "button"; tg.title = "Collapse or expand";
    tg.style.cssText = "padding:1px 7px;min-width:1.8em;";
    const pv = h("span", "hint"); pv.style.cssText = "flex:1;min-width:8em;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;cursor:pointer;";
    row.insertBefore(tg, row.firstChild);
    if (editorEl) row.insertBefore(pv, editorEl);
    const apply = () => {
      const c = collapsedSecs.has(key);
      tg.textContent = c ? "▸" : "▾";
      if (editorEl) { hideEl(editorEl, c); pv.style.display = c ? "" : "none"; if (c) pv.textContent = (previewText() || "").replace(/\s+/g, " ").trim() || "(empty)"; }
      (typeof rest === "function" ? rest() : rest).forEach((e) => { hideEl(e, c); });
    };
    const flip = () => { if (collapsedSecs.has(key)) collapsedSecs.delete(key); else collapsedSecs.add(key); apply(); };
    tg.addEventListener("click", flip); pv.addEventListener("click", flip);
    apply();
    return apply;
  }
  function renderEditor(tool, container, testId) {
    const test = ScoringModule.findTest(tool.id, testId);
    const quiz = ScoringModule.quizOf(tool.id, testId);
    const answersOnly = quiz.kind === "answers";
    const isSurvey = isSurveyKind(quiz.kind);
    const style = quiz.settings.labelStyle;
    container.innerHTML = "";
    if (window.QuizRich && QuizRich.refsFromQuiz) QuizRich.refsFromQuiz(quiz);
    const rerender = () => renderScoringToolView(tool, container);
    const regrade = () => ScoringModule.regradeQuiz(tool.id, testId);

    container.appendChild(editorHeader(tool, container, test, quiz, "build"));
    { const used = window.QTSBank && QTSBank.usedInNote ? QTSBank.usedInNote(test) : null; if (used) container.appendChild(used); }

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
      collapsible(section, body, `${testId}:settings`);
      container.appendChild(section);
    }

    let n = 0;
    quiz.sections.forEach((sec) => { sec.notes = sec.notes || []; QuizRich.ensureUnits(sec); });
    quiz.sections.forEach((sec, si) => {
      const { section, body } = makePresSection(`Section ${si + 1}: ${sec.title || "(untitled)"}`);
      section.classList.add("qz-sec-q" + (si % 4));
      const top = h("div", "panel-toolbar");
      top.appendChild(textInput(sec.title, "Section title", (v) => { sec.title = v; rerender(); }));
      const tb = h("div", "panel-toolbar-buttons");
      const addEnd = (type) => { try { ScoringModule.addQuizQuestion(quiz, sec, type); } catch (e) { alert(e.message); return; } rerender(); };
      tb.appendChild(button("+ Instructions", "btn btn-ghost btn-small", () => { // a unit: the instructions box holds its questions
        const last = sec.questions[sec.questions.length - 1];
        sec.notes.push({ id: newId("n"), text: "", kind: "instructions", at: last ? "after" : "start", q: last ? last.id : "" });
        rerender();
      }));
      if (quiz.sections.length > 1) { // re-order sections
        const mv = (d) => { const j = si + d; if (j < 0 || j >= quiz.sections.length) return; [quiz.sections[si], quiz.sections[j]] = [quiz.sections[j], quiz.sections[si]]; regrade(); rerender(); };
        const up = button("▲ Move up", "btn btn-ghost btn-small", () => mv(-1)); up.disabled = si === 0;
        const dn = button("▼ Move down", "btn btn-ghost btn-small", () => mv(1)); dn.disabled = si === quiz.sections.length - 1;
        tb.append(up, dn);
      }
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

      const attach = (note, type) => { // add a question to a Paragraph box: after its last attached question, else where the box sits
        try { ScoringModule.addQuizQuestion(quiz, sec, type); } catch (e) { alert(e.message); return; }
        const nq = sec.questions.pop(); nq.group = note.id;
        let at = -1; sec.questions.forEach((x, i) => { if (x.group === note.id) at = i; });
        if (at >= 0) at += 1;
        else if (note.at === "start") at = 0;
        else if (note.at === "before" || note.at === "after") { const i = sec.questions.findIndex((x) => x.id === note.q); at = i < 0 ? sec.questions.length : i + (note.at === "after" ? 1 : 0); }
        else at = sec.questions.length;
        sec.questions.splice(at, 0, nq); regrade(); rerender();
      };
      const NOTE_LOOK = {
        instructions: ["Instructions", "#b8860b", "Instructions for this unit's questions (shown to students and when printed). A thin line separates units."],
        text: ["Text box", "#6b7280", "Text for students: an explanation, a heading… (no question number)"],
        passage: ["Paragraph", "#7c3aed", "Paragraph for students to read (no question number); the questions attached below belong to it"],
      };
      let cur = body; // where the next box goes: the current instructions unit (or the section), or the Paragraph unit being drawn
      const lateFold = []; // fold functions to re-run once the whole unit has been drawn
      let iu = null, iuCount = 0; // the instructions unit being drawn, and how many questions it holds so far
      const units = new Map();
      const unitKinds = [["mc", "Multiple choice"], ["multi", "Multiple select"], ["blank", "Fill in the blank"], ["para", "Long answer"]];
      const closeUnit = () => { // an instructions unit with no questions yet shows an empty slot waiting for one
        if (iu && iuCount === 0) {
          const ph = h("div", "hint"); ph.style.cssText = "border:2px dashed #b8860b;border-radius:8px;padding:14px;margin:0 0 14px 18px;text-align:center;";
          ph.textContent = "No questions in this unit yet — use “Add question” in the instructions box above.";
          iu.appendChild(ph);
        }
        iu = null; iuCount = 0;
      };
      const addNoteToUnit = (note, kind) => { // a Paragraph / text box goes at the end of the instructions box's unit
        if (note.at === "end") { const lastQ = sec.questions[sec.questions.length - 1]; if (lastQ) { note.at = "after"; note.q = lastQ.id; } else { note.at = "start"; note.q = ""; } }
        const items = QuizRich.flow(sec); const k = items.findIndex((it) => it.note === note);
        let last = null;
        for (let i = k + 1; i < items.length; i++) { const it = items[i]; if (it.note && it.note.kind === "instructions") break; if (it.q) last = it.q; }
        const anchor = last ? { at: "after", q: last.id } : { at: note.at, q: note.q };
        sec.notes.push({ id: newId("n"), text: "", kind, at: anchor.at, q: anchor.q });
        rerender();
      };
      const addToUnit = (note, type) => { // a new question goes at the end of the instructions box's unit
        try { ScoringModule.addQuizQuestion(quiz, sec, type); } catch (e) { alert(e.message); return; }
        const nq = sec.questions.pop();
        if (note.at === "end") { const lastQ = sec.questions[sec.questions.length - 1]; if (lastQ) { note.at = "after"; note.q = lastQ.id; } else { note.at = "start"; note.q = ""; } }
        const items = QuizRich.flow(sec); const k = items.findIndex((it) => it.note === note);
        let last = null;
        for (let i = k + 1; i < items.length; i++) { const it = items[i]; if (it.note && it.note.kind === "instructions") break; if (it.q) last = it.q; }
        let at;
        if (last) at = sec.questions.indexOf(last) + 1;
        else { let prev = null; for (let i = k - 1; i >= 0; i--) if (items[i].q) { prev = items[i].q; break; } at = prev ? sec.questions.indexOf(prev) + 1 : 0; }
        sec.questions.splice(at, 0, nq); regrade(); rerender();
      };
      const moveBtns = (what) => [
        button("↑", "btn btn-ghost btn-small", () => { if (QuizRich.move(sec, what, -1)) { regrade(); rerender(); } }),
        button("↓", "btn btn-ghost btn-small", () => { if (QuizRich.move(sec, what, 1)) { regrade(); rerender(); } }),
      ].map((b, i) => { b.title = i ? "Move down" : "Move up"; b.disabled = !QuizRich.canMove(sec, what, i ? 1 : -1); return b; });
      const noteBox = (note) => {
        const look = NOTE_LOOK[note.kind] || NOTE_LOOK.instructions;
        if (note.kind === "instructions") { closeUnit(); iu = h("div", "qz-iunit"); iu.style.cssText = "border:2px solid #b8860b;border-radius:10px;padding:8px 8px 0;margin-bottom:16px;background:rgba(184,134,11,.06);"; body.appendChild(iu); iuCount = 0; cur = iu; }
        const nb = h("div", "category-manage-item qz-q");
        nb.style.cssText = `margin-bottom:14px;border-left:5px solid ${look[1]};`;
        const nr = h("div", "category-manage-top-row");
        nr.appendChild(h("span", "qz-pill", look[0]));
        const ned = QuizRich.editor({ text: note.text, rich: note.rich, placeholder: look[2], bullets: true, onChange: (t, r) => { note.text = t; note.rich = r; } });
        ned.style.minWidth = "24em";
        nr.appendChild(ned);
        if (note.kind === "instructions") {
          const sl = h("label", "hint"); const sc = h("input"); sc.type = "checkbox"; sc.checked = !note.hide;
          sc.addEventListener("change", () => { note.hide = !sc.checked; });
          sl.append(sc, document.createTextNode(" Show words")); sl.title = "Untick to hide the words from students and printouts (the unit and its dividing line stay)";
          nr.appendChild(sl);
        }
        if (note.kind === "text") {
          const bl = h("label", "hint"); const bc = h("input"); bc.type = "checkbox"; bc.checked = !!note.border;
          bc.addEventListener("change", () => { note.border = bc.checked; ned.style.outline = bc.checked ? "2px solid var(--ink, #555)" : ""; });
          if (note.border) ned.style.outline = "2px solid var(--ink, #555)";
          bl.append(bc, document.createTextNode(" Border")); bl.title = "Draw a border around this text box (student form and printouts)";
          nr.appendChild(bl);
        }
        if (note.kind === "instructions") nr.appendChild(menuButton("Add question", look[1], [...unitKinds.map(([id, lab]) => ({ label: lab, onClick: () => addToUnit(note, id) })), { label: "Paragraph", onClick: () => addNoteToUnit(note, "passage") }, { label: "Text box", onClick: () => addNoteToUnit(note, "text") }]));
        if (note.kind === "passage") {
          nr.appendChild(menuButton("Add question", look[1], [["mc", "Multiple choice"], ["multi", "Multiple select"], ["blank", "Fill in the blank"], ["para", "Long answer"]].map(([id, lab]) => ({ label: lab, onClick: () => attach(note, id) }))));
        }
        moveBtns({ note }).forEach((b) => nr.appendChild(b));
        nr.appendChild(button("×", "btn btn-ghost btn-small", () => {
          if (note.kind === "instructions") { // the box is the unit: its questions go with it
            const items = QuizRich.flow(sec); const k = items.findIndex((it) => it.note === note);
            const gone = [];
            for (let i = k + 1; i < items.length; i++) { const it = items[i]; if (it.note && it.note.kind === "instructions") break; if (it.q) gone.push(it.q); }
            if (gone.length && !confirm(`Delete this instructions box and its ${gone.length} question${gone.length === 1 ? "" : "s"}?`)) return;
            const ids = new Set(gone.map((x) => x.id));
            sec.questions = sec.questions.filter((x) => !ids.has(x.id));
            sec.notes = sec.notes.filter((x) => x !== note && !(x.q && ids.has(x.q)) && !(x.kind === "passage" && gone.some((g) => g.group === x.id)));
            regrade(); rerender(); return;
          }
          if (note.kind === "passage") {
            const gone = sec.questions.filter((x) => x.group === note.id);
            if (gone.length && !confirm(`Delete this paragraph and its ${gone.length} question${gone.length === 1 ? "" : "s"}?`)) return;
            const ids = new Set(gone.map((x) => x.id));
            sec.questions = sec.questions.filter((x) => !ids.has(x.id));
            sec.notes = sec.notes.filter((x) => x !== note && !(x.q && ids.has(x.q)));
            regrade(); rerender(); return;
          }
          sec.notes = sec.notes.filter((x) => x !== note); rerender();
        }));
        nb.appendChild(nr);
        { const hostEl = cur; if (note.kind === "instructions" || note.kind === "passage") lateFold.push(foldable(nr, ned, () => Array.from(hostEl.children).filter((c) => c !== nb), `${testId}:n:${note.id}`, () => note.text)); else foldable(nr, ned, [], `${testId}:n:${note.id}`, () => note.text); }
        cur.appendChild(nb);
      };
      const grouped = new Set(sec.questions.map((x) => x.group).filter(Boolean));
      const placedHere = (x) => !(x.kind === "passage" && grouped.has(x.id));
      const shownGroups = new Set();
      sec.notes.filter((x) => placedHere(x) && x.at === "start").forEach(noteBox);
      const addNote = (at, qid, kind) => { sec.notes.push({ id: newId("n"), text: "", kind: kind || "instructions", at, q: qid }); rerender(); };
      const ids = new Set(sec.questions.map((x) => x.id));
      const divs = QuizRich.dividers(sec);
      sec.questions.forEach((q, qi) => {
        n++;
        cur = iu || body;
        if (q.group) {
          if (!units.has(q.group)) {
            const unit = h("div", "qz-unit"); unit.style.cssText = "border:2px solid #7c3aed;border-radius:10px;padding:8px 8px 0;margin-bottom:16px;background:rgba(124,58,237,.05);";
            (iu || body).appendChild(unit); units.set(q.group, unit); cur = unit;
            const pn = sec.notes.find((x) => x.id === q.group && x.kind === "passage"); if (pn) noteBox(pn);
          }
          cur = units.get(q.group);
        }
        sec.notes.filter((x) => placedHere(x) && x.at === "before" && x.q === q.id).forEach(noteBox);
        if (!q.group) cur = iu || body; // a new instructions box above this question just started a unit
        iuCount++;
        const box = h("div", "category-manage-item qz-q " + (isChoiceQ(q) ? "qz-q-mc" : "qz-q-blank"));
        box.style.marginBottom = "14px";
        if (q.group || iu) box.style.marginLeft = "18px"; // attached to the Paragraph / instructions above
        const row = h("div", "category-manage-top-row");
        { const qp = h("span", "qz-qnum", `Q${n}`); qp.draggable = true; qp.style.cursor = "grab"; qp.title = "Drag this into a text box to refer to this question; the reference follows the question's number";
          qp.addEventListener("dragstart", (e) => { e.dataTransfer.setData("application/x-qref", q.id); e.dataTransfer.setData("text/plain", `(Q${n})`); e.dataTransfer.effectAllowed = "copy"; });
          row.appendChild(qp); }
        const addUnit = (below) => { // a new instructions box starts a new unit; if no question follows it, it comes with a blank one
          sec.notes.push({ id: newId("n"), text: "", kind: "instructions", at: below ? "after" : "before", q: q.id });
          rerender();
        };
        const pill = menuButton(typeName(q), "#1f6fd1", [["mc", "Multiple choice"], ["multi", "Multiple select"], ["blank", "Fill in the blank"], ["para", "Long answer"]].filter(([id]) => id !== q.type).map(([id, label]) => ({
          label: `Change to ${label}`,
          onClick: () => {
            if (quiz.submissions.some((s) => (s.answers || {})[q.id] !== undefined && (s.answers || {})[q.id] !== "") && !confirm("Students have already answered this question. Their answers are kept and re-graded as the new type, which may mark some wrong. Change the type?")) return;
            ScoringModule.setQuizQuestionType(q, id); regrade(); rerender();
          },
        })).concat([{ label: "Add instructions above (new unit)", onClick: () => addUnit(false) }, { label: "Add instructions below (new unit)", onClick: () => addUnit(true) }]));
        pill.className = "qz-pill qz-pill-btn"; pill.style.cssText = "background:transparent;cursor:pointer;"; pill.title = "Click to change the question type";
        row.appendChild(pill);
        let qEd = null;
        if (answersOnly) {
          const spacer = h("span");
          spacer.style.flex = "1";
          row.appendChild(spacer);
        } else {
          qEd = QuizRich.editor({ text: q.text, rich: q.rich, placeholder: "Question text", bullets: true, onChange: (t, r) => { q.text = t; q.rich = r; } });
          qEd.style.cssText += "flex:3;min-width:26em;";
          qEd.querySelector("[contenteditable]").style.minHeight = "3.6em";
          row.appendChild(qEd);
        }
        if (!isSurvey) {
          row.appendChild(h("span", "hint", "pts"));
          const ptsIn = textInput(String(q.points), "", (v) => { q.points = Math.max(0, Number(v) || 0); regrade(); rerender(); }, "point-value-input");
          ptsIn.style.cssText += "width:3.4em;min-width:0;flex:0 0 auto;padding:2px 4px;";
          row.appendChild(ptsIn);
        }
        row.appendChild(button(q.dividerAfter ? "Line below ✓" : "Line below", "btn btn-ghost btn-small", () => { q.dividerAfter = !q.dividerAfter; rerender(); }));
        if (q.dividerAfter) box.style.borderBottom = "3px solid var(--ink, #555)";
        const insertQ = (type, below) => { try { ScoringModule.addQuizQuestion(quiz, sec, type); } catch (e) { alert(e.message); return; } const nq = sec.questions.pop(); if (q.group) nq.group = q.group; sec.questions.splice(qi + (below ? 1 : 0), 0, nq); regrade(); rerender(); };
        const kinds = [["mc", "Multiple choice"], ["multi", "Multiple select"], ["blank", "Fill in the blank"], ["para", "Long answer"]];
        const side = (below) => {
          const at = below ? "after" : "before";
          return [
            ...kinds.map(([id, lab]) => ({ label: lab, onClick: () => insertQ(id, below) })),
            { label: "Paragraph", onClick: () => addNote(at, q.id, "passage") },
            { label: "Text box", onClick: () => addNote(at, q.id, "text") },
            { label: "Instructions (new unit)", onClick: () => addUnit(below) },
          ];
        };
        moveBtns({ q }).forEach((b) => row.appendChild(b));
        const stack = h("div"); stack.style.cssText = "display:flex;flex-direction:column;gap:3px;";
        stack.appendChild(menuButton("Add above", "#b8860b", side(false)));
        stack.appendChild(menuButton("Add below", "#b8860b", side(true)));
        row.appendChild(stack);
        row.appendChild(button("Duplicate", "btn btn-ghost btn-small", () => { try { ScoringModule.duplicateQuizQuestion(quiz, sec, qi); } catch (e) { alert(e.message); return; } regrade(); rerender(); }));
        row.appendChild(button("×", "btn btn-ghost btn-small", () => { sec.questions.splice(qi, 1); regrade(); rerender(); }));
        box.appendChild(row);

        if (isChoiceQ(q)) {
          const cnt = h("div", "mapping-row");
          cnt.appendChild(h("label", "", "Number of options"));
          cnt.appendChild(textInput(String(q.choices.length), "", (v) => { ScoringModule.setQuizChoiceCount(q, v); regrade(); rerender(); }, "point-value-input"));
          box.appendChild(cnt);
          let keySel = null; // the correct-answer drop-down: its labels follow the option text without redrawing (so Enter / Tab keep their place)
          if (!answersOnly) {
            q.choices.forEach((c, ci) => {
              const crow = h("div", "mapping-row qz-opt-row");
              crow.appendChild(h("label", "", optionLabel(style, ci)));
              const inp = textInput(c, "Option text", (v) => {
                q.choices[ci] = v.trim();
                if (keySel && keySel.options[ci]) keySel.options[ci].textContent = q.choices[ci] ? `${optionLabel(style, ci)}: ${q.choices[ci]}` : optionLabel(style, ci);
              });
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
          const sel = h("select"); keySel = sel;
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
        } else if (q.type === "para") {
          const lr = h("div", "mapping-row");
          lr.appendChild(h("label", "", "Writing lines when printed"));
          lr.appendChild(textInput(String(q.lines || 6), "", (v) => { q.lines = Math.max(1, Math.min(40, Math.round(Number(v) || 6))); rerender(); }, "point-value-input"));
          box.appendChild(lr);
          box.appendChild(h("p", "hint", isSurvey ? "Students type a paragraph in a text box. Surveys have no points." : "Students type a paragraph in a text box. It isn't marked automatically: open Results, switch to Edit mode and type the points (0 to this question's points) for each student."));
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
        foldable(row, qEd, Array.from(box.children).filter((c) => c !== row), `${testId}:q:${q.id}`, () => q.text);
        cur.appendChild(box);
        sec.notes.filter((x) => placedHere(x) && x.at === "after" && x.q === q.id).forEach(noteBox);
      });
      cur = iu || body;
      sec.notes.filter((x) => placedHere(x) && (x.at === "end" || ((x.at === "before" || x.at === "after") && !ids.has(x.q)))).forEach(noteBox);
      closeUnit();
      lateFold.forEach((f) => f());
      if (sec.questions.length === 0 && sec.notes.length === 0) body.appendChild(h("p", "hint", "No questions yet — use “+ Add” above."));
      collapsible(section, body, `${testId}:${sec.id}`);
      container.appendChild(section);
    });
    container.appendChild(button("+ Add Section", "btn btn-ghost", () => { ScoringModule.addQuizSection(quiz); rerender(); }));

  }

  // ---------- entry order, timestamps, combining ----------
  /** "Nov 5, 19:31:02" in the teacher's own time zone ("—" when the entry has no time). */
  function fmtTime(at) {
    const d = at ? new Date(at) : null;
    if (!d || isNaN(d)) return "—";
    return d.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: false });
  }
  const timeOf = (s) => { const t = s && s.at ? Date.parse(s.at) : NaN; return isNaN(t) ? null : t; };
  /** One student's entries by time (entries with no time fall back to attempt number). */
  function byTime(a, b) {
    const ta = timeOf(a), tb = timeOf(b);
    return ta !== null && tb !== null && ta !== tb ? ta - tb : a.attempt - b.attempt;
  }
  /** Students A-Z, and each student's entries in time order. */
  function studentOrder(a, b) {
    return (a.name || a.sid).localeCompare(b.name || b.sid) || String(a.sid).localeCompare(String(b.sid)) || byTime(a, b);
  }
  const blankAnswer = (v) => v === undefined || v === null || String(v).trim() === "";

  /** Asks which answer to keep where two or more entries both answered the same question. Resolves to { questionId: entry } or null (cancelled). */
  function askConflicts(quiz, conflicts, name) {
    return new Promise((resolve) => {
      const overlay = h("div");
      overlay.style.cssText = "position:fixed;inset:0;z-index:10000;background:rgba(0,0,0,.45);display:flex;align-items:center;justify-content:center;padding:16px;";
      const box = h("div");
      box.style.cssText = "background:var(--card,#fff);color:var(--ink,#111);border:1px solid var(--line,#ccc);border-radius:var(--radius,8px);max-width:760px;width:100%;max-height:85vh;overflow:auto;padding:16px;box-shadow:0 8px 30px rgba(0,0,0,.3);";
      box.appendChild(h("h3", "", `Both entries answered some questions (${name})`));
      box.appendChild(h("p", "hint", "Recommended: keep the first answer that was entered (the earliest time). Choose a different one for any question below."));
      const chosen = {};
      conflicts.forEach((c, ci) => {
        const fs = h("div", "category-manage-item");
        fs.style.cssText = "display:block;margin:8px 0;padding:8px;";
        fs.appendChild(h("strong", "", `Q${c.n}`));
        c.options.forEach((o, oi) => {
          const lab = h("label");
          lab.style.cssText = "display:flex;gap:8px;align-items:flex-start;margin:4px 0;cursor:pointer;";
          const r = h("input"); r.type = "radio"; r.name = `qz-conf-${ci}`; r.checked = oi === 0;
          chosen[c.q.id] = c.options[0].s;
          r.addEventListener("change", () => { chosen[c.q.id] = o.s; });
          const t = h("span", "", `${oi === 0 ? "★ First entered (recommended)" : "Later entry"} — attempt ${o.s.attempt}, ${fmtTime(o.s.at)}: ${o.text || "(blank)"}`);
          t.style.whiteSpace = "pre-wrap";
          lab.append(r, t);
          fs.appendChild(lab);
        });
        box.appendChild(fs);
      });
      const bar = h("div", "qz-actions");
      const done = (v) => { overlay.remove(); resolve(v); };
      bar.append(button("Combine entries", "btn btn-primary", () => done(chosen)), button("Cancel", "btn btn-ghost", () => done(null)));
      box.appendChild(bar);
      overlay.appendChild(box);
      document.body.appendChild(overlay);
    });
  }

  /** Merges all of one student's entries into the earliest one. Needs, for every question, an answer in at most one entry (or you choose which to keep). */
  async function combineEntries(tool, container, test, quiz, sid, batch) {
    const list = quiz.submissions.filter((x) => x.sid === sid).sort(byTime);
    if (list.length < 2) return false;
    const name = list[0].name || sid;
    if (list.length > 2 && !batch && !confirm(`${name} has ${list.length} entries. Combining will merge ALL ${list.length} into the earliest one (attempt ${list[0].attempt}) and delete the others. Continue?`)) return;
    const qs = allQuestions(quiz).map((x) => x.q);
    const effs = list.map((s) => ScoringModule.quizEffectiveAnswers(s));
    const conflicts = [];
    const pick = {}; // question id -> entry whose answer is kept
    qs.forEach((q, qi) => {
      const filled = list.map((s, i) => ({ s, v: effs[i][q.id] })).filter((x) => !blankAnswer(x.v));
      if (filled.length === 0) return; // blank everywhere: stays blank
      pick[q.id] = filled[0].s; // earliest answered entry
      const distinct = new Set(filled.map((x) => String(x.v).trim()));
      if (filled.length >= 2 && distinct.size > 1) conflicts.push({ q, n: qi + 1, options: filled.map((x) => ({ s: x.s, text: optionText(quiz, q, x.v) })) });
    });
    if (conflicts.length) {
      const chosen = await askConflicts(quiz, conflicts, name);
      if (!chosen) return false;
      Object.assign(pick, chosen);
    }
    const base = list[0];
    base.overrides = base.overrides || {};
    base.marks = base.marks || {};
    qs.forEach((q) => {
      const src = pick[q.id];
      if (!src || src === base) return;
      base.overrides[q.id] = ScoringModule.quizEffectiveAnswers(src)[q.id]; // an edit, so Get Responses keeps it
      if (q.type === "para") {
        if (src.marks && src.marks[q.id] !== undefined) base.marks[q.id] = src.marks[q.id];
        else delete base.marks[q.id];
      }
    });
    base.combinedFrom = [...(base.combinedFrom || []), ...list.slice(1).map((x) => x.attempt)];
    let serverFailed = false;
    for (const other of list.slice(1)) {
      try { const r = await QuizForms.removeAttempt(tool.id, test.id, other); if (!r.serverCleared) serverFailed = true; }
      catch (e) { serverFailed = true; }
    }
    ScoringModule.regradeQuiz(tool.id, test.id);
    if (serverFailed && !batch) alert("Combined here. The server's copy of an old entry couldn't be removed; it won't come back when you Get Responses.");
    if (!batch) renderScoringToolView(tool, container);
    return serverFailed ? "server" : true;
  }

  /** Every student with more than one entry, one after another; a dialog appears for each conflicting answer. */
  async function combineAllDuplicates(tool, container, test, quiz) {
    const count = new Map();
    quiz.submissions.forEach((x) => count.set(x.sid, (count.get(x.sid) || 0) + 1));
    const dupes = [...count.entries()].filter(([, n]) => n > 1);
    if (!dupes.length) { alert("No student has more than one entry."); return; }
    const big = dupes.filter(([, n]) => n > 2).length;
    if (!confirm(`${dupes.length} student${dupes.length === 1 ? " has" : "s have"} more than one entry${big ? ` (${big} with more than 2 — all of their entries will be merged into the earliest)` : ""}.\n\nCombine them all? Where two entries answered the same question differently, you'll be asked which answer to keep. Cancelling a dialog skips that student.`)) return;
    let done = 0, skipped = 0, serverFailed = false;
    for (const [sid] of dupes) {
      const r = await combineEntries(tool, container, test, quiz, sid, true);
      if (r) done++; else skipped++;
      if (r === "server") serverFailed = true;
    }
    ScoringModule.regradeQuiz(tool.id, test.id);
    alert(`Combined ${done} student${done === 1 ? "" : "s"}${skipped ? `; skipped ${skipped}` : ""}.${serverFailed ? " Some old server copies couldn't be removed; they won't come back when you Get Responses." : ""}`);
    renderScoringToolView(tool, container);
  }

  /** The View / Edit switch at the top of the Results screen (Edit adds score editing, Combine and Delete). */
  function modeBar(tool, container, test, quiz) {
    const mode = resultMode.get(test.id) === "edit" ? "edit" : "view";
    const bar = h("div", "qz-actions");
    bar.style.cssText = "display:flex;gap:8px;align-items:center;flex-wrap:wrap;margin:8px 0;";
    bar.appendChild(h("strong", "", "Mode:"));
    [["view", "View"], ["edit", "Edit"]].forEach(([id, label]) => {
      bar.appendChild(button(label, id === mode ? "btn btn-primary btn-small" : "btn btn-ghost btn-small", () => { resultMode.set(test.id, id); renderScoringToolView(tool, container); }));
    });
    if (mode === "edit") {
      const count = new Map();
      quiz.submissions.forEach((x) => count.set(x.sid, (count.get(x.sid) || 0) + 1));
      const n = [...count.values()].filter((c) => c > 1).length;
      const b = button(`Combine all duplicate entries${n ? ` (${n})` : ""}`, "btn btn-ghost btn-small", () => combineAllDuplicates(tool, container, test, quiz));
      b.disabled = n === 0;
      bar.appendChild(b);
    }
    return bar;
  }

  /** The "Quiz stats" section: scores use each student's counted attempt (the quiz's best / latest / first rule). Returns { section, draw }. */
  function statsBox(quiz) {
    const { section, body } = makePresSection("Quiz stats");
    section.classList.add("qz-sec-review");
    const draw = () => {
      body.textContent = "";
      const total = ScoringModule.quizTotal(quiz);
      const qs = allQuestions(quiz).map((x) => x.q);
      const by = new Map();
      quiz.submissions.forEach((x) => { if (!by.has(x.sid)) by.set(x.sid, []); by.get(x.sid).push(x); });
      const rule = quiz.settings.attemptRule;
      const counted = [];
      by.forEach((list) => {
        list.sort((a, b) => a.attempt - b.attempt);
        const scored = list.map((x) => ({ x, sc: ScoringModule.gradeQuizSubmission(quiz, ScoringModule.quizEffectiveAnswers(x)) }));
        counted.push(rule === "latest" ? scored[scored.length - 1] : rule === "first" ? scored[0] : scored.reduce((a, b) => (b.sc > a.sc ? b : a)));
      });
      if (!counted.length) { body.appendChild(h("p", "hint", "No scores yet.")); return; }
      const scores = counted.map((c) => c.sc).sort((a, b) => a - b);
      const n = scores.length;
      const sum = scores.reduce((a, b) => a + b, 0), mean = sum / n;
      const median = n % 2 ? scores[(n - 1) / 2] : (scores[n / 2 - 1] + scores[n / 2]) / 2;
      const sd = Math.sqrt(scores.reduce((a, b) => a + (b - mean) * (b - mean), 0) / n);
      const f = (v) => String(Math.round(v * 100) / 100);
      const pct = (v) => (total ? ` (${Math.round((1000 * v) / total) / 10}%)` : "");
      const names = (pick) => counted.filter((c) => c.sc === pick).map((c) => c.x.name || c.x.sid).slice(0, 4).join(", ");
      const rows = [
        ["Students counted", String(n)],
        ["Total entries", `${quiz.submissions.length}${quiz.submissions.length > n ? ` (${quiz.submissions.length - n} extra)` : ""}`],
        ["Counted attempt", rule === "latest" ? "Latest" : rule === "first" ? "First" : "Best"],
        ["Maximum points", f(total)],
        ["High score", `${f(scores[n - 1])}${pct(scores[n - 1])} — ${names(scores[n - 1])}`],
        ["Low score", `${f(scores[0])}${pct(scores[0])} — ${names(scores[0])}`],
        ["Median", `${f(median)}${pct(median)}`],
        ["Average (mean)", `${f(mean)}${pct(mean)}`],
        ["Standard deviation", f(sd)],
        ["Range", f(scores[n - 1] - scores[0])],
      ];
      const ok = qs.map((q) => counted.filter((c) => { const e = ScoringModule.quizEffectiveAnswers(c.x); return ScoringModule.quizAnswerFraction(q, e[q.id], e["#" + q.id]) === 1; }).length);
      if (qs.length > 1) {
        const hard = ok.indexOf(Math.min(...ok)), easy = ok.indexOf(Math.max(...ok));
        rows.push(["Hardest question", `Q${hard + 1} — ${Math.round((100 * ok[hard]) / n)}% correct`], ["Easiest question", `Q${easy + 1} — ${Math.round((100 * ok[easy]) / n)}% correct`]);
      }
      const t = h("table", "roster-table");
      t.style.maxWidth = "640px";
      rows.forEach(([k, v]) => { const tr = h("tr"); const th = h("td", "", k); th.style.fontWeight = "700"; tr.append(th, h("td", "", v)); t.appendChild(tr); });
      body.appendChild(t);
    };
    return { section, draw };
  }

  // ---------- the review grid ----------
  function renderReview(tool, container, testId) {
    const test = ScoringModule.findTest(tool.id, testId);
    const quiz = ScoringModule.quizOf(tool.id, testId);
    const style = quiz.settings.labelStyle;
    container.innerHTML = "";
    const regrade = () => ScoringModule.regradeQuiz(tool.id, testId);

    container.appendChild(editorHeader(tool, container, test, quiz, "results"));
    container.appendChild(modeBar(tool, container, test, quiz));
    const { section, body } = makePresSection("Edit results   ● correct   ✕ incorrect");
    section.classList.add("qz-sec-review");
    container.appendChild(section);
    body.appendChild(h("p", "hint", "● green = correct, ✕ red = incorrect. Change any student's answer in its box, or fix an answer in the \"Answer key\" row — scores update instantly. Edited answers get a yellow outline and are kept when you Get Responses again."));

    if (quiz.submissions.length === 0) {
      body.appendChild(h("p", "hint", "No answers yet. Launch the QR code from the Tests & Quizzes list, then click Get Responses."));
      return;
    }
    const stats = statsBox(quiz);

    const qs = [];
    quiz.sections.forEach((s) => s.questions.forEach((q) => qs.push(q)));
    const total = ScoringModule.quizTotal(quiz);
    const wrap = h("div", "attendance-table-wrap");
    const table = h("table", "attendance-table qz-review");
    wrap.appendChild(table);
    body.appendChild(wrap);

    const thead = h("thead");
    const hr = h("tr");
    ["Student", "Attempt", "Time", "Score"].forEach((t) => hr.appendChild(h("th", "", t)));
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
      } else if (q.type === "para") {
        td.appendChild(h("span", "hint", "marked by hand"));
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
    let prevSid = null;
    const sorted = [...quiz.submissions].sort(studentOrder);
    const entryCount = new Map();
    sorted.forEach((x) => entryCount.set(x.sid, (entryCount.get(x.sid) || 0) + 1));
    sorted.forEach((s) => {
      const tr = h("tr", s.sid !== lastSid ? "qz-newstudent" : "");
      lastSid = s.sid;
      const nameTd = h("td", "", s.name || "(not on roster)");
      nameTd.appendChild(h("div", "hint", s.sid));
      nameTd.appendChild(deleteAttemptBtn(tool, container, test, quiz, s));
      if (s.sid !== prevSid && entryCount.get(s.sid) > 1) {
        const cb = button(`Combine ${entryCount.get(s.sid)} entries`, "btn btn-ghost btn-small", () => combineEntries(tool, container, test, quiz, s.sid));
        cb.title = "Merge this student's entries into one. Works question by question; you choose which answer to keep if both entries answered the same question.";
        nameTd.appendChild(cb);
      }
      prevSid = s.sid;
      tr.appendChild(nameTd);
      const attTd = h("td", "", String(s.attempt));
      if (s.combinedFrom && s.combinedFrom.length) attTd.appendChild(h("div", "hint", `combined with ${s.combinedFrom.map((n) => "#" + n).join(", ")}`));
      tr.appendChild(attTd);
      const timeTd = h("td", "", fmtTime(s.at));
      timeTd.style.whiteSpace = "nowrap";
      tr.appendChild(timeTd);
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
        } else if (q.type === "para") {
          ctl = h("div");
          const txt = h("div", "", current === undefined || current === null || current === "" ? "(no answer)" : String(current));
          txt.style.cssText = "white-space:pre-wrap;max-width:26em;max-height:9em;overflow:auto;font-size:.9rem;";
          const pr = h("label", "hint", "pts ");
          const pin = h("input"); pin.type = "text"; pin.inputMode = "decimal"; pin.className = "point-value-input";
          const cur = s.marks[q.id];
          pin.value = cur === undefined || cur === null ? "" : String(cur);
          pin.addEventListener("change", () => {
            const v = pin.value.trim();
            if (v === "") delete s.marks[q.id];
            else s.marks[q.id] = Math.max(0, Math.min(q.points, Number(v) || 0));
            pin.value = s.marks[q.id] === undefined ? "" : String(s.marks[q.id]);
            regrade(); refresh();
          });
          pr.appendChild(pin); pr.append(" / " + q.points);
          ctl.append(txt, pr);
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
    ftr.appendChild(h("td"));
    const pctCells = qs.map(() => { const td = h("td"); td.style.textAlign = "center"; ftr.appendChild(td); return td; });
    tfoot.appendChild(ftr);
    table.appendChild(tfoot);

    function refresh() {
      const correctCount = qs.map(() => 0);
      rows.forEach((r) => {
        const eff = ScoringModule.quizEffectiveAnswers(r.s);
        r.cells.forEach((c, i) => {
          const frac = ScoringModule.quizAnswerFraction(c.q, eff[c.q.id], eff["#" + c.q.id]);
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
      stats.draw();
    }
    container.appendChild(stats.section);
    refresh();
  }

  // ---------- CSV export ----------
  const sortedSubs = (quiz) => [...quiz.submissions].sort(studentOrder);
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
      rows.push([s.name || "", s.sid, s.attempt, ...qs.map((x) => ScoringModule.gradeQuizQuestion(x.q, eff[x.q.id], eff["#" + x.q.id])), totals.get(s), ScoringModule.quizTotal(quiz), counts.has(s) ? "Yes" : ""]);
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

  // ---------- quiz template: export a quiz's structure to CSV / Excel, or upload a filled-in sheet as a new quiz ----------
  // One row per element, in reading order. Column "Kind": QUIZ, SETTING, SECTION, INSTRUCTIONS, PARAGRAPH, TEXT, QUESTION (NOTE rows are comments).
  const SHEET_HEAD = ["Kind", "Text", "Type / value", "Points", "Correct answer", "Other accepted answers", "Number of options", "Lines", "Line below", "In paragraph", "Border", "Hide words"];
  const KIND_NAME = { standard: "Quiz", answers: "Answer Collection", survey: "Research Survey", formative: "Formative Survey" };
  const sheetNorm = (v) => String(v === undefined || v === null ? "" : v).trim();
  const yes = (v) => /^(y|yes|true|1|x|○|はい)$/i.test(sheetNorm(v));
  const sheetType = (s) => {
    s = sheetNorm(s).toLowerCase().replace(/[^a-z]/g, "");
    if (/^(mc|multiplechoice|choice|single)$/.test(s)) return "mc";
    if (/^(multi|multiple|multipleselect|select|checkbox)$/.test(s)) return "multi";
    if (/^(blank|fillintheblank|fill|shortanswer|text)$/.test(s)) return "blank";
    if (/^(para|paragraph|longanswer|long|essay)$/.test(s)) return "para";
    return "";
  };
  const sheetKind = (s) => { s = sheetNorm(s).toLowerCase(); return /formative/.test(s) ? "formative" : /answer/.test(s) ? "answers" : /survey|research/.test(s) ? "survey" : "standard"; };
  const guideRows = (width) => [
    "HOW THIS SHEET WORKS (delete these NOTE rows if you like; rows whose Kind is NOTE are ignored). One row per item, in the order they appear in the quiz.",
    "Kind: QUIZ (Text = name, Type / value = Quiz, Answer Collection, Research Survey or Formative Survey) · SETTING (Text = Option labels / Time limit (minutes) / Attempts per student, Type / value = the setting) · SECTION (Text = section title) · INSTRUCTIONS (a box that holds the questions after it) · PARAGRAPH (a reading text; questions marked In paragraph = yes belong to it) · TEXT (a plain text box) · QUESTION.",
    "Every question must sit under an INSTRUCTIONS row (leave its Text empty if you have no instructions); questions placed before any INSTRUCTIONS row get an empty one.",
    "QUESTION rows: Type / value = mc (multiple choice), multi (multiple select), blank (fill in the blank) or para (long answer). Points = the point value (leave empty on surveys).",
    "Correct answer: mc = the option's label (A, B, C… or 1, 2, 3) or its exact text; multi = several labels separated by commas (A, C); blank = the answer. Other accepted answers (blank only) = more accepted answers separated by |.",
    "Option 1, Option 2… = the answer choices (mc and multi). For an Answer Collection leave them empty and set Number of options. Lines = writing lines for a para question. Line below / Border / Hide words / In paragraph: type yes.",
  ].map((t) => { const r = ["NOTE", t]; while (r.length < width) r.push(""); return r; });
  function sheetRows(quiz, name) {
    const answers = quiz.kind === "answers", survey = isSurveyKind(quiz.kind);
    const style = quiz.settings.labelStyle;
    const empty = ScoringModule.quizQuestionCount(quiz) === 0;
    let nOpt = 4;
    if (!empty) quiz.sections.forEach((sec) => sec.questions.forEach((q) => { if (isChoiceQ(q)) nOpt = Math.max(nOpt, q.choices.length); }));
    const head = [...SHEET_HEAD, ...Array.from({ length: nOpt }, (_, i) => `Option ${i + 1}`)];
    const row = (...cells) => { const r = cells.map((c) => (c === undefined || c === null ? "" : c)); while (r.length < head.length) r.push(""); return r; };
    const rows = [...guideRows(head.length), head];
    const labelSample = (LABEL_STYLES.find(([id]) => id === style) || LABEL_STYLES[0])[1];
    rows.push(row("QUIZ", name || (empty ? "My new quiz" : ""), KIND_NAME[quiz.kind] || "Quiz"));
    rows.push(row("SETTING", "Option labels", labelSample), row("SETTING", "Time limit (minutes)", quiz.settings.timeLimit || 0), row("SETTING", "Attempts per student", quiz.settings.attemptsAllowed === undefined ? 1 : quiz.settings.attemptsAllowed));
    if (empty) { // example contents showing what goes where
      const pts = (v) => (survey ? "" : v);
      const ex = (txt, type, p, ok, more, nopt, ...opts) => row("QUESTION", answers ? "" : txt, type, pts(p), survey ? "" : ok, more, nopt, "", "", "", "", "", ...(answers ? [] : opts));
      rows.push(row("SECTION", "Section 1: Vocabulary"));
      rows.push(row("INSTRUCTIONS", answers ? "" : "Choose the best answer for each question."));
      rows.push(ex("Which word means “happy”?", "mc", 1, "B", "", 4, "sad", "glad", "angry", "tired"));
      rows.push(ex("Which of these are fruits? (select all)", "multi", 2, "A, C", "", 4, "apple", "carrot", "banana", "bread"));
      rows.push(row("INSTRUCTIONS", answers ? "" : "Write one word in each blank."));
      rows.push(ex("The opposite of “hot” is ____.", "blank", 1, "cold", "cool | chilly", ""));
      rows.push(row("QUESTION", answers ? "" : "Explain your answer in two or three sentences.", "para", survey ? "" : 5, "", "", "", 6, "yes", "", "", ""));
      if (!answers) {
        rows.push(row("SECTION", "Section 2: Reading"));
        rows.push(row("INSTRUCTIONS", "Read the passage and answer the questions."));
        rows.push(row("PARAGRAPH", "Paste the reading passage here."));
        rows.push(row("QUESTION", "What is the passage about?", "mc", pts(2), survey ? "" : "A", "", 3, "", "", "yes", "", "", "the weather", "a trip", "a meal"));
        rows.push(row("TEXT", "A plain text box (no question number). Type yes in Border to draw a box around it.", "", "", "", "", "", "", "", "", "yes"));
      }
      return rows;
    }
    quiz.sections.forEach((sec) => {
      rows.push(row("SECTION", sec.title || ""));
      QuizRich.flow(sec).forEach((it) => {
        if (it.note) {
          const nt = it.note;
          rows.push(row({ instructions: "INSTRUCTIONS", passage: "PARAGRAPH", text: "TEXT" }[nt.kind] || "TEXT", nt.text || "", "", "", "", "", "", "", "", "", nt.border ? "yes" : "", nt.hide ? "yes" : ""));
          return;
        }
        const q = it.q, choice = isChoiceQ(q);
        const correct = survey ? "" : q.type === "multi" ? multiSet(q.correctSet).map((i) => optionLabel(style, i)).join(", ") : q.type === "mc" ? optionLabel(style, q.correct) : (q.accepted && q.accepted[0]) || "";
        rows.push(row("QUESTION", answers ? "" : q.text || "", q.type, survey ? "" : q.points, correct, q.type === "blank" ? (q.accepted || []).slice(1).filter(Boolean).join(" | ") : "", choice ? q.choices.length : "", q.type === "para" ? q.lines || 6 : "", q.dividerAfter ? "yes" : "", q.group ? "yes" : "", "", "", ...(choice && !answers ? q.choices : [])));
      });
    });
    return rows;
  }
  const choiceIndexes = (ref, choices, style, many) => {
    const n = choices.length, out = [];
    const one = (t) => {
      t = sheetNorm(t); if (!t) return;
      let i = -1;
      for (let k = 0; k < n && i < 0; k++) if (optionLabel(style, k).toLowerCase() === t.toLowerCase()) i = k;
      if (i < 0) i = choices.findIndex((c) => sheetNorm(c).toLowerCase() === t.toLowerCase());
      if (i < 0 && /^[a-z]$/i.test(t)) i = t.toLowerCase().charCodeAt(0) - 97;
      if (i < 0 && /^\d+$/.test(t)) i = Number(t) - 1;
      if (i >= 0 && i < n && !out.includes(i)) out.push(i);
    };
    if (many) sheetNorm(ref).split(/[,;|、\n]+/).forEach(one); else one(ref);
    return out.sort((a, b) => a - b);
  };
  /** Turns the rows of a filled-in sheet into { name, kind, settings, sections, warnings }. Throws a plain-English Error if it can't be read. */
  function parseSheet(rows) {
    const warnings = [];
    const hi = rows.findIndex((r) => sheetNorm(r[0]).toLowerCase() === "kind");
    if (hi < 0) throw new Error("couldn't find the header row (its first cell must say “Kind”). Use “Export quiz template” to get a sheet with the right layout.");
    const head = rows[hi].map(sheetNorm), col = (re) => head.findIndex((x) => re.test(x));
    const C = { text: col(/^text$/i), type: col(/^type/i), pts: col(/^points?$/i), ok: col(/^correct/i), more: col(/^other/i), nopt: col(/^number of options/i), lines: col(/^lines?$/i), line: col(/^line below/i), grp: col(/^in paragraph/i), border: col(/^border/i), hide: col(/^hide/i) };
    const optCols = []; head.forEach((x, i) => { const m = /^option\s*(\d+)$/i.exec(x); if (m) optCols.push([Number(m[1]), i]); }); optCols.sort((a, b) => a[0] - b[0]);
    const cell = (r, i) => (i >= 0 ? sheetNorm(r[i]) : "");
    const out = { name: "", kind: "standard", settings: { labelStyle: "upper", defaultOptions: 4, timeLimit: 0, attemptsAllowed: 1, attemptRule: "best" }, sections: [], warnings };
    let sec = null, group = null, total = 0;
    const needSection = () => { if (!sec) { sec = { id: newId("sec"), title: "Section 1", questions: [], notes: [] }; out.sections.push(sec); } return sec; };
    for (let ri = hi + 1; ri < rows.length; ri++) {
      const r = rows[ri], at = `Row ${ri + 1}`, kind = sheetNorm(r[0]).toUpperCase();
      if (!kind || kind === "NOTE") continue;
      const text = cell(r, C.text), tv = cell(r, C.type);
      if (kind === "QUIZ") { out.name = text; if (tv) out.kind = sheetKind(tv); }
      else if (kind === "SETTING") {
        const k = text.toLowerCase();
        if (/option label/.test(k)) { const hit = LABEL_STYLES.find(([id, lab]) => id === tv || lab.replace(/\s/g, "") === tv.replace(/\s/g, "") || lab.split(",")[0].trim() === tv.split(",")[0].trim()); if (hit) out.settings.labelStyle = hit[0]; else if (tv) warnings.push(`${at}: option labels “${tv}” not recognised (using A, B, C).`); }
        else if (/time/.test(k)) out.settings.timeLimit = Math.max(0, Number(tv) || 0);
        else if (/attempt/.test(k)) out.settings.attemptsAllowed = Math.max(0, Math.round(Number(tv) || 0));
        else warnings.push(`${at}: unknown setting “${text}” ignored.`);
      } else if (kind === "SECTION") { sec = { id: newId("sec"), title: text, questions: [], notes: [] }; out.sections.push(sec); group = null; }
      else if (kind === "INSTRUCTIONS" || kind === "PARAGRAPH" || kind === "TEXT") {
        const s = needSection(), last = s.questions[s.questions.length - 1];
        const note = { id: newId("n"), text, rich: "", kind: kind === "INSTRUCTIONS" ? "instructions" : kind === "PARAGRAPH" ? "passage" : "text", at: last ? "after" : "start", q: last ? last.id : "" };
        if (yes(r[C.hide])) note.hide = true;
        if (note.kind === "text" && yes(r[C.border])) note.border = true;
        s.notes.push(note); group = kind === "PARAGRAPH" ? note.id : null;
      } else if (kind === "QUESTION") {
        const type = sheetType(tv);
        if (!type) { warnings.push(`${at}: question type “${tv}” not recognised (use mc, multi, blank or para) — row skipped.`); continue; }
        if (++total > MAX_QUESTIONS) throw new Error(`a quiz can have at most ${MAX_QUESTIONS} questions.`);
        const s = needSection(), answersKind = out.kind === "answers", survey = isSurveyKind(out.kind);
        const q = { id: newId("q"), type, text: answersKind ? "" : text, points: survey ? 0 : (cell(r, C.pts) === "" ? 1 : Math.max(0, Number(cell(r, C.pts)) || 0)), choices: [], correct: 0, accepted: type === "blank" ? [""] : [] };
        if (type === "mc" || type === "multi") {
          let opts = optCols.map(([, i]) => cell(r, i)); while (opts.length && !opts[opts.length - 1]) opts.pop();
          let n = opts.length; const want = Number(cell(r, C.nopt)); if (want >= 2 && want > n) n = want;
          if (n < 2) n = Math.max(2, out.settings.defaultOptions);
          if (n > MAX_OPTIONS) { warnings.push(`${at}: more than ${MAX_OPTIONS} options; extra ones dropped.`); n = MAX_OPTIONS; }
          q.choices = Array.from({ length: n }, (_, i) => (answersKind ? "" : opts[i] || ""));
          const ok = cell(r, C.ok), idx = choiceIndexes(ok, q.choices, out.settings.labelStyle, type === "multi");
          if (type === "mc") q.correct = idx.length ? idx[0] : 0; else { q.correctSet = idx.length ? idx : [0]; q.partial = false; }
          if (ok && !idx.length && !survey) warnings.push(`${at}: correct answer “${ok}” doesn't match an option (first option used).`);
        } else if (type === "blank") q.accepted = [cell(r, C.ok), ...cell(r, C.more).split("|").map((x) => x.trim()).filter(Boolean)];
        else q.lines = Math.max(1, Math.min(40, Math.round(Number(cell(r, C.lines))) || 6));
        if (yes(r[C.line])) q.dividerAfter = true;
        if (yes(r[C.grp])) { if (group) q.group = group; else warnings.push(`${at}: “In paragraph” but no PARAGRAPH row above — ignored.`); }
        s.questions.push(q);
      } else warnings.push(`${at}: unknown kind “${sheetNorm(r[0])}” ignored.`);
    }
    if (!total) throw new Error("the sheet has no QUESTION rows.");
    out.sections.forEach((s) => { if (window.QuizRich && QuizRich.ensureUnits) QuizRich.ensureUnits(s); });
    return out;
  }
  /** CSV (UTF-8 or Excel's Shift-JIS) or Excel file -> array of rows. */
  async function readSheetFile(file) {
    if (!window.XLSX) throw new Error("the spreadsheet reader isn't loaded.");
    const buf = await file.arrayBuffer();
    let wb;
    if (/\.csv$/i.test(file.name)) {
      let t; try { t = new TextDecoder("utf-8", { fatal: true }).decode(buf); } catch (e) { t = new TextDecoder("shift_jis").decode(buf); }
      wb = XLSX.read(t.replace(/^﻿/, ""), { type: "string" });
    } else wb = XLSX.read(buf, { type: "array" });
    return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: "" });
  }
  function pickSheet(onRows) {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".csv,.xlsx,.xls"; inp.style.display = "none";
    inp.addEventListener("change", async () => {
      const f = inp.files[0]; inp.remove(); if (!f) return;
      try { onRows(parseSheet(await readSheetFile(f)), f); } catch (e) { alert(`Couldn't read that file: ${e.message}`); }
    });
    document.body.appendChild(inp); inp.click();
  }
  const sheetSummary = (p) => `Created “${p.name}” with ${p.sections.reduce((a, s) => a + s.questions.length, 0)} question(s) in ${p.sections.length} section(s).` + (p.warnings.length ? `\n\nCheck these:\n• ${p.warnings.slice(0, 12).join("\n• ")}${p.warnings.length > 12 ? `\n• …and ${p.warnings.length - 12} more` : ""}` : "");
  function exampleDownload(kind) {
    const quiz = { kind, settings: { labelStyle: "upper", defaultOptions: 4, timeLimit: 0, attemptsAllowed: 1 }, sections: [{ id: "s", title: "", questions: [], notes: [] }] };
    rawCsv(`quiz template - ${KIND_NAME[kind] || "Quiz"}.csv`, sheetRows(quiz, ""));
  }
  window.QuizSheet = { rows: sheetRows, parse: parseSheet, pick: pickSheet, summary: sheetSummary, example: exampleDownload, download: (name, rows, fmt) => window.QuizExport.download(name, rows, fmt) };
  function exportTemplate(test, quiz) { downloadCsv(safeName(test.name, "template"), sheetRows(quiz, test.name)); }

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
      const kinds = [["Questions & answer key", exportQuestions], ["Quiz template (to fill in and upload)", exportTemplate]];
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
      nameTd.appendChild(deleteAttemptBtn(tool, container, test, quiz, s));
      tr.append(nameTd, h("td", "", String(s.attempt)));
      qs.forEach((x) => tr.appendChild(h("td", "", optionText(quiz, x.q, eff[x.q.id]))));
      tbody.appendChild(tr);
    });
    table.appendChild(tbody);
    wrap.appendChild(table);
    body.appendChild(wrap);
  }

  // ---------- the results view: a read-only grid of ● / ✕ ----------
  const resultSort = new Map(); // testId -> { key: "name"|"attempt"|"time"|"score"|"q:<n>", dir: 1|-1 } (this visit only)
  function renderResults(tool, container, testId) {
    const test = ScoringModule.findTest(tool.id, testId);
    const quiz = ScoringModule.quizOf(tool.id, testId);
    if (isSurveyKind(quiz.kind)) return renderSurveyResults(tool, container, test, quiz);
    if (resultMode.get(testId) === "edit") return renderReview(tool, container, testId);
    const style = quiz.settings.labelStyle;
    container.innerHTML = "";
    container.appendChild(editorHeader(tool, container, test, quiz, "results"));
    container.appendChild(modeBar(tool, container, test, quiz));

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
    body.appendChild(h("p", "hint", "Click a column heading (Student, Attempt, Time, Score or a question) to sort. Hover over a symbol to see the student's answer. To change an answer, fix the answer key or combine entries, switch to Edit mode above."));

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
    const sort = resultSort.get(testId) || { key: "name", dir: 1 };
    const sortable = (th, key, label) => {
      th.style.cursor = "pointer";
      th.title = "Click to sort; click again to reverse";
      th.textContent = label + (sort.key === key ? (sort.dir === 1 ? " ▲" : " ▼") : "");
      th.addEventListener("click", () => {
        resultSort.set(testId, { key, dir: sort.key === key ? -sort.dir : 1 });
        renderScoringToolView(tool, container);
      });
    };
    [["name", "Student"], ["attempt", "Attempt"], ["time", "Time"], ["score", "Score"]].forEach(([key, label]) => {
      const th = h("th");
      th.rowSpan = 2;
      sortable(th, key, label);
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
        const qlab = h("div");
        sortable(qlab, "q:" + (num - 1), `Q${num}`);
        qth.style.cursor = "pointer";
        qth.title = "Click to sort by this question (correct answers first, then click again for incorrect first)";
        qth.addEventListener("click", () => qlab.click());
        qlab.addEventListener("click", (e) => e.stopPropagation());
        qth.appendChild(qlab);
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
    const scoreOf = new Map(quiz.submissions.map((x) => [x, ScoringModule.gradeQuizSubmission(quiz, ScoringModule.quizEffectiveAnswers(x))]));
    const sortValue = (x) => {
      if (sort.key === "attempt") return x.attempt;
      if (sort.key === "time") { const t = timeOf(x); return t === null ? 0 : t; }
      if (sort.key === "score") return scoreOf.get(x);
      if (sort.key.startsWith("q:")) {
        const q = qs[Number(sort.key.slice(2))];
        const e = ScoringModule.quizEffectiveAnswers(x);
        return q ? ScoringModule.quizAnswerFraction(q, e[q.id], e["#" + q.id]) : 0;
      }
      return 0;
    };
    const ordered = [...quiz.submissions].sort((a, b) => {
      if (sort.key === "name") return sort.dir * studentOrder(a, b);
      // other columns: larger-first when sorted "▲" for score/questions is unnatural, so ▲ = smallest first, except questions (▲ = correct first)
      const d = sortValue(a) - sortValue(b);
      const flip = sort.key.startsWith("q:") ? -1 : 1;
      return d ? sort.dir * flip * d : studentOrder(a, b);
    });
    ordered.forEach((s) => {
      const eff = ScoringModule.quizEffectiveAnswers(s);
      const tr = h("tr", s.sid !== lastSid ? "qz-newstudent" : "");
      lastSid = s.sid;
      const nameTd = h("td", "", s.name || "(not on roster)");
      nameTd.appendChild(h("div", "hint", s.sid));
      nameTd.appendChild(deleteAttemptBtn(tool, container, test, quiz, s));
      tr.appendChild(nameTd);
      tr.appendChild(h("td", "", String(s.attempt)));
      const timeTd = h("td", "", fmtTime(s.at));
      timeTd.style.whiteSpace = "nowrap";
      tr.appendChild(timeTd);
      const score = h("td", "", `${scoreOf.get(s)} / ${total}`);
      score.style.cssText = "font-weight:700;white-space:nowrap;";
      tr.appendChild(score);
      qs.forEach((q, i) => {
        const ok = ScoringModule.quizAnswerFraction(q, eff[q.id], eff["#" + q.id]) === 1;
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
    ftr.appendChild(h("td"));
    const count = quiz.submissions.length;
    qs.forEach((q, i) => ftr.appendChild(h("td", "", `${Math.round((100 * correctCount[i]) / count)}%`)));
    tfoot.appendChild(ftr);
    table.appendChild(tfoot);
    const stats = statsBox(quiz);
    container.appendChild(stats.section);
    stats.draw();
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
    if (hint) hint.textContent = "Upload a CSV or Excel file of scores, or manage the quizzes, answer collections and surveys of this course (new ones are made in Class Material → Quiz Library). Collect answers from students' phones by QR code. Everything listed here can be used in Main Scores (Sources) and Progress Tracker columns.";

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
    const upload = () => QuizSheet.pick((p, f) => {
      try {
        const t = ScoringModule.addQuizTest(tool.id, p.name || f.name.replace(/\.[^.]+$/, ""), p.kind);
        Object.assign(t.quiz.settings, p.settings); t.quiz.sections = p.sections;
        ScoringModule.normalizeQuiz(t); ScoringModule.regradeQuiz(tool.id, t.id);
        editing.set(tool.id, t.id); viewOf.set(tool.id, "build");
        alert(QuizSheet.summary({ ...p, name: t.name }));
      } catch (err) { alert(`Couldn't make the quiz: ${err.message}`); return; }
      rerender();
    });
    // Quizzes are made in Class Material → Quiz Library; this tool only manages them (and feeds Main Scores).
    const btns = body.querySelector(".panel-toolbar-buttons");
    if (btns) btns.appendChild(button("Open Quiz Library", "btn btn-ghost", () => { window.showTab("classmaterial"); if (window.ClassMaterial && ClassMaterial.show) ClassMaterial.show("quiz"); }));

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
      const shareBtn = button("Add to courses…", "btn btn-ghost btn-small qz-act-share", guard(async () => {
        const msg = await QTSBank.addToCourses(courseId, tool.id, t);
        if (msg) { say(msg); rerender(); }
      }));
      const statusBtns = window.QTSBank && t.quiz ? QTSBank.statusButtons(courseId, tool.id, t, say, rerender) : [];
      if (!t.quiz) {
        const only = h("div", "qz-actions");
        only.appendChild(shareBtn);
        tr.children[5].insertBefore(only, tr.children[5].firstChild);
        return;
      }
      const quiz = ScoringModule.normalizeQuiz(t);
      const go = (view) => () => { editing.set(tool.id, t.id); if (view === "results" || view === "review") { resultMode.set(t.id, view === "review" ? "edit" : "view"); view = "results"; } viewOf.set(tool.id, view); rerender(); };
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
      group.appendChild(button(t.libId ? "Edit Questions" : "Edit this Quiz's Questions", "btn btn-primary btn-small", go("build")));
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
          { label: `Results (${students})`, onClick: go("results") },
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
      group.appendChild(button("Print", "btn btn-ghost btn-small qz-menu-btn", () => window.QuizPrint && QuizPrint.open(quiz, t.name)));
      group.appendChild(menuButton("Export CSV", "#4a5568", exportItems(t, quiz)));
      group.appendChild(shareBtn);
      statusBtns.forEach((b) => group.appendChild(b));
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
  }

  // ---------- hook into the Test & Quiz Bank view ----------
  const original = SCORING_TOOL_RENDERERS.testbank;
  SCORING_TOOL_RENDERERS.testbank = function (tool, container) {
    const testId = editing.get(tool.id);
    if (testId && ScoringModule.quizOf(tool.id, testId)) {
      const view = viewOf.get(tool.id);
      if (view === "review") { resultMode.set(testId, "edit"); return renderResults(tool, container, testId); }
      if (view === "results") return renderResults(tool, container, testId);
      return renderEditor(tool, container, testId);
    }
    editing.delete(tool.id);
    ScoringModule.testBankTests(tool.id).forEach((t) => { if (t.quiz) ScoringModule.normalizeQuiz(t); });
    original(tool, container);
    mergeBankView(tool, container);
    // The Quiz Library (js/qtsbank.js) replaces the old Shared list here: it holds every course's tests plus the Independent list.
    if (window.QTSBank && QTSBank.buildSection) { SharedTests.scope = "mine"; container.appendChild(QTSBank.buildSection(tool, container)); }
    else container.appendChild(buildSharedSection(tool, container));
  };
})();

// ===== Keep the page where it was when a screen redraws itself (editing a quiz, autosave, QR status…) =====
// The scoring screens are rebuilt from scratch after most changes, which used to throw the page back toward the top
// and drop the cursor out of the box being typed in. This remembers the scroll position and the focused box
// (and its cursor) and puts them back after the redraw.
(function keepPlace() {
  const FIELDS = "input,textarea,select,[contenteditable=true],[contenteditable='']";
  const wrap = (name) => {
    const orig = window[name];
    if (typeof orig !== "function" || orig.__kept) return;
    const f = function () {
      const y = window.scrollY;
      const root = document.querySelector(".tab-panel:not([hidden])") || document.body;
      const ae = document.activeElement;
      let rec = null;
      try {
        if (ae && ae.matches && ae.matches(FIELDS) && root.contains(ae)) {
          rec = { i: Array.prototype.indexOf.call(root.querySelectorAll(FIELDS), ae), s: ae.selectionStart, e: ae.selectionEnd, tag: ae.tagName };
        }
      } catch (err) { rec = null; }
      const r = orig.apply(this, arguments);
      const restore = () => {
        try {
          if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
          if (rec && rec.i >= 0) {
            const n = root.querySelectorAll(FIELDS)[rec.i];
            if (n && n !== document.activeElement && n.tagName === rec.tag) {
              n.focus({ preventScroll: true });
              if (rec.s != null && typeof n.setSelectionRange === "function") n.setSelectionRange(rec.s, rec.e);
              if (Math.abs(window.scrollY - y) > 2) window.scrollTo(0, y);
            }
          }
        } catch (err) { /* nothing to restore */ }
      };
      restore();
      requestAnimationFrame(restore);
      return r;
    };
    f.__kept = true;
    window[name] = f;
  };
  wrap("renderScoringToolView");
  wrap("renderScoring");
})();
