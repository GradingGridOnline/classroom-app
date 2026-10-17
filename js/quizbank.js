// ===== Quiz editor + QR answer form for the Test & Quiz Bank =====
// Load AFTER app.js. A quiz is a normal test in the bank (so Sources / Progress Tracker
// pulling keep working) with an extra `quiz` field:
//   quiz: { sections: [{ id, title, questions: [{ id, type: "mc"|"blank", text, points,
//           choices: [..], correct: index, accepted: [..] }] }],
//           token (open QR form or null), submissions: [{ sid, name, answers, at }] }
// The answer key stays in this app; the server only gets questions + who may answer.
// "Get Responses" pulls answers, grades them here, and fills the test's scores.

(function () {
  const newId = (p) => `${p}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const MAX_QUESTIONS = 200;
  const r2 = (n) => Math.round(n * 100) / 100;
  const editing = new Map(); // toolId -> testId being edited
  const statusMsg = new Map(); // toolId|testId -> text

  // ---------- data + grading ----------
  Object.assign(ScoringModule, {
    normalizeQuiz(test) {
      const q = test && test.quiz;
      if (!q) return null;
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
    addQuizTest(toolId, name) {
      const cfg = this.getTestBankConfig(toolId);
      if (!cfg) throw new Error("That Test & Quiz Bank no longer exists.");
      if (cfg.tests.length >= MAX_TESTS_PER_BANK) throw new Error(`This bank is at its limit of ${MAX_TESTS_PER_BANK} tests/quizzes.`);
      const test = {
        id: newId("test"), name: (name || "").trim() || "Untitled quiz", maxPoints: 0, sourceFile: "Quiz editor",
        rows: [], scores: {}, unmatched: [],
        quiz: { sections: [{ id: newId("sec"), title: "Section 1", questions: [] }], token: null, submissions: [] },
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
        choices: type === "mc" ? ["", "", "", ""] : [], correct: 0, accepted: [],
      });
    },
    /** Points earned for one answer. MC: chosen index must equal the key. Blank: matches any accepted answer (spacing/case/full-width ignored; numbers compare as numbers). */
    gradeQuizQuestion(q, ans) {
      if (ans === undefined || ans === null || ans === "") return 0;
      if (q.type === "mc") return Number(ans) === q.correct ? q.points : 0;
      const a = this._matchKey(ans);
      const hit = q.accepted.some((acc) => {
        const k = this._matchKey(acc);
        if (!k || !a) return false;
        if (k === a) return true;
        return !Number.isNaN(Number(k)) && !Number.isNaN(Number(a)) && Number(k) === Number(a);
      });
      return hit ? q.points : 0;
    },
    gradeQuizSubmission(quiz, answers) {
      let sum = 0;
      quiz.sections.forEach((s) => s.questions.forEach((x) => (sum += this.gradeQuizQuestion(x, (answers || {})[x.id]))));
      return r2(sum);
    },
    /** Rebuilds the test's scores from the stored submissions (use after changing the answer key). */
    regradeQuiz(toolId, testId) {
      const test = this.findTest(toolId, testId);
      const quiz = this.normalizeQuiz(test);
      if (!quiz) return;
      test.maxPoints = this.quizTotal(quiz);
      test.rows = quiz.submissions.map((s) => ({ name: s.name || "", schoolId: s.sid, score: String(this.gradeQuizSubmission(quiz, s.answers)) }));
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
      if (/PGRST20[25]|42P01|42883|schema cache|does not exist|Could not find/i.test(t)) {
        return new Error("Supabase needs the quiz update. Run sql/quiz-setup.sql in Supabase (SQL Editor), then try again.");
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
      const config = {
        sections: quiz.sections.map((s) => ({
          title: s.title,
          questions: s.questions.map((x) => ({ id: x.id, type: x.type, text: x.text, points: x.points, choices: x.type === "mc" ? x.choices : undefined })),
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
    /** Re-publishes the questions/roster, copies answers, grades. Returns { responses, expected, missing }. */
    async sync(toolId, testId) {
      const quiz = ScoringModule.quizOf(toolId, testId);
      if (!quiz.token) throw new Error("This quiz's QR code is closed.");
      const { title, config, people } = this.build(toolId, testId);
      const c = this.client();
      const up = await c.from("quiz_forms").update({ title, config, people }).eq("token", quiz.token);
      if (up.error) throw this.explain(up.error);
      const { data, error } = await c.from("quiz_responses").select("respondent, payload, submitted_at").eq("token", quiz.token);
      if (error) throw this.explain(error);
      const nameOf = new Map(people.map((p) => [p.sid, p.name]));
      quiz.submissions = (data || []).map((r) => ({ sid: r.respondent, name: nameOf.get(r.respondent) || "", answers: (r.payload && r.payload.answers) || {}, at: r.submitted_at }));
      ScoringModule.regradeQuiz(toolId, testId);
      const done = new Set(quiz.submissions.map((s) => s.sid));
      return { responses: quiz.submissions.length, expected: people.length, missing: people.filter((p) => !done.has(p.sid)).map((p) => p.name || p.sid) };
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
  const splitList = (text) => String(text).split(/[,\n、，]/).map((s) => s.trim()).filter(Boolean);

  // ---------- quiz list on the bank page ----------
  function buildQuizList(tool, container) {
    const { section, body } = makePresSection("Quizzes (built in the editor)");
    const rerender = () => renderScoringToolView(tool, container);
    const note = h("p", "hint", "Build a quiz here, open a QR code, and students answer on their phones (School ID first). Answers are graded automatically; the scores appear below as a normal test you can use in Sources.");
    body.appendChild(note);
    const tests = ScoringModule.testBankTests(tool.id).filter((t) => t.quiz);
    tests.forEach((t) => {
      const quiz = ScoringModule.normalizeQuiz(t);
      const row = h("div", "panel-toolbar");
      row.appendChild(h("span", "", `${t.name} — ${ScoringModule.quizQuestionCount(quiz)} question(s), ${ScoringModule.quizTotal(quiz)} pts${quiz.token ? " · QR open" : ""}`));
      const btns = h("div", "panel-toolbar-buttons");
      btns.appendChild(button("Edit / Collect Answers", "btn btn-primary btn-small", () => { editing.set(tool.id, t.id); rerender(); }));
      row.appendChild(btns);
      body.appendChild(row);
    });
    const add = button("+ New Quiz", "btn btn-ghost", () => {
      const name = prompt("Quiz name:", `Quiz ${tests.length + 1}`);
      if (name === null) return;
      try {
        const t = ScoringModule.addQuizTest(tool.id, name);
        editing.set(tool.id, t.id);
      } catch (err) { alert(err.message); return; }
      rerender();
    });
    body.appendChild(add);
    return section;
  }

  // ---------- the editor ----------
  function renderEditor(tool, container, testId) {
    const test = ScoringModule.findTest(tool.id, testId);
    const quiz = ScoringModule.quizOf(tool.id, testId);
    container.innerHTML = "";
    const rerender = () => renderScoringToolView(tool, container);
    const key = `${tool.id}|${testId}`;

    const bar = h("div", "panel-toolbar");
    const left = h("div", "panel-toolbar-buttons");
    left.appendChild(button("← Back to bank", "btn btn-ghost", () => { editing.delete(tool.id); rerender(); }));
    left.appendChild(h("label", "", "Quiz name:"));
    left.appendChild(textInput(test.name, "", (v) => { ScoringModule.renameTest(tool.id, testId, v); rerender(); }));
    bar.appendChild(left);
    bar.appendChild(h("span", "count-badge", `${ScoringModule.quizQuestionCount(quiz)} questions · ${ScoringModule.quizTotal(quiz)} points`));
    container.appendChild(bar);

    let n = 0;
    quiz.sections.forEach((sec, si) => {
      const { section, body } = makePresSection(`Section ${si + 1}`);
      const top = h("div", "panel-toolbar");
      top.appendChild(textInput(sec.title, "Section title", (v) => { sec.title = v; ScoringModule.regradeQuiz(tool.id, testId); rerender(); }));
      const tb = h("div", "panel-toolbar-buttons");
      tb.appendChild(button("+ Multiple choice", "btn btn-ghost btn-small", () => { try { ScoringModule.addQuizQuestion(quiz, sec, "mc"); } catch (e) { alert(e.message); return; } rerender(); }));
      tb.appendChild(button("+ Fill in the blank", "btn btn-ghost btn-small", () => { try { ScoringModule.addQuizQuestion(quiz, sec, "blank"); } catch (e) { alert(e.message); return; } rerender(); }));
      if (quiz.sections.length > 1) {
        tb.appendChild(button("Delete section", "btn btn-ghost btn-small", () => {
          if (!confirm(`Delete "${sec.title}" and its ${sec.questions.length} question(s)?`)) return;
          quiz.sections.splice(si, 1);
          ScoringModule.regradeQuiz(tool.id, testId);
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
        const text = textInput(q.text, "Question text (or just the number from the test sheet)", (v) => { q.text = v; });
        text.style.flex = "1";
        text.style.maxWidth = "none";
        row.appendChild(text);
        row.appendChild(h("span", "hint", "pts"));
        row.appendChild(textInput(String(q.points), "", (v) => { q.points = Math.max(0, Number(v) || 0); ScoringModule.regradeQuiz(tool.id, testId); rerender(); }, "point-value-input"));
        row.appendChild(button("×", "btn btn-ghost btn-small", () => { sec.questions.splice(qi, 1); ScoringModule.regradeQuiz(tool.id, testId); rerender(); }));
        box.appendChild(row);

        if (q.type === "mc") {
          const area = h("textarea");
          area.rows = Math.max(3, q.choices.length);
          area.placeholder = "One choice per line (students pick A, B, C…)";
          area.value = q.choices.join("\n");
          area.addEventListener("change", () => {
            q.choices = area.value.split("\n").map((s) => s.trim()).filter(Boolean);
            if (q.correct >= q.choices.length) q.correct = 0;
            ScoringModule.regradeQuiz(tool.id, testId);
            rerender();
          });
          box.appendChild(area);
          const keyRow = h("div", "mapping-row");
          keyRow.appendChild(h("label", "", "Correct answer"));
          const sel = h("select");
          q.choices.forEach((c, ci) => {
            const o = h("option", "", `${LETTERS[ci]}: ${c}`);
            o.value = String(ci);
            if (ci === q.correct) o.selected = true;
            sel.appendChild(o);
          });
          sel.addEventListener("change", () => { q.correct = Number(sel.value); ScoringModule.regradeQuiz(tool.id, testId); });
          keyRow.appendChild(sel);
          box.appendChild(keyRow);
        } else {
          const keyRow = h("div", "mapping-row");
          keyRow.appendChild(h("label", "", "Accepted answers"));
          const inp = textInput(q.accepted.join(", "), "e.g. 42, forty-two  (separate with commas; case and spacing ignored)", (v) => { q.accepted = splitList(v); ScoringModule.regradeQuiz(tool.id, testId); });
          inp.style.flex = "1";
          keyRow.appendChild(inp);
          box.appendChild(keyRow);
        }
        body.appendChild(box);
      });
      if (sec.questions.length === 0) body.appendChild(h("p", "hint", "No questions yet — use the buttons above."));
      container.appendChild(section);
    });
    container.appendChild(button("+ Add Section", "btn btn-ghost", () => { ScoringModule.addQuizSection(quiz); rerender(); }));

    // ----- QR + results -----
    const { section: qrSection, body: qrBody } = makePresSection("Student QR form & results");
    qrBody.appendChild(h("p", "hint", "Students scan, type their School ID, then pick choices / type answers. Get Responses refreshes the questions and roster, copies answers, and grades them (re-run it after changing the answer key). Close QR Code stops new answers; graded results stay."));
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
        say(`${r.responses} of ${r.expected} student(s) have answered and been graded.` + (r.missing.length ? ` Not yet: ${r.missing.slice(0, 12).join(", ")}${r.missing.length > 12 ? "…" : ""}.` : ""));
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
    bb.appendChild(button("Regrade", "btn btn-ghost", () => { ScoringModule.regradeQuiz(tool.id, testId); flush(); say("Regraded from stored answers."); rerender(); }));
    qrBody.appendChild(bb);
    qrBody.appendChild(stat);

    if (quiz.submissions.length > 0) {
      const total = ScoringModule.quizTotal(quiz);
      const table = h("table", "roster-table");
      table.innerHTML = "<thead><tr><th>Student</th><th>School ID</th><th>Score</th></tr></thead>";
      const tb = h("tbody");
      [...quiz.submissions].sort((a, b) => (a.name || a.sid).localeCompare(b.name || b.sid)).forEach((s) => {
        const tr = h("tr");
        [s.name || "(not on roster)", s.sid, `${ScoringModule.gradeQuizSubmission(quiz, s.answers)} / ${total}`].forEach((t) => tr.appendChild(h("td", "", t)));
        tb.appendChild(tr);
      });
      table.appendChild(tb);
      qrBody.appendChild(table);
    }
    container.appendChild(qrSection);
  }

  // ---------- hook into the Test & Quiz Bank view ----------
  const original = SCORING_TOOL_RENDERERS.testbank;
  SCORING_TOOL_RENDERERS.testbank = function (tool, container) {
    const testId = editing.get(tool.id);
    if (testId && ScoringModule.quizOf(tool.id, testId)) return renderEditor(tool, container, testId);
    editing.delete(tool.id);
    original(tool, container);
    container.insertBefore(buildQuizList(tool, container), container.children[1] || null);
  };
})();
