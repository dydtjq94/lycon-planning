# 개발 규칙

## 참고 프로젝트

- **reference_porject 폴더는 오직 참고용**: 이전에 만들던 재무 시뮬레이션 프로젝트 (React + Firebase)
- **코드 복사 금지**: 구조와 로직만 참고, 직접 복사하지 않음
- **기술 스택 다름**: reference는 React/Firebase, 현재는 Next.js/Supabase

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

## 금액 단위 규칙

- **모든 금액 입력은 만원 단위**: 사용자가 입력하는 모든 금액은 만원 단위
- **예시**: 사용자가 `10000` 입력 = 10000만원 = 1억원
- **표시는 억+만 병행**: 1억 이상은 `6억 4,724만` 형식으로 표시
- **전역 유틸리티 사용**: `formatMoney` 함수를 `@/lib/utils`에서 import하여 사용
- **원 단위 변환 필요시**: `만원 * 10000 = 원`

```tsx
import { formatMoney } from '@/lib/utils'

// formatMoney 사용 예시
formatMoney(5000)     // "5,000만원"
formatMoney(10000)    // "1억"
formatMoney(64724)    // "6억 4,724만"

// 원 단위 변환 (계산용)
const wonValue = inputValue * 10000 // 100,000,000원
```

## 시간 단위 규칙 (중요!)

- **모든 기간/시뮬레이션은 월 단위**: 내부 데이터와 계산은 반드시 월(month) 단위
- **년도만 사용 금지**: startYear만 저장하지 말고, startYear + startMonth 함께 저장
- **표시는 유연하게**: 사용자에게는 년 단위로 보여줘도 되지만, 저장/계산은 월 단위
- **reference_project 참고**: cashflowSimulator.js 패턴 참고

```tsx
// 기간 데이터 구조
interface Period {
  startYear: number
  startMonth: number  // 1-12
  endYear: number
  endMonth: number    // 1-12
}

// 월 단위 계산 예시
const monthsElapsed = (endYear - startYear) * 12 + (endMonth - startMonth)

// 연간 상승률 → 월간 상승률 변환 (복리)
const monthlyRate = Math.pow(1 + annualRate, 1/12) - 1

// 표시할 때는 년도로 간략화 가능
const displayPeriod = `${startYear}년 ${startMonth}월 ~ ${endYear}년 ${endMonth}월`
// 또는 간략하게: `${startYear}.${startMonth} ~ ${endYear}.${endMonth}`
```
