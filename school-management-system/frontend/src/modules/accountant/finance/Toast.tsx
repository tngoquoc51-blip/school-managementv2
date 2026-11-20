'use client';

import { createContext, ReactNode, useCallback, useContext, useMemo, useState } from 'react';

type Kind = 'success' | 'error' | 'warn' | 'info';
interface T { id: number; kind: Kind; title: string; text?: string }
interface Api { success: (t: string, d?: string) => void; error: (t: string, d?: string) => void; warn: (t: string, d?: string) => void; info: (t: string, d?: string) => void }

const Ctx = createContext<Api | null>(null);
const ICON: Record<Kind, string> = { success: '✓', error: '!', warn: '⚠', info: 'i' };

export function ToastProvider({ children }: { children: ReactNode }) {
    const [list, setList] = useState<T[]>([]);
    const remove = useCallback((id: number) => setList((l) => l.filter((x) => x.id !== id)), []);
    const push = useCallback((kind: Kind, title: string, text?: string) => {
        const id = Date.now() + Math.random();
        setList((l) => [...l.slice(-3), { id, kind, title, text }]);
        setTimeout(() => remove(id), kind === 'error' ? 7000 : 4500);
    }, [remove]);

    const api = useMemo<Api>(() => ({
        success: (t, d) => push('success', t, d), error: (t, d) => push('error', t, d),
        warn: (t, d) => push('warn', t, d), info: (t, d) => push('info', t, d),
    }), [push]);

    return (
        <Ctx.Provider value={api}>
            {children}
            <div className="fx-toasts" role="status" aria-live="polite">
                {list.map((t) => (
                    <div key={t.id} className={`fx-toast ${t.kind}`} style={{ ['--d' as string]: t.kind === 'error' ? '7s' : '4.5s' }}>
                        <i>{ICON[t.kind]}</i>
                        <div><b>{t.title}</b>{t.text && <span>{t.text}</span>}</div>
                        <button onClick={() => remove(t.id)} aria-label="Đóng">×</button>
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}

export function useToast(): Api {
    const c = useContext(Ctx);
    if (!c) throw new Error('useToast phải nằm trong ToastProvider');
    return c;
}