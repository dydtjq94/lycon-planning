/**
 * 생애 자금 공급/수요 총합 계산 (현금흐름 데이터 기반)
 *
 * cashflowData 배열은 calculateCashflowSimulation 결과와 동일한 형태를 기대합니다.
 * 각 항목은 { year, age, amount, ... } 구조이며 amount가 플러스면 자금 유입, 마이너스면 자금 유출입니다.
 */
export function calculateLifetimeCashFlowTotals(cashflowData = []) {
  if (!Array.isArray(cashflowData) || cashflowData.length === 0) {
    return {
      supply: [],
      demand: [],
      totalSupply: 0,
      totalDemand: 0,
      netCashFlow: 0,
    };
  }

  const supplyMap = new Map();
  const demandMap = new Map();

  const accumulate = (map, item) => {
    if (!item || !item.label) return;
    const amount = Number(item.amount) || 0;
    if (amount <= 0) return;

    // 카테고리 정규화
    const category = item.category || "기타";
    const label = item.label;

    // 각 항목을 개별적으로 표시 (통합하지 않음)
    const key = `${category}|${label}`;
    const existing = map.get(key);
    if (existing) {
      existing.amount += amount;
    } else {
      map.set(key, {
        category,
        name: label,
        amount,
      });
    }
  };

  cashflowData.forEach((entry) => {
    const breakdown = entry?.breakdown;

    if (breakdown) {
      // breakdown에 있는 모든 항목을 그대로 사용
      (breakdown.positives || []).forEach((item) => {
        const amount = Number(item?.amount) || 0;
        if (amount <= 0) return;
        accumulate(supplyMap, {
          label: item.label,
          category: item.category,
          amount,
        });
      });
      (breakdown.negatives || []).forEach((item) => {
        const amount = Number(item?.amount) || 0;
        if (amount <= 0) return;
        accumulate(demandMap, {
          label: item.label,
          category: item.category,
          amount,
        });
      });
    }

    // residual 계산 로직 제거 - breakdown에 모든 항목이 이미 포함되어 있음
  });

  // breakdown 정보가 없는 경우 amount 기준으로 fallback
  if (supplyMap.size === 0 && demandMap.size === 0) {
    cashflowData.forEach((entry) => {
      const amount = Number(entry.amount) || 0;
      if (amount > 0) {
        accumulate(supplyMap, {
          label: "자금 공급",
          category: "현금흐름",
          amount,
        });
      } else if (amount < 0) {
        accumulate(demandMap, {
          label: "자금 수요",
          category: "현금흐름",
          amount: Math.abs(amount),
        });
      }
    });
  }

  const supply = Array.from(supplyMap.values()).sort(
    (a, b) => b.amount - a.amount
  );
  const demand = Array.from(demandMap.values()).sort(
    (a, b) => b.amount - a.amount
  );

  const totalSupply = supply.reduce((sum, item) => sum + item.amount, 0);
  const totalDemand = demand.reduce((sum, item) => sum + item.amount, 0);

  return {
    supply,
    demand,
    totalSupply,
    totalDemand,
    netCashFlow: totalSupply - totalDemand,
  };
}
