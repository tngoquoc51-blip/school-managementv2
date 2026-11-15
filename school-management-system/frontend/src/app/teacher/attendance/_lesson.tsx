'use client';
// Thành phần dùng chung: thẻ tiết học (Hôm nay, Lịch sử…)
import Link from 'next/link';
import React, { useState } from 'react';
import { Bar, Btn, Field, Ico, LS, Lesson, Modal, Pill, StackBar, Sums, dt, pct, ta, useTa } from './_ta';

export const lessonHref = (l: Pick<Lesson, 'class_subject_id' | 'period'> & { date?: string }, date: string) => `/teacher/attendance/tiet?cs=${l.class_subject_id}&period=${l.period}&date=${l.date ?? date}`;
export const sums = (l: Lesson): Sums & { total: number } => ({ total: l.marked, ...l.counts });

export function LessonCard({ l, date }: { l: Lesson; date: string }) {
    const s = LS[l.state]; const done = l.state === 'locked';
    const cta = done ? 'Xem' : l.state === 'ready' ? 'Gửi nhà trường' : l.marked > 0 ? 'Tiếp tục' : 'Điểm danh';
    return (
        <article className={`ta-lcard st-${l.state}${l.phase === 'ongoing' ? ' now' : ''}`}>
            <div className="per"><b>{l.period}</b><small>Tiết</small></div>
            <div className="mid">
                <div className="top">
                    <h4>{l.class_name} <span>· {l.subject}</span></h4>
                    <Pill tone={s.tone} dot>{s.label}</Pill>
                    {l.phase === 'ongoing' && !done && <Pill tone="rose">Đang diễn ra</Pill>}
                    {l.overdue && <Pill tone="amber">Quá giờ chưa gửi</Pill>}
                    {l.request && <Pill tone="violet">Đã xin mở khóa</Pill>}
                </div>
                <p className="meta"><Ico n="clock" size={13} />{l.start ? `${l.start} – ${l.end}` : 'Chưa có giờ'} · {l.total} học sinh{done && l.submitted_at ? <> · gửi lúc {dt(l.submitted_at)}{l.auto ? ' (hệ thống tự khóa)' : ''}</> : null}</p>
                <div className="prog"><Bar value={pct(l.marked, l.total)} tone={done ? 'green' : 'indigo'} slim /><span>{l.marked}/{l.total}</span></div>
                {l.marked > 0 && <><StackBar c={sums(l)} /><p className="nums"><span className="g">{l.counts.present} có mặt</span><span className="a">{l.counts.late} muộn</span><span className="s">{l.counts.excused} vắng P</span><span className="r">{l.counts.unexcused} vắng K</span></p></>}
                {l.reopen_note && <p className="ta-mute">Ban Giám hiệu: {l.reopen_note}</p>}
            </div>
            <Link href={lessonHref(l, date)} className={`ta-btn ${done ? '' : 'primary'}`}>{cta}<Ico n="chevR" size={14} /></Link>
        </article>
    );
}

export function ReopenModal({ sel, onClose, onDone }: { sel: { cs: number; period: number; date: string }; onClose: () => void; onDone: () => void }) {
    const { toast } = useTa();
    const [reason, setReason] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
    const go = async () => {
        if (reason.trim().length < 5) { setErr('Hãy nhập lý do (ít nhất 5 ký tự).'); return; }
        setBusy(true);
        try { const r = await ta('reopen-request', { method: 'POST', body: { class_subject_id: sel.cs, date: sel.date, period: sel.period, reason } }); toast(r.message || 'Đã gửi yêu cầu.'); onDone(); }
        catch (e) { setErr((e as Error).message); setBusy(false); }
    };
    return (
        <Modal title="Xin mở khóa tiết học" onClose={onClose} foot={<><Btn onClick={onClose}>Hủy</Btn><Btn tone="primary" busy={busy} onClick={go}><Ico n="send" size={15} />Gửi yêu cầu</Btn></>}>
            <p className="ta-mute" style={{ marginBottom: 10 }}>Ban Giám hiệu sẽ xem xét và mở khóa để bạn chỉnh sửa. Nêu rõ cần sửa gì để được duyệt nhanh.</p>
            <Field label="Lý do cần chỉnh sửa" error={err}><textarea rows={4} value={reason} onChange={(e) => { setReason(e.target.value); setErr(''); }} maxLength={250} placeholder="Ví dụ: Nhập nhầm em Nguyễn Văn A, em có mặt nhưng bị đánh dấu vắng." autoFocus /></Field>
        </Modal>
    );
}