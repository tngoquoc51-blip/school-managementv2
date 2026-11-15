
'use client';
import { createContext, ReactNode, useCallback, useContext, useRef, useState } from 'react';
import Icon from './Icon';

export interface ConfirmOpts { title: string; message?: ReactNode; confirmText?: string; cancelText?: string; tone?: 'danger' | 'warning' | 'primary'; typeToConfirm?: string }
type Fn = (o: ConfirmOpts) => Promise<boolean>;
const Ctx = createContext<Fn | null>(null);
export const useConfirm = () => {
    const c = useContext(Ctx);
    if (!c) throw new Error('useConfirm must be used inside <ConfirmProvider>');
    return c;
};

export function ConfirmProvider({ children }: { children: ReactNode }) {
    const [o, setO] = useState<ConfirmOpts | null>(null);
    const [typed, setTyped] = useState('');
    const res = useRef<((v: boolean) => void) | null>(null);
    const ask = useCallback<Fn>((opts) => new Promise((r) => { res.current = r; setTyped(''); setO(opts); }), []);
    const done = (v: boolean) => { res.current?.(v); res.current = null; setO(null); };
    const tone = o?.tone ?? 'primary';
    const blocked = !!o?.typeToConfirm && typed.trim() !== o.typeToConfirm;
    return (
        <Ctx.Provider value={ask}>
            {children}
            {o && (
                <div className="sj-overlay" onMouseDown={(e) => e.target === e.currentTarget && done(false)}>
                    <div className="sj-confirm" role="alertdialog" aria-modal="true">
                        <div className={`sj-confirm-ic tone-${tone}`}><Icon name={tone === 'primary' ? 'info' : 'alert'} size={22} /></div>
                        <h3>{o.title}</h3>
                        {o.message && <div className="sj-confirm-msg">{o.message}</div>}
                        {o.typeToConfirm && (
                            <label className="sj-field">
                                <span>Gõ <b>{o.typeToConfirm}</b> để xác nhận</span>
                                <input autoFocus value={typed} onChange={(e) => setTyped(e.target.value)} />
                            </label>
                        )}
                        <div className="sj-confirm-act">
                            <button className="sj-btn ghost" onClick={() => done(false)}>{o.cancelText ?? 'Hủy'}</button>
                            <button className={`sj-btn ${tone === 'danger' ? 'danger' : tone === 'warning' ? 'warn' : 'primary'}`} disabled={blocked} onClick={() => done(true)} autoFocus={!o.typeToConfirm}>
                                {o.confirmText ?? 'Xác nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Ctx.Provider>
    );
}