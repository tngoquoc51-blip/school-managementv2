'use client';

import { useEffect, useState } from 'react';
import { finApi } from '@/services/adminFinanceService';
import { Empty, ErrorBox, Icon, METHOD, Modal, Pager, Skeleton, fmtDate, fmtDateTime, fp, overdueBadge, payBadge, useDebounced, useFetch, vnd } from '../ui';
import type { Filters } from '../types';
import s from '../finance.module.css';

const TERMS: Record<string, string> = { YEAR: 'Cả năm', HK1: 'Học kỳ 1', HK2: 'Học kỳ 2' };
const PAY: Record<string, [string, string]> = { pending: ['Chờ xác nhận', s.bWarn], confirmed: ['Đã xác nhận', s.bOk], rejected: ['Đã từ chối', s.bBad] };

export default function InvoicesTab({ f }: { f: Filters }) {
    const [qIn, setQIn] = useState(''); const q = useDebounced(qIn);
    const [ps, setPs] = useState(''); const [term, setTerm] = useState(''); const [sort, setSort] = useState('newest'); const [page, setPage] = useState(1);
    const [open, setOpen] = useState<number | null>(null);
    const key = JSON.stringify(f);
    useEffect(() => { setPage(1); }, [key, q, ps, term, sort]);
    const { data, loading, error, reload } = useFetch(() => finApi.invoices(fp(f, { q, pay_status: ps, term, sort, page, per_page: 15 })), [key, q, ps, term, sort, page]);

    return (
        <div className={s.panel}>
            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="receipt" /> Danh sách hóa đơn</h3><div className={s.cardSub}>Bấm vào một dòng để xem chi tiết khoản thu và các lần thanh toán</div></div></div>
                <div className={s.toolbar}>
                    <input className={s.input} style={{ minWidth: 240 }} placeholder="Tìm học sinh, mã HS, mã hóa đơn…" value={qIn} onChange={(e) => setQIn(e.target.value)} />
                    <select className={s.select} value={ps} onChange={(e) => setPs(e.target.value)}><option value="">Mọi trạng thái</option><option value="paid">Đã thu đủ</option><option value="partial">Thu một phần</option><option value="unpaid">Chưa thu</option><option value="overdue">Quá hạn</option></select>
                    <select className={s.select} value={term} onChange={(e) => setTerm(e.target.value)}><option value="">Mọi kỳ</option>{Object.entries(TERMS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                    <select className={s.select} value={sort} onChange={(e) => setSort(e.target.value)}><option value="newest">Mới nhất</option><option value="remaining">Còn nợ nhiều nhất</option><option value="overdue">Quá hạn lâu nhất</option></select>
                </div>
                {error && !data ? <ErrorBox message={error} onRetry={reload} /> : !data ? <Skeleton h={48} n={6} /> : data.data.length === 0 ? <Empty icon="🧾" text="Không có hóa đơn phù hợp bộ lọc." /> : (
                    <div className={s.scroll} style={{ opacity: loading ? 0.6 : 1 }}>
                        <table className={s.table}>
                            <thead><tr><th>Mã HĐ</th><th>Học sinh</th><th>Nội dung</th><th>Hạn nộp</th><th className={s.num}>Tổng</th><th className={s.num}>Đã thu</th><th className={s.num}>Còn lại</th><th>Trạng thái</th></tr></thead>
                            <tbody>{data.data.map((r) => { const [lb, cl] = payBadge(r.pay_status); return (
                                <tr key={r.id} className={s.rowLink} onClick={() => setOpen(r.id)}>
                                    <td><b>{r.code}</b></td>
                                    <td>{r.student_name}<div className={s.cardSub}>{r.student_code} · Lớp {r.class_name || '—'}</div></td>
                                    <td>{r.title}<div className={s.cardSub}>{TERMS[r.term] || r.term}</div></td>
                                    <td>{fmtDate(r.due_date)}</td>
                                    <td className={s.num}>{vnd(r.total)}</td><td className={s.num}>{vnd(r.paid)}</td><td className={s.num}><b>{vnd(r.remaining)}</b></td>
                                    <td><span className={`${s.badge} ${cl}`}>{lb}</span><div style={{ marginTop: 4 }}>{overdueBadge(r.overdue_days)}</div></td>
                                </tr>); })}</tbody>
                        </table>
                    </div>)}
                {data && <Pager page={data.current_page} last={data.last_page} total={data.total} onPage={setPage} busy={loading} />}
            </section>
            {open && <InvoiceModal id={open} onClose={() => setOpen(null)} />}
        </div>
    );
}

function InvoiceModal({ id, onClose }: { id: number; onClose: () => void }) {
    const { data, loading, error, reload } = useFetch(() => finApi.invoice(id), [id]);
    return (
        <Modal title="Chi tiết hóa đơn" wide onClose={onClose}>
            {loading ? <Skeleton h={80} n={3} /> : error || !data ? <ErrorBox message={error || 'Lỗi'} onRetry={reload} /> : (() => {
                const i = data.invoice; const [lb, cl] = payBadge(i.pay_status);
                return (<>
                    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
                        <div><b style={{ fontSize: 17 }}>{i.code}</b> <span className={`${s.badge} ${cl}`}>{lb}</span> {overdueBadge(i.overdue_days)}
                            <div className={s.cardSub}>{i.title} · Phát hành {fmtDate(i.issue_date)} · Hạn nộp {fmtDate(i.due_date)}</div></div>
                        <div style={{ textAlign: 'right' }}><b>{i.student_name}</b><div className={s.cardSub}>{i.student_code} · Lớp {i.class_name || '—'}</div></div>
                    </div>
                    <div className={s.sumRow}>
                        <div className={s.sumBox}><b>{vnd(i.subtotal)}</b><span>Tạm tính</span></div><div className={s.sumBox}><b>{vnd(i.discount)}</b><span>Miễn giảm</span></div>
                        <div className={s.sumBox}><b>{vnd(i.paid)}</b><span>Đã thu</span></div><div className={s.sumBox}><b style={{ color: i.remaining > 0 ? 'var(--bad)' : 'var(--ok)' }}>{vnd(i.remaining)}</b><span>Còn lại</span></div>
                    </div>
                    <h4 style={{ margin: '4px 0 8px' }}>Các khoản thu</h4>
                    <div className={s.scroll}><table className={s.table}><thead><tr><th>Khoản thu</th><th className={s.num}>SL</th><th className={s.num}>Đơn giá</th><th className={s.num}>Giảm</th><th className={s.num}>Thành tiền</th></tr></thead>
                        <tbody>{data.lines.map((l) => <tr key={l.id}><td>{l.description}</td><td className={s.num}>{l.quantity}</td><td className={s.num}>{vnd(l.unit_price)}</td><td className={s.num}>{vnd(l.discount)}</td><td className={s.num}><b>{vnd(l.amount)}</b></td></tr>)}</tbody></table></div>
                    <h4 style={{ margin: '18px 0 8px' }}>Lịch sử thanh toán</h4>
                    {data.payments.length === 0 ? <div className={s.cardSub}>Chưa có lần thanh toán nào.</div> : (
                        <div className={s.scroll}><table className={s.table}><thead><tr><th>Phiếu thu</th><th>Ngày</th><th>Phương thức</th><th className={s.num}>Số tiền</th><th>Trạng thái</th></tr></thead>
                            <tbody>{data.payments.map((p) => { const [pl, pc] = PAY[p.status] || [p.status, s.bMute]; return (
                                <tr key={p.id}><td><b>{p.receipt_code}</b>{p.reference && <div className={s.cardSub}>{p.reference}</div>}</td><td>{fmtDateTime(p.paid_at)}</td><td>{METHOD[p.method] || p.method}</td><td className={s.num}>{vnd(p.amount)}</td>
                                    <td><span className={`${s.badge} ${pc}`}>{pl}</span>{p.reject_reason && <div className={s.cardSub}>{p.reject_reason}</div>}</td></tr>); })}</tbody></table></div>)}
                    {data.disputes.length > 0 && (<><h4 style={{ margin: '18px 0 8px' }}>Khiếu nại</h4>{data.disputes.map((d) => (
                        <div key={d.id} className={s.noteItem}><b>{d.message}</b><div className={s.cardSub}>{fmtDateTime(d.created_at)} · {d.status === 'open' ? 'Chưa trả lời' : 'Đã trả lời'}</div>{d.reply && <div style={{ marginTop: 6 }}>↳ {d.reply}</div>}</div>))}</>)}
                </>);
            })()}
        </Modal>
    );
}