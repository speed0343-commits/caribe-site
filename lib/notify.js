// ============================================================
// 새 주문·의뢰·문의·상담 알림 (설정한 것만 보냄. 실패해도 접수는 그대로 진행)
// 이메일: Resend  — RESEND_API_KEY, 받는 주소 NOTIFY_EMAIL(기본 caribetrading@naver.com),
//                   보내는 주소 NOTIFY_FROM(기본 onboarding@resend.dev: Resend 가입 이메일로만 보낼 수 있음)
// 문자:   솔라피   — SOLAPI_API_KEY, SOLAPI_API_SECRET, SOLAPI_SENDER(사전 등록 발신번호), NOTIFY_PHONE(받을 휴대폰)
// ============================================================
"use strict";
const crypto = require("crypto");

const RESEND_URL = () => process.env.RESEND_API_URL || "https://api.resend.com/emails";
const SOLAPI_URL = () => process.env.SOLAPI_API_URL || "https://api.solapi.com/messages/v4/send";
const emailOn = () => !!process.env.RESEND_API_KEY;
const smsOn = () => !!(process.env.SOLAPI_API_KEY && process.env.SOLAPI_API_SECRET && process.env.SOLAPI_SENDER && process.env.NOTIFY_PHONE);
const digits = (s) => String(s || "").replace(/\D/g, "");
const escHtml = (s) => String(s ?? "").replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

async function email(subject, lines, link) {
  const to = (process.env.NOTIFY_EMAIL || "caribetrading@naver.com").split(",").map((s) => s.trim()).filter(Boolean);
  const text = lines.join("\n") + (link ? `\n\n관리자 화면: ${link}` : "");
  const html = `<div style="font-family:sans-serif;font-size:15px;line-height:1.6">${lines.map((l) => escHtml(l)).join("<br>")}${link ? `<p><a href="${escHtml(link)}">관리자 화면 열기</a></p>` : ""}</div>`;
  const r = await fetch(RESEND_URL(), {
    method: "POST",
    headers: { Authorization: "Bearer " + process.env.RESEND_API_KEY, "Content-Type": "application/json" },
    body: JSON.stringify({ from: process.env.NOTIFY_FROM || "카리브무역 알림 <onboarding@resend.dev>", to, subject, text, html }),
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error("resend " + r.status + " " + (await r.text()).slice(0, 200));
}

async function sms(text) {
  const date = new Date().toISOString();
  const salt = crypto.randomBytes(16).toString("hex");
  const signature = crypto.createHmac("sha256", process.env.SOLAPI_API_SECRET).update(date + salt).digest("hex");
  const r = await fetch(SOLAPI_URL(), {
    method: "POST",
    headers: { Authorization: `HMAC-SHA256 apiKey=${process.env.SOLAPI_API_KEY}, date=${date}, salt=${salt}, signature=${signature}`, "Content-Type": "application/json" },
    body: JSON.stringify({ message: { to: digits(process.env.NOTIFY_PHONE), from: digits(process.env.SOLAPI_SENDER), text } }),
    signal: AbortSignal.timeout(6000),
  });
  if (!r.ok) throw new Error("solapi " + r.status + " " + (await r.text()).slice(0, 200));
}

// subject: 이메일 제목 / lines: 본문 줄 / short: 문자용 짧은 문장 / link: 관리자 화면 주소
async function notify({ subject, lines, short, link }) {
  const result = { email: emailOn() ? "pending" : "off", sms: smsOn() ? "pending" : "off" };
  await Promise.all([
    emailOn() && email(subject, lines, link).then(() => { result.email = "sent"; }, (e) => { result.email = "failed"; console.error("notify email", e.message); }),
    smsOn() && sms(`[카리브무역] ${short || subject}`).then(() => { result.sms = "sent"; }, (e) => { result.sms = "failed"; console.error("notify sms", e.message); }),
  ]);
  return result;
}

const adminLink = (req) => {
  const host = req.headers["x-forwarded-host"] || req.headers.host;
  const proto = req.headers["x-forwarded-proto"] || (/^localhost/.test(host || "") ? "http" : "https");
  return host ? `${proto}://${host}/admin.html` : "";
};

module.exports = { notify, adminLink, status: () => ({ email: emailOn(), sms: smsOn() }) };
