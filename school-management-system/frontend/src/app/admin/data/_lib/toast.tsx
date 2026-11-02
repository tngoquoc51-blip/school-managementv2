'use client';

import { createContext, ReactNode, useCallback, useContext, useState } from 'react';
import { Icon } from '../_components/ui';

type Tone = 'success' | 'error' | 'warn' | 'info';
interface ToastItem { id: number; tone: Tone; title: string; text?: string; ms: number }
type Push = (t: { tone: Tone; title: string; text?: string; ms?: number }) => void;

const Ctx = createContext<Push>(() => {});

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);

    const close = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
    const push: Push = useCallback((t) => {
        const id = Date.now() + Math.random();
        const ms = t.ms ?? (t.tone === 'error' ? 7000 : 4500);
        setItems((l) => [...l.slice(-3), { id, tone: t.tone, title: t.title, text: t.text, ms }]);
        setTimeout(() => close(id), ms);
    }, [close]);

    return (
        <Ctx.Provider value={push}>
            {children}
            <div className="dh-toasts" aria-live="polite">
                {items.map((t) => (
                    <div key={t.id} className={`dh-toast ${t.tone}`} role="status">
                        <span className="dh-toast-ic"><Icon n={t.tone === 'success' ? 'check' : t.tone === 'info' ? 'info' : 'alert'} s={18} /></span>
                        <div className="dh-toast-b">
                            <b>{t.title}</b>
                            {t.text && <p>{t.text}</p>}
                        </div>
                        <button onClick={() => close(t.id)} aria-label="Đóng"><Icon n="x" s={15} /></button>
                        <i className="dh-toast-bar" style={{ animationDuration: `${t.ms}ms` }} />
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}

export const useToast = () => useContext(Ctx);