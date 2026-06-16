import { signal, effect } from '@preact/signals';

/**
 * @typedef {Object} Card
 * @property {string} id           Stable id (Jira key when available, else generated)
 * @property {Object<string,string>} fields  Raw Jira columns for this row
 * @property {string} column       Current column value (== fields[config.columnField] until moved)
 * @property {string} swimlane     Current swimlane value ('' when swimlanes are off)
 */

/**
 * @typedef {Object} Config
 * @property {string} columnField     Field whose values become columns (e.g. "Status")
 * @property {string} swimlaneField   Field whose values become swimlanes, or '' for none
 * @property {string[]} columns       Ordered list of column values to display
 * @property {string[]} displayFields Fields shown on the card face
 * @property {string[]} headers       All column headers seen in the imported CSV
 */

const STORAGE_KEY = 'cardwall.v1';

/** @type {import('@preact/signals').Signal<Card[]>} */
export const cards = signal([]);

/** @type {import('@preact/signals').Signal<Config>} */
export const config = signal({
  columnField: 'Status',
  swimlaneField: '',
  columns: [],
  displayFields: ['Issue key', 'Summary'],
  headers: [],
});

// Guarded so the module is safe to import outside a browser (tests, SSR).
const storage = typeof localStorage !== 'undefined' ? localStorage : null;

// ---- Persistence: mirror state to localStorage on every change ----
let restoring = true;
effect(() => {
  const snapshot = { cards: cards.value, config: config.value };
  if (restoring || !storage) return; // don't write during initial load
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
  } catch (e) {
    console.warn('Could not persist board', e);
  }
});

export function restore() {
  if (!storage) {
    restoring = false;
    return;
  }
  try {
    const raw = storage.getItem(STORAGE_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (Array.isArray(data.cards)) cards.value = data.cards;
      if (data.config) config.value = { ...config.value, ...data.config };
    }
  } catch (e) {
    console.warn('Could not restore board', e);
  } finally {
    restoring = false;
  }
}

/**
 * Distinct values of a field across all cards, in first-seen order.
 * @param {string} field
 * @returns {string[]}
 */
export function distinctValues(field) {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const c of cards.value) {
    const v = (c.fields[field] ?? '').trim();
    if (!seen.has(v)) {
      seen.add(v);
      out.push(v);
    }
  }
  return out;
}

/**
 * Order column values for display. Smart default: if any value contains a
 * number (e.g. "Sprint 2", "Sprint 10") sort naturally so 2 precedes 10;
 * otherwise keep first-seen order so workflow fields like Status stay in
 * their CSV order rather than alphabetising. Cards with a blank value collapse
 * into a single "(no value)" column parked at the end (backlog).
 * @param {string[]} values  Distinct field values in first-seen order.
 * @returns {string[]}
 */
function orderColumnValues(values) {
  const named = values.filter((v) => v !== '');
  const ordered = named.some((v) => /\d/.test(v))
    ? [...named].sort((a, b) =>
        a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }),
      )
    : named; // first-seen order
  return values.includes('') ? [...ordered, '(no value)'] : ordered;
}

/** Recompute the column list from the current cards + columnField. */
export function syncColumns() {
  const cols = orderColumnValues(distinctValues(config.value.columnField));
  config.value = {
    ...config.value,
    columns: cols.length ? cols : ['(no value)'],
  };
}

/**
 * Apply a user-chosen column order (from dragging column headers).
 * @param {string[]} orderedValues
 */
export function reorderColumns(orderedValues) {
  config.value = { ...config.value, columns: orderedValues };
}

/**
 * Move a card to a new column/swimlane (called from drag-and-drop).
 * @param {string} id
 * @param {string} column
 * @param {string} swimlane
 */
export function moveCard(id, column, swimlane) {
  cards.value = cards.value.map((c) =>
    c.id === id ? { ...c, column, swimlane } : c,
  );
}

/**
 * Patch a single card's fields (called from the edit modal).
 * @param {string} id
 * @param {Object<string,string>} patch
 */
export function updateCard(id, patch) {
  cards.value = cards.value.map((c) =>
    c.id === id ? { ...c, fields: { ...c.fields, ...patch } } : c,
  );
}

/**
 * Replace the whole board after a CSV import.
 * @param {Card[]} newCards
 * @param {string[]} headers
 */
export function loadCards(newCards, headers) {
  cards.value = newCards;
  config.value = { ...config.value, headers };
  // Default columnField to "Status" if present, else first header.
  const cf = headers.includes(config.value.columnField)
    ? config.value.columnField
    : (headers[0] ?? 'Status');
  config.value = { ...config.value, columnField: cf };
  // Seed each card's column from the chosen field.
  cards.value = cards.value.map((c) => ({
    ...c,
    column: (c.fields[cf] ?? '').trim() || '(no value)',
    swimlane: config.value.swimlaneField
      ? (c.fields[config.value.swimlaneField] ?? '').trim()
      : '',
  }));
  syncColumns();
}
