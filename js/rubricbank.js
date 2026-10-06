// ===== Shared Rubric Bank =====
// One bank (rubricbank.json) shared by every Presentation Calc project in every course.
const MAX_SHARED_RUBRICS = 100;

const RubricBankModule = {
  rubrics: [], // [{ id, text }]
  loaded: false,
  dirty: false,

  async load() {
    const data = await storage.loadFile("rubricbank.json");
    this.rubrics = data && Array.isArray(data.rubrics) ? data.rubrics : [];
    this.loaded = true;
    this.dirty = false;
  },
  async ensureLoaded() {
    if (!this.loaded) await this.load();
  },
  async save() {
    await storage.saveFile("rubricbank.json", { rubrics: this.rubrics });
    this.dirty = false;
  },

  find(id) {
    return this.rubrics.find((r) => r.id === id) || null;
  },
  add() {
    if (this.rubrics.length >= MAX_SHARED_RUBRICS) {
      throw new Error(`You've reached the limit of ${MAX_SHARED_RUBRICS} rubrics.`);
    }
    const rubric = { id: `rubric-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`, text: "" };
    this.rubrics.push(rubric);
    this.dirty = true;
    return rubric;
  },
  remove(id) {
    this.rubrics = this.rubrics.filter((r) => r.id !== id);
    this.dirty = true;
  },
  setText(id, text) {
    const r = this.find(id);
    if (r) {
      r.text = text;
      this.dirty = true;
    }
  },
  /** Adds rubrics whose ids aren't already in the bank (existing ones win). Returns how many were added. */
  mergeIn(list) {
    let added = 0;
    (list || []).forEach((r) => {
      if (r && r.id && !this.find(r.id)) {
        this.rubrics.push({ id: r.id, text: r.text || "" });
        added++;
      }
    });
    if (added) this.dirty = true;
    return added;
  },
};

window.RubricBankModule = RubricBankModule;
