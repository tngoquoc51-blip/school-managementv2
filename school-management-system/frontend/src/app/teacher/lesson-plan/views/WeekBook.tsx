'use client';

import { useEffect, useState } from 'react';
import { errMsg, logApi } from '@/modules/teacher/lessonlog/service';
import type { Slot, ViewProps, WeekData } from '@/modules/teacher/lessonlog/types';
import { RATING, dm, dmy, hm, ratingOf } from '@/modules/teacher/lessonlog/util';
import { Icon, Skeleton, useUI } from '@/app/bgh/rewards/ui';
import { ReviewChip } from '../parts';
import { SignModal } from './Reviews';

/** Sổ đầu bài theo tuần: lưới thứ × tiết, bấm vào ô để ghi / ký sổ */
export default function WeekBook({ meta, classId, date, rev, isHomeroom, openEntry, changed }: ViewProps) {
    const { toast, confirm } = useUI();
    const [w, setW] = useState<WeekData | null>(null);
    const [err, setErr] = useState('');
    const [sign, setSign] = useState(false);

    useEffect(() => {
        setW(null); setErr('');
        logApi.week(classId, date).then(setW).catch((e) => setErr(errMsg(e)));
    }, [classId, date, rev]);

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!w) return <Skeleton h={420} />;

    const periods = [...new Set(w.slots.map((s) => s.period))].sort((a, b) => a - b);
    const map = new Map(w.slots.map((s) => [s.date + '|' + s.period, s]));
    const st = w.stats;
    const status = w.review?.status ?? 'open';

    const click = (s: Slot) => {
        if (s.state === 'future' && !s.entry) { toast('info', 'Tiết chưa diễn ra', 'Chỉ ghi sổ được các tiết đã hoặc đang diễn ra.'); return; }
        openEntry({ date: s.date, period: s.period, subject_name: s.subject_name, teacher_name: s.teacher_name, entry: s.entry, can_write: s.can_write, att: s.att });
    };
    const reopen = async () => {
        if (!(await confirm({ title: 'Mở lại sổ tuần?', msg: 'Sổ tuần sẽ được mở để chỉnh sửa. Bạn cần ký lại sau khi hoàn tất.', ok: 'Mở lại' }))) return;
        try { const x: any = await logApi.reopen({ class_id: classId, week_start: w.week.start }); toast('info', 'Đã mở lại', x.message); changed(); }
        catch (e) { toast('error', 'Không thể mở lại', errMsg(e)); }
    };

    const cell = (s?: Slot) => {
        if (!s) return <div className="ll-cell empty" />;
        const e = s.entry;
        const absent = s.att ? s.att.unexcused + s.att.excused : 0;
        return (
            <button className={`ll-cell ${s.state}`} onClick={() => click(s)} title={`${s.subject_name} – tiết ${s.period}`}>
                <b>{s.subject_name}</b>
                <span className="t">{s.teacher_name || '—'}</span>
                {e?.lesson_title ? <span className="ttl">{e.lesson_title}</span> : s.state === 'missing' ? <span className="ttl">Chưa ghi sổ</span> : s.state === 'draft' ? <span className="ttl">Bản nháp</span> : null}
                <span className="ft">
          {e?.rating && e.status === 'submitted' ? <span><span className={`ll-dot ${RATING[e.rating].tone}`} /> {RATING[e.rating].l}</span> : <span />}
                    {s.att && (absent > 0 || s.att.late > 0) ? <span>Vắng {absent}{s.att.late ? ` · M${s.att.late}` : ''}</span> : <span />}
        </span>
            </button>
        );
    };

    return (
        <div className="rw-stack">
            <div className="row">
                <b style={{ fontSize: 15 }}>{w.week.label}</b>
                <ReviewChip status={status} />
                <span className="ll-st info">Đã ký {st.filled}/{st.due} tiết</span>
                {st.avg_rating != null && <span className={`ll-st ${st.avg_rating >= 3.5 ? 'good' : st.avg_rating >= 2.5 ? 'info' : 'warn'}`}>Xếp loại TB: {ratingOf(st.avg_rating)}</span>}
                <span className="spacer" />
                <button className="btn ghost" onClick={() => window.print()}><Icon n="print" s={16} />In sổ tuần</button>
                {isHomeroom && (status === 'open' || status === 'returned') && <button className="btn primary" onClick={() => setSign(true)}><Icon n="check" s={16} />Ký sổ tuần</button>}
                {isHomeroom && status === 'signed' && <button className="btn ghost" onClick={reopen}><Icon n="refresh" s={16} />Mở lại sổ</button>}
            </div>
            {w.review?.status === 'returned' && w.review.bgh_note && <div className="rw-err"><Icon n="alert" />Ban Giám hiệu trả lại: {w.review.bgh_note}</div>}
            {w.locked && <div className="hint"><Icon n="info" s={14} /> Sổ tuần đã được ký nên đang bị khóa chỉnh sửa.</div>}

            <div className="ll-gridwrap">
                <div className="ll-grid">
                    <div />
                    {w.days.map((d) => <div key={d.date} className={`ll-dh${d.is_today ? ' today' : ''}`}>{d.label}<small>{dm(d.date)}</small></div>)}
                    {periods.map((p) => {
                        const t = meta.periods.find((x) => x.id === p);
                        return [
                            <div key={'p' + p} className="ll-ph">Tiết {p}{t && <small>{hm(t.start_time)}–{hm(t.end_time)}</small>}</div>,
                            ...w.days.map((d) => <div key={d.date + p}>{cell(map.get(d.date + '|' + p))}</div>),
                        ];
                    })}
                </div>
            </div>

            <div className="ll-legend">
                <span><i style={{ background: 'var(--good)' }} />Đã ký sổ</span><span><i style={{ background: '#e0a030' }} />Bản nháp</span>
                <span><i style={{ background: 'var(--bad)' }} />Chưa ghi sổ (quá hạn)</span><span><i style={{ background: '#c9d3e3' }} />Chưa diễn ra</span>
                <span>M = đi muộn</span>
            </div>

            {sign && <SignModal classId={classId} weekStart={w.week.start} label={w.week.label} initial={w.review?.homeroom_comment} onClose={() => setSign(false)} onDone={() => { setSign(false); changed(); }} />}

            {/* Bản in khổ A4 ngang – chỉ hiện khi in */}
            <div className="ll-sheet">
                <h2>SỔ ĐẦU BÀI</h2>
                <div className="sub">Lớp {w.class.name} · {w.week.label} · Năm học {meta.year.label} · GVCN: {w.class.homeroom_name || '—'}</div>
                <table>
                    <thead><tr><th>Thứ / ngày</th><th>Tiết</th><th>Môn</th><th>Tên bài dạy</th><th>Nội dung, nhận xét</th><th>Xếp loại</th><th>Vắng (KP/CP)</th><th>Giáo viên ký</th></tr></thead>
                    <tbody>
                    {w.slots.map((s) => (
                        <tr key={s.date + s.period}>
                            <td>{w.days.find((d) => d.date === s.date)?.label}<br />{dm(s.date)}</td><td style={{ textAlign: 'center' }}>{s.period}</td><td>{s.subject_name}</td>
                            <td>{s.entry?.lesson_no ? `(${s.entry.lesson_no}) ` : ''}{s.entry?.lesson_title || ''}</td>
                            <td>{s.entry?.content || ''}{s.entry?.discipline_note ? ` — ${s.entry.discipline_note}` : ''}</td>
                            <td>{s.entry?.rating ? RATING[s.entry.rating].l : ''}</td><td style={{ textAlign: 'center' }}>{s.att ? `${s.att.unexcused}/${s.att.excused}` : ''}</td>
                            <td>{s.entry?.status === 'submitted' ? s.teacher_name : ''}</td>
                        </tr>
                    ))}
                    </tbody>
                </table>
                <p style={{ marginTop: 8, fontSize: 12.5 }}><b>Nhận xét của GVCN:</b> {w.review?.homeroom_comment || '…………………………………………………………………………………………'}</p>
                <div className="sg"><div>Giáo viên chủ nhiệm<br /><i>(ký, ghi rõ họ tên)</i><br /><br /><br />{w.review?.signed_by_name}</div><div>Ban Giám hiệu<br /><i>Ngày {dmy(w.review?.bgh_at?.slice(0, 10))}</i><br /><br /><br />{w.review?.bgh_by_name}</div></div>
            </div>
        </div>
    );
}