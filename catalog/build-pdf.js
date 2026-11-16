// 카탈로그 PDF 만들기: 카탈로그 화면(catalog/edits.json 의 수정 내용 포함)을 A4 PDF로 저장 → catalog/caribe-catalog.pdf
// 사용 (저장소 맨 위 폴더에서):  node catalog/build-pdf.js
//   - 카탈로그 서버를 잠시 띄워 PDF를 만든 뒤 끕니다. 이미 떠 있는 주소를 쓰려면 CATALOG_URL=http://localhost:4000/catalog/
//   - 보통은 node catalog/server.js 로 미리보기를 열고 화면의 'PDF 만들기' 버튼을 쓰면 됩니다.
// 필요: Playwright (npm i -D playwright 후 npx playwright install chromium)
//   Playwright 가 없으면 미리보기 화면의 'PDF 만들기'가 브라우저 인쇄 창을 엽니다 → 'PDF로 저장', 여백 없음, 배경 그래픽 켬.
const fs = require("fs");
const path = require("path");
const OUT = path.join(__dirname, "caribe-catalog.pdf");

async function makePdf(url, out = OUT) {
  const { chromium } = require("playwright");
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    await page.goto(url + (url.includes("?") ? "&" : "?") + "print", { waitUntil: "load", timeout: 60000 });
    await page.waitForSelector("body[data-ready='1']", { timeout: 60000 });
    // 사진이 다 들어올 때까지
    await page.evaluate(() => Promise.all([...document.images].map((im) => im.complete ? 0 : new Promise((r) => { im.onload = im.onerror = r; }))));
    // 넘치는 쪽 경고 (넘친 글자는 PDF에서 잘림)
    const over = await page.$$eval(".page.overflow", (x) => x.map((e) => e.querySelector(".pg-foot b")?.textContent || (e.classList.contains("cover") ? "표지" : "뒤표지")));
    if (over.length) console.warn("주의: 내용이 넘치는 쪽 →", over.join(", "), "(글을 줄이거나 간격을 조정하세요)");
    const buf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
    fs.writeFileSync(out, buf);
    return buf;
  } finally { await browser.close(); }
}
module.exports = { makePdf, OUT };

if (require.main === module) {
  (async () => {
    let url = process.env.CATALOG_URL, srv = null;
    if (!url) {
      srv = await require("./server.js").start(0);
      url = `http://127.0.0.1:${srv.address().port}/catalog/`;
    }
    await makePdf(url);
    console.log("저장:", OUT);
    if (srv) srv.close();
  })().catch((e) => { console.error(e.message || e); process.exit(1); });
}
