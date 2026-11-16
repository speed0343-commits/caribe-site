// ============================================================
// 고객 화면 ↔ 서버 연결 (주문·의뢰·문의·상담 채팅을 관리자 화면으로 보냄)
// - 화면은 지금처럼 이 브라우저에도 저장하고, 같은 내용을 서버(/api/submit)에 보냅니다.
// - 보내기에 실패하면(인터넷 끊김, 서버 준비 전) 보낼 목록(carib_outbox)에 남겨 두고 다음에 다시 보냅니다.
// - 주문·의뢰에는 이 브라우저만 아는 열쇠(_key)를 붙여, 나중에 진행 상황을 조회하고 취소를 요청합니다.
// ============================================================
(function () {
  "use strict";
  const OUTBOX = "carib_outbox";
  const CHAT_TOKEN = "agentChatToken";
  const ls = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  function newKey() {
    const a = new Uint8Array(18);
    crypto.getRandomValues(a);
    return btoa(String.fromCharCode.apply(null, a)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  }
  const newId = (prefix) => `${prefix}-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;

  async function call(url, opts) {
    try {
      const r = await fetch(url, opts);
      let data = {};
      try { data = await r.json(); } catch (e) {}
      return { ok: r.ok, status: r.status, data };
    } catch (e) { return { ok: false, status: 0, data: {} }; }
  }
  const post = (url, body) => call(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });

  // ---------------- 기록 보내기 (재시도 목록) ----------------
  function send(kind, data) {
    if (!data.id) data.id = newId(kind === "inquiry" ? "IQ" : "X");
    const box = ls.get(OUTBOX, []);
    box.push({ kind, data, n: newKey().slice(0, 8) });
    ls.set(OUTBOX, box.slice(-100));
    return flush();
  }
  let flushing = null;
  function flush() {
    if (flushing) return flushing;
    flushing = (async () => {
      for (const item of ls.get(OUTBOX, [])) {
        const r = await post("/api/submit", { kind: item.kind, data: item.data });
        // 저장됨 또는 고칠 수 없는 요청(형식 오류·너무 큼) → 목록에서 뺌. 서버 준비 전·오프라인·요청 많음 → 남겨 두고 다음에
        if (r.ok || [400, 403, 413].includes(r.status)) ls.set(OUTBOX, ls.get(OUTBOX, []).filter((x) => x.n !== item.n));
        else break;
      }
    })().finally(() => { flushing = null; });
    return flushing;
  }
  // 주문·의뢰에 조회용 열쇠 붙이기 (저장 전에 호출)
  function keyed(rec) { if (!rec._key) rec._key = newKey(); return rec; }

  // ---------------- 진행 상황 받아오기 (주문·의뢰) ----------------
  async function syncStatus() {
    const orders = ls.get("carib_orders", []), reqs = ls.get("carib_requests", []);
    const items = orders.concat(reqs).filter((x) => x && x.id && x._key).slice(0, 30).map((x) => ({ id: x.id, key: x._key }));
    if (!items.length) return false;
    const r = await post("/api/track", { action: "status", items });
    if (!r.ok || !Array.isArray(r.data.items)) return false;
    let changed = false;
    const set = (o, k, v) => { if (v !== undefined && o[k] !== v) { o[k] = v; changed = true; } };
    r.data.items.forEach((s) => {
      const o = orders.find((x) => x.id === s.id);
      if (o) {
        set(o, "status", s.status); set(o, "courier", s.courier); set(o, "tracking", s.tracking);
        if (s.paid && o.payment && !o.payment.paid) { o.payment.paid = true; changed = true; }
      }
      const q = reqs.find((x) => x.id === s.id);
      if (q) { set(q, "status", s.status); if (s.fee && q.needs && q.needs.fee !== s.fee) { q.needs.fee = s.fee; changed = true; } }
    });
    if (changed) {
      ls.set("carib_orders", orders); ls.set("carib_requests", reqs);
      window.dispatchEvent(new CustomEvent("remote:sync"));
    }
    return changed;
  }

  // 주문 취소 요청: 서버에 먼저 알리고, 결과 상태를 돌려줌 (열쇠 없는 예전 주문은 null)
  async function cancelOrder(o) {
    if (!o || !o._key) return null;
    const r = await post("/api/track", { action: "cancel", id: o.id, key: o._key });
    return r.ok ? r.data.status : (r.data && r.data.status) || null;
  }

  // 비회원 주문·배송 조회: 주문번호 + 휴대폰 번호 → { ok, item } / { ok:false, reason }
  async function lookupOrder(id, phone) {
    const r = await post("/api/track", { action: "lookup", id, phone });
    if (r.ok && r.data.item) return { ok: true, item: r.data.item };
    const reason = r.status === 404 ? "not_found" : r.status === 429 ? "rate_limited" : r.status === 400 ? "bad_request" : r.status === 503 ? "not_configured" : "failed";
    return { ok: false, reason };
  }

  // ---------------- 상담사 채팅 ----------------
  let chatReady = null;
  function chatStart(chat) {
    chatReady = post("/api/live-chat", { action: "start", chat }).then((r) => {
      if (r.ok && r.data.token) { try { sessionStorage.setItem(CHAT_TOKEN, chat.id + "|" + r.data.token); } catch (e) {} return r.data.token; }
      return null;
    });
    return chatReady;
  }
  async function chatToken(id) {
    if (chatReady) await chatReady;
    let v = "";
    try { v = sessionStorage.getItem(CHAT_TOKEN) || ""; } catch (e) {}
    const i = v.indexOf("|");
    return i > 0 && v.slice(0, i) === id ? v.slice(i + 1) : null;
  }
  async function chatPost(id, message, contact) {
    const token = await chatToken(id);
    if (!token) return null;
    const r = await post("/api/live-chat", { action: "post", id, token, message, contact });
    return r.ok || r.status === 409 ? r.data : null;
  }
  async function chatPull(id) {
    const token = await chatToken(id);
    if (!token) return null;
    const r = await call(`/api/live-chat?id=${encodeURIComponent(id)}&token=${encodeURIComponent(token)}`);
    return r.ok ? r.data : null;
  }

  // ---------------- 관리자가 등록한 AI 답변 (상담창에서 사용) ----------------
  async function loadAnswers() {
    const r = await call("/api/submit?answers=1");
    if (!r.ok || !Array.isArray(r.data.answers)) return;
    const local = ls.get("carib_ai_answers", []);
    ls.set("carib_ai_answers", r.data.answers.map((a) => ({ ...a, hits: (local.find((x) => x.id === a.id) || {}).hits || 0 })));
  }

  window.Remote = { send, flush, keyed, newKey, syncStatus, cancelOrder, lookupOrder, chatStart, chatPost, chatPull, loadAnswers };

  const start = () => {
    flush();
    syncStatus();
    if (document.getElementById("chatLog")) loadAnswers();
  };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
  else start();
  window.addEventListener("online", flush);
})();
