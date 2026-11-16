// ============================================================
// 주문·배송 조회 (order.html)
// - 주문번호 + 휴대폰 번호로 서버(/api/track lookup)에서 진행 상황·송장번호 조회 → 배송조회 버튼
// - 이 기기에서 비회원으로 주문한 내역은 바로 보여 줌 (서버의 최신 상태로 갱신)
// - 회원 주문은 마이페이지에서 확인
// ============================================================
(function () {
  "use strict";
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const won = (n) => (Number(n) || 0).toLocaleString("ko-KR") + "원";
  const day = (iso) => { const d = new Date(iso); return isNaN(d) ? "" : `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`; };
  const getLocal = () => { try { return JSON.parse(localStorage.getItem("carib_orders")) || []; } catch (e) { return []; } };

  const FLOW = ["주문 접수", "적용 확인", "입금 확인", "출고 준비", "배송 중", "배송 완료"];
  const HELP = {
    "주문 접수": "담당자가 차량 적용 여부를 확인한 뒤 연락드리겠습니다.",
    "적용 확인": "적용 확인이 완료되었습니다. 안내해 드린 계좌로 입금해 주세요.",
    "입금 확인": "입금이 확인되었습니다. 출고를 준비하고 있습니다.",
    "출고 준비": "상품을 포장하고 있습니다. 가공 상품은 가공을 마친 뒤 출고됩니다.",
    "배송 중": "상품이 택배로 배송 중입니다. 배송조회 버튼을 누르시면 택배사 화면에서 현재 위치를 확인하실 수 있습니다.",
    "배송 완료": "배송이 완료되었습니다. 이용해 주셔서 감사합니다.",
    "취소 요청": "취소 요청이 접수되었습니다. 담당자가 확인 후 처리해 드리겠습니다.",
    "취소": "취소된 주문입니다.",
  };
  const badge = (s) => `<span class="status s${s === "취소" ? 4 : s === "배송 완료" ? 3 : s === "주문 접수" ? 0 : s === "취소 요청" ? 1 : 2}">${esc(s || "주문 접수")}</span>`;
  function steps(o) {
    if (o.status === "취소" || o.status === "취소 요청") return `<p class="my-cancel-note">${esc(HELP[o.status])}</p>`;
    const cur = Math.max(0, FLOW.indexOf(o.status));
    return `<ol class="my-steps" aria-label="진행 단계">${FLOW.map((s, i) => `<li class="${i < cur ? "done" : i === cur ? "now" : ""}"${i === cur ? ' aria-current="step"' : ""}><i></i><span>${s}</span></li>`).join("")}</ol>
      <p class="my-step-help">${esc(HELP[o.status] || "")}</p>`;
  }
  const summaryOf = (o) => {
    if (o.summary) return o.summary;
    const f = (o.items && o.items[0]) || {};
    return `디스크 ${f.axle === "front" ? "앞" : "뒤"} ${f.brand || ""} ${f.pn || ""}${o.items && o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ""}`;
  };
  function card(o) {
    const total = o.total != null ? o.total : o.amounts && o.amounts.total;
    return `<article class="order-card">
      <header><span class="my-id">${esc(o.id)}</span>${badge(o.status)}</header>
      <p class="order-what">${esc(summaryOf(o))}${o.createdAt ? ` <span class="muted small">· ${esc(day(o.createdAt))} 주문</span>` : ""}${total ? ` <span class="muted small">· ${won(total)}</span>` : ""}</p>
      ${steps(o)}
      ${Delivery.trackHtml(o, esc)}
    </article>`;
  }

  // ---------- 조회 ----------
  const form = $("#lookupForm"), err = $("#lookupError"), out = $("#lookupResult");
  const showErr = (m) => { err.textContent = m; err.hidden = !m; };
  const params = new URLSearchParams(location.search);
  if (params.get("id")) form.id.value = params.get("id");

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = form.id.value.trim().toUpperCase().replace(/\s+/g, "");
    const phone = form.phone.value.replace(/[^0-9]/g, "");
    out.innerHTML = "";
    if (!/^OR-[0-9A-Z-]{4,}$/.test(id)) { showErr("주문번호를 확인해 주세요. (예: OR-20261116-1234)"); form.id.focus(); return; }
    if (phone.length < 9) { showErr("휴대폰 번호를 확인해 주세요."); form.phone.focus(); return; }
    showErr("");
    const btn = form.querySelector("button[type=submit]");
    btn.disabled = true; btn.textContent = "조회 중…";

    // 이 기기에 같은 주문이 있으면 먼저 그걸로 (서버 연결 전이어도 볼 수 있게)
    const local = getLocal().find((o) => o.id === id && [o.orderer && o.orderer.phone, o.receiver && o.receiver.phone].some((p) => String(p || "").replace(/[^0-9]/g, "") === phone));
    const r = window.Remote ? await Remote.lookupOrder(id, phone) : { ok: false, reason: "failed" };
    btn.disabled = false; btn.textContent = "조회하기";

    if (r.ok) { out.innerHTML = card(r.item); Delivery.bindCopy(out); return; }
    if (local) { out.innerHTML = card(local); Delivery.bindCopy(out); return; }
    showErr({
      not_found: "주문 정보를 찾을 수 없습니다. 주문번호와 휴대폰 번호를 다시 확인해 주세요.",
      rate_limited: "조회 요청이 많습니다. 잠시 후 다시 시도해 주세요.",
      bad_request: "주문번호와 휴대폰 번호를 다시 확인해 주세요.",
    }[r.reason] || "지금은 온라인 조회를 할 수 없습니다. 010-5459-3111로 전화 주시면 확인해 드립니다.");
  });

  // ---------- 이 기기에서 비회원으로 주문한 내역 ----------
  const me = window.CaribAuth && CaribAuth.current ? CaribAuth.current() : null;
  if (me) {
    const note = $("#memberNote");
    note.innerHTML = `회원으로 주문하신 내역은 <a href="mypage.html">마이페이지</a>에서 바로 확인하실 수 있습니다.`;
    note.classList.remove("hidden");
  }
  function renderLocal() {
    const list = getLocal().filter((o) => o && o.id && !o.memberId).slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 10);
    $("#localBox").classList.toggle("hidden", !list.length);
    $("#localOrders").innerHTML = list.map(card).join("");
    Delivery.bindCopy($("#localOrders"));
  }
  renderLocal();
  window.addEventListener("remote:sync", renderLocal);
  if (window.Remote) Remote.syncStatus().catch(() => {});
})();
