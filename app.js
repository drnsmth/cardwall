import { restore } from './src/store.js';
import { mountToolbar } from './src/ui/toolbar.js';
import { mountBoard } from './src/board.js';
import { mountModal } from './src/ui/card-edit.js';

// Load any previously saved board before we render.
restore();

/**
 * Resolve a required mount point, failing loudly if the HTML is missing it.
 * @param {string} id
 * @returns {HTMLElement}
 */
function byId(id) {
  const el = document.getElementById(id);
  if (!el) throw new Error(`Missing #${id} mount point`);
  return el;
}

mountToolbar(byId('toolbar'));
mountBoard(byId('board'));
mountModal(byId('modal-root'));
