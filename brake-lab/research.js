// ============================================================
// 기술연구 및 선행연구 페이지 (research.html)
// - 카리브무역 자체 성능시험: 미실시 → 제품 성능 수치·그래프 없음
// - 그래프는 외부 논문(LITERATURE_VERIFIED) 측정값만, "카리브무역 제품 시험 아님"을 함께 표시
// 데이터: data/research-papers.js · literature-measurements.js · disc-patterns.js · test-plan.js
// ============================================================
(function () {
  "use strict";
  const { esc, fmt } = window.LabChart;
  const $ = (id) => document.getElementById(id);
  const PAPERS = window.RESEARCH_PAPERS || [];
  const MEAS = (window.LITERATURE_MEASUREMENTS || []).filter((m) => m.status === "LITERATURE_VERIFIED" && PAPERS.some((p) => p.id === m.paperId && p.status === "LITERATURE_VERIFIED"));
  const PATTERNS = window.DISC_PATTERNS || [];

  // 외부 논문 시편 색 (카리브무역 패턴과 다른 색 묶음 — 색각 이상 검증 팔레트)
  const LIT_COLOR = { combined: "#14b8a6", slot: "#d946ef", hole: "#c08a00" };
  const BADGE = { REFERENCE_ONLY: "s-ref", LITERATURE_VERIFIED: "s-lit" };
  const STATUS_KO = { REFERENCE_ONLY: "문헌 정보만", LITERATURE_VERIFIED: "원문 수치 확인" };
  const badge = (s) => `<span class="lab-badge ${BADGE[s] || "s-ref"}">${esc(STATUS_KO[s] || s)}</span>`;
  const paperOf = (id) => PAPERS.find((p) => p.id === id) || {};
  const unitShort = (u) => String(u || "").replace(/\s*\(.*\)\s*/, "");
  const litSeries = (m) => m.series.map((s) => ({ ...s, color: LIT_COLOR[s.id] || "#6f747d" }));
  const legendKeys = (series) => series.map((s) => `<span class="lab-key"><i style="background:${s.color}"></i>${esc(s.label)}</span>`).join("");

  // ---------- 02 패턴 4종 ----------
  function placeholder(p) {
    return `<div class="lab-img-ph"><svg viewBox="0 0 100 100" aria-hidden="true"><circle cx="50" cy="50" r="44" fill="none" stroke="currentColor" stroke-width="2" stroke-dasharray="4 4"/><circle cx="50" cy="50" r="16" fill="none" stroke="currentColor" stroke-width="2"/></svg><b>이미지 준비 중</b><code>${esc(p.image)}</code></div>`;
  }
  function renderPatterns() {
    const box = $("discCards");
    box.innerHTML = PATTERNS.map((p, i) => `<article class="lab-disc">
        <div class="lab-disc-img" data-i="${i}"><img src="${esc(p.image)}" alt="${esc(p.name)} 브레이크 디스크 예시 이미지" decoding="async" /></div>
        <div class="lab-disc-body">
          <p class="lab-disc-no">0${i + 1}</p>
          <h3>${esc(p.name)}</h3>
          <p class="lab-disc-tag">${esc(p.tag)}</p>
          <p class="lab-disc-purpose"><b>형상</b>${esc(p.shape)}</p>
        </div></article>`).join("");
    box.querySelectorAll(".lab-disc-img img").forEach((img) => {
      const fail = () => { const w = img.parentElement; w.innerHTML = placeholder(PATTERNS[+w.dataset.i]); };
      img.addEventListener("error", fail);
      if (img.complete && img.naturalWidth === 0) fail();
    });
    const rows = [["형상", "shape"], ["가공 방식", "process"], ["설계 목적", "purpose"]];
    $("patternTable").innerHTML = `<caption>패턴별 형상·가공 방식·설계 목적 (성능 수치 없음)</caption><thead><tr><th scope="col">구분</th>${PATTERNS.map((p) => `<th scope="col">${esc(p.name)}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows.map(([l, k]) => `<tr><th scope="row">${l}</th>${PATTERNS.map((p) => `<td>${esc(p[k])}</td>`).join("")}</tr>`).join("")}</tbody>`;
  }

  // ---------- 03 선행연구 ----------
  function renderPapers() {
    $("paperList").innerHTML = PAPERS.map((p) => {
      const n = MEAS.filter((m) => m.paperId === p.id).length;
      const t = p.test || {};
      return `<article class="lab-paper">
        <div class="lab-paper-top"><span class="lab-paper-id">외부 문헌 ${esc(p.id)}</span>${badge(p.status)}</div>
        <h3>${esc(p.titleKo)}</h3>
        <p class="lab-paper-en">${esc(p.titleEn)}</p>
        <p class="lab-paper-by">${esc(p.authors)}<br /><span>${esc(p.affiliation)}</span></p>
        <p class="lab-paper-src">${esc(p.journal)}${p.volume ? ` ${esc(p.volume)}(${esc(p.issue)})` : ""}${p.pages ? `, ${esc(p.pages)}` : ""} · ${esc(p.year)}</p>
        <p class="lab-paper-links"><a href="${esc(p.url)}" target="_blank" rel="noopener">DOI ${esc(p.doi)} ↗</a>${p.fulltext ? ` <a href="${esc(p.fulltext.url)}" target="_blank" rel="noopener">${esc(p.fulltext.access)} ↗</a>` : ""}</p>
        ${p.patternsTested ? `<p class="lab-paper-pat"><b>논문의 시험 시편</b> ${p.patternsTested.map(esc).join(" · ")}</p>` : ""}
        ${t.equipment ? `<details><summary>시험 장비·규격</summary><dl><dt>장비</dt><dd>${esc(t.equipment)}</dd><dt>규격</dt><dd>${esc(t.standard)}</dd><dt>시편</dt><dd>${esc(t.specimen)}</dd><dt>차량 제원</dt><dd>${esc(t.vehicle)}</dd></dl></details>` : ""}
        ${p.abstractSummary ? `<p class="lab-paper-abs">${esc(p.abstractSummary)}</p>` : ""}
        <p class="lab-paper-state">${p.status === "LITERATURE_VERIFIED" && n ? `원문 수치 ${n}건 등록 · 확인일 ${esc(p.checkedAt)}` : `<b>원문 데이터 확인 필요</b> — 등록된 수치 없음`}</p>
        ${p.note ? `<p class="lab-paper-note">${esc(p.note)}</p>` : ""}
      </article>`;
    }).join("") || `<p class="lab-empty">등록된 문헌이 없습니다.</p>`;
  }

  function metaHtml(m) {
    const p = paperOf(m.paperId);
    const rows = [
      ["출처 구분", "<b>외부 연구기관 논문</b> — 카리브무역 제품 시험 아님"],
      ["논문", `${esc(p.titleKo)} <span class="lab-muted">(${esc(p.titleEn)})</span>`],
      ["저자·기관", `${esc(p.authors)} · ${esc(p.affiliation)}`],
      ["발행", `${esc(p.journal)} · ${esc(p.year)}`],
      ["DOI", `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.doi)}</a>`],
      ["원문 위치", esc(m.location)],
      ["시험 조건", esc(m.conditions)],
      ["측정 단위", esc(m.unit)],
      ["추출 방법", esc(m.extraction)],
      ["오차 정보", esc(m.error)],
    ];
    if (m.note) rows.push(["비고", esc(m.note)]);
    return rows.map(([k, v]) => `<dt>${k}</dt><dd>${v}</dd>`).join("");
  }

  let litIdx = 0, drawLit = null;
  function renderLit() {
    if (!MEAS.length) {
      $("litPanel").innerHTML = `<div class="lab-empty"><b>원문 데이터 확인 필요</b><span>논문 원문에서 확인한 측정값이 아직 등록되지 않았습니다.</span></div>`;
      return;
    }
    const sel = $("litSelect");
    sel.innerHTML = MEAS.map((m, i) => `<option value="${i}">외부 문헌 ${esc(m.paperId)} · ${esc(m.metric)}</option>`).join("");
    sel.onchange = () => { litIdx = +sel.value; update(); };
    const spec = () => {
      const m = MEAS[litIdx];
      return { groups: m.groups, series: litSeries(m), values: m.values, unit: unitShort(m.unit), decimals: m.decimals,
        flag: `외부 논문 ${m.paperId} 결과 · 카리브무역 제품 아님`, title: `${m.metric} (외부 논문 ${m.paperId})`, tipNote: `외부 논문 ${m.paperId} · ${m.location}` };
    };
    function update() {
      const m = MEAS[litIdx];
      $("litLegend").innerHTML = m.groups.length > 1 ? legendKeys(litSeries(m)) : "";
      $("litMeta").innerHTML = metaHtml(m);
      const s = litSeries(m), multi = m.groups.length > 1;
      $("litTable").innerHTML = `<caption>${badge("LITERATURE_VERIFIED")} 외부 논문 ${esc(m.paperId)} · ${esc(m.location)} · 카리브무역 제품 시험 아님</caption>` +
        `<thead><tr><th scope="col">${multi ? "구분" : "항목"}</th>${s.map((x) => `<th scope="col"><span class="lab-key"><i style="background:${x.color}"></i>${esc(x.label)}</span></th>`).join("")}</tr></thead>` +
        `<tbody>${m.groups.map((g, gi) => `<tr><th scope="row">${esc(g)}${unitShort(m.unit) ? ` <small>(${esc(unitShort(m.unit))})</small>` : ""}</th>${s.map((x, si) => `<td>${fmt(m.values[gi][si], m.decimals)}</td>`).join("")}</tr>`).join("")}</tbody>`;
      drawLit ? drawLit() : (drawLit = LabChart.mount($("litChart"), spec));
    }
    update();
  }

  // ---------- AI 질문 ----------
  function renderAsk() {
    const QA = window.ResearchQA; if (!QA) return;
    const box = $("askChips"), out = $("askAnswer");
    box.innerHTML = QA.QUESTIONS.map((q) => `<button type="button" data-q="${q.id}">${esc(q.q)}</button>`).join("");
    box.onclick = (e) => {
      const b = e.target.closest("[data-q]"); if (!b) return;
      box.querySelectorAll("button").forEach((x) => x.classList.toggle("on", x === b));
      const a = QA.answer(b.dataset.q);
      const link = (v, l) => v === "#consult" ? `<a class="btn btn-primary" href="consult.html?ask=${b.dataset.q}">${esc(l)}</a>` : v === "#inquiry" ? `<a class="btn btn-ghost" href="index.html#inquiry">${esc(l)}</a>` : v === "#tech" ? `<a class="btn btn-ghost" href="technology.html#chaos-types">${esc(l)}</a>` : "";
      out.innerHTML = `<p class="lab-q">${esc(b.textContent)}</p><div class="lab-a">${a.html.replace(/\n/g, "<br />")}</div>
        <div class="lab-a-actions">${a.actions.map(([l, v]) => link(v, l)).join("")}<a class="btn btn-ghost" href="consult.html?ask=${b.dataset.q}">가공 상담 AI에서 이어서 묻기</a></div>`;
      out.hidden = false;
    };
  }

  renderPatterns();
  renderPapers();
  renderLit();
  renderAsk();
})();
