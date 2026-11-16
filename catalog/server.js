// 카탈로그 미리보기·수정 서버 (홈페이지 서버와 별개, 외부 패키지 없음)
// 실행 (저장소 맨 위 폴더에서):  node catalog/server.js   → http://localhost:4000
//   CATALOG_PORT=4100 node catalog/server.js  → 다른 포트
// - 저장소 파일을 읽기 전용으로 보여 주고, 카탈로그 수정 내용만 catalog/edits.json 에 저장합니다.
// - 이 컴퓨터(127.0.0.1)에서만 열립니다.
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const EDITS = path.join(__dirname, "edits.json");
const TYPES = {
  ".html": "text/html; charset=utf-8", ".css": "text/css; charset=utf-8", ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8", ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml", ".webp": "image/webp", ".pdf": "application/pdf", ".ico": "image/x-icon",
};
const send = (res, status, body, type) => { res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8", "Cache-Control": "no-store" }); res.end(body); };

function readBody(req, limit) {
  return new Promise((resolve, reject) => {
    let size = 0; const chunks = [];
    req.on("data", (c) => { size += c.length; if (size > limit) { reject(new Error("too large")); req.destroy(); } else chunks.push(c); });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

let pdfBusy = false;
async function handle(req, res) {
  const url = new URL(req.url, "http://x");
  let p = decodeURIComponent(url.pathname);

  // ---- 수정 내용 · PDF ----
  if (p === "/catalog/api/ping") return send(res, 200, "ok");
  if (p === "/catalog/api/edits" && req.method === "POST") {
    try {
      const data = JSON.parse(await readBody(req, 5 * 1024 * 1024));
      if (!data || typeof data.text !== "object" || Array.isArray(data.text)) return send(res, 400, "형식 오류");
      fs.writeFileSync(EDITS, JSON.stringify({ savedAt: data.savedAt || new Date().toISOString(), text: data.text }, null, 2) + "\n");
      return send(res, 200, "saved");
    } catch (e) { return send(res, 400, "저장 실패: " + e.message); }
  }
  if (p === "/catalog/api/pdf" && req.method === "POST") {
    if (pdfBusy) return send(res, 409, "이미 PDF를 만드는 중입니다");
    pdfBusy = true;
    try {
      let makePdf;
      try { ({ makePdf } = require("./build-pdf.js")); require.resolve("playwright"); }
      catch (e) { return send(res, 501, "Playwright 가 설치되어 있지 않습니다"); }
      const port = req.socket.localPort;
      const buf = await makePdf(`http://127.0.0.1:${port}/catalog/`);
      res.writeHead(200, { "Content-Type": "application/pdf", "Content-Disposition": 'attachment; filename="caribe-catalog.pdf"' });
      return res.end(buf);
    } catch (e) { return send(res, 500, "PDF 실패: " + e.message); }
    finally { pdfBusy = false; }
  }

  // ---- 파일 보기 (읽기 전용) ----
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method Not Allowed");
  if (p === "/") { res.writeHead(302, { Location: "/catalog/" }); return res.end(); }
  if (p.endsWith("/")) p += "index.html";
  const file = path.normalize(path.join(ROOT, p));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep).some((s) => s.startsWith(".")) || ["api", "lib", "node_modules"].includes(rel.split(path.sep)[0])) return send(res, 404, "Not Found");
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) return send(res, 404, "Not Found");
    res.writeHead(200, { "Content-Type": TYPES[path.extname(file).toLowerCase()] || "application/octet-stream", "Cache-Control": "no-cache" });
    if (req.method === "HEAD") return res.end();
    fs.createReadStream(file).pipe(res);
  });
}

function start(port) {
  return new Promise((resolve) => {
    const srv = http.createServer((req, res) => handle(req, res).catch((e) => send(res, 500, String(e.message || e))));
    srv.listen(port, "127.0.0.1", () => resolve(srv));
  });
}
module.exports = { start };

if (require.main === module) {
  const port = Number(process.env.CATALOG_PORT) || 4000;
  start(port).then(() => console.log(`카탈로그 미리보기 → http://localhost:${port}  ('✎ 수정하기'로 고치고 'PDF 만들기')`));
}
