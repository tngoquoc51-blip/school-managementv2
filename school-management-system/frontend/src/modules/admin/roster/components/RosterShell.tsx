'use client';

import { ReactNode, useEffect, useState } from 'react';
import cat from '@/modules/admin/categories/categories.module.css';
import { FeedbackProvider } from '@/modules/admin/categories/components/Feedback';
import Icon from '@/modules/admin/categories/components/Icon';
import { getErrorMessage } from '@/modules/admin/categories/catalogApi';
import { ErrorState } from '@/modules/admin/categories/components/ui';
import s from '../roster.module.css';
import { rosterApi } from '../rosterApi';
import type { Year } from '../types';

interface Props {
    title: string;
    description: string;
    eyebrow?: string;
    children: (ctx: { yearId: number; year: Year | undefined; years: Year[] }) => ReactNode;
}

/** Khung chung: tiêu đề, chọn năm học, nhà cung cấp thông báo. */
export default function RosterShell({ title, description, eyebrow = 'Quản lý học sinh', children }: Props) {
    const [years, setYears] = useState<Year[]>([]);
    const [yearId, setYearId] = useState<number | null>(null);
    const [error, setError] = useState<string | null>(null);

    const load = () => {
        setError(null);
        rosterApi.years().then((y) => {
            setYears(y);
            setYearId((cur) => cur ?? y.find((x) => x.is_current)?.id ?? y[0]?.id ?? null);
        }).catch((e) => setError(getErrorMessage(e)));
    };
    useEffect(load, []);

    return (
        <FeedbackProvider>
            <div className={cat.root}>
                <header className={cat.hero}>
                    <div className={cat.heroText}>
                        <span className={cat.eyebrow}><Icon name="sparkle" size={14} /> {eyebrow}</span>
                        <h1>{title}</h1>
                        <p>{description}</p>
                    </div>
                </header>

                {error && <div style={{ marginTop: 16 }}><ErrorState message={error} onRetry={load} /></div>}

                {yearId !== null && (
                    <>
                        <div className={s.yearBar}>
                            <label htmlFor="roster-year"><Icon name="calendar" size={16} /> Năm học</label>
                            <select id="roster-year" className={cat.select} value={yearId} onChange={(e) => setYearId(Number(e.target.value))}>
                                {years.map((y) => <option key={y.id} value={y.id}>{y.label}{y.is_current ? ' (hiện tại)' : ''}</option>)}
                            </select>
                        </div>
                        {children({ yearId, year: years.find((y) => y.id === yearId), years })}
                    </>
                )}
            </div>
        </FeedbackProvider>
    );
}