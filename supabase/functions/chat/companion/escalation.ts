import type { EscalationResult } from "./CompanionProvider.ts";

// Deterministic keyword/phrase net — runs alongside the LLM's own
// self-reported severity tag (see CompanionProvider.ts system prompt).
// Two independent signals because neither a keyword list nor an LLM's
// self-assessment alone is reliable enough for a safety-relevant feature.
const HIGH_SIGNALS = [
  "chest pain",
  "can't breathe",
  "cannot breathe",
  "i fell",
  "i've fallen",
  "call 911",
  "want to die",
  "kill myself",
  "end my life",
  "hurt myself",
];

const MEDIUM_SIGNALS = [
  "so confused",
  "don't know where i am",
  "dizzy",
  "can't remember",
  "chest hurts",
  "in pain",
  "scared",
  "can't get up",
];

const LOW_SIGNALS = ["so alone", "lonely", "nobody calls", "bad day", "sad today"];

function matchAny(text: string, signals: string[]): string[] {
  const lower = text.toLowerCase();
  return signals.filter((s) => lower.includes(s));
}

export function scanKeywords(text: string): EscalationResult {
  const high = matchAny(text, HIGH_SIGNALS);
  if (high.length > 0) {
    return { triggered: true, severity: "high", reason: "keyword match", matchedSignals: high };
  }
  const medium = matchAny(text, MEDIUM_SIGNALS);
  if (medium.length > 0) {
    return { triggered: true, severity: "medium", reason: "keyword match", matchedSignals: medium };
  }
  const low = matchAny(text, LOW_SIGNALS);
  if (low.length > 0) {
    return { triggered: true, severity: "low", reason: "keyword match", matchedSignals: low };
  }
  return { triggered: false, severity: "none" };
}

const SEVERITY_RANK: Record<EscalationResult["severity"], number> = {
  none: 0,
  low: 1,
  medium: 2,
  high: 3,
};

// The higher-severity signal always wins between the keyword scan and the
// LLM's self-reported tag.
export function combineEscalation(a: EscalationResult, b: EscalationResult): EscalationResult {
  return SEVERITY_RANK[b.severity] > SEVERITY_RANK[a.severity] ? b : a;
}

const ESCALATION_TAG_RE = /<escalation\s+severity="(none|low|medium|high)"\s+reason="([^"]*)"\s*\/>/i;

// Catches a truncated/malformed tag -- e.g. the completion hitting its
// max_tokens limit mid-tag, before the closing `/>` -- which fails the
// strict regex above. A live report showed exactly this: a cut-off
// `<escalation severity="high" reason="...` leaking straight into the
// senior's visible reply because the well-formed-only match found nothing
// to strip. Anything from "<escalation" onward is never something a
// senior should see, complete tag or not, so it's always cut from the
// display text even when it can't be parsed for a severity.
const ESCALATION_TAG_START_RE = /<escalation\b[\s\S]*$/i;

// Parses the LLM's self-reported <escalation .../> tag out of its reply and
// returns the cleaned message plus the parsed result.
export function parseEscalationTag(rawReply: string): { message: string; result: EscalationResult } {
  const match = rawReply.match(ESCALATION_TAG_RE);
  const message = (match ? rawReply.replace(ESCALATION_TAG_RE, "") : rawReply.replace(ESCALATION_TAG_START_RE, "")).trim();
  if (!match) {
    return { message, result: { triggered: false, severity: "none" } };
  }
  const severity = match[1] as EscalationResult["severity"];
  return {
    message,
    result: {
      triggered: severity !== "none",
      severity,
      reason: match[2] || undefined,
    },
  };
}
