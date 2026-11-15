'use client';
import { createContext, ReactNode, useCallback, useContext, useEffect, useRef, useState } from 'react';
import Icon from './Icon';

type Tone = 'success' | 'error' | 'warning' | 'info';
interface Toast { id: number; tone: Tone; title: string; message?: string; ms: number }
interface ToastApi { success: (t: string, m?: string) => void; error: (t: string, m?: string) => void; warning: (t: string, m?: string) => void; info: (t: string, m?: string) => void }

const Ctx = createContext<ToastApi | null>(null);
export const useToast = () => {
    const c = useContext(Ctx);
    if (!c) throw new Error('useToast must be used inside <ToastProvider>');
    return c;
};

const ICON: Record<Tone, string> = { success: 'check', error: 'alert', warning: 'alert', info: 'info' };

function Item({ t, onClose }: { t: Toast; onClose: (id: number) => void }) {
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const start = () => { timer.current = setTimeout(() => onClose(t.id), t.ms); };
    const stop = () => { if (timer.current) clearTimeout(timer.current); };
    useEffect(() => { start(); return stop; }, []); // eslint-disable-line react-hooks/exhaustive-deps
    return (
        <div className={`sj-toast tone-${t.tone}`} role="status" onMouseEnter={stop} onMouseLeave={start}>
            <span className="sj-toast-ic"><Icon name={ICON[t.tone]} size={16} /></span>
            <div className="sj-toast-body">
                <b>{t.title}</b>
                {t.message && <p>{t.message}</p>}
            </div>
            <button className="sj-x" onClick={() => onClose(t.id)} aria-label="Đóng"><Icon name="x" size={14} /></button>
            <i className="sj-toast-bar" style={{ animationDuration: `${t.ms}ms` }} />
        </div>
    );
}

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<Toast[]>([]);
    const seq = useRef(0);
    const close = useCallback((id: number) => setItems((l) => l.filter((x) => x.id !== id)), []);
    const push = useCallback((tone: Tone, title: string, message?: string) => {
        const id = ++seq.current;
        setItems((l) => [...l.slice(-3), { id, tone, title, message, ms: tone === 'error' ? 7000 : 4200 }]);
    }, []);
    const api = useRef<ToastApi>({
        success: (t, m) => push('success', t, m), error: (t, m) => push('error', t, m),
        warning: (t, m) => push('warning', t, m), info: (t, m) => push('info', t, m),
    }).current;
    return (
        <Ctx.Provider value={api}>
            {children}
            <div className="sj-toasts" aria-live="polite">{items.map((t) => <Item key={t.id} t={t} onClose={close} />)}</div>
        </Ctx.Provider>
    );
}