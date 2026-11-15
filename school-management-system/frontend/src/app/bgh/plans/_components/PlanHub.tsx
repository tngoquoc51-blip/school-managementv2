'use client';

import { useCallback, useEffect, useState } from 'react';
import { pl } from '../_lib/api';
import { PlError } from '../_lib/http';
import { ToastProvider, useToast } from '../_lib/toast';
import { STATUS_ORDER } from '../_lib/types';
import type { Filters, Options, Plan, Stats, Summary } from '../_lib/types';
import { Icon, num } from './ui';
import ConnectionPanel from './ConnectionPanel';
import Dashboard from './Dashboard';
import PlanList from './PlanList';
import PlanBoard from './PlanBoard';
import PlanTimeline from './PlanTimeline';
import PlanDrawer from './PlanDrawer';
import { PlanForm, TemplateModal } from './PlanForm';
import '../plans.css';

type View = 'dashboard' | 'list' | 'board' | 'timeline';
const VIEWS: { id: View; label: string; icon: string }[] = [
    { id: 'dashboard', label: 'Tổng quan', icon: 'layers2' },
    { id: 'list', label: 'Danh sách', icon: 'list' },
    { id: 'board', label: 'Bảng Kanban', icon: 'kanban' },
    { id: 'timeline', label: 'Dòng thời gian', icon: 'gantt' },
];
const QUICK = [['', 'Tất cả'], ['mine', 'Của tôi'], ['pending', 'Chờ phê duyệt'], ['soon', 'Sắp đến hạn'], ['late', 'Trễ hạn']] as const;
const DEFAULT: Filters = { q: '', status: '', level: '', category: '', school_year: '', priority: '', owner: '', view: '', sort: 'updated', dir: 'desc', page: 1 };

function Inner() {
    const toast = useToast();
    const [opts, setOpts] = useState<Options | null>(null);
    const [view, setView] = useState<View>('dashboard');
    const [f, setF] = useState<Filters>(DEFAULT);
    const [qIn, setQIn] = useState('');
    const [rows, setRows] = useState<Plan[]>([]);
    const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number; summary: Summary } | null>(null);
    const [stats, setStats] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<{ message: string; status?: number } | null>(null);
    const [drawer, setDrawer] = useState<number | null>(null);
    const [form, setForm] = useState<{ plan?: Plan } | null>(null);
    const [tpl, setTpl] = useState(false);

    const fail = (e: unknown) => setError({ message: e instanceof Error ? e.message : 'Không tải được dữ liệu.', status: e instanceof PlError ? e.status : undefined });

    const loadOpts = useCallback(async () => {
        setError(null);
        try { setOpts(await pl.options()); } catch (e) { fail(e); setLoading(false); }
    }, []);
    useEffect(() => { loadOpts(); }, [loadOpts]);

    useEffect(() => { const t = setTimeout(() => setF((x) => (x.q === qIn ? x : { ...x, q: qIn, page: 1 })), 350); return () => clearTimeout(t); }, [qIn]);

    const refresh = useCallback(async () => {
        if (!opts) return;
        setLoading(true);
        try {
            if (view === 'dashboard') setStats(await pl.stats(f.school_year || undefined));
            else if (view === 'list') { const r = await pl.list({ ...f, per_page: 12 }); setRows(r.rows); setMeta(r.meta); }
            else { const r = await pl.list({ ...f, all: true, page: 1 }); setRows(r.rows); setMeta(r.meta); }
            setError(null);
        } catch (e) { fail(e); } finally { setLoading(false); }
    }, [opts, view, f]);
    useEffect(() => { refresh(); }, [refresh]);

    const setFilter = (k: keyof Filters, v: string) => setF((x) => ({ ...x, [k]: v, page: 1 }));
    const goList = (patch: Partial<Filters>) => { setF({ ...DEFAULT, ...patch }); setQIn(''); setView('list'); };

    const transition = async (p: Plan, to: string) => {
        try {
            await pl.transition(p.id, to);
            toast({ tone: 'success', title: `${p.code}: ${opts?.statuses[to] ?? to}` });
            refresh();
        } catch (e) { toast({ tone: 'error', title: 'Không chuyển được trạng thái', text: e instanceof Error ? e.message : '' }); }
    };

    const exportCsv = async () => {
        try {
            const r = await pl.list({ ...f, all: true, page: 1 });
            const esc = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;
            const head = ['Mã', 'Tên kế hoạch', 'Cấp', 'Lĩnh vực', 'Năm học', 'Phụ trách', 'Bắt đầu', 'Kết thúc', 'Trạng thái', 'Ưu tiên', 'Tiến độ %', 'Dự toán', 'Đã chi'];
            const lines = r.rows.map((p) => [p.code, p.title, opts?.levels[p.level], opts?.categories[p.category], p.school_year, p.owner_name, p.start_date, p.end_date, opts?.statuses[p.status], opts?.priorities[p.priority], p.progress, p.budget, p.spent]);
            const a = document.createElement('a');
            a.href = URL.createObjectURL(new Blob(['\ufeff' + [head, ...lines].map((l) => l.map(esc).join(',')).join('\r\n')], { type: 'text/csv;charset=utf-8' }));
            a.download = `ke-hoach-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a); a.click(); a.remove();
            toast({ tone: 'success', title: 'Đã xuất danh sách', text: `${num(r.rows.length)} kế hoạch` });
        } catch (e) { toast({ tone: 'error', title: 'Xuất thất bại', text: e instanceof Error ? e.message : '' }); }
    };

    const pendingN = view === 'dashboard' ? stats?.by_status?.pending : meta?.summary.by_status.pending;
    const lateN = view === 'dashboard' ? stats?.late.length : meta?.summary.late;

    return (
        <div className="pl">
            <section className="pl-hero">
                <i className="pl-orb o1" /><i className="pl-orb o2" /><i className="pl-orb o3" />
                <div>
                    <h1>Kế hoạch nhà trường</h1>
                    <p>Lập, phê duyệt và theo dõi kế hoạch năm học – học kỳ – chuyên đề; chia nhiệm vụ, cập nhật tiến độ, liên kết với các chức năng khác của cổng Ban Giám hiệu.</p>
                </div>
                <div className="pl-actions">
                    <button className="pl-btn white" onClick={() => setForm({})}><Icon n="plus" s={16} />Kế hoạch mới</button>
                    <button className="pl-btn glass" onClick={() => setTpl(true)}><Icon n="layers2" s={16} />Tạo từ mẫu</button>
                    <button className="pl-btn glass" onClick={exportCsv}><Icon n="download" s={16} />Xuất CSV</button>
                    <button className="pl-btn glass" onClick={() => { loadOpts(); refresh(); }} disabled={loading}><Icon n="history" s={16} />Làm mới</button>
                </div>
            </section>

            {error && <ConnectionPanel message={error.message} status={error.status} onRetry={() => { loadOpts(); }} />}

            {opts && !error && (
                <>
                    {((pendingN ?? 0) > 0 || (lateN ?? 0) > 0) && (
                        <div className="pl-banner" role="status">
                            <Icon n="alert" s={18} />
                            {(pendingN ?? 0) > 0 && <span><b>{pendingN}</b> kế hoạch đang chờ phê duyệt</span>}
                            {(lateN ?? 0) > 0 && <span>· <b>{lateN}</b> kế hoạch trễ hạn</span>}
                            <button className="pl-btn ghost sm" onClick={() => goList({ view: (pendingN ?? 0) > 0 ? 'pending' : 'late' })}>Xem ngay</button>
                        </div>
                    )}

                    <nav className="pl-tabs" role="tablist">
                        {VIEWS.map((v) => (
                            <button key={v.id} role="tab" aria-selected={view === v.id} className={view === v.id ? 'on' : ''} onClick={() => setView(v.id)}><Icon n={v.icon} s={16} />{v.label}</button>
                        ))}
                    </nav>

                    {view !== 'dashboard' && (
                        <div className="pl-stack">
                            <div className="pl-chips">
                                {QUICK.map(([k, l]) => (
                                    <button key={k} className={`pl-chip${f.view === k ? ' on' : ''}`} onClick={() => setFilter('view', k)}>{l}{k === 'pending' && (pendingN ?? 0) > 0 && <em>{pendingN}</em>}{k === 'late' && (lateN ?? 0) > 0 && <em>{lateN}</em>}</button>
                                ))}
                            </div>
                            <div className="pl-toolbar">
                                <input className="pl-in" type="search" placeholder="Tìm theo tên, mã, người phụ trách…" value={qIn} onChange={(e) => setQIn(e.target.value)} />
                                <select className="pl-in" value={f.status} onChange={(e) => setFilter('status', e.target.value)}><option value="">Mọi trạng thái</option>{STATUS_ORDER.map((s) => <option key={s} value={s}>{opts.statuses[s]}</option>)}</select>
                                <select className="pl-in" value={f.level} onChange={(e) => setFilter('level', e.target.value)}><option value="">Mọi cấp</option>{Object.entries(opts.levels).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                                <select className="pl-in" value={f.category} onChange={(e) => setFilter('category', e.target.value)}><option value="">Mọi lĩnh vực</option>{Object.entries(opts.categories).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                                <select className="pl-in" value={f.school_year} onChange={(e) => setFilter('school_year', e.target.value)}><option value="">Mọi năm học</option>{opts.school_years.map((y) => <option key={y} value={y}>{y}</option>)}</select>
                                <select className="pl-in" value={f.priority} onChange={(e) => setFilter('priority', e.target.value)}><option value="">Mọi mức ưu tiên</option>{Object.entries(opts.priorities).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                                <select className="pl-in" value={f.owner} onChange={(e) => setFilter('owner', e.target.value)}><option value="">Mọi người phụ trách</option>{opts.owners.map((o) => <option key={o} value={o}>{o}</option>)}</select>
                            </div>
                        </div>
                    )}

                    {view === 'dashboard' && (
                        <Dashboard stats={stats} loading={loading} opts={opts} year={f.school_year} onYear={(y) => setFilter('school_year', y)}
                                   onOpen={setDrawer} onList={goList} />
                    )}
                    {view === 'list' && <PlanList rows={rows} meta={meta} f={f} setF={setF} loading={loading} opts={opts} onOpen={setDrawer} />}
                    {view === 'board' && <PlanBoard rows={rows} loading={loading} opts={opts} onOpen={setDrawer} onMove={transition} />}
                    {view === 'timeline' && <PlanTimeline rows={rows} loading={loading} opts={opts} year={f.school_year || opts.current_year} onOpen={setDrawer} />}
                </>
            )}

            {drawer !== null && opts && (
                <PlanDrawer id={drawer} opts={opts} onClose={() => setDrawer(null)} onChanged={refresh} onOpen={setDrawer}
                            onEdit={(p) => { setDrawer(null); setForm({ plan: p }); }} />
            )}
            {form && opts && <PlanForm opts={opts} plan={form.plan} onClose={() => setForm(null)} onSaved={(id) => { setForm(null); refresh(); setDrawer(id); }} />}
            {tpl && opts && <TemplateModal opts={opts} onClose={() => setTpl(false)} onCreated={(id) => { setTpl(false); refresh(); setDrawer(id); }} />}
        </div>
    );
}

export default function PlanHub() {
    return (
        <ToastProvider>
            <Inner />
        </ToastProvider>
    );
}