import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import Layout from './components/Layout';
import Login from './pages/Login';
import AdminDashboard from './pages/AdminDashboard';
import UserManagement from './pages/UserManagement';
import AccountSelection from './pages/AccountSelection';
import BudgetCreation from './pages/BudgetCreation';
import VarianceComparison from './pages/VarianceComparison';
import BusinessActivityBudget from './pages/BusinessActivityBudget';
import PlanActualUpload from './pages/PlanActualUpload';

export default function App() {
  return (
    <Router>
      <Routes>
        <Route path="/" element={<Login />} />
        
        {/* Protected Routes wrapped in Layout */}
        <Route path="/user-management" element={<Layout><UserManagement /></Layout>} />
        <Route path="/account-selection" element={<Layout><AccountSelection /></Layout>} />
        <Route path="/budget-creation" element={<Layout><BudgetCreation /></Layout>} />
        <Route path="/business-activity-budget" element={<Layout><BusinessActivityBudget /></Layout>} />
        <Route path="/actual-upload" element={<Layout><PlanActualUpload /></Layout>} />
        <Route path="/variance-comparison" element={<Layout><VarianceComparison /></Layout>} />
        
        {/* Fallback */}
        <Route path="/dashboard" element={<Navigate to="/user-management" replace />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Router>
  );
}
