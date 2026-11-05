'use client';

import React, { useState } from 'react';
import { Bar, Card, Donut, Empty, ErrorBox, HourBars, Loading, Notice, NoticeLine, ReadMeter, Ring, Seg, TYPE_LABEL, nt, num, pct, useLoad } from '../_nt';
import { NoticeDrawer } from '../_detail';

type Stats = {
    days: number; top: Notice[]; low: Notice[]; categories: { key: string; label: string; n: number; recipients: number; reads: number; rate: number }[];
    by_type: Record<string, number>; hours: number[]; avg_read_minutes: number | null; senders: { name: string; n: number }[]; ack_notices: number; ack_total: number;
};
const dur = (m: number | null) => (m === null ? '—' : m < 60 ? `${m} phút` : m < 1440 ? `${Math.round(m / 60 * 10) / 10} giờ` : `${Math.round(m / 1440 * 10) / 10} ngày`);

export default function StatsPage() {
    const [days, setDays] = useState(30);
    const [open, setOpen] = useState<number | null>(null);
    const { data, err, loading, reload } = useLoad(async () => (await nt<Stats>(`stats?days=${days}`)).data, [days]);

    return (
        <div className="nt-page">
            <div className="nt-ptitle">
                <div><h2>Thống kê & hiệu quả</h2><p>Thông báo có tới được người nhận không? Ai đọc, đọc lúc nào, danh mục nào hiệu quả nhất.</p></div>
                <div className="acts"><Seg value={String(days)} onChange={(v) => setDays(Number(v))} items={[['7', '7 ngày'], ['30', '30 ngày'], ['90', '90 ngày'], ['365', '1 năm']]} /></div>
            </div>
            {loading && !data ? <Loading /> : err && !data ? <ErrorBox msg={err} retry={reload} /> : data && (
                <>
                    {(() => {
                        const tr = data.categories.reduce((s, c) => s + c.recipients, 0), rd = data.categories.reduce((s, c) => s + c.reads, 0), sent = data.categories.reduce((s, c) => s + c.n, 0);
                        const rate = pct(rd, tr);
                        return (
                            <div className="nt-kpis four">
                                <div className="nt-kpi t-indigo"><span className="ic"><Ring value={rate} size={58} tone="indigo" /></span><div><small>Tỉ lệ đã đọc</small><b>{rate}%</b><em>{num(rd)}/{num(tr)} lượt</em></div></div>
                                <div className="nt-kpi t-sky"><div><small>Thông báo đã gửi</small><b>{num(sent)}</b><em>{data.days} ngày qua</em></div></div>
                                <div className="nt-kpi t-green"><div><small>Thời gian đọc trung bình</small><b>{dur(data.avg_read_minutes)}</b><em>kể từ lúc gửi</em></div></div>
                                <div className="nt-kpi t-violet"><div><small>Đã xác nhận</small><b>{num(data.ack_total)}</b><em>trong {num(data.ack_notices)} thông báo yêu cầu</em></div></div>
                            </div>
                        );
                    })()}

                    {data.categories.length === 0 ? <Empty icon="stats" title="Chưa có dữ liệu trong khoảng này" text="Hãy gửi thông báo và chờ người dùng mở đọc trên các cổng." /> : (
                        <>
                            <div className="nt-grid g2">
                                <Card title="Giờ đọc nhiều nhất" sub="Số lượt đọc theo giờ trong ngày (giờ Việt Nam)"><HourBars data={data.hours} /></Card>
                                <Card title="Ai đang đọc" sub="Lượt đọc theo nhóm người dùng">
                                    {Object.keys(data.by_type).length ? <Donut center="lượt đọc" items={Object.entries(data.by_type).map(([k, v]) => ({ label: TYPE_LABEL[k] || k, n: v }))} /> : <Empty icon="eye" title="Chưa có lượt đọc" />}
                                </Card>
                            </div>
                            <Card title="Hiệu quả theo danh mục" sub="Tỉ lệ đã đọc trên số người nhận">
                                <div className="nt-catrate">
                                    {data.categories.map((c) => (
                                        <div key={c.key}><span>{c.label}<small>{c.n} thông báo</small></span><Bar value={c.rate} tone={c.rate >= 70 ? 'green' : c.rate >= 40 ? 'amber' : 'rose'} /><b>{c.rate}%</b></div>
                                    ))}
                                </div>
                            </Card>
                            <div className="nt-grid g2">
                                <Card title="Được đọc nhiều nhất" pad={false}>
                                    {data.top.length === 0 ? <Empty icon="eye" title="Chưa có" /> : data.top.map((n) => <NoticeLine key={n.id} n={n} onOpen={() => setOpen(n.id)} right={<ReadMeter n={n} />} />)}
                                </Card>
                                <Card title="Tỉ lệ đọc thấp nhất" sub="Cân nhắc nhắc lại hoặc gửi qua kênh khác" pad={false}>
                                    {data.low.length === 0 ? <Empty icon="checks" title="Không có" /> : data.low.map((n) => <NoticeLine key={n.id} n={n} onOpen={() => setOpen(n.id)} right={<ReadMeter n={n} />} />)}
                                </Card>
                            </div>
                            <Card title="Người soạn nhiều nhất">
                                <div className="nt-catrate">
                                    {data.senders.map((s) => <div key={s.name}><span>{s.name}</span><Bar value={pct(s.n, data.senders[0]?.n || 1)} tone="indigo" /><b>{s.n}</b></div>)}
                                </div>
                            </Card>
                        </>
                    )}
                </>
            )}
            {open !== null && <NoticeDrawer id={open} onClose={() => setOpen(null)} onChanged={reload} />}
        </div>
    );
}