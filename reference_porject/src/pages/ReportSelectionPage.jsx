import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { profileService } from "../services/firestoreService";
import styles from "./ReportSelectionPage.module.css";

/**
 * 보고서 타입 선택 페이지
 * 사전, Basic, Standard, Premium 중 선택
 */
function ReportSelectionPage() {
  const { profileId } = useParams();
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadProfileData();
  }, [profileId]);

  const loadProfileData = async () => {
    try {
      setLoading(true);
      const profileData = await profileService.getProfile(profileId);

      if (!profileData) {
        alert("프로필을 찾을 수 없습니다.");
        navigate("/consult");
        return;
      }

      setProfile(profileData);
    } catch (error) {
      console.error("프로필 로드 실패:", error);
      alert("프로필을 불러오는데 실패했습니다.");
    } finally {
      setLoading(false);
    }
  };

  const handleReportSelect = (reportType) => {
    navigate(`/consult/report/${profileId}/view?type=${reportType}`);
  };

  const reportTypes = [
    {
      id: "preliminary",
      title: "사전 상담 보고서",
      subtitle: "Pre-consultation Report",
      description: "기본적인 재무 현황 파악 및 상담 준비",
      features: ["재무 현황 개요", "기본 목표 설정", "상담 준비 사항"],
      color: "#6B7280",
      available: true,
    },
    {
      id: "basic",
      title: "Basic 보고서",
      subtitle: "Basic Retirement Planning Report",
      description: "은퇴 준비 상태 진단 및 기본 분석",
      features: ["은퇴 준비 현황 진단", "현금흐름 분석", "기본 리스크 평가"],
      color: "#3B82F6",
      available: true,
    },
    {
      id: "standard",
      title: "Standard 보고서",
      subtitle: "Standard Retirement Planning Report",
      description: "심층 분석 및 상세 전략 수립",
      features: [
        "상세 재무 분석",
        "투자 포트폴리오 분석",
        "세부 액션 플랜",
        "시나리오 분석",
      ],
      color: "#8B5CF6",
      available: false,
    },
    {
      id: "premium",
      title: "Premium 보고서",
      subtitle: "Premium Retirement Planning Report",
      description: "종합 컨설팅 및 맞춤형 전략",
      features: [
        "종합 재무 컨설팅",
        "맞춤형 투자 전략",
        "세금 최적화 전략",
        "정기 리뷰 및 업데이트",
      ],
      color: "#D4AF37",
      available: false,
    },
  ];

  if (loading) {
    return (
      <div className={styles.loadingContainer}>
        <div className={styles.spinner}></div>
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className={styles.errorContainer}>
        <p>프로필 정보를 찾을 수 없습니다.</p>
        <button onClick={() => navigate("/consult")}>목록으로 돌아가기</button>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      {/* 헤더 */}
      <div className={styles.header}>
        <button
          className={styles.backButton}
          onClick={() => navigate(`/consult/dashboard/${profileId}`)}
        >
          <i className="fas fa-arrow-left"></i>
          <span>대시보드로 돌아가기</span>
        </button>
        <div className={styles.headerInfo}>
          <h1>상담 보고서</h1>
          <p className={styles.profileName}>{profile.name}님</p>
        </div>
      </div>

      {/* 보고서 선택 카드들 */}
      <div className={styles.cardsContainer}>
        {reportTypes.map((report) => (
          <div
            key={report.id}
            className={`${styles.reportCard} ${
              !report.available ? styles.unavailable : ""
            }`}
            onClick={() => report.available && handleReportSelect(report.id)}
            style={{ borderTopColor: report.color }}
          >
            {!report.available && (
              <div className={styles.comingSoonBadge}>Coming Soon</div>
            )}
            <div className={styles.cardHeader}>
              <h2 className={styles.cardTitle}>{report.title}</h2>
              <p className={styles.cardSubtitle}>{report.subtitle}</p>
            </div>
            <p className={styles.cardDescription}>{report.description}</p>
            <div className={styles.features}>
              {report.features.map((feature, index) => (
                <div key={index} className={styles.featureItem}>
                  <i
                    className="fas fa-check-circle"
                    style={{ color: report.color }}
                  ></i>
                  <span>{feature}</span>
                </div>
              ))}
            </div>
            {report.available && (
              <button
                className={styles.selectButton}
                style={{ backgroundColor: report.color }}
              >
                보고서 보기
                <i className="fas fa-arrow-right"></i>
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

export default ReportSelectionPage;
