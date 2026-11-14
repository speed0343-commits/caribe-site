// ============================================================
// 관리자 로그인: 비밀번호는 Vercel 환경 변수 ADMIN_PASSWORD 에만 둡니다(코드·저장소에 넣지 않음).
// 로그인하면 12시간짜리 서명된 쿠키(HttpOnly)를 줍니다. 비밀번호를 바꾸면 기존 로그인은 모두 풀립니다.
// ============================================================
"use strict";
const crypto = require("crypto");

const COOKIE = "cb_admin";
const TTL_MS = 12 * 60 * 60 * 1000;
const sha = (s) => crypto.createHash("sha256").update(String(s)).digest();
const configured = () => !!process.env.ADMIN_PASSWORD;
const signKey = () => sha("caribe-admin|" + process.env.ADMIN_PASSWORD + "|" + (process.env.ADMIN_SESSION_SECRET || ""));
const sign = (s) => crypto.createHmac("sha256", signKey()).update(s).digest("base64url");

function passwordOk(input) {
  if (!configured() || typeof input !== "string" || !input) return false;
  return crypto.timingSafeEqual(sha(input), sha(process.env.ADMIN_PASSWORD));
}

function issue() {
  const exp = String(Date.now() + TTL_MS);
  return `${exp}.${sign(exp)}`;
}

function valid(token) {
  if (!configured() || typeof token !== "string") return false;
  const [exp, sig] = token.split(".");
  if (!exp || !sig || !(Number(exp) > Date.now())) return false;
  const a = Buffer.from(sig), b = Buffer.from(sign(exp));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

const cookieHeader = (token, maxAgeSec) =>
  `${COOKIE}=${token}; Path=/api; HttpOnly; Secure; SameSite=Strict; Max-Age=${maxAgeSec}`;
const loginCookie = () => cookieHeader(issue(), TTL_MS / 1000);
const logoutCookie = () => cookieHeader("", 0);

// 고객 쪽 조회용 임의 열쇠 (주문·의뢰 상태 조회, 상담 채팅)
const randomKey = () => crypto.randomBytes(18).toString("base64url");
function sameKey(a, b) {
  if (typeof a !== "string" || typeof b !== "string" || !a || !b) return false;
  return crypto.timingSafeEqual(sha(a), sha(b));
}

module.exports = { COOKIE, configured, passwordOk, valid, loginCookie, logoutCookie, randomKey, sameKey };
