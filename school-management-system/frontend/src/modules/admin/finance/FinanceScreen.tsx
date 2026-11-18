'use client';

import { useCallback, useEffect, useState } from 'react';
import { ToastProvider } from '@/components/Toast';
import { apiError, finApi } from '@/services/adminFinanceService';
import { ErrorBox, Icon, Skeleton, fp, short, vnd } from './ui';
import type { Filters, Meta, Overview, TabKey } from './types';
import OverviewTab from './tabs/OverviewTab';
import InvoicesTab from './tabs/InvoicesTab';
import PaymentsTab from './tabs/PaymentsTab';
import DebtsTab from './tabs/DebtsTab';
import PeriodsTab from './tabs/PeriodsTab';
import WaiversTab from './tabs/WaiversTab';
import DisputesTab from './tabs/DisputesTab';
import AuditTab from './tabs/AuditTab';
import s from './finance.module.css';

const TABS: { key: TabKey; label: string; icon: string }[] = [
    { key: 'overview', label: 'Tổng quan', icon: 'chart' }, { key: 'invoices', label: 'Hóa đơn', icon: 'receipt' },
    { key: 'payments', label: 'Thanh toán', icon: 'wallet' }, { key: 'debts', label: 'Công nợ', icon: 'alert' },
    { key: 'periods', label: 'Đợt thu & khoản thu', icon: 'calendar' }, { key: 'waivers', label: 'Miễn giảm', icon: 'percent' },
    { key: 'disputes', label: 'Khiếu nại', icon: 'chat' }, { key: 'audit', label: 'Nhật ký', icon: 'list' },
];
const isTab = (v: string): v is TabKey => TABS.some((t) => t.key === v);

function Screen() {
    const [meta, setMeta] = useState<Meta | null>(null);
    const [f, setF] = useState<Filters | null>(null);
    const [ov, setOv] = useState<Overview | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<TabKey>('overview');
    const [spin, setSpin] = useState(false);

    useEffect(() => {
        finApi.meta().then((m) => { setMeta(m); setF({ year_id: m.current_year_id, period_id: 0, grade: 0 }); }).catch((e) => setError(apiError(e).message));
    }, []);

    const loadOv = useCallback(async (flt: Filters) => {
        setSpin(true);
        try { setOv(await finApi.overview(fp(flt))); setError(null); } catch (e) { setError(apiError(e).message); } finally { setSpin(false); }
    }, []);
    useEffect(() => { if (f) loadOv(f); }, [f, loadOv]);

    useEffect(() => {
        const read = () => { const h = window.location.hash.slice(1); if (isTab(h)) setTab(h); };
        read(); window.addEventListener('hashchange', read); return () => window.removeEventListener('hashchange', read);
    }, []);
    const go = useCallback((t: TabKey) => { setTab(t); history.replaceState(null, '', `#${t}`); window.scrollTo({ top: 0, behavior: 'smooth' }); }, []);

    if (error && !ov) return <div style={{ padding: 24 }}><ErrorBox message={error} onRetry={() => { setError(null); if (f) loadOv(f); else window.location.reload(); }} /></div>;
    if (!meta || !f || !ov) return <div style={{ padding: 24 }}><Skeleton h={190} /><Skeleton h={90} n={2} /></div>;

    const t = ov.totals;
    const periods = meta.periods.filter((p) => p.school_year_id === f.year_id);
    const refresh = () => loadOv(f);
    const KPI = [
        { l: 'Tổng phải thu', n: t.invoiced, sub: `${t.n} hóa đơn · miễn giảm ${short(t.discount)}`, i: 'money', bg: '#e0f4fa', fg: '#0891b2' },
        { l: 'Đã thu', n: t.paid, sub: `Tỷ lệ thu ${t.rate}%`, i: 'wallet', bg: '#dbeafe', fg: '#0369a1' },
        { l: 'Còn phải thu', n: t.remaining, sub: `${t.debtors} học sinh còn nợ`, i: 'percent', bg: '#fef3c7', fg: '#d97706' },
        { l: 'Nợ quá hạn', n: t.overdue_amt, sub: `${t.overdue_students} học sinh · ${t.overdue_n} hóa đơn`, i: 'alert', bg: '#ffe4e6', fg: '#e11d48' },
        { l: 'Chờ xác nhận', n: ov.pending.amt, sub: `${ov.pending.n} phiếu thu`, i: 'receipt', bg: '#ede9fe', fg: '#7c3aed' },
    ];

    return (
        <div className={s.root}>
            <header className={s.hero}>
                <div className={s.heroTop}>
                    <div className={s.heroTitle}>
                        <div className={s.heroIcon}><Icon n="money" size={24} /></div>
                        <div>Học phí & Tài chính<div className={s.heroSub}>Giám sát thu – chi, công nợ và các đợt thu của toàn trường</div></div>
                    </div>
                    <div className={s.fbar}>
                        <select className={s.hsel} value={f.year_id} onChange={(e) => setF({ year_id: Number(e.target.value), period_id: 0, grade: f.grade })} aria-label="Năm học">
                            {meta.years.map((y) => <option key={y.id} value={y.id}>Năm học {y.label}{y.is_current ? ' (hiện hành)' : ''}</option>)}
                        </select>
                        <select className={s.hsel} value={f.period_id} onChange={(e) => setF({ ...f, period_id: Number(e.target.value) })} aria-label="Đợt thu">
                            <option value={0}>Tất cả đợt thu</option>{periods.map((p) => <option key={p.id} value={p.id}>{p.name || p.code}</option>)}
                        </select>
                        <select className={s.hsel} value={f.grade} onChange={(e) => setF({ ...f, grade: Number(e.target.value) })} aria-label="Khối" style={{ minWidth: 110 }}>
                            <option value={0}>Mọi khối</option><option value={10}>Khối 10</option><option value={11}>Khối 11</option><option value={12}>Khối 12</option>
                        </select>
                        <button className={s.hbtn} onClick={refresh} disabled={spin}>{spin ? <span className={s.spin} /> : <Icon n="refresh" size={16} />} Làm mới</button>
                    </div>
                </div>
            </header>

            <div className={s.wrap}>
                <div className={s.kpis} style={{ gridTemplateColumns: 'repeat(5,minmax(0,1fr))' }}>
                    {KPI.map((k) => (
                        <div key={k.l} className={s.kpi}>
                            <div className={s.kpiTop}><span>{k.l}</span><span className={s.kpiIco} style={{ background: k.bg, color: k.fg }}><Icon n={k.i} size={18} /></span></div>
                            <div className={s.kpiNum} title={vnd(k.n)}>{short(k.n)} ₫</div>
                            <div className={s.kpiSub}>{k.sub}</div>
                        </div>))}
                </div>

                <nav className={s.tabs} aria-label="Chức năng tài chính">
                    {TABS.map((x) => (
                        <button key={x.key} aria-current={tab === x.key ? 'page' : undefined} className={`${s.tab} ${tab === x.key ? s.tabOn : ''}`} onClick={() => go(x.key)}>
                            <Icon n={x.icon} size={16} /> {x.label}
                            {x.key === 'payments' && ov.pending.n > 0 && <span className={s.tabN}>{ov.pending.n}</span>}
                            {x.key === 'disputes' && ov.disputes_open > 0 && <span className={s.tabN}>{ov.disputes_open}</span>}
                        </button>))}
                </nav>

                <main style={{ opacity: spin ? 0.7 : 1, transition: '.2s' }}>
                    {tab === 'overview' && <OverviewTab ov={ov} go={go} />}
                    {tab === 'invoices' && <InvoicesTab f={f} />}
                    {tab === 'payments' && <PaymentsTab f={f} onChanged={refresh} />}
                    {tab === 'debts' && <DebtsTab f={f} onChanged={refresh} />}
                    {tab === 'periods' && <PeriodsTab f={f} onChanged={refresh} />}
                    {tab === 'waivers' && <WaiversTab f={f} />}
                    {tab === 'disputes' && <DisputesTab f={f} onChanged={refresh} />}
                    {tab === 'audit' && <AuditTab />}
                </main>
            </div>
        </div>
    );
}

export default function FinanceScreen() {
    return <ToastProvider><Screen /></ToastProvider>;
}