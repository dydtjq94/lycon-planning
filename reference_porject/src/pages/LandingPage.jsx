import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Icon } from "@iconify/react";
import styles from "./LandingPage.module.css";

/**
 * LandingPage 컴포넌트
 * Boldin 스타일 은퇴 설계 서비스 랜딩 페이지
 */
function LandingPage() {
  const navigate = useNavigate();
  const [animatedUsers, setAnimatedUsers] = useState(0);

  // Unicorn Studio 스크립트 로드
  useEffect(() => {
    const script = document.createElement("script");
    script.src = "https://cdn.unicorn.studio/v1.3.2/unicornStudio.umd.js";
    script.async = true;
    script.onload = () => {
      if (
        window.UnicornStudio &&
        typeof window.UnicornStudio.init === "function"
      ) {
        window.UnicornStudio.init();
      }
    };
    document.body.appendChild(script);

    return () => {
      if (script.parentNode) {
        script.parentNode.removeChild(script);
      }
    };
  }, []);

  // 숫자 애니메이션
  useEffect(() => {
    const timer = setTimeout(() => {
      const interval = setInterval(() => {
        setAnimatedUsers((prev) => {
          if (prev >= 2500) {
            clearInterval(interval);
            return 2500;
          }
          return prev + 50;
        });
      }, 20);
    }, 300);

    return () => clearTimeout(timer);
  }, []);

  const handleStartService = () => {
    if (window.mixpanel) {
      window.mixpanel.track("랜딩 - 서비스 시작 클릭");
    }
    navigate("/form");
  };

  return (
    <div className={styles.landingContainer}>
      {/* Hero Section */}
      <section className={styles.heroSection}>
        <header className={styles.header}>
          <div className={styles.logo}>Lycon</div>
          <button
            className={styles.loginButton}
            onClick={() => navigate("/consult")}
          >
            로그인
          </button>
        </header>

        <div
          data-us-project="Xtg0otNk0TWXRHRZ3Q8y"
          className={styles.unicornBackground}
        />

        <div className={styles.heroContent}>
          <div className={styles.heroBadge}>
            <Icon icon="solar:verified-check-bold" />
            국내 유일 은퇴 설계 플랫폼
          </div>

          <h1 className={styles.mainTitle}>
            <br />
            <span className={styles.gradientText}>직접 은퇴를 설계</span>하세요
          </h1>

          <p className={styles.subtitle}>
            현재 재무 상태를 입력하면 은퇴 후 30년의 현금흐름을 즉시 확인할 수
            있습니다.
            <br />
            수천만원 상담료? 이제 필요 없습니다.
          </p>

          <div className={styles.heroActions}>
            <button
              className={styles.primaryButton}
              onClick={handleStartService}
            >
              진단 시작하기
              <Icon icon="solar:arrow-right-linear" />
            </button>
          </div>
        </div>

        <div className={styles.scrollIndicator}>
          <Icon icon="solar:alt-arrow-down-linear" />
        </div>
      </section>

      {/* 핵심 가치 섹션 */}
      <section className={styles.valueProposition}>
        <div className={styles.valueHeader}>
          <h2 className={styles.valueTitle}>
            왜 <span className={styles.highlight}>Lycon</span>인가요?
          </h2>
          <p className={styles.valueSubtitle}>
            재무설계사에게 수백만원 내지 않아도 됩니다.
            <br />
            전문가급 도구로 직접 은퇴를 설계하세요.
          </p>
        </div>

        <div className={styles.valueGrid}>
          <div className={styles.valueCard}>
            <div className={styles.valueIcon}>
              <Icon icon="solar:calculator-bold-duotone" />
            </div>
            <h3>정밀한 시뮬레이션</h3>
            <p>인플레이션, 세금, 의료비, 연금까지 모두 반영한 정교한 계산</p>
          </div>

          <div className={styles.valueCard}>
            <div className={styles.valueIcon}>
              <Icon icon="solar:chart-square-bold-duotone" />
            </div>
            <h3>What-If 시나리오</h3>
            <p>"만약 5년 더 일하면?", "저축을 늘리면?" 다양한 가정으로 비교</p>
          </div>

          <div className={styles.valueCard}>
            <div className={styles.valueIcon}>
              <Icon icon="solar:graph-up-bold-duotone" />
            </div>
            <h3>성공 확률 분석</h3>
            <p>몬테카를로 시뮬레이션으로 은퇴 성공 확률을 정확히 계산</p>
          </div>

          <div className={styles.valueCard}>
            <div className={styles.valueIcon}>
              <Icon icon="solar:wallet-money-bold-duotone" />
            </div>
            <h3>연금 최적화</h3>
            <p>국민연금 수령 시기, 퇴직연금 인출 순서 최적화 전략 제시</p>
          </div>
        </div>
      </section>

      {/* 데모 섹션 */}
      <section className={styles.demoSection}>
        <div className={styles.demoContainer}>
          <div className={styles.demoLeft}>
            <div className={styles.demoBadge}>실시간 시뮬레이션</div>
            <h2 className={styles.demoTitle}>
              5분만 투자하면
              <br />
              <span className={styles.highlight}>30년 미래</span>가 보입니다
            </h2>
            <p className={styles.demoDesc}>
              복잡한 엑셀 계산은 이제 그만. 몇 가지 정보만 입력하면 은퇴 후 자산
              변화, 월별 현금흐름, 연금 수령 시뮬레이션까지 한눈에 확인할 수
              있습니다.
            </p>

            <ul className={styles.demoFeatures}>
              <li>
                <Icon icon="solar:check-circle-bold" />
                은퇴 시점 예상 자산 계산
              </li>
              <li>
                <Icon icon="solar:check-circle-bold" />
                월별 인출 가능 금액 산정
              </li>
              <li>
                <Icon icon="solar:check-circle-bold" />
                자산 소진 시점 예측
              </li>
              <li>
                <Icon icon="solar:check-circle-bold" />
                다양한 시나리오 비교 분석
              </li>
            </ul>

            <button className={styles.demoButton} onClick={handleStartService}>
              지금 무료로 체험하기
              <Icon icon="solar:arrow-right-linear" />
            </button>
          </div>

          <div className={styles.demoRight}>
            <div className={styles.demoCard}>
              <div className={styles.demoCardHeader}>
                <div className={styles.demoCardDots}>
                  <span />
                  <span />
                  <span />
                </div>
                <span>은퇴 시뮬레이션 결과</span>
              </div>
              <div className={styles.demoCardBody}>
                <div className={styles.resultSummary}>
                  <div className={styles.resultMain}>
                    <span className={styles.resultLabel}>은퇴 성공 확률</span>
                    <span className={styles.resultScore}>87%</span>
                    <div className={styles.resultBar}>
                      <div
                        className={styles.resultFill}
                        style={{ width: "87%" }}
                      />
                    </div>
                  </div>
                </div>

                <div className={styles.resultGrid}>
                  <div className={styles.resultItem}>
                    <Icon icon="solar:wallet-bold-duotone" />
                    <div>
                      <span className={styles.resultItemLabel}>
                        은퇴 시 자산
                      </span>
                      <span className={styles.resultItemValue}>18.5억</span>
                    </div>
                  </div>
                  <div className={styles.resultItem}>
                    <Icon icon="solar:hand-money-bold-duotone" />
                    <div>
                      <span className={styles.resultItemLabel}>
                        월 인출 가능
                      </span>
                      <span className={styles.resultItemValue}>520만원</span>
                    </div>
                  </div>
                  <div className={styles.resultItem}>
                    <Icon icon="solar:calendar-bold-duotone" />
                    <div>
                      <span className={styles.resultItemLabel}>자산 유지</span>
                      <span className={styles.resultItemValue}>92세까지</span>
                    </div>
                  </div>
                  <div className={styles.resultItem}>
                    <Icon icon="solar:bill-list-bold-duotone" />
                    <div>
                      <span className={styles.resultItemLabel}>연금 수령</span>
                      <span className={styles.resultItemValue}>월 385만</span>
                    </div>
                  </div>
                </div>

                <div className={styles.chartPreview}>
                  <div className={styles.chartTitle}>자산 변화 추이</div>
                  <div className={styles.chartBars}>
                    <div className={styles.chartBarGroup}>
                      <div
                        className={styles.chartBarItem}
                        style={{ height: "45%" }}
                      />
                      <span>현재</span>
                    </div>
                    <div className={styles.chartBarGroup}>
                      <div
                        className={styles.chartBarItem}
                        style={{ height: "65%" }}
                      />
                      <span>5년</span>
                    </div>
                    <div className={styles.chartBarGroup}>
                      <div
                        className={styles.chartBarItem}
                        style={{ height: "85%" }}
                      />
                      <span>10년</span>
                    </div>
                    <div className={styles.chartBarGroup}>
                      <div
                        className={styles.chartBarItemPeak}
                        style={{ height: "100%" }}
                      />
                      <span>은퇴</span>
                    </div>
                    <div className={styles.chartBarGroup}>
                      <div
                        className={styles.chartBarItem}
                        style={{ height: "75%" }}
                      />
                      <span>+10년</span>
                    </div>
                    <div className={styles.chartBarGroup}>
                      <div
                        className={styles.chartBarItem}
                        style={{ height: "50%" }}
                      />
                      <span>+20년</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 상세 섹션 */}
      <section className={styles.featuresSection}>
        <div className={styles.featuresHeader}>
          <h2>전문가급 도구, 누구나 쉽게</h2>
          <p>복잡한 재무 계획을 단순하게 만들었습니다</p>
        </div>

        <div className={styles.featuresGrid}>
          {/* 기능 1 */}
          <div className={styles.featureCard}>
            <div className={styles.featureCardIcon}>
              <Icon icon="solar:document-text-bold-duotone" />
            </div>
            <div className={styles.featureCardContent}>
              <h3>현재 상태 진단</h3>
              <p>
                자산, 부채, 소득, 지출을 입력하면 은퇴 준비 상태를 정확히
                진단합니다.
              </p>
              <ul>
                <li>순자산 현황 파악</li>
                <li>저축률 분석</li>
                <li>은퇴 준비 점수</li>
              </ul>
            </div>
          </div>

          {/* 기능 2 */}
          <div className={styles.featureCard}>
            <div className={styles.featureCardIcon}>
              <Icon icon="solar:graph-new-bold-duotone" />
            </div>
            <div className={styles.featureCardContent}>
              <h3>30년 미래 예측</h3>
              <p>
                은퇴 후 자산이 어떻게 변화하는지, 언제까지 유지되는지
                예측합니다.
              </p>
              <ul>
                <li>연도별 자산 변화</li>
                <li>현금흐름 시뮬레이션</li>
                <li>자산 소진 시점</li>
              </ul>
            </div>
          </div>

          {/* 기능 3 */}
          <div className={styles.featureCard}>
            <div className={styles.featureCardIcon}>
              <Icon icon="solar:slider-vertical-bold-duotone" />
            </div>
            <div className={styles.featureCardContent}>
              <h3>What-If 시나리오</h3>
              <p>다양한 가정을 적용해 최적의 전략을 찾아보세요.</p>
              <ul>
                <li>"은퇴를 2년 늦추면?"</li>
                <li>"저축을 50만원 늘리면?"</li>
                <li>"수익률이 낮아지면?"</li>
              </ul>
            </div>
          </div>

          {/* 기능 4 */}
          <div className={styles.featureCard}>
            <div className={styles.featureCardIcon}>
              <Icon icon="solar:chart-2-bold-duotone" />
            </div>
            <div className={styles.featureCardContent}>
              <h3>몬테카를로 분석</h3>
              <p>수천 번의 시뮬레이션으로 은퇴 성공 확률을 계산합니다.</p>
              <ul>
                <li>확률 기반 분석</li>
                <li>리스크 시나리오</li>
                <li>성공 확률 %</li>
              </ul>
            </div>
          </div>

          {/* 기능 5 */}
          <div className={styles.featureCard}>
            <div className={styles.featureCardIcon}>
              <Icon icon="solar:money-bag-bold-duotone" />
            </div>
            <div className={styles.featureCardContent}>
              <h3>연금 최적화</h3>
              <p>국민연금, 퇴직연금, 개인연금의 최적 수령 전략을 설계합니다.</p>
              <ul>
                <li>수령 시기 최적화</li>
                <li>인출 순서 전략</li>
                <li>세금 효율화</li>
              </ul>
            </div>
          </div>

          {/* 기능 6 */}
          <div className={styles.featureCard}>
            <div className={styles.featureCardIcon}>
              <Icon icon="solar:users-group-rounded-bold-duotone" />
            </div>
            <div className={styles.featureCardContent}>
              <h3>전문가 상담 (선택)</h3>
              <p>더 깊은 분석이 필요하면 CFP 전문가와 1:1 상담을 받으세요.</p>
              <ul>
                <li>시뮬레이션 기반 상담</li>
                <li>맞춤형 전략 제안</li>
                <li>무료 사전상담 30분</li>
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* 사용 방법 섹션 */}
      <section className={styles.howItWorks}>
        <div className={styles.howHeader}>
          <h2>3단계로 끝나는 은퇴 설계</h2>
          <p>복잡할 것 없습니다. 5분이면 충분합니다.</p>
        </div>

        <div className={styles.stepsContainer}>
          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>1</div>
            <div className={styles.stepIcon}>
              <Icon icon="solar:pen-new-square-bold-duotone" />
            </div>
            <h3>재무 정보 입력</h3>
            <p>현재 자산, 소득, 지출 등 기본 정보를 입력합니다.</p>
            <span className={styles.stepTime}>약 5분</span>
          </div>

          <div className={styles.stepArrow}>
            <Icon icon="solar:arrow-right-linear" />
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>2</div>
            <div className={styles.stepIcon}>
              <Icon icon="solar:chart-bold-duotone" />
            </div>
            <h3>결과 확인</h3>
            <p>은퇴 성공 확률, 자산 변화, 현금흐름을 즉시 확인합니다.</p>
            <span className={styles.stepTime}>즉시 확인</span>
          </div>

          <div className={styles.stepArrow}>
            <Icon icon="solar:arrow-right-linear" />
          </div>

          <div className={styles.stepCard}>
            <div className={styles.stepNumber}>3</div>
            <div className={styles.stepIcon}>
              <Icon icon="solar:settings-bold-duotone" />
            </div>
            <h3>전략 최적화</h3>
            <p>시나리오를 조정하며 최적의 은퇴 전략을 찾습니다.</p>
            <span className={styles.stepTime}>무제한</span>
          </div>
        </div>
      </section>

      {/* 비교 섹션 */}
      <section className={styles.comparisonSection}>
        <h2>재무설계사 vs Lycon</h2>
        <p>같은 결과, 다른 비용</p>

        <div className={styles.comparisonTable}>
          <div className={styles.comparisonHeader}>
            <div className={styles.comparisonEmpty} />
            <div className={styles.comparisonCol}>
              <span>재무설계사</span>
            </div>
            <div className={styles.comparisonColHighlight}>
              <span>Lycon</span>
              <div className={styles.recommendBadge}>추천</div>
            </div>
          </div>

          <div className={styles.comparisonRow}>
            <div className={styles.comparisonLabel}>비용</div>
            <div className={styles.comparisonValue}>200~500만원</div>
            <div className={styles.comparisonValueHighlight}>무료</div>
          </div>

          <div className={styles.comparisonRow}>
            <div className={styles.comparisonLabel}>소요 시간</div>
            <div className={styles.comparisonValue}>2~4주</div>
            <div className={styles.comparisonValueHighlight}>5분</div>
          </div>

          <div className={styles.comparisonRow}>
            <div className={styles.comparisonLabel}>시나리오 분석</div>
            <div className={styles.comparisonValue}>제한적</div>
            <div className={styles.comparisonValueHighlight}>무제한</div>
          </div>

          <div className={styles.comparisonRow}>
            <div className={styles.comparisonLabel}>수정 및 업데이트</div>
            <div className={styles.comparisonValue}>추가 비용</div>
            <div className={styles.comparisonValueHighlight}>무료</div>
          </div>

          <div className={styles.comparisonRow}>
            <div className={styles.comparisonLabel}>접근성</div>
            <div className={styles.comparisonValue}>예약 필요</div>
            <div className={styles.comparisonValueHighlight}>24시간</div>
          </div>
        </div>
      </section>

      {/* 후기 섹션 */}
      <section className={styles.testimonialsSection}>
        <h2>사용자 후기</h2>
        <p>이미 2,500명 이상이 Lycon으로 은퇴를 준비하고 있습니다</p>

        <div className={styles.testimonialGrid}>
          <div className={styles.testimonialCard}>
            <div className={styles.testimonialStars}>
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
            </div>
            <p>
              "재무설계사 상담 받으려고 했는데, 여기서 먼저 해보고 충격받았어요.
              상담 안 받아도 될 것 같아요."
            </p>
            <div className={styles.testimonialAuthor}>
              <span className={styles.authorName}>김OO</span>
              <span className={styles.authorInfo}>52세 · 직장인</span>
            </div>
          </div>

          <div className={styles.testimonialCard}>
            <div className={styles.testimonialStars}>
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
            </div>
            <p>
              "엑셀로 계산하다 포기했었는데, 5분만에 다 나오네요. 시나리오
              비교가 정말 유용해요."
            </p>
            <div className={styles.testimonialAuthor}>
              <span className={styles.authorName}>이OO</span>
              <span className={styles.authorInfo}>47세 · 자영업</span>
            </div>
          </div>

          <div className={styles.testimonialCard}>
            <div className={styles.testimonialStars}>
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
              <Icon icon="solar:star-bold" />
            </div>
            <p>
              "국민연금 언제 받아야 하는지 고민이었는데, 시뮬레이션 돌려보니
              답이 나왔어요."
            </p>
            <div className={styles.testimonialAuthor}>
              <span className={styles.authorName}>박OO</span>
              <span className={styles.authorInfo}>58세 · 은퇴 예정</span>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className={styles.finalCta}>
        <div className={styles.finalCtaContent}>
          <h2>은퇴 준비, 더 이상 미루지 마세요</h2>
          <p>
            5분만 투자하면 은퇴 후 30년을 설계할 수 있습니다.
            <br />
            지금 바로 무료로 시작하세요.
          </p>
          <button
            className={styles.finalCtaButton}
            onClick={handleStartService}
          >
            무료 시뮬레이션 시작하기
            <Icon icon="solar:arrow-right-linear" />
          </button>
          <div className={styles.finalCtaNote}>
            <Icon icon="solar:check-circle-bold" />
            <span>가입 없이 바로 시작</span>
            <Icon icon="solar:check-circle-bold" />
            <span>개인정보 수집 없음</span>
            <Icon icon="solar:check-circle-bold" />
            <span>완전 무료</span>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>Lycon</div>
          <p className={styles.footerDesc}>데이터 기반 은퇴 설계 플랫폼</p>
          <div className={styles.footerLinks}>
            <a href="/privacy">개인정보처리방침</a>
            <a href="/terms">이용약관</a>
          </div>
          <p className={styles.footerCopyright}>
            © 2024 Lycon. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;
