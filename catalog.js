// ============================================================
// 카리브무역 카탈로그 (catalog.html) — A4 페이지를 데이터로 자동 구성
// 데이터: catalog-data.js → data.js → core.js 의 PRODUCTS · OPTIONS · BRANDS · discSvg
// 상품이나 가격이 바뀌면 catalog-data.js 만 다시 만들면 카탈로그도 같이 바뀝니다.
// PDF 파일(caribe-catalog.pdf)은 tools/build-catalog-pdf.js 로 다시 만듭니다.
// ============================================================
// 쪽 나눔은 글자 크기로 재므로, 웹 글꼴을 먼저 불러온 뒤 만듭니다.
(function () {
  const want = ["400", "600", "700", "800", "900"].map((w) => `${w} 12px "Gothic A1"`).concat(['600 12px "IBM Plex Mono"']);
  const load = document.fonts ? Promise.all(want.map((f) => document.fonts.load(f, "가A0").catch(() => null))) : Promise.resolve();
  Promise.race([load, new Promise((r) => setTimeout(r, 4000))]).then(build);
})();

function build() {
  "use strict";
  const book = document.getElementById("book");
  const PER_PAGE = 6;
  const HOT = 20; // 판매장부 기준 이 수량 이상이면 '많이 찾는 품번'
  const TEL = "010-5459-3111", MAIL = "caribetrading@naver.com", ADDR = "울산광역시 북구 진장로 16";
  const PRICE_DATE = C.generatedAt || "";
  const pad = (n) => String(n).padStart(2, "0");
  const fmt = (n) => n.toLocaleString("ko-KR");
  const BRAND_ADD = (BRANDS.find((b) => b.code === "BREMBO") || { add: 0 }).add;

  // ---------------- 상품 정리 ----------------
  const makeOrder = (m) => { const i = MAKES.indexOf(m); return i < 0 ? 99 : i; };
  const LIST = PRODUCTS.filter((p) => p.rows.length);
  LIST.forEach((p) => {
    const cnt = {}, tree = new Map(); // make → group → Set(섀시코드)
    p.rows.forEach((r) => {
      cnt[r.make] = (cnt[r.make] || 0) + 1;
      if (!tree.has(r.make)) tree.set(r.make, new Map());
      const g = tree.get(r.make);
      if (!g.has(r.group)) g.set(r.group, new Set());
      (r.chassis.length ? r.chassis : [r.body]).forEach((c) => g.get(r.group).add(c));
    });
    p._makes = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || makeOrder(a) - makeOrder(b));
    p._tree = tree;
  });
  LIST.sort((a, b) =>
    makeOrder(a._makes[0]) - makeOrder(b._makes[0]) ||
    (a.axle === b.axle ? 0 : a.axle === "front" ? -1 : 1) ||
    (parseFloat(a.dia) || 0) - (parseFloat(b.dia) || 0) ||
    a.pn.localeCompare(b.pn));
  LIST.forEach((p, i) => { p._no = i + 1; });

  // ---------------- 페이지 틀 ----------------
  let pageCount = 0;
  const toc = []; // [제목, 시작 페이지]
  function page(cls, sec, sub) {
    pageCount++;
    const el = document.createElement("section");
    el.className = "page " + (cls || "");
    if (sec) {
      el.innerHTML = `<header class="pg-head"><img src="assets/logo-navy.png" alt="CARIBE TRADING" /><span class="sec">${sec}${sub ? `<small>${sub}</small>` : ""}</span></header>
        <div class="pg-body"></div>
        <footer class="pg-foot"><span>(주)카리브무역 · ${TEL} · ${MAIL}</span><b>${pad(pageCount)}</b></footer>`;
    }
    book.appendChild(el);
    return el;
  }
  const body = (el) => el.querySelector(".pg-body");

  // ---------------- 1. 표지 ----------------
  const makeSet = new Set(LIST.flatMap((p) => p._makes));
  const modelSet = new Set(), bodySet = new Set();
  LIST.forEach((p) => p.rows.forEach((r) => { modelSet.add(r.make + "|" + r.group); bodySet.add(r.make + "|" + r.body); }));
  page("cover").innerHTML = `<div class="cover-in">
      <img class="cover-logo" src="assets/logo-navy.png" alt="CARIBE TRADING 카리브무역" />
      <img class="cover-disc" src="images/brake-discs/hero-disc-b.png" alt="" />
      <div class="cover-txt">
        <p class="kicker">Brake Disc Catalog ${PRICE_DATE.slice(0, 4)}</p>
        <h1>수입차<br />브레이크 디스크<br />&amp; 카오스 가공</h1>
        <p>차대번호와 OEM 품번으로 맞는 디스크를 찾아 정비 현장에 공급합니다.</p>
      </div>
      <div class="cover-stats">
        <div><b>${LIST.length}종</b><span>등록 디스크</span></div>
        <div><b>${makeSet.size}개</b><span>적용 제조사</span></div>
        <div><b>${modelSet.size}개</b><span>적용 모델</span></div>
        <div><b>${bodySet.size}개</b><span>차체·세대</span></div>
      </div>
      <div class="cover-meta"><span>(주)카리브무역 CARIBE TRADING</span><span>가격 기준일 ${PRICE_DATE}</span></div>
    </div>`;

  // ---------------- 2. 회사 소개 + 목차 ----------------
  const pAbout = page("", "COMPANY", "회사 소개");
  toc.push(["회사 소개", pageCount]);
  body(pAbout).innerHTML = `<div class="about-grid">
    <div>
      <p class="kicker">About us</p>
      <h1 class="title">수입차 부품 유통 전문기업<br />카리브무역</h1>
      <p class="lead">2023년 설립 이후 수입차 부품 유통과 브레이크 디스크 가공 사업을 운영하고 있습니다. 수리 차량에 정확한 부품을 매칭해 정비 현장에 빠르게 공급합니다.</p>
      <h2 class="sub">사업 분야</h2>
      <div class="biz">
        <div><b><em>운영</em>B2B 부품 공급</b><span>수입차 정비업체·카센터에 브레이크, 필터, 하체, 전장 부품 납품</span></div>
        <div><b><em>운영</em>온라인 판매</b><span>온라인 스토어 종합관과 브레이크 전문관 운영</span></div>
        <div><b><em>운영</em>해외 직소싱</b><span>유럽·미국·중국 공급망에서 부품을 직접 조달</span></div>
        <div><b><em>운영</em>카오스 가공 디스크</b><span>브레이크 디스크 마찰면 홈 가공 (사선, A, B 타입)</span></div>
        <div><b><em class="dev">개발</em>AI 부품 매칭 플랫폼</b><span>차대번호·OEM 품번 기반 부품 검색과 상담</span></div>
        <div><b><em class="dev">예정</em>정비 네트워크</b><span>부품 공급과 정비 서비스를 잇는 지역 네트워크</span></div>
      </div>
      <h2 class="sub">핵심 경쟁력</h2>
      <ol class="strength">
        <li><div><b>차대번호 기반 부품 매칭</b><span>차대번호와 OEM 품번 검증으로 오배송 최소화</span></div></li>
        <li><div><b>정품 및 대체품 제안</b><span>예산과 용도에 맞는 부품 제안</span></div></li>
        <li><div><b>글로벌 소싱</b><span>국내 재고와 해외 조달을 병행해 안정적으로 공급</span></div></li>
        <li><div><b>지역 밀착 대응</b><span>울산·포항·경주 지역 정비업체 신속 대응</span></div></li>
      </ol>
    </div>
    <aside class="side">
      <h3>회사 개요</h3>
      <table class="facts">
        <tr><th>회사명</th><td>(주)카리브무역<br />CARIBE TRADING</td></tr>
        <tr><th>대표자</th><td>김철민</td></tr>
        <tr><th>설립일</th><td>2023년 11월 22일</td></tr>
        <tr><th>사업자번호</th><td>608-86-12959</td></tr>
        <tr><th>소재지</th><td>${ADDR}</td></tr>
        <tr><th>영업 지역</th><td>울산·포항·경주, 전국 온라인</td></tr>
        <tr><th>주요 고객</th><td>수입차 정비업체, 카센터, 부품 판매업체, 차량 소유자</td></tr>
      </table>
      <h3>취급 차종</h3>
      <div class="chips">${["Mercedes-Benz", "BMW", "Audi", "Volkswagen", "Porsche", "MINI", "Land Rover", "Volvo", "Lexus", "Toyota", "Ford", "Jeep", "Chrysler", "Dodge", "Maserati", "Peugeot", "Citroën", "DS", "Opel", "SEAT", "Skoda", "Lancia"].map((s) => `<span>${s}</span>`).join("")}</div>
      <h3>취급 부품 브랜드</h3>
      <div class="chips">${["Brembo", "TRW", "MANN-FILTER", "MAHLE", "Hengst", "febi bilstein", "INA", "LuK", "Lemförder", "VAICO", "Corteco", "NRF", "Delphi"].map((s) => `<span>${s}</span>`).join("")}</div>
      <div class="toc"><h3>CONTENTS</h3><ol id="tocList"></ol></div>
    </aside>
  </div>`;

  // ---------------- 3. 주문 안내 ----------------
  const pOrder = page("order", "ORDER GUIDE", "주문 안내");
  toc.push(["주문 안내 · 가격 기준", pageCount]);
  body(pOrder).innerHTML = `
    <p class="kicker">How to order</p>
    <h1 class="title">맞는 디스크를 찾는 세 가지 방법</h1>
    <p class="lead">같은 차종이라도 엔진·브레이크 사양에 따라 디스크가 다릅니다. 주문할 때 차대번호를 함께 알려 주시면 적용 여부를 확인한 뒤 출고합니다.</p>
    <div class="ways">
      <div class="way"><i>VIN</i><b>차대번호로 찾기</b><p>자동차등록증에 적힌 17자리 차대번호로 차종·연식을 확인합니다.</p><code>WDD2130421A123456</code></div>
      <div class="way"><i>#</i><b>OEM 품번으로 찾기</b><p>기존 디스크에 찍힌 순정 품번을 그대로 알려 주시면 됩니다.</p><code>0004231812</code></div>
      <div class="way"><i>▤</i><b>차종으로 찾기</b><p>카탈로그 뒤쪽 <b>차종별 색인</b>에서 제조사 → 모델 → 세대 순으로 찾습니다.</p><code>E-CLASS (W213)</code></div>
    </div>
    <div class="two">
      <div>
        <h2 class="sub">가격 기준</h2>
        <table class="ptable">
          <thead><tr><th>항목</th><th>기준</th></tr></thead>
          <tbody>
            <tr><th>판매 단위</th><td>2장 1세트 (한 축 좌·우)</td></tr>
            <tr><th>표시 가격</th><td>1세트 가격, VAT 포함</td></tr>
            <tr><th>기본 브랜드</th><td>COLUMN</td></tr>
            <tr><th>BREMBO 선택</th><td>1장당 +${fmt(BRAND_ADD)}원 (세트 +${fmt(BRAND_ADD * SET_SIZE)}원)</td></tr>
            <tr><th>카오스 가공</th><td>디스크 외경·타입별 가공비 추가</td></tr>
            <tr><th>가격 문의</th><td>가격이 없는 품번은 재고·조달 확인 후 안내</td></tr>
          </tbody>
        </table>
        <div class="callout"><b>찾는 품번이 카탈로그에 없나요?</b><br />차대번호와 필요 품목을 알려 주시면 국내 재고와 해외 조달 가능 여부를 확인해 답해 드립니다.</div>
      </div>
      <div>
        <h2 class="sub">주문부터 출고까지</h2>
        <ol class="steps">
          <li><b>문의 · 주문</b><span>전화, 이메일, 홈페이지 장바구니 또는 AI 상담으로 접수</span></li>
          <li><b>적용 확인</b><span>차대번호와 OEM 품번으로 차량에 맞는지 확인</span></li>
          <li><b>결제 안내</b><span>확인이 끝나면 금액과 결제 방법(무통장 입금)을 안내</span></li>
          <li><b>출고 준비</b><span>가공 주문은 패턴 가공과 치수·외관 검사 후 출고</span></li>
          <li><b>배송</b><span>정비업체나 고객에게 택배로 발송</span></li>
        </ol>
      </div>
    </div>
    <div class="howto">
      <h2 class="sub">상품 카드 보는 법</h2>
      <ol>
        <li><b>번호</b> — 차종별 색인에 적힌 번호와 같습니다.</li>
        <li><b>위치</b> — 앞(전륜) 또는 뒤(후륜) 디스크.</li>
        <li><b>OEM 품번</b> — 순정 부품 번호. 주문·문의 때 이 번호로 말씀해 주세요.</li>
        <li><b>규격 도면</b> — 외경·두께·최소 두께를 반영한 예시 도면 (실물 사진 아님).</li>
        <li><b>가격</b> — 2장 1세트, VAT 포함. 카오스 가공비는 세트 기준 추가 금액.</li>
        <li><b>적용 차종</b> — 제조사·모델·섀시코드. 칸에 다 싣지 못한 차종은 색인에 있습니다.</li>
      </ol>
    </div>`;

  // ---------------- 4. 카오스 가공 ----------------
  const pChaos = page("", "CHAOS MACHINING", "카오스 가공");
  toc.push(["카오스 가공", pageCount]);
  const optPrice = (code, i) => { const o = OPTIONS.find((x) => x.code === `${code}-${i}`); return o ? fmt(o.price * SET_SIZE) : "견적"; };
  const tiers = [1, 2, 3, 4];
  body(pChaos).innerHTML = `
    <p class="kicker">Chaos machining</p>
    <h1 class="title">휠 사이로 보이는 디스크가 달라집니다</h1>
    <p class="lead">브레이크 디스크 마찰면에 홈 패턴을 새기는 카오스 가공. 사선, A, B 세 가지 타입 가운데 휠에 어울리는 것을 고르면 차량 규격에 맞춰 가공해 보냅니다.</p>
    <div class="ctypes">
      <figure class="base"><img src="assets/chaos-before.jpg" alt="가공 전 디스크" /><figcaption><b>가공 전</b>홈이 없는 일반 디스크</figcaption></figure>
      <figure><img src="assets/chaos-diag.jpg" alt="사선 타입" /><figcaption><b>사선 타입</b>같은 간격의 직선 홈. 깔끔하고 무난합니다.</figcaption></figure>
      <figure><img src="assets/chaos-type-a.jpg" alt="A 타입" /><figcaption><b>A 타입</b>제각각인 곡선 홈. 개성이 강합니다.</figcaption></figure>
      <figure><img src="assets/chaos-type-b.jpg" alt="B 타입" /><figcaption><b>B 타입</b>한 방향 V자 홈. 회전 방향이 있습니다.</figcaption></figure>
    </div>
    <div class="two">
      <div>
        <h2 class="sub">가공비 <span class="note">(원, 2장 1세트, VAT 포함)</span></h2>
        <table class="ptable">
          <thead><tr><th>디스크 외경</th><th class="r">300 이하</th><th class="r">301~330</th><th class="r">331~350</th><th class="r">351 이상</th></tr></thead>
          <tbody>
            ${CHAOS_TYPES.map((t) => `<tr><th>${t.name}</th>${tiers.map((i) => `<td class="r">${optPrice(t.code, i)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
        <p class="note" style="margin-top:2.5mm">새 디스크와 함께 주문하면 가공을 마친 뒤 출고합니다. 상품 카드마다 해당 외경의 가공비가 적혀 있습니다.</p>
      </div>
      <div>
        <h2 class="sub">이렇게 고르세요</h2>
        <ol class="steps">
          <li><b>스포크가 얇은 휠</b><span>디스크가 넓게 보여 가공 효과가 큽니다.</span></li>
          <li><b>캘리퍼 도색과 함께</b><span>빨강·노랑 캘리퍼와 같이 하면 더 눈에 띕니다.</span></li>
          <li><b>휠 사진으로 상담</b><span>휠 사진을 보내 주시면 어울리는 타입을 같이 봅니다.</span></li>
        </ol>
      </div>
    </div>
    <div class="fitph">
      <img src="assets/fit-red-caliper.jpg" alt="빨간 캘리퍼와 가공 디스크" />
      <img src="assets/fit-yellow-caliper.jpg" alt="노란 캘리퍼와 가공 디스크" />
      <img src="assets/fit-installed.jpg" alt="차량에 장착한 가공 디스크" />
    </div>`;

  // ---------------- 5. 상품 카드 ----------------
  function chaosLine(p) {
    const os = optionsFor(p);
    if (!os.length) return `<div class="chaos">카오스 가공비 별도 견적</div>`;
    const get = (c) => { const o = os.find((x) => x.code.startsWith(c)); return o ? fmt(o.price * SET_SIZE) : "-"; };
    return `<div class="chaos">카오스 가공 추가 (1세트) 사선 <b>${get("CHAOS-D")}</b> · A <b>${get("CHAOS-A")}</b> · B <b>${get("CHAOS-B")}</b></div>`;
  }
  function card(p) {
    const vented = (parseFloat(p.thk) || 0) >= 18;
    const price = p.price
      ? `<div class="pr main"><span>COLUMN · 1세트</span><b>${fmt(brandPrice(p, "COLUMN") * SET_SIZE)}원</b></div>
         <div class="pr"><span>BREMBO · 1세트</span><b>${fmt(brandPrice(p, "BREMBO") * SET_SIZE)}원</b></div>`
      : `<div class="pr ask"><span>COLUMN / BREMBO</span><b>가격 문의</b></div><div class="pr"><span>재고·조달 확인 후</span><b>안내</b></div>`;
    const fit = [];
    p._makes.forEach((m) => {
      [...p._tree.get(m).entries()].sort((a, b) => b[1].size - a[1].size).forEach(([g, codes]) => {
        fit.push(`<div><b>${esc(makeKo(m))} ${esc(g)}</b><span>${[...codes].map(esc).join(" · ")}</span></div>`);
      });
    });
    return `<article class="card" data-no="${p._no}">
      <div class="card-top"><span class="no">${pad(p._no)}</span><span class="ax ${p.axle}">${p.axle === "front" ? "앞 FRONT" : "뒤 REAR"}</span>${p.sold >= HOT ? `<span class="hot">많이 찾는 품번</span>` : ""}<span class="pn">${esc(p.pn)}</span></div>
      <div class="card-mid">
        <figure>${discSvg(p)}</figure>
        <table class="spec">
          <tr><th>외경 × 두께</th><td class="m">${p.dia ? esc(p.dia) : "?"} × ${p.thk ? esc(p.thk) : "?"} mm</td></tr>
          <tr><th>최소 두께</th><td class="m">${p.min ? esc(p.min) + " mm" : "-"}</td></tr>
          <tr><th>형식</th><td>${vented ? "벤틸레이티드" : "솔리드"}</td></tr>
          <tr><th>COLUMN 품번</th><td class="m">${p.col ? esc(p.col) : "-"}</td></tr>
        </table>
      </div>
      <div class="price"><div class="prs">${price}</div>${chaosLine(p)}</div>
      <div class="fit"><h5>적용 차종</h5>${fit.join("")}</div>
    </article>`;
  }
  // 적용 차종이 칸을 넘치면 넘친 줄을 빼고 '외 N개 → 색인' 표시
  function trimFit(cardEl) {
    const box = cardEl.querySelector(".fit");
    const lines = [...box.querySelectorAll("div")];
    if (box.scrollHeight <= box.clientHeight + 1) return;
    let removed = 0;
    const more = document.createElement("span");
    more.className = "more";
    box.appendChild(more);
    while (box.scrollHeight > box.clientHeight + 1 && lines.length > 1) {
      lines.pop().remove(); removed++;
      more.textContent = `외 ${removed}개 모델 — 차종별 색인 참고`;
    }
  }

  const firstProductPage = pageCount + 1;
  const makesOnPage = (items) => [...new Set(items.map((p) => makeKo(p._makes[0])))].join(" · ");
  for (let i = 0; i < LIST.length; i += PER_PAGE) {
    const items = LIST.slice(i, i + PER_PAGE);
    const el = page("", "PRODUCTS", `브레이크 디스크 ${pad(items[0]._no)}–${pad(items[items.length - 1]._no)} · ${makesOnPage(items)}`);
    items.forEach((p) => { p._page = pageCount; });
    body(el).innerHTML = `<div class="pgrid">${items.map(card).join("")}</div>`;
  }
  toc.push([`브레이크 디스크 ${LIST.length}종`, firstProductPage]);

  // ---------------- 6. 차종별 색인 ----------------
  // 제조사 → 모델 → 차체(세대) 별로 앞·뒤 디스크 번호
  const idx = new Map();
  LIST.forEach((p) => p.rows.forEach((r) => {
    const key = r.make;
    if (!idx.has(key)) idx.set(key, new Map());
    const g = idx.get(key);
    if (!g.has(r.group)) g.set(r.group, new Map());
    const b = g.get(r.group);
    if (!b.has(r.body)) b.set(r.body, { front: new Set(), rear: new Set(), from: "9999", to: "" , open: false });
    const e = b.get(r.body);
    e[p.axle === "front" ? "front" : "rear"].add(p._no);
    if (r.from && r.from < e.from) e.from = r.from;
    if (!r.to) e.open = true; else if (r.to > e.to) e.to = r.to;
  }));
  const nums = (set) => [...set].sort((a, b) => a - b).map(pad).join(" ");
  const items = [];
  [...idx.keys()].sort((a, b) => makeOrder(a) - makeOrder(b)).forEach((m) => {
    const groups = idx.get(m);
    items.push({ head: 2, html: `<div class="ix-make"><span>${esc(makeKo(m))}</span><small>${esc(m)}</small></div>` });
    [...groups.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true })).forEach((g) => {
      items.push({ head: 1, html: `<div class="ix-grp">${esc(g)}</div>` });
      [...groups.get(g).entries()].sort((a, b) => a[1].from.localeCompare(b[1].from)).forEach(([bd, e]) => {
        const yrs = `${e.from === "9999" ? "?" : e.from} ~ ${e.open ? "현재" : e.to || "?"}`;
        items.push({ head: 0, html: `<div class="ix-row"><span class="nm"><b>${esc(bd)}</b><small>${yrs}</small></span><span class="n">${nums(e.front)}</span><span class="n">${nums(e.rear)}</span></div>` });
      });
    });
  });
  const firstIndexPage = pageCount + 1;
  const colHead = `<div class="ix-head"><span>모델 · 차체(섀시코드) · 생산 연월</span><span>앞 디스크</span><span>뒤 디스크</span></div>`;
  let cols = [], ci = 2;
  const newIndexPage = () => {
    const el = page("", "VEHICLE INDEX", "차종별 색인 — 번호는 상품 카드 번호");
    body(el).innerHTML = `<div class="ix-cols"><div class="ix-col">${colHead}</div><div class="ix-col">${colHead}</div></div>`;
    cols = [...el.querySelectorAll(".ix-col")]; ci = 0;
  };
  const over = (c) => c.scrollHeight > c.clientHeight + 1;
  items.forEach((it, k) => {
    if (ci > 1) newIndexPage();
    let col = cols[ci];
    col.insertAdjacentHTML("beforeend", it.html);
    if (!over(col)) return;
    // 넘치면: 이 항목과, 바로 위에 붙어 있던 제목들을 다음 칸으로
    const move = [col.lastElementChild];
    col.lastElementChild.remove();
    while (col.lastElementChild && /ix-make|ix-grp/.test(col.lastElementChild.className)) { move.unshift(col.lastElementChild); col.lastElementChild.remove(); }
    // 다음 칸 첫머리에 모델 이름이 없으면 '(계속)'으로 다시 표시
    const prevGrp = [...col.querySelectorAll(".ix-grp, .ix-make")];
    ci++; if (ci > 1) newIndexPage();
    col = cols[ci];
    if (!/ix-make/.test(move[0].className)) {
      const lastMake = [...prevGrp].reverse().find((x) => x.classList.contains("ix-make"));
      const lastGrp = [...prevGrp].reverse().find((x) => x.classList.contains("ix-grp"));
      if (lastMake) col.insertAdjacentHTML("beforeend", lastMake.outerHTML.replace("</span>", " (계속)</span>"));
      if (!/ix-grp/.test(move[0].className) && lastGrp) col.insertAdjacentHTML("beforeend", lastGrp.outerHTML);
    }
    move.forEach((n) => col.appendChild(n));
  });
  toc.push(["차종별 색인", firstIndexPage]);

  // ---------------- 7. 뒤표지 ----------------
  page("back").innerHTML = `<div class="back-in">
      <img class="cover-logo" src="assets/logo-navy.png" alt="CARIBE TRADING 카리브무역" />
      <h2>차대번호만 알려 주세요.<br />맞는 디스크를 찾아 드립니다.</h2>
      <p>카탈로그에 없는 품번, 브레이크 외 부품, 카오스 가공 상담도 같은 연락처로 받습니다. 홈페이지에서는 차대번호·품번 검색과 AI 상담, 장바구니 주문을 할 수 있습니다.</p>
      <div class="contact">
        <div><span>전화 · 문자</span><b class="big">${TEL}</b></div>
        <div><span>운영 시간</span><b>월~토 09:00 ~ 18:00</b></div>
        <div><span>이메일</span><b>${MAIL}</b></div>
        <div><span>주소</span><b>${ADDR}</b></div>
      </div>
      <img class="back-disc" src="images/brake-discs/hero-disc-a.png" alt="" />
      <div class="legal">(주)카리브무역 | 대표 김철민 | 사업자등록번호 608-86-12959 | 통신판매업 신고 제2023-울산남구-1093호<br />
        가격 기준일 ${PRICE_DATE} · VAT 포함 · 2장 1세트. 가격과 적용 차종은 사정에 따라 바뀔 수 있으니 주문 전에 확인해 주십시오.<br />
        규격 도면은 품번별 치수를 반영한 예시이며 실제 제품 사진이 아닙니다.<br />
        © ${PRICE_DATE.slice(0, 4)} CARIBE TRADING. All rights reserved.</div>
    </div>`;

  // ---------------- 마무리 ----------------
  toc.push(["연락처", pageCount]);
  document.getElementById("tocList").innerHTML = toc.map(([t, n]) => `<li><span>${t}</span><b>${pad(n)}</b></li>`).join("");
  document.getElementById("catInfo").textContent = `A4 ${pageCount}쪽 · 디스크 ${LIST.length}종 · 가격 기준일 ${PRICE_DATE}`;

  // 넘치는 적용 차종 줄 정리. 끝나면 data-ready 표시 (PDF 만들 때 이 표시를 기다림)
  document.querySelectorAll(".card").forEach(trimFit);
  document.querySelectorAll(".pg-body").forEach((b, i) => {
    const kids = [...b.querySelectorAll(":scope > *")];
    const bottom = Math.max(0, ...kids.map((k) => k.getBoundingClientRect().bottom));
    if (bottom > b.getBoundingClientRect().bottom + 1) console.warn("넘침:", b.closest(".page").querySelector(".pg-foot b")?.textContent);
  });
  document.body.dataset.ready = "1";
}
