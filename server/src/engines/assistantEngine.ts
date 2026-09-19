/**
 * LifeLens — Question Answering / "memory layer" engine.
 *
 * Answers natural questions ("What do I need to finish today?", "When is my
 * DBMS exam?", "What did I scan yesterday?") from the user's OWN captured data.
 *
 * Intent matching is intentionally transparent and local so it works in Demo
 * Mode with zero latency and zero API cost — and the same intents can later be
 * routed to a real LLM without touching the UI.
 */
import type { Capture, Task } from '@lifelens/shared';
import { priorityRank } from '@lifelens/shared';
import { daysUntil, format12h, humanDate, relativeLabel } from '../lib/dates.js';

export interface AssistantAnswer {
  answer: string;
  intent: string;
  items: Array<{ id: string; title: string; priority: Task['priority']; dueDate: string | null; category: Task['category'] }>;
}

interface Ctx {
  tasks: Task[];
  captures: Capture[];
}

const EMOJI: Record<Task['priority'], string> = { HIGH: '🔴', MEDIUM: '🟠', LOW: '🟢' };

function openTasks(ctx: Ctx): Task[] {
  return ctx.tasks.filter((t) => !t.done);
}

/**
 * LifeLens ordering: a HIGH-priority item always outranks a nearer MEDIUM/LOW
 * one (an optional workshop tomorrow must not bury an exam in three days).
 * Inside the same priority tier, the nearest deadline wins.
 */
export function rankTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    const pa = priorityRank(a.priority);
    const pb = priorityRank(b.priority);
    if (pa !== pb) return pb - pa;
    const da = daysUntil(a.dueDate);
    const db = daysUntil(b.dueDate);
    if (da === null && db === null) return 0;
    if (da === null) return 1;
    if (db === null) return -1;
    return da - db;
  });
}

function bullet(t: Task): string {
  const due = t.dueDate ? ` — ${relativeLabel(t.dueDate)}${t.dueTime ? `, ${format12h(t.dueTime)}` : ''}` : '';
  return `${EMOJI[t.priority]} ${t.title}${due}`;
}

function matches(t: { title: string; subject?: string | null; description?: string | null; category: string }, term: string): boolean {
  const hay = `${t.title} ${t.subject ?? ''} ${t.description ?? ''} ${t.category}`.toLowerCase();
  return term
    .toLowerCase()
    .split(/\s+/)
    .filter(Boolean)
    .every((w) => hay.includes(w));
}

function extractSubjectTerm(q: string): string | null {
  // "when is my DBMS exam" / "anything about operating systems"
  const m = q.match(/\b(?:my|the|about|on|for|related to)\s+([a-z0-9 &+-]{2,30}?)\s+(?:exam|examination|assignment|test|internal|workshop|event|fee|task|class|lab|session)\b/i);
  if (m) return m[1].trim();
  const known = [
    'DBMS', 'Operating Systems', 'OS', 'Computer Networks', 'CN', 'DSA', 'Machine Learning',
    'Artificial Intelligence', 'AI', 'Python', 'Java', 'Software Engineering', 'Compiler Design',
    'Cloud Computing', 'Mini Project', 'library', 'fee', 'timetable',
  ];
  for (const k of known) {
    const re = new RegExp(`\\b${k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(q)) return k;
  }
  return null;
}

function capturesOnDay(ctx: Ctx, daysAgo: number): Capture[] {
  const target = new Date();
  target.setDate(target.getDate() - daysAgo);
  const key = `${target.getFullYear()}-${String(target.getMonth() + 1).padStart(2, '0')}-${String(target.getDate()).padStart(2, '0')}`;
  return ctx.captures.filter((c) => c.createdAt.slice(0, 10) === key);
}

export function answerQuestion(question: string, ctx: Ctx): AssistantAnswer {
  const q = question.trim();
  const lower = q.toLowerCase();
  const open = rankTasks(openTasks(ctx));
  const items = (ts: Task[]) =>
    ts.slice(0, 8).map((t) => ({
      id: t.id,
      title: t.title,
      priority: t.priority,
      dueDate: t.dueDate ?? null,
      category: t.category,
    }));

  if (!q) {
    return { answer: 'Ask me anything about your captures — for example “What should I finish first?”', intent: 'empty', items: [] };
  }

  /* -------------------------------- greeting ------------------------------- */
  if (/^(hi|hello|hey|namaste|yo)\b/.test(lower) && lower.length < 20) {
    return {
      answer: `Hey! You have ${open.length} open ${open.length === 1 ? 'item' : 'items'} in LifeLens. Want to know what to finish first?`,
      intent: 'greeting',
      items: items(open.slice(0, 3)),
    };
  }

  /* ------------------------------ what to do ------------------------------- */
  if (/(finish first|start with|first|most urgent|urgent|priority|do first|what should i do|today's plan|todays plan|plan)/.test(lower)) {
    const urgent = open.filter((t) => t.priority === 'HIGH').length
      ? open.filter((t) => t.priority === 'HIGH')
      : open.slice(0, 3);
    const top = urgent[0];
    if (!top) return { answer: 'Nothing urgent right now — you are all caught up. 🎉', intent: 'first', items: [] };
    const why =
      daysUntil(top.dueDate) !== null && (daysUntil(top.dueDate) as number) <= 3
        ? `it is ${relativeLabel(top.dueDate)}`
        : top.priorityReason ?? 'it is your highest-priority open item';
    return {
      answer: `Start with ${top.title} — ${why}. ${
        urgent[1] ? `After that, move on to ${urgent[1].title}.` : ''
      }`,
      intent: 'first',
      items: items(urgent),
    };
  }

  /* ------------------------------- today list ------------------------------ */
  if (/(today|tonight|right now|finish today|need to do)/.test(lower)) {
    const today = rankTasks(open.filter((t) => (daysUntil(t.dueDate) ?? 1) <= 0));
    const tomorrow = rankTasks(open.filter((t) => daysUntil(t.dueDate) === 1));
    const undatedHigh = rankTasks(open.filter((t) => daysUntil(t.dueDate) === null && t.priority === 'HIGH'));

    if (today.length === 0 && tomorrow.length === 0 && undatedHigh.length === 0) {
      return {
        answer:
          'You have nothing due today. Your next item is ' +
          (open[0] ? `${open[0].title} (${relativeLabel(open[0].dueDate)}).` : 'nothing on the list — enjoy the free time!'),
        intent: 'today',
        items: items(open.slice(0, 3)),
      };
    }

    const lines: string[] = [];
    if (today.length) {
      lines.push(
        today.length === 1 ? 'You have 1 thing to finish today:' : `You have ${today.length} things to finish today:`,
        ...today.map(bullet),
      );
    } else {
      lines.push('Nothing is due today.');
    }
    if (tomorrow.length) {
      lines.push('', tomorrow.length === 1 ? 'Tomorrow:' : `Tomorrow (${tomorrow.length}):`, ...tomorrow.map(bullet));
    }
    if (undatedHigh.length) {
      lines.push('', 'No date, but high priority:', ...undatedHigh.map(bullet));
    }
    // Never tell the user to start with an optional event when real work exists.
    const first =
      [...today, ...tomorrow, ...undatedHigh].find((t) => t.priority === 'HIGH') ??
      [...today, ...tomorrow, ...undatedHigh].find((t) => t.priority === 'MEDIUM') ??
      today[0] ??
      tomorrow[0];
    if (first) lines.push('', `I recommend finishing ${first.title} first.`);

    return { answer: lines.join('\n'), intent: 'today', items: items([...today, ...tomorrow, ...undatedHigh]) };
  }

  /* ----------------------------- next deadline ----------------------------- */
  if (/(next deadline|upcoming|what's next|whats next|next task|soonest|earliest)/.test(lower)) {
    const dated = open.filter((t) => t.dueDate);
    if (!dated.length) return { answer: 'You have no dated deadlines right now.', intent: 'next_deadline', items: [] };
    const next = dated[0];
    return {
      answer: `Your next deadline is ${next.title} — ${relativeLabel(next.dueDate)}${
        next.dueTime ? ` at ${format12h(next.dueTime)}` : ''
      }${next.location ? `, ${next.location}` : ''}.`,
      intent: 'next_deadline',
      items: items([next, ...dated.slice(1, 3)]),
    };
  }

  /* --------------------------------- exams --------------------------------- */
  if (/(exam|examination|internal|end sem|test|viva)/.test(lower)) {
    const term = extractSubjectTerm(q);
    const exams = rankTasks(
      ctx.tasks.filter(
        (t) =>
          t.category === 'Academic' &&
          /exam|examination|internal|test|viva|end sem/i.test(`${t.title} ${t.description ?? ''}`) &&
          (!term || matches(t, term)),
      ),
    );
    if (!exams.length) {
      return { answer: 'I could not find any exams in your captures yet. Scan a notice and I will keep track.', intent: 'exams', items: [] };
    }
    return {
      answer:
        `You have ${exams.length} exam${exams.length === 1 ? '' : 's'} on record.\n` +
        exams.map(bullet).join('\n'),
      intent: 'exams',
      items: items(exams),
    };
  }

  /* ------------------------------- captured on ----------------------------- */
  const scanned = lower.match(/(scan|capture|photo|photograph|upload)(?:ned|s|ed)?\s+(today|yesterday|this week)/);
  if (scanned || /(what did i scan|my captures|capture history)/.test(lower)) {
    const when = scanned?.[2] ?? 'this week';
    let list: Capture[] = [];
    if (when === 'today') list = capturesOnDay(ctx, 0);
    else if (when === 'yesterday') list = capturesOnDay(ctx, 1);
    else list = ctx.captures.filter((c) => Date.now() - +new Date(c.createdAt) < 7 * 86400000);
    if (!list.length) {
      return { answer: `I don't have any captures from ${when} yet.`, intent: 'history', items: [] };
    }
    return {
      answer:
        `${list.length} capture${list.length === 1 ? '' : 's'} ${when === 'this week' ? 'this week' : when}:\n` +
        list
          .map((c) => `📷 ${c.result.title} — ${c.result.category}, ${c.result.priority.toLowerCase()} priority`)
          .join('\n'),
      intent: 'history',
      items: list.map((c) => ({
        id: c.id,
        title: c.result.title,
        priority: c.result.priority,
        dueDate: c.result.date,
        category: c.result.category,
      })),
    };
  }

  /* ------------------------------- this week ------------------------------- */
  if (/(this week|coming week|next 7 days|week)/.test(lower)) {
    const week = open.filter((t) => {
      const d = daysUntil(t.dueDate);
      return d !== null && d >= 0 && d <= 7;
    });
    if (!week.length) return { answer: 'Nothing is due in the next 7 days.', intent: 'week', items: [] };
    return {
      answer: `This week you have ${week.length} ${week.length === 1 ? 'deadline' : 'deadlines'}:\n` + week.map(bullet).join('\n'),
      intent: 'week',
      items: items(week),
    };
  }

  /* ------------------------------- completed ------------------------------- */
  if (/(done|finished|completed|progress|how much)/.test(lower)) {
    const done = ctx.tasks.filter((t) => t.done).length;
    const total = ctx.tasks.length;
    const pct = total ? Math.round((done / total) * 100) : 0;
    return {
      answer: `You have completed ${done} of ${total} tasks (${pct}%). ${
        open[0] ? `Next up: ${open[0].title}.` : 'Nothing left to do — nice work!'
      }`,
      intent: 'progress',
      items: items(open.slice(0, 3)),
    };
  }

  /* ------------------------- memory / topic search ------------------------- */
  const term = extractSubjectTerm(q) ?? q.replace(/^(show|find|search|list|tell me about|anything about|everything about)\s+(me\s+)?/i, '').trim();
  if (term && term.length > 1) {
    const hits = ctx.tasks.filter((t) => matches(t, term));
    const captureHits = ctx.captures.filter((c) => matches(c.result, term));
    if (hits.length || captureHits.length) {
      const lines = [
        ...rankTasks(hits).map(bullet),
        ...captureHits
          .filter((c) => !hits.some((h) => h.captureId === c.id))
          .map((c) => `📷 ${c.result.title} — captured ${new Date(c.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}`),
      ];
      return {
        answer: `Everything I have about “${term}”:\n${lines.slice(0, 8).join('\n')}`,
        intent: 'memory',
        items: items(hits),
      };
    }
  }

  /* -------------------------------- fallback ------------------------------- */
  const upcoming = open.slice(0, 3);
  return {
    answer: upcoming.length
      ? `I'm not sure I understood that, but here is what matters right now:\n${upcoming.map(bullet).join('\n')}\n\nYou can also ask: “What do I need to finish today?”, “What is my next deadline?”, “When is my DBMS exam?” or “Show me everything about DBMS”.`
      : 'Your LifeLens is empty — scan a notice or poster and I will start keeping track for you.',
    intent: 'fallback',
    items: items(upcoming),
  };
}

export { humanDate };
