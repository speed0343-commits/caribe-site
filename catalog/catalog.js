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
  const ROOT = window.CATALOG_ROOT ?? "../"; // 저장소 파일 위치 (게시용 미리보기 페이지에서는 "")
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
      el.innerHTML = `<header class="pg-head"><span class="hd-brand"><img src="${ROOT}assets/logo-navy.png" alt="CARIBE TRADING" /><span class="hd-co">주식회사 카리브무역</span></span><span class="sec">${sec}${sub ? `<small>${sub}</small>` : ""}</span></header>
        <div class="pg-body"></div>
        <footer class="pg-foot"><span>주식회사 카리브무역 · T. ${TEL} · E. ${MAIL}</span><b>${pad(pageCount)}</b></footer>`;
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
      <div class="cover-brand"><img class="cover-logo" src="brand/logo-silver.png" alt="CARIBE TRADING" /><span class="co-name">주식회사 카리브무역</span></div>
      <img class="cover-disc" src="${ROOT}images/brake-discs/hero-disc-b.png" alt="" />
      <div class="cover-txt">
        <p class="kicker">B2B Brake Disc Catalog ${PRICE_DATE.slice(0, 4)}</p>
        <h1>수입차<br />브레이크 디스크<br />&amp; 카오스 가공</h1>
        <p>수입차 정비업체·부품 판매업체를 위한 브레이크 디스크 공급 카탈로그. 차대번호·OEM 품번 기반의 정확한 매칭으로 공급합니다.</p>
      </div>
      <div class="cover-stats">
        <div><b>${LIST.length}종</b><span>등록 디스크</span></div>
        <div><b>${makeSet.size}개</b><span>적용 제조사</span></div>
        <div><b>${modelSet.size}개</b><span>적용 모델</span></div>
        <div><b>${bodySet.size}개</b><span>적용 차체·세대</span></div>
      </div>
      <div class="cover-meta"><span>CARIBE TRADING · 수입차 부품 유통 · 브레이크 디스크 가공</span><span>가격 기준일 ${PRICE_DATE}</span></div>
    </div>`;

  // ---------------- 2. 회사 소개 + 목차 ----------------
  const pAbout = page("", "COMPANY", "회사 소개");
  toc.push(["회사 소개", pageCount]);
  body(pAbout).innerHTML = `<div class="about-grid">
    <div>
      <p class="kicker">About us</p>
      <h1 class="title">수입차 부품 유통 전문기업<br />주식회사 카리브무역</h1>
      <p class="lead">주식회사 카리브무역은 2023년 설립 이래 수입차 부품 유통과 브레이크 디스크 가공을 전문으로 하고 있습니다. 차대번호와 OEM 품번에 기반한 정확한 부품 매칭으로 정비 현장에 신속하게 공급합니다.</p>
      <h2 class="sub">사업 분야</h2>
      <div class="biz">
        <div><b><em>운영 중</em>B2B 부품 공급</b><span>수입차 정비업체·카센터 대상 브레이크·필터·하체·전장 부품 납품</span></div>
        <div><b><em>운영 중</em>온라인 판매</b><span>온라인 스토어 종합관 및 브레이크 전문관 운영</span></div>
        <div><b><em>운영 중</em>해외 직소싱</b><span>유럽·미국·중국 공급망을 통한 부품 직접 조달</span></div>
        <div><b><em>운영 중</em>카오스 가공 디스크</b><span>브레이크 디스크 마찰면 패턴 가공 (사선·A·B 타입)</span></div>
        <div><b><em class="dev">개발 중</em>AI 부품 매칭 플랫폼</b><span>차대번호·OEM 품번 기반 부품 검색 및 상담 시스템</span></div>
        <div><b><em class="dev">추진 예정</em>정비 네트워크</b><span>부품 공급과 정비 서비스를 연계하는 지역 네트워크 구축</span></div>
      </div>
      <h2 class="sub">핵심 경쟁력</h2>
      <ol class="strength">
        <li><div><b>차대번호 기반 부품 매칭</b><span>차대번호·OEM 품번 이중 확인으로 오배송 최소화</span></div></li>
        <li><div><b>정품 및 대체품 제안</b><span>고객의 예산과 용도에 맞춘 정품·대체품 제안</span></div></li>
        <li><div><b>글로벌 소싱</b><span>국내 재고와 해외 조달 병행으로 안정적인 공급</span></div></li>
        <li><div><b>지역 밀착 대응</b><span>울산·포항·경주 지역 정비업체 대상 신속 대응</span></div></li>
      </ol>
    </div>
    <aside class="side">
      <h3>회사 개요</h3>
      <table class="facts">
        <tr><th>회사명</th><td>주식회사 카리브무역<br />CARIBE TRADING</td></tr>
        <tr><th>대표자</th><td>김철민</td></tr>
        <tr><th>설립일</th><td>2023년 11월 22일</td></tr>
        <tr><th>사업자등록번호</th><td>608-86-12959</td></tr>
        <tr><th>소재지</th><td>${ADDR}</td></tr>
        <tr><th>영업 지역</th><td>울산·포항·경주 및 전국 (온라인)</td></tr>
        <tr><th>주요 거래처</th><td>수입차 전문 정비업체, 카센터, 부품 판매업체</td></tr>
      </table>
      <h3>취급 차종</h3>
      <div class="chips">${["Mercedes-Benz", "BMW", "Audi", "Volkswagen", "Porsche", "MINI", "Land Rover", "Volvo", "Lexus", "Toyota", "Ford", "Jeep", "Chrysler", "Dodge", "Maserati", "Peugeot", "Citroën", "DS", "Opel", "SEAT", "Skoda", "Lancia"].map((s) => `<span>${s}</span>`).join("")}</div>
      <h3>취급 부품 브랜드</h3>
      <div class="chips">${["Brembo", "TRW", "MANN-FILTER", "MAHLE", "Hengst", "febi bilstein", "INA", "LuK", "Lemförder", "VAICO", "Corteco", "NRF", "Delphi"].map((s) => `<span>${s}</span>`).join("")}</div>
      <div class="toc"><h3>CONTENTS</h3><ol id="tocList"></ol></div>
    </aside>
  </div>`;

  // ---------------- 3. 주문 안내 ----------------
  const pOrder = page("order", "TRADE GUIDE", "거래 안내");
  toc.push(["거래 안내 · 가격", pageCount]);
  body(pOrder).innerHTML = `
    <p class="kicker">Trade guide</p>
    <h1 class="title">거래처 주문 안내</h1>
    <p class="lead">동일 차종이라도 엔진 및 브레이크 사양에 따라 적용 디스크가 다릅니다. 발주 시 입고 차량의 차대번호를 함께 알려 주시면 적용 여부를 확인한 후 출고합니다.</p>
    <div class="ways">
      <div class="way"><i>VIN</i><b>차대번호 조회</b><p>자동차등록증에 기재된 17자리 차대번호로 차종과 연식을 확인합니다.</p><code>WDD2130421A123456</code></div>
      <div class="way"><i>#</i><b>OEM 품번 조회</b><p>장착된 디스크에 각인된 순정 품번으로 적용 제품을 확인합니다.</p><code>0004231812</code></div>
      <div class="way"><i>▤</i><b>차종별 색인</b><p>본 카탈로그의 <strong>차종별 색인</strong>에서 제조사 → 모델 → 세대 순으로 확인합니다.</p><code>E-CLASS (W213)</code></div>
    </div>
    <div class="two">
      <div>
        <h2 class="sub">가격 및 거래 조건</h2>
        <table class="ptable">
          <thead><tr><th>구분</th><th>내용</th></tr></thead>
          <tbody>
            <tr><th>판매 단위</th><td>1세트 (2매, 동일 축 좌·우)</td></tr>
            <tr><th>표시 가격</th><td>기준가, 1세트 기준, 부가세 포함</td></tr>
            <tr><th>거래처 공급가</th><td>거래 조건에 따라 별도 안내</td></tr>
            <tr><th>브랜드</th><td>COLUMN 기본 · BREMBO 1매당 +${fmt(BRAND_ADD)}원</td></tr>
            <tr><th>카오스 가공</th><td>디스크 외경·가공 타입별 가공비 별도</td></tr>
            <tr><th>가격 문의</th><td>가격 미표기 품번은 재고·조달 확인 후 안내</td></tr>
            <tr><th>증빙</th><td>세금계산서 발행 (첫 거래 시 사업자등록증 접수)</td></tr>
          </tbody>
        </table>
        <div class="callout"><b>카탈로그 미수록 품번 문의</b><br />차대번호와 필요 품목을 알려 주시면 국내 재고 및 해외 조달 가능 여부를 확인하여 안내해 드립니다.</div>
      </div>
      <div>
        <h2 class="sub">주문 절차</h2>
        <ol class="steps">
          <li><b>발주</b><span>전화·문자·이메일로 차대번호와 품번 접수</span></li>
          <li><b>적용 확인</b><span>차대번호·OEM 품번으로 차량 적용 여부 확인</span></li>
          <li><b>결제 · 증빙</b><span>공급가 및 결제 방법(계좌 이체) 안내, 세금계산서 발행</span></li>
          <li><b>출고 준비</b><span>가공 주문은 패턴 가공 및 치수·외관 검사 후 출고</span></li>
          <li><b>배송</b><span>거래처 지정 주소로 택배 발송</span></li>
        </ol>
      </div>
    </div>
    <div class="howto">
      <h2 class="sub">제품 페이지 보는 법</h2>
      <ol>
        <li><b>번호</b> — 차종별 색인의 제품 번호와 동일합니다.</li>
        <li><b>장착 위치</b> — 전륜(FRONT) 또는 후륜(REAR).</li>
        <li><b>OEM 품번</b> — 순정 부품 번호로, 주문·문의 시 기준이 됩니다.</li>
        <li><b>제품 이미지 · 측면도</b> — 이미지는 동일 형식 디스크의 대표 이미지이며, 측면도에 품번별 외경·두께를 표기했습니다.</li>
        <li><b>가격</b> — 1세트(2매) 기준가, 부가세 포함. 거래처 공급가는 별도 안내합니다.</li>
        <li><b>적용 차종</b> — 제조사·모델·섀시코드. 지면상 생략한 차종은 차종별 색인에 수록했습니다.</li>
      </ol>
    </div>`;

  // ---------------- 3-1. A/S · 교환·반품 안내 (회사 제공 유의사항 원문) ----------------
  const pAS = page("aspage", "WARRANTY & RETURNS", "A/S · 교환·반품 안내");
  toc.push(["A/S · 교환·반품 안내", pageCount]);
  body(pAS).innerHTML = `
    <p class="kicker">Warranty &amp; returns</p>
    <h1 class="title">A/S · 교환·반품 안내</h1>
    <p class="lead">발주 전 아래 유의사항을 확인해 주시기 바랍니다. A/S 기간은 출고일(세금계산서 발행일)을 기준으로 산정합니다.</p>
    <h2 class="sub">품목별 A/S 기간</h2>
    <table class="ptable as-table">
      <thead><tr><th>구분</th><th>A/S 기간 · 기준</th></tr></thead>
      <tbody>
        <tr><th>애프터마켓 브랜드 제품</th><td><b>출고일로부터 3개월</b></td></tr>
        <tr><th>기타 부품 (콘덴서 · 컴프레서 · 발전기 · 스타터)</th><td><b>출고일로부터 6개월 또는 10,000 km</b> 중 선도래 기준</td></tr>
        <tr><th>정품 부품</th><td>딜러사 공급 조건 및 서비스 매뉴얼 기준에 따라 <b>A/S 불가</b></td></tr>
        <tr><th>전자제품</th><td><b>초기 불량에 한하여</b> A/S 가능 (그 외 사유는 제한)</td></tr>
      </tbody>
    </table>
    <div class="as-cols">
      <div>
        <h2 class="sub">공통 유의사항</h2>
        <ol class="terms">
          <li><b>A/S 기준:</b> 애프터마켓 브랜드 제품의 A/S 기간은 출고일로부터 3개월입니다.</li>
          <li>콘덴서, 컴프레서, 발전기, 스타터 제품의 A/S 기간은 출고일로부터 6개월 또는 10,000 km 중 선도래 기준으로 적용됩니다.</li>
          <li><b>정품 부품</b>은 딜러사 공급 조건 및 서비스 매뉴얼 기준에 따라 A/S가 불가합니다.</li>
          <li>전자제품은 초기 불량에 한하여 A/S가 가능하며, 그 외 사유에 대해서는 A/S가 제한됩니다.</li>
          <li>일부 품목은 사전 고지 후 판매됩니다.</li>
          <li>모든 불량 및 A/S 요청은 명확한 증빙자료(사진, 영상, 진단서 등) 제출 시에만 검토되며, 증빙자료가 없는 경우 어떠한 사유로도 교환·반품·환불은 불가합니다.</li>
          <li>단순 오진, 작업 오류, 소비자 노쇼(No-show), 고객 변심 등으로 인한 발주 취소·보류·변경은 일절 불가합니다. 주문 확정 이후에는 제품 취소·반품·보류가 불가하오니 상기 내용을 충분히 숙지 및 확인 후 주문하여 주시기 바랍니다. 단, 당사 귀책 사유(오배송, 초기 불량)는 제외합니다.</li>
        </ol>
      </div>
      <div>
        <h2 class="sub">브레이크 디스크 A/S · 반품 기준</h2>
        <ol class="terms disc">
          <li><b>A/S 제외 사항:</b> 다음은 제품 불량이 아니므로 A/S 대상에서 제외됩니다.
            <ul>
              <li>정상 마모, 표면 녹(방청 상태), 열에 의한 변색</li>
              <li>장착 불량으로 인한 떨림·런아웃 (허브 면 이물질·녹 미제거, 휠 볼트 체결 불균일 등)</li>
              <li>패드 미교환·편마모, 캘리퍼 고착 등 다른 부품에 원인이 있는 소음·진동</li>
            </ul></li>
          <li><b>장착 후 반품 불가:</b> 장착했거나 사용 흔적이 있는 제품, 원 포장이 훼손된 제품은 반품·교환이 불가합니다.</li>
          <li><b>카오스 가공 제품:</b> 주문 제작 품목으로, 가공 착수 이후에는 취소·반품이 불가합니다.</li>
          <li><b>적용 확인:</b> 차대번호 없이 거래처가 지정한 품번으로 발주한 경우, 차량 적용 불일치에 대한 반품은 불가합니다.</li>
          <li><b>오배송·수량 오류:</b> 품번·수량 오류는 수령 후 7일 이내에 연락 주시면 당사 부담으로 교환해 드립니다.</li>
          <li><b>A/S 기간 기준일:</b> A/S 기간은 출고일(세금계산서 발행일) 기준으로 산정합니다.</li>
          <li><b>반품 배송비:</b> 당사 귀책 사유는 당사가, 그 외 사유는 거래처가 왕복 배송비를 부담합니다.</li>
        </ol>
      </div>
    </div>
    <div class="callout"><b>A/S 접수</b> — 불량 부위 사진·영상 또는 진단서를 준비해 출고일, 품번, 차대번호와 함께 전화·문자·이메일로 보내 주시면 검토 후 처리 방법을 안내해 드립니다.<br /><b>T. ${TEL}</b> · <b>E. ${MAIL}</b> · 월~토 09:00 – 18:00</div>`;

  // ---------------- 4. 카오스 가공 ----------------
  const pChaos = page("", "CHAOS MACHINING", "카오스 가공");
  toc.push(["카오스 가공", pageCount]);
  const optPrice = (code, i) => { const o = OPTIONS.find((x) => x.code === `${code}-${i}`); return o ? fmt(o.price * SET_SIZE) : "견적"; };
  const tiers = [1, 2, 3, 4];
  body(pChaos).innerHTML = `
    <p class="kicker">Chaos machining</p>
    <h1 class="title">카오스 가공 브레이크 디스크</h1>
    <p class="lead">카오스 가공은 브레이크 디스크 마찰면에 홈 패턴을 새기는 가공입니다. 디스크 교환 시 고객에게 함께 제안할 수 있는 부가 품목으로, 사선·A·B 세 가지 타입을 차량 규격에 맞춰 가공한 후 출고합니다.</p>
    <div class="ctypes">
      <figure class="base"><img src="${ROOT}assets/chaos-before.jpg" alt="가공 전 디스크" /><figcaption><b>가공 전</b>홈이 없는 일반 디스크</figcaption></figure>
      <figure><img src="${ROOT}assets/chaos-diag.jpg" alt="사선 타입" /><figcaption><b>사선 타입</b>등간격 직선 홈 배치. 단정하고 무난한 외관</figcaption></figure>
      <figure><img src="${ROOT}assets/chaos-type-a.jpg" alt="A 타입" /><figcaption><b>A 타입</b>길이·곡률이 다른 곡선 홈 배치. 개성 있는 외관</figcaption></figure>
      <figure><img src="${ROOT}assets/chaos-type-b.jpg" alt="B 타입" /><figcaption><b>B 타입</b>V자 홈 반복 배치. 회전 방향 지정형</figcaption></figure>
    </div>
    <div class="two">
      <div>
        <h2 class="sub">가공비 <span class="note">(단위: 원, 1세트 2매, 부가세 포함)</span></h2>
        <table class="ptable">
          <thead><tr><th>디스크 외경</th><th class="r">300 이하</th><th class="r">301~330</th><th class="r">331~350</th><th class="r">351 이상</th></tr></thead>
          <tbody>
            ${CHAOS_TYPES.map((t) => `<tr><th>${t.name}</th>${tiers.map((i) => `<td class="r">${optPrice(t.code, i)}</td>`).join("")}</tr>`).join("")}
          </tbody>
        </table>
        <p class="note" style="margin-top:2.5mm">신품 디스크와 함께 주문하시면 가공 완료 후 출고합니다. 품번별 가공비는 각 제품 페이지에 표기했습니다.</p>
      </div>
      <div>
        <h2 class="sub">고객 제안 가이드</h2>
        <ol class="steps">
          <li><b>슬림 스포크 휠 차량</b><span>디스크 노출 면적이 넓어 가공 패턴이 돋보입니다.</span></li>
          <li><b>캘리퍼 도색 동시 작업</b><span>레드·옐로 캘리퍼 도색과 함께 제안하면 시각적 효과가 커집니다.</span></li>
          <li><b>휠 사진 상담</b><span>고객 차량의 휠 사진을 보내 주시면 적합한 타입을 추천해 드립니다.</span></li>
        </ol>
      </div>
    </div>
    <div class="fitph">
      <img src="${ROOT}assets/fit-red-caliper.jpg" alt="빨간 캘리퍼와 가공 디스크" />
      <img src="${ROOT}assets/fit-yellow-caliper.jpg" alt="노란 캘리퍼와 가공 디스크" />
      <img src="${ROOT}assets/fit-installed.jpg" alt="차량에 장착한 가공 디스크" />
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
  const NOT_OURS = "본 자료는 공개된 논문·특허의 시험 결과를 요약한 것으로, 당사 제품(카오스 가공 디스크)의 시험 결과가 아닙니다. 수치는 각 연구의 시편 및 시험 조건에서 측정된 값입니다.";

  const pR1 = page("research", "TECHNICAL NOTES", "기술 자료 ①");
  toc.push(["기술 자료", pageCount]);
  body(pR1).innerHTML = `
    <p class="kicker">Research</p>
    <h1 class="title">디스크 마찰면 홈 가공의<br />연구 결과</h1>
    <p class="lead">디스크 마찰면 홈 가공은 고성능 차량에 널리 적용되어 온 기술입니다${cite("SAE13")}. 완성차 업체와 대학 연구진이 다이나모미터 시험으로 확인한 결과 중 정비 현장에서 참고할 만한 내용을 정리했습니다.</p>
    <div class="disclaim">${NOT_OURS}</div>
    <h2 class="sub">홈 가공 디스크와 무가공 디스크 비교 <span class="note">GM 미국 특허 US 8,146,719 B2${cite("GM")} · 345 mm 벤틸레이티드 주철 디스크 다이나모미터 시험</span></h2>
    <div class="stats">
      <div class="stat"><span>페이드 구간 마찰계수</span><b>0.22 <i>→</i> 0.24</b><em>약 9% 높음</em><small>고온 상태에서의 제동력 저하 감소</small></div>
      <div class="stat"><span>페이드 중 제동 토크 변동</span><b>약 50% <i>↓</i></b><em>길이가 다른 홈</em><small>홈 길이를 달리 배치할 때 제동감 균일</small></div>
      <div class="stat"><span>패드 편마모</span><b>22.6 <i>→</i> 13.0</b><em>µm/mm · 약 42% 적음</em><small>패드 한쪽 쏠림 마모 감소</small></div>
      <div class="stat"><span>패드 마모량</span><b>차이 거의 없음</b><em>&nbsp;</em><small>홈 가공에 따른 패드 마모 증가 없음</small></div>
    </div>
    <h2 class="sub">주요 연구 결과</h2>
    <div class="finds">
      <div class="find"><i>소음</i><b>마찰 소음(스퀼) 저감</b><p>디스크 면에 45° 홈을 가공한 결과 마찰 소음이 크게 감소했습니다. 홈이 마모 분진을 포집하고 패드 접촉 압력을 고르게 분산하는 효과로 분석되었습니다.${cite("TI16")}</p><small>Tribology International 102 (2016)</small></div>
      <div class="find"><i>우천</i><b>젖은 노면 이후 제동력 회복</b><p>침수 조건을 반복한 시험에서 홈 가공 디스크가 무가공 디스크보다 마찰계수를 더 빠르게 회복했으며, 표면 마모 손상도 크게 줄었습니다. 건조 조건의 평균 마찰에는 영향이 거의 없었습니다.${cite("WEAR24")}</p><small>Wear 540 (2024) · 고속열차용 디스크 시편</small></div>
      <div class="find"><i>설계</i><b>홈 설계의 중요성</b><p>슬롯 디스크는 페이드 성능 향상에 효과가 있으며, 홈의 개수·형상·방향을 최적화하여 소음과 패드 마모 부담을 줄이는 설계 방향이 제시되었습니다.${cite("B")}</p><small>SAE 2018-01-1883 · 현대자동차 · 상신브레이크</small></div>
    </div>
    <h2 class="sub" style="margin-top:6mm">참고 문헌</h2>
    <ol class="refs">${REFS.map((id) => { const r = paper(id); return `<li>${esc(firstAuthor(r.authors))}. ${esc(r.titleEn || r.titleKo || "")}. <i>${esc(r.journal || "")}</i>${r.year ? ", " + r.year : ""}.${r.doi ? " doi:" + esc(r.doi) : ""}</li>`; }).join("")}</ol>`;

  // 연구 자료 ②: 국내 논문 표
  const pR2 = page("research", "TECHNICAL NOTES", "기술 자료 ②");
  const A = paper("A"), Cc = paper("C");
  const SER = ["관통 구멍", "홈(슬롯)", "관통+홈 복합"];
  const rowsA = [
    ["A-T5-mu-ramp", "최대 마찰계수 · Ramp stop", "높을수록 우수", 3, "max"],
    ["A-T5-mu-step", "최대 마찰계수 · Step stop", "높을수록 우수", 3, "max"],
    ["A-text-maxtemp", "최대 로터 온도 (°C)", "패턴 간 차이 7 °C 이내", 0, ""],
    ["A-T4-torque", "최대 제동 토크 평균 (Nm)", "3회 평균", 0, "max"],
    ["A-T4-hyst", "제동 토크 이력 비율 (%)", "낮을수록 제동감 균일", 1, "min"],
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
    <h1 class="title">가공 패턴별 다이나모미터 시험</h1>
    <p class="lead">인하대학교 기계공학과와 한양정밀 기술연구소는 동일 로트의 15인치 전륜 로터(외경 276 mm)에 관통 구멍·홈·관통+홈 복합 패턴을 가공하여 FMVSS 135 및 SAE J2521 절차로 성능을 비교했습니다.${cite("A")} 시험 장비: ${esc(A.test ? A.test.equipment : "다이나모미터")}.</p>
    <h2 class="sub">패턴별 시험 결과 <span class="note">한국자동차공학회 논문집 ${A.volume || ""}(${A.issue || ""}), ${A.year || ""}</span></h2>
    <table class="ptable rtable">
      <thead><tr><th>항목</th>${SER.map((x) => `<th class="r">${x}</th>`).join("")}</tr></thead>
      <tbody>${rowsA}</tbody>
    </table>
    <p class="note" style="margin-top:1.6mm">음영 칸은 항목별 최우수 값입니다. 수치는 논문의 표·본문에 인쇄된 값을 그대로 옮겼으며, 무가공 로터는 시험 대상에 포함되지 않아 패턴 간 비교 결과입니다.</p>
    <div class="takeaways">
      <div><b>01</b><p><strong>홈(슬롯) 패턴</strong>은 Step stop 최대 마찰계수 0.466으로 최고 수준을 기록했습니다.</p></div>
      <div><b>02</b><p><strong>관통+홈 복합 패턴</strong>은 토크 이력 비율 12.3%로 가장 낮아, 제동 시와 해제 시의 제동감 차이가 가장 작았습니다.</p></div>
      <div><b>03</b><p>세 패턴의 최대 온도는 650~657 °C로, 가공 형태에 따른 <strong>열 부하 차이는 크지 않았습니다</strong>.</p></div>
    </div>
    <h2 class="sub">후속 연구 — 이종 재질 로터 <span class="note">한국자동차공학회 논문집 ${Cc.volume || ""}(${Cc.issue || ""}), ${Cc.year || ""}${cite("C")}</span></h2>
    <div class="two" style="grid-template-columns:1.25fr 1fr;gap:6mm;align-items:start">
      <div>
        <table class="ptable rtable small-t">
          <thead><tr><th>평균 제동 토크 (Nm)<br />압력 ${esc(c1 ? c1.groups[hiIdx] : "")}</th>${cSer.map((x) => `<th class="r">${x}</th>`).join("")}</tr></thead>
          <tbody>${rowsC}</tbody>
        </table>
      </div>
      <p class="note" style="font-size:8.3pt">마찰면은 주철, 햇(중앙부)은 알루미늄(Al6061-T6)으로 구성한 경량 로터에서도 동일한 세 패턴을 비교했습니다. 고압(10,600 kPa 이상) 구간에서 이종 재질 로터의 제동 토크는 단일 재질과 같거나 더 높게 측정되었습니다.</p>
    </div>
    ${PLAN ? `<div class="plan">
      <div class="plan-h"><b>당사 자체 성능시험 계획</b><span>계획 단계 · 공인 시험 완료 후 결과 공개</span></div>
      <p>${esc(PLAN.compare)}</p>
      <div class="plan-items">${PLAN.items.map((it) => `<div><b>${esc(it.name)}</b><span>${esc(it.what)}</span></div>`).join("")}</div>
      <p class="note">${PLAN.publishRules.map(esc).join(" · ")}</p>
    </div>` : ""}`;

  // ---------------- 5. 상품 카드 ----------------
  function chaosLine(p) {
    const os = optionsFor(p);
    if (!os.length) return `<div class="chaos">카오스 가공비 별도 견적</div>`;
    const get = (c) => { const o = os.find((x) => x.code.startsWith(c)); return o ? fmt(o.price * SET_SIZE) : "-"; };
    return `<div class="chaos">카오스 가공비 (1세트) 사선 <b>${get("CHAOS-D")}</b> · A <b>${get("CHAOS-A")}</b> · B <b>${get("CHAOS-B")}</b></div>`;
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
      <g stroke="#5a6472" stroke-width=".6" fill="none">
        <line x1="${cx + w / 2 + 6}" y1="${top}" x2="${cx + w / 2 + 6}" y2="${top + H}"/>
        <line x1="${cx + w / 2 + 3.5}" y1="${top}" x2="${cx + w / 2 + 8.5}" y2="${top}"/><line x1="${cx + w / 2 + 3.5}" y1="${top + H}" x2="${cx + w / 2 + 8.5}" y2="${top + H}"/>
        <line x1="${x0}" y1="${top + H + 6}" x2="${x0 + w}" y2="${top + H + 6}"/>
        <line x1="${x0}" y1="${top + H + 3.5}" x2="${x0}" y2="${top + H + 8.5}"/><line x1="${x0 + w}" y1="${top + H + 3.5}" x2="${x0 + w}" y2="${top + H + 8.5}"/>
      </g>
      <text x="${cx + w / 2 + 9}" y="${top + H / 2}" fill="#131922" font-size="7.5" font-weight="700" font-family="IBM Plex Mono, monospace" transform="rotate(90 ${cx + w / 2 + 9} ${top + H / 2})" text-anchor="middle">Ø${p.dia || "?"}</text>
      <text x="${cx}" y="${top + H + 16}" fill="#131922" font-size="7.5" font-weight="700" font-family="IBM Plex Mono, monospace" text-anchor="middle">${p.thk || "?"}</text>
    </svg>`;
  }
  function photoFig(p) {
    const dia = parseFloat(p.dia) || 320;
    const scale = Math.max(78, Math.min(100, 78 + ((dia - 260) / 140) * 22)); // 외경에 따라 사진 크기 78~100%
    const own = PHOTOS[p.pn];
    return `<div class="ph-wrap"><img class="ph" src="${own ? "photos/" + own : BASE_PHOTO}" alt="브레이크 디스크 ${esc(p.pn)}" style="width:${scale.toFixed(0)}%" /></div>${edgeSvg(p)}${own ? "" : `<span class="ph-tag">대표 이미지</span>`}`;
  }

  function card(p) {
    const vented = (parseFloat(p.thk) || 0) >= 18;
    const price = p.price
      ? `<div class="pr main"><span>COLUMN · 1세트 기준가</span><b>${fmt(brandPrice(p, "COLUMN") * SET_SIZE)}원</b></div>
         <div class="pr"><span>BREMBO · 1세트 기준가</span><b>${fmt(brandPrice(p, "BREMBO") * SET_SIZE)}원</b></div>`
      : `<div class="pr ask"><span>COLUMN / BREMBO</span><b>가격 문의</b></div><div class="pr"><span>재고·조달 확인 후</span><b>별도 안내</b></div>`;
    const fit = [];
    p._makes.forEach((m) => {
      [...p._tree.get(m).entries()].sort((a, b) => b[1].size - a[1].size).forEach(([g, codes]) => {
        fit.push(`<div><b>${esc(makeKo(m))} ${esc(g)}</b><span>${[...codes].map(esc).join(" · ")}</span></div>`);
      });
    });
    return `<article class="card" data-no="${p._no}">
      <div class="card-top"><span class="no">${pad(p._no)}</span><span class="ax ${p.axle}">${p.axle === "front" ? "앞 FRONT" : "뒤 REAR"}</span>${p.sold >= HOT ? `<span class="hot">인기 품번</span>` : ""}<span class="pn">${esc(p.pn)}</span></div>
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
      more.textContent = `외 ${removed}개 모델은 차종별 색인 참조`;
    }
  }

  const firstProductPage = pageCount + 1;
  const makesOnPage = (items) => [...new Set(items.map((p) => makeKo(p._makes[0])))].join(" · ");
  for (let i = 0; i < LIST.length; i += PER_PAGE) {
    const items = LIST.slice(i, i + PER_PAGE);
    const el = page("", "PRODUCTS", `제품 ${pad(items[0]._no)}–${pad(items[items.length - 1]._no)} · ${makesOnPage(items)}`);
    items.forEach((p) => { p._page = pageCount; });
    body(el).innerHTML = `<div class="pgrid">${items.map(card).join("")}</div>`;
  }
  toc.push([`제품 목록 (브레이크 디스크 ${LIST.length}종)`, firstProductPage]);

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
  // 제조사별로 쪽을 나눔. 행이 적은 제조사(MINOR 미만)는 '기타 제조사' 쪽에 모음.
  const MINOR = 10;
  const makeItems = (m) => {
    const groups = idx.get(m), out = [{ head: 2, html: `<div class="ix-make"><span>${esc(makeKo(m))}</span><small>${esc(m)}</small></div>` }];
    [...groups.keys()].sort((a, b) => a.localeCompare(b, "en", { numeric: true })).forEach((g) => {
      out.push({ head: 1, html: `<div class="ix-grp">${esc(g)}</div>` });
      [...groups.get(g).entries()].sort((a, b) => a[1].from.localeCompare(b[1].from)).forEach(([bd, e]) => {
        const yrs = `${e.from === "9999" ? "?" : e.from} ~ ${e.open ? "현재" : e.to || "?"}`;
        out.push({ head: 0, html: `<div class="ix-row"><span class="nm"><b>${esc(bd)}</b><small>${yrs}</small></span><span class="n">${nums(e.front)}</span><span class="n">${nums(e.rear)}</span></div>` });
      });
    });
    return out;
  };
  const rowCount = (m) => [...idx.get(m).values()].reduce((n, b) => n + b.size, 0);
  const makesSorted = [...idx.keys()].sort((a, b) => makeOrder(a) - makeOrder(b));
  const sections = makesSorted.filter((m) => rowCount(m) >= MINOR).map((m) => ({ title: makeKo(m) === m ? m : `${makeKo(m)} · ${m}`, items: makeItems(m) }));
  const minor = makesSorted.filter((m) => rowCount(m) < MINOR);
  if (minor.length) sections.push({ title: "기타 제조사", items: minor.flatMap(makeItems) });

  const firstIndexPage = pageCount + 1;
  const colHead = `<div class="ix-head"><span>모델 · 차체(섀시코드) · 생산 기간</span><span>전륜</span><span>후륜</span></div>`;
  const over = (c) => c.scrollHeight > c.clientHeight + 1;
  sections.forEach((sec) => {
    let cols = [], ci = 0;
    const newIndexPage = () => {
      const el = page("", "VEHICLE INDEX", `차종별 색인 · ${esc(sec.title)}`);
      body(el).innerHTML = `<div class="ix-cols"><div class="ix-col">${colHead}</div><div class="ix-col">${colHead}</div></div>`;
      cols = [...el.querySelectorAll(".ix-col")]; ci = 0;
    };
    newIndexPage();
    sec.items.forEach((it) => {
      let col = cols[ci];
      col.insertAdjacentHTML("beforeend", it.html);
      if (!over(col)) return;
      // 넘치면: 이 항목과 바로 위에 붙은 제목들을 다음 칸(또는 다음 쪽)으로
      const move = [col.lastElementChild];
      col.lastElementChild.remove();
      while (col.lastElementChild && /ix-make|ix-grp/.test(col.lastElementChild.className)) { move.unshift(col.lastElementChild); col.lastElementChild.remove(); }
      const heads = [...col.querySelectorAll(".ix-make, .ix-grp")].reverse();
      ci++; if (ci > 1) newIndexPage();
      col = cols[ci];
      // 모델 중간에서 나뉘면 새 칸 첫머리에 모델 이름만 다시 표시
      if (!/ix-make|ix-grp/.test(move[0].className)) {
        const lastGrp = heads.find((x) => x.classList.contains("ix-grp"));
        if (lastGrp) col.insertAdjacentHTML("beforeend", lastGrp.outerHTML);
      }
      move.forEach((n) => col.appendChild(n));
    });
  });
  toc.push(["차종별 색인", firstIndexPage]);

  // ---------------- 6-1. 품번 색인 · 교차 참조 ----------------
  // OEM 품번 순. BREMBO 품번은 적용 차종·규격 출처(Spareto 브렘보 제품 페이지) 주소에서 읽음: .../brembo-brake-disc/09-d533-13 → 09.D533.13
  const bremboNo = (p) => { const m = String(p.src || "").match(/brembo-brake-disc\/([0-9a-z]+)-([0-9a-z]+)-([0-9a-z]+)\/?$/i); return m ? `${m[1]}.${m[2]}.${m[3]}`.toUpperCase() : ""; };
  const byPn = LIST.slice().sort((a, b) => a.pn.localeCompare(b.pn, "en", { numeric: true }));
  const firstPnPage = pageCount + 1;
  const pnHead = `<thead><tr><th>OEM 품번</th><th class="c">제품 번호</th><th class="c">쪽</th><th class="c">위치</th><th class="r">외경 × 두께</th><th>COLUMN 품번</th><th>BREMBO 품번</th><th>주요 적용 차종</th></tr></thead>`;
  const pnRow = (p) => `<tr><td class="m b">${esc(p.pn)}</td><td class="c m">${pad(p._no)}</td><td class="c m">${pad(p._page)}</td><td class="c">${p.axle === "front" ? "전륜" : "후륜"}</td><td class="r m">${esc(p.dia || "?")} × ${esc(p.thk || "?")}</td><td class="m">${esc(p.col || "–")}</td><td class="m">${esc(bremboNo(p) || "–")}</td><td class="fitc">${esc(p._makes.slice(0, 2).map(makeKo).join(" · "))} ${esc([...p._tree.get(p._makes[0]).keys()].slice(0, 2).join(", "))}</td></tr>`;
  let pnBody = null;
  const newPnPage = () => {
    const el = page("", "PART NUMBER INDEX", "품번 색인 · 교차 참조 · OEM 품번 순");
    body(el).innerHTML = `<div class="pn-wrap"><table class="ptable pn-table">${pnHead}<tbody></tbody></table></div>`;
    pnBody = el.querySelector(".pn-table tbody");
    return el.querySelector(".pn-wrap");
  };
  let pnWrap = newPnPage();
  byPn.forEach((p) => {
    pnBody.insertAdjacentHTML("beforeend", pnRow(p));
    if (pnWrap.scrollHeight > pnWrap.clientHeight + 1) { pnBody.lastElementChild.remove(); pnWrap = newPnPage(); pnBody.insertAdjacentHTML("beforeend", pnRow(p)); }
  });
  pnWrap.insertAdjacentHTML("beforeend", `<p class="note" style="margin-top:2mm">BREMBO 품번은 동일 규격 대응 품번(참고용)입니다. 발주 시에는 OEM 품번과 차대번호로 적용 여부를 확인합니다.</p>`);
  toc.push(["품번 색인 · 교차 참조", firstPnPage]);

  // ---------------- 7. 뒤표지 ----------------
  page("back").innerHTML = `<div class="back-in">
      <div class="cover-brand"><img class="cover-logo" src="brand/logo-silver.png" alt="CARIBE TRADING" /><span class="co-name">주식회사 카리브무역</span></div>
      <h2>거래처 등록 및 발주 문의</h2>
      <p>신규 거래, 공급가 문의, 카탈로그 미수록 품번, 브레이크 외 부품, 카오스 가공 상담을 아래 연락처로 접수합니다. 입고 차량의 차대번호와 필요 품목을 문자 또는 이메일로 보내 주시면 확인 후 안내해 드립니다.</p>
      <div class="contact">
        <div><span>거래 문의 · 전화 · 문자</span><b class="big">${TEL}</b></div>
        <div><span>영업 시간</span><b>월~토 09:00 – 18:00</b></div>
        <div><span>이메일</span><b>${MAIL}</b></div>
        <div><span>본사</span><b>${ADDR}</b></div>
      </div>
      <div class="back-bottom">
        <div class="qr-box"><img src="brand/qr-site.svg" alt="카리브무역 홈페이지 QR 코드" /><div><span>홈페이지 바로가기</span><b>caribetrading.co.kr</b><small>차대번호·품번 검색 · 상담</small></div></div>
        <img class="back-disc" src="${ROOT}images/brake-discs/hero-disc-a.png" alt="" />
      </div>
      <div class="legal">주식회사 카리브무역 | 대표 김철민 | 사업자등록번호 608-86-12959 | 통신판매업 신고 제2023-울산남구-1093호<br />
        가격 기준일 ${PRICE_DATE} · 부가세 포함 · 1세트(2매) 기준. 가격 및 적용 차종은 사전 예고 없이 변경될 수 있으므로 주문 전 확인하시기 바랍니다.<br />
        제품 이미지는 대표 이미지로, 품번별 실제 외관(햇 높이, 볼트 홀 수 등)과 다를 수 있습니다.<br />
        © ${PRICE_DATE.slice(0, 4)} CARIBE TRADING. All rights reserved.</div>
    </div>`;

  // ---------------- 마무리 ----------------
  toc.push(["연락처", pageCount]);
  document.getElementById("tocList").innerHTML = toc.map(([t, n]) => `<li><span>${t}</span><b>${pad(n)}</b></li>`).join("");
  document.getElementById("catInfo").textContent = `A4 ${pageCount}쪽 · 디스크 ${LIST.length}종 · 가격 기준일 ${PRICE_DATE}`;

  // 수정 내용(editor.js) 적용 → 넘치는 적용 차종 줄 정리 → data-ready 표시 (PDF 만들 때 이 표시를 기다림)
  const done = () => {
    document.querySelectorAll(".card").forEach(trimFit);
    if (window.CatalogEditor) CatalogEditor.checkOverflow();
    document.body.dataset.ready = "1";
  };
  if (window.CatalogEditor) CatalogEditor.init().then(done, done); else done();
}
