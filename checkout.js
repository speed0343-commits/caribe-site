// ============================================================
// 주문서 작성 (checkout.html) — 장바구니 → 주문자·배송지·결제 방법 입력 → 주문 접수
// 시연용: 주문은 이 브라우저 localStorage(carib_orders)에 저장. 실제 결제는 이루어지지 않음.
// 실제 운영: 서버 API(POST /api/orders) + PG 결제 연동으로 교체
// ============================================================
(function () {
  "use strict";
  const form = $("#coForm");
  const me = window.CaribAuth && CaribAuth.current();
  const digits = (s) => String(s || "").replace(/\D/g, "");
  const isMobile = (p) => /^01[016789]\d{7,8}$/.test(digits(p));
  const fmtPhone = (s) => { const d = digits(s); return d.length === 11 ? `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}` : d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}` : String(s || "").trim(); };
  const spec = (p) => `Ø${p.dia || "?"}×${p.thk || "?"}mm`;

  // ---------- 주문 완료 화면 (?done=주문번호) ----------
  const doneId = SiteNav.params().get("done");
  if (doneId) {
    const o = store.get(ORDERS_KEY, []).find((x) => x.id === doneId);
    if (o) return showDone(o);
  }

  const items = cartItemsFromStore();
  if (!items.length) { $("#coEmpty").classList.remove("hidden"); return; }
  form.classList.remove("hidden");

  // ---------- 주문 상품 · 금액 ----------
  const goods = items.reduce((s, x) => s + brandPrice(x.p, x.brand) * SET_SIZE * x.q, 0);
  const chaosFee = items.reduce((s, x) => s + (x.o && x.o.price ? x.o.price * SET_SIZE * x.q : 0), 0);
  const chaosQuote = items.some((x) => x.o && !x.o.price);
  const hasChaos = items.some((x) => x.o);
  const total = goods + chaosFee;

  $("#coItems").innerHTML = `<ul class="co-items">${items.map((x) => `<li>
      <div><b>브레이크 디스크 ${axleKo(x.p.axle)}</b> · ${esc(x.brand)} · OEM ${esc(x.p.pn)}
        <span class="muted small">${spec(x.p)} · ${x.q}세트(${x.q * SET_SIZE}장)</span>
        ${x.o ? `<span class="chaos-line small">+ ${esc(x.o.name)} ${x.o.price ? `(${won(x.o.price * SET_SIZE)}/세트)` : "(가공비 별도 견적)"}</span>` : ""}</div>
      <b class="co-price">${won(x.sub)}</b></li>`).join("")}</ul>`;
  $("#coChaosNote").hidden = !hasChaos;
  $("#coSum").innerHTML = [
    ["상품 금액", won(goods)],
    hasChaos ? ["카오스 가공비", won(chaosFee) + (chaosQuote ? " + 별도 견적" : "")] : null,
    ["배송비", "무료배송"],
  ].filter(Boolean).map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  $("#coTotal").textContent = won(total) + (chaosQuote ? " +α" : "");
  $("#coSumNote").textContent = `${PRICE_NOTE ? PRICE_NOTE + " · " : ""}배송비는 무료이며, 가공비는 담당자 확인 후 최종 금액을 안내해 드립니다.`;

  // ---------- 주문자 · 회원 정보 ----------
  if (me) {
    form.oName.value = me.company ? `${me.name} / ${me.company}` : me.name;
    form.oPhone.value = me.phone; form.oEmail.value = me.email;
    $("#coLogin").textContent = `${me.name}님의 회원 정보로 입력되었습니다`;
  } else {
    $("#coLogin").innerHTML = `<a href="login.html?next=checkout.html">로그인</a>하시면 정보가 자동으로 입력됩니다 · 비회원 주문 가능`;
  }
  try { const v = sessionStorage.getItem("lastVin"); if (v) form.vin.value = v; } catch (e) {}

  // 휴대폰 번호 자동 하이픈
  ["oPhone", "rPhone", "receiptNo"].forEach((n) => form[n].addEventListener("input", () => {
    if (n === "receiptNo" && form.receipt.value === "tax") return; // 사업자등록번호는 아래에서 처리
    const d = digits(form[n].value).slice(0, 11);
    form[n].value = d.length > 7 ? `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
  }));

  // 받는 분 = 주문자
  const same = $("#sameAsOrderer");
  function syncReceiver() {
    if (!same.checked) { form.rName.readOnly = form.rPhone.readOnly = false; return; }
    form.rName.value = form.oName.value; form.rPhone.value = form.oPhone.value;
    form.rName.readOnly = form.rPhone.readOnly = true;
  }
  same.addEventListener("change", () => { if (!same.checked) { form.rName.value = ""; form.rPhone.value = ""; } syncReceiver(); });
  form.oName.addEventListener("input", syncReceiver);
  form.oPhone.addEventListener("input", syncReceiver);
  syncReceiver();

  // 배송 메모
  $("#memoSel").addEventListener("change", (e) => { $("#memoText").hidden = e.target.value !== "custom"; if (!$("#memoText").hidden) $("#memoText").focus(); });

  // ---------- 주소 검색 (다음 우편번호 서비스 · 불러오지 못하면 직접 입력) ----------
  const layer = $("#addrLayer"), help = $("#addrHelp");
  function openPostcode() {
    layer.innerHTML = `<div class="co-addr-bar"><b>주소 검색</b><button type="button" class="link-plain" id="closeAddr">닫기</button></div><div class="co-addr-frame"></div>`;
    layer.hidden = false;
    $("#closeAddr").onclick = () => { layer.hidden = true; layer.innerHTML = ""; };
    new window.daum.Postcode({
      width: "100%", height: "100%",
      oncomplete: (d) => {
        form.zip.value = d.zonecode;
        form.addr1.value = (d.roadAddress || d.jibunAddress) + (d.buildingName ? ` (${d.buildingName})` : "");
        layer.hidden = true; layer.innerHTML = "";
        clearErr("zip"); clearErr("addr1");
        form.addr2.focus();
      },
    }).embed(layer.querySelector(".co-addr-frame"));
  }
  $("#findAddr").addEventListener("click", () => {
    help.hidden = true;
    if (window.daum && window.daum.Postcode) return openPostcode();
    // 카카오 우편번호 서비스: t1.daumcdn.net 은 2026-11-30 종료 → t1.kakaocdn.net 사용.
    // 새 주소가 안 열리면 예전 주소로 한 번 더 시도 (예전 주소가 끝나기 전까지 대비)
    const SRC = ["https://t1.kakaocdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js", "https://t1.daumcdn.net/mapjsapi/bundle/postcode/prod/postcode.v2.js"];
    const load = (i) => {
      const s = document.createElement("script");
      s.src = SRC[i];
      s.onload = () => (window.daum && window.daum.Postcode ? openPostcode() : i + 1 < SRC.length ? load(i + 1) : fail());
      s.onerror = () => (i + 1 < SRC.length ? load(i + 1) : fail());
      document.head.appendChild(s);
    };
    load(0);
    function fail() { help.textContent = "주소 검색을 불러오지 못했습니다. 우편번호와 주소를 직접 입력해 주세요."; help.hidden = false; form.zip.focus(); }
  });

  // ---------- 결제 방법 ----------
  $("#payList").innerHTML = Object.entries(PAY_METHODS).map(([k, m], i) => `<label class="co-pay-opt${m.ready ? "" : " off"}">
      <input type="radio" name="pay" value="${k}" ${i === 0 ? "checked" : ""} ${m.ready ? "" : "disabled"} />
      <b>${esc(m.name)}</b>${m.ready ? "" : '<span class="co-tag">준비 중</span>'}<small>${esc(m.note)}</small></label>`).join("");
  const payNote = () => { const m = PAY_METHODS[form.pay.value]; $("#payNote").textContent = m ? m.note : ""; };
  form.addEventListener("change", (e) => { if (e.target.name === "pay") payNote(); });
  payNote();

  // ---------- 증빙 서류 ----------
  form.addEventListener("change", (e) => {
    if (e.target.name !== "receipt") return;
    const v = form.receipt.value;
    $("#receiptFields").hidden = v === "none";
    $("#receiptEmailWrap").hidden = v !== "tax";
    $("#receiptNoLbl").textContent = v === "tax" ? "사업자등록번호" : "휴대폰 번호";
    form.receiptNo.placeholder = v === "tax" ? "000-00-00000" : "010-0000-0000";
    form.receiptNo.value = v === "tax" ? (me && me.bizNo) || "" : form.oPhone.value;
    if (v === "tax" && me && me.email) form.receiptEmail.value = me.email;
  });
  form.receiptNo.addEventListener("input", () => {
    if (form.receipt.value !== "tax") return;
    const d = digits(form.receiptNo.value).slice(0, 10);
    form.receiptNo.value = d.length > 5 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
  });

  // ---------- 검증 · 주문 접수 ----------
  function clearErr(k) { const w = form.querySelector(`[data-for="${k}"]`); if (!w) return; w.classList.remove("has-err"); const e = w.querySelector(".field-err"); if (e) e.textContent = ""; }
  form.addEventListener("input", (e) => { const w = e.target.closest("[data-for]"); if (w) clearErr(w.dataset.for); });
  form.addEventListener("change", (e) => { if (e.target.type === "checkbox" && e.target.id.startsWith("agree")) clearErr("agree"); });
  function showErrors(errs) {
    form.querySelectorAll("[data-for]").forEach((w) => {
      const m = errs[w.dataset.for] || "";
      const e = w.querySelector(".field-err"); if (e) e.textContent = m;
      w.classList.toggle("has-err", !!m);
    });
    const first = form.querySelector(".has-err input, .has-err select");
    if (first) first.focus();
  }

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    syncReceiver();
    const v = (n) => String(form[n].value || "").trim();
    const errs = {};
    if (v("oName").length < 2) errs.oName = "이름을 2자 이상 입력해 주세요.";
    if (!isMobile(v("oPhone"))) errs.oPhone = "휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)";
    if (v("oEmail") && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("oEmail"))) errs.oEmail = "이메일 형식을 확인해 주세요.";
    if (v("rName").length < 2) errs.rName = "받는 분 이름을 입력해 주세요.";
    if (!isMobile(v("rPhone"))) errs.rPhone = "받는 분 휴대폰 번호를 확인해 주세요.";
    if (!/^\d{5}$/.test(v("zip"))) errs.zip = "우편번호 5자리를 입력해 주세요.";
    if (v("addr1").length < 5) errs.addr1 = "주소를 입력해 주세요.";
    if (!v("addr2")) errs.addr2 = "상세 주소를 입력해 주세요.";
    const vin = v("vin").toUpperCase().replace(/[\s-]/g, "");
    if (vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) errs.vin = "차대번호 17자리를 확인해 주세요. (I·O·Q는 사용되지 않습니다)";
    const receipt = form.receipt.value;
    if (receipt === "cash" && !isMobile(v("receiptNo"))) errs.receiptNo = "현금영수증을 받으실 휴대폰 번호를 확인해 주세요.";
    if (receipt === "tax" && digits(v("receiptNo")).length !== 10) errs.receiptNo = "사업자등록번호 10자리를 입력해 주세요.";
    if (receipt === "tax" && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v("receiptEmail"))) errs.receiptEmail = "세금계산서를 받으실 이메일을 입력해 주세요.";
    if (!$("#agreeOrder").checked || !$("#agreePrivacy").checked) errs.agree = "필수 항목에 동의해 주세요.";
    const pay = form.pay.value;
    if (!PAY_METHODS[pay] || !PAY_METHODS[pay].ready) errs.agree = (errs.agree ? errs.agree + " " : "") + "사용 가능한 결제 방법을 선택해 주세요.";
    if (Object.keys(errs).length) { showErrors(errs); $("#coError").textContent = "입력 내용을 확인해 주세요."; $("#coError").hidden = false; return; }
    $("#coError").hidden = true;

    // 장바구니가 다른 창에서 바뀌었는지 다시 확인
    const now = cartItemsFromStore();
    if (!now.length) { $("#coError").textContent = "장바구니가 비어 있습니다. 상품을 다시 담아 주세요."; $("#coError").hidden = false; return; }

    const memo = $("#memoSel").value === "custom" ? v("memoText") : $("#memoSel").value;
    const order = {
      id: newOrderId(), createdAt: new Date().toISOString(), status: "주문 접수",
      memberId: me ? me.id : "",
      orderer: { name: v("oName"), phone: fmtPhone(v("oPhone")), email: v("oEmail") },
      receiver: { name: v("rName"), phone: fmtPhone(v("rPhone")), zip: v("zip"), addr1: v("addr1"), addr2: v("addr2"), memo },
      vin,
      items: now.map((x) => ({ pn: x.p.pn, axle: x.p.axle, spec: spec(x.p), brand: x.brand, sets: x.q, unit: x.unit, sub: x.sub,
        chaos: x.o ? { code: x.o.code, name: x.o.name, price: x.o.price || 0 } : null })),
      amounts: {
        goods: now.reduce((s, x) => s + brandPrice(x.p, x.brand) * SET_SIZE * x.q, 0),
        chaos: now.reduce((s, x) => s + (x.o && x.o.price ? x.o.price * SET_SIZE * x.q : 0), 0),
        chaosQuote: now.some((x) => x.o && !x.o.price), shipping: null, note: PRICE_NOTE,
      },
      payment: { method: pay, name: PAY_METHODS[pay].name, paid: false },
      receipt: { type: receipt, no: receipt === "none" ? "" : v("receiptNo"), email: receipt === "tax" ? v("receiptEmail") : "" },
      courier: "", tracking: "", memo: "",
    };
    order.amounts.total = order.amounts.goods + order.amounts.chaos;
    if (window.Remote) Remote.keyed(order); // 나중에 진행 상황 조회·취소 요청에 쓰는 열쇠
    const list = store.get(ORDERS_KEY, []); list.unshift(order); store.set(ORDERS_KEY, list);
    if (window.Remote) Remote.send("order", order); // 서버 저장 + 담당자 알림 (실패하면 다음에 다시 보냄)
    store.set(CART_KEY, {});
    SiteNav.setUrl("checkout.html?done=" + encodeURIComponent(order.id));
    showDone(order);
  });

  // ---------- 완료 화면 ----------
  function showDone(o) {
    form.classList.add("hidden");
    $("#coEmpty").classList.add("hidden");
    $("#coTitle").textContent = "주문이 접수되었습니다";
    $("#stepDone").classList.add("on");
    const isMember = !!(window.CaribAuth && CaribAuth.current() && o.memberId);
    const box = $("#coDone");
    box.classList.remove("hidden");
    box.innerHTML = `
      <div class="co-done-head"><span class="muted small">주문번호</span><b class="co-no">${esc(o.id)}</b><span class="status s0">${esc(o.status)}</span></div>
      <ol class="co-next">
        <li><b>차량 적용 확인</b><span>담당자가 ${o.vin ? "차대번호" : "주문 상품"}로 적용 여부를 확인한 뒤 연락드리겠습니다.</span></li>
        <li><b>결제 안내</b><span>${esc(o.payment.name)} — 확인이 끝나면 최종 금액과 입금 계좌를 문자로 안내해 드립니다.</span></li>
        <li><b>출고 · 배송</b><span>입금이 확인되면 출고 후 택배 송장번호를 알려 드립니다.${o.items.some((x) => x.chaos) ? " 가공 상품은 가공을 마친 뒤 출고됩니다." : ""}</span></li>
      </ol>
      <table class="info-table">
        <tr><th>주문 상품</th><td>${o.items.map((x) => `디스크 ${axleKo(x.axle)} ${esc(x.brand)} OEM ${esc(x.pn)} × ${x.sets}세트${x.chaos ? ` + ${esc(x.chaos.name)}` : ""}`).join("<br />")}</td></tr>
        <tr><th>결제 예정 금액</th><td><b>${won(o.amounts.total)}</b>${o.amounts.chaosQuote ? " + 가공비 별도" : ""} · 무료배송</td></tr>
        <tr><th>결제 방법</th><td>${esc(o.payment.name)} (미결제)</td></tr>
        <tr><th>받는 분</th><td>${esc(o.receiver.name)} · ${esc(o.receiver.phone)}</td></tr>
        <tr><th>배송지</th><td>(${esc(o.receiver.zip)}) ${esc(o.receiver.addr1)} ${esc(o.receiver.addr2)}${o.receiver.memo ? `<br /><span class="muted small">${esc(o.receiver.memo)}</span>` : ""}</td></tr>
        ${o.vin ? `<tr><th>차대번호</th><td>${esc(o.vin)}</td></tr>` : ""}
      </table>
      <p class="co-note">궁금하신 점은 010-5459-3111로 전화 주세요.</p>
      <div class="co-done-actions">
        ${isMember ? '<a class="btn btn-primary" href="mypage.html">마이페이지에서 주문 보기</a>' : '<span class="co-note">비회원 주문은 주문번호와 연락처를 알려 주시면 담당자가 확인해 드립니다.</span>'}
        <a class="btn btn-ghost" href="index.html">쇼핑 계속하기</a>
      </div>`;
    window.scrollTo(0, 0);
  }
})();
