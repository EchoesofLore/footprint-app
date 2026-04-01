// Shared pure utilities used by VaultRow and the vault page

export function passwordStrength(pw: string): { score: number; label: string } {
  const p = pw ?? "";
  if (!p) return { score: 0, label: "Empty" };

  let score = 0;
  const len = p.length;
  const hasLower = /[a-z]/.test(p);
  const hasUpper = /[A-Z]/.test(p);
  const hasNum = /\d/.test(p);
  const hasSym = /[^a-zA-Z0-9]/.test(p);

  if (len >= 8) score++;
  if (len >= 12) score++;
  if (hasLower && hasUpper) score++;
  if (hasNum) score++;
  if (hasSym) score++;

  score = Math.min(4, score);

  const label =
    score <= 1 ? "Weak" : score === 2 ? "Fair" : score === 3 ? "Good" : "Strong";

  return { score, label };
}

export function maskPassword(pw: string) {
  const n = Math.min(Math.max(pw?.length ?? 0, 8), 18);
  return "•".repeat(n);
}

export function daysAgo(ts?: number) {
  if (!ts) return "unknown";
  const d = Math.floor((Date.now() - ts) / (1000 * 60 * 60 * 24));
  if (d <= 0) return "today";
  if (d === 1) return "1 day ago";
  return `${d} days ago`;
}

export function normKey(site: string, username: string) {
  return `${(site ?? "").trim().toLowerCase()}|${(username ?? "").trim().toLowerCase()}`;
}
