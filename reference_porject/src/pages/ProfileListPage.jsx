import React, { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import {
  profileService,
  globalSettingsService,
} from "../services/firestoreService";
import { simulationService } from "../services/simulationService";
import { calculateKoreanAge } from "../utils/koreanAge";
import { formatAmount } from "../utils/format";
import { trackPageView, trackEvent } from "../libs/mixpanel";
import TrashModal from "../components/trash/TrashModal";
import styles from "./ProfileListPage.module.css";

/**
 * 프로필 목록 페이지
 * 재무 상담사가 여러 내담자 프로필을 관리할 수 있습니다.
 */
function ProfileListPage() {
  const navigate = useNavigate();
  const { logout, admin, adminId, isAdmin, loading: authLoading } = useAuth();
  const [profiles, setProfiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [isTrashModalOpen, setIsTrashModalOpen] = useState(false); // 휴지통 모달
  const [activeTab, setActiveTab] = useState("sample"); // 기본 탭: 샘플
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    profileId: null,
    profileName: null,
  }); // 컨텍스트 메뉴
  const [duplicating, setDuplicating] = useState(false); // 복제 중 상태
  const [globalSettings, setGlobalSettings] = useState({
    defaultInflationRate: "1.89",
    defaultIncomeGrowthRate: "3.3",
    defaultInvestmentReturnRate: "2.86",
    defaultSavingGrowthRate: "1.89",
    defaultIncomeRate: "3",
    defaultRealEstateGrowthRate: "2.4",
    defaultAssetGrowthRate: "2.86",
    defaultDebtInterestRate: "3.5",
  });
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);

  // 프로필 목록 및 전역 설정 로드
  useEffect(() => {
    loadProfiles();
    loadGlobalSettings();
  }, []);

  // 전역 설정 로드
  const loadGlobalSettings = async () => {
    try {
      const settings = await globalSettingsService.getSettings();
      setGlobalSettings(settings);
    } catch (error) {
      console.error("전역 설정 로드 오류:", error);
    }
  };

  // 전역 설정 저장
  const handleSaveSettings = async () => {
    try {
      setSettingsSaving(true);
      await globalSettingsService.updateSettings(globalSettings);
      trackEvent("전역 설정 저장", {
        defaultInflationRate: globalSettings.defaultInflationRate,
      });
      setIsSettingsOpen(false);
    } catch (error) {
      console.error("전역 설정 저장 오류:", error);
      alert("설정 저장 중 오류가 발생했습니다.");
    } finally {
      setSettingsSaving(false);
    }
  };

  // Mixpanel: Consult 화면 진입 이벤트
  useEffect(() => {
    // 로딩이 완료되고 프로필 목록이 로드된 후 이벤트 트래킹
    if (!loading) {
      const sampleCount = profiles.filter((p) => p.status === "sample").length;
      const consultingCount = profiles.filter(
        (p) => p.status === "consulting"
      ).length;
      const completedCount = profiles.filter(
        (p) => p.status === "completed"
      ).length;

      trackPageView("프로필 목록 페이지 (Consult)", {
        profileCount: profiles.length,
        hasProfiles: profiles.length > 0,
        sampleCount: sampleCount,
        consultingCount: consultingCount,
        completedCount: completedCount,
        isAdmin: isAdmin,
        adminEmail: admin?.email || null,
      });
    }
  }, [loading, profiles.length, isAdmin, admin]);

  const loadProfiles = async () => {
    try {
      setLoading(true);
      const allProfiles = await profileService.getAllProfiles();

      // 각 프로필의 기본 시뮬레이션 retirementYear 로드
      const profilesWithRetirementYear = await Promise.all(
        allProfiles.map(async (profile) => {
          try {
            const simulations = await simulationService.getSimulations(
              profile.id || profile.docId
            );
            const defaultSim = simulations.find(
              (sim) => sim.isDefault === true
            );

            // 기본 시뮬레이션의 retirementYear가 있으면 사용, 없으면 프로필 기준으로 계산
            let retirementYear;
            if (defaultSim?.retirementYear) {
              retirementYear = defaultSim.retirementYear;
            } else {
              // 프로필의 retirementAge로부터 계산
              const birthYear = parseInt(profile.birthYear);
              const retirementAge = parseInt(profile.retirementAge);
              retirementYear = birthYear + retirementAge;
            }

            return {
              ...profile,
              retirementYear: retirementYear,
            };
          } catch (error) {
            console.error(`프로필 ${profile.id} 시뮬레이션 로드 오류:`, error);
            // 오류 발생 시 프로필 기준으로 계산
            const birthYear = parseInt(profile.birthYear);
            const retirementAge = parseInt(profile.retirementAge);
            return {
              ...profile,
              retirementYear: birthYear + retirementAge,
            };
          }
        })
      );

      // 생성일 기준으로 오래된 것부터 정렬 (오름차순)
      const sortedProfiles = profilesWithRetirementYear.sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      setProfiles(sortedProfiles);
    } catch (error) {
      console.error("프로필 로드 오류:", error);
      setError("프로필을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 현재 탭에 따라 필터링된 프로필 목록
  const filteredProfiles = profiles.filter((profile) => {
    const status = profile.status || "sample"; // 기본값: sample
    return status === activeTab;
  });

  // 로그아웃 핸들러
  const handleLogout = () => {
    trackEvent("로그아웃", {
      email: admin?.email,
    });
    logout();
    navigate("/login");
  };

  // 프로필 휴지통으로 이동 (soft delete)
  const handleDeleteProfile = async (profileId, profileName) => {
    if (
      !confirm(
        `"${profileName}" 프로필을 삭제하시겠습니까?\n\n휴지통으로 이동되며, 나중에 복구할 수 있습니다.`
      )
    ) {
      return;
    }

    try {
      await profileService.moveToTrash(profileId);
      trackEvent("프로필 삭제 (휴지통 이동)", { profileId, profileName });
      await loadProfiles(); // 목록 새로고침
    } catch (error) {
      console.error("프로필 삭제 오류:", error);
      alert("프로필 삭제 중 오류가 발생했습니다.");
    }
  };

  // 프로필 복제
  const handleDuplicateProfile = async (profileId, profileName) => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      profileId: null,
      profileName: null,
    });

    if (
      !confirm(
        `"${profileName}" 프로필을 복제하시겠습니까?\n\n모든 시뮬레이션과 데이터가 복사됩니다.`
      )
    ) {
      return;
    }

    try {
      setDuplicating(true);
      const newProfile = await profileService.duplicateProfile(profileId);
      trackEvent("프로필 복제", {
        originalProfileId: profileId,
        newProfileId: newProfile.id,
        profileName,
      });
      await loadProfiles(); // 목록 새로고침
      alert(`"${profileName}" 프로필이 복제되었습니다.`);
    } catch (error) {
      console.error("프로필 복제 오류:", error);
      alert("프로필 복제 중 오류가 발생했습니다.");
    } finally {
      setDuplicating(false);
    }
  };

  // 컨텍스트 메뉴 열기
  const handleContextMenu = (e, profileId, profileName) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      profileId,
      profileName,
    });
  };

  // 컨텍스트 메뉴 닫기 (클릭 시)
  useEffect(() => {
    const handleClick = () => {
      if (contextMenu.visible) {
        setContextMenu({
          visible: false,
          x: 0,
          y: 0,
          profileId: null,
          profileName: null,
        });
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, [contextMenu.visible]);

  // ESC 키로 설정 모달 닫기
  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === "Escape" && isSettingsOpen) {
        setIsSettingsOpen(false);
      }
    };
    if (isSettingsOpen) {
      document.addEventListener("keydown", handleEscape);
    }
    return () => document.removeEventListener("keydown", handleEscape);
  }, [isSettingsOpen]);

  // 만 나이 계산 (calculateKoreanAge 함수 사용)

  // 인증 로딩 중
  if (authLoading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>로딩 중...</div>
      </div>
    );
  }

  // 관리자가 아니면 로그인 페이지로 연결하는 안내 표시
  if (!adminId || !isAdmin) {
    return (
      <div className={styles.container}>
        <div className={styles.loginPrompt}>
          <h2 className={styles.loginTitle}>관리자 로그인이 필요합니다</h2>
          <p className={styles.loginMessage}>
            이 페이지에 접근하려면 관리자 계정으로 로그인해주세요.
          </p>
          <button
            className={styles.loginButton}
            onClick={() => navigate("/login")}
          >
            관리자 로그인하기
          </button>
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className={styles.container}>
        <div className={styles.loading}>프로필을 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.container}>
        <div className={styles.error}>{error}</div>
      </div>
    );
  }

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1 className={styles.title}>Lycon Planning</h1>
        <div className={styles.headerActions}>
          <button
            className={styles.settingsButton}
            onClick={() => setIsSettingsOpen(!isSettingsOpen)}
          >
            기본값 설정
          </button>
          <button
            className={styles.trashButton}
            onClick={() => setIsTrashModalOpen(true)}
          >
            휴지통
          </button>
          <button
            className={styles.createButton}
            onClick={() => navigate("/consult/create")}
          >
            + 새 프로필
          </button>
          <button
            className={styles.logoutButton}
            onClick={handleLogout}
            title={`${admin?.email || "사용자"} 로그아웃`}
          >
            로그아웃
          </button>
        </div>
      </div>

      {/* 기본값 설정 모달 */}
      {isSettingsOpen && (
        <div className={styles.settingsModalOverlay}>
          <div className={styles.settingsModal}>
            <div className={styles.settingsHeader}>
              <h3>기본값 설정</h3>
              <button
                className={styles.settingsCloseButton}
                onClick={() => setIsSettingsOpen(false)}
              >
                ✕
              </button>
            </div>
            <div className={styles.settingsContent}>
              {/* 소득/지출 그룹 */}
              <div className={styles.settingsGroup}>
                <h4 className={styles.settingsGroupTitle}>소득 / 지출</h4>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsField}>
                    <label htmlFor="defaultIncomeGrowthRate">
                      소득 상승률 (%)
                    </label>
                    <input
                      type="text"
                      id="defaultIncomeGrowthRate"
                      value={globalSettings.defaultIncomeGrowthRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setGlobalSettings({
                            ...globalSettings,
                            defaultIncomeGrowthRate: value,
                          });
                        }
                      }}
                      placeholder="3.3"
                    />
                    <span className={styles.settingsHint}>
                      소득 추가 시 기본값
                    </span>
                  </div>
                  <div className={styles.settingsField}>
                    <label htmlFor="defaultInflationRate">
                      물가 상승률 (%)
                    </label>
                    <input
                      type="text"
                      id="defaultInflationRate"
                      value={globalSettings.defaultInflationRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setGlobalSettings({
                            ...globalSettings,
                            defaultInflationRate: value,
                          });
                        }
                      }}
                      placeholder="1.89"
                    />
                    <span className={styles.settingsHint}>
                      지출, 국민연금 추가 시 기본값
                    </span>
                  </div>
                </div>
              </div>

              {/* 저축/투자 그룹 */}
              <div className={styles.settingsGroup}>
                <h4 className={styles.settingsGroupTitle}>저축 / 투자</h4>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsField}>
                    <label htmlFor="defaultInvestmentReturnRate">
                      연평균 수익률 (%)
                    </label>
                    <input
                      type="text"
                      id="defaultInvestmentReturnRate"
                      value={globalSettings.defaultInvestmentReturnRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setGlobalSettings({
                            ...globalSettings,
                            defaultInvestmentReturnRate: value,
                          });
                        }
                      }}
                      placeholder="2.86"
                    />
                    <span className={styles.settingsHint}>
                      저축/투자, 퇴직/개인연금
                    </span>
                  </div>
                  <div className={styles.settingsField}>
                    <label htmlFor="defaultSavingGrowthRate">
                      저축금액 증가율 (%)
                    </label>
                    <input
                      type="text"
                      id="defaultSavingGrowthRate"
                      value={globalSettings.defaultSavingGrowthRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setGlobalSettings({
                            ...globalSettings,
                            defaultSavingGrowthRate: value,
                          });
                        }
                      }}
                      placeholder="1.89"
                    />
                    <span className={styles.settingsHint}>
                      저축/투자 추가 시 기본값
                    </span>
                  </div>
                  <div className={styles.settingsField}>
                    <label htmlFor="defaultIncomeRate">
                      연간 수익률 (배당, 이자)
                    </label>
                    <input
                      type="text"
                      id="defaultIncomeRate"
                      value={globalSettings.defaultIncomeRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setGlobalSettings({
                            ...globalSettings,
                            defaultIncomeRate: value,
                          });
                        }
                      }}
                      placeholder="3"
                    />
                    <span className={styles.settingsHint}>
                      수익형 저축/투자, 수익형 자산
                    </span>
                  </div>
                </div>
              </div>

              {/* 자산 그룹 */}
              <div className={styles.settingsGroup}>
                <h4 className={styles.settingsGroupTitle}>부동산 / 자산</h4>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsField}>
                    <label htmlFor="defaultRealEstateGrowthRate">
                      부동산 가치 상승률 (%)
                    </label>
                    <input
                      type="text"
                      id="defaultRealEstateGrowthRate"
                      value={globalSettings.defaultRealEstateGrowthRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setGlobalSettings({
                            ...globalSettings,
                            defaultRealEstateGrowthRate: value,
                          });
                        }
                      }}
                      placeholder="2.4"
                    />
                    <span className={styles.settingsHint}>
                      부동산 추가 시 기본값
                    </span>
                  </div>
                  <div className={styles.settingsField}>
                    <label htmlFor="defaultAssetGrowthRate">
                      자산 가치 상승률 (%)
                    </label>
                    <input
                      type="text"
                      id="defaultAssetGrowthRate"
                      value={globalSettings.defaultAssetGrowthRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setGlobalSettings({
                            ...globalSettings,
                            defaultAssetGrowthRate: value,
                          });
                        }
                      }}
                      placeholder="2.86"
                    />
                    <span className={styles.settingsHint}>
                      자산 추가 시 기본값
                    </span>
                  </div>
                </div>
              </div>

              {/* 부채 그룹 */}
              <div className={styles.settingsGroup}>
                <h4 className={styles.settingsGroupTitle}>부채</h4>
                <div className={styles.settingsRow}>
                  <div className={styles.settingsField}>
                    <label htmlFor="defaultDebtInterestRate">
                      부채 이자율 (%)
                    </label>
                    <input
                      type="text"
                      id="defaultDebtInterestRate"
                      value={globalSettings.defaultDebtInterestRate}
                      onChange={(e) => {
                        const value = e.target.value;
                        if (value === "" || /^-?\d*\.?\d*$/.test(value)) {
                          setGlobalSettings({
                            ...globalSettings,
                            defaultDebtInterestRate: value,
                          });
                        }
                      }}
                      placeholder="3.5"
                    />
                    <span className={styles.settingsHint}>
                      부채 추가 시 기본값
                    </span>
                  </div>
                </div>
              </div>
            </div>
            <div className={styles.settingsActions}>
              <button
                className={styles.settingsCancelButton}
                onClick={() => setIsSettingsOpen(false)}
              >
                취소
              </button>
              <button
                className={styles.settingsSaveButton}
                onClick={handleSaveSettings}
                disabled={settingsSaving}
              >
                {settingsSaving ? "저장 중..." : "저장"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 탭 네비게이션 */}
      <div className={styles.tabNav}>
        <button
          className={`${styles.tabButton} ${
            activeTab === "sample" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("sample")}
        >
          샘플 (
          {profiles.filter((p) => (p.status || "sample") === "sample").length})
        </button>
        <button
          className={`${styles.tabButton} ${
            activeTab === "inProgress" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("inProgress")}
        >
          제작중 ({profiles.filter((p) => p.status === "inProgress").length})
        </button>
        <button
          className={`${styles.tabButton} ${
            activeTab === "beforeConsult" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("beforeConsult")}
        >
          상담 전 ({profiles.filter((p) => p.status === "beforeConsult").length}
          )
        </button>
        <button
          className={`${styles.tabButton} ${
            activeTab === "afterConsult" ? styles.tabButtonActive : ""
          }`}
          onClick={() => setActiveTab("afterConsult")}
        >
          상담 후 ({profiles.filter((p) => p.status === "afterConsult").length})
        </button>
      </div>

      <div className={styles.profileList}>
        {filteredProfiles.length === 0 && (
          <div className={styles.emptyState}>
            <p>
              {activeTab === "sample" && "샘플 프로필이 없습니다"}
              {activeTab === "inProgress" && "제작중인 프로필이 없습니다"}
              {activeTab === "beforeConsult" && "상담 전 프로필이 없습니다"}
              {activeTab === "afterConsult" && "상담 후 프로필이 없습니다"}
            </p>
          </div>
        )}

        {filteredProfiles.map((profile) => (
          <div
            key={profile.id}
            className={styles.profileItem}
            onClick={() => navigate(`/consult/dashboard/${profile.id}`)}
            onContextMenu={(e) =>
              handleContextMenu(e, profile.id, profile.name)
            }
          >
            <div className={styles.profileInfo}>
              <h3 className={styles.profileName}>{profile.name}님</h3>
              <span className={styles.infoText}>
                현재 {calculateKoreanAge(profile.birthYear)}세
              </span>
              <span className={styles.infoDivider}>|</span>
              <span className={styles.infoText}>
                은퇴 {profile.retirementAge}세 ({profile.retirementYear}년)
              </span>
              <span className={styles.infoDivider}>|</span>
              <span className={styles.infoText}>
                현금 {formatAmount(profile.currentCash || 0)}
              </span>
              <span className={styles.infoDivider}>|</span>
              <span className={styles.infoText}>
                목표{" "}
                {formatAmount(
                  profile.targetAssets || profile.targetAmount || 0
                )}
              </span>
              <span className={styles.infoDivider}>|</span>
              <span className={styles.infoText}>
                가구{" "}
                {(() => {
                  let count = 1;
                  if (profile.hasSpouse) count += 1;
                  if (profile.familyMembers)
                    count += profile.familyMembers.length;
                  return count;
                })()}
                명
              </span>
            </div>
            <div className={styles.profileActions}>
              <button
                className={styles.deleteButton}
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteProfile(profile.id, profile.name);
                }}
              >
                삭제
              </button>
            </div>
          </div>
        ))}

        {/* 프로필 추가 아이템 */}
        <div
          className={styles.addProfileItem}
          onClick={() => navigate("/consult/create")}
        >
          <div className={styles.addProfileContent}>
            <span className={styles.addIcon}>+</span>
            <span className={styles.addText}>새 프로필 추가</span>
          </div>
        </div>
      </div>

      {/* 휴지통 모달 */}
      <TrashModal
        isOpen={isTrashModalOpen}
        onClose={() => setIsTrashModalOpen(false)}
        onUpdate={loadProfiles}
      />

      {/* 컨텍스트 메뉴 */}
      {contextMenu.visible && (
        <div
          className={styles.contextMenu}
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className={styles.contextMenuItem}
            onClick={() =>
              handleDuplicateProfile(
                contextMenu.profileId,
                contextMenu.profileName
              )
            }
          >
            복제하기
          </button>
          <button
            className={styles.contextMenuItem}
            onClick={() => {
              setContextMenu({
                visible: false,
                x: 0,
                y: 0,
                profileId: null,
                profileName: null,
              });
              handleDeleteProfile(
                contextMenu.profileId,
                contextMenu.profileName
              );
            }}
          >
            삭제하기
          </button>
        </div>
      )}

      {/* 복제 중 오버레이 */}
      {duplicating && (
        <div className={styles.duplicatingOverlay}>
          <div className={styles.duplicatingContent}>
            <div className={styles.spinner}></div>
            <p>프로필 복제 중...</p>
          </div>
        </div>
      )}
    </div>
  );
}

export default ProfileListPage;
