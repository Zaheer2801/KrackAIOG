# Voice Cloning — In-Development Feature (HIDDEN)

> **Status:** Work in progress. **Not visible** in production. Do not announce on the website until complete.

## What it is
A **practice / rehearsal** feature: the candidate hears a sample answer spoken back in **their own cloned voice** so they can rehearse before the real interview.

It is **NOT** wired into live interviews and does **NOT** inject audio into any meeting — that would be a deepfake/detection risk. This is rehearsal only.

## How it stays hidden
Two independent switches, both OFF in production:

| Layer | Switch | Default | Effect when off |
|-------|--------|---------|-----------------|
| Backend | `ENABLE_VOICE_CLONE` env var | `false` | `/dev/voice/*` routes return **404** (feature doesn't exist) |
| Frontend | `environment.voiceCloneEnabled` | `false` (prod), `true` (dev) | No UI renders; service throws if called |

Even with the code merged, production behaves exactly as before.

## Architecture
```
Frontend (Angular)                     Backend (Express)              Provider
─────────────────────                  ──────────────────            ──────────
VoiceCloneService          ──POST──▶   /dev/voice/clone   ──▶  ElevenLabs /voices/add  → voiceId
  .cloneVoice(samples)                 (gated 404 if off)
  .speak(voiceId, text)    ──POST──▶   /dev/voice/speak   ──▶  ElevenLabs /text-to-speech → mp3
                                       /dev/voice/:id DELETE ▶  cleanup
```

- Backend controller: `src/controllers/voiceClone.ts`
- Backend route (gated): `src/routes/voice.ts`
- Frontend service: `src/app/services/voice/voice-clone.service.ts`

## To work on it locally
1. Get an [ElevenLabs](https://elevenlabs.io) API key (free tier works for testing).
2. Backend `.env`:
   ```
   ENABLE_VOICE_CLONE=true
   ELEVENLABS_API_KEY=your_key
   ```
3. Frontend: `environment.development.ts` already has `voiceCloneEnabled: true`.
4. Run `ng serve` (uses the development environment).
5. Build a UI that:
   - reuses the agent-training voice recordings as clone samples
   - calls `voiceClone.cloneVoice(samples)` once → stores the `voiceId`
   - on a "Hear in my voice" button → `voiceClone.speak(voiceId, answerText)`

## Capturing the user faithfully (accent, pauses, rhythm)

The clone must sound like **this individual** — their accent exactly as they speak it (American, Indian, British, etc.), their pauses, their breaths. Not a neutral/standard voice. Two things drive that:

**1. Enrollment scripts** (`src/app/services/voice/enrollment-scripts.ts`)
Six sections the user reads aloud, designed to capture everything:
| Section | Captures |
|---------|----------|
| Warm-up | default rhythm & tone |
| Sound coverage | every English phoneme (no missing sounds) |
| Questions | rising intonation |
| Numbers & terms | how they say digits/acronyms |
| Emphasis | confident, stressed delivery |
| Long pauses | real breathing & pacing |

Recording rules are in the same file (quiet room, natural pace, keep your own accent, 3-5 min total).

**2. Cloning tier — for maximum accent fidelity**
- **Instant Voice Clone** (current default): ~1-3 min audio, instant, good fidelity. Fine for the first version.
- **Professional Voice Cloning (PVC)**: ~30+ min audio, trains over a few hours, captures accent & micro-pauses far more faithfully. Upgrade to this when you want the clone indistinguishable from the user. Swap the `/voices/add` call for the PVC flow in `voiceClone.ts`.

## Verifying the clone (no overlap / no errors)

Endpoint: `POST /dev/voice/verify` — automated quality gate.

It synthesizes the **held-out** `VERIFICATION_SCRIPTS` (which the user did NOT record) in the cloned voice, transcribes that audio back with Deepgram, and compares word-for-word:

| Overall accuracy | Verdict |
|------------------|---------|
| ≥ 0.90 | Clean & faithful — ship it |
| 0.75-0.90 | Acceptable, minor issues |
| < 0.75 | Re-record with cleaner audio |

Low accuracy means the synthesized audio was garbled, overlapping, or artifact-heavy (because it failed to transcribe cleanly). High accuracy means it's intelligible and clean. Then a human still does a final listen against the verification checklist (does it *sound* like them, pauses natural, pitch rises on questions).

Frontend usage:
```ts
const voiceId = await voiceClone.cloneVoice(samples);
const report  = await voiceClone.verify(voiceId, VERIFICATION_SCRIPTS);
// report.overallAccuracy, report.results[].verdict
```

## Before going live
- [ ] Add UI in a practice/rehearsal screen (NOT the live interview screen)
- [ ] Store `voiceId` per user (DB) so it's reused, not re-cloned each session
- [ ] Add a clear consent + "delete my voice" control (privacy)
- [ ] Set `ENABLE_VOICE_CLONE=true` + key on the production server
- [ ] Flip `environment.ts` `voiceCloneEnabled: true`
- [ ] Only then mention it on the website
