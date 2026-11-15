'use client';

import { ReactNode, createContext, useCallback, useContext, useEffect, useState } from 'react';
import Icon from './icons';

function useEsc(open: boolean, onClose: () => void) {
    useEffect(() => {
        if (!open) return;
        const h = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [open, onClose]);
}

interface PanelProps {
    open: boolean; onClose: () => void; title: ReactNode; subtitle?: ReactNode;
    children: ReactNode; footer?: ReactNode; width?: number;
}

export function Modal({ open, onClose, title, subtitle, children, footer, width }: PanelProps) {
    useEsc(open, onClose);
    if (!open) return null;
    return (
        <div className="emu-scrim" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <div className="emu-modal" style={width ? { width: `min(${width}px, 100%)` } : undefined} role="dialog" aria-modal="true">
                <div className="emu-mh">
                    <div style={{ flex: 1, minWidth: 0 }}><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
                    <button className="emu-btn ghost icon sm" onClick={onClose} aria-label="Đóng"><Icon name="x" /></button>
                </div>
                <div className="emu-mb">{children}</div>
                {footer && <div className="emu-mf">{footer}</div>}
            </div>
        </div>
    );
}

export function Drawer({ open, onClose, title, subtitle, children, footer, width }: PanelProps) {
    useEsc(open, onClose);
    if (!open) return null;
    return (
        <div className="emu-scrim right" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
            <aside className="emu-drawer" style={width ? { width: `min(${width}px, 100%)` } : undefined} role="dialog" aria-modal="true">
                <div className="emu-mh">
                    <div style={{ flex: 1, minWidth: 0 }}><h3>{title}</h3>{subtitle && <p>{subtitle}</p>}</div>
                    <button className="emu-btn ghost icon sm" onClick={onClose} aria-label="Đóng"><Icon name="x" /></button>
                </div>
                <div className="emu-mb">{children}</div>
                {footer && <div className="emu-mf">{footer}</div>}
            </aside>
        </div>
    );
}

/* ---------- Hộp thoại xác nhận dạng Promise ---------- */
interface ConfirmOpts { title: string; message?: string; confirmText?: string; tone?: 'danger' | 'primary' }
type ConfirmFn = (o: ConfirmOpts) => Promise<boolean>;
const ConfirmCtx = createContext<ConfirmFn>(async () => false);
export const useConfirm = () => useContext(ConfirmCtx);

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [st, setSt] = useState<{ o: ConfirmOpts; done: (v: boolean) => void } | null>(null);
    const confirm = useCallback<ConfirmFn>((o) => new Promise<boolean>((done) => setSt({ o, done })), []);
    const close = (v: boolean) => { st?.done(v); setSt(null); };

    return (
        <ConfirmCtx.Provider value={confirm}>
            {children}
            <Modal
                open={!!st} onClose={() => close(false)} width={440} title={st?.o.title}
                footer={<>
                    <button className="emu-btn" onClick={() => close(false)}>Để sau</button>
                    <button className={`emu-btn ${st?.o.tone === 'danger' ? 'danger solid' : 'primary'}`} onClick={() => close(true)}>
                        {st?.o.confirmText ?? 'Đồng ý'}
                    </button>
                </>}
            >
                <p style={{ margin: 0, color: 'var(--ink-2)' }}>{st?.o.message}</p>
            </Modal>
        </ConfirmCtx.Provider>
    );
}