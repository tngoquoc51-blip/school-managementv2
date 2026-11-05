'use client';

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '../ui/Toast';
import { classService, getErrorMessage } from '../../services/classService';
import type { ClassMeta, ClassSubject, SchoolClass } from '../../types/classes';

export function SubjectsTab({ cls, meta }: { cls: SchoolClass; meta: ClassMeta }) {
  const toast = useToast();
  const [map, setMap] = useState<Record<number, number | null>>({}); // subject_id -> teacher_id (null = không dạy)
  const [orig, setOrig] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const apply = (list: ClassSubject[]) => {
    const m: Record<number, number | null> = {};
    meta.subjects.forEach((s) => (m[s.id] = null));
    list.forEach((cs) => (m[cs.subject_id] = cs.teacher_id));
    setMap(m); setOrig(JSON.stringify(m));
  };

  useEffect(() => {
    classService.subjects(cls.id).then(apply).catch((e) => toast.error('Không tải được môn học', getErrorMessage(e))).finally(() => setLoading(false));
  }, [cls.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const dirty = JSON.stringify(map) !== orig;
  const assigned = Object.values(map).filter(Boolean).length;
  const totalPeriods = useMemo(() => meta.subjects.reduce((n, s) => n + (map[s.id] ? s.periods_per_week : 0), 0), [map, meta]);

  const toggle = (sid: number, subjectTeacherPool: number | undefined) =>
    setMap((m) => ({ ...m, [sid]: m[sid] ? null : subjectTeacherPool ?? meta.teachers[0]?.id ?? null }));

  const save = async () => {
    const missing = meta.subjects.filter((s) => map[s.id] === undefined);
    if (missing.length) return;
    setSaving(true);
    try {
      const list = await classService.saveSubjects(cls.id, Object.entries(map).filter(([, t]) => t).map(([s, t]) => ({ subject_id: +s, teacher_id: t as number })));
      apply(list);
      toast.success('Đã lưu phân công môn học', `${list.length} môn được phân công cho lớp ${cls.name}`);
    } catch (e) { toast.error('Không thể lưu phân công', getErrorMessage(e)); } finally { setSaving(false); }
  };

  if (loading) return <div className="a-skel" style={{ height: 360 }} />;

  return (
    <div className="a-card">
      <div className="a-card-h">
        <div><h3>Phân công môn học & giáo viên bộ môn</h3>
          <span className="a-muted">{assigned}/{meta.subjects.length} môn · {totalPeriods} tiết/tuần</span></div>
        <div className="a-row">
          {dirty && <span className="a-badge warn">Chưa lưu</span>}
          <button className="a-btn" disabled={!dirty} onClick={() => setMap(JSON.parse(orig))}>Hoàn tác</button>
          <button className="a-btn pri" disabled={!dirty || saving} onClick={save}>{saving && <span className="a-spin" />} Lưu phân công</button>
        </div>
      </div>
      <div className="a-table-wrap" style={{ marginTop: 14 }}>
        <table className="a-table">
          <thead><tr><th style={{ width: 70 }}>Dạy</th><th>Môn học</th><th>Tiết/tuần</th><th>Giáo viên phụ trách</th></tr></thead>
          <tbody>
            {meta.subjects.map((s) => {
              const on = !!map[s.id];
              const pool = meta.teachers.filter((t) => t.main_subject_id === s.id);
              const others = meta.teachers.filter((t) => t.main_subject_id !== s.id);
              return (
                <tr key={s.id}>
                  <td><input type="checkbox" className="a-check" checked={on} onChange={() => toggle(s.id, pool[0]?.id)} /></td>
                  <td><b>{s.name}</b> <span className="a-muted">({s.code})</span></td>
                  <td><span className="a-badge pri">{s.periods_per_week} tiết</span></td>
                  <td>
                    <select className="a-select" style={{ maxWidth: 340 }} disabled={!on} value={map[s.id] ?? ''}
                            onChange={(e) => setMap({ ...map, [s.id]: +e.target.value })}>
                      {!on && <option value="">—</option>}
                      <optgroup label={`Giáo viên ${s.name}`}>{pool.map((t) => <option key={t.id} value={t.id}>{t.full_name}</option>)}</optgroup>
                      <optgroup label="Giáo viên khác">{others.map((t) => <option key={t.id} value={t.id}>{t.full_name} · {t.main_subject}</option>)}</optgroup>
                    </select>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
