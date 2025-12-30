'use client'

import { useEffect, useState, useRef } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import styles from './landing.module.css'

export default function LandingPage() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [typedText, setTypedText] = useState('')
  const [brandStoryModalOpen, setBrandStoryModalOpen] = useState(false)
  const [calculatorModalOpen, setCalculatorModalOpen] = useState(false)
  const [startAge, setStartAge] = useState(45)
  const [initialInvestment, setInitialInvestment] = useState(5000)
  const [timelineProgress, setTimelineProgress] = useState(0)
  const [activeMarker, setActiveMarker] = useState<number | null>(null)
  const storyChaptersRef = useRef<(HTMLDivElement | null)[]>([])
  const storyCtaRef = useRef<HTMLDivElement | null>(null)
  const timelineContainerRef = useRef<HTMLDivElement | null>(null)

  // Typed text animation
  useEffect(() => {
    const words = [
      '스마트하게 설계하세요',
      '체계적으로 관리하세요',
      '안전하게 준비하세요',
      '현명하게 계획하세요'
    ]
    let wordIndex = 0
    let charIndex = 0
    let isDeleting = false
    let timeoutId: NodeJS.Timeout

    function type() {
      const currentWord = words[wordIndex]

      if (isDeleting) {
        setTypedText(currentWord.substring(0, charIndex - 1))
        charIndex--
      } else {
        setTypedText(currentWord.substring(0, charIndex + 1))
        charIndex++
      }

      let typeSpeed = isDeleting ? 50 : 100

      if (!isDeleting && charIndex === currentWord.length) {
        typeSpeed = 2000
        isDeleting = true
      } else if (isDeleting && charIndex === 0) {
        isDeleting = false
        wordIndex = (wordIndex + 1) % words.length
        typeSpeed = 500
      }

      timeoutId = setTimeout(type, typeSpeed)
    }

    const initialTimeout = setTimeout(type, 1000)
    return () => {
      clearTimeout(initialTimeout)
      clearTimeout(timeoutId)
    }
  }, [])

  // Timeline progress
  useEffect(() => {
    const chapterToMarkerMap: Record<string, number> = {
      '1': 0, '2': 0, '3': 1, '4': 2, '5': 3, '6': 3, '7': 4
    }

    function updateProgress() {
      const windowHeight = window.innerHeight
      const triggerPoint = windowHeight * 0.4

      // Hide progress bar when Story CTA section is visible
      if (storyCtaRef.current && timelineContainerRef.current) {
        const ctaRect = storyCtaRef.current.getBoundingClientRect()
        if (ctaRect.top < windowHeight * 0.6) {
          timelineContainerRef.current.style.opacity = '0'
          timelineContainerRef.current.style.pointerEvents = 'none'
        } else {
          timelineContainerRef.current.style.opacity = '1'
          timelineContainerRef.current.style.pointerEvents = 'auto'
        }
      }

      let activeChapter: string | null = null

      storyChaptersRef.current.forEach((chapter) => {
        if (chapter) {
          const rect = chapter.getBoundingClientRect()
          const chapterTop = rect.top
          const chapterNum = chapter.getAttribute('data-chapter')

          if (chapterTop < triggerPoint && chapterTop > -rect.height && chapterNum) {
            activeChapter = chapterNum
          }
        }
      })

      let progress = 0
      if (activeChapter) {
        const markerIndex = chapterToMarkerMap[activeChapter]
        progress = markerIndex * (100 / 4)
        setActiveMarker(markerIndex)
      } else {
        setActiveMarker(null)
      }

      setTimelineProgress(progress)
    }

    window.addEventListener('scroll', updateProgress)
    updateProgress()
    return () => window.removeEventListener('scroll', updateProgress)
  }, [])

  // Scroll animations for chapters
  useEffect(() => {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add(styles.visible)
            observer.unobserve(entry.target)
          }
        })
      },
      { threshold: 0.1, rootMargin: '0px 0px -50px 0px' }
    )

    storyChaptersRef.current.forEach((chapter) => {
      if (chapter) observer.observe(chapter)
    })

    return () => observer.disconnect()
  }, [])

  // Calculator logic
  const TARGET_AGE = 65
  const TARGET_AMOUNT = 1000000000
  const ANNUAL_RATE = 0.07
  const MONTHLY_RATE = ANNUAL_RATE / 12

  function formatNumber(num: number) {
    return Math.round(num).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',')
  }

  function formatToEok(num: number) {
    const eok = num / 100000000
    if (eok >= 1) {
      return eok.toFixed(1).replace(/\.0$/, '') + '억원'
    }
    const man = num / 10000
    if (man >= 1) {
      return formatNumber(Math.round(man)) + '만원'
    }
    return formatNumber(num) + '원'
  }

  function formatInitialDisplay(valueInMan: number) {
    if (valueInMan === 0) return '0원'
    if (valueInMan >= 10000) return (valueInMan / 10000) + '억원'
    return formatNumber(valueInMan) + '만원'
  }

  function calculateMonthlyInvestment(age: number, initial: number) {
    const years = TARGET_AGE - age
    const months = years * 12

    if (months <= 0) {
      return { monthlyPayment: 0, monthlyTotal: 0, profit: 0, totalAmount: initial }
    }

    const initialFV = initial * Math.pow(1 + MONTHLY_RATE, months)
    const remainingTarget = TARGET_AMOUNT - initialFV

    if (remainingTarget <= 0) {
      const profit = initialFV - initial
      return { monthlyPayment: 0, monthlyTotal: 0, profit, totalAmount: initialFV }
    }

    const monthlyPayment = remainingTarget * MONTHLY_RATE / (Math.pow(1 + MONTHLY_RATE, months) - 1)
    const monthlyTotal = monthlyPayment * months
    const totalPrincipal = initial + monthlyTotal
    const profit = TARGET_AMOUNT - totalPrincipal

    return { monthlyPayment, monthlyTotal, profit, totalAmount: TARGET_AMOUNT }
  }

  const calcResult = calculateMonthlyInvestment(startAge, initialInvestment * 10000)

  // Close modal on ESC
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setBrandStoryModalOpen(false)
        setCalculatorModalOpen(false)
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Prevent body scroll when modal is open
  useEffect(() => {
    if (brandStoryModalOpen || calculatorModalOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = ''
    }
  }, [brandStoryModalOpen, calculatorModalOpen])

  const currentYear = new Date().getFullYear()

  return (
    <>
      {/* Skip Link */}
      <a href="#main-content" className={styles.skipLink}>본문으로 건너뛰기</a>

      {/* Header */}
      <header className={styles.header}>
        <div className={styles.headerContainer}>
          <Link href="/" className={styles.logo}>
            <span className={styles.logoText}>LYCON</span>
          </Link>

          <nav className={`${styles.navMenu} ${mobileMenuOpen ? styles.navMenuActive : ''}`}>
            <ul className={styles.navList}>
              <li><a href="#stats-section">서비스 소개</a></li>
              <li><a href="#story">시뮬레이션</a></li>
              <li><a href="#pricing">요금제</a></li>
            </ul>
          </nav>

          <div className={styles.headerActions}>
            <Link href="/auth/login" className={styles.btnLogin}>로그인</Link>
            <Link href="/auth/signup" className={`${styles.btnPrimary}`}>무료로 시작하기</Link>
          </div>

          <button
            className={styles.mobileMenuToggle}
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label={mobileMenuOpen ? '메뉴 닫기' : '메뉴 열기'}
          >
            <span></span>
            <span></span>
            <span></span>
          </button>
        </div>
      </header>

      <main id="main-content">
        {/* Hero Section */}
        <section className={styles.hero}>
          <div className={styles.heroContainer}>
            <div className={styles.heroContent}>
              <div className={styles.heroBadge}>
                <span className={styles.heroBadgeDot}></span>
                <span>간편한 은퇴 준비의 시작</span>
              </div>
              <h1 className={styles.heroTitle}>
                당신의 은퇴를<br />
                <span className={styles.typedWrapper}>
                  <span className={styles.typedText}>{typedText}</span>
                  <span className={styles.cursor}>|</span>
                </span>
              </h1>
              <p className={styles.heroSubtitle}>
                복잡한 은퇴 준비를 간단하게 시각화하고,<br />
                놓치고 있던 선택지들을 알려드립니다.
              </p>
              <div className={styles.heroCta}>
                <button onClick={() => setCalculatorModalOpen(true)} className={`${styles.btnPrimary} ${styles.btnLarge}`}>
                  무료로 시작하기
                </button>
                <a href="#stats-section" className={`${styles.btnSecondary} ${styles.btnLarge}`}>
                  서비스 알아보기
                </a>
              </div>
            </div>
          </div>
        </section>

        {/* Statistics Section */}
        <section className={styles.statsSection} id="stats-section">
          <div className={styles.container}>
            <div className={styles.statsContent}>
              <div className={styles.statsHeader}>
                <span className={styles.statsLabel}>노후준비가 필요한가요?</span>
                <h2 className={styles.statsTitle}>대부분이 알고 있지만,<br />준비된 사람은 많지 않습니다</h2>
              </div>
              <div className={styles.statsGrid}>
                <div className={`${styles.statCard} ${styles.statCardLarge}`}>
                  <div className={styles.statNumber}>77.8<span className={styles.statUnit}>%</span></div>
                  <div className={styles.statDesc}>노후 준비가 필요하다고<br />느끼는 가구</div>
                </div>
                <div className={styles.statDivider}>
                  <span className={styles.dividerText}>하지만</span>
                </div>
                <div className={`${styles.statCard} ${styles.statCardHighlight}`}>
                  <div className={styles.statNumber}>19.1<span className={styles.statUnit}>%</span></div>
                  <div className={styles.statDesc}>실제로 준비가 잘 되어있다고<br />응답한 비율</div>
                </div>
              </div>
              <p className={styles.statsInsight}>
                <strong>5명 중 4명</strong>은 준비의 필요성을 알면서도, 제대로 시작하지 못하고 있습니다.
              </p>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className={styles.features} id="features">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>FEATURES</span>
              <h2 className={styles.sectionTitle}>은퇴 준비를<br />함께 해드리겠습니다</h2>
              <p className={styles.sectionSubtitle}>
                고액자산가를 위한 개인 자산운용사(PB)처럼,<br />
                당신만을 위한 맞춤형 은퇴 설계를 제공합니다.
              </p>
            </div>
            <div className={styles.featuresGrid}>
              <div className={styles.featureCard}>
                <div className={styles.featureIllustration}>
                  <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="20" y="30" width="80" height="60" rx="4"/>
                    <path d="M20 45h80"/>
                    <circle cx="35" cy="37" r="3"/>
                    <circle cx="45" cy="37" r="3"/>
                    <circle cx="55" cy="37" r="3"/>
                    <rect x="30" y="55" width="25" height="8" rx="2"/>
                    <rect x="30" y="68" width="40" height="8" rx="2"/>
                    <rect x="65" y="55" width="25" height="21" rx="2"/>
                  </svg>
                </div>
                <h3 className={styles.featureTitle}>진단</h3>
                <p className={styles.featureDesc}>
                  재무 상태를 빠르게 분석하고<br />은퇴 준비 상태를 확인하세요
                </p>
                <button onClick={() => setCalculatorModalOpen(true)} className={styles.btnFeature}>무료로 진단받기</button>
                <span className={styles.featurePrice}>5분 소요</span>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIllustration}>
                  <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <rect x="15" y="20" width="90" height="70" rx="4"/>
                    <path d="M25 70 L40 50 L55 60 L75 35 L95 45"/>
                    <circle cx="40" cy="50" r="3" fill="currentColor"/>
                    <circle cx="55" cy="60" r="3" fill="currentColor"/>
                    <circle cx="75" cy="35" r="3" fill="currentColor"/>
                    <circle cx="95" cy="45" r="3" fill="currentColor"/>
                    <path d="M25 80h70" strokeDasharray="4 2"/>
                  </svg>
                </div>
                <h3 className={styles.featureTitle}>시뮬레이션</h3>
                <p className={styles.featureDesc}>
                  다양한 시나리오로 미래를<br />예측하고 최적의 계획을 만드세요
                </p>
                <button onClick={() => setCalculatorModalOpen(true)} className={styles.btnFeature}>시뮬레이션 체험</button>
                <span className={styles.featurePrice}>다양한 시나리오</span>
              </div>
              <div className={styles.featureCard}>
                <div className={styles.featureIllustration}>
                  <svg viewBox="0 0 120 100" fill="none" stroke="currentColor" strokeWidth="1.5">
                    <path d="M60 15 L60 25"/>
                    <circle cx="60" cy="40" r="20"/>
                    <path d="M60 40 L60 30"/>
                    <path d="M60 40 L70 45"/>
                    <rect x="25" y="70" width="70" height="20" rx="4"/>
                    <path d="M35 80h50"/>
                  </svg>
                </div>
                <h3 className={styles.featureTitle}>가이드</h3>
                <p className={styles.featureDesc}>
                  맞춤형 액션 플랜으로<br />목표 달성을 도와드립니다
                </p>
                <a href="#pricing" className={styles.btnFeature}>플랜 확인하기</a>
                <span className={styles.featurePrice}>연금 최적화부터 세금까지</span>
              </div>
            </div>
          </div>
        </section>

        {/* Misconception Section */}
        <section className={styles.misconceptionSection} id="misconception">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>RETIREMENT</span>
              <h2 className={styles.sectionTitle}>대부분은 은퇴 준비에 대해<br /> 잘못 생각하고 있습니다</h2>
              <p className={styles.sectionSubtitle}>
                은퇴 준비는 수익률 경쟁이 아니라<br />
                끊기지 않는 삶을 설계하는 문제입니다.
              </p>
            </div>
            <div className={styles.misconceptionGrid}>
              <div className={styles.misconceptionCard}>
                <div className={styles.misconceptionIcon}>
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="14" cy="14" r="6"/>
                    <circle cx="34" cy="34" r="6"/>
                    <path d="M38 10L10 38"/>
                  </svg>
                </div>
                <span className={styles.misconceptionLabel}>오해 1</span>
                <h3 className={styles.misconceptionTitle}>수익률만 높이면 해결된다</h3>
                <p className={styles.misconceptionDesc}>
                  은퇴 준비의 본질은 최대 수익이 아니라 안정적인 현금흐름 창출입니다.
                </p>
                <p className={styles.misconceptionSummary}>
                  은퇴는 재테크가 아닌 인생 설계입니다
                </p>
              </div>
              <div className={styles.misconceptionCard}>
                <div className={styles.misconceptionIcon}>
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M10 18h8v-4a4 4 0 0 1 8 0v4h12v12h-4a4 4 0 0 0 0 8h4v8H10V18z"/>
                    <path d="M18 30a4 4 0 0 1 0-8" strokeDasharray="2 2"/>
                  </svg>
                </div>
                <span className={styles.misconceptionLabel}>오해 2</span>
                <h3 className={styles.misconceptionTitle}>좋은 투자 하나면 된다</h3>
                <p className={styles.misconceptionDesc}>
                  은퇴는 투자, 연금, 세금, 주택 등 종합적으로 설계되어야 합니다. 투자 하나만 보는 순간, 노후 설계는 반쪽이 됩니다.
                </p>
                <p className={styles.misconceptionSummary}>
                  투자는 편안한 노후를 위한 수단이지, 답이 아닙니다
                </p>
              </div>
              <div
                className={`${styles.misconceptionCard} ${styles.misconceptionCardClickable}`}
                onClick={() => setCalculatorModalOpen(true)}
              >
                <div className={styles.misconceptionIcon}>
                  <svg viewBox="0 0 48 48" fill="none" stroke="currentColor" strokeWidth="2">
                    <circle cx="24" cy="24" r="18"/>
                    <path d="M24 14v10l7 7"/>
                  </svg>
                </div>
                <span className={styles.misconceptionLabel}>오해 3</span>
                <h3 className={styles.misconceptionTitle}>나중에 준비해도 된다</h3>
                <p className={styles.misconceptionDesc}>
                  은퇴는 여러 선택들이 모여진 결과입니다.
                  시작이 늦어질수록 선택지는 줄고 비용은 커집니다.
                </p>
                <button className={styles.misconceptionSummaryBtn}>
                  직접 계산해보기
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Planning Approach Section */}
        <section className={styles.planningSection} id="approach">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>OUR APPROACH</span>
              <h2 className={styles.sectionTitle}>우리는 상품이 아니라<br />&apos;계획&apos;을 만듭니다</h2>
              <p className={styles.sectionSubtitle}>
                목표 없는 투자는 방향 없는 운전과 같습니다.<br />
                숫자로 확인할 수 있는 은퇴 계획부터 시작합니다.
              </p>
            </div>
            <div className={styles.planningSteps}>
              <div className={styles.planningStep}>
                <div className={styles.stepNumber}>1</div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>현실적인 목표 설정</h3>
                  <ul className={styles.stepPoints}>
                    <li>언제 은퇴할지</li>
                    <li>은퇴 후 매달 얼마가 필요한지</li>
                    <li>어떤 생활 수준을 원하는지부터 정의</li>
                  </ul>
                </div>
              </div>
              <div className={styles.stepConnector}></div>
              <div className={styles.planningStep}>
                <div className={styles.stepNumber}>2</div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>여러 선택지를 동시에 시뮬레이션</h3>
                  <ul className={styles.stepPoints}>
                    <li>집을 유지할 경우 / 매각할 경우</li>
                    <li>연금 중심 / 배당 중심 / 혼합 전략</li>
                    <li>하나의 답이 아니라 여러 시나리오 제시</li>
                  </ul>
                </div>
              </div>
              <div className={styles.stepConnector}></div>
              <div className={styles.planningStep}>
                <div className={styles.stepNumber}>3</div>
                <div className={styles.stepContent}>
                  <h3 className={styles.stepTitle}>지금 당장 실행할 수 있는 액션 플랜</h3>
                  <ul className={styles.stepPoints}>
                    <li>이번 달 무엇을 해야 하는지</li>
                    <li>어떤 계좌를 먼저 정리해야 하는지</li>
                    <li>우선순위가 명확한 가이드 제공</li>
                  </ul>
                </div>
              </div>
            </div>
            <div className={styles.planningFooter}>
              <p className={styles.planningMessage}>
                은퇴 준비는 더 높은 수익을 찾는 일이 아니라<br />
                <strong>후회 없는 선택을 미리 해두는 과정</strong>입니다.
              </p>
              <button onClick={() => setCalculatorModalOpen(true)} className={`${styles.btnPrimary} ${styles.btnLarge}`}>
                내 은퇴 계획 시뮬레이션 해보기
              </button>
            </div>
          </div>
        </section>

        {/* Story Comparison Section */}
        <section className={styles.storySection} id="story">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>WHY PLANNING MATTERS</span>
              <h2 className={styles.sectionTitle}>같은 시작, 다른 미래</h2>
              <p className={styles.sectionSubtitle}>
                같은 조건에서 시작한 두 사람의 이야기입니다.
              </p>
            </div>

            {/* Timeline Progress Bar */}
            <div className={styles.timelineProgressContainer} ref={timelineContainerRef}>
              <div className={styles.timelineInner}>
                <div className={styles.timelineProgressBar}>
                  <div className={styles.timelineProgressFill} style={{ width: `${timelineProgress}%` }}></div>
                </div>
                <div className={styles.timelineMarkers}>
                  {[
                    { age: '45세', chapter: 1 },
                    { age: '55세', chapter: 3 },
                    { age: '60세', chapter: 4 },
                    { age: '65세', chapter: 5 },
                    { age: '70세', chapter: 7 }
                  ].map((marker, index) => (
                    <div
                      key={marker.age}
                      className={`${styles.timelineMarker} ${activeMarker !== null && index < activeMarker ? styles.passed : ''} ${activeMarker === index ? styles.active : ''}`}
                    >
                      <span className={styles.markerDot}></span>
                      <span className={styles.markerLabel}>{marker.age}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className={styles.storyTimeline}>
              {/* Chapter 1 */}
              <div
                className={styles.storyChapter}
                data-chapter="1"
                ref={(el) => { storyChaptersRef.current[0] = el }}
              >
                <div className={styles.chapterHeader}>
                  <span className={styles.chapterNumber}>CHAPTER 1</span>
                  <h3 className={styles.chapterTitle}>시작점, 같은 고민</h3>
                  <span className={styles.chapterAge}>45세</span>
                </div>
                <div className={styles.unifiedCard}>
                  <div className={styles.unifiedCardHeader}>
                    <span className={styles.unifiedLabel}>지혁 & 경표</span>
                  </div>
                  <div className={styles.unifiedCardContent}>
                    <ul className={styles.unifiedPoints}>
                      <li>순자산 5억원, 월소득 550만원</li>
                      <li>아파트 1채 보유, 대출 1억원</li>
                      <li>60세 은퇴 목표</li>
                    </ul>
                  </div>
                  <div className={styles.unifiedCardThoughts}>
                    <div className={`${styles.thoughtBubble} ${styles.thoughtBubbleWithout}`}>
                      <span className={styles.thoughtName}>지혁</span>
                      <p>&quot;아직 시간이 많이 남아 있으니까...&quot;</p>
                    </div>
                    <div className={`${styles.thoughtBubble} ${styles.thoughtBubbleWith}`}>
                      <span className={styles.thoughtName}>경표</span>
                      <p>&quot;지금부터 제대로 준비하자&quot;</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chapter 2 */}
              <div
                className={styles.storyChapter}
                data-chapter="2"
                ref={(el) => { storyChaptersRef.current[1] = el }}
              >
                <div className={styles.chapterHeader}>
                  <span className={styles.chapterNumber}>CHAPTER 2</span>
                  <h3 className={styles.chapterTitle}>다른 선택</h3>
                  <span className={styles.chapterAge}>45세</span>
                </div>
                <div className={styles.comparisonCard}>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWithout}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>지혁</span>
                    </div>
                    <div className={styles.sideContent}>
                      <ul className={styles.sidePoints}>
                        <li>구체적인 목표 없음</li>
                        <li>남들따라 테슬라 주식 구매</li>
                        <li>승진을 위해 최선을 다해 일하는 중</li>
                      </ul>
                      <p className={styles.sideQuote}>&quot;열심히 일하면 은퇴 뭐 어떻게든 되겠지...&quot;</p>
                    </div>
                  </div>
                  <div className={styles.comparisonDivider}>
                    <span>VS</span>
                  </div>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWith}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>경표 + Lycon</span>
                    </div>
                    <div className={styles.sideContent}>
                      <ul className={styles.sidePoints}>
                        <li>목표 자산 10억원 설정</li>
                        <li>목표 연수익률 7%</li>
                        <li>리스크 시나리오 분석</li>
                      </ul>
                      <p className={styles.sideQuote}>&quot;데이터를 보고 미리미리 계획하자&quot;</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chapter 3 */}
              <div
                className={styles.storyChapter}
                data-chapter="3"
                ref={(el) => { storyChaptersRef.current[2] = el }}
              >
                <div className={styles.chapterHeader}>
                  <span className={styles.chapterNumber}>CHAPTER 3</span>
                  <h3 className={styles.chapterTitle}>예상치 못한 순간, 조기 퇴직</h3>
                  <span className={styles.chapterAge}>55세</span>
                </div>
                <div className={styles.comparisonCard}>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWithout}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>지혁</span>
                    </div>
                    <div className={styles.sideContent}>
                      <ul className={styles.sidePoints}>
                        <li>준비되지 않은 구직 활동</li>
                        <li>부담스러운 자녀 대학등록금</li>
                        <li>현금부족으로 부동산 매각</li>
                      </ul>
                      <p className={styles.sideQuote}>&quot;이럴 줄 몰랐는데...&quot;</p>
                    </div>
                  </div>
                  <div className={styles.comparisonDivider}>
                    <span>VS</span>
                  </div>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWith}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>경표 + Lycon</span>
                    </div>
                    <div className={styles.sideContent}>
                      <ul className={styles.sidePoints}>
                        <li>준비해둔 자격증으로 재취업</li>
                        <li>별도로 준비해둔 비상자금</li>
                        <li>소득 공백기 없음</li>
                      </ul>
                      <p className={styles.sideQuote}>&quot;미리 준비해두길 잘했다&quot;</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chapter 4 */}
              <div
                className={styles.storyChapter}
                data-chapter="4"
                ref={(el) => { storyChaptersRef.current[3] = el }}
              >
                <div className={styles.chapterHeader}>
                  <span className={styles.chapterNumber}>CHAPTER 4</span>
                  <h3 className={styles.chapterTitle}>15년 후, 목표 은퇴시점</h3>
                  <span className={styles.chapterAge}>60세</span>
                </div>
                <div className={styles.comparisonCard}>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWithout}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>지혁</span>
                    </div>
                    <div className={styles.sideContent}>
                      <div className={styles.chartPlaceholder}>
                        <svg className={`${styles.chartSvg} ${styles.chartSvgLinear}`} viewBox="0 0 100 40" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="linearFill" x1="0%" y1="0%" x2="100%" y2="0%">
                              <stop offset="0%" style={{ stopColor: 'rgba(255,255,255,0.2)' }}/>
                              <stop offset="100%" style={{ stopColor: 'rgba(255,255,255,0.05)' }}/>
                            </linearGradient>
                          </defs>
                          <path d="M0,35 L100,32 L100,40 L0,40 Z" fill="url(#linearFill)"/>
                          <path d="M0,35 L100,32" stroke="rgba(255,255,255,0.6)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                        </svg>
                        <span className={`${styles.chartDot} ${styles.chartDotStart}`}></span>
                        <span className={`${styles.chartDot} ${styles.chartDotEnd} ${styles.chartDotEndLinear}`}></span>
                      </div>
                      <ul className={styles.sidePoints}>
                        <li>연 평균 수익률 2%</li>
                        <li>퇴직연금: 1억 → <strong>1.34억</strong></li>
                        <li>물가 상승률에도 못 미침</li>
                      </ul>
                    </div>
                  </div>
                  <div className={styles.comparisonDivider}>
                    <span>VS</span>
                  </div>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWith}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>경표 + Lycon</span>
                    </div>
                    <div className={styles.sideContent}>
                      <div className={styles.chartPlaceholder}>
                        <svg className={`${styles.chartSvg} ${styles.chartSvgExponential}`} viewBox="0 0 100 40" preserveAspectRatio="none">
                          <defs>
                            <linearGradient id="expFill" x1="0%" y1="100%" x2="100%" y2="0%">
                              <stop offset="0%" style={{ stopColor: 'rgba(255,255,255,0.1)' }}/>
                              <stop offset="100%" style={{ stopColor: 'rgba(255,255,255,0.3)' }}/>
                            </linearGradient>
                          </defs>
                          <path d="M0,38 Q30,37 50,34 Q70,28 85,18 Q95,8 100,2 L100,40 L0,40 Z" fill="url(#expFill)"/>
                          <path d="M0,38 Q30,37 50,34 Q70,28 85,18 Q95,8 100,2" stroke="rgba(255,255,255,0.95)" strokeWidth="1.5" fill="none" strokeLinecap="round"/>
                        </svg>
                        <span className={`${styles.chartDot} ${styles.chartDotStart}`}></span>
                        <span className={`${styles.chartDot} ${styles.chartDotEnd} ${styles.chartDotEndExponential}`}></span>
                      </div>
                      <ul className={styles.sidePoints}>
                        <li>연 평균 수익률 7%</li>
                        <li>퇴직연금: 1억 → <strong>2.76억</strong></li>
                        <li>+1.42억원 차이 발생</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chapter 5 */}
              <div
                className={styles.storyChapter}
                data-chapter="5"
                ref={(el) => { storyChaptersRef.current[4] = el }}
              >
                <div className={styles.chapterHeader}>
                  <span className={styles.chapterNumber}>CHAPTER 5</span>
                  <h3 className={styles.chapterTitle}>은퇴 후 현금 흐름</h3>
                  <span className={styles.chapterAge}>65세</span>
                </div>
                <div className={styles.comparisonCard}>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWithout}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>지혁</span>
                    </div>
                    <div className={styles.sideContent}>
                      <ul className={styles.sidePoints}>
                        <li>월 수령액: 150만원</li>
                        <li>생활비 부족분 발생</li>
                        <li>자산 가파르게 감소</li>
                      </ul>
                    </div>
                  </div>
                  <div className={styles.comparisonDivider}>
                    <span>VS</span>
                  </div>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWith}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>경표 + Lycon</span>
                    </div>
                    <div className={styles.sideContent}>
                      <ul className={styles.sidePoints}>
                        <li>월 수령액: 600만원</li>
                        <li>생활비 100% + 여유자금</li>
                        <li>자산 유지 및 성장</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chapter 6 */}
              <div
                className={styles.storyChapter}
                data-chapter="6"
                ref={(el) => { storyChaptersRef.current[5] = el }}
              >
                <div className={styles.chapterHeader}>
                  <span className={styles.chapterNumber}>CHAPTER 6</span>
                  <h3 className={styles.chapterTitle}>삶의 질</h3>
                  <span className={styles.chapterAge}>65세 ~ 70세</span>
                </div>
                <div className={styles.comparisonCard}>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWithout}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>지혁</span>
                    </div>
                    <div className={styles.sideContent}>
                      <div className={`${styles.statusIndicator} ${styles.statusIndicatorNegative}`}>
                        <div className={`${styles.statusBar} ${styles.statusBar25}`}></div>
                        <span className={styles.statusText}>삶의 만족도 25%</span>
                      </div>
                      <ul className={styles.sidePoints}>
                        <li>지출마다 스트레스</li>
                        <li>여행/취미 포기</li>
                        <li>자녀에게 부담 전가</li>
                      </ul>
                    </div>
                  </div>
                  <div className={styles.comparisonDivider}>
                    <span>VS</span>
                  </div>
                  <div className={`${styles.comparisonSide} ${styles.comparisonSideWith}`}>
                    <div className={styles.sideHeader}>
                      <span className={styles.sideLabel}>경표 + Lycon</span>
                    </div>
                    <div className={styles.sideContent}>
                      <div className={`${styles.statusIndicator} ${styles.statusIndicatorPositive}`}>
                        <div className={`${styles.statusBar} ${styles.statusBar85}`}></div>
                        <span className={styles.statusText}>삶의 만족도 85%</span>
                      </div>
                      <ul className={styles.sidePoints}>
                        <li>경제적 안정감</li>
                        <li>여행과 취미 생활</li>
                        <li>가족과 함께하는 시간</li>
                      </ul>
                    </div>
                  </div>
                </div>
              </div>

              {/* Chapter 7 */}
              <div
                className={styles.storyChapter}
                data-chapter="7"
                ref={(el) => { storyChaptersRef.current[6] = el }}
              >
                <div className={styles.chapterHeader}>
                  <span className={styles.chapterNumber}>CHAPTER 7</span>
                  <h3 className={styles.chapterTitle}>25년 후의 결과</h3>
                  <span className={styles.chapterAge}>70세</span>
                </div>
                <div className={styles.finalResultCard}>
                  <div className={styles.finalResultHeader}>
                    <span className={styles.finalResultLabel}>같은 출발선, 다른 결과</span>
                    <p className={styles.finalResultSubtitle}>45세 순자산 5억원에서 시작한 두 사람</p>
                  </div>
                  <div className={styles.finalResultComparison}>
                    <div className={`${styles.finalResultSide} ${styles.finalResultSideWithout}`}>
                      <div className={styles.finalResultName}>지혁</div>
                      <div className={`${styles.finalResultAsset} ${styles.finalResultAssetNegative}`}>
                        <span className={styles.assetLabel}>순자산</span>
                        <span className={styles.assetValue}>2.9억원</span>
                        <span className={styles.assetChange}>2.1억 감소</span>
                      </div>
                      <ul className={styles.finalResultPoints}>
                        <li>보유 현금 고갈</li>
                        <li>자녀에게 경제적 의존</li>
                        <li>건강보험료 체납 위기</li>
                      </ul>
                      <div className={`${styles.finalResultQuote} ${styles.finalResultQuoteWithout}`}>
                        <p>&quot;그때 준비했어야 했는데...&quot;</p>
                      </div>
                    </div>
                    <div className={styles.finalResultDivider}>
                      <div className={styles.dividerLine}></div>
                      <span className={styles.dividerYears}>25년</span>
                      <div className={styles.dividerLine}></div>
                    </div>
                    <div className={`${styles.finalResultSide} ${styles.finalResultSideWith}`}>
                      <div className={styles.finalResultName}>경표 + Lycon</div>
                      <div className={`${styles.finalResultAsset} ${styles.finalResultAssetPositive}`}>
                        <span className={styles.assetLabel}>순자산</span>
                        <span className={styles.assetValue}>20.5억원</span>
                        <span className={styles.assetChange}>체계적 관리 성공</span>
                      </div>
                      <ul className={styles.finalResultPoints}>
                        <li>월 600만원 현금흐름</li>
                        <li>자녀에게 1억원 증여</li>
                        <li>여유로운 노후 생활</li>
                      </ul>
                      <div className={`${styles.finalResultQuote} ${styles.finalResultQuoteWith}`}>
                        <p>&quot;준비된 은퇴, 행복한 노후&quot;</p>
                      </div>
                    </div>
                  </div>
                  <div className={styles.finalResultFooter}>
                    <div className={styles.resultDifference}>
                      <span className={styles.differenceLabel}>25년 후 자산 차이</span>
                      <span className={styles.differenceValue}>약 17.6억원</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Story CTA */}
            <div className={styles.storyCta} ref={storyCtaRef}>
              <div className={styles.storyCtaImage}>
                <Image
                  src="/images/chart-comparison.png"
                  alt="시점별 순자산 비교 차트"
                  width={800}
                  height={400}
                />
              </div>
              <p className={styles.storyCtaText}>
                당신은 어떤 미래를 선택하시겠습니까?
              </p>
              <button onClick={() => setCalculatorModalOpen(true)} className={`${styles.btnPrimary} ${styles.btnLarge}`}>
                지금 무료로 진단받기
              </button>
            </div>
          </div>
        </section>

        {/* Case Studies Section */}
        <section className={styles.caseStudies} id="cases">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>SUCCESS STORIES</span>
              <h2 className={styles.sectionTitle}>고객 사례</h2>
            </div>
            <div className={styles.caseStudiesGrid}>
              <div className={`${styles.caseCard} ${styles.caseCardGray}`}>
                <div className={styles.caseCardContent}>
                  <h3 className={styles.caseCardTitle}>40대 맞벌이 부부</h3>
                  <p className={styles.caseCardDesc}>
                    자녀 교육비와 노후 준비를 동시에 해결해야 했던
                    맞벌이 부부의 10년 재무 플랜 성공 사례입니다.
                  </p>
                  <div className={styles.caseCardResult}>
                    <span className={styles.resultLabel}>순자산 증가</span>
                    <span className={styles.resultValue}>+127%</span>
                  </div>
                  <a href="#case-1" className={styles.btnCase}>자세히 보기</a>
                </div>
              </div>
              <div className={`${styles.caseCard} ${styles.caseCardBlueLight}`}>
                <div className={styles.caseCardContent}>
                  <h3 className={styles.caseCardTitle}>1인 가구 프리랜서</h3>
                  <p className={styles.caseCardDesc}>
                    불규칙한 수입 속에서도 체계적인 자산 관리로
                    5년 만에 내 집 마련에 성공한 이야기입니다.
                  </p>
                  <div className={styles.caseCardResult}>
                    <span className={styles.resultLabel}>목표 달성</span>
                    <span className={styles.resultValue}>내 집 마련</span>
                  </div>
                  <a href="#case-2" className={styles.btnCase}>자세히 보기</a>
                </div>
              </div>
              <div className={`${styles.caseCard} ${styles.caseCardBlueMedium}`}>
                <div className={styles.caseCardContent}>
                  <h3 className={styles.caseCardTitle}>50대 조기 은퇴자</h3>
                  <p className={styles.caseCardDesc}>
                    예상치 못한 조기 퇴직 후, Lycon과 함께
                    안정적인 현금 흐름을 만들어낸 재설계 사례입니다.
                  </p>
                  <div className={styles.caseCardResult}>
                    <span className={styles.resultLabel}>월 현금흐름</span>
                    <span className={styles.resultValue}>450만원</span>
                  </div>
                  <a href="#case-3" className={styles.btnCase}>자세히 보기</a>
                </div>
              </div>
              <div className={`${styles.caseCard} ${styles.caseCardBlueDark}`}>
                <div className={styles.caseCardContent}>
                  <h3 className={styles.caseCardTitle}>60대 은퇴 부부</h3>
                  <p className={styles.caseCardDesc}>
                    은퇴 후 자산 인출 전략 최적화로 예상 수명 대비
                    자산 고갈 위험을 제거한 성공 사례입니다.
                  </p>
                  <div className={styles.caseCardResult}>
                    <span className={styles.resultLabel}>자산 수명 연장</span>
                    <span className={styles.resultValue}>+15년</span>
                  </div>
                  <a href="#case-4" className={styles.btnCase}>자세히 보기</a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Brand Story Section */}
        <section className={styles.brandStory} id="about">
          <div className={styles.container}>
            <div className={styles.brandStoryContent}>
              <div className={styles.brandStoryIntro}>
                <span className={styles.sectionLabel}>OUR STORY</span>
                <h2 className={styles.sectionTitle}>Lycon을 만든 이유</h2>
                <p className={styles.brandStoryLead}>
                  은퇴라는 단어가 더 이상 남의 이야기가 아닐 때,<br />
                  준비해야 할 것 같다는 생각은 들지만 무엇부터 해야 할지 모르겠을 때.<br />
                  Lycon은 그 불안 속에서도 판단할 수 있는 기준을 만들어 드립니다.
                </p>
                <button
                  onClick={() => setBrandStoryModalOpen(true)}
                  className={`${styles.btnOutline} ${styles.btnBrandStory}`}
                >
                  브랜드 스토리 전체보기
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M5 12h14M12 5l7 7-7 7"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Pricing Section */}
        <section className={styles.pricing} id="pricing">
          <div className={styles.container}>
            <div className={styles.sectionHeader}>
              <span className={styles.sectionLabel}>PRICING</span>
              <h2 className={styles.sectionTitle}>요금제</h2>
              <p className={styles.sectionSubtitle}>
                필요에 맞는 플랜을 선택하세요.
              </p>
            </div>
            <div className={`${styles.pricingGrid} ${styles.pricingGridTwo}`}>
              <div className={styles.pricingCard}>
                <div className={styles.pricingHeader}>
                  <h3 className={styles.pricingName}>셀프 설계</h3>
                  <div className={styles.pricingPrice}>
                    <span className={styles.priceAmount}>무료</span>
                  </div>
                  <p className={styles.pricingDesc}>직접 나만의 은퇴 계획을 설계하세요</p>
                </div>
                <ul className={styles.pricingFeatures}>
                  <li>은퇴 자금 계산기</li>
                  <li>자산 현황 대시보드</li>
                  <li>기본 시뮬레이션 도구</li>
                  <li>투자 포트폴리오 분석</li>
                  <li>맞춤형 리포트 제공</li>
                </ul>
                <Link href="/auth/signup" className={styles.btnOutline}>무료로 시작하기</Link>
              </div>
              <div className={`${styles.pricingCard} ${styles.pricingPopular}`}>
                <div className={styles.popularBadge}>추천</div>
                <div className={styles.pricingHeader}>
                  <h3 className={styles.pricingName}>전문가 상담</h3>
                  <div className={styles.pricingPrice}>
                    <span className={styles.priceAmount}>99,000</span>
                    <span className={styles.pricePeriod}>/회</span>
                  </div>
                  <p className={styles.pricingDesc}>재무 전문가가 맞춤 솔루션을 설계합니다</p>
                </div>
                <ul className={styles.pricingFeatures}>
                  <li>셀프 설계 모든 기능 포함</li>
                  <li>1:1 재무 전문가 상담</li>
                  <li>상황별 맞춤 솔루션 설계</li>
                  <li>세금 최적화 전략 제안</li>
                  <li>정기 포트폴리오 리밸런싱 가이드</li>
                </ul>
                <a href="#contact" className={styles.btnPrimary}>상담 신청하기</a>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className={styles.footer}>
        <div className={styles.container}>
          <div className={`${styles.footerBottom} ${styles.footerBottomInline}`}>
            <Link href="/" className={`${styles.logo} ${styles.footerLogo}`}>
              <span className={styles.logoText}>LYCON</span>
            </Link>
            <div className={styles.footerLegal}>
              <a href="#">이용약관</a>
              <span className={styles.footerDivider}>|</span>
              <a href="#">개인정보처리방침</a>
            </div>
            <p className={styles.footerCopyright}>&copy; {currentYear} Lycon. All rights reserved.</p>
          </div>
        </div>
      </footer>

      {/* Brand Story Modal */}
      <div className={`${styles.brandStoryModal} ${brandStoryModalOpen ? styles.brandStoryModalActive : ''}`}>
        <div className={styles.modalOverlay} onClick={() => setBrandStoryModalOpen(false)}></div>
        <div className={styles.modalContent}>
          <button className={styles.modalClose} onClick={() => setBrandStoryModalOpen(false)} aria-label="닫기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div className={styles.modalBody}>
            <h2 className={styles.modalTitle}>우리는 왜 Lycon을 만들었을까</h2>

            <div className={styles.storySectionBlock}>
              <p>아직 은퇴한 건 아닙니다.<br />하지만 문득 이런 생각이 들기 시작합니다.</p>
              <blockquote>&quot;이대로 괜찮은 걸까?&quot;</blockquote>
              <p>월급은 들어오고, 당장 큰 문제는 없어 보이지만 은퇴라는 단어가 더 이상 남의 이야기가 아닐 때.</p>
              <p>준비해야 할 것 같다는 생각은 들지만, 무엇부터 해야 할지는 잘 모르겠습니다.</p>
            </div>

            <div className={styles.storySectionBlock}>
              <h3>준비하려고 할수록 커지는 불안</h3>
              <p>은퇴 준비를 검색해보면 연금, 투자, 세금, 부동산, 보험까지 서로 다른 말들이 쏟아집니다.</p>
              <p>조금만 공부해도 깨닫게 됩니다. 이건 단순히 &apos;돈을 모으는 문제&apos;가 아니라는 걸.</p>
              <p>선택은 많아 보이지만, 정작 확신을 가지고 고를 수 있는 선택은 없습니다.</p>
              <p>그래서 많은 사람들은 중요한 결정을 미루게 됩니다.</p>
            </div>

            <div className={styles.storySectionBlock}>
              <h3>문제는 &apos;준비의 시기&apos;를 놓친다는 것</h3>
              <p>은퇴 준비에서 가장 위험한 건 잘못된 선택이 아니라, 아무 선택도 하지 않는 상태가 길어지는 것입니다.</p>
              <p>시간이 지날수록 선택지는 줄어들고, 되돌릴 수 없는 지점이 가까워집니다.</p>
              <p>불안은 사라지지 않고 그저 뒤로 미뤄질 뿐입니다.</p>
            </div>

            <div className={styles.storySectionBlock}>
              <h3>이건 혼자 판단하기엔 너무 복잡한 문제</h3>
              <p>Lycon은 이 문제를 개인의 의지나 공부 부족으로 보지 않습니다.</p>
              <p>은퇴 준비는 정답이 없는 문제이고, 그래서 함께 판단해줄 구조가 필요하다고 생각했습니다.</p>
              <p>Lycon은 결정을 대신하지 않습니다. 대신, 지금 시점에서 가능한 선택지와 각 선택이 만들어낼 미래를 차분하게 보여줍니다.</p>
            </div>

            <div className={styles.storySectionBlock}>
              <h3>우리가 돕고 싶은 것은 &apos;자신감&apos;</h3>
              <p>Lycon의 목표는 불안을 없애는 것이 아니라, 불안 속에서도 판단할 수 있는 기준을 만드는 것입니다.</p>
              <ul className={styles.storyPoints}>
                <li>지금 이 선택을 왜 하는지 설명할 수 있는 자신감</li>
                <li>시장이 흔들려도 흔들리지 않는 계획</li>
                <li>남의 말이 아닌, 내 계획을 믿을 수 있는 확신</li>
              </ul>
            </div>

            <div className={`${styles.storySectionBlock} ${styles.storyFinale}`}>
              <h3>Life with Confidence</h3>
              <p className={styles.finaleText}>그래서 우리는 <strong>Lycon</strong>입니다.</p>
              <p className={styles.finaleTagline}>Life with Confidence.</p>
              <p>은퇴가 멀게 느껴질 때부터 당신의 선택에 조용한 자신감을 더해주는 서비스.</p>
              <p><strong>Lycon은 은퇴 이전의 당신과 함께 시작합니다.</strong></p>
            </div>
          </div>
        </div>
      </div>

      {/* Calculator Modal */}
      <div className={`${styles.calculatorModal} ${calculatorModalOpen ? styles.calculatorModalActive : ''}`}>
        <div className={styles.modalOverlay} onClick={() => setCalculatorModalOpen(false)}></div>
        <div className={`${styles.modalContent} ${styles.calculatorModalContent}`}>
          <button className={styles.modalClose} onClick={() => setCalculatorModalOpen(false)} aria-label="닫기">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <div className={styles.modalBody}>
            <div className={styles.calcHeader}>
              <h2 className={styles.calcTitle}>10억원 달성 계산기</h2>
              <p className={styles.calcSubtitle}>초기 투자 후 필요한 월 적립액을 계산해보세요</p>
            </div>

            <div className={styles.calcBodyModal}>
              {/* 결과 표시 */}
              <div className={styles.calcResult}>
                <div className={styles.calcMonthly}>
                  <span className={styles.calcLabel}>필요 월 적립액</span>
                  <span className={styles.calcValue}>
                    {calcResult.monthlyPayment === 0 ? '추가 필요없음' : formatNumber(calcResult.monthlyPayment) + '원'}
                  </span>
                </div>
                <div className={styles.calcDetails}>
                  <div className={styles.calcRow}>
                    <span className={styles.calcLabel}>초기 투자금</span>
                    <span className={styles.calcValue}>{formatInitialDisplay(initialInvestment)}</span>
                  </div>
                  <div className={styles.calcRow}>
                    <span className={styles.calcLabel}>월 적립 총액</span>
                    <span className={styles.calcValue}>{formatToEok(calcResult.monthlyTotal)}</span>
                  </div>
                  <div className={styles.calcRow}>
                    <span className={styles.calcLabel}>예상 수익금</span>
                    <span className={`${styles.calcValue} ${styles.calcValueProfit}`}>+{formatToEok(calcResult.profit)}</span>
                  </div>
                  <div className={`${styles.calcRow} ${styles.calcRowTotal}`}>
                    <span className={styles.calcLabel}>합계</span>
                    <span className={`${styles.calcValue} ${styles.calcValueTotal}`}>
                      {calcResult.totalAmount > TARGET_AMOUNT ? formatToEok(calcResult.totalAmount) : '10억원'}
                    </span>
                  </div>
                </div>
              </div>

              {/* 슬라이더 */}
              <div className={styles.calcSliderArea}>
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderHeader}>
                    <span className={styles.sliderLabel}>초기 투자금</span>
                    <span className={styles.sliderValue}>{formatInitialDisplay(initialInvestment)}</span>
                  </div>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      min="0"
                      max="10000"
                      value={initialInvestment}
                      step="100"
                      onChange={(e) => setInitialInvestment(Number(e.target.value))}
                    />
                    <div className={styles.sliderTicks}>
                      <span>0원</span>
                      <span>5,000만원</span>
                      <span>1억원</span>
                    </div>
                  </div>
                </div>
                <div className={styles.sliderGroup}>
                  <div className={styles.sliderHeader}>
                    <span className={styles.sliderLabel}>시작 나이</span>
                    <span className={styles.sliderValue}>{startAge}세</span>
                  </div>
                  <div className={styles.sliderContainer}>
                    <input
                      type="range"
                      min="30"
                      max="60"
                      value={startAge}
                      step="1"
                      onChange={(e) => setStartAge(Number(e.target.value))}
                    />
                    <div className={styles.sliderTicks}>
                      <span>30세</span>
                      <span>45세</span>
                      <span>60세</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.calcAssumptions}>
              <span className={styles.assumption} data-tooltip="목표 나이는 65세로 설정되어 있습니다">
                목표: 65세 <span className={styles.infoIcon}>i</span>
              </span>
              <span className={styles.assumption} data-tooltip="연 복리 수익률 7%를 가정합니다">
                수익률: 연 7% <span className={styles.infoIcon}>i</span>
              </span>
            </div>

            <div className={styles.calcModalInsight}>
              <div className={styles.insightIcon}>
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <path d="M12 16v-4M12 8h.01"/>
                </svg>
              </div>
              <p className={styles.insightText}>
                <strong>은퇴 준비는 지금 시작하는게 제일 좋습니다</strong><br />
                슬라이더를 움직여 초기 투자금과 시작 나이에 따른 차이를 확인해보세요.
              </p>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
