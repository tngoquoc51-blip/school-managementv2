'use client';

import Link from 'next/link';
import React, { useState } from 'react';
import { NoticeDrawer, useNoticeActions } from './_detail';
import { ActivityChart, Btn, Card, Donut, Empty, ErrorBox, Ico, Loading, Notice, NoticeLine, PriorityPill, ReadMeter, ago, dt, nt, num, useLoad, useNt } from './_nt';

type Ov = {
    kpi: { sent_30d: number; drafts: number; pending: number; scheduled: number; rejected: number; archived: number; sent_total: number; read_rate: number; reads_30d: number; recipients_30d: number };
    series: { d: string; sent: number; reads: number }[]; categories: { key: string; label: string; n: number }[];
    pending: Notice[]; upcoming: Notice[]; recent: Notice[]; attention: Notice[];
};

export default function Overview() {
    const { canApprove, staff } = useNt();
    const { data, err, loading, reload } = useLoad(async () => (await nt<Ov>('overview')).data);
    const [open, setOpen] = useState<number | null>(null);
    const a = useNoticeActions(reload);

    if (loading && !data) return <Loading />;
    if (err && !data) return <ErrorBox msg={err} retry={reload} />;
    if (!data) return null;
    const k = data.kpi;
    const hour = new Date().getHours();
    const hello = hour < 11 ? 'Chào buổi sáng' : hour < 14 ? 'Chào buổi trưa' : hour < 18 ? 'Chào buổi chiều' : 'Chào buổi tối';

    const kpis = [
        { l: 'Đã gửi 30 ngày', v: num(k.sent_30d), s: `${num(k.sent_total)} đang hiển thị`, t: 'indigo', i: 'send', href: '/bgh/notices/danh-sach?status=sent' },
        { l: 'Tỉ lệ đã đọc', v: `${k.read_rate}%`, s: `${num(k.reads_30d)}/${num(k.recipients_30d)} lượt`, t: 'green', i: 'eye', href: '/bgh/notices/thong-ke' },
        { l: 'Chờ duyệt', v: num(k.pending), s: k.pending ? 'cần xử lý' : 'không tồn đọng', t: 'amber', i: 'checks', href: '/bgh/notices/phe-duyet' },
        { l: 'Hẹn giờ gửi', v: num(k.scheduled), s: k.scheduled ? 'sắp được gửi' : 'chưa có', t: 'sky', i: 'clock', href: '/bgh/notices/danh-sach?status=scheduled' },
        { l: 'Bản nháp', v: num(k.drafts), s: k.rejected ? `${k.rejected} bị từ chối` : 'đang soạn dở', t: 'violet', i: 'pen', href: '/bgh/notices/danh-sach?status=draft' },
    ];

    const empty = k.sent_total + k.drafts + k.pending + k.scheduled + k.archived === 0;

    return (
        <div className="nt-page">
            <div className="nt-welcome">
                <div><h2>{hello}, {staff.name.split(' ').slice(-1)[0]} 👋</h2>
                    <p>{k.pending > 0 && canApprove ? <>Có <b>{k.pending}</b> thông báo đang chờ bạn duyệt.</> : empty ? 'Chưa có thông báo nào. Hãy soạn thông báo đầu tiên để gửi tới nhà trường.' : 'Mọi thông báo đang được theo dõi. Xem nhanh tình hình bên dưới.'}</p></div>
                <div className="acts">
                    <Link className="nt-btn light" href="/bgh/notices/soan"><Ico n="pen" size={15} />Soạn mới</Link>
                    <Link className="nt-btn light" href="/bgh/notices/mau"><Ico n="tpl" size={15} />Dùng mẫu</Link>
                    <Link className="nt-btn light" href="/bgh/notices/thong-ke"><Ico n="stats" size={15} />Thống kê</Link>
                </div>
            </div>

            <div className="nt-kpis">
                {kpis.map((x) => (
                    <Link key={x.l} href={x.href} className={`nt-kpi t-${x.t}`}>
                        <span className="ic"><Ico n={x.i} size={20} /></span>
                        <div><small>{x.l}</small><b>{x.v}</b><em>{x.s}</em></div>
                    </Link>
                ))}
            </div>

            <div className="nt-grid g21">
                <Card title="Hoạt động 14 ngày qua" sub="Số thông báo gửi đi và lượt đọc mỗi ngày">
                    {k.sent_30d + k.reads_30d === 0 ? <Empty icon="stats" title="Chưa có số liệu" text="Biểu đồ xuất hiện sau khi bạn gửi thông báo đầu tiên và có người đọc." /> : <ActivityChart data={data.series} />}
                </Card>
                <Card title="Theo danh mục" sub="30 ngày gần nhất">
                    {data.categories.length ? <Donut items={data.categories.map((c) => ({ label: c.label, n: c.n }))} /> : <Empty icon="doc" title="Chưa có dữ liệu" />}
                </Card>
            </div>

            <div className="nt-grid g2">
                <Card title="Chờ duyệt" sub={canApprove ? 'Thông báo do Phó hiệu trưởng gửi lên' : 'Thông báo bạn đã gửi, đang chờ Hiệu trưởng'} right={<Link href="/bgh/notices/phe-duyet" className="nt-more">Xem tất cả <Ico n="chevR" size={14} /></Link>} pad={false}>
                    {data.pending.length === 0 ? <Empty icon="checks" title="Không có thông báo chờ duyệt" /> : data.pending.map((n) => (
                        <NoticeLine key={n.id} n={n} onOpen={() => setOpen(n.id)} right={canApprove ? <><Btn size="sm" tone="success" onClick={() => a.act(n, 'approve')}>Duyệt</Btn><Btn size="sm" tone="danger" onClick={() => a.act(n, 'reject')}>Từ chối</Btn></> : <PriorityPill p={n.priority} />} />
                    ))}
                </Card>
                <Card title="Sắp gửi" sub="Thông báo đã hẹn giờ" right={<Link href="/bgh/notices/danh-sach?status=scheduled" className="nt-more">Xem tất cả <Ico n="chevR" size={14} /></Link>} pad={false}>
                    {data.upcoming.length === 0 ? <Empty icon="clock" title="Chưa hẹn giờ thông báo nào" text="Khi soạn, chọn “Hẹn giờ gửi” để thông báo tự gửi đúng lúc." /> : data.upcoming.map((n) => (
                        <NoticeLine key={n.id} n={n} onOpen={() => setOpen(n.id)} right={<><span className="nt-when">{dt(n.scheduled_at)}</span><Btn size="sm" onClick={() => a.act(n, 'send_now')}>Gửi ngay</Btn></>} />
                    ))}
                </Card>
            </div>

            <div className="nt-grid g2">
                <Card title="Mới gửi gần đây" sub="Theo dõi tỉ lệ đã đọc" right={<Link href="/bgh/notices/danh-sach?status=sent" className="nt-more">Xem tất cả <Ico n="chevR" size={14} /></Link>} pad={false}>
                    {data.recent.length === 0 ? <Empty icon="send" title="Chưa gửi thông báo nào" action={<Link className="nt-btn primary" href="/bgh/notices/soan">Soạn thông báo</Link>} /> : data.recent.map((n) => (
                        <NoticeLine key={n.id} n={n} onOpen={() => setOpen(n.id)} right={<ReadMeter n={n} />} />
                    ))}
                </Card>
                <Card title="Cần chú ý" sub="Gửi trong 14 ngày qua nhưng dưới 50% đã đọc" pad={false}>
                    {data.attention.length === 0 ? <Empty icon="checks" title="Tất cả đều được đọc tốt" text="Không có thông báo nào có tỉ lệ đọc thấp." /> : data.attention.map((n) => (
                        <NoticeLine key={n.id} n={n} onOpen={() => setOpen(n.id)} right={<><ReadMeter n={n} /><Btn size="sm" tone="primary" onClick={() => a.act(n, 'remind')}>Nhắc lại</Btn></>} />
                    ))}
                </Card>
            </div>

            <p className="nt-foot">Cập nhật {ago(new Date().toISOString())} · Thông báo hẹn giờ được gửi tự động khi có người mở hệ thống hoặc khi tải lại trang này.</p>
            {open !== null && <NoticeDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
            {a.dialog}
        </div>
    );
}