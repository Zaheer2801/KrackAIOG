// Strip prompt injection patterns from user-supplied text before embedding in AI prompts
export function sanitizeForPrompt(text: string, maxLen: number): string {
  if (text == null) return "";
  return String(text)
    .replace(/<\/?(RESUME_ANCHORS|DOMAIN_GLOSSARY|AGENT_BRAIN|INTERVIEW_PREP|RAW_RESUME_TEXT|TARGET_JD)[^>]*>/gi, "[removed]")
    .replace(/ignore\s+(all\s+)?(previous|above|prior)\s+instructions?/gi, "[filtered]")
    .replace(/you\s+are\s+now\s+[a-z]/gi, "[filtered]")
    .replace(/system\s*prompt/gi, "[filtered]")
    .slice(0, maxLen);
}
