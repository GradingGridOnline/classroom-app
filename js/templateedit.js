// ===== Edit course templates directly =====
// Load AFTER app.js (and after quizbank.js). Adds an "Edit" button to each template in the
// course list. It opens the template in the normal Scoring / Attendance / Seating / Report
// Card screens (with no students), so every setting can be changed in the same place you
// use for a course. "Save to Template" writes the changes back to the template; courses
// linked to it follow the next time they are opened, and new courses made from it start
// with the changes.
//
// How: the template's contents are copied into a hidden, temporary course
// ("tmpledit-<template id>"), which the existing screens edit as usual. Saving rebuilds the
// template from that course. The hidden course never shows in the course list and its files
// are deleted when you close the editor.

(function () {
  const EDIT_PREFIX = "tmpledit-";
  let editing = null; // { templateId, courseId } while a template is open in the editor

  // ---------- template storage ----------
  Object.assign(TemplatesModule, {
    /** Copies a template's contents into the hidden editing course's own files (no students), ready for the normal screens to load. */
    async populateEditor(templateId, courseId) {
      const data = await storage.loadFile(this.fileName(templateId));
      if (!data) throw new Error("That template's data couldn't be found.");

      // The template's rubrics join the shared bank so its Presentation Calc projects can use them.
      await RubricBankModule.ensureLoaded();
      RubricBankModule.mergeIn(data.rubricBank);
      ((data.scoring && data.scoring.tools) || []).forEach((tool) => {
        if (tool.type !== "presentation" || !tool.config) return;
        const projects = Array.isArray(tool.config.projects) ? tool.config.projects : [tool.config];
        projects.forEach((p) => {
          RubricBankModule.mergeIn(p.rubricBank);
          p.rubricBank = [];
        });
      });

      await storage.saveFile(`roster-${courseId}.json`, { students: [] });

      if (data.attendance) {
        const settings = this._clone(data.attendance.settings || {});
        const count = Math.max(0, Math.min(100, Math.round(Number(settings.termClassCount) || 0)));
        const sessions = [];
        for (let i = 0; i < count; i++) {
          sessions.push({ id: `session-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`, number: i + 1, date: "" });
        }
        await storage.saveFile(`attendance-${courseId}.json`, { sessions, records: {}, notes: {}, settings });
      }
      if (data.scoring) {
        await storage.saveFile(`scoring-${courseId}.json`, {
          categories: this._clone(data.scoring.categories || []),
          records: {},
          weights: this._clone(data.scoring.weights || {}),
          tools: this._clone(data.scoring.tools || []),
          presentationMigrated: true,
        });
      }
      if (data.seating) {
        await storage.saveFile(`seating-${courseId}.json`, { ...this._clone(data.seating), seats: {}, locks: {} });
      }
      if (data.reportcard) {
        await storage.saveFile(`reportcard-${courseId}.json`, this._clone(data.reportcard));
      }
      if (RubricBankModule.dirty) await RubricBankModule.save();
    },

    /** Rebuilds a template from what is saved for the editing course (all four parts, including the seating layout). */
    async saveFromEditor(templateId, courseId) {
      if (!this.find(templateId)) throw new Error("That template no longer exists.");
      const data = await this._buildData(courseId);
      await storage.saveFile(this.fileName(templateId), data);
    },
  });

  // ---------- keep the hidden editing course out of the course list ----------
  const origActive = CoursesModule.activeCourses;
  CoursesModule.activeCourses = function () {
    return origActive.call(this).filter((c) => !c.editingTemplateId);
  };
  const origArchived = CoursesModule.archivedCourses;
  CoursesModule.archivedCourses = function () {
    return origArchived.call(this).filter((c) => !c.editingTemplateId);
  };
  const origLoad = CoursesModule.load;
  CoursesModule.load = async function (...args) {
    const result = await origLoad.apply(this, args);
    if (!editing) this.courses = this.courses.filter((c) => !c.editingTemplateId); // leftovers from a closed browser tab
    return result === this.courses || !Array.isArray(result) ? this.courses : result;
  };

  // ---------- the banner shown while editing ----------
  const banner = document.createElement("div");
  banner.id = "template-edit-banner";
  banner.hidden = true;
  banner.style.cssText =
    "margin:0 0 16px;padding:12px 16px;border:2px solid #c2571a;border-radius:8px;" +
    "background:color-mix(in srgb, #c2571a 14%, var(--card));";
  const bannerText = document.createElement("div");
  bannerText.style.cssText = "font-weight:700;margin-bottom:4px;";
  const bannerHint = document.createElement("div");
  bannerHint.className = "hint";
  bannerHint.textContent =
    "You're editing the template itself, so there are no students here. Courses linked to it follow your changes the next time they are opened; new courses made from it start with them.";
  const bannerButtons = document.createElement("div");
  bannerButtons.className = "panel-toolbar-buttons";
  bannerButtons.style.cssText = "margin-top:10px;";
  const bannerStatus = document.createElement("p");
  bannerStatus.className = "result";
  bannerStatus.style.cssText = "margin:8px 0 0;";
  const mk = (label, cls, onClick) => {
    const b = document.createElement("button");
    b.type = "button";
    b.className = cls;
    b.textContent = label;
    b.addEventListener("click", onClick);
    bannerButtons.appendChild(b);
    return b;
  };
  mk("Save to Template", "btn btn-primary btn-small", () => saveEditor());
  mk("Save & Close", "btn btn-ghost btn-small", () => closeEditor(true));
  mk("Close without saving", "btn btn-ghost btn-small", () => {
    if (!confirm("Close without saving? Changes since your last \"Save to Template\" will be lost.")) return;
    closeEditor(false);
  });
  banner.append(bannerText, bannerHint, bannerButtons, bannerStatus);
  el.courseDetailTitle.parentElement.insertAdjacentElement("afterend", banner);

  const say = (text, bad) => {
    bannerStatus.textContent = text;
    bannerStatus.style.color = bad ? "#d3302f" : "";
  };

  // ---------- open / save / close ----------
  async function openEditor(template) {
    el.courseStatus.textContent = `Opening "${template.name}" for editing…`;
    try {
      const courseId = EDIT_PREFIX + template.id;
      await TemplatesModule.populateEditor(template.id, courseId);
      let course = CoursesModule.find(courseId);
      if (!course) {
        course = { id: courseId, name: "", periodId: null, archived: false, templateId: null, editingTemplateId: template.id };
        CoursesModule.courses.push(course);
      }
      course.name = `Template: ${template.name}`;
      editing = { templateId: template.id, courseId };
      await openCourseDetail(course);

      bannerText.textContent = `Editing template "${template.name}"`;
      banner.hidden = false;
      say("");
      el.tabRosterBtn.style.display = "none"; // no students in a template
      showTab("scoring");
      el.modePrintcardBtn.click(); // show the Report Card item choices rather than the (empty) student view
      el.courseStatus.textContent = "";
    } catch (err) {
      editing = null;
      CoursesModule.courses = CoursesModule.courses.filter((c) => !c.editingTemplateId);
      el.courseStatus.textContent = `Couldn't open the template: ${err.message}`;
    }
  }

  async function saveEditor() {
    if (!editing) return false;
    say("Saving…");
    try {
      await SeatingModule.save();
      await AttendanceModule.save();
      await ScoringModule.save();
      await ReportCardModule.save();
      if (RubricBankModule.dirty) await RubricBankModule.save();
      await TemplatesModule.saveFromEditor(editing.templateId, editing.courseId);
      say("Saved to the template ✓");
      return true;
    } catch (err) {
      say(`Couldn't save: ${err.message}`, true);
      return false;
    }
  }

  async function closeEditor(save) {
    if (!editing) return;
    if (save && !(await saveEditor())) return; // stay open so nothing is lost
    const { courseId } = editing;
    editing = null;
    CoursesModule.courses = CoursesModule.courses.filter((c) => !c.editingTemplateId);
    banner.hidden = true;
    el.tabRosterBtn.style.display = "";
    await showCourses();
    // The temporary files are no longer needed (best effort).
    [...COURSE_DATA_PREFIXES, "emailcollect"].forEach((prefix) => {
      try {
        Promise.resolve(storage.deleteFile(`${prefix}-${courseId}.json`)).catch(() => {});
      } catch (e) {}
    });
  }

  // "← All Courses" saves and closes the editor instead of just leaving.
  el.backToCoursesBtn.addEventListener(
    "click",
    (e) => {
      if (!editing) return;
      e.stopImmediatePropagation();
      closeEditor(true);
    },
    true
  );

  // ---------- an "Edit" button on every template in the course list ----------
  const origRenderTemplateList = window.renderTemplateList;
  window.renderTemplateList = function () {
    origRenderTemplateList();
    const rows = el.templateList.querySelectorAll(":scope > li.course-item");
    TemplatesModule.templates.forEach((template, i) => {
      const li = rows[i];
      if (!li || li.classList.contains("hint")) return;
      const btn = makeSmallButton("Edit", "Edit this template's attendance, scoring, seating and report card settings directly", () => openEditor(template));
      btn.classList.remove("btn-ghost");
      btn.classList.add("btn-primary");
      li.insertBefore(btn, li.children[1] || null);
    });
  };
})();
