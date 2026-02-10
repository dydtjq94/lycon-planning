// 은행 목록 (가나다순 + ABC순)
export const BANK_OPTIONS = [
  // 가나다순
  "경남은행", "광주은행", "국민은행", "기업은행", "대구은행",
  "부산은행", "산업은행", "새마을금고", "수협은행", "신한은행",
  "신협", "우리은행", "우체국", "전북은행", "제주은행",
  "카카오뱅크", "케이뱅크", "토스뱅크", "하나은행",
  // ABC순
  "BNP파리바은행", "HSBC", "IM뱅크", "NH농협은행", "SC제일은행",
  "SBI저축은행", "뱅크오브아메리카", "시티은행", "JP모간체이스", "도이치은행",
  // 기타
  "기타",
] as const

// 증권사 목록 (가나다순 + ABC순)
export const SECURITIES_OPTIONS = [
  // 가나다순
  "교보증권", "대신증권", "메리츠증권", "미래에셋증권", "부국증권",
  "삼성증권", "신영증권", "신한투자증권", "유안타증권", "유진투자증권",
  "이베스트증권", "카카오페이증권", "케이프투자증권", "키움증권",
  "토스증권", "하나증권", "한국투자증권", "한화투자증권",
  // ABC순
  "DB금융투자", "KB증권", "NH투자증권", "SK증권",
  // 기타
  "기타",
] as const

// 카드사 목록 (카드사 + 페이)
export const CARD_COMPANY_OPTIONS = [
  // 카드사 (가나다순)
  "롯데카드", "삼성카드", "신한카드", "우리카드", "카카오뱅크카드", "케이뱅크카드",
  "토스뱅크카드", "하나카드", "현대카드",
  "아멕스", "BC카드", "KB국민카드", "NH농협카드",
  // 페이 서비스 (가나다순)
  "네이버페이", "삼성페이", "애플페이", "제로페이", "카카오페이", "토스페이",
  "페이코", "SSG페이", "L.Pay", "쿠페이",
  // 기타
  "기타",
] as const

// 은행/증권사 로고 매핑
export const BROKER_LOGO_MAP: Record<string, string> = {
  // 은행
  "카카오뱅크": "/logos/banks/kakaobank.png",
  "토스뱅크": "/logos/banks/tossbank.png",
  "케이뱅크": "/logos/banks/kbank.png",
  "국민은행": "/logos/banks/kookmin.png",
  "KB국민은행": "/logos/banks/kookmin.png",
  "신한은행": "/logos/banks/shinhan.png",
  "하나은행": "/logos/banks/hana.png",
  "우리은행": "/logos/banks/woori.png",
  "NH농협은행": "/logos/banks/nh.png",
  "농협은행": "/logos/banks/nh.png",
  "IBK기업은행": "/logos/banks/ibk.png",
  "기업은행": "/logos/banks/ibk.png",
  "SC제일은행": "/logos/banks/sc.png",
  "씨티은행": "/logos/banks/citi.png",
  "시티은행": "/logos/banks/citi.png",
  "KDB산업은행": "/logos/banks/kdb.png",
  "산업은행": "/logos/banks/kdb.png",
  "수협은행": "/logos/banks/suhyup.png",
  "대구은행": "/logos/banks/daegu.png",
  "부산은행": "/logos/banks/busan.png",
  "경남은행": "/logos/banks/kyongnam.png",
  "광주은행": "/logos/banks/gwangju.png",
  "전북은행": "/logos/banks/jeonbuk.png",
  "제주은행": "/logos/banks/jeju.png",
  "우체국": "/logos/banks/epost.png",
  "새마을금고": "/logos/banks/saemaul.png",
  "신협": "/logos/banks/shinhyup.png",
  "SBI저축은행": "/logos/banks/sbi.png",
  "아이엠뱅크": "/logos/banks/im.png",
  "IM뱅크": "/logos/banks/im.png",
  "BNP파리바은행": "/logos/banks/bnp-paribas.png",
  "HSBC": "/logos/banks/hsbc.png",
  "뱅크오브아메리카": "/logos/banks/boa.png",
  "JP모간체이스": "/logos/banks/jpmorgan.png",
  "도이치은행": "/logos/banks/deutsche.png",
  // 증권사
  "토스증권": "/logos/securities/toss.png",
  "삼성증권": "/logos/securities/samsung.png",
  "미래에셋증권": "/logos/securities/mirae.png",
  "KB증권": "/logos/securities/kb.png",
  "NH투자증권": "/logos/securities/nh.png",
  "한국투자증권": "/logos/securities/korea.png",
  "신한투자증권": "/logos/securities/shinhan.png",
  "하나증권": "/logos/securities/hana.png",
  "키움증권": "/logos/securities/kiwoom.png",
  "대신증권": "/logos/securities/daishin.png",
  "메리츠증권": "/logos/securities/meritz.png",
  "한화투자증권": "/logos/securities/hanwha.png",
  "유안타증권": "/logos/securities/yuanta.png",
  "유진투자증권": "/logos/securities/eugene.png",
  "이베스트투자증권": "/logos/securities/ebest.png",
  "DB금융투자": "/logos/securities/db.png",
  "교보증권": "/logos/securities/kyobo.png",
  "신영증권": "/logos/securities/shinyoung.png",
  "SK증권": "/logos/securities/sk.png",
  "부국증권": "/logos/securities/bookook.png",
  "케이프투자증권": "/logos/securities/cape.png",
  "카카오페이증권": "/logos/securities/kakaopay.png",
}

export function getBrokerLogo(brokerName: string | null): string | null {
  if (!brokerName) return null
  return BROKER_LOGO_MAP[brokerName] || null
}

// 모듈 로드 시점에 모든 로고를 브라우저 캐시에 미리 로드
if (typeof window !== 'undefined') {
  const preloaded = new Set<string>()
  Object.values(BROKER_LOGO_MAP).forEach(src => {
    if (!preloaded.has(src)) {
      const img = new Image()
      img.src = src
      preloaded.add(img.src)
    }
  })
}
