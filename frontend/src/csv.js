// Minimal RFC4180-ish CSV parser — handles quoted fields, embedded commas,
// embedded newlines, and doubled "" quote-escaping. No external dependency
// needed for a format this simple, and it keeps the bundle small.
export function parseCSV(text) {
  const rows = [];
  let row = [];
  let field = "";
  let inQuotes = false;
  // Normalize line endings up front so \r\n / \r / \n all behave the same.
  const s = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < s.length; i++) {
    const c = s[i];
    if (inQuotes) {
      if (c === '"') {
        if (s[i + 1] === '"') { field += '"'; i++; }
        else inQuotes = false;
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += c;
    }
  }
  // Last field/row (files don't always end with a trailing newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }

  // Drop fully blank trailing rows (common when exporting from Excel)
  while (rows.length > 0 && rows[rows.length - 1].every((f) => f.trim() === "")) {
    rows.pop();
  }
  return rows;
}

// Maps the template's human-readable column headers to the field names the
// backend import endpoint expects. Matching is case/space-insensitive so
// minor header edits by the user don't break the import.
const HEADER_MAP = {
  title: "title",
  description: "description",
  status: "status",
  priority: "priority",
  category: "category",
  assigneeemail: "assigneeEmail",
  assigneeteam: "assigneeTeam",
  startdate: "startDate",
  duedate: "dueDate",
  labels: "labels",
  subtasks: "subtasks",
};

function normalizeHeader(h) {
  return h.trim().toLowerCase().replace(/[^a-z]/g, "");
}

// Turns raw CSV text into an array of task-import row objects, keyed by the
// field names the backend expects. Rows that are entirely blank are skipped.
export function csvToTaskRows(text) {
  const rows = parseCSV(text);
  if (rows.length === 0) return [];
  const headers = rows[0].map((h) => HEADER_MAP[normalizeHeader(h)] || null);

  return rows.slice(1)
    .filter((r) => r.some((f) => f.trim() !== ""))
    .map((r) => {
      const obj = {};
      headers.forEach((key, i) => {
        if (key) obj[key] = (r[i] || "").trim();
      });
      return obj;
    });
}
