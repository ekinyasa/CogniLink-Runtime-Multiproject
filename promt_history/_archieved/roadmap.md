==================================================
CAMPAIGN OS — SYSTEM ROADMAP
==================================================

This document tracks the evolution of Campaign OS.

Sections are organized into:

1. Completed Architecture Stages
2. Current Production Hardening
3. Near‑Term System Capabilities
4. Campaign OS V2 Roadmap
5. Productization Path
6. KV Cleanup Plan (deferred maintenance)

Only stages that are already implemented are listed under
"Completed Architecture Stages". Future work appears below
in the roadmap sections.

--------------------------------------------------
COMPLETED ARCHITECTURE STAGES
--------------------------------------------------

These capabilities already exist in the system.

L1 — Alias Router

alias → routing rule → campaign slug

Components
- ALIAS_REGISTRY
- compileRoutes()
- ROUTE_TABLE
- resolveAlias()
- canonical slug
- hub renderer

Properties
- deterministic compile
- O(1) alias resolution
- KV-backed registry
- Workers edge runtime

--------------------------------------------------

L2 — Campaign OS Router

Request
→ alias grammar
→ campaign graph
→ channel resolution
→ canonical slug
→ hub render

Capabilities introduced

- modifier grammar
- campaign graph abstraction
- channel routing layer
- analytics normalization

Example modifier grammar

/atlas
/atlas/ig
/atlas/email
/atlas/youtube

Channel synonym system

/atlas/insta
/atlas/ig
/atlas/instagram
→ same channel

Campaign graph example

campaign: atlas-release

channels
default
ig
youtube
email

Runtime overrides

ig → waitlist
youtube → landing
email → upsell

--------------------------------------------------

L3 — Experiment Routing Engine

Traffic experimentation integrated into the router layer.

Capabilities

A/B routing

/spring-sale
→ 50% landing A
→ 50% landing B

Traffic weighting

5% → new landing
95% → existing landing

Experiment lifecycle

RUNNING
→ winner detection
→ guardrail validation
→ DECIDED
→ enforced routing

Components

- experiment resolver
- exposure tracking
- conversion tracking
- winner detection
- guardrail validation
- KV persistence
- DECIDED enforcement

--------------------------------------------------

CURRENT SYSTEM CAPABILITIES (V9)

Routing Layer
- compiled alias router
- modifier parsing
- canonical slug resolution

Telemetry Layer
- route_resolved events
- route_fail_unknown_alias

Analytics Layer
- Workers Analytics Engine ingestion
- campaign / alias / slug dimensions

Diagnostics Layer
- smoke test
- manual validation
- hub integrity validator
- background self-test
- health endpoint

Testing Infrastructure
- fixture campaign creation
- deterministic click sequence
- analytics delta verification
- automated fixture cleanup

Admin Capabilities
- analytics dashboard
- campaign registry visibility
- hub verification mode
- experiment management
- experiment lifecycle controls

--------------------------------------------------
PRODUCTION READINESS CHECKLIST
--------------------------------------------------

Before production deployment the routing layer must pass
these checks.

1. ROUTE TABLE INTEGRITY

Verify compileRoutes produces correct routes.
Check ROUTE_TABLE entries match ALIAS_REGISTRY.

2. CACHE INVALIDATION

After compileRoutes, previously cached routes must be
invalidated so stale 404 responses cannot survive.

3. HOT PATH SAFETY

resolveAlias must only read:

- Workers Cache
- ROUTE_TABLE

No runtime scans of:

- ALIAS_REGISTRY
- LINKHUB_SLUGS

4. ROUTE TELEMETRY

Ensure routing events emit correctly:

- route_resolved
- route_fail_unknown_alias

5. ALIAS COLLISION TEST

Verify alias uniqueness across:

- campaign aliases
- slug aliases

6. ROUTE TABLE REBUILD

Compile must fully rebuild routes deterministically.
Repeated compile runs must produce identical results.

7. EVENTUAL CONSISTENCY SAFETY

Compiler must tolerate KV eventual consistency without
generating partial route tables.

8. ROUTING LATENCY

Alias resolution must remain O(1).
Target latency <10ms at edge.

9. ANALYTICS INTEGRITY

Alias must never leak into analytics payload.
Canonical slug must be used instead.

10. OPS VISIBILITY

Admin panel must expose routing events for quick debugging
without Cloudflare queries.

--------------------------------------------------
CAMPAIGN OS V2 ROADMAP
--------------------------------------------------

The next evolution of the system expands experimentation
into adaptive routing.

Goal

Campaign OS evolves from:

routing + attribution + experiments

into:

adaptive growth infrastructure.

Planned capabilities

1. Dimensioned Experiment Analytics

Statistics broken down by dimensions:

variant × source
variant × channel
variant × campaign

Example

spotify traffic → variant A performs best
instagram traffic → variant B performs best

2. Adaptive Traffic Routing

Router learns from experiment performance.

Example

spotify → route 80% variant A
instagram → route 70% variant B

Traffic weights dynamically updated from analytics.

3. Experiment Segmentation

Experiments scoped by traffic segment.

Examples

instagram users → experiment A
youtube users → experiment B

4. Experiment Promotion Automation

Optional auto-promotion rules:

- minimum runtime
- minimum sample size
- minimum conversion gap
- confidence threshold

Admin can configure:

auto-promote
or
manual promotion.

--------------------------------------------------
MICRO-SAAS PRODUCTIZATION PATH
--------------------------------------------------

Campaign OS can evolve into a standalone growth tool.

Potential product positioning:

Edge‑native campaign routing and experimentation platform.

Target users

- growth teams
- performance marketers
- creator funnels
- SaaS marketing teams

Core differentiator

Routing + attribution + experimentation
directly at the edge.

Possible product modules

1. Campaign Router
Alias routing and channel modifiers.

2. Experiment Engine
A/B tests and traffic shaping.

3. Attribution Layer
Automatic UTM orchestration.

4. Adaptive Optimizer
Source-aware landing optimization.

Monetization possibilities

- hosted SaaS
- self-hosted edge toolkit
- growth infrastructure API

--------------------------------------------------
KV CLEANUP PLAN (DEFERRED)
--------------------------------------------------

KV namespaces should be audited before final production
deployment.

Goals

- remove unused namespaces
- normalize naming conventions
- isolate DEV and PROD environments

Recommended production structure

LINKHUB_SLUGS
LINKHUB_CAMPAIGNS
LINKHUB_CONFIG
EXPERIMENT_STATE
EXPERIMENT_STATS

DEV and PROD should run on separate Workers to avoid
quota contamination.

Cleanup procedure

1. Inspect current KV namespaces.
2. Identify namespaces not referenced by the Worker.
3. Migrate active data to normalized namespaces.
4. Remove unused namespaces.
5. Deploy clean production worker with fresh KV bindings.

This step should only be performed during the final
production cutover.