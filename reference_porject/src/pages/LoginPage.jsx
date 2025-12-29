/**
 * 로그인 페이지
 * Firestore 기반 이메일/비밀번호 로그인
 */

import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";
import { trackEvent } from "../libs/mixpanel";
import styles from "./LoginPage.module.css";

function LoginPage() {
  const navigate = useNavigate();
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  /**
   * 로그인 제출 핸들러
   */
  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const result = await login(email, password);

      if (result.success) {
        // Mixpanel: 로그인 성공 이벤트
        trackEvent("로그인 성공", {
          email: email,
        });

        // /consult로 리다이렉트
        navigate("/consult");
      } else {
        setError(result.error || "로그인에 실패했습니다.");
        // Mixpanel: 로그인 실패 이벤트
        trackEvent("로그인 실패", {
          email: email,
          error: result.error,
        });
      }
    } catch (error) {
      console.error("로그인 오류:", error);
      setError("로그인 중 오류가 발생했습니다.");
      trackEvent("로그인 오류", {
        email: email,
        error: error.message,
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.container}>
      <div className={styles.loginBox}>
        <div className={styles.header}>
          <h1 className={styles.title}>Lycon Planning</h1>
          <p className={styles.subtitle}>로그인이 필요합니다</p>
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.formGroup}>
            <label htmlFor="email" className={styles.label}>
              이메일
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={styles.input}
              placeholder="이메일을 입력하세요"
              required
              disabled={loading}
            />
          </div>

          <div className={styles.formGroup}>
            <label htmlFor="password" className={styles.label}>
              비밀번호
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className={styles.input}
              placeholder="비밀번호를 입력하세요"
              required
              disabled={loading}
            />
          </div>

          {error && <div className={styles.errorMessage}>{error}</div>}

          <button
            type="submit"
            className={styles.submitButton}
            disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}

export default LoginPage;
