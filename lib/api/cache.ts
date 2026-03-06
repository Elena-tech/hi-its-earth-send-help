/**
 * Two-tier caching: in-memory Map + localStorage persistence.
 * Keys are prefixed with "earth:" to avoid collisions.
 */

const PREFIX = "earth:";
const TTL_MS = 24 * 60 * 60 * 1000; // 24 hours

interface CacheEntry<T> {
  data: T;
  ts: number; // timestamp when stored
}

// In-memory cache (session-scoped)
const memCache = new Map<string, CacheEntry<unknown>>();

export function cacheGet<T>(key: string): T | null {
  const fullKey = PREFIX + key;

  // 1. Check in-memory first
  const mem = memCache.get(fullKey) as CacheEntry<T> | undefined;
  if (mem && Date.now() - mem.ts < TTL_MS) {
    return mem.data;
  }

  // 2. Check localStorage
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(fullKey);
    if (!raw) return null;
    const entry: CacheEntry<T> = JSON.parse(raw);
    if (Date.now() - entry.ts >= TTL_MS) {
      localStorage.removeItem(fullKey);
      return null;
    }
    // Promote to memory
    memCache.set(fullKey, entry);
    return entry.data;
  } catch {
    return null;
  }
}

export function cacheSet<T>(key: string, data: T): void {
  const fullKey = PREFIX + key;
  const entry: CacheEntry<T> = { data, ts: Date.now() };

  // Memory
  memCache.set(fullKey, entry as CacheEntry<unknown>);

  // localStorage (best-effort — may fail if quota exceeded)
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(fullKey, JSON.stringify(entry));
  } catch {
    // quota exceeded — memory cache still works
  }
}
