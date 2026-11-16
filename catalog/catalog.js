// ============================================================
// 카리브무역 카탈로그 (catalog.html) — A4 페이지를 데이터로 자동 구성
// 데이터: catalog-data.js → data.js → core.js 의 PRODUCTS · OPTIONS · BRANDS · discSvg
// 상품이나 가격이 바뀌면 catalog-data.js 만 다시 만들면 카탈로그도 같이 바뀝니다.
// 홈페이지와 별개로 운영합니다 (사이트 메뉴에 연결 안 함, 배포에서도 제외).
// PDF 파일(catalog/caribe-catalog.pdf)은 catalog/build-pdf.js 로 다시 만듭니다.
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
      el.innerHTML = `<header class="pg-head"><img src="../assets/logo-navy.png" alt="CARIBE TRADING" /><span class="sec">${sec}${sub ? `<small>${sub}</small>` : ""}</span></header>
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
      <img class="cover-logo" src="../assets/logo-navy.png" alt="CARIBE TRADING 카리브무역" />
      <img class="cover-disc" src="../images/brake-discs/hero-disc-b.png" alt="" />
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
          <li><b>문의 · 주문</b><span>전화·문자 또는 이메일로 차대번호와 품번을 알려 주세요</span></li>
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
        <li><b>제품 사진 · 측면도</b> — 사진은 같은 형식 디스크의 대표 사진이며, 옆의 측면도에 품번별 외경·두께를 표시했습니다.</li>
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
      <figure class="base"><img src="../assets/chaos-before.jpg" alt="가공 전 디스크" /><figcaption><b>가공 전</b>홈이 없는 일반 디스크</figcaption></figure>
      <figure><img src="../assets/chaos-diag.jpg" alt="사선 타입" /><figcaption><b>사선 타입</b>같은 간격의 직선 홈. 깔끔하고 무난합니다.</figcaption></figure>
      <figure><img src="../assets/chaos-type-a.jpg" alt="A 타입" /><figcaption><b>A 타입</b>제각각인 곡선 홈. 개성이 강합니다.</figcaption></figure>
      <figure><img src="../assets/chaos-type-b.jpg" alt="B 타입" /><figcaption><b>B 타입</b>한 방향 V자 홈. 회전 방향이 있습니다.</figcaption></figure>
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
      <img src="../assets/fit-red-caliper.jpg" alt="빨간 캘리퍼와 가공 디스크" />
      <img src="../assets/fit-yellow-caliper.jpg" alt="노란 캘리퍼와 가공 디스크" />
      <img src="../assets/fit-installed.jpg" alt="차량에 장착한 가공 디스크" />
    </div>`;

  // ---------------- 4-1. 연구 자료 (외부 논문·특허 요약) ----------------
  // 출처: data/research-papers.js · data/literature-measurements.js (원문 대조한 값만)
  // 모두 각 논문의 시험편 결과이며 카리브무역 제품 시험 결과가 아닙니다 — 페이지마다 이 점을 밝힙니다.
  const PAPERS = window.RESEARCH_PAPERS || [], MEAS = window.LITERATURE_MEASUREMENTS || [], PLAN = window.TEST_PLAN;
  const paper = (id) => PAPERS.find((x) => x.id === id) || {};
  const meas = (id) => MEAS.find((x) => x.id === id);
  const REFS = ["SAE13", "GM", "TI16", "WEAR24", "B", "A", "C"].filter((id) => paper(id).id);
  const firstAuthor = (a) => { const x = String(a || "").split(/\s*[·,]\s*|\s+외/)[0].replace(/\s*\(.*$/, ""); return x + (String(a || "").length > x.length + 3 ? " 외" : ""); };
  const refNo = (id) => REFS.indexOf(id) + 1;
  const cite = (id) => `<sup class="ref">[${refNo(id)}]</sup>`;
  const NOT_OURS = "아래 내용은 공개된 논문·특허의 시험 결과를 요약한 것이며, 카리브무역 제품(카오스 가공)으로 시험한 결과가 아닙니다. 수치는 각 연구의 시편과 시험 조건에서 나온 값입니다.";

  const pR1 = page("research", "TECHNICAL NOTES", "연구 자료 ①");
  toc.push(["연구 자료", pageCount]);
  body(pR1).innerHTML = `
    <p class="kicker">Research</p>
    <h1 class="title">마찰면 홈 가공,<br />연구에서는 이렇게 나왔습니다</h1>
    <p class="lead">디스크 마찰면에 홈을 내는 가공은 고성능 차량에서 오래 써 온 방법입니다${cite("SAE13")}. 자동차 회사와 대학 연구진이 다이나모미터 시험으로 확인한 내용 가운데 정비 현장에서 참고할 만한 결과를 골랐습니다.</p>
    <div class="disclaim">${NOT_OURS}</div>
    <h2 class="sub">홈 가공 디스크 vs 무가공 디스크 <span class="note">GM 미국 특허 US 8,146,719 B2${cite("GM")} · 345 mm 벤틸레이티드 주철 디스크 다이나모미터 시험</span></h2>
    <div class="stats">
      <div class="stat"><span>페이드 구간 마찰계수</span><b>0.22 <i>→</i> 0.24</b><em>약 9% 높음</em><small>뜨거워진 상태에서도 제동력이 덜 떨어짐</small></div>
      <div class="stat"><span>페이드 중 제동 토크 변동</span><b>약 50% <i>↓</i></b><em>길이가 다른 홈</em><small>홈 길이를 제각각으로 했을 때 제동감이 고름</small></div>
      <div class="stat"><span>패드 편마모</span><b>22.6 <i>→</i> 13.0</b><em>µm/mm · 약 42% 적음</em><small>패드가 한쪽만 닳는 현상이 줄어듦</small></div>
      <div class="stat"><span>패드 마모량</span><b>차이 거의 없음</b><em>&nbsp;</em><small>홈을 내도 패드가 더 빨리 닳지 않음</small></div>
    </div>
    <h2 class="sub">그 밖의 연구 결과</h2>
    <div class="finds">
      <div class="find"><i>소음</i><b>마찰 소음(스퀼) 감소</b><p>디스크 면에 45° 홈을 내자 마찰 소음이 크게 줄었습니다. 홈이 마모 가루를 가두고 패드 접촉 압력을 고르게 나누기 때문으로 분석했습니다.${cite("TI16")}</p><small>Tribology International 102 (2016)</small></div>
      <div class="find"><i>빗길</i><b>젖은 뒤 제동력 회복이 빠름</b><p>물에 젖는 조건을 반복한 시험에서 홈 가공 디스크가 무가공보다 원래 마찰계수를 더 빨리 회복했고, 디스크 표면 마모 손상도 크게 줄었습니다. 마른 조건의 평균 마찰에는 영향이 거의 없었습니다.${cite("WEAR24")}</p><small>Wear 540 (2024) · 고속열차용 디스크 시편</small></div>
      <div class="find"><i>설계</i><b>홈의 개수·모양·방향이 중요</b><p>슬롯 디스크는 페이드 성능에 도움이 되며, 홈의 개수·형상·방향을 알맞게 설계해 소음과 패드 마모 부담을 줄이는 방향이 제시됐습니다.${cite("B")}</p><small>SAE 2018-01-1883 · 현대자동차 · 상신브레이크</small></div>
    </div>
    <h2 class="sub" style="margin-top:6mm">참고 문헌</h2>
    <ol class="refs">${REFS.map((id) => { const r = paper(id); return `<li>${esc(firstAuthor(r.authors))}. ${esc(r.titleEn || r.titleKo || "")}. <i>${esc(r.journal || "")}</i>${r.year ? ", " + r.year : ""}.${r.doi ? " doi:" + esc(r.doi) : ""}</li>`; }).join("")}</ol>`;

  // 연구 자료 ②: 국내 논문 표
  const pR2 = page("research", "TECHNICAL NOTES", "연구 자료 ②");
  const A = paper("A"), Cc = paper("C");
  const SER = ["관통 구멍", "홈(슬롯)", "관통+홈 복합"];
  const rowsA = [
    ["A-T5-mu-ramp", "최대 마찰계수 · Ramp stop", "높을수록 제동력 큼", 3, "max"],
    ["A-T5-mu-step", "최대 마찰계수 · Step stop", "높을수록 제동력 큼", 3, "max"],
    ["A-text-maxtemp", "최대 로터 온도 (°C)", "패턴 간 차이 7 °C 이내", 0, ""],
    ["A-T4-torque", "최대 제동 토크 평균 (Nm)", "3회 평균", 0, "max"],
    ["A-T4-hyst", "제동 토크 이력 비율 (%)", "낮을수록 제동감 일정", 1, "min"],
  ].map(([id, label, hint, d, best]) => {
    const m = meas(id); if (!m) return "";
    const v = m.values[0];
    const pick = best === "max" ? Math.max(...v) : best === "min" ? Math.min(...v) : null;
    return `<tr><th>${label}<small>${hint} · ${esc(m.location)}</small></th>${v.map((x) => `<td class="r${x === pick ? " best" : ""}">${x.toFixed(d)}</td>`).join("")}</tr>`;
  }).join("");
  const c1 = meas("C-T6-1p"), c2 = meas("C-T6-2p");
  const cSer = c1 ? c1.series.map((x) => x.label) : [];
  const hiIdx = c1 ? c1.groups.length - 1 : 0;
  const rowsC = [c1, c2].filter(Boolean).map((m, k) => {
    const v = m.values[hiIdx], pick = Math.max(...v);
    return `<tr><th>${k ? "이종 재질 (알루미늄 햇)" : "단일 재질 (주철)"}</th>${v.map((x) => `<td class="r${x === pick ? " best" : ""}">${fmt(Math.round(x))}</td>`).join("")}</tr>`;
  }).join("");
  body(pR2).innerHTML = `
    <p class="kicker">Domestic research</p>
    <h1 class="title">가공 형태별 다이나모미터 시험</h1>
    <p class="lead">인하대학교 기계공학과와 한양정밀 기술연구소가 같은 로트의 15인치 전륜 로터(외경 276 mm)에 관통 구멍, 홈, 관통+홈 복합 패턴을 가공해 FMVSS 135 · SAE J2521 절차로 비교했습니다.${cite("A")} 시험 장비는 ${esc(A.test ? A.test.equipment : "다이나모미터")}입니다.</p>
    <h2 class="sub">패턴별 시험 결과 <span class="note">한국자동차공학회 논문집 ${A.volume || ""}(${A.issue || ""}), ${A.year || ""}</span></h2>
    <table class="ptable rtable">
      <thead><tr><th>항목</th>${SER.map((x) => `<th class="r">${x}</th>`).join("")}</tr></thead>
      <tbody>${rowsA}</tbody>
    </table>
    <p class="note" style="margin-top:1.6mm">초록 칸은 해당 항목에서 가장 좋은 값입니다. 논문 표·본문에 인쇄된 값을 그대로 옮겼으며, 무가공 로터는 시험 대상에 없어 패턴끼리 비교한 결과입니다.</p>
    <div class="takeaways">
      <div><b>01</b><p><strong>홈(슬롯) 패턴</strong>은 Step stop 최대 마찰계수가 0.466으로 가장 높은 쪽이었습니다.</p></div>
      <div><b>02</b><p><strong>관통+홈 복합 패턴</strong>은 토크 이력 비율이 12.3%로 가장 낮아, 밟을 때와 뗄 때 제동감 차이가 가장 작았습니다.</p></div>
      <div><b>03</b><p>세 패턴의 최대 온도는 650~657 °C로, 가공 형태가 달라도 <strong>열 부담은 비슷</strong>했습니다.</p></div>
    </div>
    <h2 class="sub">후속 연구 — 이종 재질 로터 <span class="note">한국자동차공학회 논문집 ${Cc.volume || ""}(${Cc.issue || ""}), ${Cc.year || ""}${cite("C")}</span></h2>
    <div class="two" style="grid-template-columns:1.25fr 1fr;gap:6mm;align-items:start">
      <div>
        <table class="ptable rtable small-t">
          <thead><tr><th>평균 제동 토크 (Nm)<br />압력 ${esc(c1 ? c1.groups[hiIdx] : "")}</th>${cSer.map((x) => `<th class="r">${x}</th>`).join("")}</tr></thead>
          <tbody>${rowsC}</tbody>
        </table>
      </div>
      <p class="note" style="font-size:8.3pt">마찰면은 주철, 햇(가운데 부분)은 알루미늄(Al6061-T6)으로 만든 가벼운 로터에서도 같은 세 패턴을 비교했습니다. 높은 압력(10,600 kPa 이상) 구간에서는 이종 재질 로터의 제동 토크가 단일 재질과 같거나 더 높게 나왔습니다.</p>
    </div>
    ${PLAN ? `<div class="plan">
      <div class="plan-h"><b>카리브무역 자체 성능시험 계획</b><span>계획 단계 · 카오스 가공 타입별 결과는 공인 시험 후 공개</span></div>
      <p>${esc(PLAN.compare)}</p>
      <div class="plan-items">${PLAN.items.map((it) => `<div><b>${esc(it.name)}</b><span>${esc(it.what)}</span></div>`).join("")}</div>
      <p class="note">${PLAN.publishRules.map(esc).join(" · ")}</p>
    </div>` : ""}`;

  // ---------------- 5. 상품 카드 ----------------
  function chaosLine(p) {
    const os = optionsFor(p);
    if (!os.length) return `<div class="chaos">카오스 가공비 별도 견적</div>`;
    const get = (c) => { const o = os.find((x) => x.code.startsWith(c)); return o ? fmt(o.price * SET_SIZE) : "-"; };
    return `<div class="chaos">카오스 가공 추가 (1세트) 사선 <b>${get("CHAOS-D")}</b> · A <b>${get("CHAOS-A")}</b> · B <b>${get("CHAOS-B")}</b></div>`;
  }
  // ---------------- 제품 사진 + 측면도 ----------------
  // 품번 사진이 있으면 photos/photos.js 에 등록된 파일을, 없으면 대표 사진을 씁니다.
  const PHOTOS = window.CATALOG_PHOTOS || {};
  const BASE_PHOTO = "photos/base-disc.png"; // plain-disc.png 의 흰 배경을 지운 사진
  function edgeSvg(p) {
    const dia = parseFloat(p.dia) || 320, thk = parseFloat(p.thk) || 22, vented = thk >= 18;
    const H = 112, top = 9, cx = 30;
    const w = Math.max(7, Math.min(20, (thk / dia) * H * 2.2)); // 두께는 보기 쉽게 2.2배 과장
    const hatH = H * 0.5, hatD = 9;
    const x0 = cx - w / 2;
    let vents = "";
    if (vented) {
      const plate = w * 0.3, gx = x0 + plate, gw = w - plate * 2;
      vents = `<rect x="${gx.toFixed(2)}" y="${top + 2}" width="${gw.toFixed(2)}" height="${H - 4}" fill="url(#eVent)"/>`;
      for (let y = top + 5; y < top + H - 4; y += 4.2) vents += `<rect x="${gx.toFixed(2)}" y="${y.toFixed(1)}" width="${gw.toFixed(2)}" height="1.6" fill="#8d949b"/>`;
    }
    return `<svg class="edge" viewBox="0 0 64 ${H + 30}" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <defs>
        <linearGradient id="eMetal" x1="0" x2="1"><stop offset="0" stop-color="#7f868d"/><stop offset=".35" stop-color="#e9ecee"/><stop offset=".55" stop-color="#c3c8cd"/><stop offset="1" stop-color="#6f767d"/></linearGradient>
        <linearGradient id="eHat" x1="0" x2="1"><stop offset="0" stop-color="#5d646b"/><stop offset=".5" stop-color="#b9bec4"/><stop offset="1" stop-color="#5d646b"/></linearGradient>
        <linearGradient id="eVent" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stop-color="#2d3237"/><stop offset=".5" stop-color="#454b51"/><stop offset="1" stop-color="#2d3237"/></linearGradient>
      </defs>
      <rect x="${(x0 - hatD).toFixed(2)}" y="${(top + H / 2 - hatH / 2).toFixed(1)}" width="${hatD + 1}" height="${hatH.toFixed(1)}" rx="1.5" fill="url(#eHat)"/>
      <rect x="${x0.toFixed(2)}" y="${top}" width="${w.toFixed(2)}" height="${H}" rx="1.2" fill="url(#eMetal)"/>
      ${vents}
      <g stroke="#55615c" stroke-width=".6" fill="none">
        <line x1="${cx + w / 2 + 6}" y1="${top}" x2="${cx + w / 2 + 6}" y2="${top + H}"/>
        <line x1="${cx + w / 2 + 3.5}" y1="${top}" x2="${cx + w / 2 + 8.5}" y2="${top}"/><line x1="${cx + w / 2 + 3.5}" y1="${top + H}" x2="${cx + w / 2 + 8.5}" y2="${top + H}"/>
        <line x1="${x0}" y1="${top + H + 6}" x2="${x0 + w}" y2="${top + H + 6}"/>
        <line x1="${x0}" y1="${top + H + 3.5}" x2="${x0}" y2="${top + H + 8.5}"/><line x1="${x0 + w}" y1="${top + H + 3.5}" x2="${x0 + w}" y2="${top + H + 8.5}"/>
      </g>
      <text x="${cx + w / 2 + 9}" y="${top + H / 2}" fill="#1b2422" font-size="7.5" font-weight="700" font-family="IBM Plex Mono, monospace" transform="rotate(90 ${cx + w / 2 + 9} ${top + H / 2})" text-anchor="middle">Ø${p.dia || "?"}</text>
      <text x="${cx}" y="${top + H + 16}" fill="#1b2422" font-size="7.5" font-weight="700" font-family="IBM Plex Mono, monospace" text-anchor="middle">${p.thk || "?"}</text>
    </svg>`;
  }
  function photoFig(p) {
    const dia = parseFloat(p.dia) || 320;
    const scale = Math.max(78, Math.min(100, 78 + ((dia - 260) / 140) * 22)); // 외경에 따라 사진 크기 78~100%
    const own = PHOTOS[p.pn];
    return `<div class="ph-wrap"><img class="ph" src="${own ? "photos/" + own : BASE_PHOTO}" alt="브레이크 디스크 ${esc(p.pn)}" style="width:${scale.toFixed(0)}%" /></div>${edgeSvg(p)}${own ? "" : `<span class="ph-tag">대표 사진</span>`}`;
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
        <figure class="photo">${photoFig(p)}</figure>
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
      <img class="cover-logo" src="../assets/logo-navy.png" alt="CARIBE TRADING 카리브무역" />
      <h2>차대번호만 알려 주세요.<br />맞는 디스크를 찾아 드립니다.</h2>
      <p>카탈로그에 없는 품번, 브레이크 외 부품, 카오스 가공 상담도 같은 연락처로 받습니다. 차대번호와 필요한 품목을 문자나 이메일로 보내 주시면 확인해 답해 드립니다.</p>
      <div class="contact">
        <div><span>전화 · 문자</span><b class="big">${TEL}</b></div>
        <div><span>운영 시간</span><b>월~토 09:00 ~ 18:00</b></div>
        <div><span>이메일</span><b>${MAIL}</b></div>
        <div><span>주소</span><b>${ADDR}</b></div>
      </div>
      <img class="back-disc" src="../images/brake-discs/hero-disc-a.png" alt="" />
      <div class="legal">(주)카리브무역 | 대표 김철민 | 사업자등록번호 608-86-12959 | 통신판매업 신고 제2023-울산남구-1093호<br />
        가격 기준일 ${PRICE_DATE} · VAT 포함 · 2장 1세트. 가격과 적용 차종은 사정에 따라 바뀔 수 있으니 주문 전에 확인해 주십시오.<br />
        제품 사진은 대표 이미지이며 품번별 실제 외관(햇 높이·볼트 구멍 수 등)은 다를 수 있습니다.<br />
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
