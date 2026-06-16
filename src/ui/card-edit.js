import { html, render } from 'htm/preact';
import { signal } from '@preact/signals';
import { cards, config, updateCard } from '../store.js';

const editingId = signal(null);

/** Open the edit modal for a card id. */
export function openCardEditor(id) {
  editingId.value = id;
}

function close() {
  editingId.value = null;
}

function Modal() {
  const id = editingId.value;
  if (!id) return null;

  const card = cards.value.find((c) => c.id === id);
  if (!card) return null;

  // Edit the display fields plus a couple of always-useful ones.
  const fields = uniqueFields(config.value.displayFields, ['Summary'], card.fields);

  const onSubmit = (e) => {
    e.preventDefault();
    const patch = {};
    for (const f of fields) {
      const input = e.target.elements[f];
      if (input) patch[f] = input.value;
    }
    updateCard(id, patch);
    close();
  };

  return html`
    <div class="modal-backdrop" onClick=${(e) => e.target === e.currentTarget && close()}>
      <div class="modal" role="dialog" aria-modal="true">
        <h2>${card.fields['Issue key'] || card.fields['Key'] || 'Edit card'}</h2>
        <form onSubmit=${onSubmit}>
          ${fields.map((f) => html`
            <div class="row" key=${f}>
              <label>${f}</label>
              ${f === 'Summary' || f === 'Description'
                ? html`<textarea name=${f}>${card.fields[f] ?? ''}</textarea>`
                : html`<input name=${f} value=${card.fields[f] ?? ''} />`}
            </div>
          `)}
          <div class="actions">
            <button type="button" onClick=${close}>Cancel</button>
            <button type="submit" class="primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

function uniqueFields(...lists) {
  const seen = new Set();
  const out = [];
  for (const list of lists) {
    const src = Array.isArray(list) ? list : Object.keys(list);
    for (const f of src) {
      if (f && !seen.has(f)) { seen.add(f); out.push(f); }
    }
  }
  return out;
}

export function mountModal(root) {
  render(html`<${Modal} />`, root);
}
