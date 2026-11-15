'use client';
// Thời khóa biểu tuần (/teacher/schedule/tuan)
import React, { useMemo, useState } from 'react';
import { Btn, Card, Empty, ErrorBox, Ico, Loading, Seg, addDays, fmtS, num, todayStr, useLoad, useTa } from '../../attendance/_ta';
import { DAYS, Slot, SlotCard, SlotDrawer, WeekRes, dayName, downloadIcs, tk } from '../_tk';

export default function WeekPage() {
    const { toast } = useTa();
    const [date, setDate] = useState(todayStr());
    const [view, setView] = useState('grid');
    const [cls, setCls] = useState('');
    const [sel, setSel] = useState<Slot | null>(null);
    const [busy, setBusy] = useState(false);
    const { data, err, loading, reload } = useLoad(() => tk<WeekRes>(`week?date=${date}`), [date]);

    const all = data?.data || [];
    const classes = useMemo(() => Array.from(new Set(all.map((s) => s.class_name))).sort(), [all]);
    const list = cls ? all.filter((s) => s.class_name === cls) : all;
    const nowHm = `${String(new Date().getHours()).padStart(2, '0')}:${String(new Date().getMinutes()).padStart(2, '0')}`;
    const dateOf = (w: number) => (data ? addDays(data.from, w - 2) : '');
    const total = all.filter((s) => !s.extra && !s.moved).length;

    const exportIcs = async () => {
        setBusy(true);
        try {
            const weeks = await Promise.all([0, 1, 2, 3].map((i) => tk<WeekRes>(`week?date=${addDays(date, i * 7)}`)));
            const slots = weeks.flatMap((w) => w.data);
            downloadIcs(slots, `thoi-khoa-bieu-${date}.ics`);
            toast(`Đã xuất ${slots.length} tiết (4 tuần). Mở file bằng Google Calendar / Outlook / Apple Lịch.`);
        } catch (e) { toast((e as Error).message, 'err'); } finally { setBusy(false); }
    };

    return (
        <div className="ta-page">
            <div className="ts-printhead"><h2>Thời khóa biểu tuần {data ? `${fmtS(data.from)} – ${fmtS(data.to)}` : ''} · {data?.teacher.name}</h2></div>
            <div className="ta-range">
                <div className="ta-seg" style={{ marginBottom: 0 }}>
                    <button onClick={() => setDate(addDays(date, -7))}>‹ Tuần trước</button>
                    <button className={date === todayStr() ? 'on' : ''} onClick={() => setDate(todayStr())}>Tuần này</button>
                    <button onClick={() => setDate(addDays(date, 7))}>Tuần sau ›</button>
                </div>
                <input type="date" value={date} onChange={(e) => e.target.value && setDate(e.target.value)} className="ta-btn" style={{ padding: '7px 10px' }} aria-label="Chọn tuần chứa ngày" />
                {data && <b>{fmtS(data.from)} – {fmtS(data.to)} · {num(total)} tiết</b>}
                <span style={{ flex: 1 }} />
                <select value={cls} onChange={(e) => setCls(e.target.value)} className="ta-btn" style={{ padding: '8px 10px' }}><option value="">Tất cả các lớp</option>{classes.map((c) => <option key={c}>{c}</option>)}</select>
                <Seg value={view} onChange={setView} items={[['grid', 'Dạng lưới'], ['day', 'Theo ngày']]} />
                <Btn size="sm" onClick={() => window.print()}><Ico n="print" size={15} />In</Btn>
                <Btn size="sm" busy={busy} onClick={exportIcs}><Ico n="download" size={15} />Xuất lịch (.ics)</Btn>
            </div>

            {loading && !data ? <Loading /> : err || !data ? <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} /> : all.length === 0
                ? <Card><Empty icon="cal" title="Tuần này bạn không có tiết dạy" text="Nếu thấy thiếu lịch, hãy liên hệ giáo vụ để kiểm tra phân công giảng dạy." /></Card>
                : view === 'grid' ? (
                    <Card pad={false}>
                        <div style={{ padding: 14 }} className="ts-gridwrap">
                            <div className="ts-grid">
                                <div />
                                {DAYS.map((w) => { const d = dateOf(w); return <div key={w} className={`ts-dh${d === data.today ? ' today' : ''}`}>{dayName(w)}<small>{fmtS(d)}</small></div>; })}
                                {data.periods.map((p) => (
                                    <React.Fragment key={p.id}>
                                        <div className={`ts-ph${data.today >= data.from && data.today <= data.to && p.start && p.end && nowHm >= p.start && nowHm <= p.end ? ' now' : ''}`}>Tiết {p.id}<small>{p.start ? `${p.start}–${p.end}` : ''}</small></div>
                                        {DAYS.map((w) => {
                                            const d = dateOf(w); const cell = list.filter((s) => s.date === d && s.period === p.id);
                                            return <div key={w} className={`ts-cell${d === data.today ? ' today' : ''}`}>{cell.length ? cell.map((s) => <SlotCard key={s.cs + '-' + s.extra} s={s} onClick={() => setSel(s)} />) : <span className="none">·</span>}</div>;
                                        })}
                                    </React.Fragment>
                                ))}
                            </div>
                        </div>
                        <p className="ta-mute" style={{ padding: '0 18px 16px' }}>Bấm vào một tiết để điểm danh, ghi chú, nhập phòng hoặc gửi yêu cầu đổi tiết. Viền xanh lá là tiết đang diễn ra.</p>
                    </Card>
                ) : (
                    <div className="ts-days">{DAYS.map((w) => {
                        const d = dateOf(w); const xs = list.filter((s) => s.date === d);
                        return (
                            <div key={w} className={`ts-day${d === data.today ? ' today' : ''}`}>
                                <h4><span>{dayName(w)} · {fmtS(d)}</span><span className="ta-mute">{xs.length} tiết</span></h4>
                                {xs.length === 0 ? <p className="ta-mute">Không có tiết dạy.</p> : xs.map((s) => (
                                    <div className="ts-row" key={s.cs + '-' + s.period + (s.extra ? 'x' : '')}><span>T{s.period}<small>{s.start || ''}</small></span><SlotCard s={s} onClick={() => setSel(s)} /></div>))}
                            </div>
                        );
                    })}</div>
                )}
            {sel && <SlotDrawer slot={sel} onClose={() => setSel(null)} onChanged={() => { setSel(null); reload(); }} />}
        </div>
    );
}