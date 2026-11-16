// ============================================================
// 고객이 남긴 기록을 서버에 저장 (POST /api/submit)
// - 주문(order), 가공 의뢰(request), 문의(inquiry), 회원 가입 정보(member), AI가 답하지 못한 질문(unanswered)
// - 같은 id로 다시 보내면 한 번만 저장(재전송 안전). 새 주문·의뢰·문의는 담당자에게 알림.
// GET /api/submit?answers=1 : 관리자가 등록한 AI 답변 (상담창이 사용)
// ============================================================
"use strict";
const { send, readBody, clientIp, originOk, query } = require("../lib/http");
const db = require("../lib/db");
const { notify, adminLink } = require("../lib/notify");

const RULES = {
  order: { prefix: "OR", key: true, status: "주문 접수", max: 40_000 },
  request: { prefix: "CR", key: true, status: "접수", max: 80_000 },
  inquiry: { prefix: "IQ", status: "접수", max: 20_000 },
  // member: 회원 계정은 /api/account 에서만 만듦 (누구나 회원 기록을 미리 만들어 두지 못하게)
  unanswered: { prefix: "AQ", status: "미처리", max: 3_000 },
};
const ID_RE = /^[A-Za-z]{1,3}-[A-Za-z0-9-]{3,40}$/;
const KEY_RE = /^[A-Za-z0-9_-]{16,64}$/;
const won = (n) => (Number(n) || 0).toLocaleString("ko-KR") + "원";
const s = (v, n = 200) => String(v ?? "").slice(0, n);

function message(kind, r) {
  if (kind === "order") {
    const o = r.orderer || {}, rc = r.receiver || {}, a = r.amounts || {};
    const items = (r.items || []).map((x) => `- ${s(x.pn, 40)} ${s(x.brand, 20)} ${x.sets || 1}세트${x.chaos ? ` + ${s(x.chaos.name, 40)}` : ""} ${x.sub ? won(x.sub) : ""}`);
    return {
      subject: `새 주문 ${r.id} · ${s(o.name, 30)} · ${won(a.total)}`,
      short: `새 주문 ${r.id} ${s(o.name, 20)} ${won(a.total)}`,
      lines: [`새 주문이 들어왔습니다. (${r.id})`, `주문자: ${s(o.name)} ${s(o.phone, 30)} ${s(o.email, 80)}`, `받는 분: ${s(rc.name)} ${s(rc.phone, 30)}`, `주소: ${s(rc.addr1)} ${s(rc.addr2)}`,
        `차대번호: ${s(r.vin, 20) || "-"}`, "주문 상품:", ...items, `합계: ${won(a.total)}${a.chaosQuote ? " + 가공비 별도" : ""} · 결제: ${s(r.payment && r.payment.name, 40)}`, rc.memo ? `배송 요청: ${s(rc.memo)}` : ""].filter(Boolean),
    };
  }
  if (kind === "request") {
    const c = r.contact || {}, v = r.vehicle || {}, d = r.disc || {}, n = r.needs || {};
    return {
      subject: `새 가공 의뢰 ${r.id} · ${s(c.name, 30)}`,
      short: `새 가공 의뢰 ${r.id} ${s(c.name, 20)} ${s(c.phone, 20)}`,
      lines: [`새 카오스 가공 의뢰가 들어왔습니다. (${r.id})`, `의뢰자: ${s(c.name)} ${s(c.phone, 30)} ${s(c.email, 80)}`, `차량: ${s(v.make, 40)} ${s(v.model, 80)} ${v.vin ? `(차대번호 ${s(v.vin, 20)})` : ""}`,
        `디스크: ${s(d.pn, 40)} ${s(d.axle, 10)} ${s(d.spec, 80)} · ${s(d.qty, 30)}`, `가공 타입: ${s(n.ctype, 40) || "상담 후 결정"} · 희망 일정: ${s(n.schedule, 40) || "-"}`,
        n.request ? `요청 사항: ${s(n.request, 500)}` : "", c.items ? `함께 필요한 품목: ${s(c.items, 500)}` : ""].filter(Boolean),
    };
  }
  if (kind === "inquiry") {
    return {
      subject: `새 문의 · ${s(r.name, 30)}${r.quoteId ? ` (견적서 ${s(r.quoteId, 30)})` : ""}`,
      short: `새 문의 ${s(r.name, 20)} ${s(r.phone, 20)}`,
      lines: [`새 문의가 들어왔습니다.`, `이름: ${s(r.name)} · 연락처: ${s(r.phone, 30)}`, r.vin ? `차대번호: ${s(r.vin, 20)}` : "", "", s(r.message, 1500)].filter((x) => x !== ""),
    };
  }
  return null;
}

module.exports = async function handler(req, res) {
  if (req.method === "GET") {
    if (!query(req).get("answers")) return send(res, 400, { error: "bad_request" });
    if (!db.configured()) return send(res, 200, { answers: [] });
    try {
      const answers = (await db.list("answer", 300)).map((a) => ({ id: a.id, keywords: a.keywords || [], answer: a.answer || "" }));
      return send(res, 200, { answers });
    } catch (e) { console.error("answers", e.message); return send(res, 200, { answers: [] }); }
  }
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
  if (!originOk(req)) return send(res, 403, { error: "forbidden" });
  if (!db.configured()) return send(res, 503, { error: "not_configured" });

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: "bad_request" }); }
  const kind = body && body.kind, rule = RULES[kind], data = body && body.data;
  if (!rule || !data || typeof data !== "object" || Array.isArray(data)) return send(res, 400, { error: "bad_request" });
  if (JSON.stringify(data).length > rule.max) return send(res, 413, { error: "too_large" });

  try {
    if (await db.limited("submit:" + clientIp(req), 60, 600)) return send(res, 429, { error: "rate_limited" });
    const rec = { ...data };
    for (const k of Object.keys(rec)) if (k.startsWith("_")) delete rec[k];
    if (kind === "member") { delete rec.salt; delete rec.hash; delete rec.password; }
    rec.id = typeof data.id === "string" && ID_RE.test(data.id) ? data.id : `${rule.prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
    if (rule.status && !rec.status) rec.status = rule.status;
    if (rule.key) {
      if (typeof data._key !== "string" || !KEY_RE.test(data._key)) return send(res, 400, { error: "bad_key" });
      rec._key = data._key; // 고객 브라우저가 만든 조회용 열쇠 (상태 조회·취소 요청에 사용)
    }
    rec._at = new Date().toISOString();
    const created = await db.create(kind, rec);
    let notified = null;
    if (created) {
      const m = message(kind, rec);
      if (m) notified = await notify({ ...m, link: adminLink(req) });
    }
    return send(res, 200, { ok: true, id: rec.id, duplicate: !created, notified });
  } catch (e) {
    console.error("submit", kind, e.message);
    return send(res, 502, { error: "store_failed" });
  }
};
