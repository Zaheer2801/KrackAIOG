<div align="center">

<img src="https://img.shields.io/badge/KrackAI-Interview%20Co--Pilot-3B82F6?style=for-the-badge&logoColor=white" />

# KrackAI — AI-Powered Interview Co-Pilot

**Real-time AI answers during your live interviews. Desktop-only. Invite-only.**

[![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Angular](https://img.shields.io/badge/Angular-20-DD0031?style=flat-square&logo=angular&logoColor=white)](https://angular.io)
[![Electron](https://img.shields.io/badge/Electron-Desktop-47848F?style=flat-square&logo=electron&logoColor=white)](https://electronjs.org)
[![OpenAI](https://img.shields.io/badge/OpenAI-GPT--4o-412991?style=flat-square&logo=openai&logoColor=white)](https://openai.com)
[![Deepgram](https://img.shields.io/badge/Deepgram-Nova--2-13EF93?style=flat-square)](https://deepgram.com)
[![MongoDB](https://img.shields.io/badge/MongoDB-Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white)](https://mongodb.com)

---

*KrackAI listens to your interviewer in real-time, auto-detects questions, and streams precise AI answers grounded in your actual resume — invisibly, on your Windows desktop.*

</div>

---

## Table of Contents

- [Overview](#overview)
- [How It Works](#how-it-works)
- [Workflows](#workflows)
- [Screenshots](#screenshots)
- [Features](#features)
- [Architecture](#architecture)
- [Repository Structure](#repository-structure)
- [Local Development Setup](#local-development-setup)
- [Environment Variables](#environment-variables)
- [Deployment](#deployment)
- [Access & Trial](#access--trial)

---

## Overview

KrackAI is a **Windows desktop application** (Electron + Angular) backed by a **Node.js/Express API**. It captures live audio from meetings, transcribes speech using Deepgram's Nova-2 model, auto-detects interview questions, and streams contextual AI answers using GPT-4o-mini — all in under 3 seconds.

Every answer is grounded in the candidate's actual resume and voice profile, making responses sound natural and specific rather than generic. Sessions are saved to MongoDB and can be downloaded as PDF or DOC.

> **Invite-only product.** Users receive an 8-character access code from the KrackAI team. First 15 minutes are free on every new code.

---

## How It Works

### Step 1 — Download & Install

The user downloads `KrackAI-Setup.exe` from [krackai.org](https://krackai.org). Installation takes under 30 seconds on any Windows 10/11 machine. No admin rights required.

<!-- Replace with real screenshot: docs/screenshots/01-download.png -->
![Step 1 - Download](https://placehold.co/900x420/c7d2fe/1e293b?font=raleway&text=Step+1%3A+Download+KrackAI.exe+from+krackai.org)

---

### Step 2 — Enter Access Code & Login

Open the app. The login screen shows a single access code field. The user types the code sent to them by the KrackAI team. On first login, the code binds to their device (fraud prevention). Subsequent logins are instant.

Below the login form, a **"How It Works"** section walks new users through the four steps.

<!-- Replace with real screenshot: docs/screenshots/02-login.png -->
![Step 2 - Login](https://placehold.co/900x520/dde4ff/1e293b?font=raleway&text=Step+2%3A+Enter+access+code+%E2%80%94+How+It+Works+section+below)

---

### Step 3 — Upload Resume & Set Target Role

After login, the user reaches the **Interview Prep** screen:

1. **Upload resume** (PDF, DOCX, or TXT) — the AI parses it into a structured YAML profile covering experience, projects, skills, achievements, and impact language.
2. **Paste the job description** (optional but recommended) — the AI aligns answers to the target role's terminology.

<!-- Replace with real screenshot: docs/screenshots/03-prep.png -->
![Step 3 - Prep Screen](https://placehold.co/900x520/f0f4ff/1e293b?font=raleway&text=Step+3%3A+Upload+resume+%2B+paste+job+description)

---

### Step 4 — AI Greeting & Background Intelligence

KrackAI generates a **personalized greeting** ("Hey Zaheer, today you're interviewing for SAP EWM Consultant at Deloitte…") and simultaneously builds in the background:

- **Domain Glossary** — SAP/technical terminology, T-codes, SPRO paths, hot topics
- **Interview Prep** — 5+ questions per category (HR, technical, behavioral, scenario) with must-hit points and traps to avoid

<!-- Replace with real screenshot: docs/screenshots/04-greeting.png -->
![Step 4 - AI Greeting](https://placehold.co/900x400/fff1e6/1e293b?font=raleway&text=Step+4%3A+Personalized+AI+greeting+%2B+intelligence+building)

---

### Step 5 — Agent Voice Training (Optional but Powerful)

The AI generates 8 personalized training questions. The candidate answers them in their own words. KrackAI analyzes the responses to build an **Agent Brain** — a YAML voice profile capturing:

- Sentence rhythm and opening patterns
- Signature phrases the candidate naturally uses
- Key stories with exact hooks and outcomes
- Confidence markers and verbs to avoid

All subsequent answers sound like **the candidate speaking**, not an AI.

<!-- Replace with real screenshot: docs/screenshots/05-agent-training.png -->
![Step 5 - Agent Training](https://placehold.co/900x480/f0f4ff/1e293b?font=raleway&text=Step+5%3A+8+training+questions+%E2%80%94+AI+learns+your+voice)

---

### Step 6 — Live Interview with Real-Time AI Answers

The main interview screen. The user joins their video call normally. KrackAI runs invisibly alongside it.

**What happens automatically:**
1. Audio from the meeting is captured — system audio (WASAPI loopback on Windows, `getDisplayMedia` on macOS)
2. Deepgram Nova-2 transcribes speech in real-time, with domain keyword boosting
3. After 1.8 seconds of silence, the transcript is checked against 40+ question patterns
4. If a question is detected → GPT-4o-mini streams an answer in under 3 seconds
5. The answer appears on screen; the user reads it naturally

**Manual controls:**
- **Spacebar** → generate answer immediately
- **Double Shift** or **CC** → clear the transcription buffer
- **BEHIND button** (`Ctrl/Cmd+Alt+B`) → toggle see-through overlay mode
- **HIDE** (`Ctrl/Cmd+Alt+K`) → instantly hide window; stays hidden until you show it
- **Audio toggle** → 🎧 From Interview (interviewer's voice) ↔ 🎙 My Device (your mic)

<!-- Replace with real screenshot: docs/screenshots/06-live-interview.png -->
![Step 6 - Live Interview](https://placehold.co/900x560/1e293b/e2e8f0?font=raleway&text=Step+6%3A+Live+interview+%E2%80%94+real-time+transcription+%2B+AI+answers)

---

### Step 7 — Stealth Mobile Mode

Scan the QR code shown in the app to pair a phone. Answers stream silently to the phone's browser — useful when the laptop screen may be visible to the interviewer on camera.

<!-- Replace with real screenshot: docs/screenshots/07-stealth-mobile.png -->
![Step 7 - Stealth Mobile](https://placehold.co/900x400/0f172a/22d3ee?font=raleway&text=Step+7%3A+Stealth+mode+%E2%80%94+answers+stream+to+paired+phone)

---

### Step 8 — Interview History & Export

After the session, all questions and answers are saved automatically to the user's account. From the **My Interviews** page, users can:

- Browse all past sessions with date, duration, and status
- Expand any session to read the full Q&A
- Download as **PDF** (print-formatted) or **DOC** (Word-compatible)

Admins can also view any user's full interview history from the admin panel.

<!-- Replace with real screenshot: docs/screenshots/08-my-interviews.png -->
![Step 8 - My Interviews](https://placehold.co/900x460/f8fafc/1e293b?font=raleway&text=Step+8%3A+Interview+history+%E2%80%94+PDF+%2F+DOC+export)

---

## Workflows

### 👤 User Workflow

```
Request Access → Get Code by Email → Download App → Login →
Setup (Resume + JD) → AI Greeting → Agent Training → Phone Pairing →
Live Interview → Auto Answers → Session Saved → Review History
```

<!-- Replace with real diagram/screenshot: docs/screenshots/workflow-user.png -->
![User Workflow](https://placehold.co/1000x240/3B82F6/ffffff?font=raleway&text=User+Workflow+Diagram+%E2%80%94+paste+visual+here)

| Step | Where | What Happens | Endpoint / Feature |
|------|-------|--------------|--------------------|
| 1. Request Access | krackai.org | Submit name, email, phone, minutes | `POST /access-request` |
| 2. Get Code | Email | Admin approves → 8-char code emailed | (admin action) |
| 3. Download | krackai.org | Mac `.dmg` / Windows `.exe`, auto-detected | platform detect |
| 4. Login | Desktop App | Enter access code (rate-limited) | `POST /login` |
| 5. Upload Resume | Setup Step 1 | PDF/DOCX/TXT → text extracted | `POST /upload-resume` |
| 6. Add Job Description | Setup Step 1 | Paste JD (optional) | — |
| 7. AI Greeting | Setup Step 2 | Personalized welcome; builds anchors, glossary, prep | `generate-greeting`, `generate-glossary`, `generate-interview-prep` |
| 8. Agent Training | Setup Step 3 | 8 questions; type / voice / ✨ Generate AI | `generate-training-questions`, `build-agent-brain` |
| 9. Phone Pairing | Setup Step 4 | Scan QR → answers mirror to phone | LAN server + `stealth-broadcast` |
| 10. Live Interview | Step 5 | Listen → transcribe → auto-answer | `generate-answer` (SSE) |
| 11. Save & Review | Post-session | Time deducted, interview stored | `deduct-partial`, `POST /interview` |

---

### 🛡️ Admin Workflow

```
Login (master passcode) → Admin Panel → Review Requests →
Approve / Reject → Manage Passcodes → Monitor Users → View Interviews
```

<!-- Replace with real diagram/screenshot: docs/screenshots/workflow-admin.png -->
![Admin Workflow](https://placehold.co/1000x240/0f172a/22d3ee?font=raleway&text=Admin+Workflow+Diagram+%E2%80%94+paste+visual+here)

| Step | What Happens | Endpoint |
|------|--------------|----------|
| 1. Login | Master passcode → admin token | `POST /login` |
| 2. View Requests | All access requests (pending / approved / rejected) | `GET /admin/access-requests` |
| 3. Approve | Generate code, set tier/minutes/expiry → email sent | `POST /admin/access-requests/:id/approve` |
| 4. Reject | Decline a request | `POST /admin/access-requests/:id/reject` |
| 5. Edit Request | Update payment status, notes, amount | `PATCH /admin/access-requests/:id` |
| 6. Create Passcode | Manually issue a code (bypass request flow) | `POST /admin/passcodes` |
| 7. Manage Passcodes | List / edit / delete codes, set expiry | `GET/PUT/DELETE /admin/passcodes` |
| 8. Reset Device | Unbind a code from a locked device | `POST /admin/passcodes/:id/reset-device` |
| 9. View User Interviews | Inspect any user's session history | `GET /admin/users/:userId/interviews` |

<!-- Replace with real screenshot: docs/screenshots/09-admin.png -->
![Admin Panel](https://placehold.co/1000x520/f8fafc/1e293b?font=raleway&text=Admin+Panel+%E2%80%94+paste+screenshot+here)

---

### User vs Admin at a Glance

| | 👤 User | 🛡️ Admin |
|---|---------|----------|
| **Login** | Issued access code | Master passcode |
| **Purpose** | Take interviews with AI help | Manage who gets access |
| **Limits** | Time/credits + expiry | Unlimited |
| **Interface** | Desktop app (interview UI) | Admin panel (`/admin`) |
| **Sees others' data** | No | Yes (all users) |

---

## Screenshots

> **To add real screenshots:** take them while running the app locally, save as `.png` into `docs/screenshots/`, commit, and replace the placeholder `img` tags above.

| Screen | File |
|--------|------|
| Login + How It Works | `docs/screenshots/02-login.png` |
| Prep (Resume Upload) | `docs/screenshots/03-prep.png` |
| AI Greeting | `docs/screenshots/04-greeting.png` |
| Agent Training | `docs/screenshots/05-agent-training.png` |
| Live Interview | `docs/screenshots/06-live-interview.png` |
| Stealth Mobile | `docs/screenshots/07-stealth-mobile.png` |
| My Interviews | `docs/screenshots/08-my-interviews.png` |
| Admin Panel | `docs/screenshots/09-admin.png` |
| User Workflow Diagram | `docs/screenshots/workflow-user.png` |
| Admin Workflow Diagram | `docs/screenshots/workflow-admin.png` |

---

## Features

| Feature | Description |
|---------|-------------|
| 🎙️ Real-Time Transcription | Deepgram Nova-2 with domain keyword boosting (SAP terms, company names) |
| 🤖 Resume-Grounded Answers | Every answer references actual resume data — no fabrication |
| 🧠 Agent Voice Training | AI learns your speaking style from 8 training Q&As |
| ⚡ Sub-3s Response Speed | GPT-4o-mini primary, GPT-4o fallback; 450 token cap |
| 📱 Stealth Mobile Mode | QR pair → answers stream live to phone browser |
| 👁️ See-Through Overlay | Electron click-through mode — read answers over any window |
| 🔊 Audio Mode Toggle | 🎧 From Interview (system audio) ↔ 🎙 My Device (microphone) |
| ⌨️ Keyboard Shortcuts | Space = answer · Double Shift / CC = clear buffer |
| 💾 Session Saving | All Q&As auto-saved to MongoDB after interview ends |
| 📄 PDF & DOC Export | Download full Q&A transcript as PDF or Word document |
| 🛡️ Admin Panel | Manage access codes, view/download any user's history |
| 🔐 Device Binding | Access code locks to first device (fraud prevention) |
| ⏱️ 15-Min Free Trial | Every new code includes 15 free interview minutes |
| 🖥️ Screen Capture Analysis | Screenshot any window → GPT-4o vision analyzes code/questions |

---

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                  DESKTOP APP (.exe)                      │
│         Angular 20 + Electron (Windows)                  │
│                                                         │
│  Login → Prep → Greeting → Agent Training → Interview   │
│                                                         │
│  ┌──────────────┐    ┌──────────────────────────────┐   │
│  │  Audio Layer │    │        UI Layer               │   │
│  │  WASAPI /    │    │  Transcription panel          │   │
│  │  WebAudio    │    │  AI answer stream             │   │
│  │  ScriptProc  │    │  See-through overlay          │   │
│  └──────┬───────┘    └──────────────────────────────┘   │
│         │ PCM16 chunks (base64, WebSocket)               │
└─────────┼───────────────────────────────────────────────┘
          │
          ▼
┌─────────────────────────────────────────────────────────┐
│                 BACKEND API (Node.js)                    │
│              Express + WebSocket Server                  │
│                                                         │
│  ┌─────────────┐  ┌──────────────┐  ┌───────────────┐  │
│  │  WebSocket  │  │  REST API    │  │  Stealth Page  │  │
│  │  /ws        │  │  /login      │  │  /stealth/:id  │  │
│  │  session    │  │  /interview  │  │  (mobile HTML) │  │
│  │  rooms      │  │  /admin/...  │  └───────────────┘  │
│  └──────┬──────┘  └──────┬───────┘                     │
│         │                │                              │
└─────────┼────────────────┼──────────────────────────────┘
          │                │
    ┌─────▼──────┐   ┌─────▼──────┐   ┌──────────────┐
    │  Deepgram  │   │  OpenAI    │   │  MongoDB     │
    │  Nova-2    │   │  GPT-4o    │   │  Atlas       │
    │  (STT)     │   │  (answers) │   │  (sessions)  │
    └────────────┘   └────────────┘   └──────────────┘
```

**Data flow during a live interview:**

1. `Electron desktopCapturer` captures system audio → PCM16 chunks
2. Chunks sent over WebSocket to Express server
3. Server relays to Deepgram; Deepgram returns transcription events
4. Transcription broadcast to all clients in the session room
5. 1.8s debounce fires → `isInterviewQuestion()` checks the buffer
6. If question detected → frontend calls `POST /generate-answer` (SSE stream)
7. Tokens stream back → rendered on screen; every 10th token broadcast to stealth mobile
8. On interview end → `POST /interview` saves full Q&A to MongoDB

---

## Repository Structure

```
Krackai/
├── saas-interview-assistant-tool/        # Angular + Electron frontend
│   ├── electron/
│   │   ├── main.js                       # Electron main process
│   │   └── preload.js                    # IPC bridge
│   ├── src/
│   │   ├── app/
│   │   │   ├── components/
│   │   │   │   ├── login/                # Login + How It Works
│   │   │   │   ├── dashboard/            # Home dashboard
│   │   │   │   ├── interview/            # Core interview engine
│   │   │   │   ├── myinterviews/         # History + PDF/DOC export
│   │   │   │   ├── admin/users/          # Admin panel
│   │   │   │   ├── pricing/              # Stripe checkout
│   │   │   │   └── support/              # Support form
│   │   │   └── services/
│   │   │       ├── auth/                 # Auth + API service
│   │   │       └── guards/               # Route guards
│   │   └── environments/
│   │       ├── environment.ts            # Production (smart host detection)
│   │       └── environment.development.ts
│   ├── angular.json                      # Build configs (production / web / development)
│   └── package.json
│
├── saas-interview-assistant-tool-api/    # Node.js / Express backend
│   ├── src/
│   │   ├── config/
│   │   │   ├── db.ts                     # MongoDB connection
│   │   │   └── websoket.ts               # WebSocket server + Deepgram relay
│   │   ├── controllers/
│   │   │   ├── interview.ts              # AI answer generation + session CRUD
│   │   │   ├── user.ts                   # Auth, passcode management
│   │   │   ├── access.ts                 # Access request flow
│   │   │   ├── payment.ts                # Stripe checkout
│   │   │   └── support.ts                # Support emails
│   │   ├── models/
│   │   │   ├── user.ts                   # User schema (passcode, tier, minutes)
│   │   │   ├── interview.ts              # Session schema (questions array)
│   │   │   └── accessRequest.ts          # Access request schema
│   │   └── routes/
│   ├── dockerfile                        # Multi-stage Docker build
│   └── .env.example                      # Required environment variables
│
├── krackai-landing/
│   └── index.html                        # Static marketing page for krackai.org
│
└── docs/
    └── screenshots/                      # Add .png files here
```

---

## Local Development Setup

### Prerequisites

- Node.js 20+
- MongoDB (local or Atlas)
- OpenAI API key
- Deepgram API key

### 1. Clone the repo

```bash
git clone https://github.com/Zaheer2801/Krackai.git
cd Krackai
```

### 2. Start the backend

```bash
cd saas-interview-assistant-tool-api
npm install
cp .env.example .env
# Fill in .env with your keys (see Environment Variables below)
npm run dev
# API running at http://localhost:3000
```

### 3. Start the frontend (web dev mode)

```bash
cd saas-interview-assistant-tool
npm install
npm start
# Angular dev server at http://localhost:4200
```

### 4. Run as Electron desktop app

```bash
cd saas-interview-assistant-tool
npm run dev
# Starts Angular + launches Electron together
```

### 5. Build the .exe installer

```bash
cd saas-interview-assistant-tool
npm run electron:build
# Output: release/KrackAI-Setup.exe
```

---

## Environment Variables

Copy `saas-interview-assistant-tool-api/.env.example` to `.env` and fill in:

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default `3000`) |
| `MONGO_URI` | MongoDB connection string (Atlas recommended for production) |
| `JWT_SECRET` | Secret for signing JWTs |
| `JWT_EXPIRES_IN` | Token expiry (e.g. `1d`) |
| `OPENAI_API_KEY` | OpenAI API key (GPT-4o / GPT-4o-mini) |
| `DEEPGRAM_API_KEY` | Deepgram API key (Nova-2 model) |
| `STRIPE_SECRET_KEY` | Stripe secret key |
| `STRIPE_WEBHOOK_SECRET` | Stripe webhook signing secret |
| `RESEND_API_KEY` | Resend API key (transactional email) |
| `EMAIL_FROM` | Sender address e.g. `KrackAI <hello@krackai.org>` |
| `EMAILJS_*` | EmailJS keys for support form emails |
| `FRONTEND_URL` | Frontend URL for Stripe redirects (e.g. `https://krackai.org`) |
| `NODE_ENV` | `development` or `production` |

---

## Deployment

### Backend → Railway

1. Go to [railway.app](https://railway.app) → New Project → Deploy from GitHub → select `saas-interview-assistant-tool-api`
2. Railway auto-detects the `dockerfile`
3. Set all environment variables in the Railway dashboard
4. Add custom domain: `api.krackai.org`

### Landing Page → Cloudflare Pages

**krackai.org is served by Cloudflare Pages**, which builds from the **`krackai-landing/`** folder on branch `main`. Edit `krackai-landing/index.html` (and `krackai-landing/admin.html` for the admin panel), push to GitHub, and Cloudflare Pages auto-deploys in ~1 minute.

> ⚠️ The website source is `krackai-landing/index.html` — NOT a root-level `index.html`. Editing anything outside `krackai-landing/` will not change krackai.org.

### App Distribution

Build with `npx electron-builder --mac --arm64` and `npx electron-builder --win --x64`, then upload to the **public** `Zaheer2801/krackai-releases` repo via `gh release create`. Update the download links in `krackai-landing/index.html`. (The main `Zaheer2801/Krackai` repo is private — release assets there are NOT downloadable by clients.)

---

## Access & Trial

KrackAI is invite-only. The team manually creates and sends access codes:

- **Admin** logs into the app with the master passcode → **Admin Panel**
- Creates a passcode (custom or random) with optional label, tier, and expiry
- Sends the code to the user by email
- User opens the .exe, enters the code → **15 free trial minutes** granted automatically
- Additional time can be purchased in-app (60 / 120 / 180 minute packages via Stripe)

Each access code binds to the **first device** it's used on. A second device triggers a fraud flag and blocks access.

---

<div align="center">

**KrackAI** · Built with Angular, Electron, Node.js, OpenAI & Deepgram

*For support: [support@krackai.org](mailto:support@krackai.org)*

</div>
