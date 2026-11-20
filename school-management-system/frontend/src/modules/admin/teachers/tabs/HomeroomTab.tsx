'use client';
import { useState } from 'react';
import type { Ctx } from '../TeachersPage';
import Modal from '../../subjects/ui/Modal';
import Icon from '../../subjects/ui/Icon';
import { useToast } from '../../subjects/ui/Toast';
import { useConfirm } from '../../subjects/ui/Confirm';
import { ErrorBox, Kpi, Loading, useLoad } from '../../subjects/tabs/shared';
import { errMsg, teacherApi } from '../api';
import type { HomeroomData } from '../types';
import { Avatar } from './bits';

type Cls = HomeroomData['classes'][number];

export default function HomeroomTab({ ctx }: { ctx: Ctx }) {
    const toast = useToast();
    const confirm = useConfirm();
    const q = useLoad(() => teacherApi.homeroom(ctx.yearId), [ctx.yearId]);
    const [grade, setGrade] = useState(0);
    const [pick, setPick] = useState<Cls | null>(null);
    const [find, setFind] = useState('');
    if (q.loading && !q.data) return <Loading />;
    if (q.error || !q.data) return <ErrorBox msg={q.error} retry={q.reload} />;
    const all = q.data.classes;
    const rows = all.filter((c) => !grade || c.grade === grade);
    const none = all.filter((c) => !c.homeroom_teacher_id).length;
    const students = all.reduce((a, c) => a + c.students, 0);

    const set = async (c: Cls, tid: number | null, name?: string) => {
        try {
            const r = await teacherApi.setHomeroom(c.id, tid);
            toast.success(tid ? 'Đã phân công chủ nhiệm' : 'Đã bỏ chủ nhiệm', tid ? `${name} → lớp ${c.name}` : `Lớp ${c.name}`);
            r.warnings.forEach((w) => toast.warning('Lưu ý', w));
            setPick(null); q.reload(true);
        } catch (e) { toast.error('Không thực hiện được', errMsg(e)); }
    };
    const clear = async (c: Cls) => {
        if (await confirm({ title: `Bỏ chủ nhiệm lớp ${c.name}?`, tone: 'warning', confirmText: 'Bỏ chủ nhiệm', message: <>{c.teacher} sẽ không còn là GVCN lớp này (định mức tiết dạy tăng thêm {ctx.meta.reduction} tiết).</> })) set(c, null);
    };
    const free = q.data.free_teachers.filter((t) => !find || t.full_name.toLowerCase().includes(find.toLowerCase()) || t.code.toLowerCase().includes(find.toLowerCase()));

    return (
        <>
            <div className="sj-kpis">
                <Kpi icon="star" label="Đã có GVCN" value={`${all.length - none}/${all.length}`} color={none ? 'amber' : 'emerald'} sub={none ? `${none} lớp còn trống` : 'Đủ GVCN'} />
                <Kpi icon="users" label="Tổng học sinh" value={students} color="indigo" />
                <Kpi icon="users" label="GV chưa chủ nhiệm" value={q.data.free_teachers.length} sub="Có thể phân công" color="sky" />
            </div>
            <div className="sj-bar sj-mt">
                <div className="sj-seg">{[0, 10, 11, 12].map((g) => <button key={g} className={grade === g ? 'on' : ''} onClick={() => setGrade(g)}>{g ? `Khối ${g}` : 'Tất cả'}</button>)}</div>
                <span className="sj-spacer" /><button className="sj-btn" onClick={() => q.reload()}><Icon name="refresh" size={16} /> Làm mới</button>
            </div>
            <div className="tc-hr-grid">
                {rows.map((c) => (
                    <div key={c.id} className={`tc-hr ${c.homeroom_teacher_id ? '' : 'none'}`}>
                        <h4>Lớp {c.name}<span className="sj-badge">{c.students} HS</span></h4>
                        {c.homeroom_teacher_id ? (
                            <>
                                <div className="tc-person"><Avatar name={c.teacher ?? ''} /><div><b>{c.teacher}</b><small>{c.teacher_code} • {c.teacher_periods} tiết/tuần</small></div></div>
                                {!c.teaches_class && <div className="sj-hint warn"><Icon name="alert" size={16} /><span>GVCN chưa dạy môn nào ở lớp này</span></div>}
                                <div style={{ display: 'flex', gap: 8 }}>
                                    <button className="sj-btn sm" style={{ flex: 1 }} onClick={() => ctx.openTeacher(c.homeroom_teacher_id!)}>Hồ sơ</button>
                                    <button className="sj-btn sm" style={{ flex: 1 }} onClick={() => setPick(c)}>Đổi GVCN</button>
                                    <button className="sj-btn sm danger-h" onClick={() => clear(c)} title="Bỏ chủ nhiệm"><Icon name="x" size={14} /></button>
                                </div>
                            </>
                        ) : (
                            <><p className="sj-muted">Chưa có giáo viên chủ nhiệm.</p><button className="sj-btn primary" onClick={() => setPick(c)}><Icon name="plus" size={15} /> Phân công GVCN</button></>
                        )}
                    </div>))}
            </div>

            {pick && (
                <Modal size="md" onClose={() => { setPick(null); setFind(''); }} title={`Chọn GVCN lớp ${pick.name}`} subtitle="Chỉ hiển thị giáo viên đang công tác và chưa chủ nhiệm lớp nào."
                       footer={<button className="sj-btn ghost" onClick={() => setPick(null)}>Đóng</button>}>
                    <div className="sj-search sj-mb"><Icon name="search" size={16} /><input className="sj-input" autoFocus placeholder="Tìm giáo viên…" value={find} onChange={(e) => setFind(e.target.value)} /></div>
                    {free.length === 0 ? <p className="sj-muted">Không còn giáo viên phù hợp.</p> : free.map((t) => (
                        <button key={t.id} className="tc-cert" style={{ width: '100%', background: 'var(--card)', cursor: 'pointer', textAlign: 'left' }} onClick={() => set(pick, t.id, t.full_name)}>
                            <span className="tc-person"><Avatar name={t.full_name} /><span><b>{t.full_name}</b><small>{t.code} • {ctx.meta.subjects.find((s) => s.id === t.main_subject_id)?.name ?? 'Chưa có môn chính'}</small></span></span>
                            <Icon name="right" size={16} /></button>))}
                </Modal>)}
        </>
    );
}