'use client';

import { useEffect, useState } from 'react';
import { Modal } from '../ui/Modal';
import { useToast } from '../ui/Toast';
import { classService, getErrorMessage } from '../../services/classService';
import type { ClassMeta, SchoolClass } from '../../types/classes';

/* ---------------- Tạo lớp hàng loạt ---------------- */
export function BulkCreateModal({ open, onClose, meta, yearId, onDone }: {
  open: boolean; onClose: () => void; meta: ClassMeta; yearId: number; onDone: () => void;
}) {
  const toast = useToast();
  const [f, setF] = useState({ grade: 10, prefix: 'A', start: 1, count: 6, capacity: 45 });
  const [busy, setBusy] = useState(false);
  const preview = Array.from({ length: Math.min(Math.max(f.count, 0), 20) }, (_, i) => `${f.grade}${f.prefix}${f.start + i}`);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await classService.bulk({ school_year_id: yearId, ...f });
      toast.success(`Đã tạo ${r.created.length} lớp`, r.skipped.length ? `Bỏ qua (đã tồn tại): ${r.skipped.join(', ')}` : undefined);
      onDone(); onClose();
    } catch (e) { toast.error('Không thể tạo hàng loạt', getErrorMessage(e)); } finally { setBusy(false); }
  };

  return (
    <Modal open={open} onClose={onClose} title="Tạo lớp hàng loạt" subtitle="Sinh nhanh danh sách lớp theo quy tắc đặt tên" footer={
      <><button className="a-btn" onClick={onClose}>Hủy</button>
        <button className="a-btn pri" onClick={submit} disabled={busy || !f.prefix.trim() || f.count < 1}>{busy && <span className="a-spin" />} Tạo {preview.length} lớp</button></>
    }>
      <div style={{ display: 'grid', gap: 14, paddingTop: 8 }}>
        <div className="a-grid2">
          <div className="a-field"><label>Khối</label>
            <select className="a-select" value={f.grade} onChange={(e) => setF({ ...f, grade: +e.target.value })}>
              {meta.grades.map((g) => <option key={g} value={g}>Khối {g}</option>)}</select></div>
          <div className="a-field"><label>Ký hiệu (A, B, CT…)</label>
            <input className="a-input" maxLength={3} value={f.prefix} onChange={(e) => setF({ ...f, prefix: e.target.value.toUpperCase() })} /></div>
        </div>
        <div className="a-grid2">
          <div className="a-field"><label>Bắt đầu từ số</label>
            <input type="number" min={1} className="a-input" value={f.start} onChange={(e) => setF({ ...f, start: +e.target.value })} /></div>
          <div className="a-field"><label>Số lớp (tối đa 20)</label>
            <input type="number" min={1} max={20} className="a-input" value={f.count} onChange={(e) => setF({ ...f, count: +e.target.value })} /></div>
        </div>
        <div className="a-field"><label>Sĩ số tối đa mỗi lớp</label>
          <input type="number" min={10} max={60} className="a-input" value={f.capacity} onChange={(e) => setF({ ...f, capacity: +e.target.value })} /></div>
        <div>
          <div className="a-muted" style={{ marginBottom: 8, fontWeight: 600 }}>Xem trước</div>
          <div className="a-row a-wrap">{preview.map((n) => <span key={n} className="a-badge pri">{n}</span>)}</div>
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Sao chép / lên lớp sang năm học mới ---------------- */
export function CloneYearModal({ open, onClose, meta, yearId, onDone }: {
  open: boolean; onClose: () => void; meta: ClassMeta; yearId: number; onDone: (toYear: number) => void;
}) {
  const toast = useToast();
  const other = meta.school_years.find((y) => y.id !== yearId)?.id ?? yearId;
  const [from, setFrom] = useState(yearId);
  const [to, setTo] = useState(other);
  const [promote, setPromote] = useState(true);
  const [copySubjects, setCopySubjects] = useState(true);
  const [busy, setBusy] = useState(false);

  useEffect(() => { if (open) { setFrom(yearId); setTo(meta.school_years.find((y) => y.id !== yearId)?.id ?? yearId); } }, [open, yearId, meta]);

  const submit = async () => {
    setBusy(true);
    try {
      const r = await classService.cloneYear({ from_year_id: from, to_year_id: to, promote, copy_subjects: copySubjects });
      toast.success('Hoàn tất sao chép cơ cấu lớp',
        `+${r.classes_created} lớp mới · ${r.students_moved} học sinh lên lớp${r.graduated ? ` · ${r.graduated} học sinh tốt nghiệp` : ''}`);
      onDone(to); onClose();
    } catch (e) { toast.error('Không thể sao chép', getErrorMessage(e)); } finally { setBusy(false); }
  };

  const Toggle = ({ on, set, title, desc }: { on: boolean; set: (b: boolean) => void; title: string; desc: string }) => (
    <label className={`a-sel-row ${on ? 'on' : ''}`}>
      <input type="checkbox" className="a-check" checked={on} onChange={(e) => set(e.target.checked)} />
      <div><b>{title}</b><div className="a-muted" style={{ fontSize: 12.5 }}>{desc}</div></div>
    </label>
  );

  return (
    <Modal open={open} onClose={onClose} title="Sao chép sang năm học mới" subtitle="Dựng nhanh cơ cấu lớp và cho học sinh lên lớp" footer={
      <><button className="a-btn" onClick={onClose}>Hủy</button>
        <button className="a-btn pri" onClick={submit} disabled={busy || from === to}>{busy && <span className="a-spin" />} Thực hiện</button></>
    }>
      <div style={{ display: 'grid', gap: 14, paddingTop: 8 }}>
        <div className="a-grid2">
          <div className="a-field"><label>Từ năm học</label>
            <select className="a-select" value={from} onChange={(e) => setFrom(+e.target.value)}>
              {meta.school_years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}</select></div>
          <div className="a-field"><label>Sang năm học</label>
            <select className="a-select" value={to} onChange={(e) => setTo(+e.target.value)}>
              {meta.school_years.map((y) => <option key={y.id} value={y.id}>{y.label}</option>)}</select></div>
        </div>
        <Toggle on={promote} set={setPromote} title="Cho học sinh lên lớp" desc="10A1 → 11A1, 11A1 → 12A1. Học sinh khối 12 được ghi nhận tốt nghiệp." />
        <Toggle on={copySubjects} set={setCopySubjects} title="Sao chép phân công môn học & GV bộ môn" desc="Giữ nguyên danh sách môn và giáo viên của lớp nguồn." />
        <div className="a-badge warn" style={{ borderRadius: 12, padding: '10px 12px', fontWeight: 500 }}>
          Lớp hoặc học sinh đã tồn tại ở năm học đích sẽ được bỏ qua, không bị ghi đè.
        </div>
      </div>
    </Modal>
  );
}

/* ---------------- Phân công GVCN nhanh ---------------- */
export function HomeroomModal({ open, onClose, meta, target, onSaved }: {
  open: boolean; onClose: () => void; meta: ClassMeta; target: SchoolClass | null; onSaved: (c: SchoolClass) => void;
}) {
  const toast = useToast();
  const [tid, setTid] = useState<number | ''>('');
  const [busy, setBusy] = useState(false);
  useEffect(() => { if (open) setTid(target?.homeroom_teacher?.id ?? ''); }, [open, target]);
  if (!target) return null;

  const submit = async () => {
    setBusy(true);
    try {
      const c = await classService.setHomeroom(target.id, tid === '' ? null : tid);
      toast.success('Đã cập nhật GVCN', `Lớp ${c.name}: ${c.homeroom_teacher?.full_name ?? 'chưa có GVCN'}`);
      onSaved(c); onClose();
    } catch (e) { toast.error('Không thể phân công', getErrorMessage(e)); } finally { setBusy(false); }
  };

  const sameYear = target.school_year_id === meta.current_year_id;
  return (
    <Modal open={open} onClose={onClose} size="sm" title={`GVCN lớp ${target.name}`} subtitle={target.school_year_label} footer={
      <><button className="a-btn" onClick={onClose}>Hủy</button>
        <button className="a-btn pri" onClick={submit} disabled={busy}>{busy && <span className="a-spin" />} Lưu</button></>
    }>
      <div className="a-field" style={{ paddingTop: 8 }}>
        <label>Giáo viên chủ nhiệm</label>
        <select className="a-select" value={tid} onChange={(e) => setTid(e.target.value ? +e.target.value : '')}>
          <option value="">— Gỡ phân công —</option>
          {meta.teachers.map((t) => {
            const busyT = sameYear && t.homeroom_class_id && t.homeroom_class_id !== target.id;
            return <option key={t.id} value={t.id} disabled={!!busyT}>{t.full_name} · {t.main_subject}{busyT ? ` (đang CN ${t.homeroom_class_name})` : ''}</option>;
          })}
        </select>
        <span className="hint">Mỗi giáo viên chỉ chủ nhiệm một lớp trong một năm học.</span>
      </div>
    </Modal>
  );
}
