import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import LoginComponent from './components/LoginComponent';
import DashboardComponent from './components/DashboardComponent';
import OrdersComponent from './components/OrdersComponent';
import AuthCallbackComponent from './components/AuthCallbackComponent';

function ProtectedRoute({ children }) {
  const { accounts, inProgress } = useMsal();
  
  if (inProgress !== InteractionStatus.None) {
    return <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>Cargando...</div>;
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
        
        {/* We use the root '/' as the auth callback to match Azure AD config. */}
        <Route path="/" element={<AuthCallbackComponent />} />
        
        {/* This was the previous callback, leaving it just in case. */}
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
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
