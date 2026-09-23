// Seccion 1: estado de la sesion y botones de login/logout
export default function LoginSection({ session }) {
  const { account, username, busy, error, login, logout } = session;
  return (
    <section className="section">
      <h2>1. Iniciar sesión</h2>
      <div className="who">
        {account ? <>Sesión iniciada como <b>{username}</b></> : 'Sin sesión.'}
      </div>
      <button className="btn primary" onClick={login} disabled={busy}>
        {busy ? 'Conectando…' : 'Iniciar sesión con Microsoft'}
      </button>
      <button className="btn" onClick={logout} disabled={!account}>Cerrar sesión</button>
      {error && <p className="error">Error: {error}</p>}
    </section>
  );
}
