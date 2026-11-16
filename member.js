// 로그인 · 회원가입 · 마이페이지 화면 (auth.js 의 CaribAuth 사용)
(function () {
  "use strict";
  const A = window.CaribAuth;
  const { esc, fmtPhone } = A.util;
  const $ = (s, r) => (r || document).querySelector(s);
  const page = document.body.dataset.page;
  const WELCOME_KEY = "carib_welcome";

  // 비밀번호 보기/숨기기
  document.querySelectorAll(".pw-toggle").forEach((b) => b.addEventListener("click", () => {
    const i = b.parentElement.querySelector("input");
    const show = i.type === "password";
    i.type = show ? "text" : "password";
    b.textContent = show ? "숨기기" : "보기";
    b.setAttribute("aria-label", show ? "비밀번호 숨기기" : "비밀번호 보기");
  }));
  // 휴대폰 번호 자동 하이픈
  document.querySelectorAll('input[name="phone"]').forEach((i) => i.addEventListener("input", () => {
    const d = i.value.replace(/\D/g, "").slice(0, 11);
    i.value = d.length > 7 ? `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
  }));
  document.querySelectorAll('input[name="bizNo"]').forEach((i) => i.addEventListener("input", () => {
    const d = i.value.replace(/\D/g, "").slice(0, 10);
    i.value = d.length > 5 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
  }));

  // 필드 오류 표시
  function showErrors(form, errors) {
    form.querySelectorAll("[data-for]").forEach((w) => {
      const msg = errors[w.dataset.for] || (w.dataset.for === "agree" && errors.age) || "";
      const e = w.querySelector(".field-err"); if (e) e.textContent = msg;
      w.classList.toggle("has-err", !!msg);
      const inp = w.querySelector("input"); if (inp) inp.setAttribute("aria-invalid", msg ? "true" : "false");
    });
    const first = form.querySelector(".has-err input"); if (first) first.focus();
  }
  function clearOnInput(form) {
    form.addEventListener("input", (e) => {
      const w = e.target.closest("[data-for]"); if (!w) return;
      w.classList.remove("has-err"); const er = w.querySelector(".field-err"); if (er) er.textContent = "";
    });
  }
  function busy(btn, on, text) {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = text; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  }

  // ================= 로그인 =================
  if (page === "login") {
    if (A.current()) { SiteNav.go(A.safeNext("mypage.html"), true); return; }
    const seeding = window.DEMO_ACCOUNTS ? A.seedDemo(window.DEMO_ACCOUNTS).catch(() => {}) : Promise.resolve();
    const next = SiteNav.params().get("next");
    if (next) {
      $("#toSignup").href = "signup.html?next=" + encodeURIComponent(next);
      if (/^mypage\.html/.test(next)) { const m = $("#loginInfo"); m.textContent = "로그인 후 이용하실 수 있는 페이지입니다."; m.classList.remove("hidden"); }
    }
    $("#findPw").onclick = () => $("#findPwHelp").classList.toggle("hidden");
    const form = $("#loginForm");
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector(".auth-submit"), err = $("#loginError");
      err.hidden = true;
      busy(btn, true, "확인 중…");
      try {
        await seeding;
        const r = await A.login(form.email.value, form.password.value, form.remember.checked);
        if (!r.ok) { err.textContent = r.error; err.hidden = false; form.password.value = ""; form.password.focus(); return; }
        SiteNav.go(A.safeNext("mypage.html"));
      } catch (ex) { err.textContent = ex.message || "로그인 중 오류가 발생했습니다."; err.hidden = false; }
      finally { busy(btn, false); }
    });
  }

  // ================= 회원가입 =================
  if (page === "signup") {
    if (A.current()) { SiteNav.go("mypage.html", true); return; }
    const form = $("#signupForm");
    const next = SiteNav.params().get("next");
    if (next) $("#toLogin").href = "login.html?next=" + encodeURIComponent(next);
    const syncType = () => {
      const biz = form.type.value === "biz";
      form.classList.toggle("is-biz", biz);
      $("#nameLbl").innerHTML = (biz ? "담당자 이름" : "이름") + " <em>*</em>";
    };
    form.querySelectorAll('input[name="type"]').forEach((r) => r.addEventListener("change", syncType));
    syncType();
    // 전체 동의
    const boxes = ["age", "terms", "privacy", "marketing"].map((n) => form[n]);
    $("#agreeAll").addEventListener("change", (e) => boxes.forEach((b) => (b.checked = e.target.checked)));
    boxes.forEach((b) => b.addEventListener("change", () => ($("#agreeAll").checked = boxes.every((x) => x.checked))));
    clearOnInput(form);
    form.addEventListener("change", (e) => { if (e.target.type === "checkbox") { const w = form.querySelector('[data-for="agree"]'); w.classList.remove("has-err"); w.querySelector(".field-err").textContent = ""; } });

    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = form.querySelector(".auth-submit"), err = $("#signupError");
      err.hidden = true;
      busy(btn, true, "가입 처리 중…");
      try {
        const r = await A.signup({
          type: form.type.value, name: form.name.value, phone: form.phone.value, company: form.company.value, bizNo: form.bizNo.value,
          email: form.email.value, password: form.password.value, password2: form.password2.value,
          agree: { age: form.age.checked, terms: form.terms.checked, privacy: form.privacy.checked, marketing: form.marketing.checked },
        });
        if (!r.ok) { showErrors(form, r.errors); return; }
        try { sessionStorage.setItem(WELCOME_KEY, "1"); } catch (x) {}
        SiteNav.go(A.safeNext("mypage.html"));
      } catch (ex) { err.textContent = ex.message || "가입 중 오류가 발생했습니다."; err.hidden = false; }
      finally { busy(btn, false); }
    });
  }

  // ================= 마이페이지 =================
  if (page === "mypage") {
    let me = A.current();
    if (!me) { SiteNav.go("login.html?next=mypage.html", true); return; }
    const get = (k) => { try { return JSON.parse(localStorage.getItem(k)) || []; } catch (e) { return []; } };
    const STATUS = ["접수", "검토 중", "견적 안내", "작업 완료", "취소"];
    const badge = (s) => `<span class="status s${Math.max(0, STATUS.indexOf(s || "접수"))}">${esc(s || "접수")}</span>`;
    // 저장값(UTC) → 한국 시간 표시
    const dt = (iso) => { const d = new Date(iso); if (!iso || isNaN(d)) return ""; const p = (n) => String(n).padStart(2, "0"); return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`; };
    const day = (iso) => dt(iso).slice(0, 10);

    function renderHead() {
      $("#myTitle").textContent = `${me.name}님`;
      $("#mySub").textContent = [me.type === "biz" ? "사업자 회원" : "개인 회원", me.company, `가입일 ${day(me.createdAt)}`].filter(Boolean).join(" · ");
    }
    try {
      if (sessionStorage.getItem(WELCOME_KEY)) {
        sessionStorage.removeItem(WELCOME_KEY);
        const w = $("#myWelcome"); w.textContent = `${me.name}님, 회원가입을 환영합니다. 이제 상담·문의 시 연락처가 자동으로 입력되며, 진행 상황을 이곳에서 확인하실 수 있습니다.`; w.classList.remove("hidden");
      }
    } catch (e) {}

    function renderLists() {
      const reqs = get("carib_requests").filter((r) => r.memberId === me.id);
      const inqs = get("inquiries").filter((r) => r.memberId === me.id).reverse();
      const allOrders = get("carib_orders");
      const orders = allOrders.filter((o) => o.memberId === me.id);
      const open = reqs.filter((r) => ["접수", "검토 중", "견적 안내"].includes(r.status || "접수")).length;
      const ordOpen = orders.filter((o) => !["배송 완료", "취소"].includes(o.status)).length;
      $("#myStats").innerHTML = [[ordOpen, "진행 중 주문", "#myOrderSec"], [orders.length, "전체 주문", "#myOrderSec"], [reqs.length, "가공 의뢰", "#myReqSec"], [inqs.length, "문의", "#myInqSec"]]
        .map(([n, l, h]) => `<a href="${h}"><b>${n}</b><span>${l}</span></a>`).join("");

      // 같은 휴대폰 번호로 접수된 비회원 주문 → 내 주문으로 연결 (이 브라우저에 저장된 주문만)
      const digitsOf = (s) => String(s || "").replace(/\D/g, "");
      const guest = allOrders.filter((o) => !o.memberId && digitsOf(o.orderer && o.orderer.phone) === digitsOf(me.phone));
      $("#myGuestLink").innerHTML = guest.length ? `<div class="my-link-box"><span>휴대폰 번호 ${esc(me.phone)}로 접수된 <b>비회원 주문 ${guest.length}건</b>이 있습니다.</span><button type="button" class="btn btn-ghost" id="linkGuest">내 주문으로 연결</button></div>` : "";
      const lg = $("#linkGuest");
      if (lg) lg.onclick = () => {
        const all = get("carib_orders");
        all.forEach((o) => { if (!o.memberId && digitsOf(o.orderer && o.orderer.phone) === digitsOf(me.phone)) { o.memberId = me.id; o.linkedAt = new Date().toISOString(); } });
        localStorage.setItem("carib_orders", JSON.stringify(all));
        renderLists();
      };

      const FLOW = ["주문 접수", "적용 확인", "입금 확인", "출고 준비", "배송 중", "배송 완료"];
      const FLOW_HELP = {
        "주문 접수": "담당자가 차량 적용 여부를 확인한 뒤 연락드리겠습니다.",
        "적용 확인": "적용 확인이 완료되었습니다. 안내해 드린 계좌로 입금해 주세요.",
        "입금 확인": "입금이 확인되었습니다. 출고를 준비하고 있습니다.",
        "출고 준비": "상품을 포장하고 있습니다. 가공 상품은 가공을 마친 뒤 출고됩니다.",
        "배송 중": "상품이 택배로 배송 중입니다. 아래 배송조회 버튼을 누르시면 택배사 화면에서 현재 위치를 확인하실 수 있습니다.",
        "배송 완료": "배송이 완료되었습니다. 이용해 주셔서 감사합니다.",
        "취소 요청": "취소 요청이 접수되었습니다. 담당자가 확인 후 처리해 드리겠습니다.",
        "취소": "취소된 주문입니다.",
      };
      const obadge = (s) => `<span class="status s${s === "취소" ? 4 : s === "배송 완료" ? 3 : s === "주문 접수" ? 0 : s === "취소 요청" ? 1 : 2}">${esc(s || "주문 접수")}</span>`;
      const wonf = (n) => (Number(n) || 0).toLocaleString("ko-KR") + "원";
      const canCancel = (o) => ["주문 접수", "적용 확인"].includes(o.status) && !(o.payment && o.payment.paid);
      const steps = (o) => {
        if (o.status === "취소" || o.status === "취소 요청") return `<p class="my-cancel-note">${esc(FLOW_HELP[o.status])}</p>`;
        const cur = Math.max(0, FLOW.indexOf(o.status));
        return `<ol class="my-steps" aria-label="진행 단계">${FLOW.map((s, i) => `<li class="${i < cur ? "done" : i === cur ? "now" : ""}"${i === cur ? ' aria-current="step"' : ""}><i></i><span>${s}</span></li>`).join("")}</ol>
          <p class="my-step-help">${esc(FLOW_HELP[o.status] || "")}</p>`;
      };
      $("#myOrders").innerHTML = orders.length ? `<ul class="my-list my-orders">${orders.map((o, idx) => {
        const first = o.items[0] || {};
        const what = `디스크 ${first.axle === "front" ? "앞" : "뒤"} ${first.brand || ""} ${first.pn || ""}${o.items.length > 1 ? ` 외 ${o.items.length - 1}건` : ""}`;
        const rows = [
          ["주문 상품", o.items.map((x) => `디스크 ${x.axle === "front" ? "앞" : "뒤"} ${x.brand} OEM ${x.pn} × ${x.sets}세트${x.chaos ? ` + ${x.chaos.name}` : ""}`).join("\n")],
          ["결제 예정 금액", wonf(o.amounts.total) + (o.amounts.chaosQuote ? " + 가공비 별도" : "") + " · 무료배송"],
          ["결제", `${o.payment.name} · ${o.payment.paid ? "결제 완료" : "미결제"}`],
          ["받는 분", `${o.receiver.name} · ${o.receiver.phone}`],
          ["배송지", `(${o.receiver.zip}) ${o.receiver.addr1} ${o.receiver.addr2}${o.receiver.memo ? "\n메모: " + o.receiver.memo : ""}`],
          o.vin ? ["차대번호", o.vin] : null,
        ].filter(Boolean);
        const track = window.Delivery ? Delivery.trackHtml(o, esc) : (o.tracking
          ? `<div class="my-track"><span>${esc(o.courier || "택배")} 송장번호</span><b>${esc(o.tracking)}</b><button type="button" class="link-plain" data-copy="${esc(o.tracking)}">복사</button></div>`
          : `<div class="my-track muted"><span>송장번호</span><b>출고 후 안내</b></div>`);
        const cancel = canCancel(o)
          ? `<div class="my-cancel"><button type="button" class="btn btn-ghost danger" data-cancel="${esc(o.id)}">주문 취소 요청</button><span class="small muted">입금 전 주문만 취소 요청하실 수 있습니다.</span></div>` : "";
        return `<li><details${idx === 0 ? " open" : ""}><summary><span class="my-id">${esc(o.id)}</span><span class="my-what">${esc(what)}</span><span class="my-date">${esc(day(o.createdAt))}</span>${obadge(o.status)}</summary>
          <div class="my-order-body">${steps(o)}${track}
          <table class="info-table">${rows.map(([k, v]) => `<tr><th>${k}</th><td style="white-space:pre-line">${esc(v)}</td></tr>`).join("")}</table>${cancel}</div></details></li>`;
      }).join("")}</ul>` : `<p class="my-empty">아직 주문 내역이 없습니다. 로그인 후 주문하시면 이곳에서 진행 상황과 송장번호를 확인하실 수 있습니다. <a href="index.html#top">부품 찾기 →</a></p>`;

      // 송장번호 복사
      $("#myOrders").querySelectorAll("[data-copy]").forEach((b) => b.onclick = async () => {
        try { await navigator.clipboard.writeText(b.dataset.copy); b.textContent = "복사됨"; }
        catch (e) { const r = document.createRange(); r.selectNodeContents(b.previousElementSibling); const s = getSelection(); s.removeAllRanges(); s.addRange(r); b.textContent = "선택됨"; }
      });
      // 취소 요청: 두 번 눌러 확인
      $("#myOrders").querySelectorAll("[data-cancel]").forEach((b) => b.onclick = () => {
        if (!b.dataset.armed) { b.dataset.armed = "1"; b.textContent = "한 번 더 누르시면 취소 요청됩니다"; return; }
        const all = get("carib_orders"); const t = all.find((x) => x.id === b.dataset.cancel);
        if (t && canCancel(t)) { t.status = "취소 요청"; t.cancelRequestedAt = new Date().toISOString(); localStorage.setItem("carib_orders", JSON.stringify(all)); if (window.Remote) Remote.cancelOrder(t); }
        renderLists();
      });

      $("#myReqs").innerHTML = reqs.length ? `<ul class="my-list">${reqs.map((r) => {
        const car = [r.vehicle?.make, r.vehicle?.model].filter(Boolean).join(" ") || r.vehicle?.vin || "차량 미입력";
        const disc = [r.disc?.brand, r.disc?.pn, r.disc?.axle].filter(Boolean).join(" ");
        const rows = [["차대번호", r.vehicle?.vin], ["디스크", disc], ["규격", r.disc?.spec], ["수량", r.disc?.qty], ["가공 타입", r.needs?.ctype], ["예상 가공비", r.needs?.fee], ["요청 사항", r.needs?.request], ["희망 일정", r.needs?.schedule], ["필요 품목", r.contact?.items]].filter(([, v]) => v);
        return `<li><details><summary><span class="my-id">${esc(r.id)}</span><span class="my-what">${esc(car)}${disc ? " · " + esc(disc) : ""}</span><span class="my-date">${esc(r.date || day(r.createdAt))}</span>${badge(r.status)}</summary>
          <table class="info-table">${rows.map(([k, v]) => `<tr><th>${k}</th><td>${esc(v)}</td></tr>`).join("")}</table></details></li>`;
      }).join("")}</ul>` : `<p class="my-empty">로그인 후 작성하신 가공 의뢰가 이곳에 표시됩니다. <a href="consult.html">가공 상담 시작 →</a></p>`;

      $("#myInqs").innerHTML = inqs.length ? `<ul class="my-list">${inqs.map((r) => `<li><details><summary><span class="my-id">${esc(dt(r.at))}</span><span class="my-what">${esc((r.message || "").split("\n")[0].slice(0, 50))}</span>${badge(r.status)}</summary>
          <p class="my-msg">${esc(r.message)}</p></details></li>`).join("")}</ul>`
        : `<p class="my-empty">로그인 후 남기신 문의가 이곳에 표시됩니다.</p>`;
    }

    function fillProfile() {
      const f = $("#profileForm");
      f.email.value = me.email; f.name.value = me.name; f.phone.value = me.phone;
      f.company.value = me.company || ""; f.bizNo.value = me.bizNo || ""; f.marketing.checked = !!me.agree?.marketing;
      f.classList.toggle("is-biz", me.type === "biz");
    }
    const pf = $("#profileForm"); clearOnInput(pf);
    pf.addEventListener("submit", (e) => {
      e.preventDefault();
      $("#profileOk").classList.add("hidden");
      const r = A.updateProfile({ name: pf.name.value, phone: pf.phone.value, company: pf.company.value, bizNo: pf.bizNo.value, marketing: pf.marketing.checked });
      if (!r.ok) return showErrors(pf, r.errors);
      me = r.member; fillProfile(); renderHead(); A.renderHeader();
      $("#profileOk").classList.remove("hidden");
    });

    const pw = $("#pwForm"); clearOnInput(pw);
    pw.addEventListener("submit", async (e) => {
      e.preventDefault();
      $("#pwOk").classList.add("hidden");
      const btn = pw.querySelector("button[type=submit]"); busy(btn, true, "변경 중…");
      try {
        const r = await A.changePassword(pw.oldPw.value, pw.newPw.value, pw.newPw2.value);
        if (!r.ok) return showErrors(pw, r.errors);
        pw.reset(); $("#pwOk").classList.remove("hidden");
      } finally { busy(btn, false); }
    });

    const wd = $("#withdrawForm");
    wd.addEventListener("submit", async (e) => {
      e.preventDefault();
      const err = $("#withdrawErr"); err.hidden = true;
      const btn = wd.querySelector("button[type=submit]");
      // 확인 창(confirm) 대신 화면 안에서 두 번 눌러 확인 — 공유 페이지에서는 브라우저 확인 창이 뜨지 않음
      if (!wd.dataset.armed) {
        wd.dataset.armed = "1";
        btn.textContent = "탈퇴하시려면 한 번 더 눌러 주세요";
        err.textContent = "탈퇴하시면 회원 정보를 복구할 수 없습니다. 계속하시려면 버튼을 한 번 더 눌러 주세요.";
        err.hidden = false;
        return;
      }
      const r = await A.withdraw(wd.pw.value);
      if (!r.ok) { delete wd.dataset.armed; btn.textContent = "탈퇴하기"; err.textContent = r.error; err.hidden = false; return; }
      SiteNav.go("index.html");
    });

    renderHead(); renderLists(); fillProfile();
    window.addEventListener("storage", (e) => { if (e.key === "carib_requests" || e.key === "inquiries" || e.key === "carib_orders") renderLists(); });
    window.addEventListener("remote:sync", renderLists); // 담당자가 바꾼 주문·의뢰 상태를 서버에서 받아 오면 다시 그림
  }
})();
