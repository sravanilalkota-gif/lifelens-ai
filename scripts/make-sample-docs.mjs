/**
 * Generates the 5 bundled sample documents used by Demo Mode.
 *
 *   node scripts/make-sample-docs.mjs
 *
 * They are plain JPGs in client/public/samples so the demo looks like real
 * photos of college paperwork instead of a text box.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const outDir = path.join(root, 'client', 'public', 'samples');
fs.mkdirSync(outDir, { recursive: true });

// --- tiny pure-python image generator (Pillow is present in most sandboxes) ---
const today = new Date();
const fmt = (d) => d.toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
const addDays = (n) => {
  const d = new Date(today);
  d.setDate(d.getDate() + n);
  return d;
};
const weekdayName = (d) => d.toLocaleDateString('en-IN', { weekday: 'long' });
const nextWeekday = (target) => {
  const d = new Date(today);
  const delta = (target - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + delta);
  return d;
};

const docs = [
  {
    key: 'dbms-internal-exam',
    accent: '#b91c1c',
    lines: [
      ['VNR VJIET — DEPARTMENT OF CSE', 26, 'bold', '#111827'],
      ['NOTICE', 20, 'bold', '#b91c1c'],
      ['', 14, 'normal', '#111827'],
      ['Internal Examination — DBMS (CS302)', 24, 'bold', '#111827'],
      [`Date: ${fmt(addDays(3))}`, 21, 'normal', '#111827'],
      ['Time: 10:00 AM – 1:00 PM', 21, 'normal', '#111827'],
      ['Room: Seminar Hall 2', 21, 'normal', '#111827'],
      ['', 14, 'normal', '#111827'],
      ['Syllabus: Units 1–3', 19, 'normal', '#374151'],
      ['(ER modelling, Normalisation, SQL, Indexing)', 19, 'normal', '#374151'],
      ['', 14, 'normal', '#111827'],
      ['Attendance is mandatory. Carry your ID card.', 19, 'bold', '#b91c1c'],
    ],
  },
  {
    key: 'os-assignment',
    accent: '#1d4ed8',
    lines: [
      ['DEPARTMENT OF CSE', 24, 'bold', '#111827'],
      ['ASSIGNMENT NOTICE', 20, 'bold', '#1d4ed8'],
      ['', 14, 'normal', '#111827'],
      ['Subject: Operating Systems (CS304)', 21, 'normal', '#111827'],
      ['Assignment 2 — CPU Scheduling & Deadlocks', 23, 'bold', '#111827'],
      ['', 12, 'normal', '#111827'],
      [`Submission: on or before ${weekdayName(nextWeekday(1))}, in the OS Lab`, 20, 'normal', '#111827'],
      ['Marks: 10 (counts towards internals)', 20, 'normal', '#111827'],
      ['', 14, 'normal', '#111827'],
      ['Late submissions will NOT be accepted.', 20, 'bold', '#b91c1c'],
    ],
  },
  {
    key: 'ai-workshop',
    accent: '#7c3aed',
    lines: [
      ['CSE DEPARTMENT — TECH FEST', 20, 'bold', '#7c3aed'],
      ['', 16, 'normal', '#111827'],
      ['AI & GEN-AI WORKSHOP', 32, 'bold', '#111827'],
      ['Build your first LLM app in 4 hours', 21, 'normal', '#4b5563'],
      ['', 16, 'normal', '#111827'],
      [`Date: ${fmt(addDays(1))}`, 22, 'bold', '#111827'],
      ['Time: 2:00 PM', 22, 'bold', '#111827'],
      ['Venue: Main Auditorium', 22, 'normal', '#111827'],
      ['', 14, 'normal', '#111827'],
      ['Open to all branches • Free registration at the desk', 18, 'normal', '#6b7280'],
    ],
  },
  {
    key: 'timetable',
    accent: '#0f766e',
    lines: [
      ['CSE — III YEAR, SEMESTER V', 22, 'bold', '#111827'],
      ['WEEKLY TIME TABLE', 19, 'bold', '#0f766e'],
      ['', 12, 'normal', '#111827'],
      ['Mon  09:00 DBMS | 10:00 OS | 14:00 DBMS Lab', 18, 'normal', '#111827'],
      ['Tue  09:00 SE | 10:00 DBMS | 14:00 OS Lab', 18, 'normal', '#111827'],
      ['Wed  09:00 OS | 10:00 CN | 14:00 Library', 18, 'normal', '#111827'],
      ['Thu  09:00 AI | 10:00 SE | 14:00 Mini Project', 18, 'normal', '#111827'],
      ['Fri  09:00 DBMS | 10:00 OS | 14:00 Seminar', 18, 'normal', '#111827'],
      ['', 12, 'normal', '#111827'],
      ['Lunch break 12:40 – 1:30', 16, 'normal', '#6b7280'],
    ],
  },
  {
    key: 'fee-payment',
    accent: '#a16207',
    lines: [
      ['TUITION FEE PAYMENT REMINDER', 22, 'bold', '#111827'],
      ['Semester V — 2026', 19, 'normal', '#a16207'],
      ['', 14, 'normal', '#111827'],
      ['Amount payable: Rs. 42,500', 24, 'bold', '#111827'],
      [`Due date: ${fmt(addDays(9))}`, 22, 'bold', '#b91c1c'],
      ['', 12, 'normal', '#111827'],
      ['Late fee after due date: Rs. 500 per week', 19, 'normal', '#374151'],
      ['', 12, 'normal', '#111827'],
      ['Pay online at the college portal', 18, 'normal', '#374151'],
      ['or at the SBI counter, ground floor.', 18, 'normal', '#374151'],
    ],
  },
];

const py = `
import json, sys
from PIL import Image, ImageDraw, ImageFont

docs = json.loads(sys.argv[1])
out = sys.argv[2]

CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf",
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans.ttf",
    "/System/Library/Fonts/Supplemental/Arial.ttf",
    "C:/Windows/Fonts/arial.ttf",
]
REG = next((p for p in CANDIDATES if __import__("os").path.exists(p)), None)
BOLD_CANDIDATES = [
    "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
    "/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf",
    "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf",
]
BOLD = next((p for p in BOLD_CANDIDATES if __import__("os").path.exists(p)), REG)

def font(size, weight):
    path = BOLD if weight == "bold" else (REG or BOLD)
    if path:
        return ImageFont.truetype(path, size)
    return ImageFont.load_default()

W, H = 900, 1150
for d in docs:
    img = Image.new("RGB", (W, H), "#ffffff")
    dr = ImageDraw.Draw(img)
    dr.rectangle([0, 0, W, 14], fill=d["accent"])
    dr.rectangle([0, H - 14, W, H], fill=d["accent"])
    dr.rectangle([34, 48, W - 34, H - 48], outline="#d1d5db", width=2)
    y = 96
    for text, size, weight, color in d["lines"]:
        if text == "":
            y += size
            continue
        f = font(size, weight)
        dr.text((72, y), text, font=f, fill=color)
        y += int(size * 1.75)
    dr.text((72, H - 92), "Generated sample document for the LifeLens AI demo", font=font(15, "normal"), fill="#9ca3af")
    target = out + "/" + d["key"] + ".jpg"
    img.save(target, quality=90)
    print("wrote", d["key"])
`;

const pyFile = path.join(root, 'scripts', '.make-sample-docs.py');
fs.writeFileSync(pyFile, py, 'utf8');

try {
  execSync(`python3 ${JSON.stringify(pyFile)} ${JSON.stringify(JSON.stringify(docs))} ${JSON.stringify(outDir)}`, {
    stdio: 'inherit',
  });
  console.log(`\n✅ Sample documents written to ${path.relative(root, outDir)}`);
} catch (err) {
  console.error('Could not generate sample images (is Pillow installed?). The app still works without them.');
  console.error(err.message);
} finally {
  fs.rmSync(pyFile, { force: true });
}
