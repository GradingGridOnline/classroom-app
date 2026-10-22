// ===== Printable seating chart: 9 editable sections + schematic in Seating Settings =====
// Load AFTER app.js. Sections 1-3 sit at the top of the printout (1 left, 2 middle, 3 right); sections
// 4-9 sit below "Front of Classroom". Each section shows one kind of information (or nothing).

(function () {
  const TYPES = [
    { id: "none", label: "Nothing" },
    { id: "classinfo", label: "Class Information" },
    { id: "lesson", label: "Lesson Content" },
    { id: "homework", label: "Homework" },
    { id: "date", label: "Date of Lesson" },
    { id: "recorded", label: "Recorded" },
    { id: "excluded", label: "Students Excluded from Seating" },
    { id: "special", label: "Students with Special Needs" },
    { id: "future", label: "Future Use" },
  ];
  const BLANK_LABELS = { lesson: "Lesson Content", homework: "Homework", date: "Date of Lesson", recorded: "Recorded" };
  const TOP_H = "14mm";
  const BOTTOM_H = "17mm";

  const css = document.createElement("style");
  css.textContent = `
.sp-top { display:flex; gap:8px; flex-shrink:0; margin:0 0 6px; height:${TOP_H}; }
.sp-top > .sp-sec { flex:1 1 0; min-width:0; }
.sp-top > .sp-sec.sp-nowrap { min-width:max-content; }
.sp-bottom { display:flex; gap:8px; flex-shrink:0; height:${BOTTOM_H}; }
.sp-bottom > .sp-sec { flex:1 1 0; min-width:0; }
.sp-bottom > .sp-sec.sp-nowrap { min-width:max-content; }
.sp-sec { box-sizing:border-box; height:100%; overflow:hidden; text-align:left; line-height:1.2; }
.sp-sec.sp-right { text-align:right; }
.sp-sec.sp-boxed { border:1px solid #333; border-radius:4px; padding:3px 6px; position:relative; }
.sp-sec .sp-label { display:block; font-size:0.6rem; font-weight:700; color:#444; text-transform:uppercase; letter-spacing:.03em; margin-bottom:1px; }
.sp-sec .sp-text { font-size:0.65rem; line-height:1.25; word-break:break-word; }
.sp-sec h2 { margin:0 0 2px; font-size:1.4rem; white-space:nowrap; }
.sp-sec .sp-period { margin:0; font-size:1rem; color:#333; white-space:nowrap; }
.sp-sec .sp-small { margin:0; font-size:0.65rem; line-height:1.3; white-space:nowrap; }

.sp-schem { max-width:760px; border:1px solid var(--line); border-radius:6px; padding:8px; background:var(--card); margin:0 0 14px; }
.sp-schem-row { display:grid; gap:6px; }
.sp-schem-cell { min-width:0; }
.sp-schem-top { grid-template-columns:1fr 1fr 1fr; }
.sp-schem-bottom { grid-template-columns:repeat(6, minmax(0,1fr)); }
.sp-schem-box { position:relative; border:1px dashed var(--ink-soft); border-radius:4px; min-height:46px; background:color-mix(in srgb, var(--card) 85%, var(--line)); }
.sp-schem-box.sp-on { border:1px solid var(--green); background:color-mix(in srgb, var(--green) 14%, var(--card)); }
.sp-schem-num { position:absolute; top:2px; left:4px; font-weight:700; font-size:.75rem; color:var(--ink-soft); pointer-events:none; }
.sp-schem-size { display:flex; justify-content:center; margin:3px 0; }
.sp-schem-size select { font-size:.75rem; max-width:100%; }
.sp-schem-box select { position:absolute; inset:0; width:100%; height:100%; opacity:0.001; cursor:pointer; font-size:14px; }
.sp-schem-val { position:absolute; left:4px; right:4px; bottom:3px; font-size:.7rem; line-height:1.15; overflow:hidden; pointer-events:none; text-align:left; }
.sp-schem-top .sp-schem-cell:nth-child(3) .sp-schem-val { text-align:right; }
.sp-schem-mid { margin:6px 0 2px; height:70px; border:1px solid var(--line); border-radius:4px; display:flex; align-items:center; justify-content:center; color:var(--ink-soft); font-size:.8rem; background:repeating-linear-gradient(45deg, transparent 0 8px, color-mix(in srgb, var(--line) 40%, transparent) 8px 9px); }
.sp-schem-front { text-align:center; font-style:italic; font-size:.8rem; margin:2px 0 6px; color:var(--ink-soft); }
`;
  document.head.appendChild(css);

  const sizes = () => {
    if (!Array.isArray(SeatingModule.printSizes)) SeatingModule.printSizes = [];
    const arr = SeatingModule.printSizes;
    while (arr.length < 9) arr.push(100);
    return arr;
  };
  const typeLabel = (id) => (TYPES.find((t) => t.id === id) || TYPES[0]).label;
  const sections = () => {
    if (!Array.isArray(SeatingModule.printSections)) SeatingModule.printSections = [];
    const arr = SeatingModule.printSections;
    while (arr.length < 9) arr.push("none");
    return arr;
  };
  const studentName = (s) => (s.classNumber ? `#${s.classNumber} ${s.name || "(unnamed)"}` : s.name || "(unnamed)");
  const periodInfo = (course) => {
    const period = course && course.periodId ? PeriodsModule.find(course.periodId) : null;
    if (!period) return { name: "", time: "" };
    const time = period.startTime && period.endTime ? `${period.startTime}–${period.endTime}` : period.startTime || period.endTime || "";
    return { name: period.name || "", time };
  };
  const p = (cls, text) => {
    const e = document.createElement("p");
    e.className = cls;
    e.textContent = text;
    return e;
  };

  /** One section's element for the printout, or null when it shows nothing. */
  function buildSection(type, slot, course) {
    if (!type || type === "none") return null;
    const big = slot <= 3;
    const box = document.createElement("div");
    box.className = "sp-sec";
    box.style.flexGrow = String(sizes()[slot - 1] / 100);
    if (slot === 3) box.classList.add("sp-right");
    const label = (text) => {
      const l = document.createElement("span");
      l.className = "sp-label";
      l.textContent = text;
      box.appendChild(l);
    };

    if (type === "classinfo") {
      box.classList.add("sp-nowrap");
      const name = (course && course.name) || "Seating Chart";
      const { name: pName, time } = periodInfo(course);
      if (big) {
        const h = document.createElement("h2");
        h.textContent = name;
        box.appendChild(h);
        const line = [pName, time ? `(${time})` : ""].filter(Boolean).join(" ");
        if (line) box.appendChild(p("sp-period", line));
      } else {
        box.classList.add("sp-boxed");
        label("Course");
        box.appendChild(p("sp-small", name));
        if (pName) box.appendChild(p("sp-small", pName));
        if (time) box.appendChild(p("sp-small", time));
      }
      return box;
    }

    box.classList.add("sp-boxed");
    if (BLANK_LABELS[type]) {
      label(BLANK_LABELS[type]);
    } else if (type === "excluded" || type === "special") {
      const list = RosterModule.students.filter((s) => (type === "excluded" ? s.excludeFromSeating : s.specialNeeds));
      // top sections (1-3): nothing to show means no border and no label; lower sections keep label + outline
      if (!list.length && big) return null;
      label(type === "excluded" ? "Not in seating chart" : "Special needs");
      const t = document.createElement("div");
      t.className = "sp-text";
      t.textContent = list.map(studentName).join(", ");
      box.appendChild(t);
    }
    // "future" prints as an empty box
    return box;
  }

  window.buildSeatingPrintTop = function (course) {
    const row = document.createElement("div");
    row.className = "sp-top";
    const arr = sections();
    [1, 2, 3].forEach((slot) => {
      const s = buildSection(arr[slot - 1], slot, course) || document.createElement("div");
      if (!s.classList.contains("sp-sec")) { s.className = "sp-sec"; s.style.flexGrow = String(sizes()[slot - 1] / 100); }
      if (slot === 3) s.classList.add("sp-right");
      row.appendChild(s);
    });
    return row;
  };

  window.buildSeatingPrintBottom = function (course) {
    const arr = sections();
    const row = document.createElement("div");
    row.className = "sp-bottom";
    for (let slot = 4; slot <= 9; slot++) {
      const s = buildSection(arr[slot - 1], slot, course);
      if (s) row.appendChild(s);
    }
    return row.children.length ? row : null;
  };

  /** The little page diagram in Seating Settings: click a section to choose what it shows. */
  window.buildSeatingPrintSchematic = function () {
    const wrap = document.createElement("div");
    const heading = document.createElement("h4");
    heading.textContent = "Printed seating chart";
    const hint = document.createElement("p");
    hint.className = "hint";
    hint.textContent = "Click a numbered section to choose what prints there. Sections 1–3 go at the top; 4–9 go below “Front of Classroom”. The % box sets a section\u2019s width relative to the others. Click Save Seating Chart to keep your choices.";
    const schem = document.createElement("div");
    schem.className = "sp-schem";

    const box = (slot) => {
      const b = document.createElement("div");
      b.className = "sp-schem-box";
      const num = document.createElement("span");
      num.className = "sp-schem-num";
      num.textContent = String(slot);
      const val = document.createElement("span");
      val.className = "sp-schem-val";
      const sel = document.createElement("select");
      sel.title = `Section ${slot}`;
      TYPES.forEach((t) => {
        const o = document.createElement("option");
        o.value = t.id;
        o.textContent = t.label;
        sel.appendChild(o);
      });
      const refresh = () => {
        const v = sections()[slot - 1];
        sel.value = v;
        val.textContent = v === "none" ? "" : typeLabel(v);
        b.classList.toggle("sp-on", v !== "none");
      };
      sel.addEventListener("change", () => {
        sections()[slot - 1] = sel.value;
        refresh();
      });
      refresh();
      b.append(num, val, sel);

      const sizeWrap = document.createElement("div");
      sizeWrap.className = "sp-schem-size";
      const sz = document.createElement("select");
      sz.title = `Section ${slot} size relative to the other sections`;
      [100, 75, 50, 25].forEach((n) => {
        const o = document.createElement("option");
        o.value = String(n);
        o.textContent = `${n}%`;
        sz.appendChild(o);
      });
      sz.value = String(sizes()[slot - 1]);
      sz.addEventListener("change", () => { sizes()[slot - 1] = Number(sz.value); });

      const cell = document.createElement("div");
      cell.className = "sp-schem-cell";
      if (slot <= 3) cell.append(sizeWrap, b); // top sections: size above
      else cell.append(b, sizeWrap); // bottom sections: size below
      sizeWrap.appendChild(sz);
      return cell;
    };
    const rowOf = (cls, slots) => {
      const r = document.createElement("div");
      r.className = "sp-schem-row " + cls;
      slots.forEach((s) => r.appendChild(box(s)));
      return r;
    };
    const mid = document.createElement("div");
    mid.className = "sp-schem-mid";
    mid.textContent = "Desk arrangement";
    const front = document.createElement("div");
    front.className = "sp-schem-front";
    front.textContent = "Front of Classroom";
    schem.append(rowOf("sp-schem-top", [1, 2, 3]), mid, front, rowOf("sp-schem-bottom", [4, 5, 6, 7, 8, 9]));
    wrap.append(heading, hint, schem);
    return wrap;
  };
})();
