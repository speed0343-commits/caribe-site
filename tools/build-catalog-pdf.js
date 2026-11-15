// 카탈로그 PDF 만들기: catalog.html 을 A4 PDF(caribe-catalog.pdf)로 저장
// 사용: npm start 로 사이트를 띄운 상태에서  node tools/build-catalog-pdf.js
//      (다른 주소면 CATALOG_URL=http://localhost:8080/catalog.html node tools/build-catalog-pdf.js)
// 필요: Playwright (npm i -D playwright 후 npx playwright install chromium)
// Chrome 에서 catalog.html 을 열고 '인쇄 → PDF로 저장' (여백 없음, 배경 그래픽 켬) 해도 같은 결과입니다.
const path = require("path");
const { chromium } = require("playwright");

(async () => {
  const url = process.env.CATALOG_URL || "http://localhost:3000/catalog.html";
  const out = path.join(__dirname, "..", "caribe-catalog.pdf");
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(url, { waitUntil: "networkidle" });
  await page.waitForSelector("body[data-ready='1']", { timeout: 30000 });
  await page.pdf({ path: out, format: "A4", printBackground: true, preferCSSPageSize: true, margin: { top: 0, right: 0, bottom: 0, left: 0 } });
  await browser.close();
  console.log("저장:", out);
})().catch((e) => { console.error(e); process.exit(1); });
