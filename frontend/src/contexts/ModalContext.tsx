import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
  useEffect,
  ReactNode,
} from 'react';
import { X } from 'lucide-react';

interface ModalConfig {
  title: string;
  content: ReactNode;
  size?: 'sm' | 'md' | 'lg';
  footer?: ReactNode;
  onClose?: () => void;
}

interface ModalContextValue {
  openModal: (config: ModalConfig) => void;
  closeModal: () => void;
  confirm: (opts: {
    message: string;
    title?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    danger?: boolean;
  }) => Promise<boolean>;
}

const ModalCtx = createContext<ModalContextValue | null>(null);

export function ModalProvider({ children }: { children: ReactNode }) {
  const [config, setConfig] = useState<ModalConfig | null>(null);
  const onCloseRef = useRef<(() => void) | null>(null);

  const closeModal = useCallback(() => {
    onCloseRef.current?.();
    onCloseRef.current = null;
    setConfig(null);
  }, []);

  const openModal = useCallback((cfg: ModalConfig) => {
    onCloseRef.current = cfg.onClose ?? null;
    setConfig(cfg);
  }, []);

  const confirm = useCallback(
    (opts: {
      message: string;
      title?: string;
      confirmLabel?: string;
      cancelLabel?: string;
      danger?: boolean;
    }): Promise<boolean> => {
      return new Promise((resolve) => {
        const dismiss = (result: boolean) => {
          onCloseRef.current = null;
          setConfig(null);
          resolve(result);
        };

        onCloseRef.current = () => resolve(false);
        setConfig({
          title: opts.title ?? 'Confirm',
          size: 'sm',
          content: (
            <p style={{ fontSize: 14, lineHeight: 1.7, color: 'var(--text-secondary)', margin: 0 }}>
              {opts.message}
            </p>
          ),
          footer: (
            <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
              <button className="btn btn-secondary" onClick={() => dismiss(false)}>
                {opts.cancelLabel ?? 'Cancel'}
              </button>
              <button
                className={`btn ${opts.danger ? 'btn-danger' : 'btn-primary'}`}
                onClick={() => dismiss(true)}
              >
                {opts.confirmLabel ?? 'Confirm'}
              </button>
            </div>
          ),
        });
      });
    },
    [],
  );

  return (
    <ModalCtx.Provider value={{ openModal, closeModal, confirm }}>
      {children}
      {config && <ModalOverlay config={config} onClose={closeModal} />}
    </ModalCtx.Provider>
  );
}

function ModalOverlay({ config, onClose }: { config: ModalConfig; onClose: () => void }) {
  const sizeClass =
    config.size === 'lg' ? 'modal-lg' : config.size === 'sm' ? 'modal-sm' : '';

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [onClose]);

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className={`modal ${sizeClass}`}>
        <div className="modal-header">
          <h2 className="modal-title">{config.title}</h2>
          <button className="modal-close" onClick={onClose} aria-label="Close modal">
            <X size={16} />
          </button>
        </div>
        <div className="modal-body">{config.content}</div>
        {config.footer && <div className="modal-footer">{config.footer}</div>}
      </div>
    </div>
  );
}

export function useModal() {
  const ctx = useContext(ModalCtx);
  if (!ctx) throw new Error('useModal must be inside ModalProvider');
  return ctx;
}
