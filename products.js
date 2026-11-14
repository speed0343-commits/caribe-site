// ============================================================
// 전체 상품 페이지 — 등록된 브레이크 디스크 전체 목록
// 데이터: catalog-data.js (core.js 의 PRODUCTS · ROWS · BRANDS 사용)
// 장바구니는 메인과 같은 저장소(cart4)를 씁니다. 키 형식: "품번|브랜드|가공코드"
// ============================================================
(function () {
  "use strict";
  const q = $("#pdQ"), makeSel = $("#pdMake"), axleSel = $("#pdAxle"), sortSel = $("#pdSort");
  const grid = $("#pdGrid"), result = $("#pdResult");
  const BASE_BRAND = BRANDS[0].code;

  // 상품별 적용 제조사·모델 요약
  PRODUCTS.forEach((p) => {
    const makes = {}, groups = {};
    p.rows.forEach((r) => { makes[r.make] = (makes[r.make] || 0) + 1; groups[r.group] = (groups[r.group] || 0) + 1; });
    p._makes = Object.keys(makes).sort((a, b) => makes[b] - makes[a]);
    p._groups = Object.keys(groups).filter(Boolean).sort((a, b) => groups[b] - groups[a]);
    p._text = [p.pn, norm(p.pn), ...p._makes.map(makeKo), ...p._makes, ...p._groups, ...p.rows.map((r) => r.body)].join(" ").toUpperCase();
  });
  const LIST = PRODUCTS.filter((p) => p.rows.length);

  // 제조사 선택 목록 (상품 수 많은 순)
  const makeCount = {};
  LIST.forEach((p) => p._makes.forEach((m) => { makeCount[m] = (makeCount[m] || 0) + 1; }));
  Object.keys(makeCount).sort((a, b) => makeCount[b] - makeCount[a])
    .forEach((m) => makeSel.insertAdjacentHTML("beforeend", `<option value="${esc(m)}">${esc(makeKo(m))} (${makeCount[m]})</option>`));


  const cartQty = (pn) => {
    const c = store.get(CART_KEY, {});
    return Object.entries(c).filter(([k]) => k.split("|")[0] === pn).reduce((s, [, n]) => s + (Number(n) || 0), 0);
  };

  function card(p) {
    const makes = p._makes.slice(0, 2).map(makeKo).join(" · ") + (p._makes.length > 2 ? ` 외 ${p._makes.length - 2}` : "");
    const models = p._groups.slice(0, 3).join(", ") + (p._groups.length > 3 ? ` 외 ${p._groups.length - 3}개 모델` : "");
    const n = cartQty(p.pn);
    const price = p.price
      ? `${won(brandPrice(p, BASE_BRAND) * SET_SIZE)} <small>/ 2장 1세트 · ${esc(BASE_BRAND)}</small>`
      : "가격 문의";
    return `<div class="card pd-card">
      <figure class="thumb">${discSvg(p)}</figure>
      <div><span class="brand">OEM ${esc(p.pn)}</span></div>
      <h4>${esc(makes)} 브레이크 디스크 ${axleKo(p.axle)}</h4>
      <div class="spec">외경 ${esc(p.dia)}mm × 두께 ${esc(p.thk)}mm${p.min ? ` · 최소 ${esc(p.min)}mm` : ""}</div>
      <div class="meta">적용 모델: ${esc(models || "-")}</div>
      <div class="price">${price}</div>
      <div class="pd-actions">
        ${p.price ? `<button type="button" data-pd-add="${esc(p.pn)}">${n ? `장바구니에 ${n}세트` : "장바구니 담기"}</button>`
          : `<button type="button" data-pd-ask="${esc(p.pn)}" data-axle="${esc(axleKo(p.axle))}">가격 문의하기</button>`}
        <a class="btn btn-ghost" href="index.html?q=${encodeURIComponent(p.pn)}">자세히 보기</a>
      </div>
    </div>`;
  }

  function render() {
    const text = q.value.trim().toUpperCase(), tn = norm(text);
    let items = LIST.filter((p) =>
      (!makeSel.value || p._makes.includes(makeSel.value)) &&
      (!axleSel.value || p.axle === axleSel.value) &&
      (!text || p._text.includes(text) || (tn.length >= 3 && p._text.includes(tn))));
    const s = sortSel.value;
    items = items.slice().sort((a, b) =>
      s === "price" ? (a.price ?? Infinity) - (b.price ?? Infinity) :
      s === "price-desc" ? (b.price ?? -Infinity) - (a.price ?? -Infinity) :
      (b.sold || 0) - (a.sold || 0));
    result.textContent = `${items.length}종`;
    grid.className = "pt-host";
    grid.innerHTML = items.length ? ptTable(items, false)
      : `<div class="empty">조건에 맞는 디스크가 없습니다. 검색어를 바꾸거나 <a href="index.html#inquiry">문의</a>를 남겨 주십시오.</div>`;
  }

  [makeSel, axleSel, sortSel].forEach((el) => el.addEventListener("change", render));
  q.addEventListener("input", render);

  grid.addEventListener("click", (e) => {
    const add = e.target.closest("[data-pd-add]");
    if (add) {
      const key = `${add.dataset.pdAdd}|${BASE_BRAND}|`;
      const c = store.get(CART_KEY, {});
      c[key] = (Number(c[key]) || 0) + 1;
      store.set(CART_KEY, c);
      if (window.SiteNav && SiteNav.updateCartCount) SiteNav.updateCartCount();
      add.textContent = `담음 ${cartQty(add.dataset.pdAdd)}`;
      return;
    }
    const ask = e.target.closest("[data-pd-ask]");
    if (ask) {
      try { sessionStorage.setItem("prefillInquiry", `[가격 문의] 브레이크 디스크 ${ask.dataset.axle} OEM ${ask.dataset.pdAsk}`); } catch (err) {}
      SiteNav.go("index.html#inquiry");
    }
  });

  render();
})();
