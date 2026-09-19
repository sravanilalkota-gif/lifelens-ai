# 🔍 LifeLens AI

> **It doesn't just tell you what it sees. It tells you what you should do about it.**

LifeLens is a visual personal assistant. You point your camera at a college notice, a poster, a
timetable, an assignment sheet or a receipt — and instead of giving you OCR text, it returns
**tasks, events, reminders and a justified priority**.

```
See  →  Understand  →  Extract  →  Prioritize  →  Act
```

Built for **Hack Devengers 2.0** (24-hour hackathon). Works with **or without** a Gemini API key —
with no key it runs on its own rule-based understanding engine plus bundled sample documents, so
the demo can never break on stage.

---

## 1. Project structure

```
lifelens-ai/
├── package.json                  # npm workspaces + dev/verify scripts
├── .env.example                  # copy to .env
├── shared/
│   └── index.ts                  # domain types shared by API + UI (AnalysisResult, Task…)
├── server/                       # Express API  (Node 20 + TypeScript, run with tsx)
│   └── src/
│       ├── index.ts              # bootstrap, CORS, JSON limits, route wiring, error net
│       ├── ai/
│       │   ├── gemini.ts         # Gemini multimodal call + output validation/sanitising
│       │   └── demoAnalyzer.ts   # Demo Mode understanding engine (dates, subject, category…)
│       ├── engines/
│       │   ├── priorityEngine.ts # explainable priority score + reason + reminder logic
│       │   ├── taskEngine.ts     # understanding → concrete checklist tasks
│       │   └── assistantEngine.ts# "What do I need to finish today?" over your own data
│       ├── data/
│       │   ├── store.ts          # JSON-file repository (swap for MongoDB/SQLite later)
│       │   └── demoData.ts       # 5+ sample documents, dates relative to TODAY
│       ├── routes/
│       │   ├── analyze.ts        # POST /api/analyze  (vision → structured JSON)
│       │   └── api.ts            # captures, tasks, plan, assistant, memory, health, admin
│       └── lib/dates.ts          # local-time day maths (deadlines are a human concept)
├── client/                       # React 18 + Vite + TypeScript + Tailwind
│   └── src/
│       ├── App.tsx               # navigation shell + voice FAB + offline banner
│       ├── hooks/useLifeLens.tsx # single source of truth for API state
│       ├── lib/{api,format}.ts   # typed fetch client, human date/priority copy
│       ├── components/           # BottomNav, ConfirmCard, VoiceAssistant, TaskDetail,
│       │                         # AnalyzingOverlay, Sheet, Cards, Badges, Icon (inline SVG)
│       ├── pages/                # Home, Capture, Tasks, Plan, Calendar, Captures, Profile
│       └── public/samples/       # generated sample documents (jpg)
└── scripts/
    ├── make-sample-docs.mjs      # regenerates client/public/samples/*.jpg
    ├── verify-engines.mjs        # Gemini normalisation + priority engine checks
    └── smoke.mjs                 # renders the real bundle in jsdom and clicks through the app
```

---

## 2. Installation

```bash
cd lifelens-ai
npm install                 # installs shared + server + client workspaces
cp .env.example .env        # create your environment file
```

Optional — regenerate the bundled sample documents (needs Python 3 + Pillow):

```bash
npm run seed:samples
```

---

## 3. Environment variables (`.env` at the project root)

```ini
PORT=4000

# OPTIONAL. Leave empty → LifeLens runs in Demo Mode automatically.
# Free key: https://aistudio.google.com/apikey
GEMINI_API_KEY=
GEMINI_MODEL=gemini-2.5-flash

# Demo user (the MVP has no real auth, by design)
USER_NAME=Sravani
USER_COURSE=B.Tech CSE • 3rd Year

# Upload limit in MB
MAX_UPLOAD_MB=6
```

The key lives **only** on the server. The browser calls `/api/*` through the Vite proxy and never
sees it.

---

## 4. Run

```bash
# both at once (API on :4000, web on :5173)
npm run dev

# or separately, in two terminals
npm run dev:server          # http://localhost:4000/api
npm run dev:client          # http://localhost:5173
```

Production build (the API then serves the built client from the same port):

```bash
npm run build
npm start                   # → http://localhost:4000
```

Checks:

```bash
npm run typecheck           # tsc for server + client
npm run verify              # engine + Gemini-normalisation checks (needs no server)
npm run smoke               # builds, then clicks through the whole app in jsdom (needs API up)
```

---

## 5. API surface

| Method | Path | What it does |
| --- | --- | --- |
| `GET` | `/api/health` | AI mode, model, user, counts |
| `POST` | `/api/analyze` | `{ image | demoKey | text, fileName }` → structured `AnalysisResult` |
| `GET/POST/PATCH/DELETE` | `/api/captures` | visual memory; POST creates the capture **and** its tasks |
| `GET/POST/PATCH/DELETE` | `/api/tasks` | tasks + generated subtasks |
| `GET` | `/api/plan` | today's ordered, time-slotted plan with a recommendation |
| `POST` | `/api/plan/:id/complete` | tick a plan item off |
| `POST` | `/api/assistant` | `{ question }` → answer grounded in your own captures |
| `GET` | `/api/memory?q=DBMS` | "show me everything related to DBMS" |
| `POST` | `/api/admin/reset` · `/clear` | restore / wipe demo data between judge demos |

---

## 6. Live demo script (under 2 minutes)

1. **Open LifeLens** → the dashboard says *"Good morning, Sravani 👋"* with three real priorities
   already ranked. Point at the red one: *"LifeLens knows the exam is in 3 days and why that is HIGH."*
2. **Tap the big Scan button** (centre of the bottom nav) → tap **📚 DBMS Internal Exam Notice**.
3. Watch the pipeline narrate itself: *Reading → Understanding → Extracting → Prioritizing → Acting*.
4. The **confirmation card** appears: 📚 DBMS Internal Examination · 📅 22 Sept · 🔴 High priority ·
   *"High priority because it is 3 days away and the text says mandatory."*
   Tap **Edit** once to show that nothing is saved blindly, then **Add to my tasks**.
5. You land on **Today's plan** — the new item is already ranked #1 with a time slot.
   Tap **Create my plan** to show it re-ordering live.
6. Tap the **microphone** and ask *"What should I finish first?"* →
   *"Start with your Operating Systems assignment — it is due tomorrow."* **← the wow moment.**
7. Close with **My captures → search "DBMS"**: exam, timetable and tasks in one place.
   *"That's the memory layer for your physical world."*

Fallback if the mic is blocked in the room: the voice sheet has a text box with the same questions,
and the Capture page has 5 bundled sample documents that need no camera at all.

---

## 7. 30-second pitch

> **Problem.** Students drown in paper. Exam dates live on a notice board, assignment deadlines in a
> WhatsApp screenshot, workshop timings on a poster — and turning any of it into action is manual.
>
> **Solution.** LifeLens is a visual personal assistant. Photograph anything and it doesn't hand back
> text — it hands back **tasks, a date, a reminder and a priority you can argue with**.
>
> **Innovation.** Three things: an **explainable priority engine** that says *why* something is
> urgent; a **confirmation layer** so the human always corrects the AI before it enters your plan;
> and a **memory layer** — ask *"show me everything about DBMS"* or *"what should I finish first?"*
> and it answers from your own captures, by voice.
>
> **Impact.** It removes the gap between *seeing* information and *acting* on it — first for
> students, then for employees, families and anyone whose life is printed on paper.
>
> **It doesn't just tell you what it sees. It tells you what you should do about it.**

---

## 8. Future scope

1. **Expense tracking from receipts** — the Finance category already extracts store, amount and
   date; add monthly budgets and category totals.
2. **Real notifications** — reminders are stored today; wire them to FCM/APNs plus a daily
   8 AM "here is your day" digest.
3. **Real auth + sync** — Firebase Auth or Supabase, with per-user encrypted storage so a student's
   captures follow them across devices.
4. **Group mode** — a shared class notice board: one student scans the notice, everyone in the
   section gets the same tasks and deadlines.
5. **Multi-document reasoning** — photograph a whole syllabus or a term's notices at once and let
   LifeLens build a study schedule that balances load across weeks.

---

## 9. Notes for judges / teammates

* **Demo Mode is a feature, not a stub.** The rule engine parses real dates ("28 September",
  "next week", "Friday", "tomorrow"), subjects, venues, amounts and urgency language, and always
  reports which fields it is unsure about instead of inventing them.
* **Priority is never a black box.** Every card shows the sentence that produced its colour.
* **Nothing is auto-saved.** The confirmation card is the trust layer — the user edits, then saves.
* **MongoDB swap:** implement the `DataStore` interface in `server/src/data/store.ts` and swap it
  in `server/src/index.ts`. No route changes needed.
