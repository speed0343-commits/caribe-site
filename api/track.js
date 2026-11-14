// ============================================================
// 고객의 주문·의뢰 진행 상황 조회와 주문 취소 요청 (POST /api/track)
// - 주문할 때 브라우저가 만든 열쇠(_key)가 맞아야 조회·취소할 수 있습니다.
// { action: "status", items: [{ id, key }] } → 상태·택배 정보
// { action: "cancel", id, key }               → 입금 전·출고 전 주문만 "취소 요청"으로
// ============================================================
"use strict";
const { send, readBody, clientIp, originOk } = require("../lib/http");
const db = require("../lib/db");
const { sameKey } = require("../lib/auth");
const { notify, adminLink } = require("../lib/notify");

const kindOf = (id) => (/^OR-/.test(id) ? "order" : /^CR-/.test(id) ? "request" : null);
const canCancel = (o) => ["주문 접수", "적용 확인"].includes(o.status) && !(o.payment && o.payment.paid);
const pub = (kind, r) => kind === "order"
  ? { id: r.id, status: r.status, courier: r.courier || "", tracking: r.tracking || "", paid: !!(r.payment && r.payment.paid), updatedAt: r.updatedAt || "" }
  : { id: r.id, status: r.status, fee: (r.needs && r.needs.fee) || "", updatedAt: r.updatedAt || "" };

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
  if (!originOk(req)) return send(res, 403, { error: "forbidden" });
  if (!db.configured()) return send(res, 503, { error: "not_configured" });
  let body;
  try { body = await readBody(req, 10_000); } catch { return send(res, 400, { error: "bad_request" }); }
  try {
    if (await db.limited("track:" + clientIp(req), 120, 600)) return send(res, 429, { error: "rate_limited" });

    if (body.action === "status") {
      const items = (Array.isArray(body.items) ? body.items : []).slice(0, 30);
      const out = [];
      for (const it of items) {
        const kind = kindOf(String(it && it.id));
        if (!kind) continue;
        const r = await db.get(kind, it.id);
        if (r && sameKey(it.key, r._key)) out.push(pub(kind, r));
      }
      return send(res, 200, { items: out });
    }

    if (body.action === "cancel") {
      const id = String(body.id || "");
      if (kindOf(id) !== "order") return send(res, 400, { error: "bad_request" });
      const o = await db.get("order", id);
      if (!o || !sameKey(body.key, o._key)) return send(res, 404, { error: "not_found" });
      if (o.status === "취소 요청") return send(res, 200, { ok: true, status: o.status });
      if (!canCancel(o)) return send(res, 409, { error: "not_cancellable", status: o.status });
      o.status = "취소 요청"; o.cancelRequestedAt = o.updatedAt = new Date().toISOString();
      await db.save("order", o);
      await notify({ subject: `주문 취소 요청 ${o.id}`, short: `주문 취소 요청 ${o.id} ${(o.orderer && o.orderer.name) || ""}`,
        lines: [`고객이 주문 취소를 요청했습니다. (${o.id})`, `주문자: ${(o.orderer && o.orderer.name) || ""} ${(o.orderer && o.orderer.phone) || ""}`], link: adminLink(req) });
      return send(res, 200, { ok: true, status: o.status });
    }
    return send(res, 400, { error: "bad_request" });
  } catch (e) {
    console.error("track", e.message);
    return send(res, 502, { error: "store_failed" });
  }
};
