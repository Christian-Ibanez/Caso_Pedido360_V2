import { useState, useEffect } from 'react';
import { useMsal } from '@azure/msal-react';
import Layout from './Layout';
import { getAuditEvents, getAuditEventDetail, getEventTypes, getActors } from '../api/audit';
import { getAccessToken, decodeClaims } from '../auth/token';

export default function AuditComponent() {
  const { instance, accounts } = useMsal();
  const account = accounts[0];
  const [roles, setRoles] = useState(account?.idTokenClaims?.roles || []);
  const isAdmin = roles.includes('Admin');
  const isAuditor = roles.includes('Auditor');
  const canAccess = isAdmin || isAuditor;

  const [events, setEvents] = useState([]);
  const [eventTypes, setEventTypes] = useState([]);
  const [actors, setActors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filtros
  const [selectedType, setSelectedType] = useState('');
  const [selectedActor, setSelectedActor] = useState('');
  const [orderIdFilter, setOrderIdFilter] = useState('');
  const [limit, setLimit] = useState(100);

  // Modal detalle Kafka
  const [selectedEventDetail, setSelectedEventDetail] = useState(null);
  const [loadingDetail, setLoadingDetail] = useState(false);
  const [detailError, setDetailError] = useState('');

  useEffect(() => {
    const fetchRoles = async () => {
      if (!account) return;
      try {
        const token = await getAccessToken(instance, account);
        if (token) {
          const claims = decodeClaims(token);
          if (claims.roles) setRoles(claims.roles);
        }
      } catch (err) {
        console.error('Error obteniendo roles en AuditComponent:', err);
      }
    };
    fetchRoles();
  }, [instance, account]);

  // Cargar metadatos para filtros
  useEffect(() => {
    if (canAccess) {
      getEventTypes().then(types => Array.isArray(types) && setEventTypes(types)).catch(() => {});
      getActors().then(acts => Array.isArray(acts) && setActors(acts)).catch(() => {});
    }
  }, [canAccess]);

  const loadEvents = async () => {
    if (!canAccess) return;
    setLoading(true);
    setError('');
    try {
      const data = await getAuditEvents({
        type: selectedType || undefined,
        user: selectedActor || undefined,
        orderId: orderIdFilter.trim() || undefined,
        limit
      });
      setEvents(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || 'No se pudo conectar con ms-pedidos360-audit.');
      setEvents([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (canAccess) {
      loadEvents();
    } else {
      setLoading(false);
    }
  }, [canAccess, selectedType, selectedActor, limit]);

  const handleOpenDetail = async (eventId) => {
    setLoadingDetail(true);
    setDetailError('');
    setSelectedEventDetail(null);
    try {
      const detail = await getAuditEventDetail(eventId);
      setSelectedEventDetail(detail);
    } catch (err) {
      setDetailError(err.message || 'Error al cargar el detalle del evento.');
    } finally {
      setLoadingDetail(false);
    }
  };

  const getEventTypeBadge = (type) => {
    let bg = '#eff6ff';
    let color = '#1d4ed8';
    let border = '#bfdbfe';

    if (type?.includes('CREATED')) {
      bg = '#ecfdf5'; color = '#047857'; border = '#a7f3d0';
    } else if (type?.includes('DELETED')) {
      bg = '#fef2f2'; color = '#b91c1c'; border = '#fecaca';
    } else if (type?.includes('STATUS') || type?.includes('UPDATED')) {
      bg = '#f5f3ff'; color = '#6d28d9'; border = '#ddd6fe';
    } else if (type?.includes('CANCELADO')) {
      bg = '#fff7ed'; color = '#c2410c'; border = '#fed7aa';
    }

    return (
      <span style={{ padding: '0.2rem 0.6rem', borderRadius: '4px', fontSize: '0.75rem', fontWeight: 'bold', backgroundColor: bg, color: color, border: `1px solid ${border}` }}>
        {type}
      </span>
    );
  };

  if (!canAccess) {
    return (
      <Layout title="Auditoría y Trazabilidad">
        <div style={{ backgroundColor: '#fffbeb', border: '1px solid #fde68a', borderRadius: '8px', padding: '2rem', textAlign: 'center', color: '#92400e' }}>
          <h3 style={{ margin: '0 0 0.5rem', color: '#78350f' }}>Acceso Restringido</h3>
          <p style={{ margin: 0 }}>
            El módulo de Auditoría y Trazabilidad Kafka está reservado para usuarios con rol <strong>Administrador (Admin)</strong> o <strong>Auditor (Auditor)</strong>.
          </p>
        </div>
      </Layout>
    );
  }

  return (
    <Layout title="Auditoría y Trazabilidad (ms-pedidos360-audit)">
      <div>
        {/* Banner del Microservicio */}
        <div style={{ backgroundColor: '#f8fafc', border: '1px solid #cbd5e1', borderRadius: '8px', padding: '1rem', marginBottom: '1.5rem', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <span style={{ fontWeight: 'bold', color: '#1e293b', fontSize: '1rem' }}>
              Microservicio: <code style={{ backgroundColor: '#e2e8f0', color: '#0f172a' }}>ms-pedidos360-audit</code> (Puerto 8084)
            </span>
            <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#475569' }}>
              Bitácora inmutable de eventos consumidos desde Kafka (tópico <code>orders.events</code>). Registra qué usuario, desde qué IP y en qué fecha realizó cambios sobre cada pedido.
            </p>
          </div>
          <button onClick={loadEvents} className="btn" title="Refrescar eventos">
            ↻ Actualizar Auditoría
          </button>
        </div>

        {error && (
          <div style={{ backgroundColor: '#fff1f2', border: '1px solid #fecdd3', borderRadius: '8px', padding: '1.25rem', marginBottom: '1.5rem', color: '#9f1239' }}>
            <h4 style={{ margin: '0 0 0.5rem', fontWeight: 'bold' }}>Aviso sobre el servicio de Auditoría:</h4>
            <p style={{ margin: '0 0 0.5rem', fontSize: '0.9rem' }}>{error}</p>
            <p style={{ margin: 0, fontSize: '0.85rem', color: '#be123c', fontStyle: 'italic' }}>
              💡 Nota de Arquitectura: <code>ms-pedidos360-audit</code> requiere el cluster Kafka levantado (perfil kafka: <code>docker compose --profile kafka up -d</code>).
            </p>
          </div>
        )}

        {/* Barra de Filtros */}
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center', flexWrap: 'wrap', backgroundColor: '#fff', padding: '1rem', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', marginBottom: '1.5rem' }}>
          
          <div style={{ minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.3rem' }}>
              Tipo de Evento:
            </label>
            <select
              value={selectedType}
              onChange={e => setSelectedType(e.target.value)}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
            >
              <option value="">Todos los eventos</option>
              {eventTypes.length > 0 ? (
                eventTypes.map(t => <option key={t} value={t}>{t}</option>)
              ) : (
                <>
                  <option value="ORDER_CREATED">ORDER_CREATED</option>
                  <option value="ORDER_STATUS_CHANGED">ORDER_STATUS_CHANGED</option>
                  <option value="ORDER_UPDATED">ORDER_UPDATED</option>
                  <option value="ORDER_DELETED">ORDER_DELETED</option>
                </>
              )}
            </select>
          </div>

          <div style={{ minWidth: '180px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.3rem' }}>
              Usuario / Actor:
            </label>
            <select
              value={selectedActor}
              onChange={e => setSelectedActor(e.target.value)}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
            >
              <option value="">Todos los usuarios</option>
              {actors.map(a => <option key={a} value={a}>{a}</option>)}
            </select>
          </div>

          <div style={{ minWidth: '140px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.3rem' }}>
              ID de Pedido:
            </label>
            <input
              type="text"
              placeholder="ej. 102"
              value={orderIdFilter}
              onChange={e => setOrderIdFilter(e.target.value)}
              onKeyDown={e => { if (e.key === 'Enter') loadEvents(); }}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
            />
          </div>

          <div style={{ minWidth: '100px' }}>
            <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: 'bold', color: '#4b5563', marginBottom: '0.3rem' }}>
              Límite:
            </label>
            <select
              value={limit}
              onChange={e => setLimit(Number(e.target.value))}
              style={{ width: '100%', padding: '0.45rem', borderRadius: '6px', border: '1px solid #d1d5db', fontSize: '0.85rem' }}
            >
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value={200}>200</option>
            </select>
          </div>

          <div style={{ alignSelf: 'flex-end', marginBottom: '2px' }}>
            <button onClick={loadEvents} className="btn primary" style={{ padding: '0.45rem 1rem', fontSize: '0.85rem' }}>
              Filtrar
            </button>
          </div>

        </div>

        {/* Tabla de Eventos */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '4rem', color: '#6b7280' }}>
            Cargando timeline de auditoría desde Kafka...
          </div>
        ) : events.length > 0 ? (
          <div style={{ overflowX: 'auto', borderRadius: '8px', boxShadow: '0 1px 3px rgba(0,0,0,0.1)', border: '1px solid #e5e7eb', backgroundColor: '#fff' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ backgroundColor: '#f8fafc', borderBottom: '2px solid #e2e8f0', textAlign: 'left', color: '#475569', fontSize: '0.82rem' }}>
                  <th style={{ padding: '0.85rem' }}>ID</th>
                  <th style={{ padding: '0.85rem' }}>Fecha y Hora</th>
                  <th style={{ padding: '0.85rem' }}>Tipo de Evento</th>
                  <th style={{ padding: '0.85rem' }}>Pedido</th>
                  <th style={{ padding: '0.85rem' }}>Actor (Usuario / IP)</th>
                  <th style={{ padding: '0.85rem' }}>Transición de Estado</th>
                  <th style={{ padding: '0.85rem' }}>Resumen</th>
                  <th style={{ padding: '0.85rem', textAlign: 'center' }}>Detalle</th>
                </tr>
              </thead>
              <tbody>
                {events.map(ev => (
                  <tr key={ev.id} style={{ borderBottom: '1px solid #f1f5f9' }}>
                    <td style={{ padding: '0.85rem', color: '#64748b', fontSize: '0.8rem', fontFamily: 'monospace' }}>
                      #{ev.id}
                    </td>
                    <td style={{ padding: '0.85rem', color: '#334155', fontSize: '0.85rem', whiteSpace: 'nowrap' }}>
                      {ev.occurredAt ? new Date(ev.occurredAt).toLocaleString() : 'N/A'}
                    </td>
                    <td style={{ padding: '0.85rem' }}>
                      {getEventTypeBadge(ev.eventType)}
                    </td>
                    <td style={{ padding: '0.85rem', fontWeight: 'bold', color: '#0f172a' }}>
                      #{ev.entityId}
                    </td>
                    <td style={{ padding: '0.85rem' }}>
                      <div style={{ fontWeight: '600', color: '#1e293b', fontSize: '0.85rem' }}>{ev.actor || 'sistema'}</div>
                      {ev.origin && <div style={{ fontSize: '0.75rem', color: '#64748b' }}>IP: {ev.origin}</div>}
                    </td>
                    <td style={{ padding: '0.85rem', fontSize: '0.85rem' }}>
                      {ev.previousStatus && ev.newStatus ? (
                        <span>
                          <span style={{ color: '#64748b' }}>{ev.previousStatus}</span>
                          <span style={{ margin: '0 0.3rem', color: '#94a3b8' }}>&rarr;</span>
                          <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{ev.newStatus}</span>
                        </span>
                      ) : ev.newStatus ? (
                        <span style={{ fontWeight: 'bold', color: '#0f172a' }}>{ev.newStatus}</span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>-</span>
                      )}
                    </td>
                    <td style={{ padding: '0.85rem', color: '#475569', fontSize: '0.85rem', maxWidth: '280px' }}>
                      {ev.summary || '-'}
                    </td>
                    <td style={{ padding: '0.85rem', textAlign: 'center' }}>
                      <button
                        onClick={() => handleOpenDetail(ev.id)}
                        style={{ padding: '0.3rem 0.6rem', border: '1px solid #cbd5e1', borderRadius: '4px', background: '#f8fafc', cursor: 'pointer', fontSize: '0.75rem', fontWeight: '600', color: '#2563eb' }}
                        title="Ver mensaje recibido en Kafka"
                      >
                        Ver Kafka
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div style={{ textAlign: 'center', padding: '3rem', backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', color: '#64748b' }}>
            No se encontraron registros de auditoría con los criterios seleccionados.
          </div>
        )}

        {/* Modal Detalle Kafka */}
        {(selectedEventDetail || loadingDetail || detailError) && (
          <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 1000 }}>
            <div style={{ backgroundColor: '#fff', borderRadius: '8px', padding: '2rem', width: '90%', maxWidth: '750px', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', borderBottom: '1px solid #e2e8f0', paddingBottom: '0.75rem' }}>
                <h3 style={{ margin: 0, color: '#0f172a' }}>
                  Detalle del Evento Kafka #{selectedEventDetail?.event?.id}
                </h3>
                <button
                  onClick={() => { setSelectedEventDetail(null); setDetailError(''); }}
                  style={{ background: 'none', border: 'none', fontSize: '1.25rem', cursor: 'pointer', color: '#64748b' }}
                >
                  ✕
                </button>
              </div>

              {loadingDetail && <p style={{ color: '#64748b' }}>Cargando datos completos desde el repositorio de auditoría...</p>}

              {detailError && (
                <div style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '1rem', borderRadius: '6px' }}>
                  {detailError}
                </div>
              )}

              {selectedEventDetail && (
                <div>
                  {/* Metadatos Kafka */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '0.75rem', marginBottom: '1.5rem', backgroundColor: '#f8fafc', padding: '1rem', borderRadius: '6px', border: '1px solid #e2e8f0', fontSize: '0.85rem' }}>
                    <div>
                      <strong style={{ color: '#475569' }}>Tópico Kafka:</strong>
                      <div style={{ color: '#0f172a', fontWeight: 'bold' }}>{selectedEventDetail.kafkaTopic || 'orders.events'}</div>
                    </div>
                    <div>
                      <strong style={{ color: '#475569' }}>Partición / Offset:</strong>
                      <div style={{ color: '#0f172a', fontWeight: 'bold' }}>P{selectedEventDetail.kafkaPartition ?? 0} @ {selectedEventDetail.kafkaOffset ?? '-'}</div>
                    </div>
                    <div>
                      <strong style={{ color: '#475569' }}>Trace ID:</strong>
                      <div style={{ color: '#0f172a', fontFamily: 'monospace' }}>{selectedEventDetail.event?.traceId || 'N/A'}</div>
                    </div>
                    <div>
                      <strong style={{ color: '#475569' }}>Correlation ID:</strong>
                      <div style={{ color: '#0f172a', fontFamily: 'monospace' }}>{selectedEventDetail.event?.correlationId || 'N/A'}</div>
                    </div>
                  </div>

                  {/* Resumen del Evento */}
                  <div style={{ marginBottom: '1.25rem', fontSize: '0.9rem' }}>
                    <p style={{ margin: '0 0 0.5rem' }}><strong>Tipo de Evento:</strong> {getEventTypeBadge(selectedEventDetail.event?.eventType)}</p>
                    <p style={{ margin: '0 0 0.5rem' }}><strong>Actor:</strong> {selectedEventDetail.event?.actor} ({selectedEventDetail.event?.origin})</p>
                    <p style={{ margin: '0 0 0.5rem' }}><strong>Servicio Emisor:</strong> {selectedEventDetail.event?.sourceService || 'ms-pedidos360-orders'}</p>
                    <p style={{ margin: 0 }}><strong>Ocurrido el:</strong> {new Date(selectedEventDetail.event?.occurredAt).toLocaleString()}</p>
                  </div>

                  {/* Payload JSON de Kafka */}
                  <h4 style={{ margin: '1rem 0 0.5rem', color: '#1e293b' }}>Payload Recibido (JSON original de Kafka):</h4>
                  <pre style={{ backgroundColor: '#0f172a', color: '#38bdf8', padding: '1rem', borderRadius: '6px', overflowX: 'auto', fontSize: '0.82rem', maxHeight: '300px' }}>
                    {(() => {
                      try {
                        return JSON.stringify(JSON.parse(selectedEventDetail.payload), null, 2);
                      } catch {
                        return selectedEventDetail.payload || 'Sin payload';
                      }
                    })()}
                  </pre>

                  <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem' }}>
                    <button className="btn" onClick={() => setSelectedEventDetail(null)}>Cerrar</button>
                  </div>
                </div>
              )}

            </div>
          </div>
        )}
      </div>
    </Layout>
  );
}
