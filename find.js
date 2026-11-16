// ============================================================
// 아이디 찾기 · 비밀번호 찾기 (find.html) — auth.js 의 CaribAuth 사용
// - 아이디 찾기: 이름 + 휴대폰 번호 → 가린 아이디(이메일)
// - 비밀번호 찾기: 이메일 + 이름 → 이메일로 받은 인증번호 6자리 + 새 비밀번호
//   (고객 메일 발송이 아직 준비되지 않았으면 담당자가 전화로 본인 확인 후 임시 비밀번호 안내)
// ============================================================
(function () {
  "use strict";
  const A = window.CaribAuth;
  const { esc } = A.util;
  const $ = (s) => document.querySelector(s);
  const busy = (btn, on, text) => {
    if (on) { btn.dataset.label = btn.textContent; btn.textContent = text; btn.disabled = true; }
    else { btn.textContent = btn.dataset.label || btn.textContent; btn.disabled = false; }
  };
  const showErr = (el, msg) => { el.textContent = msg || ""; el.hidden = !msg; };

  // 이미 로그인한 상태면 마이페이지로
  if (A.current()) { SiteNav.go("mypage.html", true); return; }

  // ---------- 탭 ----------
  const tabs = { id: [$("#tabId"), $("#paneId")], pw: [$("#tabPw"), $("#panePw")] };
  function show(which) {
    Object.entries(tabs).forEach(([k, [tab, pane]]) => { const on = k === which; tab.setAttribute("aria-selected", on ? "true" : "false"); tab.classList.toggle("on", on); pane.hidden = !on; });
  }
  $("#tabId").onclick = () => { show("id"); history.replaceState(null, "", "#id"); };
  $("#tabPw").onclick = () => { show("pw"); history.replaceState(null, "", "#pw"); };
  show(location.hash === "#pw" ? "pw" : "id");

  // 휴대폰 번호 자동 하이픈 · 비밀번호 보기
  document.querySelectorAll('input[name="phone"]').forEach((i) => i.addEventListener("input", () => {
    const d = i.value.replace(/\D/g, "").slice(0, 11);
    i.value = d.length > 7 ? `${d.slice(0, 3)}-${d.slice(3, d.length - 4)}-${d.slice(-4)}` : d.length > 3 ? `${d.slice(0, 3)}-${d.slice(3)}` : d;
  }));
  document.querySelectorAll(".pw-toggle").forEach((b) => b.addEventListener("click", () => {
    const i = b.parentElement.querySelector("input"); const showPw = i.type === "password";
    i.type = showPw ? "text" : "password"; b.textContent = showPw ? "숨기기" : "보기";
  }));

  // ---------- 아이디 찾기 ----------
  const idForm = $("#findIdForm");
  idForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#findIdError"), out = $("#findIdResult"), btn = idForm.querySelector(".auth-submit");
    showErr(err, ""); out.hidden = true;
    busy(btn, true, "확인 중…");
    const r = await A.findId(idForm.name.value, idForm.phone.value).finally(() => busy(btn, false));
    if (!r.ok) { showErr(err, r.error); return; }
    out.innerHTML = `<p>입력하신 정보로 가입된 아이디입니다.</p>
      <ul class="find-ids">${r.ids.map((x) => `<li><b>${esc(x.email)}</b>${x.createdAt ? `<span class="muted small">${esc(x.createdAt)} 가입</span>` : ""}</li>`).join("")}</ul>
      <p class="muted small">개인정보 보호를 위해 아이디 일부를 * 로 표시합니다.</p>
      <div class="find-next"><a class="btn btn-primary" href="login.html">로그인</a><button type="button" class="btn btn-ghost" id="goPw">비밀번호 찾기</button></div>`;
    out.hidden = false;
    $("#goPw").onclick = () => { show("pw"); history.replaceState(null, "", "#pw"); $("#resetReqForm").name.value = idForm.name.value; $("#resetReqForm").email.focus(); };
  });

  // ---------- 비밀번호 찾기 ----------
  const reqForm = $("#resetReqForm"), resetForm = $("#resetForm");
  let email = "";
  async function request(btn) {
    const err = $("#resetReqError");
    showErr(err, "");
    busy(btn, true, "보내는 중…");
    const r = await A.resetRequest(reqForm.email.value, reqForm.name.value).finally(() => busy(btn, false));
    if (!r.ok) { showErr(err, r.error); if (!resetForm.hidden) showErr($("#resetError"), r.error); return; }
    email = reqForm.email.value;
    if (r.via === "admin") { reqForm.hidden = true; resetForm.hidden = true; $("#resetAdmin").hidden = false; return; }
    reqForm.hidden = true; resetForm.hidden = false;
    $("#resetSent").textContent = `${r.to || "가입하신 이메일"}로 인증번호를 보냈습니다. 10분 안에 입력해 주세요. 메일이 보이지 않으면 스팸함도 확인해 주세요.`;
    resetForm.code.focus();
  }
  reqForm.addEventListener("submit", (e) => { e.preventDefault(); request(reqForm.querySelector(".auth-submit")); });
  $("#resendCode").onclick = (e) => request(e.target);

  resetForm.addEventListener("input", (e) => {
    const w = e.target.closest("[data-for]"); if (!w) return;
    w.classList.remove("has-err"); const er = w.querySelector(".field-err"); if (er) er.textContent = "";
  });
  resetForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const err = $("#resetError"), btn = resetForm.querySelector(".auth-submit");
    showErr(err, "");
    const pp = A.util.pwProblem(resetForm.newPw.value);
    const local = {};
    if (!/^\d{6}$/.test(resetForm.code.value.trim())) local.code = "인증번호 6자리를 입력해 주세요.";
    if (pp) local.newPw = pp;
    if (resetForm.newPw.value !== resetForm.newPw2.value) local.newPw2 = "새 비밀번호가 일치하지 않습니다.";
    const paint = (errors) => {
      resetForm.querySelectorAll("[data-for]").forEach((w) => {
        const msg = errors[w.dataset.for] || ""; w.classList.toggle("has-err", !!msg);
        const er = w.querySelector(".field-err"); if (er) er.textContent = msg;
      });
      const first = resetForm.querySelector(".has-err input"); if (first) first.focus();
    };
    if (Object.keys(local).length) return paint(local);
    busy(btn, true, "변경 중…");
    const r = await A.resetConfirm(email, resetForm.code.value.trim(), resetForm.newPw.value, resetForm.newPw2.value).finally(() => busy(btn, false));
    if (!r.ok) { paint(r.errors || {}); if (r.errors && r.errors._) showErr(err, r.errors._); return; }
    resetForm.innerHTML = `<p class="auth-msg">비밀번호가 변경되었습니다. 새 비밀번호로 로그인되었습니다.</p><a class="btn btn-primary auth-submit" href="mypage.html">마이페이지로</a>`;
  });
})();
