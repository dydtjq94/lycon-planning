"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { ArrowLeft, Users, Building2, Wallet, Receipt, PiggyBank, TrendingUp, CreditCard, Shield, Briefcase, Heart, LucideIcon } from "lucide-react";
import styles from "./tips.module.css";

interface TipCategory {
  id: string;
  title: string;
  icon: LucideIcon;
  description: string;
  tips: string[];
  documents: string[];
}

const TIP_DATA: Record<string, TipCategory> = {
  family: {
    id: "family",
    title: "가족 정보",
    icon: Users,
    description: "가족 구성원 정보를 정확히 파악해두세요.",
    tips: [
      "배우자와 자녀의 생년월일을 확인하세요",
      "부양 가족 수에 따라 세금 공제가 달라집니다",
      "자녀의 교육 계획을 미리 생각해보세요",
      "부모님 부양 여부도 고려하세요",
    ],
    documents: ["가족관계증명서", "주민등록등본"],
  },
  housing: {
    id: "housing",
    title: "거주/부동산",
    icon: Building2,
    description: "현재 거주 형태와 보유 부동산을 정리해보세요.",
    tips: [
      "자가/전세/월세 여부를 확인하세요",
      "보유 부동산의 현재 시세를 알아보세요",
      "주택담보대출이 있다면 잔액을 확인하세요",
      "부동산 보유세(재산세, 종부세)를 파악하세요",
    ],
    documents: ["등기부등본", "임대차계약서", "주택담보대출 상환 내역서"],
  },
  income: {
    id: "income",
    title: "소득",
    icon: Wallet,
    description: "모든 소득원을 빠짐없이 파악해두세요.",
    tips: [
      "근로소득: 월급, 상여금, 성과급 포함",
      "사업소득: 프리랜서, 부업 수입 포함",
      "금융소득: 이자, 배당 수입",
      "임대소득: 부동산 임대 수입",
      "연금소득: 국민연금, 퇴직연금 수령액",
    ],
    documents: ["급여명세서", "원천징수영수증", "종합소득세 신고서"],
  },
  expense: {
    id: "expense",
    title: "지출",
    icon: Receipt,
    description: "매달 나가는 지출을 항목별로 정리해보세요.",
    tips: [
      "고정 지출: 주거비, 보험료, 통신비, 구독료",
      "변동 지출: 식비, 교통비, 문화생활비",
      "비정기 지출: 경조사비, 여행비, 의료비",
      "카드 사용 내역을 확인하면 편리해요",
    ],
    documents: ["카드 사용 내역서", "자동이체 내역", "가계부"],
  },
  savings: {
    id: "savings",
    title: "저축",
    icon: PiggyBank,
    description: "보유 중인 저축 상품을 정리해보세요.",
    tips: [
      "예금: 정기예금, 적금 잔액",
      "청약저축: 주택청약종합저축 납입액",
      "비과세/절세 저축 상품 여부 확인",
      "만기일과 금리를 함께 정리하세요",
    ],
    documents: ["예금 잔액 증명서", "적금 내역서", "청약 납입 확인서"],
  },
  investment: {
    id: "investment",
    title: "투자",
    icon: TrendingUp,
    description: "투자 중인 금융자산을 파악해보세요.",
    tips: [
      "주식: 국내주식, 해외주식 평가금액",
      "펀드: 적립식, 거치식 펀드 현황",
      "ETF: 보유 종목과 수량",
      "ISA, 연금저축펀드 등 절세 계좌 확인",
    ],
    documents: ["증권 계좌 잔고 증명", "펀드 보유 현황", "ISA 가입 확인서"],
  },
  debt: {
    id: "debt",
    title: "부채",
    icon: CreditCard,
    description: "모든 부채를 빠짐없이 정리해보세요.",
    tips: [
      "주택담보대출: 잔액, 금리, 상환 방식",
      "신용대출: 잔액, 금리, 만기일",
      "카드론/현금서비스: 이용 잔액",
      "학자금 대출, 전세자금 대출 포함",
    ],
    documents: ["대출 상환 계획표", "금융거래 확인서"],
  },
  nationalPension: {
    id: "nationalPension",
    title: "국민연금",
    icon: Shield,
    description: "국민연금 예상 수령액을 확인해보세요.",
    tips: [
      "국민연금공단 홈페이지에서 예상 연금액 조회",
      "가입 기간에 따라 수령액이 달라져요",
      "조기 수령 vs 연기 수령 옵션 확인",
      "배우자의 국민연금도 함께 확인하세요",
    ],
    documents: ["국민연금 가입 내역서", "예상 연금액 조회 결과"],
  },
  retirementPension: {
    id: "retirementPension",
    title: "퇴직연금",
    icon: Briefcase,
    description: "직장에서 가입한 퇴직연금을 확인해보세요.",
    tips: [
      "DB형(확정급여형): 회사가 운용, 퇴직 시 확정 급여",
      "DC형(확정기여형): 본인이 운용, 운용 수익에 따라 변동",
      "IRP(개인형퇴직연금): 추가 납입 가능",
      "퇴직연금 적립금 현황 조회하세요",
    ],
    documents: ["퇴직연금 가입 확인서", "적립금 운용 현황"],
  },
  personalPension: {
    id: "personalPension",
    title: "개인연금",
    icon: Heart,
    description: "개인적으로 준비한 연금을 정리해보세요.",
    tips: [
      "연금저축: 연금저축펀드, 연금저축보험",
      "연간 납입액과 세액공제 한도 확인",
      "예상 수령 시기와 수령액 파악",
      "중도 해지 시 불이익 확인",
    ],
    documents: ["연금저축 가입 확인서", "납입 내역서"],
  },
};

export default function TipPage() {
  const router = useRouter();
  const params = useParams();
  const categoryId = params.category as string;
  const [isClosing, setIsClosing] = useState(false);

  const handleBack = () => {
    setIsClosing(true);
  };

  useEffect(() => {
    if (isClosing) {
      const timer = setTimeout(() => {
        router.back();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isClosing, router]);

  const category = TIP_DATA[categoryId];

  if (!category) {
    return (
      <div className={styles.container}>
        <div className={styles.errorState}>
          <p>존재하지 않는 카테고리입니다.</p>
          <button onClick={() => router.back()}>돌아가기</button>
        </div>
      </div>
    );
  }

  const IconComponent = category.icon;

  return (
    <div className={`${styles.container} ${isClosing ? styles.closing : ""}`}>
      <header className={styles.header}>
        <button className={styles.backButton} onClick={handleBack}>
          <ArrowLeft size={24} />
        </button>
        <h1 className={styles.headerTitle}>{category.title}</h1>
        <div className={styles.headerSpacer} />
      </header>

      <main className={styles.main}>
        {/* 카테고리 소개 */}
        <div className={styles.intro}>
          <div className={styles.iconWrapper}>
            <IconComponent size={32} />
          </div>
          <p className={styles.description}>{category.description}</p>
        </div>

        {/* 팁 섹션 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>파악해야 할 내용</h2>
          <ul className={styles.tipList}>
            {category.tips.map((tip, index) => (
              <li key={index} className={styles.tipItem}>
                {tip}
              </li>
            ))}
          </ul>
        </section>

        {/* 준비 서류 섹션 */}
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>참고할 서류</h2>
          <div className={styles.documentList}>
            {category.documents.map((doc, index) => (
              <span key={index} className={styles.documentTag}>
                {doc}
              </span>
            ))}
          </div>
        </section>
      </main>
    </div>
  );
}
