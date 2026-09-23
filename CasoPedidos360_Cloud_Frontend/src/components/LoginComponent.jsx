import { useMsal } from '@azure/msal-react';
import { tokenRequest } from '../auth/authConfig';
import { Navigate } from 'react-router-dom';
import { useState } from 'react';

export default function LoginComponent() {
  const { instance, accounts } = useMsal();
  const [error, setError] = useState('');

  // If already logged in, go to dashboard
  if (accounts.length > 0) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async () => {
    try {
      await instance.loginRedirect({
        ...tokenRequest,
        prompt: 'select_account',
      });
    } catch (e) {
      console.error(e);
      setError(e.message || "Error al iniciar sesin");
    }
  };

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100vh' }}>
      <div className="section" style={{ textAlign: 'center', padding: '2rem', maxWidth: '400px', width: '100%' }}>
        <h2>Bienvenido a Pedidos360</h2>
        <p className="sub" style={{ marginBottom: '2rem' }}>Por favor, inicia sesin para continuar.</p>
        
        <button className="btn primary" onClick={handleLogin} style={{ width: '100%' }}>
          Iniciar sesin con Microsoft
        </button>

        {error && <p className="error" style={{ marginTop: '1rem' }}>{error}</p>}
      </div>
    </div>
  );
}
