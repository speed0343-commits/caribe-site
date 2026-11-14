// ============================================================
// 관리자 화면 ↔ 서버 (/api/admin)
// 1) 로그인 확인 → 안 돼 있으면 비밀번호 입력 화면
// 2) 서버에서 주문·의뢰·문의·채팅·회원·AI 질문/답변을 불러와 window.RemoteStore 에 담음
//    (core.js 의 store.get/set 이 이걸 쓰므로 admin.js 는 그대로 동작)
// 3) admin.js 가 store.set 으로 바꾼 내용은 바뀐 기록만 골라 서버에 저장
// 4) 채팅은 4초, 나머지는 30초마다 새로 불러옴
// ============================================================
(function () {
  "use strict";
  const MAP = { carib_orders: "order", carib_requests: "request", inquiries: "inquiry", carib_agent_chats: "chat", carib_members: "member", carib_ai_unanswered: "unanswered", carib_ai_answers: "answer" };
  const KEY_OF = Object.fromEntries(Object.entries(MAP).map(([k, v]) => [v, k]));
  const OLDEST_FIRST = new Set(["inquiry", "member"]); // 예전 화면이 오래된 것부터 쌓던 목록
  const cache = {}, snap = {};
  const clone = (v) => JSON.parse(JSON.stringify(v));
  let pending = 0, gen = 0, started = false;

  async function api(method, payload) {
    try {
      const r = method === "GET"
        ? await fetch("/api/admin?" + new URLSearchParams(payload), { credentials: "same-origin" })
        : await fetch("/api/admin", { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      let data = {};
      try { data = await r.json(); } catch (e) {}
      if (r.status === 401 && started) showLogin("로그인이 만료되었습니다. 다시 로그인해 주십시오.");
      return { ok: r.ok, status: r.status, data };
    } catch (e) { return { ok: false, status: 0, data: {} }; }
  }

  function put(kind, arr) {
    let list = arr.slice();
    if (OLDEST_FIRST.has(kind)) list.reverse();
    if (kind === "chat") list.sort((a, b) => String(b.updatedAt || b.createdAt).localeCompare(String(a.updatedAt || a.createdAt)));
    const before = JSON.stringify(cache[KEY_OF[kind]] || null);
    cache[KEY_OF[kind]] = list;
    snap[kind] = new Map(list.map((r) => [r.id, JSON.stringify(r)]));
    return before !== JSON.stringify(list);
  }

  // 바뀐 기록만 서버로 (순서대로 하나씩). 저장이 끝나면 화면 아래에 결과를 잠깐 보여 줌 (채팅 답변은 대화창에 바로 보이므로 생략)
  let chain = Promise.resolve(), failed = false;
  function queue(payload) {
    pending++; gen++;
    chain = chain.then(async () => {
      const r = await api("POST", payload);
      if (!r.ok && r.status !== 401) failed = true;
    }).finally(() => {
      pending--; gen++;
      if (pending) return;
      if (failed) toast("저장하지 못했습니다. 인터넷 연결을 확인하고 다시 시도해 주십시오.", true);
      else if (payload.kind !== "chat") toast(payload.action === "delete" ? "삭제했습니다." : "저장했습니다.");
      failed = false;
    });
  }

  window.RemoteStore = {
    has: (k) => k in MAP,
    get: (k, d) => (k in cache ? clone(cache[k]) : d),
    set(k, v) {
      const kind = MAP[k], prev = snap[kind] || new Map(), next = new Map();
      cache[k] = clone(v);
      for (const r of v) {
        if (!r || !r.id) continue;
        const j = JSON.stringify(r);
        next.set(r.id, j);
        if (!prev.has(r.id)) queue({ action: "create", kind, data: r });
        else if (prev.get(r.id) !== j) queue({ action: "update", kind, id: r.id, data: r });
      }
      for (const id of prev.keys()) if (!next.has(id)) queue({ action: "delete", kind, id });
      snap[kind] = next;
    },
  };

  async function load(kinds) {
    const g = gen;
    const r = await api("GET", { action: "list", kinds: kinds.join(",") });
    if (!r.ok || !r.data.data) return { ok: false, changed: false };
    if (pending || g !== gen) return { ok: true, changed: false }; // 저장 중에 받은 예전 내용은 버림
    let changed = false;
    for (const k of kinds) if (put(k, r.data.data[k] || [])) changed = true;
    return { ok: true, changed };
  }

  // ---------------- 화면 ----------------
  const $ = (s) => document.querySelector(s);
  function toast(text, isError) {
    let t = $("#adminToast");
    if (!t) { t = document.createElement("div"); t.id = "adminToast"; t.className = "contact-toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
    t.textContent = text; t.classList.add("show"); t.classList.toggle("err", !!isError);
    clearTimeout(t._h); t._h = setTimeout(() => t.classList.remove("show"), isError ? 6000 : 2500);
  }
  function showLogin(msg) {
    $("#adminApp").hidden = true; $("#logoutBtn").hidden = true;
    $("#loginBox").hidden = false;
    $("#loginMsg").textContent = msg || "";
    $("#loginPw").value = ""; $("#loginPw").focus();
  }
  function showStatus(me) {
    const n = me.notify || {};
    const parts = [
      me.db ? "저장소 연결됨" : "⚠ 저장소(Upstash Redis)가 연결되지 않아 고객 기록을 받을 수 없습니다",
      `이메일 알림 ${n.email ? "켜짐" : "꺼짐"}`, `문자 알림 ${n.sms ? "켜짐" : "꺼짐"}`,
    ];
    $("#sysStatus").innerHTML = parts.map((p) => `<span>${p}</span>`).join(" · ") + (n.email || n.sms ? ' <button type="button" class="btn btn-ghost" id="testNotify" style="padding:4px 10px">알림 시험 보내기</button>' : "");
    const tb = $("#testNotify");
    if (tb) tb.onclick = async () => {
      tb.disabled = true;
      const r = await api("POST", { action: "test-notify" });
      const res = (r.data && r.data.result) || {};
      toast(r.ok ? `시험 발송 — 이메일: ${{ sent: "보냄", failed: "실패", off: "꺼짐" }[res.email] || "-"}, 문자: ${{ sent: "보냄", failed: "실패", off: "꺼짐" }[res.sms] || "-"}` : "시험 발송에 실패했습니다.");
      tb.disabled = false;
    };
    $("#sysStatus").classList.toggle("warn", !me.db);
  }

  async function startApp(me) {
    $("#loginBox").hidden = true; $("#adminApp").hidden = false; $("#logoutBtn").hidden = false;
    showStatus(me);
    if (me.db) await load(Object.values(MAP));
    else Object.values(MAP).forEach((k) => put(k, []));
    if (!started) {
      started = true;
      const s = document.createElement("script"); s.src = "admin.js"; document.body.appendChild(s);
      setInterval(async () => { if (!document.hidden && me.db) await load(["chat"]); }, 4000);
      setInterval(async () => {
        if (document.hidden || !me.db) return;
        const r = await load(["order", "request", "inquiry", "member", "unanswered", "answer"]);
        if (r.changed && typeof window.renderAll === "function") window.renderAll();
      }, 30000);
    } else if (typeof window.renderAll === "function") window.renderAll();
  }

  async function boot() {
    const r = await api("GET", { action: "me" });
    if (r.ok) return startApp(r.data);
    if (r.status === 401 && r.data.error === "no_password") return showLogin("관리자 비밀번호가 아직 설정되지 않았습니다. Vercel 환경 변수에 ADMIN_PASSWORD를 등록해 주십시오.");
    if (r.status === 401) return showLogin("");
    showLogin("서버에 연결하지 못했습니다. 잠시 후 새로고침해 주십시오.");
  }

  $("#loginForm").addEventListener("submit", async (e) => {
    e.preventDefault();
    const btn = $("#loginForm button"); btn.disabled = true;
    const r = await api("POST", { action: "login", password: $("#loginPw").value });
    btn.disabled = false;
    if (r.ok) { const me = await api("GET", { action: "me" }); if (me.ok) return startApp(me.data); }
    $("#loginMsg").textContent = r.status === 401 ? "비밀번호가 맞지 않습니다." : r.status === 429 ? "시도가 너무 많습니다. 15분 뒤에 다시 시도해 주십시오."
      : r.data.error === "no_password" ? "관리자 비밀번호가 아직 설정되지 않았습니다. Vercel 환경 변수에 ADMIN_PASSWORD를 등록해 주십시오." : "로그인하지 못했습니다. 잠시 후 다시 시도해 주십시오.";
    $("#loginPw").select();
  });
  $("#logoutBtn").addEventListener("click", async (e) => {
    e.preventDefault();
    await api("POST", { action: "logout" });
    location.reload();
  });

  boot();
})();
