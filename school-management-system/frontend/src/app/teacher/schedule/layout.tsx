'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import React, { useCallback, useMemo, useState } from 'react';
import { TaContext, getStaff, type Settings } from '../attendance/_ta';

const DEFAULT_SETTINGS: Settings = {
    lock_days: 7,
    good_rate: 90,
    warn_rate: 80,
    alert_absent: 5,
};

const TABS = [
    { href: '/teacher/schedule', label: 'Tổng quan', end: true },
    { href: '/teacher/schedule/tuan', label: 'Thời khóa biểu tuần' },
    { href: '/teacher/schedule/lop', label: 'Lớp của tôi' },
    { href: '/teacher/schedule/khoi-luong', label: 'Khối lượng & tiết trống' },
    { href: '/teacher/schedule/yeu-cau', label: 'Yêu cầu' },
    { href: '/teacher/schedule/ghi-chu', label: 'Ghi chú & giáo án' },
];

export default function ScheduleLayout({ children }: { children: React.ReactNode }) {
    const pathname = usePathname();
    const [version, setVersion] = useState(0);
    const refresh = useCallback(() => setVersion((v) => v + 1), []);
    const toast = useCallback((m: string) => {
        if (typeof window !== 'undefined') console.info(m);
    }, []);
    const value = useMemo(
        () => ({
            staff: getStaff(),
            settings: DEFAULT_SETTINGS,
            toast,
            refresh,
            version,
        }),
        [toast, refresh, version],
    );

    const active = (href: string, end?: boolean) =>
        end ? pathname === href : pathname === href || pathname.startsWith(href + '/');

    return (
        <TaContext.Provider value={value}>
            <div className="ta-page" style={{ paddingTop: 8 }}>
                <nav style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
                    {TABS.map((t) => (
                        <Link
                            key={t.href}
                            href={t.href}
                            className="ta-btn sm"
                            style={{
                                fontWeight: active(t.href, t.end) ? 700 : 500,
                                borderColor: active(t.href, t.end) ? '#0284c7' : undefined,
                                color: active(t.href, t.end) ? '#0284c7' : undefined,
                            }}
                        >
                            {t.label}
                        </Link>
                    ))}
                </nav>
                {children}
            </div>
        </TaContext.Provider>
    );
}