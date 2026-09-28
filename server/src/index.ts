/**
 * LifeLens AI — API entry point.
 *
 *   Frontend  →  Express API  →  AI Vision Service  →  Structured JSON
 *            →  Priority / Task Engine  →  Store  →  Dashboard / Assistant
 */
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import cors from 'cors';
import express from 'express';
import type { Request, Response, NextFunction } from 'express';

dotenv.config({
  path: path.resolve(process.cwd(), '../.env'),
});
import { JsonFileStore } from './data/store.js';
import {
  adminRouter,
  assistantRouter,
  capturesRouter,
  healthRouter,
  memoryRouter,
  planRouter,
  tasksRouter,
} from './routes/api.js';
import { analyzeRouter } from './routes/analyze.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

/* --------------------------------- config --------------------------------- */

const PORT = Number(process.env.PORT ?? 4000);
const API_KEY = (process.env.GEMINI_API_KEY ?? '').trim();
const MODEL = (process.env.GEMINI_MODEL ?? 'gemini-2.5-flash').trim();
const USER_NAME = (process.env.USER_NAME ?? 'Sravani').trim();
const USER_COURSE = (process.env.USER_COURSE ?? 'B.Tech CSE • 3rd Year').trim();
const MAX_UPLOAD_MB = Number(process.env.MAX_UPLOAD_MB ?? 6);

/** MVP: a single local demo user. No password, no session, no time wasted. */
const DEMO_USER_ID = 'demo-student';

/* ---------------------------------- store --------------------------------- */

const DATA_DIR = path.resolve(__dirname, '../../data');
const store = new JsonFileStore(path.join(DATA_DIR, 'lifelens.json'));
store.ensureSeeded(DEMO_USER_ID);

/* ---------------------------------- app ----------------------------------- */

const app = express();
app.disable('x-powered-by');
app.use(
  cors({
    origin: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'OPTIONS'],
  }),
);
// Images arrive as base64 data URLs → allow a generous JSON body, then validate.
app.use(express.json({ limit: `${MAX_UPLOAD_MB + 2}mb` }));

const env = () => ({ apiKey: API_KEY, model: MODEL });
const aiMode = () => (API_KEY ? ('gemini' as const) : ('demo' as const));

app.use(
  '/api',
  healthRouter(store, DEMO_USER_ID, () => ({
    aiMode: aiMode(),
    model: MODEL,
    hasApiKey: Boolean(API_KEY),
    user: { name: USER_NAME, course: USER_COURSE },
  })),
);
app.use('/api/analyze', analyzeRouter(env));
app.use('/api/captures', capturesRouter(store, DEMO_USER_ID));
app.use('/api/tasks', tasksRouter(store, DEMO_USER_ID));
app.use('/api/plan', planRouter(store, DEMO_USER_ID));
app.use('/api/assistant', assistantRouter(store, DEMO_USER_ID));
app.use('/api/memory', memoryRouter(store, DEMO_USER_ID));
app.use('/api/admin', adminRouter(store, DEMO_USER_ID));

app.get('/api', (_req, res) => {
  res.json({
    ok: true,
    name: 'LifeLens AI API',
    tagline: 'It doesn’t just tell you what it sees. It tells you what you should do about it.',
    mode: aiMode(),
    endpoints: [
      'GET  /api/health',
      'POST /api/analyze',
      'GET|POST|PATCH|DELETE /api/captures',
      'GET|POST|PATCH|DELETE /api/tasks',
      'GET  /api/plan • POST /api/plan/:id/complete',
      'POST /api/assistant',
      'GET  /api/memory?q=DBMS',
      'POST /api/admin/reset • POST /api/admin/clear',
    ],
  });
});

/* --------------------- serve the built client in production ---------------- */

const CLIENT_DIST = path.resolve(__dirname, '../../client/dist');
if (fs.existsSync(CLIENT_DIST)) {
  app.use(express.static(CLIENT_DIST));
  app.get(/^\/(?!api).*/, (_req, res) => res.sendFile(path.join(CLIENT_DIST, 'index.html')));
}

/* ------------------------------- error safety ------------------------------ */

// Body-parser / validation errors → friendly JSON, never a stack trace.
app.use((err: any, _req: Request, res: Response, next: NextFunction) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ ok: false, error: `That image is too large. Please keep it under ${MAX_UPLOAD_MB} MB.` });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ ok: false, error: 'LifeLens could not read that request. Please try again.' });
  }
  console.error('[api] unexpected error:', err?.message ?? err);
  res.status(500).json({ ok: false, error: 'Something went wrong inside LifeLens. Please try again.' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log('');
  console.log('  🔍 LifeLens AI — API');
  console.log(`  ➜  http://localhost:${PORT}/api`);
  console.log(`  ➜  AI mode: ${API_KEY ? `LIVE (Gemini ${MODEL})` : 'DEMO (built-in understanding engine)'}`);
  console.log(`  ➜  User: ${USER_NAME} (${USER_COURSE})`);
  console.log('');
});
