# KrackAI — Complete Manual (v1.0.18)

KrackAI is an invite-only AI interview co-pilot. It listens to your interview, understands the question, and shows a personalized answer on your screen — invisible to screen share.

---

# PART 1 — USER MANUAL (for your clients)

## The Complete User Journey

```
Request Access → Get Code by Email → Download App → Login →
Setup (Resume + JD) → AI Greeting → Agent Training → Phone Pairing →
Live Interview → Auto Answers → Session Saved → Review History
```

---

### Step 1 — Request Access (one time)
1. Go to **krackai.org**
2. Click **Request Access**
3. Fill in name, email, phone, and how many minutes you want
4. Submit — the admin reviews and approves it

### Step 2 — Get Your Code
- You receive an **8-character access code** by email once approved.
- This code is yours forever — you only enter it once.

### Step 3 — Install the App (one time)
1. On **krackai.org**, click **Download** (it auto-detects Mac or Windows)
2. **Windows:** run the `.exe` → if SmartScreen warns, click "More info" → "Run anyway"
3. **Mac:** open the `.dmg`, drag to Applications → if blocked: System Settings → Privacy & Security → "Open Anyway"

### Step 4 — Login (one time)
- Open KrackAI → enter your access code → **Continue**. The app remembers you after this.

### Step 5 — Setup Your Session
| Sub-step | What you do |
|----------|-------------|
| 1. Context Document | Upload your resume (PDF / DOCX / TXT) |
| 2. Target Role | Paste the job description (optional, improves accuracy) |
| AI Greeting | KrackAI greets you and silently builds your interview intelligence |

### Step 6 — Agent Training (makes AI sound like YOU)
- KrackAI generates **8 personalized questions**.
- For each: type your answer, **record** your voice, or click **✨ Generate AI Answer** then edit it.
- Click **⚡ Activate** → KrackAI learns your voice, phrases, and stories.
- *(You can Skip this, but answers sound more generic.)*

### Step 7 — Phone Pairing (optional, stealth)
- Click **Pair Mobile Device** → a QR code appears.
- Scan it with your phone (same WiFi) → answers mirror privately to your phone.
- Useful when you don't want answers on the laptop you're screen-sharing.

### Step 8 — Live Interview
1. Pick your **Audio Source** (see table below) → click **▶ START**
2. KrackAI transcribes the interviewer live
3. Turn on **⚡ Auto-Answer** (or press **Space**) → AI answers appear in ~2 seconds
4. Read the answer, speak naturally. Answers are invisible to screen share.

### Step 9 — After the Interview
- Click **End Session** → your time is deducted and the session is saved.
- Review past sessions anytime under **My Interviews**.

---

## User Features

| Feature | What it does |
|---------|-------------|
| 🎧 **From Interview** audio | Captures the **interviewer's** voice (system/meeting audio) |
| 🎙 **My Device** audio | Captures **your** microphone |
| ⚡ Auto-Answer | AI answers automatically when a question is detected (~1.8s) |
| ✨ Generate AI Answer | In training: drafts an answer you can edit |
| 🧠 Agent Brain | AI mimics your tone, phrasing & stories |
| 📱 Stealth Phone Pairing | View answers privately on your phone via QR |
| 👁 BEHIND Mode | Click-through transparency — invisible to screen share |
| 🛡 HIDE | Instantly hide the window; stays hidden until you show it |
| 📸 Screenshot Analysis | Capture a coding question → AI solves it |
| 🎚 Opacity Slider | Adjust how transparent the window is |
| 📜 My Interviews | Review past sessions and answers |

## Keyboard Shortcuts

| Shortcut (Win / Mac) | Action |
|----------------------|--------|
| `Ctrl+Alt+K` / `Ctrl+Opt+K` | Show / Hide window (stays hidden until you show it) |
| `Ctrl+Alt+B` / `Ctrl+Opt+B` | Toggle BEHIND mode (click-through overlay) |
| `Space` | Generate answer for the current question |
| `Shift Shift` or `C C` | Clear transcription buffer |

## User Troubleshooting

| Problem | Fix |
|---------|-----|
| "Access code expired" | Contact admin to renew |
| App not visible | Press `Ctrl+Alt+K`, or click the system-tray icon |
| "From Interview" captures my voice not theirs | On Mac, accept the screen-share prompt and tick **Share audio**; or use "My Device" |
| QR code won't connect phone | Phone and laptop must be on the **same WiFi** |
| Shortcuts dead (Mac) | System Settings → Privacy & Security → Accessibility → add KrackAI |
| App frozen | Right-click tray icon → Quit → reopen |

---

# PART 2 — ADMIN MANUAL (for you)

## Admin Login
- Go to **krackai.org** → log in with the **master passcode**.
- The admin account has unlimited access and can see all users.

## The Admin Workflow

```
Login → Review Requests → Approve / Reject → Manage Passcodes →
Monitor Users → View Interview History
```

### Approving a New User
1. Open the **Access Requests** tab → find the **PENDING** request
2. Click ✅ → the Approve modal opens
3. Set: **Tier**, **Duration (minutes)**, **Expiry Date** (optional), **Access Code** (auto-generated, or type custom)
4. Click **Send Approval & Code** → the user is emailed their code automatically

> The code is generated once with a cryptographically-secure random generator. Users keep it forever.

### Other Admin Actions
| Action | How |
|--------|-----|
| Reject a request | Click ✕ on the request row |
| Edit a request | ✏️ Edit → update name/email/phone/payment/notes → Save |
| Create a code manually | **Users & Codes** → fill Create Code form → Create |
| Edit / delete a code | Users & Codes → edit row or delete |
| Set expiry / minutes | On the code's row or in the approve modal |
| Reset a stuck device | Code row → **Reset Device** (use on reinstall / "403") |
| View a user's interviews | Click any user row → Profile → interview log |

## Admin Features

| Feature | Description |
|---------|-------------|
| 📋 Access Request Queue | Approve/reject incoming requests |
| 🎟 Passcode Management | Create, edit, delete codes; set expiry & minutes |
| 👥 User Monitoring | View each user's history & usage |
| 💳 Tier & Credits Control | Assign tier and minute balance |
| 🔄 Device Reset | Unbind a code from a locked device |
| 📅 Auto-Expiry | Calendar-date expiry, enforced on **every** API request |
| ♾ Unlimited Admin | Master account has no limits |

---

# PART 3 — HOW IT ALL WORKS (architecture)

| Part | Where it runs | Role |
|------|--------------|------|
| Landing + Admin panel | **Cloudflare Pages** (krackai.org) — builds from the `krackai-landing/` folder, branch `main` | Marketing, request form, admin panel — auto-deploys on git push |
| Backend API | **Render** (krackai-api.onrender.com) | Logins, codes, AI calls, emails, interview storage |
| Desktop app | Client's machine (Electron) | The actual AI interview tool |
| App downloads | **GitHub Releases** | Hosts the `.dmg` and `.exe` |
| Database | **MongoDB Atlas** | Users, access requests, interview records |
| Transcription | **Deepgram** | Real-time speech-to-text |
| AI answers | **OpenAI** (gpt-4o-mini → gpt-4o fallback) | Answer generation |

> **Render free tier sleeps** after 15 min idle — the first login of the day may take 30–60s to wake. This is normal.

## Security & Reliability (v1.0.18)
- Login rate-limited (10 / 15 min per IP); access requests rate-limited (5 / hour)
- Account expiry enforced on every request (fails closed if DB is unreachable)
- Prompt-injection sanitization on all AI inputs
- Atomic credit deduction and request approval (no double-spend / duplicate accounts)
- Crypto-secure passcode generation; 1 MB request body cap

---

# PART 4 — DEPLOYING UPDATES

**Website / Admin:** edit files in **`krackai-landing/`** (this is the folder Cloudflare Pages serves to krackai.org — NOT the repo root). Push to GitHub `Zaheer2801/Krackai` → Cloudflare Pages auto-deploys in ~1 min.

**Backend API:** push to GitHub → Render auto-deploys (or trigger Manual Deploy).

**New app version:**
1. Bump `version` in `saas-interview-assistant-tool/package.json`
2. `npm run build`
3. `npx electron-builder --mac --arm64` and `npx electron-builder --win --x64`
4. `gh release create vX.Y.Z <dmg> <exe>`
5. Update the download links in **`krackai-landing/index.html`** → push (Cloudflare Pages deploys to krackai.org)
6. The app's built-in auto-update check prompts existing users to download the new version on launch.
