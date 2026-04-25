/**
 * Cloudflare Workers - KIS API CORS Proxy + KV 동기화 + Supabase DB 프록시
 */

const ALLOWED_ORIGIN = "https://gitjmk.github.io";

const KIS_DOMAINS = {
  real:  "https://openapi.koreainvestment.com:9443",
  paper: "https://openapivts.koreainvestment.com:9443",
};

function corsHeaders(origin) {
  const allowed = origin === ALLOWED_ORIGIN || origin?.startsWith("http://localhost");
  return {
    "Access-Control-Allow-Origin":   allowed ? origin : ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods":  "GET, POST, PATCH, DELETE, OPTIONS",
    "Access-Control-Allow-Headers":  "Content-Type, Authorization, appkey, appsecret, tr_id, custtype, tr_cont, gt_uid, X-App-Key",
    "Access-Control-Expose-Headers": "tr_id, tr_cont, gt_uid, msg_cd, msg1",
    "Access-Control-Max-Age":        "86400",
  };
}

function json(data, origin, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

function isAllowed(origin) {
  return origin === ALLOWED_ORIGIN || origin?.startsWith("http://localhost");
}

async function sha256(text) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// ── Supabase DB 프록시 ────────────────────────────────────────────────────────
async function handleDB(request, env, origin) {
  if (!isAllowed(origin)) return json({ error: "Origin not allowed" }, origin, 403);

  // 앱 키 검증
  const appKey = request.headers.get("X-App-Key");
  if (!appKey || appKey !== env.DB_APP_KEY) {
    return json({ message: "인증 실패" }, origin, 401);
  }

  let method, path, body;
  try {
    ({ method, path, body } = await request.json());
  } catch {
    return json({ message: "잘못된 요청 형식" }, origin, 400);
  }

  if (!method || !path) return json({ message: "method, path 필수" }, origin, 400);

  const supaRes = await fetch(`${env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      "Content-Type": "application/json",
      "apikey": env.SUPABASE_SERVICE_KEY,
      "Authorization": `Bearer ${env.SUPABASE_SERVICE_KEY}`,
      "Prefer": "return=representation",
    },
    body: body !== null ? JSON.stringify(body) : undefined,
  });

  const text = await supaRes.text();
  return new Response(text || null, {
    status: supaRes.status,
    headers: { "Content-Type": "application/json", ...corsHeaders(origin) },
  });
}

// ── KV 동기화 ─────────────────────────────────────────────────────────────────
async function handleKV(request, env) {
  const origin = request.headers.get("Origin") || "";
  if (!isAllowed(origin)) return json({ error: "Origin not allowed" }, origin, 403);
  if (!env.DIARY_KV)      return json({ error: "KV not configured — Workers 설정 필요" }, origin, 503);

  const pathname = new URL(request.url).pathname;

  let body;
  try { body = await request.json(); } catch { return json({ error: "Invalid JSON" }, origin, 400); }

  const { userId, data } = body;
  if (!userId || typeof userId !== "string" || userId.length > 64)
    return json({ error: "Invalid userId" }, origin, 400);

  const kvKey = "diary:" + await sha256(userId);

  if (pathname === "/kv/save") {
    if (!data || typeof data !== "string")
      return json({ error: "data 필드가 필요합니다" }, origin, 400);
    if (data.length > 512 * 1024)
      return json({ error: "데이터가 너무 큽니다 (최대 512KB)" }, origin, 413);
    await env.DIARY_KV.put(kvKey, data, { expirationTtl: 60 * 60 * 24 * 365 });
    return json({ ok: true, savedAt: new Date().toISOString() }, origin);
  }

  if (pathname === "/kv/load") {
    const stored = await env.DIARY_KV.get(kvKey);
    return json({ ok: true, data: stored ?? null }, origin);
  }

  if (pathname === "/kv/delete") {
    await env.DIARY_KV.delete(kvKey);
    return json({ ok: true }, origin);
  }

  return json({ error: "알 수 없는 KV 경로" }, origin, 404);
}

// ── KIS 프록시 ────────────────────────────────────────────────────────────────
async function handleProxy(request) {
  const origin = request.headers.get("Origin") || "";
  const url    = new URL(request.url);
  if (!isAllowed(origin)) return json({ error: "Origin not allowed" }, origin, 403);

  const match = url.pathname.match(/^\/(real|paper)(\/.*)/);
  if (!match) return json({ error: "Invalid path. Use /real/... or /paper/..." }, origin, 400);

  const targetUrl = `${KIS_DOMAINS[match[1]]}${match[2]}${url.search}`;
  const forwardHeaders = new Headers();
  for (const [k, v] of request.headers.entries()) {
    const l = k.toLowerCase();
    if (l === "host" || l === "origin" || l === "referer") continue;
    forwardHeaders.set(k, v);
  }

  let body;
  if (["POST", "PUT", "PATCH"].includes(request.method)) body = await request.arrayBuffer();

  try {
    const r = await fetch(targetUrl, { method: request.method, headers: forwardHeaders, body });
    const h = new Headers();
    for (const [k, v] of r.headers.entries()) {
      if (k.toLowerCase().startsWith("access-control-")) continue;
      h.set(k, v);
    }
    Object.entries(corsHeaders(origin)).forEach(([k, v]) => h.set(k, v));
    return new Response(await r.arrayBuffer(), { status: r.status, statusText: r.statusText, headers: h });
  } catch (err) {
    return json({ error: "KIS API fetch failed", detail: err.message }, origin, 502);
  }
}

// ── 헬스체크 ──────────────────────────────────────────────────────────────────
function handleHealth(origin, env) {
  return json({
    status: "ok",
    version: "2.1.0",
    kv: env.DIARY_KV ? "connected" : "not configured",
    db: env.SUPABASE_SERVICE_KEY ? "connected" : "not configured",
    allowedOrigin: ALLOWED_ORIGIN,
    timestamp: new Date().toISOString(),
  }, origin);
}

// ── 메인 ──────────────────────────────────────────────────────────────────────
export default {
  async fetch(request, env, ctx) {
    const origin   = request.headers.get("Origin") || "";
    const pathname = new URL(request.url).pathname;

    if (request.method === "OPTIONS")          return handleOptions(request);
    if (pathname === "/" || pathname === "/health") return handleHealth(origin, env);
    if (pathname === "/db")                    return handleDB(request, env, origin);
    if (pathname.startsWith("/kv/"))           return handleKV(request, env);
    return handleProxy(request);
  },
};

function handleOptions(request) {
  const origin = request.headers.get("Origin") || "";
  return new Response(null, { status: 204, headers: corsHeaders(request.headers.get("Origin") || "") });
}
