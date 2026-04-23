import { useState } from 'react';
import { CheckCircle, XCircle, AlertTriangle, Info, X } from 'lucide-react';
import { useToastStore, ToastItem } from '../../store/toastStore';

const ICONS = {
  success: CheckCircle,
  error: XCircle,
  warning: AlertTriangle,
  info: Info,
};

function ToastEl({ toast }: { toast: ToastItem }) {
  const remove = useToastStore((s) => s.remove);
  const [exiting, setExiting] = useState(false);

  function dismiss() {
    setExiting(true);
    setTimeout(() => remove(toast.id), 300);
  }

  const Icon = ICONS[toast.type];

  return (
    <div className={`toast toast-${toast.type}${exiting ? ' toast-fade-out' : ''}`} role="alert">
      <Icon className="toast-icon" size={18} />
      <div className="toast-body">
        {toast.title && <div className="toast-title">{toast.title}</div>}
        <div className="toast-message">{toast.message}</div>
      </div>
      <button className="toast-close" onClick={dismiss} aria-label="Dismiss">
        <X size={14} />
      </button>
    </div>
  );
}

export function ToastContainer() {
  const toasts = useToastStore((s) => s.toasts);
  return (
    <div className="toast-container" aria-live="polite">
      {toasts.map((t) => (
        <ToastEl key={t.id} toast={t} />
      ))}
    </div>
  );
}
