'use client';

import { useParams } from 'next/navigation';
import '../../fees.css';
import { vnd } from '../../_shared/api';
import { Crumbs, ErrorBox, Loading, useFee } from '../../_shared/ui';

export default function Receipt() {
    const { id } = useParams<{ id: string }>();
    const { data: r, err, reload } = useFee<any>(`receipts/${id}`);
    if (err) return <div className="fe-page"><Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: 'Lịch sử', href: '/student/fees/payments' }, { label: 'Biên lai' }]} /><ErrorBox msg={err} retry={reload} /></div>;
    if (!r) return <div className="fe-page"><Loading /></div>;
    return (
        <div className="fe-page">
            <div className="fe-noprint">
                <Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: 'Lịch sử', href: '/student/fees/payments' }, { label: r.receipt_code }]} />
                <div style={{ display: 'flex', gap: 10, marginBottom: 16, flexWrap: 'wrap' }}><button className="fe-btn" onClick={() => window.print()}>In biên lai / Lưu PDF</button></div>
            </div>
            <article className="fe-receipt fe-print">
                <div className="fe-rc-head"><div><h2>{r.school.name}</h2><p>{r.school.address} · Hotline {r.school.hotline}</p></div><div style={{ textAlign: 'right' }}><p>Số biên lai</p><b>{r.receipt_code}</b></div></div>
                <div className="fe-rc-title"><h1>BIÊN LAI THU TIỀN</h1><p style={{ color: '#5b6f85' }}>Ngày {r.paid_at}</p></div>
                <div className="fe-kv" style={{ marginBottom: 14 }}>
                    <div><small>Học sinh</small><b>{r.student.name}</b></div><div><small>Mã học sinh</small><b>{r.student.code}</b></div>
                    <div><small>Lớp</small><b>{r.student.class || '—'}</b></div><div><small>Ngày sinh</small><b>{r.student.birth_date}</b></div>
                    <div><small>Hóa đơn</small><b>{r.invoice.code}</b></div><div><small>Hình thức</small><b>{r.method_label}{r.reference ? ` · ${r.reference}` : ''}</b></div>
                </div>
                <p style={{ color: '#5b6f85', marginBottom: 8 }}>{r.invoice.title}</p>
                <div className="fe-tw"><table className="fe-table" style={{ minWidth: 0 }}><thead><tr><th>Khoản thu của hóa đơn</th><th className="n">Thành tiền</th></tr></thead><tbody>
                {r.invoice.lines.map((l: any) => <tr key={l.id}><td>{l.description}</td><td className="n">{vnd(l.amount)}</td></tr>)}
                </tbody><tfoot><tr><td>Tổng hóa đơn</td><td className="n">{vnd(r.invoice.total)}</td></tr></tfoot></table></div>
                <div className="fe-rc-words"><p>Số tiền thu lần này: <b style={{ fontSize: 20 }}>{vnd(r.amount)}</b></p><p><i>Bằng chữ: {r.amount_words}</i></p><p style={{ color: '#5b6f85', marginTop: 4 }}>Còn lại sau lần thu này: <b>{vnd(r.remaining_after)}</b></p></div>
                <div className="fe-rc-sign"><div><b>Người nộp tiền</b><span>(Ký, ghi rõ họ tên)</span></div><div><b>Kế toán thu tiền</b><span>{r.cashier}</span></div></div>
                <p style={{ textAlign: 'center', color: '#8aa0b6', fontSize: 12 }}>Biên lai điện tử được tạo từ hệ thống quản lý nhà trường</p>
            </article>
        </div>
    );
}