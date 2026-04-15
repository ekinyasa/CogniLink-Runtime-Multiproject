/**
 * retry.js — Shared exponential back-off retry utility for Campaign OS.
 *
 * retryWithBackoff(fn, options)
 *
 * Calls fn() up to options.maxAttempts times.
 * Before each attempt it waits for the corresponding delay from the delays array.
 * Stops early when fn() returns { ok: true }.
 *
 * Options:
 *   delays      {number[]} — wait durations in ms before each attempt
 *                            Default: [1000, 2000, 4000, 8000, 16000, 32000, 32000, 25000]
 *   maxAttempts {number}   — cap on executions; defaults to delays.length
 *
 * Total wait window with defaults:
 *   1+2+4+8+16+32+32+25 = 120 seconds
 *   Covers measured AE ingestion latency (52–57s) plus parallel smoke-test
 *   traffic and edge buffering overhead.
 *
 * fn() contract:
 *   • Returns { ok: boolean, ...anyOtherFields }
 *   • ok: true  → success; retry loop stops and result is returned
 *   • ok: false → not ready yet; retry continues
 *   • May throw — treated as { ok: false, error: err.message }; retry continues
 *
 * Return value:
 *   { ok: boolean, attempts: number, ...lastResultFields }
 *   If ok is still false after all retries, the last (failing) result is returned.
 */

// Total wait: 1+2+4+8+16+32+32+25 = 120 seconds.
// Extended from 95s to ensure coverage of worst-case AE ingestion windows.
// Measured ingestion latency: 52–57s. Extra headroom covers edge buffering and retries.
const DEFAULT_DELAYS = [1000, 2000, 4000, 8000, 16000, 32000, 32000, 25000];

/**
 * @param {() => Promise<{ok: boolean, [key: string]: any}>} fn
 * @param {{ delays?: number[], maxAttempts?: number }} [options]
 * @returns {Promise<{ok: boolean, attempts: number, [key: string]: any}>}
 */
export async function retryWithBackoff(fn, options = {}) {
  const delays      = options.delays      ?? DEFAULT_DELAYS;
  const maxAttempts = options.maxAttempts ?? delays.length;
  const limit       = Math.min(maxAttempts, delays.length);

  let lastResult = { ok: false, error: "not_started" };

  for (let i = 0; i < limit; i++) {
    // Always wait before querying — AE has significant ingestion latency
    await new Promise(r => setTimeout(r, delays[i]));

    try {
      lastResult = await fn();
    } catch (err) {
      lastResult = { ok: false, error: err?.message ?? "fn_threw" };
    }

    if (lastResult?.ok) {
      return { ...lastResult, attempts: i + 1 };
    }
  }

  return { ...lastResult, attempts: limit };
}
