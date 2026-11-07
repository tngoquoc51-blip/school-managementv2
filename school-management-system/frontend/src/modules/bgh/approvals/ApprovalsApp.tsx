'use client';

import { useCallback, useEffect, useState, type KeyboardEvent } from 'react';
import s from './approvals.module.css';
import { approvals, errMsg, type Counts, type Overview, type Row } from '@/services/bghApproval';
import { Icon, PRIORITY_LABEL, ROLE_LABEL, STATUS_LABEL, ToastProvider, TYPE_ICON, fmtMoney, slaText, useToast } from './ui';
import DetailPane from './DetailPane';
import { DelegationPanel, ReportPanel, TypesPanel } from './Panels';

type View = 'inbox' | 'report' | 'types' | 'delegation';
type Tab = 'todo' | 'waiting' | 'approved' | 'rejected' | 'returned' | 'all';
const TABS: { key: Tab; label: string; icon: string; count: keyof Counts }[] = [
    { key: 'todo', label: 'Chờ tôi duyệt', icon: 'inbox', count: 'todo' },
    { key: 'waiting', label: 'Chờ cấp trên', icon: 'forward', count: 'waiting' },
    { key: 'approved', label: 'Đã phê duyệt', icon: 'check', count: 'approved' },
    { key: 'rejected', label: 'Đã từ chối', icon: 'x', count: 'rejected' },
    { key: 'returned', label: 'Đã trả lại', icon: 'undo', count: 'returned' },
    { key: 'all', label: 'Tất cả', icon: 'doc', count: 'total' },
];
const VIEWS: { key: View; label: string; icon: string }[] = [
    { key: 'inbox', label: 'Hộp phê duyệt', icon: 'inbox' }, { key: 'report', label: 'Báo cáo', icon: 'chart' },
    { key: 'types', label: 'Loại phê duyệt', icon: 'sliders' }, { key: 'delegation', label: 'Ủy quyền', icon: 'users' },
];
const ZERO: Counts = { todo: 0, waiting: 0, approved: 0, rejected: 0, returned: 0, total: 0, overdue: 0 };

export default function ApprovalsApp() {
    return <div className={s.app}><ToastProvider><Workspace /></ToastProvider></div>;
}

function Workspace() {
    const toast = useToast();
    const [view, setView] = useState<View>('inbox');
    const [ov, setOv] = useState<Overview | null>(null);
    const [counts, setCounts] = useState<Counts>(ZERO);
    const [tab, setTab] = useState<Tab>('todo');
    const [typeCode, setTypeCode] = useState('');
    const [priority, setPriority] = useState('');
    const [overdue, setOverdue] = useState(false);
    const [q, setQ] = useState('');
    const [qd, setQd] = useState('');
    const [page, setPage] = useState(1);
    const [rows, setRows] = useState<Row[]>([]);
    const [meta, setMeta] = useState<{ current_page: number; last_page: number; total: number } | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [sel, setSel] = useState<number | null>(null);
    const [checked, setChecked] = useState<number[]>([]);
    const [bulkNote, setBulkNote] = useState<string | null>(null);
    const [syncing, setSyncing] = useState(false);
    const [mobileDetail, setMobileDetail] = useState(false);

    useEffect(() => { const t = setTimeout(() => { setQd(q.trim()); setPage(1); }, 300); return () => clearTimeout(t); }, [q]);

    const loadOv = useCallback(async () => {
        try { const r = await approvals.overview(); setOv(r.data as Overview); }
        catch (e) { toast.push('error', 'Không tải được tổng quan', errMsg(e)); }
    }, [toast]);

    const loadList = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const r = await approvals.list({ tab, type_code: typeCode || undefined, priority: priority || undefined, overdue: overdue ? 1 : undefined, q: qd || undefined, page, per_page: 20 });
            const items = r.data as Row[];
            setRows(items); setMeta(r.meta); setCounts(r.meta.counts as Counts); setChecked([]);
            setSel((cur) => (cur !== null && items.some((x) => x.id === cur) ? cur : items[0]?.id ?? null));
        } catch (e) { setError(errMsg(e)); } finally { setLoading(false); }
    }, [tab, typeCode, priority, overdue, qd, page]);

    useEffect(() => { loadList(); }, [loadList]);
    useEffect(() => { loadOv(); }, [loadOv]);
    // Mở trang: tự kéo các đơn nghỉ dài ngày mới từ cổng học sinh vào hộp phê duyệt
    useEffect(() => {
        approvals.sync().then((r: any) => {
            const n = r?.data?.added ?? 0;
            if (n > 0) { toast.push('info', 'Có yêu cầu mới', `${n} đơn xin nghỉ dài ngày vừa được đưa vào hộp phê duyệt.`); loadList(); loadOv(); }
        }).catch(() => {});
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const refresh = () => { loadList(); loadOv(); };
    const resync = async () => {
        setSyncing(true);
        try {
            const r = await approvals.sync();
            const { added = 0, closed = 0, ok = true } = r?.data ?? {};
            toast.push(ok ? 'success' : 'error', ok ? 'Đã đồng bộ' : 'Chưa đồng bộ được', ok ? `Thêm ${added} yêu cầu mới, đóng ${closed} yêu cầu đã được xử lý ở nơi khác.` : 'Bảng đơn nghỉ học chưa sẵn sàng.');
            refresh();
        } catch (e) { toast.push('error', 'Chưa đồng bộ được', errMsg(e)); } finally { setSyncing(false); }
    };

    const toggle = (id: number) => setChecked((c) => (c.includes(id) ? c.filter((x) => x !== id) : [...c, id]));
    const allChecked = rows.length > 0 && checked.length === rows.length;

    const runBulk = async (action: 'approve' | 'reject') => {
        if (!checked.length) return;
        if (action === 'reject' && (bulkNote ?? '').trim().length < 5) { toast.push('error', 'Chưa có lý do', 'Hãy ghi rõ lý do từ chối (ít nhất 5 ký tự).'); return; }
        if (action === 'approve' && !window.confirm(`Phê duyệt ${checked.length} yêu cầu đã chọn?`)) return;
        try {
            const r = await approvals.bulk({ ids: checked, action, note: action === 'reject' ? (bulkNote ?? '').trim() : undefined });
            const { done, failed } = r.data as { done: number; failed: { id: number; message: string }[] };
            toast.push(failed.length ? 'info' : 'success', `Đã xử lý ${done} yêu cầu`, failed.length ? `${failed.length} yêu cầu chưa xử lý được: ${failed[0].message}` : undefined);
            setBulkNote(null); refresh();
        } catch (e) { toast.push('error', 'Chưa xử lý được', errMsg(e)); }
    };

    const onKey = (e: KeyboardEvent<HTMLDivElement>) => {
        if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
        e.preventDefault();
        const i = rows.findIndex((r) => r.id === sel);
        const n = rows[Math.min(rows.length - 1, Math.max(0, i + (e.key === 'ArrowDown' ? 1 : -1)))];
        if (n) setSel(n.id);
    };

    const me = ov?.me ?? null;
    const kpi = [
        { label: 'Chờ bạn duyệt', value: counts.todo, tone: '' },
        { label: 'Quá hạn xử lý', value: counts.overdue, tone: counts.overdue ? s.kpiLate : '' },
        { label: 'Đã duyệt hôm nay', value: ov?.approved_today ?? '–', tone: '' },
        { label: 'Tỷ lệ duyệt 30 ngày', value: ov?.approval_rate != null ? `${ov.approval_rate}%` : '–', tone: '' },
        { label: 'Xử lý trung bình', value: ov?.avg_hours != null ? `${ov.avg_hours} giờ` : '–', tone: '' },
    ];

    return (
        <>
            <header className={s.top}>
                <div>
                    <p className={s.eyebrow}><Icon name="shield" size={14} />Ban giám hiệu{me ? `, ${ROLE_LABEL[me.role] ?? ''}` : ''}</p>
                    <h1 className={s.title}>Phê duyệt</h1>
                    <p className={s.sub}>{counts.todo > 0 ? `Có ${counts.todo} yêu cầu đang chờ bạn quyết định${counts.overdue ? `, ${counts.overdue} đã quá hạn.` : '.'}` : 'Không có yêu cầu nào đang chờ bạn.'}</p>
                </div>
                <nav className={s.views} aria-label="Chức năng phê duyệt">
                    {VIEWS.map((v) => <button key={v.key} type="button" className={`${s.view} ${view === v.key ? s.viewOn : ''}`} aria-current={view === v.key} onClick={() => setView(v.key)}><Icon name={v.icon} size={16} />{v.label}</button>)}
                </nav>
            </header>

            <section className={s.kpis} aria-label="Tổng quan">
                {kpi.map((k) => <div key={k.label} className={`${s.kpi} ${k.tone}`}><b>{k.value}</b><span>{k.label}</span></div>)}
            </section>

            {view === 'inbox' && (
                <div className={s.board}>
                    <aside className={s.rail}>
                        <div className={s.railHead}><h2>Bộ lọc</h2><button type="button" className={s.iconBtn} onClick={resync} disabled={syncing} title="Đồng bộ yêu cầu từ các module" aria-label="Đồng bộ"><Icon name="refresh" size={16} /></button></div>
                        <ul className={s.railList}>
                            {TABS.map((t) => (
                                <li key={t.key}>
                                    <button type="button" className={`${s.railItem} ${tab === t.key ? s.railOn : ''}`} onClick={() => { setTab(t.key); setPage(1); }}>
                                        <Icon name={t.icon} size={16} /><span>{t.label}</span><b>{counts[t.count]}</b>
                                    </button>
                                </li>
                            ))}
                        </ul>
                        <label className={s.railField}><span>Loại yêu cầu</span>
                            <select value={typeCode} onChange={(e) => { setTypeCode(e.target.value); setPage(1); }}>
                                <option value="">Tất cả loại</option>
                                {ov?.by_type.map((t) => <option key={t.code} value={t.code}>{t.name}{t.pending ? ` (${t.pending})` : ''}</option>)}
                            </select>
                        </label>
                        <div className={s.railField}><span>Mức độ</span>
                            <div className={s.chips}>
                                {[['', 'Tất cả'], ['urgent', 'Khẩn'], ['high', 'Ưu tiên'], ['normal', 'Thường']].map(([k, l]) => <button key={k} type="button" className={`${s.chip} ${priority === k ? s.chipOn : ''}`} onClick={() => { setPriority(k); setPage(1); }}>{l}</button>)}
                            </div>
                        </div>
                        <label className={s.check}><input type="checkbox" checked={overdue} onChange={(e) => { setOverdue(e.target.checked); setPage(1); }} />Chỉ hiện yêu cầu quá hạn</label>
                    </aside>

                    <div className={s.listPane}>
                        <div className={s.listHead}>
                            <label className={s.search}><Icon name="search" size={16} /><span className={s.srOnly}>Tìm yêu cầu</span><input type="search" placeholder="Tìm theo tiêu đề, mã hoặc người đề nghị" value={q} onChange={(e) => setQ(e.target.value)} /></label>
                        </div>
                        {tab === 'todo' && rows.length > 0 && (
                            <div className={s.bulk}>
                                <label className={s.check}><input type="checkbox" checked={allChecked} onChange={() => setChecked(allChecked ? [] : rows.map((r) => r.id))} />Chọn tất cả</label>
                                {checked.length > 0 && (
                                    <div className={s.bulkActs}>
                                        <span>Đã chọn {checked.length}</span>
                                        {bulkNote === null ? (
                                            <>
                                                <button type="button" className={`${s.btn} ${s.btnSm} ${s.btnPrimary}`} onClick={() => runBulk('approve')}><Icon name="check" size={14} />Duyệt</button>
                                                <button type="button" className={`${s.btn} ${s.btnSm} ${s.btnDanger}`} onClick={() => setBulkNote('')}>Từ chối</button>
                                            </>
                                        ) : (
                                            <>
                                                <input className={s.bulkNote} value={bulkNote} maxLength={1000} placeholder="Lý do từ chối" onChange={(e) => setBulkNote(e.target.value)} aria-label="Lý do từ chối" />
                                                <button type="button" className={`${s.btn} ${s.btnSm} ${s.btnDanger}`} onClick={() => runBulk('reject')}>Xác nhận</button>
                                                <button type="button" className={`${s.btn} ${s.btnSm}`} onClick={() => setBulkNote(null)}>Hủy</button>
                                            </>
                                        )}
                                    </div>
                                )}
                            </div>
                        )}

                        <div className={s.listScroll} tabIndex={0} onKeyDown={onKey} aria-label="Danh sách yêu cầu">
                            {error ? (
                                <div className={s.empty} role="alert"><b>Chưa tải được danh sách</b><p>{error}</p><button type="button" className={`${s.btn} ${s.btnPrimary}`} onClick={loadList}>Tải lại</button></div>
                            ) : loading && rows.length === 0 ? (
                                <div aria-busy="true">{[0, 1, 2, 3, 4].map((i) => <div key={i} className={s.skelRow} />)}</div>
                            ) : rows.length === 0 ? (
                                <div className={s.empty}><Icon name="inbox" size={34} /><b>Không có yêu cầu nào</b><p>{tab === 'todo' ? 'Bạn đã xử lý hết các yêu cầu đang chờ.' : 'Thử đổi bộ lọc hoặc từ khóa tìm kiếm.'}</p></div>
                            ) : (
                                <ul className={`${s.rows} ${loading ? s.rowsBusy : ''}`}>
                                    {rows.map((r) => {
                                        const sla = slaText(r);
                                        return (
                                            <li key={r.id} className={`${s.row} ${sel === r.id ? s.rowOn : ''} ${s['pri_bar_' + r.priority]}`}>
                                                {tab === 'todo' && <input type="checkbox" className={s.rowCheck} checked={checked.includes(r.id)} onChange={() => toggle(r.id)} aria-label={`Chọn ${r.code}`} />}
                                                <button type="button" className={s.rowMain} onClick={() => { setSel(r.id); setMobileDetail(true); }}>
                                                    <span className={s.rowIcon}><Icon name={TYPE_ICON[r.icon] ?? 'doc'} size={18} /></span>
                                                    <span className={s.rowBody}>
                                                        <span className={s.rowTitle}>{r.title}</span>
                                                        <span className={s.rowMeta}>{r.requester_name}{r.requester_info ? `, ${r.requester_info}` : ''}</span>
                                                        <span className={s.rowMeta}>{r.type_name}{r.amount ? `, ${fmtMoney(r.amount)}` : ''}</span>
                                                    </span>
                                                    <span className={s.rowSide}>
                                                        {r.status === 'pending' ? (sla.tone !== 'none' && <span className={`${s.sla} ${s['sla_' + sla.tone]}`}>{sla.text}</span>) : <span className={`${s.badge} ${s['badge_' + r.status]}`}>{STATUS_LABEL[r.status]}</span>}
                                                        {r.priority !== 'normal' && <span className={`${s.pri} ${s['pri_' + r.priority]}`}>{PRIORITY_LABEL[r.priority]}</span>}
                                                    </span>
                                                </button>
                                            </li>
                                        );
                                    })}
                                </ul>
                            )}
                        </div>
                        {meta && meta.last_page > 1 && (
                            <div className={s.pager}>
                                <button type="button" className={`${s.btn} ${s.btnSm}`} disabled={page <= 1} onClick={() => setPage(page - 1)}>Trước</button>
                                <span>{meta.current_page} / {meta.last_page}</span>
                                <button type="button" className={`${s.btn} ${s.btnSm}`} disabled={page >= meta.last_page} onClick={() => setPage(page + 1)}>Sau</button>
                            </div>
                        )}
                    </div>

                    <div className={`${s.detailWrap} ${mobileDetail ? s.detailOpen : ''}`}>
                        <DetailPane id={sel} me={me} onChanged={refresh} onClose={() => setMobileDetail(false)} />
                    </div>
                </div>
            )}

            {view === 'report' && <ReportPanel />}
            {view === 'types' && <TypesPanel me={me} />}
            {view === 'delegation' && <DelegationPanel me={me} />}
        </>
    );
}