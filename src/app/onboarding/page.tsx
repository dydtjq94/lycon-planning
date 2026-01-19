"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SimpleOnboarding } from "./components/SimpleOnboarding";
import { simulationService } from "@/lib/services/simulationService";
import { initializePrimaryConversation } from "@/lib/services/messageService";
import { createBooking } from "@/lib/services/bookingService";
import { identifyUser, setUserProperties } from "@/lib/analytics/mixpanel";

interface InitialData {
  name: string;
  rrnFront: string;
  rrnBack: string;
  savedStep?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [initialData, setInitialData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);

  // 기존 프로필 데이터 불러오기
  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      // 로그인 안됨 → 로그인 페이지로
      if (!user) {
        router.replace("/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, gender, birth_date, onboarding_step, pin_hash, phone_number")
        .eq("id", user.id)
        .single();

      // PIN 없음 → PIN 설정으로
      if (!profile?.pin_hash) {
        router.replace("/auth/pin-setup");
        return;
      }

      // 온보딩 완료 + 전화번호 인증 완료 → 대기 화면으로
      if (profile?.onboarding_step === "completed" && profile?.phone_number) {
        router.replace("/waiting");
        return;
      }

      // 온보딩 완료했지만 전화번호 미인증 → 전화번호 인증으로
      if (profile?.onboarding_step === "completed") {
        router.replace("/auth/phone-verify");
        return;
      }

      if (profile?.name && profile?.birth_date && profile?.gender) {
        // birth_date: "1990-01-01" 형식
        const [year, month] = profile.birth_date.split("-");
        const yy = year.slice(2); // "90"
        const mm = month; // "01"

        // 성별 코드 계산 (1: 1900년대 남성, 2: 1900년대 여성, 3: 2000년대 남성, 4: 2000년대 여성)
        const century = parseInt(year) >= 2000 ? 2 : 0;
        const genderCode = profile.gender === "male" ? 1 + century : 2 + century;

        setInitialData({
          name: profile.name,
          rrnFront: `${yy}${mm}01`,
          rrnBack: String(genderCode),
          savedStep: profile.onboarding_step || undefined,
        });
      } else if (profile?.onboarding_step) {
        // 프로필 정보는 없지만 저장된 단계가 있는 경우
        setInitialData({
          name: "",
          rrnFront: "",
          rrnBack: "",
          savedStep: profile.onboarding_step,
        });
      }

      setLoading(false);
    };

    loadProfile();
  }, []);

  // 완료 처리
  const handleComplete = async (data: {
    name: string;
    gender: string;
    birthYear: number;
    birthMonth: number;
    surveyResponses: Record<string, string | string[]>;
    bookingDate: string | null;
    bookingTime: string | null;
    expertId: string | null;
  }) => {
    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // 생년월일 문자열 생성
      const birthDate = `${data.birthYear}-${String(data.birthMonth).padStart(2, "0")}-01`;

      // 1. 필수 데이터 먼저 저장 (페이지 이동 전)
      await supabase.from("profiles").upsert({
        id: user.id,
        name: data.name,
        gender: data.gender,
        birth_date: birthDate,
        onboarding_step: "completed",
        booking_info: data.bookingDate ? {
          date: data.bookingDate,
          time: data.bookingTime,
          expert: "손균우",
          booked_at: new Date().toISOString(),
        } : null,
        updated_at: new Date().toISOString(),
      });

      // Mixpanel 유저 식별 및 속성 설정
      const currentYear = new Date().getFullYear();
      const age = currentYear - data.birthYear;
      identifyUser(user.id);
      setUserProperties({
        name: data.name,
        gender: data.gender,
        birth_year: data.birthYear,
        age,
        onboarding_completed_at: new Date().toISOString(),
      });

      // 2. 예약 생성 (프로필 저장 후)
      if (data.bookingDate && data.bookingTime && data.expertId) {
        try {
          const bookingDateObj = new Date(data.bookingDate);
          const dateStr = `${bookingDateObj.getFullYear()}-${String(bookingDateObj.getMonth() + 1).padStart(2, "0")}-${String(bookingDateObj.getDate()).padStart(2, "0")}`;
          await createBooking(data.expertId, dateStr, data.bookingTime);
        } catch (bookingErr) {
          console.error("예약 생성 실패:", bookingErr);
          // 예약 테이블 저장 실패 시 프로필의 booking_info도 제거
          await supabase.from("profiles").update({
            booking_info: null,
          }).eq("id", user.id);
          alert("예약 생성에 실패했습니다. 다시 시도해주세요.");
          return;
        }
      }

      // 3. 페이지 이동
      router.push("/auth/phone-verify");

      // 4. 나머지는 백그라운드에서 저장
      const saveRest = async () => {
        try {
          const { data: existingProfile } = await supabase
            .from("profiles")
            .select("diagnosis_started_at")
            .eq("id", user.id)
            .single();

          const { error: profileError } = await supabase.from("profiles").update({
            settings: {
              inflationRate: 2.5,
              investmentReturn: 5.0,
              lifeExpectancy: 100,
            },
            survey_responses: {
              onboarding: data.surveyResponses,
              completed_at: new Date().toISOString(),
            },
            diagnosis_started_at: existingProfile?.diagnosis_started_at || new Date().toISOString(),
          }).eq("id", user.id);

          if (profileError) {
            console.error("[온보딩] 프로필 설정 저장 실패:", profileError);
          }

          // 시뮬레이션 생성
          try {
            await simulationService.getDefault();
          } catch (simError) {
            console.error("[온보딩] 시뮬레이션 생성 실패:", simError);
          }

          // 담당 전문가 환영 메시지 생성
          try {
            await initializePrimaryConversation();
          } catch (msgError) {
            console.error("[온보딩] 환영 메시지 생성 실패:", msgError);
          }
        } catch (err) {
          console.error("[온보딩] 백그라운드 저장 실패:", err);
        }
      };

      saveRest();
    } catch (err) {
      console.error("저장 실패:", err);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <SimpleOnboarding
      onComplete={handleComplete}
      initialData={initialData}
    />
  );
}
