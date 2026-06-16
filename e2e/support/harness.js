// Shared end-to-end test harness: a tiny static server, a Chrome launcher, and
// a helper to open the board with a seeded localStorage snapshot. Tests assert
// on the DOM/values rather than on screenshots.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import puppeteer from 'puppeteer-core';

const ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../..',
);
export const SAMPLE_CSV = path.join(ROOT, 'sample-jira.csv');
const STORAGE_KEY = 'cardwall.v1';

const MIME = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.csv': 'text/csv',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
};

/**
 * Serve the repo's static files on an ephemeral port. ES modules need correct
 * JS MIME types or the browser refuses them, hence the explicit map.
 * @returns {Promise<{url: string, close: () => Promise<void>}>}
 */
export async function startServer() {
  const server = http.createServer(async (req, res) => {
    try {
      let urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      if (urlPath === '/') urlPath = '/index.html';
      const filePath = path.join(ROOT, urlPath);
      if (!filePath.startsWith(ROOT)) {
        res.writeHead(403);
        res.end();
        return;
      }
      const data = await readFile(filePath);
      res.writeHead(200, {
        'Content-Type':
          MIME[path.extname(filePath)] || 'application/octet-stream',
      });
      res.end(data);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = /** @type {import('node:net').AddressInfo} */ (
    server.address()
  );
  return {
    url: `http://127.0.0.1:${port}/`,
    close: () => new Promise((resolve) => server.close(() => resolve())),
  };
}

/**
 * Launch headless Chrome. Uses PUPPETEER_EXECUTABLE_PATH if set, otherwise the
 * installed Chrome via the 'chrome' channel.
 */
export function launchBrowser() {
  const executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
  return puppeteer.launch({
    headless: true,
    args: ['--no-sandbox'],
    ...(executablePath ? { executablePath } : { channel: 'chrome' }),
  });
}

/**
 * Open a fresh page at the app, optionally seeding a board snapshot into
 * localStorage (then reloading so the app restores it).
 * @param {import('puppeteer-core').Browser} browser
 * @param {string} url
 * @param {object|null} [snapshot]  { cards, config } to seed, or null for empty
 */
export async function openBoard(browser, url, snapshot = null) {
  const page = await browser.newPage();
  await page.setViewport({ width: 1000, height: 720 });
  await page.goto(url, { waitUntil: 'networkidle0' });
  await page.evaluate((key) => localStorage.removeItem(key), STORAGE_KEY);
  if (snapshot) {
    await page.evaluate(
      (key, json) => localStorage.setItem(key, json),
      STORAGE_KEY,
      JSON.stringify(snapshot),
    );
  }
  await page.reload({ waitUntil: 'networkidle0' });
  return page;
}

/**
 * Build a board snapshot for seeding.
 * @param {object} cfg  partial config overrides
 * @param {Array<object>} cards
 */
export function board(cfg, cards) {
  return {
    cards,
    config: {
      columnField: 'Status',
      swimlaneField: '',
      colourField: '',
      columns: [],
      displayFields: ['Issue key', 'Summary'],
      headers: ['Issue key', 'Summary', 'Status', 'Assignee', 'Issue Type'],
      ...cfg,
    },
  };
}

/**
 * Make a card with the given fields; column/swimlane default from Status.
 * @param {Object<string,string>} fields
 * @param {string} [swimlane]
 */
export function card(fields, swimlane = '') {
  return {
    id: fields['Issue key'] || `id-${fields.Summary}`,
    fields,
    column: fields.Status ?? '',
    swimlane,
  };
}
