'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import './grades.css';
/* ======================================================================
   BẢNG ĐIỂM HỌC SINH – dữ liệu lấy từ API (do giáo viên bộ môn nhập)

   HỢP ĐỒNG API (backend Laravel cần trả về):
   GET {API}/student/grades?school_year=2025-2026&semester=1
       semester: 1 = HK1 · 2 = HK2 · 0 = Cả năm
       Header: Authorization: Bearer <token>  → API tự biết học sinh nào
   {
     "success": true,
     "data": {
       "student":  { "code": "HS0002", "name": "Trần Thị Học", "class_name": "10A2" },
       "school_year": "2025-2026",
       "semester": 1,
       "years": [                       // các năm học sinh đã/đang học
         { "school_year": "2025-2026", "class_name": "10A2", "is_current": true,
           "gpa_hk1": 8.3, "gpa_hk2": 8.5, "gpa_year": 8.4,
           "academic": "Giỏi", "conduct": "Tốt" }
       ],
       "subjects": [
         { "id": 1, "name": "Toán", "type": "score",          // hoặc "pass_fail"
           "tx": [8.5, 9.0, 8.0, 8.5], "gk": 8.5, "ck": 9.0, "tbm": 8.6,
           "rank": "Giỏi", "teacher": "Nguyễn Văn A", "updated_at": "2026-01-10" }
       ],
       "summary": { "gpa": 8.3, "academic": "Giỏi", "conduct": "Tốt",
                    "rank_in_class": 5, "class_size": 42 }
     }
   }
   (Nhớ thêm điểm = null khi giáo viên chưa nhập.)
   ====================================================================== */
const API = process.env.NEXT_PUBLIC_API_URL || 'http://127.0.0.1:8000/api';

/* Khi API chưa sẵn sàng: ở máy dev tự hiện dữ liệu minh hoạ (có thanh báo).
   Khi chạy thật (production) KHÔNG bao giờ hiện điểm giả cho học sinh. */
const ALLOW_DEMO = process.env.NODE_ENV !== 'production' || process.env.NEXT_PUBLIC_DEMO === '1';

/* ======================================================
   KIỂU DỮ LIỆU
   ====================================================== */
interface Subject {
    id: string;
    name: string;
    tx: (number | null)[];
    gk: number | null;
    ck: number | null;
    tbm: number | null;
    rank: string | null;
    passFail: boolean;
    teacher: string | null;
    updatedAt: string | null;
}

interface YearInfo {
    schoolYear: string;
    className: string;
    isCurrent: boolean;
    gpaHk1: number | null;
    gpaHk2: number | null;
    gpaYear: number | null;
    academic: string | null;
    conduct: string | null;
}

interface Grades {
    student: { code: string; name: string; className: string };
    schoolYear: string;
    semester: string;
    years: YearInfo[];
    subjects: Subject[];
    summary: { gpa: number | null; academic: string | null; conduct: string | null; rankInClass: number | null; classSize: number | null };
}

type Sem = '1' | '2' | '0';
const SEM_LABEL: Record<Sem, string> = { '1': 'Học kỳ 1', '2': 'Học kỳ 2', '0': 'Cả năm' };

/* ======================================================
   CHUẨN HOÁ DỮ LIỆU API (chịu được thiếu trường / tên khác)
   ====================================================== */
function num(v: unknown): number | null {
    const n = typeof v === 'string' ? parseFloat(v) : (v as number);
    return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function normalize(d: any): Grades {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const subjects: Subject[] = (d.subjects || []).map((s: any, i: number) => {
        const tx: unknown[] = Array.isArray(s.tx) ? s.tx : [s.tx1, s.tx2, s.tx3, s.tx4].filter((x) => x !== undefined);
        return {
            id: String(s.id ?? i),
            name: s.name ?? s.subject ?? '',
            tx: tx.map(num),
            gk: num(s.gk ?? s.midterm),
            ck: num(s.ck ?? s.final),
            tbm: num(s.tbm ?? s.average),
            rank: s.rank ?? null,
            passFail: s.type === 'pass_fail',
            teacher: s.teacher ?? null,
            updatedAt: s.updated_at ?? null,
        };
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const years: YearInfo[] = (d.years || []).map((y: any) => ({
        schoolYear: y.school_year,
        className: y.class_name ?? y.class ?? '',
        isCurrent: !!y.is_current,
        gpaHk1: num(y.gpa_hk1),
        gpaHk2: num(y.gpa_hk2),
        gpaYear: num(y.gpa_year),
        academic: y.academic ?? null,
        conduct: y.conduct ?? null,
    }));
    const sm = d.summary || {};
    return {
        student: {
            code: d.student?.code ?? d.student?.id ?? '',
            name: d.student?.name ?? '',
            className: d.student?.class_name ?? d.student?.class ?? '',
        },
        schoolYear: d.school_year,
        semester: String(d.semester ?? '1'),
        years,
        subjects,
        summary: {
            gpa: num(sm.gpa),
            academic: sm.academic ?? null,
            conduct: sm.conduct ?? null,
            rankInClass: num(sm.rank_in_class),
            classSize: num(sm.class_size),
        },
    };
}

/* ======================================================
   DỮ LIỆU MINH HOẠ (từ bảng điểm cũ của bạn) – chỉ dùng khi API chưa có
   ====================================================== */
const DEMO_BASE: [string, number[], number | null, number | null, number | null, string][] = [
    ['Toán', [8.5, 9.0, 8.0, 8.5], 8.5, 9.0, 8.6, 'Giỏi'],
    ['Ngữ văn', [7.5, 8.0, 7.0, 7.5], 7.5, 8.0, 7.6, 'Khá'],
    ['Tiếng Anh', [9.0, 8.5, 9.0, 8.5], 9.0, 8.5, 8.8, 'Giỏi'],
    ['Vật lý', [8.0, 7.5, 8.5, 8.0], 8.0, 7.5, 7.9, 'Khá'],
    ['Hóa học', [7.0, 7.5, 8.0, 7.5], 7.5, 8.0, 7.6, 'Khá'],
    ['Sinh học', [8.5, 8.0, 8.5, 9.0], 8.5, 8.5, 8.5, 'Giỏi'],
    ['Lịch sử', [8.0, 8.5, 7.5, 8.0], 8.0, 8.5, 8.1, 'Giỏi'],
    ['Địa lý', [7.5, 8.0, 7.5, 8.0], 7.5, 8.0, 7.7, 'Khá'],
    ['GDCD', [9.0, 9.0, 8.5, 9.0], 9.0, 9.0, 8.9, 'Giỏi'],
    ['Tin học', [9.5, 9.0, 9.5, 9.0], 9.0, 9.5, 9.3, 'Giỏi'],
    ['Công nghệ', [8.0, 8.5, 8.0, 8.5], 8.0, 8.5, 8.2, 'Giỏi'],
    ['Thể dục', [], null, null, null, 'Đạt'],
];

function demoResponse(year: string | null, sem: Sem): Grades {
    const years: YearInfo[] = [
        { schoolYear: '2025-2026', className: '10A2', isCurrent: false, gpaHk1: 8.3, gpaHk2: 8.5, gpaYear: 8.4, academic: 'Giỏi', conduct: 'Tốt' },
        { schoolYear: '2026-2027', className: '11A2', isCurrent: true, gpaHk1: null, gpaHk2: null, gpaYear: null, academic: null, conduct: null },
    ];
    const y = year ?? '2026-2027';
    const info = years.find((x) => x.schoolYear === y) ?? years[0];
    const d = sem === '2' ? 0.2 : sem === '0' ? 0.1 : 0;
    const sh = (n: number | null) => (n === null ? null : Math.min(10, Math.round((n + d) * 10) / 10));
    const hasData = y === '2025-2026';
    const subjects: Subject[] = hasData
        ? DEMO_BASE.map(([name, tx, gk, ck, tbm, rank], i) => ({
            id: String(i + 1),
            name,
            tx: tx.map((n) => sh(n)),
            gk: sh(gk),
            ck: sh(ck),
            tbm: sh(tbm),
            rank,
            passFail: tbm === null,
            teacher: ['Nguyễn Văn Toàn', 'Lê Thị Hoa', 'Phạm Minh Anh'][i % 3],
            updatedAt: '2026-01-10',
        }))
        : [];
    return {
        student: { code: 'HS0002', name: 'Trần Thị Học', className: info.className },
        schoolYear: y,
        semester: sem,
        years,
        subjects,
        summary: hasData
            ? { gpa: null, academic: 'Giỏi', conduct: 'Tốt', rankInClass: 5, classSize: 42 }
            : { gpa: null, academic: null, conduct: null, rankInClass: null, classSize: null },
    };
}

/* ======================================================
   TIỆN ÍCH HIỂN THỊ
   ====================================================== */
const defaultSemester = (d = new Date()): Sem => (d.getMonth() >= 8 || d.getMonth() === 0 ? '1' : '2');
const yearLabel = (y: string) => y.replace('-', ' – ');
const fmt = (n: number | null) => (n === null ? '—' : n.toFixed(1));

type Tone = 'gioi' | 'kha' | 'tb' | 'dat' | 'yeu' | 'none';
function rankTone(label?: string | null): Tone {
    const s = (label || '').trim().toLowerCase();
    if (s === 'giỏi' || s === 'tốt') return 'gioi';
    if (s === 'khá') return 'kha';
    if (s === 'tb' || s === 'trung bình') return 'tb';
    if (s === 'đạt') return 'dat';
    if (s === 'yếu' || s === 'kém' || s === 'chưa đạt') return 'yeu';
    return 'none';
}

const scoreTone = (n: number | null) => (n === null ? 'none' : n >= 8 ? 'hi' : n >= 6.5 ? 'mid' : n >= 5 ? 'lo' : 'bad');

const TONE_LABEL: Record<Exclude<Tone, 'none'>, string> = { gioi: 'Giỏi / Tốt', kha: 'Khá', tb: 'Trung bình', dat: 'Đạt', yeu: 'Yếu / Chưa đạt' };

function exportCsv(g: Grades, label: string) {
    const nTx = Math.max(4, ...g.subjects.map((s) => s.tx.length));
    const esc = (v: string) => `"${v.replace(/"/g, '""')}"`;
    const head = ['STT', 'Môn học', ...Array.from({ length: nTx }, (_, i) => `TX${i + 1}`), 'Giữa kỳ', 'Cuối kỳ', 'TBM', 'Xếp loại', 'Giáo viên'];
    const rows = g.subjects.map((s, i) =>
        [String(i + 1), s.name, ...Array.from({ length: nTx }, (_, k) => fmt(s.tx[k] ?? null)), fmt(s.gk), fmt(s.ck), fmt(s.tbm), s.rank || '', s.teacher || '']
            .map(esc)
            .join(',')
    );
    const blob = new Blob(['\uFEFF' + [head.map(esc).join(','), ...rows].join('\r\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `bang-diem-${g.student.code || 'hoc-sinh'}-${g.schoolYear}-${label}.csv`.replace(/\s+/g, '-');
    a.click();
    URL.revokeObjectURL(url);
}

/* ======================================================
   ICON (có width/height để không bị phình)
   ====================================================== */
const PATHS = {
    download: (<path d="M12 3v12M7 10l5 5 5-5M4 21h16" />),
    refresh: (<><path d="M21 12a9 9 0 0 0-15-6.7L3 8" /><path d="M3 3v5h5" /><path d="M3 12a9 9 0 0 0 15 6.7L21 16" /><path d="M21 21v-5h-5" /></>),
    search: (<><circle cx="11" cy="11" r="7" /><path d="M21 21l-4.3-4.3" /></>),
    info: (<><circle cx="12" cy="12" r="9" /><path d="M12 8h.01M11 12h1v5h1" /></>),
    book: (<><path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z" /><path d="M4 21h15M9 8h6" /></>),
    calendar: (<><rect x="3" y="4" width="18" height="18" rx="2" /><path d="M16 2v4M8 2v4M3 10h18" /></>),
} as const;

function Icon({ name, size = 18 }: { name: keyof typeof PATHS; size?: number }) {
    return (
        <svg viewBox="0 0 24 24" width={size} height={size} fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {PATHS[name]}
        </svg>
    );
}

/* Vòng tròn điểm TB */
function Ring({ value }: { value: number | null }) {
    const C = 2 * Math.PI * 52;
    const pct = value === null ? 0 : Math.min(1, value / 10);
    return (
        <div className="sg-ring" role="img" aria-label={value === null ? 'Chưa có điểm trung bình' : `Điểm trung bình ${value.toFixed(1)}`}>
            <svg viewBox="0 0 120 120" width="132" height="132" aria-hidden="true">
                <circle cx="60" cy="60" r="52" fill="none" stroke="rgba(255,255,255,0.22)" strokeWidth="10" />
                <circle cx="60" cy="60" r="52" fill="none" stroke="#fde68a" strokeWidth="10" strokeLinecap="round" strokeDasharray={`${pct * C} ${C}`} transform="rotate(-90 60 60)" />
            </svg>
            <div className="sg-ring-text">
                <strong>{value === null ? '—' : value.toFixed(1)}</strong>
                <span>ĐTB</span>
            </div>
        </div>
    );
}

/* Xu hướng điểm qua các năm */
function Trend({ values }: { values: number[] }) {
    if (values.length < 2) return null;
    const W = 160, H = 44, pad = 6;
    const min = Math.min(...values) - 0.3, max = Math.max(...values) + 0.3;
    const pts = values.map((v, i) => [pad + (i * (W - pad * 2)) / (values.length - 1), H - pad - ((v - min) / (max - min || 1)) * (H - pad * 2)]);
    return (
        <svg className="sg-trend" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
            <polyline points={pts.map((p) => p.join(',')).join(' ')} fill="none" stroke="#0369a1" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
            {pts.map((p, i) => <circle key={i} cx={p[0]} cy={p[1]} r="3.5" fill="#fff" stroke="#0369a1" strokeWidth="2" />)}
        </svg>
    );
}

/* ======================================================
   TRANG
   ====================================================== */
export default function StudentGradesPage() {
    const [year, setYear] = useState<string | null>(null); // null = để API trả năm hiện tại
    const [sem, setSem] = useState<Sem>(defaultSemester());
    const [data, setData] = useState<Grades | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [demo, setDemo] = useState(false);
    const [reload, setReload] = useState(0);
    const [query, setQuery] = useState('');

    useEffect(() => {
        const ctrl = new AbortController();
        setLoading(true);
        setError('');

        const qs = new URLSearchParams({ semester: sem });
        if (year) qs.set('school_year', year);

        const token =
            typeof window !== 'undefined'
                ? localStorage.getItem('token') ?? sessionStorage.getItem('token')
                : null;

        // Lấy id học sinh đã login (để API nhận ?user_id= khi chưa có Bearer)
        let userId = '';
        try {
            const raw =
                typeof window !== 'undefined'
                    ? localStorage.getItem('user') ?? sessionStorage.getItem('user')
                    : null;
            if (raw) {
                const u = JSON.parse(raw);
                userId = String(u?.id ?? '');
            }
        } catch {
            /* ignore */
        }

        // Nếu không có token nhưng có user id → gửi user_id (khớp backend test)
        if (!token && userId) {
            qs.set('user_id', userId);
        }

        fetch(`${API}/student/grades?${qs}`, {
            signal: ctrl.signal,
            headers: {
                Accept: 'application/json',
                ...(token ? { Authorization: `Bearer ${token}` } : {}),
            },
        })
            .then((r) => {
                if (!r.ok) throw new Error(String(r.status));
                return r.json();
            })
            .then((json) => {
                if (!json.success) throw new Error('api');
                setData(normalize(json.data));
                setDemo(false);
            })
            .catch((err) => {
                if (err?.name === 'AbortError') return;
                if (ALLOW_DEMO) {
                    setData(demoResponse(year, sem));
                    setDemo(true);
                } else {
                    setError('Không tải được bảng điểm. Vui lòng thử lại sau.');
                }
            })
            .finally(() => {
                if (!ctrl.signal.aborted) setLoading(false);
            });

        return () => ctrl.abort();
    }, [year, sem, reload]);

    /* ---------- số liệu suy ra ---------- */
    const subjects = useMemo(() => data?.subjects ?? [], [data]);
    const scored = subjects.filter((s) => s.tbm !== null);
    const gpa = data?.summary.gpa ?? (scored.length ? scored.reduce((a, s) => a + (s.tbm as number), 0) / scored.length : null);
    const nTx = Math.max(4, ...subjects.map((s) => s.tx.length));

    const dist = useMemo(() => {
        const c: Record<Exclude<Tone, 'none'>, number> = { gioi: 0, kha: 0, tb: 0, dat: 0, yeu: 0 };
        subjects.forEach((s) => {
            const t = rankTone(s.rank);
            if (t !== 'none') c[t] += 1;
        });
        return c;
    }, [subjects]);
    const distTotal = Object.values(dist).reduce((a, b) => a + b, 0);

    const shown = subjects.filter((s) => !query.trim() || s.name.toLowerCase().includes(query.trim().toLowerCase()));

    const lastUpdated = useMemo(() => {
        const times = subjects.map((s) => (s.updatedAt ? Date.parse(s.updatedAt) : NaN)).filter((t) => !Number.isNaN(t));
        return times.length ? new Date(Math.max(...times)).toLocaleDateString('vi-VN') : null;
    }, [subjects]);

    const years = data?.years ?? [];
    const activeYear = year ?? data?.schoolYear ?? null;
    const trendValues = years.map((y) => y.gpaYear).filter((v): v is number => v !== null);
    const academic = data?.summary.academic ?? years.find((y) => y.schoolYear === activeYear)?.academic ?? null;
    const conduct = data?.summary.conduct ?? years.find((y) => y.schoolYear === activeYear)?.conduct ?? null;

    /* ---------- trạng thái lỗi / lần tải đầu ---------- */
    if (error && !data) {
        return (
            <div className="sg-page">
                <div className="sg-alert" role="alert">
                    <span>{error}</span>
                    <button type="button" onClick={() => setReload((n) => n + 1)}>Thử lại</button>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="sg-page" aria-busy="true" aria-label="Đang tải bảng điểm">
                <div className="sg-skel hero" />
                <div className="sg-skel row" />
                <div className="sg-skel tall" />
            </div>
        );
    }

    return (
        <div className="sg-page">
            {demo && (
                <div className="sg-demo" role="status">
                    <Icon name="info" size={16} />
                    Đang hiển thị <b>dữ liệu minh hoạ</b> vì chưa kết nối được API <code>/student/grades</code>.
                </div>
            )}

            {/* ---------- Hero ---------- */}
            <header className="sg-hero">
                <div className="sg-hero-info">
                    <span className="sg-avatar">{data.student.name.charAt(0).toUpperCase() || 'H'}</span>
                    <div>
                        <p className="sg-eyebrow">Góc học tập · Bảng điểm</p>
                        <h1>{data.student.name || 'Học sinh'}</h1>
                        <p className="sg-sub">
                            {data.student.className && <>Lớp {data.student.className} · </>}
                            Năm học {activeYear ? yearLabel(activeYear) : '—'} · {SEM_LABEL[sem]}
                            {data.student.code && <> · Mã HS <b>{data.student.code}</b></>}
                        </p>
                    </div>
                </div>
                <div className="sg-hero-ring">
                    <Ring value={gpa} />
                    <div className="sg-hero-tags">
                        <span className="sg-hero-tag">Học lực: <b>{academic || '—'}</b></span>
                        <span className="sg-hero-tag">Rèn luyện: <b>{conduct || '—'}</b></span>
                    </div>
                </div>
            </header>

            {/* ---------- Chọn năm học / học kỳ ---------- */}
            <section className="sg-picker" aria-label="Chọn năm học và học kỳ">
                <div className="sg-years" role="group" aria-label="Năm học">
                    <span className="sg-picker-label"><Icon name="calendar" size={16} /> Năm học</span>
                    {years.length === 0 && activeYear && <span className="sg-year on">{yearLabel(activeYear)}</span>}
                    {[...years].sort((a, b) => a.schoolYear.localeCompare(b.schoolYear)).map((y) => (
                        <button
                            key={y.schoolYear}
                            type="button"
                            className={`sg-year ${activeYear === y.schoolYear ? 'on' : ''}`}
                            aria-pressed={activeYear === y.schoolYear}
                            onClick={() => setYear(y.schoolYear)}
                        >
                            {yearLabel(y.schoolYear)}
                            {y.className && <small>Lớp {y.className}</small>}
                            {y.isCurrent && <i>Hiện tại</i>}
                        </button>
                    ))}
                </div>
                <div className="sg-seg" role="group" aria-label="Học kỳ">
                    {(['1', '2', '0'] as Sem[]).map((s) => (
                        <button key={s} type="button" className={sem === s ? 'on' : ''} aria-pressed={sem === s} onClick={() => setSem(s)}>
                            {SEM_LABEL[s]}
                        </button>
                    ))}
                </div>
            </section>

            {/* ---------- Điều hướng nhanh (giữ nguyên các trang của bạn) ---------- */}
            <nav className="sg-nav" aria-label="Điều hướng điểm số">
                <Link href="/student/grades" className="active" aria-current="page">Bảng điểm</Link>
                <Link href="/student/grades/summary">Tổng kết học kỳ</Link>
                <Link href="/student/grades/subjects">Chi tiết môn học</Link>
            </nav>

            <div className={loading ? 'sg-body loading' : 'sg-body'} aria-busy={loading}>
                {/* ---------- Thống kê ---------- */}
                <div className="sg-stats">
                    <div className="sg-stat sky">
                        <span className="sg-stat-val">{gpa === null ? '—' : gpa.toFixed(1)}</span>
                        <span className="sg-stat-lbl">Điểm trung bình</span>
                    </div>
                    <div className="sg-stat green">
                        <span className="sg-stat-val">{academic || '—'}</span>
                        <span className="sg-stat-lbl">Học lực</span>
                    </div>
                    <div className="sg-stat violet">
                        <span className="sg-stat-val">{conduct || '—'}</span>
                        <span className="sg-stat-lbl">Rèn luyện</span>
                    </div>
                    <div className="sg-stat amber">
                        <span className="sg-stat-val">
                            {data.summary.rankInClass && data.summary.classSize ? `${data.summary.rankInClass}/${data.summary.classSize}` : subjects.length}
                        </span>
                        <span className="sg-stat-lbl">{data.summary.rankInClass && data.summary.classSize ? 'Thứ hạng trong lớp' : 'Số môn học'}</span>
                    </div>
                </div>

                {subjects.length === 0 ? (
                    <section className="sg-card sg-empty">
                        <Icon name="book" size={34} />
                        <h2>Chưa có điểm cho {SEM_LABEL[sem].toLowerCase()} năm học {activeYear ? yearLabel(activeYear) : ''}</h2>
                        <p>Điểm sẽ hiển thị khi giáo viên bộ môn nhập vào hệ thống. Bạn có thể xem học kỳ hoặc năm học khác.</p>
                        <div className="sg-empty-actions">
                            {(['1', '2', '0'] as Sem[]).filter((s) => s !== sem).map((s) => (
                                <button key={s} type="button" className="sg-btn ghost" onClick={() => setSem(s)}>Xem {SEM_LABEL[s]}</button>
                            ))}
                        </div>
                    </section>
                ) : (
                    <>
                        {/* ---------- Biểu đồ ---------- */}
                        <div className="sg-grid2">
                            <section className="sg-card">
                                <h2 className="sg-h">Điểm trung bình theo môn</h2>
                                <div className="sg-bars">
                                    {scored.map((s) => (
                                        <div key={s.id} className="sg-bar-row">
                                            <span className="sg-bar-name">{s.name}</span>
                                            <span className="sg-bar-track">
                                                <i className={`s-${scoreTone(s.tbm)}`} style={{ width: `${(s.tbm as number) * 10}%` }} />
                                            </span>
                                            <b className={`s-${scoreTone(s.tbm)}`}>{fmt(s.tbm)}</b>
                                        </div>
                                    ))}
                                </div>
                            </section>

                            <section className="sg-card">
                                <h2 className="sg-h">Phân bố xếp loại</h2>
                                {distTotal > 0 && (
                                    <div className="sg-dist" role="img" aria-label="Phân bố xếp loại các môn">
                                        {(Object.keys(dist) as Exclude<Tone, 'none'>[]).filter((k) => dist[k] > 0).map((k) => (
                                            <i key={k} className={`rank-${k}`} style={{ flexGrow: dist[k] }} title={`${TONE_LABEL[k]}: ${dist[k]} môn`} />
                                        ))}
                                    </div>
                                )}
                                <ul className="sg-legend">
                                    {(Object.keys(dist) as Exclude<Tone, 'none'>[]).map((k) => (
                                        <li key={k}><span className={`sg-dot rank-${k}`} />{TONE_LABEL[k]}<b>{dist[k]}</b></li>
                                    ))}
                                </ul>

                                {trendValues.length >= 2 && (
                                    <div className="sg-trendbox">
                                        <span>Xu hướng ĐTB cả năm</span>
                                        <Trend values={trendValues} />
                                    </div>
                                )}
                            </section>
                        </div>

                        {/* ---------- Bảng điểm chi tiết ---------- */}
                        <section className="sg-card">
                            <div className="sg-toolbar">
                                <h2 className="sg-h">Bảng điểm chi tiết</h2>
                                <div className="sg-tools">
                                    <div className="sg-search">
                                        <Icon name="search" size={16} />
                                        <input type="search" placeholder="Tìm môn học..." value={query} onChange={(e) => setQuery(e.target.value)} aria-label="Tìm môn học" />
                                    </div>
                                    <button type="button" className="sg-btn ghost" onClick={() => setReload((n) => n + 1)} disabled={loading}>
                                        <Icon name="refresh" size={16} /> Làm mới
                                    </button>
                                    <button type="button" className="sg-btn primary" onClick={() => exportCsv(data, SEM_LABEL[sem])}>
                                        <Icon name="download" size={16} /> Xuất bảng điểm
                                    </button>
                                </div>
                            </div>

                            <div className="sg-table-wrap">
                                <table className="sg-table">
                                    <thead>
                                    <tr>
                                        <th rowSpan={2} className="c-stt">STT</th>
                                        <th rowSpan={2} className="c-subject">Môn học</th>
                                        <th colSpan={nTx}>Điểm thường xuyên (TX)</th>
                                        <th rowSpan={2}>Giữa kỳ</th>
                                        <th rowSpan={2}>Cuối kỳ</th>
                                        <th rowSpan={2}>TBM</th>
                                        <th rowSpan={2}>Xếp loại</th>
                                    </tr>
                                    <tr>
                                        {Array.from({ length: nTx }, (_, i) => <th key={i} className="sub">TX{i + 1}</th>)}
                                    </tr>
                                    </thead>
                                    <tbody>
                                    {shown.map((s, i) => (
                                        <tr key={s.id}>
                                            <td className="c-stt">{i + 1}</td>
                                            <td className="c-subject">
                                                <Link href={`/student/grades/subjects?mon=${encodeURIComponent(s.name)}`}>{s.name}</Link>
                                                {s.teacher && <small>GV: {s.teacher}</small>}
                                            </td>
                                            {Array.from({ length: nTx }, (_, k) => (
                                                <td key={k}><span className={`sg-score s-${scoreTone(s.tx[k] ?? null)}`}>{fmt(s.tx[k] ?? null)}</span></td>
                                            ))}
                                            <td><span className={`sg-score s-${scoreTone(s.gk)}`}>{fmt(s.gk)}</span></td>
                                            <td><span className={`sg-score s-${scoreTone(s.ck)}`}>{fmt(s.ck)}</span></td>
                                            <td className="c-tbm"><span className={`sg-tbm s-${scoreTone(s.tbm)}`}>{fmt(s.tbm)}</span></td>
                                            <td>{s.rank ? <span className={`sg-rank rank-${rankTone(s.rank)}`}>{s.rank}</span> : '—'}</td>
                                        </tr>
                                    ))}
                                    {shown.length === 0 && (
                                        <tr><td colSpan={nTx + 6} className="sg-none">Không có môn học phù hợp với “{query}”.</td></tr>
                                    )}
                                    </tbody>
                                </table>
                            </div>

                            <div className="sg-note">
                                <p>
                                    <strong>Ghi chú (Thông tư 22):</strong> TBM = (TX×2 + GK×2 + CK×3) / hệ số tương ứng theo quy định từng môn.
                                    Điểm Thể dục, Âm nhạc, Mỹ thuật đánh giá Đạt / Chưa đạt.
                                </p>
                                <p className="sg-source">
                                    Điểm do giáo viên bộ môn nhập{lastUpdated && <> · cập nhật lần cuối <b>{lastUpdated}</b></>}. Nếu thấy sai sót, hãy liên hệ giáo viên bộ môn hoặc giáo viên chủ nhiệm.
                                </p>
                            </div>
                        </section>
                    </>
                )}

                {/* ---------- Lịch sử học tập qua các năm ---------- */}
                {years.length > 0 && (
                    <section className="sg-card">
                        <h2 className="sg-h">Quá trình học tập qua các năm</h2>
                        <div className="sg-history">
                            {[...years].sort((a, b) => a.schoolYear.localeCompare(b.schoolYear)).map((y) => (
                                <button
                                    key={y.schoolYear}
                                    type="button"
                                    className={`sg-hy ${activeYear === y.schoolYear ? 'on' : ''}`}
                                    onClick={() => { setYear(y.schoolYear); setSem('0'); }}
                                >
                                    <span className="sg-hy-top">
                                        <b>{yearLabel(y.schoolYear)}</b>
                                        {y.isCurrent && <i>Đang học</i>}
                                    </span>
                                    <span className="sg-hy-class">{y.className ? `Lớp ${y.className}` : '—'}</span>
                                    <span className="sg-hy-gpa">
                                        <span><small>HK1</small>{fmt(y.gpaHk1)}</span>
                                        <span><small>HK2</small>{fmt(y.gpaHk2)}</span>
                                        <span className="strong"><small>Cả năm</small>{fmt(y.gpaYear)}</span>
                                    </span>
                                    <span className="sg-hy-tags">
                                        {y.academic && <em className={`rank-${rankTone(y.academic)}`}>{y.academic}</em>}
                                        {y.conduct && <em className="rank-dat">RL: {y.conduct}</em>}
                                    </span>
                                </button>
                            ))}
                        </div>
                    </section>
                )}
            </div>
        </div>
    );
}