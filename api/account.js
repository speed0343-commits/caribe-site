// ============================================================
// 회원 계정 (POST /api/account) — 어느 기기에서나 같은 계정으로 로그인
// { action: "signup", ...가입 정보, id? }      → 가입 + 로그인 (id: 예전 브라우저 계정을 옮길 때 그 회원번호 유지)
// { action: "login", email, password, remember } → 로그인 쿠키(cb_m, HttpOnly)
// { action: "me" } / { action: "logout" }
// { action: "update", name, phone, company, bizNo, marketing }
// { action: "password", oldPw, newPw, newPw2 }  → 다른 기기 로그인은 풀림
// { action: "withdraw", password }
// { action: "orders" }                            → 내 주문 (다른 기기에서 한 주문도 마이페이지에 보이게)
// { action: "find-id", name, phone }              → 가린 아이디(이메일) 목록
// { action: "reset-request", email, name }        → 가입 이메일로 인증번호 6자리(10분) 발송.
//                                                  고객 메일 발송이 아직 꺼져 있으면 관리자에게 재설정 요청으로 접수
// { action: "reset-confirm", email, code, newPw, newPw2 } → 새 비밀번호로 변경 + 로그인
// ============================================================
"use strict";
const crypto = require("crypto");
const { send, readBody, clientIp, originOk, cookies } = require("../lib/http");
const db = require("../lib/db");
const M = require("../lib/members");
const { notify, adminLink, sendCustomerEmail, customerEmailOn } = require("../lib/notify");

const ID_RE = /^M-[A-Z0-9-]{4,24}$/;
const newId = () => "M-" + Date.now().toString(36).toUpperCase() + crypto.randomBytes(2).toString("hex").toUpperCase();
const now = () => new Date().toISOString();
const str = (v, n = 100) => String(v == null ? "" : v).trim().slice(0, n);

module.exports = async function handler(req, res) {
  if (req.method !== "POST") return send(res, 405, { error: "method_not_allowed" });
  if (!originOk(req)) return send(res, 403, { error: "forbidden" });
  if (!db.configured()) return send(res, 503, { error: "not_configured" });
  let body;
  try { body = await readBody(req, 20_000); } catch { return send(res, 400, { error: "bad_request" }); }
  const ip = clientIp(req), action = String(body.action || "");
  const ok = (data, cookie) => send(res, 200, { ok: true, ...data }, cookie ? { "Set-Cookie": cookie } : {});
  const fail = (status, data) => send(res, status, { ok: false, ...data });

  try {
    // ---------------- 가입 ----------------
    if (action === "signup") {
      if (await db.limited("signup:" + ip, 10, 3600)) return fail(429, { error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." });
      const errors = {};
      const type = body.type === "biz" ? "biz" : "personal";
      const name = str(body.name, 40), email = M.normEmail(body.email), phone = M.fmtPhone(body.phone);
      const company = str(body.company, 80), bizNo = str(body.bizNo, 20);
      if (name.length < 2) errors.name = "이름을 2자 이상 입력해 주세요.";
      if (!M.isEmail(email)) errors.email = "이메일 형식을 확인해 주세요.";
      const pp = M.pwProblem(body.password); if (pp) errors.password = pp;
      if (body.password !== body.password2) errors.password2 = "비밀번호가 일치하지 않습니다.";
      if (!M.isMobile(phone)) errors.phone = "휴대폰 번호를 확인해 주세요. (예: 010-1234-5678)";
      if (type === "biz") {
        if (!company) errors.company = "업체명을 입력해 주세요.";
        if (bizNo && !M.isBizNo(bizNo)) errors.bizNo = "사업자등록번호가 올바르지 않습니다.";
      }
      const a = body.agree || {};
      if (!a.age) errors.age = "만 14세 이상만 가입하실 수 있습니다.";
      if (!a.terms || !a.privacy) errors.agree = "필수 약관에 동의해 주세요.";
      if (!errors.email && await M.byEmail(email)) errors.email = "이미 가입된 이메일입니다.";
      if (Object.keys(errors).length) return fail(400, { errors });

      // 회원번호: 예전 브라우저 계정을 옮길 때는 그 번호를 그대로 써야 이 기기의 주문·의뢰 기록과 이어짐.
      // 같은 번호로 관리자용 기록(비밀번호 없음, 같은 이메일)만 있던 경우에는 그 기록을 계정으로 바꿈. 그 밖에는 새 번호.
      let id = newId(), prev = null;
      if (ID_RE.test(String(body.id || ""))) {
        const cur = await db.get("member", body.id);
        if (!cur) id = body.id;
        else if (!cur._pw && M.normEmail(cur.email) === email) { id = body.id; prev = cur; }
      }
      const t = now();
      const m = {
        id, type, name, email, phone,
        company: type === "biz" ? company : "", bizNo: type === "biz" && bizNo ? M.fmtBizNo(bizNo) : "",
        agree: { age: true, terms: true, privacy: true, marketing: !!a.marketing, at: (prev && prev.agree && prev.agree.at) || t },
        createdAt: (prev && prev.createdAt) || (/^\d{4}-\d\d-\d\dT/.test(str(body.createdAt, 30)) ? str(body.createdAt, 30) : t), lastLoginAt: t,
        _pw: await M.hashPw(body.password), _sv: 0,
      };
      if (body.migrated) m.migratedAt = t;
      await db.save("member", m, Date.parse(m.createdAt) || Date.now());
      await M.index(m);
      if (!body.migrated) await notify({ subject: `새 회원 가입 ${m.name}`, short: `새 회원 ${m.name} ${m.phone}`, lines: [`새 회원이 가입했습니다.`, `${m.type === "biz" ? "사업자" : "개인"} · ${m.name}${m.company ? " (" + m.company + ")" : ""} · ${m.phone} · ${m.email}`], link: adminLink(req) }).catch(() => {});
      return ok({ member: M.pub(m) }, await M.issue(m, false));
    }

    // ---------------- 로그인 ----------------
    if (action === "login") {
      const email = M.normEmail(body.email), pw = String(body.password || "");
      if (!email || !pw) return fail(400, { error: "이메일과 비밀번호를 입력해 주세요." });
      if (await db.limited("login-ip:" + ip, 40, 600) || await db.limited("mlogin:" + email, 8, 600)) {
        return fail(429, { error: "로그인 시도가 너무 많습니다. 10분 후 다시 시도하시거나 비밀번호 찾기를 이용해 주세요." });
      }
      const m = await M.byEmail(email);
      if (!m || !(await M.checkPw(pw, m._pw))) return fail(401, { error: "이메일 또는 비밀번호가 일치하지 않습니다.", code: "invalid" });
      m.lastLoginAt = now();
      await db.save("member", m);
      return ok({ member: M.pub(m) }, await M.issue(m, !!body.remember));
    }

    if (action === "logout") return ok({}, M.clearCookie());

    // ---------------- 아이디 찾기 ----------------
    if (action === "find-id") {
      if (await db.limited("find:" + ip, 10, 600)) return fail(429, { error: "요청이 많습니다. 잠시 후 다시 시도해 주세요." });
      const name = str(body.name, 40), phone = M.digits(body.phone);
      if (name.length < 2 || phone.length < 10) return fail(400, { error: "이름과 휴대폰 번호를 확인해 주세요." });
      const all = await db.list("member", 3000);
      const found = all.filter((m) => m._pw && m.name === name && M.digits(m.phone) === phone);
      if (!found.length) return fail(404, { error: "입력하신 정보와 일치하는 회원이 없습니다." });
      return ok({ ids: found.map((m) => ({ email: M.maskEmail(m.email), createdAt: (m.createdAt || "").slice(0, 10) })) });
    }

    // ---------------- 비밀번호 찾기 ----------------
    if (action === "reset-request") {
      if (await db.limited("reset:" + ip, 6, 600)) return fail(429, { error: "요청이 많습니다. 10분 후 다시 시도해 주세요." });
      const email = M.normEmail(body.email), name = str(body.name, 40);
      if (!M.isEmail(email) || name.length < 2) return fail(400, { error: "이메일과 이름을 확인해 주세요." });
      const m = await M.byEmail(email);
      if (!m || m.name !== name) return fail(404, { error: "입력하신 정보와 일치하는 회원이 없습니다." });
      if (await db.limited("reset-mail:" + m.id, 5, 3600)) return fail(429, { error: "인증번호 요청이 많습니다. 1시간 후 다시 시도해 주세요." });

      if (customerEmailOn()) {
        const code = String(crypto.randomInt(0, 1000000)).padStart(6, "0");
        const rec = { h: M.hmac(await M.secret(), m.id + ":" + code), n: 0, exp: Date.now() + 10 * 60 * 1000 };
        await db.cmd("SET", M.resetKey(m.id), JSON.stringify(rec), "EX", 600);
        try {
          await sendCustomerEmail(m.email, "[카리브무역] 비밀번호 재설정 인증번호", [
            `${m.name}님, 안녕하세요. 카리브무역입니다.`, "",
            `비밀번호 재설정 인증번호: ${code}`, "",
            "인증번호는 10분 동안만 사용하실 수 있습니다.",
            "본인이 요청하지 않으셨다면 이 메일은 무시하셔도 됩니다. 비밀번호는 바뀌지 않습니다.",
          ]);
          return ok({ via: "email", to: M.maskEmail(m.email) });
        } catch (e) {
          console.error("reset mail", e.message);
          await db.cmd("DEL", M.resetKey(m.id));
          // 메일 발송 실패 → 아래 관리자 접수로
        }
      }
      // 고객 메일을 보낼 수 없을 때: 관리자에게 재설정 요청으로 접수 → 전화로 본인 확인 후 임시 비밀번호 안내
      const inq = { id: "IQ-PW" + Date.now().toString(36).toUpperCase(), at: now(), createdAt: now(), name: m.name, phone: m.phone, vin: "", memberId: m.id,
        message: `[비밀번호 재설정 요청]\n회원: ${m.name} · ${m.email} · ${m.phone}\n본인 확인 후 관리자 > 회원 탭에서 '임시 비밀번호 발급'을 눌러 안내해 주세요.`, status: "접수", source: "password-reset" };
      await db.create("inquiry", inq);
      await notify({ subject: `비밀번호 재설정 요청 ${m.name}`, short: `비밀번호 재설정 요청 ${m.name} ${m.phone}`, lines: [`회원이 비밀번호 재설정을 요청했습니다.`, `${m.name} · ${m.email} · ${m.phone}`, `본인 확인 후 관리자 > 회원 탭에서 임시 비밀번호를 발급해 주세요.`], link: adminLink(req) }).catch(() => {});
      return ok({ via: "admin" });
    }

    if (action === "reset-confirm") {
      const email = M.normEmail(body.email), code = M.digits(body.code);
      const m = email ? await M.byEmail(email) : null;
      const bad = () => fail(400, { errors: { code: "인증번호가 올바르지 않거나 시간이 지났습니다. 인증번호를 다시 받아 주세요." } });
      if (!m || code.length !== 6) return bad();
      const raw = await db.cmd("GET", M.resetKey(m.id));
      let rec; try { rec = JSON.parse(raw); } catch { rec = null; }
      if (!rec || !(rec.exp > Date.now())) return bad();
      const want = Buffer.from(rec.h), got = Buffer.from(M.hmac(await M.secret(), m.id + ":" + code));
      if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) {
        rec.n = (rec.n || 0) + 1;
        if (rec.n >= 5) await db.cmd("DEL", M.resetKey(m.id));
        else await db.cmd("SET", M.resetKey(m.id), JSON.stringify(rec), "EX", Math.max(1, Math.ceil((rec.exp - Date.now()) / 1000)));
        return fail(400, { errors: { code: rec.n >= 5 ? "인증번호를 5회 잘못 입력하셨습니다. 인증번호를 다시 받아 주세요." : "인증번호가 일치하지 않습니다." } });
      }
      const pp = M.pwProblem(body.newPw); if (pp) return fail(400, { errors: { newPw: pp } });
      if (body.newPw !== body.newPw2) return fail(400, { errors: { newPw2: "새 비밀번호가 일치하지 않습니다." } });
      await db.cmd("DEL", M.resetKey(m.id));
      m._pw = await M.hashPw(body.newPw); m._sv = (m._sv || 0) + 1; m.pwChangedAt = now(); m.lastLoginAt = now(); delete m.mustChangePw;
      await db.save("member", m);
      return ok({ member: M.pub(m) }, await M.issue(m, false));
    }

    // ---------------- 여기부터는 로그인한 회원만 ----------------
    const me = await M.fromCookie(cookies(req));
    if (!me) return fail(401, { error: "로그인이 필요합니다.", code: "login_required" });

    if (action === "me") return ok({ member: M.pub(me) });

    if (action === "update") {
      const errors = {};
      const name = str(body.name, 40), phone = M.fmtPhone(body.phone);
      if (name.length < 2) errors.name = "이름을 2자 이상 입력해 주세요.";
      if (!M.isMobile(phone)) errors.phone = "휴대폰 번호를 확인해 주세요.";
      let company = "", bizNo = "";
      if (me.type === "biz") {
        company = str(body.company, 80); bizNo = str(body.bizNo, 20);
        if (!company) errors.company = "업체명을 입력해 주세요.";
        if (bizNo && !M.isBizNo(bizNo)) errors.bizNo = "사업자등록번호가 올바르지 않습니다.";
      }
      if (Object.keys(errors).length) return fail(400, { errors });
      Object.assign(me, { name, phone, company, bizNo: bizNo ? M.fmtBizNo(bizNo) : "", updatedAt: now() });
      if (!me.agree) me.agree = {};
      if (me.agree.marketing !== !!body.marketing) me.agree = { ...me.agree, marketing: !!body.marketing, marketingAt: now() };
      await db.save("member", me);
      return ok({ member: M.pub(me) });
    }

    if (action === "password") {
      if (!(await M.checkPw(body.oldPw, me._pw))) return fail(400, { errors: { oldPw: "현재 비밀번호가 일치하지 않습니다." } });
      const pp = M.pwProblem(body.newPw); if (pp) return fail(400, { errors: { newPw: pp } });
      if (body.newPw !== body.newPw2) return fail(400, { errors: { newPw2: "새 비밀번호가 일치하지 않습니다." } });
      if (body.oldPw === body.newPw) return fail(400, { errors: { newPw: "현재 비밀번호와 다른 비밀번호를 입력해 주세요." } });
      me._pw = await M.hashPw(body.newPw); me._sv = (me._sv || 0) + 1; me.pwChangedAt = now(); delete me.mustChangePw;
      await db.save("member", me);
      return ok({ member: M.pub(me) }, await M.issue(me, !!body.remember));
    }

    if (action === "withdraw") {
      if (!(await M.checkPw(body.password, me._pw))) return fail(400, { error: "비밀번호가 일치하지 않습니다." });
      await M.unindex(me);
      await db.remove("member", me.id);
      return ok({}, M.clearCookie());
    }

    if (action === "orders") {
      const all = await db.list("order", 2000);
      const mine = all.filter((o) => o.memberId === me.id).slice(0, 100).map(M.pub);
      return ok({ orders: mine });
    }

    return fail(400, { error: "bad_request" });
  } catch (e) {
    console.error("account", action, e.message);
    return fail(502, { error: "일시적인 오류가 발생했습니다. 잠시 후 다시 시도해 주세요." });
  }
};
