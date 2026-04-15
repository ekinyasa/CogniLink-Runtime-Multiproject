/**
 * functions/thank-you-demo.js — Dedicated conversion demo page.
 *
 * This function serves the HTML content for the Thank You demo page.
 * By putting it in its own file under /functions, it takes precedence
 * over the catch-all [[path]].js handler.
 */
export async function onRequestGet(context) {
    const html = `<!DOCTYPE html>
<html lang="tr">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Teşekkürler | Siparişiniz Alındı</title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --primary: #10b981;
            --primary-dark: #059669;
            --bg: #0f172a;
            --text: #f8fafc;
            --text-muted: #94a3b8;
        }
        body {
            font-family: 'Inter', sans-serif;
            background-color: var(--bg);
            color: var(--text);
            margin: 0;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            overflow: hidden;
        }
        .container {
            text-align: center;
            background: rgba(30, 41, 59, 0.5);
            backdrop-filter: blur(12px);
            padding: 3rem;
            border-radius: 2rem;
            border: 1px solid rgba(255, 255, 255, 0.1);
            box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
            max-width: 400px;
            width: 90%;
            animation: fadeIn 0.8s ease-out;
        }
        @keyframes fadeIn {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
        .icon {
            width: 80px;
            height: 80px;
            background: var(--primary);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0 auto 1.5rem;
            font-size: 2.5rem;
            box-shadow: 0 0 30px rgba(16, 185, 129, 0.3);
        }
        h1 { margin: 0 0 1rem; font-weight: 700; font-size: 1.875rem; }
        p { color: var(--text-muted); line-height: 1.6; margin-bottom: 2rem; }
        .status {
            font-size: 0.875rem;
            color: var(--primary);
            font-weight: 600;
            background: rgba(16, 185, 129, 0.1);
            padding: 0.5rem 1rem;
            border-radius: 1rem;
            display: inline-block;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="icon">✓</div>
        <h1>Harika!</h1>
        <p>Siparişiniz başarıyla alındı. Mail kutunuzu kontrol etmeyi unutmayın.</p>
        <div id="tracking-status" class="status">Dönüşüm İşleniyor...</div>
    </div>

    <script>
        /**
         * conversion-tracker.js
         */
        (function() {
            function getCookie(name) {
                const match = document.cookie.match(new RegExp('(^| )' + name + '=([^;]+)'));
                return match ? decodeURIComponent(match[2]) : null;
            }

            const exp = getCookie('cos_exp');
            const variant = getCookie('cos_variant');
            const statusEl = document.getElementById('tracking-status');

            if (exp && variant) {
                console.log("[Conversion] Attr found:", exp, variant);
                
                // Telemetry ping
                fetch('/t?e=conversion&exp=' + encodeURIComponent(exp) + '&v=' + encodeURIComponent(variant))
                    .then(response => {
                        if (response.ok) {
                            statusEl.innerText = "Dönüşüm Kaydedildi ✓";
                        } else {
                            statusEl.innerText = "Dönüşüm Zaten Kaydedilmiş";
                        }
                    })
                    .catch(err => {
                        statusEl.innerText = "Bağlantı Hatası";
                    });
            } else {
                statusEl.style.display = 'none';
            }
        })();
    </script>
</body>
</html>`;

    return new Response(html, {
        headers: {
            "Content-Type": "text/html;charset=UTF-8",
            "Cache-Control": "no-store",
        },
    });
}
