import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus, EventType } from '@azure/msal-browser';
import { useNavigate } from 'react-router-dom';

export default function AuthCallbackComponent() {
  const { instance, accounts, inProgress } = useMsal();
  const navigate = useNavigate();
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    // Listen to MSAL events for errors
    const callbackId = instance.addEventCallback((message) => {
      if (message.eventType === EventType.LOGIN_FAILURE) {
        setErrorMsg('Error al iniciar sesión: ' + message.error?.message || 'Error desconocido');
      }
    });

    return () => {
      if (callbackId) {
        instance.removeEventCallback(callbackId);
      }
    };
  }, [instance]);

  useEffect(() => {
    // If MSAL is completely done (None) and we didn't capture a LOGIN_FAILURE
    if (inProgress === InteractionStatus.None && !errorMsg) {
      if (accounts.length > 0) {
        navigate('/dashboard', { replace: true });
      } else {
        // If no account and no error, just go to login (e.g. they visited / directly)
        navigate('/login', { replace: true });
      }
    }
  }, [inProgress, accounts, navigate, errorMsg]);

  return (
    <div className="page" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      {errorMsg ? (
        <div style={{ textAlign: 'center' }}>
          <p style={{ color: 'red', marginBottom: '1rem' }}>{errorMsg}</p>
          <button className="btn" onClick={() => navigate('/login', { replace: true })}>Volver al Login</button>
        </div>
      ) : (
        <p>Procesando autenticación... por favor espera.</p>
      )}
    </div>
  );
}
