'use client';

import { useCallback, useEffect, useState } from 'react';
import { getStudentToken } from '@/hooks/useCurrentStudent';

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

export interface HsRow {
    id: string;
    subject: string;
    type: 'score' | 'pass';
    teacher_name: string | null;
    updated_at: string | null;
    tx: (number | null)[];
    gk: number | null;
    ck: number | null;
    tbm: number | null;
    rank: string | null;
}

export interface HsYear {
    id: string;
    label: string;
    is_current: boolean;
    class_name: string;
    grade: number;
    conduct: { hk1?: string; hk2?: string; year?: string };
    semesters: { hk1: HsRow[]; hk2: HsRow[] };
}

export interface HsGrades {
    student: { code: string; name: string };
    years: HsYear[];
}

export type Sem = '1' | '2' | '0';
export const SEM_LABEL: Record<Sem, string> = { '1': 'Học kỳ 1', '2': 'Học kỳ 2', '0': 'Cả năm' };

export const rankOf = (n: number) =>
    n >= 8 ? 'Giỏi' : n >= 6.5 ? 'Khá' : n >= 5 ? 'Trung bình' : n >= 3.5 ? 'Yếu' : 'Kém';

export const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(1));

export const rankClass = (r?: string | null) => {
    const s = (r || '').toLowerCase();
    if (s === 'giỏi' || s === 'tốt') return 'gx-r-gioi';
    if (s === 'khá') return 'gx-r-kha';
    if (s === 'trung bình' || s === 'tb') return 'gx-r-tb';
    if (s === 'đạt') return 'gx-r-dat';
    if (s) return 'gx-r-yeu';
    return 'gx-r-none';
};

/** Các môn của một học kỳ; "Cả năm" = (HK1 + 2×HK2) / 3 theo Thông tư 22. */
export function rowsOf(y: HsYear | undefined, sem: Sem): HsRow[] {
    if (!y) return [];
    if (sem === '1') return y.semesters.hk1;
    if (sem === '2') return y.semesters.hk2;
    return y.semesters.hk1.map((a) => {
        const b = y.semesters.hk2.find((x) => x.subject === a.subject);
        const t = a.tbm !== null && b?.tbm !== null && b?.tbm !== undefined ? Math.round(((a.tbm + 2 * b.tbm) / 3) * 10) / 10 : null;
        return {
            ...a,
            tx: [],
            gk: null,
            ck: null,
            tbm: t,
            rank: a.type === 'pass' ? (b?.rank ?? a.rank) : null,
        };
    });
}

export function avgOf(rows: HsRow[]): number | null {
    const v = rows.filter((r) => typeof r.tbm === 'number').map((r) => r.tbm as number);
    return v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null;
}

export function conductOf(y: HsYear | undefined, sem: Sem): string | null {
    if (!y) return null;
    return (sem === '1' ? y.conduct.hk1 : sem === '2' ? y.conduct.hk2 : y.conduct.year) || null;
}

export function useHsGrades() {
    const [data, setData] = useState<HsGrades | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [tick, setTick] = useState(0);

    useEffect(() => {
        const token = getStudentToken();
        if (!token) {
            setLoading(false);
            setError('Chưa đăng nhập');
            return;
        }
        const ctrl = new AbortController();
        setLoading(true);
        setError('');
        fetch(`${API}/hs/grades`, {
            signal: ctrl.signal,
            headers: { Accept: 'application/json', Authorization: `Bearer ${token}` },
        })
            .then((r) => {
                if (!r.ok) throw new Error(r.status === 401 ? 'Phiên đăng nhập hết hạn, vui lòng đăng nhập lại' : `HTTP ${r.status}`);
                return r.json();
            })
            .then((j) => {
                if (!j?.data?.years) throw new Error('Dữ liệu điểm không hợp lệ');
                setData(j.data as HsGrades);
            })
            .catch((e) => {
                if (e?.name !== 'AbortError') setError(e.message || 'Không tải được bảng điểm');
            })
            .finally(() => {
                if (!ctrl.signal.aborted) setLoading(false);
            });
        return () => ctrl.abort();
    }, [tick]);

    const reload = useCallback(() => setTick((n) => n + 1), []);
    return { data, loading, error, reload };
}