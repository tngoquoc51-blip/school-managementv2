'use client';
// Thanh toán & đối soát (/admin/finance/thanh-toan)
import Link from 'next/link';
import React, { useState } from 'react';
import { Btn, Card, Empty, ErrorBox, GroupBars, Ico, InvoiceDrawer, Loading, PAY_ST, Page, Pager, Pill, Tabs, addDays, downloadCsv, dt, fi, fmtD, fmtS, monthStart, num, qs, short, todayStr, useDebounced, useFi, useLoad, vnd } from '../_fi';

type Pay = { id: number; code: string; amount: number; method: string; method_label: string; reference: string | null; status: string; paid_at: string | null; confirmed_by: string | null; reject_reason: string | null; sname: string; scode: string; invoice: string; invoice_id: number };
type PRes = { meta: Page; counts: Record<string, number>; sum: { confirmed: number; pending: number }; data: Pay[] };
type Day = { date: string; count: number; total: number; by: Record<string, number> };
type RRes = {
    from: string; to: string; days: Day[]; by_method: Record<string, number>;
    totals: { amount: number; count: number; pending_n: number; pending_amt: number; rejected_n: number; rejected_amt: number };
    anomalies: { duplicate_reference: { reference: string; n: number; amount: number }[]; overpaid: { id: number; code: string; total: number; paid: number }[]; stale_pending: { id: number; code: string; amount: number; paid_at: string; sname: string }[] };
};
const MLAB: Record<string, string> = { cash: 'Tiền mặt', bank_transfer: 'Chuyển khoản', card: 'Thẻ (POS)', ewallet: 'Ví điện tử' };

export default function PaymentsPage() {
    const [tab, setTab] = useState('list');
    return (
        <div className="ta-page">
            <Tabs value={tab} onChange={setTab} items={[{ key: 'list', label: 'Danh sách phiếu thu' }, { key: 'recon', label: 'Đối soát theo ngày' }]} />
            {tab === 'list' ? <List /> : <Recon />}
        </div>
    );
}

function List() {
    const { yearId, meta } = useFi();
    const [status, setStatus] = useState(''); const [method, setMethod] = useState(''); const [from, setFrom] = useState(''); const [to, setTo] = useState('');
    const [q, setQ] = useState(''); const [page, setPage] = useState(1); const [open, setOpen] = useState<number | null>(null);
    const dq = useDebounced(q);
    const { data, err, loading, reload } = useLoad(() => fi<PRes>(`payments${qs({ year_id: yearId, status, method, from, to, q: dq, page })}`), [yearId, status, method, from, to, dq, page]);
    const c = data?.counts || {}; const n = (k: string) => c[k] || 0;
    return (
        <>
            <Tabs value={status} onChange={(v) => { setStatus(v); setPage(1); }} items={[{ key: '', label: 'Tất cả' }, { key: 'pending', label: 'Chờ xác nhận', count: n('pending'), tone: 'amber' }, { key: 'confirmed', label: 'Đã xác nhận', count: n('confirmed'), tone: 'green' }, { key: 'rejected', label: 'Từ chối', count: n('rejected'), tone: 'rose' }, { key: 'cancelled', label: 'Đã hủy', count: n('cancelled') }]} />
            <div className="ta-filters">
                <label className="ta-search"><Ico n="search" size={16} /><input placeholder="Mã phiếu, nội dung CK, họ tên, mã HS…" value={q} onChange={(e) => { setQ(e.target.value); setPage(1); }} /></label>
                <select value={method} onChange={(e) => { setMethod(e.target.value); setPage(1); }}><option value="">Mọi hình thức</option>{Object.entries(meta.methods).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input type="date" value={from} onChange={(e) => { setFrom(e.target.value); setPage(1); }} className="ta-btn" aria-label="Từ ngày" /><span className="ta-mute">đến</span><input type="date" value={to} onChange={(e) => { setTo(e.target.value); setPage(1); }} className="ta-btn" aria-label="Đến ngày" />
                {(from || to || method || status || q) && <Btn size="sm" tone="ghost" onClick={() => { setFrom(''); setTo(''); setMethod(''); setStatus(''); setQ(''); setPage(1); }}>Xóa lọc</Btn>}
            </div>
            {data && <div className="fi-sum"><div><small>Số phiếu (theo bộ lọc)</small><b>{num(data.meta.total)}</b></div><div><small>Đã xác nhận</small><b className="fi-money g">{vnd(data.sum.confirmed)}</b></div><div><small>Đang chờ xác nhận</small><b className="fi-money">{vnd(data.sum.pending)}</b></div></div>}
            <Card pad={false}>
                {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : data.data.length === 0 ? <Empty icon="coin" title="Không có phiếu thu phù hợp" /> : (
                    <><div className="ta-tablewrap"><table className="ta-tbl big"><thead><tr><th>Phiếu thu</th><th>Học sinh</th><th>Hóa đơn</th><th>Hình thức</th><th>Số tiền</th><th>Ngày nộp</th><th>Trạng thái</th></tr></thead><tbody>
                    {data.data.map((p) => (
                        <tr key={p.id} onClick={() => setOpen(p.invoice_id)}>
                            <td><b>{p.code}</b>{p.reference && <small>{p.reference}</small>}</td><td><b>{p.sname}</b><small>{p.scode}</small></td><td>{p.invoice}</td><td>{p.method_label}</td><td className="fi-money"><b>{vnd(p.amount)}</b></td><td className="ta-time">{dt(p.paid_at)}</td>
                            <td><Pill tone={PAY_ST[p.status]?.tone || 'gray'} dot>{PAY_ST[p.status]?.label || p.status}</Pill>{p.confirmed_by && <small>bởi {p.confirmed_by}</small>}{p.reject_reason && <small style={{ color: '#be123c' }}>{p.reject_reason}</small>}</td>
                        </tr>))}</tbody></table></div>
                        <Pager page={data.meta.page} pages={data.meta.pages} total={data.meta.total} onPage={setPage} /></>)}
            </Card>
            <p className="ta-mute">Việc xác nhận / từ chối phiếu thu do kế toán thực hiện ở khu Kế toán. Trang này để giám sát và đối chiếu.</p>
            {open !== null && <InvoiceDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
        </>
    );
}

function Recon() {
    const [from, setFrom] = useState(monthStart(todayStr())); const [to, setTo] = useState(todayStr());
    const { data, err, loading, reload } = useLoad(() => fi<RRes>(`reconcile${qs({ from, to })}`), [from, to]);
    const preset = (k: string) => { const t = todayStr(); if (k === 'today') { setFrom(t); setTo(t); } else if (k === '7') { setFrom(addDays(t, -6)); setTo(t); } else if (k === 'month') { setFrom(monthStart(t)); setTo(t); } else { setFrom(addDays(t, -29)); setTo(t); } };
    const A = data?.anomalies; const bad = A ? A.duplicate_reference.length + A.overpaid.length + A.stale_pending.length : 0;
    return (
        <>
            <div className="ta-range fi-noprint">
                <div className="ta-seg" style={{ marginBottom: 0 }}><button onClick={() => preset('today')}>Hôm nay</button><button onClick={() => preset('7')}>7 ngày</button><button onClick={() => preset('month')}>Tháng này</button><button onClick={() => preset('30')}>30 ngày</button></div>
                <input type="date" value={from} max={to} onChange={(e) => e.target.value && setFrom(e.target.value)} className="ta-btn" /><span className="ta-mute">đến</span><input type="date" value={to} min={from} onChange={(e) => e.target.value && setTo(e.target.value)} className="ta-btn" />
                <span style={{ flex: 1 }} />
                <Btn size="sm" onClick={() => window.print()}><Ico n="print" size={15} />In biên bản</Btn>
                {data && <Btn size="sm" onClick={() => downloadCsv(`doi-soat-${from}_${to}.csv`, ['Ngày', 'Số phiếu', 'Tiền mặt', 'Chuyển khoản', 'Thẻ POS', 'Ví điện tử', 'Tổng'], data.days.map((d) => [d.date, d.count, d.by.cash || 0, d.by.bank_transfer || 0, d.by.card || 0, d.by.ewallet || 0, d.total]))}><Ico n="download" size={15} />Xuất CSV</Btn>}
            </div>
            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : (
                <>
                    <div className="fi-kpis four">
                        <div className="fi-kpi hero"><div className="top"><small>Tổng thu đã xác nhận</small><span className="ic"><Ico n="coin" size={17} /></span></div><b>{vnd(data.totals.amount)}</b><em>{num(data.totals.count)} phiếu · {fmtD(from)} – {fmtD(to)}</em></div>
                        {Object.keys(MLAB).slice(0, 1).map((k) => <div key={k} className="fi-kpi t-green"><div className="top"><small>Tiền mặt</small><span className="ic"><Ico n="coin" size={17} /></span></div><b>{vnd(data.by_method.cash || 0)}</b><em>cần khớp két quỹ</em></div>)}
                        <div className="fi-kpi t-sky"><div className="top"><small>Chuyển khoản</small><span className="ic"><Ico n="school" size={17} /></span></div><b>{vnd(data.by_method.bank_transfer || 0)}</b><em>cần khớp sao kê ngân hàng</em></div>
                        <div className="fi-kpi t-amber"><div className="top"><small>Chờ xác nhận / từ chối</small><span className="ic"><Ico n="clock" size={17} /></span></div><b>{num(data.totals.pending_n)} / {num(data.totals.rejected_n)}</b><em>{short(data.totals.pending_amt)} đang chờ</em></div>
                    </div>
                    <Card title="Phát hiện bất thường" sub="Hệ thống tự rà soát toàn bộ phiếu thu">
                        {bad === 0 ? <div className="fi-ok"><Ico n="check" size={20} />Không phát hiện bất thường: không trùng nội dung chuyển khoản, không hóa đơn thu thừa, không phiếu treo quá 3 ngày.</div> : (
                            <div className="fi-twocol">
                                {A!.duplicate_reference.length > 0 && <div><h4 className="fi-h4" style={{ marginTop: 0 }}>Trùng nội dung chuyển khoản ({A!.duplicate_reference.length})</h4>{A!.duplicate_reference.map((x) => <div key={x.reference} className="fi-note"><b>{x.reference}</b> – {x.n} phiếu, {vnd(x.amount)}</div>)}</div>}
                                {A!.overpaid.length > 0 && <div><h4 className="fi-h4" style={{ marginTop: 0 }}>Hóa đơn thu vượt số phải thu ({A!.overpaid.length})</h4>{A!.overpaid.map((x) => <div key={x.id} className="fi-note"><b>{x.code}</b> – phải thu {vnd(x.total)}, đã thu {vnd(x.paid)}</div>)}</div>}
                                {A!.stale_pending.length > 0 && <div><h4 className="fi-h4" style={{ marginTop: 0 }}>Phiếu chờ xác nhận quá 3 ngày ({A!.stale_pending.length})</h4>{A!.stale_pending.map((x) => <div key={x.id} className="fi-note"><b>{x.code}</b> – {x.sname}, {vnd(x.amount)} ({dt(x.paid_at)})</div>)}</div>}
                            </div>)}
                    </Card>
                    <div className="fi-grid g21">
                        <Card pad={false} title="Thu theo ngày" sub="Chỉ tính phiếu đã xác nhận">
                            {data.days.length === 0 ? <Empty icon="coin" title="Không có khoản thu nào trong khoảng này" /> : (
                                <div className="ta-tablewrap"><table className="ta-tbl fi-recon"><thead><tr><th>Ngày</th><th className="n">Số phiếu</th><th className="n">Tiền mặt</th><th className="n">Chuyển khoản</th><th className="n">Thẻ</th><th className="n">Ví</th><th className="n">Tổng</th></tr></thead><tbody>
                                {data.days.map((d) => <tr key={d.date}><td><b>{fmtD(d.date)}</b></td><td className="n">{d.count}</td><td className="n fi-money">{num(d.by.cash || 0)}</td><td className="n fi-money">{num(d.by.bank_transfer || 0)}</td><td className="n fi-money">{num(d.by.card || 0)}</td><td className="n fi-money">{num(d.by.ewallet || 0)}</td><td className="n fi-money"><b>{num(d.total)}</b></td></tr>)}
                                <tr><td><b>Cộng</b></td><td className="n"><b>{data.totals.count}</b></td><td className="n fi-money"><b>{num(data.by_method.cash || 0)}</b></td><td className="n fi-money"><b>{num(data.by_method.bank_transfer || 0)}</b></td><td className="n fi-money"><b>{num(data.by_method.card || 0)}</b></td><td className="n fi-money"><b>{num(data.by_method.ewallet || 0)}</b></td><td className="n fi-money g">{num(data.totals.amount)}</td></tr></tbody></table></div>)}
                        </Card>
                        <Card title="Biểu đồ theo ngày"><GroupBars aLabel="Tiền mặt" bLabel="Chuyển khoản" aColor="#f59e0b" items={data.days.slice(-14).map((d) => ({ label: fmtS(d.date), a: d.by.cash || 0, b: (d.by.bank_transfer || 0) + (d.by.card || 0) + (d.by.ewallet || 0) }))} /></Card>
                    </div>
                    <p className="ta-mute fi-noprint">Cách đối soát: so tổng “Tiền mặt” với biên bản kiểm quỹ, tổng “Chuyển khoản” với sao kê ngân hàng cùng kỳ. Cần xem chi tiết từng phiếu, mở <Link href="/admin/finance/thanh-toan" className="ta-link">Danh sách phiếu thu</Link>.</p>
                </>)}
        </>
    );
}