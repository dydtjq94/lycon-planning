/**
 * 인증 Context
 * Firestore 기반 로그인 상태를 전역으로 관리합니다.
 */

import React, {
  createContext,
  useContext,
  useState,
  useEffect,
  useCallback,
} from "react";
import {
  login as loginService,
  logout as logoutService,
  getAdminInfo,
  userLogin as userLoginService,
  signup as signupService,
  getUserInfo,
} from "../services/authService";

const AuthContext = createContext(null);

/**
 * AuthProvider 컴포넌트
 * 로그인 상태를 관리하고 전역적으로 제공합니다.
 */
export function AuthProvider({ children }) {
  const [admin, setAdmin] = useState(null);
  const [adminId, setAdminId] = useState(null);
  const [user, setUser] = useState(null);
  const [userId, setUserId] = useState(null);
  const [loading, setLoading] = useState(true);

  // Firestore에서 관리자 정보를 실시간으로 가져오는 함수
  const fetchAdminInfo = useCallback(async (id) => {
    if (!id) {
      console.warn("fetchAdminInfo: adminId가 없음");
      setAdmin(null);
      return;
    }

    console.log("fetchAdminInfo 호출, adminId:", id);
    try {
      const result = await getAdminInfo(id);
      console.log("getAdminInfo 결과:", result);

      // admins 컬렉션에 문서가 존재하면 성공 (isAdmin 체크는 하지 않음)
      if (result.success && result.admin) {
        console.log("관리자 정보 설정:", result.admin);
        setAdmin(result.admin);
      } else {
        // 문서가 존재하지 않으면 로그아웃 처리
        console.warn("관리자 문서가 존재하지 않음", result);
        setAdmin(null);
        setAdminId(null);
        localStorage.removeItem("adminId");
      }
    } catch (error) {
      console.error("관리자 정보 조회 오류:", error);
      setAdmin(null);
      setAdminId(null);
      localStorage.removeItem("adminId");
    }
  }, []);

  // Firestore에서 사용자 정보를 실시간으로 가져오는 함수
  const fetchUserInfo = useCallback(async (id) => {
    if (!id) {
      setUser(null);
      return;
    }

    try {
      const result = await getUserInfo(id);
      if (result.success && result.user) {
        setUser(result.user);
      } else {
        setUser(null);
        setUserId(null);
        localStorage.removeItem("userId");
      }
    } catch (error) {
      console.error("사용자 정보 조회 오류:", error);
      setUser(null);
      setUserId(null);
      localStorage.removeItem("userId");
    }
  }, []);

  // 컴포넌트 마운트 시 localStorage에서 adminId와 userId 확인 및 Firestore에서 실시간 검증
  useEffect(() => {
    const checkAuthStatus = async () => {
      const storedAdminId = localStorage.getItem("adminId");
      const storedUserId = localStorage.getItem("userId");

      if (storedAdminId) {
        setAdminId(storedAdminId);
        await fetchAdminInfo(storedAdminId);
      }

      if (storedUserId) {
        setUserId(storedUserId);
        await fetchUserInfo(storedUserId);
      }

      setLoading(false);
    };

    checkAuthStatus();
  }, [fetchAdminInfo, fetchUserInfo]);

  /**
   * 관리자 로그인 함수
   * @param {string} email - 이메일
   * @param {string} password - 비밀번호
   * @returns {Promise<Object>} 로그인 결과
   */
  const login = async (email, password) => {
    try {
      const result = await loginService(email, password);

      if (result.success && result.adminId) {
        // adminId만 localStorage에 저장
        setAdminId(result.adminId);
        localStorage.setItem("adminId", result.adminId);

        // Firestore에서 실시간으로 관리자 정보 가져오기
        await fetchAdminInfo(result.adminId);

        return { success: true, error: null };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("로그인 오류:", error);
      return {
        success: false,
        error: "로그인 중 오류가 발생했습니다.",
      };
    }
  };

  /**
   * 일반 사용자 로그인 함수
   * @param {string} email - 이메일
   * @param {string} password - 비밀번호
   * @returns {Promise<Object>} 로그인 결과
   */
  const userLogin = async (email, password) => {
    try {
      const result = await userLoginService(email, password);

      if (result.success && result.userId) {
        // userId만 localStorage에 저장
        setUserId(result.userId);
        localStorage.setItem("userId", result.userId);

        // Firestore에서 실시간으로 사용자 정보 가져오기
        await fetchUserInfo(result.userId);

        return { success: true, error: null };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("사용자 로그인 오류:", error);
      return {
        success: false,
        error: "로그인 중 오류가 발생했습니다.",
      };
    }
  };

  /**
   * 회원가입 함수
   * @param {string} email - 이메일
   * @param {string} password - 비밀번호
   * @param {string} passwordConfirm - 비밀번호 확인
   * @param {string} name - 이름
   * @param {string} profileId - 접근할 프로필 ID
   * @returns {Promise<Object>} 회원가입 결과
   */
  const signup = async (email, password, passwordConfirm, name, profileId) => {
    // 비밀번호 확인
    if (password !== passwordConfirm) {
      return {
        success: false,
        error: "비밀번호가 일치하지 않습니다.",
      };
    }

    try {
      const result = await signupService(email, password, name, profileId);

      if (result.success && result.userId) {
        // userId만 localStorage에 저장
        setUserId(result.userId);
        localStorage.setItem("userId", result.userId);

        // Firestore에서 실시간으로 사용자 정보 가져오기
        await fetchUserInfo(result.userId);

        return { success: true, error: null };
      } else {
        return { success: false, error: result.error };
      }
    } catch (error) {
      console.error("회원가입 오류:", error);
      return {
        success: false,
        error: "회원가입 중 오류가 발생했습니다.",
      };
    }
  };

  /**
   * 로그아웃 함수 (관리자 및 사용자 모두)
   */
  const logout = () => {
    logoutService();
    setAdmin(null);
    setAdminId(null);
    setUser(null);
    setUserId(null);
    localStorage.removeItem("adminId");
    localStorage.removeItem("userId");
  };

  // 관리자 상태를 실시간으로 확인하는 함수 (필요할 때마다 호출)
  const refreshAdminStatus = useCallback(async () => {
    if (adminId) {
      await fetchAdminInfo(adminId);
    }
  }, [adminId, fetchAdminInfo]);

  // 사용자 상태를 실시간으로 확인하는 함수 (필요할 때마다 호출)
  const refreshUserStatus = useCallback(async () => {
    if (userId) {
      await fetchUserInfo(userId);
    }
  }, [userId, fetchUserInfo]);

  const value = {
    // 관리자 관련
    admin,
    adminId,
    isAdmin: admin?.isAdmin !== false, // Firestore에서 가져온 실시간 정보
    // 사용자 관련
    user,
    userId,
    // 인증 상태
    isAuthenticated: (!!admin && !!adminId) || (!!user && !!userId),
    loading,
    // 관리자 함수
    login,
    // 사용자 함수
    userLogin,
    signup,
    // 공통 함수
    logout,
    refreshAdminStatus,
    refreshUserStatus,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

/**
 * useAuth 훅
 * AuthContext를 쉽게 사용할 수 있도록 합니다.
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth는 AuthProvider 내부에서만 사용할 수 있습니다.");
  }
  return context;
}
