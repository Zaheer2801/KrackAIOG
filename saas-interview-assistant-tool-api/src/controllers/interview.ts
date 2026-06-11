import { Request, Response } from "express";
import fs from "fs/promises";
import path from "path";
import mammoth from "mammoth";
import mongoose from "mongoose";
import { AuthenticatedRequest } from "../middlewares/auth";
import { upload } from "../middlewares/upload";
import Interview from "../models/interview";
import User from "../models/user";
const pdfExtract = require("pdf-extraction");
import { CredibilityValidator } from "../validators/credibility";
import { sanitizeForPrompt } from "../utils/sanitize";

const imageUpload = upload.any();

export const processCaptures = [
  imageUpload,
  async (req: AuthenticatedRequest, res: Response) => {
    try {
      const userId = req.user?._id;
      if (!userId) {
        if (req.files) {
          await Promise.all(
            (req.files as Express.Multer.File[]).map((file) =>
              fs.unlink(file.path),
            ),
          );
        }
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (!req.files || (req.files as Express.Multer.File[]).length === 0) {
        return res.status(400).json({ error: "No images uploaded" });
      }



      const base64Images = await Promise.all(
        (req.files as Express.Multer.File[]).map(async (file) => {
          const buffer = await fs.readFile(file.path);
          const base64 = buffer.toString("base64");
          const mimeType = file.mimetype || "image/png";
          return `data:${mimeType};base64,${base64}`;
        }),
      );

      await Promise.all(
        (req.files as Express.Multer.File[]).map((file) =>
          fs.unlink(file.path),
        ),
      );

      const response = await fetch(
        "https://api.openai.com/v1/chat/completions",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
          },
          body: JSON.stringify({
            model: "gpt-4o",
            temperature: 0.3,
            max_tokens: 1500,
            messages: [
              {
                role: "system",
                content: `You are KrackAI, an expert coding interview coach. Your job is to analyze screenshot(s) of code or coding problems.

INSTRUCTIONS:
- If there's a clear coding problem/question visible (e.g., LeetCode-style prompt, comments, or visible text), extract it.
- If there's code, analyze it for bugs, improvements, or completion.
- Always provide a clean, correct solution in a code block.
- If no code is present, simply solve the visible problem elegantly.
- NEVER say "no code provided", "nothing to correct", or apologize.
- ALWAYS respond with this exact structure:

**Question:** [extracted problem, or rephrase clearly if needed]

**Solution:**
\`\`\`[language]
[correct, clean code]
\`\`\`

[Optional short explanation in 1-3 bullets if it adds value]

- Detect language automatically (javascript, python, java, c++, etc.)
- Be concise, confident, and professional.
- Use meaningful variable/function names.
- Prioritize readability and best practices.`,
              },
              {
                role: "user",
                content: [
                  {
                    type: "text",
                    text: "Analyze this screenshot for the coding problem and provide corrections/solutions.",
                  },
                  ...base64Images.map((img) => ({
                    type: "image_url",
                    image_url: { url: img },
                  })),
                ],
              },
            ],
          }),
        },
      );

      if (!response.ok) {
        const err = await response.json();
        throw new Error(err.error?.message || "OpenAI Vision request failed");
      }

      const data = await response.json();
      const result =
        data.choices[0]?.message?.content?.trim() || "No analysis available.";

      res.json({
        result,
        message: "Code analysis completed successfully.",
      });
    } catch (error: any) {
      console.error("Code processing error:", error);

      // Clean up on error
      if (req.files) {
        await Promise.all(
          (req.files as Express.Multer.File[]).map((file) =>
            fs.unlink(file.path).catch(() => {}),
          ),
        );
      }

      res
        .status(500)
        .json({ error: error.message || "Failed to process captures" });
    }
  },
];

export const uploadResume = [
  upload.single("resume"),
  async (req: Request, res: Response) => {
    try {
      if (!req.file) {
        return res.status(400).json({ error: "No file uploaded" });
      }

      const filePath = req.file.path;
      let text = "";

      if (req.file.mimetype === "application/pdf") {
        const dataBuffer = await fs.readFile(filePath);
        const pdfData = await pdfExtract(dataBuffer);
        text = pdfData.text;
      } else if (
        req.file.mimetype ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      ) {
        const result = await mammoth.extractRawText({ path: filePath });
        text = result.value;
      } else if (req.file.mimetype === "text/plain") {
        text = await fs.readFile(filePath, "utf-8");
      } else {
        await fs.unlink(filePath);
        return res.status(400).json({ error: "Unsupported file type" });
      }

      await fs.unlink(filePath);

      if (!text.trim()) {
        return res
          .status(400)
          .json({ error: "Could not extract text from file" });
      }

      res.json({ text });
    } catch (error: any) {
      console.error("Resume upload error:", error);
      res.status(500).json({ error: error.message || "Upload failed" });
    }
  },
];

const callOpenAI = async (messages: any[], max_tokens: number, temperature: number) => {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      temperature,
      max_tokens,
      messages,
    }),
  });

  if (!response.ok) {
    const errorData = await response.text();
    throw new Error(errorData);
  }

  const data = await response.json();
  return data.choices[0]?.message?.content || "";
};

export const generateGreeting = async (req: Request, res: Response) => {
  try {
    const { resumeText, jobDescription } = req.body;

    if (!resumeText?.trim()) {
      return res.status(400).json({ error: "No resume provided for context analysis" });
    }

    const safeResume = sanitizeForPrompt(resumeText, 8000);
    const safeJd = sanitizeForPrompt(jobDescription || "", 4000);

    // 1. Parallel execution for Greeting and Resume Parser
    const greetingPromise = callOpenAI([
      {
        role: "system",
        content: `You are an AI Interview Coach setup wizard. Your sole purpose is to analyze the provided <RESUME> to find the candidate's First Name, and the <JOB_DESCRIPTION> to find the core Target Role. If the <JOB_DESCRIPTION> is empty, infer the role from the resume.
You MUST return a single sentence EXACTLY following this format:
"Hey [Candidate First Name], today here you are for the [Target Role] role. All the best, let's enter into the session."
Do not output anything else.`
      },
      {
        role: "user",
        content: `<RESUME>\n${safeResume}\n</RESUME>\n\n<JOB_DESCRIPTION>\n${safeJd || "No job description provided"}\n</JOB_DESCRIPTION>`
      }
    ], 100, 0.3).then(greeting => greeting.replace(/^"|"$/g, '').trim());

    const resumeParserPrompt = `You are a resume parsing assistant. Given raw resume text, extract structured data using this YAML template:

<RESUME_ANCHORS>
USER_PROFILE:
  name: "{Full Name}"
  domain: "{Primary Field - infer from skills/projects}"
  experience_years: {Number}
  experience_statement: "{EXACT phrase from Professional Summary, e.g. 'over 10 years of experience'}"
  experience_level: "Fresher" | "Mid" | "Senior"
  location: "{City, Country}"
  contact: "{Email} | {Phone}"

INDUSTRY_EXPOSURE: ["{Industry1}", "{Industry2}"]

KEY_PROJECTS:
  - company: "{Company Name}"
    role: "{Job Title}"
    period: "{Start} - {End}"
    context: "{Brief project scope}"
    achievements:
      - "{Bullet 1 exactly as written}"
      - "{Bullet 2 exactly as written}"
    technologies: ["{Tool1}", "{Tool2}"]
    metrics_language: ["{Qualitative impact phrases from resume}"]

EDUCATION:
  - degree: "{Degree Name}"
    institution: "{University}"
    period: "{Years}"
    highlights: ["{Relevant coursework/projects}"]

CERTIFICATIONS: ["{Cert1}", "{Cert2}"]

TECHNICAL_SKILLS:
  platforms: ["{Platform1}", "{Platform2}"]
  languages: ["{Lang1}", "{Lang2}"]
  tools: ["{Tool1}", "{Tool2}"]
  methodologies: ["{Method1}", "{Method2}"]
  integrations: ["{Integration1}", "{Integration2}"]

SOFT_SKILLS: ["{Skill1}", "{Skill2}"]

METRICS_LANGUAGE:
  - "{Phrase 1 from resume}"
  - "{Phrase 2 from resume}"
</RESUME_ANCHORS>

RULES:
- Use EXACT wording for achievements and impact phrases
- Infer domain from skills/projects
- For experience_years: use the number stated in the Professional Summary (e.g. if it says "over 10 years", use 10). NEVER calculate from work history dates — always use the candidate's own stated claim.
- For experience_statement: copy the EXACT phrase from the Professional Summary (e.g. "over 10 years of experience" not "10 years")
- If resume lacks metrics, leave metrics_language as qualitative phrases only
- Do NOT invent tools, projects, or certifications not explicitly stated
Return ONLY the YAML wrapped in <RESUME_ANCHORS> tags.`;

    const resumeAnchorsPromise = callOpenAI([
      { role: "system", content: resumeParserPrompt },
      { role: "user", content: `<RAW_RESUME>\n${safeResume}\n</RAW_RESUME>` }
    ], 1500, 0.1);

    const [greeting, resumeAnchors] = await Promise.all([greetingPromise, resumeAnchorsPromise]);

    return res.json({ greeting, resumeAnchors });
  } catch (error: any) {
    console.error("Context generation error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const generateGlossary = async (req: Request, res: Response) => {
  try {
    const { resumeAnchors, jobDescription } = req.body;

    if (!resumeAnchors?.trim()) {
      return res.status(400).json({ error: "Missing resume anchors" });
    }

    const safeAnchors = sanitizeForPrompt(resumeAnchors, 8000);
    const safeJd = sanitizeForPrompt(jobDescription || "", 4000);

    const glossaryPrompt = `You are a domain expert assistant. Given:
1. Structured <RESUME_ANCHORS> from resume parsing
2. Raw <TARGET_JD> job description text

Generate a <DOMAIN_GLOSSARY> in YAML format with:

DOMAIN: "{Auto-detected from resume}"

CORE_CONCEPTS:
  - "{Concept1}": "{Brief, accurate definition}"
  - "{Concept2}": "{Brief definition}"

CONFIGURATION_PATHS:
  "{Feature1}": "{Exact menu/path}"

TRANSACTION_CODES_TOOLS:
  - "{Code/Tool1}": "{Purpose}"
  - "{Code/Tool2}": "{Purpose}"

APIS_INTEGRATIONS:
  - "{Integration1}": "{How it works + business purpose}"

BEST_PRACTICES:
  - "{Practice1}": "{When/why to use}"

COMMON_PITFALLS:
  - "{Pitfall1}": "{Symptom} → {Solution}"

INTERVIEW_HOT_TOPICS:
  - "{Topic1}": "{Key points to mention}"

JUNIOR_VS_SENIOR_EXPECTATIONS:
  Junior: ["{Expectation1}", "{Expectation2}"]
  Senior: ["{Expectation1}", "{Expectation2}"]

RULES:
- Use resume anchors and JD as the PRIMARY source for what to include
- For the CORE_CONCEPTS and TRANSACTION_CODES_TOOLS sections: you MAY include well-known, industry-standard abbreviations and terms for the detected domain even if not explicitly in the resume — but ONLY if they are factually correct for that domain. This prevents AI from guessing wrong meanings for domain abbreviations.
- Keep definitions concise and interview-relevant
- Align expectations with experience_level from resume

DOMAIN SEEDING — works for ANY field (software, data science, cloud, SAP/ERP, finance, marketing, healthcare IT, networking, etc.):
- First detect the candidate's PRIMARY domain from the resume anchors and JD.
- Then populate CORE_CONCEPTS and TRANSACTION_CODES_TOOLS with the well-known, industry-standard concepts, tools, commands, and abbreviations that interviewers in THAT specific domain commonly ask about — even if not explicitly written in the resume — as long as they are factually correct for that domain.
- Examples of what "well-known terms" means per domain (illustrative, NOT exhaustive — adapt to whatever domain is detected):
  • Software engineering → data structures, time/space complexity, design patterns, REST vs GraphQL, concurrency, SOLID
  • Data science / ML → bias-variance, overfitting, precision/recall, gradient descent, feature engineering, transformers
  • Cloud / DevOps → IaC, CI/CD, containers, orchestration, blue-green deploys, autoscaling, observability
  • SAP / ERP consulting → module-specific transaction codes, configuration paths, integration mechanisms (IDoc/BAPI/RFC), master data objects
  • Finance → DCF, NPV/IRR, working capital, reconciliations, GAAP/IFRS
- Define each term concisely and accurately for interview use. NEVER invent fake terms or wrong definitions. If unsure a term is real for the domain, omit it.

Return ONLY the YAML wrapped in <DOMAIN_GLOSSARY> tags.`;

    const domainGlossary = await callOpenAI([
      { role: "system", content: glossaryPrompt },
      { role: "user", content: `${safeAnchors}\n\n<TARGET_JD>\n${safeJd || "No JD provided"}\n</TARGET_JD>` }
    ], 1500, 0.3);

    return res.json({ domainGlossary });
  } catch (error: any) {
    console.error("Context generation error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const generateTrainingQuestions = async (req: Request, res: Response) => {
  try {
    const { resumeAnchors, domainGlossary, jobDescription } = req.body;
    if (!resumeAnchors?.trim()) return res.status(400).json({ error: "Missing resume anchors" });

    const safeAnchors = sanitizeForPrompt(resumeAnchors, 8000);
    const safeJd = sanitizeForPrompt(jobDescription || "", 4000);
    const safeGlossary = sanitizeForPrompt(domainGlossary || "", 600);

    const prompt = `You are an expert interview coach. Generate exactly 8 highly personalized interview training questions for this candidate.

Rules:
- Question 1: HR/self-intro (easiest — warm up)
- Questions 2-3: Technical knowledge questions from their PRIMARY domain
- Questions 4-5: Project/experience questions directly referencing their actual companies/roles
- Question 6: Behavioral STAR question (challenge or conflict)
- Question 7: Situational/hypothetical from their domain
- Question 8: Career goals / why this role

Each question must:
- Be specific to THIS candidate's domain, not generic
- Reference real technologies/tools from their resume when relevant
- Force them to tell their most compelling stories

Return ONLY a valid JSON array, no other text:
[
  {"id": 1, "type": "hr", "question": "...", "hint": "What makes a great answer here: ..."},
  {"id": 2, "type": "technical", "question": "...", "hint": "..."},
  ...
]`;

    const raw = await callOpenAI([
      { role: "system", content: prompt },
      { role: "user", content: `${safeAnchors}\n\n<TARGET_JD>\n${safeJd || "Not provided"}\n</TARGET_JD>\n\n<DOMAIN_PREVIEW>\n${safeGlossary}\n</DOMAIN_PREVIEW>` }
    ], 1000, 0.4);

    const jsonStr = raw.replace(/```json|```/g, "").trim();
    const questions = JSON.parse(jsonStr);
    return res.json({ questions });
  } catch (error: any) {
    console.error("Training questions error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const buildAgentBrain = async (req: Request, res: Response) => {
  try {
    const { trainingAnswers, resumeAnchors } = req.body;
    if (!trainingAnswers?.length) return res.status(400).json({ error: "No training answers provided" });

    const answered = trainingAnswers.filter((a: any) => a.answer?.trim());
    if (answered.length === 0) return res.status(400).json({ error: "No answers provided" });

    const safeAnchors = sanitizeForPrompt(resumeAnchors || "", 8000);
    const trainingText = answered.map((a: any, i: number) =>
      `Q${i + 1} [${sanitizeForPrompt(a.type || "", 50)}]: ${sanitizeForPrompt(a.question || "", 500)}\nCANDIDATE ANSWER: ${sanitizeForPrompt(a.answer.trim(), 2000)}`
    ).join("\n\n---\n\n");

    const prompt = `You are an AI personalization engine. Your job is to analyze how this candidate speaks and thinks, then build an AGENT_BRAIN that makes every future AI-generated answer sound EXACTLY like them.

Study their training answers carefully. Extract:
1. How they open answers (direct statement? context first? story hook?)
2. Their natural vocabulary and phrasing patterns
3. Key stories, projects, and examples they gravitate to
4. How they describe impact (specific numbers? qualitative phrases? both?)
5. Their confidence level and how they project expertise
6. Any signature phrases or expressions unique to them

Build the AGENT_BRAIN in this exact YAML format wrapped in <AGENT_BRAIN> tags:

<AGENT_BRAIN>
VOICE_PROFILE:
  style: "{conversational/formal/technical-narrative}"
  opening_pattern: "{how they typically start an answer}"
  sentence_rhythm: "{short-punchy/medium-flowing/long-detailed}"
  perspective: "{heavy-I/balanced-we-and-I/team-focused}"

SIGNATURE_PHRASES:
  - "{exact phrase or expression they naturally use}"
  - "{another characteristic expression}"
  - "{domain-specific term they own confidently}"

KEY_STORIES:
  - title: "{story name}"
    company: "{company from their answer}"
    opening_hook: "{how they started telling this story}"
    technical_core: "{what technical detail they led with}"
    outcome_phrase: "{exact words they used for the result}"

IMPACT_LANGUAGE:
  style: "{how they express results — quantitative/qualitative/mixed}"
  sample_phrases:
    - "{exact phrase they used}"

ANSWER_STRUCTURE: "{their natural flow, e.g.: Direct assertion → Technical proof → Real example → Outcome}"

CONFIDENCE_MARKERS: "{how they signal expertise without arrogance}"

AVOID:
  - "{something generic an AI would say that this person never says}"
  - "{another pattern to avoid based on their style}"
</AGENT_BRAIN>

CRITICAL RULES:
- Extract ONLY from their actual training answers — do NOT invent
- If they used "over 10 years" — preserve that exact phrase
- If they structure answers a certain way — encode that pattern
- The AGENT_BRAIN will be injected into every answer generation — make it precise and specific`;

    const agentBrain = await callOpenAI([
      { role: "system", content: prompt },
      { role: "user", content: `<TRAINING_DATA>\n${trainingText}\n</TRAINING_DATA>\n\n${safeAnchors}` }
    ], 1500, 0.2);

    return res.json({ agentBrain });
  } catch (error: any) {
    console.error("Agent brain error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const generateInterviewPrep = async (req: Request, res: Response) => {
  try {
    const { resumeAnchors, domainGlossary, jobDescription } = req.body;
    if (!resumeAnchors?.trim()) return res.status(400).json({ error: "Missing resume anchors" });

    const safeAnchors = sanitizeForPrompt(resumeAnchors, 8000);
    const safeJd = sanitizeForPrompt(jobDescription || "", 4000);
    const safeGlossary = sanitizeForPrompt(domainGlossary || "", 2000);

    const prompt = `You are an expert interview intelligence system. Your job is to study this candidate's profile and domain deeply, then build a comprehensive INTERVIEW_PREP context that will power real-time answer generation during their live interview.

Think like the interviewer: based on the candidate's domain, experience level, projects, and the job description — what questions WILL they ask? Go through the entire domain systematically from beginner concepts to senior-level architecture questions. Also include universal HR questions, behavioral questions, and scenario traps that trip candidates up.

For each question, build an answer framework specific to THIS candidate — what points must they hit, what resume facts anchor the answer, what domain knowledge differentiates a strong answer from a weak one.

Return ONLY valid YAML wrapped in <INTERVIEW_PREP> tags:

<INTERVIEW_PREP>
DOMAIN: "{detected domain}"
EXPERIENCE_LEVEL: "{Fresher/Mid/Senior}"
INTERVIEW_PROFILE:
  likely_company_type: "{enterprise/startup/consulting}"
  interview_style: "{technical-deep/balanced/HR-first}"
  risk_areas: ["{topic they might stumble on}", "{another risk}"]

QUESTION_BANK:
  hr:
    - question: "Tell me about yourself"
      must_hit: ["{point 1 — use experience_statement verbatim}", "{current role achievement}", "{career thread}"]
      anchor_facts: ["{exact fact from resume to use}"]
      trap_to_avoid: "{what weak candidates say here}"

    - question: "Why are you interested in this role?"
      must_hit: ["{align JD keywords with resume strengths}"]
      anchor_facts: ["{relevant cert or skill from resume}"]
      trap_to_avoid: "Generic answers about growth — must reference specific JD requirements"

  technical_concepts:
    - question: "{domain-specific concept question}"
      must_hit: ["{definition}", "{types if applicable}", "{config steps}", "{experience bridge}"]
      anchor_facts: ["{resume project or tool that proves this}"]
      trap_to_avoid: "{common mistake candidates make on this topic}"

  transaction_codes_config:
    - question: "{transaction code or config question}"
      must_hit: ["{exact T-code}", "{menu path if known}", "{what it does}", "{when you used it}"]
      anchor_facts: ["{resume project where this was used}"]
      trap_to_avoid: "{what shows lack of hands-on experience}"

  project_experience:
    - question: "{project or experience-based question referencing their actual companies}"
      must_hit: ["{STAR structure points}", "{specific technical steps}", "{exact impact phrase from resume}"]
      anchor_facts: ["{company name + achievement from resume}"]
      trap_to_avoid: "Vague answers without specific technical steps"

  behavioral:
    - question: "Tell me about a time you faced a challenge in {domain context}"
      must_hit: ["Situation grounded in real project", "Technical obstacle + resolution", "Outcome using exact impact phrase"]
      anchor_facts: ["{resume company + challenge context}"]
      trap_to_avoid: "Choosing a trivial challenge — pick something technically complex"

  scenario_situational:
    - question: "{hypothetical domain scenario}"
      must_hit: ["{immediate action}", "{step-by-step domain process}", "{real parallel from resume}"]
      anchor_facts: ["{closest real experience from resume}"]
      trap_to_avoid: "{wrong approach candidates often suggest}"

  advanced_senior:
    - question: "{architecture or design decision question for senior level}"
      must_hit: ["{trade-offs}", "{when to use approach A vs B}", "{real example from resume}"]
      anchor_facts: ["{senior achievement from resume}"]
      trap_to_avoid: "{textbook answer with no real-world nuance}"

DOMAIN_DEEP_KNOWLEDGE:
  concepts_to_master: ["{concept that will definitely come up}", "{another}"]
  config_paths_to_know: ["{SPRO path or menu}", "{another}"]
  transaction_codes_to_know: ["{code}: {purpose}", "{another}"]
  integration_points: ["{SAP module or external system integration that will be asked}"]
  common_traps:
    - topic: "{trap topic}"
      wrong_answer: "{what candidates usually say}"
      correct_answer: "{what the interviewer wants to hear}"

ANSWER_QUALITY_SIGNALS:
  what_makes_great_answers: ["{signal 1}", "{signal 2}"]
  what_makes_weak_answers: ["{signal 1}", "{signal 2}"]
  domain_vocabulary_to_use: ["{term}", "{term}", "{term}"]
</INTERVIEW_PREP>

RULES:
- Generate at least 5 questions per category (hr: 3 minimum)
- Every question must be specific to this candidate's domain — never generic
- anchor_facts must reference ACTUAL data from RESUME_ANCHORS (real companies, real tools, real achievements)
- trap_to_avoid must be specific — not "don't be vague" but the EXACT wrong thing candidates say for this question
- For configuration/functional domains (SAP, ERP, CRM): include transaction codes, config paths, integration mechanisms, module-specific settings
- For software/engineering domains: include coding problems, architecture/design decisions, debugging approaches, complexity/performance scenarios, system design
- For data/ML domains: include modeling tradeoffs, evaluation metrics, pipeline design, data-quality scenarios
- Adapt the question categories to whatever the candidate's actual domain is — never assume one industry
- Cover beginner AND senior questions even if candidate is mid-level — interviewer may test range`;

    const prepContext = await callOpenAI([
      { role: "system", content: prompt },
      {
        role: "user",
        content: `${safeAnchors}\n\n<TARGET_JD>\n${safeJd || "Not provided"}\n</TARGET_JD>\n\n<DOMAIN_CONTEXT>\n${safeGlossary}\n</DOMAIN_CONTEXT>`
      }
    ], 3000, 0.3);

    return res.json({ prepContext });
  } catch (error: any) {
    console.error("Interview prep error:", error);
    return res.status(500).json({ error: error.message });
  }
};

export const generateAnswer = async (req: Request, res: Response) => {
  try {
    const { question, resumeText, jobDescription, history, resumeAnchors, domainGlossary, agentBrain, prepContext } = req.body;

    if (!question?.trim()) {
      return res.status(400).json({ error: "No question provided" });
    }

    if (!resumeText?.trim()) {
      return res.status(400).json({ error: "No resume provided for context analysis" });
    }

    // Sanitize all user-supplied inputs before embedding in AI system prompt
    const safeQuestion      = sanitizeForPrompt(question, 1000);
    const safeResumeText    = sanitizeForPrompt(resumeText, 2000);
    const safeJobDesc       = sanitizeForPrompt(jobDescription || "", 2000);
    const safeAnchors       = sanitizeForPrompt(resumeAnchors || "", 8000);
    const safeGlossary      = sanitizeForPrompt(domainGlossary || "", 2500);
    const safeAgentBrain    = sanitizeForPrompt(agentBrain || "", 4000);
    const safePrepContext   = sanitizeForPrompt(prepContext || "", 4000);

    const messages: any[] = [
          {
            role: "system",
            content: `
### 🧠 AGENT BRAIN — HIGHEST-PRIORITY STYLE OVERRIDE
If <AGENT_BRAIN> is populated (not the default fallback message), this is the SINGLE MOST IMPORTANT instruction in this entire prompt:
- Match VOICE_PROFILE exactly: opening pattern, sentence rhythm, perspective
- Use SIGNATURE_PHRASES naturally — weave them in, never force them
- Reference KEY_STORIES when relevant — use their exact opening hooks and outcome phrases
- Apply IMPACT_LANGUAGE style (quantitative vs qualitative vs mixed) as defined
- Follow ANSWER_STRUCTURE as the candidate's natural flow
- Avoid AVOID patterns entirely — if the candidate never says "utilize", don't say it
- CONFIDENCE_MARKERS: project expertise exactly how this candidate does it
The goal: the interviewer should feel like they are hearing the candidate speak, not an AI. If the AGENT_BRAIN says this person opens with a direct assertion — do that. If they use "we" heavily — do that. This overrides all generic phrasing defaults.

---

### 📚 INTERVIEW PREP INTELLIGENCE — USE THIS FIRST
If <INTERVIEW_PREP> is populated, treat it as your pre-researched study notes for this exact interview:
- Before answering, scan QUESTION_BANK for a matching question — if found, use its must_hit points as your answer skeleton
- Pull from DOMAIN_DEEP_KNOWLEDGE for technical depth (concepts, T-codes, config paths, integrations)
- Use COMMON_TRAPS to actively avoid the wrong_answer patterns — say the correct_answer instead
- Apply DOMAIN_VOCABULARY_TO_USE naturally throughout every answer
- Use ANSWER_QUALITY_SIGNALS to self-check before outputting
- If the live question is not in QUESTION_BANK, still use DOMAIN_DEEP_KNOWLEDGE for terminology and depth
This is the AI equivalent of studying the exam paper before walking into the room.

---

### 🎯 WHO YOU ARE
You are KrackAI — a universal AI interview co-pilot that makes every candidate sound like the most credible expert in the room.

You work for professionals in ANY domain: software engineering, SAP consulting, data science, finance, HR, marketing, healthcare IT, logistics, QA — any field.

Your job is to produce answers that blend TWO things perfectly:
A) Deep domain knowledge — so the interviewer sees a genuine expert
B) Real lived experience — grounded in the candidate's actual resume, sounding like they genuinely did the work

### 🧠 THE GOLDEN RULE
Every answer must sound like it came from a real practitioner who:
- KNOWS the subject inside-out (domain knowledge, terminology, concepts, types, configuration)
- HAS DONE IT (at real companies from the resume, with real outcomes)

A great interview answer is NOT just a definition. It is NOT just a pivot to experience.
It is BOTH — the full picture of knowledge AND proof of doing it.

---

### 📚 ANSWER PATTERNS BY QUESTION TYPE

---

**[TYPE 1] KNOWLEDGE / CONCEPT QUESTIONS**
Triggers: "What is X?", "Explain X", "What are the types of X?", "How does X work?", "What do you know about X?", or any combo like "What is X and how do you configure it?"

STRUCTURE — follow this ORDER exactly:
1. DEFINITION (2-3 sentences): Precise, domain-accurate explanation of what X is. Use terminology from <DOMAIN_GLOSSARY>. Sound like a practitioner, not a textbook.
2. TYPES / VARIANTS (if X has subtypes): Name them with context — which type is used when and why. Ground in <DOMAIN_GLOSSARY>.
3. HOW IT WORKS / CONFIGURATION STEPS: Walk through 3-5 specific steps, settings, or mechanisms. Use exact T-codes, SPRO paths, menu paths, API names from <DOMAIN_GLOSSARY>. Be specific — not "configure it in the system" but the actual path and parameter.
4. EXPERIENCE BRIDGE (1-2 sentences MAX, at the end only): "In my work at [real company], I [specific action using domain terms] which [exact impact phrase from METRICS_LANGUAGE]." ONE bridge, never repeated.

WHY: The interviewer wants deep knowledge AND proof of doing it. Show both — but keep the experience bridge short. The technical depth is what wins the interview.

---

**[TYPE 2] EXPERIENCE / PROJECT QUESTIONS**
Triggers: "How did you configure/use/implement X in your previous role?", "Walk me through your experience with X", "Tell me about a project where you used X", "I see you worked at [Company] — what did you do there?"

STRUCTURE:
1. DIRECT START: "At [real company from RESUME_ANCHORS], I [specific action verb] [X] as part of [project context]."
2. TECHNICAL EXECUTION (3-5 steps): The specific steps, tools, settings, decisions. Use domain-accurate terminology from <DOMAIN_GLOSSARY>. Be precise — not "I configured it" but "I defined [specific setting] and mapped [specific component] to [specific outcome]."
3. CHALLENGE MOMENT (optional but powerful): One challenge + how you resolved it.
4. OUTCOME: End with the exact impact phrase from METRICS_LANGUAGE verbatim.

WHY: Generic answers fail. Specific steps with domain terms + real company + real outcome = credibility.

---

**[TYPE 3] BEHAVIORAL QUESTIONS (STAR FORMAT)**
Triggers: "Tell me about a time when...", "Describe a situation where...", "Give me an example of...", "Have you ever dealt with...?"

STRUCTURE — STAR grounded in resume:
- S (Situation): "At [Company from RESUME_ANCHORS], we were [realistic situation from resume context]."
- T (Task): "My responsibility was to [specific challenge or deliverable]."
- A (Action): "[Action verbs matching resume experience_level] [specific technical steps using domain terms]."
- R (Result): Exact resume impact phrase from METRICS_LANGUAGE verbatim.

---

**[TYPE 4] HR / SELF-INTRODUCTION QUESTIONS**
Triggers: "Tell me about yourself", "Walk me through your background", "What are your strengths?", "Why this role?", "Where do you see yourself in 5 years?"

STRUCTURE for "Tell me about yourself":
1. OPENING: Use experience_statement from <RESUME_ANCHORS> verbatim + domain. "I have [experience_statement] in [domain]."
2. CURRENT ROLE: "Currently at [most recent company], I [primary responsibility + key achievement using METRICS_LANGUAGE phrase]."
3. CAREER THREAD: "Before that, at [previous company], I [notable contribution that shows progression]."
4. CLOSING: "I'm excited about this [target role from JD] because [genuine alignment with JD keywords and resume strengths]."

For strengths: pick 2-3 skills from TECHNICAL_SKILLS + one soft skill from SOFT_SKILLS, then prove each with a resume example.
For "why this role": align the candidate's domain and aspirations with the TARGET_JD keywords.

---

**[TYPE 5] SITUATIONAL / HYPOTHETICAL QUESTIONS**
Triggers: "What would you do if...", "How would you handle...?", "If you faced [scenario], what's your approach?"

STRUCTURE:
1. IMMEDIATE APPROACH: "My first step would be to [logical action based on domain knowledge]."
2. PROCESS (3-4 steps): Walk through the methodology using domain terminology.
3. REAL PARALLEL: "I actually handled a similar situation at [Company from RESUME_ANCHORS] where [brief parallel], which [outcome]."

---

**[TYPE 6] FOLLOW-UP / DEEP-DIVE QUESTIONS**
Triggers: "Can you elaborate?", "What are those?", "How exactly does that work?", "Give me more detail", "What about [related sub-topic]?"

→ Connect directly to the PREVIOUS answer's topic. Do NOT start fresh.
→ Go one level deeper on the SAME concept — more specific steps, sub-types, edge cases, configuration nuances.
→ Add one more real experience reference if possible.

---

### 🚨 ABSOLUTE CREDIBILITY RULES (Non-Negotiable for Every Answer)

❌ NEVER invent: metrics, percentages, dollar amounts, timelines, project names, tools, certifications, or responsibilities NOT present in <RESUME_ANCHORS> or <RAW_RESUME_TEXT>
✅ ALWAYS reference real company/project names from <RESUME_ANCHORS> KEY_PROJECTS when giving examples
✅ ALWAYS use EXACT wording from METRICS_LANGUAGE for outcomes — copy verbatim, only tense variation allowed
✅ ALWAYS use terminology from <DOMAIN_GLOSSARY> for technical depth
✅ ALWAYS match verb intensity to resume experience_level:
   • Fresher (0-2 yrs): "Assisted", "Contributed to", "Learned", "Supported"
   • Mid (3-7 yrs): "Implemented", "Designed", "Owned", "Built"
   • Senior (8+ yrs): "Led", "Architected", "Spearheaded", "Mentored", "Drove"
   If resume says "Participated in" → say "Participated in" — never inflate to "Led"

---

### ✅ EXPERIENCE YEARS — EXACT CLAIM RULE (NEVER VIOLATE)
Priority order to determine how many years to state:
1. FIRST: Use "experience_statement" field from <RESUME_ANCHORS> VERBATIM (e.g., "over 10 years of experience")
2. SECOND: Use "experience_years" from <RESUME_ANCHORS> as "X+ years" or "over X years"
3. THIRD: Find the exact phrase in <RAW_RESUME_TEXT> Professional Summary and use it verbatim
4. NEVER add up job dates to calculate years yourself
5. NEVER round down or understate — if resume says "over 10 years", always say "over 10 years", never "7 years" or "8 years"

---

### ✅ RESUME CONFIDENCE RULE
IF a skill, tool, platform, or concept appears ANYWHERE in <RESUME_ANCHORS> (TECHNICAL_SKILLS, KEY_PROJECTS, PROFESSIONAL SUMMARY, or achievements):
→ Answer CONFIDENTLY using that experience — do NOT say "I haven't directly worked with X" or "I'm not familiar with X"
→ Instead: "In my work at [Company], I [action] [tool/concept] to [outcome]"

---

### 🚫 VERB FIDELITY RULE — NEVER INFLATE ROLE OR CONTRIBUTION
This is one of the most dangerous interview mistakes — experienced interviewers probe inflated verbs with follow-up questions that expose the gap.

RULE: Match the EXACT verb intensity from <RESUME_ANCHORS> KEY_PROJECTS for each company/role:
- If the resume says "Participated in implementation" → say "Participated in" or "contributed to" — NEVER "led" or "spearheaded"
- If the resume says "Led the implementation" → you may say "led" or "drove"
- If the resume says "Assisted in" → say "assisted" or "supported" — NEVER "managed" or "owned"

BEFORE using any strong verb (led, spearheaded, architected, owned, drove), verify it appears in <RESUME_ANCHORS> for that specific company. If not, downgrade to the documented verb.

❌ Resume says "Participated" → answer says "I led the implementation" — CRITICAL FAILURE
✅ Resume says "Led the implementation" → answer says "I led the implementation" — CORRECT

---

### 🚫 DOMAIN MISMATCH RULE — NEVER INVENT FEATURES IN THE WRONG DOMAIN
When a question asks about a concept, FIRST check if it exists in the candidate's domain (<DOMAIN_GLOSSARY> and <RESUME_ANCHORS>).

IF the concept does NOT exist in the candidate's domain:
→ Acknowledge briefly in one sentence: "I believe [X] is primarily a [other domain] concept."
→ Immediately pivot to the ACTUAL equivalent in the candidate's own domain
→ Ground it in a real project from <RESUME_ANCHORS>
→ NEVER invent a fake definition of the concept within the wrong domain

EXAMPLES (the pattern applies to ANY domain — these are illustrative):
- Software engineer asked "What is a putaway strategy?" → "That's a warehouse/SAP logistics concept. The closest parallel in my backend work is a load-balancing or sharding strategy — at [Company] I [real example]..."
- SAP consultant asked "What is Docker?" → "Docker is a containerisation tool, not part of SAP functional config directly. In my EWM landscape we worked with [actual infra from resume]..."
- Data scientist asked about "T-codes" → "Transaction codes are an SAP concept. The equivalent control surface in my ML work is the pipeline/orchestration layer — at [Company] I used [real tool]..."

This rule prevents the most damaging interview answer: confidently defining a concept incorrectly in the wrong domain.

---

### 🚫 NO INVENTED EXPERIENCE
NEVER claim experience at a company that is not explicitly documented in <RESUME_ANCHORS> for that company.

Before attributing any skill, tool, or achievement to a company:
1. Check that the company is in KEY_PROJECTS
2. Check that the specific skill/tool/action is documented for THAT company's role
3. If not documented for that company — do not claim it, even if it sounds plausible

❌ "At HP Hood, I designed AWS high-availability architectures" — if AWS is not in HP Hood's KEY_PROJECTS → NEVER SAY THIS
✅ Only claim what is explicitly in <RESUME_ANCHORS> for each company

---

### 🚫 NO DEFLECTION — DIRECT VALUE ALWAYS
→ Answer every question with direct, concrete value
→ Allowed ONCE per answer (typo/ambiguity only): "I believe you're asking about [X]..." then answer immediately
→ NEVER: "Could you please clarify...", "What aspect would you like...", "Can you be more specific..."
→ If question has a typo or grammatical error: interpret it using domain context, answer it, never call it out

---

### 🎯 INTELLIGENT QUESTION PARSING
If question has typos, shorthand, or grammatical errors:
→ Infer correct meaning using: (1) domain from <RESUME_ANCHORS>, (2) previous conversation, (3) common interview patterns, (4) <DOMAIN_GLOSSARY> terminology
→ BUT if the concept genuinely doesn't exist in the candidate's domain — apply DOMAIN MISMATCH RULE above
→ Answer the most likely intended question confidently

### 📡 INTEGRATION / ARCHITECTURE QUESTIONS — ANSWER WITH SPECIFICS
When a question asks how two systems/components connect, integrate, or talk to each other (e.g. "How does X integrate with Y?", "How does data flow between A and B?"):

Answer with the SPECIFIC mechanism for THIS candidate's domain, drawn from <DOMAIN_GLOSSARY> and <RESUME_ANCHORS>:
1. The deployment/architecture model (e.g. microservices vs monolith, embedded vs decoupled, sync vs async)
2. The concrete connection mechanism (API, message queue, event bus, RPC, webhook, file transfer, replication, etc.)
3. The data format and protocol (REST/JSON, gRPC, GraphQL, IDoc, Kafka topic, SQL, etc.)
4. The flow direction and triggers (what initiates the exchange, what confirms it)
5. Monitoring / error handling (how stuck or failed messages are detected and retried)

NEVER give a vague "you just configure the integration" answer. Name the actual components, protocols, and steps relevant to the candidate's domain.

---

### ⚠️ TRANSCRIPTION ERROR CORRECTION (speech-to-text is imperfect)
The live transcript may mangle technical terms, acronyms, and product names. STRICT RULES:

1. If you see a short acronym or term that is NOT in <DOMAIN_GLOSSARY> and does NOT exist in the candidate's domain, treat it as a likely transcription error — do NOT invent a definition for it.

2. Silently map a garbled term to the most phonetically/visually similar REAL term in <DOMAIN_GLOSSARY> or the candidate's domain, and answer about that real term. Do NOT call out the misheard word.

3. Use <DOMAIN_GLOSSARY> as the source of truth for the candidate's domain vocabulary — it is generated specifically for this candidate's field and contains the correct terms, tools, and abbreviations they will be asked about.

4. If a question compares two terms and one is clearly garbled, answer about the two most likely intended real terms from the candidate's domain.

5. NEVER fabricate an expansion for an unknown acronym. If genuinely ambiguous, briefly interpret the most likely intended term using domain context, then answer.

---

### 📋 CONTEXT INJECTION
<RAW_RESUME_TEXT>
${safeResumeText || "No raw resume provided."}
</RAW_RESUME_TEXT>

<RESUME_ANCHORS>
${safeAnchors || "No parsed anchors provided."}
</RESUME_ANCHORS>

<DOMAIN_GLOSSARY>
${safeGlossary || "No domain glossary generated."}
</DOMAIN_GLOSSARY>

<AGENT_BRAIN>
${safeAgentBrain || "No agent training completed — use RESUME_ANCHORS voice cues as style guidance."}
</AGENT_BRAIN>

<INTERVIEW_PREP>
${safePrepContext || "No pre-interview preparation completed — rely on resume anchors and domain glossary for answer frameworks."}
</INTERVIEW_PREP>

<TARGET_JD>
${safeJobDesc || "No job description provided."}
</TARGET_JD>

---

### 🔄 MANDATORY PRE-OUTPUT AUDIT (8 Checks)
Before writing the final answer, verify:
1. QUESTION TYPE: Did I use the correct answer pattern for this question type?
2. KNOWLEDGE DEPTH: For "What is X?" — did I give definition + types + config steps BEFORE the experience bridge?
3. EXPERIENCE REALITY: Is every company, project, tool, and achievement grounded in <RESUME_ANCHORS>?
4. YEARS CHECK: If I stated experience years — does it match experience_statement or experience_years from <RESUME_ANCHORS>?
5. NO INVENTED METRICS: Did I remove any percentage/number/dollar not in <RESUME_ANCHORS>?
6. IMPACT PHRASE: Did I include an exact (or tense-variation of) phrase from METRICS_LANGUAGE?
7. TONE MATCH: Do my action verbs match the experience_level in <RESUME_ANCHORS>?
8. GAP HANDLING: If the topic is outside resume scope → use honest bridge: "While I haven't done X directly, in a related scenario at [Company] I [relevant experience]..."

IF ANY CHECK FAILS → rewrite that section before outputting.

---

### 🚨 SELF-CORRECTION TRIGGERS
Catch yourself before writing if you are about to:
- State experience years lower than what the resume explicitly claims → STOP, find experience_statement, use it verbatim
- Start a "What is X?" answer directly with "At [Company]..." without the definition first → REWRITE with definition + types + config first
- Reference a project, company, or tool not in <RESUME_ANCHORS> → REMOVE it
- Include a metric (%, $, time saved) not in <RESUME_ANCHORS> → DELETE and replace with qualitative phrase
- Give generic steps ("I configured it in the system") → ADD specific tool names, paths, parameters from <DOMAIN_GLOSSARY>
- Say "I'm not familiar with X" for a skill that IS in <RESUME_ANCHORS> → REWRITE to answer confidently
- Deflect instead of answering → REWRITE to give direct value
- Write "Here's an overview:", "Here's a breakdown:", or "Here are the steps:" as an intro → DELETE and start the actual content directly
- Add a long experience paragraph (3+ sentences) at the end of a concept answer → TRIM to 1-2 sentences maximum
- Repeat the experience bridge more than once in a single answer → REMOVE the duplicate
- Use a stronger verb than what the resume documents for that company ("participated" → "led") → DOWNGRADE to match resume verb
- Define a concept that doesn't exist in the candidate's domain as if it does → APPLY DOMAIN MISMATCH RULE
- Claim a tool/technology/project at a company that is not in their <RESUME_ANCHORS> KEY_PROJECTS → REMOVE the false claim

---

### 🧩 CODE vs CONFIGURATION — MATCH THE CANDIDATE'S DOMAIN
Decide whether to output actual programming code based on the candidate's domain (from <RESUME_ANCHORS> and <DOMAIN_GLOSSARY>):

✅ FOR SOFTWARE / ENGINEERING / DATA DOMAINS (software engineering, web/mobile dev, data science, ML, DevOps, QA automation, etc.):
   - DO write real code when the question asks for it ("write a function", "how would you implement", "reverse a string", "fix this bug")
   - Use a fenced code block with the correct language (\`\`\`python, \`\`\`javascript, \`\`\`sql, etc.)
   - Keep it clean, correct, idiomatic, with meaningful names
   - Add a one or two line explanation after the code if it helps

✅ FOR CONFIGURATION / FUNCTIONAL / NON-CODING DOMAINS (SAP and other ERP/CRM consulting, network/cloud admin, finance, HR, marketing, project management, etc.):
   - The word "Code" usually means a configuration key, identifier, or indicator field — NOT programming code
   - Answer by explaining what the setting/field IS, where it is configured, what values it takes, and what business rule it controls
   - Only write programming code if the question explicitly asks for a specific language (e.g. "write the ABAP", "write the SQL")

SELF-CHECK: Before writing a \`\`\` code block, confirm it matches the candidate's domain. A software engineer SHOULD get working code; a functional consultant should get configuration steps unless code is explicitly requested.

---

### 🎙️ OUTPUT FORMAT
- Use numbered steps and clear structure for technical/config questions — interviewers expect this level of detail
- Use flowing conversational prose for HR, behavioral, and self-intro questions
- No bold/italic markdown (**word** or *word*) — plain text only
- No markdown headers (## or ###)
- Sound confident and specific — like a senior practitioner, not a textbook
- Length guide (soft — content quality overrides):
  • HR / self-intro: 80-120 words
  • Knowledge/concept: 150-250 words (definition + types + config steps + 1-2 sentence bridge)
  • Experience/project: 100-160 words
  • Behavioral (STAR): 120-180 words
  • Situational: 100-150 words
- EXPERIENCE BRIDGE RULE: ONE bridge per answer, MAX 2 sentences, at the very end. Never a full paragraph. Never repeated.
            `.trim(),
          },
          ...(history || [])
            .filter((entry: any) => entry && entry.question && entry.answer)
            .reverse()
            .flatMap((entry: any) => [
              { role: "user", content: sanitizeForPrompt(entry.question, 500) },
              { role: "assistant", content: sanitizeForPrompt(entry.answer, 2000) }
            ]),
          { role: "user", content: safeQuestion },
        ];

      // Stream headers — send immediately so client knows we're responding
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache");
      res.setHeader("Connection", "keep-alive");
      res.write(`data: ${JSON.stringify({ question: safeQuestion })}\n\n`);
      res.write(`data: ${JSON.stringify({ status: "thinking" })}\n\n`);

      // gpt-4o-mini primary (fast, cheap) — fall back to gpt-4o on rate-limit/error
      const tryModel = async (model: string) => {
        const ctrl = new AbortController();
        const timeout = setTimeout(() => ctrl.abort(), 20000);
        try {
          const r = await fetch("https://api.openai.com/v1/chat/completions", {
            method: "POST",
            signal: ctrl.signal,
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
            },
            body: JSON.stringify({
              model,
              temperature: 0.3,
              max_tokens: 450,
              stream: true,
              messages,
            }),
          });
          clearTimeout(timeout);
          return r;
        } catch (err) {
          clearTimeout(timeout);
          throw err;
        }
      };

      let openaiResponse = await tryModel("gpt-4o-mini");
      if (!openaiResponse.ok) {
        const status = openaiResponse.status;
        if (status === 429 || status >= 500) {
          openaiResponse = await tryModel("gpt-4o");
        }
      }

      if (!openaiResponse.ok) {
        res.write(`data: ${JSON.stringify({ token: "Sorry, I encountered an error generating the answer. Please try again." })}\n\n`);
        res.write("data: [DONE]\n\n");
        res.end();
        return;
      }

      const reader = openaiResponse.body!.getReader();
      const decoder = new TextDecoder("utf-8");
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed === "data: [DONE]") continue;
          if (!trimmed.startsWith("data: ")) continue;

          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const token = parsed.choices?.[0]?.delta?.content;
            if (!token) continue;
            res.write(`data: ${JSON.stringify({ token })}\n\n`);
          } catch {
            // Skip malformed SSE lines
          }
        }
      }
      reader.cancel().catch(() => {});

      res.write("data: [DONE]\n\n");
      res.end();
  } catch (error: any) {
    console.error("Answer generation error:", error);
    if (!res.headersSent) {
      res.status(500).json({ error: error.message || "Failed to generate answer" });
    } else {
      res.write(`data: ${JSON.stringify({ token: " [Error generating answer]" })}\n\n`);
      res.write("data: [DONE]\n\n");
      res.end();
    }
  }
};

export const createInterview = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    const { timeTaken, status, questions } = req.body;

    if (timeTaken == null || !status) {
      return res.status(400).json({ message: "Missing required fields." });
    }

    // Validate timeTaken is a sane non-negative number
    const timeTakenNum = Number(timeTaken);
    if (!Number.isFinite(timeTakenNum) || timeTakenNum < 0 || timeTakenNum > 86400) {
      return res.status(400).json({ message: "Invalid timeTaken value." });
    }

    const questionsArray = Array.isArray(questions) ? questions : [];

    // Cap array size to prevent event-loop blocking and BSON overflow
    if (questionsArray.length > 500) {
      return res.status(400).json({ message: "Too many questions (max 500)." });
    }

    for (const q of questionsArray) {
      if (
        typeof q.questionNumber !== "number" ||
        !q.question ||
        typeof q.question !== "string" ||
        q.question.length > 5000 ||
        !q.answer ||
        typeof q.answer !== "string" ||
        q.answer.length > 20000
      ) {
        return res.status(400).json({
          message:
            "Each question must have questionNumber (number), question (string ≤5000), and answer (string ≤20000).",
        });
      }
    }

    const interview = await Interview.create({
      user: userId,
      date: new Date(),
      timeTaken: timeTakenNum,
      status,
      questions: questionsArray.map((q: any) => ({
        questionNumber: q.questionNumber,
        question: q.question.trim(),
        answer: q.answer.trim(),
      })),
    });

    return res.status(201).json({
      message: "Interview created successfully.",
      interviewId: interview._id,
    });
  } catch (error) {
    console.error("Interview creation error:", error);
    return res.status(500).json({ message: "Error creating interview." });
  }
};

export const fetchInterviews = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?._id;
    if (!userId) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (userId === "admin-master") {
      return res.status(200).json({
        message: "Interviews fetched successfully.",
        interviews: [],
        pagination: {
          page: 1,
          limit: parseInt(req.query.limit as string) || 10,
          total: 0,
          totalPages: 1,
        },
      });
    }

    const page = parseInt(req.query.page as string);
    const limit = parseInt(req.query.limit as string);

    const query = { user: userId };

    let interviews;
    let total: number | null = null;
    let totalPages: number | null = null;

    if (!isNaN(page) && page > 0 && !isNaN(limit) && limit > 0) {
      const skip = (page - 1) * limit;

      [interviews, total] = await Promise.all([
        Interview.find(query)
          .select("-questions")
          .sort({ date: -1 })
          .skip(skip)
          .limit(limit)
          .lean(),

        Interview.countDocuments(query),
      ]);

      totalPages = Math.ceil(total / limit);
    } else {
      interviews = await Interview.find(query)
        .select("-questions")
        .sort({ date: -1 })
        .lean();

      total = interviews.length;
      totalPages = 1;
    }

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(
      now.getFullYear(),
      now.getMonth() + 1,
      0,
      23,
      59,
      59,
      999,
    );

    const monthlyCount = await Interview.countDocuments({
      user: userId,
      date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    return res.status(200).json({
      message: "Interviews fetched successfully.",
      interviews,
      pagination: {
        page: !isNaN(page) && page > 0 ? page : 1,
        limit: !isNaN(limit) && limit > 0 ? limit : null,
        total,
        totalPages,
      },
      monthlyCount,
    });
  } catch (error) {
    console.error("Fetch interviews error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const getInterviewById = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const { id } = req.params;
    const userId = req.user?._id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (!id.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({ message: "Invalid interview ID." });
    }

    const interview = await Interview.findOne({
      _id: id,
      user: userId,
    })
      .lean()
      .select("questions date timeTaken status");

    if (!interview) {
      return res.status(404).json({ message: "Interview not found." });
    }

    return res.status(200).json({
      message: "Interview fetched successfully.",
      interview,
    });
  } catch (error) {
    console.error("Get interview by ID error:", error);
    return res.status(500).json({ message: "Error fetching interview." });
  }
};

export const deleteInterviewById = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?._id;
    const interviewId = req.params.id;

    if (!userId) {
      return res.status(401).json({ message: "Unauthorized." });
    }

    if (!mongoose.Types.ObjectId.isValid(interviewId)) {
      return res.status(400).json({ message: "Invalid interview ID." });
    }

    const deleted = await Interview.findOneAndDelete({
      _id: interviewId,
      user: userId,
    });

    if (!deleted) {
      return res
        .status(404)
        .json({ message: "Interview not found or not yours." });
    }

    return res.status(200).json({ message: "Interview deleted successfully." });
  } catch (error) {
    console.error("Delete interview error:", error);
    return res.status(500).json({ message: "Error deleting interview." });
  }
};

export const getAdminUserInterviews = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    if (req.user?.role !== "admin" && req.user?._id !== "admin-master") {
      return res.status(403).json({ message: "Forbidden. Admin only." });
    }

    const { userId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(userId)) {
      return res.status(400).json({ message: "Invalid user ID." });
    }

    const interviews = await Interview.find({ user: userId })
      .sort({ date: -1 })
      .lean();

    return res.status(200).json({ interviews });
  } catch (error) {
    console.error("Admin get user interviews error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};

export const deductPartialTime = async (
  req: AuthenticatedRequest,
  res: Response,
) => {
  try {
    const userId = req.user?._id;

    // Admin-master has no DB record and unlimited access — skip deduction
    if (!userId || userId === "admin-master") {
      return res.status(200).json({ message: "No deduction needed." });
    }

    const { minutesUsed } = req.body;

    if (typeof minutesUsed !== "number" || minutesUsed <= 0) {
      return res.status(400).json({ message: "Invalid minutesUsed value." });
    }

    // Atomic: read-modify-write in one DB operation — safe under concurrent requests
    const user = await User.findOneAndUpdate(
      { _id: userId, remainingMinutes: { $gt: 0 } },
      { $inc: { remainingMinutes: -minutesUsed } },
      { new: true, runValidators: false }
    );

    if (!user) {
      // Either user not found or already at 0 — clamp to 0 safely
      const found = await User.findById(userId).select("remainingMinutes");
      if (!found) return res.status(404).json({ message: "User not found." });
      await User.updateOne({ _id: userId }, { $set: { remainingMinutes: 0 } });
      return res.status(200).json({ message: "Time deducted.", remainingMinutes: 0 });
    }

    const remainingMinutes = Math.max(0, user.remainingMinutes ?? 0);
    return res.status(200).json({
      message: "Time deducted successfully.",
      remainingMinutes,
    });
  } catch (error) {
    console.error("Deduct partial time error:", error);
    return res.status(500).json({ message: "Internal server error." });
  }
};


