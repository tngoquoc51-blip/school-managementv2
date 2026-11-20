'use client';

import Link from 'next/link';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { ReactNode, useCallback, useEffect, useRef, useState } from 'react';
import { get } from './api';
import { ago, initials } from './format';
import { useSession } from './session';
import type { Notices } from './types';
import { Icon } from './ui';

/** Đổi đường dẫn này nếu trang tổng quan Kế toán của bạn nằm ở địa chỉ khác. */
export const ACCOUNTANT_HOME = '/accountant/dashboard';
export const BASE = '/accountant/students';
export const notifyChanged = () => window.dispatchEvent(new Event('fx:changed'));

const NOTE_ICON: Record<string, [string, string, string]> = {
    payment: ['wallet', 'var(--warn-bg)', 'var(--warn)'], dispute: ['chat', 'var(--info-bg)', 'var(--info)'],
    promise: ['clock', 'var(--bad-bg)', 'var(--bad)'], overdue: ['alert', 'var(--bad-bg)', 'var(--bad)'],
};

export default function Shell({ children }: { children: ReactNode }) {
    const { user, logout } = useSession();
    const path = usePathname();
    const router = useRouter();
    const sp = useSearchParams();
    const status = sp.get('status') || '';
    const [open, setOpen] = useState(false);
    const [bell, setBell] = useState(false);
    const [notices, setNotices] = useState<Notices | null>(null);
    const [dark, setDark] = useState(false);
    const popRef = useRef<HTMLDivElement>(null);

    const load = useCallback(() => { get<Notices>('/notifications').then(setNotices).catch(() => undefined); }, []);
    useEffect(() => {
        load();
        const t = setInterval(load, 60000);
        window.addEventListener('fx:changed', load);
        return () => { clearInterval(t); window.removeEventListener('fx:changed', load); };
    }, [load]);

    useEffect(() => {
        try { const v = localStorage.getItem('fx_theme') === 'dark'; setDark(v); } catch { /* bỏ qua */ }
    }, []);
    useEffect(() => {
        const root = document.querySelector('.fx-root') as HTMLElement | null;
        if (root) root.dataset.theme = dark ? 'dark' : 'light';
        try { localStorage.setItem('fx_theme', dark ? 'dark' : 'light'); } catch { /* bỏ qua */ }
    }, [dark]);
    useEffect(() => {
        const h = (e: MouseEvent) => { if (popRef.current && !popRef.current.contains(e.target as Node)) setBell(false); };
        document.addEventListener('mousedown', h);
        return () => document.removeEventListener('mousedown', h);
    }, []);
    useEffect(() => setOpen(false), [path, status]);

    const c = notices?.counts;
    const onList = path === BASE;
    const isDetail = path.startsWith(BASE + '/');
    const nav: { label: string; icon: string; status: string; cnt?: number; hot?: boolean }[] = [
        { label: 'Tất cả học sinh', icon: 'users', status: '' },
        { label: 'Nợ quá hạn', icon: 'alert', status: 'overdue', cnt: c?.overdue_students, hot: true },
        { label: 'Còn nợ chưa đến hạn', icon: 'clock', status: 'debt' },
        { label: 'Chờ xác nhận thu', icon: 'wallet', status: 'pending', cnt: c?.pending_payments },
        { label: 'Có lịch hẹn trả', icon: 'note', status: 'promise', cnt: c?.late_promises, hot: true },
        { label: 'Được miễn giảm', icon: 'gift', status: 'waiver' },
        { label: 'Đã đóng đủ', icon: 'check', status: 'paid' },
    ];

    return (
        <section className="fx-main fx-main--embed">
            <div className="fx-embed-tools">
                <div className="fx-seg">
                    {nav.map((n) => (
                        <Link
                            key={n.status || 'all'}
                            href={n.status ? `${BASE}?status=${n.status}` : BASE}
                            className={`fx-pill ${onList && status === n.status ? 'on' : ''}`}
                        >
                            {n.label}
                            {!!n.cnt && <b className={n.hot ? 'hot' : ''}>{n.cnt}</b>}
                        </Link>
                    ))}
                </div>
            </div>
            <main className="fx-content">
                <div className="fx-wrap">{children}</div>
            </main>
        </section>
    );
}