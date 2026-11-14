// ============================================================
// 회원가입 · 로그인 (시연용)
// - 회원 정보는 이 브라우저 localStorage 에만 저장됩니다. 서버 전송 없음.
// - 비밀번호는 원문을 저장하지 않고 PBKDF2(SHA-256, 무작위 salt)로 변환한 값만 저장합니다.
// - 실제 운영: 서버 API(POST /api/auth/signup, /api/auth/login)와 서버 세션(HttpOnly 쿠키)으로 교체해야 합니다.
//   브라우저 저장소 방식은 같은 PC를 쓰는 사람이 데이터를 볼 수 있어 실제 개인정보 보관에 쓰면 안 됩니다.
// ============================================================
(function () {
  "use strict";
  const MEMBERS_KEY = "carib_members";
  const SESSION_KEY = "carib_session";
  const FAIL_KEY = "carib_login_fail";
  const MAX_FAIL = 5, LOCK_MIN = 5, ITER = 100000;

  const ls = {
    get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v == null ? d : v; } catch (e) { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} },
  };
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  // ---------- 입력 검사 ----------
  const normEmail = (e) => String(e || "").trim().toLowerCase();
  const digits = (s) => String(s || "").replace(/\D/g, "");
  function fmtPhone(s) {
    const d = digits(s);
    if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
    if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
    return String(s || "").trim();
  }
  function fmtBizNo(s) { const d = digits(s); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : String(s || "").trim(); }
  const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail(e));
  const isMobile = (p) => /^01[016789]\d{7,8}$/.test(digits(p));
  // 사업자등록번호 검증(국세청 체크섬)
  function isBizNo(s) {
    const d = digits(s); if (d.length !== 10) return false;
    const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
    let sum = 0;
    for (let i = 0; i < 9; i++) sum += +d[i] * w[i];
    sum += Math.floor((+d[8] * 5) / 10);
    return (10 - (sum % 10)) % 10 === +d[9];
  }
  function pwProblem(pw) {
    if (!pw || pw.length < 8) return "비밀번호는 8자 이상 입력해 주세요.";
    if (pw.length > 64) return "비밀번호는 64자 이하로 입력해 주세요.";
    if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "비밀번호에 영문과 숫자를 모두 포함해 주세요.";
    if (/\s/.test(pw)) return "비밀번호에는 공백을 사용할 수 없습니다.";
    return "";
  }

  // ---------- 비밀번호 변환 ----------
  const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
  const unhex = (h) => new Uint8Array((h.match(/../g) || []).map((x) => parseInt(x, 16)));
  async function hashPw(pw, saltHex) {
    if (!window.crypto || !crypto.subtle) throw new Error("이 브라우저에서는 보안 기능(crypto.subtle)을 사용할 수 없습니다. http://localhost 또는 https 주소로 접속해 주세요.");
    const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(pw), "PBKDF2", false, ["deriveBits"]);
    const bits = await crypto.subtle.deriveBits({ name: "PBKDF2", hash: "SHA-256", salt: unhex(saltHex), iterations: ITER }, key, 256);
    return hex(bits);
  }
  const newSalt = () => hex(crypto.getRandomValues(new Uint8Array(16)));
  function sameHash(a, b) { if (a.length !== b.length) return false; let r = 0; for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i); return r === 0; }

  // ---------- 회원 저장소 ----------
  const members = () => ls.get(MEMBERS_KEY, []);
  const saveMembers = (list) => ls.set(MEMBERS_KEY, list);
  const findByEmail = (email) => members().find((m) => m.email === normEmail(email));
  const publicView = (m) => { if (!m) return null; const { salt, hash, ...rest } = m; return rest; };

  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  function writeSession(id, remember) {
    const s = JSON.stringify({ id, at: new Date().toISOString() });
    try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, s); } catch (e) {}
  }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {} }

  function current() {
    const s = readSession(); if (!s || !s.id) return null;
    const m = members().find((x) => x.id === s.id);
    if (!m) { clearSession(); return null; }
    return publicView(m);
  }

  // ---------- 가입 ----------
  async function signup(input) {
    const errors = {};
    const type = input.type === "biz" ? "biz" : "personal";
    const name = String(input.name || "").trim();
    const email = normEmail(input.email);
    const phone = fmtPhone(input.phone);
    const company = String(input.company || "").trim();
    const bizNo = String(input.bizNo || "").trim();
    if (name.length < 2) errors.name = "이름을 2자 이상 입력해 주세요.";
    if (!isEmail(email)) errors.email = "이메일 형식을 확인해 주세요.";
    else if (findByEmail(email)) errors.email = "이미 가입된 이메일입니다.";
    const pp = pwProblem(input.password); if (pp) errors.password = pp;
    if (input.password !== input.password2) errors.password2 = "비밀번호가 일치하지 않습니다.";
    if (!isMobile(phone)) errors.phone = "휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)";
    if (type === "biz") {
      if (!company) errors.company = "업체명을 입력해 주세요.";
      if (bizNo && !isBizNo(bizNo)) errors.bizNo = "사업자등록번호가 올바르지 않습니다.";
    }
    const a = input.agree || {};
    if (!a.age) errors.age = "만 14세 이상만 가입하실 수 있습니다.";
    if (!a.terms || !a.privacy) errors.agree = "필수 약관에 동의해 주세요.";
    if (Object.keys(errors).length) return { ok: false, errors };

    const salt = newSalt();
    const hash = await hashPw(input.password, salt);
    const now = new Date().toISOString();
    const m = {
      id: "M-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      type, name, email, phone,
      company: type === "biz" ? company : "", bizNo: type === "biz" && bizNo ? fmtBizNo(bizNo) : "",
      agree: { age: true, terms: true, privacy: true, marketing: !!a.marketing, at: now },
      createdAt: now, lastLoginAt: now, salt, hash,
    };
    const list = members(); list.push(m); saveMembers(list);
    // 관리자 '회원' 목록용으로 서버에 보냄 (비밀번호 변환값은 보내지 않음)
    if (window.Remote) { const { salt: _s, hash: _h, ...pub } = m; Remote.send("member", pub); }
    writeSession(m.id, false);
    return { ok: true, member: publicView(m) };
  }

  // ---------- 로그인 ----------
  function failInfo(email) { return (ls.get(FAIL_KEY, {})[email]) || { n: 0, until: 0 }; }
  function setFail(email, v) { const all = ls.get(FAIL_KEY, {}); if (v) all[email] = v; else delete all[email]; ls.set(FAIL_KEY, all); }

  async function login(emailIn, pw, remember) {
    const email = normEmail(emailIn);
    if (!email || !pw) return { ok: false, error: "이메일과 비밀번호를 입력해 주세요." };
    const f = failInfo(email);
    if (f.until && f.until > Date.now()) {
      const min = Math.ceil((f.until - Date.now()) / 60000);
      return { ok: false, error: `비밀번호를 ${MAX_FAIL}회 잘못 입력하여 로그인이 일시적으로 제한되었습니다. ${min}분 후 다시 시도해 주세요.` };
    }
    const m = findByEmail(email);
    const ok = m ? sameHash(await hashPw(pw, m.salt), m.hash) : (await hashPw(pw, "00"), false);
    if (!ok) {
      const n = (f.until && f.until <= Date.now() ? 0 : f.n) + 1;
      setFail(email, n >= MAX_FAIL ? { n, until: Date.now() + LOCK_MIN * 60000 } : { n, until: 0 });
      const left = MAX_FAIL - n;
      if (left <= 0) return { ok: false, error: `비밀번호를 ${MAX_FAIL}회 잘못 입력하여 ${LOCK_MIN}분간 로그인이 제한됩니다.` };
      return { ok: false, error: "이메일 또는 비밀번호가 일치하지 않습니다." + (left > 0 && n >= 3 ? ` (${left}회 더 틀리시면 ${LOCK_MIN}분간 로그인이 제한됩니다)` : "") };
    }
    setFail(email, null);
    const list = members(); const t = list.find((x) => x.id === m.id); t.lastLoginAt = new Date().toISOString(); saveMembers(list);
    writeSession(m.id, !!remember);
    return { ok: true, member: publicView(t) };
  }
  function logout() { clearSession(); }

  // ---------- 회원정보 수정 · 비밀번호 변경 · 탈퇴 ----------
  function updateProfile(input) {
    const me = current(); if (!me) return { ok: false, errors: { _: "로그인이 필요합니다." } };
    const errors = {};
    const name = String(input.name || "").trim();
    const phone = fmtPhone(input.phone);
    if (name.length < 2) errors.name = "이름을 2자 이상 입력해 주세요.";
    if (!isMobile(phone)) errors.phone = "휴대폰 번호를 확인해 주세요.";
    let company = "", bizNo = "";
    if (me.type === "biz") {
      company = String(input.company || "").trim();
      bizNo = String(input.bizNo || "").trim();
      if (!company) errors.company = "업체명을 입력해 주세요.";
      if (bizNo && !isBizNo(bizNo)) errors.bizNo = "사업자등록번호가 올바르지 않습니다.";
    }
    if (Object.keys(errors).length) return { ok: false, errors };
    const list = members(); const t = list.find((x) => x.id === me.id);
    Object.assign(t, { name, phone, company, bizNo: bizNo ? fmtBizNo(bizNo) : "", updatedAt: new Date().toISOString() });
    if (t.agree.marketing !== !!input.marketing) t.agree = { ...t.agree, marketing: !!input.marketing, marketingAt: new Date().toISOString() };
    saveMembers(list);
    return { ok: true, member: publicView(t) };
  }
  async function changePassword(oldPw, newPw, newPw2) {
    const me = current(); if (!me) return { ok: false, errors: { _: "로그인이 필요합니다." } };
    const list = members(); const t = list.find((x) => x.id === me.id);
    if (!sameHash(await hashPw(oldPw || "", t.salt), t.hash)) return { ok: false, errors: { oldPw: "현재 비밀번호가 일치하지 않습니다." } };
    const pp = pwProblem(newPw); if (pp) return { ok: false, errors: { newPw: pp } };
    if (newPw !== newPw2) return { ok: false, errors: { newPw2: "새 비밀번호가 일치하지 않습니다." } };
    if (oldPw === newPw) return { ok: false, errors: { newPw: "현재 비밀번호와 다른 비밀번호를 입력해 주세요." } };
    t.salt = newSalt(); t.hash = await hashPw(newPw, t.salt); t.pwChangedAt = new Date().toISOString();
    saveMembers(list);
    return { ok: true };
  }
  async function withdraw(pw) {
    const me = current(); if (!me) return { ok: false, error: "로그인이 필요합니다." };
    const list = members(); const t = list.find((x) => x.id === me.id);
    if (!sameHash(await hashPw(pw || "", t.salt), t.hash)) return { ok: false, error: "비밀번호가 일치하지 않습니다." };
    saveMembers(list.filter((x) => x.id !== me.id));
    clearSession();
    return { ok: true };
  }

  // 시연용 계정 준비 (login.html 에서 data/demo-accounts.js 가 있을 때만)
  async function seedDemo(accounts) {
    for (const a of accounts || []) {
      if (findByEmail(a.email)) continue;
      const salt = newSalt(), now = new Date().toISOString();
      const list = members();
      list.push({ id: a.id || "M-DEMO", type: a.type || "biz", name: a.name, email: normEmail(a.email), phone: fmtPhone(a.phone), company: a.company || "", bizNo: a.bizNo || "",
        agree: { age: true, terms: true, privacy: true, marketing: false, at: now }, createdAt: now, lastLoginAt: "", demo: true, salt, hash: await hashPw(a.password, salt) });
      saveMembers(list);
    }
  }

  // ---------- 상단 메뉴: 로그인 / 회원 이름 ----------
  function renderHeader() {
    const nav = document.querySelector(".topbar nav"); if (!nav || nav.dataset.noAuth != null) return;
    nav.querySelectorAll(".nav-auth").forEach((n) => n.remove());
    const me = current();
    const here = SiteNav.page();
    const next = encodeURIComponent(here + SiteNav.search() + SiteNav.hash());
    const cart = nav.querySelector(".cart-btn");
    const add = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); const n = t.content.firstChild; cart ? nav.insertBefore(n, cart) : nav.appendChild(n); };
    if (me) {
      add(`<a class="nav-auth keep nav-user${here === "mypage.html" ? " active" : ""}" href="mypage.html" title="마이페이지"><span class="full">${esc(me.name)}님</span><span class="short">MY</span></a>`);
      add(`<a class="nav-auth" href="#" data-logout>로그아웃</a>`);
    } else {
      add(`<a class="nav-auth keep nav-login${here === "login.html" || here === "signup.html" ? " active" : ""}" href="login.html${here === "login.html" || here === "signup.html" ? "" : "?next=" + next}">로그인</a>`);
    }
  }
  document.addEventListener("click", (e) => {
    const a = e.target.closest && e.target.closest("[data-logout]"); if (!a) return;
    e.preventDefault();
    logout();
    SiteNav.go("index.html");
  });
  window.addEventListener("storage", (e) => { if (e.key === SESSION_KEY || e.key === MEMBERS_KEY) renderHeader(); });

  // 로그인 후 돌아갈 주소 — 같은 사이트 안의 상대 경로만 허용
  function safeNext(fallback) {
    const n = SiteNav.params().get("next") || "";
    return /^[a-z0-9._-]+\.html([?#].*)?$/i.test(n) ? n : (fallback || "mypage.html");
  }

  window.CaribAuth = {
    current, signup, login, logout, updateProfile, changePassword, withdraw, seedDemo,
    members: () => members().map(publicView), renderHeader, safeNext,
    util: { esc, fmtPhone, fmtBizNo, isEmail, isMobile, isBizNo, pwProblem },
    MEMBERS_KEY,
  };
  renderHeader();
})();
