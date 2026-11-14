/*
 * 카리브무역 디스크 패턴 4종 — 형상·가공 방식·설계 목적 (성능 수치 없음)
 * ------------------------------------------------------------
 * 카리브무역은 아직 자체 성능시험을 실시하지 않았습니다.
 * 이 파일에는 제동력·마찰계수·온도·순위 등 성능 수치나 우열 표현을 넣지 않습니다.
 * 성능 관련 내용은 시험성적서를 확보한 뒤 별도 검토를 거쳐 추가합니다.
 *
 * 이미지: images/brake-discs/ 의 같은 이름 파일을 교체하면 화면이 바뀝니다.
 */
window.DISC_PATTERNS = [
  {
    id: "plain", name: "패턴 없음", tag: "가공 전", image: "images/brake-discs/plain-disc.png",
    shape: "홈이나 구멍이 없는 평평한 마찰면",
    process: "마찰면 추가 가공 없음 (일반 디스크 상태)",
    purpose: "가공 패턴과 비교하기 위한 기준 형상",
  },
  {
    id: "slotted", name: "사선 타입", tag: "직선 슬롯 가공", image: "images/brake-discs/slotted-disc.png",
    shape: "마찰면에 비스듬한 직선 홈(슬롯)을 일정 간격으로 배치",
    process: "마찰면 홈 가공 — 디스크 규격에 맞춰 홈의 폭·깊이·개수를 정해 가공",
    purpose: "일반적인 슬롯 디스크 형태를 카리브무역 공정으로 구현 · 단순한 외관",
  },
  {
    id: "chaosA", name: "카오스 A타입", tag: "불규칙 곡선형 패턴", image: "images/brake-discs/chaos-a-disc.png",
    shape: "길이와 곡률이 서로 다른 곡선 홈을 마찰면 전체에 불규칙하게 배치",
    process: "마찰면 홈 가공 — 곡선 경로를 따라 홈을 가공",
    purpose: "자연스러운 곡선 외관 · 홈을 불규칙하게 배치한 카오스 패턴",
  },
  {
    id: "chaosB", name: "카오스 B타입", tag: "화살표형 패턴", image: "images/brake-discs/chaos-b-disc.png",
    shape: "화살표(V자) 형태의 홈을 원주 방향으로 반복 배치 — 회전 방향이 있는 형상",
    process: "마찰면 홈 가공 — 꺾인(V자) 경로를 따라 홈을 가공",
    purpose: "방향성이 뚜렷한 외관 · 회전 방향을 살린 화살표형 카오스 패턴",
  },
];
