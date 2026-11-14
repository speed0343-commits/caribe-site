// ============================================================
// 관리자 화면 (시연용): 가공 의뢰 · 일반 문의 목록, 상세, 상태·메모 관리
// 실제 운영: 서버 API(GET/PATCH /api/requests)와 관리자 로그인으로 교체
// ============================================================
let tab = "req";
const statusIdx = (s) => Math.max(0, REQ_STATUS.indexOf(s));
const badge = (s) => `<span class="status s${statusIdx(s)}">${esc(s || "접수")}</span>`;
REQ_STATUS.forEach((s) => $("#statusFilter").add(new Option(s, s)));

const getReqs = () => store.get(REQUESTS_KEY, []);
const getInqs = () => store.get(INQUIRIES_KEY, []).map((x, i) => ({ ...x, idx: i, status: x.status || "접수" }));
const getOrders = () => store.get(ORDERS_KEY, []);
const orderBadge = (s) => `<span class="status s${s === "취소" ? 4 : s === "배송 완료" ? 3 : s === "주문 접수" || s === "취소 요청" ? 1 : 0}">${esc(s)}</span>`;
const COURIERS = ["CJ대한통운", "한진택배", "롯데택배", "로젠택배", "우체국택배", "경동택배", "직접 배송"];

// 상담사가 아직 답하지 않은 고객 메시지 수 (마지막 상담사 답변 이후)
function unreadOf(c) {
  let n = 0;
  for (let i = c.messages.length - 1; i >= 0; i--) { const w = c.messages[i].who; if (w === "agent") break; if (w === "customer") n++; }
  return c.status === "종료" ? 0 : n;
}
const chatBadge = (s) => `<span class="status s${s === "대기" ? 1 : s === "상담 중" ? 0 : 4}">${esc(s)}</span>`;

function renderStats() {
  const r = getReqs(), q = getInqs(), ch = agentChats(), od = getOrders();
  const open = r.filter((x) => ["접수", "검토 중"].includes(x.status)).length;
  const waitingChats = ch.filter((c) => c.status !== "종료" && unreadOf(c) > 0).length;
  const newOrders = od.filter((o) => ["주문 접수", "적용 확인", "취소 요청"].includes(o.status)).length;
  const openInq = q.filter((x) => ["접수", "검토 중", "견적 안내"].includes(x.status)).length; // 작업 완료·취소는 빼고 셈
  $("#stats").innerHTML = [
    [newOrders, "처리 대기 주문 (접수·적용 확인·취소 요청)"], [open, "가공 의뢰 처리 대기"], [waitingChats, "답변 대기 상담사 채팅"], [openInq, "일반 문의 처리 대기"],
  ].map(([n, l]) => `<div><b>${n}</b><span>${l}</span></div>`).join("");
  const unreadTotal = ch.reduce((s, c) => s + unreadOf(c), 0);
  const b = $("#chatBadge"); b.hidden = !unreadTotal; b.textContent = unreadTotal;
  const aiOpen = aiGroups().filter((g) => g.status === "미처리").length;
  const ab = $("#aiBadge"); ab.hidden = !aiOpen; ab.textContent = aiOpen;
}

// ---------------- AI 미답변 질문 ----------------
// 같은 질문(띄어쓰기·문장부호 무시)은 한 줄로 묶어 횟수로 표시
function aiGroups() {
  const map = new Map();
  store.get(AI_UNANSWERED_KEY, []).forEach((x) => {
    const k = x.norm || kwNorm(x.q);
    if (!map.has(k)) map.set(k, { key: k, q: x.q, items: [], status: x.status, last: x.at, car: x.car });
    const g = map.get(k); g.items.push(x);
    if (x.status === "미처리") g.status = "미처리";
  });
  return [...map.values()];
}
const aiBadge = (s) => `<span class="status s${s === "미처리" ? 1 : s === "답변 등록" ? 3 : 4}">${esc(s)}</span>`;
const PARTICLE = /(은|는|이|가|을|를|도|요|나요|까요|에요|예요|해요|돼요|되나요|인가요|있나요|있어요|할까요|하나요|가능해요|가능한가요|가능)$/;
function suggestKeywords(q) {
  return [...new Set(String(q).toLowerCase().replace(/[?!.,~]/g, " ").split(/\s+/).map((w) => w.replace(PARTICLE, "")).filter((w) => w.length >= 2))].slice(0, 3).join(", ");
}
function showAi(key) {
  const g = aiGroups().find((x) => x.key === key); if (!g) return;
  const answers = store.get(AI_ANSWERS_KEY, []);
  $("#detail").innerHTML = `<section class="panel"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
      <h2 style="margin:0">AI가 답하지 못한 질문</h2>${aiBadge(g.status)}</div>
    <p class="ai-q">"${esc(g.q)}"</p>
    <p class="muted small">${g.items.length}번 받은 질문 · 마지막 ${esc(fmtDT(g.last))}${g.car ? " · 대화 중 차량: " + esc(g.car) : ""}</p>
    ${(() => { const ids = [...new Set(g.items.map((x) => x.answerId).filter(Boolean))]; const regs = answers.filter((a) => ids.includes(a.id));
      return regs.length ? `<div class="ai-done"><b>등록된 답변</b>${regs.map((a) => `<p>${esc(a.answer)}</p><span class="muted small">키워드: ${a.keywords.map(esc).join(", ")}</span>`).join("")}</div>` : ""; })()}
    <form class="ai-form" id="aiForm">
      <label>키워드 <span class="muted small">쉼표로 구분 · 질문에 키워드가 모두 들어 있으면 아래 답변으로 응답합니다</span>
        <input name="keywords" required value="${esc(suggestKeywords(g.q))}" placeholder="예: 업체, 거래" /></label>
      <label>답변 <textarea name="answer" rows="4" required maxlength="800" placeholder="고객에게 보여 줄 답변을 적어 주십시오"></textarea></label>
      <div class="ai-form-actions"><button type="button" class="btn btn-ghost" id="aiSkip">답변 없이 제외</button><button type="submit" class="btn btn-primary">${g.status === "답변 등록" ? "답변 추가 등록" : "답변 등록"}</button></div>
    </form>
    <p class="muted small" id="aiTest"></p></section>
    ${aiAnswersPanel(answers)}`;
  const f = $("#aiForm");
  const test = () => {
    const kws = f.keywords.value.split(",").map((k) => k.trim()).filter(Boolean);
    const ok = kws.length && kws.every((k) => g.key.includes(kwNorm(k)));
    $("#aiTest").textContent = kws.length ? (ok ? "이 질문에 등록한 답변이 나갑니다." : "키워드 중 이 질문에 없는 말이 있어 이 질문에는 답변이 나가지 않습니다.") : "";
  };
  f.keywords.addEventListener("input", test); test();
  f.onsubmit = (e) => {
    e.preventDefault();
    const kws = f.keywords.value.split(",").map((k) => k.trim()).filter(Boolean);
    if (!kws.length || !f.answer.value.trim()) return;
    const all = store.get(AI_ANSWERS_KEY, []);
    const id = "AA-" + Date.now().toString(36).toUpperCase();
    all.unshift({ id, keywords: kws, answer: f.answer.value.trim(), createdAt: new Date().toISOString(), hits: 0, from: g.q });
    store.set(AI_ANSWERS_KEY, all);
    // 이 키워드로 답할 수 있는 다른 미처리 질문도 함께 '답변 등록'으로
    aiGroups().filter((x) => x.status === "미처리" && kws.every((k) => x.key.includes(kwNorm(k)))).forEach((x) => setAiStatus(x.key, "답변 등록", id));
    setAiStatus(g.key, "답변 등록", id); renderAll(); showAi(g.key);
  };
  $("#aiSkip").onclick = () => { setAiStatus(g.key, "제외"); renderAll(); $("#detail").innerHTML = aiAnswersPanel(store.get(AI_ANSWERS_KEY, [])); };
  $("#detail").scrollIntoView({ behavior: "smooth" });
}
function setAiStatus(key, status, answerId) {
  const list = store.get(AI_UNANSWERED_KEY, []);
  list.forEach((x) => { if ((x.norm || kwNorm(x.q)) === key) { x.status = status; if (answerId) x.answerId = answerId; } });
  store.set(AI_UNANSWERED_KEY, list);
}
function aiAnswersPanel(answers) {
  return `<section class="panel"><h2>등록한 답변 <span class="muted small">${answers.length}개</span></h2>
    ${answers.length ? `<div class="table-wrap"><table class="admin-table"><thead><tr><th>키워드</th><th>답변</th><th>사용</th><th>등록일</th><th></th></tr></thead><tbody>
      ${answers.map((a) => `<tr><td>${a.keywords.map((k) => `<span class="tag">${esc(k)}</span>`).join(" ")}</td><td style="white-space:pre-wrap;max-width:420px">${esc(a.answer)}</td><td>${a.hits || 0}회</td><td>${esc((a.createdAt || "").slice(0, 10))}</td>
        <td><button type="button" class="btn btn-ghost" data-ai-del="${esc(a.id)}">삭제</button></td></tr>`).join("")}</tbody></table></div>`
      : '<p class="muted">아직 등록한 답변이 없습니다. 위 목록에서 질문을 눌러 답변을 등록해 보십시오.</p>'}</section>`;
}
document.addEventListener("click", (e) => {
  const b = e.target.closest("[data-ai-del]"); if (!b) return;
  const all = store.get(AI_ANSWERS_KEY, []).filter((a) => a.id !== b.dataset.aiDel);
  store.set(AI_ANSWERS_KEY, all);
  const list = store.get(AI_UNANSWERED_KEY, []); list.forEach((x) => { if (x.answerId === b.dataset.aiDel) { x.status = "미처리"; delete x.answerId; } }); store.set(AI_UNANSWERED_KEY, list);
  renderAll(); b.closest("section").outerHTML = aiAnswersPanel(all);
});

function matches(obj, q) { return !q || JSON.stringify(obj).toLowerCase().includes(q.toLowerCase()); }

function renderTable() {
  const q = $("#q").value.trim(), st = $("#statusFilter").value;
  if (tab === "req") {
    const list = getReqs().filter((r) => matches({ ...r, log: undefined }, q) && (!st || r.status === st));
    $("#table").innerHTML = `<thead><tr><th>의뢰번호</th><th>접수일</th><th>고객</th><th>연락처</th><th>차량</th><th>디스크</th><th>수량</th><th>상태</th></tr></thead><tbody>` +
      (list.length ? list.map((r) => `<tr data-id="${esc(r.id)}"><td><b>${esc(r.id)}</b></td><td>${esc(r.date)}</td><td>${esc(r.contact?.name)}</td><td>${esc(r.contact?.phone)}</td>
        <td>${esc([r.vehicle?.make, r.vehicle?.model].filter(Boolean).join(" ") || r.vehicle?.vin || "-")}${r.memberId ? ' <span class="tag">회원</span>' : ""}</td><td>${esc(r.disc?.pn || "-")} ${esc(r.disc?.axle || "")}</td><td>${esc(r.disc?.qty || "-")}</td><td>${badge(r.status)}</td></tr>`).join("")
        : `<tr><td colspan="8" class="muted" style="text-align:center;padding:28px">가공 의뢰가 없습니다. <a href="consult.html">가공 상담</a>에서 의뢰서를 만들어 보십시오.</td></tr>`) + "</tbody>";
  } else if (tab === "ord") {
    const list = getOrders().filter((o) => matches(o, q) && (!st || o.status === st));
    $("#table").innerHTML = `<thead><tr><th>주문번호</th><th>주문 시각</th><th>주문자</th><th>연락처</th><th>상품</th><th>금액</th><th>결제</th><th>상태</th></tr></thead><tbody>` +
      (list.length ? list.map((o) => `<tr data-ord="${esc(o.id)}"><td><b>${esc(o.id)}</b>${o.memberId ? ' <span class="tag">회원</span>' : ""}</td><td>${esc(fmtDT(o.createdAt))}</td><td>${esc(o.orderer.name)}</td><td>${esc(o.orderer.phone)}</td>
        <td>${esc(o.items[0] ? o.items[0].pn : "-")}${o.items.length > 1 ? ` 외 ${o.items.length - 1}` : ""}</td><td>${won(o.amounts.total)}${o.amounts.chaosQuote ? "+α" : ""}</td><td>${esc(o.payment.name)} · ${o.payment.paid ? "완료" : "미결제"}</td><td>${orderBadge(o.status)}</td></tr>`).join("")
        : `<tr><td colspan="8" class="muted" style="text-align:center;padding:28px">주문이 없습니다. 부품 검색에서 장바구니에 담고 주문해 보십시오.</td></tr>`) + "</tbody>";
  } else if (tab === "mem") {
    // 회원 목록 (비밀번호 변환값은 표시하지 않음)
    const reqs = getReqs(), inqs = getInqs();
    const list = store.get("carib_members", []).map(({ salt, hash, ...m }) => m).filter((m) => matches(m, q)).reverse();
    $("#table").innerHTML = `<thead><tr><th>가입일</th><th>회원번호</th><th>구분</th><th>이름</th><th>업체명</th><th>이메일</th><th>휴대폰</th><th>마케팅 수신</th><th>최근 로그인</th><th>의뢰</th><th>문의</th></tr></thead><tbody>` +
      (list.length ? list.map((m) => `<tr data-mem="${esc(m.id)}"><td>${esc((m.createdAt || "").slice(0, 10))}</td><td><b>${esc(m.id)}</b>${m.demo ? ' <span class="tag">시연</span>' : ""}</td><td>${m.type === "biz" ? "사업자" : "개인"}</td><td>${esc(m.name)}</td><td>${esc(m.company || "-")}</td>
        <td>${esc(m.email)}</td><td>${esc(m.phone)}</td><td>${m.agree?.marketing ? "동의" : "-"}</td><td>${esc(fmtDT(m.lastLoginAt) || "-")}</td>
        <td>${reqs.filter((r) => r.memberId === m.id).length}</td><td>${inqs.filter((r) => r.memberId === m.id).length}</td></tr>`).join("")
        : `<tr><td colspan="11" class="muted" style="text-align:center;padding:28px">가입한 회원이 없습니다. <a href="signup.html">회원가입</a>에서 만들어 보십시오.</td></tr>`) + "</tbody>";
  } else if (tab === "ai") {
    const list = aiGroups().filter((g) => matches(g, q) && (!st || g.status === st)).sort((a, b) => (a.status === "미처리" ? 0 : 1) - (b.status === "미처리" ? 0 : 1) || b.items.length - a.items.length || String(b.last).localeCompare(String(a.last)));
    $("#table").innerHTML = `<thead><tr><th>질문</th><th>받은 횟수</th><th>마지막</th><th>대화 중 차량</th><th>상태</th></tr></thead><tbody>` +
      (list.length ? list.map((g) => `<tr data-ai="${esc(g.key)}"><td style="white-space:normal;max-width:420px"><b>${esc(g.q)}</b></td><td>${g.items.length}회</td><td>${esc(fmtDT(g.last))}</td><td>${esc(g.car || "-")}</td><td>${aiBadge(g.status)}</td></tr>`).join("")
        : `<tr><td colspan="5" class="muted" style="text-align:center;padding:28px">AI가 답하지 못한 질문이 없습니다. 고객이 AI 상담에서 처음 보는 질문을 하면 여기에 쌓입니다.</td></tr>`) + "</tbody>";
    if (!$("#detail").innerHTML.trim()) $("#detail").innerHTML = aiAnswersPanel(store.get(AI_ANSWERS_KEY, []));
  } else if (tab === "chat") {
    const list = agentChats().filter((c) => matches(c, q) && (!st || c.status === st));
    $("#table").innerHTML = `<thead><tr><th>채팅번호</th><th>시작</th><th>고객</th><th>연락처</th><th>첫 문의</th><th>마지막 메시지</th><th>새 메시지</th><th>상태</th></tr></thead><tbody>` +
      (list.length ? list.map((c) => { const last = [...c.messages].reverse().find((m) => m.who !== "system"); const u = unreadOf(c);
        return `<tr data-chat="${esc(c.id)}"><td><b>${esc(c.id)}</b></td><td>${esc(fmtDT(c.createdAt))}</td><td>${esc(c.contact?.name || "-")}</td><td>${esc(c.contact?.phone || "-")}</td>
          <td style="white-space:normal;max-width:220px">${esc((c.topic || "-").slice(0, 40))}</td><td style="white-space:normal;max-width:260px">${last ? (last.who === "agent" ? "↳ " : "") + esc(last.text.slice(0, 40)) : "-"}</td>
          <td>${u ? `<span class="unread">${u}</span>` : "-"}</td><td>${chatBadge(c.status)}</td></tr>`; }).join("")
        : `<tr><td colspan="8" class="muted" style="text-align:center;padding:28px">상담사 채팅이 없습니다. 메인 페이지 AI 상담에서 "디스크 외 부품 문의"로 시작해 보십시오.</td></tr>`) + "</tbody>";
  } else {
    const list = getInqs().filter((r) => matches(r, q) && (!st || r.status === st)).reverse();
    $("#table").innerHTML = `<thead><tr><th>접수 시각</th><th>고객</th><th>연락처</th><th>차대번호</th><th>내용</th><th>상태</th></tr></thead><tbody>` +
      (list.length ? list.map((r) => `<tr data-inq="${r.idx}"><td>${esc(fmtDT(r.at))}</td><td>${esc(r.name)}</td><td>${esc(r.phone)}</td><td>${esc(r.vin || "-")}</td>
        <td style="white-space:normal;max-width:360px">${esc((r.message || "").slice(0, 60))}${(r.message || "").length > 60 ? "…" : ""}</td><td>${badge(r.status)}</td></tr>`).join("")
        : `<tr><td colspan="6" class="muted" style="text-align:center;padding:28px">일반 문의가 없습니다.</td></tr>`) + "</tbody>";
  }
}

function statusControls(cur) {
  return `<label style="flex-direction:row;align-items:center;gap:8px">상태 <select id="stSel">${REQ_STATUS.map((s) => `<option ${s === cur ? "selected" : ""}>${s}</option>`).join("")}</select></label>`;
}

function showReq(id) {
  const list = getReqs(); const r = list.find((x) => x.id === id); if (!r) return;
  const actions = `${statusControls(r.status)}<button class="btn btn-ghost" type="button" id="printBtn">인쇄 / PDF</button>`;
  const logHtml = (r.log || []).map((m) => `<div class="msg ${m.who === "me" ? "me" : "bot"}" style="max-width:80%">${esc(m.text)}</div>`).join("");
  $("#detail").innerHTML = requestDocHtml(r, actions) +
    `<section class="panel"><h2>담당자 메모</h2><textarea id="memo" rows="3" style="width:100%" placeholder="검토 내용, 견적, 연락 기록 등">${esc(r.memo || "")}</textarea>
      <div style="display:flex;justify-content:flex-end;margin-top:8px"><button class="btn btn-primary" type="button" id="saveBtn">저장</button></div></section>
     <section class="panel"><h2>상담 대화 기록</h2><div class="chat-log" style="max-height:420px;border-radius:12px">${logHtml || '<p class="muted">기록 없음</p>'}</div></section>`;
  const save = () => {
    const all = getReqs(); const t = all.find((x) => x.id === id);
    t.status = $("#stSel").value; t.memo = $("#memo").value; t.updatedAt = new Date().toISOString();
    store.set(REQUESTS_KEY, all); renderAll(); showReq(id);
  };
  $("#stSel").onchange = save;
  $("#saveBtn").onclick = save;
  $("#printBtn").onclick = () => printHtml(requestDocHtml(getReqs().find((x) => x.id === id)));
  $("#detail").scrollIntoView({ behavior: "smooth" });
}

// ---------------- 주문 상세 ----------------
function showOrder(id) {
  const o = getOrders().find((x) => x.id === id); if (!o) return;
  const rc = o.receipt || { type: "none" };
  const receiptTxt = rc.type === "cash" ? `현금영수증 · ${rc.no}` : rc.type === "tax" ? `세금계산서 · ${rc.no} · ${rc.email}` : "필요 없음";
  $("#detail").innerHTML = `<section class="panel"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
      <h2 style="margin:0">주문 ${esc(o.id)}</h2>${orderBadge(o.status)}</div>
    <div class="table-wrap" style="margin-top:12px"><table class="admin-table"><thead><tr><th>상품</th><th>규격</th><th>브랜드</th><th>가공</th><th>수량</th><th>금액</th></tr></thead><tbody>
      ${o.items.map((x) => `<tr><td>디스크 ${axleKo(x.axle)} · OEM ${esc(x.pn)}</td><td>${esc(x.spec)}</td><td>${esc(x.brand)}</td><td>${x.chaos ? esc(x.chaos.name) + (x.chaos.price ? "" : " (견적)") : "-"}</td><td>${x.sets}세트(${x.sets * SET_SIZE}장)</td><td>${won(x.sub)}</td></tr>`).join("")}
    </tbody></table></div>
    <table class="admin-table" style="margin-top:12px"><tbody>
      <tr><th>금액</th><td>상품 ${won(o.amounts.goods)} · 가공비 ${won(o.amounts.chaos)}${o.amounts.chaosQuote ? " + 별도 견적" : ""} · 합계 <b>${won(o.amounts.total)}</b> · 무료배송</td></tr>
      <tr><th>주문자</th><td>${esc(o.orderer.name)} · ${esc(o.orderer.phone)}${o.orderer.email ? " · " + esc(o.orderer.email) : ""}</td></tr>
      <tr><th>받는 분</th><td>${esc(o.receiver.name)} · ${esc(o.receiver.phone)}</td></tr>
      <tr><th>배송지</th><td style="white-space:normal">(${esc(o.receiver.zip)}) ${esc(o.receiver.addr1)} ${esc(o.receiver.addr2)}${o.receiver.memo ? " · 메모: " + esc(o.receiver.memo) : ""}</td></tr>
      <tr><th>차대번호</th><td>${esc(o.vin || "미입력")}</td></tr>
      <tr><th>결제 방법</th><td>${esc(o.payment.name)}</td></tr>
      <tr><th>증빙</th><td>${esc(receiptTxt)}</td></tr>
    </tbody></table>
    <div class="ord-admin">
      <label>상태 <select id="oSt">${ORDER_STATUS.map((s) => `<option ${s === o.status ? "selected" : ""}>${s}</option>`).join("")}</select></label>
      <label class="check"><input type="checkbox" id="oPaid" ${o.payment.paid ? "checked" : ""} /> 입금(결제) 확인</label>
      <label>택배사 <select id="oCourier"><option value="">선택</option>${COURIERS.map((c) => `<option ${c === o.courier ? "selected" : ""}>${c}</option>`).join("")}</select></label>
      <label>송장번호 <input id="oTrack" value="${esc(o.tracking || "")}" inputmode="numeric" /></label>
      <label class="full">담당자 메모 <input id="oMemo" value="${esc(o.memo || "")}" placeholder="적용 확인 결과, 최종 금액 안내 기록 등" /></label>
      <button class="btn btn-primary" type="button" id="oSave">저장</button>
    </div></section>`;
  $("#oSave").onclick = () => {
    const all = getOrders(); const t = all.find((x) => x.id === id);
    t.status = $("#oSt").value; t.payment.paid = $("#oPaid").checked; t.courier = $("#oCourier").value; t.tracking = $("#oTrack").value.trim(); t.memo = $("#oMemo").value; t.updatedAt = new Date().toISOString();
    store.set(ORDERS_KEY, all); renderAll(); showOrder(id);
  };
  $("#detail").scrollIntoView({ behavior: "smooth" });
}

function showInq(idx) {
  const all = store.get(INQUIRIES_KEY, []); const r = all[idx]; if (!r) return;
  $("#detail").innerHTML = `<section class="panel"><h2>일반 문의</h2>
    <table class="admin-table"><tbody>
      <tr><th>접수 시각</th><td>${esc(fmtDT(r.at))}</td></tr>
      <tr><th>고객</th><td>${esc(r.name)}</td></tr><tr><th>연락처</th><td>${esc(r.phone)}</td></tr><tr><th>차대번호</th><td>${esc(r.vin || "-")}</td></tr>
      <tr><th>내용</th><td style="white-space:pre-wrap">${esc(r.message)}</td></tr></tbody></table>
    <div style="display:flex;gap:8px;justify-content:space-between;align-items:center;margin-top:12px;flex-wrap:wrap">${statusControls(r.status || "접수")}
      <input id="memo" placeholder="담당자 메모" value="${esc(r.memo || "")}" style="flex:1;min-width:200px" /><button class="btn btn-primary" id="saveBtn" type="button">저장</button></div></section>`;
  const save = () => { const a = store.get(INQUIRIES_KEY, []); a[idx].status = $("#stSel").value; a[idx].memo = $("#memo").value; store.set(INQUIRIES_KEY, a); renderAll(); showInq(idx); };
  $("#stSel").onchange = save; $("#saveBtn").onclick = save;
  $("#detail").scrollIntoView({ behavior: "smooth" });
}

// ---------------- 상담사 채팅 상세 ----------------
let openChatId = null, openChatLen = -1;
const QUICK = ["안녕하세요, 카리브무역 상담사입니다. 확인 후 바로 안내드리겠습니다.", "차대번호(17자리)를 알려주시면 정확한 품번을 확인해 드릴게요.", "재고 확인 후 가격과 출고 일정을 안내드리겠습니다.", "남겨주신 연락처로 전화드리겠습니다."];
function renderChatLog(c) {
  const box = $("#agentLog"); if (!box) return;
  box.innerHTML = c.messages.map((m) => `<div class="msg ${m.who === "agent" ? "agent" : m.who === "system" ? "system" : "customer"}">${esc(m.text)}<div class="small" style="opacity:.6;margin-top:2px">${esc(fmtDT(m.at).slice(5))}</div></div>`).join("");
  box.scrollTop = box.scrollHeight;
  openChatLen = c.messages.length;
}
function showChat(id) {
  const c = agentChats().find((x) => x.id === id); if (!c) return;
  openChatId = id;
  $("#detail").innerHTML = `<section class="panel"><div style="display:flex;justify-content:space-between;gap:12px;flex-wrap:wrap;align-items:center">
      <h2 style="margin:0">상담사 채팅 ${esc(c.id)}</h2>
      <label style="flex-direction:row;align-items:center;gap:8px">상태 <select id="chatSt">${CHAT_STATUS.map((s) => `<option ${s === c.status ? "selected" : ""}>${s}</option>`).join("")}</select></label></div>
    <p class="muted small">고객: ${esc(c.contact?.name || "-")} · ${esc(c.contact?.phone || "연락처 미등록")}${c.contact?.items ? " · 필요 품목: " + esc(c.contact.items) : ""}${c.vin ? " · 차대번호 " + esc(c.vin) : ""} · 시작 ${esc(fmtDT(c.createdAt))}</p>
    <div class="chat-log admin-chat-log" id="agentLog"></div>
    <div class="chips">${QUICK.map((t, i) => `<button type="button" data-quick="${i}">${esc(t.slice(0, 18))}…</button>`).join("")}</div>
    <form class="reply-form" id="replyForm"><textarea id="replyText" rows="2" placeholder="고객에게 보낼 답변 (Enter 전송, Shift+Enter 줄바꿈)"></textarea><button class="btn btn-primary" type="submit">보내기</button></form></section>`;
  renderChatLog(c);
  const send = () => {
    const text = $("#replyText").value.trim(); if (!text) return;
    const u = updateAgentChat(id, (c) => { c.messages.push({ who: "agent", text, at: new Date().toISOString() }); if (c.status === "대기") c.status = "상담 중"; });
    $("#replyText").value = ""; if (u) { renderChatLog(u); $("#chatSt").value = u.status; } renderStats(); renderTable();
  };
  $("#replyForm").onsubmit = (e) => { e.preventDefault(); send(); };
  $("#replyText").onkeydown = (e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); send(); } };
  $("#chatSt").onchange = () => {
    const s = $("#chatSt").value;
    const u = updateAgentChat(id, (c) => { c.status = s; if (s === "종료") c.messages.push({ who: "system", text: "상담사가 상담을 종료했습니다.", at: new Date().toISOString() }); });
    if (u) renderChatLog(u); renderStats(); renderTable();
  };
  document.querySelectorAll("[data-quick]").forEach((b) => b.onclick = () => { $("#replyText").value = QUICK[+b.dataset.quick]; $("#replyText").focus(); });
  $("#detail").scrollIntoView({ behavior: "smooth" });
}
// 새 고객 메시지 자동 반영 (입력 중인 답변은 유지)
function refreshChats() {
  renderStats();
  if (tab === "chat" && !$("#q").value) renderTable();
  if (openChatId && $("#agentLog")) { const c = agentChats().find((x) => x.id === openChatId); if (c && c.messages.length !== openChatLen) renderChatLog(c); }
}
setInterval(refreshChats, 1500);
window.addEventListener("storage", (e) => { if (e.key === AGENT_KEY) refreshChats(); });

function renderAll() { renderStats(); renderTable(); }

document.querySelectorAll("[data-tab]").forEach((b) => b.addEventListener("click", () => {
  tab = b.dataset.tab;
  document.querySelectorAll("[data-tab]").forEach((x) => x.classList.toggle("on", x === b));
  const sf = $("#statusFilter"); sf.innerHTML = '<option value="">전체 상태</option>';
  (tab === "chat" ? CHAT_STATUS : tab === "ord" ? ORDER_STATUS : tab === "ai" ? AI_Q_STATUS : REQ_STATUS).forEach((s) => sf.add(new Option(s, s)));
  sf.hidden = tab === "mem";
  $("#q").placeholder = tab === "mem" ? "이름·업체명·이메일·휴대폰 검색" : tab === "ai" ? "질문 내용 검색" : "의뢰번호·고객·연락처·차대번호 검색";
  $("#detail").innerHTML = ""; openChatId = null; renderTable();
}));
$("#q").addEventListener("input", renderTable);
$("#statusFilter").addEventListener("change", renderTable);
$("#table").addEventListener("click", (e) => {
  const tr = e.target.closest("tr[data-id], tr[data-inq], tr[data-chat], tr[data-ord], tr[data-ai]"); if (!tr) return;
  if (tr.dataset.ai) showAi(tr.dataset.ai);
  else if (tr.dataset.ord) showOrder(tr.dataset.ord);
  else if (tr.dataset.chat) showChat(tr.dataset.chat); else if (tr.dataset.id) showReq(tr.dataset.id); else showInq(+tr.dataset.inq);
});

renderAll();
const qid = SiteNav.params().get("id");
if (qid) showReq(qid);
