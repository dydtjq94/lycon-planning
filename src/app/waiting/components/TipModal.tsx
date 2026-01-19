"use client";

import { useState, useEffect } from "react";
import {
  ArrowLeft,
  ExternalLink,
  Users,
  Building2,
  Wallet,
  Receipt,
  PiggyBank,
  TrendingUp,
  CreditCard,
  Shield,
  Briefcase,
  Heart,
  LucideIcon,
  Edit3,
} from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { InputFormModal } from "./InputFormModal";
import { FamilyInputForm } from "./FamilyInputForm";
import { IncomeInputForm, type IncomeFormData } from "./IncomeInputForm";
import { ExpenseInputForm, type ExpenseFormData } from "./ExpenseInputForm";
import { SavingsInputForm } from "./SavingsInputForm";
import { InvestmentInputForm } from "./InvestmentInputForm";
import { HousingInputForm } from "./HousingInputForm";
import { DebtInputForm } from "./DebtInputForm";
import { NationalPensionInputForm } from "./NationalPensionInputForm";
import { RetirementPensionInputForm } from "./RetirementPensionInputForm";
import { PersonalPensionInputForm } from "./PersonalPensionInputForm";
import type {
  FamilyMember,
  FinancialAssetItem,
  InvestmentAccountData,
  HousingData,
  DebtItem,
  NationalPensionData,
  RetirementPensionData,
  PersonalPensionItem,
} from "../types";
import styles from "./TipModal.module.css";

// prep_data 전체 타입
interface PrepDataStore {
  family?: FamilyMember[];
  income?: IncomeFormData;
  expense?: ExpenseFormData;
  savings?: FinancialAssetItem[];
  investment?: InvestmentAccountData;
  housing?: HousingData;
  debt?: DebtItem[];
  nationalPension?: NationalPensionData;
  retirementPension?: RetirementPensionData;
  personalPension?: PersonalPensionItem[];
}

interface TipLink {
  label: string;
  url: string;
}

interface TipStep {
  step: number;
  text: string;
}

interface TipCategory {
  id: string;
  title: string;
  icon: LucideIcon;
  summary: string[];
  placeholder: string;
  steps?: TipStep[];
  details?: string[];
  documents: string[];
  links?: TipLink[];
}

const TIP_DATA: Record<string, TipCategory> = {
  family: {
    id: "family",
    title: "가계 정보",
    icon: Users,
    summary: [
      "본인/배우자 생년월일",
      "자녀 생년월일",
      "희망 은퇴 나이",
      "부양 가족",
    ],
    placeholder:
      "예: 본인 1985년생, 배우자 1987년생\n자녀: 아들 2018년생, 딸 2020년생\n희망 은퇴: 60세\n부양가족: 어머니 함께 거주",
    details: [
      "본인: 생년월일, 희망 은퇴 나이",
      "배우자: 생년월일, 직장 유무, 예상 은퇴 나이",
      "자녀: 각 자녀의 생년월일",
      "부양가족: 함께 사는 부모님 유무",
    ],
    documents: [],
  },
  housing: {
    id: "housing",
    title: "거주용 부동산",
    icon: Building2,
    summary: ["거주 형태 (자가/전세/월세)", "시세 또는 보증금", "대출 현황"],
    placeholder:
      "예: 자가, 아파트 시세 8억\n주담대 잔액 3억, 금리 4.5%\n월 상환액 150만원, 만기 2040년\n관리비 월 25만원",
    details: [
      "자가: 현재 시세 (네이버부동산, 호갱노노)",
      "자가: 주담대 잔액, 금리, 만기일, 월 상환액",
      "전세: 보증금 금액",
      "전세: 전세대출 잔액, 금리, 만기일",
      "월세: 보증금, 월세 금액",
      "관리비: 월 평균 금액",
    ],
    documents: [],
  },
  savings: {
    id: "savings",
    title: "저축",
    icon: PiggyBank,
    summary: [
      "보유 현금(입출금 통장 잔액)",
      "정기예금 잔액/금리/만기",
      "적금 잔액/금리/만기",
    ],
    placeholder:
      "예: 입출금 통장 총 2,000만원\n정기예금 5,000만원 (3.8%, 2025.06 만기)\n적금 월 50만원씩, 현재 600만원\n청약통장 1,200만원",
    steps: [
      { step: 1, text: "토스, 카카오페이, 뱅크샐러드 앱 열기" },
      { step: 2, text: "자산 연동에서 모든 은행 계좌 연결" },
      { step: 3, text: "아래 항목들을 확인하세요" },
    ],
    details: [
      "보유 현금: 입출금 통장 전체 잔액 합계",
      "정기예금: 잔액, 금리(%), 만기일",
      "적금: 잔액, 월 납입액, 금리(%), 만기일",
      "청약통장: 납입 총액",
    ],
    documents: [],
  },
  investment: {
    id: "investment",
    title: "투자",
    icon: TrendingUp,
    summary: [
      "주식/ETF 평가금액",
      "펀드 평가금액",
      "가상자산 평가금액",
      "금 평가금액",
    ],
    placeholder:
      "예: 국내주식/ETF 3,000만원\n해외주식/ETF 2,000만원\n펀드 1,500만원\n가상자산 500만원",
    steps: [
      { step: 1, text: "증권사 앱에서 자산현황 확인" },
      { step: 2, text: "코인 거래소 앱에서 잔고 확인" },
      { step: 3, text: "금 등 실물자산 시세 확인" },
    ],
    details: [
      "국내주식/ETF: 평가금액 합계",
      "해외주식/ETF: 평가금액 (원화 환산)",
      "펀드: 평가금액 합계",
      "가상자산: 거래소별 평가금액",
      "금: 현재 시세 기준 평가금액",
    ],
    documents: [],
  },
  debt: {
    id: "debt",
    title: "부채",
    icon: CreditCard,
    summary: ["대출 잔액/금리", "할부 잔액", "카드론 잔액"],
    placeholder:
      "예: 신용대출 2,000만원 (5.5%)\n마이너스통장 500만원 사용중\n카드할부 잔액 200만원\n학자금대출 없음",
    steps: [
      { step: 1, text: "토스/카카오페이 '내 대출' 확인" },
      { step: 2, text: "아래 항목별로 정리하세요" },
    ],
    details: [
      "신용대출: 잔액, 금리(%), 월 상환액",
      "마이너스통장: 사용 금액, 금리(%)",
      "카드할부: 남은 할부금액",
      "카드론/현금서비스: 잔액, 금리(%)",
      "학자금대출: 잔액, 금리(%)",
      "기타: 보험약관대출, 자동차할부 등",
    ],
    documents: [],
  },
  income: {
    id: "income",
    title: "소득",
    icon: Wallet,
    summary: ["월급 실수령액", "상여금/성과급 월평균", "기타소득 월평균"],
    placeholder:
      "예: 본인 월급 400만원 (세후)\n배우자 월급 300만원\n상여금 연 600만원 (월 50만원)\n기타소득 없음",
    details: [
      "근로소득: 월급 실수령액 (세후)",
      "상여금: 연간 총액 ÷ 12",
      "사업소득: 월 평균 순수입",
      "임대소득: 월세 수입",
      "기타소득: 이자, 배당 등 (연간 ÷ 12)",
      "가계 기준 상담 시 배우자분 것도 함께 파악",
    ],
    documents: [],
  },
  nationalPension: {
    id: "nationalPension",
    title: "국민(공적)연금",
    icon: Shield,
    summary: ["예상 월 수령액 (본인)", "예상 월 수령액 (배우자)"],
    placeholder:
      "예: 본인 65세 수령 시 월 120만원\n배우자 65세 수령 시 월 80만원\n(국민연금공단 조회 결과)",
    steps: [
      { step: 1, text: "아래 링크에서 해당 연금 사이트 접속" },
      { step: 2, text: "공동인증서/간편인증 로그인" },
      { step: 3, text: "'예상연금액 조회' 클릭" },
    ],
    details: [
      "본인과 배우자 모두 각자 조회",
      "조회 화면을 캡처해두면 편해요",
      "가계 기준 상담 시 배우자분 것도 함께 파악",
    ],
    documents: [],
    links: [
      {
        label: "국민연금 조회",
        url: "https://csa.nps.or.kr/ohkd/ntpsidnty/anpninq/UHKD7101M0.do",
      },
      { label: "공무원연금 조회", url: "https://www.geps.or.kr" },
      { label: "사학연금 조회", url: "https://www.tp.or.kr" },
      { label: "군인연금 조회", url: "https://www.mps.mil.kr" },
    ],
  },
  retirementPension: {
    id: "retirementPension",
    title: "퇴직연금/퇴직금",
    icon: Briefcase,
    summary: ["DB형: 근속연수", "DC형: 적립금 잔액", "IRP: 잔액"],
    placeholder:
      "예: 본인 DC형, 적립금 4,500만원\nIRP 추가납입 800만원\n배우자 DB형, 근속 8년차",
    steps: [
      { step: 1, text: "아래 통합연금포털에서 로그인" },
      { step: 2, text: "연금계약정보 조회 (개인연금도 함께 조회됨)" },
      { step: 3, text: "조회 결과를 PDF로 저장해두세요" },
    ],
    details: [
      "DB형 (확정급여): 현재 근속연수만 알면 됨",
      "DC형 (확정기여): 현재 적립금 잔액 확인",
      "IRP: 개인 추가 납입 잔액 확인",
      "PDF 저장 시 개인연금 정보도 함께 확인 가능",
      "가계 기준 상담 시 배우자분 것도 함께 파악",
    ],
    documents: [],
    links: [
      {
        label: "연금포털에서 조회",
        url: "https://www.fss.or.kr/fss/lifeplan/anntyLogin/list.do?menuNo=200945",
      },
    ],
  },
  personalPension: {
    id: "personalPension",
    title: "개인연금",
    icon: Heart,
    summary: ["연금저축 잔액", "IRP 개인납입 잔액", "저축성보험 해약환급금"],
    placeholder:
      "예: 연금저축펀드 2,000만원\n연금저축보험 1,500만원\n저축성보험 해약환급금 3,000만원",
    steps: [
      { step: 1, text: "가입한 금융사 앱 열기 (은행/증권/보험)" },
      { step: 2, text: "연금 메뉴에서 잔액 확인" },
    ],
    details: [
      "연금저축펀드: 현재 평가금액",
      "연금저축보험: 현재 적립금",
      "연금저축신탁: 현재 잔액",
      "IRP 개인납입분: 본인 추가 납입 금액",
      "저축성 보험: 해약환급금 (보험사 앱 조회)",
      "가계 기준 상담 시 배우자분 것도 함께 파악",
    ],
    documents: [],
  },
  expense: {
    id: "expense",
    title: "지출",
    icon: Receipt,
    summary: [
      "식비 월평균",
      "교통비 월평균",
      "쇼핑/미용 월평균",
      "유흥/여가 월평균",
      "기타 월평균",
    ],
    placeholder:
      "예: 식비 월 80만원\n교통비 월 30만원\n쇼핑/미용 월 40만원\n유흥/여가 월 50만원\n기타 월 20만원\n(최근 3개월 평균)",
    steps: [
      { step: 1, text: "카드사 앱/토스에서 최근 3개월 소비 확인" },
      { step: 2, text: "5가지 항목별 월평균 계산" },
    ],
    details: [
      "식비: 마트 + 외식 + 배달 + 카페",
      "교통비: 대중교통 + 택시 + 주유 + 주차",
      "쇼핑/미용: 의류 + 화장품 + 미용실",
      "유흥/여가: 술자리 + 취미 + 구독료 + 여행",
      "기타: 반려동물 + 경조사 + 분류 어려운 지출",
      "3개월 합계 ÷ 3 = 월평균",
      "가계 기준 상담 시 배우자분 것도 함께 파악",
    ],
    documents: [],
  },
};

interface TipModalProps {
  categoryId: string;
  initialHasData?: boolean;
  onDataSaved?: (category: string) => void;
  onClose: () => void;
}

export function TipModal({
  categoryId,
  initialHasData = false,
  onDataSaved,
  onClose,
}: TipModalProps) {
  const [isClosing, setIsClosing] = useState(false);
  const [showInputForm, setShowInputForm] = useState(false);
  const [hasData, setHasData] = useState(initialHasData);
  const [prepData, setPrepData] = useState<PrepDataStore>({});
  const [userId, setUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const category = TIP_DATA[categoryId];

  // Supabase에서 prep_data 로드
  useEffect(() => {
    const loadPrepData = async () => {
      setIsLoading(true);
      const supabase = createClient();
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (user) {
        setUserId(user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("prep_data")
          .eq("id", user.id)
          .single();

        if (profile?.prep_data) {
          setPrepData(profile.prep_data as PrepDataStore);
          // 현재 카테고리에 데이터가 있는지 확인
          const categoryData = (profile.prep_data as PrepDataStore)[
            categoryId as keyof PrepDataStore
          ];
          setHasData(
            !!categoryData &&
              (Array.isArray(categoryData)
                ? categoryData.length > 0
                : Object.keys(categoryData).length > 0),
          );
        }
      }
      setIsLoading(false);
    };

    loadPrepData();
  }, [categoryId]);

  const handleClose = () => {
    setIsClosing(true);
  };

  useEffect(() => {
    if (isClosing) {
      const timer = setTimeout(() => {
        onClose();
      }, 250);
      return () => clearTimeout(timer);
    }
  }, [isClosing, onClose]);

  // Supabase 기반 저장 함수
  const getStoredData = <T,>(key: string, defaultValue: T): T => {
    const data = prepData[key as keyof PrepDataStore];
    return (data as T) ?? defaultValue;
  };

  const saveData = async <T,>(key: string, data: T) => {
    if (!userId) return;

    const supabase = createClient();
    const newPrepData = { ...prepData, [key]: data };

    const { error } = await supabase
      .from("profiles")
      .update({ prep_data: newPrepData })
      .eq("id", userId);

    if (!error) {
      setPrepData(newPrepData);
      setHasData(true);
      onDataSaved?.(categoryId);
    }
  };

  // 각 카테고리별 저장 핸들러
  const handleSaveFamily = async (data: FamilyMember[]) => {
    await saveData("family", data);
    setShowInputForm(false);
  };

  const handleSaveIncome = async (data: IncomeFormData) => {
    await saveData("income", data);
    setShowInputForm(false);
  };

  const handleSaveExpense = async (data: ExpenseFormData) => {
    await saveData("expense", data);
    setShowInputForm(false);
  };

  const handleSaveSavings = async (data: FinancialAssetItem[]) => {
    await saveData("savings", data);
    setShowInputForm(false);
  };

  const handleSaveInvestment = async (data: InvestmentAccountData) => {
    await saveData("investment", data);
    setShowInputForm(false);
  };

  const handleSaveHousing = async (data: HousingData) => {
    await saveData("housing", data);
    setShowInputForm(false);
  };

  const handleSaveDebt = async (data: DebtItem[]) => {
    await saveData("debt", data);
    setShowInputForm(false);
  };

  const handleSaveNationalPension = async (data: NationalPensionData) => {
    await saveData("nationalPension", data);
    setShowInputForm(false);
  };

  const handleSaveRetirementPension = async (data: RetirementPensionData) => {
    await saveData("retirementPension", data);
    setShowInputForm(false);
  };

  const handleSavePersonalPension = async (data: PersonalPensionItem[]) => {
    await saveData("personalPension", data);
    setShowInputForm(false);
  };

  // 배우자 여부 (family 데이터에서 확인)
  const hasSpouse = (): boolean => {
    const familyData = getStoredData<FamilyMember[]>("family", []);
    return familyData.some((m) => m.relationship === "spouse");
  };

  if (!category) {
    return null;
  }

  return (
    <div className={`${styles.overlay} ${isClosing ? styles.closing : ""}`}>
      <div className={styles.container}>
        <header className={styles.header}>
          <button className={styles.backButton} onClick={handleClose}>
            <ArrowLeft size={24} />
          </button>
          <h1 className={styles.headerTitle}>{category.title}</h1>
          <div className={styles.headerSpacer} />
        </header>

        <main className={styles.main}>
          {/* 요약 */}
          <div className={styles.summarySection}>
            <h2 className={styles.summaryTitle}>확인할 항목</h2>
            <ul className={styles.summaryList}>
              {category.summary.map((item, index) => (
                <li key={index} className={styles.summaryItem}>
                  {item}
                </li>
              ))}
            </ul>
            <button
              className={styles.memoButton}
              onClick={() => setShowInputForm(true)}
              disabled={isLoading}
            >
              <Edit3 size={16} />
              <span>{hasData ? "입력 수정하기" : "입력해두기"}</span>
            </button>
          </div>

          {/* 가이드 스텝 */}
          {category.steps && category.steps.length > 0 && (
            <div className={styles.stepsSection}>
              <h3 className={styles.sectionTitle}>확인 방법</h3>
              <ol className={styles.stepList}>
                {category.steps.map((step) => (
                  <li key={step.step} className={styles.stepItem}>
                    <span className={styles.stepNumber}>{step.step}</span>
                    <span className={styles.stepText}>{step.text}</span>
                  </li>
                ))}
              </ol>
            </div>
          )}

          {/* 바로가기 링크 */}
          {category.links && category.links.length > 0 && (
            <div className={styles.linkSection}>
              {category.links.map((link, index) => (
                <a
                  key={index}
                  href={link.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.linkButton}
                >
                  <ExternalLink size={16} />
                  <span>{link.label}</span>
                </a>
              ))}
            </div>
          )}

          {/* 세부 항목 */}
          {category.details && category.details.length > 0 && (
            <div className={styles.detailsSection}>
              <h3 className={styles.sectionTitle}>세부 항목</h3>
              <ul className={styles.detailList}>
                {category.details.map((detail, index) => (
                  <li key={index} className={styles.detailItem}>
                    {detail}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </main>
      </div>

      {/* 입력 폼 모달 */}
      <InputFormModal
        isOpen={showInputForm}
        onClose={() => setShowInputForm(false)}
      >
        {categoryId === "family" && (
          <FamilyInputForm
            taskId="family"
            initialData={getStoredData<FamilyMember[]>("family", [])}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSaveFamily}
          />
        )}
        {categoryId === "income" && (
          <IncomeInputForm
            hasSpouse={hasSpouse()}
            initialData={getStoredData<IncomeFormData | null>("income", null)}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSaveIncome}
          />
        )}
        {categoryId === "expense" && (
          <ExpenseInputForm
            housingData={getStoredData<HousingData | null>("housing", null)}
            debtData={getStoredData<DebtItem[]>("debt", [])}
            initialData={getStoredData<ExpenseFormData | null>("expense", null)}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSaveExpense}
          />
        )}
        {categoryId === "savings" && (
          <SavingsInputForm
            hasSpouse={hasSpouse()}
            initialData={getStoredData<FinancialAssetItem[]>("savings", [])}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSaveSavings}
          />
        )}
        {categoryId === "investment" && (
          <InvestmentInputForm
            hasSpouse={hasSpouse()}
            initialData={getStoredData<InvestmentAccountData | null>(
              "investment",
              null,
            )}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSaveInvestment}
          />
        )}
        {categoryId === "housing" && (
          <HousingInputForm
            initialData={getStoredData<HousingData | null>("housing", null)}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSaveHousing}
          />
        )}
        {categoryId === "debt" && (
          <DebtInputForm
            hasSpouse={hasSpouse()}
            housingData={getStoredData<HousingData | null>("housing", null)}
            initialData={getStoredData<DebtItem[]>("debt", [])}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSaveDebt}
          />
        )}
        {categoryId === "nationalPension" && (
          <NationalPensionInputForm
            hasSpouse={hasSpouse()}
            initialData={getStoredData<NationalPensionData | null>(
              "nationalPension",
              null,
            )}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSaveNationalPension}
          />
        )}
        {categoryId === "retirementPension" && (
          <RetirementPensionInputForm
            hasSpouse={hasSpouse()}
            initialData={getStoredData<RetirementPensionData | null>(
              "retirementPension",
              null,
            )}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSaveRetirementPension}
          />
        )}
        {categoryId === "personalPension" && (
          <PersonalPensionInputForm
            hasSpouse={hasSpouse()}
            initialData={getStoredData<PersonalPensionItem[]>(
              "personalPension",
              [],
            )}
            isCompleted={hasData}
            onClose={() => setShowInputForm(false)}
            onSave={handleSavePersonalPension}
          />
        )}
      </InputFormModal>
    </div>
  );
}
