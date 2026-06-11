/**
 * VOICE ENROLLMENT SCRIPTS — what the user reads aloud to clone their voice.
 *
 * Goal: capture the INDIVIDUAL faithfully — their accent exactly as they speak
 * it (American, Indian, British, Nigerian, whatever it is), their natural
 * pauses, breaths, rhythm and emphasis. NOT a standardized/neutralized voice.
 *
 * Why these specific scripts:
 *  - Phonetic coverage: every English vowel + consonant sound appears, so the
 *    clone reproduces all of the speaker's phonemes (no "missing sound" gaps).
 *  - Prosody variety: statements, questions, lists, emphasis and long flowing
 *    sentences — so the model learns the speaker's intonation and pacing, not
 *    just a flat monotone.
 *  - Natural pauses & breath: commas, em-dashes and longer sentences force the
 *    speaker's real pausing/breathing pattern into the sample.
 *  - Interview-relevant: numbers, acronyms and technical phrasing so the clone
 *    handles the words it will actually need to say later.
 *
 * RECORDING RULES (shown to the user before they start):
 *  1. Quiet room, no background noise, no echo. One person only.
 *  2. Use a decent mic ~15cm away. Keep volume consistent.
 *  3. Read at your NATURAL pace — do not slow down or "perform". Pause where
 *     you normally would. If you stumble, pause and re-read the whole line.
 *  4. Keep your normal accent. Do not imitate anyone.
 *  5. Aim for 3-5 minutes total of clean audio across all sections.
 */

export interface EnrollmentSection {
  id: string;
  title: string;
  purpose: string;        // what this section captures
  lines: string[];        // the user reads each line
}

export const ENROLLMENT_SCRIPTS: EnrollmentSection[] = [
  {
    id: 'warmup',
    title: '1. Natural warm-up',
    purpose: 'Captures your default speaking rhythm and tone.',
    lines: [
      "Hi, my name is going to be spoken in my own voice. I'm recording a few lines so the system can learn exactly how I talk.",
      "I speak the way I normally would, at my normal pace, with my normal pauses.",
      "This is just me, talking naturally, the way I'd talk to a colleague.",
    ],
  },
  {
    id: 'phonetic',
    title: '2. Sound coverage',
    purpose: 'Every English speech sound — so no phoneme is missing from the clone.',
    lines: [
      "The quick brown fox jumps over the lazy dog.",
      "Pack my box with five dozen liquor jugs.",
      "She sells sea shells by the shore, while the thrushes thrash through the thick brush.",
      "Bright vision, gentle measure, and a yellow garage beyond the bridge.",
      "Choose the cheese, judge the jam, and watch the whirling windmill wheels.",
    ],
  },
  {
    id: 'questions',
    title: '3. Questions & rising tone',
    purpose: 'Captures how your pitch rises — so questions sound like you.',
    lines: [
      "Could you tell me a little more about the role?",
      "What does a typical day look like on your team?",
      "How soon would you want someone to start?",
      "Is this something we can walk through together, step by step?",
    ],
  },
  {
    id: 'numbers',
    title: '4. Numbers, dates & terms',
    purpose: 'Captures how you say numbers and technical words you will need.',
    lines: [
      "I worked there from twenty nineteen to twenty twenty four, just over five years.",
      "We reduced processing time by about forty percent across three regions.",
      "The pipeline handled roughly 1.2 million records every single day.",
      "I've worked with Python, Java, SQL, REST APIs, Docker and Kubernetes.",
    ],
  },
  {
    id: 'emphasis',
    title: '5. Emphasis & confidence',
    purpose: 'Captures your stressed, confident delivery — not just a flat tone.',
    lines: [
      "I genuinely believe this was the most important project I've ever led.",
      "We did NOT cut corners — we rebuilt it properly, from the ground up.",
      "That result? That was the moment everything clicked for the whole team.",
      "I'm confident I can bring exactly that kind of impact here.",
    ],
  },
  {
    id: 'flowing',
    title: '6. Long, natural pauses',
    purpose: 'Captures your real pausing, breathing and rhythm over longer speech.',
    lines: [
      "When I first joined the company, things were honestly a bit chaotic — there were no clear processes, the data was scattered, and nobody really owned the outcome, so I took a step back, mapped out what was actually happening, and slowly, piece by piece, started putting structure around it.",
      "The way I think about it is simple: understand the problem first, talk to the people who live with it every day, and only then start building — because if you skip that step, you end up solving the wrong thing really efficiently.",
      "So, to sum it up — I care about doing the work properly, I care about the people I work with, and I care about leaving things in a better state than I found them.",
    ],
  },
];

/**
 * VERIFICATION SCRIPTS — read by the model AFTER cloning (held-out, the user
 * did NOT record these). Synthesize each, then listen and compare to the user's
 * real voice. They probe the things clones most often get wrong.
 */
export const VERIFICATION_SCRIPTS: { id: string; checks: string; text: string }[] = [
  {
    id: 'identity',
    checks: 'Does it sound like the SAME person? Accent intact?',
    text: "This is a test of my cloned voice. If this sounds like me, with my own accent and my own way of speaking, then the clone worked.",
  },
  {
    id: 'pauses',
    checks: 'Are the pauses natural? No rushed or robotic gaps?',
    text: "Let me think about that for a second — okay, so, the way I'd approach it is, first I'd gather the requirements, then I'd prototype, and finally I'd test with real users.",
  },
  {
    id: 'question',
    checks: 'Does the pitch rise correctly on the question?',
    text: "So, just to confirm — you'd want me to own the whole pipeline end to end, right?",
  },
  {
    id: 'numbers',
    checks: 'Are numbers and acronyms pronounced cleanly?',
    text: "Over the last 3 years I scaled the system from 10,000 to 1.2 million daily requests using AWS, Kafka and PostgreSQL.",
  },
  {
    id: 'long',
    checks: 'No overlap, doubling, glitches or breath artifacts across a long sentence?',
    text: "The hardest part of that project was honestly the coordination — we had four teams in three time zones, each with their own priorities, and getting everyone aligned on a single roadmap took patience, a lot of listening, and a willingness to compromise without losing the core vision.",
  },
];
