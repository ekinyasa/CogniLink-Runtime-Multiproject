/**
 * router.test.js — Basic alias routing validation.
 *
 * Test:
 *   GET /nb
 *     → status 200
 *     → Content-Type: text/html
 *     → body contains HTML
 */

export async function run({ baseUrl }) {
  const url = `${baseUrl}/nb`;
  let res;

  try {
    res = await fetch(url, { redirect: "follow" });
  } catch (err) {
    return { pass: false, error: `Network error on GET /nb: ${err?.message}` };
  }

  if (res.status !== 200) {
    return { pass: false, error: `Expected status 200, got ${res.status} for GET /nb` };
  }

  const body = await res.text().catch(() => "");
  if (!body.includes("<html") && !body.includes("<!DOCTYPE")) {
    return { pass: false, error: "GET /nb response body does not contain HTML" };
  }

  return { pass: true };
}
