'use client';
// Thời khóa biểu – Tổng quan (/teacher/schedule). Không tự bọc layout: layout.tsx đã lo.
import Link from 'next/link';
import React, { useState } from 'react';
import { Card, Empty, ErrorBox, Ico, Loading, Pill, longDate, num, useLoad } from '../attendance/_ta';
import { lessonHref } from '../attendance/_lesson';
import { PHASE, AttPill, Period, Slot, SlotCard, SlotDrawer, Teacher, fromNow, minsUntil, subjStyle, timeText, tk, useNow } from './_tk';

type Ov = {
    teacher: Teacher; today: string; now: string; periods: Period[];
    week: { from: string; to: string; lessons: number; done: number; need_att: number; classes: number; subjects: number; by_day: number[] };
    today_lessons: Slot[]; next: Slot | null; pending_requests: number;
};
const DN = ['T2', 'T3', 'T4', 'T5', 'T6', 'T7'];

export default function ScheduleHome() {
    const { data, err, loading, reload } = useLoad(() => tk<Ov>('overview'), []);
    const now = useNow(20000);
    const [sel, setSel] = useState<Slot | null>(null);
    if (loading && !data) return <Loading text="Đang tải thời khóa biểu…" />;
    if (err || !data) return <ErrorBox msg={err || 'Không có dữ liệu'} retry={reload} />;
    const { week, next, today_lessons: tl } = data;
    const wdIdx = (now.getDay() + 6) % 7;               // 0 = thứ 2
    const max = Math.max(1, ...week.by_day);
    const m = next ? minsUntil(next.date, next.start) : 0;
    const live = !!next && next.phase === 'ongoing';
    let prog = 0;
    if (live && next?.start && next.end) { const a = minsUntil(next.date, next.start), b = minsUntil(next.date, next.end); prog = Math.min(100, Math.max(0, (-a / Math.max(1, b - a)) * 100)); }
    const isToday = next?.date === data.today;

    return (
        <div className="ta-page">
            {next ? (
                <div className={`ts-next${live ? ' live' : ''}`} style={subjStyle(next.subject_id)}>
                    <div className="big">{next.period}</div>
                    <div style={{ position: 'relative', zIndex: 1 }}>
                        <small>{live ? 'Đang diễn ra' : isToday ? 'Tiết kế tiếp hôm nay' : `Tiết kế tiếp · ${longDate(next.date)}`}</small>
                        <h2>{next.subject} – {next.class_name}</h2>
                        <p>{timeText(next)}{next.room ? ` · Phòng ${next.room}` : ''} · {num(next.total)} học sinh · {live ? `còn ${Math.max(1, -minsUntil(next.date, next.end))} phút` : fromNow(m)}</p>
                        {live && <div className="ts-prog"><i style={{ width: `${prog}%` }} /></div>}
                    </div>
                    <div className="acts">
                        <Link href={lessonHref({ class_subject_id: next.cs, period: next.period, date: next.date }, next.date)} className="ta-btn hero"><Ico n="checks" size={16} />Điểm danh</Link>
                        <button className="ta-btn light" onClick={() => setSel(next)}>Chi tiết</button>
                    </div>
                </div>
            ) : (
                <div className="ts-next none"><div className="big"><Ico n="sun" size={28} /></div><div style={{ position: 'relative', zIndex: 1 }}><small>Không có tiết sắp tới</small><h2>Bạn không còn tiết dạy trong 2 tuần tới</h2><p>Kiểm tra lại thời khóa biểu tuần hoặc liên hệ giáo vụ nếu thấy thiếu.</p></div><span /></div>
            )}

            <div className="ta-kpis four">
                <Link href="/teacher/schedule/tuan" className="ta-kpi t-indigo"><span className="ic"><Ico n="book" size={18} /></span><div><small>Tiết dạy mỗi tuần</small><b>{num(week.lessons)}</b><em>{week.classes} lớp · {week.subjects} môn</em></div></Link>
                <div className="ta-kpi t-green"><span className="ic"><Ico n="check" size={18} /></span><div><small>Đã dạy tuần này</small><b>{num(week.done)}</b><em>/ {num(week.lessons)} tiết</em></div></div>
                <Link href="/teacher/attendance/lich-su" className="ta-kpi t-amber"><span className="ic"><Ico n="lock" size={18} /></span><div><small>Tiết cần điểm danh</small><b>{num(week.need_att)}</b><em>chưa gửi & khóa</em></div></Link>
                <Link href="/teacher/schedule/yeu-cau" className="ta-kpi t-violet"><span className="ic"><Ico n="send" size={18} /></span><div><small>Yêu cầu chờ duyệt</small><b>{num(data.pending_requests)}</b><em>đổi tiết, dạy bù, nghỉ</em></div></Link>
            </div>

            <div className="ta-grid g21">
                <Card title={`Lịch dạy hôm nay · ${longDate(data.today)}`} sub={tl.length ? `${tl.length} tiết` : undefined} right={<Link href="/teacher/schedule/tuan" className="ta-link">Xem cả tuần</Link>}>
                    {tl.length === 0 ? <Empty icon="sun" title="Hôm nay bạn không có tiết dạy" text="Bạn có thể dùng thời gian này để soạn giáo án hoặc xem tiết trống." /> : (
                        <div className="ts-tl">{tl.map((s) => (
                            <div key={`${s.cs}-${s.period}-${s.date}`} className={`ts-tl-i ${s.phase}`}>
                                <div className="ts-tl-t">{s.start || `Tiết ${s.period}`}<small>{s.end || ''}</small></div>
                                <div className="ts-tl-d"><i /></div>
                                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                                    <SlotCard s={s} onClick={() => setSel(s)} />
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}><Pill tone={PHASE[s.phase].tone} dot>{PHASE[s.phase].label}</Pill><AttPill s={s} /></div>
                                </div>
                            </div>))}</div>
                    )}
                </Card>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
                    <Card title="Số tiết theo ngày" sub={`Tuần ${week.from.slice(8, 10)}/${week.from.slice(5, 7)} – ${week.to.slice(8, 10)}/${week.to.slice(5, 7)}`} right={<Link href="/teacher/schedule/khoi-luong" className="ta-link">Chi tiết</Link>}>
                        <div className="ts-bars">{week.by_day.map((n, i) => <div key={i} className={i === wdIdx ? 'on' : ''}><b>{n}</b><i style={{ height: `${(n / max) * 100}%` }} /><small>{DN[i]}</small></div>)}</div>
                    </Card>
                    <Card title="Đi nhanh tới">
                        <div className="ts-quick">
                            <Link href="/teacher/attendance"><span className="ic"><Ico n="checks" size={17} /></span><span>Điểm danh<small>từng tiết trong ngày</small></span></Link>
                            {data.teacher.homeroom && <Link href="/teacher/attendance/chu-nhiem"><span className="ic"><Ico n="school" size={17} /></span><span>Lớp chủ nhiệm {data.teacher.homeroom.name}<small>chuyên cần & đơn nghỉ</small></span></Link>}
                            <Link href="/teacher/assignments"><span className="ic"><Ico n="book" size={17} /></span><span>Bài tập<small>giao & chấm bài</small></span></Link>
                            <Link href="/teacher/schedule/yeu-cau"><span className="ic"><Ico n="send" size={17} /></span><span>Đổi tiết / dạy bù<small>gửi nhà trường duyệt</small></span></Link>
                        </div>
                    </Card>
                </div>
            </div>
            {sel && <SlotDrawer slot={sel} onClose={() => setSel(null)} onChanged={() => { setSel(null); reload(); }} />}
        </div>
    );
}