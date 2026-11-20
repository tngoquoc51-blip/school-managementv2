'use client';

import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import s from './lessonplan.module.css';
import type { Item } from '@/services/teacherLessonPlan';

const P: Record<string, ReactNode> = {
    doc: <><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z" /><path d="M14 3v5h5M9 13h6M9 17h4" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    check: <path d="M20 6 9 17l-5-5" />,
    x: <path d="M18 6 6 18M6 6l12 12" />,
    edit: <><path d="M4 20h4L19 9l-4-4L4 16z" /><path d="M13.5 6.5l4 4" /></>,
    trash: <path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />,
    copy: <><rect x="9" y="9" width="12" height="12" rx="2" /><path d="M5 15V5a2 2 0 0 1 2-2h10" /></>,
    print: <><path d="M6 9V3h12v6M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" /><rect x="6" y="14" width="12" height="7" /></>,
    send: <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />,
    undo: <><path d="M9 14 4 9l5-5" /><path d="M4 9h10.5a5.5 5.5 0 0 1 0 11H11" /></>,
    up: <path d="m18 15-6-6-6 6" />,
    down: <path d="m6 9 6 6 6-6" />,
    calendar: <><rect x="3" y="4" width="18" height="17" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>,
    list: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />,
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    history: <><path d="M3 12a9 9 0 1 0 3-6.7L3 8" /><path d="M3 3v5h5M12 7v5l3 2" /></>,
    alert: <><path d="M12 3 2 21h20z" /><path d="M12 10v5M12 18h.01" /></>,
    book: <><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></>,
};
export function Icon({ name, size = 18 }: { name: string; size?: number }) {
    return (
        <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {P[name] ?? P.doc}
        </svg>
    );
}

export const STATUS_LABEL: Record<string, string> = { draft: 'Bản nháp', submitted: 'Chờ duyệt', approved: 'Đã duyệt', returned: 'Cần chỉnh sửa' };
export const EVENT_LABEL: Record<string, string> = { create: 'Tạo kế hoạch', clone: 'Sao chép kế hoạch', submit: 'Nộp duyệt', approve: 'Phê duyệt', return: 'Trả lại để chỉnh sửa', reopen: 'Mở lại để chỉnh sửa' };
export const SEM_LABEL: Record<number, string> = { 1: 'Học kỳ I', 2: 'Học kỳ II' };

export const pad = (n: number) => String(n).padStart(2, '0');
const parse = (v: string) => new Date(v.replace(' ', 'T'));
export const fmtD = (v: string) => { const x = parse(v); return `${pad(x.getDate())}/${pad(x.getMonth() + 1)}/${x.getFullYear()}`; };
export const fmtDT = (v: string) => { const x = parse(v); return `${pad(x.getHours())}:${pad(x.getMinutes())} ${fmtD(v)}`; };
export const WEEKDAY = ['Chủ nhật', 'Thứ hai', 'Thứ ba', 'Thứ tư', 'Thứ năm', 'Thứ sáu', 'Thứ bảy'];
export const fmtDow = (v: string) => `${WEEKDAY[parse(v).getDay()]}, ${pad(parse(v).getDate())}/${pad(parse(v).getMonth() + 1)}`;
export const pct = (a: number, b: number) => (b > 0 ? Math.round((a / b) * 100) : 0);

/** 7 phần của một bài dạy: mục tiêu, thiết bị, 4 hoạt động, đánh giá. Trả về danh sách phần đã có nội dung. */
export const SECTION_KEYS = ['objectives', 'equipment', 'act_start', 'act_learn', 'act_practice', 'act_apply', 'assessment'] as const;
export const SECTION_LABEL: Record<string, string> = {
    objectives: 'Mục tiêu', equipment: 'Thiết bị, học liệu', act_start: 'Khởi động', act_learn: 'Hình thành kiến thức',
    act_practice: 'Luyện tập', act_apply: 'Vận dụng', assessment: 'Đánh giá',
};
const has = (v: string | null | undefined) => !!v && v.trim() !== '';
export function filled(i: Partial<Item>): string[] {
    const out: string[] = [];
    if (has(i.objectives_knowledge) || has(i.objectives_competence) || has(i.objectives_quality)) out.push('objectives');
    if (has(i.equipment)) out.push('equipment');
    if (has(i.act_start)) out.push('act_start');
    if (has(i.act_learn)) out.push('act_learn');
    if (has(i.act_practice)) out.push('act_practice');
    if (has(i.act_apply)) out.push('act_apply');
    if (has(i.assessment)) out.push('assessment');
    return out;
}

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
        setTimeout(() => close(id), kind === 'error' ? 8000 : 4500);
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