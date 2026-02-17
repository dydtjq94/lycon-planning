/**
 * 버전 히스토리
 *
 * 버전 체계: a.b.c
 *   a (Major) - 대규모 변경, 서비스 리뉴얼, 기존 호환 깨지는 변경
 *   b (Minor) - 새로운 기능 추가, 주요 개선
 *   c (Patch) - 버그 수정, 소소한 개선
 *
 * 규칙:
 *   - 모든 변경사항은 현재 버전의 changes 배열에 추가 (필수)
 *   - 버전 번호는 사용자 요청 시에만 올림
 *   - 버전 올릴 때 AI가 changes를 바탕으로 summary(마크다운) 작성
 */

export interface VersionEntry {
  version: string;
  date: string; // YYYY.MM.DD
  summary: string; // 마크다운 형식의 릴리즈 노트 (버전 올릴 때 AI가 작성)
  changes: string[]; // 개발 중 쌓이는 변경사항 목록
}

export const VERSION_HISTORY: VersionEntry[] = [
  {
    version: "1.0.1",
    date: "2026.02.13",
    summary: "", // 아직 릴리즈 전 - 사용자가 "버전 올려줘" 하면 AI가 작성
    changes: [
      "버전 히스토리 마크다운 릴리즈 노트 시스템 구축",
      "투자 포트폴리오 차트 기간 옵션을 전체/1개월/3개월/1년/3년/5년/10년으로 변경",
      "투자 포트폴리오 차트 기본 기간을 전체로 변경",
      "투자 포트폴리오 차트 거래 점선 위치 기간 변경 시 어긋나는 버그 수정",
      "시뮬레이션 생성 시 부동산 관리비/월세를 별도 지출로 중복 생성하지 않도록 수정",
      "현금 흐름 우선순위 패널에서 무한 리렌더링 루프 발생하는 버그 수정",
      "현금 흐름 우선순위 저장 시 차트/사이드바에 즉시 반영되도록 개선",
      "시뮬레이션 가정 저장 시 차트에 즉시 반영되도록 개선",
      "시뮬레이션 엔진 성장률 시스템 통합 - InvestmentAssumptions 패널 값이 소득/지출/부동산 성장률에 실제 반영되도록 수정",
      "지출 탭에서 의료비 기본 섹션 제거",
      "지출 추가 모달에 자동 생성 섹션 추가 (의료비/교육비)",
      "의료비/교육비를 그룹 요약 카드로 표시, 상세 관리 모달 추가",
      "의료비/교육비 자동 생성 시 배치 API로 성능 개선 (2회 호출로 단축)",
      "의료비 구간 변경 (0~59/60~69/70~79/80~89/90~100세, 연간 기준)",
      "amount_base_year 필드 추가 - 현재가치 저장 후 엔진이 동적으로 물가 반영",
      "의료비 자동 생성 시 기대수명 반영 (기대수명 이후 구간 미생성)",
      "DashboardContent에서 사용하지 않는 레거시 switch case 9개 및 미사용 import 제거",
      "소득/지출/부동산 카드에서 시뮬레이션 가정 사용 시 '시뮬레이션 가정'으로 표시 (하드코딩 퍼센트 제거)",
      "InvestmentAssumptions → SimulationAssumptions 리네임 + DB 컬럼 migration",
      "GlobalSettings 제거 - 시뮬레이션 가정(SimulationAssumptions) 단일 시스템으로 통합",
      "SimulationRates에 baseRate/debtDefault 필드 추가 (변동금리/부채 기본이자 지원)",
      "ScenarioModal 삭제 (dead code)",
      "V1 시뮬레이션 엔진 완전 제거 (simulationEngine.ts, dataMigration.ts, AssetSimulationChart.tsx 삭제)",
      "V1 deprecated 타입 제거 (GlobalSettings, ScenarioMode, ScenarioRates, SimulationSettings 등)",
      "시뮬레이션 공통 타입을 simulationTypes.ts로 분리",
      "저축/투자 카드 레이아웃을 시뮬레이션 관점으로 개선 (브로커명 제거, 이율/적립액/기간 표시)",
      "시뮬레이션 엔진에 기본 유동 현금 보장 - 계좌 없어도 가상 유동 현금 자동 생성, 잉여/인출 최후순위",
      "현금흐름 우선순위 잉여금 배분 패널에 유동 현금 고정 행 표시 (마이너스 통장과 동일 패턴)",
      "저축/투자 삭제 시 현금흐름 우선순위에 남아있던 규칙 자동 정리",
      "잉여금 배분 규칙 없을 때 임의 계좌 배분 폴백 제거 - 유동 현금으로만 흡수되도록 수정",
    ],
  },
  {
    version: "1.0.0",
    date: "2026.02.13",
    summary: `Lycon의 첫 번째 릴리즈입니다.`,
    changes: [
      "서비스 오픈",
      "설정 페이지 사이드바 + 콘텐츠 패널 구조로 재설계",
      "계좌 관리 - 계좌/카드/페이 목록 및 편집",
      "더보기 메뉴 (이용약관, 개인정보처리방침)",
      "버전 히스토리 페이지",
      "기본 정보 이름/생년월일 수정 기능",
    ],
  },
];

export const CURRENT_VERSION = VERSION_HISTORY[0].version;
