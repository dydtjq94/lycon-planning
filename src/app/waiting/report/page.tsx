"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DiagnosisReport } from "@/app/admin/users/[id]/report/DiagnosisReport";
import {
  convertPrepDataToDiagnosisData,
  PrepDataStore,
  DiagnosisData,
} from "@/lib/services/diagnosisDataService";
import styles from "./report.module.css";

export default function WaitingReportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <WaitingReportPageContent />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className={styles.loadingContainer}>
      <div className={styles.spinner} />
      <p>보고서를 불러오고 있습니다...</p>
    </div>
  );
}

function WaitingReportPageContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isPrintMode = searchParams.get("print") === "true";
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opinion, setOpinion] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          localStorage.setItem("returnUrl", "/waiting/report");
          router.replace("/auth/login");
          return;
        }

        // 프로필 정보 및 prep_data 조회
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name, birth_date, target_retirement_age, report_published_at, report_opinion, prep_data")
          .eq("id", user.id)
          .single();

        if (profileError) throw new Error("프로필을 찾을 수 없습니다.");

        if (!profile.report_published_at) {
          setError("발행된 보고서가 없습니다.");
          setLoading(false);
          return;
        }

        // 공통 유틸리티로 prep_data를 DiagnosisData로 변환
        const diagnosisData = convertPrepDataToDiagnosisData({
          name: profile.name,
          birth_date: profile.birth_date,
          target_retirement_age: profile.target_retirement_age,
          prep_data: profile.prep_data as PrepDataStore,
        });

        setData(diagnosisData);
        setOpinion(profile.report_opinion || "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "데이터 로드 실패");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [router]);

  // 인쇄 모드일 때 자동으로 인쇄 다이얼로그 띄우기
  useEffect(() => {
    if (isPrintMode && !loading && data) {
      // 렌더링 완료 후 인쇄 다이얼로그
      const timer = setTimeout(() => {
        window.print();
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isPrintMode, loading, data]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>보고서를 불러오고 있습니다...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className={styles.errorContainer}>
        <p>{error || "데이터를 불러올 수 없습니다."}</p>
        <button onClick={() => router.back()}>뒤로 가기</button>
      </div>
    );
  }

  return (
    <div className={styles.pageContainer}>
      {!isPrintMode && (
        <button className={styles.backButton} onClick={() => router.back()}>
          <ArrowLeft size={16} />
          뒤로 가기
        </button>
      )}
      <DiagnosisReport data={data} userId="" isPublished={true} hideActions opinion={opinion} />
    </div>
  );
}
