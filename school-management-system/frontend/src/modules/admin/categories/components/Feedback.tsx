'use client';

import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import s from '../categories.module.css';
import Icon from './Icon';

type Tone = 'success' | 'error' | 'warning' | 'info';

export interface ToastOptions {
    title: string;
    message?: string;
    tone?: Tone;
    /** ms; 0 = không tự đóng */
    duration?: number;
    action?: { label: string; onClick: () => void | Promise<void> };
}

interface ToastItem extends ToastOptions {
    id: number;
    tone: Tone;
    duration: number;
}

export interface ConfirmOptions {
    title: string;
    message?: string;
    confirmLabel?: string;
    cancelLabel?: string;
    tone?: 'danger' | 'primary';
    /** Danh sách gạch đầu dòng hiển thị thêm (vd. mục bị bỏ qua). */
    details?: string[];
}

interface FeedbackApi {
    toast: (o: ToastOptions) => void;
    success: (title: string, message?: string, action?: ToastOptions['action']) => void;
    error: (title: string, message?: string) => void;
    warning: (title: string, message?: string) => void;
    info: (title: string, message?: string) => void;
    confirm: (o: ConfirmOptions) => Promise<boolean>;
}

const Ctx = createContext<FeedbackApi | null>(null);

export function useFeedback(): FeedbackApi {
    const v = useContext(Ctx);
    if (!v) throw new Error('useFeedback phải nằm trong <FeedbackProvider>');
    return v;
}

const TONE_ICON: Record<Tone, string> = { success: 'success', error: 'alert', warning: 'alert', info: 'info' };

function Toast({ item, onClose }: { item: ToastItem; onClose: () => void }) {
    const [paused, setPaused] = useState(false);
    const remaining = useRef(item.duration);
    const startedAt = useRef(0);

    useEffect(() => {
        if (item.duration === 0 || paused) return;
        startedAt.current = Date.now();
        const timer = setTimeout(onClose, remaining.current);
        return () => {
            clearTimeout(timer);
            remaining.current -= Date.now() - startedAt.current;
        };
    }, [paused, item.duration, onClose]);

    return (
        <div
            className={`${s.toast} ${s['toast_' + item.tone]}`}
            role={item.tone === 'error' ? 'alert' : 'status'}
            onMouseEnter={() => setPaused(true)}
            onMouseLeave={() => setPaused(false)}
        >
            <span className={s.toastIcon}><Icon name={TONE_ICON[item.tone]} size={18} /></span>
            <div className={s.toastBody}>
                <strong>{item.title}</strong>
                {item.message && <p>{item.message}</p>}
                {item.action && (
                    <button
                        className={s.toastAction}
                        onClick={async () => {
                            onClose();
                            await item.action?.onClick();
                        }}
                    >
                        {item.action.label}
                    </button>
                )}
            </div>
            <button className={s.toastClose} onClick={onClose} aria-label="Đóng thông báo"><Icon name="x" size={14} /></button>
            {item.duration > 0 && (
                <span
                    className={s.toastBar}
                    style={{ animationDuration: `${item.duration}ms`, animationPlayState: paused ? 'paused' : 'running' }}
                />
            )}
        </div>
    );
}

export function FeedbackProvider({ children }: { children: ReactNode }) {
    const [toasts, setToasts] = useState<ToastItem[]>([]);
    const [dialog, setDialog] = useState<(ConfirmOptions & { resolve: (v: boolean) => void }) | null>(null);
    const seq = useRef(0);

    const close = useCallback((id: number) => setToasts((t) => t.filter((x) => x.id !== id)), []);

    const toast = useCallback((o: ToastOptions) => {
        const tone = o.tone ?? 'info';
        const item: ToastItem = { ...o, tone, id: ++seq.current, duration: o.duration ?? (tone === 'error' ? 7000 : 4500) };
        setToasts((t) => [...t.slice(-3), item]);
    }, []);

    const confirm = useCallback(
        (o: ConfirmOptions) => new Promise<boolean>((resolve) => setDialog({ ...o, resolve })),
        []
    );

    const api = useMemo<FeedbackApi>(
        () => ({
            toast,
            success: (title, message, action) => toast({ title, message, tone: 'success', action }),
            error: (title, message) => toast({ title, message, tone: 'error' }),
            warning: (title, message) => toast({ title, message, tone: 'warning' }),
            info: (title, message) => toast({ title, message, tone: 'info' }),
            confirm,
        }),
        [toast, confirm]
    );

    const answer = (v: boolean) => {
        dialog?.resolve(v);
        setDialog(null);
    };

    useEffect(() => {
        if (!dialog) return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === 'Escape') answer(false);
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [dialog]);

    return (
        <Ctx.Provider value={api}>
            {children}

            <div className={s.toastStack} aria-live="polite">
                {toasts.map((t) => (
                    <Toast key={t.id} item={t} onClose={() => close(t.id)} />
                ))}
            </div>

            {dialog && (
                <div className={s.overlay} onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
                    <div className={s.dialog} role="alertdialog" aria-modal="true" aria-labelledby="confirm-title">
            <span className={`${s.dialogIcon} ${dialog.tone === 'danger' ? s.dialogIconDanger : ''}`}>
              <Icon name={dialog.tone === 'danger' ? 'trash' : 'info'} size={22} />
            </span>
                        <h3 id="confirm-title">{dialog.title}</h3>
                        {dialog.message && <p>{dialog.message}</p>}
                        {dialog.details && dialog.details.length > 0 && (
                            <ul className={s.dialogList}>{dialog.details.map((d, i) => <li key={i}>{d}</li>)}</ul>
                        )}
                        <div className={s.dialogActions}>
                            <button className={s.btnGhost} onClick={() => answer(false)}>{dialog.cancelLabel ?? 'Hủy'}</button>
                            <button
                                autoFocus
                                className={dialog.tone === 'danger' ? s.btnDanger : s.btnPrimary}
                                onClick={() => answer(true)}
                            >
                                {dialog.confirmLabel ?? 'Xác nhận'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </Ctx.Provider>
    );
}