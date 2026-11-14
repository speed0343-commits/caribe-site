// ============================================================
// 연구자료 Q&A — AI 상담 챗봇 공용 지식베이스 (index.html 부품 상담, consult.html 가공 상담)
// 근거 데이터: data/research-papers.js, data/literature-measurements.js, data/disc-patterns.js
//
// 답변 원칙
//  - 카리브무역은 자체 성능시험을 실시하지 않았다 → 자사 제품의 향상률·순위·우위는 말하지 않는다.
//  - 성능 질문에는 해외·국내 연구에서 확인된 홈 가공 디스크의 개선 결과로 답한다 (data/research-papers.js).
//    이때 반드시 논문명·시험 조건을 함께 적고, 카리브무역 제품을 시험한 값이 아님을 밝힌다.
//  - 패턴 차이는 형상·가공 방식·설계 목적으로만 설명한다.
//  - 차량별 가공 가능 여부·안전성은 확정하지 않고 담당자 확인으로 연결한다.
// 2차: 서버의 Claude API 로 바꿀 때도 이 원칙과 데이터를 시스템 지시로 함께 넘긴다.
// ============================================================
(function () {
  "use strict";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const PAPERS = () => window.RESEARCH_PAPERS || [];
  const PATTERNS = () => window.DISC_PATTERNS || [];
  const STATUS_LABEL = { REFERENCE_ONLY: "문헌 정보만 확보", LITERATURE_VERIFIED: "원문 수치 확인", PATENT_VERIFIED: "특허 원문 확인", ABSTRACT_VERIFIED: "초록 확인" };
  const NO_TEST = "성능이 궁금하시면 관련 연구 결과를 쉽게 정리해 알려 드릴게요.";

  const QUESTIONS = [
    { id: "what", q: "카오스 가공은 어떤 기술인가요?" },
    { id: "plain-slot", q: "패턴 없는 일반 디스크와 슬롯 디스크의 차이는 무엇인가요?" },
    { id: "a-b", q: "A타입과 B타입의 차이는 무엇인가요?" },
    { id: "improve", q: "홈 가공 디스크는 성능이 좋아지나요?" },
    { id: "papers", q: "관련 논문과 시험자료를 보여주십시오." },
    { id: "my-car", q: "제 차량의 브레이크 디스크에 가공할 수 있나요?" },
  ];

  function match(text) {
    const t = String(text || "").toLowerCase().replace(/\s+/g, " ");
    // 성능 향상·수치·순위·우위 질문 → 미검증 안내
    if (/(제동력|제동\s?성능|성능|효과|마찰력|냉각|방열|열|소음|수명|마모).*(향상|좋아|올라|개선|늘어|높아|좋나|있나|있어|좋은|나아|우수|차이|몇|얼마|수치|퍼센트|%)/.test(t) ||
        /(향상|개선)\s?(되나|돼|될까|효과|률|율)/.test(t) || /(어느|어떤|뭐가).*(더\s?좋|제일|가장|최고|우수|낫)/.test(t) || /(순위|랭킹|베스트|best)/.test(t)) return "improve";
    if (/(가공|슬롯|홈|카오스|무늬|패턴|타입)/.test(t) && /(소음|소리|마모|수명|냉각|방열|온도|열|마찰|제동|성능|효과|떨림|진동|비|젖|분진|먼지|좋|나아|개선|향상)/.test(t) && !/(가격|얼마|비용|기간|가능)/.test(t)) return "improve";
    if (/(논문|문헌|시험\s?자료|시험\s?성적|성적서|연구\s?자료|선행\s?연구|근거\s?자료|실험\s?데이터|시험\s?데이터)/.test(t)) return "papers";
    if (/((내|제|우리|저희)\s?(차|차량)|차종).*(가공|가능)|가공\s?(할\s?수|가능|되나|돼)/.test(t)) return "my-car";
    if (/a\s?타입.*b\s?타입|b\s?타입.*a\s?타입|a.{0,3}(와|과|랑|하고)\s?b/.test(t)) return "a-b";
    if (/(민무늬|패턴\s?없|무가공|일반\s?디스크|순정).*(슬롯|홈|사선)|(슬롯|홈|사선).*(민무늬|패턴\s?없|무가공|일반\s?디스크)/.test(t)) return "plain-slot";
    if (/카오스.*(뭐|무엇|어떤|이란|란\b|기술|설명)/.test(t)) return "what";
    return null;
  }

  const pat = (id) => PATTERNS().find((p) => p.id === id) || {};
  const shapeLine = (p) => `<b>${esc(p.name)}</b> — 형상: ${esc(p.shape)} / 가공: ${esc(p.process)} / 설계 목적: ${esc(p.purpose)}`;

  // ---------- 성능 질문: 해외·국내 연구에서 확인된 개선 결과를 쉬운 말로 ----------
  // 근거: data/research-papers.js 의 GM(특허 다이나모 시험), SAE13, TI16, WEAR24, B, SAE24
  // 모든 답변에 출처와 "카리브무역 제품을 직접 시험한 값은 아님"을 함께 붙입니다.
  const paper = (pid) => PAPERS().find((p) => p.id === pid) || {};
  const src = (pid, label) => { const p = paper(pid); return p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(label)}</a>` : esc(label); };
  const NOTE = `<span class="muted small">해외 연구·시험에서 나온 결과이며, 카리브무역 카오스 가공 디스크를 직접 시험한 값은 아닙니다.</span>`;

  const FACT = {
    fade: () => `<b>뜨거워져도 제동력 유지</b>: GM 연구진의 다이나모 시험에서 홈을 낸 디스크는 브레이크가 뜨거워진 상태(페이드)에서 제동력이 일반 디스크보다 <b>약 9% 높았습니다</b>(마찰계수 0.22 → 0.24). 현대자동차·상신브레이크 연구에서도 슬롯 디스크가 페이드 성능에 도움이 된다고 밝혔습니다.`,
    judder: () => `<b>떨림 감소</b>: 같은 GM 시험에서 길이가 서로 다른 홈을 넣은 디스크는 뜨거운 상태에서 제동력이 출렁이는 현상(토크 변동)이 <b>약 50% 줄었습니다.</b>`,
    taper: () => `<b>패드 편마모 감소</b>: 패드가 한쪽만 비스듬히 닳는 편마모가 <b>약 42% 줄었고</b>(22.6 → 13.0 µm/mm), 패드가 닳는 양 자체는 거의 늘지 않았습니다. 브레이크 페달을 밟는 거리도 짧아졌습니다.`,
    noise: () => `<b>소음 감소</b>: 중국 서남교통대 연구팀(Tribology International, 2016)은 디스크에 45° 방향 홈을 내면 브레이크 끽 소리(스퀼)가 <b>크게 줄었다</b>고 보고했습니다. 홈이 마모 가루를 가두고 패드가 닿는 힘을 고르게 나눠 주기 때문입니다.`,
    wet: () => `<b>비 오는 날 제동</b>: 물에 젖는 조건을 반복한 시험(Wear, 2024)에서 홈 가공 디스크가 일반 디스크보다 <b>원래 제동력을 더 빨리 되찾았고</b>, 디스크 표면이 긁혀 상하는 손상도 크게 줄었습니다.`,
    race: () => `<b>고성능 차량에서 쓰는 이유</b>: GM의 SAE 논문(2013)은 고성능 차량이 가혹한 주행에서 제동력을 높이려고 디스크에 홈·구멍 가공을 쓴다고 설명합니다.`,
  };
  const SOURCES = {
    fade: () => `${src("GM", "GM 특허 US 8,146,719")} · ${src("B", "SAE 2018-01-1883")}`,
    judder: () => src("GM", "GM 특허 US 8,146,719"),
    taper: () => src("GM", "GM 특허 US 8,146,719"),
    noise: () => src("TI16", "Tribology International 102 (2016)"),
    wet: () => src("WEAR24", "Wear 540 (2024)"),
    race: () => src("SAE13", "SAE 2013-01-2039"),
  };

  function perfTopic(t) {
    t = String(t || "");
    if (/(분진|먼지|가루|더러|휠\s?때)/.test(t)) return "dust";
    if (/(비\b|비\s?올|빗길|젖|물|우천|wet)/.test(t)) return "wet";
    if (/(소음|소리|끽|스퀼)/.test(t)) return "noise";
    if (/(떨림|진동|저더|울컥|출렁)/.test(t)) return "judder";
    if (/(마모|수명|패드|편마모|닳)/.test(t)) return "wear";
    if (/(온도|냉각|방열|열|식|페이드|fade|뜨거|과열|내리막)/.test(t)) return "heat";
    if (/(제동력|제동\s?성능|마찰|토크|멈추|정지|잘\s?서|브레이크\s?힘|밀림)/.test(t)) return "brake";
    return "all";
  }
  function build(keys, extra) {
    const body = keys.map((k) => FACT[k]()).join("\n");
    const srcs = [...new Set(keys.flatMap((k) => SOURCES[k]().split(" · ")))].join(" · ");
    return `${body}${extra ? "\n" + extra : ""}\n<span class="muted small">출처: ${srcs}</span>\n${NOTE}`;
  }
  function perfAnswer(text) {
    const topic = perfTopic(text);
    if (topic === "heat") return build(["fade"], "홈의 효과는 디스크 온도를 크게 낮추기보다, <b>뜨거워졌을 때도 제동력을 지켜 주는 쪽</b>에서 확인됐습니다.");
    if (topic === "brake") return build(["fade", "race"]);
    if (topic === "judder") return build(["judder", "taper"]);
    if (topic === "noise") return build(["noise"], "다만 홈의 방향·폭·간격에 따라 효과가 달라서, 디스크에 맞게 설계하는 것이 중요합니다.");
    if (topic === "wear") return build(["taper", "wet"]);
    if (topic === "wet") return build(["wet"]);
    if (topic === "dust") return `<b>브레이크 분진</b>: 홈 가공 디스크는 일반 디스크보다 분진이 조금 더 생길 수 있다는 연구가 있습니다(SAE 2024, 축소 시편 시험). 휠에 묻는 가루가 늘 수 있으니 세차할 때 휠을 함께 닦아 주시면 좋습니다.\n<span class="muted small">출처: ${src("SAE24", "SAE 2024-01-3030")}</span>\n${NOTE}`;
    return `해외 연구에서 디스크 마찰면에 홈을 낸 경우 다음과 같은 <b>개선 결과</b>가 확인됐습니다.\n` + build(["fade", "judder", "taper", "noise", "wet"]);
  }

  function answer(id, text) {
    let html = "", actions = [["디자인 보기", "#lab"]];
    if (id === "what") {
      html = `<b>카오스 가공</b>은 브레이크 디스크 마찰면에 홈 패턴을 가공하는 카리브무역이 <b>제공하는 가공</b>입니다. ` +
        `타입은 ${esc(pat("slotted").name)}(${esc(pat("slotted").tag)}), ${esc(pat("chaosA").name)}(${esc(pat("chaosA").tag)}), ${esc(pat("chaosB").name)}(${esc(pat("chaosB").tag)}) 세 가지이며, 차이는 홈의 형상과 배치입니다.\n${NO_TEST}`;
      actions.push(["성능 시험 수치 보기", "#rq:improve"], ["가공 상담 시작", "#consult"]);
    } else if (id === "plain-slot") {
      html = `${shapeLine(pat("plain"))}\n${shapeLine(pat("slotted"))}\n` +
        `슬롯(홈) 디스크에 관한 외부 연구는 있지만, 다른 연구기관이 다른 시편으로 시험한 결과라 카리브무역 제품의 성능으로 볼 수 없습니다.\n${NO_TEST}`;
    } else if (id === "a-b") {
      html = `${shapeLine(pat("chaosA"))}\n${shapeLine(pat("chaosB"))}\n외관과 홈 형상을 보고 고르시면 됩니다.`;
      actions.push(["타입별 가공비 보기", "#tech"]);
    } else if (id === "improve") {
      html = perfAnswer(text);
      actions = [["관련 논문 목록", "#rq:papers"], ["가공 상담 시작", "#consult"], ["디자인 보기", "#lab"]];
    } else if (id === "papers") {
      const lines = PAPERS().map((p) => `· [${esc(STATUS_LABEL[p.status] || p.status)}] ${esc(p.titleKo)} (${esc(p.year)}) <a href="${esc(p.url)}" target="_blank" rel="noopener">${p.doi ? "DOI " + esc(p.doi) : "원문 보기"}</a>`);
      html = `참고 중인 국내·해외 연구자료입니다.\n${lines.join("\n")}\n이 논문들은 <b>다른 연구기관의 시험 결과</b>이며 카리브무역 제품을 시험한 것이 아닙니다.`;
    } else if (id === "my-car") {
      html = `차량별 <b>가공 가능 여부와 안전성은 AI가 확정하지 않습니다.</b>\n디스크 규격(외경·두께·최소 두께), 마모·변형 상태, 차량 사용 환경을 담당자가 확인한 뒤 진행 여부를 안내드립니다. 가공 상담에서 차량과 디스크 정보를 남겨 주십시오.`;
      actions = [["가공 상담 시작", "#consult"], ["담당자 확인 요청", "#inquiry"], ["디자인 보기", "#lab"]];
    } else return null;
    return { html, actions };
  }

  window.ResearchQA = { QUESTIONS, match, answer, STATUS_LABEL };
})();
