const fs = require('fs');
let code = fs.readFileSync('functions/api/lead.js', 'utf8');

const validationBlock = `
  // ── Turnstile Verification ────────────────────────────────────────────────
  if (env.TURNSTILE_SECRET_KEY && body["cf-turnstile-response"]) {
    const turnstileToken = body["cf-turnstile-response"];
    try {
      const formData = new FormData();
      formData.append('secret', env.TURNSTILE_SECRET_KEY);
      formData.append('response', turnstileToken);
      formData.append('remoteip', request.headers.get('CF-Connecting-IP') || '');
      
      const res = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
        method: 'POST',
        body: formData
      });
      
      const outcome = await res.json();
      if (!outcome.success) {
        return new Response(JSON.stringify({ error: "Güvenlik doğrulaması başarısız oldu (Bot Şüphesi)." }), {
          status: 400,
          headers: corsHeaders
        });
      }
    } catch (e) {
      console.error("Turnstile error:", e);
    }
  } else if (env.TURNSTILE_SECRET_KEY && !body["cf-turnstile-response"]) {
    return new Response(JSON.stringify({ error: "Güvenlik doğrulaması eksik. Lütfen tekrar deneyin." }), {
      status: 400,
      headers: corsHeaders
    });
  }
`;

code = code.replace(
  '  // 1. IDEMPOTENCY BUG FIX & SPAM PROTECTION (Roadmap V1)',
  `${validationBlock}\n\n  // 1. IDEMPOTENCY BUG FIX & SPAM PROTECTION (Roadmap V1)`
);

fs.writeFileSync('functions/api/lead.js', code);
