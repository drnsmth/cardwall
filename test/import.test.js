import { test } from 'node:test';
import assert from 'node:assert/strict';
import { importFile } from '../docs/src/import.js';
import { cards, config } from '../docs/src/store.js';

test('importFile parses a Jira CSV File and loads it into the board', async () => {
  const csv =
    'Issue key,Summary,Status\nPROJ-1,First,To Do\nPROJ-2,Second,Done';
  const file = new File([csv], 'jira.csv', { type: 'text/csv' });

  await importFile(file);

  assert.equal(cards.value.length, 2);
  assert.equal(cards.value[0].fields['Summary'], 'First');
  assert.deepEqual(config.value.headers, ['Issue key', 'Summary', 'Status']);
});
