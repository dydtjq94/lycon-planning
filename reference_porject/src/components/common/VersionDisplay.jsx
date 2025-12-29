import React, { useState, useEffect, useRef, useMemo } from "react";
import { useAuth } from "../../contexts/AuthContext";
import { getAdminInfo } from "../../services/authService";
import versionData from "../../../version.json";
import styles from "./VersionDisplay.module.css";

/**
 * 버전을 메이저.마이너 형식으로 그룹화
 * 예: "0.34.65" -> "0.34"
 */
function getMajorMinorVersion(version) {
  const parts = version.split(".");
  if (parts.length >= 2) {
    return `${parts[0]}.${parts[1]}`;
  }
  return version;
}

/**
 * 버전 표시 컴포넌트 (개발자용)
 * 관리자만 볼 수 있습니다.
 * 마우스를 올리면 버전 히스토리가 표시됩니다.
 * 클릭하면 툴팁이 고정되어 더 편하게 볼 수 있습니다.
 */
function VersionDisplay() {
  const { adminId, loading } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [isChecking, setIsChecking] = useState(true);
  const [isHovered, setIsHovered] = useState(false);
  const [isFixed, setIsFixed] = useState(false);
  const [activeTab, setActiveTab] = useState(null);
  const tooltipRef = useRef(null);
  const hoverTimeoutRef = useRef(null);

  const history = versionData.history || [];

  // 버전을 메이저.마이너로 그룹화
  const groupedVersions = useMemo(() => {
    const groups = {};
    history.forEach((item) => {
      const majorMinor = getMajorMinorVersion(item.version);
      if (!groups[majorMinor]) {
        groups[majorMinor] = [];
      }
      groups[majorMinor].push(item);
    });
    return groups;
  }, [history]);

  // 탭 목록 (최신순 정렬)
  const tabs = useMemo(() => {
    return Object.keys(groupedVersions).sort((a, b) => {
      const [aMajor, aMinor] = a.split(".").map(Number);
      const [bMajor, bMinor] = b.split(".").map(Number);
      if (aMajor !== bMajor) return bMajor - aMajor;
      return bMinor - aMinor;
    });
  }, [groupedVersions]);

  // 초기 탭 설정 (최신 버전)
  useEffect(() => {
    if (tabs.length > 0 && activeTab === null) {
      setActiveTab(tabs[0]);
    }
  }, [tabs, activeTab]);

  // DashboardPage와 동일한 방식으로 관리자 권한 확인
  useEffect(() => {
    const checkAdminStatus = async () => {
      if (!adminId) {
        setIsAdmin(false);
        setIsChecking(false);
        return;
      }

      try {
        const result = await getAdminInfo(adminId);
        if (result.success && result.admin) {
          const adminIsAdmin = result.admin.isAdmin !== false;
          setIsAdmin(adminIsAdmin);
        } else {
          setIsAdmin(false);
        }
      } catch (error) {
        console.error("관리자 상태 확인 오류:", error);
        setIsAdmin(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkAdminStatus();
  }, [adminId]);

  // 바깥쪽 클릭 시 고정 해제
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        isFixed &&
        tooltipRef.current &&
        !tooltipRef.current.contains(event.target) &&
        !event.target.closest(`.${styles.versionText}`)
      ) {
        setIsFixed(false);
      }
    };

    if (isFixed) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [isFixed]);

  // cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) {
        clearTimeout(hoverTimeoutRef.current);
      }
    };
  }, []);

  // 마우스 진입 핸들러 (딜레이 취소하고 즉시 표시)
  const handleMouseEnter = () => {
    if (hoverTimeoutRef.current) {
      clearTimeout(hoverTimeoutRef.current);
      hoverTimeoutRef.current = null;
    }
    setIsHovered(true);
  };

  // 마우스 나감 핸들러 (딜레이 후 숨김)
  const handleMouseLeave = () => {
    if (!isFixed) {
      hoverTimeoutRef.current = setTimeout(() => {
        setIsHovered(false);
      }, 100); // 100ms 딜레이로 버전 텍스트와 툴팁 사이 이동 시간 확보
    }
  };

  // 로딩 중이거나 관리자가 아니면 아무것도 표시하지 않음
  if (loading || isChecking || !isAdmin) {
    return null;
  }

  // 클릭으로 고정 토글
  const handleVersionClick = (e) => {
    e.stopPropagation();
    setIsFixed(!isFixed);
  };

  const showTooltip = isHovered || isFixed;
  const currentTabItems = activeTab ? groupedVersions[activeTab] || [] : [];

  return (
    <div className={styles.versionDisplay}>
      <div
        className={styles.versionText}
        onClick={handleVersionClick}
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
      >
        v{versionData.version}
      </div>

      {showTooltip && (
        <div
          ref={tooltipRef}
          className={styles.historyTooltip}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
        >
          <div className={styles.tooltipHeader}>
            버전 히스토리
            {isFixed && (
              <button
                className={styles.closeButton}
                onClick={() => {
                  setIsFixed(false);
                  setIsHovered(false);
                }}
                aria-label="닫기"
              >
                ×
              </button>
            )}
          </div>

          {/* 버전 탭 */}
          {tabs.length > 0 && (
            <div className={styles.versionTabs}>
              {tabs.map((tab) => (
                <button
                  key={tab}
                  className={`${styles.versionTab} ${activeTab === tab ? styles.versionTabActive : ""}`}
                  onClick={() => setActiveTab(tab)}
                >
                  {tab}
                </button>
              ))}
            </div>
          )}

          <div className={styles.tooltipContent}>
            {currentTabItems.length > 0 ? (
              currentTabItems.map((item, index) => (
                <div key={index} className={styles.historyItem}>
                  <div className={styles.historyVersion}>
                    v{item.version}
                    <span className={styles.historyDate}> ({item.date})</span>
                  </div>
                  {item.changes && item.changes.length > 0 && (
                    <ul className={styles.historyChanges}>
                      {item.changes.map((change, changeIndex) => (
                        <li key={changeIndex}>{change}</li>
                      ))}
                    </ul>
                  )}
                </div>
              ))
            ) : (
              <div className={styles.noHistory}>버전 히스토리가 없습니다.</div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default VersionDisplay;
