# Campaign OS — TELEPORT CONTEXT (Phase 2 → continuation)

This document is used to **teleport the active engineering context** of the Campaign OS project into a new AI chat session without losing architectural continuity.

The assistant receiving this prompt must treat the following as the **current live system state** and continue development from here.

Do not redesign the system from scratch.  
Assume the described architecture exists and extend it carefully.

---

# PROJECT

Campaign OS

A lightweight **serverless campaign attribution and routing infrastructure** designed for growth teams who want clean attribution and deterministic traffic control.

Primary goals:

• clean attribution  
• deterministic routing  
• campaign‑level experimentation  
• serverless scalability  
• minimal dependencies  
• operator‑friendly debugging  

The system is being designed so it can eventually evolve into a **multi‑tenant micro‑SaaS growth infrastructure**.

---

# STACK

Cloudflare Workers / Pages Functions  
Cloudflare KV  
Cloudflare Analytics Engine  
Vanilla Admin Panel  
Serverless architecture

No heavy frameworks.

---

# PUBLIC ROUTING GRAMMAR

The public routing surface is intentionally minimal.

```
/<alias>
/<alias>/<modifier>
```

Examples

```
/nb
/nb/offer
/nb/vsl
```

Rules

• alias = required first segment  
• modifier = optional second segment  
• third segment → 404  

Deterministic grammar is critical for performance and debugging.

---

# CAMPAIGN REGISTRY

KV structure

```
route:{alias}
```

Maps alias → campaign slug.

Campaign configuration then defines:

```
links
utm presets
modifiers
experiments
```

---

# WORKSPACES

Campaign OS now supports multi‑tenant architecture.

Structure:

```
workspace
campaigns
analytics
routing
diagnostics
```

Default workspace:

```
"default"
```

Goal: allow multiple clients/projects to share the same routing infrastructure.

---

# EXPERIMENT SYSTEM

Campaign OS includes an experimentation engine.

Example experiment aliases:

```
/ab47
/abrand45
```

Variants example:

```
ab-rand-45-ttbio
ab-rand-45-igbio
```

Each variant tracks:

```
exposures
clicks
conversions
```

---

# CONVERSION INGESTION

Conversions are recorded via:

```
POST /api/convert
```

Example payload:

```json
{
 "event": "signup",
 "experiment": "abrand45",
 "variant": "ab-rand-45-igbio"
}
```

Analytics Engine records exposures, clicks and conversions.

---

# BANDIT LEARNING SYSTEM

Experiments use a **Thompson‑sampling‑based learning loop**.

Learning endpoint:

```
POST /api/experiment/bandit-update
```

Process:

1. read exposures + conversions
2. compute posterior

```
alpha = conversions + 1
beta  = exposures - conversions + 1
```

3. run Thompson sampling
4. convert posterior into integer traffic weights
5. store weights in experiment config

To reduce noise, weight calculation uses **multiple Thompson draws** (≈200 averaged).

---

# ROUTING ARCHITECTURE (CURRENT STATE)

Important architectural decision:

The **router is deterministic**.

Router does **not** run Thompson sampling.

Instead:

```
bandit-update → computes weights
router → allocates traffic deterministically
```

Routing algorithm:

```
hash(requestId) → bucket 0‑99
cumulative weight lookup → selected variant
```

Example:

```
weights: [35, 65]

bucket 0‑34 → variant A
bucket 35‑99 → variant B
```

Benefits:

• deterministic routing  
• reproducible debugging  
• cache stability  
• operator transparency  

Alpha/Beta values are stored only for **analytics and admin visibility**, not routing.

Routing authority:

```
variant.weight
```

---

# EXPLORATION FLOOR

Bandit weight generation enforces a minimum exploration floor.

Example:

```
min weight = 5%
max weight = 95%
```

This guarantees that every variant continues receiving traffic for learning.

---

# ADMIN PANEL FEATURES

The admin interface includes:

• experiment list  
• experiment health indicators  
• variant performance table  
• traffic distribution chart  
• conversion rate chart  
• operator breakdown  

Warnings include:

```
sample size too small
traffic imbalance
insufficient data
```

Operators can trigger:

```
Update Bandit Weights
Pause experiment
Archive experiment
```

---

# CURRENT DEVELOPMENT STATE

Experiment engine is functioning.

Observed example:

```
Variant A traffic: 26
Variant B traffic: 25
Variant B conversions: 3
Conversion rate: 12%
```

Bandit update produced weights:

```
35 / 65
```

Router now follows these weights deterministically.

---

# CORE ARCHITECTURAL PRINCIPLES

Campaign OS prioritizes:

Determinism  
Observability  
Operator control  
Serverless simplicity  
Debuggability  

The router must remain extremely simple.

Learning logic must remain **outside the request hot path**.

---

# NEXT DEVELOPMENT AREAS

1. experiment lifecycle cleanup (state vs status)
2. automated bandit scheduling
3. admin observability improvements
4. analytics breakdown expansion
5. KV namespace separation
6. production hardening

---

# WORKFLOW RULES

When continuing development:

• prefer architectural clarity over clever code  
• avoid adding dependencies  
• keep router deterministic  
• treat admin panel as operator control surface  
• maintain serverless simplicity  

---

# INSTRUCTION TO THE NEXT ASSISTANT

This system is already implemented.

Continue improving it incrementally.

Do not restart the design.

Extend the existing architecture carefully.
