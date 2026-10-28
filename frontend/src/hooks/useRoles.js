import { useEffect, useState } from 'react';
import { useMsal } from '@azure/msal-react';
import { getAccessToken, decodeClaims } from '../auth/token';

// Los app roles vienen en el access token de la API (el BFF valida los mismos).
// Se cachean para no decodificar el token en cada vista.
let cachedRoles = null;

export function useRoles() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const [roles, setRoles] = useState(cachedRoles || account?.idTokenClaims?.roles || []);
  const [resolved, setResolved] = useState(Boolean(cachedRoles));

  useEffect(() => {
    let alive = true;
    if (!account) return undefined;
    (async () => {
      try {
        const token = await getAccessToken(instance, account);
        const claims = token ? decodeClaims(token) : {};
        const next = claims.roles || account?.idTokenClaims?.roles || [];
        cachedRoles = next;
        if (alive) setRoles(next);
      } catch (err) {
        console.error('No se pudieron leer los roles del token:', err);
      } finally {
        if (alive) setResolved(true);
      }
    })();
    return () => { alive = false; };
  }, [instance, account]);

  const isAdmin = roles.includes('Admin');
  const isAuditor = roles.includes('Auditor');
  const isOperator = roles.includes('Operator');
  const isStaff = isAdmin || isOperator;
  const isCustomer = !isAdmin && !isOperator && !isAuditor;
  const email = (account?.username || account?.idTokenClaims?.preferred_username || '').toLowerCase();

  return { roles, resolved, account, email, isAdmin, isAuditor, isOperator, isStaff, isCustomer };
}

export function clearRolesCache() {
  cachedRoles = null;
}
