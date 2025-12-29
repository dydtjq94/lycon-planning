import React, { useState, useEffect } from "react";
import { profileService } from "../../services/firestoreService";
import { trackEvent } from "../../libs/mixpanel";
import styles from "./TrashModal.module.css";

/**
 * 휴지통 모달
 * 삭제된 프로필 목록을 보여주고 복구 또는 완전 삭제 가능
 */
function TrashModal({ isOpen, onClose, onUpdate }) {
  const [deletedProfiles, setDeletedProfiles] = useState([]);
  const [loading, setLoading] = useState(false);

  // 삭제된 프로필 로드
  useEffect(() => {
    if (isOpen) {
      loadDeletedProfiles();
      trackEvent("휴지통 모달 열기");
    }
  }, [isOpen]);

  const loadDeletedProfiles = async () => {
    try {
      setLoading(true);
      const profiles = await profileService.getDeletedProfiles();
      setDeletedProfiles(profiles);
    } catch (error) {
      console.error("삭제된 프로필 조회 오류:", error);
      alert("삭제된 프로필을 불러오는 중 오류가 발생했습니다.");
    } finally {
      setLoading(false);
    }
  };

  // 프로필 복구
  const handleRestore = async (profileId, profileName) => {
    if (!confirm(`"${profileName}" 프로필을 복구하시겠습니까?`)) {
      return;
    }

    try {
      await profileService.restoreFromTrash(profileId);
      trackEvent("프로필 복구", { profileId, profileName });
      alert(`"${profileName}" 프로필이 복구되었습니다.`);
      await loadDeletedProfiles();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("프로필 복구 오류:", error);
      alert("프로필 복구 중 오류가 발생했습니다.");
    }
  };

  // 프로필 완전 삭제
  const handlePermanentDelete = async (profileId, profileName) => {
    if (
      !confirm(
        `"${profileName}" 프로필을 완전히 삭제하시겠습니까?\n\n이 작업은 되돌릴 수 없으며, 모든 관련 데이터(수입, 지출, 저축, 연금, 부동산, 자산, 부채)가 함께 삭제됩니다.`
      )
    ) {
      return;
    }

    try {
      await profileService.deleteProfileWithAllData(profileId);
      trackEvent("프로필 완전 삭제", { profileId, profileName });
      alert(`"${profileName}" 프로필이 완전히 삭제되었습니다.`);
      await loadDeletedProfiles();
      if (onUpdate) onUpdate();
    } catch (error) {
      console.error("프로필 완전 삭제 오류:", error);
      alert("프로필 삭제 중 오류가 발생했습니다.");
    }
  };

  // ESC 키로 모달 닫기 + body 스크롤 막기
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e) => {
      if (e.key === "Escape") {
        onClose();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    // 모달이 열릴 때 body 스크롤 막기
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      // 모달이 닫힐 때 body 스크롤 복원
      document.body.style.overflow = "";
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modalContent} onClick={(e) => e.stopPropagation()}>
        <div className={styles.modalHeader}>
          <h2 className={styles.modalTitle}>🗑️ 휴지통</h2>
          <button
            type="button"
            className={styles.closeButton}
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className={styles.modalBody}>
          {loading ? (
            <div className={styles.loading}>삭제된 프로필을 불러오는 중...</div>
          ) : deletedProfiles.length === 0 ? (
            <div className={styles.emptyState}>
              <p>휴지통이 비어있습니다</p>
            </div>
          ) : (
            <div className={styles.profileList}>
              {deletedProfiles.map((profile) => (
                <div key={profile.id} className={styles.profileItem}>
                  <div className={styles.profileInfo}>
                    <span className={styles.profileName}>{profile.name}님</span>
                    <span className={styles.deletedDate}>
                      삭제일:{" "}
                      {new Date(profile.deletedAt).toLocaleDateString("ko-KR", {
                        year: "numeric",
                        month: "long",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                  <div className={styles.profileActions}>
                    <button
                      className={styles.restoreButton}
                      onClick={() => handleRestore(profile.id, profile.name)}
                    >
                      복구
                    </button>
                    <button
                      className={styles.deleteButton}
                      onClick={() =>
                        handlePermanentDelete(profile.id, profile.name)
                      }
                    >
                      완전삭제
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className={styles.modalFooter}>
          <button className={styles.cancelButton} onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}

export default TrashModal;

