'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import './fees.css';
import { qs, vnd } from './_shared/api';
import { Empty, ErrorBox, Loading, Pill, useFee } from './_shared/ui';

const CAT_COLOR = ['#0284c7', '#10b981', '#f59e0b', '#8b5cf6', '#f43f5e', '#64748b'];

export default function FeesOverview() {
    const sum = useFee<any>('summary');
    const [year, setYear] = useState('');
    const [status, setStatus] = useState('');
    const [q, setQ] = useState('');
    const [dq, setDq] = useState('');
    useEffect(() => { const id = setTimeout(() => setDq(q), 300); return () => clearTimeout(id); }, [q]);
    const inv = useFee<any>(`invoices${qs({ year_id: year, status, q: dq })}`);

    if (sum.err) return <div className="fe-page"><ErrorBox msg={sum.err} retry={sum.reload} /></div>;
    if (!sum.data) return <div className="fe-page"><Loading /></div>;
    const s = sum.data;
    const t = s.totals;
    const cur = s.current;
    const R = 56, C = 2 * Math.PI * R;
    const catTotal = s.by_category.reduce((a: number, c: any) => a + c.amount, 0) || 1;
    const c = inv.data?.counts;
    const TABS: [string, string, number | undefined][] = [['', 'Tất cả', c?.all], ['unpaid', 'Chưa đóng', c?.unpaid], ['partial', 'Đóng một phần', c?.partial], ['overdue', 'Quá hạn', c?.overdue], ['paid', 'Đã đóng', c?.paid]];

    return (
        <div className="fe-page">
            <header className="fe-hero">
                <div>
                    <p className="fe-eyebrow">Học phí và các khoản thu</p>
                    <h1>Hóa đơn học phí</h1>
                    <p className="sub">Năm học {s.year} · theo dõi công nợ, thanh toán và tải biên lai</p>
                    <p className={`fe-big ${t.balance === 0 ? 'zero' : ''}`}>{t.balance === 0 ? 'Không còn khoản nợ' : vnd(t.balance)}</p>
                    <p className="sub">{t.balance === 0 ? 'Bạn đã hoàn thành các khoản phải đóng.' : `Còn phải đóng ở ${t.open_count} hóa đơn${t.pending_amount ? ` · ${vnd(t.pending_amount)} đang chờ xác nhận` : ''}`}</p>
                    <div className="fe-hero-act">
                        {s.next_due && <Link className="fe-btn light" href={`/student/fees/${s.next_due.id}/pay`}>Thanh toán ngay</Link>}
                        <Link className="fe-btn hero-ghost" href="/student/fees/payments">Lịch sử thanh toán</Link>
                        <Link className="fe-btn hero-ghost" href="/student/fees/schedule">Biểu phí và miễn giảm</Link>
                    </div>
                </div>
                <div className="fe-ring">
                    <div className="fe-ring-c" role="img" aria-label={`Đã đóng ${cur.percent}% học phí năm học`}>
                        <svg width="132" height="132" viewBox="0 0 132 132"><circle cx="66" cy="66" r={R} fill="none" stroke="rgba(255,255,255,.18)" strokeWidth="12" /><circle cx="66" cy="66" r={R} fill="none" stroke="#6ee7b7" strokeWidth="12" strokeLinecap="round" strokeDasharray={`${(C * cur.percent) / 100} ${C}`} /></svg>
                        <b>{cur.percent}%</b>
                    </div>
                    <ul>
                        <li><span>Tổng phải đóng năm học</span><b>{vnd(cur.billed)}</b></li>
                        <li><span>Đã đóng</span><b>{vnd(cur.paid)}</b></li>
                        <li><span>Được miễn giảm</span><b>{vnd(t.discount)}</b></li>
                    </ul>
                </div>
            </header>

            {t.overdue_count > 0 && (
                <div className="fe-alert err" role="alert">
                    <span><b>Có {t.overdue_count} hóa đơn quá hạn</b> với tổng {vnd(t.overdue_amount)}. Vui lòng thanh toán hoặc liên hệ phòng Kế toán nếu cần hỗ trợ.</span>
                    <button className="fe-btn sm" onClick={() => setStatus('overdue')}>Xem hóa đơn quá hạn</button>
                </div>
            )}
            {s.pending_payments.length > 0 && (
                <div className="fe-alert warn">
                    <span><b>{s.pending_payments.length} khoản thanh toán đang chờ kế toán xác nhận</b> ({vnd(t.pending_amount)}). Thường mất 1 đến 2 ngày làm việc.</span>
                    <Link className="fe-btn sm ghost" href="/student/fees/payments?status=pending">Xem chi tiết</Link>
                </div>
            )}

            <div className="fe-grid fe-g4" style={{ marginBottom: 18 }}>
                <div className="fe-stat"><span>Tổng đã xuất hóa đơn</span><b>{vnd(t.billed)}</b><em>Tất cả năm học</em></div>
                <div className="fe-stat ok"><span>Đã thanh toán</span><b>{vnd(t.paid)}</b><em>Đã được xác nhận</em></div>
                <div className={`fe-stat ${t.balance > 0 ? 'warn' : 'ok'}`}><span>Còn phải đóng</span><b>{vnd(t.balance)}</b><em>{t.open_count} hóa đơn</em></div>
                <div className={`fe-stat ${t.overdue_count ? 'err' : 'ok'}`}><span>Quá hạn</span><b>{vnd(t.overdue_amount)}</b><em>{t.overdue_count} hóa đơn</em></div>
            </div>

            <div className="fe-grid fe-gmain">
                <section className="fe-card" aria-label="Danh sách hóa đơn">
                    <div className="fe-card-h">
                        <h2>Danh sách hóa đơn</h2>
                        <select className="fe-sel" value={year} onChange={(e) => setYear(e.target.value)} aria-label="Lọc theo năm học">
                            <option value="">Tất cả năm học</option>
                            {inv.data?.years.map((y: any) => <option key={y.id} value={y.id}>{y.label}</option>)}
                        </select>
                    </div>
                    <div className="fe-bar">
                        <div className="fe-tabs">{TABS.map(([k, l, n]) => <button key={k} className={`fe-tab ${status === k ? 'on' : ''}`} onClick={() => setStatus(k)}>{l}{n !== undefined && <em>{n}</em>}</button>)}</div>
                        <input className="fe-in" placeholder="Tìm theo mã hóa đơn…" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Tìm hóa đơn" />
                    </div>
                    {inv.err ? <div style={{ padding: 16 }}><ErrorBox msg={inv.err} retry={inv.reload} /></div> : !inv.data ? <Loading /> : inv.data.items.length === 0 ? <Empty title="Không có hóa đơn phù hợp" text="Thử đổi bộ lọc hoặc năm học." /> : (
                        <div style={{ opacity: inv.loading ? 0.55 : 1 }}>
                            {inv.data.items.map((v: any) => (
                                <div key={v.id} className="fe-inv">
                                    <div>
                                        <h3><Link href={`/student/fees/${v.id}`}>{v.title}</Link></h3>
                                        <small>{v.code} · Hạn nộp {v.due_date}{v.overdue ? ` · trễ ${v.overdue_days} ngày` : ''}</small>
                                        <div className={`fe-prog ${v.status === 'partial' ? 'warn' : ''}`} aria-hidden="true"><i style={{ width: `${v.total ? Math.round((v.paid * 100) / v.total) : 100}%` }} /></div>
                                    </div>
                                    <div className="amt"><b>{vnd(v.total)}</b><small>Tổng hóa đơn</small></div>
                                    <div className="amt"><b>{v.balance ? vnd(v.balance) : '—'}</b><small>{v.balance ? 'Còn phải đóng' : 'Đã đủ'}</small></div>
                                    <div className="fe-inv-act">
                                        <Pill status={v.status} overdue={v.overdue} />
                                        <Link className="fe-btn sm ghost" href={`/student/fees/${v.id}`}>Chi tiết</Link>
                                        {v.balance > 0 && v.pending < v.balance && <Link className="fe-btn sm" href={`/student/fees/${v.id}/pay`}>Thanh toán</Link>}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </section>

                <aside>
                    <section className="fe-card">
                        <div className="fe-card-h"><h2>Cơ cấu khoản thu {s.year}</h2></div>
                        <div className="fe-card-b">
                            <div className="fe-bars">
                                {s.by_category.map((x: any, i: number) => (
                                    <div key={x.key} className="fe-brow"><span>{x.label}</span><div><i style={{ width: `${(x.amount * 100) / catTotal}%`, background: CAT_COLOR[i % CAT_COLOR.length] }} /></div><b>{vnd(x.amount)}</b></div>
                                ))}
                            </div>
                        </div>
                    </section>
                    <section className="fe-card">
                        <div className="fe-card-h"><h2>Theo năm học</h2></div>
                        <div className="fe-tw"><table className="fe-table" style={{ minWidth: 0 }}><thead><tr><th>Năm học</th><th className="n">Đã đóng</th><th className="n">Còn nợ</th></tr></thead><tbody>
                        {s.by_year.map((y: any) => <tr key={y.year_id}><td>{y.year}<span className="fe-sub">{y.invoices} hóa đơn</span></td><td className="n">{vnd(y.paid)}</td><td className="n">{y.balance ? <b style={{ color: '#be123c' }}>{vnd(y.balance)}</b> : '—'}</td></tr>)}
                        </tbody></table></div>
                    </section>
                    {s.waivers.length > 0 && (
                        <section className="fe-card">
                            <div className="fe-card-h"><h2>Chế độ miễn giảm</h2><Link className="fe-btn sm ghost" href="/student/fees/schedule">Chi tiết</Link></div>
                            <div className="fe-card-b">{s.waivers.map((w: any) => <p key={w.id} style={{ marginBottom: 6 }}><b>{w.label}</b>: giảm {w.percent}% học phí <span className="fe-sub">Năm học {w.year}</span></p>)}</div>
                        </section>
                    )}
                    <section className="fe-card">
                        <div className="fe-card-h"><h2>Liên hệ phòng Kế toán</h2></div>
                        <div className="fe-card-b"><p>{s.contact.office}</p><p style={{ marginTop: 6 }}>Hotline: <b>{s.contact.hotline}</b></p></div>
                    </section>
                </aside>
            </div>
        </div>
    );
}