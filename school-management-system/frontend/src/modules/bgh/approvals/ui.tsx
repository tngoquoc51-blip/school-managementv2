'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import s from './approvals.module.css';

/* ---------- Biểu tượng nét mảnh ---------- */
const P: Record<string, ReactNode> = {
    doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    coin: <><circle cx="12" cy="12" r="9" /><path d="M14.5 9a2.5 2 0 0 0-2.5-1.5c-1.4 0-2.5.8-2.5 2s1 1.7 2.5 2 2.5.8 2.5 2-1.1 2-2.5 2A2.7 2 0 0 1 9.5 15M12 6v1.5M12 16.5V18" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>,
    users: <><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" /></>,
    swap: <path d="M7 7h13l-3-3M17 17H4l3 3" />,
    bell: <><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7" /><path d="M10 20a2 2 0 0 0 4 0" /></>,
    check: <path d="M20 6 9 17l-5-5" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
    forward: <path d="M5 12h14M13 6l6 6-6 6" />,
    search: <><circle cx="11" cy="11" r="7" /><path d="m21 21-4.3-4.3" /></>,
    refresh: <><path d="M21 12a9 9 0 0 1-15.5 6.2M3 12a9 9 0 0 1 15.5-6.2" /><path d="M21 4v5h-5M3 20v-5h5" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4" /><path d="M4 21h16" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    inbox: <><path d="M22 12h-6l-2 3h-4l-2-3H2" /><path d="M5.5 5h13L22 12v6a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2v-6z" /></>,
    chart: <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />,
    sliders: <><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></>,
    shield: <><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="m9 12 2 2 4-4" /></>,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
    chat: <path d="M21 12a8 8 0 0 1-11.5 7.2L4 20l1.1-4.2A8 8 0 1 1 21 12z" />,
};
export type IconName = keyof typeof P;
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {P[name] ?? P.doc}
        </svg>
    );
}

export const TYPE_ICON: Record<string, string> = { calendar: 'calendar', coin: 'coin', clock: 'clock', edit: 'edit', book: 'book', user: 'user', swap: 'swap', bell: 'bell', doc: 'doc' };

/* ---------- Nhãn và định dạng ---------- */
export const STATUS_LABEL: Record<string, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối', returned: 'Trả lại', cancelled: 'Đã hủy' };
export const PRIORITY_LABEL: Record<string, string> = { normal: 'Bình thường', high: 'Ưu tiên', urgent: 'Khẩn' };
export const LEVEL_LABEL: Record<string, string> = { principal: 'Cấp Hiệu trưởng', vice_principal: 'Cấp Phó hiệu trưởng', any: 'Hiệu trưởng hoặc Phó hiệu trưởng' };
export const ACTION_LABEL: Record<string, string> = { submit: 'Gửi đề nghị', approve: 'Phê duyệt', reject: 'Từ chối', return: 'Trả lại bổ sung', forward: 'Chuyển cấp Hiệu trưởng', comment: 'Ghi chú' };
export const KIND_LABEL: Record<string, string> = { student: 'Học sinh', teacher: 'Giáo viên', staff: 'Nhân sự nhà trường', parent: 'Phụ huynh' };
export const ROLE_LABEL: Record<string, string> = { principal: 'Hiệu trưởng', vice_principal: 'Phó hiệu trưởng', super_admin: 'Quản trị hệ thống' };

export const pad = (n: number) => String(n).padStart(2, '0');
const parse = (v: string) => new Date(v.replace(' ', 'T'));
export const fmtD = (v: string) => { const d = parse(v); return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`; };
export const fmtDT = (v: string) => { const d = parse(v); return `${pad(d.getHours())}:${pad(d.getMinutes())} ${fmtD(v)}`; };
export const fmtMoney = (n: number) => `${new Intl.NumberFormat('vi-VN').format(n)} đ`;
export const initials = (name: string) => (name.trim().split(/\s+/).slice(-1)[0]?.[0] ?? '?').toUpperCase();

export function slaText(r: { status: string; due_min: number }): { text: string; tone: 'late' | 'soon' | 'ok' | 'none' } {
    if (r.status !== 'pending') return { text: '', tone: 'none' };
    const m = r.due_min, a = Math.abs(m);
    const span = a < 60 ? `${a} phút` : a < 1440 ? `${Math.round(a / 60)} giờ` : `${Math.round(a / 1440)} ngày`;
    return m < 0 ? { text: `Quá hạn ${span}`, tone: 'late' } : { text: `Còn ${span}`, tone: m < 360 ? 'soon' : 'ok' };
}

/* ---------- Con dấu đỏ của Ban giám hiệu ---------- */
export function Seal({ status, date }: { status: string; date: string }) {
    const label = status === 'approved' ? 'ĐÃ DUYỆT' : status === 'rejected' ? 'TỪ CHỐI' : 'TRẢ LẠI';
    return (
        <div className={`${s.seal} ${s['seal_' + status]}`} role="img" aria-label={`${label} ngày ${date}`}>
            <span className={s.sealTop}>BAN GIÁM HIỆU</span>
            <b>{label}</b>
            <span className={s.sealDate}>{date}</span>
        </div>
    );
}

/* ---------- Thông báo nổi ---------- */
type Kind = 'success' | 'error' | 'info';
interface ToastItem { id: number; kind: Kind; title: string; text?: string }
const Ctx = createContext<{ push: (k: Kind, title: string, text?: string) => void }>({ push: () => {} });
export const useToast = () => useContext(Ctx);

export function ToastProvider({ children }: { children: ReactNode }) {
    const [items, setItems] = useState<ToastItem[]>([]);
    const seq = useRef(0);
    const close = useCallback((id: number) => setItems((a) => a.filter((x) => x.id !== id)), []);
    const push = useCallback((kind: Kind, title: string, text?: string) => {
        const id = ++seq.current;
        setItems((a) => [...a.slice(-3), { id, kind, title, text }]);
        setTimeout(() => close(id), kind === 'error' ? 7000 : 4500);
    }, [close]);
    const value = useMemo(() => ({ push }), [push]);
    return (
        <Ctx.Provider value={value}>
            {children}
            <div className={s.toasts} role="region" aria-label="Thông báo" aria-live="polite">
                {items.map((t) => (
                    <div key={t.id} className={`${s.toast} ${s['toast_' + t.kind]}`} role={t.kind === 'error' ? 'alert' : 'status'}>
                        <div><strong>{t.title}</strong>{t.text && <p>{t.text}</p>}</div>
                        <button type="button" aria-label="Đóng thông báo" onClick={() => close(t.id)}>×</button>
                    </div>
                ))}
            </div>
        </Ctx.Provider>
    );
}