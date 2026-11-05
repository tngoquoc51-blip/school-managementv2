'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import { Icon } from './Icons';

type Kind = 'success' | 'error' | 'warning' | 'info';
interface ToastItem { id: number; kind: Kind; title: string; text?: string; ms: number }
interface Api { push: (kind: Kind, title: string, text?: string) => void }

const Ctx = createContext<Api | null>(null);
const ICON: Record<Kind, string> = { success: 'check', error: 'x', warning: 'alert', info: 'info' };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);
  const push = useCallback((kind: Kind, title: string, text?: string) => {
    const id = Date.now() + Math.random();
    const ms = kind === 'error' ? 6000 : 3800;
    setItems((l) => [...l.slice(-3), { id, kind, title, text, ms }]);
    setTimeout(() => dismiss(id), ms);
  }, [dismiss]);

  const api = useMemo(() => ({ push }), [push]);

  return (
    <Ctx.Provider value={api}>
      {children}
      <div className="a-toasts" role="status" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`a-toast ${t.kind}`} onClick={() => dismiss(t.id)}>
            <div className="ti"><Icon name={ICON[t.kind]} size={17} /></div>
            <div><b>{t.title}</b>{t.text && <span>{t.text}</span>}</div>
            <div className="life" style={{ ['--d' as any]: `${t.ms}ms` }} />
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useToast phải nằm trong <ToastProvider>');
  return {
    success: (t: string, d?: string) => c.push('success', t, d),
    error: (t: string, d?: string) => c.push('error', t, d),
    warning: (t: string, d?: string) => c.push('warning', t, d),
    info: (t: string, d?: string) => c.push('info', t, d),
  };
}
