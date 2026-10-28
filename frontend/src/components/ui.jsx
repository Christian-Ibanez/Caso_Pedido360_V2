import { STATUS_BADGE } from '../lib/format';
import { productImage, categoryTint } from '../lib/products';
import { CategoryIcon, IconCloudOff, IconRefresh, IconX } from './Icons';

export function StatusBadge({ status }) {
  const s = status || 'CREADO';
  return <span className={`badge st-${s}`}>{STATUS_BADGE[s] || s}</span>;
}

/** Foto del producto o, si no tiene, un recuadro con el color e ícono de su categoría. */
export function ProductThumb({ product, className = 'thumb', size = 22, dim = false }) {
  const src = productImage(product);
  const style = dim ? { opacity: 0.45 } : undefined;
  if (src) return <img className={className} src={src} alt="" loading="lazy" style={style} />;
  const tint = categoryTint(product?.category);
  return (
    <span className={`${className} thumb-fallback`} style={{ background: tint.bg, color: tint.fg, ...style }}>
      <CategoryIcon category={product?.category} size={size} />
    </span>
  );
}

export function Alert({ kind = 'error', children, onClose }) {
  if (!children) return null;
  return (
    <div className={`alert ${kind}`} role={kind === 'error' ? 'alert' : 'status'}>
      <span>{children}</span>
      {onClose && (
        <button type="button" className="alert-close" aria-label="Cerrar aviso" onClick={onClose}>
          <IconX size={14} />
        </button>
      )}
    </div>
  );
}

/**
 * Aviso de módulo no disponible (por ejemplo, reportería o auditoría sin Kafka).
 * Reemplaza al "Cargando..." infinito cuando el servicio no responde.
 */
export function ServiceUnavailable({ title, children, onRetry, retrying }) {
  return (
    <section className="unavailable" aria-live="polite">
      <div className="unavailable-icon"><IconCloudOff size={30} /></div>
      <h2>{title}</h2>
      <p>{children}</p>
      {onRetry && (
        <div className="actions">
          <button type="button" className="btn primary" onClick={onRetry} disabled={retrying}>
            <IconRefresh size={16} />
            {retrying ? 'Reintentando…' : 'Reintentar'}
          </button>
        </div>
      )}
    </section>
  );
}

export function PageHead({ eyebrow, title, subtitle, children }) {
  return (
    <div className="page-head">
      <div>
        {eyebrow && <p className="eyebrow small">{eyebrow}</p>}
        <h1>{title}</h1>
        {subtitle && <p>{subtitle}</p>}
      </div>
      {children && <div className="actions">{children}</div>}
    </div>
  );
}
