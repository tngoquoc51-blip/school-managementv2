'use client';
import { useMemo, useState } from 'react';
import { fmtDate, qs, StatsRes } from '../_lib/rm';
import { Card, Empty, ErrorBox, Ico, ICON, Loading, Stat, useApi } from '../../periods/_components/ui';

const RANGES: [number, string][] = [[7, '7 ngày'], [30, '30 ngày'], [90, '90 ngày'], [180, '6 tháng'], [365, '12 tháng']];

/** Hiệu quả nhắc nợ: số tin đã gửi, tỷ lệ đọc, tỷ lệ học sinh đóng đủ sau khi được nhắc. */
export function Effect({ refreshKey }: { refreshKey: number }) {
    const [days, setDays] = useState(30);
    const res = useApi<StatsRes>(`reminders/stats${qs({ days, k: refreshKey })}`);
    const s = res.data;
    const bars = useMemo(() => {
        if (!s) return [];
        const step = s.days > 90 ? 7 : 1; const out: { label: string; title: string; n: number }[] = [];
        for (let i = 0; i < s.series.length; i += step) {
            const c = s.series.slice(i, i + step); const n = c.reduce((a, x) => a + x.count, 0);
            out.push({ label: step === 1 ? c[0].date.slice(8) : c[0].date.slice(8, 10) + '/' + c[0].date.slice(5, 7), title: `${step === 1 ? fmtDate(c[0].date) : `${fmtDate(c[0].date)} – ${fmtDate(c[c.length - 1].date)}`}: ${n} tin`, n });
        }
        return out;
    }, [s]);
    const max = Math.max(1, ...bars.map((b) => b.n));
    const tot = s?.total || 0;

    return (
        <>
            <div className="pd-toolbar">
                <div className="pd-tabs" role="group" aria-label="Khoảng thời gian">{RANGES.map(([d, l]) => <button key={d} className={days === d ? 'on' : ''} onClick={() => setDays(d)}>{l}</button>)}</div>
                {s && <span className="pd-muted">Từ {fmtDate(s.from)} đến {fmtDate(s.to)} · không tính tin đã thu hồi</span>}
            </div>
            {res.loading && !s && <Loading />}
            {res.err && <ErrorBox msg={res.err} retry={res.reload} />}
            {s && (
                <>
                    <div className="pd-stats">
                        <Stat label="Tin đã tạo" value={s.total.toLocaleString('vi-VN')} hint={`${s.students.toLocaleString('vi-VN')} học sinh được nhắc`} tone="info" icon={<Ico d={ICON.doc} />} />
                        <Stat label="Đã đóng đủ sau nhắc" value={`${s.paid_rate.toLocaleString('vi-VN')}%`} hint={`${s.paid_after}/${s.students} học sinh không còn nợ`} tone={s.paid_rate >= 30 ? 'ok' : 'warn'} icon={<Ico d={ICON.check} />} />
                        <Stat label="Tỷ lệ đã đọc (cổng học sinh)" value={s.inapp ? `${s.read_rate.toLocaleString('vi-VN')}%` : '—'} hint={s.inapp ? `${s.read}/${s.inapp} thông báo` : 'Chưa gửi qua cổng học sinh'} tone="ok" icon={<Ico d={ICON.users} />} />
                        <Stat label="Tin chờ gửi ra ngoài" value={String(s.queued_all)} hint={s.queued_all ? 'SMS, Zalo, giấy chưa đánh dấu đã gửi' : 'Không tồn đọng'} tone={s.queued_all ? 'warn' : 'mut'} icon={<Ico d={ICON.hourglass} />} />
                    </div>
                    <Card title={s.days > 90 ? 'Số tin nhắc theo tuần' : 'Số tin nhắc theo ngày'}>
                        {tot === 0 ? <Empty text="Chưa gửi tin nhắc nào trong khoảng thời gian này." /> : (
                            <div className="rc-chart" role="img" aria-label="Biểu đồ số tin nhắc">
                                {bars.map((b, i) => <div key={i} className="rc-bar" title={b.title}><i style={{ height: `${Math.max(2, (b.n / max) * 100)}%`, opacity: b.n ? 1 : 0.25 }} /><span>{bars.length <= 31 || i % Math.ceil(bars.length / 24) === 0 ? b.label : ''}</span></div>)}
                            </div>
                        )}
                    </Card>
                    <div className="pd-cols">
                        <Card title="Theo kênh gửi"><ul className="pd-bars">{s.by_channel.map((c) => <li key={c.key}><span>{c.label}</span><div><i style={{ width: `${tot ? (c.count / tot) * 100 : 0}%` }} /></div><b>{c.count.toLocaleString('vi-VN')}</b><em>{tot ? Math.round((c.count / tot) * 100) : 0}%</em></li>)}</ul></Card>
                        <Card title="Theo mức nhắc"><ul className="pd-bars">{s.by_level.map((c) => <li key={c.key}><span>{c.label}</span><div><i style={{ width: `${tot ? (c.count / tot) * 100 : 0}%` }} /></div><b>{c.count.toLocaleString('vi-VN')}</b><em>{tot ? Math.round((c.count / tot) * 100) : 0}%</em></li>)}</ul></Card>
                    </div>
                    <p className="pd-muted rmd-note">“Đã đóng đủ sau nhắc” là số học sinh được nhắc trong kỳ mà hiện không còn khoản nợ nào. Con số này cho biết xu hướng, không khẳng định phụ huynh đóng vì được nhắc.</p>
                </>
            )}
        </>
    );
}