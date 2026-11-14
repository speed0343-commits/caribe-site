// ============================================================
// 기술연구 및 선행연구 — 외부 논문 측정값용 막대 차트 컴포넌트 (의존성 없음, SVG)
//  - 0 기준선 · 세로축 1개 · 막대 끝 4px 둥근 모서리 · 막대 사이 2px 간격
//  - 묶음(groups)이 1개면 막대마다 이름, 여러 개면 묶음 이름 + 범례(페이지에서 표시)
//  - 마우스/터치/키보드로 정확한 값 표시, 컨테이너 너비에 맞춰 다시 그림
// ============================================================
(function () {
  "use strict";
  const NS = "http://www.w3.org/2000/svg";
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const fmt = (v, d) => (typeof v === "number" && isFinite(v) ? v.toLocaleString("ko-KR", { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }) : "–");
  function el(name, attrs, text) {
    const n = document.createElementNS(NS, name);
    for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, attrs[k]);
    if (text != null) n.textContent = text;
    return n;
  }
  function niceScale(max) {
    if (!(max > 0)) return { top: 1, step: 0.2 };
    const raw = (max * 1.08) / 5;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= raw);
    return { top: Math.ceil((max * 1.08) / step - 1e-9) * step, step };
  }
  const splitName = (name) => { const m = /^(.*?)\s*(\(.*\))$/.exec(name); return m ? [m[1], m[2]] : [name]; };

  /**
   * spec = {
   *   groups: ["묶음1", ...], series: [{ id, label, color }], values: [[...series 순서 값], ...],
   *   hidden: Set(series id), unit: "m", decimals: 1, flag: "외부 논문 결과 · …" | "", title: "접근성용 제목"
   * }
   */
  function render(host, spec) {
    let tip = host.querySelector(".lab-tip");
    if (!tip) { tip = document.createElement("div"); tip.className = "lab-tip"; tip.setAttribute("role", "tooltip"); tip.hidden = true; host.appendChild(tip); }
    tip.hidden = true;
    host.querySelectorAll("svg, .lab-chart-empty").forEach((n) => n.remove());

    const hidden = spec.hidden || new Set();
    const vis = spec.series.map((s, i) => ({ ...s, i })).filter((s) => !hidden.has(s.id));
    if (!vis.length) {
      const e = document.createElement("div"); e.className = "lab-chart-empty"; e.textContent = "표시할 항목을 하나 이상 선택하세요.";
      host.insertBefore(e, tip); return;
    }
    const W = Math.max(260, host.clientWidth);
    host.dataset.w = host.clientWidth;
    const narrow = W < 520;
    const multi = spec.groups.length > 1;
    const H = narrow ? 280 : 340;
    const M = { l: narrow ? 44 : 56, r: 8, t: 34, b: multi ? 34 : narrow ? 60 : 56 };
    const pw = W - M.l - M.r, ph = H - M.t - M.b;
    const all = [];
    spec.groups.forEach((g, gi) => vis.forEach((s) => all.push(spec.values[gi][s.i])));
    const { top, step } = niceScale(Math.max(0, ...all.filter((v) => typeof v === "number")));
    const y = (v) => M.t + ph - (v / top) * ph;
    const tickDec = (String(+step.toFixed(6)).split(".")[1] || "").length;

    const svg = el("svg", { viewBox: `0 0 ${W} ${H}`, width: W, height: H, role: "img", "aria-label": `${spec.title || ""}${spec.flag ? " · " + spec.flag : ""}` });
    const g = el("g", { class: "lab-grid" });
    const n = Math.round(top / step);
    for (let i = 0; i <= n; i++) {
      const v = +(i * step).toFixed(6), yy = Math.round(y(v)) + 0.5;
      g.appendChild(el("line", { x1: M.l, x2: W - M.r, y1: yy, y2: yy, class: i === 0 ? "base" : null }));
      g.appendChild(el("text", { x: M.l - 8, y: yy + 4, "text-anchor": "end" }, fmt(v, Math.min(3, tickDec))));
    }
    if (spec.unit) g.appendChild(el("text", { x: M.l - 8, y: M.t - 16, "text-anchor": "end", class: "unit" }, spec.unit));
    if (spec.flag) g.appendChild(el("text", { x: W - M.r, y: M.t - 16, "text-anchor": "end", class: "flag" }, spec.flag));
    svg.appendChild(g);

    const marks = el("g", {});
    const gw = pw / spec.groups.length;
    const GAP = 2;
    // 묶음 1개: 가로 폭을 막대 수로 나눔 / 여러 개: 묶음마다 막대를 2px 간격으로 붙여 배치
    const band = multi ? gw : pw / vis.length;
    spec.groups.forEach((gl, gi) => {
      const slot = multi ? (gw * 0.78) / vis.length : band;
      const bw = multi ? Math.min(narrow ? 30 : 44, slot - GAP) : Math.min(narrow ? 44 : 72, band * 0.56);
      const x0g = M.l + gw * gi + (multi ? (gw - (bw + GAP) * vis.length + GAP) / 2 : 0);
      vis.forEach((s, k) => {
        const v = spec.values[gi][s.i];
        const has = typeof v === "number" && isFinite(v);
        const cx = multi ? x0g + k * (bw + GAP) + bw / 2 : M.l + band * k + band / 2;
        const y0 = y(0), y1 = has ? y(Math.max(0, v)) : y0;
        const r = Math.min(4, (y0 - y1) / 2, bw / 2);
        const xa = cx - bw / 2, xb = cx + bw / 2;
        if (has && y0 - y1 > 0.5) marks.appendChild(el("path", { d: `M${xa},${y0} V${y1 + r} Q${xa},${y1} ${xa + r},${y1} H${xb - r} Q${xb},${y1} ${xb},${y1 + r} V${y0} Z`, fill: s.color, class: "lab-bar", "data-k": `${gi}:${s.id}` }));
        // 값 라벨 — 막대 폭이 글자보다 좁으면 생략(툴팁·표로 확인)
        const label = fmt(v, spec.decimals);
        const room = multi ? bw + GAP : band;
        if (room >= label.length * 7 + 2) marks.appendChild(el("text", { x: cx, y: y1 - 7, "text-anchor": "middle", class: "val" }, label));
        if (!multi) splitName(s.label).forEach((t, li) => marks.appendChild(el("text", { x: cx, y: y0 + 20 + li * 15, "text-anchor": "middle", class: li ? "cat sub" : "cat" }, t)));
        const hx = multi ? cx - (bw + GAP) / 2 : M.l + band * k;
        const hit = el("rect", { x: hx, y: M.t, width: multi ? bw + GAP : band, height: ph + 4, class: "lab-hit", tabindex: "0", role: "button",
          "aria-label": `${s.label}${multi ? " · " + gl : ""} ${label}${spec.unit ? " " + spec.unit : ""}${spec.flag ? " · " + spec.flag : ""}` });
        const show = () => {
          tip.innerHTML = `<span class="lab-key"><i style="background:${s.color}"></i>${esc(s.label)}</span>${multi ? `<span class="lab-tip-g">${esc(gl)}</span>` : ""}<b>${label}${spec.unit ? ` <small>${esc(spec.unit)}</small>` : ""}</b>${spec.tipNote ? `<span class="lab-tip-n">${esc(spec.tipNote)}</span>` : ""}${spec.flag ? `<span class="lab-tip-f">${esc(spec.flag)}</span>` : ""}`;
          tip.hidden = false;
          const tw = tip.offsetWidth, th = tip.offsetHeight;
          tip.style.left = Math.min(Math.max(4, cx - tw / 2), W - tw - 4) + "px";
          tip.style.top = Math.max(4, y1 - th - 12) + "px";
          marks.querySelectorAll(".lab-bar").forEach((b) => b.classList.toggle("dim", b.dataset.k !== `${gi}:${s.id}`));
        };
        const hide = () => { tip.hidden = true; marks.querySelectorAll(".lab-bar.dim").forEach((b) => b.classList.remove("dim")); };
        hit.addEventListener("pointerenter", show); hit.addEventListener("pointerdown", show); hit.addEventListener("focus", show);
        hit.addEventListener("pointerleave", (e) => { if (e.pointerType === "mouse") hide(); });
        hit.addEventListener("blur", hide);
        marks.appendChild(hit);
      });
      if (multi) marks.appendChild(el("text", { x: M.l + gw * gi + gw / 2, y: y(0) + 20, "text-anchor": "middle", class: "cat" }, gl));
    });
    svg.appendChild(marks);
    host.insertBefore(svg, tip);
  }

  // 컨테이너 너비가 바뀌면 다시 그림
  function mount(host, getSpec) {
    const draw = () => render(host, getSpec());
    draw();
    if (window.ResizeObserver) new ResizeObserver(() => { if (String(host.clientWidth) !== host.dataset.w) draw(); }).observe(host);
    else window.addEventListener("resize", draw);
    return draw;
  }

  document.addEventListener("pointerdown", (e) => {
    if (e.target.closest && e.target.closest(".lab-hit")) return;
    document.querySelectorAll(".lab-tip").forEach((t) => (t.hidden = true));
    document.querySelectorAll(".lab-bar.dim").forEach((b) => b.classList.remove("dim"));
  });

  window.LabChart = { render, mount, fmt, esc };
})();
