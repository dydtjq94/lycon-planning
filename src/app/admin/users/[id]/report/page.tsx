"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { DiagnosisReport } from "./DiagnosisReport";
import {
  convertPrepDataToDiagnosisData,
  PrepDataStore,
  DiagnosisData,
} from "@/lib/services/diagnosisDataService";
import styles from "./report.module.css";

export default function ReportPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<DiagnosisData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPublished, setIsPublished] = useState(false);
  const [opinion, setOpinion] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [diagnosisDate, setDiagnosisDate] = useState<string | undefined>();

  useEffect(() => {
    const loadData = async () => {
      try {
        const supabase = createClient();

        // 프로필 정보 및 prep_data 조회
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("name, birth_date, target_retirement_age, report_published_at, report_opinion, prep_data")
          .eq("id", userId)
          .single();

        if (profileError) throw new Error("프로필을 찾을 수 없습니다.");

        // 공통 유틸리티로 prep_data를 DiagnosisData로 변환
        const diagnosisData = convertPrepDataToDiagnosisData({
          name: profile.name,
          birth_date: profile.birth_date,
          target_retirement_age: profile.target_retirement_age,
          prep_data: profile.prep_data as PrepDataStore,
        });

        setData(diagnosisData);
        setIsPublished(!!profile.report_published_at);
        setOpinion(profile.report_opinion || "");

        // 첫 예약일 조회 (진단일로 사용)
        const { data: booking } = await supabase
          .from("bookings")
          .select("booking_date")
          .eq("user_id", userId)
          .order("booking_date", { ascending: true })
          .limit(1)
          .single();

        if (booking?.booking_date) {
          const bookingDate = new Date(booking.booking_date);
          setDiagnosisDate(bookingDate.toLocaleDateString("ko-KR", {
            year: "numeric",
            month: "2-digit",
            day: "2-digit",
          }));
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : "데이터 로드 실패");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [userId]);

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner} />
        <p>보고서를 생성하고 있습니다...</p>
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

  const handlePublish = async () => {
    if (isPublished) {
      alert("이미 발행된 보고서입니다.");
      return;
    }

    if (!confirm("보고서를 발행하시겠습니까?\n고객에게 SMS가 발송됩니다.")) {
      return;
    }

    setPublishing(true);
    try {
      const response = await fetch("/api/report/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, opinion }),
      });

      const result = await response.json();

      if (result.success) {
        setIsPublished(true);
        alert("보고서가 발행되었습니다.\n고객에게 SMS가 발송되었습니다.");
      } else {
        alert(result.error || "발행에 실패했습니다.");
      }
    } catch {
      alert("발행 중 오류가 발생했습니다.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className={styles.pageContainer}>
      <button className={styles.backButton} onClick={() => router.back()}>
        <ArrowLeft size={16} />
        뒤로 가기
      </button>
      <div className={styles.contentLayout}>
        <div className={styles.reportWrapper}>
          <DiagnosisReport
            data={data}
            userId={userId}
            isPublished={isPublished}
            hideActions
            opinion={opinion}
            diagnosisDate={diagnosisDate}
          />
        </div>
        <div className={styles.sidePanel}>
          <div className={styles.opinionPanel}>
            <h3 className={styles.panelTitle}>담당자 소견 작성</h3>
            <textarea
              className={styles.opinionTextarea}
              placeholder="고객에게 전달할 소견을 작성하세요..."
              value={opinion}
              onChange={(e) => setOpinion(e.target.value)}
              rows={8}
              disabled={isPublished}
            />
            <div className={styles.formatGuide}>
              <span className={styles.formatItem}><strong>**굵게**</strong></span>
              <span className={styles.formatItem}><em>*기울임*</em></span>
              <span className={styles.formatItem}><u>__밑줄__</u></span>
            </div>
            <p className={styles.opinionHint}>
              작성하지 않으면 자동 생성된 소견이 표시됩니다.
            </p>
          </div>
          <div className={styles.actionPanel}>
            <button
              className={styles.printButton}
              onClick={() => window.print()}
            >
              인쇄하기
            </button>
            <button
              className={`${styles.publishButton} ${isPublished ? styles.published : ""}`}
              onClick={handlePublish}
              disabled={publishing || isPublished}
            >
              {publishing ? "발행 중..." : isPublished ? "발행 완료" : "보고서 발행하기"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
