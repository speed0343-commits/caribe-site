# 카리브무역 웹사이트

아티팩트 디자인을 그대로 옮긴 정적 웹사이트입니다. 외부 패키지 없이 Node.js만 있으면 실행됩니다.

## 실행

Node.js 18 이상이 필요합니다.

```bash
npm start
```

브라우저에서 http://localhost:3000 을 엽니다. 포트를 바꾸려면:

```bash
PORT=8080 npm start
```

Node가 없으면 Python으로도 열 수 있습니다:

```bash
python3 -m http.server 3000
```

> `file://`로 index.html을 직접 열면 로그인(비밀번호 암호화)이 동작하지 않습니다. 반드시 서버로 여세요.

## 구조

| 경로 | 내용 |
| --- | --- |
| `index.html` | 메인 (부품 검색, 등록 디스크, 카오스 가공, AI 상담, 문의) |
| `products.html` | 전체 상품 |
| `technology.html` | 카오스 가공 소개 |
| `consult.html` | 가공 상담 |
| `about.html` | 회사 소개 |
| `login.html`, `signup.html`, `mypage.html` | 회원 |
| `checkout.html` | 주문 |
| `admin.html` | 관리자 |
| `styles.css`, `cb.css` | 스타일 |
| `catalog-data.js`, `data.js`, `data/` | 상품·차종 데이터 |
| `assets/`, `images/` | 이미지 |

## AI 상담 (Google Gemini)

상담창은 차종·품번·차대번호 검색과 자주 묻는 질문을 먼저 브라우저에서 처리하고, 거기서 답하지 못한 질문만 `api/chat.js`(서버 함수)를 거쳐 Gemini에 보냅니다.

- API 키: Vercel 프로젝트의 환경 변수 `GEMINI_API_KEY` (코드나 저장소에 넣지 않음)
- 모델 변경: 환경 변수 `GEMINI_MODEL` (기본값 `gemini-flash-lite-latest`)
- 상담 기준 문서(지식베이스): `docs/ai-knowledge.md` — 이 파일을 고치고 올리면 AI 답변 기준이 바뀝니다
- 사이트 공식 정보(연락처·가격·결제·배송): `api/chat.js`의 `SITE_FACTS` — 지식베이스와 다르면 이쪽이 우선
- 키가 없거나 할당량을 넘으면 기존 안내 문구로 답합니다.
- 차대번호, 전화번호, 이메일은 Gemini로 보내기 전에 가립니다.
- 가공 상담 페이지(`consult.js`)도 같은 `/api/chat`을 씁니다(`mode: "consult"`). 단계 진행·차량 확인·가공비 계산은 등록 데이터로 하고, 중간에 나온 질문만 Gemini가 답합니다. 이때 진행 상황 요약(차대번호·연락처 제외)을 함께 보내고, 가공 상담용 지시는 `api/chat.js`의 `CONSULT_PROMPT`에 있습니다.

로컬에서 AI까지 시험하려면 (PowerShell):

```bash
$env:GEMINI_API_KEY = Read-Host "Gemini 키"; npm start
```

## 현재 상태 (시연용)

회원, 장바구니, 주문, 문의, 상담 기록은 모두 브라우저 localStorage에 저장됩니다. 실제 운영 전에 바꿔야 할 부분은 코드에 `실제 운영:` 주석으로 표시되어 있습니다.

- `auth.js` → `POST /api/auth/signup`, `/api/auth/login` + 서버 세션
- `checkout.js`, `core.js` → `POST /api/orders` + PG 결제
- `app.js` → `POST /api/inquiries`
- `admin.js` → `GET/PATCH /api/requests` + 관리자 로그인
- `data/demo-accounts.js` → 시연용 계정. 운영 전에 삭제
