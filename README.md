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
| `index.html` | 메인 (부품 검색, 판매 중 디스크, 카오스 가공, AI 상담, 문의) |
| `products.html` | 전체 상품 |
| `technology.html` | 카오스 가공 소개 |
| `consult.html` | 가공 상담 |
| `about.html` | 회사 소개 |
| `login.html`, `signup.html`, `mypage.html` | 회원 |
| `checkout.html` | 주문 |
| `order.html` | 주문·배송 조회 (비회원: 주문번호 + 휴대폰 번호) |
| `delivery.js` | 택배사 목록·배송조회 주소 (관리자·마이페이지·주문 조회 공용) |
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

## 서버 저장 · 관리자 · 알림

고객이 남긴 주문, 가공 의뢰, 문의, 상담사 채팅, 회원 가입 정보, AI가 답하지 못한 질문은 서버(Upstash Redis)에 저장되고 관리자 화면(`/admin.html`)에서 모아 봅니다.

| 파일 | 역할 |
| --- | --- |
| `api/submit.js` | 고객 기록 저장 (같은 id 재전송은 한 번만 저장), 새 주문·의뢰·문의 알림 / 관리자 등록 AI 답변 제공 |
| `api/track.js` | 고객의 주문·의뢰 진행 상황 조회, 주문 취소 요청 (주문할 때 브라우저가 만든 열쇠로만) |
| `api/live-chat.js` | 상담사 채팅 고객 쪽 (시작·메시지·답변 받기) |
| `api/admin.js` | 관리자 로그인과 목록·수정·AI 답변·알림 시험 |
| `lib/` | 저장소(`db.js`), 로그인(`auth.js`), 알림(`notify.js`), 공통(`http.js`) |
| `remote.js` | 고객 화면 → 서버 전송. 실패하면 보낼 목록(`carib_outbox`)에 두고 다음 방문 때 다시 보냄 |
| `admin-remote.js` | 관리자 로그인 화면, 서버 데이터를 `admin.js`에 연결, 채팅 4초·나머지 30초마다 새로 불러옴 |

**Vercel 환경 변수** (Settings → Environment Variables, 코드·저장소에 넣지 않음)

| 이름 | 필수 | 내용 |
| --- | --- | --- |
| `KV_REST_API_URL`, `KV_REST_API_TOKEN` | 필수 | Storage → Upstash for Redis 를 만들고 이 프로젝트에 연결하면 자동으로 들어옴 |
| `ADMIN_PASSWORD` | 필수 | 관리자 화면 비밀번호. 바꾸면 기존 로그인은 모두 풀림 |
| `RESEND_API_KEY` | 이메일 알림 | resend.com API 키. 받는 주소 `NOTIFY_EMAIL`(기본 caribetrading@naver.com), 보내는 주소 `NOTIFY_FROM`(도메인 인증 전에는 기본값 사용, Resend 가입 이메일로만 발송 가능) |
| `SOLAPI_API_KEY`, `SOLAPI_API_SECRET`, `SOLAPI_SENDER`, `NOTIFY_PHONE` | 문자 알림 (선택) | 솔라피 API 키·시크릿, 사전 등록한 발신번호, 알림 받을 휴대폰 |

환경 변수를 바꾼 뒤에는 Vercel에서 다시 배포해야 적용됩니다. 관리자 화면 위쪽에 저장소·알림 상태와 **알림 시험 보내기** 버튼이 있습니다.

로컬에서 시험하려면 위 변수를 넣고 `npm start` (api 폴더의 모든 함수가 `/api/파일이름`으로 동작).

## 남은 시연용 부분

주문·의뢰·문의·상담은 위처럼 서버에 저장되지만, 아래는 아직 브라우저 localStorage 기준입니다. 실제 운영 전에 바꿔야 할 부분은 코드에 `실제 운영:` 주석으로 표시되어 있습니다.

- `auth.js` 회원 로그인: 계정은 가입한 브라우저에만 있음 (가입 정보 사본만 서버의 관리자 '회원' 목록으로 감) → 서버 회원 계정·세션으로 교체 필요
- 장바구니·견적서: 고객 브라우저에만 저장 (견적서를 '담당자에게 보내기' 하면 문의로 서버에 감)
- `checkout.js` → PG 결제 연동 (지금은 무통장 입금)
- `data/demo-accounts.js` → 시연용 계정. 운영 전에 삭제
