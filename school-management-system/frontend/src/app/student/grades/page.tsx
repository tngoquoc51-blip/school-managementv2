'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './grades.css';

/* ============================================================
   BẢNG ĐIỂM HỌC SINH – Sky modern
   Dữ liệu lấy từ API (điểm do giáo viên bộ môn nhập):
       GET {API}/hs/grades
   Một lần gọi trả về TẤT CẢ năm học của học sinh → đổi năm / học kỳ
   trên màn hình là xem ngay, không cần gọi lại.
   Nếu chưa kết nối được API, trang hiển thị DỮ LIỆU MẪU (có biểu ngữ báo).
   Xem hàm normalize() để biết các tên trường API được chấp nhận.
   ============================================================ */

const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

type SemKey = 'hk1' | 'hk2' | 'cn';

interface Row {
    id: string;
    subject: string;
    kind: 'score' | 'pass'; // pass = môn đánh giá Đạt / Chưa đạt (Thể dục, Âm nhạc, Mỹ thuật…)
    teacher?: string;
    updatedAt?: string;
    tx: (number | null)[]; // TX1..TX4
    gk: number | null;
    ck: number | null;
    tbm: number | null;
    rank?: string;
}

interface YearData {
    id: string;
    label: string; // "2025 – 2026"
    className: string;
    conduct: { hk1?: string; hk2?: string; year?: string };
    semesters: { hk1: Row[]; hk2: Row[] };
}

interface GradesData {
    student: { name: string; code?: string };
    years: YearData[];
}

/* ---------- tiện ích điểm ---------- */
const round1 = (n: number) => Math.round(n * 10) / 10;
const fmt = (n: number | null | undefined) => (n === null || n === undefined ? '—' : n.toFixed(1));

const rankOf = (n: number) => (n >= 8 ? 'Giỏi' : n >= 6.5 ? 'Khá' : n >= 5 ? 'Trung bình' : n >= 3.5 ? 'Yếu' : 'Kém');

const rankClass = (rank?: string) => {
    if (!rank) return 'rk-none';
    if (rank === 'Giỏi' || rank === 'Tốt') return 'rk-gioi';
    if (rank === 'Khá') return 'rk-kha';
    if (rank === 'TB' || rank === 'Trung bình') return 'rk-tb';
    if (rank === 'Đạt') return 'rk-dat';
    return 'rk-yeu';
};

const scoreClass = (n: number | null) => {
    if (n === null) return 'sc-none';
    if (n >= 8) return 'sc-a';
    if (n >= 6.5) return 'sc-b';
    if (n >= 5) return 'sc-c';
    return 'sc-d';
};

const hasScores = (rows: Row[]) =>
    rows.some((r) => r.tx.some((v) => v !== null) || r.gk !== null || r.ck !== null || r.tbm !== null || !!r.rank);

/* ĐTB môn học kỳ (TT22): (tổng TX + 2×GK + 3×CK) / (số cột TX + 5). Ưu tiên giá trị API trả về. */
const tbmOf = (r: Row): number | null => {
    if (r.kind === 'pass') return null;
    if (r.tbm !== null) return r.tbm;
    const tx = r.tx.filter((v): v is number => v !== null);
    if (tx.length === 0 || r.gk === null || r.ck === null) return null;
    return round1((tx.reduce((a, b) => a + b, 0) + 2 * r.gk + 3 * r.ck) / (tx.length + 5));
};

const rankOfRow = (r: Row): string | undefined => {
    if (r.rank) return r.rank;
    const t = tbmOf(r);
    return t === null ? undefined : rankOf(t);
};

const avgOf = (rows: Row[]): number | null => {
    const v = rows.map(tbmOf).filter((x): x is number => x !== null);
    return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null;
};

/* Cả năm = (ĐTB HK1 + 2×ĐTB HK2) / 3 */
const yearScore = (a: number | null, b: number | null): number | null =>
    a !== null && b !== null ? round1((a + 2 * b) / 3) : null;

/* ---------- chuẩn hóa dữ liệu API (chấp nhận nhiều cách đặt tên) ---------- */
const num = (x: unknown): number | null => {
    if (x === null || x === undefined || x === '') return null;
    const n = Number(x);
    return Number.isFinite(n) ? n : null;
};

function normalizeRow(r: any, i: number): Row {
    const txArr: unknown[] = Array.isArray(r.tx)
        ? r.tx
        : Array.isArray(r.regular_scores)
            ? r.regular_scores
            : [r.tx1, r.tx2, r.tx3, r.tx4];
    const tx = [0, 1, 2, 3].map((k) => num(txArr[k]));
    const rank: string | undefined = r.rank ?? r.xep_loai ?? r.assessment ?? r.grade ?? undefined;
    const kind: 'score' | 'pass' =
        r.type === 'pass' || r.is_pass_fail === true || rank === 'Đạt' || rank === 'Chưa đạt' ? 'pass' : 'score';
    return {
        id: String(r.id ?? i),
        subject: String(r.subject ?? r.subject_name ?? r.name ?? `Môn ${i + 1}`),
        kind,
        teacher: r.teacher ?? r.teacher_name ?? undefined,
        updatedAt: r.updated_at ?? r.updatedAt ?? undefined,
        tx,
        gk: num(r.gk ?? r.mid ?? r.midterm ?? r.giua_ky),
        ck: num(r.ck ?? r.final ?? r.cuoi_ky),
        tbm: num(r.tbm ?? r.average ?? r.avg),
        rank,
    };
}

function normalize(json: any): GradesData | null {
    const d = json?.data ?? json;
    const rawYears = d?.years ?? d?.school_years;
    if (!Array.isArray(rawYears)) return null;
    const years: YearData[] = rawYears.map((y: any, yi: number) => {
        const sem = y.semesters ?? {};
        const pick = (key: 'hk1' | 'hk2', n: number): any[] => {
            if (Array.isArray(sem)) {
                const f = sem.find((s: any) => s.key === key || Number(s.semester) === n);
                return f?.rows ?? f?.grades ?? f?.subjects ?? [];
            }
            const f = sem[key] ?? sem[String(n)];
            return Array.isArray(f) ? f : f?.rows ?? f?.grades ?? f?.subjects ?? [];
        };
        return {
            id: String(y.id ?? yi),
            label: String(y.label ?? y.name ?? y.year ?? `Năm ${yi + 1}`),
            className: String(y.class_name ?? y.className ?? y.class ?? ''),
            conduct: y.conduct ?? {},
            semesters: {
                hk1: pick('hk1', 1).map(normalizeRow),
                hk2: pick('hk2', 2).map(normalizeRow),
            },
        };
    });
    return {
        student: { name: String(d.student?.name ?? d.student_name ?? 'Học sinh'), code: d.student?.code },
        years,
    };
}

/* ---------- Dữ liệu mẫu (chỉ dùng khi chưa có API) ---------- */
const mk = (
    subject: string,
    teacher: string,
    tx: (number | null)[],
    gk: number | null,
    ck: number | null,
    tbm: number | null,
    rank?: string,
    kind: 'score' | 'pass' = 'score'
): Row => ({
    id: subject,
    subject,
    kind,
    teacher,
    updatedAt: '12/01/2026',
    tx: [tx[0] ?? null, tx[1] ?? null, tx[2] ?? null, tx[3] ?? null],
    gk,
    ck,
    tbm,
    rank,
});

const DEMO_HK1: Row[] = [
    mk('Toán', 'Nguyễn Văn An', [8.5, 9.0, 8.0, 8.5], 8.5, 9.0, 8.6),
    mk('Ngữ văn', 'Lê Thị Hoa', [7.5, 8.0, 7.0, 7.5], 7.5, 8.0, 7.6),
    mk('Tiếng Anh', 'Trần Minh Châu', [9.0, 8.5, 9.0, 8.5], 9.0, 8.5, 8.8),
    mk('Vật lý', 'Phạm Quốc Bảo', [8.0, 7.5, 8.5, 8.0], 8.0, 7.5, 7.9),
    mk('Hóa học', 'Đỗ Thu Hằng', [7.0, 7.5, 8.0, 7.5], 7.5, 8.0, 7.6),
    mk('Sinh học', 'Vũ Ngọc Lan', [8.5, 8.0, 8.5, 9.0], 8.5, 8.5, 8.5),
    mk('Lịch sử', 'Bùi Văn Tuấn', [8.0, 8.5, 7.5, 8.0], 8.0, 8.5, 8.1),
    mk('Địa lý', 'Ngô Thị Mai', [7.5, 8.0, 7.5, 8.0], 7.5, 8.0, 7.7),
    mk('GDCD', 'Hoàng Anh Dũng', [9.0, 9.0, 8.5, 9.0], 9.0, 9.0, 8.9),
    mk('Tin học', 'Đặng Quang Huy', [9.5, 9.0, 9.5, 9.0], 9.0, 9.5, 9.3),
    mk('Công nghệ', 'Lý Thanh Sơn', [8.0, 8.5, 8.0, 8.5], 8.0, 8.5, 8.2),
    mk('Thể dục', 'Trịnh Hải Nam', [null, null, null, null], null, null, null, 'Đạt', 'pass'),
];

const bump = (v: number | null, d: number) => (v === null ? null : Math.min(10, Math.max(0, round1(v + d))));
const DEMO_HK2: Row[] = DEMO_HK1.map((r, i) => {
    const d = [0.5, 0.25, -0.25, 0.5, 0.25, 0, 0.5, 0.25, 0, -0.25, 0.25, 0][i];
    return {
        ...r,
        id: `${r.id}-2`,
        updatedAt: '28/05/2026',
        tx: r.tx.map((v) => bump(v, d)),
        gk: bump(r.gk, d),
        ck: bump(r.ck, d),
        tbm: null, // để trang tự tính theo công thức
    };
});

const DEMO_NEXT_HK1: Row[] = DEMO_HK1.map((r, i) => ({
    ...r,
    id: `${r.id}-3`,
    updatedAt: '10/10/2026',
    tx: i < 6 ? [bump(r.tx[0], 0.25), bump(r.tx[1], 0), null, null] : [null, null, null, null],
    gk: null,
    ck: null,
    tbm: null,
    rank: undefined,
}));

const DEMO: GradesData = {
    student: { name: 'Trần Thị Học', code: 'HS0001' },
    years: [
        {
            id: '2025',
            label: '2025 – 2026',
            className: '10A2',
            conduct: { hk1: 'Tốt', hk2: 'Tốt', year: 'Tốt' },
            semesters: { hk1: DEMO_HK1, hk2: DEMO_HK2 },
        },
        {
            id: '2026',
            label: '2026 – 2027',
            className: '11A2',
            conduct: {},
            semesters: { hk1: DEMO_NEXT_HK1, hk2: [] },
        },
    ],
};

/* ---------- Icon ---------- */
const ICONS: Record<string, React.ReactNode> = {
    download: (<><path d="M12 4v11M7.5 11 12 15.5 16.5 11" /><path d="M5 20h14" /></>),
    book: (<><path d="M5 4.5A2.5 2.5 0 0 1 7.5 2H19v17H7.5A2.5 2.5 0 0 0 5 21.5V4.5Z" /><path d="M5 19.5A2.5 2.5 0 0 1 7.5 17H19" /></>),
    award: (<><circle cx="12" cy="9" r="5.5" /><path d="m8.6 13.6-1.4 7.4 4.8-2.7 4.8 2.7-1.4-7.4" /></>),
    heart: (<path d="M12 20s-7.5-4.6-7.5-10.2A4.3 4.3 0 0 1 12 7.2a4.3 4.3 0 0 1 7.5 2.6C19.5 15.4 12 20 12 20Z" />),
    star: (<path d="m12 3 2.7 5.6 6.1.9-4.4 4.3 1 6.1L12 17l-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" />),
    up: (<path d="M6 15l6-6 6 6" />),
    down: (<path d="M6 9l6 6 6-6" />),
    info: (<><circle cx="12" cy="12" r="9" /><path d="M12 11v5M12 7.6v.1" /></>),
    wait: (<><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3.2 2" /></>),
    refresh: (<><path d="M20 11a8 8 0 1 0-2.3 5.7" /><path d="M20 4v7h-7" /></>),
    user: (<><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></>),
};

const Icon = ({ name, size = 18 }: { name: keyof typeof ICONS; size?: number }) => (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[name]}
    </svg>
);

const shortYear = (label: string) => {
    const m = label.match(/(\d{4})\D+(\d{4})/);
    return m ? `${m[1].slice(2)}–${m[2].slice(2)}` : label;
};

/* ============================================================
   Trang
   ============================================================ */
export default function StudentGradesPage() {
    const [data, setData] = useState<GradesData | null>(null);
    const [loading, setLoading] = useState(true);
    const [demo, setDemo] = useState(false);
    const [yearId, setYearId] = useState('');
    const [sem, setSem] = useState<SemKey>('hk1');
    const [toast, setToast] = useState('');

    const load = useCallback(async () => {
        setLoading(true);
        let result: GradesData | null = null;
        let isDemo = false;
        try {
            const token = typeof window !== 'undefined' ? (localStorage.getItem('hs_token') ?? sessionStorage.getItem('hs_token')) : null;
            const res = await fetch(`${API}/hs/grades`, {
                headers: { Accept: 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
            });
            if (!res.ok) throw new Error(`HTTP ${res.status}`);
            result = normalize(await res.json());
            if (!result || result.years.length === 0) throw new Error('empty');
        } catch {
            result = DEMO;
            isDemo = true;
        }
        setData(result);
        setDemo(isDemo);
        // mặc định: năm mới nhất, học kỳ mới nhất đã có điểm
        const latest = result.years[result.years.length - 1];
        setYearId(latest.id);
        setSem(hasScores(latest.semesters.hk2) ? 'hk2' : 'hk1');
        setLoading(false);
    }, []);

    useEffect(() => {
        load();
    }, [load]);

    const year = data?.years.find((y) => y.id === yearId) ?? null;

    /* Lịch sử ĐTB qua các học kỳ (để vẽ xu hướng) */
    const history = useMemo(() => {
        if (!data) return [];
        const pts: { key: string; label: string; value: number; yid: string; sem: 'hk1' | 'hk2' }[] = [];
        data.years.forEach((y) => {
            (['hk1', 'hk2'] as const).forEach((s) => {
                const a = avgOf(y.semesters[s]);
                if (a !== null) pts.push({ key: `${y.id}-${s}`, label: `${s === 'hk1' ? 'HK1' : 'HK2'} ${shortYear(y.label)}`, value: a, yid: y.id, sem: s });
            });
        });
        return pts;
    }, [data]);

    const rows: Row[] = year ? (sem === 'cn' ? [] : year.semesters[sem]) : [];

    /* Bảng "Cả năm" */
    const yearRows = useMemo(() => {
        if (!year) return [];
        const h1 = year.semesters.hk1;
        const h2 = year.semesters.hk2;
        const names = Array.from(new Set([...h1.map((r) => r.subject), ...h2.map((r) => r.subject)]));
        return names.map((name) => {
            const a = h1.find((r) => r.subject === name);
            const b = h2.find((r) => r.subject === name);
            const kind = (a ?? b)!.kind;
            const t1 = a ? tbmOf(a) : null;
            const t2 = b ? tbmOf(b) : null;
            const total = kind === 'score' ? yearScore(t1, t2) : null;
            const passRank = kind === 'pass' ? (b?.rank ?? a?.rank) : undefined;
            return { name, kind, t1, t2, total, rank: kind === 'pass' ? passRank : total !== null ? rankOf(total) : undefined, teacher: (b ?? a)?.teacher };
        });
    }, [year]);

    const semAvg = sem === 'cn' ? (() => {
        const v = yearRows.map((r) => r.total).filter((x): x is number => x !== null);
        return v.length ? round1(v.reduce((a, b) => a + b, 0) / v.length) : null;
    })() : avgOf(rows);

    const scored = sem === 'cn'
        ? yearRows.filter((r) => r.total !== null).map((r) => ({ name: r.name, v: r.total as number }))
        : rows.map((r) => ({ name: r.subject, v: tbmOf(r) })).filter((x): x is { name: string; v: number } => x.v !== null);
    const best = scored.length ? scored.reduce((a, b) => (b.v > a.v ? b : a)) : null;
    const weak = scored.length > 1 ? scored.reduce((a, b) => (b.v < a.v ? b : a)) : null;

    const prev = (() => {
        if (sem === 'cn' || !year) return null;
        const idx = history.findIndex((p) => p.yid === year.id && p.sem === sem);
        return idx > 0 ? history[idx - 1] : null;
    })();
    const delta = semAvg !== null && prev ? round1(semAvg - prev.value) : null;

    const conductText = year ? (sem === 'cn' ? year.conduct.year : year.conduct[sem]) ?? '—' : '—';
    const academic = semAvg !== null ? rankOf(semAvg) : '—';
    const semLabel = sem === 'hk1' ? 'Học kỳ 1' : sem === 'hk2' ? 'Học kỳ 2' : 'Cả năm';
    const empty = sem === 'cn' ? yearRows.every((r) => r.t1 === null && r.t2 === null && !r.rank) : !hasScores(rows);

    const showToast = (m: string) => {
        setToast(m);
        setTimeout(() => setToast(''), 2400);
    };

    const exportCsv = () => {
        if (!year) return;
        const q = (v: string) => `"${v.replace(/"/g, '""')}"`;
        let head: string[];
        let lines: string[][];
        if (sem === 'cn') {
            head = ['STT', 'Môn học', 'ĐTB HK1', 'ĐTB HK2', 'Cả năm', 'Xếp loại'];
            lines = yearRows.map((r, i) => [String(i + 1), r.name, fmt(r.t1), fmt(r.t2), fmt(r.total), r.rank ?? '']);
        } else {
            head = ['STT', 'Môn học', 'GV bộ môn', 'TX1', 'TX2', 'TX3', 'TX4', 'Giữa kỳ', 'Cuối kỳ', 'TBM', 'Xếp loại'];
            lines = rows.map((r, i) => [String(i + 1), r.subject, r.teacher ?? '', ...r.tx.map(fmt), fmt(r.gk), fmt(r.ck), fmt(tbmOf(r)), rankOfRow(r) ?? '']);
        }
        const csv = '﻿' + [head, ...lines].map((l) => l.map(q).join(',')).join('\r\n');
        const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
        const a = document.createElement('a');
        a.href = url;
        a.download = `bang-diem-${year.label.replace(/[^0-9]+/g, '-').replace(/^-|-$/g, '')}-${sem}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast(`Đã xuất bảng điểm ${semLabel} ${year.label}`);
    };

    /* ----- biểu đồ xu hướng ----- */
    const chart = (() => {
        const W = 560, H = 170, padX = 28, top = 18, bottom = 34;
        const n = history.length;
        const step = n > 1 ? (W - padX * 2) / (n - 1) : 0;
        const y = (v: number) => top + (H - top - bottom) * (1 - v / 10);
        const pts = history.map((p, i) => ({ ...p, x: n > 1 ? padX + step * i : W / 2, y: y(p.value) }));
        return { W, H, pts, y, line: pts.map((p) => `${p.x},${p.y}`).join(' '), top, bottom };
    })();

    if (loading) {
        return (
            <div className="gb-page">
                <div className="gb-skeleton gb-sk-hero" />
                <div className="gb-skeleton gb-sk-bar" />
                <div className="gb-skeleton gb-sk-table" />
            </div>
        );
    }

    if (!data || !year) return null;

    const ringPct = semAvg !== null ? Math.min(100, (semAvg / 10) * 100) : 0;
    const R = 38;
    const C = 2 * Math.PI * R;

    return (
        <div className="gb-page">
            {toast && <div className="gb-toast" role="status">{toast}</div>}

            {demo && (
                <div className="gb-demo" role="status">
                    <Icon name="info" size={18} />
                    <span>Chưa kết nối được API <code>/hs/grades</code> nên đang hiển thị <b>dữ liệu mẫu</b>.</span>
                    <button type="button" onClick={load}><Icon name="refresh" size={15} /> Thử lại</button>
                </div>
            )}

            {/* ===== Hero ===== */}
            <section className="gb-hero">
                <div className="gb-hero-text">
                    <p className="gb-hero-label">Góc học tập</p>
                    <h1>Bảng điểm</h1>
                    <p className="gb-hero-sub">
                        <span><Icon name="user" size={15} /> {data.student.name}</span>
                        <span>Lớp {year.className || '—'}</span>
                        <span>Năm học {year.label}</span>
                    </p>
                </div>

                <div className="gb-hero-card">
                    <div className="gb-ring" aria-hidden="true">
                        <svg viewBox="0 0 100 100">
                            <circle cx="50" cy="50" r={R} className="gb-ring-bg" />
                            <circle
                                cx="50" cy="50" r={R}
                                className="gb-ring-fg"
                                strokeDasharray={C}
                                strokeDashoffset={C - (C * ringPct) / 100}
                                transform="rotate(-90 50 50)"
                            />
                        </svg>
                        <strong>{semAvg !== null ? semAvg.toFixed(1) : '—'}</strong>
                    </div>
                    <div className="gb-hero-card-meta">
                        <span className="gb-hero-card-label">Điểm TB {sem === 'cn' ? 'cả năm' : sem.toUpperCase()}</span>
                        <span className="gb-hero-rank">Học lực: {academic}</span>
                        {delta !== null && (
                            <span className={`gb-delta ${delta >= 0 ? 'up' : 'down'}`}>
                                <Icon name={delta >= 0 ? 'up' : 'down'} size={14} />
                                {delta >= 0 ? '+' : ''}{delta.toFixed(1)} so với {prev?.label}
                            </span>
                        )}
                    </div>
                </div>
            </section>

            {/* ===== Tab liên kết (giữ nguyên các trang con) ===== */}
            <nav className="gb-tabs" aria-label="Mục điểm số">
                <Link href="/student/grades" className="gb-tab active" aria-current="page">Bảng điểm</Link>
                <Link href="/student/grades/summary" className="gb-tab">Tổng kết học kỳ</Link>
                <Link href="/student/grades/subjects" className="gb-tab">Chi tiết môn học</Link>
            </nav>

            {/* ===== Chọn năm học + học kỳ ===== */}
            <section className="gb-picker" aria-label="Chọn năm học và học kỳ">
                <div className="gb-picker-group">
                    <span className="gb-picker-title">Năm học</span>
                    <div className="gb-chips" role="tablist" aria-label="Năm học">
                        {data.years.map((y) => (
                            <button
                                key={y.id}
                                type="button"
                                role="tab"
                                aria-selected={y.id === year.id}
                                className={`gb-chip ${y.id === year.id ? 'is-on' : ''}`}
                                onClick={() => {
                                    setYearId(y.id);
                                    if (sem !== 'cn' && !hasScores(y.semesters[sem]) && hasScores(y.semesters[sem === 'hk1' ? 'hk2' : 'hk1'])) {
                                        setSem(sem === 'hk1' ? 'hk2' : 'hk1');
                                    }
                                }}
                            >
                                {y.label}
                                <small>Lớp {y.className || '—'}</small>
                            </button>
                        ))}
                    </div>
                </div>
                <div className="gb-picker-group">
                    <span className="gb-picker-title">Học kỳ</span>
                    <div className="gb-seg" role="tablist" aria-label="Học kỳ">
                        {(['hk1', 'hk2', 'cn'] as const).map((k) => (
                            <button
                                key={k}
                                type="button"
                                role="tab"
                                aria-selected={sem === k}
                                className={`gb-seg-btn ${sem === k ? 'is-on' : ''}`}
                                onClick={() => setSem(k)}
                            >
                                {k === 'hk1' ? 'Học kỳ 1' : k === 'hk2' ? 'Học kỳ 2' : 'Cả năm'}
                            </button>
                        ))}
                    </div>
                </div>
            </section>

            {/* ===== Thẻ thống kê ===== */}
            <section className="gb-stats" aria-label="Tổng quan kết quả">
                <div className="gb-stat sky">
                    <span className="gb-stat-icon"><Icon name="book" size={20} /></span>
                    <div>
                        <span className="gb-stat-val">{semAvg !== null ? semAvg.toFixed(1) : '—'}</span>
                        <span className="gb-stat-lbl">Điểm trung bình</span>
                    </div>
                </div>
                <div className="gb-stat green">
                    <span className="gb-stat-icon"><Icon name="award" size={20} /></span>
                    <div>
                        <span className="gb-stat-val">{academic}</span>
                        <span className="gb-stat-lbl">Học lực</span>
                    </div>
                </div>
                <div className="gb-stat violet">
                    <span className="gb-stat-icon"><Icon name="heart" size={20} /></span>
                    <div>
                        <span className="gb-stat-val">{conductText}</span>
                        <span className="gb-stat-lbl">Rèn luyện</span>
                    </div>
                </div>
                <div className="gb-stat amber">
                    <span className="gb-stat-icon"><Icon name="star" size={20} /></span>
                    <div>
                        <span className="gb-stat-val gb-stat-text">{best ? best.name : '—'}</span>
                        <span className="gb-stat-lbl">
                            {best ? `Cao nhất · ${best.v.toFixed(1)}` : 'Môn nổi bật'}
                            {weak ? ` · cần cố gắng: ${weak.name} (${weak.v.toFixed(1)})` : ''}
                        </span>
                    </div>
                </div>
            </section>

            {/* ===== Xu hướng điểm ===== */}
            {history.length >= 2 && (
                <section className="gb-panel">
                    <div className="gb-panel-head">
                        <div>
                            <h2>Tiến trình học tập</h2>
                            <p>Điểm trung bình qua các học kỳ · bấm vào một mốc để xem bảng điểm kỳ đó</p>
                        </div>
                    </div>
                    <div className="gb-chart-wrap">
                        <svg className="gb-chart" viewBox={`0 0 ${chart.W} ${chart.H}`} role="group" aria-label={`Điểm trung bình các học kỳ: ${history.map((h) => `${h.label} ${h.value.toFixed(1)}`).join(', ')}`}>
                            {[5, 6.5, 8].map((g) => (
                                <g key={g}>
                                    <line x1="28" x2={chart.W - 28} y1={chart.y(g)} y2={chart.y(g)} className="gb-grid" />
                                    <text x="0" y={chart.y(g) + 4} className="gb-axis">{g}</text>
                                </g>
                            ))}
                            <polyline points={chart.line} className="gb-line" />
                            {chart.pts.map((p) => {
                                const on = p.yid === year.id && p.sem === sem;
                                return (
                                    <g
                                        key={p.key}
                                        className={`gb-pt ${on ? 'is-on' : ''}`}
                                        tabIndex={0}
                                        role="button"
                                        aria-label={`${p.label}: ${p.value.toFixed(1)}`}
                                        onClick={() => { setYearId(p.yid); setSem(p.sem); }}
                                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { setYearId(p.yid); setSem(p.sem); } }}
                                    >
                                        <rect x={p.x - 44} y={0} width={88} height={chart.H} className="gb-hit" />
                                        <circle cx={p.x} cy={p.y} r={on ? 8 : 6} />
                                        <text x={p.x} y={p.y - 14} textAnchor="middle" className="gb-pt-val">{p.value.toFixed(1)}</text>
                                        <text x={p.x} y={chart.H - 10} textAnchor="middle" className="gb-pt-lbl">{p.label}</text>
                                    </g>
                                );
                            })}
                        </svg>
                    </div>
                </section>
            )}

            {/* ===== Bảng điểm ===== */}
            <section className="gb-panel">
                <div className="gb-panel-head">
                    <div>
                        <h2>{semLabel} · Năm học {year.label}</h2>
                        <p>Điểm do giáo viên bộ môn nhập · cập nhật trực tiếp từ hệ thống</p>
                    </div>
                    <button type="button" className="gb-btn" onClick={exportCsv} disabled={empty}>
                        <Icon name="download" size={16} /> Xuất bảng điểm
                    </button>
                </div>

                {empty ? (
                    <div className="gb-empty">
                        <span className="gb-empty-ico"><Icon name="wait" size={28} /></span>
                        <strong>Chưa có điểm {semLabel.toLowerCase()}</strong>
                        <p>Giáo viên bộ môn sẽ nhập điểm trong quá trình giảng dạy. Điểm mới sẽ hiện ở đây ngay khi được cập nhật.</p>
                    </div>
                ) : sem === 'cn' ? (
                    <>
                        <div className="gb-table-wrap gb-desktop">
                            <table className="gb-table">
                                <thead>
                                <tr>
                                    <th className="c-stt">STT</th>
                                    <th className="c-subject">Môn học</th>
                                    <th>ĐTB HK1</th>
                                    <th>ĐTB HK2</th>
                                    <th>Cả năm</th>
                                    <th>Xếp loại</th>
                                </tr>
                                </thead>
                                <tbody>
                                {yearRows.map((r, i) => (
                                    <tr key={r.name}>
                                        <td className="c-stt">{i + 1}</td>
                                        <td className="c-subject">
                                            <Link href={`/student/grades/subjects?mon=${encodeURIComponent(r.name)}&nam=${encodeURIComponent(year.label)}`}>{r.name}</Link>
                                            {r.teacher && <small>GV: {r.teacher}</small>}
                                        </td>
                                        <td><span className={`gb-score ${scoreClass(r.t1)}`}>{fmt(r.t1)}</span></td>
                                        <td><span className={`gb-score ${scoreClass(r.t2)}`}>{fmt(r.t2)}</span></td>
                                        <td className="c-avg"><span className={`gb-score strong ${scoreClass(r.total)}`}>{fmt(r.total)}</span></td>
                                        <td>{r.rank ? <span className={`gb-rank ${rankClass(r.rank)}`}>{r.rank}</span> : <span className="gb-rank rk-none">Chờ điểm</span>}</td>
                                    </tr>
                                ))}
                                </tbody>
                            </table>
                        </div>
                        <div className="gb-cards gb-mobile">
                            {yearRows.map((r) => (
                                <Link key={r.name} href={`/student/grades/subjects?mon=${encodeURIComponent(r.name)}&nam=${encodeURIComponent(year.label)}`} className="gb-card">
                                    <div className="gb-card-top">
                                        <div>
                                            <strong>{r.name}</strong>
                                            {r.teacher && <small>GV: {r.teacher}</small>}
                                        </div>
                                        <span className={`gb-card-tbm ${scoreClass(r.total)}`}>{fmt(r.total)}</span>
                                    </div>
                                    <div className="gb-card-chips">
                                        <span>HK1 <b className={scoreClass(r.t1)}>{fmt(r.t1)}</b></span>
                                        <span>HK2 <b className={scoreClass(r.t2)}>{fmt(r.t2)}</b></span>
                                        {r.rank ? <span className={`gb-rank ${rankClass(r.rank)}`}>{r.rank}</span> : <span className="gb-rank rk-none">Chờ điểm</span>}
                                    </div>
                                </Link>
                            ))}
                        </div>
                    </>
                ) : (
                    <>
                        <div className="gb-table-wrap gb-desktop">
                            <table className="gb-table">
                                <thead>
                                <tr>
                                    <th rowSpan={2} className="c-stt">STT</th>
                                    <th rowSpan={2} className="c-subject">Môn học</th>
                                    <th colSpan={4}>Điểm thường xuyên (TX)</th>
                                    <th rowSpan={2}>Giữa kỳ</th>
                                    <th rowSpan={2}>Cuối kỳ</th>
                                    <th rowSpan={2}>TBM</th>
                                    <th rowSpan={2}>Xếp loại</th>
                                </tr>
                                <tr>
                                    <th className="sub">TX1</th>
                                    <th className="sub">TX2</th>
                                    <th className="sub">TX3</th>
                                    <th className="sub">TX4</th>
                                </tr>
                                </thead>
                                <tbody>
                                {rows.map((r, i) => {
                                    const t = tbmOf(r);
                                    const rk = rankOfRow(r);
                                    const none = r.kind === 'pass';
                                    return (
                                        <tr key={r.id}>
                                            <td className="c-stt">{i + 1}</td>
                                            <td className="c-subject">
                                                <Link href={`/student/grades/subjects?mon=${encodeURIComponent(r.subject)}&nam=${encodeURIComponent(year.label)}`}>{r.subject}</Link>
                                                {(r.teacher || r.updatedAt) && (
                                                    <small>
                                                        {r.teacher ? `GV: ${r.teacher}` : ''}
                                                        {r.teacher && r.updatedAt ? ' · ' : ''}
                                                        {r.updatedAt ? `cập nhật ${r.updatedAt}` : ''}
                                                    </small>
                                                )}
                                            </td>
                                            {r.tx.map((v, k) => (
                                                <td key={k}>{none ? '—' : <span className={`gb-score ${scoreClass(v)}`}>{fmt(v)}</span>}</td>
                                            ))}
                                            <td>{none ? '—' : <span className={`gb-score ${scoreClass(r.gk)}`}>{fmt(r.gk)}</span>}</td>
                                            <td>{none ? '—' : <span className={`gb-score ${scoreClass(r.ck)}`}>{fmt(r.ck)}</span>}</td>
                                            <td className="c-avg">{none ? '—' : <span className={`gb-score strong ${scoreClass(t)}`}>{fmt(t)}</span>}</td>
                                            <td>{rk ? <span className={`gb-rank ${rankClass(rk)}`}>{rk}</span> : <span className="gb-rank rk-none">Chờ điểm</span>}</td>
                                        </tr>
                                    );
                                })}
                                </tbody>
                            </table>
                        </div>

                        <div className="gb-cards gb-mobile">
                            {rows.map((r) => {
                                const t = tbmOf(r);
                                const rk = rankOfRow(r);
                                return (
                                    <Link key={r.id} href={`/student/grades/subjects?mon=${encodeURIComponent(r.subject)}&nam=${encodeURIComponent(year.label)}`} className="gb-card">
                                        <div className="gb-card-top">
                                            <div>
                                                <strong>{r.subject}</strong>
                                                {r.teacher && <small>GV: {r.teacher}</small>}
                                            </div>
                                            {r.kind === 'score' && <span className={`gb-card-tbm ${scoreClass(t)}`}>{fmt(t)}</span>}
                                        </div>
                                        {r.kind === 'score' && (
                                            <div className="gb-card-chips">
                                                {r.tx.map((v, k) => (<span key={k}>TX{k + 1} <b className={scoreClass(v)}>{fmt(v)}</b></span>))}
                                                <span>GK <b className={scoreClass(r.gk)}>{fmt(r.gk)}</b></span>
                                                <span>CK <b className={scoreClass(r.ck)}>{fmt(r.ck)}</b></span>
                                            </div>
                                        )}
                                        <div className="gb-card-foot">
                                            {rk ? <span className={`gb-rank ${rankClass(rk)}`}>{rk}</span> : <span className="gb-rank rk-none">Chờ điểm</span>}
                                        </div>
                                    </Link>
                                );
                            })}
                        </div>
                    </>
                )}

                <div className="gb-legend" aria-label="Chú giải màu điểm">
                    <span><i className="sc-a" /> Từ 8,0 · Giỏi</span>
                    <span><i className="sc-b" /> 6,5 – 7,9 · Khá</span>
                    <span><i className="sc-c" /> 5,0 – 6,4 · Trung bình</span>
                    <span><i className="sc-d" /> Dưới 5,0 · Cần cố gắng</span>
                </div>

                <div className="gb-note">
                    <strong>Ghi chú (Thông tư 22):</strong> ĐTB môn học kỳ = (tổng điểm TX + 2 × Giữa kỳ + 3 × Cuối kỳ) / (số cột TX + 5).
                    ĐTB cả năm = (ĐTB HK1 + 2 × ĐTB HK2) / 3. Các môn Thể dục, Âm nhạc, Mỹ thuật đánh giá Đạt / Chưa đạt.
                </div>
            </section>
        </div>
    );
}