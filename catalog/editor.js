// ============================================================
// 카탈로그 미리보기 수정 (화면에서 글자를 직접 고치고 PDF 만들기)
// ------------------------------------------------------------
// - 수정 모드에서 글자가 있는 칸은 모두 눌러서 고칠 수 있습니다.
// - 고친 내용은 칸마다 '열쇠'(쪽 이름 + 순서, 상품 카드는 품번 + 순서)로 저장합니다.
//     · 카탈로그 서버(node catalog/server.js)로 열면 catalog/edits.json 파일에 저장 → PDF 만들기·커밋에 그대로 반영
//     · 그냥 열었으면 이 브라우저(localStorage)에만 저장 → '수정 내용 파일 받기'로 edits.json 을 받아 catalog 폴더에 넣으면 됨
// - 상품·가격 데이터(catalog-data.js)가 바뀌어 칸 내용이 달라지면, 그 칸의 수정은 적용하지 않고 원래 내용을 보여줍니다.
// ============================================================
window.CatalogEditor = (function () {
  "use strict";
  const LS = "caribe_catalog_edits";
  const API = "api/";            // catalog/server.js 의 주소 (catalog/api/edits, catalog/api/pdf)
  let edits = { savedAt: "", text: {} }; // text[key] = { html: 고친 내용, orig: 원래 글자(바뀐 데이터 감지용) }
  let server = false;              // 카탈로그 서버로 열었는지
  const $ = (id) => document.getElementById(id);
  const INLINE = /^(B|I|EM|SMALL|STRONG|SUP|SUB|BR|SPAN|CODE|A)$/;

  // ---------------- 수정할 수 있는 칸 찾기 ----------------
  // 글자를 직접 가진 요소 중 가장 바깥 것. 도면(svg)·사진은 제외.
  function hasOwnText(el) {
    for (const n of el.childNodes) if (n.nodeType === 3 && n.textContent.trim()) return true;
    return false;
  }
  function pageKeys() {
    const seen = {};
    return [...document.querySelectorAll("#book .page")].map((pg) => {
      let name = pg.classList.contains("cover") ? "cover" : pg.classList.contains("back") ? "back"
        : (pg.querySelector(".pg-head .sec")?.firstChild?.textContent || "page").trim();
      seen[name] = (seen[name] || 0) + 1;
      return [pg, seen[name] > 1 || /PRODUCTS|INDEX|NOTES/.test(name) ? `${name}-${seen[name]}` : name];
    });
  }
  function assignKeys() {
    pageKeys().forEach(([pg, pk]) => {
      const count = {};
      const walk = (el, scope) => {
        if (el.closest("svg")) return;
        if (el.classList && el.classList.contains("card")) scope = "card-" + (el.querySelector(".pn")?.textContent.trim() || el.dataset.no);
        if (hasOwnText(el) && el !== pg) {
          count[scope] = (count[scope] || 0) + 1;
          el.dataset.ek = `${scope}:${count[scope]}`;
          el.dataset.orig = el.innerHTML;
          return; // 안쪽 굵은 글씨 등은 이 칸에 포함
        }
        [...el.children].forEach((c) => walk(c, scope));
      };
      walk(pg, pk);
    });
  }
  const textOf = (html) => { const d = document.createElement("div"); d.innerHTML = html; return d.textContent.replace(/\s+/g, " ").trim(); };

  // ---------------- 불러오기 · 적용 ----------------
  async function loadFile() {
    try {
      const r = await fetch("edits.json?t=" + Date.now(), { cache: "no-store" });
      if (r.ok) return await r.json();
    } catch (e) {}
    return null;
  }
  function loadLocal() { try { return JSON.parse(localStorage.getItem(LS)); } catch (e) { return null; } }
  function apply() {
    let n = 0, stale = 0;
    document.querySelectorAll("[data-ek]").forEach((el) => {
      const e = edits.text[el.dataset.ek];
      el.classList.remove("edited");
      if (!e) { if (el.innerHTML !== el.dataset.orig) el.innerHTML = el.dataset.orig; return; }
      if (e.orig && textOf(e.orig) !== textOf(el.dataset.orig)) { stale++; return; } // 데이터가 바뀐 칸
      el.innerHTML = e.html; el.classList.add("edited"); n++;
    });
    return { n, stale };
  }

  // ---------------- 저장 ----------------
  let timer = null;
  function status(t) { const s = $("edSave"); if (s) s.textContent = t; }
  function count() { return Object.keys(edits.text).length; }
  function save(now) {
    clearTimeout(timer);
    const run = async () => {
      edits.savedAt = new Date().toISOString();
      try { localStorage.setItem(LS, JSON.stringify(edits)); } catch (e) {}
      if (server) {
        try {
          const r = await fetch(API + "edits", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edits) });
          if (!r.ok) throw new Error(r.status);
          status(`저장됨 (edits.json) · 수정 ${count()}곳`);
        } catch (e) { status("파일 저장 실패 — 이 브라우저에만 저장됨"); }
      } else status(`이 브라우저에 저장됨 · 수정 ${count()}곳`);
    };
    status("저장 중…");
    return now ? run() : new Promise((res) => { timer = setTimeout(() => run().then(res), 600); });
  }

  // ---------------- 넘침 표시 ----------------
  function checkOverflow() {
    let bad = 0;
    document.querySelectorAll("#book .page").forEach((pg) => {
      pg.querySelector(".ed-flag")?.remove();
      const over = [...pg.querySelectorAll(".pg-body, .card, .ix-col, .cover-in, .back-in")].some((b) => {
        if (b.classList.contains("pg-body")) {
          const r = b.getBoundingClientRect();
          return [...b.querySelectorAll(":scope > *")].some((k) => k.getBoundingClientRect().bottom > r.bottom + 1);
        }
        return b.scrollHeight > b.clientHeight + 1;
      });
      pg.classList.toggle("overflow", over);
      if (over) { bad++; pg.insertAdjacentHTML("afterbegin", `<span class="ed-flag">이 쪽 내용이 넘칩니다 — 글을 줄여 주세요</span>`); }
    });
    return bad;
  }

  // ---------------- 수정 모드 ----------------
  let current = null;
  function setEditing(on) {
    document.body.classList.toggle("editing", on);
    document.querySelectorAll("[data-ek]").forEach((el) => { if (on) el.setAttribute("contenteditable", "true"); else el.removeAttribute("contenteditable"); });
    $("edBar").hidden = !on;
    $("edToggle").textContent = on ? "✓ 수정 마치기" : "✎ 수정하기";
    $("edToggle").classList.toggle("on", on);
  }
  function onInput(el) {
    const key = el.dataset.ek;
    if (el.innerHTML === el.dataset.orig) delete edits.text[key];
    else edits.text[key] = { html: el.innerHTML, orig: el.dataset.orig };
    el.classList.toggle("edited", !!edits.text[key]);
    checkOverflow();
    save();
  }
  function revert(el) { el.innerHTML = el.dataset.orig; onInput(el); }
  function toast(t, ms) {
    const d = document.createElement("div"); d.className = "ed-toast"; d.textContent = t; document.body.appendChild(d);
    setTimeout(() => d.remove(), ms || 3500);
  }

  function bind() {
    const book = $("book");
    book.addEventListener("input", (e) => { const el = e.target.closest("[data-ek]"); if (el) onInput(el); });
    book.addEventListener("focusin", (e) => { const el = e.target.closest("[data-ek]"); if (el) { current = el; $("edRevertOne").disabled = false; } });
    // 붙여넣기는 글자만, Enter 는 줄바꿈
    book.addEventListener("paste", (e) => {
      if (!e.target.closest("[data-ek]")) return;
      e.preventDefault();
      document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain"));
    });
    book.addEventListener("keydown", (e) => {
      if (e.key === "Enter" && e.target.closest("[data-ek]")) { e.preventDefault(); document.execCommand("insertLineBreak"); }
    });
    // 수정 모드에서 링크 눌러도 이동하지 않게
    book.addEventListener("click", (e) => { if (document.body.classList.contains("editing") && e.target.closest("a")) e.preventDefault(); });

    $("edToggle").addEventListener("click", () => setEditing(!document.body.classList.contains("editing")));
    $("edRevertOne").addEventListener("click", () => { if (current) revert(current); });
    $("edRevertAll").addEventListener("click", () => {
      if (!count() || !confirm(`수정한 ${count()}곳을 모두 원래대로 돌릴까요?`)) return;
      edits.text = {}; apply(); checkOverflow(); save(true);
    });
    $("edExport").addEventListener("click", () => {
      const blob = new Blob([JSON.stringify(edits, null, 2)], { type: "application/json" });
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "edits.json"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
      if (!server) toast("받은 edits.json 을 catalog 폴더에 넣으면 PDF 만들 때와 다른 컴퓨터에서도 같은 수정 내용이 보입니다.", 6000);
    });
    $("edImport").addEventListener("change", async (e) => {
      const f = e.target.files[0]; if (!f) return;
      try {
        const data = JSON.parse(await f.text());
        if (!data || typeof data.text !== "object") throw new Error();
        edits = { savedAt: "", text: data.text };
        const r = apply(); checkOverflow(); await save(true);
        toast(`수정 ${r.n}곳을 불러왔습니다.${r.stale ? ` (${r.stale}곳은 상품 데이터가 바뀌어 적용하지 않음)` : ""}`);
      } catch (err) { toast("edits.json 형식이 아닙니다."); }
      e.target.value = "";
    });
    $("edPdf").addEventListener("click", makePdf);
  }

  // ---------------- PDF 만들기 ----------------
  async function makePdf() {
    if (document.body.classList.contains("editing")) setEditing(false);
    if (checkOverflow() && !confirm("넘치는 쪽이 있습니다 (빨간 테두리). 넘친 글자는 PDF에서 잘립니다. 그래도 만들까요?")) return;
    if (!server) { window.print(); return; } // 브라우저 인쇄 창 → 'PDF로 저장' (여백 없음, 배경 그래픽 켬)
    const btn = $("edPdf"); btn.disabled = true; btn.textContent = "PDF 만드는 중…";
    try {
      await save(true);
      const r = await fetch(API + "pdf", { method: "POST" });
      if (!r.ok) throw new Error(await r.text());
      const blob = await r.blob();
      const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "caribe-catalog.pdf"; a.click();
      setTimeout(() => URL.revokeObjectURL(a.href), 2000);
      toast("PDF를 만들었습니다. catalog/caribe-catalog.pdf 에도 저장했습니다.");
    } catch (e) {
      toast("서버에서 PDF를 만들지 못해 인쇄 창을 엽니다. 'PDF로 저장'을 고르세요. (" + String(e.message || e).slice(0, 80) + ")", 6000);
      window.print();
    } finally { btn.disabled = false; btn.textContent = "PDF 만들기"; }
  }

  // ---------------- 시작 ----------------
  async function init() {
    assignKeys();
    try { server = (await fetch(API + "ping", { cache: "no-store" })).ok; } catch (e) { server = false; }
    const file = await loadFile(), local = loadLocal();
    // 서버로 열면 파일이 기준, 아니면 더 최근에 저장한 쪽
    const pick = server ? (file || local) : [file, local].filter(Boolean).sort((a, b) => String(b.savedAt).localeCompare(String(a.savedAt)))[0];
    if (pick && pick.text) edits = { savedAt: pick.savedAt || "", text: pick.text };
    const r = apply();
    bind();
    status(count() ? `수정 ${count()}곳 적용${server ? " (edits.json)" : ""}` : server ? "카탈로그 서버 연결됨" : "");
    if (r.stale) toast(`상품 데이터가 바뀐 ${r.stale}곳은 예전 수정을 적용하지 않았습니다.`, 6000);
    if (new URLSearchParams(location.search).has("print")) document.querySelector(".cat-bar").style.display = "none";
  }
  return { init, checkOverflow };
})();
