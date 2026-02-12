"use client";

import { useState } from "react";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Target,
  Users,
  Calendar,
  MessageCircle,
  BarChart3,
  Shield,
  Clock,
  Sparkles,
  ArrowRight,
  Receipt,
  PiggyBank,
  TrendingUp,
  CalendarCheck,
  Wallet,
  Building,
  Scale,
  Briefcase,
  HelpCircle,
} from "lucide-react";
import styles from "./subscription.module.css";

// 온보딩 타임라인 데이터
const onboardingTimeline = [
  {
    day: "D+3",
    title: "1차 미팅",
    duration: "30분",
    items: [
      "현재 데이터 기반 시나리오 설명",
      "기본 가정 (물가 상승률, 투자수익률 등)",
      "반영된 미래 이벤트 소개/조정",
      "부족하여 대비 필요한 구간 설명",
      "현재 포트폴리오 분석 및 투자 성향 파악",
    ],
  },
  {
    day: "D+7",
    title: "2차 미팅",
    duration: "1.5시간",
    items: [
      "적정 은퇴 시점 목표 설명 (은퇴 후 현금흐름 중심)",
      "목표 달성 시나리오 2개 제시",
      "중간 목표(마일스톤) 및 주요 이벤트 설명",
      "요구사항 반영하여 시나리오 조정",
      "로드맵 & 액션플랜 설명",
    ],
  },
  {
    day: "D+14",
    title: "3차 미팅",
    duration: "1.5시간",
    items: [
      "투자 기본 지식 설명 (자산배분, ETF 등)",
      "목표 수익률 달성을 위한 포트폴리오 추천",
      "백테스팅 결과 설명 (MDD, 손실회복력 등)",
      "리밸런싱 전략 설명",
    ],
  },
  {
    day: "D+21",
    title: "대시보드 세팅",
    duration: "",
    items: [
      "통장 분할 (계좌 재세팅)",
      "연금/절세 계좌 등록",
      "모든 계좌 대시보드 연동",
    ],
  },
  {
    day: "D+28",
    title: "4차 미팅",
    duration: "30분",
    items: [
      "1~3차 미팅에서 정해진 할 일들 점검",
      "개선 포인트 도출 및 시나리오 수정",
      "정기 관리 체계 안내",
    ],
  },
];

// 정기 관리 데이터
const regularManagement = [
  {
    period: "주간",
    count: "52회",
    type: "자동화",
    title: "가계부 관리 리마인드",
    items: ["자동 스케줄화된 알림", "지출 기록 독려 및 점검"],
    icon: Receipt,
  },
  {
    period: "월간",
    count: "12회",
    type: "온라인 + 서면 보고서",
    title: "월간 점검",
    items: [
      "소득/지출 점검",
      "투자 관련 소식 및 정보 안내",
      "월간 리포트 전송",
    ],
    icon: BarChart3,
  },
  {
    period: "분기",
    count: "4회",
    type: "메인 미팅",
    title: "분기 정기 미팅",
    items: [
      "포트폴리오 리밸런싱",
      "시나리오 업데이트",
      "목표 달성률 KPI 점검",
      "자산 스냅샷 저장",
      "다음 분기 과제 부여",
    ],
    icon: TrendingUp,
  },
  {
    period: "연말",
    count: "1회",
    type: "미팅",
    title: "연말정산 세제혜택 점검",
    items: [
      "소득공제/세액공제 최적화",
      "연금저축/IRP 납입 점검",
      "환급 극대화 전략",
    ],
    icon: Wallet,
  },
  {
    period: "연간",
    count: "1회",
    type: "미팅",
    title: "연간 시나리오 재정리",
    items: [
      "목표 대비 진행도 종합 점검",
      "시나리오 전면 재검토",
      "다음 해 로드맵 수립",
    ],
    icon: Target,
  },
];

// 전문가 네트워크 데이터
const expertNetwork = [
  {
    title: "자산전문가 (CFP)",
    description: "재무 심화 상담",
    benefit: "2회 무료",
    originalPrice: "20만원",
    discountPrice: "무료",
    icon: BarChart3,
  },
  {
    title: "세무사/회계사",
    description: "세무, 절세 상담",
    benefit: "1회 50% 할인",
    originalPrice: "40만원",
    discountPrice: "20만원",
    icon: Receipt,
  },
  {
    title: "부동산 전문가",
    description: "매매, 재건축 상담",
    benefit: "1회 50% 할인",
    originalPrice: "50만원",
    discountPrice: "25만원",
    icon: Building,
  },
  {
    title: "변호사",
    description: "법무 전반 상담",
    benefit: "1회 50% 할인",
    originalPrice: "50만원",
    discountPrice: "25만원",
    icon: Scale,
  },
  {
    title: "노무사",
    description: "직장/퇴직 관련 상담",
    benefit: "1회 50% 할인",
    originalPrice: "20만원",
    discountPrice: "10만원",
    icon: Briefcase,
  },
];

// FAQ 데이터
const faqData = [
  {
    question: "자산이 적어도 괜찮을까요?",
    answer:
      "네, 자산 규모와 관계없이 구독 가능합니다. Lycon은 '자산가'가 아닌 '중산층'을 위한 서비스입니다. 오히려 지금 시작해야 복리 효과를 누릴 수 있습니다.",
  },
  {
    question: "미팅은 어떻게 진행되나요?",
    answer:
      "모든 미팅은 화상(Zoom/Google Meet)으로 진행됩니다. 시간과 장소에 구애받지 않고 편하게 상담받으실 수 있습니다.",
  },
  {
    question: "중도 해지가 가능한가요?",
    answer:
      "연 단위 결제 특성상 중도 환불은 어렵습니다. 다만 첫 1개월 온보딩 기간 내 서비스에 불만족하시면 전액 환불해드립니다.",
  },
  {
    question: "투자 손실이 나면 어떻게 하나요?",
    answer:
      "Lycon은 투자 일임이 아닌 자문 서비스입니다. 최종 투자 결정은 고객님이 하시며, 투자 손실에 대한 책임은 고객님께 있습니다. 다만 장기 투자 관점에서 흔들리지 않도록 함께 관리해드립니다.",
  },
  {
    question: "기존에 있는 투자/보험을 바꿔야 하나요?",
    answer:
      "반드시 바꿀 필요는 없습니다. 기존 포트폴리오를 분석해서 유지할 것과 조정할 것을 구분해드립니다. 불필요한 상품 가입을 권유하지 않습니다.",
  },
  {
    question: "월간 미팅이 부담스러운데요?",
    answer:
      "월간 미팅은 온라인으로 짧게 진행되며, 서면 보고서로 대체 가능합니다. 메인은 분기 미팅이고, 월간은 가볍게 터치하는 정도입니다.",
  },
];

// 비교 테이블 데이터
const comparisonData = [
  {
    feature: "혼자 하면",
    alone: "가계부 3일 만에 포기",
    withLycon: "매주 자동 리마인드 + 전문가 점검",
  },
  {
    feature: "",
    alone: "투자 앱 깔고 방치",
    withLycon: "분기마다 포트폴리오 리밸런싱",
  },
  {
    feature: "",
    alone: '"장투하자" → 3일 만에 손절',
    withLycon: "시나리오 기반 흔들리지 않는 장기 투자",
  },
  {
    feature: "",
    alone: "막연한 은퇴 불안",
    withLycon: "숫자로 검증된 은퇴 로드맵",
  },
  {
    feature: "",
    alone: "연말정산 환급 놓침",
    withLycon: "연말 세제혜택 점검 미팅",
  },
  {
    feature: "",
    alone: "연금저축? IRP? 뭔지는 알지만 개설 안 함",
    withLycon: "온보딩 때 계좌 개설/등록 완료",
  },
  {
    feature: "",
    alone: "포트폴리오 리밸런싱? 그게 뭔데?",
    withLycon: "분기마다 전문가가 리밸런싱",
  },
];

export default function SubscriptionPage() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [expandedTimeline, setExpandedTimeline] = useState<number | null>(0);

  const toggleFaq = (index: number) => {
    setExpandedFaq(expandedFaq === index ? null : index);
  };

  const toggleTimeline = (index: number) => {
    setExpandedTimeline(expandedTimeline === index ? null : index);
  };

  return (
    <div className={styles.container}>
      {/* Hero Section */}
      <section className={styles.hero}>
        <div className={styles.heroContent}>
          <div className={styles.badge}>자산관리 구독 서비스</div>
          <h1 className={styles.heroTitle}>
            상위 5%만 누리던 PB 서비스,
            <br />
            이제 모든 중산층에게
          </h1>
          <p className={styles.heroSubtitle}>
            은퇴 목표 시나리오 기반의 1:1 자산관리 구독 서비스
          </p>
          <div className={styles.heroQuote}>
            &quot;혼자선 절대 안 할 일들을,
            <br />
            우리와 함께라면 다 하게 됩니다&quot;
          </div>
          <div className={styles.heroCta}>
            <button className={styles.ctaButton}>
              지금 시작하기
              <ArrowRight size={18} />
            </button>
            <div className={styles.ctaPrice}>
              <span className={styles.priceOriginal}>월 99,000원</span>
              <span className={styles.priceDiscount}>월 49,000원</span>
              <span className={styles.priceLabel}>초기 고객 특별가</span>
            </div>
          </div>
        </div>
        <div className={styles.heroVisual}>
          <div className={styles.visualCard}>
            <div className={styles.visualIcon}>
              <Target size={32} />
            </div>
            <div className={styles.visualText}>
              <span className={styles.visualLabel}>목표 달성률</span>
              <span className={styles.visualValue}>시나리오 기반 추적</span>
            </div>
          </div>
          <div className={styles.visualCard}>
            <div className={styles.visualIcon}>
              <Users size={32} />
            </div>
            <div className={styles.visualText}>
              <span className={styles.visualLabel}>1:1 전담 전문가</span>
              <span className={styles.visualValue}>1년간 함께</span>
            </div>
          </div>
          <div className={styles.visualCard}>
            <div className={styles.visualIcon}>
              <BarChart3 size={32} />
            </div>
            <div className={styles.visualText}>
              <span className={styles.visualLabel}>전용 대시보드</span>
              <span className={styles.visualValue}>통합 자산 관리</span>
            </div>
          </div>
        </div>
      </section>

      {/* Problem Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>40대의 현실</span>
          <h2 className={styles.sectionTitle}>
            은퇴 준비, 왜 자꾸 미뤄지나요?
          </h2>
        </div>
        <div className={styles.problemGrid}>
          <div className={styles.problemCard}>
            <div className={styles.problemNumber}>01</div>
            <h3 className={styles.problemTitle}>자녀 교육비 집중</h3>
            <p className={styles.problemDesc}>
              초중고~대학까지, 은퇴 준비가 계속 뒤로 밀림
            </p>
          </div>
          <div className={styles.problemCard}>
            <div className={styles.problemNumber}>02</div>
            <h3 className={styles.problemTitle}>소득은 정점, 지출도 정점</h3>
            <p className={styles.problemDesc}>저축 여력이 생각보다 없음</p>
          </div>
          <div className={styles.problemCard}>
            <div className={styles.problemNumber}>03</div>
            <h3 className={styles.problemTitle}>주택 대출 상환 중</h3>
            <p className={styles.problemDesc}>현금흐름 빠듯</p>
          </div>
          <div className={styles.problemCard}>
            <div className={styles.problemNumber}>04</div>
            <h3 className={styles.problemTitle}>샌드위치 세대</h3>
            <p className={styles.problemDesc}>
              부모 부양 시작, 예상치 못한 지출 발생
            </p>
          </div>
          <div className={styles.problemCard}>
            <div className={styles.problemNumber}>05</div>
            <h3 className={styles.problemTitle}>은퇴까지 15~20년</h3>
            <p className={styles.problemDesc}>
              &quot;아직 시간 있다&quot;는 착각
            </p>
          </div>
        </div>
      </section>

      {/* Comparison Section */}
      <section className={styles.sectionDark}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabelLight}>비교</span>
          <h2 className={styles.sectionTitleLight}>혼자 vs Lycon과 함께</h2>
        </div>
        <div className={styles.comparisonTable}>
          <div className={styles.comparisonHeader}>
            <div className={styles.comparisonHeaderCell}>혼자 하면</div>
            <div className={styles.comparisonHeaderCell}>Lycon과 함께라면</div>
          </div>
          {comparisonData.map((row, idx) => (
            <div key={idx} className={styles.comparisonRow}>
              <div className={styles.comparisonCellAlone}>{row.alone}</div>
              <div className={styles.comparisonCellLycon}>
                <Check size={16} className={styles.checkIcon} />
                {row.withLycon}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* Promise Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Lycon의 약속</span>
          <h2 className={styles.sectionTitle}>우리가 드리는 약속</h2>
        </div>
        <div className={styles.promiseGrid}>
          <div className={styles.promiseCard}>
            <Check size={24} className={styles.promiseIcon} />
            <p>원하는 건 최대한 반영합니다</p>
          </div>
          <div className={styles.promiseCard}>
            <Check size={24} className={styles.promiseIcon} />
            <p>
              안 되는 건 <strong>단호하게</strong> 안 된다고 말합니다
            </p>
          </div>
          <div className={styles.promiseCard}>
            <Check size={24} className={styles.promiseIcon} />
            <p>가능하다고만 말하지 않습니다</p>
          </div>
          <div className={styles.promiseCard}>
            <Check size={24} className={styles.promiseIcon} />
            <p>
              가장 못하는 장기 투자, 우리와 함께라면{" "}
              <strong>무조건 성공</strong>합니다
            </p>
          </div>
        </div>
      </section>

      {/* What You Get Section */}
      <section className={styles.sectionAlt}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>구독 혜택</span>
          <h2 className={styles.sectionTitle}>구독하면 받는 것</h2>
        </div>
        <div className={styles.benefitGrid}>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Users size={28} />
            </div>
            <h3 className={styles.benefitTitle}>1:1 전담 전문가</h3>
            <p className={styles.benefitDesc}>
              담당 자산관리 전문가가 1년간 함께합니다
            </p>
          </div>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Calendar size={28} />
            </div>
            <h3 className={styles.benefitTitle}>첫 1개월 집중 세팅</h3>
            <p className={styles.benefitDesc}>
              4회 미팅 + 계좌 세팅 + 시나리오 설계 + 로드맵 완성
            </p>
          </div>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <CalendarCheck size={28} />
            </div>
            <h3 className={styles.benefitTitle}>연간 정기 관리</h3>
            <p className={styles.benefitDesc}>
              주간 가계부 + 월간 점검 + 분기 리밸런싱 + 연말정산
            </p>
          </div>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <BarChart3 size={28} />
            </div>
            <h3 className={styles.benefitTitle}>전용 대시보드</h3>
            <p className={styles.benefitDesc}>
              가계부 / 포트폴리오 / 자산 현황 / 시뮬레이션 통합 관리
            </p>
          </div>
          <div className={styles.benefitCard}>
            <div className={styles.benefitIcon}>
              <Shield size={28} />
            </div>
            <h3 className={styles.benefitTitle}>전문가 네트워크</h3>
            <p className={styles.benefitDesc}>
              세무사, 부동산, 변호사, CFP, 노무사 할인 연결
            </p>
          </div>
        </div>
      </section>

      {/* Onboarding Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>온보딩</span>
          <h2 className={styles.sectionTitle}>첫 1개월 집중 세팅</h2>
          <p className={styles.sectionDesc}>
            구독 후 첫 1개월은 가장 중요한 시간입니다.
            <br />
            재무 상태 완벽히 파악 / 목표 시나리오 설계 / 모든 계좌와 대시보드
            세팅
          </p>
        </div>

        {/* 결제 직후 */}
        <div className={styles.onboardingIntro}>
          <div className={styles.onboardingIntroIcon}>
            <Sparkles size={24} />
          </div>
          <div className={styles.onboardingIntroContent}>
            <h3>결제 직후: 즉시 실행 액션플랜 전송</h3>
            <div className={styles.actionList}>
              <div className={styles.actionGroup}>
                <h4>지금 즉시 해야 할 일 3가지</h4>
                <ul>
                  <li>연금저축 계좌 개설 (아직 없다면)</li>
                  <li>ISA 계좌 개설 (아직 없다면)</li>
                  <li>IRP 계좌 개설 (퇴직연금 수령 대비)</li>
                </ul>
              </div>
              <div className={styles.actionGroup}>
                <h4>최적의 시나리오를 만들기 위한 자료 요청</h4>
                <ul>
                  <li>현재 보유 계좌 목록</li>
                  <li>대출 이율 및 상환 조건</li>
                  <li>기존 투자 포트폴리오 내역</li>
                  <li>보험 증권 사본</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* 타임라인 */}
        <div className={styles.timeline}>
          {onboardingTimeline.map((item, idx) => (
            <div
              key={idx}
              className={`${styles.timelineItem} ${expandedTimeline === idx ? styles.expanded : ""}`}
            >
              <button
                className={styles.timelineHeader}
                onClick={() => toggleTimeline(idx)}
              >
                <div className={styles.timelineDay}>{item.day}</div>
                <div className={styles.timelineTitle}>
                  <span>{item.title}</span>
                  {item.duration && (
                    <span className={styles.timelineDuration}>
                      {item.duration}
                    </span>
                  )}
                </div>
                {expandedTimeline === idx ? (
                  <ChevronUp size={20} />
                ) : (
                  <ChevronDown size={20} />
                )}
              </button>
              {expandedTimeline === idx && (
                <div className={styles.timelineContent}>
                  <ul>
                    {item.items.map((content, i) => (
                      <li key={i}>{content}</li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 계좌 세팅 */}
        <div className={styles.accountSetup}>
          <h3>필수 개설/등록 계좌</h3>
          <div className={styles.accountGrid}>
            <div className={styles.accountItem}>연금저축 계좌</div>
            <div className={styles.accountItem}>ISA 계좌</div>
            <div className={styles.accountItem}>IRP 계좌</div>
            <div className={styles.accountItem}>기존 투자 계좌</div>
            <div className={styles.accountItem}>입출금 통장</div>
            <div className={styles.accountItem}>비상금 통장</div>
            <div className={styles.accountItem}>청약저축</div>
          </div>
          <div className={styles.accountNote}>
            <strong>통장 분할 개념:</strong> 계좌 자체를 목적별로 재세팅
            <br />
            급여 통장 / 생활비 통장 / 저축 통장 / 투자 통장 분리 + 자동이체
            설정으로 자동화
          </div>
        </div>
      </section>

      {/* Regular Management Section */}
      <section className={styles.sectionAlt}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>정기 관리</span>
          <h2 className={styles.sectionTitle}>연간 정기 관리</h2>
          <p className={styles.sectionDesc}>
            온보딩 이후 11개월 동안 지속적으로 관리.
            <br />
            목표 시나리오대로 자산이 잘 가고 있는지 장기적으로 함께 파악.
          </p>
        </div>
        <div className={styles.managementGrid}>
          {regularManagement.map((item, idx) => (
            <div key={idx} className={styles.managementCard}>
              <div className={styles.managementHeader}>
                <div className={styles.managementIcon}>
                  <item.icon size={24} />
                </div>
                <div className={styles.managementMeta}>
                  <span className={styles.managementPeriod}>{item.period}</span>
                  <span className={styles.managementCount}>{item.count}</span>
                </div>
              </div>
              <h3 className={styles.managementTitle}>{item.title}</h3>
              <p className={styles.managementType}>{item.type}</p>
              <ul className={styles.managementItems}>
                {item.items.map((content, i) => (
                  <li key={i}>{content}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </section>

      {/* Progress Based Motivation */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>Progress-based Motivation</span>
          <h2 className={styles.sectionTitle}>행동을 유도하는 시스템</h2>
        </div>
        <div className={styles.progressGrid}>
          <div className={styles.progressStep}>
            <div className={styles.progressNumber}>1</div>
            <p>
              대시보드에서 <strong>과제가 주어짐</strong>
            </p>
          </div>
          <div className={styles.progressStep}>
            <div className={styles.progressNumber}>2</div>
            <p>
              과제를 완료해야 <strong>다음 미션이 해금</strong>
            </p>
          </div>
          <div className={styles.progressStep}>
            <div className={styles.progressNumber}>3</div>
            <p>
              <strong>목표 달성률(%)</strong>이 실시간으로 업데이트
            </p>
          </div>
          <div className={styles.progressStep}>
            <div className={styles.progressNumber}>4</div>
            <p>
              분기마다 <strong>자산 스냅샷</strong>이 저장되어 성장을 눈으로
              확인
            </p>
          </div>
        </div>
      </section>

      {/* Dashboard Section */}
      <section className={styles.sectionDark}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabelLight}>대시보드</span>
          <h2 className={styles.sectionTitleLight}>Lycon 전용 대시보드</h2>
        </div>
        <div className={styles.dashboardFeatures}>
          <div className={styles.dashboardMenu}>
            <div className={styles.menuItem}>
              <span className={styles.menuIcon}>
                <BarChart3 size={18} />
              </span>
              <span className={styles.menuLabel}>대시보드</span>
              <span className={styles.menuDesc}>
                전체 자산 현황, 목표 달성률, 할 일 목록
              </span>
            </div>
            <div className={styles.menuItem}>
              <span className={styles.menuIcon}>
                <Receipt size={18} />
              </span>
              <span className={styles.menuLabel}>가계부</span>
              <span className={styles.menuDesc}>
                수입/지출 기록, 계좌별 잔액, 월별 현금흐름
              </span>
            </div>
            <div className={styles.menuItem}>
              <span className={styles.menuIcon}>
                <PiggyBank size={18} />
              </span>
              <span className={styles.menuLabel}>정기 예금/적금</span>
              <span className={styles.menuDesc}>
                보유 예적금 현황, 예상 이자, 만기일 관리
              </span>
            </div>
            <div className={styles.menuItem}>
              <span className={styles.menuIcon}>
                <TrendingUp size={18} />
              </span>
              <span className={styles.menuLabel}>투자 포트폴리오</span>
              <span className={styles.menuDesc}>
                계좌별 보유 종목, 평가금액, 손익 차트
              </span>
            </div>
            <div className={styles.menuItem}>
              <span className={styles.menuIcon}>
                <Wallet size={18} />
              </span>
              <span className={styles.menuLabel}>현재 자산</span>
              <span className={styles.menuDesc}>
                순자산, 자산/부채 구성, 저축/투자/부동산 분류
              </span>
            </div>
            <div className={styles.menuItem}>
              <span className={styles.menuIcon}>
                <Target size={18} />
              </span>
              <span className={styles.menuLabel}>시뮬레이션</span>
              <span className={styles.menuDesc}>
                은퇴까지 자산 시뮬레이션, 현금흐름/부동산/부채/연금
              </span>
            </div>
            <div className={styles.menuItem}>
              <span className={styles.menuIcon}>
                <MessageCircle size={18} />
              </span>
              <span className={styles.menuLabel}>채팅/상담</span>
              <span className={styles.menuDesc}>
                담당 전문가와 1:1 메시지, 미팅 예약
              </span>
            </div>
          </div>
          <div className={styles.dashboardValue}>
            <h3>대시보드 핵심 가치</h3>
            <ul>
              <li>
                혼자 채우는 게 아니라, <strong>전문가가 함께 관리</strong>
              </li>
              <li>
                분기마다 자동으로 <strong>자산 스냅샷</strong>이 찍혀서 성장을
                눈으로 확인
              </li>
              <li>
                시뮬레이션이 <strong>내 실제 데이터 기반</strong>으로 업데이트됨
              </li>
              <li>
                앱 열 때마다 <strong>&apos;담당: OOO 전문가&apos;</strong>가
                보여서 관리받는 느낌
              </li>
            </ul>
          </div>
        </div>
      </section>

      {/* Expert Network Section */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>전문가 네트워크</span>
          <h2 className={styles.sectionTitle}>추가 전문 상담이 필요할 때</h2>
          <p className={styles.sectionDesc}>
            Lycon 네트워크를 통해 할인된 가격으로 연결
          </p>
        </div>
        <div className={styles.expertGrid}>
          {expertNetwork.map((expert, idx) => (
            <div key={idx} className={styles.expertCard}>
              <div className={styles.expertIcon}>
                <expert.icon size={24} />
              </div>
              <h3 className={styles.expertTitle}>{expert.title}</h3>
              <p className={styles.expertDesc}>{expert.description}</p>
              <div className={styles.expertBenefit}>{expert.benefit}</div>
              <div className={styles.expertPrice}>
                <span className={styles.priceStrike}>
                  {expert.originalPrice}
                </span>
                <span className={styles.priceNew}>{expert.discountPrice}</span>
              </div>
            </div>
          ))}
        </div>
        <div className={styles.expertTotal}>
          <div className={styles.totalRow}>
            <span>전문가 혜택 총 가치</span>
            <span className={styles.totalOriginal}>정가: 180만원</span>
          </div>
          <div className={styles.totalRow}>
            <span>구독자 가격</span>
            <span className={styles.totalDiscount}>80만원</span>
          </div>
          <div className={styles.totalSaving}>
            <span>절감액</span>
            <span>100만원</span>
          </div>
        </div>
      </section>

      {/* Pricing Section */}
      <section className={styles.sectionPricing}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabelLight}>가격</span>
          <h2 className={styles.sectionTitleLight}>투자 대비 확실한 가치</h2>
        </div>
        <div className={styles.pricingCards}>
          <div className={styles.pricingCard}>
            <div className={styles.pricingLabel}>정가</div>
            <div className={styles.pricingAmount}>
              <span className={styles.pricingValue}>99,000</span>
              <span className={styles.pricingUnit}>원/월</span>
            </div>
            <div className={styles.pricingAnnual}>연간 1,188,000원</div>
          </div>
          <div
            className={`${styles.pricingCard} ${styles.pricingCardFeatured}`}
          >
            <div className={styles.pricingBadge}>초기 고객 특별가</div>
            <div className={styles.pricingLabel}>50% 할인</div>
            <div className={styles.pricingAmount}>
              <span className={styles.pricingValue}>49,000</span>
              <span className={styles.pricingUnit}>원/월</span>
            </div>
            <div className={styles.pricingAnnual}>연간 588,000원</div>
            <button className={styles.pricingCta}>
              지금 시작하기
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
        <div className={styles.pricingComparison}>
          <h3>경쟁사 가격 비교</h3>
          <div className={styles.pricingComparisonTable}>
            <div className={styles.pricingComparisonRow}>
              <span>은행 PB 서비스</span>
              <span>자산 5억 이상 필요</span>
            </div>
            <div className={styles.pricingComparisonRow}>
              <span>Facet (미국)</span>
              <span>약 350만원</span>
            </div>
            <div className={styles.pricingComparisonRow}>
              <span>재무설계사 상담</span>
              <span>회당 30~50만원 (일회성)</span>
            </div>
            <div
              className={`${styles.pricingComparisonRow} ${styles.highlight}`}
            >
              <span>Lycon (초기)</span>
              <span>약 60만원 (Facet의 1/6)</span>
            </div>
          </div>
        </div>
        <div className={styles.pricingIncludes}>
          <h3>구독에 포함된 것</h3>
          <div className={styles.includesList}>
            <div className={styles.includesItem}>
              <Check size={18} />
              <span>1:1 전담 자산관리 전문가 배정</span>
            </div>
            <div className={styles.includesItem}>
              <Check size={18} />
              <span>
                첫 1개월 온보딩 (4회 미팅 + 계좌 세팅 + 시나리오 설계)
              </span>
            </div>
            <div className={styles.includesItem}>
              <Check size={18} />
              <span>주간 가계부 리마인드 (52회)</span>
            </div>
            <div className={styles.includesItem}>
              <Check size={18} />
              <span>월간 점검 + 보고서 (12회)</span>
            </div>
            <div className={styles.includesItem}>
              <Check size={18} />
              <span>분기 정기 미팅 + 리밸런싱 (4회)</span>
            </div>
            <div className={styles.includesItem}>
              <Check size={18} />
              <span>연말정산 세제혜택 점검</span>
            </div>
            <div className={styles.includesItem}>
              <Check size={18} />
              <span>Lycon 전용 대시보드 이용권</span>
            </div>
            <div className={styles.includesItem}>
              <Check size={18} />
              <span>전문가 네트워크 할인 혜택</span>
            </div>
          </div>
        </div>
      </section>

      {/* Facet Comparison */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>비교 분석</span>
          <h2 className={styles.sectionTitle}>Facet vs Lycon</h2>
        </div>
        <div className={styles.facetTable}>
          <div className={styles.facetHeader}>
            <div className={styles.facetHeaderCell}>항목</div>
            <div className={styles.facetHeaderCell}>Facet (미국)</div>
            <div className={styles.facetHeaderCell}>Lycon (한국)</div>
          </div>
          <div className={styles.facetRow}>
            <div className={styles.facetCell}>타겟</div>
            <div className={styles.facetCell}>Mass Affluent ($100K~$1M)</div>
            <div className={styles.facetCell}>40대 직장인 중산층</div>
          </div>
          <div className={styles.facetRow}>
            <div className={styles.facetCell}>핵심</div>
            <div className={styles.facetCell}>CFP + 종합 플래닝</div>
            <div className={styles.facetCell}>
              은퇴 시나리오 + 로드맵 트래킹
            </div>
          </div>
          <div className={styles.facetRow}>
            <div className={styles.facetCell}>온보딩</div>
            <div className={styles.facetCell}>첫해 3-4회 미팅</div>
            <div className={styles.facetCellHighlight}>첫 달 4회 집중</div>
          </div>
          <div className={styles.facetRow}>
            <div className={styles.facetCell}>정기 관리</div>
            <div className={styles.facetCell}>연 2-3회 미팅</div>
            <div className={styles.facetCellHighlight}>월 1회 + 분기 심화</div>
          </div>
          <div className={styles.facetRow}>
            <div className={styles.facetCell}>투자 관리</div>
            <div className={styles.facetCell}>직접 투자 관리 포함</div>
            <div className={styles.facetCell}>자문 (투자 결정은 고객)</div>
          </div>
          <div className={styles.facetRow}>
            <div className={styles.facetCell}>대시보드</div>
            <div className={styles.facetCell}>자산 현황 중심</div>
            <div className={styles.facetCellHighlight}>
              목표 달성률 + 미션 시스템
            </div>
          </div>
          <div className={styles.facetRow}>
            <div className={styles.facetCell}>가격</div>
            <div className={styles.facetCell}>연 $2,600~$8,700</div>
            <div className={styles.facetCellHighlight}>연 60~120만원</div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className={styles.sectionAlt}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>FAQ</span>
          <h2 className={styles.sectionTitle}>자주 묻는 질문</h2>
        </div>
        <div className={styles.faqList}>
          {faqData.map((faq, idx) => (
            <div
              key={idx}
              className={`${styles.faqItem} ${expandedFaq === idx ? styles.expanded : ""}`}
            >
              <button
                className={styles.faqQuestion}
                onClick={() => toggleFaq(idx)}
              >
                <HelpCircle size={20} className={styles.faqIcon} />
                <span>{faq.question}</span>
                {expandedFaq === idx ? (
                  <ChevronUp size={20} />
                ) : (
                  <ChevronDown size={20} />
                )}
              </button>
              {expandedFaq === idx && (
                <div className={styles.faqAnswer}>
                  <p>{faq.answer}</p>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* Core Services */}
      <section className={styles.section}>
        <div className={styles.sectionHeader}>
          <span className={styles.sectionLabel}>핵심 서비스</span>
          <h2 className={styles.sectionTitle}>5가지 핵심 서비스</h2>
        </div>
        <div className={styles.coreServices}>
          <div className={styles.coreService}>
            <div className={styles.coreNumber}>01</div>
            <h3>목표 검증</h3>
            <p>은퇴 목표 기반으로 단기 목표(내 집 마련, 자녀 교육 등)를 검증</p>
          </div>
          <div className={styles.coreService}>
            <div className={styles.coreNumber}>02</div>
            <h3>맞춤 시나리오</h3>
            <p>투자 성향별 시나리오 생성, 매년 시뮬레이션 관리 및 업데이트</p>
          </div>
          <div className={styles.coreService}>
            <div className={styles.coreNumber}>03</div>
            <h3>정기 관리</h3>
            <p>가계부 관리, 연말정산 세제혜택 점검, 포트폴리오 리밸런싱</p>
          </div>
          <div className={styles.coreService}>
            <div className={styles.coreNumber}>04</div>
            <h3>통합 관리</h3>
            <p>모든 자산/재무를 한 곳에서 투명하게 관리</p>
          </div>
          <div className={styles.coreService}>
            <div className={styles.coreNumber}>05</div>
            <h3>대시보드</h3>
            <p>자산 현황, 목표 달성률, 할 일 목록을 한눈에 확인</p>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCta}>
        <h2 className={styles.finalTitle}>
          1년 후, 당신의 자산이
          <br />
          어떻게 달라져 있을지 보여드릴게요
        </h2>
        <p className={styles.finalSubtitle}>
          지금 가입하면 월 49,000원 (초기 고객 한정)
        </p>
        <button className={styles.finalButton}>
          지금 시작하기
          <ArrowRight size={20} />
        </button>
        <p className={styles.finalNote}>
          결제 방식: 연 단위 결제만 가능 | 첫 1개월 불만족 시 전액 환불
        </p>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>Lycon</div>
          <p className={styles.footerTagline}>
            &quot;혼자선 절대 안 할 일들을, 우리와 함께라면 다 하게 됩니다&quot;
          </p>
        </div>
      </footer>
    </div>
  );
}
