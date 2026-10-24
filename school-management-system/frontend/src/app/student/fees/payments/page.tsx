'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import '../fees.css';
import { feeApi, qs, vnd } from '../_shared/api';
import { Crumbs, Empty, ErrorBox, Loading, Modal, Pill, useFee, useToast } from '../_shared/ui';

export default function Payments() {
    const [year, setYear] = useState('');
    const [status, setStatus] = useState('');
    const [method, setMethod] = useState('');
    const [ready, setReady] = useState(false);
    const [cancelId, setCancelId] = useState<number | null>(null);
    const [busy, setBusy] = useState(false);
    const toast = useToast();
    useEffect(() => { try { setStatus(new URLSearchParams(window.location.search).get('status') || ''); } catch {} setReady(true); }, []);
    const { data, err, loading, reload } = useFee<any>(ready ? `payments${qs({ year_id: year, status, method })}` : null);

    const exportCsv = () => {
        if (!data) return;
        const rows = [['Mã biên lai', 'Hóa đơn', 'Năm học', 'Số tiền', 'Hình thức', 'Mã giao dịch', 'Thời điểm', 'Trạng thái']];
        data.items.forEach((p: any) => rows.push([p.receipt_code, p.invoice_code, p.year, String(p.amount), p.method_label, p.reference ?? '', p.paid_at, p.status]));
        const csv = '﻿' + rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
        const a = document.createElement('a');
        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' })); a.download = 'lich-su-thanh-toan.csv'; a.click();
    };
    const doCancel = async () => {
        if (cancelId === null) return;
        setBusy(true);
        try { const r: any = await feeApi(`payments/${cancelId}/cancel`, { method: 'POST' }); toast.ok(r.message || 'Đã hủy.'); setCancelId(null); reload(); }
        catch (e: any) { toast.fail(e.message); } finally { setBusy(false); }
    };

    const c = data?.counts;
    const TABS: [string, string, number | undefined][] = [['', 'Tất cả', c ? c.confirmed + c.pending + c.rejected + c.cancelled : undefined], ['confirmed', 'Đã xác nhận', c?.confirmed], ['pending', 'Chờ xác nhận', c?.pending], ['rejected', 'Bị từ chối', c?.rejected], ['cancelled', 'Đã hủy', c?.cancelled]];

    return (
        <div className="fe-page">
            <Crumbs items={[{ label: 'Học phí', href: '/student/fees' }, { label: 'Lịch sử thanh toán' }]} />
            <header className="fe-hero" style={{ gridTemplateColumns: 'minmax(0,1fr)' }}>
                <div><p className="fe-eyebrow">Học phí</p><h1>Lịch sử thanh toán</h1><p className="sub">Mọi khoản bạn đã đóng, kèm biên lai điện tử</p>
                    <p className="fe-big">{data ? vnd(data.confirmed_total) : '—'}</p><p className="sub">Tổng đã được xác nhận theo bộ lọc hiện tại</p></div>
            </header>
            <section className="fe-card">
                <div className="fe-bar" style={{ borderTop: 0 }}>
                    <div className="fe-tabs">{TABS.map(([k, l, n]) => <button key={k} className={`fe-tab ${status === k ? 'on' : ''}`} onClick={() => setStatus(k)}>{l}{n !== undefined && <em>{n}</em>}</button>)}</div>
                    <select className="fe-sel" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Năm học"><option value="">Tất cả năm học</option>{data?.years.map((y: any) => <option key={y.id} value={y.id}>{y.label}</option>)}</select>
                    <select className="fe-sel" value={method} onChange={(e) => setMethod(e.target.value)} aria-label="Hình thức"><option value="">Mọi hình thức</option>{data && Object.entries(data.methods).map(([k, l]) => <option key={k} value={k}>{l as string}</option>)}</select>
                    <button className="fe-btn sm ghost" onClick={exportCsv} disabled={!data || data.items.length === 0}>Xuất CSV</button>
                </div>
                {err ? <div style={{ padding: 16 }}><ErrorBox msg={err} retry={reload} /></div> : !data ? <Loading /> : data.items.length === 0 ? <Empty title="Chưa có khoản thanh toán nào" text="Các khoản bạn đóng sẽ hiện ở đây." /> : (
                    <div className="fe-tw" style={{ opacity: loading ? 0.55 : 1 }}><table className="fe-table"><thead><tr><th>Thời điểm</th><th>Hóa đơn</th><th>Hình thức</th><th className="n">Số tiền</th><th>Trạng thái</th><th /></tr></thead><tbody>
                    {data.items.map((p: any) => (
                        <tr key={p.id}>
                            <td>{p.paid_at}<span className="fe-sub">{p.receipt_code}</span></td>
                            <td><Link href={`/student/fees/${p.invoice_id}`} style={{ color: '#0369a1', fontWeight: 700 }}>{p.invoice_code}</Link><span className="fe-sub">{p.invoice_title}</span></td>
                            <td>{p.method_label}{p.reference && <span className="fe-sub">Mã GD {p.reference}</span>}</td>
                            <td className="n"><b>{vnd(p.amount)}</b></td>
                            <td><Pill status={p.status} />{p.reject_reason && <span className="fe-sub" style={{ color: '#be123c' }}>{p.reject_reason}</span>}</td>
                            <td className="n">{p.status === 'confirmed' && <Link className="fe-btn sm ghost" href={`/student/fees/receipt/${p.id}`}>Biên lai</Link>}{p.status === 'pending' && <button className="fe-btn sm danger" onClick={() => setCancelId(p.id)}>Hủy</button>}</td>
                        </tr>
                    ))}
                    </tbody></table></div>
                )}
            </section>
            {cancelId !== null && (
                <Modal title="Hủy khoản chờ xác nhận" onClose={() => setCancelId(null)} foot={<><button className="fe-btn ghost" onClick={() => setCancelId(null)}>Giữ lại</button><button className="fe-btn danger" disabled={busy} onClick={doCancel}>Hủy khoản này</button></>}>
                    <p>Khoản thanh toán này sẽ bị hủy và không còn được kế toán xem xét.</p>
                </Modal>
            )}
            {toast.node}
        </div>
    );
}