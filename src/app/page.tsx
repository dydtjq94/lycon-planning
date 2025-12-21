import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { Button } from '@/components/ui/button'
import { BarChart3, TrendingUp, Target, ArrowRight, CheckCircle2 } from 'lucide-react'
import styles from './landing.module.css'

export default async function LandingPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (user) {
    redirect('/dashboard')
  }

  return (
    <div className={styles.container}>
      {/* 네비게이션 */}
      <nav className={styles.nav}>
        <div className={styles.navContent}>
          <Link href="/" className={styles.logo}>
            Lycon
          </Link>
          <div className={styles.navButtons}>
            <Link href="/auth/login">
              <Button variant="ghost">로그인</Button>
            </Link>
            <Link href="/auth/signup">
              <Button>시작하기</Button>
            </Link>
          </div>
        </div>
      </nav>

      {/* 히어로 섹션 */}
      <section className={styles.heroSection}>
        <div className={styles.heroContent}>
          <div className={styles.heroCenter}>
            <div className={styles.badge}>
              <CheckCircle2 />
              무료로 은퇴 계획 시작하기
            </div>
            <h1 className={styles.heroTitle}>
              당신의 은퇴를
              <br />
              <span className={styles.heroTitleHighlight}>정확하게 설계하세요</span>
            </h1>
            <p className={styles.heroDescription}>
              자산, 수입, 지출을 분석하고 은퇴 후 재정 상태를 시뮬레이션합니다.
              데이터 기반의 은퇴 계획으로 불확실성을 줄이세요.
            </p>
          </div>

          <div className={styles.heroButtons}>
            <Link href="/auth/signup">
              <Button size="lg" className={styles.heroButton}>
                무료로 시작하기
                <ArrowRight />
              </Button>
            </Link>
          </div>

          {/* 신뢰 지표 */}
          <div className={styles.trustIndicators}>
            <div className={styles.trustItem}>
              <CheckCircle2 />
              <span>5분 만에 설정</span>
            </div>
            <div className={styles.trustItem}>
              <CheckCircle2 />
              <span>개인정보 보호</span>
            </div>
            <div className={styles.trustItem}>
              <CheckCircle2 />
              <span>무료 사용</span>
            </div>
          </div>
        </div>
      </section>

      {/* 기능 소개 섹션 */}
      <section className={styles.featuresSection}>
        <div className={styles.featuresContent}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>은퇴 준비의 모든 것</h2>
            <p className={styles.sectionDescription}>
              복잡한 재정 분석을 간단하게. 직관적인 도구로 은퇴 계획을 세우세요.
            </p>
          </div>

          <div className={styles.featuresGrid}>
            <div className={styles.featureCard}>
              <div className={styles.featureCardContent}>
                <div className={`${styles.featureIcon} ${styles.featureIconPrimary}`}>
                  <BarChart3 />
                </div>
                <h3 className={styles.featureTitle}>자산 분석</h3>
                <p className={styles.featureDescription}>
                  수입, 지출, 부동산, 금융자산, 부채를 종합적으로 분석합니다. 현재 재정 상태를 한눈에 파악하세요.
                </p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureCardContent}>
                <div className={`${styles.featureIcon} ${styles.featureIconSecondary}`}>
                  <TrendingUp />
                </div>
                <h3 className={styles.featureTitle}>미래 시뮬레이션</h3>
                <p className={styles.featureDescription}>
                  인플레이션과 투자 수익률을 반영한 시뮬레이션으로 은퇴 후 자산 변화를 예측합니다.
                </p>
              </div>
            </div>

            <div className={styles.featureCard}>
              <div className={styles.featureCardContent}>
                <div className={`${styles.featureIcon} ${styles.featureIconTertiary}`}>
                  <Target />
                </div>
                <h3 className={styles.featureTitle}>은퇴 스코어</h3>
                <p className={styles.featureDescription}>
                  5개 카테고리별 점수로 은퇴 준비 상태를 진단하고 개선이 필요한 영역을 파악합니다.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 사용 방법 섹션 */}
      <section className={styles.stepsSection}>
        <div className={styles.stepsContent}>
          <div className={styles.sectionHeader}>
            <h2 className={styles.sectionTitle}>간단한 3단계</h2>
            <p className={styles.sectionDescription}>
              복잡한 설정 없이 바로 시작하세요
            </p>
          </div>

          <div className={styles.stepsList}>
            {[
              { step: 1, title: '회원가입', desc: '이메일로 30초 만에 가입하세요' },
              { step: 2, title: '정보 입력', desc: '수입, 지출, 자산 정보를 입력하세요' },
              { step: 3, title: '결과 확인', desc: '대시보드에서 분석 결과와 시뮬레이션을 확인하세요' },
            ].map((item) => (
              <div key={item.step} className={styles.stepItem}>
                <div className={styles.stepNumber}>{item.step}</div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>{item.title}</h3>
                  <p className={styles.stepDescription}>{item.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA 섹션 */}
      <section className={styles.ctaSection}>
        <div className={styles.ctaContent}>
          <h2 className={styles.ctaTitle}>
            지금 은퇴 계획을 시작하세요
          </h2>
          <p className={styles.ctaDescription}>
            무료로 시작하고, 데이터 기반의 은퇴 설계를 경험하세요
          </p>
          <Link href="/auth/signup">
            <Button size="lg" variant="secondary" className={styles.ctaButton}>
              무료로 시작하기
              <ArrowRight />
            </Button>
          </Link>
        </div>
      </section>

      {/* 푸터 */}
      <footer className={styles.footer}>
        <div className={styles.footerContent}>
          <div className={styles.footerLogo}>Lycon</div>
          <div className={styles.footerCopyright}>
            &copy; {new Date().getFullYear()} Lycon. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
