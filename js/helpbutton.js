// ===== Help: the circled "i" button next to Settings =====
// Load AFTER app.js. Opens a box with step-by-step instructions for every module, starting on the
// topic for the page you are looking at. The topic list on the left lets you read any other topic.

(function () {
  const T = []; // { id, group, title, html }
  const add = (id, group, title, html) => T.push({ id, group, title, html });

  add("start", "Start here", "Getting started", `
<p>GradingGridOnline keeps your classes in one place: a <b>roster</b>, a <b>seating chart</b>, <b>attendance</b>, <b>scoring</b> and <b>report cards</b>. Everything is saved to your own account, so you can sign in from any computer.</p>
<h4>First steps</h4>
<ol>
<li>Click <b>⚙ Settings</b> (top right) → <b>Account</b> and sign in, or create an account.</li>
<li>Back on the <b>Your courses</b> page, type a course name and click <b>+ Add Course</b>.</li>
<li>Click the course name to open it. A row of tabs appears: <b>Roster</b>, <b>Seating Chart</b>, <b>Attendance</b>, <b>Scoring</b>, <b>Report Card</b>.</li>
<li>Start with the <b>Roster</b> (add or upload your students). The other tabs all use that list.</li>
</ol>
<h4>Saving</h4>
<p><b>Autosave</b> is on by default: your changes are saved a moment after you stop editing (the small note beside the Settings button shows when it saved). Each tab also has its own <b>Save</b> button if you want to be sure. Turn autosave on or off in Settings.</p>
<h4>Good to know</h4>
<ul>
<li>The ⓘ button is on every page; it opens the help for the page you are on.</li>
<li>In tables, <b>Enter</b> moves to the box below, <b>Tab</b> moves right, and the <b>arrow keys</b> move between boxes.</li>
<li>Settings has a backup: <b>Export everything (backup)</b> downloads all your data to a file.</li>
</ul>`);

  add("courses", "Courses", "Your courses page", `
<h4>Add and open a course</h4>
<ol>
<li>Type the name in the box at the bottom of the list and click <b>+ Add Course</b>.</li>
<li>Click a course's name to open it.</li>
<li>Click <b>Save Courses &amp; Periods</b> to save the list (autosave also does this).</li>
</ol>
<h4>Buttons on each course</h4>
<ul>
<li><b>Period</b> drop-down — assigns one of the class periods you made in Settings → Periods. The period (and its time) can print on seating charts and QR windows.</li>
<li><b>↑ / ↓</b> — change the order (when <b>Order</b> is set to manual). The <b>Order</b> menu can also sort by name.</li>
<li><b>Rename</b>, <b>Duplicate</b> (copies the course and everything saved in it), <b>Delete</b>.</li>
<li><b>Archive</b> — moves a finished course to <b>Archived courses</b> (open that section below the list to <b>Restore</b> it).</li>
<li><b>Save as Template</b> — see Templates.</li>
</ul>
<h4>Templates</h4>
<p>A template keeps a course's <i>setup</i> (attendance settings, scoring categories and tools, seating layout, report card choices) with no students or scores.</p>
<ol>
<li>On a finished course click <b>Save as Template</b>.</li>
<li>In <b>Course templates</b>, click <b>Create Course</b> to start a new course with that setup.</li>
<li>Click a template's <b>Edit</b> button to change the template itself. A banner appears: <b>Save to Template</b>, <b>Save &amp; Close</b>, or <b>Close without saving</b>.</li>
</ol>`);

  add("roster", "Course tabs", "Roster", `
<p>The roster is your student list (up to 100 students). Every other tab uses it.</p>
<h4>Add students</h4>
<ul>
<li><b>Upload CSV / Excel</b> — choose a file, then tell the app which column is the name, School ID, etc. in the <b>Match your file's columns</b> step, then click <b>Import</b>. Importing <i>replaces</i> the current roster (notes and special-needs checks are kept for students whose names match).</li>
<li><b>+ Add Student</b> — adds one blank row to type in.</li>
</ul>
<h4>The columns</h4>
<ul>
<li><b>Class #</b> — a roll-call number (1–100) that stays with the student. It must be unique.</li>
<li><b>Name</b>, <b>Pronunciation</b>, <b>School ID</b>, <b>Email Address</b>.</li>
<li><b>Remove</b> — deletes the student.</li>
<li><b>Special Needs</b> — a checkbox; checked students can be listed on the printed seating chart.</li>
<li><b>Notes</b> — a box that grows while you type.</li>
</ul>
<h4>Collect Email Addresses</h4>
<ol>
<li>Click <b>Collect Email Addresses</b> — a QR code window opens.</li>
<li>Students scan it with their phones, enter their School ID, then their email address.</li>
<li>Click <b>Sync Emails</b> to bring the answers into the roster. <b>Show QR Code</b> reopens the code; <b>Delete Form</b> closes it.</li>
</ol>
<p>Click <b>Save Roster</b> when you finish (autosave also saves).</p>`);

  add("seating", "Course tabs", "Seating Chart", `
<h4>Set up the room</h4>
<ol>
<li>Click <b>Set Up Desks</b>. A small grid appears (top = back of the room, bottom = front).</li>
<li><b>Drag</b> across blank spaces to add desks; <b>drag across empty desks</b> to remove them; <b>click</b> one spot to add or remove a single desk. A desk with a student in it is never removed.</li>
<li>The chart's size follows the desks you draw. Click <b>Set Up Desks</b> again to close the grid.</li>
<li>The <b>▾</b> on the button has <b>Trim Unused Desks</b>: it deletes rows and columns that have no seated students.</li>
</ol>
<h4>Seat students</h4>
<ul>
<li><b>By hand:</b> click a student in the <b>Unseated</b> list, then click a desk. Click a seated desk to send the student back to the list.</li>
<li><b>Auto-Fill</b> — seats everyone who has no desk at random. Excluded students are skipped, and if there are spare desks they are at the back.</li>
<li>The <b>▾</b> on Auto-Fill has <b>Numerical Order — Columns</b> / <b>Rows</b> (by Class #, starting at the bottom-left desk) and <b>Keep Students Apart…</b>.</li>
</ul>
<h4>Keep Students Apart</h4>
<ol>
<li>Choose <b>Keep Students Apart…</b>, click <b>+ Add pair</b>, and pick student 1 and student 2.</li>
<li>Auto-Fill will always leave at least one empty desk between them (also diagonally). A student can be in several pairs — A↔B, A↔C and B↔C keep three students apart.</li>
<li>Auto-Fill also avoids seating the same neighbors together again until every combination has been used. <b>Reset…memory</b> forgets the history. Click <b>Done</b> to close the box.</li>
</ol>
<h4>On each desk</h4>
<ul>
<li><b>locked / unlocked</b> — a locked desk is protected from Clear Seating and Auto-Fill.</li>
<li><b>grp</b> — a group number (colors the desk).</li>
<li><b>label</b> — click to choose a label (e.g. “Do not sit here”). Labelled desks are skipped by Auto-Fill.</li>
</ul>
<h4>Other buttons</h4>
<ul>
<li><b>Clear Seating</b> — unseats everyone except locked desks.</li>
<li><b>Pop Out ↗</b> — a second window of the chart (for a projector); <b>Hide Group Colors in Pop-Out</b> switches group colors off there.</li>
<li><b>Print</b> — prints the chart on one landscape page.</li>
<li><b>Save Seating Chart</b> — saves the chart (autosave does too).</li>
</ul>
<h4>Memory Banks</h4>
<p>Each bank stores one whole arrangement. <b>Save</b> puts the current chart in a bank, <b>Load</b> brings it back (students excluded since then are taken off their desks and return to them when re-included), <b>Delete</b> empties it.</p>
<h4>Group Assignments</h4>
<p>Lists every seated student by group. Use the <b>Group N</b> buttons above the table to copy that group's email addresses (separated by commas) for pasting into OneDrive or an email. The <b>Copy</b> button on a row copies one student's address.</p>
<h4>Seating Settings (click Edit Settings)</h4>
<ul>
<li><b>Printed seating chart</b> — a small page diagram with 9 sections. Click a section to choose what prints there: Class Information, Lesson Content, Homework, Date of Lesson, Recorded, Students Excluded from Seating, Students with Special Needs, Future Use, or Nothing. Sections 1–3 are at the top (1 left, 2 middle, 3 right); 4–9 are below “Front of Classroom”. The % box makes a section wider or narrower relative to the others. A student-list section (excluded / special needs) with nobody in it prints nothing in sections 1–3, but in sections 4–9 it still prints its label and outline.</li>
<li><b>Label bank</b> — the labels you can put on a desk. Add or remove them here.</li>
</ul>
<p>To keep a student out of the chart, use the <b>Seating</b> toggle beside their name on the Attendance tab.</p>`);

  add("attendance", "Course tabs", "Attendance", `
<h4>Two views</h4>
<ul>
<li><b>Table</b> — one row per student, one column per class session. For each box pick a participation code, an infraction if any, and type a memo.</li>
<li><b>Seating Grid</b> — your seating chart, with a card on each desk. Choose the <b>Class</b> and <b>Date</b> at the top, then mark each card. <b>Mark all present (P)</b> does everyone at once.</li>
</ul>
<h4>Seating Grid details</h4>
<ul>
<li>When you record attendance, the desk arrangement used is saved with that class. The <b>As recorded / Current</b> toggle shows either that class's arrangement or today's chart.</li>
<li>A desk turns <b>orange</b> when a student reaches the absence limit and <b>red</b> when over it.</li>
<li>Students not at a desk appear under <b>Not seated</b> or <b>Excluded Students</b>, so they can still be marked.</li>
<li><b>Export to LMS</b> downloads this class's attendance as a CSV, using the template you set up in the settings below.</li>
</ul>
<h4>Per student buttons</h4>
<p>The <b>Seating</b> and <b>Scoring</b> toggles next to a student exclude them from the seating chart or from scoring (click again to include them).</p>
<h4>Attendance Settings (click Edit Settings)</h4>
<ul>
<li><b>Number of classes in this term</b> — how many session columns appear.</li>
<li><b>Absence warning limit</b> — the count that turns orange (red beyond it).</li>
<li><b>Participation types</b> — the codes you can pick (P and A are fixed; L and E are the starting extras), the points each is worth, and whether it counts as attended or absent.</li>
<li><b>Infractions</b> — your list (e.g. Sleeping, Phone use) and the points each takes off.</li>
<li><b>LMS export template</b> — which columns your school system expects, in what order.</li>
</ul>
<p>Click <b>Save Attendance</b> when you finish (autosave also saves).</p>`);

  add("scoring", "Scoring", "Scoring — overview", `
<p>The Scoring tab has a large <b>Main Scores</b> button and a row of <b>scoring tools</b> beside it. Tools collect scores in their own way; Main Scores brings everything together into each student's grade.</p>
<h4>Set up (Scoring Settings → Edit Settings)</h4>
<ol>
<li><b>Categories</b> — add categories (e.g. Homework, Tests). Each has items; a category's weight is the sum of its items.</li>
<li>Add the <b>items</b> inside each category and give each a point value.</li>
<li><b>Scoring tools</b> — add a <b>Progress Tracker</b>, <b>Presentation Calc</b> or <b>Test &amp; Quiz Bank</b>. Each appears as a tab.</li>
</ol>
<p>Click <b>Save Scoring</b> when you finish (autosave also saves).</p>`);

  add("mainscores", "Scoring", "Main Scores", `
<p>The big table of every student and every scoring item, plus attendance.</p>
<ul>
<li>Type scores straight into the boxes, or let an item pull its score from a tool.</li>
<li><b>Sources</b> — on an item, open its Sources panel to choose where its score comes from: a Progress Tracker (its Total Score, or a single column — see below), a Presentation Calc project, or a test/quiz from the Test &amp; Quiz Bank. Each source has a weight.</li>
<li>Totals and weighted scores update as you type.</li>
<li>Use <b>Scoring Settings → Edit Settings</b> to add categories, items, weights and tools.</li>
</ul>`);

  add("tracker", "Scoring", "Progress Tracker", `
<p>A simple grid for ongoing work (homework, tasks…). A <b>Total Score</b> column is always added at the end.</p>
<h4>Set up (Edit Settings inside the tool)</h4>
<ul>
<li><b>First column</b> — rows are <b>Students</b> or <b>Groups</b>.</li>
<li><b>Columns</b> — how many, and each one's name, type and maximum score.</li>
<li><b>Sub-rows</b> — optional extra lines under every student/group.</li>
</ul>
<h4>Using it</h4>
<ul>
<li>Type scores into the boxes. The <b>Scoring ◯ Choose boxes</b> switch (in Edit Settings) lets you switch off boxes that don't apply to someone (switch back to Scoring to type).</li>
<li><b>Total Score ◯ Columns</b> switch (in Edit Settings) — decides whether Main Scores uses each row's total or lets an item pick one single column (choose it in that item's Sources).</li>
<li><b>Assign Multiple Scores</b> — tick the <b>Columns</b> and the <b>Rows</b> (or sub-rows) to fill, then click the button: everyone gets the column's maximum score in those boxes. If the tracker has sub-rows, only sub-rows are offered. Columns with no maximum use the box “Score for columns without a maximum”.</li>
</ul>`);

  add("presentation", "Scoring", "Presentation Calc", `
<p>Scores group presentations from several sources and combines them. A tool holds one or more <b>projects</b>; each project has four sub-tabs.</p>
<ul>
<li><b>Student Groups</b> — import the groups from your seating chart (it uses the group numbers on the desks).</li>
<li><b>Rubrics</b> — activate <b>Teacher</b>, <b>Audience</b> and <b>Peer</b> rubrics by choosing them from the <b>Rubric Bank</b>. The bank is shared by every project and course; use <b>+ Add Section</b> to organise it. Expand or collapse a section — collapsed sections are hidden from the drop-down lists, which keeps them short. Each rubric has a <b>Section</b> menu and ▲ ▼ arrows to move it.</li>
<li><b>QR Forms</b> — add a data set for each form (Teacher, Audience, Peer Evaluation), then click <b>Launch New QR Code</b> on its row. Students scan with their phones. <b>Show QR Code</b> reshows it, <b>Get Responses</b> collects answers, and the data set you pick is the one used.</li>
<li><b>Scores</b> — the grid of scores per group. The <b>Weight</b> row sets how much each rubric counts (percentages adding to 100); the Total Score column adds them up.</li>
</ul>
<p>You can also email each student or group a PDF report from this tool.</p>`);

  add("testbank", "Scoring", "Test & Quiz Bank", `
<h4>Add a test or quiz</h4>
<ul>
<li><b>Upload scores</b> — upload a CSV or Excel file of scores, say which row is the header and which columns hold names / School IDs / scores. Students are matched to the roster.</li>
<li><b>+ New Quiz</b> — questions with text, scored by points (multiple choice and fill-in-the-blank, in sections).</li>
<li><b>+ New Answer Collection</b> — the same, but each question is just a number and options, to match a paper test sheet.</li>
<li><b>+ New Survey</b> — like a quiz but with no points and no correct answers.</li>
</ul>
<h4>Quiz editor (Edit Questions)</h4>
<ol>
<li>Open <b>settings</b>: option label style (A, a, 1, I…), number of options, <b>time limit</b>, <b>attempts</b> allowed and which attempt counts.</li>
<li>In each section add questions: <b>+ Multiple choice</b> or <b>+ Fill in the blank</b>. Set points, the correct answer, and alternate accepted answers for blanks. <b>Duplicate</b> copies a question.</li>
<li>The maximum score is the total of the question points.</li>
</ol>
<h4>Collecting answers (QR Code ▾ menu)</h4>
<ol>
<li><b>Launch QR Code</b> — students scan, enter their School ID, and answer on their phones (a timer shows if you set one).</li>
<li><b>Get Responses</b> — brings answers in and grades them. <b>Close QR Code</b> ends it (get responses first).</li>
</ol>
<h4>Results</h4>
<ul>
<li><b>Show Results</b> — a grid with ● correct and ✕ incorrect (surveys show a summary of every answer).</li>
<li><b>Review Results</b> — change a student's answer or fix an answer key, and scores recalculate.</li>
<li><b>Export CSV ▾</b> — Responses, Scores per question, or Question summary, opened in Excel.</li>
</ul>
<h4>Sharing</h4>
<p><b>Copy to Shared</b> puts a copy (without students) on the Shared Tests &amp; Quizzes list, visible from every course. There, <b>Add to this course</b> copies it in. Group items with <b>+ Add Section</b>, collapse sections, move items with the <b>Section</b> menu and ▲ ▼ arrows.</p>`);

  add("reportcard", "Course tabs", "Report Card", `
<h4>Student Consultation</h4>
<p>Choose a student from the list to see everything about them in one place: attendance details, scores and notes. Handy for a one-to-one meeting.</p>
<h4>Report Card</h4>
<ol>
<li><b>Items to include</b> — tick the scoring items that should appear (<b>Select All</b> / <b>Select None</b>), then <b>Save Selection</b>.</li>
<li>Choose a student and click <b>Print This Student</b>, or click <b>Print All Students</b> for the whole class.</li>
<li>Use the <b>Email report cards</b> section to email each student their own report; the subject and message can use {name}, {course} and similar words that fill in automatically.</li>
</ol>`);

  add("settings", "Settings", "Global Settings", `
<ul>
<li><b>Account</b> — sign in / out. After signing in you can <b>Show password</b>, <b>Change password</b>, and on the login screen use <b>Forgot password?</b> to get a reset email.</li>
<li><b>Autosave</b> — turn on or off.</li>
<li><b>Theme</b> — pick a color theme, including a Dark theme. <b>Text size</b> makes everything larger or smaller.</li>
<li><b>QR code colors</b> — how the pop-up QR windows look: match the theme, bright, or dark.</li>
<li><b>Your data</b> — <b>Export everything (backup)</b> saves all your data to a file; <b>Import from Google Drive</b> brings in old courses (one time).</li>
<li><b>Periods</b> — your class periods. Click <b>+ Add Period</b>, type a name and start / end times (like 9:00 and 10:30), then <b>Save Periods</b>. Courses can then be assigned a period.</li>
</ul>
<p>Click <b>← Back</b> to return.</p>`);

  const ORDER = ["Start here", "Courses", "Course tabs", "Scoring", "Settings"];
  T.sort((x, y) => ORDER.indexOf(x.group) - ORDER.indexOf(y.group));

  const FALLBACK = "start";

  // ---------- the button ----------
  const css = document.createElement("style");
  css.textContent = `
#help-btn { width:28px; height:28px; padding:0; border-radius:50%; border:2px solid currentColor; background:transparent; color:inherit; font:700 15px/1 Georgia, serif; font-style:italic; cursor:pointer; margin-right:8px; vertical-align:middle; }
#help-btn:hover { background:color-mix(in srgb, var(--green) 25%, transparent); }
#help-overlay { position:fixed; inset:0; z-index:20000; background:rgba(0,0,0,.55); display:flex; align-items:center; justify-content:center; padding:16px; }
#help-overlay[hidden] { display:none; }
#help-box { background:var(--card, #fff); color:var(--ink, #222); width:min(980px, 100%); height:min(760px, 100%); border-radius:10px; border:2px solid var(--green); display:flex; flex-direction:column; overflow:hidden; box-shadow:0 12px 40px rgba(0,0,0,.5); }
#help-box header { display:flex; align-items:center; gap:10px; padding:10px 14px; background:var(--hdr-bg, #3d5a40); color:#fff; }
#help-box header h2 { margin:0; font-size:1.1rem; flex:1; color:inherit; }
#help-box header .btn { color:#fff; border-color:rgba(255,255,255,.6); background:transparent; }
#help-main { flex:1; display:flex; min-height:0; }
#help-nav { width:230px; flex:none; overflow-y:auto; padding:8px; border-right:1px solid var(--line); }
#help-nav .help-group { font-size:.72rem; text-transform:uppercase; letter-spacing:.05em; color:var(--ink-soft); margin:10px 6px 3px; }
#help-nav button { display:block; width:100%; text-align:left; border:0; background:transparent; color:inherit; padding:6px 8px; border-radius:5px; cursor:pointer; font:inherit; font-size:.92rem; }
#help-nav button:hover { background:color-mix(in srgb, var(--green) 14%, transparent); }
#help-nav button.on { background:color-mix(in srgb, var(--green) 30%, transparent); font-weight:700; }
#help-content { flex:1; overflow-y:auto; padding:14px 20px 24px; line-height:1.5; }
#help-content h3 { margin:0 0 6px; font-size:1.3rem; }
#help-content h4 { margin:16px 0 4px; }
#help-content ul, #help-content ol { padding-left:22px; margin:4px 0 8px; }
#help-content li { margin:3px 0; }
#help-content .help-here { font-size:.82rem; color:var(--ink-soft); margin:0 0 10px; }
@media (max-width: 640px) { #help-main { flex-direction:column; } #help-nav { width:auto; max-height:34%; border-right:0; border-bottom:1px solid var(--line); } }
`;
  document.head.appendChild(css);

  const overlay = document.createElement("div");
  overlay.id = "help-overlay";
  overlay.hidden = true;
  const box = document.createElement("div");
  box.id = "help-box";
  box.setAttribute("role", "dialog");
  box.setAttribute("aria-modal", "true");
  box.setAttribute("aria-label", "Help");
  const head = document.createElement("header");
  const title = document.createElement("h2");
  title.textContent = "How to use GradingGridOnline";
  const closeBtn = document.createElement("button");
  closeBtn.type = "button";
  closeBtn.className = "btn btn-small";
  closeBtn.textContent = "Close ✕";
  head.append(title, closeBtn);
  const main = document.createElement("div");
  main.id = "help-main";
  const nav = document.createElement("nav");
  nav.id = "help-nav";
  const content = document.createElement("div");
  content.id = "help-content";
  main.append(nav, content);
  box.append(head, main);
  overlay.appendChild(box);
  document.body.appendChild(overlay);

  let currentId = FALLBACK;
  function show(id, here) {
    currentId = id;
    const t = T.find((x) => x.id === id) || T[0];
    content.textContent = "";
    if (here) {
      const p = document.createElement("p");
      p.className = "help-here";
      p.textContent = "Showing help for the page you are on. Pick any other topic on the left.";
      content.appendChild(p);
    }
    const h = document.createElement("h3");
    h.textContent = t.title;
    content.appendChild(h);
    const body = document.createElement("div");
    body.innerHTML = t.html; // our own fixed text
    content.appendChild(body);
    content.scrollTop = 0;
    nav.querySelectorAll("button").forEach((b) => b.classList.toggle("on", b.dataset.id === t.id));
  }
  (function buildNav() {
    let last = "";
    T.forEach((t) => {
      if (t.group !== last) {
        const g = document.createElement("div");
        g.className = "help-group";
        g.textContent = t.group;
        nav.appendChild(g);
        last = t.group;
      }
      const b = document.createElement("button");
      b.type = "button";
      b.dataset.id = t.id;
      b.textContent = t.title;
      b.addEventListener("click", () => show(t.id, false));
      nav.appendChild(b);
    });
  })();

  // ---------- which page am I on? ----------
  const visible = (id) => {
    const e = document.getElementById(id);
    return !!e && !e.hidden && e.offsetParent !== null;
  };
  function topicHere() {
    if (visible("settings-section")) return "settings";
    if (visible("course-detail-section")) {
      if (visible("roster-panel")) return "roster";
      if (visible("seating-panel")) return "seating";
      if (visible("attendance-panel")) return "attendance";
      if (visible("reportcard-panel")) return "reportcard";
      if (visible("scoring-panel")) {
        const mainBtn = document.getElementById("scoring-mode-entry-btn");
        if (mainBtn && mainBtn.classList.contains("tab-btn-active")) return "mainscores";
        const panel = document.getElementById("scoring-panel");
        if (panel.querySelector(".qz-sec-list, .qz-sec-shared")) return "testbank";
        if (panel.querySelector(".tracker-fullcredit, .tracker-mode-row")) return "tracker";
        if (panel.querySelector(".level4-row, .rubric-bank-block")) return "presentation";
        return "scoring";
      }
    }
    if (visible("course-section")) return "courses";
    return FALLBACK;
  }

  let lastFocus = null;
  function open() {
    lastFocus = document.activeElement;
    show(topicHere(), true);
    overlay.hidden = false;
    closeBtn.focus();
  }
  function close() {
    overlay.hidden = true;
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  closeBtn.addEventListener("click", close);
  overlay.addEventListener("mousedown", (e) => { if (e.target === overlay) close(); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !overlay.hidden) close(); });

  const btn = document.createElement("button");
  btn.id = "help-btn";
  btn.type = "button";
  btn.textContent = "i";
  btn.title = "How to use this page";
  btn.setAttribute("aria-label", "Help: how to use this page");
  btn.addEventListener("click", open);
  const settings = document.getElementById("settings-btn");
  if (settings && settings.parentNode) settings.parentNode.insertBefore(btn, settings);
  else document.body.appendChild(btn);
})();
