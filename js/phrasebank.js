// ===== Shared comment-phrase bank =====
// Often-used comment phrases (phrasebank.json), shared by every course, organised into collections.
// Each phrase has an optional category (its heading on the form). A Presentation Calc project ticks
// which collections go on its Teacher Scores QR form (project.templateSettings.teacherPhraseCollections;
// unset = all of them).
const MAX_PHRASES = 300;
const MAX_COLLECTIONS = 40;

const PhraseBankModule = {
  phrases: [], // [{ id, collection, category, text }]
  collections: [], // [{ id, name, collapsed }]
  loaded: false,

  _id(p) {
    return `${p || "phrase"}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  },

  async load() {
    const data = await storage.loadFile("phrasebank.json");
    this.collections = data && Array.isArray(data.collections)
      ? data.collections.filter((c) => c && typeof c === "object").map((c) => ({ id: c.id || this._id("coll"), name: String(c.name || "Collection"), collapsed: c.collapsed === true }))
      : [];
    this.phrases = data && Array.isArray(data.phrases)
      ? data.phrases.filter((p) => p && typeof p === "object").map((p) => ({ id: p.id || this._id(), collection: p.collection || "", category: String(p.category || ""), text: String(p.text || "") }))
      : [];
    // Phrases saved before collections existed go into one collection called "General".
    if (this.phrases.length && !this.collections.length) this.collections.push({ id: this._id("coll"), name: "General", collapsed: false });
    const first = this.collections[0];
    this.phrases.forEach((p) => { if (!this.collections.some((c) => c.id === p.collection) && first) p.collection = first.id; });
    this.loaded = true;
  },
  async ensureLoaded() {
    if (!this.loaded) await this.load();
  },
  async save() {
    await storage.saveFile("phrasebank.json", { phrases: this.phrases, collections: this.collections });
  },

  addCollection(name) {
    if (this.collections.length >= MAX_COLLECTIONS) throw new Error(`You've reached the limit of ${MAX_COLLECTIONS} collections.`);
    const c = { id: this._id("coll"), name: (name || "").trim() || `Collection ${this.collections.length + 1}`, collapsed: false };
    this.collections.push(c);
    return c;
  },
  /** Removes a collection and the phrases in it. */
  removeCollection(id) {
    this.collections = this.collections.filter((c) => c.id !== id);
    this.phrases = this.phrases.filter((p) => p.collection !== id);
  },
  inCollection(id) {
    return this.phrases.filter((p) => p.collection === id);
  },
  add(collectionId, category) {
    if (this.phrases.length >= MAX_PHRASES) throw new Error(`You've reached the limit of ${MAX_PHRASES} phrases.`);
    const p = { id: this._id(), collection: collectionId, category: category || "", text: "" };
    this.phrases.push(p);
    return p;
  },
  remove(id) {
    this.phrases = this.phrases.filter((p) => p.id !== id);
  },
  /** What goes on the student form: [{ c: category, t: text }] for the non-empty phrases of the chosen collections (ids = null means every collection). */
  forForm(ids) {
    const use = Array.isArray(ids) ? new Set(ids) : null;
    return this.phrases.filter((p) => p.text.trim() && (!use || use.has(p.collection))).map((p) => ({ c: p.category.trim(), t: p.text.trim() }));
  },
};
window.PhraseBankModule = PhraseBankModule;
