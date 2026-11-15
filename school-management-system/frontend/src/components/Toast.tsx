'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';
import s from './toast.module.css';

type Kind = 'success' | 'error' | 'warn' | 'info';
interface Item { id: number; kind: Kind; title: string; message?: string; leaving?: boolean }
interface Api { success: (t: string, m?: string) => void; error: (t: string, m?: string) => void; warn: (t: string, m?: string) => void; info: (t: string, m?: string) => void }

const Ctx = createContext<Api | null>(null);
const ICON: Record<Kind, string> = { success: '✓', error: '!', warn: '⚠', info: 'i' };
const DURATION = 4500;
let seq = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<Item[]>([]);

    const dismiss = useCallback((id: number) => {
        setItems((l) => l.map((i) => (i.id === id ? { ...i, leaving: true } : i)));
        setTimeout(() => setItems((l) => l.filter((i) => i.id !== id)), 200);
    }, []);

    const push = useCallback((kind: Kind, title: string, message?: string) => {
        const id = ++seq;
        setItems((l) => [...l.slice(-3), { id, kind, title, message }]);
        setTimeout(() => dismiss(id), kind === 'error' ? DURATION + 2000 : DURATION);
    }, [dismiss]);

    const api = useMemo<Api>(() => ({
        success: (t, m) => push('success', t, m), error: (t, m) => push('error', t, m),
        warn: (t, m) => push('warn', t, m), info: (t, m) => push('info', t, m),
    }), [push]);

    return (
        <Ctx.Provider value={api}>
            {children}
            <div className={s.stack} aria-live="polite" role="status">
                {items.map((i) => (
                    <div key={i.id} className={`${s.toast} ${s[i.kind]} ${i.leaving ? s.out : ''}`}>
                        <div className={s.ico}>{ICON[i.kind]}</div>
                        <div className={s.body}><div className={s.title}>{i.title}</div>{i.message && <div className={s.msg}>{i.message}</div>}</div>
                        <button className={s.close} onClick={() => dismiss(i.id)} aria-label="Đóng">×</button>
                        <div className={s.bar} style={{ animationDuration: `${DURATION}ms` }} />
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