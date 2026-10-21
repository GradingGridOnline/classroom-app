// ===== Sections for the shared Rubric Bank and the shared Tests & Quizzes list =====
// Load AFTER app.js and BEFORE quizbank.js. Adds collapsible, renamable sections; a
// "Section" drop-down on every row (shows its section / reassigns it); and ▲ ▼ arrows to
// reorder within a section. Sections are stored with each bank: bank.sections =
// [{ id, name, collapsed }] and item.section = a section id (empty = "No section").

(function () {
  const newId = () => `sec-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  };

  const css = document.createElement("style");
  css.textContent = `
.sb-group { border:1px solid var(--line); border-radius:6px; margin:0 0 10px; overflow:hidden; background:var(--card); }
.sb-head { display:flex; align-items:center; gap:8px; padding:5px 8px; background:var(--hdr-bg, #3d5a40); color:#fff; }
.sb-head .sb-toggle { background:transparent; border:0; color:inherit; font-size:1rem; cursor:pointer; width:1.6em; padding:0; }
.sb-head input.sb-name { flex:1; min-width:6em; max-width:28em; background:transparent; color:inherit; border:0; border-bottom:1px dashed rgba(255,255,255,.55); font-weight:700; font-size:1rem; padding:2px 4px; }
.sb-head .sb-count { font-size:.8rem; opacity:.85; }
.sb-head .sb-spacer { flex:1; }
.sb-head .btn { color:#fff; border-color:rgba(255,255,255,.6); background:transparent; }
.sb-body { padding:8px; }
.sb-body table { width:100%; }
.sb-empty { margin:4px 0; }
.sb-sel { max-width:12em; }
.sb-arrows { white-space:nowrap; }
.sb-arrows .btn { padding:1px 7px; }
`;
  document.head.appendChild(css);

  /**
   * opts: { sections, items, headers: [labels], buildRow(item, helpers) -> <tr>, persist() (may be async),
   *         redraw(), emptyText, addItem?(sectionId) , addLabel? }
   * helpers: { sectionSelect(item), arrows(item) }
   */
  function build(opts) {
    const { sections, items } = opts;
    const wrap = el("div", "sb-wrap");
    const secOf = (it) => (it.section && sections.some((s) => s.id === it.section) ? it.section : "");
    const commit = async () => {
      try { await opts.persist(); } catch (e) { alert(`Couldn't save: ${e.message}`); }
      opts.redraw();
    };

    const helpers = {
      sectionSelect(item) {
        const sel = el("select", "sb-sel");
        sel.title = "Section this belongs to — choose another to move it";
        const none = el("option", "", "(No section)");
        none.value = "";
        sel.appendChild(none);
        sections.forEach((s) => {
          const o = el("option", "", s.name || "(unnamed)");
          o.value = s.id;
          sel.appendChild(o);
        });
        sel.value = secOf(item);
        sel.addEventListener("change", () => {
          item.section = sel.value;
          // goes to the end of its new section
          items.splice(items.indexOf(item), 1);
          items.push(item);
          commit();
        });
        return sel;
      },
      arrows(item) {
        const box = el("span", "sb-arrows");
        const group = items.filter((x) => secOf(x) === secOf(item));
        const at = group.indexOf(item);
        const mk = (label, dir, title) => {
          const b = el("button", "btn btn-ghost btn-small", label);
          b.type = "button";
          b.title = title;
          const other = group[at + dir];
          b.disabled = !other;
          b.addEventListener("click", () => {
            const i = items.indexOf(item), j = items.indexOf(other);
            items[i] = other;
            items[j] = item;
            commit();
          });
          return b;
        };
        box.append(mk("▲", -1, "Move up within this section"), mk("▼", 1, "Move down within this section"));
        return box;
      },
    };

    const group = (section, list) => {
      const isNone = !section;
      const box = el("div", "sb-group");
      const head = el("div", "sb-head");
      const collapsed = isNone ? !!opts._noneCollapsed : !!section.collapsed;
      const tog = el("button", "sb-toggle", collapsed ? "▸" : "▾");
      tog.type = "button";
      tog.title = collapsed ? "Expand" : "Collapse";
      tog.addEventListener("click", () => {
        if (isNone) opts._noneCollapsed = !collapsed;
        else { section.collapsed = !collapsed; }
        if (isNone) opts.redraw(); else commit();
      });
      head.appendChild(tog);
      if (isNone) {
        head.appendChild(el("strong", "", "No section"));
      } else {
        const name = el("input", "sb-name");
        name.type = "text";
        name.value = section.name;
        name.placeholder = "Section name";
        name.addEventListener("change", () => { section.name = name.value.trim() || "Untitled section"; commit(); });
        head.appendChild(name);
      }
      head.appendChild(el("span", "sb-count", `${list.length} item${list.length === 1 ? "" : "s"}`));
      head.appendChild(el("span", "sb-spacer"));
      if (!isNone) {
        const del = el("button", "btn btn-ghost btn-small", "Delete section");
        del.type = "button";
        del.title = "Removes the section; its items move to \"No section\"";
        del.addEventListener("click", () => {
          if (!confirm(`Delete the section "${section.name}"? Its ${list.length} item(s) are kept, under "No section".`)) return;
          items.forEach((it) => { if (it.section === section.id) it.section = ""; });
          sections.splice(sections.indexOf(section), 1);
          commit();
        });
        head.appendChild(del);
      }
      box.appendChild(head);
      if (!collapsed) {
        const body = el("div", "sb-body");
        if (list.length === 0) {
          body.appendChild(el("p", "hint sb-empty", "Nothing in this section yet — use an item's Section drop-down to move it here."));
        } else {
          const table = el("table", "roster-table rubric-bank-grid sb-table");
          const thead = el("thead");
          const hr = el("tr");
          opts.headers.forEach((t) => hr.appendChild(el("th", "", t)));
          thead.appendChild(hr);
          table.appendChild(thead);
          const tbody = el("tbody");
          list.forEach((it) => tbody.appendChild(opts.buildRow(it, helpers)));
          table.appendChild(tbody);
          body.appendChild(table);
        }
        if (opts.addItem) {
          const add = el("button", "btn btn-ghost btn-small", opts.addLabel || "+ Add");
          add.type = "button";
          add.addEventListener("click", () => opts.addItem(isNone ? "" : section.id));
          body.appendChild(add);
        }
        box.appendChild(body);
      }
      return box;
    };

    const bar = el("div", "panel-toolbar-buttons");
    bar.style.margin = "0 0 8px";
    const addSec = el("button", "btn btn-ghost btn-small", "+ Add Section");
    addSec.type = "button";
    addSec.addEventListener("click", () => {
      sections.push({ id: newId(), name: `Section ${sections.length + 1}`, collapsed: false });
      commit();
    });
    bar.appendChild(addSec);
    if (sections.length) {
      const all = el("button", "btn btn-ghost btn-small", sections.every((s) => s.collapsed) ? "Expand all" : "Collapse all");
      all.type = "button";
      all.addEventListener("click", () => {
        const to = !sections.every((s) => s.collapsed);
        sections.forEach((s) => { s.collapsed = to; });
        opts._noneCollapsed = to;
        commit();
      });
      bar.appendChild(all);
    }
    wrap.appendChild(bar);

    sections.forEach((s) => wrap.appendChild(group(s, items.filter((it) => secOf(it) === s.id))));
    const loose = items.filter((it) => secOf(it) === "");
    if (loose.length || sections.length === 0) {
      if (loose.length === 0 && opts.emptyText) wrap.appendChild(el("p", "hint", opts.emptyText));
      if (loose.length || opts.addItem) wrap.appendChild(group(null, loose));
    }
    return wrap;
  }

  window.SectionedBank = { build, newId };

  // ---------- Rubric Bank ----------
  RubricBankModule.sections = RubricBankModule.sections || [];
  RubricBankModule.load = async function () {
    const data = await storage.loadFile("rubricbank.json");
    this.rubrics = data && Array.isArray(data.rubrics) ? data.rubrics : [];
    this.sections = data && Array.isArray(data.sections) ? data.sections.filter((s) => s && s.id) : [];
    this.loaded = true;
    this.dirty = false;
  };
  RubricBankModule.save = async function () {
    await storage.saveFile("rubricbank.json", { rubrics: this.rubrics, sections: this.sections });
    this.dirty = false;
  };

  window.buildPresentationBankBlock = function (tool, cfg, rerender, status) {
    const block = document.createElement("div");
    block.className = "rubric-bank-block";
    const heading = document.createElement("h5");
    heading.textContent = "Rubric Bank (shared by every project and course)";
    block.appendChild(heading);

    block.appendChild(
      build({
        sections: RubricBankModule.sections,
        items: RubricBankModule.rubrics,
        headers: ["Rubric", "Section", "Order", ""],
        emptyText: 'No rubrics yet — click "+ Add Rubric" to write one.',
        addLabel: "+ Add Rubric",
        persist: () => { RubricBankModule.dirty = true; },
        redraw: rerender,
        addItem: (sectionId) => {
          try {
            const r = RubricBankModule.add();
            r.section = sectionId;
          } catch (err) {
            status.textContent = err.message;
            return;
          }
          rerender();
        },
        buildRow(rubric, h) {
          const tr = document.createElement("tr");
          const textTd = document.createElement("td");
          const input = document.createElement("input");
          input.type = "text";
          input.value = rubric.text;
          input.placeholder = "Describe the rubric…";
          input.addEventListener("change", () => {
            RubricBankModule.setText(rubric.id, input.value);
            rerender();
          });
          textTd.appendChild(input);
          const secTd = document.createElement("td");
          secTd.appendChild(h.sectionSelect(rubric));
          const arrowTd = document.createElement("td");
          arrowTd.appendChild(h.arrows(rubric));
          const removeTd = document.createElement("td");
          const removeBtn = document.createElement("button");
          removeBtn.type = "button";
          removeBtn.className = "btn btn-ghost btn-small";
          removeBtn.textContent = "×";
          removeBtn.title = "Remove this rubric from the shared bank";
          removeBtn.addEventListener("click", () => {
            if (!confirm("Remove this rubric from the shared bank? It disappears for every course. Projects in other courses using it will lose that column until you pick another rubric.")) return;
            ScoringModule.presRemoveRubricBankRow(rubric.id);
            rerender();
          });
          removeTd.appendChild(removeBtn);
          tr.append(textTd, secTd, arrowTd, removeTd);
          return tr;
        },
      })
    );
    return block;
  };
})();
