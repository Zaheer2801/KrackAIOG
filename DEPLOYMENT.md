# KrackAI — Full Deployment Guide

> This document covers the complete deployment process for KrackAI — from domain purchase to live production. Written from real deployment experience including all errors encountered and how they were resolved.

---

## Architecture Overview

```
User visits krackai.org
        │
        ▼
┌─────────────────┐        ┌─────────────────────┐
│   Netlify CDN   │        │   Render.com (Free) │
│  Landing Page   │        │   Node.js/Express   │
│  krackai.org    │◄──────►│  api.krackai.org    │
└─────────────────┘        └─────────────────────┘
                                      │
                           ┌──────────▼──────────┐
                           │   MongoDB Atlas     │
                           │   (Free Cluster)    │
                           └─────────────────────┘
```

| Layer | Service | URL | Cost |
|-------|---------|-----|------|
| Domain | IONOS | krackai.org | Paid |
| DNS + CDN | Cloudflare | krackai.org | Free |
| Frontend | Cloudflare Pages | krackai.org | Free |
| Backend API | Render | api.krackai.org | Free |
| Database | MongoDB Atlas | Cloud | Free |
| Keep-alive | UptimeRobot | — | Free |
| Auth | Google OAuth | — | Free |

---

## Part 1 — Domain (IONOS)

### What we did
Purchased the domain `krackai.org` from IONOS.com and configured DNS records to point to Netlify (frontend) and Render (backend).

### Why
IONOS provides full DNS control. The domain needed two separate destinations:
- Root (`@`) and `www` → Netlify (landing page)
- `api` subdomain → Render (backend API)

### DNS Records configured

| Type | Host Name | Value | Purpose |
|------|-----------|-------|---------|
| CNAME | `@` | `krackai.pages.dev` | Root domain → Cloudflare Pages (auto-managed) |
| CNAME | `api` | `krackai-api.onrender.com` | API subdomain → Render |
| MX | `@` | `mx00.ionos.com` | Mail (leave untouched) |
| MX | `@` | `mx01.ionos.com` | Mail (leave untouched) |
| TXT | `@` | `v=spf1 include:spf-us.ionos.com ~all` | Mail SPF (leave untouched) |

> **Note:** Since Cloudflare manages DNS, the A record and www CNAME are handled automatically when you add `krackai.org` as a custom domain in Cloudflare Pages. Cloudflare is now the authoritative nameserver — DNS changes are made in Cloudflare dashboard, not IONOS.

### How to access
IONOS Dashboard → Domains → krackai.org → DNS tab → Add record

### Important
- **Never touch MX, SPF, DKIM, DMARC records** — these control email delivery
- DNS changes take 15 minutes to 2 hours to propagate
- Netlify IP `75.2.60.5` is Netlify's load balancer — do not change it

---

## Part 2 — MongoDB Atlas (Database)

### What we did
Created a free MongoDB Atlas cluster and connected it to the backend.

### Why
The backend needs a database to store users, access codes, interview history, and access requests. MongoDB Atlas provides a free 512MB cluster — enough for early-stage usage.

### Steps

1. Go to [cloud.mongodb.com](https://cloud.mongodb.com) → Create free account
2. Create a new **free cluster** (M0 tier)
3. **Database Access** → Add database user:
   - Username: `Krackai`
   - Password: (your password — no special characters like `#` or `@`)
4. **Network Access** → Add IP Address → **"Allow Access from Anywhere"** (`0.0.0.0/0`)
5. **Connect** → Drivers → Copy connection string

### Connection string format
```
mongodb+srv://USERNAME:PASSWORD@cluster0.xxxxx.mongodb.net/krackai?retryWrites=true&w=majority&appName=Cluster0
```

### Error encountered: MongoParseError
**Error:**
```
MongoParseError: Invalid scheme, expected connection string to 
start with "mongodb://" or "mongodb+srv://"
```

**Cause:** The `MONGO_URI` environment variable was either empty or had an incorrect value pasted into Render.

**Fix:** Ensure the full connection string is pasted correctly, starting with `mongodb+srv://`.

### Error encountered: Special characters in password
**Cause:** Original password `Meeramart#@2025` contained `#` and `@` which are reserved characters in URLs.

**Fix (two options):**
- URL-encode them: `#` → `%23`, `@` → `%40`
- Or use a password without special characters (simpler) — changed to `Meeramart2025`

### Error encountered: Connection refused
**Cause:** MongoDB Atlas blocks all IPs by default. Render's servers couldn't reach the database.

**Fix:** Atlas → Network Access → Add `0.0.0.0/0` (allow all IPs)

---

## Part 3 — GitHub Repository

### What we did
Pushed the entire KrackAI codebase to a private GitHub repository.

### Repository structure
```
Krackai/
├── saas-interview-assistant-tool/      # Angular + Electron desktop app
├── saas-interview-assistant-tool-api/  # Node.js/Express backend
├── krackai-landing/                    # Landing page (deployed to Netlify)
├── index.html                          # Landing page source
├── docs/screenshots/                   # Screenshot placeholders
├── README.md                           # Project overview
├── DEPLOYMENT.md                       # This file
└── .gitignore                          # Excludes .env, node_modules, dist
```

### Steps
```bash
git init
git remote add origin https://github.com/Zaheer2801/Krackai.git
git add .
git commit -m "Initial commit"
git push origin main
```

### Issue encountered: Embedded .git folders
**Error:** Git warned about embedded repositories in subfolders.

**Fix:**
```bash
rm -rf saas-interview-assistant-tool-api/.git
rm -rf saas-interview-assistant-tool/.git
git rm -r --cached . -qf
git add .
```

### .gitignore — what is excluded
```
.env              # All secret keys — never commit this
node_modules/     # Dependencies — reinstalled on deploy
dist/             # Build output — rebuilt on deploy
release/          # Electron build output
.angular/         # Angular cache
.claude/          # Claude Code local settings
```

---

## Part 4 — Cloudflare Pages (Frontend)

### What we did
Deployed the landing page (`krackai-landing/`) to Cloudflare Pages and connected it to `krackai.org` using Cloudflare as both the DNS and CDN provider.

### Why Cloudflare Pages and not Netlify
We initially deployed to Netlify. It worked, but Netlify's free tier has **300 build minutes/month**. After many rapid deploys during development, the site was paused with:
> "This site was paused as it reached its usage limits."

Cloudflare Pages was the correct choice from the start:
- **500 builds/day** (vs Netlify's 300/month)
- Unlimited bandwidth
- Free SSL
- Built-in DNS management (no separate IONOS DNS config needed once nameservers are transferred)
- Supports private GitHub repos on free plan

### Steps

1. Go to [dash.cloudflare.com](https://dash.cloudflare.com) → sign up with GitHub account
2. **Left sidebar → Compute → Workers & Pages → Create**
3. Click the **"Pages"** tab (not Workers) → **"Connect to Git"**
4. Select repository `Zaheer2801/Krackai`
5. Configure build settings:
   - **Project name:** `krackai`
   - **Root directory:** `krackai-landing`
   - **Framework preset:** None
   - **Build command:** (leave empty)
   - **Build output directory:** (leave empty)
6. Click **"Save and Deploy"** → wait ~1 minute

### Add custom domain
1. Go to project → **Custom domains** tab → **"Set up a custom domain"**
2. Enter `krackai.org`
3. Choose **"Cloudflare DNS"** → **"Begin DNS transfer"**
4. Cloudflare imports all existing DNS records automatically

### Transfer nameservers (IONOS → Cloudflare)
Cloudflare provides two nameservers (e.g. `derek.ns.cloudflare.com`, `virginia.ns.cloudflare.com`).

1. Go to IONOS → Domains → krackai.org → **Name server** tab
2. Click **"Edit name server"**
3. Replace the 4 IONOS nameservers with Cloudflare's two
4. Save
5. Back in Cloudflare → click **"I updated my nameservers"**
6. Wait 1-2 hours for propagation

Once active, Cloudflare auto-manages DNS — no manual A records needed for Pages.

### `/admin` route
Cloudflare Pages serves `admin/index.html` automatically at `/admin` (directory index).
No `_redirects` file needed — just place `admin/index.html` in `krackai-landing/admin/`.

**Do not use `_redirects` with `/admin → /admin.html 200`** — this causes an infinite redirect loop in Safari.

### Error: Too many redirects on /admin
**Cause:** `_redirects` file had `/admin /admin.html 200` which conflicted with browser routing.

**Fix:** Removed the redirect rule and instead placed admin panel at `krackai-landing/admin/index.html`. Cloudflare serves it natively at `/admin`.

### Error: Worker created instead of Pages
**Cause:** Cloudflare's "Create" flow defaults to Workers if you don't explicitly click the "Pages" tab.

**Fix:** Go back → click "Create" again → select "Pages" tab → "Connect to Git".

### Re-deployment (Cloudflare Pages)
Every `git push origin main` triggers an automatic deploy. No manual steps needed.

```bash
git add krackai-landing/
git commit -m "Update landing page"
git push origin main
# Cloudflare auto-deploys within 30-60 seconds
```

---

## Part 5 — Render (Backend API)

### What we did
Deployed the Node.js/Express backend to Render's free tier using Docker.

### Why Render
- Supports Docker deployments
- Supports WebSockets (required for Deepgram transcription relay)
- Free tier available
- Auto-deploys from GitHub on every push

### Why not Vercel or Netlify for the backend
Both are serverless platforms — they don't support long-running WebSocket connections, which KrackAI needs for real-time audio transcription.

### Steps

1. Go to [render.com](https://render.com) → Sign up with GitHub
2. New → **Web Service** → Connect `Zaheer2801/Krackai`
3. Configure:
   - **Name:** `krackai-api`
   - **Language:** `Docker` ← critical, not Node
   - **Root Directory:** `saas-interview-assistant-tool-api`
   - **Branch:** `main`
   - **Instance Type:** Free
4. Add all environment variables (see below)
5. Deploy

### Environment variables required

| Variable | Description |
|----------|-------------|
| `PORT` | `3000` |
| `NODE_ENV` | `production` |
| `MONGO_URI` | Full MongoDB Atlas connection string |
| `JWT_SECRET` | Any long random string for signing tokens |
| `OPENAI_API_KEY` | From platform.openai.com |
| `DEEPGRAM_API_KEY` | From deepgram.com |
| `FRONTEND_URL` | `https://krackai.org` |
| `EMAIL_FROM` | `KrackAI <hello@krackai.org>` |
| `RESEND_API_KEY` | From resend.com (for approval emails) |
| `ADMIN_PASSCODE` | Your admin access code |
| `STRIPE_SECRET_KEY` | Optional — only needed for payments |

### Error 1: Wrong language setting
**Cause:** Render auto-detected `Node` as the language. This caused it to run `yarn` as build/start commands instead of using Docker.

**Fix:** Manually change Language to `Docker`. The Dockerfile handles everything — no build or start commands needed.

### Error 2: Duplicate PORT variable
**Cause:** PORT was accidentally added twice in the environment variables form.

**Fix:** Delete one of the duplicate rows before deploying.

### Error 3: TypeScript build errors
**Errors:**
```
src/middlewares/auth.ts: Type 'string | undefined' is not assignable to type 'string'
src/controllers/support.ts: Cannot find name 'email'. Did you mean 'emailjs'?
```

**Cause 1:** The JWT payload interface in `jwt.ts` had optional fields (`username?`, `email?`, `role?`) but `auth.ts` expected required strings.

**Fix:** Added fallback values:
```typescript
req.user = {
  _id: decoded._id,
  username: decoded.username || '',
  email: decoded.email || '',
  role: decoded.role || 'user',
};
```

**Cause 2:** `support.ts` referenced `email` variable which was out of scope. The correct variable was `userEmail`.

**Fix:**
```typescript
// Before (wrong)
console.log(`Support request received from ${name} <${email}>`);
// After (correct)
console.log(`Support request received from ${name} <${userEmail}>`);
```

### Error 4: Stripe crashes on startup
**Error:**
```
Error: Neither apiKey nor config.authenticator provided
at Stripe._setAuthenticator
```

**Cause:** `STRIPE_SECRET_KEY` was not set in environment variables. Stripe was initializing at module load time and crashing the entire server.

**Fix:** Made Stripe initialization conditional:
```typescript
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-12-15.clover" })
  : null;
```
Added null guard before any Stripe usage:
```typescript
if (!stripe) return res.status(503).json({ error: "Payment not configured" });
```

Same fix applied to `stripe_webhook.ts`.

### Dockerfile (already in repo)
```dockerfile
FROM node:20-slim AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npx tsc

FROM node:20-slim
WORKDIR /app
COPY --from=builder /app/package*.json ./
COPY --from=builder /app/dist ./dist
RUN npm ci --only=production && npm cache clean --force
EXPOSE 3000
ENV NODE_ENV=production
ENV PORT=3000
CMD ["node", "dist/index.js"]
```

---

## Part 6 — UptimeRobot (Keep-Alive)

### What we did
Set up a free UptimeRobot monitor to ping the backend every 5 minutes.

### Why
Render's free tier **spins down** the server after 15 minutes of inactivity. The next request after sleep takes 30-50 seconds to respond. UptimeRobot prevents this by sending a request every 5 minutes.

### Steps

1. Go to [uptimerobot.com](https://uptimerobot.com) → Create free account
2. **Add New Monitor:**
   - Monitor Type: `HTTP(s)`
   - Friendly Name: `KrackAI API`
   - URL: `https://krackai-api.onrender.com/health`
   - Monitoring Interval: `5 minutes`
3. Save

### Health endpoint (added to backend)
```typescript
app.get("/health", (_req, res) => res.json({ status: "ok" }));
```
This lightweight endpoint gives UptimeRobot something to ping without touching the database.

---

## Part 7 — Google OAuth

### What we did
Set up Google Sign-In on the landing page using Google Identity Services (GIS).

### Why
Users sign in with their Google account to view a preview dashboard. Access to the full app still requires an 8-character access code sent by the admin.

### Steps

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a new project: `KrackAI`
3. **APIs & Services → OAuth consent screen:**
   - App name: `KrackAI`
   - User support email: your email
   - Authorized domains: `krackai.org`
4. **APIs & Services → Credentials → Create Credentials → OAuth Client ID:**
   - Application type: Web application
   - Name: `Web client 1`
5. **Authorized JavaScript origins:**
   ```
   https://krackai.org
   https://www.krackai.org
   ```
6. **Authorized redirect URIs:**
   ```
   https://krackai.org
   ```
7. Copy the **Client ID** (public — safe to put in HTML)
8. Never put the **Client Secret** in frontend code

### Error encountered: origin_mismatch
**Error:**
```
Access blocked: Authorization Error
Error 400: origin_mismatch
```

**Cause:** The domain the user was accessing from (Netlify staging URL or krackai.org) was not added to Authorized JavaScript Origins in Google Cloud Console.

**Fix:** Add the exact origin URL to Authorized JavaScript Origins and wait 5 minutes for Google to propagate the change.

### How Google Auth works in the landing page
```
User clicks "Sign in with Google"
        │
        ▼
Google Identity Services popup
        │
        ▼
Google returns user profile (name, email, avatar)
        │
        ▼
Dashboard preview shown (blurred/locked)
        │
        ▼
User enters 8-character access code
        │
        ▼
POST /login → backend validates → JWT token
        │
        ▼
Dashboard unlocked + download available
```

---

## Part 8 — Access Code Flow

### How it works end-to-end

1. **User visits krackai.org** → fills Request Access form (name, email, phone, duration, T&C)
2. **Form submits** to `POST https://api.krackai.org/access-request` → saved to MongoDB
3. **Admin logs into the app** with admin passcode → sees all pending requests in admin panel
4. **Admin clicks Approve** → backend auto-generates 8-character code → sends email to user
5. **User receives email** → downloads `.exe` → enters code → starts using KrackAI

### Admin endpoints
| Endpoint | Method | Description |
|----------|--------|-------------|
| `/access-request` | POST | Submit request (public) |
| `/admin/access-requests` | GET | View all requests (admin) |
| `/admin/access-requests/:id/approve` | POST | Approve + send email |
| `/admin/access-requests/:id/reject` | POST | Reject request |

---

## Re-deployment Checklist

If you need to redeploy or update the app:

### Frontend update (landing page)
```bash
# Edit krackai-landing/index.html (and admin/index.html if needed)
# Keep krackai-landing/admin.html and krackai-landing/admin/index.html in sync:
cp krackai-landing/admin/index.html krackai-landing/admin.html
git add krackai-landing/
git commit -m "Update landing page"
git push origin main
# Cloudflare Pages auto-deploys within 30-60 seconds
```

### Backend update
```bash
git add saas-interview-assistant-tool-api/
git commit -m "Update backend"
git push origin main
# Render auto-deploys within 3-5 minutes
```

### If Render deploy fails
1. Check **Events** tab in Render dashboard
2. Read the build/runtime logs
3. Common issues:
   - TypeScript errors → fix types, push again
   - Missing env variable → add in Render → Environment → redeploy
   - MongoDB connection refused → check Atlas Network Access whitelist

---

## Environment Variables Reference

### Backend (.env for local dev)
```bash
PORT=3000
NODE_ENV=development
MONGO_URI=mongodb+srv://Krackai:PASSWORD@cluster0.hjonc3z.mongodb.net/krackai?retryWrites=true&w=majority&appName=Cluster0
JWT_SECRET=your_long_random_secret_here
JWT_EXPIRES_IN=1d
OPENAI_API_KEY=sk-...
DEEPGRAM_API_KEY=...
RESEND_API_KEY=re_...
EMAIL_FROM=KrackAI <hello@krackai.org>
FRONTEND_URL=https://krackai.org
ADMIN_PASSCODE=your_admin_code
STRIPE_SECRET_KEY=sk_live_...        # Optional
STRIPE_WEBHOOK_SECRET=whsec_...      # Optional
```

---

## Cost Summary

| Service | Plan | Monthly Cost |
|---------|------|-------------|
| IONOS Domain | krackai.org | ~£10/yr |
| Cloudflare Pages | Free | £0 |
| Cloudflare DNS/CDN | Free | £0 |
| Render | Free | £0 |
| MongoDB Atlas | M0 Free | £0 |
| UptimeRobot | Free (50 monitors) | £0 |
| Google OAuth | Free | £0 |
| **Total** | | **~£1/month** |

> Netlify was used initially but hit the 300 build minutes/month limit. Replaced with Cloudflare Pages (500 builds/day, no bandwidth limits).

---

## Contacts & Service Links

| Service | URL |
|---------|-----|
| IONOS (nameservers only) | my.ionos.com |
| Cloudflare Dashboard | dash.cloudflare.com |
| Cloudflare Pages | dash.cloudflare.com → Workers & Pages → krackai |
| Render | dashboard.render.com |
| MongoDB Atlas | cloud.mongodb.com |
| UptimeRobot | uptimerobot.com |
| Google Cloud Console | console.cloud.google.com |
| GitHub Repo | github.com/Zaheer2801/Krackai |

---

*Document written based on actual deployment session — April 2026. Updated to reflect migration from Netlify to Cloudflare Pages.*
