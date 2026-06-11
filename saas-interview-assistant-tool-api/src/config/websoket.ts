import { Server } from "http";
import { WebSocketServer } from "ws";
import WebSocket from "ws";
import url from "url";

const sessionRooms = new Map<string, Set<WebSocket>>();

// Per-session transcript accumulation for auto-question detection
const sessionBuffers = new Map<string, { text: string; timer: ReturnType<typeof setTimeout> | null }>();

// Words that indicate a sentence is incomplete — question not finished yet
const INCOMPLETE_ENDINGS = new Set([
  "you", "your", "the", "a", "an", "and", "but", "or", "so", "if",
  "where", "when", "how", "what", "which", "that", "this", "who",
  "have", "has", "had", "would", "could", "should", "will", "can",
  "may", "might", "to", "of", "in", "on", "at", "for", "with",
  "about", "from", "by", "as", "than", "then", "there", "were",
  "are", "is", "be", "been", "being", "do", "did", "does",
]);

// Filler words at the start of a sentence that should be stripped before pattern matching
const FILLER_PREFIXES = ["okay ", "ok ", "so ", "right ", "well ", "now ", "alright ", "sure ", "good ", "great ", "yes ", "yeah "];

function isInterviewQuestion(text: string): boolean {
  const trimmed = text.trim();
  const words = trimmed.split(/\s+/).filter(Boolean);

  // Must have at least 3 words — short questions like "What is MLOps?" should still trigger
  if (words.length < 3) return false;

  // Reject if the last word suggests the sentence is cut off mid-way
  const lastWord = words[words.length - 1].toLowerCase().replace(/[.,!;:'"]+$/, "");
  if (INCOMPLETE_ENDINGS.has(lastWord)) return false;

  // Explicit question mark — clearest signal
  if (trimmed.endsWith("?")) return true;

  // Strip leading filler words before checking starters
  // e.g. "Okay. Tell me what is POSC?" → "tell me what is POSC?"
  let t = trimmed.toLowerCase().replace(/^[^a-z]+/, ""); // strip leading punctuation
  for (const prefix of FILLER_PREFIXES) {
    if (t.startsWith(prefix)) {
      t = t.slice(prefix.length);
      break;
    }
  }

  // Strong interview question starters
  const starters = [
    "what is ", "what are ", "what was ", "what were ", "what's ",
    "what do ", "what does ", "what did ",
    "how do ", "how did ", "how does ", "how would ", "how have ", "how can ",
    "how to ", "how you ",
    "why did ", "why do ", "why would ", "why is ",
    "can you explain", "can you describe", "can you walk", "can you tell",
    "could you explain", "could you describe", "could you walk", "could you tell",
    "tell me ", // broad — catches "tell me what", "tell me about", "tell me how"
    "explain ", "describe ",
    "walk me through",
    "have you ever", "have you worked", "have you used", "have you done",
    "did you ", "do you ",
    "give me an example", "give me a ",
    "what would you do", "what would you",
    "difference between", "differences between",
    "when would you", "when do you", "when did you",
    "where do you", "where did you",
    "which is ", "which are ", "which one",
  ];
  if (starters.some((s) => t.startsWith(s))) return true;

  // Context patterns inside the sentence
  const patterns = [
    "your experience with", "your experience in",
    "your background in", "about yourself",
    "in your previous role", "in your last role", "in your current role",
    "you configured", "you implemented", "you worked on", "you handled",
    "stands for", "difference between",
    "configuration steps", "how to configure", "how do you configure",
    "transaction code", "t-code for",
    "what is your", "what was your",
  ];
  if (patterns.some((p) => t.includes(p))) return true;

  return false;
}

export function initializeRealtimeWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });

  wss.on("connection", (ws: WebSocket, req: any) => {
    const parameters = url.parse(req.url, true);
    const sessionId = parameters.query.sessionId as string;
    const isStealth = parameters.query.stealth === "true";
    // Company/proper-noun keywords passed from the frontend resume context
    const extraKeywordsRaw = (parameters.query.extraKeywords as string || '');
    const extraKeywordsList = extraKeywordsRaw
      .split(',')
      .map(k => k.trim())
      .filter(k => k.length > 0);

    if (!sessionId) {
      ws.close();
      return;
    }

    if (!sessionRooms.has(sessionId)) {
      sessionRooms.set(sessionId, new Set());
    }
    sessionRooms.get(sessionId)!.add(ws);

    let deepgramWS: WebSocket | null = null;
    let isDeepgramReady = false;

    if (!isStealth) {
      console.log(`Desktop connected to session: ${sessionId}`);

      // Domain-agnostic: boost ONLY the candidate's own resume-derived keywords
      // (company names, tools, technologies passed from the frontend). No hardcoded
      // industry terms — those would corrupt transcription for other domains
      // (e.g. SAP "HU" was turning "HP" → "HU", "ALE" was turning "LLC" → "ALE").
      const extraKeywords = extraKeywordsList
        .map((k) => `keywords=${encodeURIComponent(k)}:3`)
        .join("&");
      const domainKeywords = [extraKeywords].filter(Boolean).join("&");

      const deepgramUrl = `wss://api.deepgram.com/v1/listen?encoding=linear16&sample_rate=24000&channels=1&model=nova-2&interim_results=true&endpointing=300&smart_format=true${domainKeywords ? "&" + domainKeywords : ""}`;

      let reconnectAttempts = 0;
      const MAX_RECONNECT = 8;

      function connectDeepgram() {
        const dgWS = new WebSocket(deepgramUrl, {
          headers: { Authorization: `Token ${process.env.DEEPGRAM_API_KEY}` },
        });

        dgWS.on("open", () => {
          console.log("Connected to Deepgram");
          deepgramWS = dgWS;
          isDeepgramReady = true;
          reconnectAttempts = 0; // reset on successful connection
        });

        dgWS.on("message", (data) => {
          try {
            const event = JSON.parse(data.toString());

            if (event.type === "Results") {
              const transcript = event.channel.alternatives[0].transcript;
              if (transcript) {
                const payload = JSON.stringify({
                  type: event.is_final ? "transcription" : "transcription-delta",
                  text: transcript + (event.is_final ? " " : ""),
                });
                sessionRooms.get(sessionId)?.forEach((client) => {
                  if (client.readyState === WebSocket.OPEN) client.send(payload);
                });

                // Auto-question detection: accumulate finals with 1.5s debounce
                if (event.is_final) {
                  const buf = sessionBuffers.get(sessionId) || { text: "", timer: null };
                  buf.text += " " + transcript;
                  if (buf.timer) clearTimeout(buf.timer);

                  buf.timer = setTimeout(() => {  // 1.8s silence = interviewer finished speaking
                    const question = buf.text.trim();
                    buf.text = "";
                    buf.timer = null;
                    sessionBuffers.set(sessionId, buf);

                    if (isInterviewQuestion(question)) {
                      const autoPayload = JSON.stringify({ type: "auto-question", text: question });
                      sessionRooms.get(sessionId)?.forEach((client) => {
                        if (client.readyState === WebSocket.OPEN) client.send(autoPayload);
                      });
                    }
                  }, 1800);

                  sessionBuffers.set(sessionId, buf);
                }
              }
            } else if (event.type === "Error") {
              console.error("Deepgram Error:", event);
            }
          } catch (err) {
            console.error("Deepgram parsing error:", err);
          }
        });

        dgWS.on("close", () => {
          isDeepgramReady = false;
          deepgramWS = null;
          reconnectAttempts++;
          if (!sessionRooms.has(sessionId)) return;
          if (reconnectAttempts > MAX_RECONNECT) {
            console.error(`[Deepgram] Max reconnect attempts (${MAX_RECONNECT}) reached for session ${sessionId}. Giving up.`);
            // Notify client that transcription is unavailable
            sessionRooms.get(sessionId)?.forEach((client) => {
              if (client.readyState === WebSocket.OPEN) {
                client.send(JSON.stringify({ type: "error", message: "Transcription service unavailable. Please restart the session." }));
              }
            });
            return;
          }
          // Exponential backoff: 1s, 2s, 4s, 8s... capped at 30s
          const delay = Math.min(1000 * Math.pow(2, reconnectAttempts - 1), 30000);
          console.log(`Deepgram disconnected — reconnecting in ${delay}ms (attempt ${reconnectAttempts}/${MAX_RECONNECT})...`);
          setTimeout(() => {
            if (sessionRooms.has(sessionId)) connectDeepgram();
          }, delay);
        });

        dgWS.on("error", (err) => {
          console.error("Deepgram WS error:", err);
          isDeepgramReady = false;
        });
      }

      connectDeepgram();
    } else {
      console.log(`Stealth mobile connected to session: ${sessionId}`);
    }

    ws.on("message", (message) => {
      try {
        // Reject oversized frames before parsing — caps memory per message
        const MAX_MSG_BYTES = 256 * 1024; // 256 KB — audio chunks are ~a few KB
        if ((message as Buffer).length > MAX_MSG_BYTES) {
          console.warn(`[WS] Dropped oversized message (${(message as Buffer).length} bytes) for session ${sessionId}`);
          return;
        }

        const data = JSON.parse(message.toString());

        if (data.type === "audio-chunk") {
          if (typeof data.audio !== "string" || data.audio.length > MAX_MSG_BYTES) return;
          if (deepgramWS && deepgramWS.readyState === WebSocket.OPEN) {
            const buffer = Buffer.from(data.audio, "base64");
            deepgramWS.send(buffer);
          }
        } else if (data.type === "broadcast-answer") {
          const payload = JSON.stringify({
            type: "broadcast-answer",
            question: typeof data.question === "string" ? data.question.slice(0, 2000) : "",
            answer: typeof data.answer === "string" ? data.answer.slice(0, 20000) : "",
          });
          sessionRooms.get(sessionId)?.forEach((client) => {
            if (client !== ws && client.readyState === WebSocket.OPEN) {
              client.send(payload);
            }
          });
        } else {
          // Unknown message type — ignore silently but log for debugging
          console.warn(`[WS] Unknown message type "${data.type}" for session ${sessionId}`);
        }
      } catch (err) {
        console.error("Client message error:", err);
      }
    });

    ws.on("close", () => {
      sessionRooms.get(sessionId)?.delete(ws);
      if (sessionRooms.get(sessionId)?.size === 0) {
        sessionRooms.delete(sessionId);
        // Clean up transcript buffer when session ends
        const buf = sessionBuffers.get(sessionId);
        if (buf?.timer) clearTimeout(buf.timer);
        sessionBuffers.delete(sessionId);
      }
      if (deepgramWS) deepgramWS.close();
      console.log(`Client disconnected from session: ${sessionId}`);
    });
  });

  console.log("Transcription & Sync WebSocket server initialized");
}
