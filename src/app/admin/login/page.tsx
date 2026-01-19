"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import styles from "../admin.module.css";

export default function AdminLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();

    // 로그인 시도
    const { data, error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (authError) {
      setError("이메일 또는 비밀번호가 올바르지 않습니다.");
      setLoading(false);
      return;
    }

    if (!data.user) {
      setError("로그인에 실패했습니다.");
      setLoading(false);
      return;
    }

    // 전문가인지 확인
    const { data: expert } = await supabase
      .from("experts")
      .select("id")
      .eq("user_id", data.user.id)
      .single();

    if (!expert) {
      setError("전문가 계정이 아닙니다.");
      await supabase.auth.signOut();
      setLoading(false);
      return;
    }

    // 전문가 확인됨 → 대시보드로
    router.replace("/admin");
  };

  return (
    <div className={styles.loginContainer}>
      <div className={styles.loginCard}>
        <h1 className={styles.loginTitle}>Lycon Admin</h1>
        <p className={styles.loginSubtitle}>전문가 전용 관리 페이지입니다</p>

        {error && <div className={styles.loginError}>{error}</div>}

        <p style={{ marginBottom: 24, fontSize: 13, color: "#737373", textAlign: "center" }}>
          계정이 없나요?{" "}
          <a href="/admin/setup" style={{ color: "#007aff" }}>
            계정 설정
          </a>
        </p>

        <form onSubmit={handleLogin} className={styles.loginForm}>
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
              placeholder="비밀번호"
              required
            />
          </div>

          <button
            type="submit"
            className={styles.loginButton}
            disabled={loading}
          >
            {loading ? "로그인 중..." : "로그인"}
          </button>
        </form>
      </div>
    </div>
  );
}
