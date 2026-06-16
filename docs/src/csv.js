import Papa from 'papaparse';

/**
 * Parse Jira-exported CSV text into cards. Pure (no DOM/File), so it is the
 * unit-testable core shared by {@link importCsv}.
 * Jira exports often repeat column headers (e.g. several "Labels" columns);
 * PapaParse disambiguates duplicates by suffixing them, which we keep as-is.
 *
 * @param {string} text
 * @returns {{cards: import('./store.js').Card[], headers: string[]}}
 */
export function parseCsvText(text) {
  const results = Papa.parse(text, {
    header: true,
    skipEmptyLines: 'greedy',
    transformHeader: (h) => h.trim(),
  });
  const headers = results.meta.fields ?? [];
  const keyField = pickKeyField(headers);
  const cards = results.data.map((row, i) => {
    const id = (keyField && String(row[keyField]).trim()) || `row-${i}`;
    return { id, fields: row, column: '', swimlane: '' };
  });
  return { cards, headers };
}

/**
 * Read a Jira-exported CSV File into cards (browser entry point).
 * @param {File} file
 * @returns {Promise<{cards: import('./store.js').Card[], headers: string[]}>}
 */
export async function importCsv(file) {
  const text = await file.text();
  return parseCsvText(text);
}

/**
 * Jira Cloud uses "Issue key"; on-prem sometimes "Key".
 * @param {string[]} headers
 * @returns {string|null}
 */
function pickKeyField(headers) {
  return (
    ['Issue key', 'Key', 'Issue Key'].find((h) => headers.includes(h)) || null
  );
}

/**
 * Export the current board back to CSV. We write the original Jira columns so
 * the file can be re-opened or (for supported fields) re-imported into Jira.
 * Column/swimlane moves are already reflected in each card's fields, so we
 * simply write the fields out.
 *
 * @param {import('./store.js').Card[]} cards
 * @param {import('./store.js').Config} config
 * @returns {string} CSV text
 */
export function exportCsv(cards, config) {
  const headers = config.headers.length
    ? config.headers
    : Array.from(new Set(cards.flatMap((c) => Object.keys(c.fields))));

  // Fields are the source of truth: moveCard/updateCard write column and
  // swimlane changes back into them, so exporting the fields reflects moves.
  const rows = cards.map((c) => {
    /** @type {Object<string,string>} */
    const out = {};
    for (const h of headers) out[h] = c.fields[h] ?? '';
    return out;
  });

  return Papa.unparse({ fields: headers, data: rows });
}

/**
 * Trigger a browser download of text content.
 * @param {string} filename
 * @param {string} text
 * @param {string} [mime]
 */
export function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
