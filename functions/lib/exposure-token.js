/**
 * functions/lib/exposure-token.js — Exposure token generation + validation.
 *
 * Cryptographically ties a conversion event to a real experiment exposure.
 * Tokens are generated when a variant is served and must be present at
 * conversion time when EXPOSURE_TOKEN_SECRET is bound.
 *
 * ┌──────────────────────────────────────────────────────────────────────────┐
 * │  Token format:                                                           │
 * │    base64url(payloadJson) + "." + base64url(HMAC-SHA256 signature)       │
 * │                                                                          │
 * │  Payload:                                                                │
 * │    { alias: string, variant: string, ts: unixSeconds, nonce: string }   │
 * │                                                                          │
 * │  Token lifetime: 24 hours (MAX_TOKEN_AGE_SECS = 86400)                  │
 * └──────────────────────────────────────────────────────────────────────────┘
 *
 * Graceful degradation:
 *   All functions return null / { ok: false } when EXPOSURE_TOKEN_SECRET is
 *   not bound — no error is thrown.  This allows existing deployments to
 *   operate without a secret until one is configured.
 *
 * Replay protection:
 *   verifyExposureToken returns the token nonce.
 *   Callers must write `exp_used:<nonce>` to KV with expirationTtl: 86400
 *   and check for its presence before accepting the conversion.
 *
 * Key caching:
 *   The CryptoKey object is cached at module scope so importKey() is called
 *   at most once per isolate lifetime.  The cache key is the secret string
 *   itself so a secret rotation is picked up on the next request.
 *
 * Dependencies: Web Crypto API (built-in Workers runtime), no npm packages.
 */

const ENC = new TextEncoder();
const DEC = new TextDecoder();

/** Maximum token age in seconds (24 hours). */
export const MAX_TOKEN_AGE_SECS = 86400;

/** Clock-skew tolerance for "future timestamp" check (5 minutes). */
const CLOCK_SKEW_SECS = 300;

// ── Module-level HMAC key cache ────────────────────────────────────────────
// importKey() is called once per isolate and the result is reused for every
// subsequent sign/verify call.  The cache is keyed by the secret value so
// a secret rotation is picked up automatically.
let _cachedSecret = null;
let _cachedKey    = null;

async function getHmacKey(secret) {
  if (_cachedKey && _cachedSecret === secret) return _cachedKey;
  _cachedKey = await crypto.subtle.importKey(
    "raw",
    ENC.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
  _cachedSecret = secret;
  return _cachedKey;
}

// ── Base64url helpers ──────────────────────────────────────────────────────
// Cloudflare Workers provide btoa/atob.  We use the URL-safe alphabet
// (- instead of +, _ instead of /) and strip padding (=) so the token
// is safe to embed in a query string without additional encoding.

function bufToBase64url(buf) {
  let binary = "";
  const bytes = new Uint8Array(buf instanceof ArrayBuffer ? buf : buf.buffer);
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=/g, "");
}

function base64urlToBuf(str) {
  // Re-add padding, restore standard base64 alphabet
  const padded = str.replace(/-/g, "+").replace(/_/g, "/");
  const raw    = atob(padded.padEnd(padded.length + ((4 - (padded.length % 4)) % 4), "="));
  return Uint8Array.from(raw, (c) => c.charCodeAt(0));
}

// ── Token generation ───────────────────────────────────────────────────────

/**
 * Generate an HMAC-SHA256 signed exposure token.
 *
 * Returns null when EXPOSURE_TOKEN_SECRET is not bound — callers must
 * handle null gracefully (skip token embedding in hub links).
 *
 * @param {string} alias   — experiment alias
 * @param {string} variant — selected variant slug
 * @param {object} env     — Workers env (needs env.EXPOSURE_TOKEN_SECRET)
 * @returns {Promise<string|null>}
 */
export async function generateExposureToken(alias, variant, env) {
  const secret = env?.EXPOSURE_TOKEN_SECRET;
  if (!secret) return null;

  try {
    // 8 random bytes → base64url nonce (11 chars, ~48 bits of entropy)
    const nonce      = bufToBase64url(crypto.getRandomValues(new Uint8Array(8)));
    const payloadStr = JSON.stringify({
      alias,
      variant,
      ts:    Math.floor(Date.now() / 1000),
      nonce,
    });

    const key = await getHmacKey(secret);
    const sig = await crypto.subtle.sign("HMAC", key, ENC.encode(payloadStr));

    return bufToBase64url(ENC.encode(payloadStr)) + "." + bufToBase64url(sig);
  } catch (_) {
    // Crypto failure must never break routing — degrade silently
    return null;
  }
}

// ── Token verification ─────────────────────────────────────────────────────

/**
 * Verify an exposure token from a conversion request.
 *
 * Validation steps:
 *   1. Split at the last "." — left part is payload, right part is signature.
 *   2. Decode and re-verify HMAC (constant-time via crypto.subtle.verify).
 *   3. Parse payload JSON; check required fields.
 *   4. Reject future timestamps (clock skew tolerance: 5 min).
 *   5. Reject tokens older than MAX_TOKEN_AGE_SECS (24h).
 *   6. Verify alias + variant match the conversion request fields.
 *
 * Returns { ok: false, reason } when EXPOSURE_TOKEN_SECRET is not bound —
 * the caller is responsible for deciding whether to accept or reject an
 * un-validated conversion when the secret is absent.
 *
 * @param {string} token   — raw token string from request body
 * @param {string} alias   — expected experiment alias
 * @param {string} variant — expected variant slug
 * @param {object} env     — Workers env
 * @returns {Promise<{ ok: true, nonce: string } | { ok: false, reason: string }>}
 */
export async function verifyExposureToken(token, alias, variant, env) {
  const secret = env?.EXPOSURE_TOKEN_SECRET;
  if (!secret) return { ok: false, reason: "no_secret_configured" };

  if (typeof token !== "string" || !token) {
    return { ok: false, reason: "token_missing" };
  }

  // ── 1. Split token ────────────────────────────────────────────────────────
  const dotIdx = token.lastIndexOf(".");
  if (dotIdx <= 0 || dotIdx === token.length - 1) {
    return { ok: false, reason: "token_malformed" };
  }
  const payloadB64 = token.slice(0, dotIdx);
  const sigB64     = token.slice(dotIdx + 1);

  // ── 2. Decode signature + verify HMAC (constant-time) ────────────────────
  let payloadBytes, sigBytes;
  try {
    payloadBytes = base64urlToBuf(payloadB64);
    sigBytes     = base64urlToBuf(sigB64);
  } catch (_) {
    return { ok: false, reason: "token_decode_failed" };
  }

  let sigValid = false;
  try {
    const key = await getHmacKey(secret);
    sigValid   = await crypto.subtle.verify("HMAC", key, sigBytes, payloadBytes);
  } catch (_) {
    return { ok: false, reason: "token_verify_error" };
  }

  if (!sigValid) return { ok: false, reason: "token_invalid_signature" };

  // ── 3. Parse payload ──────────────────────────────────────────────────────
  let payload;
  try {
    payload = JSON.parse(DEC.decode(payloadBytes));
  } catch (_) {
    return { ok: false, reason: "token_payload_parse_failed" };
  }

  if (
    !payload || typeof payload !== "object" ||
    typeof payload.alias   !== "string" ||
    typeof payload.variant !== "string" ||
    typeof payload.ts      !== "number" ||
    typeof payload.nonce   !== "string"
  ) {
    return { ok: false, reason: "token_payload_invalid" };
  }

  // ── 4–5. Timestamp checks ─────────────────────────────────────────────────
  const now = Math.floor(Date.now() / 1000);
  if (payload.ts > now + CLOCK_SKEW_SECS) {
    return { ok: false, reason: "token_future_ts" };
  }
  if (now - payload.ts > MAX_TOKEN_AGE_SECS) {
    return { ok: false, reason: "token_expired" };
  }

  // ── 6. Field matching ─────────────────────────────────────────────────────
  if (payload.alias   !== alias)   return { ok: false, reason: "token_alias_mismatch" };
  if (payload.variant !== variant) return { ok: false, reason: "token_variant_mismatch" };

  return { ok: true, nonce: payload.nonce };
}
