import Sortable from 'sortablejs';
import { effect } from '@preact/signals';
import { cards, config, moveCard, reorderColumns } from './store.js';
import { importFile } from './import.js';
import { openCardEditor } from './ui/card-edit.js';

/** @typedef {import('./store.js').Card} Card */
/** @typedef {import('./store.js').Config} Config */

/** @type {Sortable[]} */
const sortables = [];

/**
 * Render the board imperatively (Preact owns the chrome; Sortable owns the
 * board DOM, so we keep them apart to avoid vdom/drag conflicts).
 * @param {HTMLElement} root
 */
export function mountBoard(root) {
  effect(() => {
    // Touch the signals we depend on so the effect re-runs on change.
    const cardList = cards.value;
    const cfg = config.value;
    render(root, cardList, cfg);
  });
}

/**
 * Render a single sticky header row of columns, then one horizontal band per
 * swimlane. Columns line up across bands because the header row and every
 * band's cells share the same fixed column width and gap.
 * @param {HTMLElement} root
 * @param {Card[]} cardList
 * @param {Config} cfg
 */
function render(root, cardList, cfg) {
  destroySortables();
  root.replaceChildren();

  if (!cardList.length) {
    root.append(emptyState());
    return;
  }

  const swimlanes = cfg.swimlaneField
    ? distinct(cardList.map((c) => c.swimlane))
    : [''];

  root.append(renderHeaderRow(cardList, cfg));

  const lanes = document.createElement('div');
  lanes.className = 'lanes';
  for (const lane of swimlanes) {
    lanes.append(renderLane(lane, cardList, cfg));
  }
  root.append(lanes);
}

/**
 * The single, sticky row of column headers. Each header shows the total card
 * count for that column across all swimlanes, and doubles as the drag handle
 * for reordering columns.
 * @param {Card[]} cardList
 * @param {Config} cfg
 * @returns {HTMLElement}
 */
function renderHeaderRow(cardList, cfg) {
  const row = document.createElement('div');
  row.className = 'column-headers';

  for (const col of cfg.columns) {
    const count = cardList.filter((c) => c.column === col).length;
    const header = document.createElement('div');
    header.className = 'column-header';
    header.dataset.col = col;
    header.innerHTML = `<span>${escapeHtml(col)}</span><span>${count}</span>`;
    row.append(header);
  }

  // Drag headers to override column order; persisted globally via the store.
  const s = Sortable.create(row, {
    draggable: '.column-header',
    animation: 120,
    onEnd: () => {
      const order = [...row.querySelectorAll(':scope > .column-header')].map(
        (el) => /** @type {HTMLElement} */ (el).dataset.col ?? '',
      );
      reorderColumns(order);
    },
  });
  sortables.push(s);

  return row;
}

/**
 * One swimlane band: an optional title plus a row of column cells aligned to
 * the header row.
 * @param {string} lane
 * @param {Card[]} cardList
 * @param {Config} cfg
 * @returns {HTMLElement}
 */
function renderLane(lane, cardList, cfg) {
  const laneEl = document.createElement('section');
  laneEl.className = 'swimlane';

  if (cfg.swimlaneField) {
    const title = document.createElement('div');
    title.className = 'swimlane-title';
    title.textContent = lane || '(none)';
    laneEl.append(title);
  }

  const cols = document.createElement('div');
  cols.className = 'lane-columns';
  for (const col of cfg.columns) {
    cols.append(renderCell(col, lane, cardList, cfg));
  }
  laneEl.append(cols);

  return laneEl;
}

/**
 * A single column×swimlane cell: a drop target holding the cards for that
 * column within this lane.
 * @param {string} col
 * @param {string} lane
 * @param {Card[]} cardList
 * @param {Config} cfg
 * @returns {HTMLElement}
 */
function renderCell(col, lane, cardList, cfg) {
  const cell = document.createElement('div');
  cell.className = 'cards';
  cell.dataset.column = col;
  cell.dataset.swimlane = lane;

  const inCell = cardList.filter(
    (c) => c.column === col && (!cfg.swimlaneField || c.swimlane === lane),
  );
  for (const card of inCell) cell.append(renderCard(card, cfg));

  // Drag-and-drop between every cell (shared group spans all columns/lanes).
  const s = Sortable.create(cell, {
    group: 'cardwall',
    animation: 120,
    ghostClass: 'sortable-ghost',
    dragClass: 'sortable-drag',
    onEnd: (evt) => {
      const id = evt.item.dataset.id ?? '';
      const target = evt.to;
      moveCard(id, target.dataset.column ?? '', target.dataset.swimlane ?? '');
    },
  });
  sortables.push(s);

  return cell;
}

/**
 * @param {Card} card
 * @param {Config} cfg
 * @returns {HTMLElement}
 */
function renderCard(card, cfg) {
  const el = document.createElement('article');
  el.className = 'card';
  el.dataset.id = card.id;

  const key = card.fields['Issue key'] || card.fields['Key'] || '';
  const summary = card.fields['Summary'] || '';

  const extra = cfg.displayFields
    .filter((f) => f !== 'Issue key' && f !== 'Summary' && card.fields[f])
    .map(
      (f) =>
        `<span><span class="field-label">${escapeHtml(f)}:</span> ${escapeHtml(card.fields[f])}</span>`,
    )
    .join('');

  el.innerHTML = `
    ${key ? `<div class="key">${escapeHtml(key)}</div>` : ''}
    ${summary ? `<div class="summary">${escapeHtml(summary)}</div>` : ''}
    ${extra ? `<div class="meta">${extra}</div>` : ''}
  `;

  // Double-click opens the field editor (single click is reserved for drag).
  el.addEventListener('dblclick', () => openCardEditor(card.id));
  return el;
}

function emptyState() {
  const el = document.createElement('div');
  el.className = 'empty-state';
  el.innerHTML = `
    <h2>Welcome to Cardwall</h2>
    <p>A browser-only card wall for offline planning and workshops. Import a CSV
       exported from Jira, rearrange cards into columns and swimlanes, edit
       fields, then export a CSV again. Everything stays in your browser —
       your data is never uploaded.</p>
    <p class="how">To start: export your issues from Jira to CSV, then import
       the file here.</p>
    <label class="btn import-cta">
      Import CSV
      <input type="file" accept=".csv,text/csv" hidden />
    </label>
  `;

  const input = /** @type {HTMLInputElement} */ (
    el.querySelector('input[type=file]')
  );
  input.addEventListener('change', async () => {
    const file = input.files?.[0];
    if (!file) return;
    await importFile(file);
    input.value = '';
  });

  return el;
}

function destroySortables() {
  let s;
  while ((s = sortables.pop())) s.destroy();
}

/**
 * @param {string[]} arr
 * @returns {string[]}
 */
function distinct(arr) {
  return [...new Set(arr)];
}

/**
 * @param {string} s
 * @returns {string}
 */
function escapeHtml(s) {
  /** @type {Object<string,string>} */
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  };
  return String(s).replace(/[&<>"']/g, (c) => map[c]);
}
