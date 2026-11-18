'use client';

import { useEffect, useState } from 'react';
import { errMsg, logApi } from '@/modules/teacher/lessonlog/service';
import type { OverviewData, ViewProps } from '@/modules/teacher/lessonlog/types';
import { barTone, dm, ratingOf, ratingTone } from '@/modules/teacher/lessonlog/util';
import { Empty, Icon, Skeleton, ftime } from '@/app/bgh/rewards/ui';
import { Bar, Kpi, ReviewChip } from '../parts';

const WD: Record<number, string> = { 2: 'T2', 3: 'T3', 4: 'T4', 5: 'T5', 6: 'T6', 7: 'T7' };
const ACT: Record<string, string> = { sign: 'edit', draft: 'edit', delete: 'trash', note: 'star', week_sign: 'check', week_reopen: 'refresh', week_approve: 'award', week_return: 'alert', init: 'info' };

export default function Overview({ classId, date, rev, isHomeroom, meta, go, openEntry, openNote }: ViewProps) {
    const [d, setD] = useState<OverviewData | null>(null);
    const [err, setErr] = useState('');
    useEffect(() => {
        setD(null); setErr('');
        logApi.overview(classId, date).then(setD).catch((e) => setErr(errMsg(e)));
    }, [classId, date, rev]);

    if (err) return <div className="rw-err"><Icon n="alert" />{err}</div>;
    if (!d) return <div className="rw-stack"><div className="rw-grid4"><Skeleton h={92} /><Skeleton h={92} /><Skeleton h={92} /><Skeleton h={92} /></div><Skeleton h={220} /></div>;

    const s = d.stats;
    const maxRate = 100;

    return (
        <div className="rw-stack">
            <div className="row">
                <b style={{ fontSize: 15 }}>{d.week.label}</b>
                <ReviewChip status={d.review?.status ?? 'open'} />
                <span className="spacer" />
                {!meta.me.is_bgh && <button className="btn brass" onClick={() => go('week')}><Icon n="edit" s={16} />Ghi sổ tuần này</button>}
            </div>

            <section className="rw-grid4">
                <Kpi label="Tiết đã ký sổ" value={`${s.filled}/${s.due}`} note={s.rate != null ? `${s.rate}% tiết đến hạn` : 'Chưa có tiết đến hạn'} accent />
                <Kpi label="Tiết chưa ký sổ" value={s.missing} tone={s.missing ? 'bad' : 'good'} note={s.missing ? 'Cần bổ sung ngay' : 'Đã đầy đủ'} onClick={() => go('week')} />
                <Kpi label="Xếp loại tiết học TB" value={ratingOf(s.avg_rating)} tone={ratingTone(s.avg_rating) === 'bad' ? 'bad' : ratingTone(s.avg_rating) === 'good' ? 'good' : undefined} note={s.avg_rating != null ? `${s.avg_rating}/4 điểm` : 'Chưa có xếp loại'} />
                <Kpi label="Lượt vắng trong tuần" value={s.excused + s.unexcused} note={`KP ${s.unexcused} · CP ${s.excused} · Muộn ${s.late}`} onClick={() => go('attendance')} />
            </section>

            <section className="rw-cols">
                <div className="panel">
                    <div className="ph"><h3>Hoàn thành sổ 8 tuần gần nhất</h3><span className="spacer" /><span className="muted">% tiết đã ký sổ</span></div>
                    <div className="pb">
                        <div className="ll-bars">
                            {d.trend.map((t) => (
                                <div className="c" key={t.start} title={`${t.label}: ${t.filled}/${t.due} tiết`}>
                                    <b>{t.rate ?? '–'}{t.rate != null ? '%' : ''}</b>
                                    <i className={`${(t.rate ?? 100) < 70 ? 'low' : ''}${t.start === d.week.start ? ' cur' : ''}`} style={{ height: `${((t.rate ?? 0) / maxRate) * 100}%` }} />
                                    <span>{t.label}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="panel">
                    <div className="ph"><h3>Trạng thái sổ tuần</h3></div>
                    <div className="pb" style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                        <ReviewChip status={d.review?.status ?? 'open'} />
                        {d.review?.homeroom_comment && <div className="ll-ro">{d.review.homeroom_comment}</div>}
                        {d.review?.bgh_note && <div className="hint">Ý kiến BGH ({d.review.bgh_by_name}): {d.review.bgh_note}</div>}
                        {d.review?.signed_by_name && <div className="hint">GVCN {d.review.signed_by_name} đã ký.</div>}
                        <button className="btn ghost" onClick={() => go('reviews')}><Icon n="award" s={16} />{isHomeroom ? 'Ký sổ tuần' : 'Xem ký & duyệt'}</button>
                    </div>
                </div>
            </section>

            <section className="rw-cols3">
                <div className="panel">
                    <div className="ph"><h3>Việc cần làm</h3><span className="spacer" />{d.todo_total > 0 && <span className="badge bad">{d.todo_total} tiết</span>}</div>
                    {!d.todo.length ? <Empty icon="check" text="Không còn tiết nào chưa ký sổ." /> : d.todo.map((t) => (
                        <button className="mini" key={t.date + t.period} onClick={() => openEntry({ date: t.date, period: t.period, subject_name: t.subject_name, teacher_name: t.teacher_name, entry: null, can_write: !meta.me.is_bgh && (t.mine || isHomeroom) })}>
                            <span className="n"><b>{t.subject_name}</b><span>{WD[t.weekday]} {dm(t.date)} · Tiết {t.period} · {t.teacher_name || '—'}</span></span>
                            <span className="badge warn">Ghi sổ</span>
                        </button>
                    ))}
                </div>
                <div className="panel">
                    <div className="ph"><h3>Hoàn thành theo môn (tuần)</h3></div>
                    <div className="pb">
                        {d.by_subject.map((b) => {
                            const pct = b.due ? Math.round(b.filled / b.due * 100) : null;
                            return (
                                <div className="ll-prow" key={b.subject_id}>
                                    <span><b>{b.name}</b><small>{b.teacher_name || '—'}</small></span>
                                    <Bar pct={pct} tone={barTone(pct)} /><b>{b.filled}/{b.due}</b>
                                </div>
                            );
                        })}
                    </div>
                </div>
                <div className="panel">
                    <div className="ph"><h3>Học sinh vắng nhiều</h3><span className="spacer" /><button className="btn ghost sm" onClick={() => go('attendance')}>Chi tiết</button></div>
                    {!d.absent.length ? <Empty icon="check" text="Không có học sinh vắng trong tuần." /> : d.absent.map((a) => (
                        <div className="mini" key={a.id}>
                            <span className="n"><b>{a.full_name}</b><span>{a.code}</span></span>
                            {a.unexcused > 0 && <span className="badge bad">KP {a.unexcused}</span>}
                            {a.excused > 0 && <span className="badge info">CP {a.excused}</span>}
                            {a.late > 0 && <span className="badge warn">M {a.late}</span>}
                        </div>
                    ))}
                </div>
            </section>

            <section className="rw-cols">
                <div className="panel">
                    <div className="ph"><h3>Nề nếp trong tuần</h3><span className="spacer" />{!meta.me.is_bgh && <button className="btn brass sm" onClick={openNote}><Icon n="plus" s={14} />Ghi nhận</button>}</div>
                    <div className="pb" style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                        <span className="ll-st good"><Icon n="star" s={14} />Biểu dương {d.notes.praise}</span>
                        <span className="ll-st bad"><Icon n="alert" s={14} />Vi phạm {d.notes.violation}</span>
                        <span className="ll-st info"><Icon n="info" s={14} />Ghi chú {d.notes.note}</span>
                        <button className="btn ghost sm" onClick={() => go('notes')}>Xem sổ nề nếp</button>
                    </div>
                </div>
                <div className="panel">
                    <div className="ph"><h3>Hoạt động gần đây</h3></div>
                    {!d.recent.length ? <Empty icon="log" text="Chưa có hoạt động." /> : d.recent.map((l) => (
                        <div className="mini" key={l.id}>
                            <span className="ll-dot info" /><span className="n"><b>{l.description}</b><span>{l.user_name} · {ftime(l.created_at)}</span></span>
                            <Icon n={ACT[l.action] || 'info'} s={15} />
                        </div>
                    ))}
                </div>
            </section>
        </div>
    );
}