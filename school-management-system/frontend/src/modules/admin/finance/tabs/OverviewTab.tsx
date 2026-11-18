'use client';

import { BarChart, Donut } from '../charts';
import { Empty, Icon, METHOD, METHOD_COLOR, short, vnd } from '../ui';
import type { Overview, TabKey } from '../types';
import s from '../finance.module.css';

const ym = (v: string) => `${v.slice(5, 7)}/${v.slice(2, 4)}`;
const PSTATUS: Record<string, [string, string]> = { open: ['Đang thu', s.bOk], closed: ['Đã đóng', s.bMute], draft: ['Nháp', s.bInfo] };

export default function OverviewTab({ ov, go }: { ov: Overview; go: (t: TabKey) => void }) {
    const t = ov.totals;
    const maxRem = Math.max(1, ...ov.top_classes.map((c) => c.remaining));
    const parts = ov.by_method.map((m) => ({ label: METHOD[m.method] || m.method, value: m.amt, color: METHOD_COLOR[m.method] || '#64748b' }));
    const todo = [
        { n: ov.pending.n, icon: 'receipt', title: `${ov.pending.n} phiếu thu chờ xác nhận`, sub: `Tổng ${vnd(ov.pending.amt)}`, tab: 'payments' as TabKey },
        { n: t.overdue_students, icon: 'alert', title: `${t.overdue_students} học sinh nợ quá hạn`, sub: `Tổng nợ quá hạn ${vnd(t.overdue_amt)}`, tab: 'debts' as TabKey },
        { n: ov.disputes_open, icon: 'chat', title: `${ov.disputes_open} khiếu nại chưa trả lời`, sub: 'Phụ huynh đang chờ phản hồi', tab: 'disputes' as TabKey },
    ].filter((x) => x.n > 0);

    return (
        <div className={`${s.panel} ${s.stack}`}>
            <section className={s.card}>
                <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="alert" /> Cần xử lý ngay</h3></div>
                {todo.length === 0 ? <Empty icon="🎉" text="Không có việc tồn đọng. Mọi thứ đều đã được xử lý." /> : (
                    <div className={s.g3}>{todo.map((x) => (
                        <div key={x.tab} className={s.todo}><div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                            <div className={s.itemIco} style={{ background: 'var(--warnSoft)', color: 'var(--warn)' }}><Icon n={x.icon} /></div>
                            <div><b>{x.title}</b><span className={s.cardSub}>{x.sub}</span></div></div>
                            <button className={`${s.btn} ${s.btnS} ${s.btnP}`} onClick={() => go(x.tab)}>Xử lý</button></div>))}</div>)}
            </section>

            <div className={s.g21}>
                <section className={s.card}>
                    <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="chart" /> Số tiền thu theo tháng</h3><div className={s.cardSub}>Chỉ tính các phiếu thu đã xác nhận</div></div></div>
                    {ov.monthly.length === 0 ? <Empty icon="📊" text="Chưa có dữ liệu thu tiền." /> : <BarChart data={ov.monthly.map((m) => ({ label: ym(m.ym), value: m.amt }))} />}
                </section>
                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="wallet" /> Phương thức thanh toán</h3></div>
                    {parts.length === 0 ? <Empty text="Chưa có dữ liệu." /> : (
                        <div className={s.donutRow}>
                            <Donut parts={parts} center={`${t.rate}%`} />
                            <div className={s.legend}>{parts.map((p) => <div key={p.label} className={s.lgItem}><span className={s.lgDot} style={{ background: p.color }} /> {p.label}<span className={s.lgVal}>{short(p.value)}</span></div>)}</div>
                        </div>)}
                    <div className={s.cardSub} style={{ marginTop: 10 }}>Giữa vòng: tỷ lệ thu / tổng phải thu</div>
                </section>
            </div>

            <div className={s.g2}>
                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="percent" /> Tiến độ thu theo khối</h3></div>
                    {ov.by_grade.length === 0 ? <Empty text="Chưa có dữ liệu." /> : ov.by_grade.map((g) => {
                        const rate = g.invoiced ? Math.round((g.paid / g.invoiced) * 100) : 0;
                        return (<div key={String(g.grade)} className={s.hrow}><b>{g.grade ? `Khối ${g.grade}` : 'Chưa xếp lớp'}</b>
                            <div className={s.bar}><div className={s.barFill} style={{ width: `${rate}%` }} /></div><span className={s.num}>{rate}% · còn {short(g.remaining)}</span></div>);
                    })}
                </section>
                <section className={s.card}>
                    <div className={s.cardHead}><h3 className={s.cardTitle}><Icon n="users" /> Lớp còn nợ nhiều nhất</h3></div>
                    {ov.top_classes.length === 0 ? <Empty icon="🎉" text="Không có lớp nào còn nợ." /> : ov.top_classes.map((c) => (
                        <div key={c.class_id} className={s.hrow}><b>Lớp {c.class_name}</b>
                            <div className={s.bar}><div className={s.barFill} style={{ width: `${(c.remaining / maxRem) * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#e11d48)' }} /></div><span className={s.num}>{short(c.remaining)}</span></div>))}
                </section>
            </div>

            <section className={s.card}>
                <div className={s.cardHead}><div><h3 className={s.cardTitle}><Icon n="calendar" /> Tiến độ theo đợt thu</h3></div><button className={s.btn} onClick={() => go('periods')}>Quản lý đợt thu</button></div>
                {ov.by_period.length === 0 ? <Empty text="Chưa có đợt thu." /> : ov.by_period.map((p) => {
                    const rate = p.invoiced ? Math.round((p.paid / p.invoiced) * 100) : 0; const [lb, cl] = PSTATUS[p.status] || [p.status, s.bMute];
                    return (<div key={p.id} className={s.hrow} style={{ gridTemplateColumns: '200px 1fr 190px' }}>
                        <span><b>{p.name || p.code}</b> <span className={`${s.badge} ${cl}`}>{lb}</span></span>
                        <div className={s.bar}><div className={s.barFill} style={{ width: `${rate}%` }} /></div>
                        <span className={s.num}>{short(p.paid)} / {short(p.invoiced)} ({rate}%)</span></div>);
                })}
            </section>
        </div>
    );
}