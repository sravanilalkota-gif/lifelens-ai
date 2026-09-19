/**
 * Headless smoke test: renders the PRODUCTION bundle in jsdom, wiring fetch to
 * the real running API. Catches render-time crashes, missing exports and
 * broken data paths that `tsc` and `vite build` cannot see.
 *
 *   node scripts/smoke.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { JSDOM, VirtualConsole } from 'jsdom';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const dist = path.join(root, 'client', 'dist');
const API = process.env.API_URL ?? 'http://127.0.0.1:4000';

if (!fs.existsSync(path.join(dist, 'index.html'))) {
  console.error('client/dist not found — run `npm run build` first.');
  process.exit(1);
}

let html = fs.readFileSync(path.join(dist, 'index.html'), 'utf8');
const assets = fs.readdirSync(path.join(dist, 'assets'));
const css = assets.find((f) => f.endsWith('.css'));

/**
 * jsdom cannot execute ES-module scripts, and Vite only emits ESM. So we build
 * the very same entry point (`client/src/main.tsx`) into an IIFE with esbuild —
 * same source, same components, just a format jsdom can run.
 */
const esbuild = await import('esbuild');
const iife = await esbuild.build({
  entryPoints: [path.join(root, 'client', 'src', 'main.tsx')],
  bundle: true,
  format: 'iife',
  write: false,
  jsx: 'automatic',
  loader: { '.css': 'empty', '.svg': 'dataurl', '.png': 'dataurl', '.jpg': 'dataurl' },
  define: { 'import.meta.env': '{}' },
  target: 'es2020',
  logLevel: 'silent',
});
const bundle = iife.outputFiles[0].text;

// Swap the module <script> for the inline IIFE bundle. It must be injected at
// the END of <body>: an IIFE runs the moment it parses, and main.tsx mounts
// into #root, which does not exist yet while we are still inside <head>.
const moduleScript = html.match(/<script[^>]*type="module"[^>]*>\s*<\/script>/);
if (!moduleScript) throw new Error('could not find the module <script> tag in dist/index.html');
html = html.replace(moduleScript[0], '');
html = html.replace('</body>', () => `<script>${bundle}</script></body>`);
if (css) {
  html = html.replace('</head>', () => `<style>${fs.readFileSync(path.join(dist, 'assets', css), 'utf8')}</style></head>`);
}

const errors = [];
const vc = new VirtualConsole();
vc.on('jsdomError', (e) => errors.push(`jsdomError: ${e.message}`));
vc.on('error', (...a) => errors.push(`console.error: ${a.join(' ')}`));
vc.on('warn', (...a) => {
  const msg = a.join(' ');
  if (!/Not implemented|Could not parse CSS/i.test(msg)) errors.push(`console.warn: ${msg}`);
});

const dom = new JSDOM(html, {
  runScripts: 'dangerously',
  pretendToBeVisual: true,
  url: 'http://localhost:5173/',
  virtualConsole: vc,
  beforeParse(window) {
    window.fetch = (input, init) => {
      const url = String(input);
      if (url.startsWith('/api')) return fetch(`${API}${url}`, init);
      if (url.startsWith('/samples')) {
        const file = path.join(root, 'client', 'public', url.replace(/^\//, ''));
        if (fs.existsSync(file)) {
          return Promise.resolve(
            new window.Response(fs.readFileSync(file), { status: 200, headers: { 'Content-Type': 'image/jpeg' } }),
          );
        }
      }
      return Promise.resolve(new window.Response('', { status: 404 }));
    };
    window.Response = Response;
    window.scrollTo = () => {};
    window.matchMedia = window.matchMedia ?? (() => ({ matches: false, addEventListener() {}, removeEventListener() {} }));
  },
});

const { window } = dom;
const doc = window.document;
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

function text() {
  return doc.body.textContent.replace(/\s+/g, ' ').trim();
}

function click(el, label) {
  if (!el) throw new Error(`could not find element to click: ${label}`);
  el.dispatchEvent(new window.MouseEvent('click', { bubbles: true, cancelable: true }));
}

const results = [];
function check(name, cond, detail = '') {
  results.push({ name, ok: Boolean(cond), detail });
  console.log(`${cond ? '✅' : '❌'} ${name}${detail ? ` — ${detail}` : ''}`);
  if (!cond) process.exitCode = 1;
}

try {
  await wait(1200);
  if (process.env.DEBUG_SMOKE) {
    console.log('--- DEBUG root html length:', doc.getElementById('root')?.innerHTML.length);
    console.log('--- DEBUG errors:', errors.slice(0, 5));
    console.log('--- DEBUG body:', doc.body.textContent.replace(/\s+/g, ' ').slice(0, 200));
  }

  /* ------------------------------ 1. dashboard ----------------------------- */
  const t0 = text();
  check('Dashboard renders greeting', /Good (morning|afternoon|evening|night), Sravani/.test(t0), t0.slice(0, 60));
  check('Dashboard shows seeded priorities', /DBMS Internal Examination/.test(t0));
  check('Dashboard shows scan CTA', /Scan something/.test(t0));
  check('Dashboard shows Demo Mode badge', /Demo Mode/.test(t0));
  check('Dashboard shows priority engine copy', /Due (today|tomorrow|in \d+ days)/.test(t0));

  /* ------------------------------ 2. capture ------------------------------- */
  const scanBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('Scan something'));
  click(scanBtn, 'Scan something');
  await wait(400);
  check('Capture page opens', /Show LifeLens something/.test(text()));
  check('Capture lists sample documents', /DBMS Internal Exam Notice/.test(text()));

  const sample = [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('DBMS Internal Exam Notice'));
  click(sample, 'sample doc');
  await wait(600);
  check('Analyzing overlay appears', /Understanding your capture/.test(text()));
  await wait(2600);
  check('Confirmation card shows understanding', /LifeLens understood/.test(text()));
  if (process.env.DEBUG_SMOKE) {
    const sheet = doc.querySelector('div[role="dialog"]');
    console.log('--- DEBUG sheet text ---');
    console.log(sheet ? sheet.textContent.replace(/\s+/g, ' ').slice(0, 1400) : '(no dialog)');
  }
  const t1 = text();
  check('Extracted date shown', /(September|2026)/.test(t1));
  check('Priority shown', /High priority|High/.test(t1));
  check('Suggested action shown', /Prepare for the DBMS internal exam/.test(t1));
  check('Generated tasks shown', /Revise DBMS Units/.test(t1));

  /* --------------------------- 3. edit + save ------------------------------ */
  const editBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === 'Edit');
  click(editBtn, 'Edit');
  await wait(300);
  check('Edit form opens', /Priority \(your call wins\)/.test(text()));

  const saveBtn = [...doc.querySelectorAll('button')].find((b) => b.textContent.includes('Add to my tasks'));
  click(saveBtn, 'Add to my tasks');
  await wait(1200);
  check('Saved and routed to plan', /What should I do today/.test(text()));
  check('New task appears in plan', /DBMS Internal Examination/.test(text()));

  /* ------------------------------- 4. voice -------------------------------- */
  const mic = doc.querySelector('button[aria-label="Ask LifeLens"]');
  click(mic, 'voice button');
  await wait(400);
  check('Voice sheet opens', /Ask LifeLens/.test(text()) && /Try asking/.test(text()));

  const suggestion = [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === 'What should I finish first?');
  click(suggestion, 'suggestion chip');
  await wait(1200);
  const t2 = text();
  check('Assistant answers from stored data', /Start with|Operating Systems|DBMS/.test(t2), t2.slice(0, 90));

  const closeBtn = doc.querySelector('div[role="dialog"] button[aria-label="Close"]');
  click(closeBtn, 'close sheet');
  await wait(300);

  /* ------------------------------ 5. tasks --------------------------------- */
  const tasksTab = [...doc.querySelectorAll('nav button')].find((b) => b.textContent.trim().startsWith('Tasks'));
  click(tasksTab, 'Tasks tab');
  await wait(500);
  check('Tasks page renders', /Open/.test(text()) && /Operating Systems Assignment 2/.test(text()));

  /* ----------------------------- 6. calendar ------------------------------- */
  const calTab = [...doc.querySelectorAll('nav button')].find((b) => b.textContent.trim().startsWith('Calendar'));
  click(calTab, 'Calendar tab');
  await wait(500);
  check('Calendar renders month grid', /Upcoming deadlines/.test(text()) && /MonTueWed/.test(text().replace(/\s/g, '')));

  /* ----------------------------- 7. captures ------------------------------- */
  const homeTab = [...doc.querySelectorAll('nav button')].find((b) => b.textContent.trim().startsWith('Home'));
  click(homeTab, 'Home tab');
  await wait(300);
  const seeAll = [...doc.querySelectorAll('button')].find((b) => b.textContent.trim() === 'See all');
  click(seeAll, 'See all captures');
  await wait(500);
  check('Captures page renders', /My captures/.test(text()) && /visual memory/i.test(text()));

  /* ------------------------------ 8. profile ------------------------------- */
  const profileTab = [...doc.querySelectorAll('nav button')].find((b) => b.textContent.trim().startsWith('Profile'));
  click(profileTab, 'Profile tab');
  await wait(400);
  check('Profile page renders', /AI engine/.test(text()) && /Demo Mode/.test(text()));

  /* -------------------------- 9. no console errors ------------------------- */
  check('No runtime errors logged', errors.length === 0, errors.slice(0, 3).join(' | '));
} catch (e) {
  console.error('💥 smoke test crashed:', e.message);
  process.exitCode = 1;
} finally {
  const failed = results.filter((r) => !r.ok);
  console.log(`\n${results.length - failed.length}/${results.length} checks passed`);
  dom.window.close();
}
