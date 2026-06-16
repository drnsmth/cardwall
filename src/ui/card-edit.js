import { html, render } from 'htm/preact';
import { signal } from '@preact/signals';
import { cards, config, updateCard } from '../store.js';

/** @type {import('@preact/signals').Signal<string|null>} */
const editingId = signal(null);

/**
 * Open the edit modal for a card id.
 * @param {string} id
 */
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
  const fields = uniqueFields(
    config.value.displayFields,
    ['Summary'],
    card.fields,
  );

  /** @param {SubmitEvent} e */
  const onSubmit = (e) => {
    e.preventDefault();
    const form = /** @type {HTMLFormElement} */ (e.target);
    /** @type {Object<string,string>} */
    const patch = {};
    for (const f of fields) {
      const input = /** @type {HTMLInputElement|null} */ (
        form.elements.namedItem(f)
      );
      if (input) patch[f] = input.value;
    }
    updateCard(id, patch);
    close();
  };

  return html`
    <div
      class="modal-backdrop"
      onClick=${(/** @type {Event} */ e) =>
        e.target === e.currentTarget && close()}
    >
      <div class="modal" role="dialog" aria-modal="true">
        <h2>
          ${card.fields['Issue key'] || card.fields['Key'] || 'Edit card'}
        </h2>
        <form onSubmit=${onSubmit}>
          ${fields.map(
            (f) => html`
              <div class="row" key=${f}>
                <label>${f}</label>
                ${f === 'Summary' || f === 'Description'
                  ? html`<textarea name=${f}>${card.fields[f] ?? ''}</textarea>`
                  : html`<input name=${f} value=${card.fields[f] ?? ''} />`}
              </div>
            `,
          )}
          <div class="actions">
            <button type="button" onClick=${close}>Cancel</button>
            <button type="submit" class="primary">Save</button>
          </div>
        </form>
      </div>
    </div>
  `;
}

/**
 * Merge several field lists into one, de-duplicated, preserving order.
 * Each list is either an array of field names or an object keyed by them.
 * @param {...(string[]|Object<string,string>)} lists
 * @returns {string[]}
 */
function uniqueFields(...lists) {
  const seen = new Set();
  /** @type {string[]} */
  const out = [];
  for (const list of lists) {
    const src = Array.isArray(list) ? list : Object.keys(list);
    for (const f of src) {
      if (f && !seen.has(f)) {
        seen.add(f);
        out.push(f);
      }
    }
  }
  return out;
}

/** @param {HTMLElement} root */
export function mountModal(root) {
  render(html`<${Modal} />`, root);
}
