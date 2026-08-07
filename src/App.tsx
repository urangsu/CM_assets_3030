import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { ReactNode } from 'react';
import Layout from './components/Layout';
import Login from './pages/Login';
import HomeDashboard from './pages/HomeDashboard';
import UserManagement from './pages/UserManagement';
import AccountSelection from './pages/AccountSelection';
import BudgetCreation from './pages/BudgetCreation';
import VarianceComparison from './pages/VarianceComparison';
import BusinessActivityBudget from './pages/BusinessActivityBudget';
import BudgetOverrunCheck from './pages/BudgetOverrunCheck';
import PlanActualUpload from './pages/PlanActualUpload';
import BudgetLockManagement from './pages/BudgetLockManagement';

// Newly added high-fidelity pages
import BudgetStatus from './pages/BudgetStatus';
import ExecutionLedger from './pages/ExecutionLedger';
import UnderrunCheck from './pages/UnderrunCheck';
import UnbudgetedCheck from './pages/UnbudgetedCheck';
import AccountManagement from './pages/AccountManagement';
import DepartmentManagement from './pages/DepartmentManagement';
import SalesStatus from './pages/SalesStatus';
import PurchaseStatus from './pages/PurchaseStatus';
import ProductionStatus from './pages/ProductionStatus';
import RawMaterialStatus from './pages/RawMaterialStatus';
import DepartmentAssignment from './pages/DepartmentAssignment';
import OperationUpload from './pages/OperationUpload';
import OperationDashboard from './pages/OperationDashboard';
import ProductStatus from './pages/ProductStatus';
import { BlendTester } from './pages/BlendTester';
import OperationSettings from './pages/OperationSettings';
import { ErrorBoundary } from './components/ErrorBoundary';

function ProtectedRoute({ children }: { children: ReactNode }) {
  const raw = localStorage.getItem('current_user');

  if (!raw) {
    return <Navigate to="/" replace />;
  }

  try {
    const user = JSON.parse(raw);
    if (!user || typeof user !== 'object' || !user.code) {
      throw new Error('Invalid user object');
    }
  } catch {
    localStorage.removeItem('current_user');
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Login Page */}
        <Route path="/" element={<Login />} />
        
        {/* Protected Routes wrapped in Layout */}
        <Route path="/dashboard" element={<ProtectedRoute><Layout><HomeDashboard /></Layout></ProtectedRoute>} />
        <Route path="/user-management" element={<ProtectedRoute><Layout><UserManagement /></Layout></ProtectedRoute>} />
        <Route path="/account-selection" element={<ProtectedRoute><Layout><AccountSelection /></Layout></ProtectedRoute>} />
        
        <Route path="/budget-creation" element={
          <ProtectedRoute>
            <Layout>
              <ErrorBoundary title="예산 편성">
                <BudgetCreation />
              </ErrorBoundary>
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/business-activity-budget" element={<ProtectedRoute><Layout><BusinessActivityBudget /></Layout></ProtectedRoute>} />
        
        <Route path="/plan-actual-upload" element={
          <ProtectedRoute>
            <Layout>
              <ErrorBoundary title="실적 업로드 및 관리">
                <PlanActualUpload />
              </ErrorBoundary>
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/variance-comparison" element={
          <ProtectedRoute>
            <Layout>
              <ErrorBoundary title="비교분석">
                <VarianceComparison />
              </ErrorBoundary>
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/overrun-check" element={
          <ProtectedRoute>
            <Layout>
              <ErrorBoundary title="통제 대상성 점검">
                <BudgetOverrunCheck />
              </ErrorBoundary>
            </Layout>
          </ProtectedRoute>
        } />

        {/* 1. 운영 현황 및 검토 */}
        <Route path="/budget-status" element={
          <ProtectedRoute>
            <Layout>
              <ErrorBoundary title="부서 예산 현황">
                <BudgetStatus />
              </ErrorBoundary>
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/execution-ledger" element={<ProtectedRoute><Layout><ExecutionLedger /></Layout></ProtectedRoute>} />

        {/* 2. 점검 및 통제 */}
        <Route path="/underrun-check" element={<Navigate to="/overrun-check?status=underrun" replace />} />
        <Route path="/unbudgeted-check" element={<Navigate to="/overrun-check?status=unbudgeted" replace />} />

        {/* 4. 마스터 정보 및 시스템 설정 */}
        <Route path="/account-management" element={<ProtectedRoute><Layout><AccountManagement /></Layout></ProtectedRoute>} />
        <Route path="/department-management" element={<ProtectedRoute><Layout><DepartmentManagement /></Layout></ProtectedRoute>} />
        
        <Route path="/department-assignment" element={
          <ProtectedRoute>
            <Layout>
              <ErrorBoundary title="부서 소속 및 권한 매핑">
                <DepartmentAssignment />
              </ErrorBoundary>
            </Layout>
          </ProtectedRoute>
        } />
        
        <Route path="/budget-lock-management" element={<ProtectedRoute><Layout><BudgetLockManagement /></Layout></ProtectedRoute>} />

        {/* 5. 비즈니스 운영 모듈 */}
        <Route path="/operation-dashboard" element={<ProtectedRoute><Layout><ErrorBoundary title="운영 대시보드"><OperationDashboard /></ErrorBoundary></Layout></ProtectedRoute>} />
        <Route path="/operation-upload" element={<ProtectedRoute><Layout><ErrorBoundary title="운영자료 업로드"><OperationUpload /></ErrorBoundary></Layout></ProtectedRoute>} />
        <Route path="/sales-status" element={<ProtectedRoute><Layout><ErrorBoundary title="판매 현황"><SalesStatus /></ErrorBoundary></Layout></ProtectedRoute>} />
        <Route path="/purchase-status" element={<ProtectedRoute><Layout><ErrorBoundary title="구매 현황"><PurchaseStatus /></ErrorBoundary></Layout></ProtectedRoute>} />
        <Route path="/product-status" element={<ProtectedRoute><Layout><ErrorBoundary title="제품 수불 현황"><ProductStatus /></ErrorBoundary></Layout></ProtectedRoute>} />
        <Route path="/production-status" element={<ProtectedRoute><Layout><ErrorBoundary title="생산 현황"><ProductionStatus /></ErrorBoundary></Layout></ProtectedRoute>} />
        <Route path="/raw-material-status" element={<ProtectedRoute><Layout><ErrorBoundary title="원자재 수불 현황"><RawMaterialStatus /></ErrorBoundary></Layout></ProtectedRoute>} />
        <Route path="/blend-tester" element={<ProtectedRoute><Layout><ErrorBoundary title="배합테스터"><BlendTester /></ErrorBoundary></Layout></ProtectedRoute>} />
        <Route path="/operation-settings" element={<ProtectedRoute><Layout><ErrorBoundary title="운영 설정"><OperationSettings /></ErrorBoundary></Layout></ProtectedRoute>} />

        {/* --- Route Alias Redirects (라우트 안정화) --- */}
        <Route path="/plan-actual" element={<Navigate to="/plan-actual-upload" replace />} />
        <Route path="/actual-upload" element={<Navigate to="/plan-actual-upload" replace />} />
        <Route path="/budget" element={<Navigate to="/budget-creation" replace />} />
        <Route path="/account" element={<Navigate to="/account-selection" replace />} />
        <Route path="/review" element={<Navigate to="/overrun-check" replace />} />
        <Route path="/compare" element={<Navigate to="/variance-comparison" replace />} />
        <Route path="/overrun" element={<Navigate to="/overrun-check" replace />} />
        <Route path="/underrun" element={<Navigate to="/overrun-check?status=underrun" replace />} />
        <Route path="/unbudgeted" element={<Navigate to="/overrun-check?status=unbudgeted" replace />} />
        <Route path="/plan-create" element={<Navigate to="/budget-creation" replace />} />
        <Route path="/comparison" element={<Navigate to="/variance-comparison" replace />} />
        <Route path="/account-master" element={<Navigate to="/account-management" replace />} />
        <Route path="/department-master" element={<Navigate to="/department-management" replace />} />
        <Route path="/products" element={<Navigate to="/product-status" replace />} />
        <Route path="/product-ledger" element={<Navigate to="/product-status" replace />} />
        <Route path="/product" element={<Navigate to="/product-status" replace />} />

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
