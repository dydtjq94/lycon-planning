"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FinancialProvider, type ProfileBasics, type FamilyMember } from "@/contexts/FinancialContext";
import type { Simulation } from "@/types";
import { DashboardContent } from "./DashboardContent";


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

      // 시뮬레이션 + 가족구성원 병렬 로드
      const [simulationResult, familyResult] = await Promise.all([
        supabase
          .from("simulations")
          .select("*")
          .eq("profile_id", user.id)
          .limit(1)
          .maybeSingle(),
        supabase
          .from("family_members")
          .select("*")
          .eq("user_id", user.id),
      ]);

      let simulation = simulationResult.data;

      // 시뮬레이션이 없으면 생성
      if (!simulation) {
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
        simulation = newSimulation;
      }

      setData({
        simulation,
        profile: profile as ProfileBasics,
        familyMembers: (familyResult.data || []) as FamilyMember[],
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
    <FinancialProvider
      simulation={data.simulation}
      profile={data.profile}
      familyMembers={data.familyMembers}
    >
      <DashboardContent />
    </FinancialProvider>
  );
}
