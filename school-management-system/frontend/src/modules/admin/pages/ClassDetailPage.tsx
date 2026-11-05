'use client';

import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Icon } from '../components/ui/Icons';
import { ConfirmDialog } from '../components/ui/Modal';
import { useToast } from '../components/ui/Toast';
import { ClassFormModal } from '../components/classes/ClassFormModal';
import { HomeroomModal } from '../components/classes/ClassToolModals';
import { ActivityTab } from '../components/classes/ActivityTab';
import { OverviewTab } from '../components/classes/OverviewTab';
import { StatusBadge } from '../components/classes/shared';
import { StudentsTab } from '../components/classes/StudentsTab';
import { SubjectsTab } from '../components/classes/SubjectsTab';
import { TimetableTab } from '../components/classes/TimetableTab';
import { classService, getErrorMessage } from '../services/classService';
import type { ClassMeta, SchoolClass } from '../types/classes';

const TABS = [
  { id: 'overview', label: 'Tổng quan', icon: 'chart' },
  { id: 'students', label: 'Học sinh', icon: 'users' },
  { id: 'subjects', label: 'Môn học', icon: 'book' },
  { id: 'timetable', label: 'Thời khóa biểu', icon: 'calendar' },
  { id: 'activity', label: 'Nhật ký', icon: 'history' },
];

export default function ClassDetailPage({ classId }: { classId: number }) {
  const router = useRouter();
  const toast = useToast();
  const [cls, setCls] = useState<SchoolClass | null>(null);
  const [meta, setMeta] = useState<ClassMeta | null>(null);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('overview');
  const [edit, setEdit] = useState(false);
  const [hr, setHr] = useState(false);
  const [del, setDel] = useState(false);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const c = await classService.show(classId);
      setCls(c);
      setMeta(await classService.meta(c.school_year_id));
    } catch (e: any) { setError(e?.response?.status === 404 ? 'Không tìm thấy lớp học này.' : getErrorMessage(e)); }
  }, [classId]);

  useEffect(() => { load(); }, [load]);
  useEffect(() => { const h = window.location.hash.replace('#', ''); if (TABS.some((t) => t.id === h)) setTab(h); }, []);
  const go = (t: string) => { setTab(t); window.history.replaceState(null, '', `#${t}`); };
  const refreshClass = () => classService.show(classId).then(setCls).catch(() => {});

  const remove = async () => {
    setBusy(true);
    try { await classService.remove(classId); toast.success('Đã xóa lớp học'); router.push('/admin/classes'); }
    catch (e) { toast.error('Không thể xóa lớp', getErrorMessage(e)); setDel(false); } finally { setBusy(false); }
  };

  if (error) return (
    <div className="a-card a-empty">
      <div className="ill" style={{ background: 'var(--danger-soft)', color: 'var(--danger)' }}><Icon name="alert" size={36} /></div>
      <h3 style={{ color: 'var(--ink)' }}>{error}</h3><Link href="/admin/classes" className="a-btn pri">Quay lại danh sách</Link>
    </div>
  );
  if (!cls || !meta) return <div style={{ display: 'grid', gap: 18 }}><div className="a-skel" style={{ height: 150 }} /><div className="a-skel" style={{ height: 380 }} /></div>;

  return (
    <>
      <section className="a-hero">
        <div className="a-crumb"><Link href="/admin/classes">Lớp học</Link><span>›</span>Lớp {cls.name}</div>
        <div className="a-row a-wrap">
          <div style={{ flex: 1, minWidth: 260 }}>
            <h1>Lớp {cls.name}</h1>
            <p>Khối {cls.grade} · Năm học {cls.school_year_label} · {cls.homeroom_teacher ? `GVCN ${cls.homeroom_teacher.full_name}` : 'Chưa có GVCN'} · {cls.student_count}/{cls.capacity} học sinh</p>
          </div>
          <div className="a-row a-wrap">
            <StatusBadge status={cls.status} />
            <button className="a-btn" onClick={() => router.push('/admin/classes')}><Icon name="back" size={16} /> Danh sách</button>
            <button className="a-btn white" onClick={() => setEdit(true)}><Icon name="edit" size={16} /> Chỉnh sửa</button>
            <button className="a-btn" onClick={() => setDel(true)}><Icon name="trash" size={16} /> Xóa</button>
          </div>
        </div>
      </section>

      <div className="a-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.id} role="tab" aria-selected={tab === t.id} className={`a-tab ${tab === t.id ? 'on' : ''}`} onClick={() => go(t.id)}>
            <Icon name={t.icon} size={16} />{t.label}{t.id === 'students' && <span className="n">{cls.student_count}</span>}
          </button>
        ))}
      </div>

      {tab === 'overview' && <OverviewTab cls={cls} onEdit={() => setEdit(true)} onHomeroom={() => setHr(true)} goTab={go} />}
      {tab === 'students' && <StudentsTab cls={cls} onChanged={refreshClass} />}
      {tab === 'subjects' && <SubjectsTab cls={cls} meta={meta} />}
      {tab === 'timetable' && <TimetableTab cls={cls} />}
      {tab === 'activity' && <ActivityTab classId={cls.id} />}

      <ClassFormModal open={edit} onClose={() => setEdit(false)} meta={meta} yearId={cls.school_year_id} editing={cls} onSaved={(c) => setCls(c)} />
      <HomeroomModal open={hr} onClose={() => setHr(false)} meta={meta} target={cls} onSaved={(c) => setCls(c)} />
      <ConfirmDialog open={del} danger loading={busy} title={`Xóa lớp ${cls.name}?`} confirmText="Xóa lớp" onConfirm={remove} onClose={() => setDel(false)}
        message="Chỉ xóa được lớp chưa có học sinh và chưa có dữ liệu điểm. Thao tác không thể hoàn tác." />
    </>
  );
}
