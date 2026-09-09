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
    const idIdx = find(["id", "student id", "学籍番号", "番号"]);
    const pronunciationIdx = find([
      "pronunciation",
      "reading",
      "furigana",
      "フリガナ",
      "ふりがな",
    ]);

    return {
      name: nameIdx !== -1 ? nameIdx : 0,
      schoolId: idIdx !== -1 ? idIdx : this.headers.length > 1 ? 1 : -1,
      pronunciation:
        pronunciationIdx !== -1
          ? pronunciationIdx
          : this.headers.length > 2
          ? 2
          : -1,
    };
  },

  /** mapping: { name: colIndex, schoolId: colIndex|-1, pronunciation: colIndex|-1 } */
  buildStudents(mapping) {
    return this.rows.map((row) => ({
      name: String(row[mapping.name] ?? "").trim(),
      schoolId:
        mapping.schoolId >= 0 ? String(row[mapping.schoolId] ?? "").trim() : "",
      pronunciation:
        mapping.pronunciation >= 0
          ? String(row[mapping.pronunciation] ?? "").trim()
          : "",
    }));
  },
};
