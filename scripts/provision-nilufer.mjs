#!/usr/bin/env node
/**
 * scripts/provision-nilufer.mjs
 *
 * Automated provisioning script for Nilüfer Ormanlı Cloudflare resources:
 * - 9 KV Namespaces: cognilink-nilufer-*
 * - 1 D1 Database: cognilink-nilufer-db
 * - Applies schema.sql to remote D1
 * - Generates clean, isolated wrangler.toml with real IDs
 * - Enforces safety checks: no insurance resource IDs allowed
 */

import { execSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, "..");
const WRANGLER_TOML_PATH = path.join(ROOT_DIR, "wrangler.toml");
const SCHEMA_PATH = path.join(ROOT_DIR, "schema.sql");

// Strictly forbidden insurance production resource IDs (must NEVER appear)
const FORBIDDEN_INSURANCE_IDS = new Set([
  "1554e86d-a10d-44b5-aabf-63e9f71f51ac", // Insurance D1
  "281632c6f5f1457db9e04ee79d979929",     // SLUG_LINKS
  "172ef04f783640228c68d3fd321ed33d",     // CAMPAIGN_INDEX
  "b44f1b0e907a4649b9f0c28fd849ac36",     // LANDING_CONFIG
  "f76395da9009447dbd630acef12b522c",     // CAMPAIGN_AB_ALIAS_INDEX
  "eafe5cfff45f40738c8bd7aba82e05ac",     // AB_INDEX
  "bc3f8583acb3480dbe9ba84d97612593",     // ROUTE_ALIAS
  "2ff9d0424c9442a2919f60885097e017",     // APP_CONFIG
  "2034dc1f7c3243f382e5ed9a7e6d1dd9",     // ANALYTICS_DATA
  "7b9bb0d4c1b44c6797f8d328f1b64600",     // GUARD_CACHE
]);

const KV_SPECS = [
  { binding: "SLUG_LINKS",               name: "cognilink-nilufer-slug-links" },
  { binding: "CAMPAIGN_INDEX",           name: "cognilink-nilufer-campaign-index" },
  { binding: "LANDING_CONFIG",           name: "cognilink-nilufer-landing-config" },
  { binding: "CAMPAIGN_AB_ALIAS_INDEX",   name: "cognilink-nilufer-campaign-ab-alias-index" },
  { binding: "AB_INDEX",                 name: "cognilink-nilufer-ab-index" },
  { binding: "ROUTE_ALIAS",              name: "cognilink-nilufer-route-alias" },
  { binding: "APP_CONFIG",               name: "cognilink-nilufer-app-config" },
  { binding: "ANALYTICS_DATA",           name: "cognilink-nilufer-analytics-data" },
  { binding: "GUARD_CACHE",              name: "cognilink-nilufer-guard-cache" },
];

const D1_SPEC = {
  binding: "DB",
  name: "cognilink-nilufer-db",
};

function run(cmd, opts = {}) {
  try {
    return execSync(cmd, { cwd: ROOT_DIR, encoding: "utf8", stdio: ["pipe", "pipe", "pipe"], ...opts });
  } catch (err) {
    const stderr = err.stderr ? err.stderr.toString() : "";
    const stdout = err.stdout ? err.stdout.toString() : "";
    throw new Error(`Command failed: ${cmd}\nSTDOUT: ${stdout}\nSTDERR: ${stderr}`);
  }
}

function extractJson(text) {
  const start = text.indexOf("[");
  const objStart = text.indexOf("{");
  const first = (start !== -1 && (objStart === -1 || start < objStart)) ? start : objStart;
  if (first === -1) throw new Error("No JSON found in output: " + text);
  const lastBracket = text.lastIndexOf("]");
  const lastBrace = text.lastIndexOf("}");
  const last = Math.max(lastBracket, lastBrace);
  return JSON.parse(text.slice(first, last + 1));
}

console.log("=== CogniLink Nilüfer Resource Provisioning ===");

// 1. Check whoami
console.log("\n1. Verifying Cloudflare credentials...");
const whoamiOut = run("npx wrangler whoami");
if (!whoamiOut.includes("logged in")) {
  console.error("Error: Wrangler is not authenticated. Please run 'npx wrangler login'.");
  process.exit(1);
}
console.log("✓ Cloudflare credentials verified.");

// 2. Provision KV Namespaces
console.log("\n2. Fetching existing KV namespaces...");
let kvList = [];
try {
  const kvListOut = run("npx wrangler kv namespace list");
  kvList = extractJson(kvListOut);
} catch (e) {
  console.warn("Could not parse existing KV list as JSON, will query per namespace or create directly.");
}

const kvMap = new Map();
for (const item of kvList) {
  if (item && item.title && item.id) {
    kvMap.set(item.title, item.id);
  }
}

const resolvedKvBindings = [];
for (const spec of KV_SPECS) {
  let id = kvMap.get(spec.name);
  if (id) {
    console.log(`✓ KV Namespace exists: ${spec.name} -> ID: ${id}`);
  } else {
    console.log(`Creating KV Namespace: ${spec.name}...`);
    const createOut = run(`npx wrangler kv namespace create ${spec.name}`);
    const match = createOut.match(/id\s*=\s*"([a-f0-9]{32})"/i) || createOut.match(/"id":\s*"([a-f0-9]{32})"/i);
    if (!match) {
      throw new Error(`Failed to parse created KV ID for ${spec.name}. Output:\n${createOut}`);
    }
    id = match[1];
    console.log(`✓ Created KV Namespace: ${spec.name} -> ID: ${id}`);
    kvMap.set(spec.name, id);
  }

  if (FORBIDDEN_INSURANCE_IDS.has(id)) {
    throw new Error(`FATAL SAFETY ERROR: Generated KV ID ${id} matches insurance production resource!`);
  }
  if (!/^[a-f0-9]{32}$/i.test(id)) {
    throw new Error(`FATAL: Invalid KV ID format for ${spec.name}: ${id}`);
  }
  resolvedKvBindings.push({ ...spec, id });
}

// 3. Provision D1 Database
console.log("\n3. Fetching existing D1 databases...");
let d1List = [];
try {
  const d1ListOut = run("npx wrangler d1 list --json");
  d1List = extractJson(d1ListOut);
} catch (e) {
  console.warn("Could not list D1 databases via --json.");
}

let d1DatabaseId = "";
const existingDb = d1List.find(d => d.name === D1_SPEC.name);

if (existingDb && existingDb.uuid) {
  d1DatabaseId = existingDb.uuid;
  console.log(`✓ D1 Database exists: ${D1_SPEC.name} -> ID: ${d1DatabaseId}`);
} else {
  console.log(`Creating D1 Database: ${D1_SPEC.name}...`);
  const createDbOut = run(`npx wrangler d1 create ${D1_SPEC.name}`);
  const match = createDbOut.match(/database_id\s*=\s*"([a-f0-9-]{36})"/i) || createDbOut.match(/"uuid":\s*"([a-f0-9-]{36})"/i);
  if (!match) {
    throw new Error(`Failed to parse created D1 database_id. Output:\n${createDbOut}`);
  }
  d1DatabaseId = match[1];
  console.log(`✓ Created D1 Database: ${D1_SPEC.name} -> ID: ${d1DatabaseId}`);
}

if (FORBIDDEN_INSURANCE_IDS.has(d1DatabaseId)) {
  throw new Error(`FATAL SAFETY ERROR: D1 Database ID ${d1DatabaseId} matches insurance production resource!`);
}

// 4. Initialize D1 Schema
console.log("\n4. Applying database schema to D1...");
try {
  run(`npx wrangler d1 execute ${D1_SPEC.name} --file=${SCHEMA_PATH} --remote -y`);
  console.log(`✓ Schema applied successfully to ${D1_SPEC.name}.`);
} catch (schemaErr) {
  console.warn(`Warning applying schema: ${schemaErr.message}`);
}

// 5. Build isolated wrangler.toml content
console.log("\n5. Generating isolated wrangler.toml...");
const kvBlocks = resolvedKvBindings.map(kv => `[[env.production.kv_namespaces]]
binding = "${kv.binding}"
id = "${kv.id}"
`).join("\n");

const wranglerContent = `name = "cognilink-nilufer"
pages_build_output_dir = "./public"
compatibility_date = "2024-09-23"

[[d1_databases]]
binding = "${D1_SPEC.binding}"
database_name = "${D1_SPEC.name}"
database_id = "${d1DatabaseId}"

# ==============================================================================
# DEV ENVIRONMENT : LOCAL & PREVIEW
# ==============================================================================
[vars]
ENV_NAME = "dev"
PROJECT_ID = "nilufer"
ROOT_DOMAIN = "niluferormanli.com"
CANONICAL_HOST_MODE = "apex"
ADMIN_SUBDOMAIN = "login"
WWW_REDIRECT_TO_APEX = "true"
GA4_ID = "G-K5RNWREM5K"
META_PIXEL_ID = "1452820495739175"
RUNTIME_CONTEXT_READ_ENABLED = "true"
SHADOW_TELEMETRY_ENABLED = "false"
SHADOW_TELEMETRY_SAMPLE_RATE = "0.1"
REAL_RULE_SHADOW_ENABLED = "false"
DECISION_V2_CUTOVER_ENABLED = "false"
DECISION_V2_CUTOVER_ROUTE_TYPE = "c"
DECISION_V2_CUTOVER_SLUG = ""
DECISION_V2_CUTOVER_SOURCE = ""
DECISION_V2_CUTOVER_RULE_ID = ""

# ==============================================================================
# PRODUCTION ENVIRONMENT (Nilüfer Isolated Resources)
# ==============================================================================
[env.production]

${kvBlocks}
[[env.production.analytics_engine_datasets]]
binding = "AE_CONVERSION"
dataset = "cognilink_nilufer_conversion_prod"

[[env.production.analytics_engine_datasets]]
binding = "AE_TRAFFIC"
dataset = "cognilink_nilufer_traffic_prod"

[[env.production.analytics_engine_datasets]]
binding = "AE_EXPERIMENT"
dataset = "cognilink_nilufer_experiment_prod"

[env.production.vars]
ENV_NAME = "production"
PROJECT_ID = "nilufer"
ROOT_DOMAIN = "niluferormanli.com"
CANONICAL_HOST_MODE = "apex"
ADMIN_SUBDOMAIN = "login"
WWW_REDIRECT_TO_APEX = "true"
GA4_ID = "G-K5RNWREM5K"
META_PIXEL_ID = "1452820495739175"
RUNTIME_CONTEXT_READ_ENABLED = "true"
SHADOW_TELEMETRY_ENABLED = "true"
SHADOW_TELEMETRY_SAMPLE_RATE = "0.1"
REAL_RULE_SHADOW_ENABLED = "false"
DECISION_V2_CUTOVER_ENABLED = "false"
DECISION_V2_CUTOVER_ROUTE_TYPE = "c"
DECISION_V2_CUTOVER_SLUG = ""
DECISION_V2_CUTOVER_SOURCE = ""
DECISION_V2_CUTOVER_RULE_ID = ""

[[env.production.d1_databases]]
binding = "${D1_SPEC.binding}"
database_name = "${D1_SPEC.name}"
database_id = "${d1DatabaseId}"
`;

fs.writeFileSync(WRANGLER_TOML_PATH, wranglerContent, "utf8");
console.log("✓ wrangler.toml written successfully.");

// 6. Final verification of generated configuration
console.log("\n6. Running safety and naming verification...");
const finalWrangler = fs.readFileSync(WRANGLER_TOML_PATH, "utf8");

for (const forbiddenId of FORBIDDEN_INSURANCE_IDS) {
  if (finalWrangler.includes(forbiddenId)) {
    throw new Error(`FATAL AUDIT FAILURE: Forbidden insurance ID ${forbiddenId} found in final wrangler.toml!`);
  }
}

for (const kv of resolvedKvBindings) {
  if (!kv.name.startsWith("cognilink-nilufer-")) {
    throw new Error(`Naming violation: KV namespace ${kv.name} does not start with cognilink-nilufer-`);
  }
}

if (!D1_SPEC.name.startsWith("cognilink-nilufer-")) {
  throw new Error(`Naming violation: D1 database ${D1_SPEC.name} does not start with cognilink-nilufer-`);
}

console.log("✓ All resource names verified to begin with cognilink-nilufer.");
console.log("✓ Verified ZERO insurance production resource IDs in wrangler.toml.");
console.log("\nProvisioning completed successfully!");
