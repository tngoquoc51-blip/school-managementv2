'use client';

import { ReactNode, createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Icon, { IconName } from './icons';

type Kind = 'success' | 'error' | 'info' | 'warning';
interface ToastInput {
    title: string; message?: string; kind?: Kind; duration?: number;
    action?: { label: string; onClick: () => void };
}
interface ToastItem extends ToastInput { id: number; kind: Kind; leaving?: boolean }
interface ToastApi {
    show: (t: ToastInput) => void;
    success: (title: string, message?: string) => void;
    error: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
}

const STYLE: Record<Kind, { icon: IconName; bg: string; fg: string }> = {
    success: { icon: 'check', bg: 'var(--ok-soft)', fg: 'var(--ok)' },
    error: { icon: 'alert', bg: 'var(--danger-soft)', fg: 'var(--danger)' },
    info: { icon: 'info', bg: 'var(--info-soft)', fg: 'var(--info)' },
    warning: { icon: 'alert', bg: 'var(--gold-soft)', fg: 'var(--gold)' },
};

const Ctx = createContext<ToastApi | null>(null);

export function useToast(): ToastApi {
    const c = useContext(Ctx);
    if (!c) throw new Error('useToast phải nằm trong <ToastProvider>');
    return c;
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const seq = useRef(0);

    const dismiss = useCallback((id: number) => {
        setItems((l) => l.map((t) => (t.id === id ? { ...t, leaving: true } : t)));
        setTimeout(() => setItems((l) => l.filter((t) => t.id !== id)), 250);
    }, []);

    const show = useCallback((t: ToastInput) => {
        const id = ++seq.current;
        const kind = t.kind ?? 'info';
        const duration = t.duration ?? (t.action ? 7000 : kind === 'error' ? 6000 : 4200);
        setItems((l) => [...l.slice(-3), { ...t, id, kind, duration }]);
        setTimeout(() => dismiss(id), duration);
    }, [dismiss]);

    const api = useMemo<ToastApi>(() => ({
        show,
        success: (title, message) => show({ title, message, kind: 'success' }),
        error: (title, message) => show({ title, message, kind: 'error' }),
        info: (title, message) => show({ title, message, kind: 'info' }),
        warning: (title, message) => show({ title, message, kind: 'warning' }),
    }), [show]);

    return (
        <Ctx.Provider value={api}>
            {children}
            <div className="emu-toasts" role="status" aria-live="polite">
                {items.map((t) => {
                    const s = STYLE[t.kind];
                    return (
                        <div key={t.id} className={`emu-toast${t.leaving ? ' out' : ''}`}>
                            <div className="emu-toast-ic" style={{ background: s.bg, color: s.fg }}><Icon name={s.icon} size={17} /></div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                                <b>{t.title}</b>
                                {t.message && <span>{t.message}</span>}
                                {t.action && (
                                    <button className="emu-toast-act" onClick={() => { t.action!.onClick(); dismiss(t.id); }}>
                                        {t.action.label}
                                    </button>
                                )}
                            </div>
                            <button className="emu-btn ghost icon sm" onClick={() => dismiss(t.id)} aria-label="Đóng"><Icon name="x" size={14} /></button>
                            <div className="emu-toast-bar" style={{ background: s.fg, animationDuration: `${t.duration}ms` }} />
                        </div>
                    );
                })}
            </div>
        </Ctx.Provider>
    );
}