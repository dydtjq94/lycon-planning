/**
 * 로컬 스토리지 서비스 (Firebase 설정 완료 전 임시 사용)
 */

// 프로필 관리
export const profileService = {
  // 프로필 생성
  createProfile: async (profileData) => {
    const profiles = JSON.parse(localStorage.getItem("profiles") || "[]");
    const newProfile = {
      id: Date.now().toString(),
      ...profileData,
      createdAt: new Date().toISOString(),
    };
    profiles.push(newProfile);
    localStorage.setItem("profiles", JSON.stringify(profiles));
    return newProfile;
  },

  // 모든 프로필 조회
  getAllProfiles: async () => {
    const profiles = JSON.parse(localStorage.getItem("profiles") || "[]");
    return profiles;
  },

  // 프로필 조회
  getProfile: async (profileId) => {
    const profiles = JSON.parse(localStorage.getItem("profiles") || "[]");
    return profiles.find((profile) => profile.id === profileId);
  },

  // 프로필 수정
  updateProfile: async (profileId, updateData) => {
    const profiles = JSON.parse(localStorage.getItem("profiles") || "[]");
    const index = profiles.findIndex((profile) => profile.id === profileId);
    if (index !== -1) {
      profiles[index] = { ...profiles[index], ...updateData };
      localStorage.setItem("profiles", JSON.stringify(profiles));
      return profiles[index];
    }
    throw new Error("프로필을 찾을 수 없습니다.");
  },

  // 프로필 삭제
  deleteProfile: async (profileId) => {
    const profiles = JSON.parse(localStorage.getItem("profiles") || "[]");
    const filteredProfiles = profiles.filter(
      (profile) => profile.id !== profileId
    );
    localStorage.setItem("profiles", JSON.stringify(filteredProfiles));
  },
};

// 데이터 관리 (향후 확장용)
export const dataService = {
  addData: async (profileId, category, data) => {
    console.log("로컬 스토리지에 데이터 추가:", { profileId, category, data });
    // 향후 구현 예정
  },

  getAllData: async (profileId, category) => {
    console.log("로컬 스토리지에서 데이터 조회:", { profileId, category });
    return [];
  },

  updateData: async (profileId, category, itemId, updateData) => {
    console.log("로컬 스토리지에서 데이터 수정:", {
      profileId,
      category,
      itemId,
      updateData,
    });
  },

  deleteData: async (profileId, category, itemId) => {
    console.log("로컬 스토리지에서 데이터 삭제:", {
      profileId,
      category,
      itemId,
    });
  },
};
