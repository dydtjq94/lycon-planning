"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FinancialProvider, type ProfileBasics, type FamilyMember } from "@/contexts/FinancialContext";
import type { Simulation } from "@/types";
import { DashboardContent } from "./DashboardContent";
import { copySnapshotToSimulation } from "@/lib/services/snapshotToSimulation";


interface DashboardData {
  simulation: Simulation;
  profile: ProfileBasics;
  familyMembers: FamilyMember[];
  adminView?: {
    targetUserId: string;
    targetUserName: string;
  };
}

function DashboardPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const viewAs = searchParams.get("viewAs");
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

      // Admin viewAs 모드: expert가 고객 대시보드를 보는 경우
      if (viewAs) {
        // 현재 로그인 사용자가 expert인지 확인
        const { data: expert, error: expertError } = await supabase
          .from("experts")
          .select("id")
          .eq("user_id", user.id)
          .single();

        console.log("[Dashboard viewAs] Expert check:", { expert, expertError, userId: user.id });

        if (!expert) {
          router.replace("/dashboard");
          return;
        }

        // 해당 고객이 담당 고객인지 확인
        const { data: conversation, error: convError } = await supabase
          .from("conversations")
          .select("id")
          .eq("expert_id", expert.id)
          .eq("user_id", viewAs)
          .maybeSingle();

        console.log("[Dashboard viewAs] Conversation check:", { conversation, convError, expertId: expert.id, viewAs });

        if (!conversation) {
          router.replace("/admin");
          return;
        }

        // 대상 유저의 프로필, 시뮬레이션, 가족구성원 로드
        const [profileResult, simulationResult, familyResult] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", viewAs)
            .single(),
          supabase
            .from("simulations")
            .select("*")
            .eq("profile_id", viewAs)
            .limit(1)
            .maybeSingle(),
          supabase
            .from("family_members")
            .select("*")
            .eq("user_id", viewAs),
        ]);

        if (!profileResult.data) {
          router.replace("/admin");
          return;
        }

        let simulation = simulationResult.data;

        // 시뮬레이션이 없으면 생성
        if (!simulation) {
          const { data: newSimulation } = await supabase
            .from("simulations")
            .insert({
              profile_id: viewAs,
              title: "은퇴",
              is_default: true,
            })
            .select()
            .single();

          if (!newSimulation) {
            router.replace("/admin");
            return;
          }
          simulation = newSimulation;
        }

        setData({
          simulation,
          profile: profileResult.data as ProfileBasics,
          familyMembers: (familyResult.data || []) as FamilyMember[],
          adminView: {
            targetUserId: viewAs,
            targetUserName: profileResult.data.name || "이름 없음",
          },
        });
        setLoading(false);
        return;
      }

      // 일반 사용자 모드
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
            title: "은퇴",
            is_default: true,
          })
          .select()
          .single();

        if (!newSimulation) {
          console.error("Failed to create simulation");
          router.replace("/onboarding");
          return;
        }
        simulation = newSimulation;

        // 스냅샷 데이터를 시뮬레이션에 복사
        try {
          const result = await copySnapshotToSimulation(user.id, simulation.id);
          console.log("[DashboardPage] Copied snapshot data:", result);
        } catch (error) {
          console.error("[DashboardPage] Failed to copy snapshot:", error);
        }
      }

      setData({
        simulation,
        profile: profile as ProfileBasics,
        familyMembers: (familyResult.data || []) as FamilyMember[],
      });
      setLoading(false);
    };

    checkAuthAndLoadData();
  }, [router, viewAs]);

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
      <DashboardContent adminView={data.adminView} />
    </FinancialProvider>
  );
}

export default function DashboardPage() {
  return (
    <Suspense fallback={
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100vh", background: "#f5f5f7", color: "#666" }}>
        로딩 중...
      </div>
    }>
      <DashboardPageInner />
    </Suspense>
  );
}
