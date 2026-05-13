# CURRENT_SYSTEM_REVIEW

## 현재 앱 목적
본 애플리케이션 `CM_assets_3030`은 조직 기반의 로컬 우선(Local-first) 예산 관리 시스템입니다. 클라이언트 영역(브라우저)에서 모든 경영계획/예산 및 실적 데이터를 1차 통합 관리할 수 있게 해주며, 주로 부서장이나 재무담당자가 예산 초과분 및 현황 비교 정보를 쉽게 분석할 수 있도록 돕습니다.

## 현재 라우트
- `/`: 로그인 (Login)
- `/dashboard`: 전사 및 개인 사용자 대시보드 (BudgetDashboard)
- `/budget-creation`: 각 부서의 계정별 연간 12개월 월별 예산 작성 및 제출 (BudgetCreation)
- `/variance-comparison`: 목표(계획/초기예산) 대비 기준(실적 등) 차이 분석기 (VarianceComparison)
- `/budget-overrun-check`: 예산 초과 발생 부서/계정 탐색 및 월별 Detail 조회기 (BudgetOverrunCheck)
- `/business-activity-budget`: 인원수 * 단가 기반의 부서 공통 경비 일괄 적용기 (BusinessActivityBudget)
- `/plan-actual-upload`: 실적 또는 경영계획 데이터 대량(엑셀) 업로드기 (PlanActualUpload)
- `/admin`: 전체 부서 사용자 및 시스템 설정 관리 (AdminDashboard)

## 현재 데이터 저장 방식
로컬스토리지(localStorage)를 JSON Document Storage 형태로 활용 중이며 각 화면에서 동기적(또는 비동기적 Promise 모방)으로 데이터에 접근합니다. 향후 Cloud Firestore 등 BaaS 연결을 위한 Adapter 패턴 구조를 미리 준비해 두기 위해 단일 스토리지 키 관리자(`src/lib/storageKeys.ts`)를 바탕으로 작동합니다.

## 예산 key 구조
```text
cleanmetal_budget_data_{deptCode}_{year}_{planType}
```
저장 형태: `BudgetRow[]` 배열로서 각 row에는 12개의 Number 배열(`values`)과 메타데이터(`sourceType`, `sourceFormulaId` 등)가 저장됩니다.

## 실적 key 구조
```text
cleanmetal_actual_data_{year}
```
저장 형태: `ActualData[]` 배열. 모든 부서의 개별 집행 건이 누적 기록됩니다.

## 권한 구조
`user.code` 를 기준으로 판단하며 마스터 권한('99999' - 관리자)과 기획재무그룹('32100')에 대한 하드코딩된 예외 로직 외에는, 개별 사용자에게 `viewableDeptCodes` 배열과 `canViewSalaryAccounts` Boolean 플래그를 localStorage(`cleanmetal_custom_users` 등)를 통해 주입하여 View 레벨 및 조회 쿼리 레벨 필터를 통제합니다.

## 제출/승인 구조
`cleanmetal_submission_status` 라는 Key 내부에 `deptCode_year_planType` 를 서브키로 가지는 Dictionary 객체 구조로 관리됩니다. 상태 값으로는 `DRAFT`, `SUBMITTED`, `REVIEWING`, `APPROVED`, `LOCKED` 등을 갖습니다. 

## 예산 초과 점검 로직 (`BudgetOverrunCheck.tsx`)
- 입력된 조건(실적년도 등)에 맞춰 `budgetAggregation.ts`의 `aggregateByDeptAccount`가 호출됩니다.
- 예산(budgetMap)과 실적(actualMap)을 하나의 유니온 키 공간에서 병합합니다.
- 초과 금액은 단순히 `Math.max(actual - budget, 0)`로 처리하지만, 각 월별 초과액 및 무예산 편성 여부를 함께 상세하게 도출합니다.

## 업무활동경비 반영 로직 (`BusinessActivityBudget.tsx`)
- 인원수 대비 단가(회식비, 간담회비 등)를 곱하여 월 단위 12개 값의 배열을 자동 산출합니다.
- 산출된 행들은 `sourceType: 'BUSINESS_ACTIVITY_AUTO'` 를 가지고 부서별 예산 StorageKey에 업서트(upsert)됩니다. 이때 일반 사용자가 수동입력한 수기 행과 충돌나지 않고 공존하도록 보존됩니다.

## 디자인시스템 적용 상태
Tailwind CSS를 기반으로, 토스(Toss)와 유사한 형태의 무채색 그레이 스케일을 메인 베이스로 하고, 포인트 색상인 Cobalt/Blue 류를 적용하여 안정감을 제공하는 `CM_assets` 내부 컬러 파레트를 부분적으로 따르고 있습니다. 복잡한 표(Table)가 많아 Reusable 한 CSS 모듈 대신, Lucide 아이콘과 Radix/Headless 접근법과 비슷한 Raw Tailwind 템플릿 계층을 사용합니다.

## 남은 과제 (P0/P1)
1. **조직변경 반영 기준 (P0)**: 현재 부서코드 기반이긴 하나 조직이 통폐합되거나 새로 갈라질 때 발생하는 과거 이력에 대한 롤업(Rollup)이 완벽히 구조화되지 않았습니다.
2. **계정별현황/부서별현황 대시보드 통합 기능 (P1)**: `aggregateByAccount` 및 `aggregateByDept`를 더욱 다양한 View에 이식할 수 있는 컴포넌트 구조화가 남았습니다.
3. **Firestore 연결 (P2)**: 전체적인 로컬스토리지 IO를 실제 Web SDK (DB API) 로 마이그레이션.

## 웹 전환을 위한 다음 구조
`PlanActualUpload` 의 경우 현재 인메모리 파싱 후 한방에 localStorage로 저장하지만, 실제 환경에서는 Firebase Storage나 Batch Write 처리가 필요하므로 chunking 구조 개선이 예정되어야 합니다.
