/**
 * CogniLink Frontend Tracker (Production Ready)
 * 
 * Inject this snippet into the global header or footer of your Kartra pages.
 * Fully compliant with Event Contract v3 (Security, Bounding, Semantic Sources).
 */
(function() {
  if (window.__cognilink_initialized) return;
  window.__cognilink_initialized = true;

  const COGNILINK_API = "https://your-cognilink-domain.com/api/decision/signal";
  
  // ==========================================
  // 1. CORE UTILITIES & SECURITY
  // ==========================================

  // Element-based throttle to prevent spam clicking
  const throttledElements = new WeakSet();
  function checkThrottle(el, limit = 2000) {
    if (throttledElements.has(el)) return true;
    throttledElements.add(el);
    setTimeout(() => throttledElements.delete(el), limit);
    return false;
  }

  // Session-level guard to prevent multiple identical events per session reload
  function sessionFired(key) {
    if (sessionStorage.getItem(key)) return true;
    sessionStorage.setItem(key, "1");
    return false;
  }

  // Fetch with Lightweight Retry (1 time, 500ms delay)
  async function sendSignal(type, metaValue = null, retries = 1, urgency = null) {
    const payload = {
      type: type,
      meta: {
        source: getSemanticSource(),
        page_type: getPageType()
      }
    };
    if (metaValue !== null && metaValue !== undefined) {
      payload.meta.value = metaValue;
    }
    if (urgency) {
      payload.meta.urgency = urgency;
    }

    try {
      const response = await fetch(COGNILINK_API, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include", // Required for cross-origin cookie persistence
        body: JSON.stringify(payload)
      });
      if (!response.ok) throw new Error("HTTP error " + response.status);
    } catch (e) {
      if (retries > 0) {
        setTimeout(() => sendSignal(type, metaValue, retries - 1), 500);
      } else {
        console.warn("CogniLink: Signal delivery failed", e);
      }
    }
  }

  // ==========================================
  // 2. CONTEXT AWARENESS (Semantic Routing)
  // ==========================================
  
  const PATH = window.location.pathname.toLowerCase();
  
  function getSemanticSource() {
    if (PATH.includes("buy")) return "buy_page";
    if (PATH.includes("join")) return "checkout_page";
    if (PATH.includes("welcome") || PATH.includes("thank")) return "thank_you_page";
    if (PATH.includes("advanced") || PATH.includes("upsell")) return "upsell_page";
    if (PATH.includes("blog-popup") || PATH.includes("newsletter")) return "newsletter_popup";
    return "generic_page";
  }

  function getPageType() {
    const src = getSemanticSource();
    if (src === "buy_page") return "product_page";
    if (src === "checkout_page") return "checkout";
    if (src === "thank_you_page") return "thank_you";
    if (src === "upsell_page") return "upsell";
    if (src === "newsletter_popup") return "newsletter";
    return "unknown";
  }

  // ==========================================
  // 3. OBSERVERS & HANDLERS
  // ==========================================

  const semanticSource = getSemanticSource();

  // A. Fire Page View strictly once per session per semantic route
  if (!sessionFired(`cl_pv_${semanticSource}`)) {
    sendSignal("page_view");
  }

  // Initialize specific observers based on page context
  switch (semanticSource) {
    case "buy_page": initProductPageTracker(); break;
    case "checkout_page": initCheckoutTracker(); break;
    case "thank_you_page": initThankYouTracker(); break;
    case "upsell_page": initUpsellTracker(); break;
    case "newsletter_popup": initNewsletterTracker(); break;
  }

  // --- Product Page Logic ---
  function initProductPageTracker() {
    // interval for time_on_page (stops when page hidden, max 10 events)
  // 0. FETCH GLOBAL ENGINE CONFIG FOR DYNAMIC TIMING
  let engineTiming = { time_hard_freq: 10 };
  (async function() {
    try {
      const configRes = await fetch(COGNILINK_API.replace("/signal", "/routes"));
      const configData = await configRes.json();
      if (configData && configData.engine && configData.engine.timing) {
        engineTiming = configData.engine.timing;
        // Re-init timer if config is different from default 10s
        if (engineTiming.time_hard_freq !== 10) {
           setupHardTimer();
        }
      }
    } catch(e) {}
  })();

  // ... (existing logic) ...

  // --- Product Page Logic ---
  function initProductPageTracker() {
    setupHardTimer();
    // ... rest of initProductPageTracker ...
  }

  let hardTimer = null;
  function setupHardTimer() {
    if (hardTimer) clearInterval(hardTimer);
    let secondsOnPage = 0;
    let ticks = 0;
    const MAX_TICKS = 20;
    const freqMs = (engineTiming.time_hard_freq || 10) * 1000;
    
    hardTimer = setInterval(() => {
      if (!document.hidden) {
        ticks++;
        secondsOnPage += (engineTiming.time_hard_freq || 10);
        sendSignal("time_on_page", secondsOnPage, 1, "hard");
        
        if (ticks >= MAX_TICKS) {
          clearInterval(hardTimer);
        }
      }
    }, freqMs);
  }

    // One-time 50% scroll depth observer
    const scrollHandler = () => {
      const scrollHeight = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollHeight <= 0) return; // Prevent zero division
      const scrollPercent = Math.round((window.scrollY / scrollHeight) * 100);
      
      if (scrollPercent >= 50) {
        sendSignal("scroll_depth", 50);
        window.removeEventListener("scroll", scrollHandler);
      }
    };
    window.addEventListener("scroll", scrollHandler, { passive: true });

    // Click tracker (Element-based throttle)
    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, button, [role='button']");
      if (!el || checkThrottle(el, 2000)) return;
      
      const txt = (el.innerText || "").toLowerCase();
      const href = (el.href || "").toLowerCase();
      
      if (txt.includes("buy") || txt.includes("checkout") || txt.includes("order") || href.includes("buy")) {
        sendSignal("click_hard");
      } else {
        sendSignal("click_soft");
      }
    }, true);

    // HTML5 Video observer for milestones (Checks if video element exists first)
    const videos = document.querySelectorAll("video");
    if (videos.length > 0) {
      videos.forEach(video => {
        const markers = { 30: false, 60: false, 90: false };
        const videoHandler = () => {
          if (checkThrottle(video, 1000)) return; 
          const percent = Math.round((video.currentTime / video.duration) * 100);
          [30, 60, 90].forEach(mark => {
            if (percent >= mark && !markers[mark]) {
              markers[mark] = true;
              sendSignal("video_played", mark);
            }
          });
        };
        video.addEventListener("timeupdate", videoHandler);
      });
    }
  }

  // --- Checkout logic ---
  function initCheckoutTracker() {
    // Wait until checkout form is actually visible
    const checkoutTargets = document.querySelectorAll("form, [data-kt-type='checkout'], .checkout-form, .kartra_checkout_container");
    if (checkoutTargets.length > 0) {
      const observer = new IntersectionObserver((entries, obs) => {
        entries.forEach(entry => {
          if (entry.isIntersecting) {
            sendSignal("checkout_start");
            obs.disconnect(); // Fire only once
          }
        });
      }, { threshold: 0.1 });
      checkoutTargets.forEach(tgt => observer.observe(tgt));
    } else {
      // Fallback if rendered later / deeply hidden
      setTimeout(() => sendSignal("checkout_start"), 2000);
    }

    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, button, [role='button'], input[type='submit']");
      if (!el || checkThrottle(el, 3000)) return;
      
      const txt = (el.innerText || el.value || "").toLowerCase();
      if (txt.includes("complete") || txt.includes("pay") || txt.includes("submit") || txt.includes("confirm")) {
        sendSignal("click_hard");
      }
    }, true);
  }

  // --- Thank You Logic ---
  function initThankYouTracker() {
    if (!sessionFired(`cl_conv_${semanticSource}`)) {
      sendSignal("conversion");
    }
  }

  // --- Upsell Logic ---
  function initUpsellTracker() {
    if (!sessionFired(`cl_ups_ent_${semanticSource}`)) {
      sendSignal("upsell_enter");
    }

    document.addEventListener("click", (e) => {
      const el = e.target.closest("a, button, [role='button']");
      if (!el || checkThrottle(el, 3000)) return;
      
      const txt = (el.innerText || "").toLowerCase();
      if (txt.includes("add") || txt.includes("yes") || txt.includes("accept") || txt.includes("upgrade")) {
        sendSignal("upsell_accept");
      } else if (txt.includes("no") || txt.includes("thanks") || txt.includes("decline")) {
        sendSignal("upsell_reject");
      }
    }, true);
  }

  // --- Newsletter Logic ---
  function initNewsletterTracker() {
    // Listen for form submissions
    document.addEventListener("submit", (e) => {
      const form = e.target;
      if (checkThrottle(form, 5000)) return;
      
      if (!sessionFired(`cl_nl_${semanticSource}`)) {
         sendSignal("newsletter_optin");
      }
    });
  }

  // Global Export for custom programmatic usage
  window.CogniLink = {
    sendSignal: (type, value) => sendSignal(type, value, 1)
  };

})();
