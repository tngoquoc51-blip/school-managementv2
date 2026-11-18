'use client';

import { useEffect, useState } from 'react';
import { apiError, finApi } from '@/services/adminFinanceService';
import { useToast } from '@/components/Toast';
import { Empty, ErrorBox, Field, Icon, METHOD, Modal, Pager, Skeleton, Spin, fmtDateTime, fp, useDebounced, useFetch, vnd } from '../ui';
import type { Filters, PaymentRow } from '../types';
import s from '../finance.module.css';

const ST: Record<string, [string, string]> = { pending: ['Chờ xác nhận', s.bWarn], confirmed: ['Đã xác nhận', s.bOk], rejected: ['Đã từ chối', s.bBad] };

export default function PaymentsTab({ f, onChanged }: { f: Filters; onChanged: () => void }) {
    const toast = useToast();
    const [qIn, setQIn] = useState(''); const q = useDebounced(qIn);
    const [status, setStatus] = useState(''); const [method, setMethod] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState(''); const [page, setPage] = useState(1);
    const key = JSON.stringify(f);
    useEffect(() => { setPage(1); }, [key, q, status, method, from, to]);
    const { data, loading, error, reload } = useFetch(() => finApi.payments(fp(f, { q, status, method, from, to, page, per_page: 15 })), [key, q, status, method, from, to, page]);
    const [conf, setConf] = useState<PaymentRow | null>(null); const [rej, setRej] = useState<PaymentRow | null>(null);
    const [reason, setReason] = useState(''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
    const sm = data?.summary || {};
    const all = Object.values(sm).reduce((a, x) => a + x.n, 0);

    async function doConfirm() {
        if (!conf) return; setBusy(true);
        try { await finApi.confirmPayment(conf.id); toast.success('Đã xác nhận phiếu thu', `${conf.receipt_code} · ${vnd(conf.amount)}`); setConf(null); await reload(); onChanged(); }
        catch (e) { toast.error('Không xác nhận được', apiError(e).message); } finally { setBusy(false); }
    }
    async function doReject() {
        if (!rej) return; setBusy(true); setErr('');
        try { await finApi.rejectPayment(rej.id, reason); toast.success('Đã từ chối phiếu thu', rej.receipt_code); setRej(null); setReason(''); await reload(); onChanged(); }
        catch (e) { const r = apiError(e); setErr(r.fields.reason || r.message); } finally { setBusy(false); }
    }

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="wallet" /> Phiếu thu & thanh toán</h3><div className={s.cardSub}>Phiếu đang chờ được xếp lên đầu để xử lý trước</div></div></div>
                <div className={s.filters} style={{ marginBottom: 14 }}>
                    <button className={`${s.pill} ${status === '' ? s.pillOn : ''}`} onClick={() => setStatus('')}>Tất cả ({all})</button>
                    {Object.entries(ST).map(([k, [lb]]) => <button key={k} className={`${s.pill} ${status === k ? s.pillOn : ''}`} onClick={() => setStatus(k)}>{lb} ({sm[k]?.n ?? 0}){sm[k] ? ` · ${vnd(sm[k].amt)}` : ''}</button>)}
                </div>
                <div className={s.toolbar}>
                    <input className={s.input} style={{ minWidth: 240 }} placeholder="Tìm học sinh, số phiếu, mã giao dịch…" value={qIn} onChange={(e) => setQIn(e.target.value)} />
                    <select className={s.select} value={method} onChange={(e) => setMethod(e.target.value)}><option value="">Mọi phương thức</option>{Object.entries(METHOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <input type="date" className={s.input} value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Từ ngày" />
                    <input type="date" className={s.input} value={to} onChange={(e) => setTo(e.target.value)} aria-label="Đến ngày" />
                </div>
                {error && !data ? <ErrorBox message={error} onRetry={reload} /> : !data ? <Skeleton h={48} n={6} /> : data.data.length === 0 ? <Empty icon="💳" text="Không có phiếu thu phù hợp." /> : (
                    <div className={s.scroll} style={{ opacity: loading ? 0.6 : 1 }}>
                        <table className={s.table}>
                            <thead><tr><th>Phiếu thu</th><th>Học sinh</th><th>Hóa đơn</th><th>Phương thức</th><th className={s.num}>Số tiền</th><th>Ngày thu</th><th>Trạng thái</th><th /></tr></thead>
                            <tbody>{data.data.map((p) => { const [lb, cl] = ST[p.status] || [p.status, s.bMute]; return (
                                <tr key={p.id}>
                                    <td><b>{p.receipt_code}</b>{p.reference && <div className={s.cardSub}>{p.reference}</div>}</td>
                                    <td>{p.student_name}<div className={s.cardSub}>{p.student_code} · Lớp {p.class_name || '—'}</div></td>
                                    <td>{p.invoice_code}<div className={s.cardSub}>{p.title}</div></td>
                                    <td>{METHOD[p.method] || p.method}</td><td className={s.num}><b>{vnd(p.amount)}</b></td><td>{fmtDateTime(p.paid_at)}</td>
                                    <td><span className={`${s.badge} ${cl}`}>{lb}</span>{p.reject_reason && <div className={s.cardSub}>{p.reject_reason}</div>}{p.confirmed_by && p.status !== 'pending' && <div className={s.cardSub}>{p.confirmed_by}</div>}</td>
                                    <td style={{ whiteSpace: 'nowrap', textAlign: 'right' }}>{p.status === 'pending' && (<>
                                        <button className={`${s.btn} ${s.btnS} ${s.btnP}`} onClick={() => setConf(p)}>Xác nhận</button>{' '}
                                        <button className={`${s.btn} ${s.btnS} ${s.btnD}`} onClick={() => { setRej(p); setReason(''); setErr(''); }}>Từ chối</button></>)}</td>
                                </tr>); })}</tbody>
                        </table>
                    </div>)}
                {data && <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} busy={loading} />}
            </section>

            {conf && (
                <Modal title="Xác nhận phiếu thu" onClose={() => setConf(null)}>
                    <p>Xác nhận đã nhận <b>{vnd(conf.amount)}</b> ({METHOD[conf.method] || conf.method}) từ <b>{conf.student_name}</b> cho hóa đơn <b>{conf.invoice_code}</b>?</p>
                    <p className={s.cardSub}>Sau khi xác nhận, số tiền sẽ được tính vào “Đã thu” của hóa đơn và công nợ của học sinh.</p>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setConf(null)}>Hủy</button><button className={`${s.btn} ${s.btnP}`} disabled={busy} onClick={doConfirm}>{busy ? <Spin /> : <Icon n="check" size={16} />} Xác nhận</button></div>
                </Modal>)}
            {rej && (
                <Modal title="Từ chối phiếu thu" onClose={() => setRej(null)}>
                    <p>Từ chối phiếu <b>{rej.receipt_code}</b> ({vnd(rej.amount)}) của <b>{rej.student_name}</b>.</p>
                    <Field label="Lý do từ chối" required error={err}><textarea className={`${s.textarea} ${err ? s.invalid : ''}`} style={{ minHeight: 90 }} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Không tìm thấy giao dịch trên sao kê ngân hàng" autoFocus /></Field>
                    <div className={s.modalFoot}><button className={s.btn} onClick={() => setRej(null)}>Hủy</button><button className={`${s.btn} ${s.btnD}`} disabled={busy || reason.trim().length < 3} onClick={doReject}>{busy && <Spin />} Từ chối phiếu</button></div>
                </Modal>)}
        </div>
    );
}