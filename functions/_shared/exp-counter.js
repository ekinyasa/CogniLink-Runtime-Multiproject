/**
 * exp-counter.js — Lightweight experiment counter helpers (KV-backed).
 *
 * Uses ANALITICS_DATA KV namespace with sharded counter keys.
 *
 * Key format (sharded — v2):
 *   exp:<alias>:<slug>:exposure:{shard}   — incremented once per A/B-routed page view
 *   exp:<alias>:<slug>:click:{shard}      — incremented once per outbound hub link click
 *   exp:<alias>:<slug>:conversion:{shard} — incremented once per reported conversion event
 *
 * Shard range: 0 – (NUM_SHARDS-1), chosen at random on each write.
 *
 * Hot-key mitigation (Section 1 — Prompt 45):
 *   Single-key write patterns create KV write contention under high traffic.
 *   Sharding distributes writes across NUM_SHARDS independent keys, reducing
 *   per-key write frequency by ~10× at equal traffic.
 *   Reads aggregate all shards via parallel Promise.all.
 *
 * Backward compatibility:
 *   getExpCounters also reads the legacy unsharded key
 *   (exp:<alias>:<slug>:<type>) and adds it to the total.
 *   This ensures existing counters are not lost after the migration.
 *   New writes always target sharded keys — legacy keys will naturally
 *   become stale as experiments reset or new ones are created.
 *
 * Read-modify-write is not atomic in KV. For typical campaign traffic
 * (< 1 k req/s) the occasional race is acceptable. Sharding reduces the
 * probability of a write collision per key proportionally to 1/NUM_SHARDS.
 *
 * Both helpers are fire-and-forget — callers should use context.waitUntil()
 * so the Worker stays alive long enough to flush, but never block responses.
 */

/** Number of write shards per counter key. Stored in AB config as shard_count. */
export const NUM_SHARDS = 10;   // distribute writes across 10 keys per metric

// ── Counter increment ──────────────────────────────────────────────────────────

/**
 * Increment an experiment counter by 1 in ANALITICS_DATA using a randomly
 * chosen shard key to reduce hot-key write contention.
 *
 * Writes to: exp:<alias>:<slug>:<type>:<shard>
 *   where shard = Math.floor(Math.random() * NUM_SHARDS)
 *
 * Silent no-op when ANALITICS_DATA is not bound or inputs are missing.
 *
 * @param {object} env
 * @param {string} alias   — experiment name (= A/B alias)
 * @param {string} slug    — variant canonical slug
 * @param {'exposure'|'click'|'conversion'} type
 * @returns {Promise<void>}
 */
export async function incrementExpCounter(env, alias, slug, type, extraData = "", utmSource = "", utmMedium = "") {
  if (!env?.AE_CONVERSION || !alias || !slug || !type) return;
  // Stage 1 & 2: Moved telemetry from ANALITICS_DATA (KV) to AE_CONVERSION (AE)
  // We use unified AE schema: type (exposure|click|conversion) as index, and [alias, variant] as blobs.
  try {
    env.AE_CONVERSION.writeDataPoint({
      indexes: [String(type).slice(0, 100)],
      blobs: [
        String(alias).slice(0, 200),
        String(slug).slice(0, 200),
        String(utmSource).slice(0, 200),
        String(utmMedium).slice(0, 200),
        String(extraData).slice(0, 500) // blobs[4] for additional context (e.g. order_id)
      ]
    });
  } catch (_) {
    // Silent no-op
  }
}

// ── Counter reader ─────────────────────────────────────────────────────────────

/**
 * Read exposure, click, and conversion counters for all variants of an experiment.
 * Aggregates all NUM_SHARDS sharded keys plus the legacy unsharded key per metric.
 *
 * Returns one entry per slug with all metrics computed.
 *
 * @param {object}   env
 * @param {string}   alias   — experiment alias
 * @param {string[]} slugs   — ordered variant slugs (from AB config)
 * @returns {Promise<Array<{
 *   slug: string,
 *   exposures: number,
 *   clicks: number,
 *   conversions: number,
 *   ctr: number,
 *   conversion_rate: number
 * }>>}
 */
export async function getExpCounters(env, alias, slugs, shardCount = NUM_SHARDS) {
  if (!env?.ANALITICS_DATA || !alias || !Array.isArray(slugs)) return [];

  const n = (Number.isInteger(shardCount) && shardCount > 0) ? shardCount : NUM_SHARDS;

  const results = await Promise.all(
    slugs.map(async (slug) => {
      /**
       * Sum the legacy unsharded key + all n sharded keys for one metric.
       * Reads are parallel via Promise.all for minimal latency.
       * The legacy key is included for backward compat with pre-sharding data.
       */
      const readMetric = async (type) => {
        const keys = [
          // Legacy key (backward compat — written before sharding was introduced)
          `exp:${alias}:${slug}:${type}`,
          // Sharded keys (current write target)
          ...Array.from({ length: n }, (_, i) => `exp:${alias}:${slug}:${type}:${i}`),
        ];
        const values = await Promise.all(
          keys.map((k) => env.ANALITICS_DATA.get(k, { type: "text" }).catch(() => null))
        );
        return values.reduce((sum, v) => sum + (parseInt(v || "0", 10) || 0), 0);
      };

      const [exposures, clicks, conversions] = await Promise.all([
        readMetric("exposure"),
        readMetric("click"),
        readMetric("conversion"),
      ]);

      // Round rates to 4 decimal places (e.g. 0.2328 = 23.28%)
      const ctr             = exposures > 0 ? Math.round((clicks      / exposures) * 10000) / 10000 : 0;
      const conversion_rate = exposures > 0 ? Math.round((conversions / exposures) * 10000) / 10000 : 0;
      return { slug, exposures, clicks, conversions, ctr, conversion_rate };
    })
  );

  return results;
}
