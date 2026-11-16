# 카리브무역 카탈로그 (홈페이지와 별개)

A4 인쇄·PDF용 브레이크 디스크 카탈로그입니다. 홈페이지 메뉴에 연결하지 않고, Vercel 배포에서도 빠집니다(`.vercelignore`).
상품·적용 차종·가격과 연구 자료는 저장소의 데이터 파일을 읽어 자동으로 쪽을 구성합니다.

| 파일 | 내용 |
| --- | --- |
| `index.html`, `catalog.css`, `catalog.js` | 카탈로그 화면 (표지·회사 소개·주문 안내·카오스 가공·연구 자료·상품 카드·차종별 색인·연락처) |
| `caribe-catalog.pdf` | 완성 PDF |
| `build-pdf.js` | PDF 다시 만들기 |
| `photos/` | 제품 사진. `base-disc.png` 는 모든 카드에 쓰는 대표 사진 |

읽어 오는 데이터: `../catalog-data.js`(상품·차종·가격), `../data/research-papers.js`, `../data/literature-measurements.js`, `../data/test-plan.js`(연구 자료)

## 보기 · PDF 만들기

저장소 맨 위 폴더에서:

```bash
npm start
```

브라우저에서 http://localhost:3000/catalog/ 을 엽니다. PDF는 서버를 띄운 채로 (Playwright 필요):

```bash
node catalog/build-pdf.js
```

## 품번별 실제 사진 넣기

1. 흰 배경·정면 사진을 `photos/` 에 넣습니다 (예: `0004231812.jpg`).
2. `photos/photos.js` 에 `"0004231812": "0004231812.jpg",` 한 줄을 추가합니다.
3. 그 품번 카드의 '대표 사진' 표시가 사라지고 실제 사진이 들어갑니다.
