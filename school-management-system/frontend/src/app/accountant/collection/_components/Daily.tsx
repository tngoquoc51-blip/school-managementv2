'use client';
import { useState } from 'react';
import { addDays, downloadCsv, PayRow, qs, todayIso, vnd, vndShort, fmtDate } from '../_lib/cash';
import { Card, Empty, ErrorBox, Loading, Stat, useApi, Ico, ICON } from '../../periods/_components/ui';
import { PrintPortal, ReceiptModal } from './Receipt';

type Day = {
    date: string; total: number; count: number; cash_total: number; non_cash_total: number; prev_total: number;
    by_method: { method: string; label: string; count: number; amount: number }[];
    by_cashier: { name: string; count: number; amount: number; cash: number }[];
    voided: { count: number; amount: number }; rejected: { count: number; amount: number };
    items: PayRow[]; school: { name: string };
};

/** Tổng kết thu theo ngày: dùng để đối chiếu tiền mặt cuối ngày và nộp quỹ. */
export function Daily({ refreshKey }: { refreshKey: number }) {
    const [date, setDate] = useState(todayIso());
    const [view, setView] = useState<number | null>(null);
    const res = useApi<Day>(`cashier/daily${qs({ date, k: refreshKey })}`);
    const d = res.data;
    const diff = d ? d.total - d.prev_total : 0;
    const isToday = date === todayIso();

    const csv = () => {
        if (!d) return;
        const rows: (string | number)[][] = [[`Báo cáo thu ngày ${fmtDate(d.date)}`], [], ['Mã phiếu', 'Thời điểm', 'Mã HS', 'Họ tên', 'Lớp', 'Hóa đơn', 'Số tiền', 'Hình thức', 'Mã giao dịch', 'Người thu']];
        d.items.forEach((x) => rows.push([x.receipt_code, x.confirmed_at || x.paid_at || '', x.student.code, x.student.name, x.student.class || '', x.invoice.code, x.amount, x.method_label, x.reference || '', x.confirmed_by || '']));
        rows.push([], ['Tổng thu', '', '', '', '', '', d.total], ['Trong đó tiền mặt', '', '', '', '', '', d.cash_total]);
        downloadCsv(`bao-cao-thu-${d.date}.csv`, rows);
    };

    return (
        <>
            <div className="cl-daybar">
                <div className="cl-daynav">
                    <button className="pd-btn ghost sm" onClick={() => setDate(addDays(date, -1))} aria-label="Ngày trước">‹</button>
                    <input className="pd-in" type="date" aria-label="Chọn ngày" value={date} max={todayIso()} onChange={(e) => e.target.value && setDate(e.target.value)} />
                    <button className="pd-btn ghost sm" disabled={isToday} onClick={() => setDate(addDays(date, 1))} aria-label="Ngày sau">›</button>
                    {!isToday && <button className="pd-btn ghost sm" onClick={() => setDate(todayIso())}>Hôm nay</button>}
                </div>
                <div className="pd-head-act">
                    <button className="pd-btn ghost" disabled={!d || d.count === 0} onClick={csv}>Xuất Excel (CSV)</button>
                    <button className="pd-btn" disabled={!d} onClick={() => window.print()}>In báo cáo ngày</button>
                </div>
            </div>
            {res.loading && !d && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {d && (
                <div className="cl-report">
                    <div className="pd-stats">
                        <Stat label="Tổng thu trong ngày" value={vndShort(d.total)} hint={`${d.count} phiếu · ${vnd(d.total)}`} tone="ok" icon={<Ico d={ICON.cash} />} />
                        <Stat label="Tiền mặt cần nộp quỹ" value={vnd(d.cash_total)} hint="Đối chiếu với tiền thực tế trong két" tone="warn" icon={<Ico d={ICON.cash} />} />
                        <Stat label="Chuyển khoản / POS / ví" value={vnd(d.non_cash_total)} hint="Đối chiếu với sao kê ngân hàng" tone="info" icon={<Ico d={ICON.doc} />} />
                        <Stat label="So với hôm trước" value={`${diff >= 0 ? '+' : '−'}${vndShort(Math.abs(diff))}`} hint={`Hôm trước: ${vnd(d.prev_total)}`} tone={diff >= 0 ? 'ok' : 'err'} icon={<Ico d={ICON.clock} />} />
                    </div>
                    {(d.voided.count > 0 || d.rejected.count > 0) && (
                        <div className="pd-alert warn">
                            <b>Lưu ý trong ngày:</b>
                            <ul>
                                {d.voided.count > 0 && <li>{d.voided.count} phiếu bị hủy, tổng {vnd(d.voided.amount)} (không tính vào tổng thu).</li>}
                                {d.rejected.count > 0 && <li>{d.rejected.count} khoản học sinh khai báo bị từ chối, tổng {vnd(d.rejected.amount)}.</li>}
                            </ul>
                        </div>
                    )}
                    <div className="pd-cols">
                        <Card title="Theo hình thức thanh toán">
                            {d.by_method.length === 0 ? <Empty text="Chưa có khoản thu nào trong ngày." /> : (
                                <ul className="pd-bars">
                                    {d.by_method.map((m) => (
                                        <li key={m.method}><span>{m.label}</span><div><i style={{ width: `${d.total ? (m.amount / d.total) * 100 : 0}%` }} /></div><b>{vnd(m.amount)}</b><em>{m.count} phiếu · {d.total ? Math.round((m.amount / d.total) * 100) : 0}%</em></li>
                                    ))}
                                </ul>
                            )}
                        </Card>
                        <Card title="Theo người thu" pad={false}>
                            {d.by_cashier.length === 0 ? <Empty text="Chưa có dữ liệu." /> : (
                                <div className="pd-tw"><table className="pd-table" style={{ minWidth: 0 }}>
                                    <thead><tr><th>Người thu</th><th className="n">Số phiếu</th><th className="n">Tiền mặt</th><th className="n">Tổng</th></tr></thead>
                                    <tbody>{d.by_cashier.map((c) => <tr key={c.name}><td><b>{c.name}</b></td><td className="n">{c.count}</td><td className="n">{vnd(c.cash)}</td><td className="n"><b>{vnd(c.amount)}</b></td></tr>)}</tbody>
                                </table></div>
                            )}
                        </Card>
                    </div>
                    <Card title={`Danh sách phiếu thu (${d.items.length})`} pad={false} className="cl-daylist">
                        {d.items.length === 0 ? <Empty text="Không có phiếu thu nào trong ngày này." /> : (
                            <div className="pd-tw"><table className="pd-table">
                                <thead><tr><th>Giờ</th><th>Mã phiếu</th><th>Học sinh</th><th>Hóa đơn</th><th>Hình thức</th><th className="n">Số tiền</th><th>Người thu</th></tr></thead>
                                <tbody>
                                {d.items.map((p) => (
                                    <tr key={p.id}>
                                        <td>{(p.confirmed_at || p.paid_at || '').slice(0, 5)}</td>
                                        <td><button className="cl-link mono" onClick={() => setView(p.id)}>{p.receipt_code}</button></td>
                                        <td><b>{p.student.name}</b><small>{p.student.code} · {p.student.class || '—'}</small></td>
                                        <td className="pd-mono">{p.invoice.code}</td>
                                        <td>{p.method_label}{p.reference && <small className="pd-mono">{p.reference}</small>}</td>
                                        <td className="n"><b>{vnd(p.amount)}</b></td>
                                        <td>{p.confirmed_by}</td>
                                    </tr>
                                ))}
                                <tr className="cl-total"><td colSpan={5}>Tổng cộng ({d.count} phiếu)</td><td className="n"><b>{vnd(d.total)}</b></td><td /></tr>
                                </tbody>
                            </table></div>
                        )}
                    </Card>
                </div>
            )}
            {d && <PrintPortal><PrintReport d={d} /></PrintPortal>}
            {view && <ReceiptModal ids={[view]} onClose={() => setView(null)} />}
        </>
    );
}


/** Bản in của báo cáo ngày (khổ A4, chữ đen trắng, có chỗ ký). */
function PrintReport({ d }: { d: Day }) {
    return (
        <article className="cl-sheet">
            <header><span>{d.school.name || 'TRƯỜNG THPT'}</span><h2>BÁO CÁO THU HỌC PHÍ NGÀY {fmtDate(d.date)}</h2></header>
            <table className="cl-sheet-sum">
                <tbody>
                <tr><td>Tổng thu trong ngày ({d.count} phiếu)</td><td className="n"><b>{vnd(d.total)}</b></td></tr>
                <tr><td>Trong đó tiền mặt (nộp quỹ)</td><td className="n">{vnd(d.cash_total)}</td></tr>
                <tr><td>Chuyển khoản, POS, ví điện tử</td><td className="n">{vnd(d.non_cash_total)}</td></tr>
                {d.voided.count > 0 && <tr><td>Phiếu đã hủy trong ngày ({d.voided.count})</td><td className="n">{vnd(d.voided.amount)}</td></tr>}
                </tbody>
            </table>
            <h3>Theo hình thức thanh toán</h3>
            <table><thead><tr><th>Hình thức</th><th className="n">Số phiếu</th><th className="n">Số tiền</th></tr></thead>
                <tbody>{d.by_method.map((m) => <tr key={m.method}><td>{m.label}</td><td className="n">{m.count}</td><td className="n">{vnd(m.amount)}</td></tr>)}</tbody></table>
            <h3>Danh sách phiếu thu</h3>
            <table><thead><tr><th>Giờ</th><th>Mã phiếu</th><th>Học sinh</th><th>Lớp</th><th>Hóa đơn</th><th>Hình thức</th><th className="n">Số tiền</th><th>Người thu</th></tr></thead>
                <tbody>
                {d.items.map((p) => <tr key={p.id}><td>{(p.confirmed_at || p.paid_at || '').slice(0, 5)}</td><td>{p.receipt_code}</td><td>{p.student.name} ({p.student.code})</td><td>{p.student.class}</td><td>{p.invoice.code}</td><td>{p.method_label}</td><td className="n">{vnd(p.amount)}</td><td>{p.confirmed_by}</td></tr>)}
                <tr className="sum"><td colSpan={6}>Tổng cộng</td><td className="n">{vnd(d.total)}</td><td /></tr>
                </tbody></table>
            <div className="cl-sign">
                <div><b>Người lập báo cáo</b><span>(Ký, ghi rõ họ tên)</span></div>
                <div><b>Kế toán trưởng</b><span>(Ký, ghi rõ họ tên)</span></div>
                <div><b>Thủ quỹ</b><span>(Ký, ghi rõ họ tên)</span></div>
            </div>
        </article>
    );
}