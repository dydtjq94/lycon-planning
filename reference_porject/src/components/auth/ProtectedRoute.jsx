/**
 * Protected Route 컴포넌트
 * 로그인하지 않은 사용자를 로그인 페이지로 리다이렉트합니다.
 */

import React from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../../contexts/AuthContext";

/**
 * ProtectedRoute 컴포넌트
 * @param {React.ReactNode} children - 보호할 컴포넌트
 */
function ProtectedRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();

  // 로딩 중일 때는 아무것도 표시하지 않음
  if (loading) {
    return (
      <div style={{ padding: "2rem", textAlign: "center" }}>로딩 중...</div>
    );
  }

  // 로그인하지 않은 경우 로그인 페이지로 리다이렉트
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 로그인한 경우 자식 컴포넌트 렌더링
  return <>{children}</>;
}

export default ProtectedRoute;
