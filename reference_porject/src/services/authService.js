/**
 * 인증 서비스 (Firestore 기반)
 * Firestore의 admins 컬렉션에서 관리자 정보를 확인합니다.
 */

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  addDoc,
  updateDoc,
} from "firebase/firestore";
import { db } from "../libs/firebase";

/**
 * 로그인 - Firestore에서 admin 확인
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {Object} { success: boolean, admin: Object|null, error: string|null }
 */
export const login = async (email, password) => {
  try {
    // admins 컬렉션에서 이메일로 검색
    const adminsRef = collection(db, "admins");
    const q = query(adminsRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return {
        success: false,
        admin: null,
        error: "존재하지 않는 이메일입니다.",
      };
    }

    // 첫 번째 문서 가져오기
    const adminDoc = querySnapshot.docs[0];
    const adminData = adminDoc.data();

    // 비밀번호 확인 (테스트용이므로 간단하게 비교)
    // 실제 프로덕션에서는 해싱된 비밀번호를 비교해야 함
    if (adminData.password !== password) {
      return {
        success: false,
        admin: null,
        error: "비밀번호가 맞지 않습니다.",
      };
    }

    // 로그인 성공 - adminId만 반환 (나머지는 Firestore에서 실시간으로 가져옴)
    const adminIdToReturn = adminDoc.id;
    console.log("로그인 성공 - adminId:", adminIdToReturn);
    return {
      success: true,
      adminId: adminIdToReturn, // adminId만 반환
      error: null,
    };
  } catch (error) {
    console.error("로그인 오류:", error);
    return {
      success: false,
      admin: null,
      error: "로그인 중 오류가 발생했습니다: " + error.message,
    };
  }
};

/**
 * 관리자 정보 확인
 * Firestore의 admins 컬렉션에 문서가 존재하는지 확인하고 관리자 정보를 가져옵니다.
 * isAdmin 값은 UI 결정 용도로만 사용되며, 접근 제어에는 사용되지 않습니다.
 * @param {string} adminId - 관리자 ID
 * @returns {Promise<Object>} { success: boolean, admin: Object|null }
 */
export const verifyAdminStatus = async (adminId) => {
  try {
    console.log("verifyAdminStatus 호출, adminId:", adminId);
    const adminDocRef = doc(db, "admins", adminId);
    const adminDocSnap = await getDoc(adminDocRef);

    if (!adminDocSnap.exists()) {
      console.warn("관리자 문서가 존재하지 않음, adminId:", adminId);
      return {
        success: false,
        admin: null,
      };
    }

    const adminData = adminDocSnap.data();
    console.log("Firestore에서 가져온 adminData:", adminData);
    // isAdmin은 정보로만 저장 (접근 제어 용도가 아님)
    const isAdmin = adminData.isAdmin !== false;

    const adminInfo = {
      id: adminDocSnap.id,
      email: adminData.email,
      name: adminData.name || adminData.email,
      isAdmin, // UI 결정용 정보로만 사용
    };
    console.log("반환할 adminInfo:", adminInfo);

    return {
      success: true,
      admin: adminInfo,
    };
  } catch (error) {
    console.error("관리자 상태 확인 오류:", error);
    return {
      success: false,
      admin: null,
    };
  }
};

/**
 * 관리자 정보 가져오기 (adminId 기반)
 * Firestore에서 관리자 정보를 실시간으로 가져옵니다.
 * @param {string} adminId - 관리자 ID
 * @returns {Promise<Object>} { success: boolean, admin: Object|null }
 */
export const getAdminInfo = async (adminId) => {
  return await verifyAdminStatus(adminId);
};

/**
 * 회원가입 - users 컬렉션에 새 사용자 추가
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @param {string} name - 이름
 * @param {string} profileId - 접근할 프로필 ID
 * @returns {Promise<Object>} { success: boolean, userId: string|null, error: string|null }
 */
export const signup = async (email, password, name, profileId) => {
  try {
    // 이메일 중복 확인
    const usersRef = collection(db, "users");
    const emailQuery = query(usersRef, where("email", "==", email));
    const emailSnapshot = await getDocs(emailQuery);

    if (!emailSnapshot.empty) {
      return {
        success: false,
        userId: null,
        error: "이미 사용 중인 이메일입니다.",
      };
    }

    // 새 사용자 생성
    const userData = {
      email,
      password, // 실제 프로덕션에서는 해싱 필요
      name,
      profileIds: profileId ? [profileId] : [], // 해당 프로필에 대한 권한 부여
      createdAt: new Date().toISOString(),
    };

    const docRef = await addDoc(collection(db, "users"), userData);

    return {
      success: true,
      userId: docRef.id,
      error: null,
    };
  } catch (error) {
    console.error("회원가입 오류:", error);
    return {
      success: false,
      userId: null,
      error: "회원가입 중 오류가 발생했습니다: " + error.message,
    };
  }
};

/**
 * 일반 사용자 로그인 - users 컬렉션에서 확인
 * @param {string} email - 이메일
 * @param {string} password - 비밀번호
 * @returns {Promise<Object>} { success: boolean, userId: string|null, error: string|null }
 */
export const userLogin = async (email, password) => {
  try {
    const usersRef = collection(db, "users");
    const q = query(usersRef, where("email", "==", email));
    const querySnapshot = await getDocs(q);

    if (querySnapshot.empty) {
      return {
        success: false,
        userId: null,
        error: "존재하지 않는 이메일입니다.",
      };
    }

    const userDoc = querySnapshot.docs[0];
    const userData = userDoc.data();

    if (userData.password !== password) {
      return {
        success: false,
        userId: null,
        error: "비밀번호가 맞지 않습니다.",
      };
    }

    return {
      success: true,
      userId: userDoc.id,
      error: null,
    };
  } catch (error) {
    console.error("사용자 로그인 오류:", error);
    return {
      success: false,
      userId: null,
      error: "로그인 중 오류가 발생했습니다: " + error.message,
    };
  }
};

/**
 * 사용자 정보 조회
 * @param {string} userId - 사용자 ID
 * @returns {Promise<Object>} { success: boolean, user: Object|null }
 */
export const getUserInfo = async (userId) => {
  try {
    const userDocRef = doc(db, "users", userId);
    const userDocSnap = await getDoc(userDocRef);

    if (!userDocSnap.exists()) {
      return {
        success: false,
        user: null,
      };
    }

    const userData = userDocSnap.data();
    return {
      success: true,
      user: {
        id: userDocSnap.id,
        email: userData.email,
        name: userData.name || userData.email,
        profileIds: userData.profileIds || [],
      },
    };
  } catch (error) {
    console.error("사용자 정보 조회 오류:", error);
    return {
      success: false,
      user: null,
    };
  }
};

/**
 * 사용자가 특정 프로필에 대한 접근 권한이 있는지 확인
 * @param {string} userId - 사용자 ID
 * @param {string} profileId - 프로필 ID
 * @returns {Promise<boolean>} 권한 여부
 */
export const checkProfileAccess = async (userId, profileId) => {
  try {
    const userInfo = await getUserInfo(userId);
    if (!userInfo.success || !userInfo.user) {
      return false;
    }

    return userInfo.user.profileIds.includes(profileId);
  } catch (error) {
    console.error("프로필 접근 권한 확인 오류:", error);
    return false;
  }
};

/**
 * 로그아웃 (관리자 및 사용자 모두)
 */
export const logout = () => {
  // localStorage에서 adminId와 userId 모두 제거
  localStorage.removeItem("adminId");
  localStorage.removeItem("userId");
  return { success: true };
};
