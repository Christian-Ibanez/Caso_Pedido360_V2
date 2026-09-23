// Identidades de Entra ID (no son secretos). Se pueden sobreescribir con .env.local.
const tenantId = import.meta.env.VITE_ENTRA_TENANT_ID || '85ffb3f2-fe8a-4eef-9c3d-f1f4983a31b6';
const spaClientId = import.meta.env.VITE_SPA_CLIENT_ID || '0f1c9d10-bb47-4c6a-81af-d93fa51d44bf';
const apiClientId = import.meta.env.VITE_API_CLIENT_ID || 'c11a2330-26f6-4d03-a29b-9f43c9f47078';

export const msalConfig = {
  auth: {
    clientId: spaClientId,
    authority: `https://login.microsoftonline.com/${tenantId}`,
    redirectUri: `${window.location.origin}/redirect.html`,
    postLogoutRedirectUri: window.location.origin,
  },
  cache: {
    cacheLocation: 'sessionStorage',
  },
};

// Permiso delegado que expone el registro de la API
export const tokenRequest = {
  scopes: [`api://${apiClientId}/access_as_user`],
};
