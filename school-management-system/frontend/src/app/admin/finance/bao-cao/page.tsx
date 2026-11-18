'use client';
// Báo cáo tài chính (/admin/finance/bao-cao)
import React from 'react';
import { AreaChart, Btn, Card, Donut, ErrorBox, GroupBars, HBars, Ico, Loading, downloadCsv, fi, num, pct, qs, short, useFi, useLoad, useTa, vnd } from '../_fi';

type R = {
    by_class: { class_name: string; grade: number; n: number; billed: number; paid: number; balance: number }[];
    by_term: { term: string; label: string; n: number; billed: number; paid: number; balance: number; discount: number }[];
    by_category: { key: string; label: string; amount: number; lines: number }[];
    months: { month: string; income: number; count: number; expense: number }[];
    compare: { id: number; label: string; billed: number; paid: number; expense: number; rate: number }[];
};

export default function ReportPage() {
    const { yearId, meta } = useFi(); const { toast } = useTa();
    const { data, err, loading, reload } = useLoad(() => fi<R>(`report${qs({ year_id: yearId })}`), [yearId]);
    if (loading && !data) return <Loading />;
    if (err || !data) return <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} />;
    const yl = meta.years.find((y) => y.id === yearId)?.label;
    const inc = data.months.reduce((s, m) => s + m.income, 0), exp = data.months.reduce((s, m) => s + m.expense, 0);
    const csv = () => { downloadCsv(`bao-cao-lop-${yl}.csv`, ['Lớp', 'Khối', 'Số hóa đơn', 'Phải thu', 'Đã thu', 'Còn nợ', 'Tỷ lệ thu %'], data.by_class.map((c) => [c.class_name, c.grade, c.n, c.billed, c.paid, c.balance, c.billed ? Math.round((c.paid * 1000) / c.billed) / 10 : 0])); toast('Đã xuất báo cáo theo lớp.'); };
    return (
        <div className="ta-page">
            <div className="ta-filters"><span className="ta-mute">Báo cáo năm học <b>{yl}</b> · 12 tháng gần nhất cho biểu đồ thu – chi</span><span style={{ flex: 1 }} /><Btn size="sm" onClick={csv}><Ico n="download" size={15} />Xuất CSV theo lớp</Btn><Btn size="sm" onClick={() => window.print()}><Ico n="print" size={15} />In báo cáo</Btn></div>
            <div className="fi-kpis four">
                <div className="fi-kpi t-green"><div className="top"><small>Thu 12 tháng</small></div><b>{short(inc)}</b><em>{vnd(inc)}</em></div>
                <div className="fi-kpi t-rose"><div className="top"><small>Chi 12 tháng</small></div><b>{short(exp)}</b><em>{vnd(exp)}</em></div>
                <div className={`fi-kpi ${inc - exp >= 0 ? 't-gold' : 't-rose'}`}><div className="top"><small>Chênh lệch thu – chi</small></div><b>{short(inc - exp)}</b><em>{inc - exp >= 0 ? 'thặng dư' : 'thâm hụt'}</em></div>
                <div className="fi-kpi t-sky"><div className="top"><small>Số giao dịch thu</small></div><b>{num(data.months.reduce((s, m) => s + m.count, 0))}</b><em>đã xác nhận</em></div>
            </div>
            <div className="fi-grid g21">
                <Card title="Thu – chi theo tháng" sub="12 tháng gần nhất"><GroupBars aLabel="Thu" bLabel="Chi" aColor="#059669" bColor="#f43f5e" items={data.months.map((m) => ({ label: m.month.slice(5) + '/' + m.month.slice(2, 4), a: m.income, b: m.expense }))} /></Card>
                <Card title="Cơ cấu phải thu" sub="theo nhóm khoản thu"><Donut center="đồng" items={data.by_category.map((c) => ({ label: c.label, n: c.amount }))} /></Card>
            </div>
            <Card title="So sánh các năm học" pad={false}>
                <div className="ta-tablewrap"><table className="ta-tbl"><thead><tr><th>Năm học</th><th>Phải thu</th><th>Đã thu</th><th>Tỷ lệ thu</th><th>Chi</th><th>Chênh lệch</th></tr></thead><tbody>
                {data.compare.map((c) => <tr key={c.id} style={c.id === yearId ? { background: 'var(--ta-soft, #ecfdf5)' } : undefined}><td><b>{c.label}</b></td><td className="fi-money">{vnd(c.billed)}</td><td className="fi-money">{vnd(c.paid)}</td><td>{pct(c.paid, c.billed)}%</td><td className="fi-money">{vnd(c.expense)}</td><td className="fi-money"><b>{vnd(c.paid - c.expense)}</b></td></tr>)}</tbody></table></div>
            </Card>
            <div className="fi-grid g2">
                <Card title="Theo học kỳ">
                    <HBars items={data.by_term.map((t) => ({ label: t.label, sub: `${num(t.n)} hóa đơn · giảm ${short(t.discount)}`, value: t.paid, of: t.billed, right: `${short(t.paid)} / ${short(t.billed)}` }))} />
                </Card>
                <Card title="Dòng thu theo tháng"><AreaChart points={data.months.map((m) => ({ label: m.month.slice(5), value: m.income }))} /></Card>
            </div>
            <Card title="Tình hình thu theo lớp" pad={false} sub={`${data.by_class.length} lớp`}>
                <div className="ta-tablewrap"><table className="ta-tbl"><thead><tr><th>Lớp</th><th>Khối</th><th>Hóa đơn</th><th>Phải thu</th><th>Đã thu</th><th>Còn nợ</th><th>Tỷ lệ</th></tr></thead><tbody>
                {data.by_class.map((c) => { const r = c.billed ? (c.paid * 100) / c.billed : 0; return <tr key={c.class_name}><td><b>{c.class_name}</b></td><td>{c.grade}</td><td>{num(c.n)}</td><td className="fi-money">{vnd(c.billed)}</td><td className="fi-money">{vnd(c.paid)}</td><td className="fi-money">{vnd(c.balance)}</td><td><div className="fi-hb"><div><div className="trk"><i className={r >= 90 ? 't-green' : r >= 60 ? 't-gold' : 't-rose'} style={{ width: `${Math.min(100, r)}%` }} /></div><b>{r.toFixed(0)}%</b></div></div></td></tr>; })}</tbody></table></div>
            </Card>
        </div>
    );
}