'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import s from './homework.module.css';

type Kind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: Kind; title: string; text?: string }
interface Ctx { push: (kind: Kind, title: string, text?: string) => void }

const ToastCtx = createContext<Ctx>({ push: () => {} });
export const useToast = () => useContext(ToastCtx);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const seq = useRef(0);
    const close = useCallback((id: number) => setItems((a) => a.filter((x) => x.id !== id)), []);
    const push = useCallback((kind: Kind, title: string, text?: string) => {
        const id = ++seq.current;
        setItems((a) => [...a.slice(-3), { id, kind, title, text }]);
        setTimeout(() => close(id), kind === 'error' ? 7000 : 4200);
    }, [close]);
    const value = useMemo(() => ({ push }), [push]);

    return (
        <ToastCtx.Provider value={value}>
            {children}
            <div className={s.toasts} role="region" aria-label="Thông báo" aria-live="polite">
                {items.map((t) => (
                    <div key={t.id} className={`${s.toast} ${s['toast_' + t.kind]}`} role={t.kind === 'error' ? 'alert' : 'status'}>
                        <div>
                            <strong>{t.title}</strong>
                            {t.text && <p>{t.text}</p>}
                        </div>
                        <button type="button" aria-label="Đóng thông báo" onClick={() => close(t.id)}>×</button>
                    </div>
                ))}
            </div>
        </ToastCtx.Provider>
    );
}