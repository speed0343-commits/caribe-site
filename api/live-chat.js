// ============================================================
// 상담사 채팅 (고객 쪽): POST /api/live-chat, GET /api/live-chat?id=&token=
// - start: 채팅 시작 → 고객 브라우저에 열쇠(token)를 돌려줌. 담당자에게 알림.
// - post : 고객 메시지·연락처 추가 (10분에 한 번까지 담당자에게 알림)
// - GET  : 상담사 답변 포함 전체 대화와 상태 (고객 화면이 몇 초마다 확인)
// ============================================================
"use strict";
const { send, readBody, clientIp, originOk, query } = require("../lib/http");
const db = require("../lib/db");
const { randomKey, sameKey } = require("../lib/auth");
const { notify, adminLink } = require("../lib/notify");

const ID_RE = /^CH-[A-Za-z0-9]{4,30}$/;
const NOTIFY_GAP_MS = 10 * 60 * 1000;
const t = (v, n) => String(v ?? "").slice(0, n);
const validAt = (at) => { const d = Date.parse(at); return Number.isFinite(d) && Math.abs(d - Date.now()) < 864e5 ? new Date(d).toISOString() : new Date().toISOString(); };
const cleanMsg = (m) => (m && (m.who === "customer" || m.who === "system") && String(m.text || "").trim())
  ? { who: m.who, text: t(m.text, 1000), at: validAt(m.at) } : null;
const cleanContact = (c) => (c && typeof c === "object") ? { name: t(c.name, 60), phone: t(c.phone, 30), items: t(c.items, 500) } : null;
const msgKey = (m) => `${m.who}|${m.at}|${m.text}`;
const view = (c) => ({ id: c.id, status: c.status, messages: c.messages || [] });

module.exports = async function handler(req, res) {
  if (!db.configured()) return send(res, 503, { error: "not_configured" });
  try {
    if (req.method === "GET") {
      const q = query(req);
      const c = await db.get("chat", String(q.get("id") || ""));
      if (!c || !sameKey(q.get("token"), c._token)) return send(res, 404, { error: "not_found" });
      return send(res, 200, view(c));
    }
    if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
    if (!originOk(req)) return send(res, 403, { error: "forbidden" });
    let body;
    try { body = await readBody(req, 30_000); } catch { return send(res, 400, { error: "bad_request" }); }
    if (await db.limited("chat:" + clientIp(req), 120, 600)) return send(res, 429, { error: "rate_limited" });

    if (body.action === "start") {
      const ch = body.chat || {};
      if (!ID_RE.test(String(ch.id))) return send(res, 400, { error: "bad_request" });
      const now = new Date().toISOString();
      const c = {
        id: ch.id, createdAt: validAt(ch.createdAt), updatedAt: now, status: "대기",
        topic: t(ch.topic, 200), vin: t(ch.vin, 20), contact: cleanContact(ch.contact) || { name: "", phone: "" },
        messages: (Array.isArray(ch.messages) ? ch.messages : []).slice(-50).map(cleanMsg).filter(Boolean),
        _token: randomKey(), _notifiedAt: Date.now(),
      };
      if (!(await db.create("chat", c))) return send(res, 409, { error: "exists" });
      const first = c.messages.filter((m) => m.who === "customer").map((m) => m.text)[0] || "";
      const sys = c.messages.filter((m) => m.who === "system").map((m) => m.text)[0] || "";
      await notify({ subject: `상담사 채팅 요청 · ${c.topic || "새 상담"}`, short: `상담사 채팅 요청: ${t(c.topic || first, 40)}`,
        lines: ["고객이 상담사 채팅을 시작했습니다. 관리자 화면 '상담사 채팅'에서 답변해 주십시오.", sys, first ? `고객: ${first}` : ""].filter(Boolean), link: adminLink(req) });
      return send(res, 200, { ok: true, token: c._token });
    }

    if (body.action === "post") {
      const c = await db.get("chat", String(body.id || ""));
      if (!c || !sameKey(body.token, c._token)) return send(res, 404, { error: "not_found" });
      if (c.status === "종료") return send(res, 409, { error: "closed", ...view(c) });
      const m = cleanMsg(body.message);
      const contact = cleanContact(body.contact);
      if (!m && !contact) return send(res, 400, { error: "bad_request" });
      c.messages = c.messages || [];
      if (m && !c.messages.some((x) => msgKey(x) === msgKey(m))) c.messages.push(m);
      if (c.messages.length > 300) c.messages = c.messages.slice(-300);
      if (contact) c.contact = contact;
      c.updatedAt = new Date().toISOString();
      const ping = Date.now() - (c._notifiedAt || 0) > NOTIFY_GAP_MS;
      if (ping) c._notifiedAt = Date.now();
      await db.save("chat", c, Date.now());
      if (ping) await notify({ subject: `상담사 채팅 새 메시지 · ${c.topic || c.id}`, short: `상담 채팅 새 메시지: ${t(m ? m.text : "연락처 등록", 40)}`,
        lines: ["상담사 채팅에 새 메시지가 있습니다.", m ? `고객: ${m.text}` : "", contact ? `연락처: ${contact.name} ${contact.phone}${contact.items ? " / " + contact.items : ""}` : ""].filter(Boolean), link: adminLink(req) });
      return send(res, 200, { ok: true, ...view(c) });
    }
    return send(res, 400, { error: "bad_request" });
  } catch (e) {
    console.error("live-chat", e.message);
    return send(res, 502, { error: "store_failed" });
  }
};
