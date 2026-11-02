'use client';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { ReactNode, useEffect, useState } from 'react';
import { api } from '@/app/academic/_lib/api';
import '@/app/academic/website/website.css';
import './lien-he.css';

/* Phần dùng chung của module Liên hệ & Hỗ trợ. */
export const BASE = '/academic/website/lien-he';
export const ST: Record<string, string> = { new: 'Mới', working: 'Đang xử lý', done: 'Đã trả lời', spam: 'Spam' };

/** "5 phút trước", "3 giờ trước", "2 ngày trước". */
export function ago(s: string | null | undefined): string {
    if (!s) return '';
    const t = new Date(s.replace(' ', 'T')).getTime();
    if (isNaN(t)) return s;
    const m = Math.max(0, Math.round((Date.now() - t) / 60000));
    if (m < 1) return 'vừa xong';
    if (m < 60) return `${m} phút trước`;
    if (m < 1440) return `${Math.floor(m / 60)} giờ trước`;
    if (m < 43200) return `${Math.floor(m / 1440)} ngày trước`;
    return new Date(t).toLocaleDateString('vi-VN');
}
/** 90 → "1 giờ 30 phút". */
export function span(min: number | null | undefined): string {
    if (min === null || min === undefined) return '—';
    if (min < 60) return `${min} phút`;
    if (min < 1440) { const h = Math.floor(min / 60), r = min % 60; return r ? `${h} giờ ${r} phút` : `${h} giờ`; }
    const d = Math.floor(min / 1440), h = Math.round((min % 1440) / 60);
    return h ? `${d} ngày ${h} giờ` : `${d} ngày`;
}
export const initials = (n: string) => (n || '?').trim().split(/\s+/).slice(-1)[0]?.[0]?.toUpperCase() ?? '?';

export function Av({ name }: { name: string }) { return <span className="lh-av" aria-hidden>{initials(name)}</span>; }
export function StPill({ s, overdue }: { s: string; overdue?: boolean }) {
    return <><span className={`wm-pill lh-${s}`}>{ST[s] ?? s}</span>{overdue && <span className="wm-pill new" style={{ marginLeft: 6 }}>Quá hạn</span>}</>;
}

const TABS = [
    { href: BASE, t: 'Tổng quan', exact: true },
    { href: `${BASE}/hop-thu`, t: 'Hộp thư', badge: true },
    { href: `${BASE}/mau-tra-loi`, t: 'Mẫu trả lời' },
    { href: `${BASE}/bao-cao`, t: 'Báo cáo' },
    { href: `${BASE}/cai-dat`, t: 'Cài đặt' },
];

/** Thanh chức năng con của module: mỗi mục mở một màn hình bên trong. */
export function SubNav() {
    const path = usePathname() || '';
    const [open, setOpen] = useState(0);
    useEffect(() => { api<any>('website/inbox/overview').then((d) => setOpen((d?.counts?.new ?? 0) + (d?.counts?.working ?? 0))).catch(() => {}); }, [path]);
    return (
        <nav className="lh-tabs" aria-label="Chức năng của Liên hệ & Hỗ trợ">
            {TABS.map((x) => {
                const on = x.exact ? path === x.href : path === x.href || path.startsWith(x.href + '/');
                return <Link key={x.href} href={x.href} className={on ? 'on' : ''} aria-current={on ? 'page' : undefined}>{x.t}{x.badge && open > 0 && <em>{open}</em>}</Link>;
            })}
        </nav>
    );
}

export function Crumb({ items }: { items: (string | [string, string])[] }) {
    return (
        <p className="lh-crumb">
            {items.map((x, i) => <span key={i}>{i > 0 && ' › '}{typeof x === 'string' ? <b>{x}</b> : <Link href={x[1]}>{x[0]}</Link>}</span>)}
        </p>
    );
}

export function Empty({ children }: { children: ReactNode }) { return <div className="wm-state">{children}</div>; }