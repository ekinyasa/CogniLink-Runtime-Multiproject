# A/B Experiment Simulation Test Guide

This guide is used to simulate realistic traffic behavior for the Campaign OS experimentation system. The goal is to test the **full loop**:

alias → variant routing → clicks → conversions → panel statistics.

The test is executed in **phases**, and after each phase you must record results before continuing.

---

# Phase 0 — Clean Test Setup

## Step 0.1 — Create a fresh campaign

Campaign name:

ab-sim-1

Create two slugs belonging to that campaign:

ab-sim-1-a
ab-sim-1-b

Verify in admin panel:

Campaign:

ab-sim-1

Slug list must show:

ab-sim-1-a
ab-sim-1-b

If these do not appear, stop the test.

---

# Phase 1 — Create Experiment

Go to **Experiments → Create Experiment**.

Alias:

sim1

Campaign:

ab-sim-1

Variants:

Variant A → ab-sim-1-a weight 50
Variant B → ab-sim-1-b weight 50

State:

RUNNING

Click **Create**.

---

# Phase 1.2 — Router Validation

Open in browser:

https://links.niluferormanli.studio/sim1

Refresh the page 5–10 times.

Record the sequence of variants you see:

Example:

A
B
A
A
B

If both variants appear, routing works.

---

# Phase 2 — Neutral Traffic Simulation

Goal:

Verify routing distribution under neutral traffic.

Generate exposures:

```bash
for i in {1..300}; do
curl -s "https://links.niluferormanli.studio/sim1?r=$RANDOM" > /dev/null
done
```

Open the admin panel and record:

traffic A
traffic B
share A
share B

Expected result:

Distribution should be roughly 50/50.

---

# Phase 3 — Click Simulation

Goal:

Simulate ~30% click rate.

Run:

```bash
for i in {1..100}; do
curl -s "https://links.niluferormanli.studio/t?e=click&r=$RANDOM" > /dev/null
done
```

Record from panel:

click A
click B

---

# Phase 4 — Neutral Conversion Simulation

Goal:

Verify conversion attribution without bias.

Run:

```bash
for i in {1..30}; do
curl -s "https://links.niluferormanli.studio/t?e=conversion&r=$RANDOM" > /dev/null
done
```

Record:

conv A
conv B
conv rate
lift

Expected:

Lift should be close to zero.

---

# Phase 5 — A Dominant Period

Goal:

Simulate period where variant A performs better.

## Step 5.1 — Exposure

```bash
for i in {1..300}; do
curl -s "https://links.niluferormanli.studio/sim1?r=$RANDOM" > /dev/null
done
```

## Step 5.2 — Clicks

Higher click rate for A:

```bash
for i in {1..80}; do
curl -s "https://links.niluferormanli.studio/t?e=click&variant=a&r=$RANDOM" > /dev/null
done
```

Lower click rate for B:

```bash
for i in {1..30}; do
curl -s "https://links.niluferormanli.studio/t?e=click&variant=b&r=$RANDOM" > /dev/null
done
```

## Step 5.3 — Conversions

A strong conversions:

```bash
for i in {1..20}; do
curl -s "https://links.niluferormanli.studio/t?e=conversion&variant=a&r=$RANDOM" > /dev/null
done
```

B weak conversions:

```bash
for i in {1..5}; do
curl -s "https://links.niluferormanli.studio/t?e=conversion&variant=b&r=$RANDOM" > /dev/null
done
```

Record panel metrics:

traffic
clicks
conversions
lift

Expected:

Variant A should show positive lift.

---

# Phase 6 — Rebalance Test

Go to admin panel → Rebalance.

Set weights:

A → 80
B → 20

Save.

Then generate more traffic:

```bash
for i in {1..300}; do
curl -s "https://links.niluferormanli.studio/sim1?r=$RANDOM" > /dev/null
done
```

Record traffic share:

share A
share B

Expected:

Approximately:

A ≈ 80%
B ≈ 20%

---

# What This Test Validates

This simulation confirms the following systems work together:

1. Router distribution
2. Campaign → slug filtering
3. Exposure counting
4. Click attribution
5. Conversion attribution
6. Rebalance traffic adjustment

If any of these fail, the panel metrics will become inconsistent (for example: conversions exceeding clicks).
