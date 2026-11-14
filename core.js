// ============================================================
// 카리브무역 — 공통 로직 (데이터 색인, 차대번호·품번 해석, 공통 도구)
// 사용: catalog-data.js → data.js → core.js 순서로 불러온 뒤 각 페이지 스크립트
// ============================================================
const $ = (s) => document.querySelector(s);
const won = (n) => n.toLocaleString("ko-KR") + "원";
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");
const store = {
  get(k, d) { try { return JSON.parse(localStorage.getItem(k)) ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} },
};
const makeKo = (m) => MAKE_KO[m] || m;
const axleKo = (a) => (a === "front" ? "앞" : "뒤");

// ---------------- 데이터 색인 ----------------
const C = window.CATALOG;
const PRODUCTS = C.products.map((p, i) => ({ ...p, i, rows: [] }));
const ROWS = [];
C.fit.forEach((f) => {
  const p = PRODUCTS[f[0]];
  const make = C.makes[f[1]];
  if (SUSPECT_ROWS.some((s) => s.pn === p.pn && s.make === make)) return;
  const body = f[3] || "";
  const m = body.match(/\(([^)]*)\)\s*$/);
  const row = {
    p: f[0], make, group: C.groups[f[2]], body, engine: f[4] || "",
    codes: String(f[5] || "").split(/,\s*/).filter(Boolean),
    chassis: m ? m[1].split(/,\s*/).filter(Boolean) : [],
    from: f[6] || "", to: f[7] || "", kw: f[8] || "", cc: f[9] || "",
  };
  ROWS.push(row);
  p.rows.push(row);
});
// 가공 옵션 (data\가공비용.csv 에서 판매 여부 Y + 가공비 입력된 것만 들어옴)
const OPTIONS = [].concat(C.options || []);
const PRICE_NOTE = C.priceNote || "";
function optionsFor(p) {
  const d = parseFloat(p.dia);
  if (!d) return [];
  return OPTIONS.filter((o) => (!o.axle || o.axle === p.axle) && d >= o.min && d <= o.max);
}
const optionByCode = (code) => OPTIONS.find((o) => o.code === code) || null;
const MAKES = [...new Set(ROWS.map((r) => r.make))].sort((a, b) => ROWS.filter((r) => r.make === b).length - ROWS.filter((r) => r.make === a).length);
const CHASSIS = new Map(); // 섀시코드 → 행 목록
ROWS.forEach((r) => r.chassis.forEach((c) => { if (!CHASSIS.has(c)) CHASSIS.set(c, []); CHASSIS.get(c).push(r); }));

// 행 목록 → 상품별로 묶기 (판매량 많은 순)
function groupByProduct(rows, axle) {
  const map = new Map();
  rows.forEach((r) => { const p = PRODUCTS[r.p]; if (axle && p.axle !== axle) return; if (!map.has(p)) map.set(p, []); map.get(p).push(r); });
  return [...map.entries()].map(([p, rs]) => ({ p, rows: rs })).sort((a, b) => b.p.sold - a.p.sold);
}
const rowsFor = ({ make, group, code }) => ROWS.filter((r) => (!make || r.make === make) && (!group || r.group === group) && (!code || r.chassis.includes(code)));
const years = (r) => `${r.from || "?"} ~ ${r.to || "현재"}`;

// ---------------- 차대번호 / 품번 해석 ----------------
const YEAR_CODES = "ABCDEFGHJKLMNPRSTVWXY";
function decodeVin(raw) {
  const vin = raw.trim().toUpperCase().replace(/[\s-]/g, "");
  if (vin.length !== 17) return { ok: false, error: `차대번호는 17자리입니다. (입력: ${vin.length}자리)` };
  if (/[IOQ]/.test(vin)) return { ok: false, error: "차대번호에는 I, O, Q 문자가 쓰이지 않습니다. 숫자 1, 0과 혼동했는지 확인해 주십시오." };
  if (!/^[A-HJ-NPR-Z0-9]{17}$/.test(vin)) return { ok: false, error: "영문 대문자와 숫자만 입력할 수 있습니다." };
  return { ok: true, vin, make: WMI_MAP[vin.slice(0, 3)] || null };
}

// 차대번호 → 적용 행 찾기. level: exact(모델코드 일치) | platform(플랫폼 코드 추정) | make(제조사만)
function matchVin(r) {
  if (!r.make) return { level: "none", rows: [] };
  if (r.make === "MERCEDES-BENZ") {
    const raw = r.vin.slice(3, 9);
    const code = `${raw.slice(0, 3)}.${raw.slice(3)}`;
    const rows = ROWS.filter((x) => x.make === r.make && x.codes.includes(code));
    if (rows.length) return { level: "exact", key: code, rows };
    return { level: "make", key: code, rows: [] };
  }
  if (VAG_MAKES.includes(r.make)) {
    const pc = r.vin.slice(6, 8);
    const rows = ROWS.filter((x) => VAG_MAKES.includes(x.make) && x.chassis.some((c) => c.startsWith(pc)));
    if (rows.length) return { level: "platform", key: pc, rows };
    return { level: "make", key: pc, rows: [] };
  }
  return { level: "make", rows: [] };
}

function findPn(raw) {
  let q = norm(raw);
  if (/^A\d{10}$/.test(q)) q = q.slice(1); // 벤츠 A0004231812 → 0004231812
  if (q.length < 5) return null;
  const nz = (s) => s.replace(/^0+/, ""); // 앞자리 0 생략 표기(4231812 = 0004231812)도 인식
  return PRODUCTS.find((p) => norm(p.pn) === q) || PRODUCTS.find((p) => nz(norm(p.pn)) === nz(q)) || null;
}

// 의뢰번호·날짜 도구
// 날짜·시각은 접속한 기기의 현지 시각(한국 시간)으로 표시
const pad2 = (n) => String(n).padStart(2, "0");
const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
function fmtDT(iso) {
  if (!iso) return "";
  const d = new Date(iso); if (isNaN(d)) return String(iso);
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())} ${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}
function newRequestId() {
  const ymd = today().replace(/-/g, "");
  return "CR-" + ymd + "-" + String(Math.floor(Math.random() * 9000) + 1000);
}
const REQUESTS_KEY = "carib_requests";
const INQUIRIES_KEY = "inquiries";

// 의뢰서 등 특정 영역만 인쇄 (브라우저 인쇄 → "PDF로 저장" 가능)
function printHtml(html) {
  const area = document.createElement("div");
  area.className = "print-area";
  area.innerHTML = html;
  document.body.appendChild(area);
  document.body.classList.add("printing");
  let printed = false;
  const done = () => { document.body.classList.remove("printing"); area.remove(); window.removeEventListener("afterprint", onAfter); };
  const onAfter = () => { printed = true; done(); };
  window.addEventListener("afterprint", onAfter);
  try { window.print(); } catch (e) {}
  // 공유용 페이지 등 인쇄 창을 열 수 없는 환경이면 안내만 표시
  setTimeout(() => { if (!printed) { done(); printNotice(); } }, 1000);
}
function printNotice() {
  const n = document.createElement("div");
  n.className = "print-notice";
  n.setAttribute("role", "status");
  n.textContent = "이 화면에서는 인쇄 창을 열 수 없습니다. 의뢰서 내용은 화면에서 확인해 주십시오.";
  document.body.appendChild(n);
  setTimeout(() => n.remove(), 4000);
}

// 가공 의뢰서 HTML (상담 페이지·관리자 화면 공용)
const REQ_STATUS = ["접수", "검토 중", "견적 안내", "작업 완료", "취소"];
function requestDocHtml(r, withActions) {
  const row = (k, v) => `<tr><th>${esc(k)}</th><td>${v ? esc(v).replace(/\n/g, "<br>") : '<span class="muted">-</span>'}</td></tr>`;
  return `<div class="req-doc">
    <div class="doc-head">
      <div><h2>가공 의뢰서</h2><div class="muted small">카오스 브레이크 디스크 가공 상담 결과</div></div>
      <div style="text-align:right"><b>${esc(r.id)}</b><div class="muted small">접수일 ${esc(r.date)}${r.status ? " · " + esc(r.status) : ""}</div></div>
    </div>
    <div class="sec">의뢰자</div>
    <table>${row("성함 / 업체명", r.contact?.name)}${row("연락처", r.contact?.phone)}${row("이메일", r.contact?.email)}${r.contact?.items ? row("함께 필요한 품목", r.contact.items) : ""}</table>
    <div class="sec">차량 정보</div>
    <table>${row("차대번호", r.vehicle?.vin)}${row("제조사", r.vehicle?.make)}${row("차종 / 세대", r.vehicle?.model)}${row("식별 방법", r.vehicle?.how)}</table>
    <div class="sec">디스크 정보</div>
    <table>${row("OEM 품번", r.disc?.pn)}${row("브랜드", r.disc?.brand || "상담 후 결정")}${row("디스크 위치", r.disc?.axle)}${row("규격", r.disc?.spec)}${row("수량", r.disc?.qty)}</table>
    <div class="sec">가공 요구사항</div>
    <table>${row("가공 타입", r.needs?.ctype ? "카오스 가공 · " + r.needs.ctype : "")}${row("사용 환경", r.needs?.usage)}${row("현재 증상", r.needs?.symptoms)}${row("요청 사항", r.needs?.request)}${row("희망 일정", r.needs?.schedule)}${row("의뢰 방식", r.needs?.mode || "추후 확정")}${row("예상 가공비", r.needs?.fee || "검토 후 안내")}</table>
    ${r.memo ? `<div class="sec">담당자 메모</div><table>${row("메모", r.memo)}</table>` : ""}
    <p class="muted small">※ 본 의뢰서는 상담 내용을 정리한 문서이며, 디스크 적용 여부와 가공 가능 여부·비용은 담당자 검토 후 확정됩니다.</p>
    ${withActions ? `<div class="doc-actions">${withActions}</div>` : ""}
  </div>`;
}
// 판매 단위: 브레이크 디스크는 2장 1세트(한 축 좌·우)로 판매
const SET_SIZE = 2;

// ---------------- 상담사 채팅 (시연용: 이 브라우저 localStorage 에 저장) ----------------
// 실제 운영: 서버 + 실시간 연결(웹소켓) 또는 카카오톡 채널·네이버 톡톡 상담으로 교체
const AGENT_KEY = "carib_agent_chats";
const CHAT_STATUS = ["대기", "상담 중", "종료"];
const agentChats = () => store.get(AGENT_KEY, []);
const saveAgentChats = (list) => store.set(AGENT_KEY, list);
function updateAgentChat(id, fn) {
  const list = agentChats(); const c = list.find((x) => x.id === id);
  if (!c) return null;
  fn(c); c.updatedAt = new Date().toISOString(); saveAgentChats(list); return c;
}
// ---------------- 디스크 규격 도면 이미지 (SVG 자동 생성) ----------------
// 품번별 외경·두께·최소두께를 반영한 정면도 + 단면도. 실제 제품 사진이 아니라 "규격 예시 도면".
// 외경은 260~400mm 범위에서 크기를 비례 조정해, 카드끼리 크기 차이가 눈에 보이게 함.
function discSvg(p) {
  const dia = parseFloat(p.dia) || 0, thk = parseFloat(p.thk) || 0, min = parseFloat(p.min) || 0;
  const R = dia ? Math.max(44, Math.min(64, 44 + ((dia - 260) / 140) * 20)) : 54;
  const cx = 82, cy = 82;
  const hubR = R * 0.44, boreR = R * 0.17, lugR = R * 0.29;
  const vented = thk >= 18;
  const lugs = Array.from({ length: 5 }, (_, i) => {
    const a = (-90 + i * 72) * Math.PI / 180;
    return `<circle cx="${(cx + Math.cos(a) * lugR).toFixed(1)}" cy="${(cy + Math.sin(a) * lugR).toFixed(1)}" r="${(R * 0.055).toFixed(1)}" fill="#0d0e10"/>`;
  }).join("");
  const rings = [0.62, 0.74, 0.86].map((k) => `<circle cx="${cx}" cy="${cy}" r="${(R * k).toFixed(1)}" fill="none" stroke="#ffffff" stroke-opacity=".18" stroke-width=".6"/>`).join("");
  // 단면도
  const sx = 200, top = cy - R, h = R * 2, w = Math.max(7, Math.min(46, (thk || 22) * 1.35));
  const hubH = hubR * 2, hatW = 13;
  let section = `<rect x="${sx}" y="${top}" width="${w.toFixed(1)}" height="${h}" rx="1.5" fill="url(#dsSilver)"/>`;
  if (vented) {
    const gap = w * 0.36, gx = sx + (w - gap) / 2;
    section += `<rect x="${gx.toFixed(1)}" y="${top + 3}" width="${gap.toFixed(1)}" height="${h - 6}" fill="#0d0e10"/>`;
    for (let y = top + 8; y < top + h - 6; y += 9) section += `<rect x="${gx.toFixed(1)}" y="${y.toFixed(1)}" width="${gap.toFixed(1)}" height="3" fill="#8b9099"/>`;
  }
  section += `<rect x="${(sx - hatW).toFixed(1)}" y="${(cy - hubH / 2).toFixed(1)}" width="${hatW + 2}" height="${hubH.toFixed(1)}" rx="2" fill="#4b5058"/>`;
  section += `<rect x="${(sx - hatW - 3).toFixed(1)}" y="${(cy - boreR).toFixed(1)}" width="${hatW + 6}" height="${(boreR * 2).toFixed(1)}" fill="#0d0e10"/>`;
  // 치수선
  const dimX = sx + w + 14, dimY = top - 10;
  const dims = `
    <g stroke="#c9cdd3" stroke-width=".8" fill="none">
      <line x1="${dimX}" y1="${top}" x2="${dimX}" y2="${top + h}"/>
      <line x1="${dimX - 4}" y1="${top}" x2="${dimX + 4}" y2="${top}"/><line x1="${dimX - 4}" y1="${top + h}" x2="${dimX + 4}" y2="${top + h}"/>
      <line x1="${sx}" y1="${dimY}" x2="${sx + w}" y2="${dimY}"/>
      <line x1="${sx}" y1="${dimY - 4}" x2="${sx}" y2="${dimY + 4}"/><line x1="${sx + w}" y1="${dimY - 4}" x2="${sx + w}" y2="${dimY + 4}"/>
    </g>
    <text x="${dimX + 6}" y="${cy + 4}" fill="#e5e7eb" font-size="12" font-weight="700" font-family="Segoe UI, Arial, sans-serif">Ø${dia || "?"}</text>
    <text x="${sx + w / 2}" y="${dimY - 6}" fill="#e5e7eb" font-size="11" font-weight="700" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">${thk || "?"}mm</text>
    ${min ? `<text x="${sx + w / 2}" y="${top + h + 16}" fill="#9ca3af" font-size="9.5" text-anchor="middle" font-family="Segoe UI, Arial, sans-serif">최소 ${min}mm</text>` : ""}`;
  return `<svg viewBox="0 0 300 170" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="브레이크 디스크 규격 도면 외경 ${dia}mm 두께 ${thk}mm">
    <defs>
      <radialGradient id="dsFace" cx="45%" cy="40%" r="65%"><stop offset="0" stop-color="#f3f4f6"/><stop offset=".55" stop-color="#b8bdc5"/><stop offset="1" stop-color="#7d838c"/></radialGradient>
      <linearGradient id="dsSilver" x1="0" x2="1"><stop offset="0" stop-color="#9ca3af"/><stop offset=".5" stop-color="#eef0f2"/><stop offset="1" stop-color="#9ca3af"/></linearGradient>
      <radialGradient id="dsHat" cx="45%" cy="40%" r="70%"><stop offset="0" stop-color="#6b7079"/><stop offset="1" stop-color="#2b2e34"/></radialGradient>
    </defs>
    <text x="10" y="16" fill="#9ca3af" font-size="9.5" letter-spacing="1.5" font-family="Segoe UI, Arial, sans-serif">${p.axle === "front" ? "FRONT" : "REAR"} · ${vented ? "VENTED" : "SOLID"}</text>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#dsFace)"/>
    ${rings}
    <circle cx="${cx}" cy="${cy}" r="${hubR.toFixed(1)}" fill="url(#dsHat)" stroke="#0d0e10" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="${boreR.toFixed(1)}" fill="#0d0e10"/>
    ${lugs}
    ${section}
    ${dims}
  </svg>`;
}
// ---------------- 카오스 가공 타입 ----------------
// 가공비는 data\가공비용.csv 에서 타입 코드(CHAOS-D / CHAOS-A / CHAOS-B)로 시작하는 줄에 입력.
// 입력 전(또는 판매 여부 N)에는 "가공비 별도 견적"으로 표시.
const CHAOS_TYPES = [
  { code: "CHAOS-D", key: "diag", name: "사선 타입", desc: "비스듬한 직선 홈(슬롯)을 일정 간격으로 배치한 단순한 형상" },
  { code: "CHAOS-A", key: "A", name: "A 타입", desc: "길이와 곡률이 다른 곡선 홈을 불규칙하게 배치한 형상" },
  { code: "CHAOS-B", key: "B", name: "B 타입", desc: "화살표(V자) 홈을 원주 방향으로 반복 배치한, 회전 방향이 있는 형상" },
];
const chaosType = (code) => CHAOS_TYPES.find((t) => t.code === code) || null;
// 품번 p 에 대해 타입별 가공 옵션(금액 있으면 금액, 없으면 null) 반환
function chaosOption(p, code) {
  const t = chaosType(code); if (!t) return null;
  const cfg = p ? optionsFor(p).find((o) => o.code.startsWith(t.code)) : null;
  return { code: t.code, name: "카오스 가공 · " + t.name, type: t, price: cfg ? cfg.price : null };
}

// 가공 타입 일러스트 (SVG). key: none | diag | A | B. 실제 사진이 아닌 형상 이해용 예시.
function chaosSvg(key, label) {
  const cx = 120, cy = 120, R = 104;
  const pt = (r, d) => { const a = (d - 90) * Math.PI / 180; return [(cx + Math.cos(a) * r).toFixed(1), (cy + Math.sin(a) * r).toFixed(1)]; };
  const P = (r, d) => pt(r, d).join(" ");
  let g = "";
  if (key === "diag") {
    // 사선: 허브 근처에서 바깥으로 비스듬히 뻗는 직선 홈 10개
    for (let i = 0; i < 10; i++) { const a = i * 36; g += `<path d="M ${P(64, a)} L ${P(96, a + 26)}"/>`; }
  } else if (key === "A") {
    // A 타입: 회전 방향으로 크게 휘는 곡선 홈 + 바깥쪽 짧은 갈래(가지)
    for (let i = 0; i < 12; i++) {
      const a = i * 30;
      g += `<path d="M ${P(60, a)} Q ${P(88, a + 2)} ${P(99, a + 38)}"/>`;
      g += `<path d="M ${P(86, a + 12)} Q ${P(93, a + 9)} ${P(99, a + 12)}"/>`;
    }
  } else if (key === "B") {
    // B 타입: 바깥을 향한 화살표(쉐브론) + 화살표 사이 곡선으로 꽉 찬 패턴
    for (let i = 0; i < 10; i++) {
      const a = i * 36;
      g += `<path d="M ${P(70, a - 11)} Q ${P(88, a - 7)} ${P(99, a)} Q ${P(88, a + 7)} ${P(70, a + 11)}"/>`;
      g += `<path d="M ${P(66, a - 5)} Q ${P(77, a - 3)} ${P(86, a)} Q ${P(77, a + 3)} ${P(66, a + 5)}"/>`;
      g += `<path d="M ${P(58, a + 15)} Q ${P(76, a + 16)} ${P(97, a + 21)}"/>`;
    }
  }
  const lugs = [0, 72, 144, 216, 288].map((d) => `<circle cx="${pt(31, d)[0]}" cy="${pt(31, d)[1]}" r="5.6" fill="#1a1b1e"/>`).join("");
  return `<svg viewBox="0 0 240 ${label ? 262 : 240}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="카오스 가공 ${label || key} 예시">
    <defs>
      <radialGradient id="cxFace" cx="42%" cy="36%" r="70%"><stop offset="0" stop-color="#f7f8f9"/><stop offset=".55" stop-color="#c9cdd3"/><stop offset="1" stop-color="#8f959e"/></radialGradient>
      <radialGradient id="cxHat" cx="40%" cy="35%" r="70%"><stop offset="0" stop-color="#eef0f2"/><stop offset="1" stop-color="#a3a9b1"/></radialGradient>
    </defs>
    <circle cx="${cx}" cy="${cy}" r="${R}" fill="url(#cxFace)" stroke="#7d838c" stroke-width="1"/>
    ${[66, 78, 90].map((r) => `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffffff" stroke-opacity=".35" stroke-width=".7"/>`).join("")}
    <g fill="none" stroke="#3d4148" stroke-width="${key === "diag" ? 3.4 : 2.3}" stroke-linecap="round" stroke-linejoin="round">${g}</g>
    <circle cx="${cx}" cy="${cy}" r="52" fill="url(#cxHat)" stroke="#8f959e" stroke-width="1.2"/>
    <circle cx="${cx}" cy="${cy}" r="44" fill="none" stroke="#9aa0a8" stroke-width="1"/>
    <circle cx="${cx}" cy="${cy}" r="17" fill="#1a1b1e"/>
    ${lugs}
    ${label ? `<text x="120" y="256" text-anchor="middle" font-family="Segoe UI, Pretendard, Arial, sans-serif" font-size="15" font-weight="700" fill="#23262b">${label}</text>` : ""}
  </svg>`;
}
// ---------------- 판매 브랜드 (COLUMN 기본가 / BREMBO 추가금) ----------------
// 금액 설정: data\가격설정.csv 의 "BREMBO 추가금 1장" → 데이터 생성 시 CATALOG.brands 로 들어옴
const BRANDS = [].concat(C.brands || [{ code: "COLUMN", add: 0 }]);
const brandOf = (code) => BRANDS.find((b) => b.code === code) || BRANDS[0];
const brandPrice = (p, code) => (p.price ? p.price + brandOf(code).add : null); // 1장 가격

// ---------------- 장바구니 · 주문 (시연용: 이 브라우저 localStorage 에 저장) ----------------
// 실제 운영: 서버 API(POST /api/orders) + PG 결제 연동으로 교체
const CART_KEY = "cart4";
const ORDERS_KEY = "carib_orders";
const ORDER_STATUS = ["주문 접수", "적용 확인", "입금 확인", "출고 준비", "배송 중", "배송 완료", "취소 요청", "취소"];
const PAY_METHODS = {
  bank: { name: "무통장 입금", ready: true, note: "차량 적용 확인 후 입금 계좌를 문자로 안내합니다." },
  card: { name: "신용·체크카드", ready: false, note: "결제대행(PG) 연동 후 제공 예정" },
  easy: { name: "간편결제 (네이버페이·카카오페이)", ready: false, note: "결제대행(PG) 연동 후 제공 예정" },
};
// 장바구니 한 줄: 키 "품번|브랜드|가공코드" → 상품·가격 정보 (가공비 미정이면 디스크 값만)
function cartLine(key, q) {
  const [pn, brand, oc] = key.split("|");
  const p = PRODUCTS.find((x) => x.pn === pn);
  const o = oc && p ? chaosOption(p, oc) : null;
  if (!p || !p.price || (oc && !o) || !BRANDS.some((b) => b.code === brand) || !(q > 0)) return null;
  const unit = (brandPrice(p, brand) + (o && o.price ? o.price : 0)) * SET_SIZE; // 1세트(2장)
  return { key, q, p, brand, o, unit, sub: unit * q };
}
function cartItemsFromStore() {
  return Object.entries(store.get(CART_KEY, {})).map(([k, q]) => cartLine(k, q)).filter(Boolean);
}
function newOrderId() {
  const ymd = today().replace(/-/g, "");
  return "OR-" + ymd + "-" + String(Math.floor(Math.random() * 9000) + 1000);
}
// ---------------- AI 상담: 답하지 못한 질문 · 관리자가 등록한 답변 (시연용 localStorage) ----------------
// 실제 운영: 서버 API(POST /api/ai/unanswered, GET/POST /api/ai/answers)로 교체
const AI_UNANSWERED_KEY = "carib_ai_unanswered";
const AI_ANSWERS_KEY = "carib_ai_answers";
const AI_Q_STATUS = ["미처리", "답변 등록", "제외"];
const kwNorm = (s) => String(s || "").toLowerCase().replace(/[\s?!.,~]+/g, "");

// ---------------- B 시안 상품표 (메인 · 전체 상품 공용) ----------------
function ptTable(items, home) {
  const rows = items.map((p) => {
    const cars = [...new Set(p.rows.map((r) => `${makeKo(r.make)} ${r.group}`))];
    const car = cars.slice(0, 2).join(", ") + (cars.length > 2 ? ` 외 ${cars.length - 2}` : "");
    const act = p.price ? `<button type="button" ${home ? "data-add" : "data-pd-add"}="${esc(p.pn)}">담기</button>`
      : `<button type="button" ${home ? "data-inquiry" : "data-pd-ask"}="${home ? `[가격 문의] 브레이크 디스크 ${axleKo(p.axle)} OEM ${esc(p.pn)}` : esc(p.pn)}" data-axle="${axleKo(p.axle)}">가격 문의</button>`;
    const price = (b) => (p.price ? (brandPrice(p, b) * SET_SIZE).toLocaleString("ko-KR") : "문의");
    return `<tr><td><b>${axleKo(p.axle)}</b></td><td class="m"><a href="index.html?q=${encodeURIComponent(p.pn)}">${esc(p.pn)}</a></td><td class="m">Ø${esc(p.dia)} × ${esc(p.thk)}</td><td>${esc(car)}</td><td class="m r"><b>${price("COLUMN")}</b></td><td class="m r g">${price("BREMBO")}</td><td class="r">${act}</td></tr>`;
  }).join("");
  return `<div class="pt-wrap"><table class="pt"><thead><tr><th>위치</th><th>OEM 품번</th><th>외경 × 두께 (mm)</th><th>적용 차종</th><th class="r">COLUMN (원)</th><th class="r">BREMBO (원)</th><th class="r">2장 1세트</th></tr></thead><tbody>${rows}</tbody></table></div>`;
}
