'use client';

import { useCallback, useEffect, useState } from 'react';
import cat from '@/modules/admin/categories/categories.module.css';
import { getErrorMessage } from '@/modules/admin/categories/catalogApi';
import { useFeedback } from '@/modules/admin/categories/components/Feedback';
import Icon from '@/modules/admin/categories/components/Icon';
import { Badge, Drawer, EmptyState, ErrorState } from '@/modules/admin/categories/components/ui';
import s from '../roster.module.css';
import { ACCOUNT_LABEL, SIZE_LABEL, fmtDate, initials } from '../constants';
import { rosterApi } from '../rosterApi';
import type { ClassDetail, ClassRow, SubjectLite, Teacher } from '../types';
import AddStudentsModal from './AddStudentsModal';
import ClassFormModal from './ClassFormModal';
import PickClassModal from './PickClassModal';

type Tab = 'students' | 'subjects' | 'info';

interface Props {
    classId: number | null;
    yearId: number;
    allClasses: ClassRow[];
    teachers: Teacher[];
    subjects: SubjectLite[];
    onClose: () => void;
    onChanged: () => void;
    onOpenStudent: (id: number) => void;
}

export default function ClassDrawer({ classId, yearId, allClasses, teachers, subjects, onClose, onChanged, onOpenStudent }: Props) {
    const fb = useFeedback();
    const [d, setD] = useState<ClassDetail | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [tab, setTab] = useState<Tab>('students');
    const [add, setAdd] = useState(false);
    const [edit, setEdit] = useState(false);
    const [moving, setMoving] = useState<{ id: number; name: string } | null>(null);
    const [newSubject, setNewSubject] = useState('');
    const [newTeacher, setNewTeacher] = useState('');

    const load = useCallback(async () => {
        if (classId === null) return;
        setError(null);
        try { setD(await rosterApi.classDetail(classId)); } catch (e) { setError(getErrorMessage(e)); }
    }, [classId]);

    useEffect(() => { setD(null); setTab('students'); void load(); }, [load]);

    const changed = () => { onChanged(); void load(); };
    const c = d?.class;

    const removeStudent = async (id: number, name: string) => {
        const ok = await fb.confirm({ title: 'Gỡ học sinh khỏi lớp?', message: `${name} sẽ chưa có lớp trong năm học này.`, confirmLabel: 'Gỡ khỏi lớp', tone: 'danger' });
        if (!ok) return;
        try { await rosterApi.unenroll(id, yearId); fb.success('Đã gỡ khỏi lớp', name); changed(); } catch (e) { fb.error('Không gỡ được', getErrorMessage(e)); }
    };

    const transfer = async (toClass: number) => {
        if (!moving) return;
        try { await rosterApi.enroll(moving.id, toClass, yearId); fb.success('Đã chuyển lớp', moving.name); setMoving(null); changed(); } catch (e) { fb.error('Không chuyển được', getErrorMessage(e)); }
    };

    const setTeacher = async (subjectId: number, teacherId: number) => {
        if (!c) return;
        try { setD(await rosterApi.setSubjectTeacher(c.id, subjectId, teacherId)); onChanged(); fb.success('Đã cập nhật giáo viên bộ môn'); } catch (e) { fb.error('Không cập nhật được', getErrorMessage(e)); }
    };

    const removeSubject = async (subjectId: number, name: string) => {
        if (!c) return;
        const ok = await fb.confirm({ title: `Gỡ môn ${name} khỏi lớp?`, message: 'Chỉ gỡ được khi môn chưa nằm trong thời khóa biểu.', confirmLabel: 'Gỡ môn', tone: 'danger' });
        if (!ok) return;
        try { setD(await rosterApi.removeSubject(c.id, subjectId)); onChanged(); fb.success('Đã gỡ môn khỏi lớp'); } catch (e) { fb.error('Không gỡ được', getErrorMessage(e)); }
    };

    const addSubject = async () => {
        if (!c || !newSubject || !newTeacher) return;
        await setTeacher(Number(newSubject), Number(newTeacher));
        setNewSubject(''); setNewTeacher('');
    };

    const deleteClass = async () => {
        if (!c) return;
        const ok = await fb.confirm({ title: `Xóa lớp ${c.name}?`, message: 'Chỉ xóa được lớp trống (không học sinh, không phân công môn, không điểm).', confirmLabel: 'Xóa lớp', tone: 'danger' });
        if (!ok) return;
        try { await rosterApi.deleteClass(c.id); fb.success('Đã xóa lớp', c.name); onChanged(); onClose(); } catch (e) { fb.error('Không xóa được', getErrorMessage(e)); }
    };

    const exportCsv = async () => {
        if (!c) return;
        try { await rosterApi.exportClass(c.id); fb.success('Đã xuất danh sách lớp ' + c.name); } catch (e) { fb.error('Không xuất được', getErrorMessage(e)); }
    };

    const usedSubjects = new Set(d?.subjects.map((x) => x.subject_id));
    const pct = c ? Math.min(100, Math.round((c.students / c.capacity) * 100)) : 0;

    return (
        <>
            <Drawer open={classId !== null} title={c ? `Lớp ${c.name}` : 'Chi tiết lớp'} subtitle={c ? `Khối ${c.grade} · ${c.year_label ?? ''}` : undefined} onClose={onClose}>
                {error && <ErrorState message={error} onRetry={() => void load()} />}
                {!d && !error && <div className={cat.skelCard} style={{ height: 200 }} />}
                {d && c && (
                    <>
                        <div className={s.profileHead} style={{ alignItems: 'stretch', flexDirection: 'column', gap: 10 }}>
                            <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                                <Badge tone={SIZE_LABEL[c.size_state].tone} dot>{SIZE_LABEL[c.size_state].label}</Badge>
                                <span style={{ fontWeight: 800 }}><Icon name="users" size={15} /> {c.students}/{c.capacity} học sinh · {c.male} nam · {c.female} nữ</span>
                                <span style={{ flex: 1 }} />
                                <span className={cat.muted}>GVCN: <b>{c.homeroom_name ?? 'Chưa phân công'}</b></span>
                            </div>
                            <div className={`${s.meter} ${c.size_state === 'over' ? s.meterOver : c.size_state === 'under' ? s.meterUnder : ''}`}><i style={{ width: `${pct}%` }} /></div>
                        </div>

                        <div className={s.subTabs} role="tablist">
                            {([['students', `Học sinh (${c.students})`], ['subjects', `Môn & giáo viên (${c.subjects})`], ['info', 'Thông tin lớp']] as [Tab, string][]).map(([id, label]) => (
                                <button key={id} role="tab" aria-selected={tab === id} className={`${s.subTab} ${tab === id ? s.subTabOn : ''}`} onClick={() => setTab(id)}>{label}</button>
                            ))}
                        </div>

                        {tab === 'students' && (
                            <>
                                <div style={{ display: 'flex', gap: 10, marginBottom: 12, flexWrap: 'wrap' }}>
                                    <button className={cat.btnPrimary} onClick={() => setAdd(true)}><Icon name="plus" size={16} /> Thêm học sinh</button>
                                    <button className={cat.btnSoft} onClick={exportCsv}><Icon name="download" size={16} /> Xuất danh sách</button>
                                </div>
                                {d.students.length === 0 ? <EmptyState icon="users" title="Lớp chưa có học sinh" hint="Bấm “Thêm học sinh” để xếp học sinh chưa có lớp vào đây." /> : (
                                    <div className={cat.tableWrap}>
                                        <table className={cat.table}>
                                            <thead><tr><th style={{ width: 44 }}>#</th><th>Học sinh</th><th>Ngày sinh</th><th>Tài khoản</th><th style={{ width: 120 }} /></tr></thead>
                                            <tbody>
                                            {d.students.map((st, i) => {
                                                const a = st.account_status ? ACCOUNT_LABEL[st.account_status] : null;
                                                return (
                                                    <tr key={st.id}>
                                                        <td>{i + 1}</td>
                                                        <td><div className={cat.cellMain}><span className={`${s.avatar} ${st.gender === 'Nữ' ? s.avatarF : ''}`} style={{ width: 34, height: 34, fontSize: 13 }}>{initials(st.full_name)}</span><div><strong>{st.full_name}</strong><small>{st.code} · {st.gender}</small></div></div></td>
                                                        <td>{fmtDate(st.birth_date)}</td>
                                                        <td>{a ? <Badge tone={a.tone} dot>{a.label}</Badge> : <span className={cat.muted}>Chưa có</span>}</td>
                                                        <td className={cat.colActions}>
                                                            <button className={cat.iconBtn} title="Xem hồ sơ" aria-label="Xem hồ sơ" onClick={() => onOpenStudent(st.id)}><Icon name="search" size={16} /></button>
                                                            <button className={cat.iconBtn} title="Chuyển lớp" aria-label="Chuyển lớp" onClick={() => setMoving({ id: st.id, name: st.full_name })}><Icon name="restore" size={16} /></button>
                                                            <button className={cat.iconBtnDanger} title="Gỡ khỏi lớp" aria-label="Gỡ khỏi lớp" onClick={() => removeStudent(st.id, st.full_name)}><Icon name="x" size={16} /></button>
                                                        </td>
                                                    </tr>
                                                );
                                            })}
                                            </tbody>
                                        </table>
                                    </div>
                                )}
                            </>
                        )}

                        {tab === 'subjects' && (
                            <>
                                <div className={cat.tableWrap}>
                                    <table className={cat.table}>
                                        <thead><tr><th>Môn học</th><th>Tiết/tuần</th><th>Giáo viên bộ môn</th><th>TKB</th><th style={{ width: 60 }} /></tr></thead>
                                        <tbody>
                                        {d.subjects.length === 0 && <tr><td colSpan={5}><EmptyState icon="book" title="Lớp chưa được phân công môn học" hint="Thêm môn và giáo viên ở bên dưới." /></td></tr>}
                                        {d.subjects.map((sb) => (
                                            <tr key={sb.id}>
                                                <td><strong>{sb.name}</strong></td>
                                                <td>{sb.periods_per_week}</td>
                                                <td>
                                                    <select className={cat.select} value={sb.teacher_id ?? ''} onChange={(e) => setTeacher(sb.subject_id, Number(e.target.value))} aria-label={`Giáo viên môn ${sb.name}`}>
                                                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}
                                                    </select>
                                                </td>
                                                <td>{sb.slots > 0 ? <Badge tone="success">{sb.slots} tiết</Badge> : <span className={cat.muted}>Chưa xếp</span>}</td>
                                                <td className={cat.colActions}><button className={cat.iconBtnDanger} aria-label="Gỡ môn" onClick={() => removeSubject(sb.subject_id, sb.name)}><Icon name="trash" size={16} /></button></td>
                                            </tr>
                                        ))}
                                        </tbody>
                                    </table>
                                </div>
                                <div className={s.section}><span>Thêm môn học cho lớp</span></div>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <select className={cat.select} value={newSubject} onChange={(e) => setNewSubject(e.target.value)} aria-label="Môn học">
                                        <option value="">Chọn môn…</option>
                                        {subjects.filter((x) => !usedSubjects.has(x.id)).map((x) => <option key={x.id} value={x.id}>{x.name}</option>)}
                                    </select>
                                    <select className={cat.select} value={newTeacher} onChange={(e) => setNewTeacher(e.target.value)} aria-label="Giáo viên">
                                        <option value="">Chọn giáo viên…</option>
                                        {teachers.map((t) => <option key={t.id} value={t.id}>{t.full_name} — {t.subject ?? ''}</option>)}
                                    </select>
                                    <button className={cat.btnPrimary} disabled={!newSubject || !newTeacher} onClick={addSubject}><Icon name="plus" size={16} /> Thêm</button>
                                </div>
                            </>
                        )}

                        {tab === 'info' && (
                            <>
                                <dl className={s.kv}>
                                    <div><dt>Tên lớp</dt><dd>{c.name}</dd></div>
                                    <div><dt>Khối</dt><dd>{c.grade}</dd></div>
                                    <div><dt>Năm học</dt><dd>{c.year_label}</dd></div>
                                    <div><dt>Giáo viên chủ nhiệm</dt><dd>{c.homeroom_name ? `${c.homeroom_name} (${c.homeroom_code})` : 'Chưa phân công'}</dd></div>
                                    <div><dt>Sĩ số</dt><dd>{c.students} (nam {c.male} · nữ {c.female})</dd></div>
                                    <div><dt>Số môn được phân công</dt><dd>{c.subjects}</dd></div>
                                </dl>
                                <div style={{ display: 'flex', gap: 10, marginTop: 22, justifyContent: 'space-between', flexWrap: 'wrap' }}>
                                    <button className={cat.btnSoft} onClick={() => setEdit(true)}><Icon name="edit" size={15} /> Sửa thông tin lớp</button>
                                    <button className={cat.btnDangerSoft} onClick={deleteClass}><Icon name="trash" size={15} /> Xóa lớp</button>
                                </div>
                            </>
                        )}
                    </>
                )}
            </Drawer>

            {c && <AddStudentsModal open={add} yearId={yearId} classId={c.id} className={c.name} onClose={() => setAdd(false)} onDone={() => { setAdd(false); changed(); }} />}
            <ClassFormModal open={edit} yearId={yearId} editing={c ?? null} teachers={teachers} onClose={() => setEdit(false)} onSaved={() => { setEdit(false); changed(); }} />
            <PickClassModal open={moving !== null} title="Chuyển sang lớp khác" hint={moving ? `Chọn lớp mới cho ${moving.name}.` : undefined} classes={allClasses.filter((x) => x.grade === c?.grade || true)}
                            currentClassId={c?.id} confirmLabel="Chuyển lớp" onClose={() => setMoving(null)} onSubmit={transfer} />
        </>
    );
}