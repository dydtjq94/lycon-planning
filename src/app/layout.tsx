import type { Metadata } from "next";
import { Geist, Geist_Mono, Gaegu } from "next/font/google";
import { QueryProvider } from "@/components/providers/QueryProvider";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const gaegu = Gaegu({
  variable: "--font-handwriting",
  subsets: ["latin"],
  weight: ["400"],
});

export const metadata: Metadata = {
  title: "Lycon | Retirement",
  description: "전문가와 함께하는 맞춤형 재무 설계 서비스",
  keywords: ["재무설계", "재무상담", "자산관리", "은퇴설계", "연금"],
  authors: [{ name: "Lycon" }],
  openGraph: {
    title: "Lycon | Retirement",
    description: "전문가와 함께하는 맞춤형 재무 설계 서비스",
    type: "website",
    locale: "ko_KR",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ko">
      <body
        className={`${geistSans.variable} ${geistMono.variable} ${gaegu.variable} antialiased`}
      >
        <QueryProvider>
          {children}
        </QueryProvider>
      </body>
    </html>
  );
}
