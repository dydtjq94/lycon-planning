import type { Metadata } from "next";
import { SignupForm } from "./SignupForm";

export const metadata: Metadata = {
  title: "회원가입",
  description: "Lycon 회원가입 - 전문가와 함께하는 맞춤형 은퇴 설계",
};

export default function SignupPage() {
  return <SignupForm />;
}
