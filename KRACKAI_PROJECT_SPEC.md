# KrackAI — Complete Project Specification
### The Document That Rebuilds This Project From Scratch

> Written April 2026. Hand this to any AI or developer and they can rebuild KrackAI with zero prior context.

---

## 1. What Is KrackAI?

KrackAI is a real-time AI interview co-pilot. It listens to a job interview happening on the user's computer — via system audio capture — transcribes the interviewer's voice using Deepgram, detects when a question has been asked, and generates a tailored, credible spoken answer in seconds. The answer appears on the user's screen while the interview is happening so they can read it out.

The product has two delivery surfaces:
- **Electron desktop app** — main experience; captures audio, shows answers, has stealth/overlay mode
- **Mobile companion (Stealth Screen)** — phone opens a web URL; the app streams answers there via WebSocket so the user can read from their phone camera-off

It is **not** a practice tool. It is a live, real-time assistant used during actual job interviews.

---

## 2. Tech Stack

| Layer | Technology |
|-------|-----------|
| Desktop shell | Electron 33 (main.js + preload.js) |
| Frontend framework | Angular 20, standalone components |
| Styling | Tailwind CSS |
| Backend | Node.js + Express, TypeScript |
| Database | MongoDB via Mongoose |
| Auth | JWT (1-day expiry) |
| Speech-to-text | Deepgram nova-2 (WebSocket streaming) |
| AI answers | OpenAI GPT-4o-mini (standard calls) + GPT-4o (vision/code screenshots) |
| Email | Resend API (transactional), EmailJS (support forms) |
| Payments | Stripe (subscriptions + webhooks) |
| Audio routing (macOS) | Loopback device auto-detected: BlackHole, Soundflower, VB-Cable, Loopback — falls back to mic |
| Audio routing (Windows) | desktopCapturer (Electron built-in) |

---

## 3. Repository Structure

```
Krack_new_gen/
├── saas-interview-assistant-tool/          ← Frontend (Electron + Angular)
│   ├── electron/
│   │   ├── main.js                         ← Electron main process
│   │   └── preload.js                      ← IPC bridge (context isolation)
│   ├── src/
│   │   ├── app/
│   │   │   ├── app.routes.ts               ← Route definitions
│   │   │   ├── components/
│   │   │   │   ├── interview/              ← CORE: main interview screen
│   │   │   │   │   ├── interview.ts        ← All interview logic (2000+ lines)
│   │   │   │   │   ├── interview.html      ← UI template
│   │   │   │   │   └── interview.css
│   │   │   │   ├── stealth/               ← Phone companion screen
│   │   │   │   │   ├── stealth.ts
│   │   │   │   │   └── stealth.html
│   │   │   │   ├── dashboard/             ← Post-login home
│   │   │   │   ├── myinterviews/          ← Past sessions + PDF download
│   │   │   │   ├── login/                 ← Passcode auth
│   │   │   │   ├── pricing/               ← Stripe subscription plans
│   │   │   │   ├── support/               ← Support form (EmailJS)
│   │   │   │   ├── header/                ← Nav header
│   │   │   │   └── admin/users/           ← Admin: manage users
│   │   │   ├── services/
│   │   │   │   ├── auth/auth.ts           ← JWT storage + login calls
│   │   │   │   ├── interview/interview.ts ← HTTP service for interview API
│   │   │   │   ├── guards/auth-guard.ts   ← Route protection
│   │   │   │   └── interceptors/token/   ← Attaches JWT to every request
│   │   │   └── electron.d.ts              ← TypeScript types for window.electron IPC
│   │   └── environments/
│   │       └── environment.ts             ← apiUrl + websocketUrl (dynamic hostname)
│   └── package.json
│
└── saas-interview-assistant-tool-api/     ← Backend (Express API)
    └── src/
        ├── index.ts                        ← Express app entry, routes, CORS, WebSocket init
        ├── config/
        │   ├── db.ts                       ← MongoDB connection
        │   └── websoket.ts                 ← Deepgram WebSocket + session rooms + auto-question
        ├── controllers/
        │   ├── interview.ts                ← ALL AI logic (most important file)
        │   ├── user.ts                     ← Auth: login, register
        │   ├── access.ts                   ← Access request handling
        │   ├── payment.ts                  ← Stripe checkout session
        │   ├── stripe_webhook.ts           ← Stripe event processing
        │   └── support.ts                  ← Support email endpoint
        ├── models/
        │   ├── user.ts                     ← User schema (passcode, tier, remainingMinutes)
        │   ├── interview.ts                ← Interview schema (questions, date, status)
        │   └── accessRequest.ts           ← Early access request schema
        ├── middlewares/
        │   ├── auth.ts                     ← JWT verification middleware
        │   └── upload.ts                   ← Multer file upload config
        ├── routes/
        │   ├── interview.ts                ← All /interview routes
        │   ├── user.ts                     ← /login, /register
        │   ├── payment.ts                  ← /create-checkout-session
        │   ├── stripe_webhook.ts           ← /webhook
        │   ├── support.ts                  ← /support
        │   └── access.ts                   ← /request-access
        └── utils/
            ├── jwt.ts                      ← sign + verify
            ├── hash.ts                     ← bcrypt
            └── email.ts                    ← Resend email sender
```

---

## 4. Environment Variables (Backend `.env`)

```env
PORT=3000
MONGO_URI=mongodb://127.0.0.1:27017/siat
JWT_SECRET=<your-secret>
JWT_EXPIRES_IN=1d
DEEPGRAM_API_KEY=<key>
OPENAI_API_KEY=<key>
EMAILJS_PUBLIC_KEY=<key>
EMAILJS_PRIVATE_KEY=<key>
EMAILJS_SERVICE_ID=<id>
EMAILJS_TEMPLATE_ID=<id>
STRIPE_SECRET_KEY=<sk_test_...>
STRIPE_WEBHOOK_SECRET=<whsec_...>
FRONTEND_URL=http://localhost:4200
RESEND_API_KEY=<key>
EMAIL_FROM="KrackAI <krackai@yourdomain.com>"
```

Frontend environment (`src/environments/environment.ts`):
```typescript
export const environment = {
  apiUrl: `http://${window.location.hostname}:3000`,
  websockerUrl: `ws://${window.location.hostname}:3000`,
};
```
Using `window.location.hostname` (not hardcoded `localhost`) is critical — it allows the phone companion to automatically connect to the correct IP when the user accesses the app from the LAN.

---

## 5. How To Launch The App

### Every session — two terminals:

**Terminal 1 (Backend):**
```bash
cd saas-interview-assistant-tool-api
npm run dev
# Starts Express on port 3000
# MongoDB must be running locally: mongod
```

**Terminal 2 (Frontend):**
```bash
cd saas-interview-assistant-tool
npm start
# Which is: ng serve --host 0.0.0.0
# Starts Angular on http://localhost:4200
# --host 0.0.0.0 makes it LAN-accessible for phone pairing
```

**Optional — Electron (dev mode):**
```bash
cd saas-interview-assistant-tool
npm run electron:dev
# or: npx electron . with NODE_ENV=development
```

**Phone companion (stealth mode):**
1. User's phone must be on same WiFi
2. Open phone browser to: `http://<LAN-IP>:4200/#/stealth?sessionId=<session>`
3. The LAN IP is returned by the backend endpoint: `GET /local-ip`

---

## 5b. Route Guards

Two route guards protect `/interview`:

**authGuard** — checks for valid JWT in localStorage. Redirects to `/login` if missing.

**remainingTimeGuard** — checks `user.remainingMinutes` from the backend:
- If `remainingMinutes > 0` → allow entry
- If `remainingMinutes <= 0` → redirect to `/pricing` with toast: "You are out of interview credits."
- If `role === "admin"` → always allow (unlimited access)
- This guard hits `GET /user` (or equivalent) to get fresh user data — not just cached JWT claims

---

## 6. User Authentication

- Users authenticate with a **passcode** (not username/password)
- Passcodes are bcrypt-hashed in MongoDB
- On login, backend issues a JWT (1-day expiry)
- JWT is stored in localStorage by the Angular auth service
- The token interceptor (`token-interceptor.ts`) appends `Authorization: Bearer <token>` to every HTTP request
- The `authenticate` middleware on the backend verifies the token on every protected route

**User model fields:**
- `passcode` (required, unique)
- `email` (optional)
- `role`: `"user"` | `"admin"`
- `tier`: `"free"` | `"starter"` | `"pro"` | etc.
- `remainingMinutes`: numeric, decremented during interviews
- `deviceFingerprint`: for fraud detection
- `fraudFlag`: boolean

---

## 7. The Full Interview Flow (Step by Step)

The interview component (`interview.ts`) has multiple sequential steps rendered in a single component. Understanding this flow is essential.

### Step 0: Setup / Greeting Screen

1. User uploads resume (PDF, DOCX, or TXT)
2. Backend extracts text via `pdf-extraction` or `mammoth`
3. User enters job description (optional)
4. User clicks "Start Interview" → triggers **two parallel background jobs**:

**Background Job 1 — Glossary generation:**
```
POST /generate-greeting
  → Returns: greeting message (candidate name + role) + resumeAnchors YAML
POST /generate-glossary  (after anchors ready)
  → Returns: domainGlossary YAML
```

**Background Job 2 — Interview Prep Intelligence:**
```
POST /generate-interview-prep  (after glossary ready)
  → Returns: prepContext YAML (QUESTION_BANK, DOMAIN_DEEP_KNOWLEDGE, ANSWER_QUALITY_SIGNALS)
```

These jobs run while the user is reading the greeting screen. By the time they proceed to Agent Training, the prep is already loaded.

The greeting step shows:
- "Building interview intelligence..." badge while prepContext is loading
- "Interview intelligence ready ✓" badge once it completes

### Step 1: Agent Training

**Skippable**: User can click "Skip" on any question or skip the entire step. If zero answers are given, `activateAgent()` auto-calls `skipAgentTraining()` which advances to pairing without building agentBrain. The interview still works — it just uses generic style instead of the candidate's voice.

The user answers 8 AI-generated training questions using **Web Speech API** (voice recognition in browser). This captures HOW the candidate speaks, not just what they know.

```
POST /generate-training-questions
  → Returns: array of 8 questions (HR, technical, behavioral, situational, career goals)
```

Question types: `hr`, `technical`, `project`, `behavioral`, `situational`, `advanced_senior`, `career`

Training uses Web Speech API for voice capture. Each answer is saved locally. When all 8 are answered:

```
POST /build-agent-brain
  → Returns: agentBrain YAML
```

The `agentBrain` encodes the candidate's voice profile: how they open answers, sentence rhythm, signature phrases, key stories with exact hooks, impact language style, answer structure, what to avoid.

### Step 2: Phone Pairing (Optional)

1. Backend `GET /local-ip` returns machine's LAN IP
2. Interview component generates QR code using `qrcode` npm package (dynamic import):
   - URL: `http://<LAN-IP>:4200/stealth/<sessionId>`
   - Colors: cyan on dark gray (`dark: '#22d3ee', light: '#1f2937'`), 250px width
   - A 120-second countdown timer is shown — user has 2 minutes to scan
3. User scans QR with phone
4. Phone opens stealth component → connects to WebSocket with `?stealth=true`
5. When answers are generated, they are broadcast to all WebSocket clients in the session room

### Step 3: Live Interview

The interview is active. The component:

1. Connects to WebSocket: `ws://localhost:3000?sessionId=<id>&extraKeywords=<company names>`
2. Requests microphone/audio permission via Electron IPC
3. Starts capturing audio via `desktopCapturer` (system audio) or microphone
4. Audio is processed by `ScriptProcessorNode` (buffer size 4096, mono, 24kHz):
   - float32 input → Int16Array (PCM16) conversion
   - PCM16 buffer → base64 string via `btoa`
   - Sent as: `{ type: "audio-chunk", audio: "<base64>" }`
5. WebSocket server forwards audio to Deepgram
6. Deepgram streams back transcription events
7. Interim transcriptions → displayed as live text
8. Final transcriptions → accumulated in sessionBuffer for auto-question detection
9. After 3.5 seconds of silence → `isInterviewQuestion()` runs on the buffered text
10. If question detected → `auto-question` WebSocket event → UI auto-generates answer
    - Only fires if `isAutoMode = true` (default) AND no answer is currently being generated
    - User can toggle auto mode off; manual "Answer" button always works regardless
11. User can also click "Answer" button for any question manually
12. Questions stored newest-first: `questions.unshift({...})` so `questions[0]` is always the latest
    - History sent to API: `questions.slice(0, 4)` — 4 most recent Q&As for follow-up context
13. Answers generated via: `POST /generate-answer` (SSE streaming)
    - SSE wire format: `data: {"token": "word "}` per token, ends with `data: [DONE]`
    - `<think>...</think>` chain-of-thought blocks are stripped server-side before streaming
14. Each token is appended to the answer AND immediately broadcast to stealth screen via `broadcast-answer` WebSocket (real-time streaming to phone, not just final answer)

### Step 4: End Interview

1. User clicks "End Interview"
2. `endInterview()` is **async** — it awaits `saveInterview()` before navigating
3. `POST /interview` saves the session (questions, date, duration, status)
4. Navigate to dashboard

**CRITICAL**: The async save was a bug fix. Previously, `router.navigate()` fired immediately, destroying the component before the HTTP request completed, so sessions never saved.

---

## 8. WebSocket Architecture (`websoket.ts`)

The WebSocket server has two types of connections per session:

| Type | Query param | Role |
|------|-------------|------|
| Desktop | `stealth=false` | Captures audio, sends to Deepgram, receives transcriptions |
| Mobile | `stealth=true` | Receives broadcast answers only, no audio |

### Session Rooms
```typescript
const sessionRooms = new Map<string, Set<WebSocket>>();
```
All clients with the same `sessionId` are in the same room. Answers are broadcast to all room members.

### Deepgram Connection
- One Deepgram connection per **desktop** client
- URL: `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=24000&channels=1&model=nova-2&interim_results=true&endpointing=300&smart_format=true&<keywords>`
- Auto-reconnects on disconnect (1 second delay) as long as session room exists

### Keyword Boosting (Critical — Prevents Misrecognition)

This was a hard-won configuration. Wrong boost levels cause Deepgram to mishear real words:

```typescript
// Long/unique SAP terms — boost 5: no collision risk
const highPriority5 = ["POSC","SPRO","IDoc","S4HANA","PMR","SLED","GxP","FDA","MIGO","BAPI"]

// Short 2-3 letter abbreviations — boost 3: prevents collision with real English words
// WARNING: HU at boost 5 converts "HP" → "HU". ALE at boost 5 converts "LLC" → "ALE"
const highPriority3 = ["EWM","HU","ALE","WM","RF"]

// General domain terms — boost 2
const domainTerms = ["putaway","replenishment","wave","FIFO","SAP", ...]

// Company/proper-noun keywords from resume — boost 3
// Extracted from resumeAnchors YAML using regex, passed in WebSocket URL query param
const extraKeywords = extraKeywordsList.map(k => `keywords=${k}:3`).join("&")
```

### Auto-Question Detection (`isInterviewQuestion()`)

Runs on the accumulated transcript after 3.5 seconds of silence. Returns `true` if the text is an interview question.

Logic:
1. Must be ≥ 6 words
2. Last word must not be an incomplete-sentence indicator (prepositions, conjunctions, etc.)
3. If ends with `?` → true
4. Strip leading filler words: `["okay ", "ok ", "so ", "right ", "well ", "now ", "alright ", "sure ", "good ", "great ", "yes ", "yeah "]`
5. Check strong interview starters: `"what is "`, `"how do "`, `"tell me "`, `"explain "`, `"describe "`, `"walk me through"`, `"have you ever"`, `"can you explain"`, `"give me an example"`, `"difference between"`, etc.
6. Check content patterns: `"your experience with"`, `"in your previous role"`, `"configuration steps"`, `"transaction code"`, `"what is your"`, etc.

**Why filler stripping matters**: "Okay. Tell me what is POSC?" — without stripping "okay", `"tell me "` is never matched. The strip runs before any pattern check.

---

## 9. AI System — `interview.ts` Controller

### Shared OpenAI caller

All standard calls go through one helper (GPT-4o-mini):
```typescript
const callOpenAI = async (messages, max_tokens, temperature) => {
  // POST https://api.openai.com/v1/chat/completions
  // model: "gpt-4o-mini"
}
```

Code screenshot analysis uses **GPT-4o** (vision capable).

### Endpoint: `POST /generate-greeting`

Parallel execution:
1. Greeting sentence: `"Hey [Name], today here you are for the [Role] role. All the best, let's enter into the session."`
2. Resume parser → `<RESUME_ANCHORS>` YAML

**RESUME_ANCHORS structure:**
```yaml
USER_PROFILE:
  name, domain, experience_years, experience_statement, experience_level, location, contact
INDUSTRY_EXPOSURE: [...]
KEY_PROJECTS:
  - company, role, period, context, achievements, technologies, metrics_language
EDUCATION: [...]
CERTIFICATIONS: [...]
TECHNICAL_SKILLS:
  platforms, languages, tools, methodologies, integrations
SOFT_SKILLS: [...]
METRICS_LANGUAGE: [exact phrases from resume for outcomes]
```

Rules for parsing:
- Use EXACT wording for achievements
- `experience_years`: use number from Professional Summary statement, NEVER calculate from job dates
- `experience_statement`: copy exact phrase (e.g., "over 10 years of experience")
- Do NOT invent tools or certifications

### Endpoint: `POST /generate-glossary`

Generates `<DOMAIN_GLOSSARY>` YAML with:
- DOMAIN, CORE_CONCEPTS, CONFIGURATION_PATHS, TRANSACTION_CODES_TOOLS
- APIS_INTEGRATIONS, BEST_PRACTICES, COMMON_PITFALLS
- INTERVIEW_HOT_TOPICS, JUNIOR_VS_SENIOR_EXPECTATIONS

For SAP EWM domain: seeded with hardcoded accurate definitions for POSC, HU, EWM, WM, PMR, SPRO, IDoc, ALE, BAPI, MIGO, SLED, FIFO, GxP, RF, Wave, Replenishment, Deconsolidation. This prevents AI from guessing wrong definitions for abbreviations.

### Endpoint: `POST /generate-training-questions`

Returns 8 questions as JSON array. Fixed structure:
- Q1: HR/self-intro
- Q2-3: Technical knowledge from primary domain
- Q4-5: Project/experience (reference real companies)
- Q6: Behavioral STAR
- Q7: Situational/hypothetical
- Q8: Career goals / why this role

### Endpoint: `POST /build-agent-brain`

Takes `trainingAnswers` array (Q+A from training session).
Returns `<AGENT_BRAIN>` YAML:

```yaml
VOICE_PROFILE:
  style, opening_pattern, sentence_rhythm, perspective
SIGNATURE_PHRASES: [exact phrases they use]
KEY_STORIES:
  - title, company, opening_hook, technical_core, outcome_phrase
IMPACT_LANGUAGE:
  style, sample_phrases
ANSWER_STRUCTURE: "their natural flow"
CONFIDENCE_MARKERS: "how they signal expertise"
AVOID: [patterns this person never uses]
```

### Endpoint: `POST /generate-interview-prep`

The pre-interview intelligence job. Returns `<INTERVIEW_PREP>` YAML:

```yaml
DOMAIN, EXPERIENCE_LEVEL
INTERVIEW_PROFILE:
  likely_company_type, interview_style, risk_areas
QUESTION_BANK:
  hr: [{question, must_hit, anchor_facts, trap_to_avoid}]
  technical_concepts: [...]
  transaction_codes_config: [...]
  project_experience: [...]
  behavioral: [...]
  scenario_situational: [...]
  advanced_senior: [...]
DOMAIN_DEEP_KNOWLEDGE:
  concepts_to_master, config_paths_to_know, transaction_codes_to_know
  integration_points, common_traps: [{topic, wrong_answer, correct_answer}]
ANSWER_QUALITY_SIGNALS:
  what_makes_great_answers, what_makes_weak_answers, domain_vocabulary_to_use
```

Rules: ≥5 questions per category, anchor_facts reference REAL data from resume, trap_to_avoid is the SPECIFIC wrong thing (not generic "don't be vague").

### Answer Word Length Guide (soft limits in system prompt)

| Question Type | Target Length |
|--------------|---------------|
| HR / self-intro | 80–120 words |
| Knowledge/concept | 150–250 words (definition + types + config + 1-2 sentence bridge) |
| Experience/project | 100–160 words |
| Behavioral (STAR) | 120–180 words |
| Situational | 100–150 words |

Content quality overrides word count — these are guides, not hard cutoffs.

### Chain of Thought (internal reasoning)

The system prompt ends with: `Think step by step in <think> tags: (1) classify the question type, (2) identify relevant resume facts and domain knowledge, (3) plan the answer structure. Then write the final answer after </think>.`

The backend strips `<think>...</think>` blocks in the SSE streaming loop before forwarding tokens to the client. The user never sees internal reasoning — only the final answer.

### Endpoint: `POST /generate-answer`

The most complex endpoint. Accepts:
```json
{
  "question": "...",
  "resumeText": "...",
  "jobDescription": "...",
  "history": [...],
  "resumeAnchors": "...",
  "domainGlossary": "...",
  "agentBrain": "...",
  "prepContext": "..."
}
```

Returns SSE stream. The system prompt is the crown jewel of KrackAI.

---

## 10. The AI System Prompt — Complete Rules

This is the most critical piece of the entire product. Every rule has been validated through real interview testing and failure analysis.

### Priority Layers (highest to lowest)

1. **AGENT_BRAIN** — override all generic phrasing; match this person's voice exactly
2. **INTERVIEW_PREP** — scan QUESTION_BANK first, use must_hit as answer skeleton
3. **RESUME_ANCHORS** — every claim must be verifiable here
4. **DOMAIN_GLOSSARY** — source of technical terminology and definitions
5. **RAW_RESUME_TEXT** — fallback for facts not in parsed anchors

### Answer Patterns by Question Type

**TYPE 1 — Knowledge/Concept Questions** ("What is X?", "Explain X", "How does X work?")

Structure (in this exact order):
1. Definition (2-3 sentences, domain-accurate)
2. Types/Variants (if X has subtypes, with context for when each is used)
3. Configuration Steps (3-5 specific steps; exact T-codes, SPRO paths, API names)
4. Experience Bridge (1-2 sentences MAX, at the end only, ONE time)

**TYPE 2 — Experience/Project Questions** ("How did you configure X?", "Tell me about a project where...")

Structure:
1. Direct Start: "At [real company], I [verb] [X] as part of [context]."
2. Technical Execution (3-5 steps with domain terminology)
3. Challenge Moment (optional)
4. Outcome (exact phrase from METRICS_LANGUAGE verbatim)

**TYPE 3 — Behavioral STAR** ("Tell me about a time when...")

STAR grounded in RESUME_ANCHORS: Situation → Task → Action (verb intensity matching resume level) → Result (exact METRICS_LANGUAGE phrase)

**TYPE 4 — HR / Self-Introduction**

For "Tell me about yourself":
1. `experience_statement` verbatim + domain
2. Current role: company + primary responsibility + achievement
3. Career thread: previous company + notable contribution
4. Closing: alignment with JD keywords

**TYPE 5 — Situational/Hypothetical** ("What would you do if...?")
1. Immediate approach
2. Process (3-4 steps using domain terminology)
3. Real parallel from RESUME_ANCHORS

**TYPE 6 — Follow-up** ("Can you elaborate?", "What about X?")
→ Connect to previous answer's topic, go one level deeper, same concept

### Critical Credibility Rules

**VERB FIDELITY RULE** (most dangerous failure mode):
- Before using a strong verb (led, spearheaded, architected), verify it in RESUME_ANCHORS for that specific company
- Resume says "Participated in" → NEVER say "led" or "spearheaded"
- Resume says "Led" → may say "led" or "drove"
- Experienced interviewers probe inflated verbs with follow-up questions

**DOMAIN MISMATCH RULE**:
- If concept doesn't exist in candidate's domain → acknowledge briefly → pivot to the actual equivalent in their domain
- NEVER invent a definition of a concept in the wrong domain
- Example: "Availability groups in SAP EWM" → "Availability groups is a SQL Server concept. In EWM, stock availability is managed through Storage Type Search Sequences and ATP configuration."

**NO INVENTED EXPERIENCE**:
- Before attributing any skill/tool to a company → check it is in KEY_PROJECTS for that company
- "At HP Hood, I designed AWS architectures" — if AWS not in HP Hood entry → NEVER say this

**EXPERIENCE YEARS — EXACT CLAIM RULE**:
1. Use `experience_statement` from RESUME_ANCHORS verbatim
2. If not found, use `experience_years` as "X+ years"
3. Never calculate from job date arithmetic
4. Never round down (resume says "over 10 years" → always say "over 10 years")

**RESUME CONFIDENCE RULE**:
- If skill/tool appears anywhere in RESUME_ANCHORS → answer confidently
- Never say "I'm not familiar with X" for a skill that IS in the resume

**NO DEFLECTION**:
- Answer every question with direct concrete value
- Never: "Could you clarify?", "What aspect would you like?"
- Typos in question → infer meaning from domain context, answer it, never call it out

### Output Format Rules
- Numbered steps for technical/config questions (interviewers expect this)
- Flowing prose for HR, behavioral, self-intro
- No bold/italic markdown (`**word**` or `*word*`) — plain text only
- Never start with "Here's an overview:", "Here's a breakdown:", "Here are the steps:"
- Start the actual content directly

### Pre-Output Audit (8 Checks)
Before writing final answer, verify:
1. Correct question type pattern used?
2. For "What is X?" — definition + types + config BEFORE experience bridge?
3. Every company/project/tool in RESUME_ANCHORS?
4. Years claim matches `experience_statement`?
5. No invented metrics (%, $, time saved)?
6. METRICS_LANGUAGE phrase included?
7. Action verbs match `experience_level`?
8. Gap handling: "While I haven't done X directly, at [Company] I [related experience]"

---

## 11. Electron Main Process Features (`main.js`)

### Window Configuration
- Frameless, transparent, no shadow (`backgroundColor: '#00000000'`)
- Content protection enabled by default (`setContentProtection(true)`) — window not visible in screen share/recordings
- DevTools only in development mode
- PrintScreen and Ctrl+P blocked via `before-input-event`

### Global Shortcuts
- **Ctrl+Alt+K** — toggle KrackAI window visibility
- **Ctrl+Alt+B** — toggle BEHIND mode (click-through, transparent overlay over any app)

### Behind Mode
`setIgnoreMouseEvents(true, { forward: true })` — KrackAI becomes click-through but still receives keyboard events for shortcuts. The interview answer is readable while clicking through to the video call.

### IPC Handlers
| Channel | Direction | Purpose |
|---------|-----------|---------|
| `set-behind-mode` | renderer→main | Toggle click-through |
| `window:minimize` | renderer→main | Minimize |
| `window:toggle-maximize` | renderer→main | Maximize/restore |
| `window:close` | renderer→main | Hide (not quit) |
| `window:isMaximized` | main→renderer | Query state |
| `toggle-protection` | renderer→main | Enable/disable screenshot protection |
| `request-audio-permission` | renderer→main | macOS microphone permission |
| `get-audio-sources` | renderer→main | Get desktopCapturer sources |
| `open-external` | renderer→main | Open Stripe checkout (whitelist only) |
| `auto-type` | renderer→main | Copy answer to clipboard + paste into focused app |
| `set-opacity` | renderer→main | Change window opacity (0.2–1.0) |

### Auto-Type Feature
When user clicks "Auto Type" button:
1. Answer text → clipboard
2. KrackAI window hides (previous app gets focus)
3. Wait 600ms for OS focus transfer
4. Simulate Cmd+V (macOS) or Ctrl+V (Windows) via osascript/PowerShell

### Deep Link Handling
Custom protocol: `krackai://`
- `krackai://success` → navigate to dashboard (Stripe success)
- `krackai://cancel` → navigate to dashboard (Stripe cancel)

---

## 12. The Stealth Screen (Mobile Companion)

Route: `/stealth/:sessionId` (route param — **not** a query param)

Example URL generated by QR code: `http://<LAN-IP>:4200/stealth/abc123xyz`

**stealth.ts** — connects to WebSocket: `ws://<hostname>:3000?sessionId=<id>&stealth=true`

Does NOT send audio. Only listens for `broadcast-answer` WebSocket messages.

**Auto-reconnects**: On WebSocket close, waits 3 seconds then calls `connectWS()` again — handles temporary network drops without user action.

**Wake lock**: `navigator.wakeLock.request('screen')` is called on init to prevent the phone screen from sleeping during the interview.

**Answer preprocessing** (`stripHtml` method) before display:
- Strip `**bold**` markdown: `**word**` → `word`
- Convert `- ` list markers → `\n• `
- Remove code blocks: replaces ` ``` ... ``` ` with `[Code Block Removed for Stealth]`
- Strip any remaining HTML tags

**stealth.html** — shows Q&A feed, newest at top (answers array uses `unshift` so newest is index 0):
- Question in blue (`text-blue-300`) with left border accent
- Answer in white/gray-100 (`text-gray-100`)
- "Connecting..." and "Waiting for interview to start..." placeholder states

**Critical bug that was fixed**: Original template used `text-[#08091E]` (dark navy text) on black background — completely invisible. The entire template was rewritten with white/light text colors.

---

## 13. My Interviews + PDF Download (`myinterviews.ts`)

**Fetch interviews**: `GET /interviews?page=<n>&limit=10` (paginated)

**Fetch detail**: `GET /interview/<id>` — returns questions, date, timeTaken, status

**Bug fixed here**: `getInterviewById` was only selecting `"questions"` field from MongoDB. The `date`, `timeTaken`, and `status` fields were missing, breaking the PDF. Fixed to select `"questions date timeTaken status"`.

**PDF Generation**: No third-party PDF library. Uses HTML Blob + `window.print()`:
1. Generate HTML string with Apple-style print CSS
2. `new Blob([html], { type: 'text/html' })`
3. `URL.createObjectURL(blob)`
4. `window.open(url, '_blank')`
5. `win.onload` → `win.print()` → `URL.revokeObjectURL(url)`

---

## 14. Data Models

### User
```typescript
{
  email?: string,           // optional
  passcode: string,         // unique, bcrypt-hashed
  role: "user" | "admin",
  tier: string,             // "free" | "starter" | etc.
  remainingMinutes: number, // decremented per interview minute
  deviceFingerprint: string,
  fraudFlag: boolean,
}
```
Cascade delete: when user is deleted, all their interviews are deleted via Mongoose pre-hook.

### Interview
```typescript
{
  user: ObjectId,           // ref to User
  date: Date,
  timeTaken: number,        // seconds
  status: "completed" | "incomplete",
  questions: [{
    questionNumber: number,
    question: string,
    answer: string,
  }],
}
```
Index: `{ user: 1, date: -1 }` for fast paginated queries.

---

## 15. Bugs Found During Real Testing + Fixes

### Bug 1: "HU Hood ALE" transcription (Deepgram mishearing)
- **Cause**: HU boosted at 5 caused Deepgram to convert "HP" → "HU". ALE at 5 caused "LLC" → "ALE"
- **Fix**: Split into tiers — long unique terms at 5, short 2-3 letter abbreviations at 3. Added company name keyword injection from resume (boost 3) so proper nouns are recognized

### Bug 2: Phone screen completely blank
- **Cause 1**: `ng serve` not listening on LAN IP — phone couldn't reach it
  - **Fix**: Changed to `ng serve --host 0.0.0.0`
- **Cause 2**: `text-[#08091E]` (dark navy) on black background = invisible text
  - **Fix**: Rewrote entire stealth.html with `text-gray-100` and `text-blue-300`

### Bug 3: Auto-answer not triggering
- **Cause**: Question detector too narrow. "Okay. Tell me what is POSC?" starts with filler word "Okay" and "tell me" wasn't in starters
- **Fix**: Added `FILLER_PREFIXES` array, strip filler before pattern matching, added broad `"tell me "` starter and many others

### Bug 4: Sessions not saving after interview ends
- **Cause**: `router.navigate()` fired immediately after `cleanupAndSave()`, destroying the Angular component before the HTTP POST completed
- **Fix**: Made `endInterview()` async, wrapped `interviewService.createInterview().subscribe()` in a Promise, awaited it before navigating

### Bug 5: Answer format regression
- **Cause**: AI system prompt was changed to "flowing prose only" thinking it would sound more natural
- **Reality**: For technical configuration questions (POSC setup, Wave Management steps), numbered structure is essential — interviewers expect to see step-by-step knowledge. User explicitly rejected the prose-only version.
- **Fix**: Restored numbered steps for TYPE 1 and TYPE 2 answers

### Bug 6: AI inventing EWM concepts (Availability Groups)
- **Cause**: No guard against answering questions about concepts that don't exist in the candidate's domain
- **Fix**: Added DOMAIN MISMATCH RULE to system prompt

### Bug 7: Verb inflation (Participated → Led)
- **Cause**: AI used stronger verbs than documented in resume
- **Fix**: Added VERB FIDELITY RULE requiring exact verb matching from RESUME_ANCHORS per company

### Bug 8: Invented company experience
- **Cause**: AI claimed AWS architecture work at HP Hood; not in resume
- **Fix**: Added NO INVENTED EXPERIENCE rule

### Bug 9: PDF missing date/duration fields
- **Cause**: `getInterviewById` only selected `"questions"` field
- **Fix**: Changed select to `"questions date timeTaken status"`

---

## 16. API Routes Reference

All routes require `Authorization: Bearer <token>` except auth endpoints.

| Method | Path | Controller | Description |
|--------|------|-----------|-------------|
| POST | /upload-resume | uploadResume | Extract text from PDF/DOCX/TXT |
| POST | /generate-greeting | generateGreeting | Greeting + parse resume → RESUME_ANCHORS |
| POST | /generate-glossary | generateGlossary | Domain glossary YAML |
| POST | /generate-training-questions | generateTrainingQuestions | 8 training Qs as JSON |
| POST | /build-agent-brain | buildAgentBrain | AGENT_BRAIN YAML from training answers |
| POST | /generate-interview-prep | generateInterviewPrep | INTERVIEW_PREP YAML (pre-interview intelligence) |
| POST | /generate-answer | generateAnswer | SSE: stream answer to question |
| POST | /process-captures | processCaptures | Vision: analyze screenshot (GPT-4o) |
| POST | /interview | createInterview | Save interview session |
| GET | /interviews | fetchInterviews | Paginated interview list |
| GET | /interview/:id | getInterviewById | Single interview with questions |
| DELETE | /interview/:id | deleteInterviewById | Delete interview |
| POST | /deduct-partial | deductPartialTime | Deduct partial minutes from user account |
| GET | /local-ip | (inline) | Return server LAN IP |

---

## 17. Company Name Keyword Injection (WebSocket + Deepgram)

When the interview starts, the component:
1. Extracts company names from `resumeAnchors` YAML using regex:
   ```typescript
   extractCompanyKeywords(anchors: string): string {
     const keywords = new Set<string>();
     const companyMatches = anchors.matchAll(/company:\s*["']?([^"'\n\r]+)["']?/gi);
     for (const m of companyMatches) {
       const name = m[1].trim();
       if (name && name !== '{Company Name}') {
         keywords.add(name);
         name.split(/\s+/).forEach(w => { if (w.length >= 3) keywords.add(w); });
       }
     }
     // Also extract candidate name
     const nameMatch = anchors.match(/name:\s*["']?([^"'\n\r]+)["']?/i);
     if (nameMatch) nameMatch[1].trim().split(/\s+/).forEach(w => { if (w.length >= 3) keywords.add(w); });
     return [...keywords].slice(0, 20).join(',');
   }
   ```
2. Passes as WebSocket URL query param: `?sessionId=X&extraKeywords=HP+Hood,HP,Hood,...`
3. WebSocket server appends them to Deepgram URL as boost-3 keywords
4. Result: Deepgram correctly recognizes company proper nouns in transcription

---

## 18. Known Limitations / What's Not Built Yet

- **Billing time tracking**: `remainingMinutes` field exists in user model and `deductPartialTime` endpoint exists, but live minute-by-minute deduction during interview is not wired up in the frontend
- **Windows audio**: desktopCapturer auto-selects the first `screen:` source which carries the system audio mix. macOS enumerates audio devices and auto-selects a loopback device (BlackHole, Soundflower, VB-Cable, Loopback) — no manual selection needed on either platform
- **Offline mode**: No offline capability — requires internet for Deepgram + OpenAI
- **Answer history persistence**: The conversation `history` array sent to `/generate-answer` exists in memory only — not stored per-question in the current session. Long interviews may lose early context.
- **Multi-language**: All prompts and detection are English-only
- **Production deployment**: Currently local-only. No cloud deployment configured. Backend CORS allows only `localhost:4200` and `app://.` (Electron origin)

---

## 19. Architecture Diagram (Text)

```
User's interview (audio from meeting) 
         ↓
[BlackHole / desktopCapturer]
         ↓
[Angular Interview Component]
    • Captures audio chunks (PCM)
    • Sends via WebSocket as base64 audio-chunk messages
         ↓
[Express WebSocket Server]
    • Forwards PCM bytes to Deepgram
         ↓
[Deepgram nova-2]
    • Returns interim + final transcription
         ↓
[Express WebSocket Server]
    • Broadcasts transcription to all session clients
    • Accumulates finals in sessionBuffer
    • After 3.5s silence → isInterviewQuestion() check
    • If question → broadcast auto-question event
         ↓
[Angular Interview Component]
    • Receives transcription → displays live text
    • Receives auto-question → calls POST /generate-answer
         ↓
[Express /generate-answer]
    • System prompt: AGENT_BRAIN + INTERVIEW_PREP + RESUME_ANCHORS + DOMAIN_GLOSSARY + all rules
    • POST to OpenAI GPT-4o-mini
    • SSE stream back to client
         ↓
[Angular Interview Component]
    • Displays streaming answer on screen
    • Broadcasts answer via WebSocket broadcast-answer
         ↓
[Mobile Stealth Screen]
    • Receives broadcast-answer
    • Displays Q+A feed on phone
```

---

## 20. How to Rebuild This (Instructions for Another AI)

If you are reading this as a new AI taking over this project:

1. **Read every file before editing** — the interview controller is ~900+ lines, the interview component is ~2000+ lines. Both are tightly integrated.

2. **The system prompt is sacred** — every rule in Section 10 was added because a real interview failed without it. Do not remove rules without understanding why they were added.

3. **Never change the answer format** — numbered steps for technical questions is a hard requirement. The user tested prose-only and explicitly rejected it.

4. **The async save pattern in endInterview() is not optional** — without it, sessions silently fail to save. Always await the HTTP call before navigating.

5. **Deepgram keyword boost tiers are calibrated** — do not boost short abbreviations (2-3 chars) above 3. You will break real-word recognition.

6. **Test with stealth screen on phone** — the white text color is critical. Dark text on dark background is invisible and the user cannot see answers.

7. **The FILLER_PREFIXES list must be stripped before question pattern matching** — without this, roughly 30% of real interview questions are missed.

8. **All AI context is passed per-request** — nothing is server-side cached. resumeAnchors, domainGlossary, agentBrain, prepContext are all sent in the request body to /generate-answer on every call.

9. **The company name keyword extraction is on the frontend** — it runs at interview start, extracts from the resumeAnchors YAML already in memory, and passes via WebSocket URL param.

10. **The environment.ts hostname trick** — `window.location.hostname` means the phone automatically uses the correct IP when it loads the app from the LAN URL. Never hardcode `localhost` there.
