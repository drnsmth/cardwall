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
 * @property {string} colourField     Field whose value tints each card, or '' for none
 * @property {string[]} columns       Ordered list of column values to display
 * @property {string[]} displayFields Fields shown on the card face
 * @property {string[]} headers       All column headers seen in the imported CSV
 */

const STORAGE_KEY = 'cardwall.v1';

/** @returns {Config} A fresh default board configuration. */
function defaultConfig() {
  return {
    columnField: 'Status',
    swimlaneField: '',
    colourField: '',
    columns: [],
    displayFields: ['Issue key', 'Summary'],
    headers: [],
  };
}

/** @type {import('@preact/signals').Signal<Card[]>} */
export const cards = signal([]);

/** @type {import('@preact/signals').Signal<Config>} */
export const config = signal(defaultConfig());

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

/** Clear the board back to empty defaults and wipe the saved copy. */
export function reset() {
  cards.value = [];
  config.value = defaultConfig();
  if (!storage) return;
  try {
    storage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn('Could not clear saved board', e);
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

/**
 * Derive a card's column from its fields (blank collapses to the backlog).
 * @param {Object<string,string>} fields
 * @param {string} columnField
 * @returns {string}
 */
function deriveColumn(fields, columnField) {
  return (fields[columnField] ?? '').trim() || '(no value)';
}

/**
 * Derive a card's swimlane from its fields ('' when swimlanes are off).
 * @param {Object<string,string>} fields
 * @param {string} swimlaneField
 * @returns {string}
 */
function deriveSwimlane(fields, swimlaneField) {
  return swimlaneField ? (fields[swimlaneField] ?? '').trim() : '';
}

/**
 * Whether a field's value differs between two field maps.
 * @param {Object<string,string>} before
 * @param {Object<string,string>} after
 * @param {string} field
 * @returns {boolean}
 */
function fieldChanged(before, after, field) {
  return (before[field] ?? '') !== (after[field] ?? '');
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
 * Add a new, empty card to the board in the given column/swimlane (defaulting
 * to the first column / no swimlane). The column and swimlane are seeded into
 * the card's fields so the placement survives export. New cards have no Jira
 * key, so they get a generated id. Returns the new id for opening the editor.
 * @param {string} [column]
 * @param {string} [swimlane]
 * @returns {string}
 */
export function addCard(column, swimlane = '') {
  const { columnField, swimlaneField, headers, columns } = config.value;
  const col = column || columns[0] || '(no value)';
  /** @type {Object<string,string>} */
  const fields = {};
  for (const h of headers) fields[h] = '';
  fields[columnField] = col === '(no value)' ? '' : col;
  if (swimlaneField) fields[swimlaneField] = swimlane;

  const id = `card-${crypto.randomUUID()}`;
  cards.value = [
    ...cards.value,
    { id, fields, column: col, swimlane: swimlaneField ? swimlane : '' },
  ];
  syncColumns();
  return id;
}

/**
 * Move a card to a new column/swimlane (called from drag-and-drop), writing the
 * new values back into the underlying fields so the change survives export. The
 * "(no value)" column maps back to an empty field; the swimlane field is only
 * written when swimlanes are on.
 * @param {string} id
 * @param {string} column
 * @param {string} swimlane
 */
export function moveCard(id, column, swimlane) {
  const { columnField, swimlaneField } = config.value;
  cards.value = cards.value.map((c) => {
    if (c.id !== id) return c;
    const fields = { ...c.fields };
    fields[columnField] = column === '(no value)' ? '' : column;
    if (swimlaneField) fields[swimlaneField] = swimlane;
    return { ...c, column, swimlane, fields };
  });
}

/**
 * Patch a single card's fields (called from the edit modal). When the edit
 * changes the value of the column or swimlane field, the card's derived
 * position is recomputed (and columns re-synced) so the board reflects the move
 * immediately — but only when the value actually changed, so a position set by
 * dragging isn't clobbered by re-submitting an unchanged field.
 * @param {string} id
 * @param {Object<string,string>} patch
 */
export function updateCard(id, patch) {
  const { columnField, swimlaneField } = config.value;
  let columnChanged = false;

  cards.value = cards.value.map((c) => {
    if (c.id !== id) return c;
    const fields = { ...c.fields, ...patch };
    const next = { ...c, fields };
    if (fieldChanged(c.fields, fields, columnField)) {
      next.column = deriveColumn(fields, columnField);
      columnChanged = true;
    }
    if (swimlaneField && fieldChanged(c.fields, fields, swimlaneField)) {
      next.swimlane = deriveSwimlane(fields, swimlaneField);
    }
    return next;
  });

  if (columnChanged) syncColumns();
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
    column: deriveColumn(c.fields, cf),
    swimlane: deriveSwimlane(c.fields, config.value.swimlaneField),
  }));
  syncColumns();
}
