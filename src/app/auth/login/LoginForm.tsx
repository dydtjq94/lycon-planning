"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { OnboardingEvents, identifyUser, trackPageView } from "@/lib/analytics/mixpanel";
import styles from "../auth.module.css";

export function LoginForm() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [ready, setReady] = useState(false);

  // 페이지 진입 시 기존 세션 로그아웃
  useEffect(() => {
    const init = async () => {
      const supabase = createClient();
      await supabase.auth.signOut();
      trackPageView("login");
      setReady(true);
    };
    init();
  }, []);

  const handleKakaoLogin = async () => {
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

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    const { error, data } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    // 인증 상태 확인 후 적절한 페이지로 이동
    if (data.user) {
      // 로그인 완료 트래킹
      identifyUser(data.user.id, { email: data.user.email });
      OnboardingEvents.loginCompleted(data.user.id);
      const { data: profile } = await supabase
        .from("profiles")
        .select("phone_number, onboarding_step")
        .eq("id", data.user.id)
        .single();

      // 1. 프로필 없음 → 온보딩
      if (!profile) {
        router.replace("/onboarding");
        return;
      }

      // 2. 온보딩 미완료 → 온보딩
      if (profile.onboarding_step !== "completed") {
        router.replace("/onboarding");
        return;
      }

      // 3. 전화번호 미인증 → 전화번호 인증
      if (!profile.phone_number) {
        router.replace("/auth/phone-verify");
        return;
      }

      // 4. 모두 완료 (재방문) → 웨이팅
      router.replace("/waiting");
      return;
    }

    router.replace("/onboarding");
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
                onClick={handleKakaoLogin}
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
                    <span>카카오로 로그인</span>
                  </>
                )}
              </button>

              <button
                type="button"
                className={styles.emailToggle}
                onClick={() => setShowEmailForm(true)}
              >
                이메일로 로그인
              </button>

              <p className={styles.linkText}>
                계정이 없으신가요?{" "}
                <Link href="/auth/signup" className={styles.link}>
                  회원가입
                </Link>
              </p>
            </>
          ) : (
            <form onSubmit={handleEmailLogin} className={styles.emailForm}>
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
                  placeholder="비밀번호"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
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
                  "로그인"
                )}
              </button>
              <button
                type="button"
                className={styles.backButton}
                onClick={() => setShowEmailForm(false)}
              >
                다른 방법으로 로그인
              </button>
            </form>
          )}
        </div>
      </main>
    </div>
  );
}
