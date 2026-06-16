import { importCsv } from './csv.js';
import { loadCards } from './store.js';

/**
 * Parse a Jira-exported CSV File and load it into the board. Shared by the
 * toolbar and the empty-state import controls so the file→parse→load flow
 * lives in one place.
 * @param {File} file
 * @returns {Promise<void>}
 */
export async function importFile(file) {
  const { cards, headers } = await importCsv(file);
  loadCards(cards, headers);
}
