import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import {
  cards,
  config,
  loadCards,
  moveCard,
  updateCard,
  syncColumns,
  distinctValues,
} from '../src/store.js';

const HEADERS = ['Issue key', 'Summary', 'Status', 'Assignee'];

function fixture() {
  return [
    { id: 'A-1', fields: { 'Issue key': 'A-1', Summary: 'One', Status: 'To Do', Assignee: 'Alice' }, column: '', swimlane: '' },
    { id: 'A-2', fields: { 'Issue key': 'A-2', Summary: 'Two', Status: 'Done', Assignee: 'Bob' }, column: '', swimlane: '' },
    { id: 'A-3', fields: { 'Issue key': 'A-3', Summary: 'Three', Status: 'To Do', Assignee: 'Alice' }, column: '', swimlane: '' },
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
  assert.deepEqual(cards.value.map((c) => c.column), ['To Do', 'Done', 'To Do']);
});

test('loadCards derives columns in first-seen order', () => {
  assert.deepEqual(config.value.columns, ['To Do', 'Done']);
});

test('loadCards falls back to first header when Status is absent', () => {
  loadCards(
    [{ id: 'X', fields: { Name: 'n', Phase: 'Backlog' }, column: '', swimlane: '' }],
    ['Name', 'Phase']
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

test('distinctValues returns first-seen unique values', () => {
  assert.deepEqual(distinctValues('Assignee'), ['Alice', 'Bob']);
  assert.deepEqual(distinctValues('Status'), ['To Do', 'Done']);
});

test('syncColumns recomputes columns after the column field changes', () => {
  config.value = { ...config.value, columnField: 'Assignee' };
  cards.value = cards.value.map((c) => ({ ...c, column: c.fields['Assignee'] }));
  syncColumns();
  assert.deepEqual(config.value.columns, ['Alice', 'Bob']);
});

test('syncColumns yields a placeholder when the field is empty everywhere', () => {
  loadCards(
    [{ id: 'E', fields: { 'Issue key': 'E', Status: '' }, column: '', swimlane: '' }],
    ['Issue key', 'Status']
  );
  assert.deepEqual(config.value.columns, ['(no value)']);
  assert.equal(cards.value[0].column, '(no value)');
});

test('swimlane field assigns swimlane values on load', () => {
  config.value = { ...config.value, swimlaneField: 'Assignee' };
  loadCards(fixture(), HEADERS);
  assert.deepEqual(cards.value.map((c) => c.swimlane), ['Alice', 'Bob', 'Alice']);
});
