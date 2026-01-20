import type { Metadata } from "next";
import { LoginForm } from "./LoginForm";

export const metadata: Metadata = {
  title: "로그인",
  description: "Lycon 로그인 - 내 은퇴 설계 확인하기",
};

export default function LoginPage() {
  return <LoginForm />;
}
