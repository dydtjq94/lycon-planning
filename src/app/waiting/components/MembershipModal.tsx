"use client";

import { useEffect, useState } from "react";
import { X, Check } from "lucide-react";
import styles from "./MembershipModal.module.css";

interface MembershipModalProps {
  isOpen: boolean;
  onClose: () => void;
}

const MEMBERSHIP_BENEFITS = [
  {
    category: "지속적인 재무 관리",
    items: [
      "월 1회 정기 재무 상담",
      "실시간 자산 변동 모니터링",
      "맞춤형 포트폴리오 리밸런싱",
    ],
  },
  {
    category: "세무 및 절세 전략",
    items: [
      "연말정산 최적화 컨설팅",
      "종합소득세 신고 지원",
      "절세 전략 수립 및 실행",
    ],
  },
  {
    category: "연금 및 은퇴 설계",
    items: [
      "국민연금 수령 전략 최적화",
      "개인연금 운용 컨설팅",
      "은퇴 후 현금흐름 시뮬레이션",
    ],
  },
  {
    category: "우선 지원",
    items: [
      "전담 매니저 배정",
      "24시간 내 응답 보장",
      "긴급 상담 우선 예약",
    ],
  },
];

export function MembershipModal({ isOpen, onClose }: MembershipModalProps) {
  const [isAnimating, setIsAnimating] = useState(false);
  const [contentVisible, setContentVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      // 모달 열릴 때
      setIsAnimating(true);
      const timer = setTimeout(() => {
        setContentVisible(true);
      }, 200);
      return () => clearTimeout(timer);
    } else {
      // 모달 닫힐 때
      setContentVisible(false);
      const timer = setTimeout(() => {
        setIsAnimating(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  // 닫기 핸들러
  const handleClose = () => {
    setContentVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  };

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape" && isOpen) {
        handleClose();
      }
    };
    window.addEventListener("keydown", handleEsc);
    return () => window.removeEventListener("keydown", handleEsc);
  }, [isOpen]);

  // body 스크롤 방지
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden";
    } else {
      document.body.style.overflow = "";
    }
    return () => {
      document.body.style.overflow = "";
    };
  }, [isOpen]);

  if (!isAnimating && !isOpen) return null;

  return (
    <div
      className={`${styles.overlay} ${isOpen ? styles.overlayVisible : ""}`}
      onClick={handleClose}
    >
      <div
        className={`${styles.container} ${isOpen ? styles.containerVisible : ""}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* 닫기 버튼 */}
        <button
          className={styles.closeButton}
          onClick={handleClose}
          aria-label="닫기"
        >
          <X size={24} />
        </button>

        {/* 스크롤 가능한 콘텐츠 */}
        <div className={styles.scrollContent}>
          {/* 헤더 */}
          <div
            className={`${styles.header} ${contentVisible ? styles.headerVisible : ""}`}
          >
            <div className={styles.badge}>Premium</div>
            <h1 className={styles.title}>Lycon Membership</h1>
            <p className={styles.subtitle}>
              평생 재무 건강을 위한
              <br />
              프리미엄 멤버십
            </p>
          </div>

          {/* 혜택 섹션 */}
          <div className={styles.benefits}>
            {MEMBERSHIP_BENEFITS.map((section, sectionIndex) => (
              <div
                key={section.category}
                className={`${styles.benefitSection} ${
                  contentVisible ? styles.benefitSectionVisible : ""
                }`}
                style={{
                  animationDelay: `${0.1 + sectionIndex * 0.08}s`,
                }}
              >
                <h3 className={styles.benefitCategory}>{section.category}</h3>
                <ul className={styles.benefitList}>
                  {section.items.map((item, itemIndex) => (
                    <li
                      key={itemIndex}
                      className={styles.benefitItem}
                    >
                      <div className={styles.checkIcon}>
                        <Check size={16} />
                      </div>
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>

          {/* 가격 섹션 */}
          <div
            className={`${styles.pricingSection} ${
              contentVisible ? styles.pricingSectionVisible : ""
            }`}
          >
            <div className={styles.pricingCard}>
              <div className={styles.pricingLabel}>월 구독료</div>
              <div className={styles.pricingAmount}>
                <span className={styles.pricingCurrency}>월</span>
                <span className={styles.pricingValue}>99,000</span>
                <span className={styles.pricingUnit}>원</span>
              </div>
              <div className={styles.pricingNote}>
                VAT 포함 / 언제든 해지 가능
              </div>
            </div>
          </div>

          {/* CTA 버튼 */}
          <div className={styles.ctaSection}>
            <button
              className={`${styles.ctaButton} ${
                contentVisible ? styles.ctaButtonVisible : ""
              }`}
              onClick={() => {
                // TODO: 실제 구독 처리
                alert("멤버십 가입 기능은 준비 중입니다.");
              }}
            >
              지금 시작하기
            </button>
            <p className={styles.ctaNote}>
              첫 달 무료 체험 후 자동 결제됩니다
            </p>
          </div>
        </div>

        {/* 배경 장식 요소 */}
        <div className={styles.decorCircle1} />
        <div className={styles.decorCircle2} />
        <div className={styles.decorCircle3} />
      </div>
    </div>
  );
}
