// ============================================================
// 서버 함수 공통 도구: 응답, 본문 읽기, 접속 주소, 허용 출처, 쿠키
// ============================================================
"use strict";

const ALLOWED_ORIGINS = [/^https:\/\/(www\.)?caribetrading\.co\.kr$/, /^https:\/\/caribe-site[a-z0-9-]*\.vercel\.app$/, /^http:\/\/localhost(:\d+)?$/];

function send(res, status, obj, headers = {}) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  for (const [k, v] of Object.entries(headers)) res.setHeader(k, v);
  res.end(JSON.stringify(obj));
}

async function readBody(req, limit = 100_000) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) return req.body;
  if (typeof req.body === "string") { if (req.body.length > limit) throw new Error("too_large"); return JSON.parse(req.body || "{}"); }
  let raw = "";
  for await (const chunk of req) { raw += chunk; if (raw.length > limit) throw new Error("too_large"); }
  return JSON.parse(raw || "{}");
}

const clientIp = (req) => String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim() || "unknown";

// 다른 사이트에서 이 API를 부르는 것을 막음 (브라우저가 보내는 Origin 기준)
function originOk(req) {
  const o = req.headers.origin;
  return !o || ALLOWED_ORIGINS.some((re) => re.test(o));
}

function cookies(req) {
  const out = {};
  String(req.headers.cookie || "").split(";").forEach((p) => {
    const i = p.indexOf("=");
    if (i > 0) out[p.slice(0, i).trim()] = decodeURIComponent(p.slice(i + 1).trim());
  });
  return out;
}

const query = (req) => new URL(req.url || "/", "http://x").searchParams;

module.exports = { send, readBody, clientIp, originOk, cookies, query };
