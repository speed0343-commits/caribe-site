// ============================================================
// 관리자 API (/api/admin) — 로그인한 관리자만 사용
// POST {action:"login", password} / {action:"logout"}
// GET  ?action=me                       → 로그인·저장소·알림 설정 상태
// GET  ?action=list&kinds=order,chat…   → 종류별 최근 기록
// POST {action:"update", kind, id, data} → 상태·메모 등 수정 (채팅은 메시지를 합쳐서 저장)
// POST {action:"create"|"delete", kind:"answer"…} → AI 답변 등록·삭제
// POST {action:"test-notify"}            → 알림 시험 발송
// ============================================================
"use strict";
const { send, readBody, clientIp, originOk, cookies, query } = require("../lib/http");
const db = require("../lib/db");
const auth = require("../lib/auth");
const { notify, adminLink, status: notifyStatus } = require("../lib/notify");

const ID_RE = /^[A-Za-z]{1,3}-[A-Za-z0-9-]{3,40}$/;
const strip = (r) => { const o = {}; for (const [k, v] of Object.entries(r)) if (k !== "_key" && k !== "_token") o[k] = v; return o; };
const msgKey = (m) => `${m.who}|${m.at}|${m.text}`;

module.exports = async function handler(req, res) {
  let body = {};
  if (req.method === "POST") {
    if (!originOk(req)) return send(res, 403, { error: "forbidden" });
    try { body = await readBody(req, 200_000); } catch { return send(res, 400, { error: "bad_request" }); }
  } else if (req.method !== "GET") return send(res, 405, { error: "method_not_allowed" });
  const action = req.method === "GET" ? query(req).get("action") : body.action;

  if (action === "login") {
    if (!auth.configured()) return send(res, 503, { error: "no_password" });
    try { if (db.configured() && (await db.limited("login:" + clientIp(req), 10, 900))) return send(res, 429, { error: "rate_limited" }); } catch {}
    if (!auth.passwordOk(body.password)) return send(res, 401, { error: "wrong_password" });
    return send(res, 200, { ok: true }, { "Set-Cookie": auth.loginCookie() });
  }
  if (action === "logout") return send(res, 200, { ok: true }, { "Set-Cookie": auth.logoutCookie() });

  if (!auth.valid(cookies(req)[auth.COOKIE])) return send(res, 401, { error: auth.configured() ? "login_required" : "no_password" });
  if (action === "me") return send(res, 200, { ok: true, db: db.configured(), notify: notifyStatus() });
  if (!db.configured()) return send(res, 503, { error: "not_configured" });

  try {
    if (action === "list") {
      const kinds = String(query(req).get("kinds") || "").split(",").filter((k) => db.KINDS.includes(k));
      const data = {};
      for (const k of kinds) data[k] = (await db.list(k, 500)).map(strip);
      return send(res, 200, { data });
    }

    const kind = body.kind, id = String(body.id || (body.data && body.data.id) || "");
    if (action === "update") {
      if (!db.KINDS.includes(kind) || !ID_RE.test(id) || !body.data || typeof body.data !== "object") return send(res, 400, { error: "bad_request" });
      const cur = await db.get(kind, id);
      if (!cur) return send(res, 404, { error: "not_found" });
      const next = { ...cur };
      for (const [k, v] of Object.entries(body.data)) if (!k.startsWith("_") && k !== "id" && k !== "messages") next[k] = v;
      if (kind === "chat") {
        // 그사이 고객이 보낸 메시지를 잃지 않도록 합쳐서 저장
        const seen = new Set((cur.messages || []).map(msgKey));
        const add = (Array.isArray(body.data.messages) ? body.data.messages : []).filter((m) => m && m.text && !seen.has(msgKey(m)));
        next.messages = [...(cur.messages || []), ...add].sort((a, b) => String(a.at).localeCompare(String(b.at))).slice(-300);
      }
      next.updatedAt = new Date().toISOString();
      await db.save(kind, next, kind === "chat" ? Date.now() : undefined);
      return send(res, 200, { ok: true, data: strip(next) });
    }
    if (action === "create") {
      if (kind !== "answer" || !ID_RE.test(id)) return send(res, 400, { error: "bad_request" });
      const d = body.data;
      const rec = { id, keywords: (d.keywords || []).map(String).slice(0, 10), answer: String(d.answer || "").slice(0, 800), createdAt: d.createdAt || new Date().toISOString(), hits: 0, from: String(d.from || "").slice(0, 300) };
      await db.create("answer", rec);
      return send(res, 200, { ok: true, data: rec });
    }
    if (action === "delete") {
      if (!["answer", "unanswered"].includes(kind) || !ID_RE.test(id)) return send(res, 400, { error: "bad_request" });
      await db.remove(kind, id);
      return send(res, 200, { ok: true });
    }
    if (action === "test-notify") {
      const r = await notify({ subject: "카리브무역 알림 시험", short: "알림 시험입니다", lines: ["관리자 화면에서 보낸 알림 시험입니다.", "이 메시지가 보이면 새 주문·의뢰·문의 알림이 정상으로 옵니다."], link: adminLink(req) });
      return send(res, 200, { ok: true, result: r });
    }
    return send(res, 400, { error: "bad_request" });
  } catch (e) {
    console.error("admin", action, e.message);
    return send(res, 502, { error: "store_failed" });
  }
};
