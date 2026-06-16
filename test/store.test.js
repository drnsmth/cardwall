import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  cards,
  config,
  loadCards,
  moveCard,
  updateCard,
  syncColumns,
  reorderColumns,
  distinctValues,
  reset,
  addCard,
  deleteCard,
} from '../src/store.js';

const HEADERS = ['Issue key', 'Summary', 'Status', 'Assignee'];

function fixture() {
  return [
    {
      id: 'A-1',
      fields: {
        'Issue key': 'A-1',
        Summary: 'One',
        Status: 'To Do',
        Assignee: 'Alice',
      },
      column: '',
      swimlane: '',
    },
    {
      id: 'A-2',
      fields: {
        'Issue key': 'A-2',
        Summary: 'Two',
        Status: 'Done',
        Assignee: 'Bob',
      },
      column: '',
      swimlane: '',
    },
    {
      id: 'A-3',
      fields: {
        'Issue key': 'A-3',
        Summary: 'Three',
        Status: 'To Do',
        Assignee: 'Alice',
      },
      column: '',
      swimlane: '',
    },
  ];
}

beforeEach(() => {
  // Reset singleton state between tests.
  config.value = {
    columnField: 'Status',
    swimlaneField: '',
    columns: [],
    displayFields: ['Issue key', 'Summary'],
    headers: [],
  };
  loadCards(fixture(), HEADERS);
});

test('loadCards seeds each card column from the column field', () => {
  assert.deepEqual(
    cards.value.map((c) => c.column),
    ['To Do', 'Done', 'To Do'],
  );
});

test('loadCards keeps textual column values in first-seen (workflow) order', () => {
  // Status has no numbers, so smart ordering preserves CSV/workflow order
  // rather than alphabetising (which would give Done before To Do).
  assert.deepEqual(config.value.columns, ['To Do', 'Done']);
});

/** Load a board whose cards carry the given Sprint values, grouped by Sprint. */
function sprintBoard(...sprints) {
  loadCards(
    sprints.map((sprint, i) => ({
      id: `S-${i}`,
      fields: { 'Issue key': `S-${i}`, Sprint: sprint },
      column: '',
      swimlane: '',
    })),
    ['Issue key', 'Sprint'],
  );
  config.value = { ...config.value, columnField: 'Sprint' };
  syncColumns();
}

test('syncColumns sorts numeric-suffixed values naturally (Sprint 2 before Sprint 10)', () => {
  sprintBoard('Sprint 2', 'Sprint 10', 'Sprint 1');
  assert.deepEqual(config.value.columns, ['Sprint 1', 'Sprint 2', 'Sprint 10']);
});

test('syncColumns parks blank-valued cards in a trailing (no value) column', () => {
  sprintBoard('Sprint 1', '');
  assert.deepEqual(config.value.columns, ['Sprint 1', '(no value)']);
});

test('reset empties the board and restores default config', () => {
  // beforeEach loaded a fixture; also drift the config away from defaults.
  config.value = {
    ...config.value,
    columnField: 'Assignee',
    swimlaneField: 'Status',
  };
  reset();
  assert.deepEqual(cards.value, []);
  assert.deepEqual(config.value, {
    columnField: 'Status',
    swimlaneField: '',
    colourField: '',
    columns: [],
    displayFields: ['Issue key', 'Summary'],
    headers: [],
  });
});

test('reorderColumns applies a user-chosen column order', () => {
  reorderColumns(['Done', 'To Do']);
  assert.deepEqual(config.value.columns, ['Done', 'To Do']);
});

test('loadCards falls back to first header when Status is absent', () => {
  loadCards(
    [
      {
        id: 'X',
        fields: { Name: 'n', Phase: 'Backlog' },
        column: '',
        swimlane: '',
      },
    ],
    ['Name', 'Phase'],
  );
  assert.equal(config.value.columnField, 'Name');
  assert.equal(cards.value[0].column, 'n');
});

test('moveCard updates only the target card column and swimlane', () => {
  moveCard('A-1', 'Done', '');
  const byId = Object.fromEntries(cards.value.map((c) => [c.id, c.column]));
  assert.equal(byId['A-1'], 'Done');
  assert.equal(byId['A-2'], 'Done');
  assert.equal(byId['A-3'], 'To Do');
});

test('moveCard preserves card identity and fields', () => {
  moveCard('A-1', 'Done', '');
  const c = cards.value.find((x) => x.id === 'A-1');
  assert.equal(c.fields['Summary'], 'One');
});

test('moveCard writes the new column value back into the column field', () => {
  moveCard('A-1', 'Done', '');
  const c = cards.value.find((x) => x.id === 'A-1');
  assert.equal(c.fields['Status'], 'Done');
});

test('moveCard maps the (no value) column back to an empty field', () => {
  moveCard('A-1', '(no value)', '');
  const c = cards.value.find((x) => x.id === 'A-1');
  assert.equal(c.fields['Status'], '');
});

test('moveCard writes the swimlane field when swimlanes are on', () => {
  config.value = { ...config.value, swimlaneField: 'Assignee' };
  moveCard('A-1', 'To Do', 'Bob');
  const c = cards.value.find((x) => x.id === 'A-1');
  assert.equal(c.swimlane, 'Bob');
  assert.equal(c.fields['Assignee'], 'Bob');
});

test('moveCard leaves other fields untouched when swimlanes are off', () => {
  moveCard('A-1', 'Done', '');
  const c = cards.value.find((x) => x.id === 'A-1');
  assert.equal(c.fields['Assignee'], 'Alice'); // not overwritten
  assert.ok(!('' in c.fields)); // no stray empty-key field
});

test('updateCard patches fields without touching others', () => {
  updateCard('A-2', { Summary: 'Two (edited)' });
  const c = cards.value.find((x) => x.id === 'A-2');
  assert.equal(c.fields['Summary'], 'Two (edited)');
  assert.equal(c.fields['Status'], 'Done');
});

test('updateCard ignores unknown ids', () => {
  const before = JSON.stringify(cards.value);
  updateCard('nope', { Summary: 'x' });
  assert.equal(JSON.stringify(cards.value), before);
});

test('addCard appends a new card in the given column', () => {
  const before = cards.value.length;
  const id = addCard('Done', '');
  assert.equal(cards.value.length, before + 1);
  const c = cards.value.find((x) => x.id === id);
  assert.ok(c, 'returns the new card id');
  assert.equal(c.column, 'Done');
  assert.equal(c.fields['Status'], 'Done');
});

test('addCard defaults to the first column when none is given', () => {
  const id = addCard();
  const c = cards.value.find((x) => x.id === id);
  assert.equal(c.column, config.value.columns[0]);
});

test('addCard seeds the swimlane field when swimlanes are on', () => {
  config.value = { ...config.value, swimlaneField: 'Assignee' };
  const id = addCard('To Do', 'Bob');
  const c = cards.value.find((x) => x.id === id);
  assert.equal(c.swimlane, 'Bob');
  assert.equal(c.fields['Assignee'], 'Bob');
});

test('addCard maps a (no value) target to a blank column field', () => {
  const id = addCard('(no value)', '');
  const c = cards.value.find((x) => x.id === id);
  assert.equal(c.fields['Status'], '');
});

test('addCard re-syncs columns to include a brand-new column value', () => {
  addCard('Backlog', '');
  assert.ok(config.value.columns.includes('Backlog'));
});

test('addCard gives each new card a distinct id', () => {
  const a = addCard('To Do', '');
  const b = addCard('To Do', '');
  assert.notEqual(a, b);
});

test('deleteCard removes the card from the board', () => {
  const before = cards.value.length;
  deleteCard('A-2');
  assert.equal(cards.value.length, before - 1);
  assert.ok(!cards.value.find((c) => c.id === 'A-2'));
});

test('deleteCard drops a column that becomes empty', () => {
  // A-2 is the only card in Done.
  deleteCard('A-2');
  assert.ok(!config.value.columns.includes('Done'));
  assert.deepEqual(config.value.columns, ['To Do']);
});

test('deleteCard keeps a column that still has cards', () => {
  // A-1 and A-3 are both To Do.
  deleteCard('A-1');
  assert.ok(config.value.columns.includes('To Do'));
});

test('deleteCard ignores an unknown id', () => {
  const before = cards.value.length;
  deleteCard('nope');
  assert.equal(cards.value.length, before);
});

test('updateCard re-derives the column and syncs when the column field changes', () => {
  // Grouped by Status (the default). Move A-2 from Done to a new value.
  updateCard('A-2', { Status: 'In Progress' });
  const c = cards.value.find((x) => x.id === 'A-2');
  assert.equal(c.column, 'In Progress');
  // The new value gets its own column; the now-empty Done column drops out.
  assert.deepEqual(config.value.columns, ['To Do', 'In Progress']);
});

test('updateCard leaves column and column order alone when other fields change', () => {
  updateCard('A-1', { Summary: 'Edited' });
  const c = cards.value.find((x) => x.id === 'A-1');
  assert.equal(c.column, 'To Do');
  assert.deepEqual(config.value.columns, ['To Do', 'Done']);
});

test('updateCard re-derives the swimlane when the swimlane field changes', () => {
  config.value = { ...config.value, swimlaneField: 'Assignee' };
  updateCard('A-1', { Assignee: 'Zoe' });
  const c = cards.value.find((x) => x.id === 'A-1');
  assert.equal(c.swimlane, 'Zoe');
});

test('updateCard does not move a card when the column field is re-submitted unchanged', () => {
  // Dragging to Done now also writes fields.Status = 'Done' (moveCard).
  moveCard('A-1', 'Done', '');
  // The editor re-submits Status with its existing value plus a real edit.
  updateCard('A-1', { Status: 'Done', Summary: 'Edited' });
  const c = cards.value.find((x) => x.id === 'A-1');
  assert.equal(c.column, 'Done'); // unchanged value → stays put
  assert.equal(c.fields['Summary'], 'Edited');
});

test('distinctValues returns first-seen unique values', () => {
  assert.deepEqual(distinctValues('Assignee'), ['Alice', 'Bob']);
  assert.deepEqual(distinctValues('Status'), ['To Do', 'Done']);
});

test('syncColumns recomputes columns after the column field changes', () => {
  config.value = { ...config.value, columnField: 'Assignee' };
  cards.value = cards.value.map((c) => ({
    ...c,
    column: c.fields['Assignee'],
  }));
  syncColumns();
  assert.deepEqual(config.value.columns, ['Alice', 'Bob']);
});

test('syncColumns yields a placeholder when the field is empty everywhere', () => {
  loadCards(
    [
      {
        id: 'E',
        fields: { 'Issue key': 'E', Status: '' },
        column: '',
        swimlane: '',
      },
    ],
    ['Issue key', 'Status'],
  );
  assert.deepEqual(config.value.columns, ['(no value)']);
  assert.equal(cards.value[0].column, '(no value)');
});

test('swimlane field assigns swimlane values on load', () => {
  config.value = { ...config.value, swimlaneField: 'Assignee' };
  loadCards(fixture(), HEADERS);
  assert.deepEqual(
    cards.value.map((c) => c.swimlane),
    ['Alice', 'Bob', 'Alice'],
  );
});
