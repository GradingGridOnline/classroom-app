// ===== Quiz editor + QR answer form for the Test & Quiz Bank =====
// Load AFTER app.js. A quiz is a normal test in the bank (so Sources / Progress Tracker
// pulling keep working) with an extra `quiz` field:
//   quiz: { kind: "standard" | "answers",            ("answers" = Answer Collection: no question text)
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
  const r2 = (n) => Math.round(n * 100) / 100;
  const editing = new Map(); // toolId -> testId being edited
  const viewOf = new Map(); // toolId -> "build" | "review"
  const statusMsg = new Map(); // toolId|testId -> text

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
      if (q.kind !== "answers") q.kind = "standard";
      if (!q.settings || typeof q.settings !== "object") q.settings = {};
      const st = q.settings;
      if (!LABEL_STYLES.some(([id]) => id === st.labelStyle)) st.labelStyle = "upper";
      st.defaultOptions = Math.max(2, Math.min(MAX_OPTIONS, Math.round(Number(st.defaultOptions) || 4)));
      st.timeLimit = Math.max(0, Math.min(600, Math.round(Number(st.timeLimit) || 0)));
      const att = Number(st.attemptsAllowed);
      st.attemptsAllowed = Number.isFinite(att) && att >= 0 ? Math.min(99, Math.round(att)) : 1;
      if (!["best", "latest", "first"].includes(st.attemptRule)) st.attemptRule = "best";
      if (!Array.isArray(q.sections)) q.sections = [];
      if (!Array.isArray(q.submissions)) q.submissions = [];
      if (typeof q.token !== "string") q.token = null;
      q.sections.forEach((s) => {
        if (!Array.isArray(s.questions)) s.questions = [];
        s.questions.forEach((x) => {
          if (!Array.isArray(x.choices)) x.choices = [];
          if (!Array.isArray(x.accepted)) x.accepted = [];
          x.points = Number(x.points) || 0;
          if (typeof x.correct !== "number") x.correct = 0;
        });
      });
      q.submissions.forEach((s) => {
        if (!s.answers || typeof s.answers !== "object") s.answers = {};
        if (!s.overrides || typeof s.overrides !== "object") s.overrides = {};
        s.attempt = Number(s.attempt) || 1;
      });
      return q;
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
          kind: kind === "answers" ? "answers" : "standard",
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
        choices: type === "mc" ? Array(quiz.settings.defaultOptions).fill("") : [], correct: 0, accepted: type === "blank" ? [""] : [],
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
    },
    /** A student's answers after the teacher's edits. */
    quizEffectiveAnswers(s) {
      return { ...(s.answers || {}), ...(s.overrides || {}) };
    },
    /** Is this answer correct? MC: chosen index equals the key. Blank: matches any accepted answer (spacing/case/full-width ignored; numbers compare as numbers). */
    quizAnswerCorrect(q, ans) {
      if (ans === undefined || ans === null || ans === "") return false;
      if (q.type === "mc") return Number(ans) === q.correct;
      const a = this._matchKey(ans);
      return q.accepted.some((acc) => {
        const k = this._matchKey(acc);
        if (!k || !a) return false;
        if (k === a) return true;
        return !Number.isNaN(Number(k)) && !Number.isNaN(Number(a)) && Number(k) === Number(a);
      });
    },
    gradeQuizQuestion(q, ans) {
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
        kind: quiz.kind,
        labelStyle: quiz.settings.labelStyle,
        timeLimit: quiz.settings.timeLimit,
        maxAttempts: quiz.settings.attemptsAllowed,
        sections: quiz.sections.map((s) => ({
          title: s.title,
          questions: s.questions.map((x) => ({
            id: x.id, type: x.type, text: answersOnly ? "" : x.text, points: x.points,
            choices: x.type === "mc" ? (answersOnly ? x.choices.map(() => "") : x.choices) : undefined,
          })),
        })),
      };
      return { title: test.name, config, people };
    },
    async create(toolId, testId) {
      const quiz = ScoringModule.quizOf(toolId, testId);
      const { title, config, people } = this.build(toolId, testId);
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
  const kindName = (quiz) => (quiz.kind === "answers" ? "Answer Collection" : "Quiz");

  // ---------- quiz list on the bank page ----------
  function buildQuizList(tool, container) {
    const { section, body } = makePresSection("Quizzes & Answer Collections (built in the editor)");
    const rerender = () => renderScoringToolView(tool, container);
    body.appendChild(h("p", "hint", "Build a quiz (questions with text) or an Answer Collection (just question numbers and answer options, to match a paper test sheet). Open a QR code and students answer on their phones (School ID first). Answers are graded automatically; scores appear below as a normal test you can use in Sources."));
    const tests = ScoringModule.testBankTests(tool.id).filter((t) => t.quiz);
    tests.forEach((t) => {
      const quiz = ScoringModule.normalizeQuiz(t);
      const row = h("div", "panel-toolbar");
      row.appendChild(h("span", "", `${t.name} (${kindName(quiz)}) — ${ScoringModule.quizQuestionCount(quiz)} question(s), ${ScoringModule.quizTotal(quiz)} pts${quiz.token ? " · QR open" : ""}`));
      const btns = h("div", "panel-toolbar-buttons");
      btns.appendChild(button("Edit / Collect Answers", "btn btn-primary btn-small", () => { editing.set(tool.id, t.id); viewOf.set(tool.id, "build"); rerender(); }));
      row.appendChild(btns);
      body.appendChild(row);
    });
    const create = (kind, label) => () => {
      const name = prompt(`${label} name:`, `${label} ${tests.length + 1}`);
      if (name === null) return;
      try {
        const t = ScoringModule.addQuizTest(tool.id, name, kind);
        editing.set(tool.id, t.id);
        viewOf.set(tool.id, "build");
      } catch (err) { alert(err.message); return; }
      rerender();
    };
    const bar = h("div", "panel-toolbar-buttons");
    bar.appendChild(button("+ New Quiz", "btn btn-ghost", create("standard", "Quiz")));
    bar.appendChild(button("+ New Answer Collection", "btn btn-ghost", create("answers", "Answer Collection")));
    body.appendChild(bar);
    return section;
  }

  // ---------- shared editor header ----------
  function editorHeader(tool, container, test, quiz, current) {
    const rerender = () => renderScoringToolView(tool, container);
    const bar = h("div", "panel-toolbar");
    const left = h("div", "panel-toolbar-buttons");
    left.appendChild(button("← Back to bank", "btn btn-ghost", () => { editing.delete(tool.id); rerender(); }));
    left.appendChild(h("label", "", `${kindName(quiz)} name:`));
    left.appendChild(textInput(test.name, "", (v) => { ScoringModule.renameTest(tool.id, test.id, v); rerender(); }));
    left.appendChild(button("Edit questions", current === "build" ? "btn btn-primary btn-small" : "btn btn-ghost btn-small", () => { viewOf.set(tool.id, "build"); rerender(); }));
    left.appendChild(button(`Review answers & regrade (${new Set(quiz.submissions.map((s) => s.sid)).size})`, current === "review" ? "btn btn-primary btn-small" : "btn btn-ghost btn-small", () => { viewOf.set(tool.id, "review"); rerender(); }));
    bar.appendChild(left);
    bar.appendChild(h("span", "count-badge", `${ScoringModule.quizQuestionCount(quiz)} questions · ${ScoringModule.quizTotal(quiz)} points`));
    return bar;
  }

  // ---------- the question editor ----------
  function renderEditor(tool, container, testId) {
    const test = ScoringModule.findTest(tool.id, testId);
    const quiz = ScoringModule.quizOf(tool.id, testId);
    const answersOnly = quiz.kind === "answers";
    const style = quiz.settings.labelStyle;
    container.innerHTML = "";
    const rerender = () => renderScoringToolView(tool, container);
    const regrade = () => ScoringModule.regradeQuiz(tool.id, testId);
    const key = `${tool.id}|${testId}`;

    container.appendChild(editorHeader(tool, container, test, quiz, "build"));

    // ----- quiz settings -----
    {
      const { section, body } = makePresSection(`${kindName(quiz)} settings`);
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
        addRow("Score that counts", rule);
      }
      body.appendChild(h("p", "hint", "The timer starts when a student enters their School ID, is shown on their screen, and their answers are submitted automatically when it runs out (late answers are refused). If the QR code is already open, click Get Responses to publish changed settings."));
      container.appendChild(section);
    }

    let n = 0;
    quiz.sections.forEach((sec, si) => {
      const { section, body } = makePresSection(`Section ${si + 1}`);
      const top = h("div", "panel-toolbar");
      top.appendChild(textInput(sec.title, "Section title", (v) => { sec.title = v; rerender(); }));
      const tb = h("div", "panel-toolbar-buttons");
      tb.appendChild(button("+ Multiple choice", "btn btn-ghost btn-small", () => { try { ScoringModule.addQuizQuestion(quiz, sec, "mc"); } catch (e) { alert(e.message); return; } rerender(); }));
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
        const box = h("div", "category-manage-item");
        box.style.marginBottom = "10px";
        const row = h("div", "category-manage-top-row");
        row.appendChild(h("strong", "", `Q${n}`));
        row.appendChild(h("span", "hint", q.type === "mc" ? "Multiple choice" : "Fill in the blank"));
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
        row.appendChild(h("span", "hint", "pts"));
        row.appendChild(textInput(String(q.points), "", (v) => { q.points = Math.max(0, Number(v) || 0); regrade(); rerender(); }, "point-value-input"));
        row.appendChild(button("Duplicate", "btn btn-ghost btn-small", () => { try { ScoringModule.duplicateQuizQuestion(quiz, sec, qi); } catch (e) { alert(e.message); return; } regrade(); rerender(); }));
        row.appendChild(button("×", "btn btn-ghost btn-small", () => { sec.questions.splice(qi, 1); regrade(); rerender(); }));
        box.appendChild(row);

        if (q.type === "mc") {
          const cnt = h("div", "mapping-row");
          cnt.appendChild(h("label", "", "Number of options"));
          cnt.appendChild(textInput(String(q.choices.length), "", (v) => { ScoringModule.setQuizChoiceCount(q, v); regrade(); rerender(); }, "point-value-input"));
          box.appendChild(cnt);
          if (!answersOnly) {
            q.choices.forEach((c, ci) => {
              const crow = h("div", "mapping-row");
              crow.appendChild(h("label", "", optionLabel(style, ci)));
              const inp = textInput(c, "Option text", (v) => { q.choices[ci] = v.trim(); rerender(); });
              inp.style.flex = "1";
              crow.appendChild(inp);
              box.appendChild(crow);
            });
          }
          const keyRow = h("div", "mapping-row");
          keyRow.appendChild(h("label", "", "Correct answer"));
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
        } else {
          if (q.accepted.length === 0) q.accepted.push("");
          q.accepted.forEach((a, ai) => {
            const arow = h("div", "mapping-row");
            arow.appendChild(h("label", "", ai === 0 ? "Correct answer" : `Alternate answer ${ai}`));
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

    // ----- QR -----
    const { section: qrSection, body: qrBody } = makePresSection("Student QR form");
    qrBody.appendChild(h("p", "hint", "Students scan, type their School ID, then pick options / type answers. Get Responses refreshes the questions, settings and roster, copies answers, and grades them. Close QR Code stops new answers; graded results stay. Look at and fix individual answers under \"Review answers & regrade\"."));
    const bb = h("div", "panel-toolbar-buttons");
    const stat = h("p", "result", statusMsg.get(key) || "");
    const say = (t) => { statusMsg.set(key, t); stat.textContent = t; };
    const guard = (fn) => async () => { try { await fn(); } catch (err) { say(`Couldn't do that: ${err.message}`); } };
    const openQr = (url) => window.open(`presqr.html?k=quiz&u=${encodeURIComponent(url)}`, "ggo-quiz-qr", "width=480,height=620");
    if (!quiz.token) {
      bb.appendChild(button("Launch QR Code", "btn btn-primary", guard(async () => {
        say("Creating QR code…");
        const url = await QuizForms.create(tool.id, testId);
        flush();
        say("QR code is open.");
        rerender();
        openQr(url);
      })));
    } else {
      bb.appendChild(button("Show QR Code", "btn btn-primary", () => openQr(QuizForms.urlFor(quiz.token))));
      bb.appendChild(button("Get Responses", "btn btn-ghost", guard(async () => {
        say("Getting responses…");
        const r = await QuizForms.sync(tool.id, testId);
        flush();
        say(`${r.responses} attempt(s) from ${r.students} of ${r.expected} student(s) collected and graded.` + (r.missing.length ? ` Not yet: ${r.missing.slice(0, 12).join(", ")}${r.missing.length > 12 ? "…" : ""}.` : ""));
        rerender();
      })));
      bb.appendChild(button("Close QR Code", "btn btn-ghost", guard(async () => {
        if (!confirm("Close the QR code? Click Get Responses first if you haven't — the server's copies of the answers are deleted on close.")) return;
        await QuizForms.close(tool.id, testId);
        flush();
        say("QR code closed. Graded results are kept.");
        rerender();
      })));
    }
    qrBody.appendChild(bb);
    qrBody.appendChild(stat);
    container.appendChild(qrSection);
  }

  // ---------- the review grid ----------
  function renderReview(tool, container, testId) {
    const test = ScoringModule.findTest(tool.id, testId);
    const quiz = ScoringModule.quizOf(tool.id, testId);
    const style = quiz.settings.labelStyle;
    container.innerHTML = "";
    const regrade = () => ScoringModule.regradeQuiz(tool.id, testId);

    container.appendChild(editorHeader(tool, container, test, quiz, "review"));
    const { section, body } = makePresSection("Review & edit answers");
    container.appendChild(section);
    body.appendChild(h("p", "hint", "● green = correct, ✕ red = incorrect. Change any student's answer in its box, or fix an answer in the \"Answer key\" row — scores update instantly. Edited answers get a yellow outline and are kept when you Get Responses again."));

    if (quiz.submissions.length === 0) {
      body.appendChild(h("p", "hint", "No answers yet. Launch the QR code on the \"Edit questions\" screen, then click Get Responses."));
      return;
    }

    const qs = [];
    quiz.sections.forEach((s) => s.questions.forEach((q) => qs.push(q)));
    const total = ScoringModule.quizTotal(quiz);
    const wrap = h("div", "attendance-table-wrap");
    const table = h("table", "attendance-table");
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
    const keyTr = h("tr");
    const keyLabel = h("td", "", "Answer key");
    keyLabel.style.fontWeight = "700";
    keyTr.appendChild(keyLabel);
    keyTr.appendChild(h("td"));
    keyTr.appendChild(h("td"));
    qs.forEach((q) => {
      const td = h("td");
      if (q.type === "mc") {
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
    const sorted = [...quiz.submissions].sort((a, b) => (a.name || a.sid).localeCompare(b.name || b.sid) || a.attempt - b.attempt);
    sorted.forEach((s) => {
      const tr = h("tr");
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
        if (q.type === "mc") {
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
        cells.push({ q, mark, cell });
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
          const ok = ScoringModule.quizAnswerCorrect(c.q, eff[c.q.id]);
          if (ok) correctCount[i]++;
          c.mark.textContent = ok ? "●" : "✕";
          c.mark.style.color = ok ? "#1e9e4a" : "#d3302f";
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

  // ---------- hook into the Test & Quiz Bank view ----------
  const original = SCORING_TOOL_RENDERERS.testbank;
  SCORING_TOOL_RENDERERS.testbank = function (tool, container) {
    const testId = editing.get(tool.id);
    if (testId && ScoringModule.quizOf(tool.id, testId)) {
      return viewOf.get(tool.id) === "review" ? renderReview(tool, container, testId) : renderEditor(tool, container, testId);
    }
    editing.delete(tool.id);
    original(tool, container);
    container.insertBefore(buildQuizList(tool, container), container.children[1] || null);
  };
})();
