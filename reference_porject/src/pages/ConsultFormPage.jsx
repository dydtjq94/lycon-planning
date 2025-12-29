import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../libs/firebase";
import styles from "./ConsultFormPage.module.css";

/**
 * ConsultFormPage 컴포넌트
 * 무료 사전상담 신청 페이지
 */
function ConsultFormPage() {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    email: "",
    message: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStatus, setSubmitStatus] = useState(null);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    setSubmitStatus(null);

    try {
      await addDoc(collection(db, "consultRequests"), {
        ...formData,
        createdAt: serverTimestamp(),
        status: "pending",
      });

      if (window.mixpanel) {
        window.mixpanel.track("상담 신청 완료", {
          name: formData.name,
        });
      }

      setSubmitStatus("success");

      setTimeout(() => {
        navigate("/");
      }, 3000);
    } catch (error) {
      console.error("상담 신청 오류:", error);
      setSubmitStatus("error");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className={styles.container}>
      {submitStatus === "success" ? (
        <div className={styles.success}>
          <div className={styles.successIcon}>✓</div>
          <h2>신청 완료</h2>
          <p>24시간 내에 연락드리겠습니다.</p>
        </div>
      ) : (
        <div className={styles.formCard}>
          <button className={styles.back} onClick={() => navigate("/")}>
            ← 돌아가기
          </button>

          <h1 className={styles.title}>무료 사전상담 신청</h1>

          <form onSubmit={handleSubmit} className={styles.form}>
            <div className={styles.field}>
              <label>이름 *</label>
              <input
                type="text"
                name="name"
                value={formData.name}
                onChange={handleChange}
                required
                placeholder="홍길동"
              />
            </div>

            <div className={styles.field}>
              <label>연락처 *</label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="010-1234-5678"
              />
            </div>

            <div className={styles.field}>
              <label>이메일 *</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                required
                placeholder="example@email.com"
              />
            </div>

            <div className={styles.field}>
              <label>문의사항</label>
              <textarea
                name="message"
                value={formData.message}
                onChange={handleChange}
                rows="4"
                placeholder="상담 받고 싶은 내용이나 궁금한 점을 자유롭게 작성해주세요."
              />
            </div>

            {submitStatus === "error" && (
              <div className={styles.error}>
                오류가 발생했습니다. 다시 시도해주세요.
              </div>
            )}

            <button type="submit" disabled={isSubmitting} className={styles.submit}>
              {isSubmitting ? "신청 중..." : "신청하기"}
            </button>

            <p className={styles.note}>
              개인정보는 상담 목적으로만 사용되며, 상담 종료 후 파기됩니다.
            </p>
          </form>
        </div>
      )}
    </div>
  );
}

export default ConsultFormPage;
