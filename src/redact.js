// Secret redaction. Runs before content is emitted so credentials never leak
// into an LLM context bundle. Patterns cover the common high-signal formats.

const PATTERNS = [
  [/\b(sk-ant-[a-zA-Z0-9_-]{20,})\b/g, "ANTHROPIC_KEY"],
  [/\b(sk-[a-zA-Z0-9]{20,})\b/g, "OPENAI_KEY"],
  [/\b(AKIA[0-9A-Z]{16})\b/g, "AWS_ACCESS_KEY_ID"],
  [/\b(github_pat_[0-9a-zA-Z_]{22,})\b/g, "GITHUB_FINEGRAINED_PAT"],
  [/\b(ghp_[a-zA-Z0-9]{36})\b/g, "GITHUB_PAT"],
  [/\b(gho_[a-zA-Z0-9]{36})\b/g, "GITHUB_OAUTH"],
  [/\b((?:r|s)k_(?:live|test)_[0-9a-zA-Z]{24,})\b/g, "STRIPE_KEY"],
  [/\b(npm_[A-Za-z0-9]{36})\b/g, "NPM_TOKEN"],
  [/\b(GOCSPX-[a-zA-Z0-9_-]{20,})\b/g, "GOOGLE_OAUTH_SECRET"],
  [/\b(SG\.[A-Za-z0-9_-]{16,}\.[A-Za-z0-9_-]{16,})\b/g, "SENDGRID_KEY"],
  [/\b(xox[baprs]-[a-zA-Z0-9-]{10,})\b/g, "SLACK_TOKEN"],
  [/\b(AIza[0-9A-Za-z_-]{35})\b/g, "GOOGLE_API_KEY"],
  [/\b(eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,})\b/g, "JWT"],
  [/-----BEGIN (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----[\s\S]*?-----END (?:RSA |EC |OPENSSH |DSA |PGP )?PRIVATE KEY-----/g, "PRIVATE_KEY"],
  // key = "value" style assignments for sensitive-looking names.
  [/((?:password|passwd|secret|api[_-]?key|token|access[_-]?key)\s*[:=]\s*['"])([^'"]{6,})(['"])/gi, "ASSIGNED_SECRET"],
];

export function redact(text) {
  let count = 0;
  let out = text;
  for (const [re, label] of PATTERNS) {
    out = out.replace(re, (m, ...groups) => {
      count++;
      // For the assignment pattern, keep the name+quotes, mask the value.
      if (label === "ASSIGNED_SECRET") {
        const [name, , close] = groups;
        return `${name}<redacted:${label}>${close}`;
      }
      return `<redacted:${label}>`;
    });
  }
  return { text: out, count };
}

// Locate secrets without exposing them — used by CI `--check` mode. Returns
// one finding per match with its 1-based line number and the secret type.
export function findSecrets(text) {
  const findings = [];
  for (const [re, label] of PATTERNS) {
    const rx = new RegExp(re.source, re.flags);
    let m;
    while ((m = rx.exec(text)) !== null) {
      const line = text.slice(0, m.index).split("\n").length;
      findings.push({ label, line });
      if (m.index === rx.lastIndex) rx.lastIndex++; // guard against zero-width
    }
  }
  return findings.sort((a, b) => a.line - b.line);
}
