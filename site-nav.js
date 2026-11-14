// ============================================================
// 페이지 이동 도우미 — 일반 사이트와 "HTML 파일 하나" 버전에서 똑같이 동작
// - 일반 사이트: location / history 를 그대로 사용
// - 단일 파일 버전: 묶음 파일(window.__BUNDLE__)이 페이지를 바꿔 끼우므로 부모 창에 이동을 요청
// 모든 페이지에서 다른 스크립트보다 먼저 불러옵니다.
// ============================================================
(function () {
  "use strict";
  const B = window.__BUNDLE__ || null;
  const SiteNav = {
    bundled: !!B,
    page: () => (B ? B.page : location.pathname.split("/").pop() || "index.html"),
    search: () => (B ? (B.qs ? "?" + B.qs : "") : location.search),
    hash: () => (B ? (B.hash ? "#" + B.hash : "") : location.hash),
    params: () => new URLSearchParams(SiteNav.search()),
    go(url, replace) {
      if (B) parent.postMessage({ caribNav: String(url), replace: !!replace }, "*");
      else if (replace) location.replace(url);
      else location.href = url;
    },
    // 주소창만 바꾸기 (새로고침해도 같은 화면이 나오도록)
    setUrl(url) {
      if (B) parent.postMessage({ caribUrl: String(url) }, "*");
      else history.replaceState(null, "", url);
    },
  };
  window.SiteNav = SiteNav;

  // ---------- 휴대폰 메뉴: 좁은 화면에서 "메뉴" 버튼으로 전체 메뉴 열기 ----------
  function setupMenu() {
    const bar = document.querySelector(".topbar");
    const nav = bar && bar.querySelector("nav");
    if (!nav || nav.querySelectorAll("a").length < 4 || bar.querySelector(".nav-toggle")) return;
    const panel = document.createElement("div");
    panel.className = "nav-panel";
    panel.id = "navPanel";
    // 상단 띠(.topbar)는 pointer-events:none 이라 그대로 두면 패널 링크가 눌리지 않음.
    // CSS(cb.css)가 예전 것으로 캐시돼 있어도 눌리도록 여기서도 직접 지정
    panel.style.pointerEvents = "auto";
    nav.querySelectorAll("a").forEach((a) => {
      if (a.classList.contains("nav-auth") || a.classList.contains("cart-btn")) return;
      const c = a.cloneNode(true);
      c.className = a.classList.contains("active") ? "active" : "";
      panel.appendChild(c);
    });
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "nav-toggle";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-controls", "navPanel");
    btn.innerHTML = '<i aria-hidden="true"></i><span>메뉴</span>';
    nav.appendChild(btn);
    bar.appendChild(panel);
    // 로그인 · 내 정보 · 로그아웃 (좁은 화면에서는 상단 띠 대신 메뉴 안에 보임)
    // auth.js 가 로그인 상태에 따라 .nav-auth 를 다시 그리므로 메뉴를 열 때마다 새로 복사
    const acct = document.createElement("div");
    acct.className = "nav-panel-acct";
    panel.appendChild(acct);
    const syncAcct = () => {
      acct.innerHTML = "";
      nav.querySelectorAll("a.nav-auth").forEach((a) => {
        const c = a.cloneNode(true);
        c.className = a.classList.contains("active") ? "active" : "";
        acct.appendChild(c);
      });
    };
    const set = (open) => {
      if (open) syncAcct();
      bar.classList.toggle("menu-open", open);
      btn.setAttribute("aria-expanded", open ? "true" : "false");
      btn.querySelector("span").textContent = open ? "닫기" : "메뉴";
    };
    btn.addEventListener("click", () => set(!bar.classList.contains("menu-open")));
    panel.addEventListener("click", (e) => { if (e.target.closest("a")) set(false); });
    document.addEventListener("keydown", (e) => { if (e.key === "Escape") set(false); });
    document.addEventListener("click", (e) => { if (!bar.contains(e.target)) set(false); });
  }
  // 상단 메뉴: 맨 위에서는 배경 이미지와 하나로(투명), 내리면 옅은 배경을 깔아 글자가 잘 보이게
  function setupScroll() {
    const bar = document.querySelector(".topbar"); if (!bar) return;
    const on = () => bar.classList.toggle("scrolled", window.scrollY > 8);
    on();
    window.addEventListener("scroll", on, { passive: true });
  }
  // 메인 외 페이지의 장바구니 숫자 (메인은 app.js 가 직접 갱신)
  function updateCartCount() {
    let n = 0;
    try { const c = JSON.parse(localStorage.getItem("cart4")) || {}; Object.values(c).forEach((q) => { n += Number(q) || 0; }); } catch (e) {}
    document.querySelectorAll(".cart-count").forEach((b) => { b.textContent = n; });
  }
  SiteNav.updateCartCount = updateCartCount;
  window.addEventListener("storage", (e) => { if (e.key === "cart4") updateCartCount(); });
  // ---------- 전화·이메일 링크 ----------
  // 아티팩트 화면(액자 안)에서는 tel:/mailto: 로 바로 이동하면 빈 화면이 됩니다.
  // 휴대폰이면 새 창으로 전화·메일 앱을 열고, 그 밖에는 번호·주소를 복사하고 안내를 띄웁니다.
  function toast(msg) {
    let t = document.getElementById("contactToast");
    if (!t) {
      t = document.createElement("div");
      t.id = "contactToast"; t.className = "contact-toast"; t.setAttribute("role", "status");
      document.body.appendChild(t);
    }
    t.textContent = msg; t.classList.add("on");
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("on"), 3200);
  }
  function copy(text) {
    try { if (navigator.clipboard && window.isSecureContext) return navigator.clipboard.writeText(text).then(() => true, () => false); } catch (e) {}
    return Promise.resolve(false);
  }
  function setupContactLinks() {
    const mobile = window.matchMedia && window.matchMedia("(pointer: coarse)").matches;
    document.addEventListener("click", (e) => {
      const a = e.target.closest && e.target.closest('a[href^="tel:"], a[href^="mailto:"]');
      if (!a) return;
      let framed = true;
      try { framed = window.self !== window.top; } catch (err) {}
      if (!framed) return; // 일반 사이트에서는 링크 그대로 (휴대폰은 바로 전화 연결)
      e.preventDefault();
      const href = a.getAttribute("href");
      const isTel = href.startsWith("tel:");
      const shown = isTel ? href.slice(4).replace(/^(\d{3})(\d{4})(\d{4})$/, "$1-$2-$3") : href.slice(7);
      if (mobile) {
        const w = window.open(href, "_blank");
        if (w) return;
      }
      copy(shown).then((ok) => toast(isTel ? (ok ? `전화번호를 복사했습니다: ${shown}` : `전화 문의: ${shown}`) : (ok ? `이메일 주소를 복사했습니다: ${shown}` : `이메일: ${shown}`)));
    });
  }
  // ---------- 모든 페이지 오른쪽 아래 "AI 상담" 버튼 ----------
  // 메인(부품 검색)은 자체 상담창이 있고, 다른 페이지에서는 메인으로 가면서 상담창을 바로 엽니다.
  function setupChatFab() {
    if (document.getElementById("chatFab") || !document.querySelector(".footer")) return;
    const a = document.createElement("a");
    a.className = "chat-fab";
    a.href = "index.html?chat=1";
    a.textContent = "AI 상담";
    document.body.appendChild(a);
  }
  // ---------- 좁은 화면에서 입력칸 안내 문구 줄이기 (data-ph-short) ----------
  function setupShortPlaceholders() {
    const els = document.querySelectorAll("[data-ph-short]");
    if (!els.length || !window.matchMedia) return;
    const mq = window.matchMedia("(max-width: 480px)");
    const apply = () => els.forEach((el) => {
      if (!el.dataset.phLong) el.dataset.phLong = el.getAttribute("placeholder") || "";
      el.setAttribute("placeholder", mq.matches ? el.dataset.phShort : el.dataset.phLong);
    });
    apply();
    if (mq.addEventListener) mq.addEventListener("change", apply);
  }
  const init = () => { setupMenu(); setupScroll(); updateCartCount(); setupContactLinks(); setupChatFab(); setupShortPlaceholders(); };
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", init);
  else init();
})();
