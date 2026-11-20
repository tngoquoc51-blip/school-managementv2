
'use client';
// Tổng quan thông báo (/teacher/notifications)
import Link from 'next/link';
import React, { useState } from 'react';
import { Btn, Drawer, ErrorBox, Ico, Item, ItemDetail, KIND, Kind, Loading, Pill, Row, Spark, ago, dt, nt, num, useLoad, useTa } from './_nt';

type Ov = {
    today: string; counts: { all: number; unread: number; urgent: number; high: number; starred: number; snoozed: number; archived: number }; by_kind: Record<string, number>; by_day: { date: string; n: number }[];
    attention: Item[]; todo: Item[]; next: Item | null; recent: Item[]; reminders: { open: number; overdue: number; soon: number }; outbox: { sent: number; recipients: number; scheduled: number };
};

export default function NotificationsHome() {
    const { toast, refresh, staff } = useTa();
    const { data: o, err, loading, reload } = useLoad(() => nt<Ov>('overview'), []);
    const [open, setOpen] = useState<Item | null>(null);
    if (loading && !o) return <Loading text="Đang tổng hợp thông báo…" />;
    if (err || !o) return <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} />;
    const c = o.counts; const kinds = Object.entries(o.by_kind).sort((a, b) => b[1] - a[1]); const maxK = Math.max(1, ...kinds.map((k) => k[1]));
    const readAll = async () => { try { const r = await nt<{ message: string }>('read-all', { method: 'POST', body: {} }); toast(r.message); refresh(); reload(); } catch (e) { toast((e as Error).message, 'err'); } };
    const star = async (it: Item) => { try { await nt('state', { method: 'POST', body: { keys: [it.key], action: it.starred ? 'unstar' : 'star' } }); reload(); } catch (e) { toast((e as Error).message, 'err'); } };
    const hour = new Date().getHours(); const hello = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

    return (
        <div className="ta-page">
            <div className="nt-row2" style={{ justifyContent: 'space-between' }}>
                <div><h2 style={{ fontSize: 20, fontWeight: 800 }}>{hello}, {staff.name.split(' ').slice(-1)[0]}</h2><p className="ta-mute">{c.unread > 0 ? `Có ${c.unread} thông báo đang chờ bạn xem.` : 'Bạn đã xem hết mọi thông báo. Làm tốt lắm!'}</p></div>
                <div className="nt-row2"><Btn onClick={readAll} disabled={c.unread === 0}><Ico n="checks" size={15} />Đánh dấu tất cả đã đọc</Btn><Link href="/teacher/notifications/nhac-viec" className="ta-btn"><Ico n="plus" size={15} />Thêm nhắc việc</Link><Link href="/teacher/notifications/gui-hoc-sinh" className="ta-btn primary"><Ico n="send" size={15} />Gửi học sinh</Link></div>
            </div>

            <div className="nt-kpis">
                <Link href="/teacher/notifications/hop-thu?tab=unread" className="nt-kpi t-indigo"><div className="top"><small>Chưa đọc</small><span className="ic"><Ico n="bell" size={17} /></span></div><b>{num(c.unread)}</b><em>trên {num(c.all)} thông báo</em></Link>
                <Link href="/teacher/notifications/hop-thu?tab=unread&priority=urgent" className="nt-kpi t-rose"><div className="top"><small>Khẩn cấp / quan trọng</small><span className="ic"><Ico n="alert" size={17} /></span></div><b>{num(c.urgent + c.high)}</b><em>{c.urgent} khẩn cấp · {c.high} quan trọng</em></Link>
                <Link href="/teacher/notifications/nhac-viec" className="nt-kpi t-amber"><div className="top"><small>Nhắc việc đang mở</small><span className="ic"><Ico n="clock" size={17} /></span></div><b>{num(o.reminders.open)}</b><em>{o.reminders.overdue > 0 ? `${o.reminders.overdue} quá hạn` : `${o.reminders.soon} sắp đến hạn`}</em></Link>
                <Link href="/teacher/notifications/hop-thu?tab=starred" className="nt-kpi t-violet"><div className="top"><small>Gắn sao</small><span className="ic"><Ico n="pin" size={17} /></span></div><b>{num(c.starred)}</b><em>{c.snoozed} đang tạm hoãn</em></Link>
                <Link href="/teacher/notifications/gui-hoc-sinh" className="nt-kpi t-green"><div className="top"><small>Đã gửi học sinh (30 ngày)</small><span className="ic"><Ico n="send" size={17} /></span></div><b>{num(o.outbox.sent)}</b><em>{num(o.outbox.recipients)} lượt nhận{o.outbox.scheduled > 0 ? ` · ${o.outbox.scheduled} hẹn giờ` : ''}</em></Link>
            </div>

            {o.next && (
                <div className="ta-card" style={{ borderColor: '#9fd0ee', background: 'linear-gradient(120deg,#f0f9ff,#fff)' }}>
                    <div className="nt-row" style={{ cursor: 'default', borderBottom: 0 }}><span className="nt-kic" style={{ width: 44, height: 44, background: '#e0f2fe', color: '#0284c7' }}><Ico n="cal" size={22} /></span>
                        <div className="nt-rb"><div className="nt-rt"><b style={{ fontSize: 15.5 }}>{o.next.title}</b></div><p style={{ WebkitLineClamp: 3 }}>{o.next.body}</p></div>
                        <Link href={o.next.link || '/teacher/schedule'} className="ta-btn primary"><Ico n="cal" size={15} />Xem lịch dạy</Link></div>
                </div>
            )}

            <div className="nt-grid nt-g21">
                <div className="ta-card">
                    <header><div><h3>Cần xử lý ngay</h3><p>Thông báo khẩn cấp, quan trọng hoặc được ghim chưa đọc</p></div><Link href="/teacher/notifications/hop-thu?tab=unread" className="ta-link">Xem hộp thư</Link></header>
                    <div className="nt-list" style={{ marginTop: 10 }}>
                        {o.attention.length === 0 ? <p className="ta-mute" style={{ padding: '10px 20px 22px' }}>Không có thông báo nào cần xử lý gấp.</p> : o.attention.map((it) => <Row key={it.key} it={it} onOpen={() => setOpen(it)} onStar={() => star(it)} />)}
                    </div>
                </div>
                <div className="ta-card">
                    <header><div><h3>Việc hôm nay</h3><p>Tiết đã dạy xong nhưng chưa điểm danh</p></div></header>
                    <div style={{ padding: '10px 20px 18px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                        {o.todo.length === 0 ? <p className="ta-mute">Mọi tiết đã được điểm danh.</p> : o.todo.map((t) => (
                            <div key={t.key} className="nt-bub p-high" style={{ borderLeftColor: '#0d9488' }}><small>{ago(t.created_at)}</small><h4 style={{ fontSize: 13.5 }}>{t.title.replace('Chưa điểm danh: ', '')}</h4><Link href={t.link || '/teacher/attendance'} className="ta-link">Điểm danh ngay →</Link></div>))}
                    </div>
                </div>
            </div>

            <div className="nt-grid nt-g2">
                <div className="ta-card"><header><div><h3>Thông báo 14 ngày qua</h3><p>Số thông báo nhận được mỗi ngày</p></div></header><div style={{ padding: '8px 18px 14px' }}><Spark days={o.by_day} /></div></div>
                <div className="ta-card"><header><div><h3>Chưa đọc theo loại</h3><p>Bấm vào loại để lọc trong hộp thư</p></div></header>
                    <div style={{ padding: '14px 20px 18px' }}>
                        {kinds.length === 0 ? <p className="ta-mute">Không có thông báo chưa đọc.</p> : <div className="nt-bars">{kinds.map(([k, n]) => { const m = KIND[k as Kind]; return (
                            <Link key={k} href={`/teacher/notifications/hop-thu?tab=unread&kind=${k}`} style={{ display: 'contents', color: 'inherit', textDecoration: 'none' }}><div><span><Ico n={m.icon} size={15} />{m.label}</span><div className="trk"><i style={{ width: `${(n / maxK) * 100}%`, background: m.c }} /></div><b>{n}</b></div></Link>); })}</div>}
                    </div></div>
            </div>

            <div className="ta-card">
                <header><div><h3>Mới nhận gần đây</h3><p>Cập nhật tự động mỗi phút</p></div><Link href="/teacher/notifications/hop-thu" className="ta-link">Xem tất cả</Link></header>
                <div className="nt-list" style={{ marginTop: 10 }}>{o.recent.length === 0 ? <p className="ta-mute" style={{ padding: '10px 20px 22px' }}>Chưa có thông báo nào.</p> : o.recent.map((it) => <Row key={it.key} it={it} onOpen={() => setOpen(it)} onStar={() => star(it)} />)}</div>
            </div>

            <p className="ta-mute">Thông báo được tổng hợp từ: nhà trường phát hành, kết quả duyệt yêu cầu đổi tiết, tiết chưa điểm danh, giờ dạy sắp tới và nhắc việc cá nhân. Cập nhật lần cuối {dt(new Date().toISOString())}. <Pill tone="slate">Tự động làm mới mỗi 60 giây</Pill></p>
            {open && <Drawer title="Chi tiết thông báo" onClose={() => setOpen(null)}><ItemDetail compact it={open} onChange={() => { setOpen(null); reload(); }} /></Drawer>}
        </div>
    );
}