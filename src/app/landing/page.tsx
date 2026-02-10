"use client";

import { useEffect, useState, useRef } from "react";
import Link from "next/link";
import { trackPageView } from "@/lib/analytics/mixpanel";
import styles from "../landing.module.css";

export default function LandingPage() {
  const [typedText, setTypedText] = useState("");
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackPageView("landing");
    }
  }, []);

  useEffect(() => {
    const words = ["함께 설계합니다", "함께 준비합니다", "함께 관리합니다"];
    let wordIndex = 0;
    let charIndex = 0;
    let isDeleting = false;
    let timeoutId: NodeJS.Timeout;

    function type() {
      const currentWord = words[wordIndex];

      if (isDeleting) {
        setTypedText(currentWord.substring(0, charIndex - 1));
        charIndex--;
      } else {
        setTypedText(currentWord.substring(0, charIndex + 1));
        charIndex++;
      }

      let typeSpeed = isDeleting ? 50 : 100;

      if (!isDeleting && charIndex === currentWord.length) {
        typeSpeed = 2000;
        isDeleting = true;
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false;
        wordIndex = (wordIndex + 1) % words.length;
        typeSpeed = 500;
      }

      timeoutId = setTimeout(type, typeSpeed);
    }

    const initialTimeout = setTimeout(type, 1000);
    return () => {
      clearTimeout(initialTimeout);
      clearTimeout(timeoutId);
    };
  }, []);

  const currentYear = new Date().getFullYear();

  return (
    <>
      {/* Header - 로고만 */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <Link href="/landing" className={styles.logo}>
            <span className={styles.logoText}>Lycon | Retirement</span>
          </Link>
          <div className={styles.headerActions} />
        </div>
      </header>

      <main>
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroContainer}>
            <div className={styles.heroContent}>
              <h1 className={styles.heroTitle}>
                당신의 은퇴를
                <br />
                <span className={styles.typedWrapper}>
                  <span className={styles.typedText}>{typedText}</span>
                  <span className={styles.cursor}>|</span>
                </span>
              </h1>
              <p className={styles.heroSubtitle}>
                자산가만 재무 전문가를 가질 이유는 없습니다.
                <br />
                모두에게 담당 전문가가 있어야 합니다.
              </p>
              <div className={styles.heroCta}>
                <Link
                  href="/landing/join-waitlist"
                  className={`${styles.btnPrimary} ${styles.btnLarge}`}
                >
                  무료로 은퇴 검진받기
                </Link>
              </div>
            </div>
          </div>
        </section>

        {/* 어려운 용어들 */}
        <section className={styles.complexitySection}>
          <div className={styles.complexityContainer}>
            <h2 className={styles.complexityTitle}>
              이런 것들, 다 알아야 하나요?
            </h2>
            <div className={styles.complexityTerms}>
              <span className={styles.complexityTerm}>
                퇴직금 일시금 vs 연금
              </span>
              <span className={styles.complexityTerm}>IRP 해지하면?</span>
              <span className={styles.complexityTerm}>
                국민연금 조기수령 vs 연기
              </span>
              <span className={styles.complexityTerm}>퇴직연금 DC/DB 차이</span>
              <span className={styles.complexityTerm}>연금저축 중도인출</span>
              <span className={styles.complexityTerm}>ISA 만기 후 어떻게?</span>
              <span className={styles.complexityTerm}>금융소득종합과세</span>
              <span className={styles.complexityTerm}>연금소득세 계산</span>
              <span className={styles.complexityTerm}>
                건보료 피부양자 탈락
              </span>
              <span className={styles.complexityTerm}>
                분리과세 vs 종합과세
              </span>
              <span className={styles.complexityTerm}>퇴직소득세 절세</span>
              <span className={styles.complexityTerm}>세액공제 한도</span>
            </div>
          </div>
        </section>

        {/* Story 1 */}
        <section className={styles.storySection}>
          <div className={styles.storyContainer}>
            <h2 className={styles.storyTitle}>
              카페, 오픈채팅에
              <br />
              물어보고 계신가요?
            </h2>
            <p className={styles.storyDesc}>
              답변은 달리지만, 내 상황에 맞는지 확신이 없죠.
              <br />
              전문가에게 물어보고 싶어도, PB는 수억 자산가만 받습니다.
            </p>
          </div>
        </section>

        {/* Story 2 */}
        <section className={styles.storySectionGray}>
          <div className={styles.storyContainer}>
            <h2 className={styles.storyTitle}>
              결국 중요한 결정은
              <br />
              혼자 내리고 계시죠
            </h2>
            <div className={styles.storyQuestions}>
              <p>집을 살까, 전세를 살까</p>
              <p>퇴직금을 어떻게 굴릴까</p>
              <p>연금은 언제부터 받을까</p>
              <p>노후 자금은 충분할까</p>
            </div>
          </div>
        </section>

        {/* Story 3 */}
        <section className={styles.storySectionHighlight}>
          <div className={styles.storyContainer}>
            <h2 className={styles.storyTitleLight}>
              이제 당신에게도
              <br />
              담당 전문가가 있습니다
            </h2>
            <p className={styles.storyDescLight}>
              건강검진처럼 재무검진을 받고,
              <br />
              맞춤 전략으로 함께 준비하세요.
            </p>
            <div className={styles.expertNetwork}>
              <div className={styles.expertMain}>
                <span className={styles.expertMainTitle}>은퇴설계 전문가</span>
                <span className={styles.expertMainDesc}>
                  당신의 담당 전문가로서 전체 과정을 함께합니다
                </span>
              </div>
              <div className={styles.expertPartners}>
                <span className={styles.expertPartnersLabel}>
                  협력 전문가 네트워크
                </span>
                <div className={styles.expertList}>
                  <span>
                    세무사 <em>세금/절세</em>
                  </span>
                  <span>
                    회계사 <em>자산관리</em>
                  </span>
                  <span>
                    변호사 <em>법률자문</em>
                  </span>
                  <span>
                    부동산 전문가 <em>부동산</em>
                  </span>
                  <span>
                    노무사 <em>퇴직금</em>
                  </span>
                  <span>
                    자산운용사 <em>투자</em>
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 재무검진 프로그램 */}
        <section className={styles.checkupSection}>
          <div className={styles.checkupContainer}>
            <span className={styles.checkupBadge}>건강검진처럼, 재무검진</span>
            <h2 className={styles.checkupTitle}>기본형 종합 재무검진</h2>
            <p className={styles.checkupSubtitle}>
              은퇴설계 전문가와 1:1로 진행하는 은퇴 진단
            </p>

            <div className={styles.checkupTags}>
              <span>소득</span>
              <span>지출</span>
              <span>자산</span>
              <span>부채</span>
              <span>연금</span>
              <span>투자</span>
            </div>

            <div className={styles.checkupInfo}>
              <span>온라인 또는 대면</span>
              <span className={styles.checkupDot}></span>
              <span>약 30분</span>
              <span className={styles.checkupDot}></span>
              <span>
                <span className={styles.priceOriginal}>249,000원</span>{" "}
                <span className={styles.priceFree}>무료</span>
              </span>
            </div>

            <p className={styles.checkupNote}>
              검진 후 은퇴 진단 보고서와 맞춤 재무 전략을 제공해드립니다.
            </p>

            <Link
              href="/landing/join-waitlist"
              className={`${styles.btnPrimary} ${styles.btnLarge} ${styles.checkupCta}`}
            >
              예약하기
            </Link>
          </div>
        </section>

        {/* CTA Section */}
        <section className={styles.ctaSection}>
          <div className={styles.container}>
            <h2 className={styles.ctaTitle}>30분이면 충분합니다</h2>
            <p className={styles.ctaDesc}>
              은퇴 준비, 어디서부터 시작해야 할지 막막하셨다면
              <br />
              전문가와의 첫 상담으로 방향을 잡아보세요.
            </p>
            <Link
              href="/landing/join-waitlist"
              className={`${styles.btnPrimary} ${styles.btnLarge}`}
            >
              무료로 은퇴 검진받기
            </Link>
            <p className={styles.ctaNote}>이제 혼자 고민하지 않아도 됩니다.</p>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div
            className={`${styles.footerBottom} ${styles.footerBottomInline}`}
          >
            <Link
              href="/landing"
              className={`${styles.logo} ${styles.footerLogo}`}
            >
              <span className={styles.logoText}>Lycon | Retirement</span>
            </Link>
            <p className={styles.footerCopyright}>
              &copy; {currentYear} Lycon. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  );
}
