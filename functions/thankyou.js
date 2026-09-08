const HTML = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Thank You — Nilüfer Ormanlı</title>
<meta name="description" content="Thank you for joining Nilüfer Ormanlı's early access list.">
<style>
@import url('https://fonts.googleapis.com/css2?family=Cabin:wght@400;500;600&family=Instrument+Serif&display=swap');

:root{
  --ink:#211f1c;
  --cream:rgb(233,226,216);
  --green:#536257;
  --display:"Instrument Serif",Georgia,serif;
  --sans:"Cabin",Arial,sans-serif;
  --glass-bg:rgba(255,221,174,.20);
  --glass-blur:7px;
  --glass-radius:36px;
}

*{box-sizing:border-box}
html,body{margin:0;min-width:320px;background:#241c18;color:var(--ink);font-family:var(--sans);-webkit-font-smoothing:antialiased;text-rendering:optimizeLegibility}
a{color:inherit}
a:visited{color:inherit}
a:focus-visible{outline:2px solid currentColor;outline-offset:4px}

.page{position:relative;min-height:100svh;overflow:hidden;isolation:isolate;display:grid;grid-template-rows:1fr auto;background:#2b221d}
.photo-pair{position:absolute;inset:0;z-index:-4;display:grid;grid-template-columns:calc(50% + 1px) calc(50% + 1px);overflow:hidden}
.photo-half{position:relative;overflow:hidden}
.photo-half img{position:absolute;inset:0;width:100%;height:100%;max-width:none;object-fit:cover;filter:saturate(.96) contrast(1.02) brightness(.94)}
.photo-half--left{margin-right:-1px}
.photo-half--right{margin-left:-1px}
.photo-half--left img{object-position:62% center;transform:scaleX(-1) translateX(-1.4%) scale(1.012)}
.photo-half--right img{object-position:62% center;transform:translateX(-1.4%) scale(1.012)}

.glass{position:relative;background:var(--glass-bg);-webkit-backdrop-filter:blur(var(--glass-blur));backdrop-filter:blur(var(--glass-blur));border-radius:var(--glass-radius);box-shadow:inset 1px 1px 0 rgba(255,248,236,.25),inset -1px -1px 0 rgba(46,31,23,.14)}
.glass::before{content:"";position:absolute;inset:0;border-radius:inherit;padding:1px;background:linear-gradient(135deg,rgba(255,250,242,.30) 0%,rgba(255,250,242,.10) 30%,rgba(59,40,29,.08) 70%,rgba(59,40,29,.16) 100%);-webkit-mask:linear-gradient(#000 0 0) content-box,linear-gradient(#000 0 0);-webkit-mask-composite:xor;mask-composite:exclude;pointer-events:none}

.main-stage{min-height:0;display:flex;align-items:center;justify-content:center;padding:18px 24px 10px}
.main-glass{width:min(100%,520px);padding:28px 34px 30px;transform:translateY(-2.2vh);text-align:center}
.identity{margin:3px 0 0;color:var(--cream);font-family:var(--display);font-size:clamp(18px,1.34vw,23px);line-height:1;font-weight:700;letter-spacing:.13em;white-space:nowrap;text-shadow:0 1px 10px rgba(0,0,0,.18)}
.thanks{margin-top:34px;color:var(--cream)}
.thanks-icon{display:block;font-size:clamp(34px,3vw,44px);line-height:1;margin-bottom:8px}
.thanks h1{margin:0;font-family:var(--display);font-size:clamp(40px,3.25vw,50px);line-height:1;font-weight:400;letter-spacing:-.02em}
.thanks h2{margin:8px 0 0;font-family:var(--sans);font-size:clamp(17px,1.25vw,20px);line-height:1.25;font-weight:500}
.body-copy{margin:28px auto 0;max-width:410px;color:rgba(245,239,231,.94);font-size:15px;line-height:1.55;text-shadow:0 1px 5px rgba(0,0,0,.28)}
.body-copy p{margin:0}
.body-copy p + p{margin-top:12px}
.home-cta{display:flex;align-items:center;justify-content:center;width:100%;min-height:50px;margin-top:30px;padding:10px 18px;background:var(--green);color:#f6f1ea;text-decoration:none;font-size:16px;line-height:1.2}
.closing{margin:24px 0 0;color:var(--cream);font-family:var(--sans);font-size:15px;line-height:1.35}

.footer-system{width:100%;padding:0 18px 10px;display:flex;align-items:center;justify-content:center;gap:8px}
.legal-strip{min-height:38px;width:auto;max-width:calc(100% - 210px);padding:8px 15px;border-radius:999px;display:flex;align-items:center;gap:12px;flex-wrap:nowrap;color:rgba(245,239,231,.94);font-size:10.5px;line-height:1.3;text-shadow:0 1px 5px rgba(0,0,0,.38)}
.legal-strip p{margin:0}.legal-strip a{text-underline-offset:3px;text-decoration-color:rgba(245,239,231,.45)}
.socials{display:flex;align-items:center;gap:7px}
.social{width:38px;height:38px;flex:0 0 38px;border-radius:50%;display:grid;place-items:center;text-decoration:none}
.social::before{border-radius:50%}
.social img{display:block;width:17px;height:17px;object-fit:contain;pointer-events:none}
.mobile-footer-system{display:none}

@media(max-width:1024px){
  .photo-half--left img{object-position:66% center;transform:scaleX(-1) translateX(-2%) scale(1.012)}
  .photo-half--right img{object-position:66% center;transform:translateX(-2%) scale(1.012)}
  .main-stage{padding:14px 18px 8px}
  .main-glass{width:min(56vw,500px);padding:24px 28px 26px;transform:translateY(-1.5vh)}
  .identity{font-size:clamp(17px,2vw,21px)}
  .thanks{margin-top:28px}
  .thanks h1{font-size:clamp(36px,4.8vw,46px)}
  .body-copy{font-size:14px}
}

@media(max-width:700px){
  .page{min-height:100svh;height:100svh;width:100%;max-width:100vw;overflow:hidden}
  .photo-pair{display:grid;grid-template-columns:1fr;grid-template-rows:52% 48%;overflow:hidden;transform:translateY(-15%);height:118%}
  .photo-half--left,.photo-half--right{display:block}
  .photo-half img{width:100%;height:100%;object-fit:cover;max-width:none}
  .photo-half--left img{object-position:31% 30%;transform:none}
  .photo-half--right img{object-position:31% 70%;transform:scaleY(-1);transform-origin:center;filter:saturate(.92) contrast(.98) brightness(.82)}

  .main-stage{position:relative;min-height:100svh;height:100svh;width:100%;max-width:100vw;padding:0;overflow:hidden}
  .main-glass{position:absolute;left:50%;bottom:-19px;width:100vw;max-width:100vw;margin:0;padding:18px 34px 31px;transform:translateX(-50%);border-radius:30px}
  .identity{font-size:15px;letter-spacing:.10em;white-space:normal}
  .thanks{margin-top:24px}
  .thanks-icon{font-size:34px;margin-bottom:6px}
  .thanks h1{font-size:36px}
  .thanks h2{font-size:17px;margin-top:6px}
  .body-copy{margin-top:22px;max-width:360px;font-size:13.5px;line-height:1.5}
  .body-copy p + p{margin-top:10px}
  .home-cta{min-height:48px;margin-top:24px;font-size:15px}
  .closing{margin-top:20px;font-size:14px}

  .page > .footer-system{display:none}
  .mobile-footer-system{display:flex;flex-direction:column;align-items:center;justify-content:center;gap:8px;width:100%;margin-top:22px;padding:0;color:rgba(245,239,231,.94);text-shadow:0 1px 5px rgba(0,0,0,.38)}
  .mobile-footer-system .socials{display:flex;align-items:center;justify-content:center;gap:10px;width:100%;margin-bottom:4px}
  .mobile-footer-system .social{width:36px;height:36px;flex:0 0 36px;display:grid;place-items:center;background:none;backdrop-filter:none;-webkit-backdrop-filter:none;box-shadow:none;border-radius:0;text-decoration:none}
  .mobile-footer-system .social::before{content:none}
  .mobile-footer-system .social img{width:18px;height:18px;display:block;object-fit:contain}
  .mobile-legal{width:100%;display:grid;grid-template-columns:minmax(0,1fr) auto auto;align-items:center;gap:8px;padding:0;margin:0;background:none;font-size:8.5px;line-height:1.25}
  .mobile-legal p{margin:0;justify-self:start;text-align:left}
  .mobile-legal a{justify-self:end;color:inherit;text-underline-offset:3px;text-decoration-color:rgba(245,239,231,.45)}
}

@media(max-width:390px){
  .photo-half--left img{object-position:29% 30%}
  .photo-half--right img{object-position:29% 70%}
  .main-glass{padding:16px 28px 29px;border-radius:28px}
  .identity{font-size:14px;letter-spacing:.085em}
  .thanks{margin-top:20px}
  .thanks h1{font-size:34px}
  .thanks h2{font-size:16px}
  .body-copy{font-size:13px;margin-top:18px}
  .home-cta{margin-top:20px}
  .closing{margin-top:17px}
  .mobile-footer-system{gap:7px;margin-top:18px}
  .mobile-footer-system .socials{gap:8px;margin-bottom:4px}
  .mobile-footer-system .social{width:34px;height:34px;flex-basis:34px}
  .mobile-footer-system .social img{width:17px;height:17px}
  .mobile-legal{gap:6px;font-size:7.8px}
}
</style>
</head>
<body>
<div class="page">
  <div class="photo-pair" aria-hidden="true">
    <div class="photo-half photo-half--left"><img src="/assets/coming-soon/niluferormanli-comingsoon.webp" alt=""></div>
    <div class="photo-half photo-half--right"><img src="/assets/coming-soon/niluferormanli-comingsoon.webp" alt=""></div>
  </div>

  <main class="main-stage">
    <section class="glass main-glass" aria-labelledby="thank-you-title">
      <p class="identity">N&nbsp; İ&nbsp; L&nbsp; Ü&nbsp; F&nbsp; E&nbsp; R&nbsp;&nbsp; O&nbsp; R&nbsp; M&nbsp; A&nbsp; N&nbsp; L&nbsp; I</p>

      <div class="thanks">
        <span class="thanks-icon" aria-hidden="true">👍🏻</span>
        <h1 id="thank-you-title">Thank You,</h1>
        <h2>You’re on the list!</h2>
      </div>

      <div class="body-copy">
        <p>We’re so glad you’re here.</p>
        <p>You’ll be the first to know about launch updates,<br>special content, and early access opportunities.</p>
      </div>

      <a class="home-cta" href="https://niluferormanli.com/">Back to Home</a>
      <p class="closing">See you in a short while ✨</p>

      <footer class="mobile-footer-system" aria-label="Footer">
        <nav class="socials" aria-label="Social links">
          <a class="social" href="https://instagram.com/niluferormanli" aria-label="Instagram"><img src="/assets/ig.svg" alt=""></a>
          <a class="social" href="https://www.facebook.com/niluferormanli" aria-label="Facebook"><img src="/assets/fb.svg" alt=""></a>
          <a class="social" href="https://www.linkedin.com/in/niluferormanli" aria-label="LinkedIn"><img src="/assets/in.svg" alt=""></a>
          <a class="social" href="https://www.tiktok.com/@niluferormanli" aria-label="TikTok"><img src="/assets/tt.svg" alt=""></a>
        </nav>
        <div class="mobile-legal">
          <p>© 2026 - Nilufer Ormanlı LLC. - All rights reserved.</p>
          <a href="https://www.niluferormanli.com/privacy-policy">Privacy Policy</a>
          <a href="https://www.niluferormanli.com/terms-of-use">Terms of Use</a>
        </div>
      </footer>
    </section>
  </main>

  <footer class="footer-system">
    <div class="glass legal-strip">
      <p>© 2026 - Nilufer Ormanlı LLC. - All rights reserved.</p>
      <a href="https://www.niluferormanli.com/privacy-policy">Privacy Policy</a>
      <a href="https://www.niluferormanli.com/terms-of-use">Terms of Use</a>
    </div>
    <nav class="socials" aria-label="Social links">
      <a class="glass social" href="https://instagram.com/niluferormanli" aria-label="Instagram"><img src="/assets/ig.svg" alt=""></a>
      <a class="glass social" href="https://www.facebook.com/niluferormanli" aria-label="Facebook"><img src="/assets/fb.svg" alt=""></a>
      <a class="glass social" href="https://www.linkedin.com/in/niluferormanli" aria-label="LinkedIn"><img src="/assets/in.svg" alt=""></a>
      <a class="glass social" href="https://www.tiktok.com/@niluferormanli" aria-label="TikTok"><img src="/assets/tt.svg" alt=""></a>
    </nav>
  </footer>
</div>
</body>
</html>`;

export function onRequestGet() {
  return new Response(HTML, {
    status: 200,
    headers: {
      "Content-Type": "text/html; charset=UTF-8",
      "Cache-Control": "public, max-age=300",
      "X-Content-Type-Options": "nosniff",
      "Referrer-Policy": "strict-origin-when-cross-origin"
    }
  });
}
