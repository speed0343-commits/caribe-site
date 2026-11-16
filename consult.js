// ============================================================
// AI 가공 상담 → 요구사항 정리 → 가공 의뢰서 생성 → 저장
// 단계 진행·차량 확인·가공비 계산은 등록 데이터로 처리하고, 중간에 나온 질문은
// 서버 /api/chat(mode: "consult")을 거쳐 Google Gemini가 답합니다. 실패하면 기존 안내 문구로 답합니다.
// 의뢰 방식(새 디스크 구매+가공 / 보유 디스크 가공)과 가공비는 추후 확정 → 의뢰서에 "추후 확정" 표기
// ============================================================

const STEPS = [
  { key: "vehicle", label: "차량" },
  { key: "disc", label: "디스크" },
  { key: "qty", label: "수량" },
  { key: "ctype", label: "가공 타입" },
  { key: "usage", label: "사용 환경" },
  { key: "symptoms", label: "증상" },
  { key: "request", label: "요청 사항" },
  { key: "schedule", label: "일정" },
  { key: "contact", label: "연락처" },
];
const USAGE = ["일상 출퇴근", "고속·장거리", "고성능·스포츠 주행", "업무용(택시·렌트·법인)", "기타"];
const SYMPTOMS = ["제동 시 떨림", "제동 소음", "편마모·단차", "크랙·변색", "증상 없음(교체·업그레이드)"];
const SCHEDULE = ["1주 이내", "2주 이내", "한 달 이내", "상관없음"];

let S; // 상담 상태
function reset() {
  S = {
    step: "vehicle", sub: null, rows: [], picked: [],
    vehicle: { vin: "", make: "", model: "", how: "" },
    disc: { pn: "", brand: "", axle: "", spec: "", qty: "" },
    needs: { ctype: "", ctypeCode: "", usage: "", symptoms: "", request: "", schedule: "" },
    contact: { name: "", phone: "", email: "" },
    log: [],
  };
  aiHistory.length = 0;
  setBusy(false);
  $("#log").innerHTML = "";
  $("#docArea").innerHTML = "";
  renderSummary();
  say("안녕하세요, 카리브무역 카오스 가공 상담입니다.\n먼저 차량을 확인할게요. <b>차대번호 17자리</b>를 입력해 주십시오.\n모르시면 차종(예: 벤츠 W213, BMW 5시리즈)이나 디스크 OEM 품번으로도 됩니다." +
    chips([["차대번호를 몰라요", "#novin"], ["예시 차대번호로 해보기", "WDD2130421A123456"]].concat(window.ResearchQA ? [["카오스 가공 관련", "#rqlist"]] : [])));
}

// ---------------- 연구자료 질문 (research-qa.js · 등록 데이터만 근거) ----------------
function sayResearch(id, text) {
  const a = window.ResearchQA && ResearchQA.answer(id, text);
  if (!a) return false;
  // 이 페이지가 가공 상담이므로 "가공 상담 시작"은 "이어서 상담하기"로 바꿈
  const acts = a.actions.map(([l, v]) => (v === "#consult" ? ["이어서 상담하기", "#rqcont"] : [l, v]));
  say(a.html + chips(acts) + (S.step !== "done" ? '<p class="muted small" style="margin:6px 0 0">상담은 멈춘 단계에서 이어집니다.</p>' : ""));
  return true;
}

// ---------------- 화면 ----------------
const logEl = () => $("#log");
function say(html, who = "bot") {
  const d = document.createElement("div");
  d.className = "msg " + who;
  if (who === "me") d.textContent = html; else d.innerHTML = html;
  scrollToMsg(d, who);
  S.log.push({ who, text: who === "me" ? html : d.innerText.trim(), at: new Date().toISOString() });
  return d;
}
// 긴 답변은 답변의 처음이 보이게, 짧은 답변은 맨 아래로
function scrollToMsg(d, who) {
  const log = logEl();
  if (d.parentNode !== log) log.appendChild(d);
  if (who !== "me" && d.offsetHeight > log.clientHeight * 0.8) log.scrollTop += d.getBoundingClientRect().top - log.getBoundingClientRect().top - 8;
  else log.scrollTop = log.scrollHeight;
}
const chips = (items) => `<div class="chips">${items.map(([label, val]) => `<button type="button" data-v="${esc(val)}">${esc(label)}</button>`).join("")}</div>`;

function renderSummary() {
  const v = (x) => (x ? esc(x) : '<span class="empty-v">—</span>');
  const items = [
    ["차대번호", S.vehicle.vin], ["차량", [makeKo(S.vehicle.make || ""), S.vehicle.model].filter(Boolean).join(" ")],
    ["OEM 품번", S.disc.pn], ["브랜드", S.disc.brand], ["디스크 위치", S.disc.axle], ["규격", S.disc.spec], ["수량", S.disc.qty],
    ["가공 타입", S.needs.ctype], ["사용 환경", S.needs.usage], ["증상", S.needs.symptoms], ["요청 사항", S.needs.request], ["희망 일정", S.needs.schedule],
    ["연락처", [S.contact.name, S.contact.phone].filter(Boolean).join(" / ")], ["필요 품목", S.contact.items],
  ];
  $("#summary").innerHTML = items.map(([k, x]) => `<dt>${k}</dt><dd class="${x ? "" : "empty-v"}">${v(x)}</dd>`).join("");
  const idx = STEPS.findIndex((s) => s.key === S.step);
  $("#progress").innerHTML = STEPS.map((s, i) => `<i class="${i < idx || S.step === "done" ? "done" : i === idx ? "now" : ""}" title="${s.label}"></i>`).join("") +
    `<span class="step-label">${S.step === "done" ? "의뢰서 완료" : `${idx + 1}/${STEPS.length} · ${STEPS[idx].label}`}</span>`;
}

// ---------------- 단계 진행 ----------------
function go(step) {
  S.step = step; S.sub = null;
  renderSummary();
  if (step === "disc") return askDisc();
  if (step === "qty") return say("몇 세트가 필요하신가요? 디스크는 <b>2장 1세트</b>(한 축 좌·우)로 판매합니다." + chips([["1세트 · 2장 (한 축)", "#qty:1세트 · 2장 (한 축)"], ["2세트 · 4장 (앞·뒤)", "#qty:2세트 · 4장 (앞·뒤)"]]) + '<p class="muted small" style="margin:6px 0 0">그 외 수량은 세트 수(숫자)로 입력해 주십시오.</p>');
  if (step === "ctype") return say("원하시는 <b>카오스 가공 타입</b>을 골라 주십시오." + `<div class="type-chips">${CHAOS_TYPES.map((t) => `<button type="button" data-v="#ctype:${t.code}"><img src="assets/${t.key === "diag" ? "chaos-diag.jpg" : t.key === "A" ? "chaos-type-a.jpg" : "chaos-type-b.jpg"}" alt="" />${esc(t.name)}</button>`).join("")}</div>` + chips([["상담 후 결정", "#ctype:"]]) + `<p class="muted small" style="margin:6px 0 0">타입별 모양은 <a href="technology.html#chaos-types" target="_blank">카오스 가공 페이지</a>에서 크게 볼 수 있어요.</p>`);
  if (step === "usage") return say("차량은 주로 어떻게 사용하시나요?" + chips(USAGE.map((u) => [u, "#usage:" + u])));
  if (step === "symptoms") { S.picked = []; S.needs.symptoms = ""; renderSummary(); return say("현재 브레이크에 느껴지는 증상을 모두 골라 주십시오. 다 고르셨으면 <b>선택 완료</b>를 눌러 주십시오." + chips(SYMPTOMS.map((x) => [x, "#sym:" + x]).concat([["선택 완료", "#symdone"]]))); }
  if (step === "request") return say("가공과 관련해 요청하실 내용이 있으면 자유롭게 적어 주십시오.\n(예: 원하는 마감, 납품처, 함께 필요한 부품)" + chips([["특별히 없음", "#req:없음"], ["상담 후 결정", "#req:담당자 상담 후 결정"]]));
  if (step === "schedule") return say("희망하시는 일정이 있나요?" + chips(SCHEDULE.map((x) => [x, "#sch:" + x])));
  if (step === "contact") return askContact();
}

function askDisc() {
  if (S.rows.length) {
    const items = groupByProduct(S.rows);
    S.sub = "pick";
    let html = `등록 데이터에서 이 차량에 맞는 디스크 <b>${items.length}종</b>을 찾았어요. 가공할 디스크를 골라 주십시오.\n같은 차종도 브레이크 사양에 따라 외경이 다르니, 기존 디스크 외경과 비교해 주십시오.`;
    html += chips(items.slice(0, 10).map(({ p }) => [`${axleKo(p.axle)} Ø${p.dia || "?"}×${p.thk || "?"} · ${p.pn}`, "#pn:" + p.pn]).concat([["어떤 건지 모르겠어요", "#pn:"]]));
    return say(html);
  }
  S.sub = "free";
  say("디스크 OEM 품번을 알고 계시면 입력해 주십시오. 디스크 외경(mm)만 아셔도 됩니다." + chips([["모르겠어요 (담당자 확인)", "#pn:"]]));
}

function setDisc(p) {
  S.disc.pn = p.pn; S.disc.axle = axleKo(p.axle);
  S.disc.spec = `외경 ${p.dia || "?"}mm × 두께 ${p.thk || "?"}mm${p.min ? ` (최소 ${p.min}mm)` : ""}`;
}

function askContact() {
  say("마지막으로 연락처를 남겨 주시면 가공 의뢰서를 만들어 드릴게요.");
  const d = document.createElement("div");
  d.className = "msg bot";
  d.innerHTML = `<form class="contact-form" id="contactForm">
      <div class="row"><input name="name" required placeholder="성함 / 업체명" /><input name="phone" required placeholder="연락처 010-0000-0000" /></div>
      <input name="email" type="email" placeholder="이메일 (선택)" />
      <textarea name="items" rows="2" maxlength="500" placeholder="함께 필요한 품목 (선택 · 예: 브레이크 패드 1세트, 센서)"></textarea>
      <label class="check"><input type="checkbox" required /> 상담·의뢰 처리를 위한 개인정보(성함, 연락처, 이메일, 차대번호) 수집에 동의합니다.</label>
      <button class="btn btn-primary" type="submit">의뢰서 만들기</button>
    </form>`;
  // 로그인 회원이면 연락처 자동 입력, 비회원이면 로그인 안내
  const me = window.CaribAuth && CaribAuth.current();
  const cf = d.querySelector("form");
  if (me) {
    cf.name.value = me.company ? `${me.name} / ${me.company}` : me.name;
    cf.phone.value = me.phone; cf.email.value = me.email;
    cf.insertAdjacentHTML("afterbegin", `<p class="member-note">회원 정보로 자동 입력했습니다. 의뢰 진행 상황은 <a href="mypage.html">마이페이지</a>에서 볼 수 있습니다.</p>`);
  } else {
    cf.insertAdjacentHTML("afterbegin", `<p class="member-note"><a href="login.html?next=consult.html">로그인</a>하면 연락처가 자동 입력되고 진행 상황을 마이페이지에서 볼 수 있습니다. (비회원도 의뢰 가능)</p>`);
  }
  scrollToMsg(d, "bot");
  d.querySelector("form").addEventListener("submit", (e) => {
    e.preventDefault();
    const f = e.target;
    S.contact = { name: f.name.value.trim(), phone: f.phone.value.trim(), email: f.email.value.trim(), items: f.items.value.trim() };
    f.querySelectorAll("input,textarea,button").forEach((x) => (x.disabled = true));
    finish();
  });
}

// ---------------- 질문 응답 (어느 단계에서든) ----------------
// 등록 데이터로 정확히 답할 수 있는 질문(선택한 디스크의 가공비, 차대번호 위치)은 바로 답하고,
// 나머지는 Gemini에 묻습니다. localAnswer의 html은 Gemini가 실패했을 때의 대체 답변입니다.
function localAnswer(text) {
  const t = text.toLowerCase();
  if (/(가격|비용|얼마|가공비)/.test(t)) {
    const p = S.disc.pn && findPn(S.disc.pn);
    const co = p && S.needs.ctypeCode ? chaosOption(p, S.needs.ctypeCode) : null;
    if (co && co.price) return { exact: true, html: `선택하신 디스크(Ø${esc(p.dia)}mm)의 ${esc(co.name)} 가공비는 2장 1세트 <b>${won(co.price * SET_SIZE)}</b>(${esc(PRICE_NOTE)})입니다. 최종 금액은 담당자 검토 후 확정됩니다.` };
    return { html: "가공비는 사선 타입 66,000원부터, A 타입 88,000원부터, B 타입 110,000원부터(2장 1세트, VAT 포함)이며 디스크 외경에 따라 달라집니다. 디스크와 가공 타입을 고르시면 금액을 바로 알려 드릴게요." };
  }
  if (/(차대번호|vin).*(어디|위치|확인)/.test(t)) return { exact: true, html: "차대번호는 자동차등록증의 '차대번호' 칸이나 앞유리 왼쪽 하단에서 확인할 수 있습니다." };
  if (/(카오스|효과|성능|좋아|차이)/.test(t)) return { html: "카오스 가공은 현재 <b>주문을 받고 있습니다</b>. 타입별 차이는 홈의 모양과 배치(외관)입니다.\n의뢰서를 남겨 주시면 담당자가 진행 가능 여부를 안내드립니다." + chips([["디자인 보기", "#lab"]]) };
  if (/(기간|며칠|언제|오래)/.test(t)) return { html: "작업 기간은 디스크 수급과 가공 일정에 따라 달라, 의뢰서 확인 후 담당자가 안내드립니다." };
  if (/(보증|as|a\/s|환불|반품|교환)/.test(t)) return { html: "교환·반품은 먼저 담당자에게 연락 주시면 상품 상태와 장착·가공 여부를 확인해 방법을 안내드립니다." };
  return null;
}

const QUESTION = /[?？]|(뭐|무엇|무슨|얼마|어떻게|어떤|언제|왜|가능|되나요|인가요|있나요|없나요|할까요|일까요|나요$|까요$|궁금|알려|설명)/;
// 질문처럼 보여도 차량·품번·외경이 들어 있으면 단계 답변으로 처리 (예: "W213도 되나요?")
function hasStepData(v) {
  if (findPn(v)) return true;
  if (S.step === "disc") return /\d{3}\s*mm/i.test(v);
  if (S.step !== "vehicle") return false;
  const up = v.toUpperCase();
  if (/\b[A-HJ-NPR-Z0-9]{11,17}\b/.test(up.replace(/[\s-]/g, "")) && /\d/.test(up)) return true;
  if ((up.match(/\b[A-Z]{1,2}\d{2,3}[A-Z]?\b/g) || []).some((c) => CHASSIS.has(c))) return true;
  const t = v.toLowerCase();
  return MODEL_ALIASES.some(([words]) => words.some((w) => t.includes(w))) || Object.values(MAKE_WORDS).some((ws) => ws.some((w) => t.includes(w)));
}

// 진행 상황 요약 (차대번호·연락처는 보내지 않음)
function consultContext() {
  const idx = STEPS.findIndex((x) => x.key === S.step);
  const car = [makeKo(S.vehicle.make || ""), S.vehicle.model].filter(Boolean).join(" ");
  return [
    idx >= 0 && `현재 단계 ${idx + 1}/${STEPS.length} ${STEPS[idx].label}`,
    car && `차량 ${car}`,
    S.disc.pn && `디스크 OEM ${S.disc.pn}`, S.disc.spec && S.disc.spec, S.disc.qty && `수량 ${S.disc.qty}`,
    S.needs.ctype && `가공 타입 ${S.needs.ctype}`, S.needs.usage && `사용 환경 ${S.needs.usage}`, S.needs.symptoms && `증상 ${S.needs.symptoms}`,
  ].filter(Boolean).join(" / ");
}

const aiHistory = [];
let busy = false;
function setBusy(on) {
  busy = on;
  $("#text").disabled = !!(S && S.step === "done"); // 기다리는 동안에도 다음 질문은 미리 적을 수 있게
  $("#form button").disabled = on;
  $("#form").classList.toggle("busy", on);
}
const aiFormat = (s) => esc(s).replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/^\s*[*-]\s+/gm, "· ");
const CONTINUE = chips([["이어서 상담하기", "#rqcont"]]);

async function askGemini(text, fallbackHtml) {
  const wait = document.createElement("div");
  wait.className = "msg bot ai-wait";
  wait.setAttribute("role", "status");
  wait.innerHTML = '<span class="dots" aria-hidden="true"><i></i><i></i><i></i></span>답변을 준비하고 있어요';
  scrollToMsg(wait, "bot");
  setBusy(true);
  let r, data = {};
  try {
    r = await fetch("/api/chat", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ mode: "consult", message: text, history: aiHistory.slice(-6), context: consultContext() }),
    });
    data = await r.json().catch(() => ({}));
  } catch (e) { r = null; }
  wait.remove();
  setBusy(false);
  $("#text").focus();
  if (r && r.ok && data.reply) {
    aiHistory.push({ role: "user", text }, { role: "model", text: data.reply });
    return say(aiFormat(data.reply) + '<span class="ai-note">AI 답변이에요. 가공 가능 여부와 비용은 담당자가 최종 확인합니다.</span>' + CONTINUE);
  }
  if (fallbackHtml) return say(fallbackHtml + CONTINUE);
  if (r && r.status === 429) return say("지금 AI 상담 요청이 많아 잠시 답변하기 어려워요. 잠시 후 다시 물어보시거나 전화(010-5459-3111)로 문의해 주십시오." + CONTINUE);
  say("그 질문은 의뢰서를 남겨 주시면 담당자가 함께 확인해 안내드릴게요. 급하시면 전화(010-5459-3111)로 문의해 주십시오." + CONTINUE);
}

// ---------------- 입력 처리 ----------------
function handle(raw) {
  const v = raw.trim();
  if (!v) return;

  // 연구자료 질문 버튼 (현재 단계는 그대로 유지)
  if (v === "#rqlist") return say("궁금한 질문을 골라 주십시오. 등록된 논문·시험 자료만 근거로 답변드립니다." + chips(ResearchQA.QUESTIONS.map((q) => [q.q, "#rq:" + q.id])));
  if (v.startsWith("#rq:")) return sayResearch(v.slice(4));
  // 디자인(가공 타입) 보기: 상담을 그대로 둔 채 화면 위에 사진을 띄움 (페이지 이동 없음)
  if (v === "#lab" || v === "#tech") { showDesignViewer(); return; }
  if (v === "#inquiry") { $("#toInquiry").click(); return; }
  if (v === "#rqcont") {
    if (S.step === "vehicle") return say("이어서 차량을 확인할게요. <b>차대번호 17자리</b>나 차종(예: 벤츠 W213, BMW 5시리즈)을 입력해 주십시오." + chips([["차대번호를 몰라요", "#novin"]]));
    if (S.step === "done") return say("의뢰서가 이미 만들어졌어요. 새 상담은 <b>처음부터</b>를 눌러 주십시오.");
    return go(S.step);
  }

  // 앞 단계 메시지에 남아 있는 버튼을 누른 경우: 엉뚱한 칸에 기록하지 않고 지금 단계 질문을 다시 보여 줌
  const STEP_BUTTONS = { vehicle: ["#novin", "#code:", "#group:"], disc: ["#pn:"], qty: ["#qty:"], ctype: ["#ctype:"], usage: ["#usage:"], symptoms: ["#sym:", "#symdone"], request: ["#req:"], schedule: ["#sch:"], contact: [], done: [] };
  if (v.startsWith("#") && !(STEP_BUTTONS[S.step] || []).some((x) => v.startsWith(x))) {
    if (S.step === "done") return;
    say("앞 단계의 버튼이에요. 지금 단계부터 이어서 답해 주십시오.");
    return handle("#rqcont");
  }

  // 버튼 값(#)이 아닌 질문형 입력은 먼저 질문 응답 시도 → 현재 단계 유지
  const rq = !v.startsWith("#") && window.ResearchQA && ResearchQA.match(v);
  if (rq && S.step !== "request" && S.step !== "contact") return sayResearch(rq, v);
  if (!v.startsWith("#") && QUESTION.test(v) && S.step !== "request" && S.step !== "done" && !hasStepData(v)) {
    const a = localAnswer(v);
    if (a && a.exact) return say(a.html + CONTINUE);
    return askGemini(v, a && a.html);
  }

  if (S.step === "vehicle") return handleVehicle(v);
  if (S.step === "disc") return handleDisc(v);
  if (S.step === "qty") {
    let q;
    if (v.startsWith("#qty:")) q = v.slice(5);
    else {
      // 숫자 입력 = 세트 수. "3장"처럼 장 수로 적으면 2장 단위로 올림해서 세트로 환산
      const m = v.match(/(\d+)\s*(장|세트)?/);
      if (!m || +m[1] < 1) return say("수량을 세트 수(숫자)로 입력해 주십시오. 1세트 = 2장입니다.");
      let sets = +m[1];
      if (m[2] === "장") { sets = Math.ceil(+m[1] / 2); if (+m[1] % 2) say(`디스크는 2장 세트 단위로 판매해 ${sets}세트(${sets * 2}장)로 기록할게요.`); }
      q = `${sets}세트 · ${sets * 2}장`;
    }
    S.disc.qty = q; return go("ctype");
  }
  if (S.step === "ctype") {
    let code = v.startsWith("#ctype:") ? v.slice(7) : "";
    if (!v.startsWith("#")) { const t = v.replace(/\s/g, "").toUpperCase(); code = /사선/.test(t) ? "CHAOS-D" : /^A|A타입/.test(t) ? "CHAOS-A" : /^B|B타입/.test(t) ? "CHAOS-B" : ""; }
    const ty = chaosType(code);
    S.needs.ctypeCode = ty ? ty.code : ""; S.needs.ctype = ty ? ty.name : "상담 후 결정";
    return go("usage");
  }
  if (S.step === "usage") { S.needs.usage = v.startsWith("#usage:") ? v.slice(7) : v; return go("symptoms"); }
  if (S.step === "symptoms") {
    if (v.startsWith("#sym:")) {
      const x = v.slice(5);
      S.picked = S.picked.includes(x) ? S.picked.filter((y) => y !== x) : S.picked.concat(x);
      S.needs.symptoms = S.picked.join(", "); renderSummary(); return;
    }
    if (v !== "#symdone") S.picked.push(v);
    S.needs.symptoms = S.picked.join(", ") || "입력 없음";
    return go("request");
  }
  if (S.step === "request") { S.needs.request = v.startsWith("#req:") ? v.slice(5) : v; return go("schedule"); }
  if (S.step === "schedule") { S.needs.schedule = v.startsWith("#sch:") ? v.slice(5) : v; return go("contact"); }
  if (S.step === "contact") return say("아래 입력란에 연락처를 적고 <b>의뢰서 만들기</b>를 눌러 주십시오.");
  if (S.step === "done") return say("의뢰서가 이미 만들어졌어요. 새 상담은 <b>처음부터</b>를 눌러 주십시오.");
}

function vehicleFound(rows, make, model, how) {
  S.rows = rows; S.vehicle.make = make || S.vehicle.make; S.vehicle.model = model; S.vehicle.how = how;
  say(`<b>${esc(makeKo(S.vehicle.make))} ${esc(model)}</b>(으)로 확인했어요.`);
  go("disc");
}

function handleVehicle(v) {
  if (v === "#novin") { S.sub = "model"; return say("괜찮아요. 차종을 알려주십시오. 예: <b>벤츠 W213</b>, <b>BMW 5시리즈</b>, <b>아우디 A6</b>"); }
  if (v === "#code:") { S.vehicle.model = S.vehicle.model || "확인 필요"; S.vehicle.how = S.vehicle.how || "담당자 확인"; say("담당자가 차량을 확인하도록 기록할게요."); return go("disc"); }
  if (v.startsWith("#code:")) {
    const code = v.slice(6); const rows = CHASSIS.get(code) || [];
    const body = rows[0] ? rows[0].body.replace(/\s*\([^)]*\)\s*$/, "") : "";
    return vehicleFound(rows, rows[0]?.make, `${body} (${code})`, S.vehicle.vin ? "차대번호 + 세대 선택" : "세대 선택");
  }
  if (v.startsWith("#group:")) {
    const [make, group] = v.slice(7).split("|");
    S.vehicle.make = make;
    return say(`${esc(makeKo(make))} ${esc(group)} 세대(섀시코드)를 골라 주십시오.` + chassisChips(rowsFor({ make, group })));
  }

  // 품번을 바로 입력한 경우
  const p = findPn(v);
  if (p) {
    setDisc(p);
    S.rows = p.rows;
    S.vehicle.how = "OEM 품번으로 확인";
    say(`OEM <b>${esc(p.pn)}</b> — ${esc(S.disc.axle)} 디스크(${esc(S.disc.spec)})로 확인했어요. 차대번호를 알고 계시면 나중에 담당자가 적용 여부를 다시 확인합니다.`);
    return go("qty");
  }

  // 차대번호
  const tok = v.toUpperCase().replace(/[\s-]/g, "");
  if (/^[A-Z0-9]{11,17}$/.test(tok) && /\d/.test(tok) && tok.length >= 11) {
    const r = decodeVin(tok);
    if (!r.ok) return say(esc(r.error) + chips([["차대번호를 몰라요", "#novin"]]));
    S.vehicle.vin = r.vin; S.vehicle.make = r.make || "";
    if (!r.make) { S.vehicle.how = "차대번호(제조사 미식별)"; say("차대번호 형식은 맞지만 제조사를 자동으로 식별하지 못했어요. 담당자가 확인하도록 기록해 둘게요."); return go("disc"); }
    const m = matchVin(r);
    if (m.level === "exact") {
      const b = m.rows[0];
      return vehicleFound(m.rows, r.make, `${b.body} ${b.engine}`.trim(), `차대번호 모델코드 ${m.key} 일치`);
    }
    if (m.level === "platform") return vehicleFound(m.rows, r.make, `플랫폼 ${m.key} (추정)`, `차대번호 플랫폼 코드 ${m.key}`);
    const list = ROWS.filter((x) => x.make === r.make);
    if (!list.length) { S.vehicle.how = "차대번호(등록 디스크 없음)"; say(`${esc(makeKo(r.make))} 차량으로 확인됩니다. 이 제조사용 디스크는 아직 등록 전이라 담당자가 확인하도록 기록할게요.`); return go("disc"); }
    return say(`<b>${esc(makeKo(r.make))}</b> 차량으로 확인됩니다. 차대번호만으로는 세대를 확정하기 어려워요. 해당하는 섀시코드를 골라 주십시오.` + chassisChips(list));
  }

  // 차종 텍스트
  const t = v.toLowerCase();
  const codeHit = (v.toUpperCase().match(/\b[A-Z]{1,2}\d{2,3}[A-Z]?\b/g) || []).find((c) => CHASSIS.has(c));
  if (codeHit) return handleVehicle("#code:" + codeHit);
  const alias = MODEL_ALIASES.find(([words]) => words.some((w) => t.includes(w)));
  if (alias) { const [, make, group] = alias; return handleVehicle(`#group:${make}|${group}`); }
  const make = Object.keys(MAKE_WORDS).find((m) => MAKE_WORDS[m].some((w) => t.includes(w)));
  if (make) {
    S.vehicle.make = make;
    const groups = [...new Set(rowsFor({ make }).map((r) => r.group))];
    if (groups.length) return say(`${esc(makeKo(make))} 모델을 골라 주십시오.` + chips(groups.slice(0, 16).map((g) => [g, `#group:${make}|${g}`])));
  }
  S.vehicle.model = v;
  say("등록 데이터에서 차량을 찾지 못했어요. 차대번호 17자리나 차종(예: 벤츠 W213, BMW G30)으로 다시 알려주시거나, 입력하신 내용 그대로 진행할 수 있어요." + chips([["이대로 진행 (담당자 확인)", "#code:"]]));
}

function chassisChips(rows) {
  const codes = new Map();
  rows.forEach((r) => r.chassis.forEach((c) => { if (!codes.has(c)) codes.set(c, r.body.replace(/\s*\([^)]*\)\s*$/, "")); }));
  return chips([...codes.entries()].slice(0, 16).map(([c, b]) => [`${c} ${b}`, "#code:" + c]));
}

function handleDisc(v) {
  if (v.startsWith("#pn:")) {
    const pn = v.slice(4);
    if (!pn) { S.disc.pn = "확인 필요"; say("담당자가 차대번호로 디스크를 확인하도록 기록할게요."); return go("qty"); }
    const p = findPn(pn); if (p) setDisc(p);
    return go("qty");
  }
  const p = findPn(v);
  if (p) { setDisc(p); say(`OEM <b>${esc(p.pn)}</b>(${esc(S.disc.spec)})로 기록했어요.`); return go("qty"); }
  const mm = v.match(/(\d{3})\s*(mm)?/);
  if (mm) { S.disc.spec = `외경 ${mm[1]}mm (고객 입력)`; S.disc.pn = "확인 필요"; say(`외경 ${esc(mm[1])}mm로 기록했어요.`); return go("qty"); }
  S.disc.pn = v; say("입력하신 내용을 품번 메모로 기록했어요. 담당자가 확인합니다."); return go("qty");
}

// ---------------- 의뢰서 생성·저장 ----------------
function finish() {
  const p = S.disc.pn && findPn(S.disc.pn);
  const co = p && S.needs.ctypeCode ? chaosOption(p, S.needs.ctypeCode) : null;
  const fee = co && co.price ? `${co.name} 2장 1세트 ${won(co.price * SET_SIZE)} (${PRICE_NOTE}) · 최종 금액은 검토 후 확정` : "";
  const req = {
    id: newRequestId(), date: today(), createdAt: new Date().toISOString(), status: "접수", memo: "",
    memberId: (window.CaribAuth && CaribAuth.current() || {}).id || "",
    contact: S.contact,
    vehicle: { vin: S.vehicle.vin, make: makeKo(S.vehicle.make || ""), model: S.vehicle.model, how: S.vehicle.how },
    disc: { ...S.disc },
    needs: { ...S.needs, mode: "", fee },
    log: S.log,
  };
  if (window.Remote) Remote.keyed(req);
  const list = store.get(REQUESTS_KEY, []);
  list.unshift(req);
  store.set(REQUESTS_KEY, list);
  if (window.Remote) Remote.send("request", req); // 서버 저장 + 담당자 알림
  S.step = "done"; renderSummary();
  $("#text").disabled = true;
  say(`의뢰서 <b>${esc(req.id)}</b>가 만들어졌어요. 아래에서 확인하고 인쇄하거나 PDF로 저장하실 수 있습니다.\n담당자가 검토 후 연락드릴게요.`);
  const actions = `<button class="btn btn-ghost" type="button" id="newConsult">새 상담</button><button class="btn btn-primary" type="button" id="printDoc">인쇄 / PDF 저장</button>`;
  $("#docArea").innerHTML = requestDocHtml(req, actions);
  $("#printDoc").onclick = () => printHtml(requestDocHtml(req));
  $("#newConsult").onclick = () => { reset(); window.scrollTo({ top: 0, behavior: "smooth" }); };
  $("#docArea").scrollIntoView({ behavior: "smooth" });
}

// ---------------- 이벤트 ----------------
$("#form").addEventListener("submit", (e) => {
  e.preventDefault();
  const v = $("#text").value.trim();
  if (!v || busy) return;
  say(v, "me");
  $("#text").value = "";
  setTimeout(() => handle(v), 150);
});
$("#log").addEventListener("click", (e) => {
  const b = e.target.closest("[data-v]");
  if (!b || S.step === "done" || busy) return;
  const v = b.dataset.v;
  if (v.startsWith("#sym:")) { b.classList.toggle("on"); return handle(v); }
  say(b.textContent, "me");
  setTimeout(() => handle(v), 120);
});
$("#restart").onclick = reset;
$("#toInquiry").onclick = () => {
  const lines = [S.vehicle.vin && `차대번호 ${S.vehicle.vin}`, S.vehicle.model && `차량 ${S.vehicle.model}`, S.disc.pn && `품번 ${S.disc.pn}`].filter(Boolean).join(", ");
  SiteNav.go("index.html#inquiry");
  sessionStorage.setItem("prefillInquiry", `[가공 문의] ${lines}`);
};

reset();

// (예전) 기술연구 페이지 등에서 "가공 상담 AI에서 이어서 묻기"로 넘어온 경우 (?ask=질문id)
(function askFromLab() {
  const id = SiteNav.params().get("ask");
  const q = id && window.ResearchQA && ResearchQA.QUESTIONS.find((x) => x.id === id);
  if (!q) return;
  say(q.q, "me");
  sayResearch(q.id);
  SiteNav.setUrl(SiteNav.page());
})();

// 부품 검색 장바구니에서 "가공 의뢰서 작성"으로 넘어온 경우: 디스크·수량을 채우고 사용 환경 질문부터 시작
(function prefillFromCart() {
  const qs = SiteNav.params();
  const p = qs.get("pn") && findPn(qs.get("pn"));
  if (!p) return;
  const sets = Math.max(1, parseInt(qs.get("sets"), 10) || 1);
  const vin = sessionStorage.getItem("lastVin") || "";
  if (vin) {
    const r = decodeVin(vin);
    if (r.ok) {
      S.vehicle.vin = r.vin; S.vehicle.make = r.make || "";
      const m = matchVin(r); // 벤츠처럼 모델코드가 맞으면 차종까지 채움
      if (m.level === "exact" && m.rows[0]) S.vehicle.model = `${m.rows[0].body} ${m.rows[0].engine}`.trim();
    }
  }
  setDisc(p); S.rows = p.rows;
  S.vehicle.how = "부품 검색 장바구니에서 연결" + (vin ? " (최근 검색 차대번호)" : "");
  if (!S.vehicle.make && p.rows[0]) S.vehicle.make = p.rows[0].make;
  S.disc.qty = `${sets}세트 · ${sets * SET_SIZE}장`;
  if (qs.get("brand")) S.disc.brand = brandOf(qs.get("brand")).code;
  $("#log").innerHTML = ""; S.log = [];
  say(`장바구니에서 선택하신 디스크로 가공 상담을 이어갈게요.\nOEM <b>${esc(p.pn)}</b> · ${esc(S.disc.axle)} 디스크 (${esc(S.disc.spec)}) · <b>${esc(S.disc.qty)}</b>${vin ? `\n차대번호 ${esc(vin)}` : ""}`);
  SiteNav.setUrl(SiteNav.page());
  const ty = chaosType(qs.get("type"));
  if (ty) { S.needs.ctypeCode = ty.code; S.needs.ctype = ty.name; say(`가공 타입: <b>${esc(ty.name)}</b>`); go("usage"); } else go("ctype");
})();
