# 프로젝트: 로컬 우선 예산관리 앱 분석 보고서

## 1. 현재 시스템 목적
본 시스템은 예산 담당자들이 예산을 편성상신하고, 관리자가 상태를 파악/승인/반려하며, 실적을 업로드해 경영계획/수정경영계획 등 대비 실제 집행과 초과분 등을 파악하기 위해 마련되었습니다.

## 2. 현재 페이지 구조
- **예산 편성 (BudgetCreation)**: 연도별/계획별/부서별/월별 예산을 수립하고 상신(SUBMITTED)합니다.
- **실적 업로드 (ActualUpload)**: ERP 등에서 가져온 실적 데이터를 뷰/저장.
- **예산 초과 점검 (BudgetOverrunCheck)**: 계획과 실적을 대비해, 무예산 집행 또는 예산 초과분만 필터링해서 봅니다. (제조/판관, 인건비 필터 지원)
- **부서별 예산 현황 (DeptVariance)**: 특정 부서의 항목별(계정별) 예산/실적 대비
- **비교 분석 (VarianceComparison)**: 여러 조건별로 막대 그래프 등 시각화.
- **항목 관리 (AccountSelection)**: 회사에서 사용하는 비용 계정을 정의하고 필터링합니다.
- **사용자 권한 관리 (UserManagement)**: 부서장과 시스템 관리자(기획재무그룹)별 권한 및 각 부서 예산안의 상신 상태(DRAFT, SUBMITTED 등) 추적. 

## 3. 현재 데이터 저장 방식
모든 데이터는 `localStorage`에 JSON 포맷으로 직렬화되어 저장되며 백엔드 DB가 없습니다. 따라서 브라우저 세션/캐시에 종속되어 있습니다. 데이터 포맷 변경 시 즉각적인 마이그레이션 전략이 파편화되어 있을 수 있습니다.

## 4. 현재 예산 데이터 key 구조
- 키 템플릿: `budgetData_{deptCode}_{year}_{planType}`
- `planType` 종류: '경영계획', '수정경영계획', '1차RP', '2차RP', '추정실적'
- 구조: 배열 안에 `code`, `accountName`, `attributedDeptCode`, `values` (1월~12월까지의 12칸 숫자 배열) 등이 있습니다.

## 5. 현재 실적 데이터 구조
- 키 템플릿: `actualData_{year}`
- 구조: 배열의 개별 아이템. `period`(‘2024-01’ 등), `accountCode`, `accountName`, `usageCode`(부서코드), `amount`, `completed` 등을 포함합니다.

## 6. 현재 권한 구조
- `userCode`(ID 또는 `code`) 기준으로 중앙화된 권한 검사를 합니다(`src/lib/permissions.ts`).
- **시스템 관리자(`99999`)**: 모든 권한 통과
- **기획재무그룹(`32100`)**: 모든 권한 통과
- **개별 권한 설정**: `USER_SETTINGS[userCode].hasSalaryAccess` 등이 있으면 인건비/특정 뷰 접근 허용.
- `getViewableDeptCodes()`와 `canViewAccount()` 등의 유틸로 UI 레벨에서 필터링을 하고 있습니다.

## 7. 현재 제출/승인 상태 구조
- 키보단 통합 MAP 방식으로 `cleanmetal_submission_status` 라는 하나의 로컬스토리지 객체에 관리.
- 내부 `property key`: `{deptCode}_{year}_{planType}` 
- Status 종류: `DRAFT`, `SUBMITTED`, 'REVIEWING', `APPROVED`, `REJECTED`, `LOCKED` (과거 `submitted: boolean`은 읽기 시에 이 구조로 자동 마이그레이션)
- 제출자와 시간, 반려 사유 등을 함께 저장합니다.

## 8. 현재 예산 초과 점검 로직
- `aggregateByDeptAccount()` (in `budgetAggregation.ts`)를 활용해 모든 (부서+계정코드) 쌍을 Union한 후,
- 선택된 분기나 연도에 해당하는 예산 values 합계(`qBudget`, `yBudget`)와, 일치하는 기간의 실적 `completed` 필드(`qActual`, `yActual`)를 더한 후 대조.
- 예산이 0이고 실적이 발생하면 `무예산 집행`, 실적이 예산을 넘으면 `초과`로 판별.
- `계정구분`("제조", "판관", "인건비 제외", "인건비만 보기") 필터를 통해 동적 분류.

## 9. 현재 디자인시스템 적용 상태
- `src/components/ui/` 및 `src/components/budget/` 등에 컴포넌트를 분리.
- `tailwind` 토큰 기반(색상: nickel, cobalt, lithium 계열).
- `AppButton`, `AppBadge`, `MetricCard`, `OverrunBadge`, `BudgetAmount` 등 명확한 관심사 분리를 도입했습니다.

## 10. 현재 한계
1. **휘발성 (로컬스토리지)**: 브라우저 청소 시 모든 예산 데이터가 소멸. 여러 사용자 간 협업 및 승인 불가.
2. **조직변경 관리**: 부서 합병 시, 직전 연도의 실적이나 예산을 새 부서 코드로 매핑하기가 어렵습니다 (History Table 같은 개념 부재).
3. **복잡하고 큰 데이터의 렌더링 성능**: 실적 데이터가 수만 Row에 도달할 경우, 브라우저 단에서 매번 `.filter()`, `.reduce()`를 도는 집계 로직이 심각한 렌더 디레이/버벅임을 유발할 수 있습니다.
4. **동시성 제어 부재**: 엑셀 업로드와 수기 변경, 관리자 승인 등이 물리적으로 동시에 일어났을 때의 Lock/Race Condition 방지가 안 됨.

## 11. 다음 진행계획
- 계정별 현황, 부서별 현황 고도화
- 조직변경 관리: 구 조직 -> 현 조직 변환 테이블 설계 및 적용 (Mapping Table 도입)
- 차트/대시보드 고도화 (임원진용 종합 뷰)
- 데이터 저장 안정성을 위한 백업-다운로드-복구 로직이나 WebSQL / IndexedDB로의 점진적 오프로딩.

## 12. 웹 전환 시 필요한 구조
- **RDBMS 도입**: SQLite / PostgreSQL
  - `Budgets(dept, year, plan_type, account_id, month, amount)` 
  - `Actuals(id, tx_date, src_dept, dest_dept, account_id, amount_completed)`
  - `Users`, `Departments`, `Roles(RBAC)`
- **Server API**: 위 집계들(`aggregateByDeptAccount` 등)은 모두 SQL Server단에서의 `GROUP BY`와 `JOIN`으로 마이그레이션 해야 대용량 처리가 가능.
- **Audit Logging**: 언제, 어떤 사유로 예산안이 승인/반려되었는지 로그 저장소가 필수.
