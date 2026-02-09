"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { trackPageView, track } from "@/lib/analytics/mixpanel";
import landingStyles from "../../landing.module.css";
import styles from "./join-waitlist.module.css";

export default function JoinWaitlistPage() {
  const [phone, setPhone] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [waitlistCount, setWaitlistCount] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const trackedRef = useRef(false);

  useEffect(() => {
    if (!trackedRef.current) {
      trackedRef.current = true;
      trackPageView("join-waitlist");

      fetch("/api/landing/counter", { method: "POST" })
        .then((res) => res.json())
        .then((data) => {
          if (data.count) setWaitlistCount(data.count);
        })
        .catch(() => {})
        .finally(() => setIsLoading(false));
    }
  }, []);

  const formatPhone = (value: string) => {
    const numbers = value.replace(/\D/g, "");
    if (numbers.length <= 3) return numbers;
    if (numbers.length <= 7) return `${numbers.slice(0, 3)}-${numbers.slice(3)}`;
    return `${numbers.slice(0, 3)}-${numbers.slice(3, 7)}-${numbers.slice(7, 11)}`;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatPhone(e.target.value);
    setPhone(formatted);
    setError("");
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const numbers = phone.replace(/\D/g, "");
    if (numbers.length < 10 || numbers.length > 11) {
      setError("올바른 전화번호를 입력해주세요.");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      const res = await fetch("/api/landing/join-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: numbers }),
      });

      if (!res.ok) {
        throw new Error("전송에 실패했습니다.");
      }

      track("Waitlist Submitted", { phone: numbers });
      setIsSubmitted(true);
    } catch {
      setError("전송에 실패했습니다. 다시 시도해주세요.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <>
      <header className={landingStyles.header}>
        <div className={landingStyles.headerContainer}>
          <Link href="/landing" className={landingStyles.logo}>
            <span className={landingStyles.logoText}>Lycon | Retirement</span>
          </Link>
          <div className={landingStyles.headerActions} />
        </div>
      </header>

      <main className={styles.main}>
        <div className={styles.container}>
          {isLoading ? (
            <div className={styles.formCard}>
              <div className={styles.skeletonTitle} />
              <div className={styles.skeletonDesc} />
              <div className={styles.skeletonLabel} />
              <div className={styles.skeletonInput} />
              <div className={styles.skeletonButton} />
            </div>
          ) : isSubmitted ? (
            <div className={styles.successCard}>
              <div className={styles.successIcon}>
                <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
                  <circle cx="24" cy="24" r="24" fill="#2563eb" opacity="0.1" />
                  <path
                    d="M16 24L22 30L32 18"
                    stroke="#2563eb"
                    strokeWidth="3"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <h1 className={styles.successTitle}>신청이 완료되었습니다</h1>
              <p className={styles.successDesc}>
                손균우 은퇴 설계 전문가가
                <br />
                빠른 시일 내에 연락드리겠습니다.
              </p>
              <Link
                href="/landing"
                className={`${landingStyles.btnPrimary} ${styles.backButton}`}
              >
                돌아가기
              </Link>
            </div>
          ) : (
            <div className={styles.formCard}>
              <h1 className={styles.title}>무료 은퇴 검진 신청</h1>
              {waitlistCount !== null && (
                <p className={styles.desc}>
                  지금 신청하시면 손균우 은퇴 설계 전문가가{" "}
                  <strong className={styles.countHighlight}>{waitlistCount + 1}번째</strong>로
                  연락드립니다.
                </p>
              )}
              {waitlistCount === null && (
                <p className={styles.desc}>
                  지금 신청하시면 손균우 은퇴 설계 전문가가 연락드립니다.
                </p>
              )}

              <form onSubmit={handleSubmit} className={styles.form}>
                <div className={styles.inputGroup}>
                  <label htmlFor="phone" className={styles.label}>
                    연락 받을 전화번호
                  </label>
                  <input
                    id="phone"
                    type="tel"
                    value={phone}
                    onChange={handlePhoneChange}
                    placeholder="010-0000-0000"
                    className={styles.input}
                    maxLength={13}
                    autoFocus
                    autoComplete="tel"
                  />
                  {error && <p className={styles.error}>{error}</p>}
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || phone.replace(/\D/g, "").length < 10}
                  className={styles.submitButton}
                >
                  {isSubmitting ? "전송 중..." : "신청하기"}
                </button>
              </form>


              <p className={styles.privacy}>
                입력하신 정보는 상담 연락 목적으로만 사용됩니다.
              </p>
            </div>
          )}
        </div>
      </main>

    </>
  );
}
