import { createRoot } from 'react-dom/client';
import { PublicClientApplication } from '@azure/msal-browser';
import { MsalProvider } from '@azure/msal-react';
import { msalConfig } from './auth/authConfig';
import App from './App';
import './styles.css';

const msal = new PublicClientApplication(msalConfig);

msal.initialize().then(() => {
  createRoot(document.getElementById('root')).render(
    <MsalProvider instance={msal}>
      <App />
    </MsalProvider>,
  );
}).catch(e => {
  console.error("Error initializing MSAL:", e);
  // fallback if initialize isn't needed or fails for some reason
  createRoot(document.getElementById('root')).render(
    <MsalProvider instance={msal}>
      <App />
    </MsalProvider>,
  );
});
