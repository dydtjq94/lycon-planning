# 개발 규칙

## 참고 프로젝트

- **reference_porject 폴더는 오직 참고용**: 이전에 만들던 재무 시뮬레이션 프로젝트 (React + Firebase)
- **코드 복사 금지**: 구조와 로직만 참고, 직접 복사하지 않음
- **기술 스택 다름**: reference는 React/Firebase, 현재는 Next.js/Supabase

## Supabase 테이블 구조 (매우 중요!)

### 반드시 MCP 도구로 확인
- **테이블 조작 전 필수 확인**: 데이터 저장/수정/삭제 전에 반드시 `mcp__supabase__list_tables`로 실제 컬럼명 확인
- **추측 금지**: 컬럼명을 추측하지 말고 항상 실제 스키마 확인
- **외래키 관계 확인**: 테이블 간 관계는 foreign_key_constraints에서 확인

### 테이블별 핵심 컬럼 (자주 혼동됨)
```
profiles
├── id (uuid) - auth.users.id와 연결
└── 사용자 기본 정보

family_members
├── user_id (uuid) - profiles.id와 연결 (profile_id 아님!)
└── 가족 구성원 정보

simulations
├── profile_id (uuid) - profiles.id와 연결
└── 시뮬레이션 정보

incomes, expenses, debts, savings, real_estates,
physical_assets, insurances, national_pensions,
retirement_pensions, personal_pensions
├── simulation_id (uuid) - simulations.id와 연결
└── 각 재무 데이터
```

### 코드 작성 시 규칙
- **family_members는 user_id**: `.eq("user_id", profile.id)` 사용
- **재무 데이터는 simulation_id**: `.eq("simulation_id", simulation.id)` 사용
- **profiles는 id**: `.eq("id", user.id)` 사용

### 데이터 타입 주의
- **금액**: integer 또는 bigint (원 단위) - 큰 금액은 bigint 권장
- **비율**: numeric (예: 5.0, 2.5)
- **날짜**: date (YYYY-MM-DD) 또는 year/month/day 분리
- **boolean**: true/false, 기본값 확인 필수

## RLS 정책 (Row Level Security) - 반드시 확인!

### 데이터 저장/수정 안 될 때 가장 먼저 확인할 것
프론트엔드에서 Supabase로 INSERT/UPDATE/DELETE가 안 되면 **99% RLS 정책 문제**입니다.

### RLS 정책 확인 방법
```sql
-- 특정 테이블의 RLS 정책 확인
SELECT policyname, cmd, qual
FROM pg_policies
WHERE tablename = '테이블명';
```

### 현재 주요 테이블별 RLS 정책 현황
```
profiles
├── SELECT: 본인 프로필 조회 가능
├── SELECT: Expert가 담당 고객 프로필 조회 가능 (conversations 통해)
├── INSERT: 본인 프로필 생성 가능
├── UPDATE: 본인 프로필 수정 가능
└── UPDATE: Expert가 담당 고객 프로필 수정 가능 (conversations 통해)

conversations
├── SELECT/INSERT/UPDATE: 본인 대화 가능
└── SELECT/INSERT/UPDATE: Expert가 담당 대화 가능
```

### 새 기능 추가 시 체크리스트
1. **Admin이 고객 데이터 수정** → Expert용 UPDATE 정책 있는지 확인
2. **새 테이블 생성** → RLS 활성화 + 적절한 정책 추가
3. **저장 실패 시** → 브라우저 콘솔 에러 확인 + RLS 정책 확인

### 정책 추가 예시
```sql
-- Expert가 담당 고객 데이터 수정 가능하도록
CREATE POLICY "Experts can update assigned user data"
ON 테이블명
FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    JOIN experts e ON c.expert_id = e.id
    WHERE c.user_id = 테이블명.user_id
    AND e.user_id = auth.uid()
  )
);
```

## CSS 스타일

- **CSS Modules 사용**: Tailwind 사용 금지
- **단위는 px**: rem, em 대신 px 사용
- **파일 위치**: 컴포넌트와 같은 폴더에 `*.module.css` 생성
- **hover는 심플하게**: 색상만 변경, 배경색/테두리 등 추가 효과 금지
- **border-left 액센트 금지**: 왼쪽 세로 바/라인으로 강조하는 디자인 절대 사용 금지
- **이모지 금지**: 코드, UI, 텍스트 어디에서도 이모지 사용 금지

```tsx
import styles from './Component.module.css'
<div className={styles.container}>
```

## 주식/금융 색상 규칙 (한국식)

- **상승(수익)은 빨간색**: `#ef4444` - 양수, 상승, 수익
- **하락(손실)은 파란색**: `#3b82f6` - 음수, 하락, 손실
- **매수는 빨간색**: `#ef4444` - 사는 행위
- **매도는 파란색**: `#3b82f6` - 파는 행위
- **가격 차트**: `#10b981` (틸트/에메랄드) 고정
- **손익 차트**: 수익 구간 빨간색, 손실 구간 파란색
- **절대 반대로 하지 말 것**: 서양식(초록=상승, 빨강=하락) 사용 금지

```css
/* 한국식 주식 색상 */
.positive { color: #ef4444; }  /* 빨강 = 상승/수익 */
.negative { color: #3b82f6; }  /* 파랑 = 하락/손실 */
.buy { color: #ef4444; }       /* 빨강 = 매수 */
.sell { color: #3b82f6; }      /* 파랑 = 매도 */

/* 가격 차트 - 틸트 고정 */
borderColor: "#10b981"

/* 손익 차트 - 빨강/파랑 */
profit: "#ef4444"   /* 수익 = 빨강 */
loss: "#3b82f6"     /* 손실 = 파랑 */
```

## 스켈레톤 로딩 애니메이션

- **방향 통일**: 모든 shimmer 애니메이션은 왼쪽 → 오른쪽으로 이동
- **px 단위 사용**: 퍼센트(%) 대신 픽셀(px) 단위 사용
- **속도**: 1.5s infinite

```css
/* 스켈레톤 shimmer 애니메이션 (복사해서 사용) */
@keyframes shimmer {
  0% {
    background-position: -200px 0;
  }
  100% {
    background-position: 200px 0;
  }
}

.skeleton {
  background: linear-gradient(90deg, #f0f0f0 25%, #e0e0e0 50%, #f0f0f0 75%);
  background-size: 400px 100%;
  animation: shimmer 1.5s infinite;
}
```

## 컴포넌트 분리

- **작게 쪼갤수록 좋다**: 쪼개면 비효율인건 쪼개지말기
- **단일 책임**: 하나의 컴포넌트는 하나의 역할만
- **폴더 구조**: 페이지별로 `components/` 폴더 생성

```
src/app/feature/
├── page.tsx
├── feature.module.css
└── components/
    ├── index.ts
    └── FeatureItem.tsx
```

## 코드 스타일

- TypeScript 필수 (`.ts`, `.tsx`)
- Props는 interface로 정의
- 함수형 컴포넌트만 사용
- named export 선호: `export function Component`
- index.ts에서 re-export

## 상태 관리

- 상태는 page.tsx에서 관리
- 하위 컴포넌트는 props로 전달
- 콜백 네이밍: `onXxx` (예: `onUpdate`, `onDelete`)

## 파일 네이밍

- 컴포넌트: PascalCase (`UserProfile.tsx`)
- CSS: 컴포넌트명.module.css (`UserProfile.module.css`)
- 유틸리티: camelCase (`formatMoney.ts`)

## 빌드 명령어

- **`npm run build` 사용 금지**: 개발 서버 실행 중에 빌드하면 `.next` 캐시 손상됨
- **타입 오류 확인**: `npx tsc --noEmit` 사용
- **빌드는 오류 확인할 때만**: 개발 서버 끄고 실행

## UI 디자인 원칙

- **셀(Cell) 단위 설계**: 모든 UI는 엑셀처럼 셀 단위로 구성
- **행(Row) 구조**: `# | 항목 | 값` 3열 구조 유지
- **일관성**: 모든 입력 요소는 동일한 셀 레이아웃 안에 배치
- **추가 버튼**: 새 항목 추가는 빈 행에 `+ 추가` 버튼으로 표시

```
| #  | 항목   | 값                    |
|----|--------|----------------------|
| ✓  | 아들   | 2020-01-01  5세      |
|    |        | + 아들 추가  + 딸 추가 |
```

## 섹션별 컴포넌트 분리 규칙

- **각 섹션은 완전히 독립적**: 기본 정보, 소득/지출, 저축/투자, 부동산, 금융자산, 부채, 연금 등 각 섹션은 서로 다른 셀 구조를 가질 수 있음
- **CSS 클래스 분리**: 섹션별로 다른 스타일이 필요하면 별도 클래스 생성 (예: `excelRowInput` vs `excelRowInputMulti`)
- **공통 스타일 영향 주의**: 공통 스타일 수정 시 다른 섹션에 영향 주지 않도록 주의
- **확장 구조**: 소득/지출처럼 여러 항목을 입력받는 행은 메인 행 + 확장 행으로 구성

```
| # | 항목 | 항목명     | 금액  | 단위 | 주기 | X |
|---|------|-----------|-------|------|-----|---|
| 7 | 소득 | 본인 급여  | 500   | 만원 | 월  | x |
|   |      | 배우자 급여| 300   | 만원 | 월  | x |
|   |      | + 소득 추가|       |      |     |   |
```

## 숫자 입력 + 단위 스타일

- **고정 너비**: 숫자 입력칸은 고정 width 사용 (80px, 120px 등)
- **왼쪽 정렬**: 텍스트는 기본 왼쪽 정렬 유지
- **단위 배치**: 단위(세, 만원 등)는 입력칸 바로 옆에 배치
- **스핀 버튼 제거**: `type="number"` 입력의 위아래 화살표 숨김
- **스크롤 변경 방지**: 숫자 입력에서 마우스 스크롤로 값 변경되지 않도록 처리

```css
.smallInput {
  width: 80px;
}
.unit {
  margin-left: 4px;
}

/* 숫자 입력 스핀 버튼 제거 (필수) */
input[type="number"]::-webkit-outer-spin-button,
input[type="number"]::-webkit-inner-spin-button {
  -webkit-appearance: none;
  margin: 0;
}
```

```tsx
// 숫자 입력에서 스크롤 변경 방지 (필수)
<input
  type="number"
  onWheel={(e) => (e.target as HTMLElement).blur()}
/>
```

## 프로그레시브 폼 규칙

- **순차적 표시**: 체크된 항목 + 다음 해야 할 항목 하나만 표시
- **체크된 항목 유지**: 완료된 항목은 항상 보임 (수정 가능하도록)
- **현재 행 강조**: 다음 해야 할 행의 번호를 주황색 + 굵게 표시
- **나타날 때 애니메이션**: 새 행은 아래→위 슬라이드업 (0.3s)
- **하단 고정 네비게이션**: 완료 버튼은 왼쪽 영역 하단에 sticky로 고정
- **프로그레스 바**: 헤더 아래에 완료율 표시

## 버튼/아이콘 배치 규칙

- **X 삭제 버튼**: 항상 행의 맨 오른쪽에 배치 (`margin-left: auto`)
- **+ 추가 버튼**: 빈 행에 배치, 클릭 시 새 항목 추가
- **없음/있음 선택**: 버튼 그룹으로 표시, 선택 시 다음 단계로

## 개인화 TIP

- **항목별 TIP**: 현재 입력 중인 항목에 맞는 TIP을 오른쪽 패널에 표시
- **데이터 기반 개인화**: 사용자가 입력한 데이터를 활용해 맞춤형 인사이트 제공
- **동적 업데이트**: 입력값 변경 시 실시간으로 TIP 내용 업데이트

## 차트 및 그래프

- **반드시 chart.js 사용**: 모든 차트/그래프는 `chart.js` + `react-chartjs-2` 사용
- **순수 SVG 금지**: 직접 SVG로 차트 그리지 않음
- **설치된 패키지**: `chart.js@^4.5.1`, `react-chartjs-2@^5.3.1`
- **시뮬레이션 종료 시점**: 본인/배우자 중 나중에 100세가 되는 해까지 표시

```tsx
import { Line, Bar, Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ... } from 'chart.js'

// 차트 종료 시점 계산 (100세 기준)
const selfAge100Year = currentYear + (100 - currentAge);
const spouseAge100Year = spouseCurrentAge !== null
  ? currentYear + (100 - spouseCurrentAge)
  : selfAge100Year;
const maxYear = Math.max(selfAge100Year, spouseAge100Year);
```

## 나이 계산 규칙 (만 나이)

- **모든 나이는 만 나이로 계산**: 생일 기준으로 정확히 계산
- **전역 유틸리티 사용**: `calculateAge` 함수를 `@/lib/utils`에서 import하여 사용
- **연 나이 계산 금지**: `currentYear - birthYear` 방식 사용 금지

```tsx
import { calculateAge } from '@/lib/utils'

// 사용 예시
calculateAge("1994-12-15")  // 생년월일 문자열 → 만 나이
calculateAge(new Date(1994, 11, 15))  // Date 객체 → 만 나이
calculateAge(1994)  // 출생년도만 있으면 1월 1일 기준으로 계산
```

## 금액 단위 규칙 (매우 중요!)

### 핵심 원칙
- **DB 저장은 항상 원 단위**: 모든 테이블의 금액 필드는 원(KRW) 단위
- **클라이언트 입력/표시는 만원 단위**: 사용자가 보고 입력하는 금액은 만원 단위
- **변환은 서비스 레이어에서**: 조회 시 원->만원, 저장 시 만원->원 변환

### 변환 함수 (src/lib/utils.ts)
- `manwonToWon(manwon)`: 만원 -> 원 (저장 시)
- `wonToManwon(won)`: 원 -> 만원 (조회 시)

### 표시 함수
- `formatMoney(manwon)`: 만원 입력 -> "5억 3,000만원" 표시
- `formatWon(won)`: 원 입력 -> "5억 3,000만원" 표시

### 서비스 레이어 규칙
- `getXXX()` 함수: DB에서 원 단위로 조회 -> 만원 단위로 변환 후 반환
- `createXXX()`, `updateXXX()` 함수: 만원 단위로 입력 -> 원 단위로 변환 후 저장

```tsx
// 서비스 파일 예시
import { wonToManwon, manwonToWon } from '@/lib/utils'

// 조회 시: DB(원) -> 클라이언트(만원)
const income = await getIncome(id)
// income.amount는 이미 만원 단위로 변환됨

// 저장 시: 클라이언트(만원) -> DB(원)
await createIncome({ amount: 500 })  // 500만원 입력 -> DB에 5000000원 저장

// 포맷팅
import { formatMoney } from '@/lib/utils'
formatMoney(500)  // "500만원"
formatMoney(53000)  // "5억 3,000만원"
```

## 시간 단위 규칙 (매우 중요!)

### 핵심 원칙
- **모든 재무 데이터는 년+월 구조**: 년도만 저장하는 필드 절대 금지
- **시작일 = 해당 월 1일**: startYear/startMonth → 그 달 1일부터
- **종료일 = 해당 월 말일**: endYear/endMonth → 그 달 마지막 날까지
- **일(day)은 저장하지 않음**: 월 단위가 최소 단위

### 적용 대상 (예외 없음)
- 소득/지출 기간: startYear + startMonth, endYear + endMonth
- 자산 취득일: purchaseYear + purchaseMonth
- 대출 만기: maturityYear + maturityMonth (또는 "YYYY-MM" 문자열)
- 연금 수령 시작: paymentStartYear + paymentStartMonth (또는 startYear + startMonth)
- 부동산 계약: startYear + startMonth, endYear + endMonth
- ISA/저축 만기: maturityYear + maturityMonth

### 데이터 구조 예시
```tsx
// 기간 데이터
interface Period {
  startYear: number   // 시작 연도
  startMonth: number  // 시작 월 (1-12) - 해당 월 1일부터
  endYear: number     // 종료 연도
  endMonth: number    // 종료 월 (1-12) - 해당 월 말일까지
}

// 취득일/만기일
interface AssetDate {
  purchaseYear: number
  purchaseMonth: number  // 1-12
}

// 만기일 문자열 형식 (대출 등)
const maturity = "2027-06"  // YYYY-MM 형식
```

### 계산 예시
```tsx
// 월 수 계산
const months = (endYear - startYear) * 12 + (endMonth - startMonth)

// 연간 상승률 → 월간 상승률 변환
const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1

// 표시 형식
const display = `${year}.${String(month).padStart(2, '0')}`  // "2025.06"
```
