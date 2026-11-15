'use client';
import { Fragment, useMemo, useState } from 'react';
import type { Ctx } from '../SubjectsPage';
import Icon from '../ui/Icon';
import { subjectApi } from '../api';
import { initials } from '../theme';
import { Empty, ErrorBox, Kpi, Loading, useDebounced, useLoad } from './shared';

export default function WorkloadTab({ ctx }: { ctx: Ctx }) {
    const q = useLoad(() => subjectApi.workload(ctx.yearId), [ctx.yearId]);
    const [kw, setKw] = useState('');
    const k = useDebounced(kw, 200);
    const [st, setSt] = useState('');
    const [sub, setSub] = useState('');
    const [sort, setSort] = useState<'periods' | 'name'>('periods');
    const [open, setOpen] = useState<number | null>(null);

    const rows = useMemo(() => {
        const l = (q.data?.teachers ?? []).filter((t) => (!k || t.full_name.toLowerCase().includes(k.toLowerCase()) || t.code.toLowerCase().includes(k.toLowerCase())) && (!st || t.status === st) && (!sub || String(t.main_subject_id) === sub));
        return l.sort((a, b) => (sort === 'periods' ? b.periods - a.periods : a.full_name.localeCompare(b.full_name, 'vi')));
    }, [q.data, k, st, sub, sort]);

    if (q.loading && !q.data) return <Loading />;
    if (q.error || !q.data) return <ErrorBox msg={q.error} retry={q.reload} />;
    const s = q.data.summary;
    const subjects = [...new Map(q.data.teachers.filter((t) => t.main_subject).map((t) => [t.main_subject_id, t.main_subject as string])).entries()];

    return (
        <>
            <div className="sj-kpis">
                <Kpi icon="users" label="Giáo viên" value={s.total} color="indigo" />
                <Kpi icon="clock" label="Trung bình tiết/tuần" value={s.avg_periods} sub={`Định mức ${s.quota} tiết (GVCN −4)`} color="sky" />
                <Kpi icon="alert" label="Vượt định mức" value={s.over} color={s.over ? 'rose' : 'emerald'} />
                <Kpi icon="down" label="Dạy dưới 60% định mức" value={s.under} color={s.under ? 'amber' : 'emerald'} />
            </div>
            <div className="sj-bar">
                <div className="sj-search"><Icon name="search" size={16} /><input className="sj-input" placeholder="Tìm giáo viên theo tên/mã…" value={kw} onChange={(e) => setKw(e.target.value)} /></div>
                <select className="sj-select" value={sub} onChange={(e) => setSub(e.target.value)}><option value="">Mọi chuyên môn</option>{subjects.map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select>
                <select className="sj-select" value={st} onChange={(e) => setSt(e.target.value)}><option value="">Mọi trạng thái</option><option value="over">Vượt định mức</option><option value="ok">Đủ tiết</option><option value="under">Thiếu tiết</option></select>
                <div className="sj-seg"><button className={sort === 'periods' ? 'on' : ''} onClick={() => setSort('periods')}>Nhiều tiết nhất</button><button className={sort === 'name' ? 'on' : ''} onClick={() => setSort('name')}>Theo tên</button></div>
            </div>
            {rows.length === 0 ? <div className="sj-card"><Empty icon="users" title="Không có giáo viên phù hợp" /></div> : (
                <div className="sj-tablewrap">
                    <table className="sj-table" style={{ minWidth: 820 }}>
                        <thead><tr><th>Giáo viên</th><th>Chuyên môn</th><th style={{ width: 280 }}>Tiết / định mức</th><th>Số lớp</th><th>Trạng thái</th><th /></tr></thead>
                        <tbody>{rows.map((t) => {
                            const pct = Math.min(100, (t.periods / Math.max(t.quota, 1)) * 100);
                            return (
                                <Fragment key={t.id}>
                                    <tr>
                                        <td><div className="sj-cell-main t-indigo"><span className="sj-avatar">{initials(t.full_name)}</span><div><b>{t.full_name}</b><small>{t.code}{t.homeroom ? ' • GVCN' : ''}</small></div></div></td>
                                        <td>{t.main_subject ?? '—'}</td>
                                        <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className={`sj-prog ${t.status === 'over' ? 'bad' : t.status === 'under' ? 'warn' : 'ok'}`} style={{ flex: 1 }}><i style={{ width: `${pct}%` }} /></div><b style={{ minWidth: 58 }}>{t.periods}/{t.quota}</b></div></td>
                                        <td>{t.classes}</td>
                                        <td><span className={`sj-badge ${t.status === 'over' ? 'bad' : t.status === 'under' ? 'warn' : 'ok'}`}>{t.status === 'over' ? `Vượt ${t.periods - t.quota} tiết` : t.status === 'under' ? 'Thiếu tiết' : 'Đủ định mức'}</span></td>
                                        <td><button className="sj-btn icon" onClick={() => setOpen(open === t.id ? null : t.id)} aria-label="Chi tiết"><Icon name={open === t.id ? 'up' : 'down'} size={15} /></button></td>
                                    </tr>
                                    {open === t.id && <tr key={`${t.id}x`}><td colSpan={6} style={{ background: 'var(--card-2)' }}>
                                        <p><b>Môn đang dạy:</b> {t.subjects.join(', ') || '—'}</p><p style={{ marginTop: 6 }}><b>Lớp phụ trách:</b> {t.class_names.join(', ') || '—'}</p></td></tr>}
                                </Fragment>);
                        })}</tbody>
                    </table>
                </div>)}
        </>
    );
}