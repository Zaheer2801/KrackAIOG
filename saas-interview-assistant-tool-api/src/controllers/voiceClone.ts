/**
 * ───────────────────────────────────────────────────────────────────────────
 * VOICE CLONING — IN-DEVELOPMENT FEATURE (HIDDEN)
 * ───────────────────────────────────────────────────────────────────────────
 * Purpose: PRACTICE / REHEARSAL only — lets a candidate hear a sample answer
 * spoken back in their own (cloned) voice so they can rehearse before the
 * real interview. This is NOT wired into live interviews and does NOT inject
 * audio into any meeting.
 *
 * Every handler is gated behind ENABLE_VOICE_CLONE === "true".
 * When the flag is unset/false (the production default) the routes respond 404,
 * so the feature is completely invisible until explicitly enabled for dev.
 *
 * Requires (only when enabled): ELEVENLABS_API_KEY in the environment.
 * ───────────────────────────────────────────────────────────────────────────
 */
import { Request, Response, NextFunction } from "express";

const ELEVEN_BASE = "https://api.elevenlabs.io/v1";

// Guard middleware — makes the whole feature 404 unless explicitly enabled.
export const requireVoiceCloneFlag = (
  _req: Request,
  res: Response,
  next: NextFunction
) => {
  if (process.env.ENABLE_VOICE_CLONE !== "true") {
    return res.status(404).json({ message: "Not found." });
  }
  if (!process.env.ELEVENLABS_API_KEY) {
    return res.status(503).json({ message: "Voice service not configured." });
  }
  next();
};

/**
 * POST /dev/voice/clone
 * Body: multipart form with one or more short audio samples (the user's voice).
 * Returns: { voiceId } — store this with the user to reuse for synthesis.
 *
 * Uses ElevenLabs Instant Voice Clone. The frontend should collect 30-90s of
 * clean speech (e.g. reuse the agent-training voice recordings).
 */
export const cloneVoice = async (req: Request, res: Response) => {
  try {
    const files = (req as any).files as Express.Multer.File[] | undefined;
    if (!files || files.length === 0) {
      return res.status(400).json({ error: "No voice samples uploaded." });
    }

    const form = new FormData();
    form.append("name", `krack_user_${Date.now()}`);
    form.append(
      "description",
      "KrackAI practice-mode voice (rehearsal only)"
    );
    for (const f of files) {
      const fs = await import("fs/promises");
      const buf = await fs.readFile(f.path);
      form.append("files", new Blob([buf]), f.originalname || "sample.webm");
      await fs.unlink(f.path).catch(() => {});
    }

    const r = await fetch(`${ELEVEN_BASE}/voices/add`, {
      method: "POST",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string },
      body: form as any,
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Voice clone failed", detail });
    }
    const data = await r.json();
    return res.json({ voiceId: data.voice_id });
  } catch (err: any) {
    console.error("Voice clone error:", err);
    return res.status(500).json({ error: err.message || "Clone failed" });
  }
};

/**
 * POST /dev/voice/speak
 * Body: { voiceId, text }
 * Returns: audio/mpeg stream of the text spoken in the cloned voice.
 */
export const speakInVoice = async (req: Request, res: Response) => {
  try {
    const { voiceId, text } = req.body || {};
    if (!voiceId || !text?.trim()) {
      return res.status(400).json({ error: "voiceId and text are required." });
    }
    // Cap text length — rehearsal answers, not essays
    const safeText = String(text).slice(0, 3000);

    const r = await fetch(`${ELEVEN_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
      method: "POST",
      headers: {
        "xi-api-key": process.env.ELEVENLABS_API_KEY as string,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: safeText,
        model_id: "eleven_turbo_v2_5", // fast, natural
        voice_settings: { stability: 0.5, similarity_boost: 0.8 },
      }),
    });

    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Synthesis failed", detail });
    }

    res.setHeader("Content-Type", "audio/mpeg");
    const arrayBuf = await r.arrayBuffer();
    return res.send(Buffer.from(arrayBuf));
  } catch (err: any) {
    console.error("Voice speak error:", err);
    return res.status(500).json({ error: err.message || "Synthesis failed" });
  }
};

/**
 * POST /dev/voice/verify
 * Body: { voiceId, scripts: [{ id, text }] }
 * For each script: synthesize it in the cloned voice, transcribe that audio
 * back with Deepgram, and compare to the original text. A clean clone is highly
 * intelligible, so a high word-match score means no overlap / garbling / errors.
 *
 * Returns per-script: { id, expected, heard, accuracy (0-1), verdict }
 * plus an overall average. This is the automated "did it clone well?" gate.
 */
export const verifyClone = async (req: Request, res: Response) => {
  try {
    const { voiceId, scripts } = req.body || {};
    if (!voiceId || !Array.isArray(scripts) || scripts.length === 0) {
      return res.status(400).json({ error: "voiceId and scripts[] are required." });
    }

    const results = [];
    for (const s of scripts.slice(0, 10)) {
      const text = String(s.text || "").slice(0, 1000);
      if (!text) continue;

      // 1. Synthesize in the cloned voice
      const ttsRes = await fetch(`${ELEVEN_BASE}/text-to-speech/${encodeURIComponent(voiceId)}`, {
        method: "POST",
        headers: {
          "xi-api-key": process.env.ELEVENLABS_API_KEY as string,
          "Content-Type": "application/json",
          Accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text,
          model_id: "eleven_turbo_v2_5",
          voice_settings: { stability: 0.5, similarity_boost: 0.8 },
        }),
      });
      if (!ttsRes.ok) {
        results.push({ id: s.id, error: "synthesis failed" });
        continue;
      }
      const audioBuf = Buffer.from(await ttsRes.arrayBuffer());

      // 2. Transcribe the synthesized audio back with Deepgram
      const dgRes = await fetch(
        "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true&punctuate=true",
        {
          method: "POST",
          headers: {
            Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
            "Content-Type": "audio/mpeg",
          },
          body: audioBuf,
        }
      );
      const dgJson: any = await dgRes.json();
      const heard: string =
        dgJson?.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";

      // 3. Word-level accuracy (how much of the intended text came back intact)
      const accuracy = wordAccuracy(text, heard);
      results.push({
        id: s.id,
        expected: text,
        heard,
        accuracy: Number(accuracy.toFixed(3)),
        verdict: accuracy >= 0.9 ? "excellent" : accuracy >= 0.75 ? "good" : "re-record",
      });
    }

    const scored = results.filter((r: any) => typeof r.accuracy === "number");
    const overall = scored.length
      ? scored.reduce((a: number, r: any) => a + r.accuracy, 0) / scored.length
      : 0;

    return res.json({
      overallAccuracy: Number(overall.toFixed(3)),
      overallVerdict: overall >= 0.9 ? "Clone is clean and faithful" : overall >= 0.75 ? "Acceptable — minor issues" : "Re-record with cleaner audio",
      results,
    });
  } catch (err: any) {
    console.error("Voice verify error:", err);
    return res.status(500).json({ error: err.message || "Verification failed" });
  }
};

// Normalized word-overlap accuracy between intended and heard text.
function wordAccuracy(expected: string, heard: string): number {
  const norm = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").split(/\s+/).filter(Boolean);
  const exp = norm(expected);
  const got = new Set(norm(heard));
  if (exp.length === 0) return 0;
  let hits = 0;
  for (const w of exp) if (got.has(w)) hits++;
  return hits / exp.length;
}

/**
 * DELETE /dev/voice/:voiceId
 * Removes a cloned voice from the provider (cleanup / privacy).
 */
export const deleteVoice = async (req: Request, res: Response) => {
  try {
    const { voiceId } = req.params;
    const r = await fetch(`${ELEVEN_BASE}/voices/${encodeURIComponent(voiceId)}`, {
      method: "DELETE",
      headers: { "xi-api-key": process.env.ELEVENLABS_API_KEY as string },
    });
    if (!r.ok) {
      const detail = await r.text();
      return res.status(502).json({ error: "Delete failed", detail });
    }
    return res.json({ ok: true });
  } catch (err: any) {
    return res.status(500).json({ error: err.message || "Delete failed" });
  }
};
