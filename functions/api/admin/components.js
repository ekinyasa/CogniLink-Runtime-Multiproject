import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

// Helper to list all keys with a prefix
async function listAllKeys(env, prefix) {
  const keys = [];
  let cursor;
  do {
    const opts = { prefix, limit: 1000 };
    if (cursor) opts.cursor = cursor;
    const page = await env.APP_CONFIG.list(opts);
    for (const key of page.keys) {
      keys.push(key.name);
    }
    cursor = page.list_complete ? undefined : page.cursor;
  } while (cursor);
  return keys;
}

export async function onRequestGet(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  const families = [];
  const versions = [];

  if (env.APP_CONFIG) {
    try {
      // 1. List all comp_family:* and comp_ver:* keys
      const [familyKeys, verKeys] = await Promise.all([
        listAllKeys(env, "comp_family:"),
        listAllKeys(env, "comp_ver:")
      ]);

      // 2. Fetch all values in parallel batches
      const BATCH = 30;
      
      // Fetch Families
      for (let i = 0; i < familyKeys.length; i += BATCH) {
        const batch = familyKeys.slice(i, i + BATCH);
        const rows = await Promise.all(
          batch.map(async (k) => {
            try {
              return await env.APP_CONFIG.get(k, { type: "json" });
            } catch (_) { return null; }
          })
        );
        for (const r of rows) if (r) families.push(r);
      }

      // Fetch Versions
      for (let i = 0; i < verKeys.length; i += BATCH) {
        const batch = verKeys.slice(i, i + BATCH);
        const rows = await Promise.all(
          batch.map(async (k) => {
            try {
              return await env.APP_CONFIG.get(k, { type: "json" });
            } catch (_) { return null; }
          })
        );
        for (const r of rows) if (r) versions.push(r);
      }
    } catch (err) {
      return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders() });
    }
  }

  // Sort families alphabetically by key, and versions by version_number
  families.sort((a, b) => (a.family_key || "").localeCompare(b.family_key || ""));
  versions.sort((a, b) => a.version_number - b.version_number);

  return new Response(
    JSON.stringify({ families, versions }),
    { status: 200, headers: jsonHeaders() }
  );
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  try {
    const data = await request.json();
    const { family_key, family_name, type, status, title, body, cta_label, cta_url, placement_hint, priority, notes } = data;

    if (!family_key || !family_name || !type) {
      throw new Error("Missing required family fields (key, name, type)");
    }

    const family_id = crypto.randomUUID();
    const now = new Date().toISOString();

    const family = {
      family_id,
      family_key: family_key.trim(),
      family_name: family_name.trim(),
      type: type.trim(),
      status: (status === "draft" ? "inactive" : status) || "active",
      created_at: now,
      updated_at: now
    };

    const version = {
      component_id: crypto.randomUUID(),
      family_id,
      version_number: 1,
      version_label: "v1",
      name: `${family_name.trim()} v1`,
      type: type.trim(),
      status: "active",
      is_live: true,
      is_default: true,
      title: (title || "").trim(),
      body: (body || "").trim(),
      cta_label: (cta_label || "").trim(),
      cta_url: (cta_url || "").trim(),
      placement_hint: (placement_hint || "").trim(),
      priority: parseInt(priority) || 0,
      notes: (notes || "").trim(),
      created_at: now,
      updated_at: now
    };

    if (env.APP_CONFIG) {
      await Promise.all([
        env.APP_CONFIG.put(`comp_family:${family_id}`, JSON.stringify(family)),
        env.APP_CONFIG.put(`comp_ver:${family_id}:1`, JSON.stringify(version))
      ]);
      await recomputeFamilyStatusAndLive(env, family_id, now);
      await syncLiveComponentsIndex(env);
    }

    return new Response(JSON.stringify({ success: true, family_id, version_number: 1 }), { status: 200, headers: jsonHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders() });
  }
}

export async function onRequestPut(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  try {
    const data = await request.json();
    const { action } = data;
    const now = new Date().toISOString();

    if (!env.APP_CONFIG) {
      throw new Error("Storage APP_CONFIG is not available");
    }

    if (action === "update_family") {
      const { family_id, family_key, family_name, type, status } = data;
      if (!family_id) throw new Error("Missing family_id");

      const existingFamily = await env.APP_CONFIG.get(`comp_family:${family_id}`, { type: "json" });
      if (!existingFamily) throw new Error("Family not found");

      const updatedFamily = {
        ...existingFamily,
        family_key: family_key ? family_key.trim() : existingFamily.family_key,
        family_name: family_name ? family_name.trim() : existingFamily.family_name,
        type: type ? type.trim() : existingFamily.type,
        status: (status === "draft" ? "inactive" : status) || existingFamily.status,
        updated_at: now
      };

      await env.APP_CONFIG.put(`comp_family:${family_id}`, JSON.stringify(updatedFamily));
      await recomputeFamilyStatusAndLive(env, family_id, now);
      await syncLiveComponentsIndex(env);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
    }

    if (action === "update_version") {
      const { family_id, version_number, name, type, status, title, body, cta_label, cta_url, placement_hint, priority, notes } = data;
      if (!family_id || !version_number) throw new Error("Missing family_id or version_number");

      const existingVersion = await env.APP_CONFIG.get(`comp_ver:${family_id}:${version_number}`, { type: "json" });
      if (!existingVersion) throw new Error("Version not found");

      const cleanStatus = status === "draft" ? "inactive" : status;

      // Check live status constraint
      if (cleanStatus === "archived" && existingVersion.is_live) {
        throw new Error("Archived version cannot be live/default. Please set another version as live first.");
      }

      let isLive = existingVersion.is_live;
      let isDefault = existingVersion.is_default;
      if (cleanStatus === "archived" || cleanStatus === "inactive") {
        isLive = false;
        isDefault = false;
      }

      const updatedVersion = {
        ...existingVersion,
        name: name ? name.trim() : existingVersion.name,
        type: type ? type.trim() : existingVersion.type,
        status: cleanStatus || existingVersion.status,
        is_live: isLive,
        is_default: isDefault,
        title: title !== undefined ? title.trim() : existingVersion.title,
        body: body !== undefined ? body.trim() : existingVersion.body,
        cta_label: cta_label !== undefined ? cta_label.trim() : existingVersion.cta_label,
        cta_url: cta_url !== undefined ? cta_url.trim() : existingVersion.cta_url,
        placement_hint: placement_hint !== undefined ? placement_hint.trim() : existingVersion.placement_hint,
        priority: priority !== undefined ? parseInt(priority) || 0 : existingVersion.priority,
        notes: notes !== undefined ? notes.trim() : existingVersion.notes,
        updated_at: now
      };

      await env.APP_CONFIG.put(`comp_ver:${family_id}:${version_number}`, JSON.stringify(updatedVersion));
      await recomputeFamilyStatusAndLive(env, family_id, now);
      await syncLiveComponentsIndex(env);

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
    }

    if (action === "duplicate_version") {
      const { family_id, version_number } = data;
      if (!family_id || !version_number) throw new Error("Missing family_id or version_number");

      const sourceVersion = await env.APP_CONFIG.get(`comp_ver:${family_id}:${version_number}`, { type: "json" });
      if (!sourceVersion) throw new Error("Source version not found");

      const verKeys = await listAllKeys(env, `comp_ver:${family_id}:`);
      let maxVer = 1;
      for (const k of verKeys) {
        const parts = k.split(":");
        const num = parseInt(parts[parts.length - 1]);
        if (num > maxVer) maxVer = num;
      }

      const newVerNum = maxVer + 1;
      const newVersion = {
        ...sourceVersion,
        component_id: crypto.randomUUID(),
        version_number: newVerNum,
        version_label: `v${newVerNum}`,
        name: `${sourceVersion.name.replace(/ v\d+$/, "")} v${newVerNum}`,
        status: "inactive", // Duplicated starts as inactive
        is_live: false,
        is_default: false,
        created_at: now,
        updated_at: now
      };

      await env.APP_CONFIG.put(`comp_ver:${family_id}:${newVerNum}`, JSON.stringify(newVersion));
      await recomputeFamilyStatusAndLive(env, family_id, now);
      await syncLiveComponentsIndex(env);

      return new Response(JSON.stringify({ success: true, version_number: newVerNum }), { status: 200, headers: jsonHeaders() });
    }

    if (action === "set_live") {
      const { family_id, version_number } = data;
      if (!family_id || !version_number) throw new Error("Missing family_id or version_number");

      const targetVersion = await env.APP_CONFIG.get(`comp_ver:${family_id}:${version_number}`, { type: "json" });
      if (!targetVersion) throw new Error("Target version not found");
      if (targetVersion.status === "archived" || targetVersion.status === "inactive") {
        throw new Error("Archived or Inactive version cannot be set as live/default.");
      }

      const verKeys = await listAllKeys(env, `comp_ver:${family_id}:`);
      const versions = await Promise.all(
        verKeys.map(k => env.APP_CONFIG.get(k, { type: "json" }))
      );

      const updates = [];
      for (const ver of versions) {
        if (!ver) continue;
        let changed = false;
        if (ver.version_number === parseInt(version_number)) {
          if (!ver.is_live || !ver.is_default || ver.status !== "active") {
            ver.is_live = true;
            ver.is_default = true;
            ver.status = "active";
            ver.updated_at = now;
            changed = true;
          }
        } else {
          if (ver.is_live || ver.is_default) {
            ver.is_live = false;
            ver.is_default = false;
            ver.updated_at = now;
            changed = true;
          }
        }
        if (changed) {
          updates.push(env.APP_CONFIG.put(`comp_ver:${family_id}:${ver.version_number}`, JSON.stringify(ver)));
        }
      }

      await Promise.all(updates);
      await recomputeFamilyStatusAndLive(env, family_id, now);
      await syncLiveComponentsIndex(env);

      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
    }

    if (action === "migrate_draft_status") {
      const [familyKeys, verKeys] = await Promise.all([
        listAllKeys(env, "comp_family:"),
        listAllKeys(env, "comp_ver:")
      ]);

      let migratedCount = 0;

      for (const fk of familyKeys) {
        const family = await env.APP_CONFIG.get(fk, { type: "json" });
        if (family && (family.status === "draft" || !family.status)) {
          family.status = "inactive";
          family.updated_at = now;
          await env.APP_CONFIG.put(fk, JSON.stringify(family));
          migratedCount++;
        }
      }

      for (const vk of verKeys) {
        const version = await env.APP_CONFIG.get(vk, { type: "json" });
        if (version && (version.status === "draft" || !version.status)) {
          version.status = "inactive";
          version.updated_at = now;
          await env.APP_CONFIG.put(vk, JSON.stringify(version));
          migratedCount++;
        }
      }

      await syncLiveComponentsIndex(env);

      return new Response(JSON.stringify({ success: true, migrated_count: migratedCount }), { status: 200, headers: jsonHeaders() });
    }

    if (action === "sync_index") {
      await syncLiveComponentsIndex(env);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
    }

    throw new Error("Invalid action");
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders() });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!verifyToken(request, env)) return unauthorized();

  try {
    const url = new URL(request.url);
    const family_id = url.searchParams.get("family_id");
    const version_number = url.searchParams.get("version_number");

    if (!family_id) {
      throw new Error("Missing family_id");
    }

    if (!env.APP_CONFIG) {
      throw new Error("APP_CONFIG storage is not available");
    }

    const now = new Date().toISOString();

    if (version_number) {
      const verNum = parseInt(version_number);
      const versionKey = `comp_ver:${family_id}:${verNum}`;
      
      await env.APP_CONFIG.delete(versionKey);
      await recomputeFamilyStatusAndLive(env, family_id, now);
      await syncLiveComponentsIndex(env);
    } else {
      await env.APP_CONFIG.delete(`comp_family:${family_id}`);
      
      const verKeys = await listAllKeys(env, `comp_ver:${family_id}:`);
      await Promise.all(verKeys.map(k => env.APP_CONFIG.delete(k)));
      
      await cleanReferencesFromKV(env, family_id);
      await syncLiveComponentsIndex(env);
    }

    return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), { status: 500, headers: jsonHeaders() });
  }
}

async function recomputeFamilyStatusAndLive(env, family_id, now) {
  if (!env.APP_CONFIG) return;

  const family = await env.APP_CONFIG.get(`comp_family:${family_id}`, { type: "json" });
  if (!family) return;

  const verKeys = await listAllKeys(env, `comp_ver:${family_id}:`);
  const versions = [];
  for (const k of verKeys) {
    const val = await env.APP_CONFIG.get(k, { type: "json" });
    if (val) versions.push(val);
  }

  if (versions.length === 0) {
    await env.APP_CONFIG.delete(`comp_family:${family_id}`);
    return;
  }

  let status = "archived";
  if (versions.some(v => v.status === "active")) {
    status = "active";
  } else if (versions.some(v => v.status === "inactive" || v.status === "draft")) {
    status = "inactive";
  }

  family.status = status;
  family.updated_at = now;
  await env.APP_CONFIG.put(`comp_family:${family_id}`, JSON.stringify(family));
}

async function cleanReferencesFromKV(env, family_id) {
  if (env.SLUG_LINKS) {
    let cursor;
    do {
      const page = await env.SLUG_LINKS.list({ cursor, limit: 100 });
      for (const key of page.keys) {
        try {
          const slugData = await env.SLUG_LINKS.get(key.name, { type: "json" });
          if (slugData) {
            let changed = false;
            if (Array.isArray(slugData.components)) {
              const len = slugData.components.length;
              slugData.components = slugData.components.filter(id => id !== family_id);
              if (slugData.components.length !== len) changed = true;
            }
            if (Array.isArray(slugData.layout)) {
              const len = slugData.layout.length;
              slugData.layout = slugData.layout.filter(item => !(item.type === "component" && item.id === family_id));
              if (slugData.layout.length !== len) changed = true;
            }
            if (changed) {
              await env.SLUG_LINKS.put(key.name, JSON.stringify(slugData));
            }
          }
        } catch (e) {}
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }

  if (env.APP_CONFIG) {
    let cursor;
    do {
      const page = await env.APP_CONFIG.list({ prefix: "hub:", cursor, limit: 100 });
      for (const key of page.keys) {
        try {
          const pageData = await env.APP_CONFIG.get(key.name, { type: "json" });
          if (pageData) {
            let changed = false;
            if (Array.isArray(pageData.components)) {
              const len = pageData.components.length;
              pageData.components = pageData.components.filter(id => id !== family_id);
              if (pageData.components.length !== len) changed = true;
            }
            if (Array.isArray(pageData.layout)) {
              const len = pageData.layout.length;
              pageData.layout = pageData.layout.filter(item => !(item.type === "component" && item.id === family_id));
              if (pageData.layout.length !== len) changed = true;
            }
            if (changed) {
              await env.APP_CONFIG.put(key.name, JSON.stringify(pageData));
            }
          }
        } catch (e) {}
      }
      cursor = page.list_complete ? undefined : page.cursor;
    } while (cursor);
  }
}

async function updateFamilyTimestamp(env, family_id, timestamp) {
  const family = await env.APP_CONFIG.get(`comp_family:${family_id}`, { type: "json" });
  if (family) {
    family.updated_at = timestamp;
    await env.APP_CONFIG.put(`comp_family:${family_id}`, JSON.stringify(family));
  }
}

async function syncLiveComponentsIndex(env) {
  if (!env.APP_CONFIG) return;

  const [familyKeys, verKeys] = await Promise.all([
    listAllKeys(env, "comp_family:"),
    listAllKeys(env, "comp_ver:")
  ]);

  const BATCH = 30;
  const families = [];
  const versions = [];

  for (let i = 0; i < familyKeys.length; i += BATCH) {
    const batch = familyKeys.slice(i, i + BATCH);
    const rows = await Promise.all(
      batch.map(async (k) => {
        try {
          return await env.APP_CONFIG.get(k, { type: "json" });
        } catch (_) { return null; }
      })
    );
    for (const r of rows) if (r) families.push(r);
  }

  for (let i = 0; i < verKeys.length; i += BATCH) {
    const batch = verKeys.slice(i, i + BATCH);
    const rows = await Promise.all(
      batch.map(async (k) => {
        try {
          return await env.APP_CONFIG.get(k, { type: "json" });
        } catch (_) { return null; }
      })
    );
    for (const r of rows) if (r) versions.push(r);
  }

  const familyStatusMap = {};
  const familyKeyMap = {};
  families.forEach(f => {
    if (f) {
      familyStatusMap[f.family_id] = f.status;
      familyKeyMap[f.family_id] = f.family_key;
    }
  });

  const liveComponents = versions
    .filter(v => v && v.is_live && v.status === "active")
    .map(v => ({
      ...v,
      family_status: familyStatusMap[v.family_id] || "archived",
      family_key: familyKeyMap[v.family_id] || ""
    }));

  await env.APP_CONFIG.put("comp_live", JSON.stringify(liveComponents));
}
