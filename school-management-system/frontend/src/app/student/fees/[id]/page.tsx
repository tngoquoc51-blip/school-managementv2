'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import '../fees.css';
import { feeApi, vnd } from '../_shared/api';
import { Crumbs, ErrorBox, Loading, Modal, Pill, useFee, useToast } from '../_shared/ui';

export default function InvoiceDetail() {
    const { id } = useParams<{ id: string }>();
    const { data: v, err, reload } = useFee<any>(`invoices/${id}`);
    const [dlg, setDlg] = useState(false);
    const [msg, setMsg] = useState('');
    const [busy, setBusy] = useState(false);
    const [cancelId, setCancelId] = useState<number | null>(null);
    const toast = useToast();

    if (err) return <div className="fe-page"><Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: 'Hóa đơn' }]} /><ErrorBox msg={err} retry={reload} /></div>;
    if (!v) return <div className="fe-page"><Loading /></div>;
    const hasOpenDispute = v.disputes.some((d: any) => d.status === 'open');

    const sendDispute = async () => {
        setBusy(true);
        try { const r: any = await feeApi(`invoices/${id}/dispute`, { method: 'POST', body: { message: msg } }); toast.ok(r.message || 'Đã gửi.'); setDlg(false); setMsg(''); reload(); }
        catch (e: any) { toast.fail(e.message); } finally { setBusy(false); }
    };
    const doCancel = async () => {
        if (cancelId === null) return;
        setBusy(true);
        try { const r: any = await feeApi(`payments/${cancelId}/cancel`, { method: 'POST' }); toast.ok(r.message || 'Đã hủy.'); setCancelId(null); reload(); }
        catch (e: any) { toast.fail(e.message); } finally { setBusy(false); }
    };

    return (
        <div className="fe-page">
            <Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: v.code }]} />
            <header className="fe-hero fe-noprint" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
                <div>
                    <p className="fe-eyebrow">{v.term_label} · Năm học {v.year}</p>
                    <h1>{v.title}</h1>
                    <p className="sub">Mã hóa đơn {v.code} · Ngày lập {v.issue_date} · Hạn nộp {v.due_date}</p>
                    <p className="fe-big">{v.balance ? vnd(v.balance) : vnd(v.total)}</p>
                    <p className="sub">{v.balance ? (v.overdue ? `Quá hạn ${v.overdue_days} ngày · còn phải đóng` : 'Còn phải đóng') : 'Hóa đơn đã thanh toán đủ'}</p>
                    <div className="fe-hero-act">
                        {v.can_pay && <Link className="fe-btn light" href={`/student/fees/${v.id}/pay`}>Thanh toán hóa đơn</Link>}
                        <button className="fe-btn hero-ghost" onClick={() => window.print()}>In hóa đơn</button>
                        <button className="fe-btn hero-ghost" onClick={() => setDlg(true)} disabled={hasOpenDispute}>{hasOpenDispute ? 'Đã gửi phản hồi' : 'Gửi phản hồi về hóa đơn'}</button>
                    </div>
                </div>
            </header>

            {v.pending > 0 && <div className="fe-alert warn fe-noprint"><span><b>{vnd(v.pending)} đang chờ kế toán xác nhận.</b> Số tiền này chưa được trừ vào công nợ.</span></div>}

            <div className="fe-grid fe-gmain">
                <div>
                    <section className="fe-card fe-print">
                        <div className="fe-card-h"><h2>Chi tiết các khoản thu</h2><Pill status={v.status} overdue={v.overdue} /></div>
                        <div className="fe-tw"><table className="fe-table"><thead><tr><th>Khoản thu</th><th>Nhóm</th><th className="n">Đơn giá</th><th className="n">Miễn giảm</th><th className="n">Thành tiền</th></tr></thead><tbody>
                        {v.lines.map((l: any) => <tr key={l.id}><td>{l.description}</td><td>{l.category_label}</td><td className="n">{vnd(l.unit_price)}</td><td className="n">{l.discount ? <span style={{ color: '#047857' }}>−{vnd(l.discount)}</span> : '—'}</td><td className="n"><b>{vnd(l.amount)}</b></td></tr>)}
                        </tbody><tfoot><tr><td colSpan={4}>Tổng cộng</td><td className="n">{vnd(v.total)}</td></tr></tfoot></table></div>
                        <div className="fe-card-b" style={{ borderTop: '1px solid #d9e4ef' }}>
                            <div className="fe-kv"><div><small>Học sinh</small><b>{v.student.name}</b></div><div><small>Mã học sinh</small><b>{v.student.code}</b></div><div><small>Mã hóa đơn</small><b>{v.code}</b></div><div><small>Hạn nộp</small><b>{v.due_date}</b></div></div>
                        </div>
                    </section>

                    <section className="fe-card fe-noprint">
                        <div className="fe-card-h"><h2>Lịch sử thanh toán của hóa đơn</h2></div>
                        <div className="fe-card-b">
                            {v.payments.length === 0 ? <p style={{ color: '#5b6f85' }}>Chưa có khoản thanh toán nào.</p> : (
                                <ul className="fe-tl">
                                    {v.payments.map((p: any) => (
                                        <li key={p.id} className={p.status}>
                                            <b>{vnd(p.amount)} · {p.method_label} <Pill status={p.status} /></b>
                                            <small>{p.paid_at}{p.reference ? ` · Mã GD ${p.reference}` : ''}{p.confirmed_by ? ` · ${p.confirmed_by}` : ''}</small>
                                            {p.reject_reason && <small style={{ display: 'block', color: '#be123c' }}>Lý do từ chối: {p.reject_reason}</small>}
                                            <div style={{ marginTop: 6, display: 'flex', gap: 8 }}>
                                                {p.status === 'confirmed' && <Link className="fe-btn sm ghost" href={`/student/fees/receipt/${p.id}`}>Xem biên lai</Link>}
                                                {p.status === 'pending' && <button className="fe-btn sm danger" onClick={() => setCancelId(p.id)}>Hủy khoản này</button>}
                                            </div>
                                        </li>
                                    ))}
                                </ul>
                            )}
                        </div>
                    </section>
                </div>

                <aside className="fe-noprint">
                    <section className="fe-card">
                        <div className="fe-card-h"><h2>Tóm tắt thanh toán</h2></div>
                        <div className="fe-card-b fe-sum">
                            <div><span>Tổng các khoản</span><b>{vnd(v.subtotal)}</b></div>
                            {v.discount > 0 && <div className="neg"><span>Miễn giảm</span><b>−{vnd(v.discount)}</b></div>}
                            <div><span>Phải đóng</span><b>{vnd(v.total)}</b></div>
                            <div className="neg"><span>Đã thanh toán</span><b>−{vnd(v.paid)}</b></div>
                            <div className="tot"><span>Còn lại</span><b style={{ color: v.balance ? '#be123c' : '#047857' }}>{vnd(v.balance)}</b></div>
                        </div>
                    </section>
                    <section className="fe-card">
                        <div className="fe-card-h"><h2>Phản hồi về hóa đơn</h2></div>
                        <div className="fe-card-b">
                            {v.disputes.length === 0 ? <p style={{ color: '#5b6f85' }}>Bạn chưa gửi phản hồi nào. Nếu thấy khoản thu chưa đúng, hãy gửi phản hồi để phòng Kế toán kiểm tra.</p> : v.disputes.map((d: any) => (
                                <div key={d.id} className="fe-dispute"><small style={{ color: '#5b6f85' }}>{d.created_at} · {d.status === 'open' ? 'Đang chờ trả lời' : 'Đã trả lời'}</small><p>{d.message}</p>{d.reply && <div className="reply"><b>{d.replied_by}:</b> {d.reply}</div>}</div>
                            ))}
                        </div>
                    </section>
                </aside>
            </div>

            {dlg && (
                <Modal title="Gửi phản hồi về hóa đơn" onClose={() => setDlg(false)} foot={<><button className="fe-btn ghost" onClick={() => setDlg(false)}>Hủy</button><button className="fe-btn" disabled={busy || msg.trim().length < 10} onClick={sendDispute}>Gửi phản hồi</button></>}>
                    <div className="fe-field"><label htmlFor="dm">Nội dung (10 đến 1000 ký tự)</label><textarea id="dm" className="fe-ta" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="VD: Em thấy khoản học liệu chưa đúng so với thông báo…" maxLength={1000} autoFocus /></div>
                    <p className="fe-sub">Phòng Kế toán sẽ trả lời ngay trong trang này.</p>
                </Modal>
            )}
            {cancelId !== null && (
                <Modal title="Hủy khoản chờ xác nhận" onClose={() => setCancelId(null)} foot={<><button className="fe-btn ghost" onClick={() => setCancelId(null)}>Giữ lại</button><button className="fe-btn danger" disabled={busy} onClick={doCancel}>Hủy khoản này</button></>}>
                    <p>Khoản thanh toán này sẽ bị hủy và không còn được kế toán xem xét. Bạn có thể khai báo lại sau.</p>
                </Modal>
            )}
            {toast.node}
        </div>
    );
}