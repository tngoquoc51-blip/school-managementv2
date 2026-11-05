'use client';

import { useEffect, useMemo, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { classService, getErrorMessage } from '../../services/classService';
import type { SchoolClass, TimetableData } from '../../types/classes';

const COLORS = ['#5b5bf0', '#0ea5e9', '#14b8a6', '#f59e0b', '#ec4899', '#8b5cf6', '#22c55e', '#ef4444', '#06b6d4', '#f97316', '#6366f1', '#84cc16', '#d946ef', '#0d9488'];
const key = (w: number, p: number) => `${w}-${p}`;
const hhmm = (t: string) => t.slice(0, 5);

export function TimetableTab({ cls }: { cls: SchoolClass }) {
  const toast = useToast();
  const [data, setData] = useState<TimetableData | null>(null);
  const [grid, setGrid] = useState<Record<string, number | null>>({});
  const [orig, setOrig] = useState<Record<string, number | null>>({});
  const [pick, setPick] = useState<{ w: number; p: number } | null>(null);
  const [saving, setSaving] = useState(false);

  const apply = (d: TimetableData) => {
    const g: Record<string, number | null> = {};
    d.slots.forEach((s) => (g[key(s.weekday, s.period)] = s.class_subject_id));
    setData(d); setGrid(g); setOrig(g);
  };
  useEffect(() => { classService.timetable(cls.id).then(apply).catch((e) => toast.error('Không tải được TKB', getErrorMessage(e))); }, [cls.id]); // eslint-disable-line react-hooks/exhaustive-deps

  const subjById = useMemo(() => new Map((data?.subjects ?? []).map((s) => [s.id, s])), [data]);
  const used = useMemo(() => {
    const m = new Map<number, number>();
    Object.values(grid).forEach((id) => id && m.set(id, (m.get(id) ?? 0) + 1));
    return m;
  }, [grid]);

  if (!data) return <div className="a-skel" style={{ height: 420 }} />;
  if (data.subjects.length === 0) {
    return <div className="a-card a-empty"><h3 style={{ color: 'var(--ink)' }}>Chưa phân công môn học</h3>Hãy phân công môn học và giáo viên ở tab “Môn học” trước khi xếp thời khóa biểu.</div>;
  }

  const allKeys = new Set([...Object.keys(grid), ...Object.keys(orig)]);
  const changed = [...allKeys].filter((k) => (grid[k] ?? null) !== (orig[k] ?? null));
  const colorOf = (id: number) => COLORS[(subjById.get(id)?.subject_id ?? id) % COLORS.length];

  const set = (w: number, p: number, id: number | null) => { setGrid({ ...grid, [key(w, p)]: id }); setPick(null); };
  const save = async () => {
    setSaving(true);
    try {
      const slots = changed.map((k) => { const [w, p] = k.split('-').map(Number); return { weekday: w, period: p, class_subject_id: grid[k] ?? null }; });
      apply(await classService.saveTimetable(cls.id, slots));
      toast.success('Đã lưu thời khóa biểu', `${slots.length} tiết được cập nhật.`);
    } catch (e) { toast.error('Không thể lưu thời khóa biểu', getErrorMessage(e)); } finally { setSaving(false); }
  };

  return (
    <div className="a-two" style={{ gridTemplateColumns: '1fr 300px' }}>
      <div className="a-card"><div className="a-card-b">
        <div className="a-row" style={{ marginBottom: 14 }}>
          <h3 style={{ margin: 0 }}>Thời khóa biểu lớp {cls.name}</h3><span className="a-sp" />
          {changed.length > 0 && <span className="a-badge warn">{changed.length} thay đổi chưa lưu</span>}
          <button className="a-btn" disabled={!changed.length} onClick={() => setGrid(orig)}>Hoàn tác</button>
          <button className="a-btn pri" disabled={!changed.length || saving} onClick={save}>{saving && <span className="a-spin" />} Lưu TKB</button>
        </div>
        <div style={{ overflowX: 'auto' }}>
          <div className="a-tt">
            <div />
            {data.weekdays.map((w) => <div key={w} className="hd">Thứ {w}</div>)}
            {data.periods.map((per) => (
              <div key={per.id} style={{ display: 'contents' }}>
                <div className="pr">Tiết {per.id}<small>{hhmm(per.start_time)} – {hhmm(per.end_time)}</small></div>
                {data.weekdays.map((w) => {
                  const id = grid[key(w, per.id)] ?? null;
                  const s = id ? subjById.get(id) : null;
                  const isDirty = (grid[key(w, per.id)] ?? null) !== (orig[key(w, per.id)] ?? null);
                  return (
                    <button key={w} className={`a-slot ${s ? 'f' : ''} ${isDirty ? 'dirty' : ''}`} style={s ? ({ ['--sc' as any]: colorOf(s.id) }) : undefined}
                            onClick={() => setPick({ w, p: per.id })}>
                      {s ? <><b>{s.subject_name}</b><small>{s.teacher_name}</small></> : <small>+ Thêm</small>}
                    </button>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div></div>

      <div className="a-card"><div className="a-card-b">
        <h3 style={{ marginTop: 0 }}>Số tiết theo môn</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          {data.subjects.map((s) => {
            const n = used.get(s.id) ?? 0;
            const over = n > s.periods_per_week;
            return (
              <div key={s.id}>
                <div className="a-row"><i style={{ width: 10, height: 10, borderRadius: 3, background: colorOf(s.id) }} /><b>{s.subject_name}</b><span className="a-sp" />
                  <span className={`a-badge ${over ? 'dng' : n === s.periods_per_week ? 'ok' : 'mut'}`}>{n}/{s.periods_per_week}</span></div>
                <div className="a-bar" style={{ marginTop: 6 }}><i style={{ width: `${Math.min(100, (n / s.periods_per_week) * 100)}%`, background: over ? 'var(--danger)' : colorOf(s.id) }} /></div>
              </div>
            );
          })}
        </div>
      </div></div>

      <Modal open={!!pick} onClose={() => setPick(null)} size="sm" title={pick ? `Thứ ${pick.w} · Tiết ${pick.p}` : ''} subtitle="Chọn môn học cho tiết này">
        <div style={{ display: 'grid', gap: 8, paddingTop: 6 }}>
          {data.subjects.map((s) => (
            <button key={s.id} className="a-sel-row" style={{ background: 'transparent', textAlign: 'left' }} onClick={() => pick && set(pick.w, pick.p, s.id)}>
              <i style={{ width: 12, height: 12, borderRadius: 4, background: colorOf(s.id) }} />
              <div style={{ flex: 1 }}><b>{s.subject_name}</b><div className="a-muted" style={{ fontSize: 12 }}>{s.teacher_name}</div></div>
            </button>
          ))}
          <button className="a-btn dng" onClick={() => pick && set(pick.w, pick.p, null)}>Xóa tiết này</button>
        </div>
      </Modal>
    </div>
  );
}
