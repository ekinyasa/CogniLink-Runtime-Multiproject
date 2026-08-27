(async function() {
  if (window.__COGNILINK_INITIALIZED) return;
  window.__COGNILINK_INITIALIZED = true;

  const DEBUG = window.COGNILINK_DEBUG === true;
  const log = (...args) => { if (DEBUG) console.log("[CogniLink]", ...args); };

  // PRE-FLIGHT: Fetch Layer 2 (Central Map)
  try {
    const res = await fetch("https://your-runtime-domain.com/api/decision/routes");
    const json = await res.json();
    if (json) {
      if (json.routes) {
        window.COGNILINK_ROUTES = window.COGNILINK_ROUTES || {};
        Object.assign(window.COGNILINK_ROUTES, json.routes);
      }
      if (json.engine) {
        window.COGNILINK_ENGINE = json.engine;
      }
    }
  } catch (_e) { }

  // ==========================================
  // LAYER 1: HEURISTICS (AUTO-DETECTION)
  // ==========================================
  const PATH = window.location.pathname.toLowerCase();
  
  let H_PAGE_TYPE = "product";
  if (PATH.includes("odeme") || PATH.includes("checkout")) H_PAGE_TYPE = "checkout";
  else if (PATH.includes("tesekkur") || PATH.includes("success") || PATH.includes("welcome")) H_PAGE_TYPE = "thank_you";
  else if (PATH.includes("upsell") || PATH.includes("ileri")) H_PAGE_TYPE = "upsell";
  else if (PATH.includes("bulten") || PATH.includes("newsletter")) H_PAGE_TYPE = "newsletter";
  else if (PATH.includes("program")) H_PAGE_TYPE = "product"; // explicitly mapped to product

  const H_SELECTORS = {
    // kartra_button/kartra_button1 handle all variations + direct pay links
    hardCta: [".kartra_button", ".kartra_button1", ".checkout-btn", "a[href*='checkout']", "a[href*='odeme']", "a[href*='/pay/']"],
    softCta: ["a:not(.kartra_button):not(.kartra_button1):not([href*='checkout']):not([href*='odeme']):not([href*='/pay/'])"], 
    checkoutRoot: [".kartra-checkout", "form"],
    checkoutCta: ["button[type='submit']", ".submit-btn", ".kartra_button", ".kartra_button1"],
    video: ["video"],
    newsletterForm: ["form"]
  };

  const ENGINE = window.COGNILINK_ENGINE || {};
  const H_REDIRECTS = {
    hot: (ENGINE.redirects && ENGINE.redirects.hot) ? ENGINE.redirects.hot : "https://your-runtime-domain.com/checkout",
    converted: (ENGINE.redirects && ENGINE.redirects.converted) ? ENGINE.redirects.converted : "https://your-runtime-domain.com/tesekkurler"
  };

  // ==========================================
  // LAYER 2 & 3: CENTRAL REGISTRY & MANUAL OVERRIDE
  // ==========================================
  const central = (window.COGNILINK_ROUTES && window.COGNILINK_ROUTES[window.location.pathname]) ? window.COGNILINK_ROUTES[window.location.pathname] : {};
  const override = window.COGNILINK_CONFIG || {};

  // Build Final Config by Merging (L3 > L2 > L1)
  const S = {};
  for (let key in H_SELECTORS) {
    if (override.selectors && override.selectors[key]) S[key] = override.selectors[key];
    else if (central.selectors && central.selectors[key]) S[key] = central.selectors[key];
    else S[key] = H_SELECTORS[key];
  }

  const R = {};
  for (let k in H_REDIRECTS) {
    if (override.redirects && override.redirects[k]) R[k] = override.redirects[k];
    else if (central.redirects && central.redirects[k]) R[k] = central.redirects[k];
    else R[k] = H_REDIRECTS[k];
  }

  const C = {
    pageType: override.pageType || central.pageType || H_PAGE_TYPE,
    source: override.source || central.source || "kartra",
    campaign: override.campaign || new URLSearchParams(window.location.search).get("utm_campaign") || "organic",
    alias: override.alias || central.alias || "",
    addTag: override.addTag || central.addTag || "",
    endpoints: override.endpoints || central.endpoints || { signal: "https://your-runtime-domain.com/api/decision/signal" },
    selectors: S,
    redirects: R
  };

  // ==========================================
  // TRAFFIC GUARDS & STATE ENGINE
  // ==========================================
  function isOwnedTraffic() {
    const params = new URLSearchParams(window.location.search);
    return params.has("utm_campaign") || params.has("cl_source") || params.has("cos_cid");
  }

  const isOwned = isOwnedTraffic();
  if (!isOwned) {
    log("Organic traffic detected. Tracking active, redirects disabled.");
  }

  let runtimeState = { e: 0, h: 0, c: 0, u: 0 };
  let hasRedirected = false;
  const DOMCache = new WeakSet();
  const limits = { scrollSent: false, videoSent: false, newsletterSent: false, timeTicks: 0, lastStrongIntent: 0, lastSoftIntent: 0 };

  function bindSelector(selectorList, eventName, callback) {
    if (!selectorList || !Array.isArray(selectorList)) return [];
    let boundElements = [];
    selectorList.forEach(selector => {
      document.querySelectorAll(selector).forEach(el => {
        el.addEventListener(eventName, (e) => callback(e, el));
        boundElements.push(el);
      });
    });
    return boundElements;
  }

  const Tracker = {
    init() {
      log("Tracker Engine (V2) initialized for pageType:", C.pageType);
      if (DEBUG) log("Active Config Constraints:", C);
      this.bindSensors(C.pageType);
      
      if (C.addTag) {
        log("Pushing Page-Level Tag:", C.addTag);
        this.sendEvent("tag_add", 3, C.addTag);
      }
    },

    async sendEvent(type, retries = 1, explicitTag = null) {
      const payload = {
        type,
        meta: { 
          source: C.source, 
          campaign: C.campaign, 
          alias: C.alias, 
          page_type: C.pageType,}
      };

      if (explicitTag) payload.meta.tag = explicitTag;

      try {
        const res = await fetch(C.endpoints.signal, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        });

        if (!res.ok) throw new Error("API Transport Error");
        
        const data = await res.json();
        if (data.ok && data.state) {
          this.handleState(data.state, type);
        }
      } catch (err) {
        if (retries > 0) {
          setTimeout(() => this.sendEvent(type, retries - 1), 1000);
        } else { log("Event drop limit reached:", type); }
      }
    },

    handleState(newState, trigger) {
      if (DEBUG) log("STATE TRANSITION:", { trigger, old: runtimeState, new: newState });
      
      const oldState = { ...runtimeState };
      runtimeState = { ...runtimeState, ...newState };

      const becameHot = oldState.h === 0 && runtimeState.h === 1;
      const becameConverted = oldState.c === 0 && runtimeState.c === 1;
      this.maybeRedirect(becameHot, becameConverted, trigger);
    },

    maybeRedirect(becameHot, becameConverted, trigger) {
      // Passive Redirect Guard: Only Owned traffic is eligible for routing!
      if (!isOwned || hasRedirected) return;

      const isStrongTrigger = (trigger === "click_hard" || trigger === "checkout_start");
      
      if (isStrongTrigger && becameConverted && C.redirects.converted) {
        hasRedirected = true;
        log("Executing Converted Redirect ->", C.redirects.converted);
        window.location.href = C.redirects.converted;
      } else if (isStrongTrigger && becameHot) {
        if (C.pageType === "checkout") {
          log("Hot redirect suppressed: Already on checkout context");
          return;
        }
        if (C.redirects.hot) {
          hasRedirected = true;
          log("Executing Hot Redirect ->", C.redirects.hot);
          window.location.href = C.redirects.hot;
        }
      }
    },

    bindSensors(pageType) {
      const bindClickHard = (excludedEls = []) => {
        bindSelector(C.selectors.hardCta, "click", (e, el) => {
          if (excludedEls.includes(el) || DOMCache.has(el)) return;
          // Class-level dedup for forms: treat all inputs in a form as a single hard intent
          const form = el.closest('form');
          if (form) {
            if (DOMCache.has(form)) return;
            DOMCache.add(form);
          }
          const now = Date.now();
          if (now - limits.lastStrongIntent < 2000) return;
          DOMCache.add(el);
          limits.lastStrongIntent = now;
          this.sendEvent("click_hard");
        });
      };

      const bindClickSoft = () => {
        bindSelector(C.selectors.softCta, "click", (e, el) => {
          if (DOMCache.has(el)) return;
          const now = Date.now();
          if (now - limits.lastSoftIntent < 2000) return;
          DOMCache.add(el);
          limits.lastSoftIntent = now;
          this.sendEvent("click_soft");
        });
      };

      const bindCheckoutIntents = () => {
        const boundCheckoutEls = bindSelector(C.selectors.checkoutCta, "click", (e, el) => {
          if (DOMCache.has(el)) return;
          const now = Date.now();
          if (now - limits.lastStrongIntent < 2000) return;
          DOMCache.add(el);
          limits.lastStrongIntent = now;
          this.sendEvent("checkout_start");
        });

        let checkoutSeen = false;
        if (C.selectors.checkoutRoot && C.selectors.checkoutRoot.length > 0 && window.IntersectionObserver) {
          const observer = new IntersectionObserver((entries, obs) => {
            entries.forEach(entry => {
              if (entry.isIntersecting && !checkoutSeen) {
                checkoutSeen = true;
                this.sendEvent("checkout_start");
                obs.unobserve(entry.target);
              }
            });
          }, { threshold: 0.1 });

          C.selectors.checkoutRoot.forEach(sel => {
            document.querySelectorAll(sel).forEach(el => observer.observe(el));
          });
        }
        return boundCheckoutEls;
      };

      // ==== LIFECYCLE ROUTING ====
      if (pageType === "product") {
        this.sendEvent("page_view");
        bindClickHard();
        bindClickSoft();
        window.addEventListener("scroll", () => {
          if (limits.scrollSent) return;
          if (window.scrollY + window.innerHeight >= document.body.scrollHeight * 0.5) {
            limits.scrollSent = true;
            this.sendEvent("scroll_depth");
          }
        }, { passive: true });
        const softFreqMs = (ENGINE.timing && ENGINE.timing.time_soft_freq ? ENGINE.timing.time_soft_freq : 30) * 1000;
        const timeTick = setInterval(() => {
          if (limits.timeTicks >= 10) { clearInterval(timeTick); return; }
          limits.timeTicks++;
          this.sendEvent("time_on_page");
        }, softFreqMs);
        bindSelector(C.selectors.video, "play", (e, el) => {
          if (!limits.videoSent) { limits.videoSent = true; this.sendEvent("video_played"); }
        });
      }
      else if (pageType === "checkout") {
        this.sendEvent("page_view");
        const checkoutCtas = bindCheckoutIntents();
        bindClickHard(checkoutCtas); 
      }
      else if (pageType === "thank_you") {
        if (!window.__CL_CONVERSION_SENT__) {
          window.__CL_CONVERSION_SENT__ = true;
          this.sendEvent("conversion");
        }
      }
      else if (pageType === "upsell") {
        this.sendEvent("upsell_enter");
        bindClickHard();
        bindClickSoft();
      }
      else if (pageType === "newsletter") {
        bindSelector(C.selectors.newsletterForm, "submit", (e, el) => {
          if (!limits.newsletterSent) { limits.newsletterSent = true; this.sendEvent("newsletter_optin"); }
        });
      }
    }
  };

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => Tracker.init());
  } else { Tracker.init(); }
})();
