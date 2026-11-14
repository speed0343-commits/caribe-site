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

## 현재 상태 (시연용)

회원, 장바구니, 주문, 문의, 상담 기록은 모두 브라우저 localStorage에 저장됩니다. 실제 운영 전에 바꿔야 할 부분은 코드에 `실제 운영:` 주석으로 표시되어 있습니다.

- `auth.js` → `POST /api/auth/signup`, `/api/auth/login` + 서버 세션
- `checkout.js`, `core.js` → `POST /api/orders` + PG 결제
- `app.js` → `POST /api/inquiries`
- `consult.js` → `/api/consult` (AI 상담)
- `admin.js` → `GET/PATCH /api/requests` + 관리자 로그인
- `data/demo-accounts.js` → 시연용 계정. 운영 전에 삭제
