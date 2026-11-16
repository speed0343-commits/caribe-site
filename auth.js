// ============================================================
// 회원가입 · 로그인 · 아이디/비밀번호 찾기
// - 회원 계정은 서버(/api/account)에 저장되고, 로그인은 서버가 주는 HttpOnly 쿠키로 유지됩니다.
//   어느 기기에서나 같은 계정으로 로그인할 수 있습니다. 비밀번호는 서버에서 scrypt 로 변환해 저장합니다.
// - 화면에서 쓰는 회원 정보(이름·연락처 등)만 이 브라우저(carib_session)에 같이 담아 두고, 페이지를 열 때 서버로 다시 확인합니다.
// - 예전 방식(이 브라우저 localStorage 에만 저장)으로 가입한 계정은 다음 로그인 때 서버로 옮겨집니다.
// - 서버 저장소가 없는 환경(로컬에서 python 으로 열기 등)에서는 예전처럼 이 브라우저 안에서만 동작합니다(시연용).
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

  // ---------- 예전 방식: 이 브라우저에 저장된 회원 (서버 없을 때 · 옮기기 전 계정) ----------
  const members = () => ls.get(MEMBERS_KEY, []);
  const saveMembers = (list) => ls.set(MEMBERS_KEY, list);
  const findByEmail = (email) => members().find((m) => m.email === normEmail(email));
  const publicView = (m) => { if (!m) return null; const { salt, hash, ...rest } = m; return rest; };

  // ---------- 로그인 상태 (화면용 회원 정보 보관) ----------
  // { id, at, mode: "server", m: 회원 정보 }  /  예전 방식은 { id, at }
  function readSession() {
    try { return JSON.parse(sessionStorage.getItem(SESSION_KEY)) || JSON.parse(localStorage.getItem(SESSION_KEY)); } catch (e) { return null; }
  }
  const remembered = () => { try { return !!localStorage.getItem(SESSION_KEY); } catch (e) { return false; } };
  // HINT: 이 브라우저에서 서버 로그인을 한 적이 있음 → 새 탭(세션 정보 없음)에서도 서버에 로그인 상태를 물어봄
  const HINT = "carib_auth_hint";
  function writeSession(id, remember, m) {
    const s = JSON.stringify(m ? { id, at: new Date().toISOString(), mode: "server", m } : { id, at: new Date().toISOString() });
    try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); } catch (e) {}
    try { (remember ? localStorage : sessionStorage).setItem(SESSION_KEY, s); if (m) localStorage.setItem(HINT, "1"); } catch (e) {}
  }
  function clearSession() { try { sessionStorage.removeItem(SESSION_KEY); localStorage.removeItem(SESSION_KEY); localStorage.removeItem(HINT); } catch (e) {} }
  const serverSession = () => { const s = readSession(); return s && s.mode === "server" ? s : null; };

  function current() {
    const s = readSession(); if (!s || !s.id) return null;
    if (s.mode === "server") return s.m || null;
    const m = members().find((x) => x.id === s.id);
    if (!m) { clearSession(); return null; }
    return publicView(m);
  }

  // ---------- 서버 호출 ----------
  const LOCALHOST = /^(localhost|127\.0\.0\.1)$/.test(location.hostname);
  async function api(action, payload) {
    try {
      const r = await fetch("/api/account", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action, ...(payload || {}) }) });
      let data = {}; try { data = await r.json(); } catch (e) {}
      return { status: r.status, ok: r.ok && data.ok !== false, data };
    } catch (e) { return { status: 0, ok: false, data: {} }; }
  }
  // 서버 저장소가 없는 환경 → 예전 방식(이 브라우저)으로 동작
  // (이 API 는 항상 { ok: … } 를 돌려줌 → ok 가 없는 404·405·501 은 API 자체가 없는 정적 서버, 503 은 저장소 미설정)
  const noServer = (r) => r.status === 503 || ([404, 405, 501].includes(r.status) && r.data.ok === undefined) || (r.status === 0 && LOCALHOST);
  const netError = { ok: false, error: "인터넷 연결을 확인한 뒤 다시 시도해 주세요." };
  const errOf = (r, fallback) => (r.data && r.data.error) || fallback || "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요.";
  const changed = () => { renderHeader(); window.dispatchEvent(new CustomEvent("auth:change")); };

  // 페이지를 열 때 서버로 로그인 상태 확인 (다른 기기에서 비밀번호를 바꿨거나 로그아웃·탈퇴한 경우 정리)
  async function refresh() {
    const s = readSession();
    let hint = false; try { hint = !!localStorage.getItem(HINT); } catch (e) {}
    if (!(s && s.id) && !hint) return;
    const r = await api("me");
    if (r.ok && r.data.member) { writeSession(r.data.member.id, remembered(), r.data.member); changed(); return; }
    if (r.status === 401) { clearSession(); changed(); } // 서버 로그인 아님 (예전 방식 로그인도 여기서 정리 → 다시 로그인하면 서버로 옮겨짐)
  }

  // ---------- 가입 ----------
  function checkSignup(input) {
    const errors = {};
    const type = input.type === "biz" ? "biz" : "personal";
    const name = String(input.name || "").trim();
    const email = normEmail(input.email);
    const phone = fmtPhone(input.phone);
    const company = String(input.company || "").trim();
    const bizNo = String(input.bizNo || "").trim();
    if (name.length < 2) errors.name = "이름을 2자 이상 입력해 주세요.";
    if (!isEmail(email)) errors.email = "이메일 형식을 확인해 주세요.";
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
    return { errors, type, name, email, phone, company, bizNo, a };
  }
  async function signup(input) {
    const c = checkSignup(input);
    if (Object.keys(c.errors).length) return { ok: false, errors: c.errors };
    const r = await api("signup", { type: c.type, name: c.name, email: c.email, phone: c.phone, company: c.company, bizNo: c.bizNo, password: input.password, password2: input.password2, agree: c.a });
    if (r.ok) { writeSession(r.data.member.id, false, r.data.member); return { ok: true, member: r.data.member }; }
    if (noServer(r)) return localSignup(input, c);
    if (r.status === 0) return { ok: false, errors: { _: netError.error }, error: netError.error };
    if (r.data.errors) return { ok: false, errors: r.data.errors };
    const e = errOf(r); return { ok: false, errors: { _: e }, error: e };
  }
  async function localSignup(input, c) {
    if (findByEmail(c.email)) return { ok: false, errors: { email: "이미 가입된 이메일입니다." } };
    const salt = newSalt();
    const hash = await hashPw(input.password, salt);
    const now = new Date().toISOString();
    const m = {
      id: "M-" + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(),
      type: c.type, name: c.name, email: c.email, phone: c.phone,
      company: c.type === "biz" ? c.company : "", bizNo: c.type === "biz" && c.bizNo ? fmtBizNo(c.bizNo) : "",
      agree: { age: true, terms: true, privacy: true, marketing: !!c.a.marketing, at: now },
      createdAt: now, lastLoginAt: now, salt, hash,
    };
    const list = members(); list.push(m); saveMembers(list);
    writeSession(m.id, false);
    return { ok: true, member: publicView(m) };
  }

  // ---------- 로그인 ----------
  function failInfo(email) { return (ls.get(FAIL_KEY, {})[email]) || { n: 0, until: 0 }; }
  function setFail(email, v) { const all = ls.get(FAIL_KEY, {}); if (v) all[email] = v; else delete all[email]; ls.set(FAIL_KEY, all); }

  async function login(emailIn, pw, remember) {
    const email = normEmail(emailIn);
    if (!email || !pw) return { ok: false, error: "이메일과 비밀번호를 입력해 주세요." };
    const r = await api("login", { email, password: pw, remember: !!remember });
    if (r.ok) { writeSession(r.data.member.id, !!remember, r.data.member); return { ok: true, member: r.data.member, mustChangePw: !!r.data.member.mustChangePw }; }
    if (noServer(r)) return localLogin(email, pw, remember);
    if (r.status === 0) return netError;
    // 서버에 없는 계정 → 예전 방식으로 이 브라우저에 가입한 계정이면 서버로 옮기고 로그인
    if (r.status === 401) {
      const moved = await migrate(email, pw, remember);
      if (moved) return moved;
    }
    return { ok: false, error: errOf(r, "이메일 또는 비밀번호가 일치하지 않습니다.") };
  }
  async function migrate(email, pw, remember) {
    const m = findByEmail(email);
    if (!m || m.demo) return null; // 시연용 계정은 옮기지 않음
    let same = false;
    try { same = sameHash(await hashPw(pw, m.salt), m.hash); } catch (e) { return null; }
    if (!same) return null;
    const r = await api("signup", { migrated: true, id: m.id, createdAt: m.createdAt, type: m.type, name: m.name, email: m.email, phone: m.phone, company: m.company, bizNo: m.bizNo,
      password: pw, password2: pw, agree: { age: true, terms: true, privacy: true, marketing: !!(m.agree && m.agree.marketing) } });
    if (!r.ok) return null;
    saveMembers(members().filter((x) => x.id !== m.id)); // 이 브라우저에 있던 비밀번호 변환값은 지움
    // 가입 응답은 '로그인 유지' 없이 로그인 → 로그인 유지를 골랐으면 한 번 더 로그인해 쿠키를 바꿈
    let member = r.data.member;
    if (remember) { const r2 = await api("login", { email, password: pw, remember: true }); if (r2.ok) member = r2.data.member; }
    writeSession(member.id, !!remember, member);
    return { ok: true, member, migrated: true };
  }
  async function localLogin(email, pw, remember) {
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
  function logout() {
    if (serverSession()) api("logout");
    clearSession();
  }

  // ---------- 회원정보 수정 · 비밀번호 변경 · 탈퇴 ----------
  async function updateProfile(input) {
    const me = current(); if (!me) return { ok: false, errors: { _: "로그인이 필요합니다." } };
    if (serverSession()) {
      const r = await api("update", { name: input.name, phone: input.phone, company: input.company, bizNo: input.bizNo, marketing: !!input.marketing });
      if (r.ok) { writeSession(r.data.member.id, remembered(), r.data.member); return { ok: true, member: r.data.member }; }
      if (r.status === 401) { clearSession(); changed(); }
      return { ok: false, errors: r.data.errors || { _: errOf(r) } };
    }
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
    if (serverSession()) {
      const r = await api("password", { oldPw, newPw, newPw2, remember: remembered() });
      if (r.ok) { writeSession(r.data.member.id, remembered(), r.data.member); return { ok: true, member: r.data.member }; }
      if (r.status === 401) { clearSession(); changed(); }
      return { ok: false, errors: r.data.errors || { _: errOf(r) } };
    }
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
    if (serverSession()) {
      const r = await api("withdraw", { password: pw });
      if (!r.ok) return { ok: false, error: errOf(r, "비밀번호가 일치하지 않습니다.") };
      clearSession();
      return { ok: true };
    }
    const list = members(); const t = list.find((x) => x.id === me.id);
    if (!sameHash(await hashPw(pw || "", t.salt), t.hash)) return { ok: false, error: "비밀번호가 일치하지 않습니다." };
    saveMembers(list.filter((x) => x.id !== me.id));
    clearSession();
    return { ok: true };
  }

  // ---------- 아이디 찾기 · 비밀번호 찾기 ----------
  function maskEmail(e) {
    const [u, d] = normEmail(e).split("@"); if (!d) return "";
    const keep = u.length <= 2 ? 1 : u.length <= 4 ? 2 : 3;
    return u.slice(0, keep) + "*".repeat(Math.max(2, u.length - keep)) + "@" + d;
  }
  async function findId(name, phone) {
    name = String(name || "").trim();
    if (name.length < 2 || !isMobile(phone)) return { ok: false, error: "이름과 휴대폰 번호를 확인해 주세요." };
    const r = await api("find-id", { name, phone });
    if (r.ok) return { ok: true, ids: r.data.ids };
    if (noServer(r)) {
      const ids = members().filter((m) => m.name === name && digits(m.phone) === digits(phone)).map((m) => ({ email: maskEmail(m.email), createdAt: (m.createdAt || "").slice(0, 10) }));
      return ids.length ? { ok: true, ids } : { ok: false, error: "입력하신 정보와 일치하는 회원이 없습니다." };
    }
    if (r.status === 0) return netError;
    return { ok: false, error: errOf(r) };
  }
  async function resetRequest(email, name) {
    email = normEmail(email); name = String(name || "").trim();
    if (!isEmail(email) || name.length < 2) return { ok: false, error: "이메일과 이름을 확인해 주세요." };
    const r = await api("reset-request", { email, name });
    if (r.ok) return { ok: true, via: r.data.via, to: r.data.to };
    if (noServer(r)) return { ok: false, error: "지금은 온라인으로 비밀번호를 찾을 수 없습니다. 010-5459-3111로 전화 주시면 확인해 드립니다." };
    if (r.status === 0) return netError;
    return { ok: false, error: errOf(r) };
  }
  async function resetConfirm(email, code, newPw, newPw2) {
    const r = await api("reset-confirm", { email: normEmail(email), code, newPw, newPw2 });
    if (r.ok) { writeSession(r.data.member.id, false, r.data.member); return { ok: true, member: r.data.member }; }
    if (r.status === 0) return { ok: false, errors: { _: netError.error } };
    return { ok: false, errors: r.data.errors || { _: errOf(r) } };
  }
  // 마이페이지: 서버에 있는 내 주문 (다른 기기에서 한 주문 포함). 서버 로그인이 아니면 null
  async function myOrders() {
    if (!serverSession()) return null;
    const r = await api("orders");
    if (r.status === 401) { clearSession(); changed(); return null; }
    return r.ok ? r.data.orders || [] : null;
  }

  // 시연용 계정 준비 (login.html 에서 data/demo-accounts.js 가 있을 때만, 이 브라우저 안에서만)
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
  window.addEventListener("storage", (e) => { if (e.key === SESSION_KEY || e.key === MEMBERS_KEY) changed(); });

  // 로그인 후 돌아갈 주소 — 같은 사이트 안의 상대 경로만 허용
  function safeNext(fallback) {
    const n = SiteNav.params().get("next") || "";
    return /^[a-z0-9._-]+\.html([?#].*)?$/i.test(n) ? n : (fallback || "mypage.html");
  }

  window.CaribAuth = {
    current, signup, login, logout, updateProfile, changePassword, withdraw, seedDemo,
    findId, resetRequest, resetConfirm, myOrders, refresh, ready: null,
    members: () => members().map(publicView), renderHeader, safeNext,
    util: { esc, fmtPhone, fmtBizNo, isEmail, isMobile, isBizNo, pwProblem },
    MEMBERS_KEY,
  };
  renderHeader();
  window.CaribAuth.ready = refresh().catch(() => {});
})();
