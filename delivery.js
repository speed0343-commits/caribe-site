// ============================================================
// 택배사 목록 · 배송조회 주소 (관리자 · 마이페이지 · 주문/배송 조회 공용)
// - 관리자가 고른 택배사 이름과 송장번호로 택배사 공식 조회 화면 주소를 만듭니다.
// - 택배사 화면 주소가 바뀌어 안 열리면 네이버 택배 조회(검색 결과 위 조회 칸)로도 볼 수 있게 함께 제공합니다.
// - 택배사 주소를 바꿀 때는 아래 url 만 고치면 됩니다. {no} 자리에 송장번호가 들어갑니다.
// ============================================================
(function () {
  "use strict";
  const COURIERS = [
    { name: "CJ대한통운", url: "https://trace.cjlogistics.com/next/tracking.html?wblNo={no}" },
    { name: "한진택배", url: "https://www.hanjin.com/kor/CMS/DeliveryMgr/WaybillResult.do?mCode=MN038&schLang=KR&wblnumText2={no}" },
    { name: "롯데택배", url: "https://www.lotteglogis.com/home/reservation/tracking/linkView?InvNo={no}" },
    { name: "로젠택배", url: "https://www.ilogen.com/web/personal/trace/{no}" },
    { name: "우체국택배", url: "https://service.epost.go.kr/trace.RetrieveDomRigiTraceList.comm?sid1={no}" },
    { name: "경동택배", url: "https://kdexp.com/service/delivery/etc/delivery.do?barcode={no}" },
    { name: "직접 배송", url: "" },
  ];
  const find = (name) => COURIERS.find((c) => c.name === name);
  // 송장번호: 숫자만 남김 (하이픈·공백 제거)
  const clean = (no) => String(no || "").replace(/[^0-9]/g, "");
  function trackUrl(courier, no) {
    const c = find(courier), n = clean(no);
    if (!c || !c.url || !n) return "";
    return c.url.replace("{no}", encodeURIComponent(n));
  }
  function naverUrl(courier, no) {
    const n = clean(no);
    if (!n || courier === "직접 배송") return "";
    return "https://search.naver.com/search.naver?query=" + encodeURIComponent(`${courier || "택배"} ${n}`);
  }
  // 고객 화면용: 택배사·송장번호 표시 + 배송조회 버튼 (esc 는 호출하는 쪽 것을 받음)
  function trackHtml(o, esc) {
    const e = esc || ((s) => String(s ?? "").replace(/[&<>"']/g, (ch) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[ch])));
    if (!o || !o.tracking) {
      if (o && o.courier === "직접 배송" && (o.status === "배송 중" || o.status === "배송 완료")) {
        return `<div class="my-track"><span>배송</span><b>직접 배송</b></div>`;
      }
      return `<div class="my-track muted"><span>송장번호</span><b>출고 후 안내</b></div>`;
    }
    const url = trackUrl(o.courier, o.tracking), nv = naverUrl(o.courier, o.tracking);
    return `<div class="my-track"><span>${e(o.courier || "택배")} 송장번호</span><b>${e(o.tracking)}</b>`
      + `<button type="button" class="link-plain" data-copy="${e(o.tracking)}">복사</button>`
      + (url ? `<a class="btn btn-primary track-btn" href="${e(url)}" target="_blank" rel="noopener">배송조회</a>` : "")
      + (nv ? `<a class="link-plain track-alt" href="${e(nv)}" target="_blank" rel="noopener">${url ? "네이버로 조회" : "배송조회"}</a>` : "")
      + `</div>`;
  }
  // 복사 버튼 연결 (목록을 다시 그린 뒤 호출)
  function bindCopy(root) {
    (root || document).querySelectorAll(".my-track [data-copy]").forEach((b) => b.onclick = async () => {
      try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "복사됨"; }
      catch (err) { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "선택됨"; }
    });
  }
  window.Delivery = { COURIERS, names: COURIERS.map((c) => c.name), clean, trackUrl, naverUrl, trackHtml, bindCopy };
})();
