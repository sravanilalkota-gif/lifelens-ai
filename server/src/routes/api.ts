/**
 * LifeLens API routes — health, captures, tasks, plan, assistant, memory.
 * Every route is defensive: bad ids → 404, bad bodies → 400, never a stack trace.
 */
import { Router } from 'express';
import type {
  AnalysisResult,
  AssistantResponse,
  Capture,
  Category,
  PlanItem,
  PlanResponse,
  Priority,
  Task,
} from '@lifelens/shared';
import { CATEGORIES, PRIORITIES, priorityRank } from '@lifelens/shared';
import type { DataStore } from '../data/store.js';
import { buildTaskFromResult } from '../engines/taskEngine.js';
import { answerQuestion, rankTasks } from '../engines/assistantEngine.js';
import { computePriority } from '../engines/priorityEngine.js';
import { daysUntil, format12h, humanDate, isIsoDate, localDateKey, normTime, relativeLabel } from '../lib/dates.js';
import { sanitize } from '../ai/gemini.js';

const DAY_MS = 86400000;

/* --------------------------------- health --------------------------------- */

export function healthRouter(
  store: DataStore,
  userId: string,
  getInfo: () => { aiMode: 'gemini' | 'demo'; model: string; hasApiKey: boolean; user: { name: string; course: string } },
): Router {
  const r = Router();
  r.get('/health', (_req, res) => {
    const info = getInfo();
    res.json({
      ok: true,
      aiMode: info.aiMode,
      model: info.model,
      hasApiKey: info.hasApiKey,
      user: info.user,
      counts: { captures: store.listCaptures(userId).length, tasks: store.listTasks(userId).length },
      time: new Date().toISOString(),
    });
  });
  return r;
}

/* -------------------------------- captures -------------------------------- */

export function capturesRouter(store: DataStore, userId: string): Router {
  const r = Router();

  r.get('/', (req, res) => {
    const q = String(req.query.q ?? '').trim().toLowerCase();
    let list = store.listCaptures(userId);
    if (q) {
      list = list.filter((c) =>
        `${c.result.title} ${c.result.subject ?? ''} ${c.result.description ?? ''} ${c.result.category} ${c.result.sourceText ?? ''}`
          .toLowerCase()
          .includes(q),
      );
    }
    res.json({ ok: true, captures: list });
  });

  /** Save a confirmed understanding (after the user reviewed/edited it). */
  r.post('/', (req, res) => {
    const b = req.body ?? {};
    const result = coerceResult(b.result);
    if (!result) return res.status(400).json({ ok: false, error: 'That capture is missing its extracted details.' });

    const imageData = typeof b.imageData === 'string' && b.imageData.startsWith('data:image/') ? b.imageData : null;
    const capture = store.addCapture(
      {
        imageData,
        imageName: typeof b.imageName === 'string' ? sanitize(b.imageName).slice(0, 120) : null,
        createdAt: new Date().toISOString(),
        result,
        saved: true,
        edited: Boolean(b.edited),
      },
      userId,
    );

    let task: Task | undefined;
    if (b.createTask !== false) {
      task = store.addTask(
        buildTaskFromResult({ result, captureId: capture.id, userId, userPriority: result.priority }),
        userId,
      );
    }
    res.status(201).json({ ok: true, capture, task });
  });

  r.get('/:id', (req, res) => {
    const c = store.getCapture(req.params.id);
    if (!c || c.userId !== userId) return res.status(404).json({ ok: false, error: 'Capture not found.' });
    res.json({ ok: true, capture: c });
  });

  r.patch('/:id', (req, res) => {
    const existing = store.getCapture(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ ok: false, error: 'Capture not found.' });
    const result = coerceResult(req.body?.result ?? existing.result);
    if (!result) return res.status(400).json({ ok: false, error: 'Invalid capture payload.' });
    const capture = store.updateCapture(req.params.id, { result, edited: true });
    res.json({ ok: true, capture });
  });

  r.delete('/:id', (req, res) => {
    const ok = store.deleteCapture(req.params.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Capture not found.' });
    res.json({ ok: true });
  });

  return r;
}

/* ---------------------------------- tasks --------------------------------- */

export function tasksRouter(store: DataStore, userId: string): Router {
  const r = Router();

  r.get('/', (req, res) => {
    const status = String(req.query.status ?? 'all');
    const q = String(req.query.q ?? '').trim().toLowerCase();
    let list = store.listTasks(userId);
    if (status === 'open') list = list.filter((t) => !t.done);
    if (status === 'done') list = list.filter((t) => t.done);
    if (q) {
      list = list.filter((t) =>
        `${t.title} ${t.subject ?? ''} ${t.description ?? ''} ${t.category} ${t.action ?? ''}`.toLowerCase().includes(q),
      );
    }
    list = rankTasks(list);
    res.json({ ok: true, tasks: list });
  });

  r.post('/', (req, res) => {
    const b = req.body ?? {};
    const title = typeof b.title === 'string' ? sanitize(b.title).slice(0, 120) : '';
    if (!title) return res.status(400).json({ ok: false, error: 'A task needs a title.' });

    const category: Category = CATEGORIES.includes(b.category) ? b.category : 'Other';
    const dueDate = isIsoDate(b.dueDate) ? b.dueDate : null;
    const priority = computePriority({
      date: dueDate,
      time: normTime(b.dueTime),
      category,
      userPriority: PRIORITIES.includes(b.priority) ? b.priority : null,
      text: `${title} ${b.description ?? ''}`,
    });

    const task = store.addTask(
      {
        captureId: typeof b.captureId === 'string' ? b.captureId : null,
        title,
        category,
        subject: typeof b.subject === 'string' ? sanitize(b.subject).slice(0, 60) : null,
        priority: priority.priority,
        priorityReason: priority.reason,
        dueDate,
        dueTime: normTime(b.dueTime),
        location: typeof b.location === 'string' ? sanitize(b.location).slice(0, 80) : null,
        reminder: isIsoDate(b.reminder) ? b.reminder : null,
        action: typeof b.action === 'string' ? sanitize(b.action).slice(0, 160) : null,
        description: typeof b.description === 'string' ? sanitize(b.description).slice(0, 400) : null,
        done: false,
        createdAt: new Date().toISOString(),
        subtasks: Array.isArray(b.subtasks)
          ? b.subtasks
              .filter((s: unknown) => typeof s === 'string' && s.trim())
              .slice(0, 8)
              .map((s: string) => ({ id: `st_${Math.random().toString(36).slice(2, 9)}`, title: sanitize(s).slice(0, 140), done: false }))
          : [],
      },
      userId,
    );
    res.status(201).json({ ok: true, task });
  });

  r.patch('/:id', (req, res) => {
    const existing = store.getTask(req.params.id);
    if (!existing || existing.userId !== userId) return res.status(404).json({ ok: false, error: 'Task not found.' });

    const patch: Partial<Task> = {};
    const b = req.body ?? {};
    if (typeof b.title === 'string' && b.title.trim()) patch.title = sanitize(b.title).slice(0, 120);
    if (CATEGORIES.includes(b.category)) patch.category = b.category;
    if ('dueDate' in b) patch.dueDate = isIsoDate(b.dueDate) ? b.dueDate : null;
    if ('dueTime' in b) patch.dueTime = normTime(b.dueTime);
    if ('reminder' in b) patch.reminder = isIsoDate(b.reminder) ? b.reminder : null;
    if (typeof b.location === 'string') patch.location = sanitize(b.location).slice(0, 80);
    if (typeof b.done === 'boolean') patch.done = b.done;
    if (Array.isArray(b.subtasks)) {
      patch.subtasks = b.subtasks
        .filter((s: any) => s && typeof s.title === 'string')
        .slice(0, 10)
        .map((s: any) => ({
          id: String(s.id ?? `st_${Math.random().toString(36).slice(2, 9)}`),
          title: sanitize(String(s.title)).slice(0, 140),
          done: Boolean(s.done),
        }));
    }

    if (PRIORITIES.includes(b.priority)) {
      patch.priority = b.priority;
      const recomputed = computePriority({
        date: patch.dueDate !== undefined ? patch.dueDate : existing.dueDate ?? null,
        time: patch.dueTime !== undefined ? patch.dueTime : existing.dueTime,
        category: patch.category ?? existing.category,
        userPriority: b.priority,
        text: `${patch.title ?? existing.title} ${existing.description ?? ''}`,
      });
      patch.priorityReason = recomputed.reason;
    }

    const task = store.updateTask(req.params.id, patch);
    res.json({ ok: true, task });
  });

  r.delete('/:id', (req, res) => {
    const ok = store.deleteTask(req.params.id);
    if (!ok) return res.status(404).json({ ok: false, error: 'Task not found.' });
    res.json({ ok: true });
  });

  return r;
}

/* ----------------------------------- plan --------------------------------- */

export function planRouter(store: DataStore, userId: string): Router {
  const r = Router();

  r.get('/', (_req, res) => {
    res.json({ ok: true, ...buildPlan(store, userId) });
  });

  r.post('/:id/complete', (req, res) => {
    const task = store.getTask(req.params.id);
    if (!task || task.userId !== userId) return res.status(404).json({ ok: false, error: 'Task not found.' });
    store.updateTask(task.id, { done: true });
    res.json({ ok: true, plan: buildPlan(store, userId) });
  });

  return r;
}

export function buildPlan(store: DataStore, userId: string): PlanResponse {
  const tasks = store.listTasks(userId).filter((t) => !t.done);
  const ranked = rankTasks(tasks);

  // Only things that actually need attention in the next 3 days (or are overdue).
  const relevant = ranked.filter((t) => {
    const d = daysUntil(t.dueDate);
    return (d !== null && d <= 3) || (!t.dueDate && t.priority === 'HIGH');
  });
  // ...and the plan always leads with HIGH priority work, even if a nearer
  // MEDIUM item exists: an optional workshop must never bury an exam.
  const chosen = [
    ...relevant.filter((t) => t.priority === 'HIGH'),
    ...relevant.filter((t) => t.priority === 'MEDIUM'),
    ...relevant.filter((t) => t.priority === 'LOW'),
  ].slice(0, 6);

  const overdue = chosen.filter((t) => (daysUntil(t.dueDate) ?? 99) < 0);
  const today = chosen.filter((t) => daysUntil(t.dueDate) === 0);
  const soon = chosen.filter((t) => {
    const d = daysUntil(t.dueDate);
    return d !== null && d >= 1 && d <= 3;
  });

  const cursor = { h: new Date().getHours() < 8 ? 9 : Math.min(new Date().getHours() + 1, 21) };

  const items: PlanItem[] = chosen.map((t, i) => ({
    rank: i + 1,
    taskId: t.id,
    captureId: t.captureId ?? undefined,
    title: t.title,
    category: t.category,
    priority: t.priority,
    dueLabel: t.dueDate ? relativeLabel(t.dueDate) : 'No date',
    reason: t.priorityReason ?? `Ranked by priority (${t.priority.toLowerCase()}).`,
    timeSlot: t.dueTime ? format12h(t.dueTime) : slot(cursor, t.priority),
    subtasks: t.subtasks.filter((s) => !s.done).slice(0, 3).map((s) => s.title),
  }));

  const counts = {
    high: tasks.filter((t) => t.priority === 'HIGH').length,
    medium: tasks.filter((t) => t.priority === 'MEDIUM').length,
    low: tasks.filter((t) => t.priority === 'LOW').length,
    overdue: overdue.length,
  };

  if (items.length === 0) {
    return {
      summary: 'Nothing is due today. Your LifeLens is clear — a good day to get ahead on upcoming work.',
      recommendation: ranked[0]
        ? `If you want a head start, begin ${ranked[0].title} (${relativeLabel(ranked[0].dueDate)}).`
        : 'Scan a notice, poster or assignment sheet and LifeLens will build your plan automatically.',
      items: [],
      counts,
    };
  }

  const parts: string[] = [];
  if (overdue.length) parts.push(`${overdue.length} overdue`);
  if (today.length) parts.push(`${today.length} due today`);
  if (soon.length) parts.push(`${soon.length} due in the next 3 days`);

  const summary = `You have ${items.length} important ${items.length === 1 ? 'thing' : 'things'} today${
    parts.length ? ` (${parts.join(', ')})` : ''
  }.`;

  // Recommend the first HIGH-priority item; a LOW/optional event never leads.
  const lead = items.find((i) => i.priority === 'HIGH') ?? items.find((i) => i.priority === 'MEDIUM') ?? items[0];
  const recommendation = `I recommend starting with ${lead.title} — ${lead.reason.replace(/^[A-Za-z]+ priority because\s*/i, '')}`;

  return { summary, recommendation, items, counts };
}

function slot(cursor: { h: number }, priority: Priority): string {
  const label = (n: number) => {
    const suffix = n >= 12 ? 'PM' : 'AM';
    const hh = n % 12 === 0 ? 12 : n % 12;
    return `${hh}:00 ${suffix}`;
  };
  const start = Math.min(cursor.h, 21);
  cursor.h = Math.min(22, start + (priority === 'HIGH' ? 2 : 1));
  return `${label(start)} – ${label(cursor.h)}`;
}

/* -------------------------------- assistant ------------------------------- */

export function assistantRouter(store: DataStore, userId: string): Router {
  const r = Router();

  r.post('/', (req, res) => {
    const question = typeof req.body?.question === 'string' ? sanitize(req.body.question).slice(0, 300) : '';
    const out = answerQuestion(question, {
      tasks: store.listTasks(userId),
      captures: store.listCaptures(userId),
    });
    const resp: AssistantResponse = out;
    res.json({ ok: true, ...resp });
  });

  return r;
}

/* --------------------------------- memory --------------------------------- */

export function memoryRouter(store: DataStore, userId: string): Router {
  const r = Router();

  r.get('/', (req, res) => {
    const q = String(req.query.q ?? '').trim();
    if (!q) return res.status(400).json({ ok: false, error: 'Search for something, e.g. “DBMS”.' });
    const needle = q.toLowerCase();

    const captures = store.listCaptures(userId).filter((c) =>
      `${c.result.title} ${c.result.subject ?? ''} ${c.result.description ?? ''} ${c.result.category} ${c.result.sourceText ?? ''}`
        .toLowerCase()
        .includes(needle),
    );
    const tasks = rankTasks(
      store.listTasks(userId).filter((t) =>
        `${t.title} ${t.subject ?? ''} ${t.description ?? ''} ${t.category} ${t.action ?? ''}`.toLowerCase().includes(needle),
      ),
    );

    const answer = captures.length || tasks.length
      ? `I found ${tasks.length} task${tasks.length === 1 ? '' : 's'} and ${captures.length} capture${captures.length === 1 ? '' : 's'} related to “${q}”.`
      : `I don't have anything about “${q}” yet. Scan it and I'll remember it.`;

    res.json({
      ok: true,
      query: q,
      answer,
      captures,
      tasks,
      grouped: groupBySubject([...captures.map((c) => c.result), ...tasks.map(taskToResult)]),
    });
  });

  return r;
}

function taskToResult(t: Task): AnalysisResult {
  return {
    title: t.title,
    description: t.description ?? null,
    category: t.category,
    subject: t.subject ?? null,
    date: t.dueDate ?? null,
    time: t.dueTime ?? null,
    location: t.location ?? null,
    priority: t.priority,
    confidence: 1,
    action: t.action ?? null,
    reminder: t.reminder ?? null,
    tasks: t.subtasks.map((s) => s.title),
    priorityReason: t.priorityReason ?? null,
    uncertainFields: [],
    sourceText: null,
    aiMode: 'demo',
  };
}

function groupBySubject(results: AnalysisResult[]): Array<{ subject: string; count: number; titles: string[] }> {
  const map = new Map<string, string[]>();
  for (const r of results) {
    const key = r.subject ?? r.category;
    map.set(key, [...(map.get(key) ?? []), r.title]);
  }
  return [...map.entries()]
    .map(([subject, titles]) => ({ subject, count: titles.length, titles: [...new Set(titles)] }))
    .sort((a, b) => b.count - a.count);
}

/* ---------------------------------- admin --------------------------------- */

export function adminRouter(store: DataStore, userId: string): Router {
  const r = Router();
  r.post('/reset', (_req, res) => {
    const counts = store.reset(userId);
    res.json({ ok: true, message: 'Demo data restored.', ...counts });
  });
  r.post('/clear', (_req, res) => {
    store.wipe(userId);
    res.json({ ok: true, message: 'All LifeLens data cleared.' });
  });
  return r;
}

/* ------------------------------- validation ------------------------------- */

/**
 * Coerce an AnalysisResult coming from the browser (user may have edited it).
 * Anything we cannot validate is dropped to null instead of trusted.
 */
function coerceResult(input: unknown): AnalysisResult | null {
  if (!input || typeof input !== 'object') return null;
  const b = input as Record<string, unknown>;
  const title = typeof b.title === 'string' ? sanitize(b.title).slice(0, 120) : '';
  if (!title) return null;

  const confidence = Number(b.confidence);

  return {
    title,
    description: typeof b.description === 'string' ? sanitize(b.description).slice(0, 400) : null,
    category: (CATEGORIES.includes(b.category as Category) ? b.category : 'Other') as Category,
    subject: typeof b.subject === 'string' && b.subject.trim() ? sanitize(b.subject).slice(0, 60) : null,
    date: isIsoDate(b.date) ? (b.date as string) : null,
    time: normTime(b.time),
    location: typeof b.location === 'string' && b.location.trim() ? sanitize(b.location).slice(0, 80) : null,
    priority: (PRIORITIES.includes(b.priority as Priority) ? b.priority : 'MEDIUM') as Priority,
    confidence: Number.isFinite(confidence) ? Math.max(0, Math.min(1, confidence)) : 0.5,
    action: typeof b.action === 'string' ? sanitize(b.action).slice(0, 160) : null,
    reminder: isIsoDate(b.reminder) ? (b.reminder as string) : null,
    tasks: Array.isArray(b.tasks)
      ? b.tasks.filter((t): t is string => typeof t === 'string' && t.trim().length > 1).map((t) => sanitize(t).slice(0, 140)).slice(0, 8)
      : [],
    priorityReason: typeof b.priorityReason === 'string' ? sanitize(b.priorityReason).slice(0, 300) : null,
    uncertainFields: Array.isArray(b.uncertainFields)
      ? b.uncertainFields.filter((f): f is string => typeof f === 'string').slice(0, 6)
      : [],
    sourceText: typeof b.sourceText === 'string' ? sanitize(b.sourceText).slice(0, 2000) : null,
    aiMode: b.aiMode === 'gemini' ? 'gemini' : 'demo',
    demoKey: typeof b.demoKey === 'string' ? b.demoKey : undefined,
    note: typeof b.note === 'string' ? sanitize(b.note).slice(0, 300) : undefined,
  };
}

export { humanDate, localDateKey, DAY_MS, priorityRank };
export type { Capture, Task };
