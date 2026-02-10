# Notepad

## Priority Context
<!-- Keep under 500 chars. Always loaded on session start. -->

## Working Memory
<!-- Timestamped notes. Auto-pruned after 7 days. -->


## 2026-02-10
## Feature: Sankey 인출(Withdrawal) 흐름 추가

### 현재 상태
- 현금흐름도(Sankey)는 소득(유입) → 지출(유출)만 표시
- 소득 < 지출인 해에 부족분을 어디서 인출하는지 보여주지 않음
- 특히 은퇴 후 근로소득 없을 때 핵심 정보가 빠져있음

### 필요한 변경
1. **V2 엔진 확장**: 연간 인출 내역을 YearlySnapshot에 기록
   - 어떤 계좌(savings/pension)에서 얼마를 인출했는지
   - cash_flow_priorities 규칙에 따른 인출 순서 반영
2. **Sankey 차트 확장**: 인출 흐름을 유입 측에 추가
   - 저축 인출, 연금 수령, 투자 인출 등 별도 노드
   - 참고: 외부 앱 Sankey에서 "Taxable Investments -> Withdrawals -> Inflows" 형태로 표현
3. **계좌 연동**: 우리는 이미 accounts 개념이 있으므로 계좌별 인출을 추적 가능

### 관련 파일
- `src/lib/services/simulationEngineV2.ts` - 엔진 인출 로직
- `src/types/index.ts` - YearlySnapshot 타입
- 현금흐름 Sankey 컴포넌트 (CashFlowOverviewTab)
- `cash_flow_priorities` (simulations 테이블 jsonb)

### 우선순위
- 중요도: 높음 (은퇴 시뮬레이션의 핵심 시각화)
- 복잡도: 중간-높음 (엔진 + UI 변경 모두 필요)

## MANUAL
<!-- Never auto-pruned. User-controlled permanent notes. -->
