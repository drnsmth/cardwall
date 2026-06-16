import Papa from 'papaparse';

/**
 * Parse a Jira-exported CSV file into cards.
 * Jira exports often repeat column headers (e.g. several "Labels" columns);
 * PapaParse disambiguates duplicates by suffixing them, which we keep as-is.
 *
 * @param {File} file
 * @returns {Promise<{cards: import('./store.js').Card[], headers: string[]}>}
 */
export function importCsv(file) {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: 'greedy',
      transformHeader: (h) => h.trim(),
      complete: (results) => {
        const headers = results.meta.fields ?? [];
        const keyField = pickKeyField(headers);
        const cards = results.data.map((row, i) => {
          const id = (keyField && String(row[keyField]).trim()) || `row-${i}`;
          return { id, fields: row, column: '', swimlane: '' };
        });
        resolve({ cards, headers });
      },
      error: reject,
    });
  });
}

/** Jira Cloud uses "Issue key"; on-prem sometimes "Key". */
function pickKeyField(headers) {
  return ['Issue key', 'Key', 'Issue Key'].find((h) => headers.includes(h)) || null;
}

/**
 * Export the current board back to CSV. We write the original Jira columns so
 * the file can be re-opened or (for supported fields) re-imported into Jira.
 * The card's current column is written back into the columnField so moves persist.
 *
 * @param {import('./store.js').Card[]} cards
 * @param {import('./store.js').Config} config
 * @returns {string} CSV text
 */
export function exportCsv(cards, config) {
  const headers = config.headers.length
    ? config.headers
    : Array.from(new Set(cards.flatMap((c) => Object.keys(c.fields))));

  const rows = cards.map((c) => {
    const out = {};
    for (const h of headers) out[h] = c.fields[h] ?? '';
    // Reflect the card's current position back into the source field.
    if (config.columnField && headers.includes(config.columnField)) {
      out[config.columnField] = c.column === '(no value)' ? '' : c.column;
    }
    return out;
  });

  return Papa.unparse({ fields: headers, data: rows });
}

/** Trigger a browser download of text content. */
export function downloadText(filename, text, mime = 'text/csv') {
  const blob = new Blob([text], { type: `${mime};charset=utf-8;` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
