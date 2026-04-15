SYSTEM CONTEXT TRANSFER — Campaign OS Project

We are building a lightweight serverless campaign attribution and routing system called **Campaign OS**.

Stack

Cloudflare Pages Functions
Cloudflare KV
Cloudflare Analytics Engine
Vanilla admin panel
Serverless architecture

Key features implemented so far

Alias-based routing
Campaign registry
Modifier routing (/offer /vsl)
UTM orchestration
Analytics ingestion
Diagnostics panel
Fixture-based system testing
Background self-test
Hub link validation
Admin verification overlay

Current architecture

Public routing grammar

/<alias>
/<alias>/<modifier>

Examples

/nb
/nb/offer
/nb/vsl

Campaign registry

route:{alias}

maps to campaign slug.

Testing infrastructure

Fixture campaign creation
Deterministic click sequence
Analytics verification
Automatic fixture cleanup.

Diagnostics panel includes

System Test
Smoke Test
Hub Integrity Check
Analytics dashboard
Background test runner.

Current development stage

Prompt 19 — stabilization + workspace introduction.

Recent fixes

AE ingestion timing
Analytics slug filtering
Admin verify route
Background test authentication
Link validation states.

New capability introduced

Workspaces (multi-tenant support).

Workspace structure

workspace
campaigns
analytics
routing
diagnostics

Default workspace remains:

"default"

Goal

Turn Campaign OS into a multi-tenant micro-SaaS growth infrastructure.

Continue development from Prompt 19 implementation and validation.