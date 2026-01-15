"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { SimpleOnboarding } from "./components/SimpleOnboarding";
import { simulationService } from "@/lib/services/simulationService";
import { initializePrimaryConversation } from "@/lib/services/messageService";

interface InitialData {
  name: string;
  rrnFront: string;
  rrnBack: string;
  savedStep?: string;
}

export default function OnboardingPage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [initialData, setInitialData] = useState<InitialData | null>(null);
  const [loading, setLoading] = useState(true);

  // 기존 프로필 데이터 불러오기
  useEffect(() => {
    const loadProfile = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        setLoading(false);
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("name, gender, birth_date, onboarding_step")
        .eq("id", user.id)
        .single();

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
  }) => {
    setSaving(true);

    const supabase = createClient();

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        router.push("/login");
        return;
      }

      // 생년월일 문자열 생성
      const birthDate = `${data.birthYear}-${String(data.birthMonth).padStart(2, "0")}-01`;

      // 병렬 실행: 프로필 조회 + 시뮬레이션 조회/생성
      const [profileResult, simulation] = await Promise.all([
        supabase.from("profiles").select("diagnosis_started_at").eq("id", user.id).single(),
        simulationService.getDefault(),
      ]);

      const existingProfile = profileResult.data;

      // 프로필 저장 (설문 응답 + 예약 정보 포함)
      await supabase.from("profiles").upsert({
        id: user.id,
        name: data.name,
        gender: data.gender,
        birth_date: birthDate,
        settings: {
          inflationRate: 2.5,
          investmentReturn: 5.0,
          lifeExpectancy: 100,
        },
        // 온보딩 설문 응답 저장
        survey_responses: {
          onboarding: data.surveyResponses,
          completed_at: new Date().toISOString(),
        },
        // 예약 정보 저장
        booking_info: data.bookingDate ? {
          date: data.bookingDate,
          time: data.bookingTime,
          expert: "손균우",
          booked_at: new Date().toISOString(),
        } : null,
        // 온보딩 완료 표시
        onboarding_step: "completed",
        diagnosis_started_at: existingProfile?.diagnosis_started_at || new Date().toISOString(),
        updated_at: new Date().toISOString(),
      });

      // 담당 전문가 환영 메시지 생성 (백그라운드)
      initializePrimaryConversation().catch(console.error);

      // 전화번호 인증으로 이동
      router.push("/auth/phone-verify");
    } catch (err) {
      console.error("저장 실패:", err);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return null;
  }

  return (
    <SimpleOnboarding
      onComplete={handleComplete}
      isSaving={saving}
      initialData={initialData}
    />
  );
}
