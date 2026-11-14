// ============================================================
// AI 상담 확장 기능 (app.js 다음에 불러옴)
//  1. 상담창에서 바로 장바구니 담기 (브랜드 선택 · 앞뒤 함께 담기)
//  2. 담은 뒤 함께 필요한 품목 추천 (다른 쪽 디스크 → 카오스 가공 → 패드)
// ============================================================

// ---------------- 1. 상담창 상품 카드 ----------------
const cartQtyOf = (pn) => Object.entries(cart).filter(([k]) => k.split("|")[0] === pn).reduce((s, [, q]) => s + q, 0);
const addLabel = (pn) => { const n = cartQtyOf(pn); return n ? `${n}세트 담음 · 1세트 더 담기` : "장바구니 담기"; };

function chatProdCard(p) {
  const head = `<div class="cp-head"><b>${axleKo(p.axle)} 디스크</b><span>OEM ${esc(p.pn)}</span></div>
    <div class="cp-spec">외경 ${esc(p.dia)}mm × 두께 ${esc(p.thk)}mm · 2장 1세트</div>`;
  if (!p.price) return `<div class="cp">${head}<div class="cp-noprice">가격은 문의해 주시면 바로 안내드려요.</div>
    <button type="button" class="cp-add ghost" data-chat="#price:${esc(p.pn)}">가격 문의하기</button></div>`;
  return `<div class="cp" data-cp="${esc(p.pn)}">${head}
    <div class="cp-brands" role="radiogroup" aria-label="브랜드 선택">${BRANDS.map((b, i) =>
      `<button type="button" role="radio" aria-checked="${i === 0}" class="${i === 0 ? "on" : ""}" data-cbrand="${esc(b.code)}"><b>${esc(b.code)}</b><span>${won(brandPrice(p, b.code) * SET_SIZE)}</span></button>`).join("")}</div>
    <div class="cp-opt-label">카오스 가공</div>
    <div class="cp-opts" role="radiogroup" aria-label="카오스 가공 선택"><button type="button" role="radio" aria-checked="true" class="on" data-cchaos=""><b>가공 없음</b></button>${CHAOS_TYPES.map((t) => { const o = chaosOption(p, t.code);
      return `<button type="button" role="radio" aria-checked="false" data-cchaos="${t.code}"><b>${esc(t.name.replace(" 타입", ""))}</b><span>${o.price ? "+" + won(o.price * SET_SIZE) : "별도 견적"}</span></button>`; }).join("")}</div>
    <div class="cp-total" data-ctotal></div>
    <button type="button" class="cp-add" data-cadd="${esc(p.pn)}">${addLabel(p.pn)}</button></div>`;
}
function cardOf(pn) { return [...chatLog.querySelectorAll(".cp[data-cp]")].reverse().find((c) => c.dataset.cp === pn); }
const pickedChaos = (pn) => cardOf(pn)?.querySelector("[data-cchaos].on")?.dataset.cchaos || "";
function updateCardTotal(card) {
  const p = productByPn(card.dataset.cp), brand = card.querySelector("[data-cbrand].on")?.dataset.cbrand || BRANDS[0].code, code = card.querySelector("[data-cchaos].on")?.dataset.cchaos || "";
  const o = code ? chaosOption(p, code) : null;
  const sum = (brandPrice(p, brand) + (o && o.price ? o.price : 0)) * SET_SIZE;
  card.querySelector("[data-ctotal]").innerHTML = code ? `디스크 + 가공 <b>${won(sum)}</b>${o.price ? "" : " + 가공비 별도"}` : "";
}
// 차량 하나에 앞·뒤 가격 있는 디스크가 한 종씩만 있으면 "앞·뒤 함께 담기" 제공
function bothButton(items) {
  const f = items.filter((x) => x.p.axle === "front" && x.p.price), r = items.filter((x) => x.p.axle === "rear" && x.p.price);
  if (f.length !== 1 || r.length !== 1) return "";
  return `<button type="button" class="cp-both" data-cboth="${esc(f[0].p.pn)}|${esc(r[0].p.pn)}">앞·뒤 디스크 함께 담기 <small>(고른 브랜드·가공으로)</small></button>`;
}
function chatProdList(items, limit = 4) {
  // 상담창에서는 바로 담을 수 있는(가격 있는) 디스크를 먼저 보여 줌
  const rank = (x) => (x.p.price ? 0 : 2) + (x.p.axle === "front" ? 0 : 1);
  items = [...items].sort((a, b) => rank(a) - rank(b) || b.p.sold - a.p.sold);
  const shown = items.slice(0, limit);
  let html = `<div class="cp-list">${shown.map(({ p }) => chatProdCard(p)).join("")}</div>`;
  if (items.length > limit) { chatState.more = items.slice(limit); html += chips([[`나머지 ${items.length - limit}종 더 보기`, "#more"]]); }
  return html;
}
const pickedBrand = (pn) => {
  const card = [...chatLog.querySelectorAll(".cp[data-cp]")].reverse().find((c) => c.dataset.cp === pn);
  return card?.querySelector("[data-cbrand].on")?.dataset.cbrand || BRANDS[0].code;
};
function refreshAddButtons() {
  chatLog.querySelectorAll("[data-cadd]").forEach((b) => { b.textContent = addLabel(b.dataset.cadd); });
}

chatLog.addEventListener("click", (e) => {
  const br = e.target.closest("[data-cbrand]");
  if (br) {
    br.parentElement.querySelectorAll("[data-cbrand]").forEach((x) => { const on = x === br; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
    updateCardTotal(br.closest(".cp"));
    return;
  }
  const co = e.target.closest("[data-cchaos]");
  if (co) {
    co.parentElement.querySelectorAll("[data-cchaos]").forEach((x) => { const on = x === co; x.classList.toggle("on", on); x.setAttribute("aria-checked", on); });
    updateCardTotal(co.closest(".cp"));
    return;
  }
  const add = e.target.closest("[data-cadd]");
  if (add) {
    const pn = add.dataset.cadd, brand = pickedBrand(pn);
    addToCart(pn, brand, pickedChaos(pn)); refreshAddButtons();
    return setTimeout(() => afterAdd([pn]), 150);
  }
  const ch = e.target.closest(".cp-chaos");
  if (ch) { ch.closest(".msg").querySelectorAll(".cp-chaos, .chips button").forEach((x) => { x.disabled = true; }); ch.classList.add("on"); return; }
  const both = e.target.closest("[data-cboth]");
  if (both) {
    const pns = both.dataset.cboth.split("|");
    pns.forEach((pn) => addToCart(pn, pickedBrand(pn), pickedChaos(pn))); refreshAddButtons();
    both.disabled = true; both.textContent = "앞·뒤 디스크를 담았어요";
    return setTimeout(() => afterAdd(pns), 150);
  }
});

// ---------------- 2. 함께 필요한 품목 추천 ----------------
// 담은 뒤 한 단계씩: 다른 쪽 디스크 → 카오스 가공 → 패드(상담사) + 마무리
const SENSOR_MAKES = ["BMW", "MINI", "MERCEDES-BENZ", "PORSCHE", "AUDI"];
function cartSummary() {
  const lines = cartLines();
  const total = lines.reduce((s, x) => s + x.unit * x.q, 0);
  const quote = lines.some((x) => x.o && !x.o.price);
  return { lines, total, quote, sets: lines.reduce((s, x) => s + x.q, 0) };
}
const keyOf = (pn) => { const ks = Object.keys(cart).filter((k) => k.startsWith(pn + "|")); return ks.find((k) => !k.split("|")[2]) || ks[0]; };
const chaosInCart = (pn) => { const ks = Object.keys(cart).filter((k) => k.startsWith(pn + "|")); return ks.length && ks.every((k) => k.split("|")[2]) ? ks[0].split("|")[2] : ""; };
const brandInCart = (pn) => (keyOf(pn) || "").split("|")[1] || BRANDS[0].code;

function afterAdd(added) {
  // "다른 쪽 디스크 보기"에서 이어 담은 경우, 앞서 담은 디스크도 함께 가공 제안 대상에 넣음
  const pns = [...new Set([...(chatState.pendingPns || []), ...added])].filter((pn) => keyOf(pn));
  chatState.pendingPns = null; chatState.upSaved = null;
  const ps = pns.map(productByPn);
  const addedPs = added.map(productByPn);
  const s = cartSummary();
  const what = addedPs.map((p) => { const c = pickedChaos(p.pn); return `${axleKo(p.axle)} 디스크 ${esc(pickedBrand(p.pn))}${c ? ` + ${esc(chaosType(c).name)} 가공` : ""}`; }).join(", ");
  say(`<b>${what}</b> ${addedPs.length > 1 ? "각 1세트" : "1세트"}를 장바구니에 담았어요.\n장바구니 합계 <b>${won(s.total)}</b>${s.quote ? " + 가공비 별도" : ""} (${esc(PRICE_NOTE)})`);
  // 지금 보고 있는 차량에 다른 쪽 디스크가 있고 아직 안 담았으면 먼저 제안
  const vehItems = chatState.lastRows ? groupByProduct(chatState.lastRows) : [];
  const fromThisCar = ps.every((p) => vehItems.some((x) => x.p === p));
  const axles = new Set(ps.map((p) => p.axle));
  const other = axles.size === 1 && fromThisCar ? (axles.has("front") ? "rear" : "front") : null;
  const otherItems = other ? vehItems.filter((x) => x.p.axle === other) : [];
  const steps = [];
  if (ps.some((p) => p.price && !chaosInCart(p.pn))) steps.push("chaos");
  if (otherItems.length && !otherItems.some((x) => cartQtyOf(x.p.pn))) steps.push("other");
  steps.push("finish");
  chatState.up = { pns, other, steps, title: chatState.lastTitle, rows: chatState.lastRows, make: ps[0].rows[0]?.make || chatState.make };
  setTimeout(nextUpsell, 250);
}

function nextUpsell() {
  const up = chatState.up; if (!up) return;
  const step = up.steps.shift();
  if (step === "other") {
    const ko = axleKo(up.other);
    return say(`같은 차량의 <b>${ko} 디스크</b>도 함께 보시겠어요?` + chips([[`${ko} 디스크 보기`, "#up:other"], ["괜찮아요", "#up:next"]]));
  }
  if (step === "chaos") {
    const ps = up.pns.map(productByPn).filter((p) => p.price && !chaosInCart(p.pn));
    const p = ps[0];
    const cards = CHAOS_TYPES.map((t) => {
      const os = ps.map((x) => chaosOption(x, t.code));
      const fee = os.every((o) => o.price) ? os.reduce((s, o) => s + o.price * SET_SIZE, 0) : null;
      return `<button type="button" class="cp-chaos" data-chat="#up:chaos:${t.code}" data-label="${esc(t.name)} 가공 추가">${chaosSvg(t.key)}<b>${esc(t.name)}</b><span>${fee ? `+${won(fee)}${ps.length > 1 ? "" : "/세트"}` : "가공비 별도 견적"}</span></button>`;
    }).join("");
    const target = ps.length > 1 ? "담으신 디스크" : `${axleKo(p.axle)} 디스크`;
    return say(`${target}에 <b>카오스 가공</b>을 하시겠어요? 타입을 고르시면 장바구니에 바로 더해져요.<div class="cp-chaos-row">${cards}</div>` + chips([["가공 없이 진행", "#up:next"]]));
  }
  if (step === "finish") {
    const sensor = SENSOR_MAKES.includes(up.make) ? " 이 차종은 패드 마모 센서도 함께 바꾸는 경우가 많아요." : "";
    const pad = chatState.padAsked ? "" : `디스크를 바꿀 때는 <b>패드도 함께</b> 바꾸시길 권해요. 쓰던 패드는 이전 디스크 모양대로 닳아 있어 새 디스크와 잘 맞지 않거든요.${sensor}\n패드는 상담사가 차종에 맞춰 찾아 드려요.\n\n`;
    chatState.padAsked = true;
    chatState.up = null;
    return say(`${pad}더 필요한 게 없으시면 견적서를 받아 보시거나 바로 주문하실 수 있어요.` +
      chips([].concat(pad ? [["패드도 문의할게요", "#up:pad"]] : [], [["견적서 만들기", "#quote"], ["장바구니 보기", "#cart"], ["바로 주문하기", "#checkout"]])));
  }
}

function applyChaos(code) {
  const up = chatState.up; if (!up) return;
  const done = [];
  up.pns.forEach((pn) => {
    const k = keyOf(pn); if (!k) return;
    const [, brand, oc] = k.split("|"); if (oc) return;
    const q = cart[k]; delete cart[k];
    const nk = `${pn}|${brand}|${code}`; cart[nk] = (cart[nk] || 0) + q;
    done.push(productByPn(pn));
  });
  saveCart(); refreshAddButtons();
  const t = chaosType(code);
  if (!done.length) return say("이미 가공 타입이 정해진 디스크예요.");
  const os = done.map((p) => chaosOption(p, code));
  const fee = os.every((o) => o.price) ? os.reduce((sum, o) => sum + o.price * SET_SIZE, 0) : null;
  const s = cartSummary();
  const whom = done.length > 1 ? "담으신 디스크 모두에" : `${axleKo(done[0].axle)} 디스크에`;
  say(`${whom} <b>${esc(t.name)}</b> 가공을 추가했어요${fee ? ` (+${won(fee)})` : " (가공비는 담당자 확인 후 안내)"}.\n장바구니 합계 <b>${won(s.total)}</b>${s.quote ? " + 가공비 별도" : ""}\n주문 후 가공 의뢰서를 남기시면 더 빠르게 검토돼요.`);
}

function padToAgent() {
  const up = chatState.lastTitle || "";
  const ps = Object.keys(cart).map((k) => productByPn(k.split("|")[0])).filter(Boolean);
  const axles = [...new Set(ps.map((p) => axleKo(p.axle)))].join("·");
  startAgent(`[패드 문의] ${up ? up + " " : ""}${axles ? axles + " " : ""}브레이크 패드도 함께 필요합니다.${SENSOR_MAKES.includes(chatState.make) ? " (마모 센서 포함 여부도 알려 주십시오)" : ""}`);
}

// 확장 기능 라우터: botReply 맨 앞에서 호출, 처리했으면 true
function chatPlusRoute(text, t) {
  if (orderRoute(text, t)) return true;
  if (text === "#more") { const items = chatState.more || []; chatState.more = null; if (items.length) say(chatProdList(items, 99)); return true; }
  if (text.startsWith("#price:")) { const pn = text.slice(7); const p = productByPn(pn); closeAll(); prefillInquiry(`[가격 문의] 브레이크 디스크 ${p ? axleKo(p.axle) + " " : ""}OEM ${pn}`); return true; }
  if (text === "#up:next") { nextUpsell(); return true; }
  if (text === "#up:resume") { if (chatState.upSaved) { chatState.up = chatState.upSaved; chatState.upSaved = null; chatState.pendingPns = null; nextUpsell(); } return true; }
  if (text === "#up:other") {
    const up = chatState.up;
    if (up && up.rows) {
      chatState.pendingPns = up.pns; chatState.upSaved = up; chatState.up = null;
      answerRows(up.rows, up.title, up.other);
      say(chips([[`${axleKo(up.other)} 디스크는 빼고 계속하기`, "#up:resume"]]));
    }
    return true;
  }
  if (text.startsWith("#up:chaos:")) { applyChaos(text.slice(10)); setTimeout(nextUpsell, 250); return true; }
  if (text === "#up:pad") { padToAgent(); return true; }
  if (text === "#quote") { quoteInChat(); return true; }
  if (/견적\s?서|견적\s?(좀|을|내|뽑|받|주|부탁|요청|보내)|^견적$/.test(t) && !/(가공|카오스)/.test(t)) { quoteInChat(); return true; }
  if (text === "#cart") { $("#chat").classList.remove("open"); $("#cartDrawer").classList.add("open"); return true; }
  if (text === "#checkout") {
    if (!cartLines().length) { say("장바구니가 비어 있어요. 디스크를 먼저 담아 주십시오."); return true; }
    SiteNav.go("checkout.html"); return true;
  }
  return false;
}

// ---------------- 4. 질문 표현 정리 (줄임말 · 오타 · 띄어쓰기) ----------------
// 소문자로 바꾼 질문을 별칭 사전이 알아듣는 형태로 바꿉니다. 순서대로 적용.
const NORM_RULES = [
  // 제조사 오타 · 별칭
  [/벤쯔|밴츠|벤즈/g, "벤츠"], [/머세데스|메르세데츠|메르세대스|메르쎄데스/g, "메르세데스"],
  [/비\s?엠\s?(?:더블|따블|떠블|떠|더)\s?(?:유|류)|비엠떠|비\s?엠\s?w/g, "bmw"],
  [/아우뒤|아오디/g, "아우디"], [/폭바|폭스\s바겐|폭스바건|폭스밴/g, "폭스바겐"],
  [/(?:랜|렌)드\s?로(?:버|바)|랜로버/g, "랜드로버"],
  [/레인지\s?로(?:버|바)\s?스포츠|레인지\s?스포츠|레인지로버스포츠|레인지\s?로버스포츠/g, "레인지로버 스포츠"],
  [/레인지\s?로(?:버|바)(?! 스포츠)/g, "레인지로버"], [/레인지로버 스포츠/g, "레인지로버 스포츠"],
  [/포르(?:셰|세)/g, "포르쉐"], [/마세라띠/g, "마세라티"], [/렉서즈|렉써스/g, "렉서스"],
  [/미니\s?쿠퍼|mini\s?cooper/g, "미니"], [/시트로(?:앵|엔)|씨트로엥/g, "시트로엥"], [/스코타/g, "스코다"], [/볼부/g, "볼보"],
  // 벤츠 클래스 (e클, 이클래스, e 클래스 …)
  [/에이\s?클(?:래|레)스|에이클/g, "a클래스"], [/비\s?클(?:래|레)스/g, "b클래스"], [/씨\s?클(?:래|레)스|씨클/g, "c클래스"],
  [/이\s?클(?:래|레)스/g, "e클래스"], [/(^|\s|벤츠)이클(?=\s|$|앞|뒤|뒷|디스크)/g, "$1e클래스"], [/에스\s?클(?:래|레)스|에스클/g, "s클래스"],
  [/(^|[^a-z])([abces])\s?-?\s?클(?:래스|레스|라스)?/g, "$1$2클래스"],
  [/지엘씨/g, "glc"], [/지엘케이/g, "glk"], [/씨엘에스/g, "cls"], [/씨엘에이/g, "cla"], [/지엘에이/g, "gla"],
  // BMW 시리즈 (오시리즈, 5 시리즈 …)
  [/(?:원|일)\s?시리즈/g, "1시리즈"], [/투\s?시리즈/g, "2시리즈"], [/(?:쓰리|삼)\s?시리즈/g, "3시리즈"], [/(?:포|사)\s?시리즈/g, "4시리즈"],
  [/(?:오|파이브)\s?시리즈/g, "5시리즈"], [/(?:육|식스)\s?시리즈/g, "6시리즈"], [/(?:칠|세븐)\s?시리즈/g, "7시리즈"], [/(?:팔|에잇)\s?시리즈/g, "8시리즈"],
  [/(\d)\s+시리즈/g, "$1시리즈"],
  [/엑스\s?([1-7])(?!\d)/g, "x$1"], [/큐\s?([2-8])(?!\d)/g, "q$1"], [/(^|[^가-힣])에이\s?([1-8])(?!\d)/g, "$1a$2"],
  [/(^|\s)tt(?=\s|$|[가-힣])/g, "$1아우디tt"], [/(^|[^a-z])([aqxz])\s([1-8])(?!\d)/g, "$1$2$3"],
  // 섀시코드·모델명 띄어쓰기 (w 213, g-30, e 300 → w213, g30, e300)
  [/(^|[^a-z])([a-z]{1,2})\s?[-\s]\s?(\d{2,3})(?!\d)/g, "$1$2$3"],
  // 위치 표현
  [/뒷\s?(?:바퀴|쪽)?/g, "뒤 "], [/뒤\s?쪽|후방|리어/g, "뒤 "], [/앞\s?(?:바퀴|쪽)|전방|프런트|프론트/g, "앞 "],
  // 연식 표현 (19년형, 19연식 → 19년식)
  [/(\d{2})\s?(?:년형|연식|년도)/g, "$1년식"],
  // 디스크 별칭
  [/로터|브레이크\s?판|디스크\s?판/g, "디스크"],
];
function normalizeQuery(t) {
  let s = " " + String(t || "").toLowerCase().replace(/\s+/g, " ").trim() + " ";
  NORM_RULES.forEach(([re, to]) => { s = s.replace(re, to); });
  return s.replace(/\s+/g, " ").trim();
}

// ---------------- 3. 견적서 (장바구니 기준) ----------------
const COMPANY = { name: "(주)카리브무역", ceo: "김철민", bizNo: "608-86-12959", addr: "울산광역시 북구 진장로 16", tel: "010-5459-3111", mail: "caribetrading@naver.com" };
const QUOTES_KEY = "carib_quotes";
let lastQuote = null;
const cartSig = () => JSON.stringify(Object.entries(cart).sort());

function buildQuote() {
  const lines = cartLines(); if (!lines.length) return null;
  const sig = cartSig();
  const me = window.CaribAuth && CaribAuth.current();
  // 지금 상담 중인 차량의 디스크만 담겨 있으면 차량명을 견적서에 적음
  const veh = chatState.lastRows ? groupByProduct(chatState.lastRows).map((x) => x.p) : [];
  const car = lines.every((x) => veh.includes(x.p)) ? (chatState.lastTitle || "") : "";
  const items = [];
  lines.forEach(({ p, brand, o, q }) => {
    const unit = brandPrice(p, brand) * SET_SIZE;
    items.push({ name: `브레이크 디스크 ${axleKo(p.axle)} · ${brand}`, pn: p.pn, spec: `Ø${p.dia} × ${p.thk}mm`, qty: q, unit, sub: unit * q });
    if (o) items.push({ sub_of: p.pn, name: o.name, pn: "", spec: "", qty: q, unit: o.price ? o.price * SET_SIZE : null, sub: o.price ? o.price * SET_SIZE * q : null });
  });
  const q = {
    id: lastQuote && lastQuote.sig === sig ? lastQuote.id : "QT-" + today().replace(/-/g, "") + "-" + String(Math.floor(Math.random() * 9000) + 1000),
    sig, date: today(), car,
    to: lastQuote?.to || (me ? (me.company ? `${me.company} ${me.name}` : me.name) : ""),
    phone: lastQuote?.phone || (me ? me.phone : ""),
    vin: lastQuote?.vin || sessionStorage.getItem("lastVin") || "",
    items, total: items.reduce((s, x) => s + (x.sub || 0), 0), pending: items.some((x) => x.unit == null),
  };
  lastQuote = q;
  return q;
}

function quoteDocHtml(q) {
  let no = 0;
  const rows = q.items.map((x) => x.sub_of
    ? `<tr class="qt-sub"><td></td><td>└ ${esc(x.name)}</td><td></td><td></td><td>${x.qty}세트</td><td>${x.unit ? won(x.unit) : "별도 견적"}</td><td>${x.sub ? won(x.sub) : "별도 견적"}</td></tr>`
    : `<tr><td>${++no}</td><td>${esc(x.name)}</td><td>${esc(x.pn)}</td><td>${esc(x.spec)}</td><td>${x.qty}세트<small>(${x.qty * SET_SIZE}장)</small></td><td>${won(x.unit)}</td><td>${won(x.sub)}</td></tr>`).join("");
  const sup = [["상호", COMPANY.name], ["대표", COMPANY.ceo], ["사업자등록번호", COMPANY.bizNo], ["주소", COMPANY.addr], ["전화", COMPANY.tel], ["이메일", COMPANY.mail]]
    .map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("");
  return `<div class="qt-doc">
    <div class="qt-top"><h2>견적서</h2><div class="qt-no"><b>${esc(q.id)}</b><span>견적일 ${esc(q.date)}</span></div></div>
    <div class="qt-parties">
      <div class="qt-to-box"><div class="qt-label">받는 분</div>
        <p class="qt-to">${q.to ? esc(q.to) : '<span class="qt-blank"></span>'} 귀하</p>
        <table><tr><th>차량</th><td>${esc(q.car) || "-"}</td></tr><tr><th>차대번호</th><td>${esc(q.vin) || "-"}</td></tr>${q.phone ? `<tr><th>연락처</th><td>${esc(q.phone)}</td></tr>` : ""}</table>
      </div>
      <div class="qt-sup"><div class="qt-label">공급자</div><table>${sup}</table></div>
    </div>
    <p class="qt-sum">아래와 같이 견적합니다.<b>합계 ${won(q.total)}${q.pending ? " + 가공비 별도" : ""}</b><span>(${esc(PRICE_NOTE)})</span></p>
    <div class="qt-table-wrap"><table class="qt-items">
      <thead><tr><th>No</th><th>품목</th><th>OEM 품번</th><th>규격</th><th>수량</th><th>단가</th><th>금액</th></tr></thead>
      <tbody>${rows}</tbody>
      <tfoot><tr><td colspan="6">배송비</td><td>무료</td></tr><tr class="qt-total"><td colspan="6">합계 (${esc(PRICE_NOTE)})</td><td>${won(q.total)}${q.pending ? " + α" : ""}</td></tr></tfoot>
    </table></div>
    <ul class="qt-notes">
      <li>브레이크 디스크는 같은 축 2장 1세트 단위로 판매합니다.</li>
      <li>주문하시면 차대번호로 차량 적용 여부를 확인한 뒤 확정합니다.</li>
      <li>가격과 재고는 견적일 기준이며 바뀔 수 있습니다.</li>
      ${q.pending ? "<li>가공비 별도 견적 항목은 담당자가 확인한 뒤 안내드립니다.</li>" : ""}
    </ul>
  </div>`;
}

function ensureQuoteModal() {
  let m = $("#qtModal"); if (m) return m;
  document.body.insertAdjacentHTML("beforeend", `<div class="qt-modal" id="qtModal" role="dialog" aria-modal="true" aria-label="견적서" hidden>
    <div class="qt-panel">
      <div class="qt-bar"><b>견적서</b><button type="button" class="x" data-qt="close" aria-label="닫기">×</button></div>
      <div class="qt-form">
        <label>받는 분<input id="qtTo" placeholder="성함 또는 업체명" maxlength="40" /></label>
        <label>연락처<input id="qtPhone" placeholder="담당자에게 보낼 때 필요" inputmode="tel" maxlength="20" /></label>
        <label>차대번호<input id="qtVin" placeholder="17자리 (선택)" maxlength="17" /></label>
      </div>
      <div id="qtDoc"></div>
      <p class="qt-msg" id="qtMsg" role="status"></p>
      <div class="qt-actions">
        <button type="button" class="btn btn-ghost" data-qt="print">인쇄 · PDF 저장</button>
        <button type="button" class="btn btn-ghost" data-qt="send">담당자에게 보내기</button>
        <button type="button" class="btn btn-primary" data-qt="order">이 내용으로 주문하기</button>
      </div>
    </div>
  </div>`);
  m = $("#qtModal");
  const sync = () => {
    if (!lastQuote) return;
    lastQuote.to = $("#qtTo").value.trim(); lastQuote.phone = $("#qtPhone").value.trim(); lastQuote.vin = norm($("#qtVin").value);
    $("#qtDoc").innerHTML = quoteDocHtml(lastQuote);
  };
  ["#qtTo", "#qtPhone", "#qtVin"].forEach((s) => $(s).addEventListener("input", sync));
  m.addEventListener("click", (e) => {
    if (e.target === m) return closeQuote();
    const b = e.target.closest("[data-qt]"); if (!b) return;
    const act = b.dataset.qt, msg = $("#qtMsg");
    if (act === "close") return closeQuote();
    if (act === "print") return printHtml(quoteDocHtml(lastQuote));
    if (act === "order") { closeQuote(); return SiteNav.go("checkout.html"); }
    if (act === "send") {
      const q = lastQuote;
      if (!q.phone) { msg.textContent = "연락처를 적어 주시면 담당자가 확인 후 연락드려요."; msg.className = "qt-msg err"; return $("#qtPhone").focus(); }
      const me = window.CaribAuth && CaribAuth.current();
      const body = q.items.map((x) => `- ${x.sub_of ? "  └ " : ""}${x.name}${x.pn ? ` (OEM ${x.pn})` : ""} x ${x.qty}세트 ${x.sub ? won(x.sub) : "별도 견적"}`).join("\n");
      const list = store.get(INQUIRIES_KEY, []);
      list.push({ name: q.to || "(견적 요청)", phone: q.phone, vin: q.vin, at: new Date().toISOString(), memberId: me ? me.id : "", quoteId: q.id,
        message: `[견적서 ${q.id}] 확인 요청${q.car ? `\n차량: ${q.car}` : ""}\n${body}\n합계 ${won(q.total)}${q.pending ? " + 가공비 별도" : ""} (${PRICE_NOTE})` });
      store.set(INQUIRIES_KEY, list);
      const qs = store.get(QUOTES_KEY, []); qs.unshift({ ...q, sentAt: new Date().toISOString() }); store.set(QUOTES_KEY, qs.slice(0, 200));
      msg.textContent = `담당자에게 견적서를 보냈어요. ${inHours() ? "영업시간이라 곧 연락드릴게요." : "다음 영업일 오전에 연락드릴게요."}`; msg.className = "qt-msg ok";
      say(`견적서 <b>${esc(q.id)}</b>를 담당자에게 보냈어요. 남겨 주신 연락처(${esc(q.phone)})로 확인 연락을 드릴게요.`);
    }
  });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !m.hidden) closeQuote(); });
  return m;
}
function openQuote() {
  const q = buildQuote(); if (!q) return null;
  const m = ensureQuoteModal();
  $("#qtTo").value = q.to; $("#qtPhone").value = q.phone; $("#qtVin").value = q.vin;
  $("#qtDoc").innerHTML = quoteDocHtml(q);
  $("#qtMsg").textContent = ""; $("#qtMsg").className = "qt-msg";
  m.hidden = false; document.body.classList.add("qt-open");
  m.querySelector(".qt-panel").scrollTop = 0;
  setTimeout(() => m.querySelector("[data-qt=close]").focus(), 0);
  return q;
}
function closeQuote() { const m = $("#qtModal"); if (m) m.hidden = true; document.body.classList.remove("qt-open"); }

function quoteInChat() {
  const q = openQuote();
  if (!q) return say("견적서는 장바구니에 담은 디스크로 바로 만들어 드려요. 차종이나 차대번호를 알려 주시면 디스크부터 찾아 드릴게요." + chips([["벤츠 W213 앞 디스크", "벤츠 W213 앞 디스크"], ["BMW 5시리즈", "BMW 5시리즈"]]));
  say(`견적서 <b>${esc(q.id)}</b>를 만들었어요. 합계 <b>${won(q.total)}</b>${q.pending ? " + 가공비 별도" : ""}\n인쇄하거나 PDF로 저장하실 수 있고, 담당자에게 바로 보내실 수도 있어요.` + chips([["견적서 다시 보기", "#quote"], ["바로 주문하기", "#checkout"]]));
}
// 장바구니에서도 견적서 받기
(function addCartQuoteButton() {
  const foot = document.querySelector("#cartDrawer .drawer-foot"); if (!foot || $("#cartQuote")) return;
  $("#cartOrder").insertAdjacentHTML("beforebegin", '<button id="cartQuote" type="button" class="btn btn-ghost cart-ask">견적서 받기</button>');
  $("#cartQuote").onclick = () => {
    if (!cartLines().length) { $("#cartItems").insertAdjacentHTML("afterbegin", '<p class="field-err">장바구니에 담긴 상품이 없습니다.</p>'); return; }
    $("#cartDrawer").classList.remove("open"); openQuote();
  };
})();


// ---------------- 5. 답하지 못한 질문 기록 · 관리자가 등록한 답변 ----------------
// 관리자 화면 'AI 미답변' 탭에서 질문을 보고 키워드와 답변을 등록하면, 다음부터 그 답변으로 응답합니다.
function customAnswer(t) {
  const q = kwNorm(t);
  const hits = store.get(AI_ANSWERS_KEY, []).filter((a) => a.keywords.length && a.keywords.every((k) => q.includes(kwNorm(k))));
  if (!hits.length) return null;
  hits.sort((a, b) => b.keywords.join("").length - a.keywords.join("").length);
  const a = hits[0];
  const all = store.get(AI_ANSWERS_KEY, []); const x = all.find((y) => y.id === a.id);
  if (x) { x.hits = (x.hits || 0) + 1; x.lastHitAt = new Date().toISOString(); store.set(AI_ANSWERS_KEY, all); }
  return esc(a.answer) + chips([["상담사와 채팅", "#agent"]]);
}
function logUnanswered(text, t) {
  const list = store.get(AI_UNANSWERED_KEY, []);
  const car = [chatState.make && makeKo(chatState.make), chatState.group, chatState.code].filter(Boolean).join(" ");
  list.unshift({ id: "AQ-" + Date.now().toString(36).toUpperCase(), q: text.slice(0, 300), norm: kwNorm(t).slice(0, 200), at: new Date().toISOString(), car, status: "미처리" });
  store.set(AI_UNANSWERED_KEY, list.slice(0, 500));
}


// ---------------- 6. 주문 조회 ----------------
// 회원: 로그인한 계정의 주문을 바로 보여 줌 / 비회원: 주문번호 + 연락처 뒤 4자리로 확인
const ORDER_FLOW = ["주문 접수", "적용 확인", "입금 확인", "출고 준비", "배송 중", "배송 완료"];
const ORDER_HELP = {
  "주문 접수": "담당자가 차대번호로 차량 적용 여부를 확인하고 있어요. 확인되면 입금 계좌를 문자로 보내 드려요.",
  "적용 확인": "차량 적용 확인이 끝났어요. 문자로 안내드린 계좌로 입금해 주시면 출고를 준비해요.",
  "입금 확인": "입금이 확인됐어요. 곧 출고 준비를 시작해요.",
  "출고 준비": "상품을 포장하고 있어요. 가공 상품은 가공을 마친 뒤 출고돼요.",
  "배송 중": "택배로 이동 중이에요. 송장번호로 택배사에서 위치를 확인하실 수 있어요.",
  "배송 완료": "배송이 완료됐어요. 상품에 문제가 있으면 말씀해 주십시오.",
  "취소 요청": "취소 요청을 받았어요. 담당자가 확인한 뒤 처리 결과를 알려 드려요.",
  "취소": "취소된 주문이에요.",
};
const canCancelOrder = (o) => ["주문 접수", "적용 확인"].includes(o.status) && !(o.payment && o.payment.paid);
const allOrders = () => store.get(ORDERS_KEY, []);
const me = () => (window.CaribAuth && CaribAuth.current()) || null;
const myOrders = () => { const m = me(); return m ? allOrders().filter((o) => o.memberId === m.id) : []; };
const isActive = (o) => !["배송 완료", "취소"].includes(o.status);
const digitsOf = (s) => String(s || "").replace(/\D/g, "");

function orderCard(o) {
  const first = o.items[0] || {};
  const what = `디스크 ${axleKo(first.axle)} ${first.brand || ""}${o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ""}`;
  const cur = ORDER_FLOW.indexOf(o.status);
  const steps = cur >= 0
    ? `<ol class="oc-steps">${ORDER_FLOW.map((st, i) => `<li class="${i < cur ? "done" : i === cur ? "on" : ""}">${st}</li>`).join("")}</ol>`
    : `<div class="oc-stop">${esc(o.status)}</div>`;
  const track = o.tracking ? `<div class="oc-track">${esc(o.courier || "택배")} 송장번호 <b>${esc(o.tracking)}</b></div>` : "";
  return `<div class="oc"><div class="oc-head"><b>${esc(o.id)}</b><span>${esc(fmtDT(o.createdAt).slice(0, 10))}</span></div>
    <div class="oc-what">${esc(what)} · ${won(o.amounts.total)}${o.amounts.chaosQuote ? " + 가공비 별도" : ""}</div>
    ${steps}${track}<div class="oc-help">${esc(ORDER_HELP[o.status] || "")}</div>
    ${canCancelOrder(o) ? `<button type="button" class="oc-cancel" data-chat="#ocancel:${esc(o.id)}" data-label="${esc(o.id)} 주문 취소 요청">주문 취소 요청</button>` : ""}</div>`;
}
function showOrders(list, intro) {
  const shown = list.slice(0, 3);
  say(`${intro}${shown.map(orderCard).join("")}` + (list.length > 3 ? `<p class="small muted" style="margin:8px 0 0">최근 주문 3건만 보여 드렸어요.</p>` : "") +
    chips((me() ? [["마이페이지에서 전체 보기", "#mypage"]] : []).concat([["상담사와 채팅", "#agent"]])));
}

function orderRoute(text, t) {
  // 1) 비회원 확인: 주문번호 다음 연락처 뒤 4자리
  if (chatState.awaitOrder) {
    const d = digitsOf(text);
    if (/^\d{4}$/.test(d) && d.length === text.replace(/[\s-]/g, "").length) {
      const o = allOrders().find((x) => x.id === chatState.awaitOrder);
      const ok = o && [o.orderer?.phone, o.receiver?.phone].some((p) => digitsOf(p).endsWith(d));
      if (ok) { chatState.verifiedOrder = o.id; chatState.awaitOrder = null; chatState.orderTries = 0; showOrders([o], "주문을 확인했어요."); return true; }
      chatState.orderTries = (chatState.orderTries || 0) + 1;
      if (chatState.orderTries >= 3) { chatState.awaitOrder = null; chatState.orderTries = 0; say(`번호가 맞지 않아 확인하지 못했어요. 전화(${TEL})로 문의해 주시면 바로 확인해 드릴게요.`); return true; }
      say("주문하실 때 적은 연락처와 맞지 않아요. 주문자 또는 받는 분 휴대폰 번호 뒤 4자리를 다시 입력해 주십시오."); return true;
    }
    if (!/^#/.test(text)) chatState.awaitOrder = null; // 다른 질문으로 넘어가면 확인 대기 해제
  }
  // 2) 주문번호 입력 (OR-20261114-1234 / OR202611141234)
  const m = !text.startsWith("#") && text.toUpperCase().replace(/\s/g, "").match(/OR-?(\d{8})-?(\d{4})/);
  if (m) {
    const id = `OR-${m[1]}-${m[2]}`;
    const o = allOrders().find((x) => x.id === id);
    if (!o) { say(`주문번호 <b>${esc(id)}</b>를 찾지 못했어요. 주문 완료 화면이나 안내 문자의 번호를 다시 확인해 주십시오.\n이 화면은 주문하신 기기에서만 조회돼요. 다른 기기에서 주문하셨다면 전화(${TEL})로 문의해 주십시오.`); return true; }
    if (me() && o.memberId === me().id) { showOrders([o], "주문을 찾았어요."); return true; }
    chatState.awaitOrder = id; chatState.orderTries = 0;
    say(`주문번호 <b>${esc(id)}</b>를 찾았어요. 본인 확인을 위해 주문하실 때 적은 <b>휴대폰 번호 뒤 4자리</b>를 입력해 주십시오.`); return true;
  }
  if (text === "#mypage") { SiteNav.go("mypage.html"); return true; }
  if (text === "#login-order") { SiteNav.go("login.html?next=" + encodeURIComponent("index.html?chat=1")); return true; }
  // 3) 주문 취소 요청 (입금 전 주문만)
  if (text.startsWith("#ocancel:")) {
    const id = text.slice(9), all = allOrders(), o = all.find((x) => x.id === id);
    if (!o) { say("주문을 찾지 못했어요."); return true; }
    const mine = me() && o.memberId === me().id;
    if (!mine && chatState.verifiedOrder !== id) { say(`취소 요청은 로그인하시거나 전화(${TEL})로 해 주십시오.`); return true; }
    if (!canCancelOrder(o)) { say(`이 주문은 지금 단계(${esc(o.status)})에서는 상담창에서 취소할 수 없어요. 전화(${TEL})나 상담사 채팅으로 말씀해 주십시오.` + chips([["상담사와 채팅", "#agent"]])); return true; }
    if (chatState.cancelArm !== id) { chatState.cancelArm = id; say(`<b>${esc(id)}</b> 주문을 취소 요청할까요? 확인하시면 담당자가 처리한 뒤 알려 드려요.` + chips([["네, 취소 요청할게요", "#ocancel:" + id], ["아니요", "#ocancel-no"]])); return true; }
    chatState.cancelArm = null;
    o.status = "취소 요청"; o.cancelRequestedAt = new Date().toISOString(); store.set(ORDERS_KEY, all);
    say(`<b>${esc(id)}</b> 주문의 취소 요청을 접수했어요. 담당자가 확인한 뒤 처리 결과를 알려 드려요.`); return true;
  }
  if (text === "#ocancel-no") { chatState.cancelArm = null; say("취소하지 않았어요. 주문은 그대로 진행돼요."); return true; }

  // 4) 주문·배송 조회 의도
  const pre = /주문\s?(하면|하려|하는|방법|하고\s?싶|할게|할래|전)/.test(t);
  const lookup = !pre && /(주문|배송|택배)\s?(조회|내역|상태|확인)|어디쯤|내\s?주문|주문한\s?(거|것|상품|물건|디스크)|송장|운송장|배송\s?추적/.test(t);
  const cancel = /(주문|결제).{0,4}취소|취소\s?(하고|할래|요청|해\s?주|해줘|가능)/.test(t);
  const when = !pre && /(언제\s?(와|와요|오|받|도착)|도착\s?(언제|했)|배송\s?(언제|중)|출고\s?(됐|되었|했))/.test(t);
  if (!(lookup || cancel || when)) return false;
  const m2 = me();
  const verified = !m2 && chatState.verifiedOrder ? allOrders().filter((o) => o.id === chatState.verifiedOrder) : [];
  if (m2 || verified.length) {
    const list = m2 ? myOrders() : verified;
    if (!list.length) { if (when && !lookup) return false; say("로그인하신 계정으로 들어온 주문이 아직 없어요. 비회원으로 주문하셨다면 주문번호(OR-로 시작)를 알려 주십시오."); return true; }
    if (cancel) {
      const c = list.filter(canCancelOrder);
      if (!c.length) { say(`지금 상담창에서 취소할 수 있는 주문(입금 전)이 없어요. 이미 입금했거나 출고된 주문은 전화(${TEL})나 상담사 채팅으로 말씀해 주십시오.` + chips([["상담사와 채팅", "#agent"]])); return true; }
      showOrders(c, "입금 전이라 바로 취소 요청할 수 있는 주문이에요."); return true;
    }
    const active = list.filter(isActive);
    showOrders(active.length ? active : list, m2 ? `${esc(m2.name)}님의 ${active.length ? "진행 중인" : "최근"} 주문이에요.` : "확인하신 주문이에요."); return true;
  }
  if (when && !lookup) return false; // 비회원의 일반 배송 기간 질문은 자주 묻는 질문 답변으로
  say(`주문번호(<b>OR-</b>로 시작)를 알려 주시면 바로 확인해 드릴게요. 주문 완료 화면에 적혀 있어요.\n회원으로 주문하셨다면 로그인하시면 주문 목록을 바로 보여 드려요.` + chips([["로그인", "#login-order"]])); return true;
}
