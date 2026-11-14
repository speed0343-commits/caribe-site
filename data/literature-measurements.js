/*
 * 외부 논문 측정값 — 기술연구 및 선행연구 (카리브무역 제품 시험 결과 아님)
 * ------------------------------------------------------------
 * 규칙
 *  - 논문 원문의 표·본문에 "숫자로 인쇄된 값"만 옮겨 적습니다. 그래프를 눈대중으로 읽은 값(디지타이징)은 넣지 않습니다.
 *  - 각 항목에 논문 id, 표·그림 번호와 쪽, 시험 조건, 단위, 추출 방법, 오차 정보를 적습니다.
 *  - status 는 LITERATURE_VERIFIED 만 화면에 그래프로 표시됩니다. 확인 중이면 "PENDING" 으로 두세요.
 *  - 이 값들은 각 논문의 시험편(관통/홈/복합 패턴)에 대한 결과이며 카리브무역 제품의 성능이 아닙니다.
 *
 * 구조
 *  series : 막대 색·이름 (패턴)
 *  groups : 가로축 묶음. 묶음이 1개면 막대마다 패턴 이름이 붙습니다.
 *  values : groups 순서대로 [series 순서의 값]
 *
 * 확인일: 2026-11-12 (원문 표 이미지와 추출 텍스트를 대조)
 */
(function () {
  const A_SERIES = [
    { id: "hole", label: "관통 구멍" },
    { id: "slot", label: "홈(슬롯)" },
    { id: "combined", label: "관통+홈 복합" },
  ];
  const C_SERIES = [
    { id: "combined", label: "복합" },
    { id: "hole", label: "관통 구멍" },
    { id: "slot", label: "홈(슬롯)" },
  ];
  const A_RAMP = "Warm ramps 5회 · 100 km/h · 피스톤 압력 12 MPa까지 증가 · 초기 온도 65–100 °C (논문 Table 3)";
  const A_STEP = "FMVSS 135 기반 Step stop 시험 (Burnish, Cold effectiveness, Fade, Hot performance, Recovery 등 · 논문 Table 3)";
  const NO_ERR = "논문에 오차·표준편차 기재 없음";

  window.LITERATURE_MEASUREMENTS = [
    {
      id: "A-T5-mu-ramp", paperId: "A", status: "LITERATURE_VERIFIED", theme: "friction",
      metric: "최대 마찰계수 — Ramp stop", unit: "μ (무차원)", decimals: 3,
      location: "Table 5, p.478", conditions: A_RAMP,
      extraction: "원문 표의 인쇄 수치를 그대로 옮김", error: NO_ERR,
      series: A_SERIES, groups: ["Ramp stop"], values: [[0.402, 0.375, 0.388]],
    },
    {
      id: "A-T5-mu-step", paperId: "A", status: "LITERATURE_VERIFIED", theme: "friction",
      metric: "최대 마찰계수 — Step stop", unit: "μ (무차원)", decimals: 3,
      location: "Table 5, p.478", conditions: A_STEP,
      extraction: "원문 표의 인쇄 수치를 그대로 옮김", error: NO_ERR,
      series: A_SERIES, groups: ["Step stop"], values: [[0.431, 0.466, 0.466]],
    },
    {
      id: "A-text-maxtemp", paperId: "A", status: "LITERATURE_VERIFIED", theme: "temperature",
      metric: "운용 중 최대 로터 온도 (Hot performance 시험)", unit: "°C", decimals: 0,
      location: "본문 4.2절 p.475, 결론 2) p.478", conditions: "Hot performance: 100 km/h 1회 정지, Fade heating snubs(120→60 km/h 15회) 직후 (논문 Table 3)",
      extraction: "원문 본문에 인쇄된 수치를 그대로 옮김", error: NO_ERR,
      series: A_SERIES, groups: ["최대 온도"], values: [[650, 657, 651]],
      note: "논문은 패턴 간 최대 온도 차이가 크지 않다고 서술함",
    },
    {
      id: "A-T5-dT", paperId: "A", status: "LITERATURE_VERIFIED", theme: "temperature",
      metric: "시험 중 온도 변화량", unit: "°C", decimals: 0,
      location: "Table 5, p.478", conditions: A_STEP,
      extraction: "원문 표의 인쇄 수치를 그대로 옮김", error: NO_ERR,
      series: A_SERIES, groups: ["Hot stop", "Recovery stop"], values: [[88, 78, 80], [86, 92, 84]],
    },
    {
      id: "A-T4-torque", paperId: "A", status: "LITERATURE_VERIFIED", theme: "braking",
      metric: "최대 제동 토크 (3회 평균)", unit: "Nm", decimals: 0,
      location: "Table 4 p.477 (회차별 값), 본문 4.3절 p.475–476 (평균)", conditions: "Warm ramp stop · 50 km/h · 피스톤 압력 6 MPa까지 증가 · 동일 시험 3회 (온도·마찰 시험 종료 후)",
      extraction: "본문에 인쇄된 평균값을 옮김 (Table 4 회차별 값의 산술평균과 일치 확인)", error: "회차별 값: 관통 1,636/1,612/1,598 · 홈 1,532/1,533/1,527 · 복합 1,616/1,617/1,632 Nm (Table 4). 표준편차 미기재",
      series: A_SERIES, groups: ["최대 토크 평균"], values: [[1615, 1531, 1622]],
    },
    {
      id: "A-T4-hyst", paperId: "A", status: "LITERATURE_VERIFIED", theme: "hysteresis",
      metric: "제동 토크 이력 비율 (최대 토크 차 ÷ 최대 토크, 3회 평균)", unit: "%", decimals: 1,
      location: "Table 4, p.477", conditions: "Warm ramp stop · 50 km/h · 6 MPa · 3회",
      extraction: "원문 표의 'Average (%)' 열을 그대로 옮김", error: "회차별: 관통 13.3/14.0/13.6 · 홈 14.1/14.6/14.0 · 복합 11.7/12.7/12.5 %",
      series: A_SERIES, groups: ["이력 비율"], values: [[13.6, 14.2, 12.3]],
      note: "값이 낮을수록 가압·감압 시 토크 차이(이력)가 작다는 뜻. 논문의 시편에 대한 결과입니다.",
    },
    {
      id: "C-T6-1p", paperId: "C", status: "LITERATURE_VERIFIED", theme: "braking",
      metric: "평균 제동 토크 — 단일 재질 로터", unit: "Nm", decimals: 0,
      location: "Table 6, 4.1절", conditions: "Warm ramps · 100 km/h · 피스톤 압력 12,000 kPa까지 증가 · 5회 (논문 Table 4)",
      extraction: "원문 표의 인쇄 수치를 소수점 이하 반올림해 표시 (원값: 소수 셋째 자리)", error: NO_ERR,
      series: C_SERIES, groups: ["< 2,000 kPa", "2,000–10,600 kPa", "> 10,600 kPa"],
      values: [[197.139, 189.674, 180.108], [1588.687, 1623.5, 1543.658], [2697.757, 2621.15, 2504.183]],
    },
    {
      id: "C-T6-2p", paperId: "C", status: "LITERATURE_VERIFIED", theme: "braking",
      metric: "평균 제동 토크 — 이종 재질 로터 (Al 햇)", unit: "Nm", decimals: 0,
      location: "Table 6, 4.1절", conditions: "Warm ramps · 100 km/h · 피스톤 압력 12,000 kPa까지 증가 · 5회 (논문 Table 4)",
      extraction: "원문 표의 인쇄 수치를 소수점 이하 반올림해 표시 (원값: 소수 셋째 자리)", error: NO_ERR,
      series: C_SERIES, groups: ["< 2,000 kPa", "2,000–10,600 kPa", "> 10,600 kPa"],
      values: [[159.012, 169.251, 172.123], [1535.106, 1593.633, 1539.035], [2699.193, 2764.351, 2653.439]],
    },
  ];
})();
