'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import cat from '@/modules/admin/categories/categories.module.css';
import { getErrorMessage } from '@/modules/admin/categories/catalogApi';
import Icon from '@/modules/admin/categories/components/Icon';
import { Badge, EmptyState, ErrorState } from '@/modules/admin/categories/components/ui';
import { useDebounce } from '@/modules/admin/categories/hooks/useDebounce';
import s from './roster.module.css';
import AutoAssignModal from './components/AutoAssignModal';
import ClassDrawer from './components/ClassDrawer';
import ClassFormModal from './components/ClassFormModal';
import RosterShell from './components/RosterShell';
import StudentDrawer from './components/StudentDrawer';
import { GRADES, SIZE_LABEL } from './constants';
import { rosterApi } from './rosterApi';
import type { ClassRow, RosterOverview, SubjectLite, Teacher } from './types';

function Content({ yearId }: { yearId: number }) {
    const [overview, setOverview] = useState<RosterOverview | null>(null);
    const [items, setItems] = useState<ClassRow[]>([]);
    const [teachers, setTeachers] = useState<Teacher[]>([]);
    const [subjects, setSubjects] = useState<SubjectLite[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [searchInput, setSearchInput] = useState('');
    const search = useDebounce(searchInput);
    const [grade, setGrade] = useState('');
    const [filter, setFilter] = useState('');

    const [openId, setOpenId] = useState<number | null>(null);
    const [studentId, setStudentId] = useState<number | null>(null);
    const [creating, setCreating] = useState(false);
    const [auto, setAuto] = useState(false);

    const load = useCallback(async () => {
        setLoading(true); setError(null);
        try {
            const [c, o, l] = await Promise.all([rosterApi.classes({ year_id: yearId, search, grade, filter }), rosterApi.overview(yearId), rosterApi.lookups(yearId)]);
            setItems(c.items); setOverview(o); setTeachers(l.teachers); setSubjects(l.subjects);
        } catch (e) { setError(getErrorMessage(e)); } finally { setLoading(false); }
    }, [yearId, search, grade, filter]);

    useEffect(() => { void load(); }, [load]);

    const byGrade = useMemo(() => GRADES.map((g) => ({ grade: g, list: items.filter((c) => c.grade === g) })).filter((x) => x.list.length), [items]);
    const t = overview?.totals;
    const noHomeroom = overview?.warnings.find((w) => w.filter === 'no_homeroom')?.count ?? 0;

    const stats = overview && t ? [
        { icon: 'building', label: 'Số lớp học', value: t.classes, sub: overview.by_grade.map((g) => `K${g.grade}: ${g.classes}`).join(' · '), tone: 'indigo', onClick: () => { setFilter(''); setGrade(''); } },
        { icon: 'users', label: 'Học sinh đã xếp lớp', value: t.enrolled, sub: `Sĩ số trung bình ${overview.class_size.average}/lớp`, tone: 'emerald', onClick: () => setFilter('') },
        { icon: 'alert', label: 'Chưa xếp lớp', value: t.unplaced, sub: t.unplaced ? 'Bấm để xếp lớp tự động' : 'Tất cả đã có lớp', tone: 'amber', onClick: () => setAuto(true) },
        { icon: 'briefcase', label: 'Lớp chưa có GVCN', value: noHomeroom, sub: noHomeroom ? 'Bấm để lọc các lớp này' : 'Mọi lớp đã có chủ nhiệm', tone: 'cyan', onClick: () => setFilter('no_homeroom') },
    ] : [];

    const hasFilter = Boolean(searchInput || grade || filter);

    return (
        <>
            <div className={cat.statGrid}>
                {overview ? stats.map((st) => (
                    <button key={st.label} className={`${cat.statCard} ${cat['tone_' + st.tone]}`} onClick={st.onClick}>
                        <span className={cat.statIcon}><Icon name={st.icon} size={20} /></span>
                        <span className={cat.statLabel}>{st.label}</span>
                        <strong className={cat.statValue}>{st.value.toLocaleString('vi-VN')}</strong>
                        <span className={cat.statSub}>{st.sub}</span>
                        <Icon name="chevronRight" size={16} className={cat.statGo} />
                    </button>
                )) : [0, 1, 2, 3].map((i) => <div key={i} className={`${cat.statCard} ${cat.skelCard}`} />)}
            </div>

            {overview && overview.warnings.filter((w) => w.target === 'classes').length > 0 && (
                <ul className={cat.warnList} style={{ marginTop: 16 }}>
                    {overview.warnings.filter((w) => w.target === 'classes').map((w) => (
                        <li key={w.filter}>
                            <span className={`${cat.warnIcon} ${w.level === 'warning' ? cat.warnIconWarn : cat.warnIconInfo}`}><Icon name={w.level === 'warning' ? 'alert' : 'info'} size={16} /></span>
                            <div className={cat.groupText}><strong>{w.message}</strong></div>
                            <button className={cat.linkBtn} onClick={() => setFilter(w.filter)}>Lọc</button>
                        </li>
                    ))}
                </ul>
            )}

            <section className={cat.panel} style={{ marginTop: 16 }}>
                <div className={cat.toolbar}>
                    <label className={cat.search}>
                        <Icon name="search" size={16} />
                        <input value={searchInput} onChange={(e) => setSearchInput(e.target.value)} placeholder="Tìm theo tên lớp hoặc giáo viên chủ nhiệm…" aria-label="Tìm lớp" />
                    </label>
                    <div className={s.gradeChips}>
                        <button className={`${cat.chip} ${grade === '' ? cat.chipOn : ''}`} onClick={() => setGrade('')}>Tất cả khối</button>
                        {GRADES.map((g) => <button key={g} className={`${cat.chip} ${grade === String(g) ? cat.chipOn : ''}`} onClick={() => setGrade(String(g))}>Khối {g}</button>)}
                    </div>
                    <select className={cat.select} value={filter} onChange={(e) => setFilter(e.target.value)} aria-label="Tình trạng">
                        <option value="">Tình trạng: tất cả</option>
                        <option value="no_homeroom">Chưa có GVCN</option>
                        <option value="over">Quá sĩ số</option>
                        <option value="under">Thiếu sĩ số</option>
                        <option value="empty">Lớp trống</option>
                    </select>
                    {hasFilter && <button className={cat.linkBtn} onClick={() => { setSearchInput(''); setGrade(''); setFilter(''); }}>Xóa bộ lọc</button>}
                    <div className={cat.toolbarSpacer} />
                    <button className={cat.btnSoft} onClick={() => void load()}><Icon name="refresh" size={16} /> Làm mới</button>
                    <button className={cat.btnSoft} onClick={() => setAuto(true)} disabled={!t?.unplaced}><Icon name="sparkle" size={16} /> Xếp lớp tự động</button>
                    <button className={cat.btnPrimary} onClick={() => setCreating(true)}><Icon name="plus" size={16} /> Thêm lớp</button>
                </div>

                {error && <ErrorState message={error} onRetry={() => void load()} />}
                {!error && loading && items.length === 0 && <div className={s.classGrid}>{[0, 1, 2, 3, 4, 5].map((i) => <div key={i} className={cat.skelCard} style={{ height: 150 }} />)}</div>}
                {!error && !loading && items.length === 0 && <EmptyState icon="building" title={hasFilter ? 'Không có lớp phù hợp' : 'Năm học này chưa có lớp'} hint="Bấm “Thêm lớp” để tạo lớp đầu tiên." />}

                {!error && byGrade.map(({ grade: g, list }) => (
                    <div key={g}>
                        <h3 className={s.gradeTitle}>Khối {g} <Badge tone="neutral">{list.length} lớp · {list.reduce((a, c) => a + c.students, 0)} học sinh</Badge></h3>
                        <div className={s.classGrid}>
                            {list.map((c) => {
                                const pct = Math.min(100, Math.round((c.students / c.capacity) * 100));
                                const sz = SIZE_LABEL[c.size_state];
                                return (
                                    <button key={c.id} className={s.classCard} onClick={() => setOpenId(c.id)}>
                                        <div className={s.classTop}><span className={s.className}>{c.name}</span><Badge tone={sz.tone} dot>{sz.label}</Badge></div>
                                        <div className={s.classTeacher}><Icon name="briefcase" size={15} /> {c.homeroom_name ?? <span className={cat.muted}>Chưa có GVCN</span>}</div>
                                        <div className={`${s.meter} ${c.size_state === 'over' ? s.meterOver : c.size_state === 'under' ? s.meterUnder : ''}`}><i style={{ width: `${pct}%` }} /></div>
                                        <div className={s.classMeta}><span>{c.students}/{c.capacity} học sinh</span><span>{c.male} nam · {c.female} nữ</span><span>{c.subjects} môn</span></div>
                                    </button>
                                );
                            })}
                        </div>
                    </div>
                ))}
            </section>

            <ClassDrawer classId={openId} yearId={yearId} allClasses={items} teachers={teachers} subjects={subjects} onClose={() => setOpenId(null)} onChanged={() => void load()} onOpenStudent={setStudentId} />
            <StudentDrawer studentId={studentId} yearId={yearId} classes={items} onClose={() => setStudentId(null)} onChanged={() => void load()} />
            <ClassFormModal open={creating} yearId={yearId} editing={null} teachers={teachers} onClose={() => setCreating(false)} onSaved={(id) => { setCreating(false); void load(); setOpenId(id); }} />
            <AutoAssignModal open={auto} yearId={yearId} unplaced={t?.unplaced ?? 0} onClose={() => setAuto(false)} onDone={() => void load()} />
        </>
    );
}

export default function ClassesPage() {
    return (
        <RosterShell title="Lớp học" description="Quản lý lớp theo năm học: sĩ số, giáo viên chủ nhiệm, danh sách học sinh, phân công giáo viên bộ môn. Xếp lớp, chuyển lớp và xếp lớp tự động đều ghi nhật ký.">
            {({ yearId }) => <Content yearId={yearId} />}
        </RosterShell>
    );
}