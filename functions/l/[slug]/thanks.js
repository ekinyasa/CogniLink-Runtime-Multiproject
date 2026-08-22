const SEC_HEADERS = {
  "X-Frame-Options": "DENY",
  "X-Content-Type-Options": "nosniff",
  "Referrer-Policy": "strict-origin-when-cross-origin",
  "Permissions-Policy": "geolocation=(), microphone=()",
};

export async function onRequestGet(context) {
  const { request, params } = context;
  const slug = params.slug || "";
  
  // Future: Fetch editable "thanks" config from APP_CONFIG using the slug
  
  const html = `<!DOCTYPE html>
<html lang="tr">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Talebiniz Alındı - Teşekkürler!</title>
  <style>
    :root {
      --primary: #0F172A;
      --success: #22C55E;
      --bg: #F8FAFC;
      --card-bg: #FFFFFF;
      --text-main: #334155;
      --text-muted: #64748B;
      --border: #E2E8F0;
    }
    body {
      margin: 0;
      padding: 0;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
      background-color: var(--bg);
      color: var(--text-main);
      display: flex;
      justify-content: center;
      align-items: center;
      min-height: 100vh;
    }
    .container {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 3rem 2rem;
      max-width: 480px;
      width: 90%;
      text-align: center;
      box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.05), 0 8px 10px -6px rgba(0, 0, 0, 0.01);
    }
    .icon {
      background-color: #DCFCE7;
      color: var(--success);
      width: 80px;
      height: 80px;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      margin: 0 auto 1.5rem auto;
    }
    .icon svg {
      width: 40px;
      height: 40px;
    }
    h1 {
      font-size: 1.75rem;
      font-weight: 700;
      color: var(--primary);
      margin: 0 0 1rem 0;
    }
    p {
      font-size: 1rem;
      line-height: 1.6;
      color: var(--text-muted);
      margin: 0 0 2rem 0;
    }
    .btn {
      display: inline-block;
      background-color: var(--primary);
      color: #FFF;
      text-decoration: none;
      padding: 0.75rem 1.5rem;
      border-radius: 8px;
      font-weight: 600;
      transition: opacity 0.2s;
    }
    .btn:hover {
      opacity: 0.9;
    }
    .footer {
      margin-top: 2rem;
      font-size: 0.85rem;
      color: var(--text-muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="icon">
      <svg fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
        <path stroke-linecap="round" stroke-linejoin="round" d="M5 13l4 4L19 7"></path>
      </svg>
    </div>
    <h1>Talebiniz Başarıyla Alındı</h1>
    <p>Bilgileriniz sistemimize güvenli bir şekilde ulaştı. İlgili ekiplerimiz en kısa sürede sizinle iletişime geçecektir.</p>
    <a href="https://www.teklifi.online" class="btn">Ana Sayfaya Dön</a>
    <div class="footer">
      Teklifi.online
    </div>
  </div>
</body>
</html>`;

  return new Response(html, {
    status: 200,
    headers: {
      "Content-Type": "text/html;charset=UTF-8",
      ...SEC_HEADERS
    }
  });
}
