// ============================================================
// 카리브무역 브레이크 디스크 — 사이트 로직
// 데이터: window.CATALOG (catalog-data.js), 설정: data.js
// ============================================================
// 공통 로직은 core.js

// ---------------- 검색 UI ----------------
const makeSel = $("#makeSel"), groupSel = $("#groupSel"), modelSel = $("#modelSel"), axleSel = $("#axleSel");
MAKES.forEach((m) => makeSel.add(new Option(makeKo(m), m)));
let ctx = null; // 차대번호·품번 검색 결과 (선택상자보다 우선)

function fillGroups(make) {
  groupSel.innerHTML = '<option value="">전체</option>';
  [...new Set(ROWS.filter((r) => r.make === make).map((r) => r.group))].sort().forEach((g) => groupSel.add(new Option(g, g)));
  groupSel.disabled = !make;
  fillChassis(make, "");
}
function fillChassis(make, group) {
  modelSel.innerHTML = '<option value="">전체</option>';
  const codes = new Map();
  rowsFor({ make, group }).forEach((r) => r.chassis.forEach((c) => { if (!codes.has(c)) codes.set(c, r.body.replace(/\s*\([^)]*\)\s*$/, "")); }));
  [...codes.entries()].sort((a, b) => a[0].localeCompare(b[0])).forEach(([c, b]) => modelSel.add(new Option(`${c} · ${b}`, c)));
  modelSel.disabled = !make;
}
makeSel.onchange = () => { ctx = null; $("#vinResult").hidden = true; fillGroups(makeSel.value); renderResults(); };
groupSel.onchange = () => { ctx = null; fillChassis(makeSel.value, groupSel.value); renderResults(); };
modelSel.onchange = () => { ctx = null; renderResults(); };
axleSel.onchange = renderResults;

// 선택한 브랜드의 세트 가격 표시
const priceHtml = (p, brand) => `${won(brandPrice(p, brand) * SET_SIZE)} <small>/ 2장 1세트 · ${esc(brand)} · ${esc(PRICE_NOTE)}</small><div class="muted small" style="font-weight:500">1장 ${won(brandPrice(p, brand))}</div>`;
// 카드별 선택값(브랜드·가공 타입) 기억 — 장바구니 담은 뒤 다시 그려도 유지
const cardSel = {};
document.addEventListener("change", (e) => {
  const cs = e.target.closest("select[data-chaos-for]");
  if (cs) { (cardSel[cs.dataset.chaosFor] ||= {}).chaos = cs.value; return; }
  const r = e.target.closest("input[data-brand-for]");
  if (!r) return;
  (cardSel[r.dataset.brandFor] ||= {}).brand = r.value;
  const card = r.closest(".card"); const p = productByPn(r.dataset.brandFor);
  card.querySelectorAll(".brand-pick label").forEach((l) => l.classList.toggle("on", l.contains(r)));
  card.querySelector(`[data-price-for="${CSS.escape(p.pn)}"]`).innerHTML = priceHtml(p, r.value);
});

function productCard({ p, rows }, highlight) {
  const selBrand = cardSel[p.pn]?.brand || BRANDS[0].code;
  const selChaos = cardSel[p.pn]?.chaos || "";
  const inCart = Object.entries(cart).filter(([k]) => k.split("|")[0] === p.pn).reduce((s, [, q]) => s + q, 0);
  // 카오스 가공 함께 의뢰: 타입(사선/A/B) 선택. 가공비가 설정된 타입은 금액, 아니면 "별도 견적"
  const optHtml = p.price
    ? `<div class="chaos-opt"><label>카오스 가공 함께 의뢰
        <select data-chaos-for="${esc(p.pn)}"><option value="">가공 없음</option>${CHAOS_TYPES.map((t) => { const o = chaosOption(p, t.code); return `<option value="${t.code}" ${t.code === selChaos ? "selected" : ""}>${esc(t.name)} (${o.price ? `+${won(o.price * SET_SIZE)}/세트` : "가공비 별도 견적"})</option>`; }).join("")}</select></label>
        <a href="technology.html#chaos-types">타입 보기</a></div>`
    : "";
  const list = rows.slice(0, 80).map((r) => `<li>${esc(r.body)} ${esc(r.engine)}${r.codes.length ? ` (${esc(r.codes.join(", "))})` : ""} · ${esc(years(r))}</li>`).join("");
  return `<div class="card">
    <figure class="thumb">${discSvg(p)}<figcaption>규격 도면(예시) · 실제 제품 형상과 다를 수 있습니다</figcaption></figure>
    <div><span class="brand">OEM ${esc(p.pn)}</span></div>
    <h4>브레이크 디스크 ${axleKo(p.axle)} (2장 1세트)</h4>
    <div><span class="tag">${axleKo(p.axle)}</span><span class="tag gray">브레이크 사양 확인 필요</span></div>
    ${highlight ? `<div class="match">${esc(highlight)}</div>` : ""}
    <div class="spec">외경 ${esc(p.dia)}mm × 두께 ${esc(p.thk)}mm${p.min ? ` · 최소 ${esc(p.min)}mm` : ""}</div>
    <div class="meta">판매 브랜드: COLUMN · BREMBO</div>
    <details><summary>적용 차량 ${rows.length}건 보기</summary><ul>${list}</ul>${rows.length > 80 ? "<p>…외 " + (rows.length - 80) + "건</p>" : ""}</details>
    ${p.price ? `<div class="brand-pick" role="radiogroup" aria-label="브랜드 선택">${BRANDS.map((b) => `<label class="${b.code === selBrand ? "on" : ""}"><input type="radio" name="brand-${esc(p.pn)}" value="${b.code}" ${b.code === selBrand ? "checked" : ""} data-brand-for="${esc(p.pn)}" /><b>${b.code}</b><span>${won(brandPrice(p, b.code) * SET_SIZE)}</span></label>`).join("")}</div>` : ""}
    <div class="price" data-price-for="${esc(p.pn)}">${p.price ? priceHtml(p, selBrand) : "가격 문의"}</div>
    ${optHtml}
    ${p.price ? `<button data-add="${esc(p.pn)}">${inCart ? `장바구니에 ${inCart}세트` : "장바구니 담기"}</button>`
      : `<button data-inquiry="[가격 문의] 브레이크 디스크 ${axleKo(p.axle)} OEM ${esc(p.pn)}">가격 문의하기</button>`}
  </div>`;
}

function renderResults() {
  const box = $("#results");
  let items, highlight = "";
  if (ctx) { items = groupByProduct(ctx.rows, axleSel.value); highlight = ctx.highlight || ""; }
  else if (makeSel.value) items = groupByProduct(rowsFor({ make: makeSel.value, group: groupSel.value, code: modelSel.value }), axleSel.value);
  else { box.innerHTML = ""; return; }
  box.innerHTML = items.length ? items.map((it) => productCard(it, highlight)).join("")
    : '<div class="empty">등록된 디스크가 없습니다. 아래 문의창에 남겨 주시면 해외 조달 가능 여부를 확인해 드립니다.<br /><button type="button" class="btn btn-primary" data-find-help style="margin-top:12px">문의 남기기</button></div>';
}

// "찾으시는 제품이 없나요?" → 지금 검색한 내용을 담아 아래 문의창으로
function searchContextText() {
  const pick = (sel) => (sel && sel.value ? sel.options[sel.selectedIndex].text : "");
  const car = [pick(makeSel), pick(groupSel), pick(modelSel), pick(axleSel)].filter(Boolean).join(" ");
  const q = ($("#vinInput").value || "").trim();
  return [car && `차량: ${car}`, q && `검색어: ${q}`].filter(Boolean).join("\n");
}
document.addEventListener("click", (e) => {
  const b = e.target.closest && e.target.closest("[data-find-help]"); if (!b) return;
  const ctxText = searchContextText();
  prefillInquiry(`[제품 문의] 찾는 브레이크 디스크가 검색되지 않습니다.\n${ctxText ? ctxText + "\n" : ""}연식·엔진, 기존 디스크 품번이나 외경을 알면 함께 적어 주십시오.`);
  setTimeout(() => $("#inquiryForm").name.focus({ preventScroll: true }), 400);
});

function showSearch(input) {
  const box = $("#vinResult");
  box.hidden = false; box.className = "vin-result";
  const q = input.trim();
  const p = findPn(q);
  if (p) {
    ctx = { rows: p.rows, highlight: `품번 ${p.pn} 검색 결과` };
    box.innerHTML = `<b>OEM 품번 ${esc(p.pn)}</b> — ${axleKo(p.axle)} 디스크, 적용 차량 ${p.rows.length}건`;
    makeSel.value = ""; fillGroups(""); renderResults(); return;
  }
  const r = decodeVin(q);
  if (!r.ok) { ctx = null; box.className = "vin-result err"; box.innerHTML = esc(norm(q).length === 17 ? r.error : `등록된 품번이 아니거나 차대번호 형식이 아닙니다. ${r.error}`); renderResults(); return; }
  sessionStorage.setItem("lastVin", r.vin);
  $("#inquiryForm").vin.value = r.vin;
  const m = matchVin(r);
  let html = `<b>차대번호 ${esc(r.vin)}</b><dl><dt>제조사</dt><dd>${r.make ? esc(makeKo(r.make)) : "자동 식별 불가 — 직접 선택해 주십시오"}</dd>`;
  if (m.level === "exact") {
    const bodies = [...new Set(m.rows.map((x) => `${x.body} ${x.engine}`))];
    html += `<dt>모델코드</dt><dd>${esc(m.key)} <span class="match">· 등록 데이터와 일치</span></dd><dt>차량</dt><dd>${esc(bodies.slice(0, 3).join(" / "))}</dd></dl>`;
    ctx = { rows: m.rows, highlight: `모델코드 ${m.key} 적용 확인` };
  } else if (m.level === "platform") {
    html += `<dt>플랫폼 코드</dt><dd>${esc(m.key)} (추정)</dd></dl><p class="muted small" style="margin:8px 0 0">같은 플랫폼에도 엔진·브레이크 사양별로 디스크가 다릅니다. 아래 외경을 기존 디스크와 비교하시거나 담당자 확인을 요청해 주십시오.</p>`;
    ctx = { rows: m.rows, highlight: `플랫폼 ${m.key} 기준 후보` };
  } else {
    html += `</dl><p class="muted small" style="margin:8px 0 0">${m.key ? `이 차량(코드 ${esc(m.key)})에 맞는 디스크는 아직 등록 전입니다. ` : ""}${r.make ? "아래에서 모델·세대를 골라 주십시오." : ""} 담당자 확인도 가능합니다.</p>`;
    ctx = null;
  }
  box.innerHTML = html;
  if (r.make && MAKES.includes(r.make)) { makeSel.value = r.make; fillGroups(r.make); }
  renderResults();
}

$("#vinForm").onsubmit = (e) => {
  e.preventDefault();
  showSearch($("#vinInput").value);
  $("#search").scrollIntoView({ behavior: "smooth" });
};

// ---------------- 장바구니 ----------------
// 장바구니 키: "품번|브랜드|가공코드" (가공 없으면 마지막 칸 비움)
let cart = store.get("cart4", {});
function productByPn(pn) { return PRODUCTS.find((p) => p.pn === pn); }
function parseKey(key) {
  const [pn, brand, oc] = key.split("|");
  const p = productByPn(pn);
  const o = oc ? chaosOption(p, oc) : null;
  if (!p || !p.price || (oc && !o) || !BRANDS.some((b) => b.code === brand)) return null;
  return { p, brand, o, unit: (brandPrice(p, brand) + (o && o.price ? o.price : 0)) * SET_SIZE }; // 1세트(2장) 가격, 가공비 미정이면 디스크 값만
}
const optLabel = (o) => (o.price ? `${o.name} (+${won(o.price * SET_SIZE)}/세트)` : `${o.name} (가공비 별도 견적)`);
function addToCart(pn, brand = BRANDS[0].code, optCode = "") {
  const key = `${pn}|${brand}|${optCode}`;
  if (!parseKey(key)) return;
  cart[key] = (cart[key] || 0) + 1; saveCart();
}
function saveCart() { store.set("cart4", cart); renderCart(); renderResults(); }
function cartLines() { return Object.entries(cart).map(([k, q]) => ({ k, q, ...parseKey(k) })).filter((x) => x.q > 0 && x.p); }
function renderCart() {
  const lines = cartLines();
  $("#cartCount").textContent = lines.reduce((s, x) => s + x.q, 0);
  let total = 0, quote = false;
  const chaosLines = lines.filter((x) => x.o);
  $("#cartItems").innerHTML = lines.length ? lines.map(({ k, q, p, brand, o, unit }) => {
    total += unit * q; if (o && !o.price) quote = true;
    return `<div class="cart-row"><div>디스크 ${axleKo(p.axle)} · <b>${esc(brand)}</b> · OEM ${esc(p.pn)}${o ? `<br><small class="chaos-line">+ ${esc(optLabel(o))}</small>` : ""}<div class="muted small">${won(unit)} / 세트(2장)</div></div>
      <div class="qty"><button data-dec="${esc(k)}">−</button>${q}<button data-inc="${esc(k)}">+</button></div></div>`;
  }).join("") + (chaosLines.length ? `<div class="cart-chaos"><b>카오스 가공 ${chaosLines.length}건</b><span>가공 상담에서 사용 환경·요청 사항을 남기면 의뢰서가 만들어져 더 빠르게 검토됩니다.</span>
      <a class="btn btn-primary" href="consult.html?pn=${encodeURIComponent(chaosLines[0].p.pn)}&sets=${chaosLines[0].q}&type=${encodeURIComponent(chaosLines[0].o.code)}&brand=${encodeURIComponent(chaosLines[0].brand)}">가공 의뢰서 작성</a></div>` : "")
    : '<p class="muted">담은 상품이 없습니다.</p>';
  $("#cartTotal").textContent = won(total) + (quote ? " + 가공비 별도" : "") + (PRICE_NOTE ? ` (${PRICE_NOTE})` : "");
}

// ---------------- 문의 ----------------
function prefillInquiry(text) {
  const f = $("#inquiryForm");
  f.message.value = text;
  if (!f.vin.value && sessionStorage.getItem("lastVin")) f.vin.value = sessionStorage.getItem("lastVin");
  $("#inquiryDone").hidden = true;
  $("#inquiry").scrollIntoView({ behavior: "smooth" });
}
// 로그인 회원이면 문의 폼의 성함·연락처 자동 입력
function fillMemberContact() {
  const me = window.CaribAuth && CaribAuth.current(); if (!me) return;
  const f = $("#inquiryForm");
  if (!f.name.value) f.name.value = me.company ? `${me.name} / ${me.company}` : me.name;
  if (!f.phone.value) f.phone.value = me.phone;
}
fillMemberContact();
$("#inquiryForm").onsubmit = (e) => {
  e.preventDefault();
  const f = e.target;
  // 실제 운영: 서버 API(POST /api/inquiries)로 전송 → 관리자 화면에서 확인
  const list = store.get("inquiries", []);
  const me = window.CaribAuth && CaribAuth.current();
  list.push({ name: f.name.value, phone: f.phone.value, vin: f.vin.value, message: f.message.value, at: new Date().toISOString(), memberId: me ? me.id : "" });
  store.set("inquiries", list);
  f.reset();
  fillMemberContact();
  $("#inquiryDone").hidden = false;
};
// 주문하기 → 주문서 작성 페이지
$("#cartCheckout").onclick = () => {
  if (!cartLines().length) { $("#cartItems").insertAdjacentHTML("afterbegin", '<p class="field-err">장바구니에 담긴 상품이 없습니다.</p>'); return; }
  SiteNav.go("checkout.html");
};
// "부품 검색"(#top)으로 오면 맨 위 검색창으로 — PC에서는 입력칸에 바로 커서(모바일은 키보드가 뜨지 않게 생략)
function goSearchTop() {
  if ((location.hash || SiteNav.hash()) !== "#top") return;
  window.scrollTo({ top: 0, behavior: "auto" });
  if (window.matchMedia && matchMedia("(pointer: fine)").matches) $("#vinInput").focus({ preventScroll: true });
}
window.addEventListener("hashchange", goSearchTop);
document.addEventListener("click", (e) => { const a = e.target.closest && e.target.closest('a[href="#top"]'); if (a && (location.hash || SiteNav.hash()) === "#top") { e.preventDefault(); goSearchTop(); } });
setTimeout(goSearchTop, 0);
// 주문서에서 "장바구니에서 수량 변경"으로 돌아온 경우 장바구니 열기
if (SiteNav.params().get("cart") === "1") setTimeout(() => $("#cartDrawer").classList.add("open"), 0);
$("#cartOrder").onclick = () => {
  const lines = cartLines().map(({ q, p, brand, o, unit }) => `- 브레이크 디스크 ${axleKo(p.axle)} ${brand} OEM ${p.pn}${o ? ` + ${optLabel(o)}` : ""} x ${q}세트(${q * SET_SIZE}장) (${won(unit * q)}${o && !o.price ? " + 가공비 별도" : ""})`);
  if (!lines.length) return;
  closeAll();
  prefillInquiry("[주문 문의]\n" + lines.join("\n") + "\n\n차대번호로 적용 확인 후 연락 부탁드립니다.");
};

// ---------------- 공통 클릭 ----------------
document.addEventListener("click", (e) => {
  const t = e.target.closest("button, a");
  if (!t) return;
  if (t.dataset.add) {
    const sel = t.closest(".card")?.querySelector(`select[data-chaos-for="${CSS.escape(t.dataset.add)}"]`);
    const br = t.closest(".card")?.querySelector(`input[data-brand-for="${CSS.escape(t.dataset.add)}"]:checked`);
    addToCart(t.dataset.add, br ? br.value : BRANDS[0].code, sel ? sel.value : "");
  }
  if (t.dataset.inc) { const [pn, br, oc] = t.dataset.inc.split("|"); addToCart(pn, br, oc); }
  if (t.dataset.dec) { cart[t.dataset.dec]--; if (cart[t.dataset.dec] <= 0) delete cart[t.dataset.dec]; saveCart(); }
  if (t.dataset.inquiry) { e.preventDefault(); prefillInquiry(t.dataset.inquiry); }
  if (t.dataset.close) $("#" + t.dataset.close).classList.remove("open");
});
function closeAll() { $("#cartDrawer").classList.remove("open"); $("#chat").classList.remove("open"); }
$("#cartBtn").onclick = () => { $("#chat").classList.remove("open"); $("#cartDrawer").classList.add("open"); };

// ============================================================
// AI 상담 (1차: 규칙 기반 — 등록 데이터 안에서만 답변)
// 2차: 같은 자리에 서버의 Claude API를 연결하고, Claude가 matchVin/findPn/rowsFor 같은
//      검색 도구만 호출해서 답하게 한다(품번을 지어내지 않도록).
// ============================================================
const chatState = { make: null, group: null, code: null };
const chatLog = $("#chatLog");
function say(html, who = "bot") {
  const d = document.createElement("div");
  d.className = "msg " + who;
  if (who === "me") d.textContent = html; else d.innerHTML = html;
  chatLog.appendChild(d);
  // 긴 답변(상품 목록 등)은 답변의 처음이 보이게, 짧은 답변은 맨 아래로
  if (who !== "me" && d.offsetHeight > chatLog.clientHeight * 0.8) chatLog.scrollTop += d.getBoundingClientRect().top - chatLog.getBoundingClientRect().top - 8;
  else chatLog.scrollTop = chatLog.scrollHeight;
  queueSaveChat();
}
const chips = (items) => `<div class="chips">${items.map(([label, val]) => `<button data-chat="${esc(val)}">${esc(label)}</button>`).join("")}</div>`;
const INQ = chips([["담당자 확인 요청", "#inquiry"]]);

function answerRows(rows, title, axle) {
  chatState.lastRows = rows; chatState.lastTitle = title;
  const items = groupByProduct(rows, axle);
  if (!items.length) return say(`${esc(title)}에 맞는 ${axle ? axleKo(axle) + " " : ""}디스크는 아직 등록 전입니다. 차대번호를 남겨 주시면 조달 가능 여부를 확인해 드립니다.` + INQ);
  let html = `<b>${esc(title)}</b>${axle ? ` ${axleKo(axle)}` : ""} 디스크 ${items.length}종이 등록되어 있습니다. 브랜드와 카오스 가공을 고르고 바로 담으실 수 있어요. (2장 1세트 · ${esc(PRICE_NOTE)})`;
  html += bothButton(items) + chatProdList(items);
  html += `<p class="small muted" style="margin:8px 0 0">※ 같은 차종이라도 브레이크 사양에 따라 외경이 다릅니다. 기존 디스크 외경과 비교하시거나 차대번호로 최종 확인받으십시오.</p>`;
  if (!axle) html += chips([["앞만 보기", "앞 디스크"], ["뒤만 보기", "뒤 디스크"]]);
  html += INQ;
  say(html);
}
function chassisChips(rows) {
  const codes = new Map();
  rows.forEach((r) => r.chassis.forEach((c) => { if (!codes.has(c)) codes.set(c, r.body.replace(/\s*\([^)]*\)\s*$/, "")); }));
  return chips([...codes.entries()].slice(0, 16).map(([c, b]) => [`${c} ${b}`, "#code:" + c]));
}
const carName = (make, group) => (String(group).toUpperCase().startsWith(String(makeKo(make)).toUpperCase()) ? group : `${makeKo(make)} ${group}`);
const detectAxle = (t) => (/(앞|전륜|전방|프론트|프런트|front|전디스크)/.test(t) ? "front" : /(뒤|뒷|후륜|후방|리어|rear|후디스크)/.test(t) ? "rear" : null);

// ---------------- 상담사 채팅 전환 ----------------
// 디스크 외 품목(패드·필터·센서 등)을 찾으면 AI가 답하지 않고 상담사 채팅으로 넘긴다
const NON_DISC = /(패드|필터|오일|미션|변속기|엔진|마운트|미미|센서|캘리퍼|점화|코일|플러그|서모스탯|워터\s*펌프|호스|벨트|텐셔너|쇼바|쇼크|댐퍼|부싱|로워\s*암|컨트롤\s*암|타이로드|등속|베어링|허브|와이퍼|배터리|라디에이터|콤프레셔|에어컨|램프|전구|헤드라이트|범퍼|휀다|펜더|타이어|머플러|촉매|인젝터|연료\s*펌프|스티어링|조향|브레이크\s*오일|다른\s*부품|기타\s*부품|디스크\s*(말고|외))/;
let chatMode = "ai";
let agentId = sessionStorage.getItem("agentChatId");
let agentSeen = 0;
const inHours = () => { const d = new Date(), h = d.getHours(); return d.getDay() !== 0 && h >= 9 && h < 18; }; // 월~토 09~18시
function setAgentHeader(on) {
  $("#chat .chat-head div").innerHTML = on
    ? '<b>상담사 채팅</b><span class="muted small">카리브무역 상담사가 직접 답변합니다 · 월~토 오전 9시~오후 6시</span>'
    : '<b>AI 상담</b><span class="muted small">부품 찾기부터 궁금한 점까지 답변합니다</span>';
  $("#chatText").placeholder = on ? "상담사에게 보낼 메시지를 입력하십시오" : "예: 벤츠 W213 뒤 디스크 / 차대번호 / 품번";
  $("#chat").classList.toggle("agent-mode", on);
}
const CONTACT_FORM = `<form class="agent-contact"><input name="name" placeholder="성함 / 업체명" /><input name="phone" placeholder="연락처 (부재 시 전화 안내)" /><textarea name="items" rows="2" maxlength="500" placeholder="필요한 품목 (예: 벤츠 E200 앞 브레이크 패드 1세트, 오일필터)"></textarea><button type="submit">연락처 남기기</button></form>`;
function startAgent(firstText) {
  const now = new Date().toISOString();
  const list = agentChats();
  let c = agentId && list.find((x) => x.id === agentId && x.status !== "종료");
  if (!c) {
    c = { id: "CH-" + Date.now().toString(36).toUpperCase(), createdAt: now, status: "대기", topic: "", vin: sessionStorage.getItem("lastVin") || "", contact: { name: "", phone: "" }, messages: [] };
    list.unshift(c); agentId = c.id; sessionStorage.setItem("agentChatId", agentId);
  }
  const car = [chatState.make && makeKo(chatState.make), chatState.group, chatState.code].filter(Boolean).join(" ");
  c.messages.push({ who: "system", text: `AI 상담에서 상담사 채팅으로 전환${car ? ` · 대화 중 차량: ${car}` : ""}${c.vin ? ` · 차대번호 ${c.vin}` : ""}`, at: now });
  if (!firstText.startsWith("#")) { c.messages.push({ who: "customer", text: firstText, at: now }); if (!c.topic) c.topic = firstText; }
  c.updatedAt = now; saveAgentChats(list);
  agentSeen = c.messages.filter((m) => m.who === "agent").length;
  chatMode = "agent"; setAgentHeader(true);
  say(`디스크 외 부품은 <b>상담사가 직접</b> 안내해 드려요. 상담사 채팅으로 연결했습니다.\n${inHours() ? "영업시간이라 곧 답변드릴게요." : "지금은 영업시간(월~토 오전 9시~오후 6시) 외라 순차적으로 답변드립니다."}\n필요한 부품과 차대번호(또는 차종)를 함께 남겨 주시면 더 빨리 확인할 수 있어요.` + CONTACT_FORM + chips([["AI 상담으로 돌아가기", "#ai"]]));
}
function postToAgent(text) {
  const c = updateAgentChat(agentId, (c) => { c.messages.push({ who: "customer", text, at: new Date().toISOString() }); if (!c.topic) c.topic = text; });
  if (!c) { chatMode = "ai"; setAgentHeader(false); say("상담이 종료되었어요. 새로 상담이 필요하시면 다시 말씀해 주십시오." + chips([["상담사와 다시 채팅", "#agent"]])); }
}
function pollAgent() {
  if (!agentId) return;
  const c = agentChats().find((x) => x.id === agentId);
  if (!c) return;
  const replies = c.messages.filter((m) => m.who === "agent");
  for (const m of replies.slice(agentSeen)) say(esc(m.text), "agent");
  agentSeen = replies.length;
  if (c.status === "종료" && chatMode === "agent") {
    chatMode = "ai"; setAgentHeader(false); agentId = null; sessionStorage.removeItem("agentChatId");
    say("상담사가 상담을 종료했어요. 이용해 주셔서 감사합니다. 이어서 디스크 상담이 필요하시면 AI 상담을 이용해 주십시오.");
  }
}
setInterval(pollAgent, 1500);
window.addEventListener("storage", (e) => { if (e.key === AGENT_KEY) pollAgent(); });

// ---------------- 자주 묻는 질문 (2026-11-13 시뮬레이션 결과로 보강) ----------------
// 차종·품번·차대번호가 아닌 일반 질문에 답합니다. 일치하는 답이 없으면 null.
const TEL = "010-5459-3111";
const ASK_CHIPS = chips([["벤츠 W213 앞 디스크", "벤츠 W213 앞 디스크"], ["BMW 5시리즈", "BMW 5시리즈"], ["카오스 가공 관련", "#rqlist"], ["상담사와 채팅", "#agent"]]);
const DOMESTIC = /(그랜저|쏘나타|소나타|아반떼|k3|k5|k7|k8|k9|싼타페|투싼|쏘렌토|스포티지|카니발|팰리세이드|모하비|제네시스|gv70|gv80|코나|셀토스|모닝|스타리아|포터|봉고|qm6|sm6|토레스|렉스턴|티볼리|트레일블레이저|말리부|스파크|아이오닉|ev6|ev9)/;
const UNLISTED = [
  [/(테슬라|tesla|모델\s?[3ysx]\b|model\s?[3ysx]\b)/, "테슬라"],
  [/(카이엔|cayenne)/, "포르쉐 카이엔"], [/(파나메라|panamera)/, "포르쉐 파나메라"], [/(타이칸|taycan)/, "포르쉐 타이칸"], [/(911|카레라|carrera)/, "포르쉐 911"],
  [/(벤틀리|롤스로이스|페라리|람보르기니|맥라렌|애스턴)/, null],
];
function chaosPriceTable() {
  const types = [["사선 타입", "CHAOS-D"], ["A 타입", "CHAOS-A"], ["B 타입", "CHAOS-B"]];
  const head = ["외경 300mm 이하", "301~330mm", "331~350mm", "351mm 이상"];
  const rows = types.map(([name, pre]) => {
    const ps = OPTIONS.filter((o) => o.code.startsWith(pre)).sort((a, b) => a.min - b.min).map((o) => won(o.price * SET_SIZE));
    return `<b>${name}</b> ${ps.join(" / ")}`;
  });
  return `카오스 가공비는 디스크 외경과 타입에 따라 달라요. <b>2장 1세트 기준</b>(${esc(PRICE_NOTE)})입니다.\n<span class="small muted">${head.join(" / ")}</span>\n${rows.join("\n")}\n디스크를 찾은 뒤 상품 카드의 '카오스 가공 함께 의뢰'에서 타입을 고르면 가공비가 자동으로 더해져요. 최종 금액은 담당자 확인 후 확정됩니다.`;
}
function faqReply(t, text) {
  const tt = t.replace(/\s+/g, " ").trim();
  const named = (text.toUpperCase().match(/\b[A-Z]{1,2}\d{2,3}[A-Z]?\b/g) || []).find((c) => CHASSIS.has(c));
  const carChip = named ? chips([[`${named} 디스크 보기`, named]]) : "";
  // 인사 · 감사 · 정체
  if (/^(안녕|안녕하세요|안녕하십니까|하이|hi|hello|헬로|반갑)/.test(tt)) return "안녕하세요, 카리브무역 AI 상담입니다.\n차대번호 17자리, OEM 품번, 차종 중 아시는 것을 알려 주시면 맞는 브레이크 디스크를 찾아 드릴게요.\n배송, 결제, 카오스 가공 등 궁금한 점도 편하게 물어보십시오." + ASK_CHIPS;
  if (/(감사|고마|고맙|땡큐|thank)/.test(tt)) return "도움이 됐다니 다행이에요. 더 궁금한 점이 생기면 언제든 물어봐 주십시오.";
  if (/(누구(세요|야|신가요)|사람(이에요|인가요|이야|이세요)|챗봇|로봇|ai(야|에요|예요|인가요))/.test(tt)) return "저는 카리브무역의 AI 상담원이에요. 디스크 찾기는 물론 배송, 결제, 카오스 가공 같은 궁금한 점도 바로 답변드리고, 사람 상담이 필요하면 상담사에게 연결해 드려요." + chips([["상담사와 채팅", "#agent"]]);
  if (/(상담원|상담사|사람|직원|담당자).*(얘기|이야기|연결|통화|대화|상담|바꿔)/.test(tt)) return `상담사와 바로 채팅하시거나, 전화(${TEL}, 월~토 09:00~18:00)로 문의하실 수 있어요.` + chips([["상담사와 채팅", "#agent"], ["담당자 확인 요청", "#inquiry"]]);
  // 회사 · 연락
  if (/(영업\s?시간|운영\s?시간|몇\s?시(까지|부터)|주말|토요일|일요일|공휴일|점심)/.test(tt)) return "상담과 출고는 <b>월요일~토요일 오전 9시~오후 6시</b>에 해요. 일요일은 쉽니다.\n그 외 시간에 남기신 문의는 다음 영업일에 순서대로 답변드립니다.";
  if (/(전화|연락처|번호\s?(좀|알려)|통화|이메일|메일)/.test(tt)) return `전화 <b>${TEL}</b> (월~토 09:00~18:00)\n이메일 caribetrading@naver.com\n전화가 어려우시면 아래 문의칸에 남겨 주십시오.` + chips([["문의 남기기", "#inquiry"]]);
  if (/(주소|어디에\s?있|어디예요|어디에요|찾아가|방문|매장|픽업|직접\s?(가|받))/.test(tt)) return "주소는 <b>울산광역시 북구 진장로 16</b>이에요.\n방문하실 때는 미리 전화(" + TEL + ") 주시면 재고와 시간을 확인해 드릴게요.";
  // 주문 · 배송 · 결제
  if (/(어디쯤|배송\s?(조회|상태|추적)|주문\s?(조회|내역|확인|상태)|송장)/.test(tt)) return "주문 진행 상황은 <a href=\"mypage.html\">마이페이지</a>에서 확인하실 수 있어요.\n주문 접수 → 적용 확인 → 입금 확인 → 출고 준비 → 배송 중 → 배송 완료 순서로 바뀝니다. 비회원 주문은 전화(" + TEL + ")로 문의해 주십시오.";
  if (/취소/.test(tt)) return "출고 전이라면 <a href=\"mypage.html\">마이페이지</a> 주문 내역에서 '주문 취소 요청'을 누르시거나 전화(" + TEL + ")로 말씀해 주십시오. 이미 출고됐다면 담당자가 반품 방법을 안내드려요.";
  if (/(반품|환불|교환(?!\s?(주기|시기|시점|타이밍|기준)))/.test(tt)) return "받으신 상품에 문제가 있거나 차량에 맞지 않으면 먼저 담당자에게 연락 주십시오. 상품 상태와 장착·가공 여부를 확인한 뒤 교환이나 반품 방법을 안내드려요.\n이런 일을 줄이려고 주문하시면 출고 전에 차대번호로 적용 여부를 한 번 더 확인합니다." + chips([["담당자 확인 요청", "#inquiry"], ["상담사와 채팅", "#agent"]]);
  if (/(제주|도서\s?산간|산간)/.test(tt)) return "제주와 도서산간 지역도 배송해 드려요. 추가 비용이나 일정 차이가 있으면 주문 확인 때 미리 안내드릴게요.";
  if (/(배송비|택배비|무료\s?배송)/.test(tt)) return "배송비는 <b>무료</b>예요.\n국내 재고 상품은 차량 적용 확인 후 출고하고, 해외에서 들여오는 상품은 일정을 따로 안내드려요.";
  if (/(배송|택배|언제\s?(와|와요|받|도착|오)|도착|며칠|출고)/.test(tt)) return "주문하시면 담당자가 차량 적용 여부를 먼저 확인한 뒤 출고해요. 국내 재고 상품은 확인되는 대로 순서대로 보내 드리고, 해외 조달 상품은 예상 일정을 따로 안내드려요.\n정확한 출고일은 주문 확인 연락 때 알려 드립니다.";
  if (/(세금\s?계산서|현금\s?영수증|영수증|지출\s?증빙)/.test(tt)) return "세금계산서나 현금영수증이 필요하시면 주문 후 담당자에게 사업자 정보(또는 휴대폰 번호)를 알려 주십시오. 확인 후 발행해 드려요.";
  if (/(결제|카드|계좌|무통장|입금|페이|할부)/.test(tt)) return "지금은 <b>무통장 입금</b>으로 결제해요. 주문 후 차량 적용을 확인하면 입금 계좌를 문자로 보내 드립니다.\n신용카드와 간편결제(네이버페이·카카오페이)는 준비 중이에요.";
  if (/(장착|설치|공임|달아\s?주|교체\s?(작업|해\s?주|해줘|가능))/.test(tt)) return "카리브무역은 부품 공급과 카오스 가공을 맡고 있고, 장착은 가까운 정비업체에서 하시면 돼요.\n이용하시는 정비업체로 바로 보내 드릴 수도 있으니 주문하실 때 배송지를 정비업체로 적어 주십시오.";
  if (/(할인|쿠폰|이벤트|도매|거래처|대량|공급가|정비소|카센터|업체\s?가)|(업체|사업자|공업사).*(거래|가능|단가)|거래\s?(가능|하고|문의|트)/.test(tt)) return "정비업체·카센터 같은 거래처는 별도 공급가로 거래하고 있어요. 업체명과 연락처를 남겨 주시면 담당자가 조건을 안내드립니다." + chips([["거래 문의 남기기", "#inquiry"]]);
  // 상품
  if (/(column|컬럼|brembo|브렘보|브랜드)/.test(tt)) { const add = brandOf("BREMBO").add; return `판매 브랜드는 <b>COLUMN</b>과 <b>BREMBO</b> 두 가지예요. 둘 다 순정 품번 규격에 맞춘 디스크입니다.\nBREMBO는 이탈리아의 브레이크 전문 브랜드로, COLUMN보다 1장에 ${won(add)}(세트 ${won(add * SET_SIZE)}) 더 비싸요. 상품 카드에서 원하시는 브랜드를 골라 담으시면 됩니다.`; }
  if (/(정품|순정|오리지널|가품|짝퉁)/.test(tt)) return "사이트에서 판매하는 COLUMN·BREMBO 디스크는 순정(OEM) 품번 규격에 맞춘 제품이에요.\n자동차 제조사 로고가 찍힌 순정 디스크가 필요하시면 상담사가 재고와 가격을 확인해 드릴게요." + chips([["순정품 문의", "#agent"]]);
  if (/(한\s?장|1\s?장|낱개|하나만|한쪽만|한\s?개만|한\s?짝|1\s?개만)/.test(tt)) return "브레이크 디스크는 좌우 제동력이 같아야 해서 <b>같은 축(앞 또는 뒤) 2장을 한 세트</b>로 판매해요. 표시된 가격도 2장 1세트 기준입니다.";
  if (/재고/.test(tt)) return "재고는 품목마다 달라요. 원하시는 디스크를 담아 주문하시거나 문의를 남겨 주시면 국내 재고를 확인하고, 없으면 해외 조달 일정까지 안내드려요.";
  if (/(앞|뒤).*(같이|함께|둘\s?다|동시에?).*(사야|바꿔야|바꾸나|교체해야|갈아야|해야)/.test(tt)) return "앞과 뒤 디스크는 닳는 속도가 달라서 <b>꼭 함께 바꾸실 필요는 없어요</b>.\n다만 같은 축의 좌우 2장은 반드시 함께 바꾸시고, 다른 쪽은 최소 두께와 표면 상태를 보고 정하시면 됩니다. 정비업체 점검 때 함께 확인해 보십시오.";
  if (/두께.*(남|갈|교체|바꿔|한계)/.test(tt)) return "디스크 옆면에 새겨진 <b>최소 두께(MIN TH)</b>보다 얇아지면 교체하셔야 해요. 예를 들어 'MIN TH 22.4'라면 22.4mm가 한계예요.\n최소 두께에 가깝지 않더라도 떨림이 있거나 깊은 홈·균열이 보이면 바꾸시는 게 좋습니다. 상품 카드의 '최소 ○○mm'가 그 값이에요.";
  if (/((교체|교환)\s?(주기|시기|언제|해야)|언제\s?(바꿔|갈아)|갈아야|바꿔야|얼마나\s?(타|쓰)|수명|몇\s?(km|키로|킬로))/.test(tt)) return "운전 습관과 차종에 따라 달라서 정해진 주기는 없어요.\n디스크가 <b>최소 두께</b>보다 얇아졌거나, 제동할 때 떨림이 있거나, 표면에 깊은 홈이나 균열이 보이면 교체할 때예요. 보통 패드를 두 번 갈 때 디스크를 한 번 함께 바꾸는 경우가 많습니다.";
  if (/(최소\s?두께|마모\s?한계|min\s?th|minimum)/.test(tt)) return "최소 두께는 디스크가 닳아도 안전하게 쓸 수 있는 <b>한계 두께</b>예요. 디스크 옆면에 'MIN TH 22.4'처럼 새겨져 있고, 이보다 얇아지면 교체해야 합니다.\n상품 카드의 '최소 ○○mm'가 그 값이에요.";
  if (/(연마|재생|면\s?가공|평탄)/.test(tt)) return "디스크 연마(면 가공)는 최소 두께까지 여유가 있을 때만 할 수 있어요. 여유가 적거나 떨림이 다시 생기면 새 디스크로 바꾸시길 권해 드려요.\n연마 의뢰가 가능한지는 상담사가 확인해 드릴게요." + chips([["상담사와 채팅", "#agent"]]);
  if (/(회원|가입|로그인)/.test(tt)) return "회원가입 없이도 검색, 주문, 상담을 모두 이용하실 수 있어요.\n가입하시면 연락처가 자동으로 채워지고 <a href=\"mypage.html\">마이페이지</a>에서 주문과 의뢰 진행 상황을 볼 수 있습니다. <a href=\"signup.html\">회원가입</a>";
  // 증상
  if (/(떨림|떨려|떨리|진동|저더|핸들)/.test(tt)) return "브레이크를 밟을 때 핸들이나 페달이 떨리면 <b>디스크 두께가 고르지 않거나 휘어 있는 경우</b>가 많아요. 정확한 원인은 정비업체 점검으로 확인하시고, 디스크 교체가 필요하면 차종이나 차대번호를 알려 주십시오. 맞는 디스크를 찾아 드릴게요." + carChip;
  if (/(소음|소리|끽|삐|갈리|긁)/.test(tt)) return "'끽' 하는 소리는 패드가 거의 닳아 <b>마모 경고음</b>이 날 때나, 패드와 디스크 사이에 이물질이 끼었을 때 흔히 나요. 쇠가 갈리는 소리라면 패드가 다 닳아 디스크를 긁고 있을 수 있으니 빨리 점검받으십시오.\n교체가 필요하면 차종이나 차대번호를 알려 주십시오." + carChip;
  // 국산차 · 미등록 차종
  const dom = tt.match(DOMESTIC);
  if (dom) return `카리브무역은 <b>수입차 전문</b>이라 ${esc(dom[0])} 같은 국산차 디스크는 사이트에 등록돼 있지 않아요. 필요하시면 상담사가 구할 수 있는지 확인해 드릴게요.` + chips([["상담사와 채팅", "#agent"]]);
  const un = UNLISTED.find(([re]) => re.test(tt));
  if (un) return `${un[1] ? esc(un[1]) + " " : "해당 차종 "}디스크는 아직 사이트에 등록 전이에요. 차대번호를 남겨 주시면 조달 가능 여부를 확인해 드릴게요.` + INQ;
  return null;
}

function botReply(text) {
  const t = normalizeQuery(text.toLowerCase());
  if (chatPlusRoute(text, t)) return;
  const axle = detectAxle(t);

  // 홈 가공 성능 질문(예: "가공하면 패드 마모 심해지나요?")은 상담사 연결보다 먼저 연구자료로 답변
  const rqEarly = !text.startsWith("#") && window.ResearchQA && ResearchQA.match(t);
  if (rqEarly === "improve") { const a = ResearchQA.answer(rqEarly, t); if (a) return askGemini(text, t, { fallback: a.html + chips(a.actions), chips: RQ_CHIPS }); }
  if (/패드/.test(t) && /(같이|함께|교체|갈아|바꿔|바꾸)/.test(t) && !/(있|팔|구매|주문|가격|얼마)/.test(t))
    return aiOr(text, t, "네, 디스크를 바꿀 때는 <b>패드도 함께 바꾸시길</b> 권해 드려요. 쓰던 패드는 이전 디스크 모양대로 닳아 있어서 새 디스크와 잘 맞지 않고, 소음이나 떨림이 생길 수 있어요.\n패드는 상담사가 차종에 맞춰 찾아 드릴게요." + chips([["패드 문의 (상담사)", "#agent"]]));
  if (text === "#agent" || NON_DISC.test(t)) return startAgent(text);

  if (text === "#inquiry") {
    closeAll();
    const what = chatState.code ? `${makeKo(chatState.make)} ${chatState.code}` : chatState.group ? `${makeKo(chatState.make)} ${chatState.group}` : "";
    prefillInquiry(`[AI 상담에서 연결] ${what} 브레이크 디스크 적용 확인 요청`);
    return;
  }
  if (text.startsWith("#code:")) {
    const code = text.slice(6); const rows = CHASSIS.get(code) || [];
    chatState.code = code; chatState.make = rows[0]?.make || chatState.make;
    return answerRows(rows, `${makeKo(chatState.make)} ${code}`, chatState.pendingAxle || null);
  }

  // 0) 카오스 가공 연구자료 질문 (research-qa.js — 등록된 논문·시험 데이터만 근거)
  if (text === "#rqlist") return say("궁금한 질문을 골라 주십시오. 등록된 논문·시험 자료만 근거로 답변드립니다." + chips(ResearchQA.QUESTIONS.map((q) => [q.q, "#rq:" + q.id])));
  if (text === "#lab") { SiteNav.go("technology.html#chaos-types"); return; }
  if (text === "#tech") { SiteNav.go("technology.html#chaos-types"); return; }
  if (text.startsWith("#rq:")) { const a = ResearchQA.answer(text.slice(4), t); if (a) return say(a.html + chips(a.actions)); }
  const rqId = window.ResearchQA && ResearchQA.match(t);
  if (rqId) { const a = ResearchQA.answer(rqId, t); if (a) return askGemini(text, t, { fallback: a.html + chips(a.actions), chips: RQ_CHIPS }); }

  // 1) 품번
  const pnHit = text.split(/[\s,]+/).map(findPn).find(Boolean);
  if (pnHit) {
    const models = [...new Set(pnHit.rows.map((r) => `${makeKo(r.make)} ${r.group}`))];
    return say(`OEM <b>${esc(pnHit.pn)}</b>는 ${axleKo(pnHit.axle)} 디스크(외경 ${esc(pnHit.dia)}mm × ${esc(pnHit.thk)}mm)입니다.\n적용 모델군: ${esc(models.slice(0, 8).join(", "))}${models.length > 8 ? " 외" : ""}` +
      chatProdCard(pnHit) + INQ);
  }

  // 2) 차대번호
  const vinTok = text.toUpperCase().replace(/[\s-]/g, "").match(/[A-Z0-9]{17}/);
  if (vinTok || /^[a-z0-9]{11,16}$/i.test(text.trim())) {
    const r = decodeVin(vinTok ? vinTok[0] : text);
    if (!r.ok) return say(esc(r.error));
    sessionStorage.setItem("lastVin", r.vin);
    if (!r.make) return say("차대번호 형식은 맞지만 제조사를 자동으로 식별하지 못했습니다. 제조사를 알려주시거나 담당자 확인을 요청해 주십시오." + INQ);
    chatState.make = r.make;
    const m = matchVin(r);
    if (m.level === "exact") { chatState.code = null; return answerRows(m.rows, `${makeKo(r.make)} 모델코드 ${m.key}`, axle); }
    if (m.level === "platform") return answerRows(m.rows, `${makeKo(r.make)} 플랫폼 ${m.key}(추정)`, axle);
    const list = ROWS.filter((x) => x.make === r.make);
    if (!list.length) return say(`${esc(makeKo(r.make))} 차량용 디스크는 아직 등록 전입니다.` + INQ);
    return say(`<b>${esc(makeKo(r.make))}</b> 차량으로 확인됩니다. 차대번호만으로는 세대를 확정하기 어려워요. 해당하는 섀시코드를 골라 주십시오.` + chassisChips(list));
  }

  // 2-1) 17자리가 아닌 차대번호 (앞 3자리가 제조사 코드)
  const vt = text.toUpperCase().replace(/[\s-]/g, "");
  if (/^[A-HJ-NPR-Z0-9]{8,16}$/.test(vt) && /[A-Z]/.test(vt) && WMI_MAP[vt.slice(0, 3)])
    return say(`차대번호는 <b>17자리</b>예요. 입력하신 ${vt.length}자리로는 차량을 정확히 찾기 어려워요.\n자동차등록증이나 운전석 문짝 아래에 적힌 번호를 그대로 입력해 주십시오.`);

  // 2-2) 카오스 가공 세부 질문
  if (/(가공|카오스)/.test(t) && /(기간|며칠|얼마나\s?걸|소요|언제)/.test(t)) return aiOr(text, t, "가공 일정은 디스크 재고와 작업 물량에 따라 달라요. 가공 의뢰서를 남겨 주시면 담당자가 출고 예정일을 함께 안내드립니다." + chips([["가공 상담 시작", "#consult"]]));
  if (/(가공|카오스)/.test(t) && /(비용|가격|얼마(?!나)|금액)|가공비/.test(t)) return say(chaosPriceTable() + chips([["가공 상담 시작", "#consult"]]));
  if (/(제\s?디스크|내\s?디스크|가지고\s?있|보유|보내서|가공만)/.test(t)) return aiOr(text, t, "가지고 계신 디스크도 가공할 수 있는지 확인해 드려요. 가공 뒤에도 두께가 충분해야 하고 표면 상태가 좋아야 해서, 가공 상담에서 품번과 사진을 남겨 주시면 담당자가 확인 후 안내드립니다." + chips([["가공 상담 시작", "#consult"]]));
  if (/(추천|어떤\s?(타입|게|걸|패턴)|뭐가\s?(좋|나아|예뻐|이뻐)|골라)/.test(t) && /(타입|패턴|가공|카오스|디자인|사선)/.test(t)) return aiOr(text, t, "타입은 취향과 휠 디자인에 맞춰 고르시면 돼요.\n<b>사선 타입</b>: 같은 간격의 직선 홈이라 깔끔하고 무난해요. 처음이시면 가장 많이 고릅니다.\n<b>A 타입</b>: 곡선 홈이 흩어져 있어 개성이 강해요.\n<b>B 타입</b>: V자 홈이 한 방향으로 반복돼 역동적이에요. 회전 방향이 정해져 있어 좌우가 따로 만들어집니다.\n휠 사진을 가공 상담에 올려 주시면 어울리는 타입을 같이 봐 드릴게요." + chips([["디자인 보기", "#lab"], ["가공비 보기", "카오스 가공비 얼마예요?"], ["가공 상담 시작", "#consult"]]));

  // 2-3) 자주 묻는 질문
  // 인사·연락처·주문 조회·브랜드처럼 정해진 사실은 바로 답하고, 설명이 필요한 질문은 Gemini가 답합니다(실패 시 기존 답변)
  const fq = faqReply(t, text);
  if (fq) return LOCAL_FIRST.test(t) ? say(fq) : aiOr(text, t, fq);

  // 3) 카오스 가공 / 운영 안내
  if (/(카오스|chaos|가공)/.test(t)) return aiOr(text, t, "카오스 가공은 현재 <b>제공 중</b>이며, 가공 의뢰를 접수받아 담당자가 검토한 뒤 진행 여부와 가공비를 안내드립니다.\n가공 타입은 <b>사선 타입 · A 타입 · B 타입</b> 세 가지예요. 디스크를 찾은 뒤 상품 카드의 <b>'카오스 가공 함께 의뢰'</b>에서 타입을 고르고 담으시면 디스크와 가공을 한 번에 의뢰할 수 있어요.\n성능이 궁금하시면 관련 논문의 시험 수치로 안내해 드려요." + chips([["가공 상담 바로가기", "#consult"], ["카오스 가공 관련", "#rqlist"], ["담당자 확인 요청", "#inquiry"]]));
  if (text === "#consult") { SiteNav.go("consult.html"); return; }

  // 4) 섀시코드 직접 입력 (W213, G30, F10 …)
  const codeHit = ((text + " " + t).toUpperCase().match(/\b[A-Z]{1,2}\d{2,3}[A-Z]?\b/g) || []).find((c) => CHASSIS.has(c));
  if (codeHit) { chatState.code = codeHit; chatState.make = CHASSIS.get(codeHit)[0].make; return answerRows(CHASSIS.get(codeHit), `${makeKo(chatState.make)} ${codeHit}`, axle); }

  // 5) 모델 별칭 (E클래스, 5시리즈, A6 …)
  const alias = MODEL_ALIASES.find(([words]) => words.some((w) => t.includes(w)));
  if (alias) {
    const [, make, group] = alias; chatState.make = make; chatState.group = group; chatState.pendingAxle = axle;
    let rows = rowsFor({ make, group });
    if (!rows.length) return say(`${esc(carName(make, group))}용 디스크는 아직 등록 전입니다.` + INQ);
    // 연식이 있으면 그 해에 생산된 세대로 좁힘 (예: "2019년식 E300")
    const ym = t.match(/(?:^|[^\d])((?:19|20)\d{2})\s*(?:년|식|년식)?/) || t.match(/(?:^|[^\d])(\d{2})\s*(?:년식|년형|연식)/);
    if (ym) {
      const y = ym[1].length === 2 ? 2000 + Number(ym[1]) : Number(ym[1]);
      const byYear = rows.filter((r) => (!r.from || Number(r.from.slice(0, 4)) <= y) && (!r.to || Number(r.to.slice(0, 4)) >= y));
      if (byYear.length) {
        const codes = new Set(byYear.flatMap((r) => r.chassis));
        if (codes.size === 1) { const code = [...codes][0]; chatState.code = code; return answerRows(byYear, `${carName(make, group)} ${code} (${y}년식)`, axle); }
        // 쿠페·컨버터블·왜건이라고 하지 않았으면 기본(세단) 차체를 먼저 보여 줌
        const ALT = /(convertible|coupe|cabrio|t-model|touring|avant|estate|wagon|allroad|all-terrain|gran|shooting|platform)/i;
        const wantsAlt = /(쿠페|컨버|카브리|왜건|투어링|아반트|에스테이트|올로드|그란|coupe|convertible|wagon|touring|avant)/.test(t);
        const base = byYear.filter((r) => !ALT.test(r.body));
        const baseCodes = new Set(base.flatMap((r) => r.chassis));
        if (!wantsAlt && baseCodes.size === 1 && base.length) {
          const code = [...baseCodes][0]; chatState.code = code;
          answerRows(base, `${carName(make, group)} ${code} (${y}년식)`, axle);
          const others = byYear.filter((r) => ALT.test(r.body));
          if (others.length) say("쿠페·컨버터블·왜건 모델이라면 아래에서 골라 주십시오." + chassisChips(others));
          return;
        }
        rows = byYear;
      }
    }
    return say(`<b>${esc(carName(make, group))}</b>는 세대에 따라 디스크가 다릅니다. 섀시코드를 골라 주십시오. (모르시면 차대번호를 입력해 주십시오)` + chassisChips(rows));
  }

  // 6) 제조사만
  const make = Object.keys(MAKE_WORDS).find((m) => MAKE_WORDS[m].some((w) => t.includes(w)));
  if (make) {
    chatState.make = make; chatState.pendingAxle = axle;
    const groups = [...new Set(rowsFor({ make }).map((r) => r.group))];
    if (!groups.length) return say(`${esc(makeKo(make))} 차량용 디스크는 아직 등록 전입니다.` + INQ);
    return say(`${esc(makeKo(make))} 모델을 골라 주십시오.` + chips(groups.slice(0, 16).map((g) => [g, "#group:" + make + "|" + g])));
  }

  if (/(가격|얼마)/.test(t) && !chatState.make) return say(`디스크는 2장 1세트로 판매하며, 표시 가격은 세트 가격(${esc(PRICE_NOTE)})입니다. 차종을 알려주시면 해당 디스크 가격을 보여드릴게요.`);
  // 위치만 말한 경우 → 직전 차량 기준
  if (axle && chatState.lastRows) return answerRows(chatState.lastRows, chatState.lastTitle, axle);

  // 품번처럼 보이는데 디스크 목록에 없으면 → 다른 부품일 수 있으니 상담사 연결 제안
  if (/^[A-Za-z0-9-]{7,15}$/.test(text.trim()) && /\d{4}/.test(text)) return say(`<b>${esc(text.trim())}</b>는 등록된 브레이크 디스크 품번이 아니에요. 다른 부품이라면 상담사가 직접 확인해 드릴게요.` + chips([["상담사와 채팅", "#agent"], ["담당자 확인 요청", "#inquiry"]]));

  const ca = customAnswer(t);
  if (ca) return say(ca);
  if (!text.startsWith("#")) return askGemini(text, t);
  return fallbackReply(text, t);
}

// ---------------- AI 답변 (Google Gemini, 서버 /api/chat 경유) ----------------
// 위의 검색·자주 묻는 질문으로 답하지 못한 질문만 보냅니다. 실패하면 기존 안내로 돌아갑니다.
const aiHistory = [];
const LOCAL_FIRST = /(^\s*(안녕|하이|hi|hello|헬로|반갑)|감사|고마|고맙|땡큐|thank|누구(세요|야|신가요)|챗봇|상담원|상담사|직원|담당자|영업\s?시간|운영\s?시간|전화|연락처|이메일|주소|어디쯤|조회|송장|취소)/;
const RQ_CHIPS = [["디자인 보기", "#lab"], ["외부 연구 결과 보기", "#rq:improve"], ["가공 상담 시작", "#consult"]];
// 기존 답변(localHtml)을 준비해 두고 Gemini에게 먼저 묻습니다. Gemini가 실패하면 기존 답변을 보여 줍니다.
const aiOr = (text, t, localHtml) => askGemini(text, t, { fallback: localHtml });
// AI 답변을 기다리는 동안에는 전송을 막아 같은 질문이 두 번 가지 않게 합니다
let aiWaiting = false;
function aiBusy(on) {
  aiWaiting = on;
  $("#chatForm").classList.toggle("busy", on);
  $("#chatForm button").disabled = on;
  if (!on && $("#chat").classList.contains("open")) $("#chatText").focus();
}
const aiFormat = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^\s*[*-]\s+/gm, "· ");
async function askGemini(text, t, opts = {}) {
  if (!opts.chips && /(카오스|chaos|가공)/.test(t)) opts.chips = RQ_CHIPS; // 가공 질문에는 디자인·외부 연구·가공 상담 버튼
  const wait = document.createElement("div");
  wait.className = "msg bot ai-wait";
  wait.setAttribute("role", "status");
  wait.innerHTML = '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>답변을 준비하고 있어요';
  chatLog.appendChild(wait);
  chatLog.scrollTop = chatLog.scrollHeight;
  aiBusy(true);
  const car = [chatState.make && makeKo(chatState.make), chatState.group, chatState.code].filter(Boolean).join(" ");
  try {
    const r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: text, history: aiHistory.slice(-6), car }),
    });
    const data = await r.json().catch(() => ({}));
    wait.remove(); aiBusy(false);
    if (!r.ok || !data.reply) {
      if (r.status === 429 && !opts.fallback) return say("지금 AI 상담 요청이 많아 잠시 답변하기 어려워요. 잠시 후 다시 물어보시거나 상담사와 채팅해 주십시오." + chips([["상담사와 채팅", "#agent"]]));
      return opts.fallback ? say(opts.fallback) : fallbackReply(text, t);
    }
    aiHistory.push({ role: "user", text }, { role: "model", text: data.reply });
    queueSaveChat();
    say(aiFormat(data.reply) + `<span class="ai-note">AI 답변이에요. 주문·적용 여부는 담당자가 최종 확인합니다.</span>` + chips([...(opts.chips || []), ["상담사와 채팅", "#agent"]]));
  } catch (e) {
    wait.remove(); aiBusy(false);
    opts.fallback ? say(opts.fallback) : fallbackReply(text, t);
  }
}

function fallbackReply(text, t) {
  logUnanswered(text, t);
  return say("질문을 정확히 이해하지 못했어요. 이렇게 물어봐 주시면 바로 찾아 드려요.\n· 차대번호 17자리 (예: WDD2130421A123456)\n· 디스크 OEM 품번 (예: 34116860907)\n· 차종과 위치 (예: 벤츠 W213 앞 디스크)\n디스크 외 부품이나 다른 문의는 상담사가 도와드려요." + chips([["벤츠 W213 앞 디스크", "벤츠 W213 앞 디스크"], ["배송·결제 안내", "결제는 어떻게 하나요?"], ["카오스 가공 관련", "#rqlist"], ["상담사와 채팅", "#agent"]]));
}

function openChat() {
  $("#cartDrawer").classList.remove("open");
  $("#chat").classList.add("open");
  if (!chatLog.children.length) {
    // 새로고침 후에도 진행 중인 상담사 채팅이 있으면 이어서 보여줌
    const c = agentId && agentChats().find((x) => x.id === agentId && x.status !== "종료");
    if (c) {
      chatMode = "agent"; setAgentHeader(true);
      c.messages.forEach((m) => { if (m.who === "customer") say(m.text, "me"); else if (m.who === "agent") say(esc(m.text), "agent"); });
      agentSeen = c.messages.filter((m) => m.who === "agent").length;
      say("상담사 채팅이 이어지고 있어요." + chips([["AI 상담으로 돌아가기", "#ai"]]));
    } else {
      say("안녕하세요, 카리브무역 AI 상담입니다.\n차대번호 17자리, OEM 품번, 차종을 알려 주시면 맞는 브레이크 디스크를 찾아 드릴게요.\n배송, 결제, 카오스 가공, 교체 시기 등 궁금한 점도 편하게 물어보십시오.\n디스크 외 부품은 상담사가 직접 안내해 드려요." +
        chips([["벤츠 E클래스", "벤츠 E클래스"], ["BMW 5시리즈", "BMW 5시리즈"], ["디스크 외 부품 문의", "#agent"]].concat(window.ResearchQA ? [["카오스 가공 관련", "#rqlist"]] : [])));
    }
  }
  else if (typeof refreshAddButtons === "function") refreshAddButtons(); // 이어진 대화의 담기 버튼을 지금 장바구니 기준으로
  chatLog.scrollTop = chatLog.scrollHeight;
  $("#chatText").focus();
}
$("#chatFab").onclick = openChat;
$("#openChatHero").onclick = openChat;
$("#chatForm").onsubmit = (e) => {
  e.preventDefault();
  const v = $("#chatText").value.trim();
  if (!v) return;
  if (aiWaiting && chatMode !== "agent") return;
  say(v, "me");
  $("#chatText").value = "";
  if (chatMode === "agent") return postToAgent(v);
  setTimeout(() => botReply(v), 200);
};
chatLog.addEventListener("submit", (e) => {
  const f = e.target.closest("form.agent-contact");
  if (!f) return;
  e.preventDefault();
  const name = f.name.value.trim(), phone = f.phone.value.trim(), items = (f.items ? f.items.value.trim() : "");
  if (!phone) return f.phone.focus();
  updateAgentChat(agentId, (c) => { c.contact = { name, phone, items }; c.messages.push({ who: "system", text: `고객 연락처 등록: ${name} ${phone}${items ? "\n필요 품목: " + items : ""}`, at: new Date().toISOString() }); });
  f.outerHTML = `<p class="small muted" style="margin:8px 0 0">연락처${items ? "와 필요 품목을" : "를"} 남겼어요 (${esc(phone)}). 채팅 응답이 늦으면 전화로 안내드릴게요.</p>`;
});
chatLog.addEventListener("click", (e) => {
  const b = e.target.closest("[data-chat]");
  if (!b || (aiWaiting && chatMode !== "agent")) return;
  const v = b.dataset.chat;
  if (v === "#ai") { chatMode = "ai"; setAgentHeader(false); say("AI 상담으로 돌아가기", "me"); return say("AI 상담으로 돌아왔어요. 상담사 답변이 오면 이 창에 함께 표시됩니다.\n디스크는 차대번호·품번·차종으로 찾아드릴게요."); }
  say(b.dataset.label || b.textContent, "me");
  if (v.startsWith("#group:")) {
    const [make, group] = v.slice(7).split("|");
    chatState.make = make; chatState.group = group;
    return setTimeout(() => say(`<b>${esc(carName(make, group))}</b> 섀시코드를 골라 주십시오.` + chassisChips(rowsFor({ make, group }))), 150);
  }
  setTimeout(() => botReply(v), 150);
});

// 검색 예시 버튼
document.querySelectorAll("[data-example]").forEach((b) => b.addEventListener("click", () => {
  $("#vinInput").value = b.dataset.example;
  $("#vinForm").requestSubmit();
}));
// 다른 페이지에서 ?q= 로 넘어온 검색어 처리
const q0 = SiteNav.params().get("q");
if (q0) { $("#vinInput").value = q0; setTimeout(() => $("#vinForm").requestSubmit(), 0); }
// ---------------- 상담 내용 이어가기 ----------------
// 디자인 보기·가공 상담·주문 등 다른 페이지로 넘어갔다가 돌아와도 상담창이 처음부터 다시 시작하지 않게
// 대화 내용과 상태를 이 탭(sessionStorage)에 저장합니다. 탭을 닫으면 지워집니다.
const CHAT_SAVE = "chatSession";
let saveTimer = 0;
function queueSaveChat() { clearTimeout(saveTimer); saveTimer = setTimeout(saveChat, 300); }
function saveChat() {
  clearTimeout(saveTimer);
  try {
    if (!chatLog.children.length) return;
    const log = chatLog.cloneNode(true);
    log.querySelectorAll(".ai-wait").forEach((n) => n.remove());
    const data = { html: log.innerHTML, state: { ...chatState }, ai: aiHistory.slice(-6), mode: chatMode, agentSeen, open: $("#chat").classList.contains("open") };
    let json = JSON.stringify(data);
    if (json.length > 1_500_000) { data.state = { ...chatState, lastRows: null, more: null }; json = JSON.stringify(data); }
    sessionStorage.setItem(CHAT_SAVE, json);
  } catch (e) { /* 저장 공간이 없거나 막혀 있으면 이어가기만 안 됨 */ }
}
function restoreChat() {
  let d = null;
  try { d = JSON.parse(sessionStorage.getItem(CHAT_SAVE) || "null"); } catch (e) {}
  if (!d || !d.html) return null;
  chatLog.innerHTML = d.html;
  chatLog.querySelectorAll(".ai-wait").forEach((n) => n.remove());
  Object.assign(chatState, d.state || {});
  aiHistory.push(...(Array.isArray(d.ai) ? d.ai : []));
  const c = d.mode === "agent" && agentId && agentChats().find((x) => x.id === agentId && x.status !== "종료");
  if (c) { chatMode = "agent"; setAgentHeader(true); agentSeen = d.agentSeen || 0; } // 그 사이 온 상담사 답변은 pollAgent가 이어서 표시
  return d;
}
window.addEventListener("pagehide", saveChat);
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") saveChat(); });
const restored = restoreChat();
// 뒤로 가기로 돌아왔을 때 상담창이 열려 있었다면 다시 열어 둠
const navType = (performance.getEntriesByType && performance.getEntriesByType("navigation")[0] || {}).type;
if (restored && restored.open && navType === "back_forward" && !SiteNav.params().get("chat")) setTimeout(openChat, 200);

// 다른 페이지의 "AI 상담" 버튼(?chat=1)으로 넘어온 경우 상담창을 바로 엽니다
if (SiteNav.params().get("chat")) { SiteNav.setUrl("index.html"); setTimeout(openChat, 200); }
// 가공 상담 페이지에서 "일반 문의로 남기기"로 넘어온 경우
const pre = sessionStorage.getItem("prefillInquiry");
if (pre) { sessionStorage.removeItem("prefillInquiry"); setTimeout(() => prefillInquiry(pre), 300); }

// 메인의 "등록 디스크" 표 (많이 팔린 순 6종)
if ($("#homeTable")) {
  $("#homeTable").innerHTML = ptTable(PRODUCTS.filter((p) => p.price).sort((a, b) => (b.sold || 0) - (a.sold || 0)).slice(0, 6), true);
}
// AI 상담 예시 질문 → 상담창을 열고 바로 질문
document.addEventListener("click", (e) => {
  const ask = e.target.closest && e.target.closest("[data-ask]");
  if (ask) { openChat(); const q = ask.dataset.ask; setTimeout(() => { if (chatMode !== "ai") return; say(q, "me"); setTimeout(() => botReply(q), 200); }, 250); return; }
  const fs = e.target.closest && e.target.closest("[data-focus-search]");
  if (fs) { e.preventDefault(); window.scrollTo({ top: 0, behavior: "smooth" }); setTimeout(() => $("#vinInput").focus({ preventScroll: true }), 300); }
});

renderCart();
renderResults();
