import { useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { InteractionStatus } from '@azure/msal-browser';
import { tokenRequest } from './authConfig';
import { getAccessToken } from './token';

const message = (e) => (e instanceof Error ? e.message : String(e));

// Estado de la sesión con Entra ID: cuenta, login/logout y access token para las llamadas al backend
export function useSession() {
  const { instance, accounts, inProgress } = useMsal();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const account = accounts[0];

  async function login() {
    setBusy(true);
    setError('');
    try {
      await instance.loginPopup({ ...tokenRequest, prompt: 'select_account' });
    } catch (e) {
      setError(message(e));
    } finally {
      setBusy(false);
    }
  }

  return {
    account,
    username: account?.username ?? '',
    busy: busy || inProgress !== InteractionStatus.None,
    error,
    login,
    logout: () => instance.logoutPopup({ account }),
    getToken: () => getAccessToken(instance, account),
  };
}