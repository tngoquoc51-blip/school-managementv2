'use client';
import { useMemo, useState } from 'react';
import type { Ctx } from '../TeachersPage';
import Icon from '../../subjects/ui/Icon';
import { useToast } from '../../subjects/ui/Toast';
import { useConfirm } from '../../subjects/ui/Confirm';
import { Empty, ErrorBox, Kpi, Loading, useLoad } from '../../subjects/tabs/shared';
import { errMsg, teacherApi } from '../api';
import { Avatar, LoadBar } from './bits';

export default function WorkloadTab({ ctx }: { ctx: Ctx }) {
    const toast = useToast();
    const confirm = useConfirm();
    const q = useLoad(() => teacherApi.workload(ctx.yearId), [ctx.yearId]);
    const [f, setF] = useState<'' | 'over' | 'ok' | 'under'>('');
    const [busy, setBusy] = useState<number | null>(null);
    const rows = useMemo(() => (q.data?.workload.teachers ?? []).filter((t) => !f || t.status === f).sort((a, b) => b.periods - a.periods), [q.data, f]);
    if (q.loading && !q.data) return <Loading />;
    if (q.error || !q.data) return <ErrorBox msg={q.error} retry={q.reload} />;
    const s = q.data.workload.summary;
    const sug = q.data.suggestions;

    const apply = async (i: number) => {
        const x = sug[i];
        if (!(await confirm({ title: 'Chuyển phân công?', tone: 'primary', confirmText: 'Chuyển', message: <><b>{x.subject}</b> lớp <b>{x.class_name}</b> ({x.periods} tiết): <b>{x.from}</b> ({x.from_after + x.periods}→{x.from_after}) ➜ <b>{x.to}</b> ({x.to_after - x.periods}→{x.to_after}). Hệ thống đã kiểm tra không trùng lịch.</> }))) return;
        setBusy(x.class_subject_id);
        try { await teacherApi.transfer(x.class_subject_id, x.to_id); toast.success('Đã chuyển phân công', `${x.subject} ${x.class_name}: ${x.from} → ${x.to}`); q.reload(true); }
        catch (e) { toast.error('Không chuyển được', errMsg(e)); } finally { setBusy(null); }
    };
    const applyAll = async () => {
        if (!(await confirm({ title: `Áp dụng ${sug.length} gợi ý cân bằng tải?`, tone: 'warning', confirmText: 'Áp dụng tất cả', message: 'Mỗi phân công được kiểm tra trùng lịch riêng; trường hợp trùng sẽ bị bỏ qua.' }))) return;
        let ok = 0; const bad: string[] = [];
        for (const x of sug) { try { await teacherApi.transfer(x.class_subject_id, x.to_id); ok++; } catch (e) { bad.push(`${x.subject} ${x.class_name}: ${errMsg(e)}`); } }
        toast[bad.length ? 'warning' : 'success'](`Đã chuyển ${ok}/${sug.length} phân công`, bad[0]);
        q.reload(true);
    };

    return (
        <>
            <div className="sj-kpis">
                <Kpi icon="users" label="Giáo viên đang dạy" value={s.total} color="indigo" />
                <Kpi icon="gauge" label="Trung bình" value={`${s.avg} tiết`} sub={`Định mức ${s.quota}`} color="sky" />
                <Kpi icon="alert" label="Quá tải" value={s.over} color={s.over ? 'rose' : 'emerald'} />
                <Kpi icon="clock" label="Thiếu tải" value={s.under} color={s.under ? 'amber' : 'emerald'} />
            </div>

            <div className="sj-card sj-mt">
                <div className="sj-card-h"><div><h3>Gợi ý cân bằng tải</h3><p>Chuyển tiết từ giáo viên quá tải sang giáo viên cùng chuyên môn còn dư tiết, đã kiểm tra trùng lịch.</p></div>
                    {sug.length > 0 && <button className="sj-btn primary" onClick={applyAll}><Icon name="wand" size={16} /> Áp dụng tất cả</button>}</div>
                {sug.length === 0 ? <Empty icon="check" title="Không có gợi ý nào"><p>Không còn giáo viên quá tải có thể chuyển sang người cùng chuyên môn.</p></Empty> : sug.map((x, i) => (
                    <div key={x.class_subject_id} className="tc-sug">
                        <div><b>{x.from}</b><br /><small className="sj-muted">{x.from_after + x.periods} → {x.from_after} tiết</small></div>
                        <div style={{ textAlign: 'center' }}><span className="sj-badge pri">{x.subject} • {x.class_name}</span><br /><small>{x.periods} tiết <Icon name="right" size={12} /></small></div>
                        <div><b>{x.to}</b><br /><small className="sj-muted">{x.to_after - x.periods} → {x.to_after} tiết</small></div>
                        <button className="sj-btn sm primary" disabled={busy === x.class_subject_id} onClick={() => apply(i)}>Chuyển</button>
                    </div>))}
            </div>

            <div className="sj-bar sj-mt">
                <div className="sj-seg">{([['', 'Tất cả'], ['over', 'Quá tải'], ['ok', 'Hợp lý'], ['under', 'Thiếu tải']] as const).map(([k, l]) => <button key={k} className={f === k ? 'on' : ''} onClick={() => setF(k)}>{l}</button>)}</div>
                <span className="sj-spacer" /><button className="sj-btn" onClick={() => q.reload()}><Icon name="refresh" size={16} /> Làm mới</button>
            </div>
            <div className="sj-tablewrap"><table className="sj-table">
                <thead><tr><th>Giáo viên</th><th>Môn dạy</th><th>Lớp</th><th style={{ minWidth: 220 }}>Tải dạy</th></tr></thead>
                <tbody>{rows.map((t) => (
                    <tr key={t.id}>
                        <td><div className="tc-person" style={{ cursor: 'pointer' }} onClick={() => ctx.openTeacher(t.id)}><Avatar name={t.full_name} /><div><b>{t.full_name}</b><small>{t.code}{t.homeroom ? ' • GVCN' : ''}</small></div></div></td>
                        <td><small>{t.subjects.join(', ') || '—'}</small></td>
                        <td><small>{t.classes.join(', ') || '—'}</small></td>
                        <td><LoadBar periods={t.periods} quota={t.quota} status={t.status} /></td>
                    </tr>))}</tbody></table></div>
        </>
    );
}