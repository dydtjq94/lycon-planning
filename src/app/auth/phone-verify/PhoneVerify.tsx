"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CheckCircle } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { confirmUserBooking } from "@/lib/services/bookingService";
import styles from "./phone-verify.module.css";

type Step = "phone" | "code";
const CODE_LENGTH = 6;

interface BookingInfo {
  date: string;
  time: string;
  expert: string;
}

export function PhoneVerify() {
  const router = useRouter();
  const [step, setStep] = useState<Step>("phone");
  const [phoneNumber, setPhoneNumber] = useState("");
  const [verificationCode, setVerificationCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(0);
  const [bookingInfo, setBookingInfo] = useState<BookingInfo | null>(null);
  const [bookingLoading, setBookingLoading] = useState(true);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // 예약 정보 로드
  useEffect(() => {
    const loadBookingInfo = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        setBookingLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("booking_info")
        .eq("id", user.id)
        .single();

      if (profile?.booking_info) {
        setBookingInfo(profile.booking_info);
      }
      setBookingLoading(false);
    };
    loadBookingInfo();
  }, []);

  // 개별 숫자 입력 핸들러
  const handleDigitChange = (index: number, value: string) => {
    if (!/^\d*$/.test(value)) return;

    const newCode = verificationCode.split("");
    newCode[index] = value.slice(-1);
    const joined = newCode.join("").slice(0, CODE_LENGTH);
    setVerificationCode(joined);

    // 다음 칸으로 자동 이동
    if (value && index < CODE_LENGTH - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  // 백스페이스 처리
  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === "Backspace" && !verificationCode[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  // 붙여넣기 처리
  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, CODE_LENGTH);
    setVerificationCode(pasted);
    if (pasted.length === CODE_LENGTH) {
      inputRefs.current[CODE_LENGTH - 1]?.focus();
    } else {
      inputRefs.current[pasted.length]?.focus();
    }
  };

  // 카운트다운 타이머
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(countdown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [countdown]);

  // 인증번호 입력 단계로 넘어가면 첫 번째 입력칸에 포커스
  useEffect(() => {
    if (step === "code") {
      // 렌더링 완료 후 포커스 (requestAnimationFrame 사용)
      requestAnimationFrame(() => {
        setTimeout(() => {
          inputRefs.current[0]?.focus();
        }, 50);
      });
    }
  }, [step]);

  // 인증번호 발송
  const handleSendCode = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError("올바른 전화번호를 입력해주세요");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/sms/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phoneNumber }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "인증번호 발송에 실패했습니다");
        setLoading(false);
        return;
      }

      setLoading(false);
      setStep("code");
      setCountdown(180); // 3분 타이머
    } catch (err) {
      console.error("인증번호 발송 오류:", err);
      setError("인증번호 발송에 실패했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  // 인증번호 확인
  const handleVerifyCode = async () => {
    if (!verificationCode || verificationCode.length !== 6) {
      setError("6자리 인증번호를 입력해주세요");
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const response = await fetch("/api/sms/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: verificationCode }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "인증에 실패했습니다");
        setLoading(false);
        return;
      }

      // 예약 상태를 confirmed로 변경
      try {
        await confirmUserBooking();
      } catch (bookingError) {
        console.error("예약 확정 오류:", bookingError);
        // 예약 확정 실패해도 진행 (예약이 없을 수도 있음)
      }

      // 웨이팅 화면으로 이동
      router.push("/waiting");
      router.refresh();
    } catch (err) {
      console.error("인증 확인 오류:", err);
      setError("인증에 실패했습니다. 다시 시도해주세요.");
      setLoading(false);
    }
  };

  // 재발송
  const handleResend = () => {
    setStep("phone");
    setVerificationCode("");
  };

  return (
    <div className={styles.container}>
      <main className={styles.main}>
        {/* 히어로 영역 */}
        <div className={styles.heroArea}>
          {step === "phone" ? (
            <>
              <div className={styles.completeBadge}>
                <CheckCircle size={16} />
                예약 신청 완료
              </div>
              <h1 className={styles.title}>
                예약 확정을 위해
                <br />
                전화번호 인증이 필요합니다
              </h1>
              <div className={styles.bookingSummary}>
                {bookingLoading ? (
                  <>
                    <div className={`${styles.skeleton} ${styles.skeletonTitle}`} />
                    <div className={`${styles.skeleton} ${styles.skeletonDetail}`} />
                  </>
                ) : bookingInfo ? (
                  <>
                    <div className={styles.bookingTitle}>기본형 종합 재무검진 (은퇴 진단)</div>
                    <div className={styles.bookingDetail}>
                      {new Date(bookingInfo.date).toLocaleDateString("ko-KR", { month: "long", day: "numeric" })} {bookingInfo.time} | {bookingInfo.expert} 은퇴 설계 전문가
                    </div>
                  </>
                ) : null}
              </div>
            </>
          ) : (
            <>
              <h1 className={styles.title}>인증번호 입력</h1>
              <div className={styles.subtitleRow}>
                <p className={styles.subtitle}>
                  {phoneNumber}로 전송된
                  <br />
                  인증번호를 입력해주세요
                </p>
                {countdown > 0 && (
                  <span className={styles.timer}>
                    {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, "0")}
                  </span>
                )}
              </div>
            </>
          )}
        </div>

        {/* 입력 영역 */}
        <div className={styles.formArea}>
          {error && <div className={styles.error}>{error}</div>}

          {step === "phone" ? (
            <>
              <div className={styles.inputGroup}>
                <span className={styles.prefix}>+82</span>
                <input
                  type="tel"
                  className={styles.phoneInput}
                  placeholder="01012345678"
                  value={phoneNumber}
                  onChange={(e) =>
                    setPhoneNumber(e.target.value.replace(/[^0-9]/g, ""))
                  }
                  maxLength={11}
                  disabled={loading}
                />
              </div>
              <button
                type="button"
                className={styles.submitButton}
                onClick={handleSendCode}
                disabled={loading || phoneNumber.length < 10}
              >
                {loading ? (
                  <Loader2 size={20} className={styles.spinner} />
                ) : (
                  "인증번호 받기"
                )}
              </button>
            </>
          ) : (
            <>
              <div className={styles.codeBoxes}>
                {Array.from({ length: CODE_LENGTH }).map((_, i) => (
                  <input
                    key={i}
                    ref={(el) => { inputRefs.current[i] = el; }}
                    type="text"
                    inputMode="numeric"
                    className={`${styles.codeBox} ${verificationCode[i] ? styles.filled : ""}`}
                    value={verificationCode[i] || ""}
                    onChange={(e) => handleDigitChange(i, e.target.value)}
                    onKeyDown={(e) => handleKeyDown(i, e)}
                    onPaste={handlePaste}
                    maxLength={1}
                    disabled={loading}
                  />
                ))}
              </div>
              <button
                type="button"
                className={styles.submitButton}
                onClick={handleVerifyCode}
                disabled={loading || verificationCode.length !== 6}
              >
                {loading ? (
                  <Loader2 size={20} className={styles.spinner} />
                ) : (
                  "확인"
                )}
              </button>
              <button
                type="button"
                className={styles.resendButton}
                onClick={handleResend}
                disabled={loading}
              >
                인증번호 다시 받기
              </button>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
