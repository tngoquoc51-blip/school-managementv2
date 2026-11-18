'use client';
// Tài chính & Học phí – Tổng quan (/admin/finance). Không tự bọc layout: layout.tsx đã lo.
import Link from 'next/link';
import React from 'react';
import { AreaChart, Card, Donut, ErrorBox, GroupBars, HBars, Ico, Loading, Pill, Ring, Segs, dt, fi, fmtS, num, rateTone, short, useFi, useLoad, vnd } from './_fi';

type Ov = {
    year_id: number; today: string;
    totals: { invoices: number; billed: number; paid: number; balance: number; discount: number; rate: number; paid_n: number; partial_n: number; unpaid_n: number; cancel_n: number; overdue_n: number; overdue_amt: number; debtors: number };
    cash: { today: number; month: number; expense_month: number; expense_year: number; net_year: number };
    pending: { n: number; amount: number }; disputes_open: number;
    series: { date: string; amount: number; count: number }[];
    by_grade: { grade: number; n: number; billed: number; paid: number }[]; by_term: { term: string; label: string; n: number; billed: number; paid: number }[];
    by_category: { key: string; label: string; amount: number }[]; by_method: { key: string; label: string; n: number; amount: number }[];
    recent: { id: number; code: string; amount: number; method_label: string; status: string; paid_at: string | null; sname: string; scode: string; invoice: string }[];
    top_debt_classes: { class_name: string; students: number; balance: number }[];
};

export default function FinanceHome() {
    const { yearId, meta } = useFi();
    const { data: o, err, loading, reload } = useLoad(() => fi<Ov>(`overview?year_id=${yearId}`), [yearId]);
    if (loading && !o) return <Loading text="Đang tổng hợp số liệu…" />;
    if (err || !o) return <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} />;
    const t = o.totals; const empty = t.invoices === 0;
    const alerts = [
        t.overdue_n > 0 && { href: '/admin/finance/cong-no', tone: 'rose', title: `${num(t.overdue_n)} hóa đơn quá hạn`, text: `Tổng ${vnd(t.overdue_amt)} chưa thu` },
        o.pending.n > 0 && { href: '/admin/finance/thanh-toan', tone: 'amber', title: `${num(o.pending.n)} phiếu thu chờ xác nhận`, text: `Tổng ${vnd(o.pending.amount)}` },
        o.disputes_open > 0 && { href: '/admin/finance/khieu-nai', tone: 'violet', title: `${num(o.disputes_open)} khiếu nại chưa trả lời`, text: 'Phụ huynh/học sinh đang chờ phản hồi' },
    ].filter(Boolean) as { href: string; tone: string; title: string; text: string }[];

    return (
        <div className="ta-page">
            {empty && <div className="fi-note"><b>Năm học này chưa có hóa đơn nào.</b> Hóa đơn được phát hành từ khu Kế toán (Đợt thu). Bạn có thể chọn năm học khác ở góc trên bên phải.</div>}
            <div className="fi-kpis">
                <div className="fi-kpi hero"><div className="top"><small>Đã thu năm học {meta.years.find((y) => y.id === yearId)?.label}</small><span className="ic"><Ico n="coin" size={17} /></span></div><b>{vnd(t.paid)}</b><em>{t.rate}% so với phải thu</em></div>
                <div className="fi-kpi t-indigo"><div className="top"><small>Phải thu</small><span className="ic"><Ico n="doc" size={17} /></span></div><b>{vnd(t.billed)}</b><em>{num(t.invoices - t.cancel_n)} hóa đơn · giảm {short(t.discount)}</em></div>
                <Link href="/admin/finance/cong-no" className="fi-kpi t-rose"><div className="top"><small>Còn nợ</small><span className="ic"><Ico n="alert" size={17} /></span></div><b>{vnd(t.balance)}</b><em>{num(t.debtors)} học sinh còn nợ</em></Link>
                <Link href="/admin/finance/cong-no" className="fi-kpi t-amber"><div className="top"><small>Quá hạn</small><span className="ic"><Ico n="clock" size={17} /></span></div><b>{vnd(t.overdue_amt)}</b><em>{num(t.overdue_n)} hóa đơn</em></Link>
                <Link href="/admin/finance/chi-phi" className="fi-kpi t-gold"><div className="top"><small>Thu – chi năm học</small><span className="ic"><Ico n="trend" size={17} /></span></div><b style={{ color: o.cash.net_year < 0 ? '#be123c' : undefined }}>{vnd(o.cash.net_year)}</b><em>Chi {short(o.cash.expense_year)}</em></Link>
            </div>
            <div className="fi-kpis four">
                <div className="fi-kpi t-green"><div className="top"><small>Thu hôm nay</small><span className="ic"><Ico n="sun" size={17} /></span></div><b>{vnd(o.cash.today)}</b><em>đã xác nhận</em></div>
                <div className="fi-kpi t-sky"><div className="top"><small>Thu tháng này</small><span className="ic"><Ico n="cal" size={17} /></span></div><b>{vnd(o.cash.month)}</b><em>chi {short(o.cash.expense_month)} trong tháng</em></div>
                <Link href="/admin/finance/thanh-toan" className="fi-kpi t-amber"><div className="top"><small>Chờ xác nhận</small><span className="ic"><Ico n="clock" size={17} /></span></div><b>{num(o.pending.n)}</b><em>{vnd(o.pending.amount)}</em></Link>
                <Link href="/admin/finance/khieu-nai" className="fi-kpi t-violet"><div className="top"><small>Khiếu nại mở</small><span className="ic"><Ico n="mega" size={17} /></span></div><b>{num(o.disputes_open)}</b><em>cần trả lời</em></Link>
            </div>

            <div className="fi-grid g21">
                <Card title="Số tiền thu 30 ngày gần nhất" sub="Tính theo ngày nộp của các phiếu thu đã xác nhận" right={<Link href="/admin/finance/thanh-toan" className="ta-link">Đối soát</Link>}>
                    <AreaChart points={o.series.map((s) => ({ label: fmtS(s.date), value: s.amount }))} />
                </Card>
                <Card title="Tiến độ thu">
                    <div className="fi-row" style={{ justifyContent: 'center', marginBottom: 14 }}><Ring value={t.rate} size={120} label="đã thu" tone={rateTone(t.rate)} /></div>
                    <Segs items={[{ label: 'Đủ', n: t.paid_n, color: '#10b981' }, { label: 'Một phần', n: t.partial_n, color: '#f59e0b' }, { label: 'Chưa thu', n: t.unpaid_n, color: '#f43f5e' }, { label: 'Hủy', n: t.cancel_n, color: '#94a3b8' }]} />
                </Card>
            </div>

            <div className="fi-grid g3">
                <Card title="Thu theo khối lớp" sub="Phải thu và đã thu"><GroupBars aLabel="Phải thu" bLabel="Đã thu" items={o.by_grade.map((g) => ({ label: g.grade ? `Khối ${g.grade}` : 'Chưa xếp', a: g.billed, b: g.paid }))} /></Card>
                <Card title="Cơ cấu khoản thu"><Donut center="đồng" items={o.by_category.map((c) => ({ label: c.label, n: c.amount }))} /></Card>
                <Card title="Hình thức thanh toán"><Donut center="phiếu" items={o.by_method.map((m) => ({ label: m.label, n: m.amount }))} /></Card>
            </div>

            <div className="fi-grid g2">
                <Card title="Cần chú ý" sub="Việc cần xử lý ngay">
                    {alerts.length === 0 ? <div className="fi-ok"><Ico n="check" size={20} />Không có việc tồn đọng. Mọi khoản đều đang trong tầm kiểm soát.</div>
                        : <div className="fi-alerts">{alerts.map((a) => <Link key={a.href} href={a.href} className={`t-${a.tone}`}><Ico n="alert" size={18} /><div>{a.title}<span>{a.text}</span></div></Link>)}</div>}
                    <h4 className="fi-h4">Lớp nợ nhiều nhất</h4>
                    {o.top_debt_classes.length === 0 ? <p className="ta-mute">Không có lớp nào còn nợ.</p> : <HBars tone="rose" items={o.top_debt_classes.map((c) => ({ label: `Lớp ${c.class_name}`, sub: `${c.students} học sinh`, value: c.balance }))} />}
                </Card>
                <Card title="Phiếu thu gần đây" right={<Link href="/admin/finance/thanh-toan" className="ta-link">Xem tất cả</Link>}>
                    {o.recent.length === 0 ? <p className="ta-mute">Chưa có phiếu thu nào.</p> : <ul className="fi-pays">{o.recent.map((p) => (
                        <li key={p.id}><div><b>{p.sname}</b><small>{p.code} · {p.method_label} · HĐ {p.invoice}</small></div>
                            <div style={{ textAlign: 'right' }}><b className="fi-money">{vnd(p.amount)}</b><small>{p.status === 'confirmed' ? <Pill tone="green" dot>Đã xác nhận</Pill> : p.status === 'pending' ? <Pill tone="amber" dot>Chờ xác nhận</Pill> : <Pill tone="slate">{p.status}</Pill>} {dt(p.paid_at)}</small></div></li>))}</ul>}
                </Card>
            </div>
            {o.by_term.length > 0 && <Card title="Theo kỳ thu"><HBars items={o.by_term.map((x) => ({ label: x.label, sub: `${num(x.n)} hóa đơn · phải thu ${short(x.billed)}`, value: x.paid, of: x.billed, right: `${x.billed ? Math.round((x.paid * 100) / x.billed) : 0}%` }))} /></Card>}
        </div>
    );
}
