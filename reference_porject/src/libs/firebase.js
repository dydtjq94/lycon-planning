// Firebase 설정
import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";

// Firebase 설정 (환경변수에서 가져오기)
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// Firestore 인스턴스
export const db = getFirestore(app);

// Auth 인스턴스
export const auth = getAuth(app);

// Firebase 연결 상태 확인
console.log("Firebase 초기화 완료");
console.log("프로젝트 ID:", firebaseConfig.projectId);
console.log("API 키:", firebaseConfig.apiKey ? "설정됨" : "없음");

// AbortError 전역 처리 (개발 환경에서만)
if (import.meta.env.DEV) {
  window.addEventListener("unhandledrejection", (event) => {
    if (event.reason && event.reason.name === "AbortError") {
      console.warn("AbortError 무시됨:", event.reason);
      event.preventDefault(); // 에러를 콘솔에 표시하지 않음
    }
  });
}

export default app;
