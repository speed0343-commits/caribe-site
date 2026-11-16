// ============================================================
// 회원 계정 (서버 저장): 비밀번호 변환, 로그인 쿠키, 이메일 색인, 입력 검사
// - 회원 기록은 저장소의 "member" 종류에 저장. 비밀번호 변환값(_pw)·로그인 버전(_sv)처럼
//   밑줄(_)로 시작하는 값은 관리자 화면·고객 화면 어디에도 내보내지 않습니다.
// - 비밀번호: scrypt(무작위 salt). 원문은 저장하지 않습니다.
// - 로그인 쿠키(cb_m): 회원 id · 로그인 버전 · 만료 시각을 서명. 비밀번호를 바꾸면 버전이 올라가 다른 기기 로그인이 풀립니다.
// - 서명 열쇠: 환경 변수 MEMBER_SESSION_SECRET, 없으면 저장소에 한 번 만들어 둔 무작위 값을 사용
// ============================================================
"use strict";
const crypto = require("crypto");
const db = require("./db");

const COOKIE = "cb_m";
const DAY = 24 * 60 * 60 * 1000;
const normEmail = (e) => String(e || "").trim().toLowerCase();
const digits = (s) => String(s || "").replace(/\D/g, "");
const emailKey = (email) => `cb:member-email:${normEmail(email)}`;
const resetKey = (id) => `cb:member-reset:${id}`;

// ---------- 입력 검사 (auth.js 와 같은 규칙) ----------
const isEmail = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(normEmail(e)) && normEmail(e).length <= 120;
const isMobile = (p) => /^01[016789]\d{7,8}$/.test(digits(p));
function fmtPhone(s) {
  const d = digits(s);
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`;
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`;
  return String(s || "").trim();
}
function fmtBizNo(s) { const d = digits(s); return d.length === 10 ? `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}` : String(s || "").trim(); }
function isBizNo(s) {
  const d = digits(s); if (d.length !== 10) return false;
  const w = [1, 3, 7, 1, 3, 7, 1, 3, 5];
  let sum = 0;
  for (let i = 0; i < 9; i++) sum += +d[i] * w[i];
  sum += Math.floor((+d[8] * 5) / 10);
  return (10 - (sum % 10)) % 10 === +d[9];
}
function pwProblem(pw) {
  if (typeof pw !== "string" || pw.length < 8) return "비밀번호는 8자 이상 입력해 주세요.";
  if (pw.length > 64) return "비밀번호는 64자 이하로 입력해 주세요.";
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return "비밀번호에 영문과 숫자를 모두 포함해 주세요.";
  if (/\s/.test(pw)) return "비밀번호에는 공백을 사용할 수 없습니다.";
  return "";
}

// ---------- 비밀번호 ----------
const scrypt = (pw, salt) => new Promise((ok, no) => crypto.scrypt(String(pw), salt, 32, { N: 16384, r: 8, p: 1 }, (e, k) => (e ? no(e) : ok(k))));
async function hashPw(pw) {
  const salt = crypto.randomBytes(16);
  return `s1$${salt.toString("base64url")}$${(await scrypt(pw, salt)).toString("base64url")}`;
}
async function checkPw(pw, stored) {
  const [v, s, h] = String(stored || "").split("$");
  if (v !== "s1" || !s || !h) { await scrypt(String(pw || ""), "x"); return false; } // 시간 차이로 계정 유무가 드러나지 않게
  const a = await scrypt(String(pw || ""), Buffer.from(s, "base64url")), b = Buffer.from(h, "base64url");
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}
// 임시 비밀번호: 헷갈리는 글자(0 O 1 l I) 없이 영문 + 숫자 10자
function tempPassword() {
  const L = "abcdefghjkmnpqrstuvwxyz", N = "23456789", A = L + N;
  const pick = (set) => set[crypto.randomInt(set.length)];
  const chars = [pick(L), pick(N), ...Array.from({ length: 8 }, () => pick(A))];
  for (let i = chars.length - 1; i > 0; i--) { const j = crypto.randomInt(i + 1); [chars[i], chars[j]] = [chars[j], chars[i]]; }
  return chars.join("");
}

// ---------- 로그인 쿠키 ----------
let secretCache = "";
async function secret() {
  if (process.env.MEMBER_SESSION_SECRET) return process.env.MEMBER_SESSION_SECRET;
  if (secretCache) return secretCache;
  await db.cmd("SET", "cb:secret:member", crypto.randomBytes(32).toString("base64url"), "NX");
  secretCache = await db.cmd("GET", "cb:secret:member");
  return secretCache;
}
const hmac = (key, s) => crypto.createHmac("sha256", key).update(s).digest("base64url");
async function issue(m, remember) {
  const exp = Date.now() + (remember ? 30 : 1) * DAY;
  const body = Buffer.from(JSON.stringify({ id: m.id, v: m._sv || 0, exp })).toString("base64url");
  const token = `${body}.${hmac(await secret(), body)}`;
  // 로그인 유지: 30일 쿠키 / 아니면 브라우저를 닫으면 사라지는 쿠키(서명 안 만료는 1일)
  return `${COOKIE}=${token}; Path=/api; HttpOnly; Secure; SameSite=Lax${remember ? `; Max-Age=${30 * 24 * 3600}` : ""}`;
}
const clearCookie = () => `${COOKIE}=; Path=/api; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
// 쿠키 → 회원 기록 (없거나 만료·변조·버전 불일치면 null)
async function fromCookie(cookies) {
  const t = cookies[COOKIE];
  if (!t || typeof t !== "string") return null;
  const [body, sig] = t.split(".");
  if (!body || !sig) return null;
  const want = Buffer.from(hmac(await secret(), body)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  let p; try { p = JSON.parse(Buffer.from(body, "base64url").toString()); } catch { return null; }
  if (!p || !(p.exp > Date.now()) || !p.id) return null;
  const m = await db.get("member", p.id);
  if (!m || !m._pw || (m._sv || 0) !== p.v) return null;
  return m;
}

// ---------- 찾기 ----------
async function byEmail(email) {
  const id = await db.cmd("GET", emailKey(email));
  if (id) { const m = await db.get("member", id); if (m && normEmail(m.email) === normEmail(email)) return m; }
  return null;
}
async function index(m) { await db.cmd("SET", emailKey(m.email), m.id); }
async function unindex(m) { await db.cmd("DEL", emailKey(m.email)); }

// 화면에 보내는 회원 정보 (밑줄 값 제외)
const pub = (m) => { const o = {}; for (const [k, v] of Object.entries(m || {})) if (!k.startsWith("_")) o[k] = v; return o; };
// 아이디(이메일) 가리기: ab****@naver.com
function maskEmail(e) {
  const [u, d] = normEmail(e).split("@");
  if (!d) return "";
  const keep = u.length <= 2 ? 1 : u.length <= 4 ? 2 : 3;
  return u.slice(0, keep) + "*".repeat(Math.max(2, u.length - keep)) + "@" + d;
}

module.exports = {
  COOKIE, normEmail, digits, isEmail, isMobile, fmtPhone, fmtBizNo, isBizNo, pwProblem,
  hashPw, checkPw, tempPassword, issue, clearCookie, fromCookie, secret, hmac,
  byEmail, index, unindex, pub, maskEmail, resetKey,
};
