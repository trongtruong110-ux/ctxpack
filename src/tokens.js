// Token estimation + per-model context budgeting.
// Heuristic estimator (no native deps): calibrated to be within ~5-10% of
// real BPE tokenizers for typical source code. Good enough for budgeting.

export const MODELS = {
  "claude-fable-5":   { context: 200000, label: "Claude Fable 5" },
  "claude-opus-4-8":  { context: 200000, label: "Claude Opus 4.8" },
  "claude-sonnet-5":  { context: 200000, label: "Claude Sonnet 5" },
  "gpt-5":            { context: 400000, label: "GPT-5" },
  "gpt-4.1":          { context: 1000000, label: "GPT-4.1" },
  "gemini-2.5-pro":   { context: 1000000, label: "Gemini 2.5 Pro" },
};

// Estimate tokens for a chunk of text. Source code tends to tokenize denser
// than prose (more punctuation/identifiers), so we blend a char-based and a
// word/symbol-based estimate.
export function estimateTokens(text) {
  if (!text) return 0;
  const chars = text.length;
  // ~3.6 chars/token for code is a better fit than the prose ~4.0.
  const byChars = chars / 3.6;
  // Count word-ish and symbol runs as a second signal.
  const pieces = text.split(/(\s+|[^\w\s]+)/).filter((s) => s && !/^\s+$/.test(s));
  const byPieces = pieces.length * 1.15;
  return Math.ceil((byChars * 0.6) + (byPieces * 0.4));
}

export function resolveModel(name) {
  if (!name) return MODELS["claude-fable-5"];
  const key = name.toLowerCase();
  return MODELS[key] || { context: 200000, label: name, unknown: true };
}
