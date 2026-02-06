// 은행 로고 매핑
const BANK_LOGOS: Record<string, string> = {
  "경남은행": "kyongnam",
  "광주은행": "gwangju",
  "국민은행": "kookmin",
  "기업은행": "ibk",
  "대구은행": "daegu",
  "부산은행": "busan",
  "산업은행": "kdb",
  "새마을금고": "saemaul",
  "수협은행": "suhyup",
  "신한은행": "shinhan",
  "신협": "shinhyup",
  "우리은행": "woori",
  "우체국": "epost",
  "전북은행": "jeonbuk",
  "제주은행": "jeju",
  "카카오뱅크": "kakaobank",
  "케이뱅크": "kbank",
  "토스뱅크": "tossbank",
  "하나은행": "hana",
  "BNP파리바은행": "bnp-paribas",
  "HSBC": "hsbc",
  "IM뱅크": "im",
  "NH농협은행": "nh",
  "SC제일은행": "sc",
  "SBI저축은행": "sbi",
  "뱅크오브아메리카": "boa",
  "시티은행": "citi",
  "JP모간체이스": "jpmorgan",
  "도이치은행": "deutsche",
};

// 증권사 로고 매핑
const SECURITIES_LOGOS: Record<string, string> = {
  "교보증권": "kyobo",
  "대신증권": "daishin",
  "메리츠증권": "meritz",
  "미래에셋증권": "mirae",
  "부국증권": "bookook",
  "삼성증권": "samsung",
  "신영증권": "shinyoung",
  "신한투자증권": "shinhan",
  "유안타증권": "yuanta",
  "유진투자증권": "eugene",
  "이베스트증권": "ebest",
  "카카오페이증권": "kakaopay",
  "케이프투자증권": "cape",
  "키움증권": "kiwoom",
  "토스증권": "toss",
  "하나증권": "hana",
  "한국투자증권": "korea",
  "한화투자증권": "hanwha",
  "DB금융투자": "db",
  "KB증권": "kb",
  "NH투자증권": "nh",
  "SK증권": "sk",
};

// 카드사 로고 매핑
const CARD_LOGOS: Record<string, string> = {
  "롯데카드": "lotte",
  "삼성카드": "samsung",
  "신한카드": "shinhan",
  "우리카드": "woori",
  "카카오뱅크카드": "kakaobank",
  "케이뱅크카드": "kbank",
  "토스뱅크카드": "tossbank",
  "하나카드": "hana",
  "현대카드": "hyundai",
  "아멕스": "amex",
  "BC카드": "bc",
  "KB국민카드": "kb",
  "NH농협카드": "nh",
};

export type LogoType = "bank" | "securities" | "card";

/**
 * 금융기관명으로 로고 경로 반환
 * @param name 금융기관명 (예: "신한은행", "키움증권")
 * @param type 로고 타입 (bank, securities, card)
 * @returns 로고 이미지 경로 또는 null
 */
export function getLogoPath(name: string | null | undefined, type: LogoType): string | null {
  if (!name) return null;

  let logoMap: Record<string, string>;
  let folder: string;

  switch (type) {
    case "bank":
      logoMap = BANK_LOGOS;
      folder = "banks";
      break;
    case "securities":
      logoMap = SECURITIES_LOGOS;
      folder = "securities";
      break;
    case "card":
      logoMap = CARD_LOGOS;
      folder = "cards";
      break;
    default:
      return null;
  }

  const logoFile = logoMap[name];
  if (!logoFile) return null;

  return `/logos/${folder}/${logoFile}.png`;
}

/**
 * 계좌 유형으로 로고 타입 결정
 */
export function getLogoTypeFromAccountType(accountType: string | null): LogoType {
  const investmentTypes = ["general", "isa", "pension_savings", "irp"];
  if (investmentTypes.includes(accountType || "")) {
    return "securities";
  }
  return "bank";
}
