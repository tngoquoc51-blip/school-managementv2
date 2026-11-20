
'use client';
// Tổng quan dự giờ (/teacher/observations)
import Link from 'next/link';
import React, { useState } from 'react';
import { Bar, Empty, ErrorBox, Ico, Loading, Ring, RatingPill, Rating, Session, SessionDrawer, SessionRow, fmtD, num, ob, useLoad, useTa } from './_ob';

type Ov = {
    personal: boolean; is_admin: boolean; settings: { quota_observe: number; quota_taught: number };
    quota?: { observe: { done: number; target: number }; taught: { done: number; target: number } };
    kpi?: { upcoming: number; waiting: number; eval_todo: number; received: number; avg_percent: number | null; avg_rating: Rating | null; actions_open: number; unack: number };
    attention?: { type: string; prio: string; title: string; hint: string; link: string }[]; upcoming?: Session[];
    recent?: { id: number; title: string; date: string; subject: string | null; class_name: string | null; observer: string; percent: number; rating: Rating }[];
    by_month?: { m: string; n: number }[];
    school?: { sessions: number; pending: number; scheduled: number; completed: number; cancelled: number; declined: number; evals: number; avg_percent: number | null; teachers_total: number };
};
const AT: Record<string, { icon: string; tone: string }> = { respond: { icon: 'user', tone: 'amber' }, invite: { icon: 'mega', tone: 'violet' }, eval: { icon: 'pen', tone: 'rose' }, ack: { icon: 'eye', tone: 'sky' }, late: { icon: 'clock', tone: 'rose' } };

export default function Overview() {
    const { staff } = useTa(); const { data, err, loading, reload } = useLoad(() => ob<Ov>('overview'), []); const [open, setOpen] = useState<number | null>(null);
    if (loading && !data) return <div className="ta-page"><Loading /></div>;
    if (err || !data) return <div className="ta-page"><ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /></div>;
    const k = data.kpi; const q = data.quota; const max = Math.max(1, ...(data.by_month || []).map((m) => m.n));
    return (
        <div className="ta-page">
            {data.personal && k && q && (<>
                <div className="ob-kpis">
                    <Link href="/teacher/observations/lich?status=open" className="ob-kpi t-sky"><div className="top"><small>Buổi sắp tới</small><span className="ic"><Ico n="cal" size={17} /></span></div><b>{k.upcoming}</b><em>đang chờ hoặc đã lên lịch</em></Link>
                    <Link href="/teacher/observations/lich?status=pending" className="ob-kpi t-amber"><div className="top"><small>Chờ bạn phản hồi</small><span className="ic"><Ico n="user" size={17} /></span></div><b>{k.waiting}</b><em>đề nghị &amp; lời mời</em></Link>
                    <Link href="/teacher/observations/phieu" className="ob-kpi t-rose"><div className="top"><small>Phiếu cần điền</small><span className="ic"><Ico n="pen" size={17} /></span></div><b>{k.eval_todo}</b><em>tiết đã dự, chưa nộp phiếu</em></Link>
                    <Link href="/teacher/observations/ket-qua" className="ob-kpi t-green"><div className="top"><small>Nhận xét nhận được</small><span className="ic"><Ico n="trend" size={17} /></span></div><b>{k.received}</b><em>{k.avg_rating ? `TB ${k.avg_percent}% · ${k.avg_rating}` : 'chưa có phiếu nào'}</em></Link>
                    <Link href="/teacher/observations/ket-qua?tab=cai-tien" className="ob-kpi t-violet"><div className="top"><small>Việc cải tiến</small><span className="ic"><Ico n="list" size={17} /></span></div><b>{k.actions_open}</b><em>đang thực hiện</em></Link>
                </div>
                <div className="ob-g21">
                    <div style={{ display: 'grid', gap: 16 }}>
                        <section className="ta-card"><header><div><h3>Cần xử lý ngay</h3><p>Những việc đang chờ bạn trong hoạt động dự giờ</p></div></header>
                            {(data.attention || []).length === 0 ? <Empty icon="check" title="Không có việc nào tồn đọng" text="Bạn đã phản hồi và điền xong mọi phiếu." /> : <div className="ob-att">{(data.attention || []).map((a, i) => (<Link key={i} href={a.link} className={`t-${(AT[a.type] || AT.ack).tone}`}><i><Ico n={(AT[a.type] || AT.ack).icon} size={17} /></i><div><b>{a.title}</b><small>{a.hint}</small></div></Link>))}</div>}
                        </section>
                        <section className="ta-card"><header><div><h3>Buổi dự giờ sắp tới</h3><p>Sắp xếp theo ngày gần nhất</p></div><div className="r"><Link href="/teacher/observations/lich" className="ta-link">Xem tất cả</Link></div></header>
                            {(data.upcoming || []).length === 0 ? <Empty icon="cal" title="Chưa có buổi dự giờ nào sắp tới" text="Bấm “Lên lịch dự giờ” ở góc trên để đăng ký dự giờ hoặc mời đồng nghiệp." /> : (data.upcoming || []).map((s) => <SessionRow key={s.id} s={s} onOpen={() => setOpen(s.id)} />)}
                        </section>
                    </div>
                    <div style={{ display: 'grid', gap: 16 }}>
                        <section className="ta-card"><header><div><h3>Chỉ tiêu năm học</h3><p>Theo quy định nhà trường</p></div></header>
                            <div className="ob-quota">
                                <div className="ob-q"><Ring value={q.observe.target ? Math.min(100, (q.observe.done / q.observe.target) * 100) : 100} size={84} tone={q.observe.done >= q.observe.target ? 'green' : 'sky'} /><div style={{ flex: 1 }}><h4>Dự giờ đồng nghiệp</h4><p>{q.observe.done}/{q.observe.target} tiết đã nộp phiếu</p><Bar value={q.observe.target ? (q.observe.done / q.observe.target) * 100 : 100} tone={q.observe.done >= q.observe.target ? 'green' : 'sky'} slim /></div></div>
                                <div className="ob-q"><Ring value={q.taught.target ? Math.min(100, (q.taught.done / q.taught.target) * 100) : 100} size={84} tone={q.taught.done >= q.taught.target ? 'green' : 'violet'} /><div style={{ flex: 1 }}><h4>Được đồng nghiệp dự giờ</h4><p>{q.taught.done}/{q.taught.target} tiết có phiếu nhận xét</p><Bar value={q.taught.target ? (q.taught.done / q.taught.target) * 100 : 100} tone={q.taught.done >= q.taught.target ? 'green' : 'violet'} slim /></div></div>
                            </div></section>
                        <section className="ta-card"><header><div><h3>Hoạt động 6 tháng</h3><p>Số buổi dự giờ liên quan đến bạn</p></div></header>
                            <svg viewBox="0 0 300 110" className="nt-spark" style={{ width: '100%', height: 130 }}>{(data.by_month || []).map((m, i) => { const h = Math.max(3, (m.n / max) * 70); const x = 10 + i * 48; return <g key={m.m}><rect x={x} y={85 - h} width="34" height={h} rx="6" fill={i === (data.by_month || []).length - 1 ? '#0284c7' : '#bae0f7'} /><text x={x + 17} y={80 - h} textAnchor="middle" fontSize="11" fontWeight="700" fill="#082f49">{m.n}</text><text x={x + 17} y="102" textAnchor="middle" fontSize="10" fill="#5b7388">T{Number(m.m.slice(5, 7))}</text></g>; })}</svg></section>
                        <section className="ta-card"><header><div><h3>Nhận xét gần đây</h3></div><div className="r"><Link href="/teacher/observations/ket-qua" className="ta-link">Tất cả</Link></div></header>
                            {(data.recent || []).length === 0 ? <Empty icon="trend" title="Chưa có nhận xét nào" /> : (data.recent || []).map((r) => (<Link key={r.id} href={`/teacher/observations/ket-qua?eval=${r.id}`} className="ob-top" style={{ textDecoration: 'none', color: 'inherit' }}><div><b>{r.title}</b><br /><small className="ta-mute">{r.observer} · {fmtD(r.date)}</small></div><span className="pc"><RatingPill rating={r.rating} percent={r.percent} /></span></Link>))}
                        </section>
                    </div>
                </div>
            </>)}
            {!data.personal && <div className="ta-card" style={{ padding: 18 }}><div className="ob-note sky"><Ico n="eye" size={16} /><span>Tài khoản quản lý <b>{staff.name}</b> chưa gắn với giáo viên nên không có lịch dự giờ cá nhân. Bạn xem và phân công cho toàn trường bên dưới.</span></div></div>}
            {data.is_admin && data.school && (
                <section className="ta-card"><header><div><h3>Toàn trường – năm học hiện tại</h3><p>Dành cho Ban giám hiệu / giáo vụ</p></div><div className="r"><Link href="/teacher/observations/bao-cao" className="ta-link">Báo cáo chi tiết</Link></div></header>
                    <div className="ob-kpis" style={{ gridTemplateColumns: 'repeat(5,1fr)' }}>
                        <Link href="/teacher/observations/lich?scope=all" className="ob-kpi t-sky"><small>Tổng số buổi</small><b>{num(data.school.sessions)}</b><em>{data.school.completed} hoàn thành</em></Link>
                        <Link href="/teacher/observations/lich?scope=all&status=pending" className="ob-kpi t-amber"><small>Chờ xác nhận</small><b>{data.school.pending}</b><em>chưa được đồng ý</em></Link>
                        <Link href="/teacher/observations/lich?scope=all&status=scheduled" className="ob-kpi t-indigo"><small>Đã lên lịch</small><b>{data.school.scheduled}</b><em>sắp / đang diễn ra</em></Link>
                        <div className="ob-kpi t-green"><small>Phiếu đã nộp</small><b>{data.school.evals}</b><em>{data.school.avg_percent !== null ? `TB ${data.school.avg_percent}%` : '—'}</em></div>
                        <div className="ob-kpi t-violet"><small>Giáo viên</small><b>{data.school.teachers_total}</b><em>trong hệ thống</em></div>
                    </div></section>)}
            <section className="ta-card"><header><div><h3>Liên kết nhanh</h3><p>Các chức năng liên quan trong cổng giáo viên</p></div></header>
                <div className="ob-links" style={{ padding: '0 16px 16px' }}><Link href="/teacher/schedule" className="ta-btn"><Ico n="cal" size={15} />Thời khóa biểu</Link><Link href="/teacher/attendance" className="ta-btn"><Ico n="checks" size={15} />Điểm danh</Link><Link href="/teacher/notifications" className="ta-btn"><Ico n="bell" size={15} />Trung tâm thông báo</Link><Link href="/teacher/observations/tieu-chi" className="ta-btn"><Ico n="list" size={15} />Xem bộ tiêu chí</Link></div></section>
            {open !== null && <SessionDrawer id={open} onClose={() => setOpen(null)} onChange={reload} />}
        </div>
    );
}