'use client';

import { createContext, ReactNode, useContext, useMemo, useState } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Meta, Params, useApi } from '@/lib/hr-seating';
import { ErrorBox, Icon, Skeleton, ToastProvider } from './ui';

interface Ctx { meta: Meta; classId: number; semester: 1 | 2; params: Params; reloadMeta: () => void }
const SeatCtx = createContext<Ctx | null>(null);
export function useSeating(): Ctx {
    const c = useContext(SeatCtx);
    if (!c) throw new Error('useSeating phải nằm trong SeatingShell');
    return c;
}
/** Tải dữ liệu theo lớp + học kỳ đang chọn. */
export function useQ<T>(path: string | null, extra: Params = {}) {
    const { params } = useSeating();
    return useApi<T>(path, { ...params, ...extra });
}

const BASE = '/homeroom/seating';
const NAV = [
    { href: BASE, label: 'Tổng quan', icon: 'dashboard' },
    { href: `${BASE}/chart`, label: 'Sơ đồ chỗ ngồi', icon: 'layers' },
    { href: `${BASE}/groups`, label: 'Tổ & ban cán sự', icon: 'users' },
    { href: `${BASE}/roster`, label: 'Danh sách & lưu ý', icon: 'clipboard' },
    { href: `${BASE}/history`, label: 'Phiên bản & lịch sử', icon: 'clock' },
];

export default function SeatingShell({ children }: { children: ReactNode }) {
    return <ToastProvider><Inner>{children}</Inner></ToastProvider>;
}

/**
 * Bản "nhúng": nằm trong layout cổng giáo viên chủ nhiệm có sẵn, chỉ thêm thanh tab ngang
 * để chuyển giữa các chức năng của Sơ đồ & Sĩ số lớp.
 */
function Inner({ children }: { children: ReactNode }) {
    const pathname = usePathname();
    const [classId, setClassId] = useState<number | null>(null);
    const [semester, setSemester] = useState<1 | 2>(1);
    const meta = useApi<Meta>('/meta', { class_id: classId, semester });

    const ctx = useMemo<Ctx | null>(() => {
        if (!meta.data) return null;
        return { meta: meta.data, classId: meta.data.class.id, semester, params: { class_id: meta.data.class.id, semester }, reloadMeta: meta.reload };
    }, [meta.data, semester, meta.reload]);

    const active = (href: string) => (href === BASE ? pathname === BASE : pathname === href || pathname.startsWith(href + '/'));

    return (
        <div className="hs-root hs-embedded" data-theme="light">
            <div className="hs-toolbar">
                <div className="hs-tabs" role="navigation" aria-label="Chức năng sơ đồ và sĩ số lớp">
                    {NAV.map((i) => (
                        <Link key={i.href} href={i.href} className={`hs-tab ${active(i.href) ? 'active' : ''}`}>
                            <Icon name={i.icon} size={16} /><span>{i.label}</span>
                        </Link>
                    ))}
                </div>
                {ctx && (
                    <div className="hs-toolbar-tools">
                        {ctx.meta.is_manager ? (
                            <select className="hs-select inline" value={ctx.classId} onChange={(e) => setClassId(Number(e.target.value))} aria-label="Lớp">
                                {ctx.meta.classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
                            </select>
                        ) : (
                            ctx.meta.classes.length > 1
                                ? <select className="hs-select inline" value={ctx.classId} onChange={(e) => setClassId(Number(e.target.value))} aria-label="Lớp chủ nhiệm">{ctx.meta.classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}</select>
                                : <span className="hs-chip"><Icon name="grad" size={14} /> Lớp {ctx.meta.class.name}</span>
                        )}
                        <span className="hs-chip muted">Năm học {ctx.meta.year_label}</span>
                        <select className="hs-select inline" value={semester} onChange={(e) => setSemester(Number(e.target.value) as 1 | 2)} aria-label="Học kỳ">
                            <option value={1}>Học kỳ 1</option><option value={2}>Học kỳ 2</option>
                        </select>
                    </div>
                )}
            </div>
            <div className="hs-content">
                {meta.error && !meta.data ? <ErrorBox error={meta.error} onRetry={meta.reload} /> : !ctx ? <Skeleton h={110} n={4} /> : <SeatCtx.Provider value={ctx}>{children}</SeatCtx.Provider>}
            </div>
        </div>
    );
}