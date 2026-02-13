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
