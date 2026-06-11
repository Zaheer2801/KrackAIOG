import cors from "cors";
import "dotenv/config";
import express, { Application, NextFunction, Request, Response } from "express";
import morgan from "morgan";
import rateLimit from "express-rate-limit";
import connectDB from "./config/db";
import { initializeRealtimeWebSocket } from "./config/websoket";
import interviewRoutes from "./routes/interview";
import paymentRoutes from "./routes/payment";
import webhookRoutes from "./routes/stripe_webhook";
import supportRoutes from "./routes/support";
import userRoutes from "./routes/user";
import accessRoutes from "./routes/access";
import voiceRoutes from "./routes/voice"; // in-development, hidden behind ENABLE_VOICE_CLONE flag

const app: Application = express();
const port = process.env.PORT || 3000;

const allowedOrigins = [
  "http://localhost:4200",
  "app://.",
  "http://localhost:3000",
  "https://krackai.org",
  "https://www.krackai.org",
];

// LAN IP pattern — allows mobile stealth page loaded from the desktop's LAN address
const LAN_PATTERN = /^https?:\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/;

const corsOptions: cors.CorsOptions = {
  origin: (origin, callback) => {
    if (!origin || allowedOrigins.includes(origin) || LAN_PATTERN.test(origin)) {
      callback(null, true);
    } else {
      callback(new Error("Not allowed by CORS"), false);
    }
  },
  credentials: true,
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"],
};

app.use(cors(corsOptions));
app.use(morgan("dev"));

// Trust the Render/Cloudflare proxy so rate-limit sees real client IPs
app.set("trust proxy", 1);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/", (_req, res) => res.send("API is alive"));

// Stripe webhook needs the raw body — must come before express.json()
app.use(webhookRoutes);

// Explicit body size caps — prevents large-payload memory exhaustion
app.use(express.json({ limit: "1mb" }));
app.use(express.urlencoded({ extended: true, limit: "1mb" }));

// Throttle login attempts: max 10 per 15 min per IP — blocks passcode brute-force
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many login attempts. Please try again in 15 minutes." },
});
app.use("/login", loginLimiter);

// Throttle public access-request submissions: max 5 per hour per IP — blocks spam
const accessRequestLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { message: "Too many requests. Please try again later." },
});
app.use("/access-request", accessRequestLimiter);
app.use("/api/access-request", accessRequestLimiter);

app.use(userRoutes);
app.use(accessRoutes);
app.use(interviewRoutes);
app.use(supportRoutes);
app.use(paymentRoutes);
app.use(voiceRoutes); // 404s unless ENABLE_VOICE_CLONE=true — invisible in production

const os = require("os");
app.get("/local-ip", (req, res) => {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      if (iface.family === "IPv4" && !iface.internal) {
        return res.json({ ip: iface.address });
      }
    }
  }
  res.json({ ip: "localhost" });
});

// Self-contained mobile stealth page — works without Angular being served on LAN
app.get("/stealth/:sessionId", (req, res) => {
  const { sessionId } = req.params;
  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>KrackAI Stealth</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      background: #000;
      color: #e5e5e5;
      font-family: system-ui, -apple-system, sans-serif;
      min-height: 100vh;
      padding: 1rem;
    }
    #status {
      font-size: 0.72rem;
      color: #6b7280;
      margin-bottom: 1rem;
      display: flex;
      align-items: center;
      gap: 0.5rem;
    }
    .dot { width: 8px; height: 8px; border-radius: 50%; background: #ef4444; flex-shrink: 0; }
    .dot.connected { background: #22d3ee; }
    #answers { display: flex; flex-direction: column; gap: 1rem; }
    .card {
      background: #111;
      border: 1px solid #1f2937;
      border-radius: 12px;
      padding: 1rem;
      animation: fadeIn 0.3s ease;
    }
    @keyframes fadeIn { from { opacity: 0; transform: translateY(-6px); } to { opacity: 1; transform: none; } }
    .q-label {
      font-size: 0.68rem;
      color: #4b5563;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      margin-bottom: 0.5rem;
    }
    .answer {
      font-size: 1rem;
      line-height: 1.7;
      color: #e5e5e5;
      white-space: pre-wrap;
    }
    .typing::after { content: '▋'; animation: blink 0.8s step-end infinite; color: #22d3ee; }
    @keyframes blink { 50% { opacity: 0; } }
    #empty { color: #4b5563; text-align: center; margin-top: 4rem; font-size: 0.9rem; }
  </style>
</head>
<body>
  <div id="status"><div class="dot" id="dot"></div><span id="status-text">Connecting…</span></div>
  <div id="answers"><p id="empty">Waiting for answers from laptop…</p></div>
  <script>
    const sessionId = ${JSON.stringify(sessionId)};
    const wsProto = location.protocol === 'https:' ? 'wss' : 'ws';
    // location.host includes port only for non-standard ports (e.g. localhost:3000)
    // For production HTTPS (Render) it's just the hostname — no port appended
    const wsUrl = wsProto + '://' + location.host + '?sessionId=' + sessionId + '&stealth=true';

    const dot = document.getElementById('dot');
    const statusText = document.getElementById('status-text');
    const answersEl = document.getElementById('answers');
    let emptyEl = document.getElementById('empty');

    // Track cards by question key so streaming tokens UPDATE the same card
    const cards = new Map();

    function cleanText(raw) {
      return (raw || '')
        .replace(/\\*\\*(.*?)\\*\\*/g, '$1')
        .replace(/\\*(.*?)\\*/g, '$1')
        .replace(/^- /gm, '• ')
        .replace(/\`\`\`[\\s\\S]*?\`\`\`/g, '[code block]')
        .trim();
    }

    function upsertCard(question, answer, streaming) {
      const key = question || '__noq__';

      if (cards.has(key)) {
        // Update existing card — this is the streaming path
        const el = cards.get(key);
        el.answerEl.textContent = cleanText(answer);
        if (streaming) {
          el.answerEl.classList.add('typing');
        } else {
          el.answerEl.classList.remove('typing');
        }
        return;
      }

      // First time we see this question — create a new card at the top
      if (emptyEl) { emptyEl.remove(); emptyEl = null; }

      const card = document.createElement('div');
      card.className = 'card';

      if (question) {
        const ql = document.createElement('div');
        ql.className = 'q-label';
        ql.textContent = question;
        card.appendChild(ql);
      }

      const aEl = document.createElement('div');
      aEl.className = 'answer' + (streaming ? ' typing' : '');
      aEl.textContent = cleanText(answer);
      card.appendChild(aEl);

      answersEl.insertBefore(card, answersEl.firstChild);
      cards.set(key, { card, answerEl: aEl });
    }

    function connect() {
      const ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        dot.className = 'dot connected';
        statusText.textContent = 'Connected · waiting for answers';
      };
      ws.onclose = () => {
        dot.className = 'dot';
        statusText.textContent = 'Reconnecting…';
        setTimeout(connect, 3000);
      };
      ws.onerror = () => {
        statusText.textContent = 'Connection error — check same Wi-Fi';
      };
      ws.onmessage = (e) => {
        try {
          const data = JSON.parse(e.data);
          if (data.type === 'broadcast-answer') {
            // streaming=true if answer doesn't end with punctuation/newline
            const streaming = data.answer && !/[.!?\\n]$/.test(data.answer.trim());
            upsertCard(data.question || '', data.answer || '', streaming);
          }
        } catch {}
      };
    }

    connect();
    if ('wakeLock' in navigator) navigator.wakeLock.request('screen').catch(() => {});
  </script>
</body>
</html>`;
  res.setHeader("Content-Type", "text/html; charset=utf-8");
  res.send(html);
});

// Global error handler — catches errors forwarded by async middleware via next(err)
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  console.error("Unhandled error:", err);
  if (res.headersSent) return;
  res.status(500).json({ message: "Internal server error." });
});

connectDB().then(() => {
  const server = app.listen(port, () => {
    console.log(`Server listening on port ${port}`);
  });
  initializeRealtimeWebSocket(server);
});
