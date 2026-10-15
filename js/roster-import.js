// ===== Roster import (CSV / Excel) =====
// Parses an uploaded .csv, .xlsx, or .xls file into rows, so the app can
// show the person which column is which before importing.

const RosterImport = {
  headers: [],
  rows: [],

  async parseFile(file) {
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: "array" });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawRows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "" });

    if (rawRows.length === 0) {
      throw new Error("That file appears to be empty.");
    }

    this.headers = rawRows[0].map((cell) => String(cell).trim());
    this.rows = rawRows
      .slice(1)
      .filter((row) => row.some((cell) => String(cell).trim() !== ""));

    if (this.rows.length === 0) {
      throw new Error("No student rows were found below the header row.");
    }

    return { headers: this.headers, rowCount: this.rows.length };
  },

  /** Best-effort guess at which column is which, based on header text. */
  guessMapping() {
    const find = (keywords) =>
      this.headers.findIndex((h) =>
        keywords.some((k) => h.toLowerCase().includes(k))
      );

    const nameIdx = find(["name", "氏名", "名前"]);
    const idIdx = find(["student id", "school id", "学籍番号", "学籍"]);
    const classNumberIdx = find([
      "class number",
      "class #",
      "attendance",
      "roll",
      "出席番号",
      "出席番",
    ]);
    const pronunciationIdx = find([
      "pronunciation",
      "reading",
      "furigana",
      "フリガナ",
      "ふりがな",
    ]);
    const emailIdx = find(["email", "e-mail", "mail", "メール"]);

    return {
      name: nameIdx !== -1 ? nameIdx : 0,
      classNumber: classNumberIdx,
      schoolId: idIdx,
      pronunciation: pronunciationIdx,
      email: emailIdx,
    };
  },

  /**
   * mapping: { name: colIndex, classNumber: colIndex|-1, schoolId:
   * colIndex|-1, pronunciation: colIndex|-1, email: colIndex|-1,
   * emailSuffix: string }. emailSuffix, if non-empty, is appended
   * directly onto every non-blank value pulled from the email column
   * — e.g. a column of bare student IDs plus "@university.edu" typed
   * into the suffix box. Left blank, nothing is appended and the
   * column's own values are used exactly as they appear in the file.
   * A blank email cell never gets the suffix appended to it alone.
   * mapping.extraCols (optional): column indexes to keep as extra
   * fields, stored on each student as extra: { "<column header>":
   * value } — e.g. a nickname or section column that emails can later
   * be matched by.
   */
  buildStudents(mapping) {
    const suffix = (mapping.emailSuffix || "").trim();
    const extraLabels = this.extraLabels(mapping.extraCols || []);
    return this.rows.map((row) => {
      const extra = {};
      extraLabels.forEach(({ idx, label }) => {
        extra[label] = String(row[idx] ?? "").trim();
      });
      const rawEmail = mapping.email >= 0 ? String(row[mapping.email] ?? "").trim() : "";
      return {
        name: String(row[mapping.name] ?? "").trim(),
        classNumber:
          mapping.classNumber >= 0 ? String(row[mapping.classNumber] ?? "").trim() : "",
        schoolId:
          mapping.schoolId >= 0 ? String(row[mapping.schoolId] ?? "").trim() : "",
        pronunciation:
          mapping.pronunciation >= 0
            ? String(row[mapping.pronunciation] ?? "").trim()
            : "",
        email: rawEmail && suffix ? `${rawEmail}${suffix}` : rawEmail,
        extra,
      };
    });
  },

  /** Unique, readable names for the chosen extra columns (blank headers become "Column 3"; repeats get " (2)"). */
  extraLabels(indexes) {
    const used = new Set();
    return indexes.map((idx) => {
      const base = this.headers[idx] || `Column ${idx + 1}`;
      let label = base;
      for (let n = 2; used.has(label); n++) label = `${base} (${n})`;
      used.add(label);
      return { idx, label };
    });
  },
};
