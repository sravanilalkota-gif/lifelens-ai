/**
 * LifeLens — Smart Priority Engine
 * --------------------------------
 * Deliberately simple, explainable, and deterministic. Judges hate black boxes.
 *
 * score = deadline pressure (0-50)
 *       + category importance (0-16)
 *       + explicit urgency words in the text (0-12)
 *       + AI/model's own opinion (0-14)
 *       + user override (0-8)
 *
 * 72+ → HIGH   44+ → MEDIUM   else LOW
 *
 * Every decision also produces a human sentence, e.g.
 *   "High priority — your exam is 2 days away and exams are weighted heavily."
 */
import type { Category, Priority } from '@lifelens/shared';
import { addDays, daysUntil } from '../lib/dates.js';

export interface PriorityInput {
  date: string | null;
  time?: string | null;
  category: Category;
  /** model-suggested priority (may be absent / hallucinated — we only treat it as a vote) */
  aiPriority?: Priority | null;
  /** user explicitly set importance */
  userPriority?: Priority | null;
  /** raw text from the document, used for urgency keyword detection */
  text?: string | null;
  title?: string;
}

export interface PriorityOutput {
  priority: Priority;
  score: number;
  reason: string;
  breakdown: {
    deadline: number;
    category: number;
    urgency: number;
    ai: number;
    user: number;
    daysLeft: number | null;
  };
}

/**
 * Domain rule: dated academic / assignment / health items never fall below
 * MEDIUM — a deadline you can miss is never "low priority". Undated reference
 * captures (a timetable, a syllabus sheet) are exempt.
 */
const FLOOR_CATEGORY = new Set<Category>(['Academic', 'Assignment', 'Health', 'Finance']);

const CATEGORY_WEIGHT: Record<Category, number> = {
  Academic: 14,
  Assignment: 13,
  Finance: 12,
  Health: 12,
  Event: 8,
  Travel: 8,
  Personal: 5,
  Other: 4,
};

const URGENCY_KEYWORDS: Array<[RegExp, number]> = [
  [/\b(mandatory|compulsory|must attend|strictly)\b/i, 12],
  [/\b(last date|deadline|due (by|on)|submit(ted)? by|no late|final call)\b/i, 10],
  [/\b(internal|end sem|semester|final|exam|examination|viva|practical)\b/i, 8],
  [/\b(urgent|immediately|asap|hurry|last chance|penalty|fine|late fee)\b/i, 10],
  [/\b(interview|placement|counselling|registration closes)\b/i, 8],
  [/\b(optional|workshop|seminar|club|fest|meetup|webinar|open to all)\b/i, -6],
];

const AI_VOTE: Record<Priority, number> = { HIGH: 14, MEDIUM: 8, LOW: 2 };
const USER_VOTE: Record<Priority, number> = { HIGH: 8, MEDIUM: 4, LOW: 0 };

function deadlineScore(daysLeft: number | null, hasTimeToday: boolean): number {
  if (daysLeft === null) return 8; // no date → cannot panic, but not ignorable
  if (daysLeft < 0) return 58; // already overdue
  if (daysLeft === 0) return 50;
  if (daysLeft === 1) return 46;
  if (daysLeft <= 3) return 38;
  if (daysLeft <= 7) return 26;
  if (daysLeft <= 14) return 14;
  if (daysLeft <= 30) return 7;
  return 3;
}

function urgencyScore(text: string): { score: number; hits: string[] } {
  let score = 0;
  const hits: string[] = [];
  for (const [re, weight] of URGENCY_KEYWORDS) {
    if (re.test(text)) {
      score += weight;
      hits.push(text.match(re)?.[0]?.toLowerCase() ?? '');
    }
  }
  return { score: Math.max(-8, Math.min(12, score)), hits: hits.filter(Boolean) };
}

function daysPhrase(daysLeft: number): string {
  if (daysLeft === 0) return 'is due today';
  if (daysLeft === 1) return 'is due tomorrow';
  return `is ${daysLeft} days away`;
}

export function computePriority(input: PriorityInput): PriorityOutput {
  const daysLeft = daysUntil(input.date);
  const text = `${input.title ?? ''} ${input.text ?? ''}`;

  const deadline = deadlineScore(daysLeft, Boolean(input.time));
  const category = CATEGORY_WEIGHT[input.category] ?? 6;
  const urgency = urgencyScore(text);
  const ai = input.aiPriority ? AI_VOTE[input.aiPriority] : 0;
  const user = input.userPriority ? USER_VOTE[input.userPriority] : 0;

  const score = Math.max(0, Math.min(100, deadline + category + urgency.score + ai + user));
  const applyFloor =
    FLOOR_CATEGORY.has(input.category) && !input.userPriority && daysLeft !== null && daysLeft >= 0 && daysLeft <= 120;
  const effective = applyFloor ? Math.max(score, 44) : score;
  // An explicit importance set by the user always wins — that is the whole
  // point of the confirmation card. The engine only decides when they don't.
  const priority: Priority = input.userPriority
    ? input.userPriority
    : effective >= 72
      ? 'HIGH'
      : effective >= 44
        ? 'MEDIUM'
        : 'LOW';

  const label = priority === 'HIGH' ? 'High' : priority === 'MEDIUM' ? 'Medium' : 'Low';
  const bits: string[] = [];

  if (daysLeft === null) {
    bits.push('no date was found in the capture');
  } else if (daysLeft < 0) {
    bits.push(`it is already ${Math.abs(daysLeft)} day${Math.abs(daysLeft) === 1 ? '' : 's'} overdue`);
  } else if (daysLeft === 0) {
    bits.push(`it is due today${input.time ? ` at ${input.time}` : ''}`);
  } else if (daysLeft <= 3) {
    bits.push(`it ${daysPhrase(daysLeft)}`);
  } else {
    bits.push(`it ${daysPhrase(daysLeft)}`);
  }

  if (input.category === 'Academic' || input.category === 'Assignment') {
    bits.push('academic work is weighted heavily');
  } else if (input.category === 'Finance') {
    bits.push('money deadlines carry penalties');
  } else if (input.category === 'Health') {
    bits.push('health items should not slip');
  } else if (input.category === 'Event') {
    bits.push('events are usually flexible');
  }

  if (urgency.score >= 8 && urgency.hits[0]) bits.push(`the text says "${urgency.hits[0]}"`);
  if (urgency.score <= -6) bits.push('it looks optional');
  if (input.userPriority) bits.push(`you marked it ${input.userPriority.toLowerCase()} importance`);
  if (applyFloor && effective > score) {
    bits.push(`${input.category.toLowerCase()} work with a real deadline is never treated as low priority`);
  }

  const reason = `${label} priority because ${bits.join(' and ')}.`;

  return {
    priority,
    score: effective,
    reason,
    breakdown: { deadline, category, urgency: urgency.score, ai, user, daysLeft },
  };
}

/**
 * Pick a sensible reminder date. Never invents a reminder for an undated item.
 */
export function suggestReminder(date: string | null, category: Category): string | null {
  const d = daysUntil(date);
  if (!date || d === null) return null;
  if (d <= 0) return date; // today/overdue → remind immediately
  if (category === 'Academic' || category === 'Assignment') {
    return addDays(date, -Math.min(3, Math.max(1, Math.floor(d / 2))));
  }
  if (category === 'Finance') return addDays(date, -Math.min(2, Math.max(1, d - 1)));
  if (d <= 2) return date;
  return addDays(date, -1);
}
