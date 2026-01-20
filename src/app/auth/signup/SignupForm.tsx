"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OnboardingEvents, trackPageView } from "@/lib/analytics/mixpanel";
import styles from "../auth.module.css";

export function SignupForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [showEmailSent, setShowEmailSent] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [ready, setReady] = useState(false);

  // 페이지 진입 시 기존 세션 로그아웃 후 트래킹
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      trackPageView("signup");
      OnboardingEvents.signUpStarted();
      setReady(true);
    };
    init();
  }, []);

  const handleKakaoSignup = async () => {
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "kakao",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
    }
  };

  const handleEmailSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다");
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // 회원가입 완료 트래킹
    if (data.user) {
      OnboardingEvents.signUpCompleted(data.user.id);
    }

    // 이메일 확인 안내 표시
    setShowEmailSent(true);
    setLoading(false);
  };

  // 초기화 중
  if (!ready) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.heroArea}>
            <Loader2 size={32} className={styles.spinner} />
          </div>
        </main>
      </div>
    );
  }

  // 이메일 발송 완료 화면
  if (showEmailSent) {
    return (
      <div className={styles.container}>
        <main className={styles.main}>
          <div className={styles.heroArea}>
            <p className={styles.brandLabel}>Lycon | Retirement</p>
            <h1 className={styles.heroTitle}>
              이메일을
              <br />
              확인해주세요
            </h1>
            <p className={styles.heroDesc}>
              {email}로 인증 링크를 보냈습니다.
              <br />
              이메일의 링크를 클릭하면 가입이 완료됩니다.
            </p>
          </div>
          <div className={styles.actionArea}>
            <p className={styles.linkText}>
              이메일이 오지 않았나요?{" "}
              <button
                type="button"
                className={styles.link}
                onClick={() => {
                  setShowEmailSent(false);
                  setShowEmailForm(true);
                }}
              >
                다시 시도
              </button>
            </p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {/* 상단: 철학/미션 */}
        <div className={styles.heroArea}>
          <p className={styles.brandLabel}>Lycon | Retirement</p>
          <h1 className={styles.heroTitle}>
            은퇴 후에도
            <br />
            당신다운 삶을
            <br />
            살 수 있도록
          </h1>
          <p className={styles.heroDesc}>
            지금, 전문가와 시작하세요
          </p>
        </div>

        {/* 하단: 버튼 영역 */}
        <div className={styles.actionArea}>
          {error && <div className={styles.error}>{error}</div>}

          {!showEmailForm ? (
            <>
              <button
                type="button"
                className={styles.kakaoButton}
                onClick={handleKakaoSignup}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={20} className={styles.spinner} />
                ) : (
                  <>
                    <svg
                      width="22"
                      height="22"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M12 3C6.477 3 2 6.477 2 10.5c0 2.47 1.607 4.647 4.023 5.897-.125.48-.45 1.737-.516 2.008-.082.334.122.33.258.24.106-.07 1.693-1.15 2.378-1.615.598.088 1.22.135 1.857.135 5.523 0 10-3.477 10-7.665C20 6.477 17.523 3 12 3z" />
                    </svg>
                    <span>카카오로 시작하기</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className={styles.emailToggle}
                onClick={() => setShowEmailForm(true)}
              >
                이메일로 가입하기
              </button>

              <p className={styles.linkText}>
                이미 계정이 있으신가요?{" "}
                <Link href="/auth/login" className={styles.link}>
                  로그인
                </Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleEmailSignup} className={styles.emailForm}>
              <div className={styles.formGroup}>
                <input
                  id="email"
                  type="email"
                  className={styles.input}
                  placeholder="이메일"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <input
                  id="password"
                  type="password"
                  className={styles.input}
                  placeholder="비밀번호 (6자 이상)"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
              </div>
              <div className={styles.formGroup}>
                <input
                  id="confirmPassword"
                  type="password"
                  className={styles.input}
                  placeholder="비밀번호 확인"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <button
                type="submit"
                className={styles.submitButton}
                disabled={loading}
              >
                {loading ? (
                  <Loader2 size={20} className={styles.spinner} />
                ) : (
                  "가입하기"
                )}
              </button>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => setShowEmailForm(false)}
              >
                다른 방법으로 가입
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
