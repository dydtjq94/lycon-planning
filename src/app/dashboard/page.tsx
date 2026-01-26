"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createClient } from "@/lib/supabase/client";
import { FinancialProvider, type ProfileBasics, type FamilyMember } from "@/contexts/FinancialContext";
import type { Simulation } from "@/types";
import { DashboardContent } from "./DashboardContent";

// PIN 인증 유효 시간 (1시간)
const PIN_VALID_DURATION = 60 * 60 * 1000;

// QueryClient 인스턴스
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5분
      gcTime: 30 * 60 * 1000, // 30분
    },
  },
});

interface DashboardData {
  simulation: Simulation;
  profile: ProfileBasics;
  familyMembers: FamilyMember[];
}

export default function DashboardPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DashboardData | null>(null);

  useEffect(() => {
    const checkAuthAndLoadData = async () => {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/auth/login");
        return;
      }

      // PIN 설정 및 인증 시간 확인
      const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .single();

      if (!profile) {
        router.replace("/onboarding");
        return;
      }

      // PIN이 설정되지 않은 경우
      if (!profile.pin_hash) {
        router.replace("/auth/pin-setup");
        return;
      }

      // PIN 인증 시간 확인
      const pinVerifiedAt = profile.pin_verified_at
        ? new Date(profile.pin_verified_at).getTime()
        : 0;
      const now = Date.now();

      // PIN 인증이 유효한지 확인 (1시간 이내)
      if (now - pinVerifiedAt > PIN_VALID_DURATION) {
        localStorage.setItem("returnUrl", "/dashboard");
        router.replace("/auth/pin-verify");
        return;
      }

      // 시뮬레이션 로드
      const { data: simulation } = await supabase
        .from("simulations")
        .select("*")
        .eq("profile_id", user.id)
        .single();

      if (!simulation) {
        // 시뮬레이션이 없으면 생성
        const { data: newSimulation } = await supabase
          .from("simulations")
          .insert({
            profile_id: user.id,
            name: "기본 시뮬레이션",
          })
          .select()
          .single();

        if (!newSimulation) {
          console.error("Failed to create simulation");
          router.replace("/onboarding");
          return;
        }

        setData({
          simulation: newSimulation,
          profile: profile as ProfileBasics,
          familyMembers: [],
        });
        setLoading(false);
        return;
      }

      // 가족 구성원 로드
      const { data: familyMembers } = await supabase
        .from("family_members")
        .select("*")
        .eq("user_id", user.id);

      setData({
        simulation,
        profile: profile as ProfileBasics,
        familyMembers: (familyMembers || []) as FamilyMember[],
      });
      setLoading(false);
    };

    checkAuthAndLoadData();
  }, [router]);

  if (loading || !data) {
    return (
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          height: "100vh",
          background: "#f5f5f7",
          color: "#666",
        }}
      >
        로딩 중...
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <FinancialProvider
        simulation={data.simulation}
        profile={data.profile}
        familyMembers={data.familyMembers}
      >
        <DashboardContent />
      </FinancialProvider>
    </QueryClientProvider>
  );
}
