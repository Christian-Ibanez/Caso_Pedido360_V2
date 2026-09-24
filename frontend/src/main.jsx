import { createRoot } from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './auth/authConfig';
import { setTokenProvider } from './api/http';
import { getAccessToken } from './auth/token'; // Importamos la función de obtención del JWT
import App from './App';
import './styles.css';

const msal = new PublicClientApplication(msalConfig);

// Registrar el proveedor de tokens de forma global antes del renderizado de React
setTokenProvider(async () => {
  const activeAccount = msal.getActiveAccount() || msal.getAllAccounts()[0];
  if (!activeAccount) {
    console.warn('>>> No hay cuenta activa cargada en MSAL');
    return null;
  }
  try {
    const token = await getAccessToken(msal, activeAccount);
    console.log('>>> TOKEN RECUPERADO CON ÉXITO');
    return token;
  } catch (err) {
    console.error('>>> Error obteniendo el token de MSAL:', err);
    return null;
  }
});

msal.initialize().then(() => {
  // Asegurar que la cuenta quede marcada como activa al iniciar
  const accounts = msal.getAllAccounts();
  if (accounts.length > 0 && !msal.getActiveAccount()) {
    msal.setActiveAccount(accounts[0]);
  }

  createRoot(document.getElementById('root')).render(
    <MsalProvider instance={msal}>
      <App />
    </MsalProvider>,
  );
}).catch(e => {
  console.error("Error initializing MSAL:", e);
  createRoot(document.getElementById('root')).render(
    <MsalProvider instance={msal}>
      <App />
    </MsalProvider>,
  );
});