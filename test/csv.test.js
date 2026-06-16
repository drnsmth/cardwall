import { test } from 'node:test';
import assert from 'node:assert/strict';
import { parseCsvText, exportCsv } from '../src/csv.js';

const SAMPLE = [
  'Issue key,Issue Type,Summary,Status,Assignee',
  'PROJ-1,Story,First card,To Do,Alice',
  'PROJ-2,Bug,Second card,In Progress,Bob',
].join('\n');

test('parseCsvText reads headers and rows', () => {
  const { cards, headers } = parseCsvText(SAMPLE);
  assert.deepEqual(headers, [
    'Issue key',
    'Issue Type',
    'Summary',
    'Status',
    'Assignee',
  ]);
  assert.equal(cards.length, 2);
  assert.equal(cards[0].fields['Summary'], 'First card');
  assert.equal(cards[1].fields['Status'], 'In Progress');
});

test('parseCsvText uses the Jira key as the card id', () => {
  const { cards } = parseCsvText(SAMPLE);
  assert.equal(cards[0].id, 'PROJ-1');
  assert.equal(cards[1].id, 'PROJ-2');
});

test('parseCsvText falls back to a row id when no key column exists', () => {
  const { cards } = parseCsvText('Summary,Status\nNo key here,To Do');
  assert.equal(cards[0].id, 'row-0');
});

test('parseCsvText handles quoted commas and escaped quotes in a field', () => {
  const text = 'Issue key,Summary\nPROJ-9,"Has a comma, and ""quotes"" inside"';
  const { cards } = parseCsvText(text);
  assert.equal(cards[0].fields['Summary'], 'Has a comma, and "quotes" inside');
});

test('parseCsvText disambiguates duplicate Jira headers', () => {
  // Jira commonly exports several identically-named columns (e.g. Labels).
  const text = 'Issue key,Labels,Labels\nPROJ-1,backend,urgent';
  const { cards, headers } = parseCsvText(text);
  assert.equal(headers.length, 3);
  assert.notEqual(
    headers[1],
    headers[2],
    'duplicate headers must be distinct keys',
  );
  const values = headers.slice(1).map((h) => cards[0].fields[h]);
  assert.deepEqual(values.sort(), ['backend', 'urgent']);
});

test('parseCsvText skips blank lines', () => {
  const { cards } = parseCsvText(SAMPLE + '\n\n');
  assert.equal(cards.length, 2);
});

test('exportCsv writes the original headers in order', () => {
  const { cards, headers } = parseCsvText(SAMPLE);
  const config = {
    headers,
    columnField: 'Status',
    swimlaneField: '',
    columns: [],
    displayFields: [],
  };
  const out = exportCsv(cards, config);
  assert.equal(
    out.split(/\r?\n/)[0],
    'Issue key,Issue Type,Summary,Status,Assignee',
  );
});

test('exportCsv reflects a moved card in both the column and swimlane fields', () => {
  const { cards, headers } = parseCsvText(SAMPLE);
  // A drag that moved PROJ-1 to Done / Bob writes those into the fields
  // (see moveCard); export then carries them through.
  const moved = cards.map((c) =>
    c.id === 'PROJ-1'
      ? {
          ...c,
          column: 'Done',
          swimlane: 'Bob',
          fields: { ...c.fields, Status: 'Done', Assignee: 'Bob' },
        }
      : c,
  );
  const config = {
    headers,
    columnField: 'Status',
    swimlaneField: 'Assignee',
    columns: [],
    displayFields: [],
  };
  const out = exportCsv(moved, config);
  const p1 = parseCsvText(out).cards.find((c) => c.id === 'PROJ-1');
  assert.equal(p1.fields['Status'], 'Done');
  assert.equal(p1.fields['Assignee'], 'Bob');
});

test('parse → export round-trips an unchanged board', () => {
  const { cards, headers } = parseCsvText(SAMPLE);
  const seeded = cards.map((c) => ({ ...c, column: c.fields['Status'] }));
  const config = {
    headers,
    columnField: 'Status',
    swimlaneField: '',
    columns: [],
    displayFields: [],
  };
  const out = exportCsv(seeded, config);
  const again = parseCsvText(out);
  assert.deepEqual(
    again.cards.map((c) => c.fields),
    cards.map((c) => c.fields),
  );
});

test('exportCsv places (no value) column back as empty', () => {
  const { cards, headers } = parseCsvText('Issue key,Status\nPROJ-1,');
  const config = {
    headers,
    columnField: 'Status',
    swimlaneField: '',
    columns: [],
    displayFields: [],
  };
  const moved = cards.map((c) => ({ ...c, column: '(no value)' }));
  const out = exportCsv(moved, config);
  assert.equal(parseCsvText(out).cards[0].fields['Status'], '');
});
