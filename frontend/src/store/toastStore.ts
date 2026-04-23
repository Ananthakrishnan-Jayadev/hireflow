import { create } from 'zustand';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  title?: string;
  duration: number;
}

interface ToastStore {
  toasts: ToastItem[];
  add: (message: string, type: ToastType, opts?: { title?: string; duration?: number }) => void;
  remove: (id: string) => void;
}

export const useToastStore = create<ToastStore>((set) => ({
  toasts: [],
  add(message, type, opts = {}) {
    const id = Math.random().toString(36).slice(2);
    const duration = opts.duration ?? 4000;
    set((s) => ({ toasts: [...s.toasts, { id, message, type, title: opts.title, duration }] }));
    if (duration > 0) {
      setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), duration);
    }
  },
  remove(id) {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },
}));

export const toast = {
  success: (msg: string, opts?: { title?: string }) =>
    useToastStore.getState().add(msg, 'success', opts),
  error: (msg: string, opts?: { title?: string }) =>
    useToastStore.getState().add(msg, 'error', opts),
  info: (msg: string, opts?: { title?: string }) =>
    useToastStore.getState().add(msg, 'info', opts),
  warning: (msg: string, opts?: { title?: string }) =>
    useToastStore.getState().add(msg, 'warning', opts),
};
