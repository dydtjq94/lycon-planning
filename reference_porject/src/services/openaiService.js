/**
 * OpenAI API 서비스
 * 재무 데이터 분석 및 인사이트 생성
 */

const OPENAI_API_KEY = import.meta.env.VITE_OPENAI_API_KEY;
const OPENAI_API_URL = "https://api.openai.com/v1/chat/completions";

/**
 * 목표 적정성 분석
 * @param {Object} data - 분석할 재무 데이터
 * @returns {Promise<string>} AI 분석 결과
 */
export async function analyzeGoalFeasibility(data) {
  const {
    currentAge,
    retirementAge,
    targetAsset,
    targetCashflow,
    currentAsset,
    currentIncome,
    currentExpense,
    events,
  } = data;

  const prompt = `당신은 은퇴 재무 설계 전문가입니다. 다음 고객의 재무 목표와 현황을 분석하고, 목표 달성 가능성과 개선 방안을 제시해주세요.

## 고객 정보
- 현재 나이: ${currentAge}세
- 은퇴 목표 나이: ${retirementAge}세
- 은퇴까지 남은 기간: ${retirementAge - currentAge}년

## 재무 목표
- 목표 은퇴 자산: ${targetAsset ? `${(targetAsset / 10000).toFixed(0)}억원` : "미설정"}
- 목표 월 현금흐름: ${targetCashflow ? `${(targetCashflow / 10000).toFixed(0)}만원` : "미설정"}

## 현재 재무 상황
- 현재 순자산: ${currentAsset ? `${(currentAsset / 10000).toFixed(0)}억원` : "미확인"}
- 연간 소득: ${currentIncome ? `${(currentIncome / 10000).toFixed(0)}억원` : "미확인"}
- 연간 지출: ${currentExpense ? `${(currentExpense / 10000).toFixed(0)}억원` : "미확인"}

## 주요 생애 이벤트
${events && events.length > 0 ? events.map((e) => `- ${e.year}년: ${e.description} (${e.amount > 0 ? "+" : ""}${(e.amount / 10000).toFixed(0)}억원)`).join("\n") : "- 없음"}

다음 3가지를 분석해주세요:
1. 목표 자산 대비 현금흐름 적정성 (4%룰 기준)
2. 현재 상태에서 목표 달성 가능성
3. 개선이 필요한 핵심 포인트 2-3가지

200자 이내로 간결하게 작성해주세요.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 한국의 은퇴 재무 설계 전문가입니다. 데이터를 분석하고 실용적인 조언을 제공합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.statusText}`);
    }

    const result = await response.json();
    return result.choices[0].message.content;
  } catch (error) {
    console.error("OpenAI API 호출 실패:", error);
    throw error;
  }
}

/**
 * 목표 확인 및 데이터 검증 (보고서 섹션 1.1)
 * @param {Object} simulationData - 전체 시뮬레이션 데이터
 * @returns {Promise<Object>} 검증 결과 및 AI 분석
 */
export async function analyzeGoalVerification(simulationData) {
  const { profile, simulation, rawData } = simulationData;

  // 시뮬레이션 기본 가정 추출
  const assumptions = {
    incomeGrowthRate: rawData?.incomes?.[0]?.yearlyGrowthRate || 0,
    expenseGrowthRate: rawData?.expenses?.[0]?.yearlyGrowthRate || 0,
    hasDebts: rawData?.debts?.length > 0,
    hasPensions: rawData?.pensions?.length > 0,
    realEstateCount: rawData?.realEstates?.length || 0,
  };

  const prompt = `당신은 은퇴 재무 설계 전문가입니다. 다음 고객의 목표와 데이터를 검증하고, 시뮬레이션 가정의 적정성을 평가해주세요.

## 고객 기본 정보
- 프로필: ${profile.name}
- 현재 나이: ${profile.currentAge}세
- 은퇴 목표: ${profile.retirementAge}세 (${profile.retirementYear}년)
- 은퇴까지: ${profile.retirementAge - profile.currentAge}년

## 재무 목표
- 목표 은퇴 자산: ${profile.targetAssets ? `${(profile.targetAssets / 10000).toFixed(0)}억원` : "미설정"}
- 현재 보유 현금: ${profile.currentCash ? `${profile.currentCash}만원` : "미확인"}

## 데이터 현황
- 소득 데이터: ${rawData?.incomes?.length || 0}개 항목 (임금상승률 ${assumptions.incomeGrowthRate}% 가정)
- 지출 데이터: ${rawData?.expenses?.length || 0}개 항목 (물가상승률 ${assumptions.expenseGrowthRate}% 가정)
- 저축/적금: ${rawData?.savings?.length || 0}개
- 연금: ${rawData?.pensions?.length || 0}개
- 부동산: ${assumptions.realEstateCount}개
- 부채: ${rawData?.debts?.length || 0}개

## 시뮬레이션 결과 미리보기
- 은퇴 시점(${profile.retirementAge}세) 예상 자산: ${simulation.assets?.[profile.retirementAge - profile.currentAge]?.totalAmount ? `${(simulation.assets[profile.retirementAge - profile.currentAge].totalAmount / 10000).toFixed(0)}억원` : "계산 필요"}

다음 형식의 JSON으로 응답해주세요:
{
  "dataCompleteness": {
    "score": 85,
    "missingItems": ["부채 정보 미입력", "국민연금 예상 수령액"],
    "recommendations": ["추가 입력 권장 항목"]
  },
  "assumptionValidity": {
    "incomeGrowth": "적정/과도/보수적",
    "expenseGrowth": "적정/과도/보수적",
    "comments": "가정의 적정성에 대한 간단한 코멘트"
  },
  "goalFeasibility": {
    "achievable": true,
    "confidence": "높음/중간/낮음",
    "keyRisks": ["주요 리스크 2-3개"],
    "summary": "목표 달성 가능성에 대한 한 문장 요약"
  }
}`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 한국의 은퇴 재무 설계 전문가입니다. JSON 형식으로만 응답합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    return JSON.parse(content);
  } catch (error) {
    console.error("목표 검증 분석 실패:", error);
    throw error;
  }
}

/**
 * 은퇴 자산 준비율 진단 (보고서 섹션 1.2)
 * @param {Object} analysisData - 자산 분석 데이터
 * @returns {Promise<Object>} AI 진단 결과
 */
export async function analyzeAssetReadiness(analysisData) {
  const {
    currentAge,
    retirementAge,
    targetAssets,
    currentTotalAssets,
    retirementAssets,
    achievementRate,
    realEstateRatio,
    cagr,
  } = analysisData;

  const prompt = `당신은 은퇴 재무 설계 전문가입니다. 아래 데이터를 바탕으로 핵심 인사이트와 조언을 제공해주세요.

## 분석 데이터
- 현재: ${currentAge}세 / 은퇴 목표: ${retirementAge}세 (${retirementAge - currentAge}년 후)
- 현재 총자산: ${((currentTotalAssets || 0) / 10000).toFixed(1)}억원
- 은퇴 시점 예상 순자산: ${((retirementAssets || 0) / 10000).toFixed(1)}억원
- 목표 자산: ${((targetAssets || 0) / 10000).toFixed(0)}억원
- **목표 달성률: ${(achievementRate || 0).toFixed(1)}%**
- **부동산 비중: ${(realEstateRatio || 0).toFixed(1)}%**
- **자산 성장률(CAGR): ${(cagr || 0).toFixed(1)}%**

다음 형식의 JSON으로 응답해주세요:
{
  "mainInsight": {
    "status": "excellent/good/warning/critical",
    "title": "15자 이내 진단 제목",
    "description": "50자 이내로 주요 진단 내용"
  },
  "secondaryInsight": {
    "title": "15자 이내 부가 인사이트 제목",
    "description": "50자 이내로 리스크나 주의사항"
  },
  "recommendation": "30자 이내 실행 방안"
}

가이드:
- status: 달성률 100%↑(excellent/good), 80-100%(warning), 80%↓(critical)
- 부동산 비중 70%↑면 유동성 리스크 언급
- 실용적이고 구체적인 조언
- 한국 은퇴 환경 고려`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 한국의 은퇴 재무 설계 전문가입니다. JSON 형식으로만 응답합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 500,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;
    return JSON.parse(content);
  } catch (error) {
    console.error("자산 준비율 분석 실패:", error);
    throw error;
  }
}

/**
 * 생애 이벤트 예측 및 추출
 * @param {Object} profileData - 프로필 데이터
 * @returns {Promise<Array>} 예측된 생애 이벤트 목록
 */
export async function predictLifeEvents(profileData) {
  const {
    currentAge,
    retirementAge,
    hasSpouse,
    spouseAge,
    familyMembers,
    realEstateData,
    debtData,
  } = profileData;

  const familyInfo =
    familyMembers && familyMembers.length > 0
      ? familyMembers
          .map(
            (member) =>
              `${member.relationship || "가족"} (현재 ${member.age || "?"}세)`
          )
          .join(", ")
      : "없음";

  const realEstateInfo =
    realEstateData && realEstateData.length > 0
      ? realEstateData
          .map((re) => `${re.type} (${re.value ? (re.value / 10000).toFixed(0) + "억원" : "금액 미상"})`)
          .join(", ")
      : "없음";

  const debtInfo =
    debtData && debtData.length > 0
      ? debtData
          .map(
            (debt) =>
              `${debt.type} (잔액: ${debt.balance ? (debt.balance / 10000).toFixed(0) + "억원" : "미상"}, 만기: ${debt.maturityYear || "미상"}년)`
          )
          .join(", ")
      : "없음";

  const prompt = `당신은 재무 설계 전문가입니다. 다음 고객 정보를 바탕으로 향후 발생할 주요 생애 이벤트를 예측해주세요.

## 고객 정보
- 현재 나이: ${currentAge}세
- 은퇴 예정: ${retirementAge}세
- 배우자 유무: ${hasSpouse ? `있음 (${spouseAge || "?"}세)` : "없음"}
- 가족 구성원: ${familyInfo}
- 부동산: ${realEstateInfo}
- 부채: ${debtInfo}

다음 형식의 JSON 배열로만 응답해주세요 (다른 설명 없이):
[
  {
    "year": 2028,
    "age": 63,
    "description": "자녀 결혼자금 지원",
    "amount": -10000,
    "category": "family"
  }
]

고려사항:
- 자녀 결혼, 교육비 (자녀 나이 기준)
- 부채 만기 상환
- 부동산 재건축/재개발 (일반적으로 10-15년 주기)
- 의료비 증가 (고령 진입 시)
- 금액은 만원 단위 (예: 1억원 = 10000)
- 지출은 음수(-), 수입은 양수(+)
- 최대 5개 이벤트만 예측`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 한국의 생애 재무 설계 전문가입니다. JSON 형식으로만 응답합니다.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        temperature: 0.7,
        max_tokens: 800,
        response_format: { type: "json_object" },
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content;

    // JSON 파싱 시도
    try {
      const parsed = JSON.parse(content);
      // events 키가 있으면 그걸 반환, 아니면 직접 배열로 파싱
      return parsed.events || parsed;
    } catch (parseError) {
      console.error("JSON 파싱 실패:", parseError);
      return [];
    }
  } catch (error) {
    console.error("생애 이벤트 예측 실패:", error);
    throw error;
  }
}

/**
 * 자산 현황 브리핑 분석
 * @param {Object} data - 자산 현황 데이터
 * @returns {Promise<Object>} AI 분석 결과
 */
export async function analyzeAssetOverview(data) {
  const {
    totalAssets,
    totalDebt,
    netAssets,
    assetBreakdown,
    debtRatio,
    dsr,
    emergencyFundMonths,
    monthlyIncome,
    monthlyExpense,
    netCashflow,
    debtList,
  } = data;

  // 자산 구성 문자열 생성
  const assetComposition = assetBreakdown
    .map((item) => `${item.name} ${item.ratio.toFixed(1)}%`)
    .join(", ");

  const prompt = `당신은 재무 설계 전문가입니다. 다음 고객의 자산 현황을 분석하고 핵심 인사이트를 제공해주세요.

## 자산 현황
- 총 자산: ${totalAssets.toFixed(1)}억원
- 총 부채: ${totalDebt.toFixed(1)}억원
- 순 자산: ${netAssets.toFixed(1)}억원
- 자산 구성: ${assetComposition}
- 부채 비율: ${debtRatio.toFixed(1)}%

## 건전성 지표
- DSR (총소득 대비 원리금 상환 비율): ${dsr.toFixed(1)}%
- 비상자금: ${emergencyFundMonths.toFixed(1)}개월분 보유

## 현금흐름
- 월 소득: ${monthlyIncome.toFixed(0)}만원
- 월 지출: ${monthlyExpense.toFixed(0)}만원
- 순 현금흐름: ${netCashflow >= 0 ? "+" : ""}${netCashflow.toFixed(0)}만원

다음 형식의 JSON으로 응답해주세요:
{
  "mainInsight": "자산 구성의 핵심 문제점과 개선 방향을 150자 이내로 요약",
  "liquidityInsight": "비상자금과 현금흐름 상태에 대한 분석 80자 이내"
}

응답은 반드시 JSON 형식이어야 하며, 다른 텍스트는 포함하지 마세요.`;

  try {
    const response = await fetch(OPENAI_API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "당신은 전문 재무 설계사입니다. 간결하고 실용적인 조언을 제공합니다.",
          },
          { role: "user", content: prompt },
        ],
        temperature: 0.7,
        max_tokens: 500,
      }),
    });

    if (!response.ok) {
      throw new Error(`OpenAI API 오류: ${response.statusText}`);
    }

    const result = await response.json();
    const content = result.choices[0].message.content.trim();

    try {
      // JSON 파싱
      const parsed = JSON.parse(content);
      return parsed;
    } catch (parseError) {
      console.error("JSON 파싱 실패:", parseError);
      // 파싱 실패 시 기본값 반환
      return {
        mainInsight: content.substring(0, 150),
        liquidityInsight: "현금흐름 관리가 필요합니다.",
      };
    }
  } catch (error) {
    console.error("자산 현황 분석 실패:", error);
    throw error;
  }
}
