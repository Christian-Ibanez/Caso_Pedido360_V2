import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { Navigate } from 'react-router-dom';
import { tokenRequest } from '../auth/authConfig';
import { IconBag } from './Icons';
import { Alert } from './ui';

export default function LoginComponent() {
  const { instance, accounts } = useMsal();
  const [error, setError] = useState('');

  if (accounts.length > 0) {
    return <Navigate to="/dashboard" replace />;
  }

  const handleLogin = async () => {
    try {
      await instance.loginRedirect({ ...tokenRequest, prompt: 'select_account' });
    } catch (e) {
      console.error(e);
      setError(e.message || 'Error al iniciar sesión');
    }
  };

  return (
    <div className="login">
      <div className="login-card">
        <div className="login-brand">
          <div className="brand-mark"><IconBag size={22} /></div>
          <div>
            <div className="brand-name">Pedidos360</div>
            <div className="brand-sub">Panadería y cafetería</div>
          </div>
        </div>
        <div>
          <h1>Bienvenido</h1>
          <p>Inicia sesión con tu cuenta de Microsoft para hacer y seguir tus pedidos.</p>
        </div>
        <button type="button" className="btn primary block" onClick={handleLogin}>
          Iniciar sesión con Microsoft
        </button>
        <Alert>{error}</Alert>
      </div>
    </div>
  );
}
