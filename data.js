// ============================================================
// 카리브무역 브레이크 디스크 — 고정 설정값
// 상품·적용차량 데이터는 catalog-data.js (tools\build-site-data.ps1 로 생성)
// ============================================================

// 차대번호 앞 3자리(WMI) → 제조사 (catalog-data.js 의 제조사 이름과 맞춤)
const WMI_MAP = {
  WBA: "BMW", WBS: "BMW", WBY: "BMW", WBX: "BMW", "5UX": "BMW", "4US": "BMW",
  WMW: "MINI",
  WDD: "MERCEDES-BENZ", WDB: "MERCEDES-BENZ", WDC: "MERCEDES-BENZ", WDF: "MERCEDES-BENZ",
  W1K: "MERCEDES-BENZ", W1N: "MERCEDES-BENZ", W1V: "MERCEDES-BENZ", W1W: "MERCEDES-BENZ", "4JG": "MERCEDES-BENZ", "55S": "MERCEDES-BENZ",
  WAU: "AUDI", WUA: "AUDI", WA1: "AUDI", TRU: "AUDI",
  WVW: "VW", WVG: "VW", WV1: "VW", WV2: "VW", "1VW": "VW", "3VW": "VW",
  TMB: "SKODA", VSS: "SEAT",
  SAL: "LAND ROVER",
  WP0: "PORSCHE", WP1: "PORSCHE",
  YV1: "VOLVO", YV4: "VOLVO", LVY: "VOLVO",
  JTH: "LEXUS", JTJ: "LEXUS", "2T2": "LEXUS",
  JTD: "TOYOTA", JTN: "TOYOTA", "4T1": "TOYOTA",
  "2C3": "CHRYSLER", "1C3": "CHRYSLER", "2C4": "CHRYSLER",
  "1C4": "JEEP", "1J4": "JEEP", "1J8": "JEEP",
  "2B3": "DODGE", "1B3": "DODGE",
  ZAM: "MASERATI",
  VF3: "PEUGEOT", VR3: "PEUGEOT", VF7: "CITROËN",
  "1FA": "FORD USA", "1FM": "FORD USA", "2FM": "FORD USA",
};
// 아우디·폭스바겐 그룹은 차대번호 7~8번째 자리가 플랫폼 코드(예: 4G = A6 C7)
const VAG_MAKES = ["AUDI", "VW", "SKODA", "SEAT"];

const MAKE_KO = {
  "MERCEDES-BENZ": "벤츠", BMW: "BMW", AUDI: "아우디", VW: "폭스바겐", MINI: "MINI", PORSCHE: "포르쉐",
  "LAND ROVER": "랜드로버", TOYOTA: "토요타", FORD: "포드", SEAT: "세아트", SKODA: "스코다",
  VOLVO: "볼보", LEXUS: "렉서스", CHRYSLER: "크라이슬러", DODGE: "닷지", JEEP: "지프", LANCIA: "란치아",
  MASERATI: "마세라티", PEUGEOT: "푸조", "CITROËN": "시트로엥", DS: "DS", OPEL: "오펠", "FORD USA": "포드(미국)",
};

// 원본 데이터에서 의심되는 적용 정보(검토 전까지 숨김) — 폭스바겐 그룹 312mm 디스크에 섞인 포드 트랜짓
const SUSPECT_ROWS = [{ pn: "5Q0615301F", make: "FORD" }, { pn: "1K0615301AA", make: "FORD" }];

// 상담·검색용 한글 별칭 → [제조사, 모델군]
const MODEL_ALIASES = [
  [["e클래스", "e-class", "e200", "e220", "e250", "e300", "e350", "e400"], "MERCEDES-BENZ", "E-CLASS"],
  [["c클래스", "c-class", "c200", "c220", "c300", "c43"], "MERCEDES-BENZ", "C-CLASS"],
  [["s클래스", "s-class", "s350", "s400", "s450", "s500", "s560", "s580", "s63"], "MERCEDES-BENZ", "S-CLASS"],
  [["cls"], "MERCEDES-BENZ", "CLS"],
  [["glc"], "MERCEDES-BENZ", "GLC"],
  [["a클래스", "a-class", "a45"], "MERCEDES-BENZ", "A-CLASS"],
  [["cla"], "MERCEDES-BENZ", "CLA"],
  [["gla"], "MERCEDES-BENZ", "GLA-CLASS"],
  [["1시리즈", "118", "120"], "BMW", "1 Series"],
  [["2시리즈", "218", "220i", "220d"], "BMW", "2 Series"],
  [["3시리즈", "320", "330", "340"], "BMW", "3 Series"],
  [["4시리즈", "420", "430", "440"], "BMW", "4 Series"],
  [["5시리즈", "520", "523", "528", "530", "535", "540"], "BMW", "5 Series"],
  [["6시리즈", "630", "640"], "BMW", "6 Series"],
  [["7시리즈", "730", "740", "750"], "BMW", "7 Series"],
  [["x1"], "BMW", "X1"], [["x3"], "BMW", "X3"], [["x4"], "BMW", "X4"], [["x5"], "BMW", "X5"], [["x6"], "BMW", "X6"],
  [["a4"], "AUDI", "A4"], [["a5"], "AUDI", "A5"], [["a6"], "AUDI", "A6"], [["a7"], "AUDI", "A7"], [["a8"], "AUDI", "A8"], [["q5"], "AUDI", "Q5"], [["q7"], "AUDI", "Q7"],
  [["골프", "golf"], "VW", "GOLF"], [["티구안", "tiguan"], "VW", "TIGUAN"], [["파사트", "passat"], "VW", "PASSAT"], [["아테온", "arteon"], "VW", "ARTEON"], [["투아렉", "touareg"], "VW", "TOUAREG"],
  [["디스커버리", "discovery"], "LAND ROVER", "DISCOVERY"], [["레인지로버 스포츠", "range rover sport"], "LAND ROVER", "RANGE ROVER SPORT"], [["레인지로버", "range rover"], "LAND ROVER", "RANGE ROVER"],
  [["마칸", "macan"], "PORSCHE", "MACAN"],
  [["glk"], "MERCEDES-BENZ", "GLK-CLASS"], [["b클래스", "b-class"], "MERCEDES-BENZ", "B-CLASS"],
  [["s60"], "VOLVO", "S60"], [["s80"], "VOLVO", "S80"], [["v60"], "VOLVO", "V60"], [["xc70"], "VOLVO", "XC70"],
  [["es300", "es350", "렉서스 es"], "LEXUS", "ES"], [["캠리", "camry"], "TOYOTA", "CAMRY"],
  [["300c"], "CHRYSLER", "300C"], [["챌린저", "challenger"], "DODGE", "CHALLENGER"], [["차저", "charger"], "DODGE", "CHARGER"],
  [["체로키", "cherokee"], "JEEP", "CHEROKEE"],
  [["기블리", "ghibli"], "MASERATI", "GHIBLI"], [["콰트로포르테", "quattroporte"], "MASERATI", "QUATTROPORTE"],
  [["익스플로러", "explorer"], "FORD USA", "EXPLORER"], [["토러스", "taurus"], "FORD USA", "TAURUS"],
  [["a3"], "AUDI", "A3"], [["a1"], "AUDI", "A1"], [["q3"], "AUDI", "Q3"],
  // 2026-11 추가: 등록된 모델군 전체 별칭 (상담창에서 모델명으로 찾기)
  [["eqc"], "MERCEDES-BENZ", "EQC"], [["slk"], "MERCEDES-BENZ", "SLK"], [["slc"], "MERCEDES-BENZ", "SLC"],
  [["8시리즈", "840"], "BMW", "8 Series"], [["x7"], "BMW", "X7"], [["x2"], "BMW", "X2"], [["z4"], "BMW", "Z4"], [["bmw ix", "아이엑스"], "BMW", "iX"],
  [["q2"], "AUDI", "Q2"], [["아우디tt", "아우디 tt", "audi tt"], "AUDI", "TT"],
  [["제타", "jetta"], "VW", "JETTA"], [["시로코", "scirocco"], "VW", "SCIROCCO"], [["투란", "touran"], "VW", "TOURAN"], [["샤란", "sharan"], "VW", "SHARAN"],
  [["비틀", "beetle"], "VW", "BEETLE"], [["이오스", "폭스바겐 eos"], "VW", "EOS"], [["티록", "t-roc", "troc"], "VW", "T-ROC"], [["캐디", "caddy"], "VW", "CADDY"], [["폭스바겐 cc", "폭스바겐cc", "vw cc"], "VW", "CC"],
  [["컨트리맨", "countryman"], "MINI", "MINI COUNTRYMAN"],
  [["라브4", "라브 4", "rav4", "rav 4"], "TOYOTA", "RAV 4"], [["프리우스", "prius"], "TOYOTA", "PRIUS"], [["수프라", "supra"], "TOYOTA", "SUPRA"], [["오리스", "auris"], "TOYOTA", "AURIS"], [["미라이", "mirai"], "TOYOTA", "MIRAI"],
  [["es250", "es300h"], "LEXUS", "ES"],
  [["플렉스", "ford flex"], "FORD USA", "FLEX"], [["란치아 테마", "thema"], "LANCIA", "THEMA"],
  [["v70"], "VOLVO", "V70"],
  [["옥타비아", "octavia"], "SKODA", "OCTAVIA"], [["수퍼브", "슈퍼브", "superb"], "SKODA", "SUPERB"], [["코디악", "kodiaq"], "SKODA", "KODIAQ"], [["카록", "karoq"], "SKODA", "KAROQ"], [["예티", "yeti"], "SKODA", "YETI"],
  [["레온", "leon"], "SEAT", "LEON"], [["아테카", "ateca"], "SEAT", "ATECA"], [["알함브라", "alhambra"], "SEAT", "ALHAMBRA"], [["톨레도", "toledo"], "SEAT", "TOLEDO"], [["알테아", "altea"], "SEAT", "ALTEA"],
  [["모카", "mokka"], "OPEL", "MOKKA"], [["코르사", "corsa"], "OPEL", "CORSA"], [["크로스랜드", "crossland"], "OPEL", "CROSSLAND"],
  [["시트로엥 c4", "시트로엥c4", "c4 피카소", "c4피카소"], "CITROËN", "C4"], [["시트로엥 c5", "시트로엥c5"], "CITROËN", "C5"], [["시트로엥 c3", "시트로엥c3"], "CITROËN", "C3"], [["베를링고", "berlingo"], "CITROËN", "BERLINGO"], [["ds3"], "CITROËN", "DS3"], [["ds4"], "CITROËN", "DS4"],
  [["푸조 3008", "푸조3008", "peugeot 3008"], "PEUGEOT", "3008"], [["푸조 5008", "푸조5008", "peugeot 5008"], "PEUGEOT", "5008"], [["푸조 2008", "푸조2008", "peugeot 2008"], "PEUGEOT", "2008"], [["푸조 1007", "푸조1007", "peugeot 1007"], "PEUGEOT", "1007"], [["푸조 308", "푸조308", "peugeot 308"], "PEUGEOT", "308"], [["푸조 208", "푸조208", "peugeot 208"], "PEUGEOT", "208"], [["푸조 207", "푸조207", "peugeot 207"], "PEUGEOT", "207"], [["푸조 206", "푸조206", "peugeot 206"], "PEUGEOT", "206"], [["푸조 307", "푸조307", "peugeot 307"], "PEUGEOT", "307"], [["푸조 301", "푸조301", "peugeot 301"], "PEUGEOT", "301"], [["푸조 파트너", "partner"], "PEUGEOT", "PARTNER"],
];
const MAKE_WORDS = {
  "MERCEDES-BENZ": ["벤츠", "benz", "mercedes", "메르세데스"],
  BMW: ["bmw", "비엠", "비엠더블유"],
  AUDI: ["아우디", "audi"],
  VW: ["폭스바겐", "volkswagen", "vw"],
  MINI: ["미니", "mini"],
  "LAND ROVER": ["랜드로버", "land rover"],
  PORSCHE: ["포르쉐", "porsche"],
  VOLVO: ["볼보", "volvo"],
  LEXUS: ["렉서스", "lexus"],
  CHRYSLER: ["크라이슬러", "chrysler"],
  JEEP: ["지프", "jeep"],
  MASERATI: ["마세라티", "maserati"],
  PEUGEOT: ["푸조", "peugeot"],
  "FORD USA": ["포드", "ford"],
  TOYOTA: ["토요타", "도요타", "toyota"],
  SKODA: ["스코다", "skoda"],
  SEAT: ["세아트", "쎄아트"],
  "CITROËN": ["시트로엥", "citroen"],
  OPEL: ["오펠", "opel"],
  DODGE: ["닷지", "다지", "dodge"],
  LANCIA: ["란치아", "lancia"],
};
