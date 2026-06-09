import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
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

export default function App() {
  return (
    <Router>
      <Routes>
        {/* Login Page */}
        <Route path="/" element={<Login />} />
        
        {/* Protected Routes wrapped in Layout */}
        <Route path="/dashboard" element={<Layout><HomeDashboard /></Layout>} />
        <Route path="/user-management" element={<Layout><UserManagement /></Layout>} />
        <Route path="/account-selection" element={<Layout><AccountSelection /></Layout>} />
        <Route path="/budget-creation" element={<Layout><BudgetCreation /></Layout>} />
        <Route path="/business-activity-budget" element={<Layout><BusinessActivityBudget /></Layout>} />
        <Route path="/plan-actual-upload" element={<Layout><PlanActualUpload /></Layout>} />
        <Route path="/variance-comparison" element={<Layout><VarianceComparison /></Layout>} />
        <Route path="/overrun-check" element={<Layout><BudgetOverrunCheck /></Layout>} />

        {/* 1. 운영 현황 및 검토 */}
        <Route path="/budget-status" element={<Layout><BudgetStatus /></Layout>} />
        <Route path="/execution-ledger" element={<Layout><ExecutionLedger /></Layout>} />

        {/* 2. 점검 및 통제 */}
        <Route path="/underrun-check" element={<Navigate to="/overrun-check?status=underrun" replace />} />
        <Route path="/unbudgeted-check" element={<Navigate to="/overrun-check?status=unbudgeted" replace />} />

        {/* 4. 마스터 정보 및 시스템 설정 */}
        <Route path="/account-management" element={<Layout><AccountManagement /></Layout>} />
        <Route path="/department-management" element={<Layout><DepartmentManagement /></Layout>} />
        <Route path="/department-assignment" element={<Layout><DepartmentAssignment /></Layout>} />
        <Route path="/budget-lock-management" element={<Layout><BudgetLockManagement /></Layout>} />

        {/* 5. 비즈니스 운영 모듈 */}
        <Route path="/operation-dashboard" element={<Layout><OperationDashboard /></Layout>} />
        <Route path="/operation-upload" element={<Layout><OperationUpload /></Layout>} />
        <Route path="/sales-status" element={<Layout><SalesStatus /></Layout>} />
        <Route path="/purchase-status" element={<Layout><PurchaseStatus /></Layout>} />
        <Route path="/product-status" element={<Layout><ProductStatus /></Layout>} />
        <Route path="/production-status" element={<Layout><ProductionStatus /></Layout>} />
        <Route path="/raw-material-status" element={<Layout><RawMaterialStatus /></Layout>} />

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

        {/* Fallback */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Router>
  );
}
