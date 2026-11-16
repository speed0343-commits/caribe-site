# 카리브무역 카탈로그 (홈페이지와 별개)

A4 인쇄·PDF용 브레이크 디스크 카탈로그입니다. 홈페이지 메뉴에 연결하지 않고, Vercel 배포에서도 빠집니다(`.vercelignore`).
상품·적용 차종·가격과 연구 자료는 저장소의 데이터 파일을 읽어 자동으로 쪽을 구성합니다.

| 파일 | 내용 |
| --- | --- |
| `index.html`, `catalog.css`, `catalog.js` | 카탈로그 화면 (표지·회사 소개·주문 안내·카오스 가공·연구 자료·상품 카드·차종별 색인·연락처) |
| `caribe-catalog.pdf` | 완성 PDF |
| `server.js` | 미리보기·수정 서버 (http://localhost:4000) |
| `editor.js` | 화면에서 글자 고치기, 수정 내용 저장 |
| `edits.json` | 고친 내용 (수정하면 생김) |
| `build-pdf.js` | PDF 만들기 |
| `photos/` | 제품 사진. `base-disc.png` 는 모든 카드에 쓰는 대표 사진 |

읽어 오는 데이터: `../catalog-data.js`(상품·차종·가격), `../data/research-papers.js`, `../data/literature-measurements.js`, `../data/test-plan.js`(연구 자료)

## 미리보며 고치고 PDF 만들기

저장소 맨 위 폴더에서 카탈로그 서버를 켭니다 (홈페이지 서버와 별개, 이 컴퓨터에서만 열림):

```bash
node catalog/server.js
```

1. 브라우저에서 http://localhost:4000 을 엽니다.
2. **✎ 수정하기** → 고칠 글자를 눌러 바로 고칩니다 (Enter = 줄바꿈). 고친 칸은 노란색으로 표시됩니다.
3. 고친 내용은 자동으로 `catalog/edits.json` 에 저장됩니다. 글이 길어져 쪽을 넘치면 그 쪽에 빨간 테두리가 생깁니다.
4. **이 칸 원래대로 / 모두 원래대로**로 되돌릴 수 있습니다.
5. **PDF 만들기** → 고친 내용이 들어간 PDF가 내려받아지고 `catalog/caribe-catalog.pdf` 에도 저장됩니다.
   Playwright 가 없으면 인쇄 창이 열리니 'PDF로 저장'(여백 없음, 배경 그래픽 켬)을 고르세요.

- `edits.json` 을 커밋하면 다른 컴퓨터에서도 같은 수정 내용이 보입니다.
- 서버 없이 파일만 열었을 때는 수정 내용이 그 브라우저에만 저장됩니다. **수정 내용 파일 받기**로 받은 `edits.json` 을 catalog 폴더에 넣으세요.
- 상품 데이터(`catalog-data.js`)가 바뀌어 원래 글자가 달라진 칸은 예전 수정을 적용하지 않고 새 데이터를 보여줍니다.
- 명령으로 PDF만 만들기: `node catalog/build-pdf.js` (Playwright 필요: `npm i -D playwright` 후 `npx playwright install chromium`)

## 품번별 실제 사진 넣기

1. 흰 배경·정면 사진을 `photos/` 에 넣습니다 (예: `0004231812.jpg`).
2. `photos/photos.js` 에 `"0004231812": "0004231812.jpg",` 한 줄을 추가합니다.
3. 그 품번 카드의 '대표 사진' 표시가 사라지고 실제 사진이 들어갑니다.
