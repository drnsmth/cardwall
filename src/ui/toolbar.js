import { html, render } from 'htm/preact';
import { cards, config, loadCards, syncColumns } from '../store.js';
import { importCsv, exportCsv, downloadText } from '../csv.js';

function Toolbar() {
  const cfg = config.value;
  const count = cards.value.length;

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const { cards: parsed, headers } = await importCsv(file);
    loadCards(parsed, headers);
    e.target.value = ''; // allow re-importing the same file
  };

  const onExport = () => {
    const csv = exportCsv(cards.value, config.value);
    downloadText('cardwall-export.csv', csv);
  };

  const onColumnField = (e) => {
    config.value = { ...config.value, columnField: e.target.value };
    // Re-seed columns from the newly chosen field.
    cards.value = cards.value.map((c) => ({
      ...c,
      column: (c.fields[e.target.value] ?? '').trim() || '(no value)',
    }));
    syncColumns();
  };

  const onSwimlaneField = (e) => {
    const field = e.target.value;
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

      ${count > 0 && html`
        <span class="muted">Columns by</span>
        <select onChange=${onColumnField} value=${cfg.columnField}>
          ${cfg.headers.map((h) => html`<option value=${h} selected=${h === cfg.columnField}>${h}</option>`)}
        </select>

        <span class="muted">Swimlanes by</span>
        <select onChange=${onSwimlaneField} value=${cfg.swimlaneField}>
          <option value="">(none)</option>
          ${cfg.headers.map((h) => html`<option value=${h} selected=${h === cfg.swimlaneField}>${h}</option>`)}
        </select>
      `}

      <span class="spacer"></span>
      <span class="muted">${count} card${count === 1 ? '' : 's'} · stored locally</span>
    </div>
  `;
}

export function mountToolbar(root) {
  render(html`<${Toolbar} />`, root);
}
