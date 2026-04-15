/**
 * kv-cache.js — In-memory TTL cache for Workers KV lookups.
 *
 * Uses a module-level Map that persists for the lifetime of the Worker
 * isolate (typically seconds to minutes). This eliminates redundant KV
 * reads within a burst of requests hitting the same isolate.
 *
 * Configuration:
 *   - DEFAULT_TTL_MS  = 60 000 ms  (60 seconds)
 *   - MAX_ENTRIES     = 2 000      (safety cap; prevents OOM on very hot caches)
 *   - ALIAS_CACHE_TTL_MS env var   (integer ms; overrides DEFAULT_TTL_MS)
 *
 * Stale entries are served until they expire and are evicted on the next
 * access — acceptable within the TTL window per operational spec.
 *
 * Required env var (optional):
 *   ALIAS_CACHE_TTL_MS = "30000"   # 30 s — overrides the 60 s default
 */

const DEFAULT_TTL_MS = 60_000;
const MAX_ENTRIES    = 2_000;

/** @type {Map<string, { value: unknown, expiresAt: number }>} */
const _store = new Map();

// ── Public API ────────────────────────────────────────────────────────────────

/**
 * Return a cached value, or null if absent / expired.
 *
 * @param  {string}  key
 * @returns {unknown | null}
 */
export function cacheGet(key) {
  const entry = _store.get(key);
  if (!entry) return null;
  if (Date.now() > entry.expiresAt) {
    _store.delete(key);
    return null;
  }
  return entry.value;
}

/**
 * Store a value with the given TTL.
 * Silently drops the write if the store is already at MAX_ENTRIES.
 *
 * @param {string}  key
 * @param {unknown} value
 * @param {number}  [ttlMs]  — defaults to DEFAULT_TTL_MS
 */
export function cacheSet(key, value, ttlMs) {
  if (_store.size >= MAX_ENTRIES) return;   // safety valve
  _store.set(key, {
    value,
    expiresAt: Date.now() + (ttlMs ?? DEFAULT_TTL_MS),
  });
}

/**
 * Immediately invalidate a key (call after any write operation).
 *
 * @param {string} key
 */
export function cacheDelete(key) {
  _store.delete(key);
}

/**
 * Resolve the effective TTL (ms) from the Workers env.
 * Falls back to DEFAULT_TTL_MS if the var is absent or invalid.
 *
 * @param  {object} env  — Workers env object
 * @returns {number}     — milliseconds
 */
export function getTtlMs(env) {
  const raw = env?.ALIAS_CACHE_TTL_MS;
  if (!raw) return DEFAULT_TTL_MS;
  const n = parseInt(String(raw), 10);
  return Number.isFinite(n) && n > 0 ? n : DEFAULT_TTL_MS;
}

export { DEFAULT_TTL_MS };
