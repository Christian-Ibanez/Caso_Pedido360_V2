import { useCallback, useEffect, useMemo, useState } from 'react';
import Layout from './Layout';
import { useRoles } from '../hooks/useRoles';
import {
  getQueues, createQueue, deleteQueue,
  getExchanges, createExchange, deleteExchange,
  getBindings, createBinding, deleteBinding,
} from '../api/mq';
import { Alert, PageHead, ServiceUnavailable } from './ui';
import { IconRefresh, IconPlus, IconTrash } from './Icons';

const TABS = [
  { id: 'queues', label: 'Colas' },
  { id: 'exchanges', label: 'Exchanges' },
  { id: 'bindings', label: 'Bindings' },
];

const NAME_RE = /^(?!amq\.)[A-Za-z0-9][A-Za-z0-9._-]*$/;
const NAME_HINT = "Letras, números, '.', '-' y '_'. No puede empezar con 'amq.'";

/** Botón de eliminar en dos pasos (sin diálogos del navegador). */
function DeleteButton({ label, onConfirm, disabled }) {
  const [armed, setArmed] = useState(false);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!armed) return undefined;
    const t = setTimeout(() => setArmed(false), 4000);
    return () => clearTimeout(t);
  }, [armed]);
  if (disabled) return <span className="small muted">Protegido</span>;
  return (
    <button
      type="button"
      className={`btn sm ${armed ? 'danger' : 'ghost'}`}
      aria-label={armed ? `Confirmar eliminar ${label}` : `Eliminar ${label}`}
      disabled={busy}
      onClick={async () => {
        if (!armed) { setArmed(true); return; }
        setBusy(true);
        try { await onConfirm(); } finally { setBusy(false); setArmed(false); }
      }}
    >
      <IconTrash size={15} /> {armed ? '¿Eliminar?' : 'Eliminar'}
    </button>
  );
}

function SystemBadge({ system }) {
  return system ? <span className="badge st-ACEPTADO">Sistema</span> : <span className="badge st-ENTREGADO">Nuevo</span>;
}

export default function RabbitAdminComponent() {
  const { isAdmin, resolved } = useRoles();
  const [tab, setTab] = useState('queues');
  const [queues, setQueues] = useState([]);
  const [exchanges, setExchanges] = useState([]);
  const [bindings, setBindings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [failure, setFailure] = useState(null);
  const [notice, setNotice] = useState(null);
  const [error, setError] = useState(null);

  const load = useCallback(async () => {
    setLoading(true);
    setFailure(null);
    try {
      const [q, e, b] = await Promise.all([getQueues(), getExchanges(), getBindings()]);
      setQueues(q || []);
      setExchanges(e || []);
      setBindings(b || []);
    } catch (err) {
      setFailure(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (resolved && isAdmin) load();
  }, [resolved, isAdmin, load]);

  const run = async (action, ok) => {
    setError(null);
    setNotice(null);
    try {
      await action();
      setNotice(ok);
      await load();
      return true;
    } catch (err) {
      setError(err.message);
      return false;
    }
  };

  if (resolved && !isAdmin) {
    return (
      <Layout title="RabbitMQ">
        <ServiceUnavailable title="Acceso restringido">La administración de RabbitMQ está reservada para usuarios con rol Administrador.</ServiceUnavailable>
      </Layout>
    );
  }

  return (
    <Layout title="RabbitMQ">
      <PageHead title="RabbitMQ" subtitle="Colas, exchanges y bindings del broker. Los recursos del sistema están protegidos.">
        <button type="button" className="btn" onClick={load} disabled={loading}>
          <IconRefresh size={16} /> {loading ? 'Actualizando…' : 'Actualizar'}
        </button>
      </PageHead>

      {failure?.unavailable || failure?.status === 503 ? (
        <ServiceUnavailable title="Administrador de RabbitMQ no disponible" onRetry={load} retrying={loading}>
          {failure.message}
        </ServiceUnavailable>
      ) : (
        <>
          {failure && <Alert>{failure.message}</Alert>}
          <Alert kind="success" onClose={() => setNotice(null)}>{notice}</Alert>
          <Alert onClose={() => setError(null)}>{error}</Alert>

          <div className="tabs" role="tablist" aria-label="Recursos de RabbitMQ" style={{ alignSelf: 'flex-start' }}>
            {TABS.map((t) => (
              <button key={t.id} type="button" role="tab" aria-selected={tab === t.id}
                className={`tab ${tab === t.id ? 'active' : ''}`} onClick={() => setTab(t.id)}>
                {t.label}{' '}
                <span className="tab-count">{{ queues, exchanges, bindings }[t.id].length}</span>
              </button>
            ))}
          </div>

          {tab === 'queues' && <QueuesTab queues={queues} exchanges={exchanges} run={run} />}
          {tab === 'exchanges' && <ExchangesTab exchanges={exchanges} run={run} />}
          {tab === 'bindings' && <BindingsTab bindings={bindings} queues={queues} exchanges={exchanges} run={run} />}
        </>
      )}
    </Layout>
  );
}

function QueuesTab({ queues, exchanges, run }) {
  const empty = { name: '', durable: true, deadLetterExchange: '', deadLetterRoutingKey: '', messageTtlMs: '', maxLength: '' };
  const [draft, setDraft] = useState(empty);
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const nameOk = NAME_RE.test(draft.name.trim());

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = { name: draft.name.trim(), durable: draft.durable };
    if (draft.deadLetterExchange) body.deadLetterExchange = draft.deadLetterExchange;
    if (draft.deadLetterExchange && draft.deadLetterRoutingKey.trim()) body.deadLetterRoutingKey = draft.deadLetterRoutingKey.trim();
    if (draft.messageTtlMs !== '') body.messageTtlMs = Number(draft.messageTtlMs);
    if (draft.maxLength !== '') body.maxLength = Number(draft.maxLength);
    const ok = await run(() => createQueue(body), `Cola ${body.name} creada.`);
    setSaving(false);
    if (ok) setDraft(empty);
  };

  return (
    <div className="row">
      <section className="card col-main" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="tbl">
            <thead>
              <tr><th>Cola</th><th className="right">Ready</th><th className="right">Unacked</th><th className="right">Total</th><th className="right" title="Consumidores">Cons.</th><th /></tr>
            </thead>
            <tbody>
              {queues.map((q) => (
                <tr key={q.name}>
                  <td>
                    <b>{q.name}</b> <SystemBadge system={q.system} />
                    {q.arguments?.['x-dead-letter-exchange'] && (
                      <div className="small muted">DLX {q.arguments['x-dead-letter-exchange']} · {q.arguments['x-dead-letter-routing-key'] || '—'}</div>
                    )}
                  </td>
                  <td className="right num">{q.messagesReady}</td>
                  <td className="right num">{q.messagesUnacknowledged}</td>
                  <td className="right num">{q.messages}</td>
                  <td className="right num">{q.consumers}</td>
                  <td className="right nowrap">
                    <DeleteButton label={q.name} disabled={q.system}
                      onConfirm={() => run(() => deleteQueue(q.name, q.messages === 0), `Cola ${q.name} eliminada.`)} />
                  </td>
                </tr>
              ))}
              {queues.length === 0 && <tr><td colSpan={6} className="muted">Sin colas.</td></tr>}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card card-pad col-side">
        <h2 className="card-title">Nueva cola</h2>
        <form className="stack-sm" onSubmit={submit} noValidate>
          <label className="field">Nombre
            <input value={draft.name} onChange={set('name')} placeholder="q.cmd.sms" maxLength={200} required aria-invalid={draft.name !== '' && !nameOk} />
            <span className="small muted" style={{ fontWeight: 400 }}>{NAME_HINT}</span>
          </label>
          <label className="check"><input type="checkbox" checked={draft.durable} onChange={set('durable')} /> Durable (sobrevive a reinicios)</label>
          <label className="field">Dead-letter exchange
            <select value={draft.deadLetterExchange} onChange={set('deadLetterExchange')}>
              <option value="">Sin DLQ</option>
              {exchanges.map((x) => <option key={x.name} value={x.name}>{x.name} ({x.type})</option>)}
            </select>
          </label>
          {draft.deadLetterExchange && (
            <label className="field">Dead-letter routing key
              <input value={draft.deadLetterRoutingKey} onChange={set('deadLetterRoutingKey')} placeholder="sms.send" />
            </label>
          )}
          <div className="form-grid two">
            <label className="field">TTL (ms)
              <input type="number" min="0" value={draft.messageTtlMs} onChange={set('messageTtlMs')} placeholder="Opcional" />
            </label>
            <label className="field">Máx. mensajes
              <input type="number" min="1" value={draft.maxLength} onChange={set('maxLength')} placeholder="Opcional" />
            </label>
          </div>
          <button type="submit" className="btn primary" disabled={saving || !nameOk}>
            <IconPlus size={16} /> {saving ? 'Creando…' : 'Crear cola'}
          </button>
        </form>
      </section>
    </div>
  );
}

function ExchangesTab({ exchanges, run }) {
  const [draft, setDraft] = useState({ name: '', type: 'direct', durable: true });
  const [saving, setSaving] = useState(false);
  const nameOk = NAME_RE.test(draft.name.trim());

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = { ...draft, name: draft.name.trim() };
    const ok = await run(() => createExchange(body), `Exchange ${body.name} creado.`);
    setSaving(false);
    if (ok) setDraft({ name: '', type: 'direct', durable: true });
  };

  return (
    <div className="row">
      <section className="card col-main" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Exchange</th><th>Tipo</th><th>Durable</th><th>Origen</th><th /></tr></thead>
            <tbody>
              {exchanges.map((x) => (
                <tr key={x.name}>
                  <td><b>{x.name}</b></td>
                  <td>{x.type}</td>
                  <td>{x.durable ? 'Sí' : 'No'}</td>
                  <td><SystemBadge system={x.system} /></td>
                  <td className="right">
                    <DeleteButton label={x.name} disabled={x.system}
                      onConfirm={() => run(() => deleteExchange(x.name), `Exchange ${x.name} eliminado.`)} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card card-pad col-side">
        <h2 className="card-title">Nuevo exchange</h2>
        <form className="stack-sm" onSubmit={submit} noValidate>
          <label className="field">Nombre
            <input value={draft.name} onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))} placeholder="cmd.sms" maxLength={200} />
            <span className="small muted" style={{ fontWeight: 400 }}>{NAME_HINT}</span>
          </label>
          <label className="field">Tipo
            <select value={draft.type} onChange={(e) => setDraft((d) => ({ ...d, type: e.target.value }))}>
              <option value="direct">direct (routing key exacta)</option>
              <option value="topic">topic (patrones * y #)</option>
              <option value="fanout">fanout (a todas las colas)</option>
              <option value="headers">headers</option>
            </select>
          </label>
          <label className="check"><input type="checkbox" checked={draft.durable} onChange={(e) => setDraft((d) => ({ ...d, durable: e.target.checked }))} /> Durable</label>
          <button type="submit" className="btn primary" disabled={saving || !nameOk}>
            <IconPlus size={16} /> {saving ? 'Creando…' : 'Crear exchange'}
          </button>
        </form>
      </section>
    </div>
  );
}

function BindingsTab({ bindings, queues, exchanges, run }) {
  const [draft, setDraft] = useState({ exchange: '', queue: '', routingKey: '' });
  const [saving, setSaving] = useState(false);
  const type = useMemo(() => exchanges.find((x) => x.name === draft.exchange)?.type, [exchanges, draft.exchange]);
  const needsKey = type === 'direct' || type === 'topic';
  const set = (k) => (e) => setDraft((d) => ({ ...d, [k]: e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    setSaving(true);
    const body = { ...draft, routingKey: needsKey ? draft.routingKey.trim() : '' };
    const ok = await run(() => createBinding(body), `Binding ${body.exchange} → ${body.queue} creado.`);
    setSaving(false);
    if (ok) setDraft((d) => ({ ...d, routingKey: '' }));
  };

  return (
    <div className="row">
      <section className="card col-main" style={{ padding: 0 }}>
        <div className="table-wrap">
          <table className="tbl">
            <thead><tr><th>Exchange</th><th>Routing key</th><th>Cola</th><th>Origen</th><th /></tr></thead>
            <tbody>
              {bindings.map((b) => (
                <tr key={`${b.exchange}|${b.queue}|${b.routingKey}`}>
                  <td>{b.exchange}</td>
                  <td><code>{b.routingKey || '—'}</code></td>
                  <td><b>{b.queue}</b></td>
                  <td><SystemBadge system={b.system} /></td>
                  <td className="right">
                    <DeleteButton label={`${b.exchange} a ${b.queue}`} disabled={b.system}
                      onConfirm={() => run(() => deleteBinding(b), 'Binding eliminado.')} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
      <section className="card card-pad col-side">
        <h2 className="card-title">Nuevo binding</h2>
        <form className="stack-sm" onSubmit={submit} noValidate>
          <label className="field">Exchange
            <select value={draft.exchange} onChange={set('exchange')} required>
              <option value="">Elige un exchange</option>
              {exchanges.map((x) => <option key={x.name} value={x.name}>{x.name} ({x.type})</option>)}
            </select>
          </label>
          <label className="field">Cola
            <select value={draft.queue} onChange={set('queue')} required>
              <option value="">Elige una cola</option>
              {queues.map((q) => <option key={q.name} value={q.name}>{q.name}</option>)}
            </select>
          </label>
          {needsKey && (
            <label className="field">Routing key
              <input value={draft.routingKey} onChange={set('routingKey')} placeholder={type === 'topic' ? 'sms.#' : 'sms.send'} />
              <span className="small muted" style={{ fontWeight: 400 }}>
                {type === 'topic' ? "'*' = una palabra, '#' = cero o más" : 'Coincidencia exacta, sin comodines'}
              </span>
            </label>
          )}
          {type && !needsKey && <p className="small muted" style={{ margin: 0 }}>Un exchange {type} no usa routing key.</p>}
          <button type="submit" className="btn primary" disabled={saving || !draft.exchange || !draft.queue || (needsKey && !draft.routingKey.trim())}>
            <IconPlus size={16} /> {saving ? 'Creando…' : 'Crear binding'}
          </button>
        </form>
      </section>
    </div>
  );
}
