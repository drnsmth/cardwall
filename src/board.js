import Sortable from 'sortablejs';
import { effect } from '@preact/signals';
import { cards, config, moveCard, reorderColumns } from './store.js';
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

  for (const lane of swimlanes) {
    const laneEl = document.createElement('section');
    laneEl.className = 'swimlane';

    if (cfg.swimlaneField) {
      const title = document.createElement('div');
      title.className = 'swimlane-title';
      title.textContent = lane || '(none)';
      laneEl.append(title);
    }

    const columnsEl = document.createElement('div');
    columnsEl_setup(columnsEl);

    for (const col of cfg.columns) {
      const colEl = renderColumn(col, lane, cardList, cfg);
      columnsEl.append(colEl);
    }
    makeColumnsSortable(columnsEl);
    laneEl.append(columnsEl);
    root.append(laneEl);
  }
}

/**
 * Let the user drag column headers to override the default order. Grabbing is
 * limited to the header (the card lists own their own drag). No shared group,
 * so columns only re-sort within their lane; the resulting order is applied
 * globally via the store and persists through the config→localStorage effect.
 * @param {HTMLElement} columnsEl
 */
function makeColumnsSortable(columnsEl) {
  const s = Sortable.create(columnsEl, {
    handle: '.column-header',
    draggable: '.column',
    animation: 120,
    onEnd: () => {
      const order = [...columnsEl.querySelectorAll(':scope > .column')].map(
        (el) => /** @type {HTMLElement} */ (el).dataset.col ?? '',
      );
      reorderColumns(order);
    },
  });
  sortables.push(s);
}

/** @param {HTMLElement} el */
function columnsEl_setup(el) {
  el.className = 'columns';
}

/**
 * @param {string} col
 * @param {string} lane
 * @param {Card[]} cardList
 * @param {Config} cfg
 * @returns {HTMLElement}
 */
function renderColumn(col, lane, cardList, cfg) {
  const colEl = document.createElement('div');
  colEl.className = 'column';
  colEl.dataset.col = col;

  const inCol = cardList.filter(
    (c) => c.column === col && (!cfg.swimlaneField || c.swimlane === lane),
  );

  const header = document.createElement('div');
  header.className = 'column-header';
  header.innerHTML = `<span>${escapeHtml(col)}</span><span>${inCol.length}</span>`;
  colEl.append(header);

  const cardsEl = document.createElement('div');
  cardsEl.className = 'cards';
  cardsEl.dataset.column = col;
  cardsEl.dataset.swimlane = lane;

  for (const card of inCol) cardsEl.append(renderCard(card, cfg));
  colEl.append(cardsEl);

  // Drag-and-drop between every .cards list (shared group).
  const s = Sortable.create(cardsEl, {
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

  return colEl;
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
    <h2>No cards yet</h2>
    <p>Import a CSV exported from Jira to build your card wall.
       Everything stays in your browser — nothing is uploaded.</p>
  `;
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
