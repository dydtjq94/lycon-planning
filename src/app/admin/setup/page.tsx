"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

interface Expert {
  id: string;
  name: string;
  title: string;
  user_id: string | null;
}

export default function AdminSetupPage() {
  const router = useRouter();
  const [experts, setExperts] = useState<Expert[]>([]);
  const [selectedExpertId, setSelectedExpertId] = useState<string>("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingExperts, setLoadingExperts] = useState(true);

  useEffect(() => {
    const loadExperts = async () => {
      const supabase = createClient();

      // user_id가 없는 전문가만 가져오기 (아직 계정 미연결)
      const { data } = await supabase
        .from("experts")
        .select("id, name, title, user_id")
        .is("user_id", null);

      if (data) {
        setExperts(data);
        if (data.length > 0) {
          setSelectedExpertId(data[0].id);
        }
      }
      setLoadingExperts(false);
    };

    loadExperts();
  }, []);

  const handleSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccess(null);

    if (!selectedExpertId) {
      setError("전문가를 선택해주세요.");
      return;
    }

    if (password !== confirmPassword) {
      setError("비밀번호가 일치하지 않습니다.");
      return;
    }

    if (password.length < 6) {
      setError("비밀번호는 최소 6자 이상이어야 합니다.");
      return;
    }

    setLoading(true);

    const supabase = createClient();

    // 1. 회원가입으로 auth 유저 생성
    const { data: authData, error: authError } = await supabase.auth.signUp({
      email,
      password,
    });

    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }

    if (!authData.user) {
      setError("계정 생성에 실패했습니다.");
      setLoading(false);
      return;
    }

    // 2. 전문가 테이블에 user_id 연결
    const { error: updateError } = await supabase
      .from("experts")
      .update({ user_id: authData.user.id })
      .eq("id", selectedExpertId);

    if (updateError) {
      setError("전문가 연결에 실패했습니다: " + updateError.message);
      setLoading(false);
      return;
    }

    setSuccess("전문가 계정이 생성되었습니다! 로그인 페이지로 이동합니다...");
    setLoading(false);

    // 3초 후 로그인 페이지로 이동
    setTimeout(() => {
      router.push("/admin/login");
    }, 2000);
  };

  if (loadingExperts) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <div className={styles.spinner} />
        </div>
      </div>
    );
  }

  if (experts.length === 0) {
    return (
      <div className={styles.loginContainer}>
        <div className={styles.loginCard}>
          <h1 className={styles.loginTitle}>전문가 계정 설정</h1>
          <p className={styles.loginSubtitle}>
            모든 전문가가 이미 계정과 연결되어 있습니다.
          </p>
          <button
            className={styles.loginButton}
            onClick={() => router.push("/admin/login")}
          >
            로그인 페이지로 이동
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>전문가 계정 설정</h1>
        <p className={styles.loginSubtitle}>
          전문가 계정을 생성하고 연결합니다
        </p>

        {error && <div className={styles.loginError}>{error}</div>}
        {success && (
          <div style={{
            padding: 12,
            background: "#f0fdf4",
            border: "1px solid #bbf7d0",
            borderRadius: 8,
            color: "#16a34a",
            fontSize: 14,
            textAlign: "center",
            marginBottom: 16
          }}>
            {success}
          </div>
        )}

        <form onSubmit={handleSetup} className={styles.loginForm}>
          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>전문가 선택</label>
            <select
              className={styles.input}
              value={selectedExpertId}
              onChange={(e) => setSelectedExpertId(e.target.value)}
              required
            >
              {experts.map((expert) => (
                <option key={expert.id} value={expert.id}>
                  {expert.name} ({expert.title})
                </option>
              ))}
            </select>
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>이메일</label>
            <input
              type="email"
              className={styles.input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="expert@lycon.ai"
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>비밀번호</label>
            <input
              type="password"
              className={styles.input}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="6자 이상"
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.inputLabel}>비밀번호 확인</label>
            <input
              type="password"
              className={styles.input}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              placeholder="비밀번호 확인"
              required
            />
          </div>

          <button
            type="submit"
            className={styles.loginButton}
            disabled={loading}
          >
            {loading ? "생성 중..." : "계정 생성"}
          </button>
        </form>

        <p style={{ marginTop: 16, fontSize: 13, color: "#737373", textAlign: "center" }}>
          이미 계정이 있나요?{" "}
          <a href="/admin/login" style={{ color: "#007aff" }}>
            로그인
          </a>
        </p>
      </div>
    </div>
  );
}
