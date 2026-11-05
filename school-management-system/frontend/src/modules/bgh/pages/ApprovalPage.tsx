'use client';

import { useCallback, useEffect, useState } from 'react';
import c from './approval.module.css';
import DelegationPanel from './DelegationPanel';
import ReportPanel from './ReportPanel';
import { approvalApi, type ApLog, type ApStats, type Approval, type ApType } from '../services/approvalService';

const TYPE: Record<ApType, { label: string; chip: string; dot: string }> = {
    profile: { label: 'Hồ sơ học sinh', chip: c.cProfile, dot: '#7c4dd6' },
    leave: { label: 'Đơn xin nghỉ', chip: c.cLeave, dot: '#0a7bbf' },
    dispute: { label: 'Khiếu nại hóa đơn', chip: c.cDispute, dot: '#e0920b' },
};
const ST = { pending: ['Chờ duyệt', c.sPending], approved: ['Đã duyệt', c.sApproved], rejected: ['Từ chối', c.sRejected] } as const;
const TABS = [['pending', 'Chờ duyệt'], ['approved', 'Đã duyệt'], ['rejected', 'Từ chối'], ['history', 'Nhật ký']] as const;

const key = (a: Approval) => `${a.type}-${a.id}`;
const when = (s: string) => new Date(s.replace(' ', 'T')).toLocaleString('vi-VN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
const msg = (e: unknown) => (e instanceof Error ? e.message : 'Có lỗi xảy ra, vui lòng thử lại.');

export default function ApprovalPage() {
    const [view, setView] = useState<'inbox' | 'delegation' | 'report'>('inbox');
    const [tab, setTab] = useState<string>('pending');
    const [type, setType] = useState('all');
    const [q, setQ] = useState('');
    const [page, setPage] = useState(1);
    const [more, setMore] = useState(false);
    const [items, setItems] = useState<Approval[]>([]);
    const [logs, setLogs] = useState<ApLog[]>([]);
    const [stats, setStats] = useState<ApStats | null>(null);
    const [sel, setSel] = useState<Approval | null>(null);
    const [checked, setChecked] = useState<Set<string>>(new Set());
    const [note, setNote] = useState('');
    const [loading, setLoading] = useState(true);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [toast, setToast] = useState<{ ok: boolean; msg: string } | null>(null);

    const notify = (ok: boolean, m: string) => { setToast({ ok, msg: m }); setTimeout(() => setToast(null), 4500); };

    const load = useCallback(async () => {
        setLoading(true); setError('');
        try {
            const [s, data] = await Promise.all([
                approvalApi.stats(),
                tab === 'history' ? approvalApi.history() : approvalApi.list({ status: tab, type, q, page }),
            ]);
            setStats(s);
            if (tab === 'history') setLogs(data as ApLog[]);
            else {
                const r = data as { data: Approval[]; has_more: boolean };
                setItems((p) => (page > 1 ? [...p, ...r.data] : r.data));
                setMore(r.has_more);
            }
        } catch (e) { setError(msg(e)); } finally { setLoading(false); }
    }, [tab, type, q, page]);

    useEffect(() => { const t = setTimeout(load, q ? 350 : 0); return () => clearTimeout(t); }, [load, q]);
    useEffect(() => { setChecked(new Set()); setSel(null); setNote(''); setPage(1); }, [tab, type, q]);
    const refresh = () => (page === 1 ? load() : setPage(1));

    async function decide(action: 'approve' | 'reject') {
        if (!sel) return;
        setBusy(true);
        try { notify(true, await approvalApi.decide(sel.type, sel.id, action, note)); window.dispatchEvent(new Event('approvals:changed')); setSel(null); setNote(''); await refresh(); }
        catch (e) { notify(false, msg(e)); } finally { setBusy(false); }
    }

    async function bulk(action: 'approve' | 'reject') {
        const list = items.filter((i) => checked.has(key(i)) && i.type !== 'dispute').map((i) => ({ type: i.type, id: i.id }));
        if (action === 'reject' && note.trim().length < 5) return notify(false, 'Nhập lý do từ chối (ít nhất 5 ký tự) trước khi từ chối hàng loạt.');
        setBusy(true);
        try { notify(true, await approvalApi.bulk(list, action, note)); window.dispatchEvent(new Event('approvals:changed')); setChecked(new Set()); setNote(''); await refresh(); }
        catch (e) { notify(false, msg(e)); } finally { setBusy(false); }
    }

    const toggle = (a: Approval) => setChecked((p) => { const n = new Set(p); if (n.has(key(a))) n.delete(key(a)); else n.add(key(a)); return n; });
    const total = stats ? Object.values(stats.pending).reduce((x, y) => x + y, 0) : 0;
    const bulkable = items.filter((i) => checked.has(key(i)) && i.type !== 'dispute').length;
    const types = Object.keys(TYPE) as ApType[];

    return (
        <div className={c.page}>
            {toast && <div role="status" className={`${c.toast} ${toast.ok ? c.toastOk : c.toastBad}`}>{toast.msg}</div>}

            <div className={c.head}>
                <div><h1 className={c.h1}>Phê duyệt</h1><p className={c.sub}>Trung tâm xử lý hồ sơ, đơn xin nghỉ và khiếu nại của học sinh.</p></div>
                <button className={c.btn} onClick={refresh}>Làm mới</button>
            </div>

            <div className={c.views} role="group" aria-label="Chức năng">
                {([['inbox', 'Hộp thư phê duyệt'], ['delegation', 'Ủy quyền'], ['report', 'Báo cáo thống kê']] as const).map(([k, l]) => (
                    <button key={k} className={c.view} aria-pressed={view === k} onClick={() => setView(k)}>{l}</button>
                ))}
            </div>
            {view === 'delegation' && <DelegationPanel notify={notify} />}
            {view === 'report' && <ReportPanel />}
            {view === 'inbox' && (<>
                <div className={c.stats}>
                    <div className={`${c.stat} ${c.statMain}`}><small>Tổng chờ duyệt</small><b>{stats ? total : '–'}</b></div>
                    {types.map((t) => (
                        <button key={t} className={c.stat} onClick={() => { setTab('pending'); setType(t); }}>
                            <small><span className={c.dot} style={{ background: TYPE[t].dot }} />{TYPE[t].label}</small><b>{stats?.pending[t] ?? '–'}</b>
                        </button>
                    ))}
                    <div className={c.stat}><small>Hôm nay</small><p style={{ margin: '.6rem 0 0' }}><b style={{ display: 'inline', fontSize: '1.3rem', color: '#15935f' }}>{stats?.approved_today ?? 0}</b> duyệt · <b style={{ display: 'inline', fontSize: '1.3rem', color: '#d6402f' }}>{stats?.rejected_today ?? 0}</b> từ chối</p></div>
                </div>

                <div className={c.bar}>
                    <div className={c.tabs} role="tablist">
                        {TABS.map(([k, l]) => <button key={k} role="tab" aria-selected={tab === k} className={c.tab} onClick={() => setTab(k)}>{l}</button>)}
                    </div>
                    {tab !== 'history' && (
                        <div className={c.filters}>
                            <select className={c.input} value={type} onChange={(e) => setType(e.target.value)} aria-label="Loại yêu cầu">
                                <option value="all">Tất cả loại</option>
                                {types.map((t) => <option key={t} value={t}>{TYPE[t].label}</option>)}
                            </select>
                            <input className={c.input} type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm tên hoặc mã học sinh" style={{ width: 250 }} />
                        </div>
                    )}
                </div>

                {error && (
                    <>
                        <div role="alert" className={c.err}><span>{error}</span><button onClick={load}>Thử lại</button></div>
                        {error.includes('Phiên đăng nhập') && (
                            <div className={c.hint}>
                                Chưa gửi được token nhân sự. Thử <b>Đăng xuất rồi đăng nhập lại</b> (token có thể đã hết hạn). Nếu vẫn lỗi, điền tên key token vào dòng <code>TOKEN_KEY</code> trong <code>approvalService.ts</code>.
                                <br />Các key đang lưu trong trình duyệt: <code>{typeof window !== 'undefined' ? Object.keys(localStorage).join(', ') || '(trống)' : ''}</code>
                            </div>
                        )}
                    </>
                )}

                {tab === 'pending' && checked.size > 0 && (
                    <div className={c.bulk}>
                        <span>Đã chọn {checked.size}{checked.size !== bulkable && ` (${bulkable} đơn duyệt hàng loạt được)`}</span>
                        <input className={c.input} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Ghi chú / lý do từ chối" />
                        <button className={`${c.go} ${c.goOk}`} disabled={busy || !bulkable} onClick={() => bulk('approve')}>Duyệt tất cả</button>
                        <button className={`${c.go} ${c.goBad}`} disabled={busy || !bulkable} onClick={() => bulk('reject')}>Từ chối</button>
                    </div>
                )}

                <div className={c.grid}>
                    <section className={c.panel} aria-label="Danh sách">
                        {loading && page === 1 ? [0, 1, 2, 3].map((i) => <div key={i} className={c.skel} />) :
                            tab === 'history' ? (
                                logs.length === 0 ? <p className={c.empty}>Chưa có hoạt động nào.</p> :
                                    <ul className={c.ul}>{logs.map((l) => (
                                        <li key={l.id} className={c.log}>
                                            <div>
                                                <b>{l.actor_name}</b> {l.action === 'approve' ? 'đã duyệt' : 'đã từ chối'} <span className={`${c.chip} ${TYPE[l.type].chip}`}>{TYPE[l.type].label}</span> của {l.student_name ?? 'học sinh'}
                                                {l.note && <p style={{ margin: '.3rem 0 0', color: '#5b7a91' }}>“{l.note}”</p>}
                                            </div>
                                            <time className={c.time}>{when(l.created_at)}</time>
                                        </li>))}</ul>
                            ) : items.length === 0 && !error ? (
                                <div className={c.empty}><big>✓</big>{tab === 'pending' ? 'Không còn yêu cầu nào chờ duyệt' : 'Không có dữ liệu'}</div>
                            ) : (
                                <ul className={c.ul}>{items.map((a) => (
                                    <li key={key(a)} className={`${c.row} ${sel && key(sel) === key(a) ? c.rowOn : ''}`}>
                                        {tab === 'pending' && <input type="checkbox" aria-label={`Chọn ${a.student_name}`} checked={checked.has(key(a))} onChange={() => toggle(a)} />}
                                        <button onClick={() => { setSel(a); setNote(''); }}>
                                            <span className={`${c.chip} ${TYPE[a.type].chip}`}>{TYPE[a.type].label}</span><b>{a.student_name}</b> <small>{a.student_code}</small>
                                            <p><b style={{ fontWeight: 600 }}>{a.title}</b></p>
                                            <p className={c.clip}>{a.detail}</p>
                                        </button>
                                        <div className={c.side}><span className={`${c.chip} ${ST[a.status][1]}`} style={{ marginRight: 0 }}>{ST[a.status][0]}</span><small className={c.time}>{when(a.created_at)}</small></div>
                                    </li>))}</ul>
                            )}
                        {tab !== 'history' && more && <div className={c.more}><button className={c.btn} disabled={loading} onClick={() => setPage((p) => p + 1)}>{loading ? 'Đang tải…' : 'Xem thêm'}</button></div>}
                    </section>

                    <aside className={`${c.panel} ${c.aside}`} aria-label="Chi tiết">
                        {!sel ? <p className={c.empty}>Chọn một yêu cầu để xem chi tiết và xử lý.</p> : (
                            <>
                                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                                    <span className={`${c.chip} ${TYPE[sel.type].chip}`}>{TYPE[sel.type].label}</span>
                                    <button className={c.close} aria-label="Đóng" onClick={() => setSel(null)}>✕</button>
                                </div>
                                <div><h2>{sel.title}</h2><p className={c.sub}>{sel.student_name} · {sel.student_code}</p></div>
                                <div className={c.box}>{sel.detail}</div>
                                <small className={c.sub}>Gửi lúc {when(sel.created_at)}</small>
                                {sel.status !== 'pending' ? (
                                    <div className={c.box}><span className={`${c.chip} ${ST[sel.status][1]}`}>{ST[sel.status][0]}</span>{sel.note && <p style={{ margin: '.5rem 0 0' }}>{sel.note}</p>}</div>
                                ) : (
                                    <>
                                        <label style={{ fontWeight: 600 }}>{sel.type === 'dispute' ? 'Nội dung phản hồi' : 'Ghi chú (bắt buộc khi từ chối)'}
                                            <textarea className={c.textarea} rows={3} value={note} onChange={(e) => setNote(e.target.value)} />
                                        </label>
                                        {sel.type === 'leave' && <div className={c.info}>Khi duyệt, các tiết vắng không phép trong thời gian nghỉ sẽ tự chuyển thành vắng có phép.</div>}
                                        <div className={c.acts}>
                                            <button className={`${c.go} ${c.goOk}`} disabled={busy} onClick={() => decide('approve')}>{sel.type === 'dispute' ? 'Gửi phản hồi' : 'Duyệt'}</button>
                                            <button className={`${c.go} ${c.goLine}`} disabled={busy} onClick={() => decide('reject')}>Từ chối</button>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </aside>
                </div>
            </>)}
        </div>
    );
}