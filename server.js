// 카리브무역 로컬 개발 서버 (의존성 없음)
// 실행: node server.js            → http://localhost:3000
//       PORT=8080 node server.js  → 다른 포트
const http = require("http");
const fs = require("fs");
const path = require("path");

const ROOT = __dirname;
const PORT = Number(process.env.PORT) || 3000;
const HOST = process.env.HOST || "0.0.0.0";

const TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".gif": "image/gif",
  ".svg": "image/svg+xml",
  ".webp": "image/webp",
  ".ico": "image/x-icon",
  ".woff": "font/woff",
  ".woff2": "font/woff2",
  ".txt": "text/plain; charset=utf-8",
};

// 서버 파일은 외부에 노출하지 않음
const BLOCKED = new Set(["server.js", "package.json", "package-lock.json", "README.md"]);

function send(res, status, body, type) {
  res.writeHead(status, { "Content-Type": type || "text/plain; charset=utf-8" });
  res.end(body);
}

// Vercel의 /api 함수를 로컬에서도 그대로 실행 (예: GEMINI_API_KEY=... npm start)
const chatApi = require("./api/chat.js");

const server = http.createServer((req, res) => {
  if (req.url.split("?")[0] === "/api/chat") return chatApi(req, res);
  if (req.method !== "GET" && req.method !== "HEAD") return send(res, 405, "Method Not Allowed");

  let pathname;
  try {
    pathname = decodeURIComponent(new URL(req.url, "http://x").pathname);
  } catch {
    return send(res, 400, "Bad Request");
  }
  if (pathname.endsWith("/")) pathname += "index.html";

  const file = path.normalize(path.join(ROOT, pathname));
  const rel = path.relative(ROOT, file);
  if (rel.startsWith("..") || path.isAbsolute(rel) || rel.split(path.sep).some((p) => p.startsWith(".")) || ["api", "docs"].includes(rel.split(path.sep)[0]) || BLOCKED.has(rel)) {
    return send(res, 404, "Not Found");
  }

  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) {
      // 확장자 없는 주소(/about) → about.html
      if (!path.extname(file)) {
        const html = file + ".html";
        if (fs.existsSync(html)) return stream(html, req, res);
      }
      return send(res, 404, "<h1>404</h1><p><a href=\"/\">홈으로</a></p>", TYPES[".html"]);
    }
    stream(file, req, res);
  });
});

function stream(file, req, res) {
  const type = TYPES[path.extname(file).toLowerCase()] || "application/octet-stream";
  res.writeHead(200, {
    "Content-Type": type,
    // 개발 중에는 수정 사항이 바로 보이도록 캐시하지 않음
    "Cache-Control": "no-cache",
  });
  if (req.method === "HEAD") return res.end();
  fs.createReadStream(file).pipe(res);
}

server.listen(PORT, HOST, () => {
  console.log(`카리브무역 사이트 실행 중 → http://localhost:${PORT}`);
});
