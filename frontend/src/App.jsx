import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import LoginComponent from './components/LoginComponent';
import DashboardComponent from './components/DashboardComponent';
import OrdersComponent from './components/OrdersComponent';
import CatalogComponent from './components/CatalogComponent';
import ReportsComponent from './components/ReportsComponent';
import AuditComponent from './components/AuditComponent';
import AuthCallbackComponent from './components/AuthCallbackComponent';

function ProtectedRoute({ children }) {
  const { accounts, inProgress } = useMsal();
  
  if (inProgress !== InteractionStatus.None) {
    return <div className="loading" style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Cargando sesión…</div>;
  }
  
  if (accounts.length === 0) {
    return <Navigate to="/login" replace />;
  }
  return children;
}

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginComponent />} />
        
        {/* Callback para Entra ID */}
        <Route path="/" element={<AuthCallbackComponent />} />
        <Route path="/auth/callback" element={<AuthCallbackComponent />} />
        
        <Route 
          path="/dashboard" 
          element={
            <ProtectedRoute>
              <DashboardComponent />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/orders" 
          element={
            <ProtectedRoute>
              <OrdersComponent />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/catalog" 
          element={
            <ProtectedRoute>
              <CatalogComponent />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/reports" 
          element={
            <ProtectedRoute>
              <ReportsComponent />
            </ProtectedRoute>
          } 
        />
        <Route 
          path="/audit" 
          element={
            <ProtectedRoute>
              <AuditComponent />
            </ProtectedRoute>
          } 
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
