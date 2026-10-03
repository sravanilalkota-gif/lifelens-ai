/**
 * LifeLens — Rule-based Understanding Engine (Demo Mode).
 *
 * This is NOT an OCR wrapper. It reads text (pasted by the user, or the text
 * printed on one of the bundled sample documents) and returns the SAME
 * structured AnalysisResult shape the Gemini vision service returns:
 * title, category, subject, date, time, location, priority, action, tasks…
 *
 * Hard rule: never invent a date/time/location. If it is not in the text,
 * it is null and the field is listed in `uncertainFields` so the UI can ask
 * the user to confirm it.
 */
import type { AnalysisResult, Category } from '@lifelens/shared';
import { computePriority, suggestReminder } from '../engines/priorityEngine.js';
import { addDays, daysUntil, isIsoTime, localDateKey, normTime } from '../lib/dates.js';
import { findDemoDoc, getDemoDoc } from '../data/demoData.ts';

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, feb: 2, february: 2, mar: 3, march: 3, apr: 4, april: 4,
  may: 5, jun: 6, june: 6, jul: 7, july: 7, aug: 8, august: 8, sep: 9, sept: 9,
  september: 9, oct: 10, october: 10, nov: 11, november: 11, dec: 12, december: 12,
};

const WEEKDAYS: Record<string, number> = {
  sunday: 0, sun: 0, monday: 1, mon: 1, tuesday: 2, tue: 2, tues: 2,
  wednesday: 3, wed: 3, thursday: 4, thu: 4, thur: 4, thurs: 4,
  friday: 5, fri: 5, saturday: 6, sat: 6,
};

const CATEGORY_RULES: Array<{ category: Category; re: RegExp }> = [
  { category: 'Assignment', re: /\b(assignment|lab record|submission|submit|project report)\b/i },
  { category: 'Academic', re: /\b(exam|examination|internal|semester|end sem|mid term|viva|practical|syllabus|timetable|time table|attendance|library|quiz|test)\b/i },
  { category: 'Event', re: /\b(workshop|seminar|webinar|fest|meetup|hackathon|guest lecture|symposium|club|orientation|concert|cultural)\b/i },
  { category: 'Finance', re: /\b(fee|fees|payment|invoice|receipt|bill|tuition|challan|refund|scholarship|amount payable|₹|rs\.?|rupees)\b/i },
  { category: 'Health', re: /\b(appointment|doctor|clinic|hospital|dental|vaccination|checkup|check-up|medicine|prescription)\b/i },
  { category: 'Travel', re: /\b(flight|train|bus|ticket|boarding|pnr|itinerary|check-?in|departure)\b/i },
  { category: 'Personal', re: /\b(birthday|anniversary|gym|family|wedding|personal)\b/i },
];

const SUBJECT_WORDS = [
  'DBMS', 'Operating Systems', 'OS', 'Computer Networks', 'CN', 'Data Structures', 'DSA',
  'Algorithms', 'Machine Learning', 'ML', 'Artificial Intelligence', 'AI', 'Python', 'Java',
  'Software Engineering', 'SE', 'Discrete Mathematics', 'Digital Electronics', 'Cloud Computing',
  'Cyber Security', 'Web Technologies', 'Compiler Design', 'Theory of Computation', 'Statistics',
  'Physics', 'Chemistry', 'Mathematics', 'English', 'Mini Project',
];

const LOCATION_RE =
  /\b(?:venue|room|at|in|location|hall|lab|block)\s*:?\s*([A-Z][A-Za-z0-9 .\-]{2,40})/;

export interface DemoAnalysisOptions {
  text?: string;
  fileName?: string;
  /** explicitly requested sample document (the Capture page's sample buttons) */
  demoKey?: string;
}

/* ------------------------------- date parsing ------------------------------ */

/** Month word → number. Matches "September", "Sept.", "Sep" but NOT "week". */
const MONTH_WORD =
  '(?:january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sept|sep|oct|nov|dec)';

function monthOf(word: string): number | null {
  const w = word.toLowerCase().replace(/\.$/, '');
  if (MONTHS[w]) return MONTHS[w];
  // "sept" / "september" both resolve through the 4-letter prefix table
  const prefix = w.slice(0, 3);
  return MONTHS[prefix] ?? MONTHS[w.slice(0, 4)] ?? null;
}

function parseDate(text: string): { date: string | null; ambiguous: boolean; found: boolean } {
  const now = new Date();
  const year = now.getFullYear();

  // explicit ISO
  const iso = text.match(/(\d{4})-(\d{2})-(\d{2})/);
  if (iso) return { date: iso[0], ambiguous: false, found: true };

  // "28 September" / "28 Sep 2026" / "September 28"
  const dmy = text.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_WORD})\\.?\\s*(\\d{4})?\\b`, 'i'));
  const mdy = text.match(new RegExp(`\\b(${MONTH_WORD})\\.?\\s+(\\d{1,2})(?:st|nd|rd|th)?\\s*,?\\s*(\\d{4})?\\b`, 'i'));
  const hit = dmy ?? mdy;
  if (hit) {
    const day = Number(dmy ? hit[1] : hit[2]);
    const month = monthOf(dmy ? hit[2] : hit[1]);
    const y = hit[3];
    if (month && day >= 1 && day <= 31) {
      const candidate = `${y ?? year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      const d = daysUntil(candidate);
      // a bare "28 September" in the past is almost certainly next year
      const resolved = d !== null && d < -180 && !y ? `${year + 1}${candidate.slice(4)}` : candidate;
      return { date: resolved, ambiguous: !y, found: true };
    }
  }

  // dd/mm/yyyy or dd-mm-yyyy
  const slash = text.match(/\b(\d{1,2})[/-](\d{1,2})[/-](\d{2,4})\b/);
  if (slash) {
    let [, d, m, y] = slash;
    if (Number(d) > 12 && Number(m) <= 12) { /* keep d/m */ }
    else if (Number(m) > 12) { const t = d; d = m; m = t; }
    const yy = y.length === 2 ? `20${y}` : y;
    const candidate = `${yy}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    if (!Number.isNaN(new Date(`${candidate}T00:00:00`).getTime())) {
      return { date: candidate, ambiguous: true, found: true };
    }
  }

  const lower = text.toLowerCase();
  const today = localDateKey(now);

  if (/\b(today|tonight)\b/.test(lower)) return { date: today, ambiguous: false, found: true };
  if (/\btomorrow\b/.test(lower)) return { date: addDays(today, 1), ambiguous: false, found: true };
  if (/\bday after tomorrow\b/.test(lower)) return { date: addDays(today, 2), ambiguous: false, found: true };

  const rel = lower.match(/\bin\s+(\d{1,3})\s+(day|week|month)s?\b/);
  if (rel) {
    const n = Number(rel[1]);
    const add = rel[2] === 'day' ? n : rel[2] === 'week' ? n * 7 : n * 30;
    return { date: addDays(today, add), ambiguous: true, found: true };
  }

  if (/\b(next week|coming week)\b/.test(lower)) return { date: addDays(today, 7), ambiguous: true, found: true };
  if (/\b(next month)\b/.test(lower)) return { date: addDays(today, 30), ambiguous: true, found: true };
  if (/\b(this weekend|weekend)\b/.test(lower)) {
    const delta = (6 - now.getDay() + 7) % 7 || 6;
    return { date: addDays(today, delta), ambiguous: true, found: true };
  }
  if (/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/.test(lower)) {
    const m2 = lower.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/);
    const target = WEEKDAYS[m2![1]];
    const delta = (target - now.getDay() + 7) % 7 || 7;
    return { date: addDays(today, delta), ambiguous: true, found: true };
  }
  if (/\bend of (the )?month\b/.test(lower)) {
    const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
    return { date: localDateKey(end), ambiguous: true, found: true };
  }

  return { date: null, ambiguous: false, found: false };
}

function parseTime(text: string): string | null {
  // "2:00 PM" / "14:00" / "10.00 am" / "5 PM"
  const withMinutes = text.match(/\b(\d{1,2})[:.](\d{2})\s*(am|pm)?\b/i);
  const hourOnly = text.match(/\b(\d{1,2})\s*(am|pm)\b/i);
  const m = withMinutes ?? hourOnly;
  if (!m) return null;

  let h = Number(m[1]);
  const mm = withMinutes ? Number(withMinutes[2]) : 0;
  const suffix = (withMinutes ? withMinutes[3] : hourOnly?.[2])?.toLowerCase();
  if (suffix === 'pm' && h < 12) h += 12;
  if (suffix === 'am' && h === 12) h = 0;
  // a 24-hour value with no am/pm must look like a clock (e.g. 14:00), not "25"
  if (!suffix && !withMinutes) return null;
  if (h > 23 || mm > 59) return null;
  return `${String(h).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
}

function detectCategory(text: string): Category {
  for (const rule of CATEGORY_RULES) if (rule.re.test(text)) return rule.category;
  return 'Other';
}

function detectSubject(text: string): string | null {
  const lower = ` ${text.toLowerCase()} `;
  // longest match first so "Operating Systems" beats "OS"
  const sorted = [...SUBJECT_WORDS].sort((a, b) => b.length - a.length);
  for (const s of sorted) {
    const re = new RegExp(`\\b${s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (re.test(lower)) {
      if (s === 'OS' && !/\b(operating\s+systems?|os\s+(lab|assignment|exam))\b/i.test(lower)) continue;
      if (s === 'CN' && !/\b(computer\s+networks?|cn\s+(lab|assignment|exam))\b/i.test(lower)) continue;
      if (s === 'SE' && !/\b(software\s+engineering|se\s+(lab|assignment|exam))\b/i.test(lower)) continue;
      if (s === 'AI' && !/\b(artificial\s+intelligence|ai\s+(workshop|lab|assignment|exam))\b/i.test(lower)) continue;
      if (s === 'ML' && !/\b(machine\s+learning|ml\s+(lab|assignment|exam))\b/i.test(lower)) continue;
      return s;
    }
  }
  return null;
}

function detectLocation(text: string): string | null {
  const m = text.match(LOCATION_RE);
  if (m) return m[1].trim().replace(/\s+/g, ' ');
  const known = text.match(/\b(Seminar Hall\s*\d*|Main Auditorium|OS Lab|DBMS Lab|Lab\s*\d|Central Library|Room\s*\d+|Auditorium)\b/i);
  return known ? known[1] : null;
}

function detectAmount(text: string): string | null {
  const m = text.match(/(?:₹|rs\.?\s*|rupees\s*)([\d,]+(?:\.\d{1,2})?)/i);
  return m ? `₹${m[1]}` : null;
}

/** Title-case without destroying acronyms (DBMS, AI, OS, SQL, ID). */
/** Capitalise the first letter without destroying acronyms (DBMS, AI, OS, SQL). */
function titleCase(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildTitle(text: string, category: Category, subject: string | null): string {
  const lower = text.toLowerCase();
  const subjectPart = subject ? `${subject} ` : '';
  if (category === 'Assignment') {
    const n = text.match(/assignment\s*(\d+)/i);
    return `${subjectPart}Assignment${n ? ` ${n[1]}` : ''}`.trim();
  }
  if (/\b(internal|mid\s*term)\b/.test(lower) && /\b(exam|examination|test)\b/.test(lower)) {
    return `${subjectPart}Internal Examination`.trim();
  }
  if (/\b(end\s*sem|final)\b/.test(lower) && /\b(exam|examination)\b/.test(lower)) {
    return `${subjectPart}End Semester Examination`.trim();
  }
  if (/\bviva\b/.test(lower)) return `${subjectPart}Viva`.trim();
  if (/\bexam|examination\b/.test(lower)) return `${subjectPart}Examination`.trim();
  if (/\bworkshop\b/.test(lower)) return `${subjectPart || 'AI '}Workshop`.trim();
  if (/\bmeetup|meet-up\b/.test(lower)) return `${subjectPart}Club Meetup`.trim();
  if (/\bseminar|webinar|guest lecture\b/.test(lower)) return `${subjectPart || ''}Seminar`.trim();
  if (/\bfee\b/.test(lower)) return 'Tuition Fee Payment';
  if (/\breceipt|invoice|bill\b/.test(lower)) return 'Payment Receipt';
  if (/\btimetable|time table|schedule\b/.test(lower)) return 'Class Timetable';
  if (/\bappointment\b/.test(lower)) {
    const place = text.match(/\b([A-Z][a-z]+(?:\s+[A-Z][a-z]+)?)\s+(clinic|hospital|appointment)/);
    return `${place ? `${place[1]} ` : ''}Appointment`.trim();
  }
  if (/\breturn\b/.test(lower) && /\blibrary\b/.test(lower)) return 'Return Library Book';
  return tidyTitle(text.split(/\n/).map((l) => l.trim()).filter(Boolean)[0] ?? 'New capture');
}

/** Clean up a raw first line into a presentable title. */
function tidyTitle(line: string): string {
  let t = line
    // strip dates / times / venues — those live in their own fields, not the title
    .replace(new RegExp(`\\b(?:on|at|by|from|in|due)\\s+(?:the\\s+)?\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH_WORD}\\.?(?:\\s+\\d{4})?`, 'gi'), '')
    .replace(/\b\d{1,2}[:.]\d{2}\s*(?:am|pm)?\b/gi, '')
    .replace(/\b\d{1,2}\s*(?:am|pm)\b/gi, '')
    .replace(new RegExp('\\b(?:on|at|by|from|in)\\s+(?:today|tonight|tomorrow|monday|tuesday|wednesday|thursday|friday|saturday|sunday)', 'gi'), '')
    .replace(/\b(?:in|at)\s+(?:lab|room|hall|block|auditorium)\s*\d*\b/gi, '')
    .replace(/\s{2,}/g, ' ')
    // drop dangling prepositions left behind by the stripping above
    .replace(/[\s,]+(?:on|at|by|in|from|due|and|the|to|for)+$/i, '')
    .replace(/^[,\s]+|[,\s]+$/g, '')
    .trim();
  if (!t) t = line.trim();
  if (t.length > 46) {
    const cut = t.slice(0, 46);
    t = cut.slice(0, cut.lastIndexOf(' ')).trim();
  }
  return titleCase(t) || 'New capture';
}

const TASK_TEMPLATES: Record<Category, (subject: string | null, title: string) => string[]> = {
  Academic: (s, t) => {
    if (/timetable|schedule/i.test(t)) {
      return [
        'Add the weekly slots to your calendar',
        'Block time before each lab session',
        'Prepare notes for the first class of the week',
      ];
    }
    if (/library/i.test(t)) {
      return [`Return the ${s ?? ''} book before the due date`.trim(), 'Note down any pages you still need'];
    }
    return [
      `Revise the ${s ?? ''} syllabus for this exam`.trim(),
      'Solve 10 previous question papers',
      'Make a one-page formula/summary sheet',
      'Sleep early the night before',
    ];
  },
  Assignment: (s) => [
    `Draft the ${s ?? 'assignment'} answers`.trim(),
    'Review and proofread your submission',
    'Submit before the deadline (and get it signed if needed)',
  ],
  Event: (s, t) => [
    `Register for the ${s ?? t} if registration is required`.trim(),
    'Check the venue and reach 10 minutes early',
    'Take notes and follow up afterwards',
  ],
  Finance: () => [
    'Verify the exact amount payable',
    'Complete the payment online or at the counter',
    'Save the receipt / transaction ID',
  ],
  Health: () => [
    'Confirm the appointment timing',
    'Carry previous reports and ID',
    'Reach 10 minutes early',
  ],
  Travel: () => [
    'Confirm your booking and PNR',
    'Pack and keep documents ready',
    'Leave early to account for traffic',
  ],
  Personal: (_s, t) => [`Plan for: ${t}`, 'Set aside the time in your calendar'],
  Other: (_s, t) => [`Decide what to do about: ${t}`, 'Add the details to your notes'],
};

function buildTasks(category: Category, subject: string | null, title: string, text: string): string[] {
  const base = (TASK_TEMPLATES[category] as (s: string | null, t: string) => string[])(subject, title);
  const extra: string[] = [];
  const amount = detectAmount(text);
  if (amount && !base.some((b) => b.includes(amount))) base[0] = base[0].replace(/amount|exact amount/i, `amount (${amount})`);
  if (/\bid card|identity card\b/i.test(text)) extra.push('Carry your college ID card');
  if (/\bmandatory|compulsory\b/i.test(text)) extra.push('Attendance is mandatory — do not skip');
  if (/\bbring (your )?laptop\b/i.test(text)) extra.push('Bring your laptop');
  return [...base.filter(Boolean), ...extra].slice(0, 5);
}

/** Drop a leading subject from a title so we never say "DBMS DBMS assignment". */
function withoutSubject(title: string, subject: string | null): string {
  if (!subject) return title;
  const re = new RegExp(`^${subject.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s+`, 'i');
  return title.replace(re, '').trim() || title;
}

function buildAction(category: Category, subject: string | null, title: string, date: string | null): string {
  const rest = withoutSubject(title, subject);
  const when = date ? ` (${daysUntil(date) === 0 ? 'today' : `by ${date}`})` : '';
  const restLower = rest.charAt(0).toLowerCase() + rest.slice(1);
  const label = subject ? `${subject} ${restLower}` : title;

  switch (category) {
    case 'Assignment':
      return `Complete and submit the ${label}`.replace(/\s+/g, ' ').trim();
    case 'Academic':
      if (/timetable|schedule/i.test(title)) return 'Note down your weekly class schedule';
      if (/library/i.test(title)) return 'Return the library book before the fine starts';
      return `Prepare for the ${label}`.replace(/\s+/g, ' ').trim();
    case 'Event':
      return `Attend the ${title}`;
    case 'Finance':
      return `Pay the outstanding amount${when}`;
    case 'Health':
      return `Attend your ${title[0]?.toLowerCase()}${title.slice(1)}`;
    default:
      return `Take care of: ${title}`;
  }
}

/* --------------------------------- public -------------------------------- */

export function analyzeText(opts: DemoAnalysisOptions): AnalysisResult {
  const rawText = (opts.text ?? '').trim();

  // 1. A sample document, either explicitly requested (demoKey) or recognised
  //    from an uploaded file name when there is no text we can read ourselves.
  //    Real typed text always goes to the rule engine below, so
  //    "Submit DBMS assignment by Friday" is understood on its own terms.
  const doc = opts.demoKey ? getDemoDoc(opts.demoKey) : rawText ? undefined : findDemoDoc(opts.fileName ?? '');
  if (doc) {
    const cloned: AnalysisResult = {
      ...doc.result,
      sourceText: doc.ocrText,
      aiMode: 'demo',
      demoKey: doc.key,
      note: 'Demo Mode — matched a bundled sample document. Add a Gemini API key for live vision.',
    };
    // Re-run the priority engine so the reason matches the real distance from today.
    const p = computePriority({
      date: cloned.date,
      time: cloned.time,
      category: cloned.category,
      aiPriority: cloned.priority,
      text: `${cloned.title} ${cloned.sourceText}`,
    });
    cloned.priority = p.priority;
    cloned.priorityReason = p.reason;
    cloned.reminder = cloned.reminder ?? suggestReminder(cloned.date, cloned.category);
    return cloned;
  }

  // 2. Understand the free text with the rule engine.
  const text = rawText || opts.fileName || '';
  if (!text) {
    return emptyResult('Nothing to understand yet — upload an image or type what it says.');
  }

  const { date, ambiguous } = parseDate(text);
  const time = parseTime(text);
  const category = detectCategory(text);
  const subject = detectSubject(text);
  const location = detectLocation(text);
  const title = buildTitle(text, category, subject);

  const priority = computePriority({
    date,
    time,
    category,
    text: `${title} ${text}`,
  });

  const uncertain: string[] = [];
  if (!date) uncertain.push('date');
  else if (ambiguous) uncertain.push('date');
  if (!time) uncertain.push('time');
  if (!location) uncertain.push('location');
  if (!subject) uncertain.push('subject');

  const confidence = Number(
    (0.45 + (date ? 0.2 : 0) + (time ? 0.08 : 0) + (subject ? 0.1 : 0) + (category !== 'Other' ? 0.1 : 0) + (location ? 0.07 : 0)).toFixed(2),
  );

  const amount = detectAmount(text);
  const description = [
    `LifeLens read this as a ${category.toLowerCase()} item${subject ? ` related to ${subject}` : ''}.`,
    date ? `It is scheduled for ${date}${time ? ` at ${time}` : ''}.` : 'No date was stated in the capture.',
    amount ? `Amount mentioned: ${amount}.` : '',
  ]
    .filter(Boolean)
    .join(' ');

  return {
    title,
    description,
    category,
    subject,
    date,
    time: time && isIsoTime(time) ? time : normTime(time ?? ''),
    location,
    priority: priority.priority,
    confidence: Math.min(0.9, confidence),
    action: buildAction(category, subject, title, date),
    reminder: suggestReminder(date, category),
    tasks: buildTasks(category, subject, title, text),
    priorityReason: priority.reason,
    uncertainFields: uncertain,
    sourceText: text,
    aiMode: 'demo',
    note: 'Demo Mode — extracted with LifeLens’ built-in rule engine (no API key needed). Please confirm the highlighted fields.',
  };
}

function emptyResult(note: string): AnalysisResult {
  return {
    title: 'Unreadable capture',
    description: null,
    category: 'Other',
    subject: null,
    date: null,
    time: null,
    location: null,
    priority: 'LOW',
    confidence: 0.1,
    action: null,
    reminder: null,
    tasks: [],
    priorityReason: 'Low priority because nothing could be understood from this capture.',
    uncertainFields: ['title', 'date', 'time', 'category'],
    sourceText: null,
    aiMode: 'demo',
    note,
  };
}
