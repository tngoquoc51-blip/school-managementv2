'use client';
import { useEffect, useMemo, useState } from 'react';
import type { Ctx } from '../TeachersPage';
import Icon from '../../subjects/ui/Icon';
import { tcls } from '../../subjects/theme';
import { ErrorBox, Kpi, Loading, useLoad } from '../../subjects/tabs/shared';
import { teacherApi } from '../api';
import { WEEKDAYS } from './bits';

export default function ScheduleTab({ ctx }: { ctx: Ctx }) {
    const list = useLoad(() => teacherApi.list({ status: 'active', school_year_id: ctx.yearId }), [ctx.yearId]);
    const conf = useLoad(() => teacherApi.conflicts(ctx.yearId), [ctx.yearId]);
    const [id, setId] = useState<number | null>(ctx.pickTeacher);
    const [find, setFind] = useState('');
    useEffect(() => { if (id == null && list.data?.length) setId(list.data[0].id); }, [list.data, id]);
    const sc = useLoad(() => (id ? teacherApi.schedule(id, ctx.yearId) : Promise.resolve(null)), [id, ctx.yearId]);
    const teacher = list.data?.find((t) => t.id === id);
    const shown = useMemo(() => (list.data ?? []).filter((t) => !find || t.full_name.toLowerCase().includes(find.toLowerCase()) || t.code.toLowerCase().includes(find.toLowerCase())), [list.data, find]);
    if (list.loading && !list.data) return <Loading />;
    if (list.error) return <ErrorBox msg={list.error} retry={list.reload} />;
    const d = sc.data;
    const days = [2, 3, 4, 5, 6, 7];

    return (
        <div className="sj-grid" style={{ gridTemplateColumns: 'minmax(220px,280px) minmax(0,1fr)', alignItems: 'start' }}>
            <div className="sj-card" style={{ padding: 12, maxHeight: 'calc(100vh - 260px)', overflow: 'auto' }}>
                <div className="sj-search sj-mb"><Icon name="search" size={16} /><input className="sj-input" placeholder="Tìm giáo viên…" value={find} onChange={(e) => setFind(e.target.value)} /></div>
                {shown.map((t) => (
                    <button key={t.id} className={`sj-btn ${t.id === id ? 'primary' : 'ghost'}`} style={{ width: '100%', justifyContent: 'space-between', marginBottom: 4 }} onClick={() => { setId(t.id); ctx.setPickTeacher(t.id); }}>
                        <span style={{ textAlign: 'left' }}>{t.full_name}</span><small>{t.periods}t</small></button>))}
            </div>
            <div>
                {conf.data && conf.data.length > 0 && (
                    <div className="sj-hint bad sj-mb"><Icon name="alert" /><span><b>{conf.data.length} trường hợp trùng tiết</b> toàn trường: {conf.data.slice(0, 3).map((c) => `${c.full_name} (${WEEKDAYS[c.weekday]} T${c.period})`).join('; ')}{conf.data.length > 3 ? '…' : ''}</span></div>)}
                {teacher && (
                    <>
                        <div className="sj-kpis">
                            <Kpi icon="clock" label="Tiết/tuần theo TKB" value={d?.total ?? '…'} sub={`Phân công: ${teacher.periods} tiết`} color="indigo" />
                            <Kpi icon="grid" label="Số ngày dạy" value={d ? Object.keys(d.per_day).length : '…'} color="sky" />
                            <Kpi icon="alert" label="Trùng tiết" value={d?.conflicts.length ?? '…'} color={d?.conflicts.length ? 'rose' : 'emerald'} />
                        </div>
                        <div className="sj-card sj-mt">
                            <div className="sj-card-h"><div><h3>Lịch dạy: {teacher.full_name}</h3><p>{teacher.subjects.map((s) => s.name).join(', ')}{teacher.homeroom_class ? ` • GVCN ${teacher.homeroom_class}` : ''}</p></div>
                                <button className="sj-btn" onClick={() => ctx.openTeacher(teacher.id)}>Hồ sơ</button></div>
                            {sc.loading && !d ? <div className="sj-skel" style={{ height: 300 }} /> : d && (
                                <div className="tc-sched">
                                    <div className="h" />{days.map((w) => <div className="h" key={w}>{WEEKDAYS[w]}<br /><small>{d.per_day[w] ?? 0} tiết</small></div>)}
                                    {[1, 2, 3, 4, 5].map((p) => (<div key={p} style={{ display: 'contents' }}><div className="h" style={{ alignSelf: 'center' }}>Tiết {p}</div>
                                        {days.map((w) => { const c = d.cells[`${w}-${p}`]; return c ? (
                                            <div key={w} className={`lesson ${tcls(c[0].color)} ${c.length > 1 ? 'clash' : ''}`}><b>{c.map((x) => x.class_name).join(' + ')}</b>{c[0].subject}</div>) : <div key={w} className="free">·</div>; })}</div>))}
                                </div>)}
                            {d && d.total === 0 && <p className="sj-muted sj-mt">Giáo viên chưa có tiết nào trong thời khóa biểu năm học này.</p>}
                        </div>
                    </>)}
            </div>
        </div>
    );
}