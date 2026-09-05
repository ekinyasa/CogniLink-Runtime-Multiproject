/**
 * functions/api/admin/static-pages.js
 *
 * CogniLink Static Pages & Versions Admin API.
 * Manages static pages under Library without touching Intent / Landing architecture.
 *
 * Data Model in env.APP_CONFIG:
 *   - static_page:<page_id>               -> Page metadata
 *   - static_page_ver:<page_id>:<ver_id>  -> Version payload
 *   - static_slug:<slug>                  -> { page_id, version_id }
 */

import { verifyToken, unauthorized, jsonHeaders } from "../../_shared/auth.js";

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
  if (!(await verifyToken(request, env))) return unauthorized();

  const url = new URL(request.url);
  const pageId = url.searchParams.get("id");

  if (!env.APP_CONFIG) {
    return new Response(JSON.stringify({ pages: [], versions: [] }), {
      status: 200,
      headers: jsonHeaders(),
    });
  }

  try {
    if (pageId) {
      const pageKey = `static_page:${pageId}`;
      const page = await env.APP_CONFIG.get(pageKey, { type: "json" });
      if (!page) {
        return new Response(JSON.stringify({ error: "Page not found" }), {
          status: 404,
          headers: jsonHeaders(),
        });
      }

      const verKeys = await listAllKeys(env, `static_page_ver:${pageId}:`);
      const versions = await Promise.all(
        verKeys.map((k) => env.APP_CONFIG.get(k, { type: "json" }))
      );
      const validVersions = versions.filter(Boolean);
      validVersions.sort((a, b) => (a.version_number || 0) - (b.version_number || 0));

      return new Response(JSON.stringify({ page, versions: validVersions }), {
        status: 200,
        headers: jsonHeaders(),
      });
    }

    // List all pages and versions
    const [pageKeys, verKeys] = await Promise.all([
      listAllKeys(env, "static_page:"),
      listAllKeys(env, "static_page_ver:"),
    ]);

    const BATCH = 30;
    const pages = [];
    for (let i = 0; i < pageKeys.length; i += BATCH) {
      const batch = pageKeys.slice(i, i + BATCH);
      const rows = await Promise.all(
        batch.map(async (k) => {
          try {
            return await env.APP_CONFIG.get(k, { type: "json" });
          } catch (_) {
            return null;
          }
        })
      );
      for (const r of rows) if (r) pages.push(r);
    }

    const versions = [];
    for (let i = 0; i < verKeys.length; i += BATCH) {
      const batch = verKeys.slice(i, i + BATCH);
      const rows = await Promise.all(
        batch.map(async (k) => {
          try {
            return await env.APP_CONFIG.get(k, { type: "json" });
          } catch (_) {
            return null;
          }
        })
      );
      for (const r of rows) if (r) versions.push(r);
    }

    pages.sort((a, b) => (a.name || "").localeCompare(b.name || ""));
    versions.sort((a, b) => (a.version_number || 0) - (b.version_number || 0));

    return new Response(JSON.stringify({ pages, versions }), {
      status: 200,
      headers: jsonHeaders(),
    });
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }
}

export async function onRequestPost(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  if (!env.APP_CONFIG) {
    return new Response(JSON.stringify({ success: false, error: "APP_CONFIG binding missing" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  try {
    const body = await request.json();
    const action = body.action || "save_version";
    const now = new Date().toISOString();

    if (action === "create_page") {
      const name = (body.name || "").trim();
      let slug = (body.slug || "").trim().toLowerCase().replace(/^\/+|\/+$/g, "");
      const title = (body.title || name).trim();
      const status = body.status || "draft";

      if (!name || !slug) {
        throw new Error("Page Name and Slug are required.");
      }

      const page_id = body.page_id || crypto.randomUUID();
      const version_id = crypto.randomUUID();

      const page = {
        page_id,
        name,
        slug,
        title,
        status: status === "published" ? "published" : "draft",
        live_version_id: status === "published" ? version_id : null,
        created_at: now,
        updated_at: now,
      };

      const version = {
        version_id,
        page_id,
        version_number: 1,
        version_label: "v1",
        title,
        status: status === "published" ? "published" : "draft",
        layout: Array.isArray(body.layout) ? body.layout : [],
        components: Array.isArray(body.components) ? body.components : [],
        customStyleCss: body.customStyleCss || "",
        customScript: body.customScript || "",
        customBodyHtml: body.customBodyHtml || "",
        customHeaderHtml: body.customHeaderHtml || "",
        customFooterHtml: body.customFooterHtml || "",
        notes: body.notes || "Initial version",
        created_at: now,
        updated_at: now,
      };

      await Promise.all([
        env.APP_CONFIG.put(`static_page:${page_id}`, JSON.stringify(page)),
        env.APP_CONFIG.put(`static_page_ver:${page_id}:${version_id}`, JSON.stringify(version)),
      ]);

      if (status === "published") {
        await env.APP_CONFIG.put(
          `static_slug:${slug}`,
          JSON.stringify({ page_id, version_id })
        );
      }

      return new Response(
        JSON.stringify({ success: true, page, version }),
        { status: 200, headers: jsonHeaders() }
      );
    }

    if (action === "update_page") {
      const { page_id, name, slug, title, status } = body;
      if (!page_id) throw new Error("Missing page_id");

      const existing = await env.APP_CONFIG.get(`static_page:${page_id}`, { type: "json" });
      if (!existing) throw new Error("Page not found");

      const oldSlug = existing.slug;
      const newSlug = slug ? slug.trim().toLowerCase().replace(/^\/+|\/+$/g, "") : oldSlug;

      const updatedPage = {
        ...existing,
        name: name !== undefined ? name.trim() : existing.name,
        slug: newSlug,
        title: title !== undefined ? title.trim() : existing.title,
        status: status !== undefined ? status : existing.status,
        updated_at: now,
      };

      await env.APP_CONFIG.put(`static_page:${page_id}`, JSON.stringify(updatedPage));

      // Handle slug or status index migration
      if (oldSlug !== newSlug) {
        await env.APP_CONFIG.delete(`static_slug:${oldSlug}`);
      }

      if (updatedPage.status === "published" && updatedPage.live_version_id) {
        await env.APP_CONFIG.put(
          `static_slug:${newSlug}`,
          JSON.stringify({ page_id, version_id: updatedPage.live_version_id })
        );
      } else {
        await env.APP_CONFIG.delete(`static_slug:${newSlug}`);
      }

      return new Response(
        JSON.stringify({ success: true, page: updatedPage }),
        { status: 200, headers: jsonHeaders() }
      );
    }

    if (action === "save_version") {
      const { page_id, version_id } = body;
      if (!page_id || !version_id) throw new Error("Missing page_id or version_id");

      const verKey = `static_page_ver:${page_id}:${version_id}`;
      const existing = await env.APP_CONFIG.get(verKey, { type: "json" });
      if (!existing) throw new Error("Version not found");

      const updatedVersion = {
        ...existing,
        title: body.title !== undefined ? body.title : existing.title,
        layout: Array.isArray(body.layout) ? body.layout : existing.layout,
        components: Array.isArray(body.components) ? body.components : existing.components,
        customStyleCss: body.customStyleCss !== undefined ? body.customStyleCss : existing.customStyleCss,
        customScript: body.customScript !== undefined ? body.customScript : existing.customScript,
        customBodyHtml: body.customBodyHtml !== undefined ? body.customBodyHtml : existing.customBodyHtml,
        customHeaderHtml: body.customHeaderHtml !== undefined ? body.customHeaderHtml : existing.customHeaderHtml,
        customFooterHtml: body.customFooterHtml !== undefined ? body.customFooterHtml : existing.customFooterHtml,
        notes: body.notes !== undefined ? body.notes : existing.notes,
        updated_at: now,
      };

      await env.APP_CONFIG.put(verKey, JSON.stringify(updatedVersion));

      return new Response(
        JSON.stringify({ success: true, version: updatedVersion }),
        { status: 200, headers: jsonHeaders() }
      );
    }

    if (action === "publish_version") {
      const { page_id, version_id } = body;
      if (!page_id || !version_id) throw new Error("Missing page_id or version_id");

      const page = await env.APP_CONFIG.get(`static_page:${page_id}`, { type: "json" });
      if (!page) throw new Error("Page not found");

      const verKey = `static_page_ver:${page_id}:${version_id}`;
      const version = await env.APP_CONFIG.get(verKey, { type: "json" });
      if (!version) throw new Error("Version not found");

      const updatedVersion = {
        ...version,
        status: "published",
        updated_at: now,
      };

      const updatedPage = {
        ...page,
        status: "published",
        live_version_id: version_id,
        updated_at: now,
      };

      await Promise.all([
        env.APP_CONFIG.put(verKey, JSON.stringify(updatedVersion)),
        env.APP_CONFIG.put(`static_page:${page_id}`, JSON.stringify(updatedPage)),
        env.APP_CONFIG.put(
          `static_slug:${page.slug}`,
          JSON.stringify({ page_id, version_id })
        ),
      ]);

      return new Response(
        JSON.stringify({ success: true, page: updatedPage, version: updatedVersion }),
        { status: 200, headers: jsonHeaders() }
      );
    }

    if (action === "duplicate_version") {
      const { page_id, version_id } = body;
      if (!page_id || !version_id) throw new Error("Missing page_id or version_id");

      const sourceVersion = await env.APP_CONFIG.get(`static_page_ver:${page_id}:${version_id}`, { type: "json" });
      if (!sourceVersion) throw new Error("Source version not found");

      const verKeys = await listAllKeys(env, `static_page_ver:${page_id}:`);
      const allVersions = await Promise.all(
        verKeys.map((k) => env.APP_CONFIG.get(k, { type: "json" }))
      );
      const maxVer = allVersions.reduce((m, v) => Math.max(m, (v && v.version_number) || 0), 0);
      const nextVerNumber = maxVer + 1;
      const newVersionId = crypto.randomUUID();

      const newVersion = {
        ...sourceVersion,
        version_id: newVersionId,
        version_number: nextVerNumber,
        version_label: `v${nextVerNumber}`,
        status: "draft",
        notes: `Duplicated from ${sourceVersion.version_label || "v" + sourceVersion.version_number}`,
        created_at: now,
        updated_at: now,
      };

      await env.APP_CONFIG.put(
        `static_page_ver:${page_id}:${newVersionId}`,
        JSON.stringify(newVersion)
      );

      return new Response(
        JSON.stringify({ success: true, version: newVersion }),
        { status: 200, headers: jsonHeaders() }
      );
    }

    if (action === "archive_version") {
      const { page_id, version_id } = body;
      if (!page_id || !version_id) throw new Error("Missing page_id or version_id");

      const verKey = `static_page_ver:${page_id}:${version_id}`;
      const version = await env.APP_CONFIG.get(verKey, { type: "json" });
      if (!version) throw new Error("Version not found");

      const updatedVersion = {
        ...version,
        status: "archived",
        updated_at: now,
      };
      await env.APP_CONFIG.put(verKey, JSON.stringify(updatedVersion));

      // If this was the live version, clear page's live_version_id and slug lookup
      const page = await env.APP_CONFIG.get(`static_page:${page_id}`, { type: "json" });
      if (page && page.live_version_id === version_id) {
        page.live_version_id = null;
        page.status = "draft";
        page.updated_at = now;
        await env.APP_CONFIG.put(`static_page:${page_id}`, JSON.stringify(page));
        await env.APP_CONFIG.delete(`static_slug:${page.slug}`);
      }

      return new Response(
        JSON.stringify({ success: true, version: updatedVersion }),
        { status: 200, headers: jsonHeaders() }
      );
    }

    if (action === "archive_page") {
      const { page_id } = body;
      if (!page_id) throw new Error("Missing page_id");

      const page = await env.APP_CONFIG.get(`static_page:${page_id}`, { type: "json" });
      if (!page) throw new Error("Page not found");

      page.status = "archived";
      page.updated_at = now;
      await env.APP_CONFIG.put(`static_page:${page_id}`, JSON.stringify(page));
      await env.APP_CONFIG.delete(`static_slug:${page.slug}`);

      return new Response(
        JSON.stringify({ success: true, page }),
        { status: 200, headers: jsonHeaders() }
      );
    }

    throw new Error(`Unknown action: ${action}`);
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }
}

export async function onRequestDelete(context) {
  const { request, env } = context;
  if (!(await verifyToken(request, env))) return unauthorized();

  if (!env.APP_CONFIG) {
    return new Response(JSON.stringify({ success: false, error: "APP_CONFIG missing" }), {
      status: 500,
      headers: jsonHeaders(),
    });
  }

  const url = new URL(request.url);
  const pageId = url.searchParams.get("page_id") || url.searchParams.get("id");
  const versionId = url.searchParams.get("version_id");

  try {
    if (pageId && versionId) {
      // Delete specific version
      await env.APP_CONFIG.delete(`static_page_ver:${pageId}:${versionId}`);
      const page = await env.APP_CONFIG.get(`static_page:${pageId}`, { type: "json" });
      if (page && page.live_version_id === versionId) {
        page.live_version_id = null;
        page.status = "draft";
        await env.APP_CONFIG.put(`static_page:${page_id}`, JSON.stringify(page));
        await env.APP_CONFIG.delete(`static_slug:${page.slug}`);
      }
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
    }

    if (pageId) {
      // Delete entire page and all its versions
      const page = await env.APP_CONFIG.get(`static_page:${pageId}`, { type: "json" });
      if (page && page.slug) {
        await env.APP_CONFIG.delete(`static_slug:${page.slug}`);
      }
      const verKeys = await listAllKeys(env, `static_page_ver:${pageId}:`);
      await Promise.all(verKeys.map((k) => env.APP_CONFIG.delete(k)));
      await env.APP_CONFIG.delete(`static_page:${pageId}`);
      return new Response(JSON.stringify({ success: true }), { status: 200, headers: jsonHeaders() });
    }

    throw new Error("Missing page_id parameter");
  } catch (err) {
    return new Response(JSON.stringify({ success: false, error: err.message }), {
      status: 400,
      headers: jsonHeaders(),
    });
  }
}
