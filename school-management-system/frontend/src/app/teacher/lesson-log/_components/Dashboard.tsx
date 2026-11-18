'use client';

import { useEffect, useState } from 'react';
import { ll } from '../_lib/api';
import type { Meta, Stats } from '../_lib/types';
import { Bar, Icon, Pill, addDays, dmy, fmtDT, num } from './ui';

interface Props { meta: Meta; tick: number; onOpen: (id: number) => void; onWeek: (classId: number, date: string) => void }

export default function Dashboard({ meta, tick, onOpen, onWeek }: Props) {
    const [days, setDays] = useState(30);
    const [mine, setMine] = useState(!meta.me.is_admin);
    const [cls, setCls] = useState('');
    const [s, setS] = useState<Stats | null>(null);
    const [loading, setLoading] = useState(true);
    const [err, setErr] = useState('');

    useEffect(() => {
        let alive = true;
        setLoading(true);
        ll.stats({ from: addDays(meta.today, -(days - 1)), to: meta.today, class_id: cls || undefined, mine: mine ? 1 : 0 })
            .then((d) => { if (alive) { setS(d); setErr(''); } })
            .catch((e) => alive && setErr(e instanceof Error ? e.message : 'Không tải được thống kê.'))
            .finally(() => alive && setLoading(false));
        return () => { alive = false; };
    }, [days, mine, cls, tick, meta.today]);

    if (err && !s) return <div className="ll-alert err"><Icon n="alert" s={18} /><span>{err}</span></div>;
    if (!s) return <div className="ll-loading"><i className="ll-spin" />Đang tải thống kê…</div>;
    const k = s.kpi;
    const maxW = Math.max(1, ...s.by_weekday.map((w) => w.absent + w.late));
    const maxR = Math.max(1, ...s.by_rating.map((r) => r.count));
    const rateColor: Record<string, string> = { good: '#10b981', fair: '#14b8a6', pass: '#f59e0b', poor: '#ef4444' };

    return (
        <div className="ll-stack" style={{ opacity: loading ? 0.7 : 1 }}>
            <div className="ll-filter-bar">
                <div className="ll-filter-group">
                    <div className="ll-select-wrap">
                        <Icon n="calendar" s={15} />
                        <select className="ll-filter-select" value={days} onChange={(e) => setDays(Number(e.target.value))}>
                            <option value={7}>7 ngày gần nhất</option>
                            <option value={30}>30 ngày gần nhất</option>
                            <option value={90}>90 ngày gần nhất</option>
                        </select>
                    </div>
                    <div className="ll-select-wrap">
                        <Icon n="layers2" s={15} />
                        <select className="ll-filter-select" value={cls} onChange={(e) => setCls(e.target.value)}>
                            <option value="">Tất cả các lớp</option>
                            {meta.classes.map((c) => <option key={c.id} value={c.id}>Lớp {c.name}</option>)}
                        </select>
                    </div>
                    <div className="ll-select-wrap">
                        <Icon n="teacher" s={15} />
                        <select className="ll-filter-select" value={mine ? '1' : '0'} onChange={(e) => setMine(e.target.value === '1')}>
                            <option value="1">Chỉ tiết dạy của tôi</option>
                            <option value="0">Toàn bộ sổ nhà trường</option>
                        </select>
                    </div>
                </div>
                <div className="ll-date-badge">
                    <Icon n="clock" s={14} />
                    <span>Khoảng thời gian: <b>{dmy(s.from)}</b> → <b>{dmy(s.to)}</b></span>
                </div>
            </div>

            <div className="ll-grid4">
                <div className="ll-kpi"><span>Tiết đã ghi sổ</span><b>{num(k.entries)}</b><small>{num(k.confirmed)} đã được GVCN xác nhận</small></div>
                <div className="ll-kpi ok" style={{ gridTemplateColumns: '1fr auto', alignItems: 'center' }}>
                    <div style={{ display: 'grid', gap: 3 }}><span>Tỷ lệ ký sổ</span><b>{k.sign_rate}%</b><small>{num(k.signed)}/{num(k.entries)} tiết</small></div>
                    <div className="ll-ring" style={{ background: `conic-gradient(#10b981 ${k.sign_rate * 3.6}deg,#e2e8f0 0)` }}><b>{k.sign_rate}%</b></div>
                </div>
                <div className={`ll-kpi ${k.drafts ? 'warn' : 'ok'}`}><span>Tiết chưa ký (nháp)</span><b>{num(k.drafts)}</b><small>{k.overdue_drafts ? `${k.overdue_drafts} tiết nháp quá 1 ngày` : 'không có tiết nháp quá hạn'}</small></div>
                <div className={`ll-kpi ${k.unexcused ? 'err' : 'ok'}`}><span>Vắng / đi muộn</span><b>{num(k.absent)}<small style={{ fontSize: '.45em' }}> vắng · {num(k.late)} muộn</small></b><small>{num(k.unexcused)} lượt vắng không phép</small></div>
            </div>

            <div className="ll-grid2">
                <section className="ll-card">
                    <header><h2>Xếp loại tiết học</h2></header>
                    <div className="ll-hb">
                        {s.by_rating.map((r) => (
                            <div key={r.key}><p><b>{r.label}</b><span>{num(r.count)} tiết</span></p>
                                <div className="ll-bar"><i style={{ width: `${(r.count / maxR) * 100}%`, background: rateColor[r.key] }} /></div></div>
                        ))}
                    </div>
                    <h3 className="ll-h3">Vắng / muộn theo thứ trong tuần</h3>
                    <div className="ll-months">
                        {s.by_weekday.map((w) => (
                            <div key={w.label}><b>{w.absent + w.late || ''}</b>
                                <div style={{ display: 'flex', alignItems: 'flex-end', gap: 3, height: 80 }}>
                                    <i style={{ height: `${(w.absent / maxW) * 76 + 3}px`, background: 'linear-gradient(180deg,#f87171,#dc2626)', width: 16 }} title={`Vắng ${w.absent}`} />
                                    <i style={{ height: `${(w.late / maxW) * 76 + 3}px`, background: 'linear-gradient(180deg,#fbbf24,#d97706)', width: 16 }} title={`Muộn ${w.late}`} />
                                </div><small>{w.label}</small></div>
                        ))}
                    </div>
                    <p className="ll-mu" style={{ margin: '6px 0 0' }}><span style={{ color: '#dc2626' }}>■</span> vắng &nbsp; <span style={{ color: '#d97706' }}>■</span> đi muộn</p>
                </section>

                <section className="ll-card">
                    <header><h2>Theo môn học</h2></header>
                    <div className="ll-hb">
                        {s.by_subject.length === 0 && <p className="ll-empty">Chưa có dữ liệu.</p>}
                        {s.by_subject.map((x) => (
                            <div key={x.subject}><p><b>{x.subject}</b><span>{x.count} tiết · {x.good_rate}% xếp loại Tốt/Khá</span></p><Bar value={x.good_rate} tone={x.good_rate >= 70 ? 'ok' : x.good_rate >= 40 ? 'sky' : 'warn'} /></div>
                        ))}
                    </div>
                </section>
            </div>

            <div className="ll-grid3">
                <section className="ll-card">
                    <header><h2>Tuần chờ xác nhận</h2><Pill tone={s.pending_weeks.length ? 'warn' : 'ok'}>{s.pending_weeks.length}</Pill></header>
                    <div className="ll-mini">
                        {s.pending_weeks.map((w) => (
                            <button key={`${w.class_id}-${w.week_start}`} onClick={() => onWeek(w.class_id, w.week_start)}>
                                <div className="r"><b>Lớp {w.class_name}</b><Pill tone={w.drafts ? 'warn' : 'pri'}>{w.drafts ? `${w.drafts} tiết nháp` : 'Sẵn sàng xác nhận'}</Pill></div>
                                <small className="ll-mu">Tuần từ {dmy(w.week_start)} · {w.entries} tiết</small>
                            </button>
                        ))}
                        {!s.pending_weeks.length && <p className="ll-empty">Tất cả các tuần đã được xác nhận.</p>}
                    </div>
                </section>
                <section className="ll-card">
                    <header><h2>Học sinh vắng nhiều</h2></header>
                    <ul className="ll-abl">
                        {s.top_absent.map((x) => (
                            <li key={x.student_id}><div className="ll-t"><b>{x.name}</b><small>{x.code ?? ''} · lớp {x.class_name}</small></div><Pill tone={x.unexcused ? 'err' : 'warn'}>{x.count} tiết{x.unexcused ? ` · ${x.unexcused} KP` : ''}</Pill></li>
                        ))}
                        {!s.top_absent.length && <li className="ll-empty" style={{ display: 'block' }}>Chưa có học sinh vắng.</li>}
                    </ul>
                </section>
                <section className="ll-card">
                    <header><h2>Giáo viên ghi sổ</h2></header>
                    <div className="ll-tw"><table className="ll-table">
                        <thead><tr><th>Giáo viên</th><th>Tiết</th><th>Đã ký</th><th>Nháp</th></tr></thead>
                        <tbody>{s.by_teacher.map((t) => <tr key={t.teacher_id}><td><b>{t.name}</b></td><td>{t.entries}</td><td>{t.signed}</td><td>{t.drafts ? <Pill tone="warn">{t.drafts}</Pill> : '—'}</td></tr>)}
                        {!s.by_teacher.length && <tr><td colSpan={4} className="ll-empty">Chưa có dữ liệu.</td></tr>}</tbody>
                    </table></div>
                </section>
            </div>

            <section className="ll-card">
                <header><h2>Hoạt động gần đây</h2></header>
                <ul className="ll-feed">
                    {s.recent.map((e) => (
                        <li key={e.id} style={{ cursor: 'pointer' }} onClick={() => onOpen(e.log_id)}>
                            <span className={`dot ${e.type === 'comment' ? 'comment' : e.type === 'sign' || e.type === 'confirm' ? 'approval' : 'task'}`}><Icon n={e.type === 'comment' ? 'comment' : e.type === 'sign' || e.type === 'confirm' ? 'check' : 'edit'} s={14} /></span>
                            <div><b>Lớp {e.class_name} · tiết {e.period} · {e.subject_name}</b><span>{e.message}</span><small>{e.actor_name ?? 'Hệ thống'} · {fmtDT(e.created_at)}</small></div>
                        </li>
                    ))}
                    {!s.recent.length && <li className="ll-empty">Chưa có hoạt động.</li>}
                </ul>
            </section>
        </div>
    );
}