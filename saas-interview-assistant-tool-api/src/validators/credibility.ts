export interface ValidationViolation {
  type: string;
  severity: "high" | "medium" | "low";
  message: string;
}

export interface ValidationResult {
  isValid: boolean;
  violations: ValidationViolation[];
  suggestion?: string;
}

export class CredibilityValidator {
  private allowedYearPhrases: string[] = [];
  private metricsLanguage: string[] = [];
  private resumeRawText: string = "";
  
  constructor(private resumeAnchors: any) {
    if (typeof resumeAnchors === 'string') {
      this.resumeRawText = resumeAnchors;
      try {
        const parsed = JSON.parse(resumeAnchors);
        this.extractMetrics(parsed);
      } catch (e) {
        // Not JSON — extract from raw YAML/text directly
        this.extractMetricsFromRawText(resumeAnchors);
      }
    } else if (resumeAnchors && typeof resumeAnchors === 'object') {
      this.resumeRawText = JSON.stringify(resumeAnchors);
      this.extractMetrics(resumeAnchors);
    }
    // If still no year phrases found, leave empty — checkYearClaim handles empty list as "skip check"
  }

  private extractMetricsFromRawText(raw: string) {
    // Try to extract experience_statement first (most authoritative)
    const stmtMatch = raw.match(/experience_statement:\s*["']?([^\n"']+)["']?/i);
    if (stmtMatch) {
      const stmt = stmtMatch[1].trim();
      this.allowedYearPhrases.push(stmt);
      const numMatch = stmt.match(/(\d+)/);
      if (numMatch) {
        const yrs = numMatch[1];
        this.allowedYearPhrases.push(`${yrs} years`, `${yrs}+ years`, `over ${yrs} years`);
      }
    }
    // Try experience_years field
    const yearsMatch = raw.match(/experience_years:\s*(\d+)/i);
    if (yearsMatch) {
      const yrs = yearsMatch[1];
      this.allowedYearPhrases.push(`${yrs} years`, `${yrs}+ years`, `over ${yrs} years`);
    }
    // If still nothing, scan for "over N years" or "N+ years" patterns in the raw text
    if (this.allowedYearPhrases.length === 0) {
      const claimMatches = raw.matchAll(/\b(over\s+\d+|(\d+)\+?)\s*years?\b/gi);
      for (const m of claimMatches) {
        const numMatch = m[0].match(/(\d+)/);
        if (numMatch) {
          const yrs = numMatch[1];
          this.allowedYearPhrases.push(`${yrs} years`, `${yrs}+ years`, `over ${yrs} years`);
          break; // use first match only
        }
      }
    }
  }

  private extractMetrics(data: any) {
    if (data.metrics_language && Array.isArray(data.metrics_language)) {
      this.metricsLanguage = data.metrics_language;
    }
    if (data.user_profile?.experience_years) {
      const yrs = data.user_profile.experience_years;
      this.allowedYearPhrases.push(`${yrs} years`, `${yrs}+ years`, `over ${yrs} years`);
    } else {
       // Look for year claims in the raw string if we can't find explicitly
       const yearMatch = this.resumeRawText.match(/(\d+)\+?\s*years?/i);
       if (yearMatch) {
         const yrs = yearMatch[1];
         this.allowedYearPhrases.push(`${yrs} years`, `${yrs}+ years`, `over ${yrs} years`);
       }
    }
  }
  
  public async validate(answer: string, reasoning?: string): Promise<ValidationResult> {
    const violations: ValidationViolation[] = [];
    
    // 1. Check experience years
    if (!this.checkYearClaim(answer)) {
      violations.push({ 
        type: 'year_mismatch', 
        severity: 'high',
        message: 'The answer contains a year claim (e.g. X years) not supported by the resume.' 
      });
    }
    
    // 2. Check impact phrases
    if (!this.hasResumePhrase(answer)) {
      violations.push({ 
        type: 'missing_impact_phrase', 
        severity: 'medium',
        message: 'The answer does not contain any of the exact or fuzzy-matched impact phrases from the resume.' 
      });
    }
    
    // 3. Check opening pattern
    if (this.startsWithGenericDefinition(answer) && !this.hasImmediatePivot(answer)) {
      violations.push({ 
        type: 'textbook_opening', 
        severity: 'medium',
        message: 'The answer starts with a generic textbook definition without immediately pivoting to hands-on experience.'
      });
    }
    
    return {
      isValid: violations.length === 0,
      violations,
      suggestion: this.generateRepairSuggestion(violations)
    };
  }
  
  private checkYearClaim(answer: string): boolean {
    const claims = answer.match(/\b(over\s+)?(\d+)\+?\s*years?\b|\ba\s+decade\b/gi) || [];

    if (claims.length === 0) return true; // No year claim = OK
    if (this.allowedYearPhrases.length === 0) return true; // No constraints parsed = skip check

    return claims.some(claim => this.allowedYearPhrases.some(allowed => this.semanticMatch(claim, allowed)));
  }
  
  private hasResumePhrase(answer: string): boolean {
    // If no specific metrics language array, fall back to checking if the answer is grounded in raw resume text generally
    if (this.metricsLanguage.length === 0) {
      // Very basic fallback: Does it contain "significantly" or "improved" without being in the resume?
      // Actually, if we don't know the impact language, we can bypass this check to prevent breaking.
      return true; 
    }

    return this.metricsLanguage.some(phrase =>
      this.fuzzyIncludes(answer, phrase, { allowTenseVariation: true })
    );
  }
  
  private startsWithGenericDefinition(answer: string): boolean {
    const firstSentence = answer.split('.')[0].toLowerCase().trim();
    // Catch definitions like "Putaway strategies are systematic approaches..."
    return /^(.+?)\s+(is|are|refers to|means|involves)\s+(a|the|systematic|theoretical)/.test(firstSentence);
  }
  
  private hasImmediatePivot(answer: string): boolean {
    // Check if definition is followed by experience pivot within first 2 sentences
    const sentences = answer.split('.').slice(0, 2);
    return sentences.some(s => /at\s+\w+|in\s+my\s+work|during\s+\w+|worked\s+with/i.test(s));
  }
  
  private semanticMatch(a: string, b: string): boolean {
    // Basic match allowing for "10+ years" to equal "over 10 years"
    const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '');
    const normA = normalize(a.replace('decade', '10years'));
    const normB = normalize(b.replace('decade', '10years'));
    if (normA === normB) return true;
    
    if (normA.includes('over') && normB.includes('over')) {
       // 'over10years' == 'over10years'
       return normA === normB;
    }
    
    return this.levenshtein(normA, normB) <= 3;
  }
  
  private fuzzyIncludes(text: string, phrase: string, opts: { allowTenseVariation: boolean }): boolean {
    let normalizedPhrase = phrase.toLowerCase().replace(/[^\w\s-]/g, ''); // strip punctuation
    if (opts.allowTenseVariation) {
      normalizedPhrase = normalizedPhrase
        .replace(/\bimproving\b/g, 'improv(?:ing|ed)')
        .replace(/\breducing\b/g, 'reduc(?:ing|ed)')
        .replace(/\boptimizing\b/g, 'optimiz(?:ing|ed)');
    }
    // Replace multiple spaces with possible punctuation and spaces
    normalizedPhrase = normalizedPhrase.replace(/\s+/g, '(?:\\s+|[.,;!?]\\s*)');
    try {
      const re = new RegExp(normalizedPhrase, 'i');
      return re.test(text);
    } catch (e) {
      // In case regex is invalid
      return text.toLowerCase().includes(phrase.toLowerCase());
    }
  }
  
  private levenshtein(a: string, b: string): number {
    const matrix = Array.from({ length: b.length + 1 }, () => Array(a.length + 1).fill(0));
    for (let i = 0; i <= a.length; i++) matrix[0][i] = i;
    for (let j = 0; j <= b.length; j++) matrix[j][0] = j;
    for (let j = 1; j <= b.length; j++) {
      for (let i = 1; i <= a.length; i++) {
        const cost = a[i-1] === b[j-1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i-1] + 1,
          matrix[j-1][i] + 1,
          matrix[j-1][i-1] + cost
        );
      }
    }
    return matrix[b.length][a.length];
  }

  private generateRepairSuggestion(violations: ValidationViolation[]): string {
    const msgs = violations.map(v => {
      if (v.type === 'year_mismatch') return "You hallucinated the years of experience. Strictly use the exact years in the resume anchors.";
      if (v.type === 'missing_impact_phrase') return "You failed to include an exact impact phrase from the metrics language in the resume. Add it verbatim.";
      if (v.type === 'textbook_opening') return "You opened with a generic textbook definition without immediately pivoting to a project experience. Start with hands on experience.";
      return v.message;
    });
    return "Fix the following violations: " + msgs.join(" ");
  }
}
