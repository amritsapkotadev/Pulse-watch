const attempts = new Map<string, number[]>();
const LIMIT = 5;
const WINDOW_MS = 15 * 60 * 1000;

export function checkRateLimit(key: string, now = Date.now()): { allowed: boolean; retryAfter: number } {
  const recent = (attempts.get(key) ?? []).filter((timestamp) => timestamp > now - WINDOW_MS);
  if (recent.length >= LIMIT) {
    const retryAfter = Math.max(1, Math.ceil((recent[0] + WINDOW_MS - now) / 1000));
    attempts.set(key, recent);
    return { allowed: false, retryAfter };
  }
  recent.push(now);
  attempts.set(key, recent);
  return { allowed: true, retryAfter: 0 };
}

export function clearRateLimit(key: string): void {
  attempts.delete(key);
}
