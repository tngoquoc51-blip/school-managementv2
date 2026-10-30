'use client';
import { Fragment, useEffect, useState } from 'react';
import { api, BATCH_STATUS, BatchesRes, BatchRes, CHANNEL_ICON, downloadCsv, KtError, LEVEL_TONE, qs, RemItem, RMeta, STATUS, vnd } from '../_lib/rm';
import { Card, Chip, Empty, ErrorBox, Loading, Modal, Pager, Progress, useApi } from '../../periods/_components/ui';
import { PrintPortal } from '../../collection/_components/Receipt';

type Toast = { ok: (m: string) => void; fail: (m: string) => void };
type Props = { meta: RMeta; refreshKey: number; openId: number | null; onOpened: () => void; onChanged: () => void; toast: Toast };

/** Chi tiết một đợt gửi: người nhận, trạng thái, xuất danh sách, in giấy báo, đánh dấu đã gửi, thu hồi. */
function BatchModal({ id, onClose, onChanged, toast }: { id: number; onClose: () => void; onChanged: () => void; toast: Toast }) {
    const [status, setStatus] = useState('all');
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState<number | null>(null);
    const [sel, setSel] = useState<number[]>([]);
    const [busy, setBusy] = useState(false);
    const [ask, setAsk] = useState<'cancel' | null>(null);
    const [printList, setPrintList] = useState<RemItem[] | null>(null);
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    useEffect(() => { setPage(1); setSel([]); }, [status, dq]);
    const res = useApi<BatchRes>(`reminders/batches/${id}${qs({ status, q: dq, page })}`);
    const d = res.data;
    const b = d?.batch;
    const items = d?.items || [];
    const queuedIds = items.filter((r) => r.status === 'queued').map((r) => r.id);

    const fetchAll = async () => {
        const out: RemItem[] = [];
        let p = 1; let pages = 1;
        do { const r = await api<BatchRes>(`reminders/batches/${id}${qs({ page: p, per_page: 500 })}`); pages = r.pages; out.push(...r.items.filter((x) => x.status !== 'cancelled')); p++; } while (p <= pages && p <= 10);
        return out;
    };
    const exportCsv = async () => {
        setBusy(true);
        try {
            const all = await fetchAll();
            const rows: (string | number)[][] = [['Mã HS', 'Họ tên', 'Lớp', 'Còn nợ lúc nhắc', 'Quá hạn (ngày)', 'Tiêu đề', 'Nội dung', 'Trạng thái']];
            all.forEach((x) => rows.push([x.student.code, x.student.name, x.student.class || '', x.debt_amount, x.overdue_days, x.subject, x.body.replace(/\r?\n/g, ' '), STATUS[x.status][0]]));
            downloadCsv(`nhac-no-${id}-${new Date().toISOString().slice(0, 10)}.csv`, rows);
            toast.ok(`Đã xuất ${all.length} tin.`);
        } catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };
    const print = async () => {
        setBusy(true);
        try {
            const all = await fetchAll();
            setPrintList(all);
            setTimeout(() => { window.print(); setPrintList(null); }, 400);
        } catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };
    const markSent = async (ids: number[]) => {
        setBusy(true);
        try { const r = await api<{ updated: number }>(`reminders/batches/${id}/mark-sent`, { method: 'POST', body: { ids } }); toast.ok(`Đã đánh dấu ${r.updated} tin là đã gửi.`); setSel([]); res.reload(); onChanged(); }
        catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };
    const cancel = async () => {
        setBusy(true);
        try { const r = await api<{ updated: number }>(`reminders/batches/${id}/cancel`, { method: 'POST' }); toast.ok(`Đã thu hồi ${r.updated} tin.`); setAsk(null); res.reload(); onChanged(); }
        catch (e) { toast.fail((e as KtError).message); setAsk(null); } finally { setBusy(false); }
    };

    const chips: [string, string][] = [['all', 'Tất cả'], ['queued', 'Chờ gửi'], ['sent', 'Đã gửi'], ['read', 'Đã đọc'], ['cancelled', 'Đã thu hồi']];
    return (
        <Modal wide title={b ? b.name : 'Đợt gửi'} onClose={() => !busy && onClose()}
               foot={<>
                   {b && b.queued > 0 && <button className="pd-btn" disabled={busy} onClick={() => markSent(sel.length ? sel : [])}>{sel.length ? `Đánh dấu ${sel.length} tin đã gửi` : `Đánh dấu cả ${b.queued} tin đã gửi`}</button>}
                   {b && (b.queued > 0 || (b.channel === 'inapp' && b.sent - b.read > 0)) && <button className="pd-btn danger" disabled={busy} onClick={() => setAsk('cancel')}>Thu hồi</button>}
                   <button className="pd-btn ghost" onClick={onClose}>Đóng</button></>}>
            {res.loading && !d && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {b && d && (
                <div className="dbt-detail">
                    <div className="dbt-who">
                        <div><b>{CHANNEL_ICON[b.channel]} {b.channel_label}</b><small>Gửi {b.at} · {b.by}</small></div>
                        <div className="rmd-tags"><Chip tone={LEVEL_TONE[b.level]}>{b.level_label}</Chip><Chip tone={BATCH_STATUS[b.status][1]}>{BATCH_STATUS[b.status][0]}</Chip></div>
                    </div>
                    <div className="dbt-mini">
                        <div><span>Tổng tin</span><b>{b.total}</b></div>
                        <div><span>Đã gửi</span><b className="ok">{b.sent}{b.queued > 0 ? ` (+${b.queued} chờ)` : ''}</b></div>
                        <div><span>{b.channel === 'inapp' ? 'Đã đọc' : 'Đã thu hồi'}</span><b>{b.channel === 'inapp' ? `${b.read}/${b.sent}` : b.cancelled}</b></div>
                        <div><span>Đã đóng đủ sau nhắc</span><b className="ok">{b.paid}/{b.total - b.cancelled}</b></div>
                    </div>
                    <Progress paid={b.sent} pending={b.queued} total={Math.max(b.total, 1)} />
                    <details className="rmd-text"><summary>Nội dung mẫu: {b.subject}</summary><p>{b.body}</p></details>
                    {b.note && <p className="pd-muted">Ghi chú: {b.note}</p>}

                    <div className="rmd-bar">
                        <div className="pd-chips" role="group" aria-label="Trạng thái tin">{chips.map(([k, l]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}</button>)}</div>
                        <input className="pd-in" aria-label="Tìm trong đợt" placeholder="Tìm mã hoặc tên học sinh…" value={q} onChange={(e) => setQ(e.target.value)} />
                        <div className="pd-quick" style={{ marginTop: 0 }}><button disabled={busy || b.total === 0} onClick={exportCsv}>Xuất danh sách (CSV)</button><button disabled={busy || b.total === 0} onClick={print}>In giấy báo</button></div>
                    </div>
                    {items.length === 0 ? <Empty text="Không có tin nào ở mục này." /> : (
                        <div className="pd-tw"><table className="pd-table rc-table">
                            <thead><tr>{b.queued > 0 && <th style={{ width: 34 }}><input type="checkbox" aria-label="Chọn tất cả tin chờ gửi trên trang" checked={queuedIds.length > 0 && queuedIds.every((x) => sel.includes(x))} disabled={queuedIds.length === 0} onChange={() => setSel(queuedIds.every((x) => sel.includes(x)) ? [] : queuedIds)} /></th>}
                                <th>Học sinh</th><th className="n">Nợ lúc nhắc</th><th>Trạng thái</th><th>Hiện tại</th><th style={{ width: 90 }} /></tr></thead>
                            <tbody>
                            {items.map((r) => {
                                const [l, t] = STATUS[r.status];
                                return (
                                    <Fragment key={r.id}>
                                        <tr>
                                            {b.queued > 0 && <td><input type="checkbox" aria-label={`Chọn ${r.student.name}`} disabled={r.status !== 'queued'} checked={sel.includes(r.id)} onChange={() => setSel((s) => s.includes(r.id) ? s.filter((x) => x !== r.id) : [...s, r.id])} /></td>}
                                            <td><b>{r.student.name}</b><small>{r.student.code} · {r.student.class || '—'}</small></td>
                                            <td className="n">{vnd(r.debt_amount)}{r.overdue_days > 0 && <small>quá {r.overdue_days} ngày</small>}</td>
                                            <td><Chip tone={t}>{l}</Chip>{r.read_at ? <small>đọc {r.read_at}</small> : r.sent_at ? <small>gửi {r.sent_at}</small> : null}</td>
                                            <td>{r.status === 'cancelled' ? <span className="pd-muted">—</span> : r.paid ? <Chip tone="ok">Đã đóng đủ</Chip> : <b className="bad">{vnd(r.balance)}</b>}</td>
                                            <td><button className="cl-link" onClick={() => setOpen(open === r.id ? null : r.id)}>{open === r.id ? 'Ẩn tin' : 'Xem tin'}</button></td>
                                        </tr>
                                        {open === r.id && <tr className="rmd-msgrow"><td colSpan={b.queued > 0 ? 6 : 5}><div className="rmd-msg"><b>{r.subject}</b><p>{r.body}</p></div></td></tr>}
                                    </Fragment>
                                );
                            })}
                            </tbody>
                        </table></div>
                    )}
                    <div className="pd-tfoot" style={{ border: 0, padding: 0 }}><span>{d.total.toLocaleString('vi-VN')} tin</span><Pager page={page} pages={d.pages} onChange={setPage} /></div>
                </div>
            )}
            {ask === 'cancel' && (
                <Modal title="Thu hồi đợt gửi" onClose={() => !busy && setAsk(null)} foot={<><button className="pd-btn ghost" disabled={busy} onClick={() => setAsk(null)}>Không thu hồi</button><button className="pd-btn danger" disabled={busy} onClick={cancel}>{busy ? 'Đang thu hồi…' : 'Thu hồi'}</button></>}>
                    <p>Hệ thống sẽ hủy các tin <b>đang chờ gửi</b> và các thông báo trên cổng học sinh mà <b>học sinh chưa đọc</b> (học sinh không còn thấy). Tin đã đọc hoặc đã gửi ra ngoài (SMS, Zalo, giấy) không thu hồi được.</p>
                </Modal>
            )}
            {printList && <PrintPortal>{printList.map((x) => (
                <article key={x.id} className="rmd-letter">
                    <header><span>{b?.channel_label}</span><h2>THÔNG BÁO HỌC PHÍ</h2><small>Gửi phụ huynh học sinh {x.student.name} · {x.student.code} · lớp {x.student.class || '—'}</small></header>
                    <h3>{x.subject}</h3>
                    <p>{x.body}</p>
                    <footer><span>Còn nợ lúc thông báo: <b>{vnd(x.debt_amount)}</b></span><span>Người nhận ký: ………………………</span></footer>
                </article>
            ))}</PrintPortal>}
        </Modal>
    );
}

/** Lịch sử các đợt gửi nhắc nợ. */
export function Batches({ meta, refreshKey, openId, onOpened, onChanged, toast }: Props) {
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [channel, setChannel] = useState('');
    const [page, setPage] = useState(1);
    const [open, setOpen] = useState<number | null>(null);
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    useEffect(() => { setPage(1); }, [dq, channel]);
    useEffect(() => { if (openId) { setOpen(openId); onOpened(); } }, [openId, onOpened]);
    const res = useApi<BatchesRes>(`reminders/batches${qs({ q: dq, channel, page })}`);
    useEffect(() => { if (refreshKey) res.reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);
    const d = res.data;

    return (
        <Card pad={false} title="Các đợt đã gửi">
            <div className="pd-inv-bar rc-filters">
                <div className="pd-filters" style={{ flex: '1 1 100%' }}>
                    <input className="pd-in" aria-label="Tìm đợt gửi" placeholder="Tìm theo tên đợt…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '2 1 280px' }} />
                    <select className="pd-in" aria-label="Kênh" value={channel} onChange={(e) => setChannel(e.target.value)}><option value="">Mọi kênh</option>{meta.channels.map((c) => <option key={c.key} value={c.key}>{c.label}</option>)}</select>
                </div>
            </div>
            {res.loading && !d && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {d && (d.items.length === 0 ? <Empty text={dq || channel ? 'Không có đợt nào khớp bộ lọc.' : 'Chưa gửi đợt nhắc nợ nào. Sang tab "Cần nhắc", chọn học sinh rồi bấm Soạn tin.'} /> : (
                <div className="pd-tw">
                    <table className="pd-table rc-table">
                        <thead><tr><th>Đợt gửi</th><th>Kênh</th><th>Tiến độ gửi</th><th>Đã đọc</th><th>Đã đóng đủ sau nhắc</th><th>Trạng thái</th><th style={{ width: 90 }} /></tr></thead>
                        <tbody>
                        {d.items.map((b) => {
                            const [l, t] = BATCH_STATUS[b.status];
                            const live = b.total - b.cancelled;
                            return (
                                <tr key={b.id}>
                                    <td><button className="cl-link" onClick={() => setOpen(b.id)}><b>{b.name}</b></button><small>{b.at} · {b.by}</small><Chip tone={LEVEL_TONE[b.level]}>{b.level_label}</Chip></td>
                                    <td>{CHANNEL_ICON[b.channel]} {b.channel_label}</td>
                                    <td className="rmd-prog"><Progress paid={b.sent} pending={b.queued} total={Math.max(b.total, 1)} /><small>{b.sent}/{b.total} đã gửi{b.queued > 0 ? ` · ${b.queued} chờ` : ''}{b.cancelled > 0 ? ` · ${b.cancelled} thu hồi` : ''}</small></td>
                                    <td>{b.channel === 'inapp' ? <><b>{b.sent ? Math.round((b.read * 100) / b.sent) : 0}%</b><small>{b.read}/{b.sent}</small></> : <span className="pd-muted">—</span>}</td>
                                    <td><b className={b.paid ? 'ok' : ''}>{live ? Math.round((b.paid * 100) / live) : 0}%</b><small>{b.paid}/{live} học sinh</small></td>
                                    <td><Chip tone={t}>{l}</Chip></td>
                                    <td><button className="pd-btn ghost sm" onClick={() => setOpen(b.id)}>Mở</button></td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            ))}
            {d && <div className="pd-tfoot"><span>{d.total.toLocaleString('vi-VN')} đợt</span><Pager page={page} pages={d.pages} onChange={setPage} /></div>}
            {open !== null && <BatchModal id={open} onClose={() => setOpen(null)} onChanged={() => { res.reload(); onChanged(); }} toast={toast} />}
        </Card>
    );
}