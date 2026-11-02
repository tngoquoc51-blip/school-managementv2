'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon from './Icon';

type Kind = 'success' | 'error' | 'info' | 'warning';
interface ToastItem { id: number; kind: Kind; title: string; message?: string; duration: number; action?: { label: string; run: () => void } }
interface Opts { action?: { label: string; run: () => void }; duration?: number }
interface Api {
    success: (t: string, m?: string, o?: Opts) => void;
    error: (t: string, m?: string, o?: Opts) => void;
    info: (t: string, m?: string, o?: Opts) => void;
    warning: (t: string, m?: string, o?: Opts) => void;
}

const Ctx = createContext<Api | null>(null);
const ICON: Record<Kind, string> = { success: 'check', error: 'alert', info: 'info', warning: 'alert' };

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const seq = useRef(0);
    const dismiss = useCallback((id: number) => setItems((l) => l.filter((t) => t.id !== id)), []);

    const push = useCallback((kind: Kind, title: string, message?: string, o?: Opts) => {
        const id = ++seq.current;
        const duration = o?.duration ?? (kind === 'error' ? 7000 : o?.action ? 9000 : 4200);
        setItems((l) => [...l.slice(-3), { id, kind, title, message, duration, action: o?.action }]);
        window.setTimeout(() => dismiss(id), duration);
    }, [dismiss]);

    const api = useMemo<Api>(() => ({
        success: (t, m, o) => push('success', t, m, o), error: (t, m, o) => push('error', t, m, o),
        info: (t, m, o) => push('info', t, m, o), warning: (t, m, o) => push('warning', t, m, o),
    }), [push]);

    return (
        <Ctx.Provider value={api}>
            {children}
            <div className="lg-toasts" role="region" aria-label="Thông báo hệ thống" aria-live="polite">
                {items.map((t) => (
                    <div key={t.id} className={`lg-toast lg-toast--${t.kind}`} role={t.kind === 'error' ? 'alert' : 'status'}>
                        <span className="lg-toast__icon"><Icon name={ICON[t.kind]} size={18} /></span>
                        <div className="lg-toast__body">
                            <strong>{t.title}</strong>
                            {t.message && <p>{t.message}</p>}
                            {t.action && <button type="button" className="lg-toast__action" onClick={() => { t.action?.run(); dismiss(t.id); }}>{t.action.label}</button>}
                        </div>
                        <button type="button" className="lg-toast__close" onClick={() => dismiss(t.id)} aria-label="Đóng thông báo"><Icon name="x" size={16} /></button>
                        <span className="lg-toast__bar" style={{ animationDuration: `${t.duration}ms` }} />
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}

export function useToast(): Api {
    const c = useContext(Ctx);
    if (!c) throw new Error('useToast phải nằm trong <ToastProvider>');
    return c;
}