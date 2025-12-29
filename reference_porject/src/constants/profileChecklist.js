const createChecklistItemId = () =>
  `chk_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

const CHECKLIST_TEMPLATE = [
  {
    title: "소득·현금흐름",
    children: [
      {
        title:
          "공적연금 개시 전 소득 공백기 – 55~65세 사이의 소득 없는 10년 동안 생활비 대비가 되었는지 확인",
      },
      {
        title:
          "퇴직금 수령 방식에 따른 세금 차이 – 일시금과 연금 수령의 실수령액 차이 비교 여부",
      },
      {
        title:
          "배우자의 연금·소득 구조 파악 – 가계 현금흐름이 한쪽에만 의존하고 있지 않은지 점검",
      },
    ],
  },
  {
    title: "세금·법적 구조",
    children: [
      {
        title:
          "연금 수령 시 세금 구조 이해 – 사적 연금 수령액이 1,500만 원 초과 시 종합과세 대상임을 인지",
      },
      {
        title:
          "금융소득(이자·배당) 합산과세 구간 검토 – 연금 외 소득 증가 시 세금 급증 가능성 점검",
      },
      {
        title:
          "상속·증여 설계 준비 – 배우자 사망 및 자녀 간 갈등 등으로 자산이 예상치 못하게 분할될 위험 점검",
      },
    ],
  },
  {
    title: "자산·부채",
    children: [
      {
        title:
          "부동산 비중 과다 여부 – 은퇴 후 현금흐름에 지장이 없는지, 유동성 확보 방안 검토",
      },
      {
        title: "변동금리 대출 유지 점검 – 금리 상승기 이자 부담 급증 가능성 검토",
      },
      {
        title:
          "배우자 명의 부채·보증 채무 확인 – 숨은 잠재 부채가 없는지 확인",
      },
    ],
  },
  {
    title: "건강·장수 리스크",
    children: [
      {
        title:
          "장수 리스크 반영 – 90세 이상 생존 시 자산 고갈 가능성 시나리오 검토",
      },
      {
        title:
          "간병·요양 비용 준비 – 70대 이후 연간 수백만~천만 원 발생 가능성 대비",
      },
      {
        title:
          "실손보험 보장 공백 확인 – 갱신 거절이나 중복 보장으로 필요한 시기 보장 누락 여부 점검",
      },
    ],
  },
  {
    title: "기타 비상·예비계획",
    children: [
      {
        title:
          "은퇴 후 즉시 사용 가능한 현금 6개월치 확보 – 생활비 비상자금 유지 여부 확인",
      },
      {
        title:
          "가족의 재무 구조 이해 공유 – 본인 유고 시 금융자산·보험·대출 현황 파악 가능하도록 정리",
      },
      {
        title:
          "비상자금이 투자자금으로 대체되지 않았는지 – 유동성 위기 시 손실 매각 가능성 점검",
      },
    ],
  },
];

const buildChecklistTemplateItems = () =>
  CHECKLIST_TEMPLATE.map((section) => ({
    id: createChecklistItemId(),
    title: section.title,
    checked: false,
    children: section.children.map((child) => ({
      id: createChecklistItemId(),
      title: child.title,
      checked: false,
    })),
  }));

const normalizeChecklistItems = (items = []) =>
  items.map((item) => ({
    id: item.id || createChecklistItemId(),
    title: item.title || "",
    checked: !!item.checked,
    children: (item.children || item.subItems || []).map((child) => ({
      id: child.id || createChecklistItemId(),
      title: child.title || "",
      checked: !!child.checked,
    })),
  }));

export {
  CHECKLIST_TEMPLATE,
  buildChecklistTemplateItems,
  normalizeChecklistItems,
  createChecklistItemId,
};
