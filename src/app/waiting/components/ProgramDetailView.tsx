"use client";

import { ArrowLeft, Check } from "lucide-react";
import styles from "./ProgramDetailView.module.css";

interface BookingInfo {
  date: string;
  time: string;
  expert: string;
}

interface ProgramDetailViewProps {
  bookingInfo: BookingInfo;
  onClose: () => void;
}

// 나이대별 프로그램 설명
const PROGRAM_CONTENT: Record<string, { desc: string; checkpoints: string[] }> = {
  "20대": {
    desc: "사회초년생에게 가장 취약한 재무 습관 부재, 저축 계획 미흡, 연금 가입 누락 등의 조기 진단과 건강한 재무 기초를 다지기 위한 기본형 종합 재무검진 프로그램입니다.",
    checkpoints: [
      "사회초년생으로 재무 관리를 어떻게 시작해야 할지 모르겠다.",
      "월급 관리와 저축 습관을 체계적으로 만들고 싶다.",
      "국민연금, 퇴직연금 등 연금 제도를 이해하고 싶다.",
      "내 집 마련, 결혼 자금 등 목표 자금을 계획하고 싶다.",
      "20대에 알아야 할 재무 지식을 전문가에게 배우고 싶다.",
    ],
  },
  "30대": {
    desc: "30대 직장인에게 가장 취약한 주택자금 부담, 자녀 교육비 준비 미흡, 보험/연금 설계 부족 등의 조기 진단과 자산 형성기에 맞는 재무 전략 수립을 위한 기본형 종합 재무검진 프로그램입니다.",
    checkpoints: [
      "결혼, 출산, 주택 구입 등 큰 지출이 예정되어 있다.",
      "맞벌이/외벌이 상황에 맞는 재무 전략이 필요하다.",
      "자녀 교육비와 노후 준비를 동시에 계획하고 싶다.",
      "대출 상환과 자산 증식의 균형을 맞추고 싶다.",
      "30대에 꼭 해야 할 재무 결정에 대해 조언받고 싶다.",
    ],
  },
  "40대": {
    desc: "40대 가장에게 가장 취약한 자녀 교육비 집중, 은퇴 준비 후순위화, 건강/보험 리스크 등의 조기 진단과 은퇴 준비 본격화를 위한 기본형 종합 재무검진 프로그램입니다.",
    checkpoints: [
      "자녀 교육비 부담이 크고 은퇴 준비가 걱정된다.",
      "남은 직장 생활 동안 얼마나 모아야 하는지 알고 싶다.",
      "연금 수령 전략과 최적의 은퇴 시점을 계획하고 싶다.",
      "부동산, 금융자산의 최적 배분 비율을 점검하고 싶다.",
      "40대에 반드시 점검해야 할 재무 항목을 확인하고 싶다.",
    ],
  },
  "50+": {
    desc: "은퇴를 앞둔 50대 이상에게 가장 취약한 은퇴 후 소득 공백, 의료비 리스크, 자산 인출 전략 부재 등의 조기 진단과 안정적인 노후 생활을 위한 기본형 종합 재무검진 프로그램입니다.",
    checkpoints: [
      "은퇴 후 월 생활비가 얼마나 필요한지 정확히 알고 싶다.",
      "국민연금, 퇴직연금, 개인연금 수령 전략을 최적화하고 싶다.",
      "은퇴 후 자산을 어떤 순서로 인출해야 하는지 알고 싶다.",
      "의료비, 간병비 등 노후 리스크에 대비하고 싶다.",
      "자녀에게 물려줄 자산과 내가 쓸 자산을 구분하고 싶다.",
    ],
  },
};

// 검진 항목 정의 (의료재단 스타일)
const CHECKUP_ITEMS = [
  { category: "소득", items: "소득증빙 분석", diagnosis: "소득 안정성, 성장 추세, 은퇴 후 소득 공백" },
  { category: "지출", items: "지출내역 분석", diagnosis: "지출 효율성, 저축 여력, 은퇴 후 생활비" },
  { category: "금융자산", items: "예적금 현황 분석", diagnosis: "유동성, 안전자산 비중, 비상자금 적정성" },
  { category: "투자자산", items: "투자 포트폴리오 분석", diagnosis: "자산배분, 수익률, 리스크 수준" },
  { category: "실물자산", items: "부동산/실물 현황 분석", diagnosis: "자산 편중도, 현금화 가능성" },
  { category: "부채", items: "대출 현황 분석", diagnosis: "부채비율, 이자부담률, 상환 능력" },
  { category: "미래 이벤트", items: "생애주기 이벤트 설계", diagnosis: "결혼/출산/교육/의료 필요자금, 현금흐름 영향" },
  { category: "국민연금", items: "가입이력 조회 및 시뮬레이션", diagnosis: "예상 수령액, 조기/연기수령 비교" },
  { category: "퇴직연금", items: "퇴직연금 현황 분석", diagnosis: "DB/DC/IRP 예상액, 수령 전략" },
  { category: "개인연금", items: "개인연금 현황 분석", diagnosis: "세제혜택 활용도, 노후소득 보완 수준" },
  { category: "은퇴 시뮬레이션", items: "100세 현금흐름 시뮬레이션", diagnosis: "은퇴 적정 시기, 자산수명, 고갈 시점" },
  { category: "종합 소견", items: "재무 건전성 평가", diagnosis: "종합 점수, 맞춤 개선 방안, 실행 전략" },
];

export function ProgramDetailView({ bookingInfo, onClose }: ProgramDetailViewProps) {
  const formatBookingDate = (dateStr: string, timeStr: string) => {
    const date = new Date(dateStr);
    const month = date.getMonth() + 1;
    const day = date.getDate();
    const weekdays = ["일", "월", "화", "수", "목", "금", "토"];
    const weekday = weekdays[date.getDay()];
    return `${month}월 ${day}일 (${weekday}) ${timeStr}`;
  };

  // 기본값으로 30대 사용 (실제 구현시 사용자 나이대 전달 필요)
  const content = PROGRAM_CONTENT["30대"];

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <header className={styles.header}>
        <button className={styles.backButton} onClick={onClose}>
          <ArrowLeft size={24} />
        </button>
        <h1 className={styles.headerTitle}>검진 프로그램</h1>
        <div className={styles.headerSpacer} />
      </header>

      {/* 메인 */}
      <main className={styles.main}>
        {/* 프로그램 헤더 */}
        <div className={styles.programHeader}>
          <span className={styles.programBadge}>예약됨</span>
          <h1 className={styles.programTitle}>
            기본형 종합 재무검진 <span className={styles.programTitleSub}>(은퇴 진단)</span>
          </h1>
          <p className={styles.programExpert}>담당 : {bookingInfo.expert} 은퇴설계 전문가</p>
        </div>

        {/* 프로그램 설명 */}
        <p className={styles.programDesc}>{content.desc}</p>

        {/* 예약 정보 */}
        <div className={styles.bookingInfo}>
          <div className={styles.bookingRow}>
            <span className={styles.bookingLabel}>예약 일시</span>
            <span className={styles.bookingValue}>
              {formatBookingDate(bookingInfo.date, bookingInfo.time)}
            </span>
          </div>
          <div className={styles.bookingRow}>
            <span className={styles.bookingLabel}>진행방식</span>
            <span className={styles.bookingValue}>전화 또는 대면</span>
          </div>
          <div className={styles.bookingRow}>
            <span className={styles.bookingLabel}>소요시간</span>
            <span className={styles.bookingValue}>약 30분</span>
          </div>
          <div className={styles.bookingRow}>
            <span className={styles.bookingLabel}>검진비용</span>
            <span className={styles.bookingValue}>
              <span className={styles.originalPrice}>249,000원</span>
              <span className={styles.freePrice}>무료</span>
            </span>
          </div>
        </div>
        <p className={styles.metaNote}>
          * 대면 상담 시 추가 비용이 발생할 수 있으며, 소요 시간은 약 1시간입니다.
        </p>

        {/* CHECK POINT */}
        <div className={styles.checkpoint}>
          <div className={styles.checkpointTitle}>CHECK POINT !</div>
          <ul className={styles.checkpointList}>
            {content.checkpoints.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        {/* 검진 항목 테이블 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>검진 항목</h2>
          <table className={styles.checkupTable}>
            <thead>
              <tr>
                <th className={styles.thCategory}>검진 영역</th>
                <th className={styles.thItems}>검사 항목</th>
                <th className={styles.thDiagnosis}>관련 진단</th>
              </tr>
            </thead>
            <tbody>
              {CHECKUP_ITEMS.map((item, index) => (
                <tr key={index}>
                  <td className={styles.tdCategory}>{item.category}</td>
                  <td className={styles.tdItems}>{item.items}</td>
                  <td className={styles.tdDiagnosis}>{item.diagnosis}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* 검진 후 제공 */}
        <div className={styles.section}>
          <h2 className={styles.sectionTitle}>검진 후 제공</h2>
          <div className={styles.serviceList}>
            <div className={styles.serviceItem}>
              <Check size={18} className={styles.serviceCheck} />
              <span>전담 은퇴설계전문가 1:1 상담</span>
            </div>
            <div className={styles.serviceItem}>
              <Check size={18} className={styles.serviceCheck} />
              <span>은퇴 진단 보고서</span>
            </div>
            <div className={styles.serviceItem}>
              <Check size={18} className={styles.serviceCheck} />
              <span>맞춤 재무 전략 수립</span>
            </div>
            <div className={styles.serviceItem}>
              <Check size={18} className={styles.serviceCheck} />
              <span>은퇴 시나리오 다각화</span>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
