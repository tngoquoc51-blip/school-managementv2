'use client';
import { useEffect, useState } from 'react';
import { api, DMeta, KtError, PROMISE_STATE, PromisesRes, qs, vnd, fmtDate } from '../_lib/db';
import { Card, Chip, Empty, ErrorBox, Loading, Pager, useApi } from '../../periods/_components/ui';

type Props = { meta: DMeta; refreshKey: number; onOpen: (id: number) => void; onChanged: () => void; toast: { ok: (m: string) => void; fail: (m: string) => void } };

/** Lời hẹn trả của phụ huynh: theo dõi còn hiệu lực, quá hẹn, đã giữ lời hay không. */
export function Promises({ refreshKey, onOpen, onChanged, toast }: Props) {
    const [status, setStatus] = useState('open');
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    const [page, setPage] = useState(1);
    const [busy, setBusy] = useState(false);
    useEffect(() => { const t = setTimeout(() => setDq(q.trim()), 350); return () => clearTimeout(t); }, [q]);
    useEffect(() => { setPage(1); }, [status, dq]);
    const res = useApi<PromisesRes>(`debts/promises${qs({ status, q: dq, page })}`);
    useEffect(() => { if (refreshKey) res.reload(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [refreshKey]);
    const d = res.data;
    const resolve = async (id: number, result: 'kept' | 'broken' | 'cancelled') => {
        setBusy(true);
        try { await api(`debts/notes/${id}/resolve`, { method: 'POST', body: { result } }); toast.ok('Đã cập nhật lời hẹn.'); res.reload(); onChanged(); }
        catch (e) { toast.fail((e as KtError).message); } finally { setBusy(false); }
    };
    const chips: [string, string, number | undefined][] = [['open', 'Còn hiệu lực', d?.counts.open], ['late', 'Quá hẹn', d?.counts.late], ['kept', 'Đã giữ lời', undefined], ['broken', 'Không giữ lời', undefined], ['cancelled', 'Đã hủy', undefined], ['all', 'Tất cả', undefined]];

    return (
        <Card pad={false} title="Lời hẹn trả của phụ huynh">
            <div className="pd-inv-bar rc-filters">
                <div className="pd-filters" style={{ flex: '1 1 100%' }}><input className="pd-in" aria-label="Tìm lời hẹn" placeholder="Tìm theo mã hoặc họ tên học sinh…" value={q} onChange={(e) => setQ(e.target.value)} style={{ flex: '1 1 320px' }} /></div>
                <div className="pd-chips" role="group" aria-label="Trạng thái lời hẹn">
                    {chips.map(([k, l, n]) => <button key={k} className={status === k ? 'on' : ''} onClick={() => setStatus(k)}>{l}{n !== undefined ? <em>{n.toLocaleString('vi-VN')}</em> : null}</button>)}
                </div>
            </div>
            {res.loading && !d && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {d && (d.items.length === 0 ? <Empty text={status === 'open' ? 'Chưa có lời hẹn nào còn hiệu lực. Mở hồ sơ học sinh còn nợ để ghi lời hẹn trả.' : 'Không có lời hẹn nào ở mục này.'} /> : (
                <div className="pd-tw">
                    <table className="pd-table rc-table">
                        <thead><tr><th>Học sinh</th><th>Hẹn trả</th><th className="n">Số tiền hẹn</th><th className="n">Còn nợ hiện tại</th><th>Thỏa thuận</th><th>Trạng thái</th><th style={{ width: 230 }} /></tr></thead>
                        <tbody>
                        {d.items.map((r) => {
                            const [l, t] = PROMISE_STATE[r.status] || [r.status, 'mut'];
                            const live = r.raw_status === 'open';
                            return (
                                <tr key={r.id}>
                                    <td><button className="cl-link" onClick={() => onOpen(r.student.id)}><b>{r.student.name}</b></button><small>{r.student.code} · {r.student.class || '—'}</small></td>
                                    <td>{fmtDate(r.date)}{live && r.status !== 'paid' && <small className={r.days_left < 0 ? 'bad' : r.days_left <= 2 ? 'warn' : ''}>{r.days_left < 0 ? `quá ${-r.days_left} ngày` : r.days_left === 0 ? 'hôm nay' : `còn ${r.days_left} ngày`}</small>}</td>
                                    <td className="n"><b>{vnd(r.amount)}</b></td>
                                    <td className="n">{r.balance > 0 ? <b className="bad">{vnd(r.balance)}</b> : <b className="ok">0đ</b>}</td>
                                    <td><span className="dbt-clip" title={r.note}>{r.note}</span><small>{r.channel_label} · {r.by} · {r.at}</small></td>
                                    <td><Chip tone={t}>{l}</Chip></td>
                                    <td>{live ? <div className="cl-rowact"><button className="pd-btn ghost sm" disabled={busy} onClick={() => resolve(r.id, 'kept')}>Đã giữ lời</button><button className="pd-btn ghost sm" disabled={busy} onClick={() => resolve(r.id, 'broken')}>Không giữ lời</button><button className="pd-btn ghost sm" disabled={busy} onClick={() => resolve(r.id, 'cancelled')}>Hủy</button></div> : <button className="pd-btn ghost sm" onClick={() => onOpen(r.student.id)}>Xem hồ sơ</button>}</td>
                                </tr>
                            );
                        })}
                        </tbody>
                    </table>
                </div>
            ))}
            {d && <div className="pd-tfoot"><span>{d.total.toLocaleString('vi-VN')} lời hẹn</span><Pager page={page} pages={d.pages} onChange={setPage} /></div>}
        </Card>
    );
}