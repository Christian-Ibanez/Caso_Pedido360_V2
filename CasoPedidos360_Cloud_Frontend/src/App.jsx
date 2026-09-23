import { useSession } from './auth/AuthGate';
import LoginSection from './auth/LoginPage';
import { BackendTestSection, TokenSection } from './components/SessionInfo';

export default function App() {
  const session = useSession();

  return (
    <div className="page">
      <h1>Pedidos360</h1>
      <p className="sub">Inicia sesión con Microsoft Entra ID, revisa el token y pruébalo contra el BFF.</p>

      <LoginSection session={session} />
      <TokenSection session={session} />
      <BackendTestSection session={session} />
    </div>
  );
}
