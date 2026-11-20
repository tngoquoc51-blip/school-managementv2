'use client';

import { useCallback, useEffect, useState } from 'react';
import { ToastProvider } from '@/components/Toast';
import { apiError, cmtApi } from '@/services/teacherCommentService';
import { Empty, ErrorBox, Icon, Skeleton } from './ui';
import type { Filters, Kind, Meta, Overview, TabKey } from './types';
import OverviewTab from './tabs/OverviewTab';
import WriteTab from './tabs/WriteTab';
import InsightsTab from './tabs/InsightsTab';
import TemplatesTab from './tabs/TemplatesTab';
import HistoryTab from './tabs/HistoryTab';
import s from './comments.module.css';

const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Tổng quan', icon: 'chart' }, { key: 'write', label: 'Soạn nhận xét', icon: 'pen' },
    { key: 'insights', label: 'Cần quan tâm', icon: 'alert' }, { key: 'templates', label: 'Mẫu nhận xét', icon: 'template' },
    { key: 'history', label: 'Lịch sử & xuất file', icon: 'list' },
];
const isTab = (v: string): v is TabKey => TABS.some((t) => t.key === v);
const thisMonth = () => new Date().toLocaleDateString('sv-SE').slice(0, 7);
const periodOf = (k: Kind) => (k === 'midterm' ? 'GK' : k === 'final' ? 'CK' : thisMonth());

function Screen() {
    const [meta, setMeta] = useState<Meta | null>(null);
    const [f, setF] = useState<Filters | null>(null);
    const [ov, setOv] = useState<Overview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>('overview');
    const [spin, setSpin] = useState(false);

    useEffect(() => {
        cmtApi.meta().then((m) => { setMeta(m); setF({ cs: m.assignments[0]?.id ?? 0, semester: m.semester, kind: 'midterm', period: 'GK' }); }).catch((e) => setError(apiError(e).message));
    }, []);

    const loadOv = useCallback(async (flt: Filters) => {
        setSpin(true);
        try { setOv(await cmtApi.overview(flt)); setError(null); } catch (e) { setError(apiError(e).message); } finally { setSpin(false); }
    }, []);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => { if (f) loadOv(f); }, [f?.semester, f?.kind, f?.period, loadOv]);

    useEffect(() => {
        const read = () => { const h = window.location.hash.slice(1); if (isTab(h)) setTab(h); };
        read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
    }, []);
    const go = useCallback((t: TabKey) => { setTab(t); history.replaceState(null, '', `#${t}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

    if (error && !ov) return <div style={{ padding: 24 }}><ErrorBox message={error} onRetry={() => window.location.reload()} /></div>;
    if (!meta || !f || !ov) return <div style={{ padding: 24 }}><Skeleton h={190} /><Skeleton h={90} n={2} /></div>;
    if (meta.assignments.length === 0) return <div style={{ padding: 24 }}><div className={s.card}><Empty icon="📚" text="Bạn chưa được phân công dạy lớp – môn nào trong năm học hiện tại nên chưa có học sinh để nhận xét." /></div></div>;

    const k = ov.kpi; const left = Math.max(0, k.students - k.written); const pct = k.students ? Math.round((k.written / k.students) * 100) : 0;
    const refresh = () => loadOv(f);
    const KPI = [
        { l: 'Học sinh phụ trách', n: k.students, sub: `${meta.assignments.length} lớp – môn`, i: 'users', bg: '#e0f4fa', fg: '#0891b2' },
        { l: 'Đã nhận xét', n: k.written, sub: `Hoàn thành ${pct}%`, i: 'check', bg: '#dcfce7', fg: '#16a34a' },
        { l: 'Bản nháp', n: k.draft, sub: 'Chưa công bố', i: 'edit', bg: '#dbeafe', fg: '#0369a1' },
        { l: 'Đã công bố', n: k.published, sub: 'Học sinh, phụ huynh xem được', i: 'send', bg: '#ccfbf1', fg: '#0d9488' },
        { l: 'Chưa nhận xét', n: left, sub: left ? 'Cần hoàn thành' : 'Đã đủ 100%', i: 'alert', bg: left ? '#fef3c7' : '#dcfce7', fg: left ? '#d97706' : '#16a34a' },
    ];

    return (
        <div className={s.root}>
            <header className={s.hero}>
                <div className={s.heroTop}>
                    <div className={s.heroTitle}>
                        <div className={s.heroIcon}><Icon n="chat" size={24} /></div>
                        <div>Nhận xét học sinh<div className={s.heroSub}>Ghi nhận xét, đánh giá quá trình học tập của học sinh trong các lớp bạn dạy</div></div>
                    </div>
                    <div className={s.fbar}>
                        <select className={s.hsel} value={f.cs} onChange={(e) => setF({ ...f, cs: Number(e.target.value) })} aria-label="Lớp – môn">
                            {meta.assignments.map((a) => <option key={a.id} value={a.id}>Lớp {a.class_name} · {a.subject_name}</option>)}
                        </select>
                        <select className={s.hsel} value={f.semester} onChange={(e) => setF({ ...f, semester: Number(e.target.value) })} aria-label="Học kỳ" style={{ minWidth: 110 }}>
                            {meta.semesters.map((x) => <option key={x.code} value={x.code}>{x.name}</option>)}
                        </select>
                        <select className={s.hsel} value={f.kind} onChange={(e) => { const kd = e.target.value as Kind; setF({ ...f, kind: kd, period: periodOf(kd) }); }} aria-label="Kỳ nhận xét" style={{ minWidth: 130 }}>
                            <option value="midterm">Giữa kỳ</option><option value="final">Cuối kỳ</option><option value="monthly">Hằng tháng</option>
                        </select>
                        {f.kind === 'monthly' && <input type="month" className={s.hsel} value={f.period} onChange={(e) => e.target.value && setF({ ...f, period: e.target.value })} aria-label="Tháng" style={{ minWidth: 140 }} />}
                        <button className={s.hbtn} onClick={refresh} disabled={spin}>{spin ? <span className={s.spin} /> : <Icon n="refresh" size={16} />} Làm mới</button>
                    </div>
                </div>
            </header>

            <div className={s.wrap}>
                <div className={s.kpis} style={{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))' }}>
                    {KPI.map((x) => (
                        <div key={x.l} className={s.kpi}>
                            <div className={s.kpiTop}><span>{x.l}</span><span className={s.kpiIco} style={{ background: x.bg, color: x.fg }}><Icon n={x.i} size={18} /></span></div>
                            <div className={s.kpiNum}>{x.n}</div><div className={s.kpiSub}>{x.sub}</div>
                        </div>))}
                </div>

                <nav className={s.tabs} aria-label="Chức năng nhận xét">
                    {TABS.map((x) => (
                        <button key={x.key} aria-current={tab === x.key ? 'page' : undefined} className={`${s.tab} ${tab === x.key ? s.tabOn : ''}`} onClick={() => go(x.key)}>
                            <Icon n={x.icon} size={16} /> {x.label}{x.key === 'write' && left > 0 && <span className={s.tabN}>{left}</span>}
                        </button>))}
                </nav>

                <main style={{ opacity: spin ? 0.7 : 1, transition: '.2s' }}>
                    {tab === 'overview' && <OverviewTab ov={ov} pick={(cs) => { setF({ ...f, cs }); go('write'); }} go={go} />}
                    {tab === 'write' && <WriteTab f={f} onChanged={refresh} />}
                    {tab === 'insights' && <InsightsTab f={f} onChanged={refresh} />}
                    {tab === 'templates' && <TemplatesTab />}
                    {tab === 'history' && <HistoryTab meta={meta} onChanged={refresh} />}
                </main>
            </div>
        </div>
    );
}

export default function CommentsScreen() {
    return <ToastProvider><Screen /></ToastProvider>;
}