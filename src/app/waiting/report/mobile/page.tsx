"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import {
  convertPrepDataToDiagnosisData,
  PrepDataStore,
  DiagnosisData,
} from "@/lib/services/diagnosisDataService";
import { ReportTabs } from "./components";
import styles from "./mobile-report.module.css";

export default function MobileReportPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <MobileReportContent />
    </Suspense>
  );
}

function LoadingFallback() {
  return (
    <div className={styles.pageWrapper}>
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>검진 결과를 불러오고 있습니다...</p>
      </div>
    </div>
  );
}

function MobileReportContent() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [opinion, setOpinion] = useState("");
  const [customerName, setCustomerName] = useState("");

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();
        const {
          data: { user },
        } = await supabase.auth.getUser();

        if (!user) {
          localStorage.setItem("returnUrl", "/waiting/report/mobile");
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

        setCustomerName(profile.name || "고객");

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

  if (loading) {
    return <LoadingFallback />;
  }

  if (error || !data) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.errorContainer}>
          <p>{error || "데이터를 불러올 수 없습니다."}</p>
          <button onClick={() => router.back()}>뒤로 가기</button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={() => router.push("/waiting")}>
            <ArrowLeft size={20} />
          </button>
          <h1 className={styles.headerTitle}>{customerName}님의 검진 결과</h1>
        </header>
        <ReportTabs data={data} opinion={opinion} />
      </div>
    </div>
  );
}
