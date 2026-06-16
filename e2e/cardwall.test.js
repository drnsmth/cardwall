import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import {
  startServer,
  launchBrowser,
  openBoard,
  board,
  card,
  SAMPLE_CSV,
} from './support/harness.js';

let server;
let browser;

before(async () => {
  server = await startServer();
  browser = await launchBrowser();
});

after(async () => {
  await browser?.close();
  await server?.close();
});

test('empty state explains the app and imports a CSV', async () => {
  const page = await openBoard(browser, server.url, null);
  try {
    await page.waitForSelector('.empty-state .import-cta');
    const intro = await page.$eval('.empty-state', (el) =>
      el.textContent.replace(/\s+/g, ' '),
    );
    assert.match(intro, /browser-only/i);
    assert.match(intro, /import/i);

    const input = await page.$('.empty-state input[type=file]');
    await input.uploadFile(SAMPLE_CSV);

    await page.waitForSelector('.column-headers .column-header');
    const count = await page.$$eval('.card', (els) => els.length);
    assert.ok(count > 0, 'cards render after import');
  } finally {
    await page.close();
  }
});

test('swimlanes render one sticky header row with aligned cells', async () => {
  const cards = [
    card(
      { 'Issue key': 'P-1', Summary: 'a', Status: 'To Do', Assignee: 'Alice' },
      'Alice',
    ),
    card(
      {
        'Issue key': 'P-2',
        Summary: 'b',
        Status: 'In Progress',
        Assignee: 'Bob',
      },
      'Bob',
    ),
    card(
      { 'Issue key': 'P-3', Summary: 'c', Status: 'Done', Assignee: 'Alice' },
      'Alice',
    ),
  ];
  const snapshot = board(
    {
      swimlaneField: 'Assignee',
      columns: ['To Do', 'In Progress', 'Done'],
    },
    cards,
  );
  const page = await openBoard(browser, server.url, snapshot);
  try {
    await page.waitForSelector('.column-headers');
    const info = await page.evaluate(() => ({
      headerRows: document.querySelectorAll('.column-headers').length,
      headers: [...document.querySelectorAll('.column-header')].map(
        (h) => h.dataset.col,
      ),
      swimlanes: [...document.querySelectorAll('.swimlane-title')].map((t) =>
        t.textContent.trim(),
      ),
      cells: document.querySelectorAll('.cards').length,
      headerPosition: getComputedStyle(
        document.querySelector('.column-headers'),
      ).position,
    }));
    assert.equal(info.headerRows, 1, 'a single header row');
    assert.deepEqual(info.headers, ['To Do', 'In Progress', 'Done']);
    assert.deepEqual(info.swimlanes, ['Alice', 'Bob']);
    assert.equal(info.cells, 6, '3 columns x 2 swimlanes');
    assert.equal(info.headerPosition, 'sticky');
  } finally {
    await page.close();
  }
});

test('cards are coloured by a field, and colours survive reload', async () => {
  const cards = [
    card({
      'Issue key': 'P-1',
      Summary: 'a',
      Status: 'To Do',
      'Issue Type': 'Story',
    }),
    card({
      'Issue key': 'P-2',
      Summary: 'b',
      Status: 'To Do',
      'Issue Type': 'Bug',
    }),
    card({
      'Issue key': 'P-3',
      Summary: 'c',
      Status: 'Done',
      'Issue Type': 'Task',
    }),
  ];
  const snapshot = board(
    { colourField: 'Issue Type', columns: ['To Do', 'Done'] },
    cards,
  );
  const page = await openBoard(browser, server.url, snapshot);
  try {
    const read = () =>
      page.$$eval('.card', (els) =>
        els.map((c) => ({
          id: c.dataset.id,
          border: getComputedStyle(c).borderLeftColor,
        })),
      );

    await page.waitForSelector('.card');
    const first = await read();
    const distinct = new Set(first.map((c) => c.border));
    assert.equal(distinct.size, 3, 'three issue types -> three colours');

    await page.reload({ waitUntil: 'networkidle0' });
    await page.waitForSelector('.card');
    const second = await read();
    assert.deepEqual(second, first, 'colours persist across reload');
  } finally {
    await page.close();
  }
});

test('a card can be added from a column and edited', async () => {
  const snapshot = board({ columns: ['To Do', 'In Progress', 'Done'] }, [
    card({ 'Issue key': 'P-1', Summary: 'Existing', Status: 'To Do' }),
  ]);
  const page = await openBoard(browser, server.url, snapshot);
  try {
    await page.waitForSelector('.add-card');
    const before = await page.$$eval('.card', (els) => els.length);

    await page.click('.add-card');
    await page.waitForSelector('.modal textarea[name="Summary"]');
    await page.type('.modal textarea[name="Summary"]', 'Brand new idea');
    await page.click('.modal button.primary');
    await page.waitForFunction(() => !document.querySelector('.modal'));

    const after = await page.$$eval('.card', (els) => els.length);
    assert.equal(after, before + 1, 'one card added');

    const summaries = await page.$$eval('.card .summary', (els) =>
      els.map((s) => s.textContent.trim()),
    );
    assert.ok(summaries.includes('Brand new idea'));
  } finally {
    await page.close();
  }
});

test('a card can be deleted from its editor', async () => {
  const snapshot = board({ columns: ['To Do', 'Done'] }, [
    card({ 'Issue key': 'P-1', Summary: 'Keep me', Status: 'To Do' }),
    card({ 'Issue key': 'P-2', Summary: 'Delete me', Status: 'Done' }),
  ]);
  const page = await openBoard(browser, server.url, snapshot);
  try {
    page.on('dialog', (dialog) => dialog.accept()); // accept the confirm

    await page.waitForSelector('.card[data-id="P-2"]');
    // Open the editor via the card's dblclick handler (synthetic mouse
    // double-clicks are swallowed by the drag layer, so dispatch directly).
    await page.$eval('.card[data-id="P-2"]', (el) =>
      el.dispatchEvent(new MouseEvent('dblclick', { bubbles: true })),
    );
    await page.waitForSelector('.modal .danger');
    await page.click('.modal .danger');
    await page.waitForFunction(() => !document.querySelector('.modal'));

    const ids = await page.$$eval('.card', (els) =>
      els.map((c) => c.dataset.id),
    );
    assert.deepEqual(ids, ['P-1'], 'deleted card is gone, others remain');
  } finally {
    await page.close();
  }
});
