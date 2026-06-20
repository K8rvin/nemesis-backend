// ==========================================
// Simple in-memory TTL cache for Cloudflare Workers.
// Global variables persist between requests in the same isolate.
// ==========================================

const cache = new Map();

const DEFAULT_TTL_MS = 5 * 60 * 1000; // 5 minutes

function now() {
  return Date.now();
}

export function cacheGet(key) {
  const entry = cache.get(key);
  if (!entry) return undefined;
  if (entry.expiresAt < now()) {
    cache.delete(key);
    return undefined;
  }
  return entry.value;
}

export function cacheSet(key, value, ttlMs = DEFAULT_TTL_MS) {
  cache.set(key, { value, expiresAt: now() + ttlMs });
}

export function cacheDelete(key) {
  cache.delete(key);
}

export function cacheClear() {
  cache.clear();
}

export function cacheStats() {
  return { size: cache.size };
}
