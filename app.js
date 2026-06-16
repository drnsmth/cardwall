import { restore } from './src/store.js';
import { mountToolbar } from './src/ui/toolbar.js';
import { mountBoard } from './src/board.js';
import { mountModal } from './src/ui/card-edit.js';

// Load any previously saved board before we render.
restore();

mountToolbar(document.getElementById('toolbar'));
mountBoard(document.getElementById('board'));
mountModal(document.getElementById('modal-root'));
