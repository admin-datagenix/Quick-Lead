import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AlertCircle, CheckCircle2, Info, WifiOff, X } from 'lucide-react';
import { fmt } from '../lib/format';
import { toApiError } from '../lib/api';

/* ------------------------------------------------------------------ Button */
export function Button({ variant = 'primary', size, block, loading, icon: Icon, children, className = '', ...rest }) {
  const cls = ['btn', `btn-${variant}`, size && `btn-${size}`, block && 'btn-block', className].filter(Boolean).join(' ');
  return (
    <button className={cls} disabled={loading || rest.disabled} {...rest}>
      {loading ? <span className="spin" aria-hidden="true" /> : Icon ? <Icon size={size === 'sm' ? 15 : 17} aria-hidden="true" /> : null}
      {children}
    </button>
  );
}

export function ToolButton({ icon: Icon, label, tone, onClick, disabled }) {
  return (
    <button type="button" className={`tool-btn ${tone || ''}`} onClick={onClick} disabled={disabled} aria-label={label} title={label}>
      <Icon size={17} aria-hidden="true" />
    </button>
  );
}

/* ------------------------------------------------------------------ Avatar */
const PALETTE = [
  ['#E0F2FE', '#0369A1'], ['#EDE9FE', '#6D28D9'], ['#CCFBF1', '#0F766E'], ['#FEF3C7', '#92400E'], ['#E0E7FF', '#4338CA'],
];
export function Avatar({ name, size = 38 }) {
  let h = 0;
  for (const c of name || '') h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const [bg, fg] = PALETTE[h % PALETTE.length];
  return (
    <span className="avatar" style={{ width: size, height: size, background: bg, color: fg, fontSize: size * 0.36 }} aria-hidden="true">
      {fmt.initials(name)}
    </span>
  );
}

/* ------------------------------------------------------------------ Badge */
export function Badge({ cls = 'b-sky', dot, children }) {
  return <span className={`badge ${cls}`}>{dot && <span className="bd" />}{children}</span>;
}

/* ------------------------------------------------------------------ States */
export function Loader() {
  return <div className="loader" role="status" aria-label="Loading"><span className="spin" /></div>;
}

export function EmptyState({ icon: Icon, title, message, action }) {
  return (
    <div className="empty">
      {Icon && <div className="ic"><Icon size={28} aria-hidden="true" /></div>}
      <h3>{title}</h3>
      {message && <p>{message}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ error, onRetry }) {
  const e = toApiError(error);
  return (
    <EmptyState
      icon={e.network ? WifiOff : AlertCircle}
      title={e.network ? 'You are offline' : 'Could not load'}
      message={e.message}
      action={onRetry && <Button variant="secondary" onClick={onRetry}>Try again</Button>}
    />
  );
}

/** Renders a react-query result with consistent loading / error states. */
export function QueryView({ query, children, loading }) {
  if (query.isLoading) return loading ?? <Loader />;
  if (query.isError && !query.data) return <ErrorState error={query.error} onRetry={() => query.refetch()} />;
  if (query.data === null || query.data === undefined) {
    return <EmptyState icon={AlertCircle} title="Nothing to show" message="This item may have been removed." action={<Button variant="secondary" onClick={() => query.refetch()}>Reload</Button>} />;
  }
  return children(query.data);
}

/* ------------------------------------------------------------------ Form controls */
export function Field({ label, required, error, help, htmlFor, children }) {
  return (
    <div className="field">
      {label && <label htmlFor={htmlFor}>{label}{required && <span className="req"> *</span>}</label>}
      {children}
      {error ? <span className="error-text">{error}</span> : help ? <span className="help-text">{help}</span> : null}
    </div>
  );
}

export function Switch({ checked, onChange, label, id }) {
  return (
    <span className="switch">
      <input id={id} type="checkbox" role="switch" checked={checked} onChange={(e) => onChange(e.target.checked)} aria-label={label} />
      <span />
    </span>
  );
}

/* ------------------------------------------------------------------ Overlays */
function useEscape(onClose) {
  useEffect(() => {
    const h = (e) => e.key === 'Escape' && onClose?.();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);
}

export function Modal({ title, subtitle, onClose, children, footer, wide }) {
  useEscape(onClose);
  return createPortal(
    <div className="overlay" onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <div className={`modal ${wide ? 'wide' : ''}`} role="dialog" aria-modal="true" aria-label={title}>
        <div className="modal-head">
          <div className="t"><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-foot">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

export function Drawer({ title, onClose, children, actions }) {
  useEscape(onClose);
  return createPortal(
    <>
      <div className="drawer-overlay" onClick={onClose} />
      <aside className="drawer" role="dialog" aria-modal="true" aria-label={title}>
        <div className="drawer-head">
          <h2>{title}</h2>
          {actions}
          <button className="icon-btn" onClick={onClose} aria-label="Close"><X size={18} /></button>
        </div>
        <div className="drawer-body">{children}</div>
      </aside>
    </>,
    document.body,
  );
}

/* ------------------------------------------------------------------ Toasts + confirm */
const UiContext = createContext(null);

export function UiProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const [dialog, setDialog] = useState(null);
  const idRef = useRef(0);

  const toast = useCallback((message, type = 'success') => {
    const id = ++idRef.current;
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3600);
  }, []);

  const ui = {
    success: (m) => toast(m, 'success'),
    info: (m) => toast(m, 'info'),
    error: (e) => toast(toApiError(e).message, 'error'),
    confirm: (opts) => new Promise((resolve) => setDialog({ ...opts, resolve })),
  };

  const close = (v) => { dialog?.resolve(v); setDialog(null); };

  return (
    <UiContext.Provider value={ui}>
      {children}
      <div className="toasts" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.type === 'error' ? <AlertCircle size={18} color="#FCA5A5" /> : t.type === 'info' ? <Info size={18} color="#7DD3FC" /> : <CheckCircle2 size={18} color="#86EFAC" />}
            <span>{t.message}</span>
          </div>
        ))}
      </div>
      {dialog && (
        <Modal
          title={dialog.title}
          onClose={() => close(false)}
          footer={
            <>
              <Button variant="secondary" onClick={() => close(false)}>Cancel</Button>
              <Button variant={dialog.destructive ? 'danger' : 'primary'} onClick={() => close(true)}>{dialog.confirmLabel || 'Confirm'}</Button>
            </>
          }
        >
          <p className="muted">{dialog.message}</p>
        </Modal>
      )}
    </UiContext.Provider>
  );
}

export const useUi = () => useContext(UiContext);
