import { html, render } from 'htm/preact';
import { cards, config, loadCards, syncColumns } from '../store.js';
import { importCsv, exportCsv, downloadText } from '../csv.js';

function Toolbar() {
  const cfg = config.value;
  const count = cards.value.length;

  /** @param {Event} e */
  const onFile = async (e) => {
    const input = /** @type {HTMLInputElement} */ (e.target);
    const file = input.files?.[0];
    if (!file) return;
    const { cards: parsed, headers } = await importCsv(file);
    loadCards(parsed, headers);
    input.value = ''; // allow re-importing the same file
  };

  const onExport = () => {
    const csv = exportCsv(cards.value, config.value);
    downloadText('cardwall-export.csv', csv);
  };

  /** @param {Event} e */
  const onColumnField = (e) => {
    const value = /** @type {HTMLSelectElement} */ (e.target).value;
    config.value = { ...config.value, columnField: value };
    // Re-seed columns from the newly chosen field.
    cards.value = cards.value.map((c) => ({
      ...c,
      column: (c.fields[value] ?? '').trim() || '(no value)',
    }));
    syncColumns();
  };

  /** @param {Event} e */
  const onSwimlaneField = (e) => {
    const field = /** @type {HTMLSelectElement} */ (e.target).value;
    config.value = { ...config.value, swimlaneField: field };
    cards.value = cards.value.map((c) => ({
      ...c,
      swimlane: field ? (c.fields[field] ?? '').trim() : '',
    }));
  };

  return html`
    <div class="toolbar">
      <h1>Cardwall</h1>

      <label class="btn">
        Import CSV
        <input type="file" accept=".csv,text/csv" onChange=${onFile} hidden />
      </label>
      <button onClick=${onExport} disabled=${!count}>Export CSV</button>

      ${count > 0 &&
      html`
        <span class="muted">Columns by</span>
        <select onChange=${onColumnField} value=${cfg.columnField}>
          ${cfg.headers.map(
            (h) =>
              html`<option value=${h} selected=${h === cfg.columnField}>
                ${h}
              </option>`,
          )}
        </select>

        <span class="muted">Swimlanes by</span>
        <select onChange=${onSwimlaneField} value=${cfg.swimlaneField}>
          <option value="">(none)</option>
          ${cfg.headers.map(
            (h) =>
              html`<option value=${h} selected=${h === cfg.swimlaneField}>
                ${h}
              </option>`,
          )}
        </select>
      `}

      <span class="spacer"></span>
      <span class="muted"
        >${count} card${count === 1 ? '' : 's'} · stored locally</span
      >
    </div>
  `;
}

/** @param {HTMLElement} root */
export function mountToolbar(root) {
  render(html`<${Toolbar} />`, root);
}
