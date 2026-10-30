// ===== Shared comment-phrase bank =====
// Often-used comment phrases (phrasebank.json), shared by every course. They appear as an
// "Insert a phrase" menu on the Teacher Scores QR form, next to each group's comment box.
const MAX_PHRASES = 200;

const PhraseBankModule = {
  phrases: [], // [{ id, category, text }]
  loaded: false,

  async load() {
    const data = await storage.loadFile("phrasebank.json");
    this.phrases = data && Array.isArray(data.phrases)
      ? data.phrases.filter((p) => p && typeof p === "object").map((p) => ({ id: p.id || this._id(), category: String(p.category || ""), text: String(p.text || "") }))
      : [];
    this.loaded = true;
  },
  async ensureLoaded() {
    if (!this.loaded) await this.load();
  },
  async save() {
    await storage.saveFile("phrasebank.json", { phrases: this.phrases });
  },
  _id() {
    return `phrase-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  },
  add(category) {
    if (this.phrases.length >= MAX_PHRASES) throw new Error(`You've reached the limit of ${MAX_PHRASES} phrases.`);
    const p = { id: this._id(), category: category || "", text: "" };
    this.phrases.push(p);
    return p;
  },
  remove(id) {
    this.phrases = this.phrases.filter((p) => p.id !== id);
  },
  /** What goes on the student form: [{ c: category, t: text }] for every non-empty phrase. */
  forForm() {
    return this.phrases.filter((p) => p.text.trim()).map((p) => ({ c: p.category.trim(), t: p.text.trim() }));
  },
};
window.PhraseBankModule = PhraseBankModule;
